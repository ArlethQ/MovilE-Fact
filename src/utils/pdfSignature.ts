export const SIGNATURE_STAMP_SIZE_MM = { width: 50.3, height: 19.617 } as const;

export type PdfSignaturePlacement = {
  pagina: number;
  xMm: number;
  yMm: number;
  anchoMm: number;
  rotacion: number;
};

export type PdfSignaturePosition = { x: number; y: number; xMm: number; yMm: number };

export function restorePdfSignaturePlacements(placements: PdfSignaturePlacement[]) {
  return placements.filter((item) => item && Number.isInteger(item.pagina) && item.pagina > 0
    && Number.isFinite(item.xMm) && Number.isFinite(item.yMm)).slice(0, 2).map((item) => {
    // Legacy drafts used a 60 × 35 mm stamp. Keep the center of that physical box.
    const legacy = item.anchoMm === 60;
    return {
      ...item,
      xMm: Math.max(0, item.xMm + (legacy ? (60 - SIGNATURE_STAMP_SIZE_MM.width) / 2 : 0)),
      yMm: Math.max(0, item.yMm + (legacy ? (35 - SIGNATURE_STAMP_SIZE_MM.height) / 2 : 0)),
      anchoMm: SIGNATURE_STAMP_SIZE_MM.width,
    };
  });
}

// Runs inside the PDF WebView. Positions and marker sizes share the rendered page's
// physical dimensions, independent of CSS scale, device pixel ratio, and pinch zoom.
export function buildPdfSignatureInteractionScript() {
  return `
    const pageWidthMm = v.width * 25.4 / 72;
    const pageHeightMm = v.height * 25.4 / 72;
    const stampWidthMm = ${SIGNATURE_STAMP_SIZE_MM.width};
    const stampHeightMm = ${SIGNATURE_STAMP_SIZE_MM.height};
    const widthRatio = stampWidthMm / pageWidthMm;
    const heightRatio = stampHeightMm / pageHeightMm;
    const post = message => window.ReactNativeWebView.postMessage(JSON.stringify(message));
    const placeMarker = (element, position) => {
      element.style.left = (position.xMm / pageWidthMm * 100) + '%';
      element.style.top = (position.yMm / pageHeightMm * 100) + '%';
    };
    window.syncMarkers = items => {
      viewer.querySelectorAll('.marker').forEach(item => item.remove());
      items.forEach(item => {
        const element = document.createElement('div');
        element.className = 'marker';
        element.dataset.index = String(item.index);
        element.style.width = (widthRatio * 100) + '%';
        element.style.height = (heightRatio * 100) + '%';
        element.textContent = item.label;
        placeMarker(element, item);
        viewer.appendChild(element);
      });
    };
    let dragging = false, marker = null, pointerId = null, origin = null;
    let offsetX = 0, offsetY = 0;
    const moveMarker = event => {
      const rect = c.getBoundingClientRect();
      const xMm = Math.min(pageWidthMm - stampWidthMm,
        Math.max(0, ((event.clientX - rect.left) / rect.width - offsetX) * pageWidthMm - stampWidthMm / 2));
      const yMm = Math.min(pageHeightMm - stampHeightMm,
        Math.max(0, ((event.clientY - rect.top) / rect.height - offsetY) * pageHeightMm - stampHeightMm / 2));
      const position = { xMm, yMm, x: (xMm + stampWidthMm / 2) / pageWidthMm, y: (yMm + stampHeightMm / 2) / pageHeightMm };
      if (marker) placeMarker(marker, position);
      return position;
    };
    const resetDrag = () => {
      const activePointer = pointerId;
      dragging = false;
      marker = null;
      pointerId = null;
      if (viewer.hasPointerCapture(activePointer)) viewer.releasePointerCapture(activePointer);
      post({ type: 'drag', dragging: false });
    };
    const cancelDrag = () => {
      if (!dragging) return;
      if (marker && origin) { marker.style.left = origin.left; marker.style.top = origin.top; }
      resetDrag();
    };
    viewer.addEventListener('pointerdown', event => {
      if (dragging) { cancelDrag(); return; }
      if (event.isPrimary === false || event.button > 0) return;
      marker = event.target.closest('.marker');
      if (event.target !== c && !marker) return;
      if (widthRatio > 1 || heightRatio > 1) {
        post({ type: 'placementError', message: 'La página es más pequeña que el sello de firma.' });
        return;
      }
      const rect = c.getBoundingClientRect();
      origin = marker ? { left: marker.style.left, top: marker.style.top } : null;
      offsetX = marker ? (event.clientX - rect.left) / rect.width - parseFloat(marker.style.left) / 100 - widthRatio / 2 : 0;
      offsetY = marker ? (event.clientY - rect.top) / rect.height - parseFloat(marker.style.top) / 100 - heightRatio / 2 : 0;
      dragging = true;
      pointerId = event.pointerId;
      viewer.setPointerCapture(pointerId);
      post({ type: 'drag', dragging: true });
    });
    viewer.addEventListener('pointermove', event => {
      if (dragging && event.pointerId === pointerId) moveMarker(event);
    });
    viewer.addEventListener('pointerup', event => {
      if (!dragging || event.pointerId !== pointerId) return;
      const position = moveMarker(event);
      const index = marker ? Number(marker.dataset.index) : null;
      post(marker ? { type: 'move', index, ...position } : { type: 'position', ...position });
      resetDrag();
    });
    viewer.addEventListener('pointercancel', cancelDrag);
    viewer.addEventListener('lostpointercapture', cancelDrag);
  `;
}

