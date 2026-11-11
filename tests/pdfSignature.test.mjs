import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { buildPdfSignatureInteractionScript, restorePdfSignaturePlacements } from '../src/utils/pdfSignature.ts';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

function createViewer(widthMm, heightMm, cssWidth = 320, zoom = 1) {
  const rect = { left: 17, top: -63, width: cssWidth * zoom, height: cssWidth * zoom * heightMm / widthMm };
  const messages = [];
  const events = {};
  const markers = [];
  const captured = new Set();
  const c = { getBoundingClientRect: () => rect, closest: () => null };
  const viewer = {
    addEventListener: (name, handler) => { events[name] = handler; },
    querySelectorAll: () => [...markers],
    appendChild: (element) => markers.push(element),
    setPointerCapture: (id) => captured.add(id),
    hasPointerCapture: (id) => captured.has(id),
    releasePointerCapture: (id) => captured.delete(id),
  };
  const window = { ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) } };
  const document = { createElement: () => {
    const element = {
      style: {}, dataset: {}, closest: () => element,
      remove: () => markers.splice(markers.indexOf(element), 1),
    };
    return element;
  } };
  vm.runInNewContext(buildPdfSignatureInteractionScript(), {
    v: { width: widthMm * 72 / 25.4, height: heightMm * 72 / 25.4 }, c, viewer, document, window,
  });
  const fire = (name, x, y, target = c, pointerId = 1) => events[name]({
    clientX: rect.left + x * rect.width, clientY: rect.top + y * rect.height,
    target, pointerId, button: 0, isPrimary: pointerId === 1,
  });
  const tap = (x, y) => {
    fire('pointerdown', x, y);
    fire('pointerup', x, y);
    return messages.findLast((message) => message.type === 'position');
  };
  return { rect, messages, markers, captured, fire, tap, sync: window.syncMarkers };
}

for (const [name, width, height] of [['vertical', 210, 297], ['horizontal', 297, 210]]) {
  test(`Sello de 50,3 × 19,617 mm en página ${name}: escala, zoom y cuatro bordes`, () => {
    for (const cssWidth of [240, 390, 820]) {
      for (const zoom of [1, 2, 3]) {
        const view = createViewer(width, height, cssWidth, zoom);
        const center = view.tap(0.5, 0.5);
        closeTo(center.xMm, (width - 50.3) / 2);
        closeTo(center.yMm, (height - 19.617) / 2);
        for (const [x, y] of [[-0.2, -0.2], [1.2, -0.2], [-0.2, 1.2], [1.2, 1.2]]) {
          const placement = view.tap(x, y);
          closeTo(placement.xMm, x < 0 ? 0 : width - 50.3);
          closeTo(placement.yMm, y < 0 ? 0 : height - 19.617);
          view.sync([{ index: 0, ...placement, label: 'Firma 1' }]);
          const marker = view.markers[0];
          closeTo(parseFloat(marker.style.width) / 100 * width, 50.3);
          closeTo(parseFloat(marker.style.height) / 100 * height, 19.617);
          closeTo(parseFloat(marker.style.left) / 100 * width, placement.xMm);
          closeTo(parseFloat(marker.style.top) / 100 * height, placement.yMm);
          assert.ok(placement.xMm >= 0 && placement.xMm + 50.3 <= width + 1e-9);
          assert.ok(placement.yMm >= 0 && placement.yMm + 19.617 <= height + 1e-9);
        }
        assert.equal(view.captured.size, 0);
      }
    }
  });
}

test('Arrastrar conserva el punto de agarre y el índice de la segunda ubicación', () => {
  const view = createViewer(297, 210, 390, 2);
  view.sync([{ index: 1, xMm: 30, yMm: 40, label: 'Firma 2' }]);
  const marker = view.markers[0];
  const x = 35 / 297;
  const y = 43 / 210;
  view.fire('pointerdown', x, y, marker);
  view.fire('pointermove', x, y, marker);
  closeTo(parseFloat(marker.style.left) / 100 * 297, 30);
  closeTo(parseFloat(marker.style.top) / 100 * 210, 40);
  view.fire('pointermove', x + 20 / 297, y + 15 / 210, marker);
  view.fire('pointerup', x + 20 / 297, y + 15 / 210, marker);
  const move = view.messages.findLast((message) => message.type === 'move');
  assert.equal(move.index, 1);
  closeTo(move.xMm, 50);
  closeTo(move.yMm, 55);
  assert.deepEqual(view.messages.at(-1), { type: 'drag', dragging: false });
});

test('El arrastre se limita al borde y cancelar o iniciar un pellizco no guarda una ubicación', () => {
  const view = createViewer(210, 297);
  view.sync([{ index: 0, xMm: 30, yMm: 40, label: 'Firma 1' }]);
  const marker = view.markers[0];
  const originalStyle = { ...marker.style };
  view.fire('pointerdown', 0.2, 0.15, marker);
  view.fire('pointermove', 2, 2, marker);
  closeTo(parseFloat(marker.style.left) / 100 * 210, 159.7);
  closeTo(parseFloat(marker.style.top) / 100 * 297, 277.383);
  view.fire('pointercancel', 2, 2, marker);
  assert.deepEqual(marker.style, originalStyle);
  assert.equal(view.messages.some((message) => message.type === 'move'), false);
  view.fire('pointerdown', 0.5, 0.5);
  view.fire('pointerdown', 0.6, 0.6, undefined, 2);
  view.fire('pointerup', 0.5, 0.5);
  assert.equal(view.messages.some((message) => message.type === 'position'), false);
  assert.equal(view.captured.size, 0);
});

test('No se reduce el sello para páginas más pequeñas que sus dimensiones físicas', () => {
  const view = createViewer(40, 19);
  assert.equal(view.tap(0.5, 0.5), undefined);
  assert.equal(view.messages.at(-1).type, 'placementError');
});

test('Borradores de una o dos ubicaciones: migración centrada e idempotente', () => {
  const old = [
    { pagina: 1, xMm: 0, yMm: 0, anchoMm: 60, rotacion: 0 },
    { pagina: 2, xMm: 237, yMm: 175, anchoMm: 60, rotacion: 0 },
  ];
  for (const count of [1, 2]) {
    const restored = restorePdfSignaturePlacements(old.slice(0, count));
    assert.equal(restored.length, count);
    restored.forEach((item, index) => {
      assert.equal(item.pagina, index + 1);
      assert.equal(item.anchoMm, 50.3);
      closeTo(item.xMm + 50.3 / 2, old[index].xMm + 30);
      closeTo(item.yMm + 19.617 / 2, old[index].yMm + 17.5);
    });
    assert.deepEqual(restorePdfSignaturePlacements(restored), restored);
  }
  assert.equal(old[0].anchoMm, 60);
});