export function buildPdfViewerHtml({ base64, pdfJsSource, workerSource, page, selectable }: {
  base64: string;
  pdfJsSource: string;
  workerSource: string;
  page: number;
  selectable: boolean;
}) {
  const clickHandler = selectable ? buildPdfSignatureInteractionScript() : '';
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>
        html,body{margin:0;background:#eef3f7}
        #stage{text-align:center;padding:12px;box-sizing:border-box}
        #viewer{position:relative;max-width:100%;margin:0 auto}
        #canvas{display:block;width:100%;height:auto;background:#fff;box-shadow:0 2px 8px #63758755}
        .marker{position:absolute;border:1px solid #087c3a;background:#e5f8ebdd;color:#087c3a;
          font:700 clamp(7px,2.5vw,11px)/1 Arial;white-space:nowrap;overflow:hidden;border-radius:4px;
          display:flex;align-items:center;justify-content:center;box-sizing:border-box;touch-action:none}
      </style></head><body><div id="stage"><div id="viewer"><canvas id="canvas"></canvas></div></div>
      <script type="module">${pdfJsSource}
      (async () => {
        const raw = atob('${base64}');
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const workerUrl = URL.createObjectURL(new Blob([${JSON.stringify(workerSource).replace(/</g, '\\u003c')}], { type: 'text/javascript' }));
        GlobalWorkerOptions.workerSrc = workerUrl;
        const task = getDocument({ data: bytes });
        window.addEventListener('pagehide', () => {
          void task.destroy();
          URL.revokeObjectURL(workerUrl);
        }, { once: true });
        const documentPdf = await task.promise;
        const send = message => window.ReactNativeWebView.postMessage(JSON.stringify(message));
        send({ type: 'pageCount', pageCount: documentPdf.numPages });
        const pdfPage = await documentPdf.getPage(Math.min(${page}, documentPdf.numPages));
        const v = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min((innerWidth - 24) / v.width, 1.5);
        const density = Math.min(3, window.devicePixelRatio || 2);
        const renderViewport = pdfPage.getViewport({ scale: scale * density });
        const c = document.getElementById('canvas');
        const viewer = document.getElementById('viewer');
        c.width = renderViewport.width;
        c.height = renderViewport.height;
        viewer.style.width = (v.width * scale) + 'px';
        new ResizeObserver(([entry]) => send({ type: 'height', height: Math.ceil(entry.contentRect.height + 24) })).observe(viewer);
        await pdfPage.render({ canvasContext: c.getContext('2d'), viewport: renderViewport }).promise;
        ${clickHandler}
        send({ type: 'ready' });
      })().catch(error => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'viewerError', message: error instanceof Error ? error.message : String(error) }));
        document.body.innerHTML = '<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">No se pudo mostrar el PDF.</p>';
      });</script></body></html>`;
}
