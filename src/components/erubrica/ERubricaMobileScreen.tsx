import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../config/api';
import { ApiError, getAuthSessionCookie } from '../../services/apiClient';
import { ERubricaDashboard, ERubricaDocumentoFirmado, ERubricaDocumentoPendiente, ERubricaEmisor, ERubricaFirmaEstado, ERubricaSolicitudBorrador, appendERubricaFile, buscarERubricaSolicitudesProveedor, cargarERubricaDocumentoPendiente, configurarERubricaFirma, crearERubricaSolicitud, descargarERubricaFirmaP12, eliminarERubricaDocumentoPendiente, eliminarERubricaSolicitudBorrador, enviarTransferenciaERubricaSolicitud, firmarERubricaDocumento, getERubricaDocumentosFirmados, getERubricaDocumentosPendientes, getERubricaEmisores, getERubricaFirmaEstado, getERubricaPlan, getERubricaProductos, getERubricaRenovacion, getERubricaSaldo, getERubricaSolicitudBorradores, guardarERubricaSolicitudBorrador, iniciarPagoERubricaSolicitud, sincronizarERubricaSolicitud, validarERubricaFirmaPdf, validarERubricaFirmaTemporal, validarERubricaQr } from '../../services/erubricaMobileService';
import { EFACT_THEME, ERUBRICA_COLORS } from '../../styles/theme';
import { formatDocumentDate } from '../../utils/documentFormatting';
import { buildSignatureConfirmation } from '../../utils/signatureConfirmation';
import { buildDeviceFileName } from '../../utils/fileUtils';
import { validateEmail, validateIdentificacion } from '../../utils/authValidation';
import { EmptyState } from '../ui/FeedbackStates';
import { Field, MessageBox, PrimaryButton, SecondaryButton } from '../ui/FormControls';
import { ResultCollection } from '../data/ResultCollection';
import { styles } from '../../styles/appStyles';
import type { BotFeedbackState, BotMessage } from '../../types/bot';
import { EfactBotScreen, type BotVoiceControls } from '../bot/EfactBotScreen';
import { SOLICITUD_FILES_INITIAL, SOLICITUD_FORM_INITIAL, SOLICITUD_UBICACIONES_ECUADOR, type ERubricaTab, type SolicitudDocumentoKey } from '../../features/erubrica/erubricaTypes';

const MemoizedWebView = React.memo(WebView);

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
} | null;

type ERubricaSolicitudPrefill = {
  nombres?: string;
  apellidos?: string;
  identificacion?: string;
  correo?: string;
  celular?: string;
};

function getDocumentAssetUrl(response: { url?: string | null } | string) {
  const value = typeof response === 'string' ? response : response.url;
  if (!value) return '';
  return value.startsWith('http') ? value : `${API_BASE_URL.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
}

const PDFJS_VIEWER_URI = Image.resolveAssetSource(require('../../../assets/pdfjs/pdf.min.pdf')).uri;
const PDFJS_WORKER_URI = Image.resolveAssetSource(require('../../../assets/pdfjs/pdf.worker.min.pdf')).uri;
const PDF_ORIGIN_WHITELIST = ['*'];
const TEXTO_SOLICITUD_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,'&()\-]+$/;

function getSignatureDraftKey(userId: number, uri: string) {
  const safeUri = uri.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-100);
  return `efact.erubrica.signature.${userId}.${safeUri}`;
}

const ERUBRICA_BOT_ROUTE_MAP: Record<string, ERubricaTab> = {
  '/e-rubrica': 'inicio',
  '/e-rubrica/configuracion/firma': 'firma-config',
  '/e-rubrica/configuracion/plan': 'plan-disponible',
  '/e-rubrica/plan-disponible': 'plan-disponible',
  '/e-rubrica/mis-firmas': 'ver-mis-firmas',
  '/solicitud/pagos': 'historial-solicitudes',
  '/solicitud/nueva': 'nueva-solicitud',
  '/e-rubrica/documentos': 'historial-documentos',
  '/e-rubrica/documentos-por-firmar': 'documentos-por-firmar',
  '/e-rubrica/documentos/por-firmar': 'documentos-por-firmar',
  '/e-rubrica/documentos/firmar': 'firmar',
  '/e-rubrica/documentos/validar-firma': 'validar-firma',
};

const ERUBRICA_BOT_ACTION_MAP: Record<string, ERubricaTab> = {
  abrir_plan: 'plan-disponible',
  abrir_solicitud: 'nueva-solicitud',
  abrir_pagos: 'historial-solicitudes',
  abrir_configuracion_firma: 'firma-config',
  abrir_firma_pdf: 'firmar',
  abrir_validar_firma: 'validar-firma',
  abrir_documentos: 'historial-documentos',
  abrir_mis_firmas: 'ver-mis-firmas',
};

function getERubricaBotTab(route: string) {
  const normalized = route.trim().toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';
  return ERUBRICA_BOT_ROUTE_MAP[normalized];
}

function getERubricaBotActionTab(action?: string) {
  return action ? ERUBRICA_BOT_ACTION_MAP[action.trim().toLowerCase()] : undefined;
}

function textoSolicitudValido(value: string, maxLength = 100) {
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength && TEXTO_SOLICITUD_VALIDO.test(text);
}

function telefonoSolicitudValido(value: string) {
  const digits = value.replace(/\D/g, '');
  return /^[0-9+()\-\s]+$/.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}

function tipoIdentificacionSolicitud(value: string): 'CEDULA' | 'RUC' | 'PASAPORTE' {
  if (/ruc/i.test(value)) return 'RUC';
  if (/pasaporte/i.test(value)) return 'PASAPORTE';
  return 'CEDULA';
}

function usePdfJsSource(uri: string) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const readers = uri.startsWith('file:')
        ? [
            () => FileSystem.readAsStringAsync(uri),
            async () => {
              const response = await fetch(uri);
              if (!response.ok) throw new Error(`asset-${response.status}`);
              return response.text();
            },
          ]
        : [
            async () => {
              const response = await fetch(uri);
              if (!response.ok) throw new Error(`asset-${response.status}`);
              return response.text();
            },
            () => FileSystem.readAsStringAsync(uri),
          ];

      try {
        for (const read of readers) {
          try {
            const value = await read();
            if (value.trim()) {
              if (mounted) setSource(value);
              return;
            }
          } catch {
            // Try the next supported asset transport.
          }
        }
        throw new Error('empty-pdfjs-source');
      } catch {
        if (mounted) setSource('');
      }
    };
    void load();
    return () => { mounted = false; };
  }, [uri]);

  return source;
}

function writeBinaryCacheFile(fileName: string, bytes: ArrayBuffer) {
  const file = new File(Paths.cache, fileName);
  file.write(new Uint8Array(bytes));
  return file.uri;
}

export function PdfDocumentPreview({
  uri,
  selectable = false,
  page = 1,
  position = { x: 0.68, y: 0.82 },
  placements = [],
  onPositionChange,
  onPlacementMove,
  onPlacementDelete,
  onPageSizeChange,
  onPageCountChange,
  onDragChange,
}: {
  uri: string;
  selectable?: boolean;
  page?: number;
  position?: { x: number; y: number };
  placements?: Array<{ page: number; x: number; y: number; label: string }>;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onPlacementMove?: (index: number, position: { x: number; y: number }) => void;
  onPlacementDelete?: (index: number) => void;
  onPageSizeChange?: (size: { widthMm: number; heightMm: number }) => void;
  onPageCountChange?: (pageCount: number) => void;
  onDragChange?: (dragging: boolean) => void;
}) {
  const [base64, setBase64] = useState<string | null>(null);
  const [renderedHeight, setRenderedHeight] = useState(420);
  const pdfWebViewRef = useRef<WebView>(null);
  const pdfJsViewerSource = usePdfJsSource(PDFJS_VIEWER_URI);
  const pdfJsWorkerSource = usePdfJsSource(PDFJS_WORKER_URI);
  const pdfJsSource = pdfJsViewerSource && pdfJsWorkerSource ? `${pdfJsViewerSource}\n${pdfJsWorkerSource}` : null;
  const pdfJsUnavailable = pdfJsViewerSource === '' || pdfJsWorkerSource === '';
  useEffect(() => {
    let mounted = true;
    setBase64(null);
    setRenderedHeight(420);
    FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      .then((value) => { if (mounted) setBase64(value.startsWith('JVBERi0') ? value : ''); })
      .catch(() => { if (mounted) setBase64(''); });
    return () => { mounted = false; };
  }, [uri]);

  const clickHandler = selectable ? `window.syncMarkers=items=>{document.querySelectorAll('.marker').forEach(item=>item.remove());items.forEach(item=>{const element=document.createElement('div');element.className='marker';element.dataset.index=String(item.index);element.style.left=(item.x*100)+'%';element.style.top=(item.y*100)+'%';element.textContent=item.label;viewer.appendChild(element)})};let dragging=false,marker=null;const moveMarker=e=>{const r=c.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));if(marker){marker.style.left=(x*100)+'%';marker.style.top=(y*100)+'%'}return{x,y}};viewer.addEventListener('pointerdown',e=>{marker=e.target.closest('.marker');if(e.target!==c&&!marker)return;dragging=true;viewer.setPointerCapture&&viewer.setPointerCapture(e.pointerId);window.ReactNativeWebView.postMessage(JSON.stringify({type:'drag',dragging:true}));moveMarker(e)});viewer.addEventListener('pointermove',e=>{if(dragging)moveMarker(e)});const finish=e=>{if(!dragging)return;dragging=false;const p=moveMarker(e);const index=marker&&Number(marker.dataset.index);window.ReactNativeWebView.postMessage(JSON.stringify(marker&&Number.isInteger(index)?{type:'move',index,x:p.x,y:p.y}:{type:'position',x:p.x,y:p.y}));marker=null;window.ReactNativeWebView.postMessage(JSON.stringify({type:'drag',dragging:false}))};viewer.addEventListener('pointerup',finish);viewer.addEventListener('pointercancel',finish);` : '';
  const sizeHandler = selectable ? `window.ReactNativeWebView.postMessage(JSON.stringify({type:'size',widthMm:v.width*25.4/72,heightMm:v.height*25.4/72}));` : '';
  const html = React.useMemo(() => base64 && pdfJsSource ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>html,body{margin:0;background:#eef3f7}#stage{text-align:center;padding:12px;box-sizing:border-box}#viewer{display:inline-block;position:relative}#canvas{display:block;background:#fff;max-width:100%;box-shadow:0 2px 8px #63758755}.marker{position:absolute;transform:translate(-50%,-50%);width:84px;height:36px;border:2px solid #087c3a;background:#e5f8ebdd;color:#087c3a;font:700 11px Arial;border-radius:4px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;touch-action:none}</style></head><body><div id="stage"><div id="viewer"><canvas id="canvas"></canvas></div></div><script>${pdfJsSource}</script><script>try{const r=atob('${base64}'),b=new Uint8Array(r.length);for(let i=0;i<r.length;i++)b[i]=r.charCodeAt(i);pdfjsLib.getDocument({data:b,disableWorker:true}).promise.then(d=>{window.ReactNativeWebView.postMessage(JSON.stringify({type:'pageCount',pageCount:d.numPages}));return d.getPage(Math.min(${page},d.numPages))}).then(p=>{const v=p.getViewport({scale:1}),s=Math.min((innerWidth-24)/v.width,1.5),d=Math.min(3,window.devicePixelRatio||2),q=p.getViewport({scale:s}),h=p.getViewport({scale:s*d}),c=document.getElementById('canvas'),viewer=document.getElementById('viewer');c.width=h.width;c.height=h.height;c.style.width=q.width+'px';c.style.height=q.height+'px';${sizeHandler}window.ReactNativeWebView.postMessage(JSON.stringify({type:'height',height:Math.ceil(q.height+24)}));return p.render({canvasContext:c.getContext('2d'),viewport:h}).promise.then(()=>{${clickHandler};window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}))})}).catch(()=>document.body.innerHTML='<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">No se pudo mostrar el PDF.</p>')}catch(e){document.body.innerHTML='<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">No se pudo mostrar el PDF.</p>'}</script></body></html>` : base64 === '' ? '<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">El archivo descargado no es un PDF válido.</p>' : pdfJsUnavailable ? '<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">No se pudo iniciar el visor de PDF.</p>' : '<p style="padding:24px;text-align:center;font-family:Arial;color:#637587">Cargando PDF…</p>', [base64, clickHandler, page, pdfJsSource, pdfJsUnavailable, sizeHandler]);
  const visibleMarkers = placements.map((placement, index) => ({ ...placement, index })).filter((placement) => placement.page === page);
  const syncMarkers = () => pdfWebViewRef.current?.injectJavaScript(`window.syncMarkers&&window.syncMarkers(${JSON.stringify(visibleMarkers)});true;`);
  useEffect(syncMarkers, [placements, page]);
  const preview = <MemoizedWebView ref={pdfWebViewRef} originWhitelist={['*']} source={React.useMemo(() => ({ html }), [html])} javaScriptEnabled style={[styles.pdfDocumentWebView, { height: renderedHeight }]} onMessage={(event) => { try { const result = JSON.parse(event.nativeEvent.data) as { type?: string; dragging?: boolean; index?: number; x?: number; y?: number; widthMm?: number; heightMm?: number; height?: number; pageCount?: number }; if (result.type === 'ready') syncMarkers(); if (result.type === 'drag' && typeof result.dragging === 'boolean') onDragChange?.(result.dragging); if (result.type === 'position' && typeof result.x === 'number' && typeof result.y === 'number') onPositionChange?.({ x: result.x, y: result.y }); if (result.type === 'move' && typeof result.index === 'number' && typeof result.x === 'number' && typeof result.y === 'number') onPlacementMove?.(result.index, { x: result.x, y: result.y }); if (result.type === 'size' && typeof result.widthMm === 'number' && typeof result.heightMm === 'number') onPageSizeChange?.({ widthMm: result.widthMm, heightMm: result.heightMm }); if (result.type === 'height' && typeof result.height === 'number') setRenderedHeight(Math.max(240, Math.min(820, result.height))); if (result.type === 'pageCount' && typeof result.pageCount === 'number') onPageCountChange?.(result.pageCount); } catch { /* ignore viewer messages */ } }} />;
  if (!selectable) return preview;
  return <View style={styles.pdfPositionCard}>
    <View style={styles.pdfPositionHeader}><View style={styles.pdfPositionCopy}><Text style={styles.clientDetailLabel}>Ubicación de la firma</Text><Text style={styles.clientMeta}>Toca el PDF para elegir dónde se colocará la firma.</Text></View><View style={styles.pdfPositionBadge}><MaterialCommunityIcons name="gesture-tap" size={16} color={ERUBRICA_COLORS.primary} /><Text style={styles.pdfPositionBadgeText}>TÁCTIL</Text></View></View>
    {placements.length > 0 ? <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>{placements.map((placement, index) => <Pressable key={`eliminar-firma-${index}`} onPress={() => onPlacementDelete?.(index)} style={{ alignItems: 'center', backgroundColor: '#FFF4F5', borderColor: '#E8A1AC', borderRadius: 7, borderWidth: 1, flex: 1, paddingHorizontal: 8, paddingVertical: 7 }}><Text style={{ color: '#A7273A', fontSize: 11, fontWeight: '800' }}>Eliminar {placement.label}</Text></Pressable>)}</View> : null}
    {preview}
    <View style={styles.pdfPositionInfo}><MaterialCommunityIcons name="information-outline" size={18} color={ERUBRICA_COLORS.primary} /><Text style={styles.pdfPositionInfoText}>Posición horizontal {Math.round(position.x * 100)}% · vertical {Math.round(position.y * 100)}%</Text></View>
  </View>;
}

function PdfPageToolbar({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  return <View style={styles.pdfPageToolbar}>
    <Pressable accessibilityLabel="Página anterior" disabled={page <= 1} style={[styles.pdfPageButton, page <= 1 && styles.pdfPageButtonDisabled]} onPress={() => onPageChange(page - 1)}><MaterialCommunityIcons name="chevron-left" size={22} color={ERUBRICA_COLORS.primary} /></Pressable>
    <Text style={styles.pdfPageLabel}>Página {page} de {pageCount}</Text>
    <Pressable accessibilityLabel="Página siguiente" disabled={page >= pageCount} style={[styles.pdfPageButton, page >= pageCount && styles.pdfPageButtonDisabled]} onPress={() => onPageChange(page + 1)}><MaterialCommunityIcons name="chevron-right" size={22} color={ERUBRICA_COLORS.primary} /></Pressable>
  </View>;
}

type CompactSelectOption = { label: string; value: string };

function CompactSelect({
  title,
  placeholder,
  value,
  options,
  disabled = false,
  onValueChange,
}: {
  title: string;
  placeholder: string;
  value: string;
  options: CompactSelectOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return <>
    <Pressable disabled={disabled} style={[styles.erubricaCompactSelect, disabled && styles.erubricaCompactSelectDisabled]} onPress={() => setIsOpen(true)}>
      <Text numberOfLines={1} style={[styles.erubricaCompactSelectText, !selected && styles.erubricaCompactSelectPlaceholder]}>{selected?.label ?? placeholder}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={disabled ? '#9AAABA' : ERUBRICA_COLORS.primary} />
    </Pressable>
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
      <View style={styles.erubricaPaymentOverlay}>
        <View style={styles.erubricaCompactSelectSheet}>
          <View style={styles.erubricaCompactSelectHeader}>
            <Text style={styles.erubricaPaymentTitle}>{title}</Text>
            <Pressable style={styles.erubricaPaymentClose} onPress={() => setIsOpen(false)}>
              <MaterialCommunityIcons name="close" size={20} color={ERUBRICA_COLORS.primary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.erubricaCompactSelectOptions}>
            {options.map((option) => {
              const active = option.value === value;
              return <Pressable key={option.value} style={[styles.erubricaCompactSelectOption, active && styles.erubricaCompactSelectOptionActive]} onPress={() => { onValueChange(option.value); setIsOpen(false); }}>
                <Text style={[styles.erubricaCompactSelectOptionText, active && styles.erubricaCompactSelectOptionTextActive]}>{option.label}</Text>
                {active ? <MaterialCommunityIcons name="check-circle" size={20} color={ERUBRICA_COLORS.primary} /> : null}
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

export function ERubricaMobileScreen({
  data,
  puedeFirmarSinPlan,
  initialPdf,
  requestedTab,
  loading,
  message,
  onTabChange,
  onRefresh,
  onPreviewPdf,
  onPreviewRemotePdf,
  onDownloadRemotePdf,
  onSync,
  onOpenBot,
  onPdfPositionDragChange,
  voiceControlsRef,
  userName,
  userId,
  solicitudPrefill,
}: {
  data: ERubricaDashboard | null;
  puedeFirmarSinPlan: boolean;
  initialPdf?: { uri: string; name: string; mimeType?: string } | null;
  requestedTab?: ERubricaTab | null;
  loading: boolean;
  message: MessageState;
  onTabChange: (tab: ERubricaTab) => void;
  onRefresh: () => void;
  onPreviewPdf: (file: { uri: string; name: string; mimeType?: string }) => void;
  onPreviewRemotePdf: (urlOrPath: string, fileName: string) => void;
  onDownloadRemotePdf: (urlOrPath: string, fileName: string) => void;
  onSync: () => Promise<void>;
  onOpenBot: () => void;
  onPdfPositionDragChange: (dragging: boolean) => void;
  voiceControlsRef?: React.MutableRefObject<BotVoiceControls | null>;
  userName: string;
  userId: number;
  solicitudPrefill?: ERubricaSolicitudPrefill;
}) {
  const [tab, setTab] = useState<ERubricaTab>('inicio');
  const [qrInput, setQrInput] = useState('');
  const [qrResult, setQrResult] = useState<unknown>(null);
  const [validatingQr, setValidatingQr] = useState(false);
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(initialPdf ?? null);
  const [certificateFile, setCertificateFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  const [signing, setSigning] = useState(false);
  const signingRef = useRef(false);
  const [signedFileUri, setSignedFileUri] = useState<string | null>(null);
  const [pdfValidation, setPdfValidation] = useState<unknown>(null);
  const [validatingPdf, setValidatingPdf] = useState(false);
  const validatingPdfRef = useRef(false);
  const [catalogos, setCatalogos] = useState<unknown[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [renovacion, setRenovacion] = useState<unknown>(null);
  const [planDisponible, setPlanDisponible] = useState<unknown>(null);
  const [proveedorItems, setProveedorItems] = useState<unknown[]>([]);
  const [documentosPendientes, setDocumentosPendientes] = useState<ERubricaDocumentoPendiente[]>([]);
  const [loadingDocumentosPendientes, setLoadingDocumentosPendientes] = useState(false);
  const [documentoPendienteSeleccionado, setDocumentoPendienteSeleccionado] = useState<string | null>(null);
  const [documentosFirmados, setDocumentosFirmados] = useState<ERubricaDocumentoFirmado[]>([]);
  const [loadingDocumentosFirmados, setLoadingDocumentosFirmados] = useState(false);
  const [firmaEmisores, setFirmaEmisores] = useState<ERubricaEmisor[]>([]);
  const [firmaEmisorSeleccionadoId, setFirmaEmisorSeleccionadoId] = useState<number | null>(null);
  const [firmaEmisoresCargados, setFirmaEmisoresCargados] = useState(false);
  const [firmaDetalleActiva, setFirmaDetalleActiva] = useState<ERubricaFirmaEstado | null>(null);
  const [loadingFirmaDetalle, setLoadingFirmaDetalle] = useState(false);
  const [validandoFirmaTemporal, setValidandoFirmaTemporal] = useState(false);
  const [savingConfiguredSignature, setSavingConfiguredSignature] = useState(false);
  const [signedDocumentsModalOpen, setSignedDocumentsModalOpen] = useState(false);
  const [pendingDocumentsModalOpen, setPendingDocumentsModalOpen] = useState(false);
  const [loadingSignedDocument, setLoadingSignedDocument] = useState(false);
  const [historialQuery, setHistorialQuery] = useState('');
  const [historialDate, setHistorialDate] = useState('');
  const [historialStatus, setHistorialStatus] = useState('');
  const [syncingSolicitudId, setSyncingSolicitudId] = useState<number | null>(null);
  const [signaturePage, setSignaturePage] = useState(1);
  const [signaturePageCount, setSignaturePageCount] = useState(1);
  const [validationPage, setValidationPage] = useState(1);
  const [validationPageCount, setValidationPageCount] = useState(1);
  const [signaturePosition, setSignaturePosition] = useState({ x: 0.68, y: 0.82 });
  const [signaturePageSize, setSignaturePageSize] = useState({ widthMm: 210, heightMm: 297 });
  const [signaturePlacements, setSignaturePlacements] = useState<Array<{ pagina: number; xMm: number; yMm: number; anchoMm: number; rotacion: number }>>([]);
  const signaturePlacementsRef = useRef(signaturePlacements);
  const [signatureMarkers, setSignatureMarkers] = useState<Array<{ page: number; x: number; y: number }>>([]);
  const [signaturePlacementLimit, setSignaturePlacementLimit] = useState(1);
  const collectingSignaturePlacementRef = useRef(true);
  const signatureDraftKeyRef = useRef<string | null>(null);
  const signatureDraftLoadedRef = useRef(false);
  const [solicitudStep, setSolicitudStep] = useState(1);
  const [solicitudPlan, setSolicitudPlan] = useState({ label: '7 días', price: 9 });
  const [solicitudPersona, setSolicitudPersona] = useState<string | null>(null);
  const [solicitudForm, setSolicitudForm] = useState(SOLICITUD_FORM_INITIAL);
  const [solicitudCatalogos] = useState<{ nacionalidades: string[]; provincias: Array<{ nombre: string; cantones: string[] }> }>({
    nacionalidades: ['ECUATORIANA', 'ARGENTINA', 'BOLIVIANA', 'BRASILEÑA', 'CHILENA', 'COLOMBIANA', 'ESPAÑOLA', 'ESTADOUNIDENSE', 'MEXICANA', 'PERUANA', 'VENEZOLANA', 'OTRA'],
    provincias: SOLICITUD_UBICACIONES_ECUADOR.map(([nombre, cantones]) => ({ nombre, cantones: [...cantones] })),
  });
  const [showSolicitudBirthDate, setShowSolicitudBirthDate] = useState(false);
  const [solicitudFiles, setSolicitudFiles] = useState(SOLICITUD_FILES_INITIAL);
  const [solicitudId, setSolicitudId] = useState<number | null>(null);
  const [solicitudSaving, setSolicitudSaving] = useState(false);
  const [solicitudBorradores, setSolicitudBorradores] = useState<ERubricaSolicitudBorrador[]>([]);
  const [solicitudBorradoresOpen, setSolicitudBorradoresOpen] = useState(false);
  const [loadingSolicitudBorradores, setLoadingSolicitudBorradores] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'deuna' | 'transferencia'>('deuna');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({ banco: '', titular: '', cuenta: '', comprobante: '' });
  const [transferReceipt, setTransferReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<BotMessage[]>([]);
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantFeedback, setAssistantFeedback] = useState<BotFeedbackState>({});
  const [assistantActionTab, setAssistantActionTab] = useState<ERubricaTab | null>(null);
  const voiceStartPendingRef = useRef(false);
  const contentTab = assistantActionTab ?? tab;
  const guidedByVoice = tab === 'asistente' && assistantActionTab === 'nueva-solicitud';
  const openAssistantDocumentArea = (nextTab?: ERubricaTab) => {
    if (nextTab !== 'firmar' && nextTab !== 'validar-firma' && nextTab !== 'nueva-solicitud' && nextTab !== 'firma-config') return;
    if (nextTab === 'nueva-solicitud') setSolicitudStep(4);
    setAssistantActionTab(nextTab);
  };
  const handleAssistantUiAction = (action: string) => {
    if (action === 'adjuntar_comprobante_pago') {
      setPaymentMethod('transferencia');
      setPaymentModalOpen(true);
      return;
    }
    openAssistantDocumentArea(getERubricaBotActionTab(action));
  };
  useEffect(() => {
    if (tab !== 'asistente' || !voiceStartPendingRef.current || !voiceControlsRef) return undefined;
    const timer = setTimeout(() => {
      voiceStartPendingRef.current = false;
      voiceControlsRef.current?.startHandsFree();
    }, 150);
    return () => clearTimeout(timer);
  }, [tab, voiceControlsRef]);
  useEffect(() => {
    if (!pdfFile?.uri) {
      signatureDraftKeyRef.current = null;
      signatureDraftLoadedRef.current = false;
      return undefined;
    }

    const key = getSignatureDraftKey(userId, pdfFile.uri);
    signatureDraftKeyRef.current = key;
    signatureDraftLoadedRef.current = false;
    let mounted = true;
    void SecureStore.getItemAsync(key).then((raw) => {
      if (!mounted) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as {
            page?: number;
            position?: { x?: number; y?: number };
            pageSize?: { widthMm?: number; heightMm?: number };
            placements?: Array<{ pagina: number; xMm: number; yMm: number; anchoMm: number; rotacion: number }>;
            markers?: Array<{ page: number; x: number; y: number }>;
            placementLimit?: number;
          };
          if (saved.page && saved.page > 0) setSignaturePage(saved.page);
          if (saved.position && typeof saved.position.x === 'number' && typeof saved.position.y === 'number') setSignaturePosition({ x: saved.position.x, y: saved.position.y });
          if (saved.pageSize && typeof saved.pageSize.widthMm === 'number' && typeof saved.pageSize.heightMm === 'number') setSignaturePageSize({ widthMm: saved.pageSize.widthMm, heightMm: saved.pageSize.heightMm });
          if (Array.isArray(saved.placements)) setSignaturePlacements(saved.placements);
          if (Array.isArray(saved.markers)) setSignatureMarkers(saved.markers);
          if (saved.placementLimit === 2) setSignaturePlacementLimit(2);
          collectingSignaturePlacementRef.current = (saved.markers?.length ?? 0) < (saved.placementLimit === 2 ? 2 : 1);
        } catch {
          void SecureStore.deleteItemAsync(key);
        }
      }
      signatureDraftLoadedRef.current = true;
    }).catch(() => {
      if (mounted) signatureDraftLoadedRef.current = true;
    });
    return () => { mounted = false; };
  }, [pdfFile?.uri, userId]);
  useEffect(() => {
    const key = signatureDraftKeyRef.current;
    if (!pdfFile?.uri || !key || !signatureDraftLoadedRef.current) return;
    void SecureStore.setItemAsync(key, JSON.stringify({
      page: signaturePage,
      position: signaturePosition,
      pageSize: signaturePageSize,
      placements: signaturePlacements,
      markers: signatureMarkers,
      placementLimit: signaturePlacementLimit,
    })).catch(() => undefined);
  }, [pdfFile?.uri, signaturePage, signaturePosition, signaturePageSize, signaturePlacements, signatureMarkers, signaturePlacementLimit]);
  const limpiarPdfTemporal = () => {
    setPdfFile(null);
    setPdfValidation(null);
    setSignedFileUri(null);
    setSignedDocumentsModalOpen(false);
    setDocumentoPendienteSeleccionado(null);
    setSignaturePage(1);
    setSignaturePageCount(1);
    setValidationPage(1);
    setValidationPageCount(1);
    setSignaturePosition({ x: 0.68, y: 0.82 });
    setSignaturePlacements([]);
    signaturePlacementsRef.current = [];
    setSignatureMarkers([]);
    setSignaturePlacementLimit(1);
    collectingSignaturePlacementRef.current = true;
  };
  const seleccionarCantidadUbicaciones = () => {
    Alert.alert('Ubicaciones de firma', '¿Deseas firmar en uno o dos lugares del documento?', [
      { text: 'Firmar en un solo lugar', onPress: () => { setSignaturePlacementLimit(1); collectingSignaturePlacementRef.current = true; } },
      { text: 'Firmar en dos lugares', onPress: () => { setSignaturePlacementLimit(2); collectingSignaturePlacementRef.current = true; } },
    ]);
  };
  const agregarSegundaUbicacionFirma = () => {
    setSignaturePlacementLimit(2);
    collectingSignaturePlacementRef.current = true;
  };
  const registrarUbicacionFirma = (position: { x: number; y: number }) => {
    const currentPlacements = signaturePlacementsRef.current;
    if (!collectingSignaturePlacementRef.current || currentPlacements.length >= signaturePlacementLimit) return;

    setSignaturePosition(position);
    const anchoMm = 60;
    const altoMm = 35;
    const xMm = Math.min(Math.max(0, signaturePageSize.widthMm - anchoMm), Math.max(0, position.x * signaturePageSize.widthMm - anchoMm / 2));
    const yMm = Math.min(Math.max(0, signaturePageSize.heightMm - altoMm), Math.max(0, position.y * signaturePageSize.heightMm - altoMm / 2));
    const nextPlacements = [...currentPlacements, { pagina: signaturePage, xMm: Math.round(xMm), yMm: Math.round(yMm), anchoMm, rotacion: 0 }];
    signaturePlacementsRef.current = nextPlacements;
    setSignaturePlacements(nextPlacements);
    setSignatureMarkers((current) => [...current, { page: signaturePage, x: position.x, y: position.y }]);
    collectingSignaturePlacementRef.current = nextPlacements.length < signaturePlacementLimit;
  };
  const moverUbicacionFirma = (index: number, position: { x: number; y: number }) => {
    if (index < 0 || index >= signaturePlacements.length) return;

    const anchoMm = 60;
    const altoMm = 35;
    const xMm = Math.min(Math.max(0, signaturePageSize.widthMm - anchoMm), Math.max(0, position.x * signaturePageSize.widthMm - anchoMm / 2));
    const yMm = Math.min(Math.max(0, signaturePageSize.heightMm - altoMm), Math.max(0, position.y * signaturePageSize.heightMm - altoMm / 2));
    setSignaturePosition(position);
    setSignatureMarkers((current) => current.map((marker, markerIndex) => markerIndex === index ? { ...marker, x: position.x, y: position.y } : marker));
    const nextPlacements = signaturePlacementsRef.current.map((placement, placementIndex) => placementIndex === index
      ? { ...placement, xMm: Math.round(xMm), yMm: Math.round(yMm), anchoMm }
      : placement);
    signaturePlacementsRef.current = nextPlacements;
    setSignaturePlacements(nextPlacements);
  };
  const eliminarUbicacionFirma = (index: number) => {
    setSignatureMarkers((current) => current.filter((_, markerIndex) => markerIndex !== index));
    const nextPlacements = signaturePlacementsRef.current.filter((_, placementIndex) => placementIndex !== index);
    signaturePlacementsRef.current = nextPlacements;
    setSignaturePlacements(nextPlacements);
    collectingSignaturePlacementRef.current = true;
  };
  const selectTab = (nextTab: ERubricaTab) => {
    onPdfPositionDragChange(false);
    if ((contentTab === 'firmar' || contentTab === 'validar-firma') && nextTab !== contentTab) {
      limpiarPdfTemporal();
    }
    if (nextTab === 'firmar' && !puedeFirmarPdf) {
      Alert.alert('Firma no disponible', 'Primero adquiere una firma de E-RÚBRICA para usar Firmar PDF.');
      nextTab = 'plan-disponible';
    }
    if (tab === 'asistente' && assistantActionTab) {
      setAssistantActionTab(nextTab === 'inicio' ? null : nextTab);
      return;
    }
    setTab(nextTab);
    onTabChange(nextTab);
  };
  const buildSolicitudFormFromProfile = (persona: string) => {
    const identificacion = solicitudPrefill?.identificacion?.replace(/\D/g, '') ?? '';
    const apellidos = (solicitudPrefill?.apellidos ?? '').trim().split(/\s+/).filter(Boolean);
    const isCedula = /^\d{10}$/.test(identificacion);
    const isRuc = /^\d{13}$/.test(identificacion);
    return {
      ...SOLICITUD_FORM_INITIAL,
      poseeRuc: persona !== 'Persona natural con cédula',
      tipoDocumento: isCedula ? 'CEDULA' : '',
      identificacion: isCedula && persona !== 'Representante legal' ? identificacion : '',
      ruc: isRuc && persona !== 'Persona natural con cédula' ? identificacion : '',
      nombres: (solicitudPrefill?.nombres ?? '').trim(),
      primerApellido: apellidos[0] ?? '',
      segundoApellido: apellidos.slice(1).join(' '),
      celular: (solicitudPrefill?.celular ?? '').trim(),
      correo: (solicitudPrefill?.correo ?? '').trim(),
    };
  };
  useEffect(() => {
    if (!initialPdf) return;
    let mounted = true;
    const openIncomingPdf = async () => {
      setPdfFile(initialPdf);
      if (puedeFirmarSinPlan) {
        selectTab('firmar');
        return;
      }
      const plan = planDisponible ?? await getERubricaPlan().catch(() => null);
      if (!mounted) return;
      if (plan) setPlanDisponible(plan);
      const hasActivePlan = label(plan, ['tieneFirmaPagada'], 'false').toLowerCase() === 'true'
        && label(plan, ['estado'], '').toLowerCase() === 'activo';
      const nextTab = hasActivePlan ? 'firmar' : 'plan-disponible';
      setTab(nextTab);
      onTabChange(nextTab);
    };
    void openIncomingPdf();
    return () => { mounted = false; };
  }, [initialPdf]);
  useEffect(() => {
    const nextTab = requestedTab === 'asistente' ? 'inicio' : requestedTab ?? 'inicio';
    if ((tab === 'firmar' || tab === 'validar-firma') && nextTab !== tab)
      limpiarPdfTemporal();
    setAssistantActionTab(null);
    setTab(nextTab);
  }, [requestedTab]);
  const dashboardRecord = data as (ERubricaDashboard & Record<string, unknown>) | null;
  const dashboardPayload = (dashboardRecord?.data ?? dashboardRecord?.Data ?? dashboardRecord) as (ERubricaDashboard & Record<string, unknown>) | null;
  const solicitudesData = dashboardPayload?.solicitudes ?? dashboardPayload?.Solicitudes;
  const firmasData = dashboardPayload?.firmas ?? dashboardPayload?.Firmas;
  const menusData = dashboardPayload?.menus ?? dashboardPayload?.Menus;
  const solicitudes = Array.isArray(solicitudesData) ? solicitudesData : [];
  const firmas = Array.isArray(firmasData) ? firmasData : [];
  const menus = Array.isArray(menusData) ? menusData : [];
  const label = (item: unknown, keys: string[], fallback: string) => {
    if (!item || typeof item !== 'object') return fallback;
    const record = item as Record<string, unknown>;
    const value = keys.map((key) => record[key]).find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim());
    return value === undefined ? fallback : String(value);
  };
  const itemValue = (item: unknown, keys: string[]) => {
    if (!item || typeof item !== 'object') return '';
    const record = item as Record<string, unknown>;
    const value = keys.map((key) => record[key]).find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim());
    return value === undefined ? '' : String(value);
  };
  const buildSolicitudTitular = (item: unknown, fallback = 'Titular') => {
    const composed = `${itemValue(item, ['solNombres', 'SolNombres'])} ${itemValue(item, ['solPrimerApellido', 'SolPrimerApellido'])} ${itemValue(item, ['solSegundoApellido', 'SolSegundoApellido'])}`.trim();
    return composed || label(item, ['titular', 'nombreTitular', 'solicitante', 'nombres', 'nombre', 'cliente', 'razonSocial'], fallback);
  };
  const recuperarSolicitudBorrador = (datosJson: string) => {
    const datos = JSON.parse(datosJson) as Record<string, unknown>;
    if (datos.solicitudForm && typeof datos.solicitudForm === 'object') {
      return {
        plan: datos.solicitudPlan as typeof solicitudPlan | undefined,
        persona: typeof datos.solicitudPersona === 'string' ? datos.solicitudPersona : null,
        form: datos.solicitudForm as typeof solicitudForm,
      };
    }

    const get = (...keys: string[]) => {
      const value = keys.map((key) => datos[key]).find((item) => item !== null && item !== undefined && String(item).trim());
      return value === undefined ? '' : String(value);
    };
    const tieneRuc = get('SolTieneRuc', 'solTieneRuc').toLowerCase() === 'true';
    const tipoPersona = get('SolTipoPersona', 'solTipoPersona').toUpperCase();
    if (!tipoPersona) throw new Error('invalid-draft');
    const vigencias: Record<string, typeof solicitudPlan> = {
      '7 DIAS': { label: '7 días', price: 9 },
      '30 DIAS': { label: '30 días', price: 12 },
      '1 ANIO': { label: '1 año', price: 21 },
      '2 ANIOS': { label: '2 años', price: 31 },
      '3 ANIOS': { label: '3 años', price: 40 },
      '4 ANIOS': { label: '4 años', price: 49 },
      '5 ANIOS': { label: '5 años', price: 57 },
    };
    const vigencia = get('SolVigencia', 'solVigencia').toUpperCase();
    return {
      plan: vigencias[vigencia] ?? { label: '7 días', price: 9 },
      persona: tipoPersona === 'JURIDICA'
        ? 'Representante legal'
        : tieneRuc ? 'Persona natural con RUC' : 'Persona natural con cédula',
      form: {
        ...SOLICITUD_FORM_INITIAL,
        tipoDocumento: get('SolTipoIdentificacion', 'solTipoIdentificacion'),
        identificacion: get('SolIdentificacion', 'solIdentificacion'),
        codigoDactilar: get('SolCodigoDactilar', 'solCodigoDactilar'),
        poseeRuc: tieneRuc,
        ruc: get('SolNroRuc', 'solNroRuc'),
        nombres: get('SolNombres', 'solNombres'),
        primerApellido: get('SolPrimerApellido', 'solPrimerApellido'),
        segundoApellido: get('SolSegundoApellido', 'solSegundoApellido'),
        fechaNacimiento: get('SolFechaNacimiento', 'solFechaNacimiento').split('T')[0],
        nacionalidad: get('SolNacionalidad', 'solNacionalidad') || SOLICITUD_FORM_INITIAL.nacionalidad,
        sexo: get('SolSexo', 'solSexo'),
        celular: get('SolTelefono1', 'solTelefono1'),
        telefonoSecundario: get('SolTelefono2', 'solTelefono2'),
        correo: get('SolCorreo1', 'solCorreo1'),
        correoSecundario: get('SolCorreo2', 'solCorreo2'),
        provincia: get('SolProvincia', 'solProvincia'),
        canton: get('SolCanton', 'solCanton'),
        direccion: get('SolDireccion', 'solDireccion'),
        razonSocialEmpresa: get('SolCompanyName', 'solCompanyName'),
        departamento: get('SolDepartment', 'solDepartment'),
        cargo: get('SolPosition', 'solPosition'),
        motivoFirma: get('SolReason', 'solReason'),
        representanteTipoDocumento: get('SolIdentificationTypeManager', 'solIdentificationTypeManager'),
        representanteIdentificacion: get('SolIdentificationManager', 'solIdentificationManager'),
        representanteNombres: get('SolNamesManager', 'solNamesManager'),
        representanteApellidos: get('SolLastNameManager', 'solLastNameManager'),
      },
    };
  };
  const renovacionActual = planDisponible ?? renovacion ?? dashboardPayload?.renovacion ?? dashboardPayload?.Renovacion;
  const activeFirma = firmas[0] ?? null;
  const firmaEmisorOptions = firmaEmisores.map((item) => ({
    label: item.nomComercial || item.razonSocial || item.ruc || `Emisor ${item.id}`,
    value: String(item.id),
  }));
  const firmasConfiguradas = firmaEmisores.filter((item) => item.tieneCertificado && item.tieneClave);
  const firmaEfact = firmasConfiguradas.find((item) => item.id === firmaEmisorSeleccionadoId) ?? null;
  const firmaEfactValida = Boolean(firmaDetalleActiva?.esValida ?? firmaEfact?.esValida);
  const firmaTitular = firmaDetalleActiva?.nombreTitular || firmaEfact?.razonSocial || 'Titular no disponible';
  const firmaIdentificacion = firmaDetalleActiva?.identificacion || label(activeFirma, ['identificacion', 'solIdentificacion', 'SolIdentificacion', 'ruc', 'cedula', 'documento'], 'Sin dato');
  const firmaEstado = firmaDetalleActiva?.estadoVigencia || label(activeFirma, ['estado', 'estadoVigencia', 'status'], firmaEfact ? 'Configurada' : 'Sin firma');
  const firmaEmision = firmaDetalleActiva?.fechaEmision ? formatDocumentDate(firmaDetalleActiva.fechaEmision) : label(activeFirma, ['fechaEmision', 'solFechaAprobacion', 'SolFechaAprobacion', 'emitida', 'fechaInicio'], 'Sin dato');
  const firmaExpira = firmaDetalleActiva?.fechaExpiracion ? formatDocumentDate(firmaDetalleActiva.fechaExpiracion) : label(activeFirma, ['fechaExpiracion', 'solFechaActualizacion', 'SolFechaActualizacion', 'expira', 'fechaFin'], 'Sin dato');
  const firmaEfactExpira = firmaDetalleActiva?.fechaExpiracion ? formatDocumentDate(firmaDetalleActiva.fechaExpiracion) : firmaEfact?.fechaExpiracion ? formatDocumentDate(firmaEfact.fechaExpiracion) : firmaExpira;
  const firmaDiasRestantes = firmaDetalleActiva?.diasRestantes !== undefined && firmaDetalleActiva?.diasRestantes !== null ? `${firmaDetalleActiva.diasRestantes} días` : label(activeFirma, ['diasRestantes', 'vigenciaRestante'], 'Sin dato');
  const firmaAutoridad = firmaDetalleActiva?.emisor || label(activeFirma, ['autoridadEmisora', 'emisor', 'ca'], 'Sin dato');
  const firmaSerie = firmaDetalleActiva?.numeroSerie || label(activeFirma, ['numeroSerie', 'serie', 'serial'], 'Sin dato');
  const firmaHuella = firmaDetalleActiva?.huellaDigital || label(activeFirma, ['huellaDigital', 'fingerprint', 'huella'], 'Sin dato');
  const planDiasRestantes = label(renovacionActual, ['diasRestantes', 'vigenciaRestante', 'dias'], firmaDiasRestantes);
  const planFechaVencimiento = label(renovacionActual, ['fechaVencimiento', 'fechaExpiracion', 'vence'], firmaExpira);
  const planEstado = label(renovacionActual, ['estado', 'estadoAcceso', 'status'], firmaEstado);
  const puedeFirmarPdf = puedeFirmarSinPlan || (
    label(planDisponible, ['tieneFirmaPagada'], 'false').toLowerCase() === 'true' &&
    planEstado.toLowerCase() === 'activo'
  );
  const cantonesSolicitud = solicitudCatalogos.provincias
    .find((provincia) => provincia.nombre === solicitudForm.provincia)?.cantones ?? [];
  const formatSignedDate = (item: unknown) => {
    const raw = itemValue(item, ['fechaFirma', 'solFechaSolicitud', 'SolFechaSolicitud', 'solFechaAprobacion', 'SolFechaAprobacion', 'fecha', 'fechaCreacion', 'createdAt', 'signedAt']);
    if (!raw) return { date: 'Sin fecha', time: '' };
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { date: raw.split('T')[0] || raw, time: raw.includes('T') ? raw.split('T')[1]?.slice(0, 8) ?? '' : '' };
    return {
      date: parsed.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: parsed.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
    };
  };
  const historialDocumentos = documentosFirmados.length ? documentosFirmados : firmas;
  const signedMonthCount = historialDocumentos.filter((item) => {
    const parsed = new Date(itemValue(item, ['fechaFirma', 'solFechaSolicitud', 'SolFechaSolicitud', 'solFechaAprobacion', 'SolFechaAprobacion', 'fecha', 'fechaCreacion', 'createdAt', 'signedAt']));
    const now = new Date();
    return !Number.isNaN(parsed.getTime()) && parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
  }).length;
  const filteredFirmas = historialDocumentos.filter((item) => {
    const documentName = label(item, ['nombreDocumento', 'nombreArchivo', 'documento', 'archivo', 'fileName', 'nombre', 'descripcion'], '').toLowerCase();
    return !historialQuery.trim() || documentName.includes(historialQuery.trim().toLowerCase());
  });
  const documentosPorFirmar = solicitudes.filter((item) => {
    const status = label(item, ['estado', 'status', 'solEstado', 'estadoSolicitud', 'EstadoSolicitud'], 'pendiente').toLowerCase();
    return !status.includes('firmad') && !status.includes('valid');
  });
  const filteredDocumentosPorFirmar = documentosPorFirmar.filter((item) => {
    const content = JSON.stringify(item).toLowerCase();
    const status = label(item, ['estado', 'status', 'solEstado', 'estadoSolicitud', 'EstadoSolicitud'], 'pendiente').toLowerCase();
    const rawDate = itemValue(item, ['fecha', 'fechaCreacion', 'createdAt', 'fechaSolicitud', 'solFechaSolicitud', 'SolFechaSolicitud']).toLowerCase();
    return (!historialQuery.trim() || content.includes(historialQuery.trim().toLowerCase()))
      && (!historialDate.trim() || rawDate.includes(historialDate.trim().toLowerCase()))
      && (!historialStatus.trim() || status.includes(historialStatus.trim().toLowerCase()));
  });
  const historialSolicitudes = solicitudes.filter((item) => {
    const status = label(item, ['estado', 'status', 'solEstado', 'estadoSolicitud', 'EstadoSolicitud'], '').toLowerCase();
    return Boolean(status) && (status.includes('firmad') || status.includes('aprob') || status.includes('caduc') || status.includes('rechaz'));
  });
  const solicitudHistoryItems = historialSolicitudes.length ? historialSolicitudes : solicitudes;
  const filteredHistorialSolicitudes = solicitudHistoryItems.filter((item) => {
    const content = JSON.stringify(item).toLowerCase();
    return !historialQuery.trim() || content.includes(historialQuery.trim().toLowerCase());
  });
  const solicitudesPagadas = solicitudHistoryItems.filter((item) => {
    const status = label(item, ['estadoPago', 'pago', 'estado', 'status', 'estadoSolicitud', 'EstadoSolicitud'], '').toLowerCase();
    return status.includes('pag') || status.includes('aprob');
  }).length;
  const solicitudesPendientes = solicitudHistoryItems.filter((item) => {
    const status = label(item, ['estadoPago', 'pago', 'estado', 'status', 'estadoSolicitud', 'EstadoSolicitud'], 'pendiente').toLowerCase();
    return status.includes('pend');
  }).length;
  const { width } = useWindowDimensions();
  const [bannerWidth, setBannerWidth] = useState(Math.max(width - 30, 1));
  const bannerHeight = Math.round(bannerWidth * 941 / 1672);
  const inicioCompacto = width < 390;
  const pagoInicio = solicitudesPagadas > 0 ? 'Pagado' : solicitudesPendientes > 0 ? 'Pendiente' : 'Sin solicitudes';
  const uanatacaInicio = label(activeFirma, ['estadoUanataca', 'SolUanatacaStatusText', 'uanatacaStatus', 'estado'], 'No enviado');
  const recientesInicio = historialDocumentos.slice(0, 3);
  const porFirmarInicio = documentosPendientes.length || documentosPorFirmar.length;
  const cargarFirmaActiva = async (mostrarError = false) => {
    try {
      setLoadingFirmaDetalle(true);
      const emisores = (await getERubricaEmisores()).filter((item) => item.id > 0);
      setFirmaEmisores(emisores);
      const configurados = emisores.filter((item) => item.tieneCertificado && item.tieneClave);
      const emisorSeleccionado = configurados.find((item) => item.id === firmaEmisorSeleccionadoId)
        ?? (configurados.length === 1 ? configurados[0] : emisores.length === 1 ? emisores[0] : null);
      setFirmaEmisorSeleccionadoId(emisorSeleccionado?.id ?? null);
      const emisorActivo = emisorSeleccionado;
      setFirmaDetalleActiva(emisorActivo ? await getERubricaFirmaEstado(emisorActivo.id) : null);
    } catch (error) {
      setFirmaDetalleActiva(null);
      if (mostrarError) Alert.alert('No se pudo actualizar la firma', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setFirmaEmisoresCargados(true);
      setLoadingFirmaDetalle(false);
    }
  };
  useEffect(() => {
    if ((contentTab === 'catalogos' || contentTab === 'plan-disponible' || contentTab === 'nueva-solicitud') && catalogos.length === 0) {
      void getERubricaProductos().then((items) => setCatalogos(items ?? [])).catch(() => undefined);
      void getERubricaSaldo().then((balance) => setSaldo(Number(balance?.balance ?? 0))).catch(() => undefined);
    }
    if ((contentTab === 'renovacion' || contentTab === 'plan-disponible' || contentTab === 'nueva-solicitud') && renovacion === null) void getERubricaRenovacion().then(setRenovacion).catch(() => undefined);
    if (contentTab === 'plan-disponible' && planDisponible === null) void getERubricaPlan().then(setPlanDisponible).catch(() => undefined);
    if ((contentTab === 'firma-config' || contentTab === 'firmar') && !firmaEmisoresCargados) void cargarFirmaActiva();
  }, [catalogos.length, contentTab, firmaEmisoresCargados, renovacion]);
  const cargarDocumentosFirmados = async () => {
    try {
      setLoadingDocumentosFirmados(true);
      setDocumentosFirmados(await getERubricaDocumentosFirmados());
    } catch (error) {
      Alert.alert('No se pudo cargar el historial', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setLoadingDocumentosFirmados(false);
    }
  };
  useEffect(() => {
    if (tab === 'inicio' || tab === 'historial-documentos' || tab === 'validar-firma') void cargarDocumentosFirmados();
  }, [tab]);
  const cargarDocumentosPendientes = async () => {
    try {
      setLoadingDocumentosPendientes(true);
      setDocumentosPendientes(await getERubricaDocumentosPendientes());
    } catch (error) {
      Alert.alert('No se pudieron cargar los documentos', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setLoadingDocumentosPendientes(false);
    }
  };
  useEffect(() => {
    if (tab === 'inicio' || tab === 'documentos-por-firmar') void cargarDocumentosPendientes();
  }, [tab]);
  const useSignedDocumentForValidation = async (item: unknown) => {
    const documentName = label(item, ['nombreDocumento', 'documento', 'archivo', 'fileName'], 'Documento firmado.pdf');
    const documentUrl = itemValue(item, ['url', 'downloadUrl', 'documentoUrl', 'ruta', 'archivoUrl']);
    if (!documentUrl) {
      Alert.alert('Documento no disponible', 'No se encontró el archivo PDF para validar.');
      return;
    }

    try {
      setLoadingSignedDocument(true);
      const url = documentUrl.startsWith('http')
        ? documentUrl
        : `${API_BASE_URL.replace(/\/$/, '')}/${documentUrl.replace(/^\//, '')}`;
      if (!url) throw new Error('empty-url');
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) throw new Error('missing-directory');
      const safeName = buildDeviceFileName(documentName, '.pdf');
      const cookie = getAuthSessionCookie();
      const download = await FileSystem.downloadAsync(url, `${directory}validar-${Date.now()}-${safeName}`, cookie ? { headers: { Cookie: cookie } } : undefined);
      setPdfFile({ uri: download.uri, name: documentName, mimeType: 'application/pdf' });
      setPdfValidation(null);
      setValidationPage(1);
      setValidationPageCount(1);
      setSignedDocumentsModalOpen(false);
      return true;
    } catch (error) {
      Alert.alert('No se pudo cargar el documento', error instanceof ApiError ? error.message : 'No se pudo descargar el PDF firmado.');
      return false;
    } finally {
      setLoadingSignedDocument(false);
    }
  };
  const validarDocumentoFirmado = async (item: ERubricaDocumentoFirmado) => {
    if (await useSignedDocumentForValidation(item)) selectTab('validar-firma');
  };
  const sincronizarSolicitudHistorial = async (solicitudId: number) => {
    try {
      setSyncingSolicitudId(solicitudId);
      await sincronizarERubricaSolicitud(solicitudId);
      onRefresh();
    } catch (error) {
      Alert.alert('No se pudo actualizar la solicitud', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setSyncingSolicitudId(null);
    }
  };
  const descargarFirmaSolicitud = async (solicitudId: number) => {
    try {
      const result = await descargarERubricaFirmaP12(solicitudId);
      const uri = writeBinaryCacheFile(`firma-${solicitudId}.p12`, result.bytes);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/x-pkcs12', dialogTitle: 'Guardar firma .p12' });
    } catch (error) {
      Alert.alert('No se pudo descargar la firma', error instanceof ApiError ? error.message : 'La firma aún no está disponible.');
    }
  };
  const usarDocumentoPendiente = async (documento: ERubricaDocumentoPendiente) => {
    try {
      setLoadingDocumentosPendientes(true);
      const url = getDocumentAssetUrl(documento.url);
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!url || !directory) throw new Error('missing-document');
      const cookie = getAuthSessionCookie();
      const download = await FileSystem.downloadAsync(url, `${directory}firmar-${Date.now()}-${buildDeviceFileName(documento.nombreDocumento, '.pdf')}`, cookie ? { headers: { Cookie: cookie } } : undefined);
      selectTab('firmar');
      setPdfFile({ uri: download.uri, name: documento.nombreDocumento, mimeType: 'application/pdf' });
      setDocumentoPendienteSeleccionado(documento.nombreArchivo);
      setSignaturePage(1);
      setSignaturePageCount(1);
      setSignaturePlacements([]);
      signaturePlacementsRef.current = [];
      setSignatureMarkers([]);
      setSignaturePlacementLimit(1);
      collectingSignaturePlacementRef.current = true;
      seleccionarCantidadUbicaciones();
    } catch (error) {
      Alert.alert('No se pudo abrir el documento', error instanceof ApiError ? error.message : 'No se pudo descargar el PDF seleccionado.');
    } finally {
      setLoadingDocumentosPendientes(false);
    }
  };
  const cargarNuevoDocumentoPendiente = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.size ?? 0) > 10 * 1024 * 1024) {
      Alert.alert('Archivo no válido', 'Selecciona un PDF de máximo 10 MB.');
      return;
    }
    try {
      setLoadingDocumentosPendientes(true);
      const uploaded = await cargarERubricaDocumentoPendiente(file);
      setDocumentosPendientes((current) => [{ ...uploaded, nombreDocumento: file.name || uploaded.nombreDocumento }, ...current]);
      Alert.alert('Documento cargado', '¿Deseas seguir cargando documentos?', [
        { text: 'No, terminar', style: 'cancel' },
        { text: 'Sí, seguir cargando', onPress: () => void cargarNuevoDocumentoPendiente() },
      ]);
    } catch (error) {
      Alert.alert('No se pudo cargar el documento', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setLoadingDocumentosPendientes(false);
    }
  };
  const eliminarDocumentoPendiente = async (documento: ERubricaDocumentoPendiente) => {
    Alert.alert('Eliminar documento', `¿Deseas eliminar ${documento.nombreDocumento}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: () => {
          void eliminarERubricaDocumentoPendiente(documento.nombreArchivo)
            .then(() => setDocumentosPendientes((current) => current.filter((item) => item.nombreArchivo !== documento.nombreArchivo)))
            .catch((error) => Alert.alert('No se pudo eliminar', error instanceof ApiError ? error.message : 'Intenta nuevamente.'));
        },
      },
    ]);
  };
  const saveConfiguredSignature = async () => {
    const emisorId = firmaEmisorSeleccionadoId ?? (firmaEmisores.length === 1 ? firmaEmisores[0]?.id : undefined);
    if (!certificateFile || !certificatePassword.trim()) {
      if (firmaEfact) {
        Alert.alert(firmaEfactValida ? 'Firma vigente' : 'Firma configurada', firmaEfactValida ? 'Ya estás usando la firma configurada.' : 'La firma existente requiere revisión antes de usarla.');
        return;
      }
      Alert.alert('Datos incompletos', 'Selecciona el archivo .p12 e ingresa la clave.');
      return;
    }
    if (!emisorId) {
      Alert.alert('Selecciona un emisor', 'Elige el emisor donde se cargará el certificado.');
      return;
    }
    try {
      setSavingConfiguredSignature(true);
      await configurarERubricaFirma(emisorId, certificateFile, certificatePassword.trim());
      setCertificateFile(null);
      setCertificatePassword('');
      await cargarFirmaActiva();
      onRefresh();
      Alert.alert('Firma configurada', 'El certificado fue validado y guardado correctamente.');
    } catch (error) {
      Alert.alert('No se pudo guardar la firma', error instanceof ApiError ? error.message : 'Verifica el certificado y su clave.');
    } finally {
      setSavingConfiguredSignature(false);
    }
  };
  const validarFirmaTemporal = async () => {
    if (!certificateFile || !certificatePassword.trim()) {
      Alert.alert('Datos incompletos', 'Selecciona el archivo .p12 e ingresa la clave.');
      return;
    }
    try {
      setValidandoFirmaTemporal(true);
      const resultado = await validarERubricaFirmaTemporal(certificateFile, certificatePassword.trim());
      Alert.alert(resultado.esValida ? 'Firma válida' : 'Firma no válida', resultado.mensaje || (resultado.esValida ? 'La firma y la clave son correctas. El archivo no fue guardado.' : 'Verifica el archivo y su clave.'));
    } catch (error) {
      Alert.alert('No se pudo validar la firma', error instanceof ApiError ? error.message : 'Verifica el archivo y su clave.');
    } finally {
      setCertificateFile(null);
      setCertificatePassword('');
      setValidandoFirmaTemporal(false);
    }
  };
  const pickPdfToSign = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled) {
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.pdf') || (file.size ?? 0) > 10 * 1024 * 1024) {
        Alert.alert('Archivo no válido', 'Selecciona un PDF de máximo 10 MB.');
        return;
      }
      setPdfFile(file);
      setDocumentoPendienteSeleccionado(null);
      setSignedFileUri(null);
      setSignaturePage(1);
      setSignaturePageCount(1);
      setValidationPage(1);
      setValidationPageCount(1);
      setSignaturePosition({ x: 0.68, y: 0.82 });
      setSignaturePlacements([]);
      signaturePlacementsRef.current = [];
      setSignatureMarkers([]);
      setSignaturePlacementLimit(1);
      collectingSignaturePlacementRef.current = true;
      seleccionarCantidadUbicaciones();
    }
  };
  const pickPdfToValidate = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.size ?? 0) > 10 * 1024 * 1024) {
      Alert.alert('Archivo no válido', 'Selecciona un PDF de máximo 10 MB.');
      return;
    }

    setPdfFile(file);
    setPdfValidation(null);
    setValidationPage(1);
    setValidationPageCount(1);
  };
  const pickCertificate = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/x-pkcs12', 'application/pkcs12', 'application/octet-stream'], copyToCacheDirectory: true });
    if (!result.canceled) {
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.p12') || (file.size ?? 0) > 5 * 1024 * 1024) {
        Alert.alert('Certificado no válido', 'Selecciona un archivo .p12 de máximo 5 MB.');
        return;
      }
      setCertificateFile(file);
    }
  };
  const signPdfDocument = async (preview = false) => {
    if (signingRef.current) return;
    if (!pdfFile) {
      Alert.alert('Datos incompletos', 'Selecciona un PDF válido.');
      return;
    }
    if (signaturePlacements.length === 0) {
      Alert.alert('Ubicación requerida', 'Toca el PDF para registrar al menos una ubicación de firma.');
      return;
    }
    signingRef.current = true;
    setSigning(true);
    setSignedFileUri(null);
    try {
      let configuredCount = firmasConfiguradas.length;
      let emisorFirma = firmaEmisores.find((item) => item.id === firmaEmisorSeleccionadoId && item.tieneCertificado && item.tieneClave) ?? null;
      if (!emisorFirma) {
        const emisores = (await getERubricaEmisores()).filter((item) => item.id > 0);
        setFirmaEmisores(emisores);
        const configurados = emisores.filter((item) => item.tieneCertificado && item.tieneClave);
        configuredCount = configurados.length;
        const seleccionado = configurados.find((item) => item.id === firmaEmisorSeleccionadoId)
          ?? (configurados.length === 1 ? configurados[0] : null);
        setFirmaEmisorSeleccionadoId(seleccionado?.id ?? null);
        emisorFirma = seleccionado;
      }
      if (!emisorFirma) {
        Alert.alert('Selecciona una firma', configuredCount > 1
          ? 'Selecciona el certificado previamente configurado que deseas utilizar.'
          : 'Configura primero el certificado .p12 y su clave en la vista Firma.');
        return;
      }
      const form = new FormData();
      appendERubricaFile(form, 'pdf', { uri: pdfFile.uri, name: pdfFile.name || 'documento.pdf' });
      form.append('nombreOriginal', pdfFile.name || 'documento.pdf');
      form.append('idEmisor', String(emisorFirma.id));
      form.append('pagina', String(signaturePage));
      const signatureWidthMm = 60;
      const signatureHeightMm = 35;
      const pageWidthMm = Number.isFinite(signaturePageSize.widthMm) && signaturePageSize.widthMm > 0 ? signaturePageSize.widthMm : 210;
      const pageHeightMm = Number.isFinite(signaturePageSize.heightMm) && signaturePageSize.heightMm > 0 ? signaturePageSize.heightMm : 297;
      const positionX = Number.isFinite(signaturePosition.x) ? Math.min(1, Math.max(0, signaturePosition.x)) : 0.68;
      const positionY = Number.isFinite(signaturePosition.y) ? Math.min(1, Math.max(0, signaturePosition.y)) : 0.82;
      const xMm = Math.min(Math.max(0, pageWidthMm - signatureWidthMm), Math.max(0, positionX * pageWidthMm - signatureWidthMm / 2));
      const yMm = Math.min(Math.max(0, pageHeightMm - signatureHeightMm), Math.max(0, positionY * pageHeightMm - signatureHeightMm / 2));
      form.append('xMm', String(Math.round(Math.min(2000, Math.max(0, xMm)))));
      form.append('yMm', String(Math.round(Math.min(2000, Math.max(0, yMm)))));
      form.append('anchoMm', '60');
      form.append('posiciones', JSON.stringify(signaturePlacements));
      if (documentoPendienteSeleccionado) form.append('documentoPendiente', documentoPendienteSeleccionado);
      const result = await firmarERubricaDocumento(form);
      const signedName = `${(pdfFile.name || 'documento.pdf').replace(/\.pdf$/i, '')}_firmado.pdf`;
      const uri = writeBinaryCacheFile(`${Date.now()}-${buildDeviceFileName(signedName, '.pdf')}`, result.bytes);
      if (preview) {
        onPreviewPdf({ uri, name: signedName, mimeType: 'application/pdf' });
      } else {
        setSignedFileUri(uri);
        if (documentoPendienteSeleccionado) {
          setDocumentosPendientes((current) => current.filter((item) => item.nombreArchivo !== documentoPendienteSeleccionado));
          setDocumentoPendienteSeleccionado(null);
        }
        Alert.alert('Documento firmado', 'El PDF se firmó correctamente. ¿Qué deseas hacer ahora?', [
          { text: 'Después', style: 'cancel' },
          { text: 'Compartir ahora', onPress: () => { void shareSignedDocument(); } },
        ]);
      }
    } catch (error) {
      Alert.alert('No se pudo firmar', error instanceof ApiError ? error.message : 'Verifica los archivos y la clave del certificado.');
    } finally {
      signingRef.current = false;
      setSigning(false);
    }
  };
  const confirmSignPdfDocument = () => {
    if (!pdfFile) {
      Alert.alert('Datos incompletos', 'Selecciona un PDF válido.');
      return;
    }
    if (signaturePlacements.length === 0) {
      Alert.alert('Ubicación requerida', 'Toca el PDF para registrar al menos una ubicación de firma.');
      return;
    }
    const confirmation = buildSignatureConfirmation({
      documentName: pdfFile.name || 'documento.pdf',
      placementCount: signaturePlacements.length,
      certificateHolder: firmaDetalleActiva?.nombreTitular
        ?? firmaEmisores.find((item) => item.tieneCertificado && item.tieneClave)?.razonSocial,
    });
    Alert.alert(confirmation.title, confirmation.message, [
      { text: 'Revisar', style: 'cancel' },
      { text: 'Firmar ahora', onPress: () => { void signPdfDocument(); } },
    ]);
  };
  const validatePdfSignature = async () => {
    if (validatingPdfRef.current) return;
    if (!pdfFile) {
      Alert.alert('Selecciona un PDF', 'Carga primero el documento que deseas validar.');
      return;
    }
    validatingPdfRef.current = true;
    setValidatingPdf(true);
    setPdfValidation(null);
    try { setPdfValidation(await validarERubricaFirmaPdf(pdfFile)); }
    catch (error) { setPdfValidation({ mensaje: error instanceof ApiError ? error.message : 'No se pudo validar el PDF.' }); }
    finally {
      validatingPdfRef.current = false;
      setValidatingPdf(false);
    }
  };
  const shareSignedDocument = async () => {
    if (!signedFileUri) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('No disponible', 'Este dispositivo no permite compartir archivos.');
      return;
    }
    await Sharing.shareAsync(signedFileUri, { mimeType: 'application/pdf', dialogTitle: 'Compartir documento firmado', UTI: 'com.adobe.pdf' });
  };
  const solicitudSubtotal = solicitudPlan.price;
  const solicitudIva = Number((solicitudSubtotal * 0.15).toFixed(2));
  const solicitudTotal = Number((solicitudSubtotal + solicitudIva).toFixed(2));
  const parseSolicitudAge = () => {
    const parts = solicitudForm.fechaNacimiento.trim().split(/[/-]/).map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return 0;
    const [day, month, year] = parts[0] > 31 ? [parts[2], parts[1], parts[0]] : parts;
    const birth = new Date(year, month - 1, day);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (birth > new Date(today.getFullYear() - age, today.getMonth(), today.getDate())) age -= 1;
    return age;
  };
  const solicitudDocumentoItems = [
    { key: 'cedulaFrontal' as SolicitudDocumentoKey, label: 'Documento de identificación frontal *', types: ['image/*', 'application/pdf'] },
    { key: 'cedulaPosterior' as SolicitudDocumentoKey, label: 'Documento de identificación posterior *', types: ['image/*', 'application/pdf'] },
    { key: 'selfieCedula' as SolicitudDocumentoKey, label: 'Selfie sosteniendo su documento *', types: ['image/*'] },
    ...(parseSolicitudAge() >= 65 ? [{ key: 'videoAceptacion' as SolicitudDocumentoKey, label: 'Video de aceptación *', types: ['video/*'] }] : []),
    ...(solicitudForm.poseeRuc || solicitudPersona === 'Representante legal' ? [{ key: 'rucFile' as SolicitudDocumentoKey, label: 'Archivo RUC *', types: ['application/pdf'] }] : []),
    ...(solicitudPersona === 'Representante legal' ? [
      { key: 'nombramiento' as SolicitudDocumentoKey, label: 'Nombramiento *', types: ['application/pdf'] },
      { key: 'constitucion' as SolicitudDocumentoKey, label: 'Constitución *', types: ['application/pdf'] },
      { key: 'cedulaRepresentante' as SolicitudDocumentoKey, label: 'Cédula del representante *', types: ['image/*', 'application/pdf'] },
      { key: 'autorizacion' as SolicitudDocumentoKey, label: 'Autorización *', types: ['application/pdf'] },
      { key: 'aceptacionNombramiento' as SolicitudDocumentoKey, label: 'Aceptación de nombramiento *', types: ['application/pdf'] },
    ] : []),
    { key: 'archivoAdicional' as SolicitudDocumentoKey, label: 'Documento adicional', types: ['image/*', 'application/pdf'] },
  ];
  const pickSolicitudFile = async (key: SolicitudDocumentoKey, types: string[]) => {
    const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
    if (!result.canceled) {
      const file = result.assets[0];
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const allowedExtensions = key === 'videoAceptacion'
        ? ['mp4', 'mov', 'avi', 'webm']
        : key === 'selfieCedula'
          ? ['jpg', 'jpeg', 'png']
          : ['jpg', 'jpeg', 'png', 'pdf'];
      const mustBePdf = ['rucFile', 'nombramiento', 'constitucion', 'autorizacion', 'aceptacionNombramiento'].includes(key);
      const maxBytes = key === 'videoAceptacion' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!allowedExtensions.includes(extension) || (mustBePdf && extension !== 'pdf') || (file.size ?? 0) <= 0 || (file.size ?? 0) > maxBytes) {
        Alert.alert('Archivo no válido', key === 'videoAceptacion'
          ? 'Selecciona un video MP4, MOV, AVI o WEBM de máximo 50 MB.'
          : mustBePdf
            ? 'Selecciona un PDF válido de máximo 10 MB.'
            : 'Selecciona un archivo válido de máximo 10 MB.');
        return;
      }
      setSolicitudId(null);
      setSolicitudFiles((current) => ({ ...current, [key]: file }));
    }
  };
  const appendSolicitudFile = (form: FormData, key: SolicitudDocumentoKey, fieldName: string) => {
    const file = solicitudFiles[key];
    if (!file) return;
    appendERubricaFile(form, fieldName, { uri: file.uri, name: file.name || `${fieldName}.jpg` });
  };
  const buildSolicitudFormData = () => {
    const form = new FormData();
    form.append('vigencia', solicitudPlan.label);
    form.append('tipoPersona', solicitudPersona ?? '');
    form.append('tipoDocumento', solicitudForm.tipoDocumento);
    form.append('identificacion', solicitudForm.identificacion);
    form.append('codigoDactilar', solicitudForm.codigoDactilar);
    form.append('poseeRuc', String(solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc));
    form.append('ruc', solicitudForm.ruc);
    form.append('nombres', solicitudForm.nombres);
    form.append('primerApellido', solicitudForm.primerApellido);
    form.append('segundoApellido', solicitudForm.segundoApellido);
    form.append('fechaNacimiento', solicitudForm.fechaNacimiento);
    form.append('sexo', solicitudForm.sexo);
    form.append('nacionalidad', solicitudForm.nacionalidad);
    form.append('celular', solicitudForm.celular);
    form.append('correo', solicitudForm.correo);
    form.append('telefonoSecundario', solicitudForm.telefonoSecundario);
    form.append('correoSecundario', solicitudForm.correoSecundario);
    form.append('provincia', solicitudForm.provincia);
    form.append('canton', solicitudForm.canton);
    form.append('direccion', solicitudForm.direccion);
    form.append('razonSocialEmpresa', solicitudForm.razonSocialEmpresa);
    form.append('departamento', solicitudForm.departamento);
    form.append('cargo', solicitudForm.cargo);
    form.append('motivoFirma', solicitudForm.motivoFirma);
    form.append('representanteTipoDocumento', solicitudForm.representanteTipoDocumento);
    form.append('representanteIdentificacion', solicitudForm.representanteIdentificacion);
    form.append('representanteNombres', solicitudForm.representanteNombres);
    form.append('representanteApellidos', solicitudForm.representanteApellidos);
    appendSolicitudFile(form, 'cedulaFrontal', 'cedulaFrontal');
    appendSolicitudFile(form, 'cedulaPosterior', 'cedulaPosterior');
    appendSolicitudFile(form, 'selfieCedula', 'selfieCedula');
    appendSolicitudFile(form, 'videoAceptacion', 'videoAceptacion');
    appendSolicitudFile(form, 'rucFile', 'rucFile');
    appendSolicitudFile(form, 'nombramiento', 'nombramiento');
    appendSolicitudFile(form, 'constitucion', 'constitucion');
    appendSolicitudFile(form, 'cedulaRepresentante', 'cedulaRepresentante');
    appendSolicitudFile(form, 'autorizacion', 'autorizacion');
    appendSolicitudFile(form, 'aceptacionNombramiento', 'aceptacionNombramiento');
    appendSolicitudFile(form, 'archivoAdicional', 'archivoAdicional');
    return form;
  };
  const cargarSolicitudBorradores = async () => {
    setLoadingSolicitudBorradores(true);
    try {
      setSolicitudBorradores(await getERubricaSolicitudBorradores());
      setSolicitudBorradoresOpen(true);
    } catch (error) {
      Alert.alert('No se pudieron cargar los borradores', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    } finally {
      setLoadingSolicitudBorradores(false);
    }
  };
  const guardarSolicitudBorrador = async () => {
    const nombre = [solicitudForm.nombres, solicitudForm.primerApellido].filter(Boolean).join(' ').trim() || 'Solicitud de firma';
    const titulo = `${nombre} · ${solicitudPlan.label}`;
    try {
      const borrador = await guardarERubricaSolicitudBorrador(titulo, JSON.stringify({ solicitudPlan, solicitudPersona, solicitudForm }));
      setSolicitudBorradores((current) => [borrador, ...current.filter((item) => item.id !== borrador.id)].slice(0, 20));
      Alert.alert('Solicitud guardada', 'Podrás continuarla desde Solicitudes de clientes en el móvil o en la web. Los documentos se adjuntan al enviarla.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    }
  };
  const usarSolicitudBorrador = (borrador: ERubricaSolicitudBorrador) => {
    try {
      const datos = recuperarSolicitudBorrador(borrador.datosJson);
      setSolicitudPlan(datos.plan ?? { label: '7 días', price: 9 });
      setSolicitudPersona(datos.persona);
      setSolicitudForm({ ...SOLICITUD_FORM_INITIAL, ...datos.form });
      setSolicitudFiles(SOLICITUD_FILES_INITIAL);
      setSolicitudId(null);
      setSolicitudStep(1);
      setSolicitudBorradoresOpen(false);
      Alert.alert('Solicitud recuperada', 'Revisa los datos y vuelve a adjuntar los documentos antes de continuar.');
    } catch {
      Alert.alert('Borrador no disponible', 'No fue posible recuperar la información de esta solicitud.');
    }
  };
  const eliminarSolicitudBorrador = async (borrador: ERubricaSolicitudBorrador) => {
    try {
      await eliminarERubricaSolicitudBorrador(borrador.id);
      setSolicitudBorradores((current) => current.filter((item) => item.id !== borrador.id));
    } catch (error) {
      Alert.alert('No se pudo eliminar', error instanceof ApiError ? error.message : 'Intenta nuevamente.');
    }
  };
  const validateSolicitudBeforePayment = () => {
    if (!solicitudPersona) {
      Alert.alert('Selecciona el tipo de solicitud', 'Elige Persona natural con cédula, Persona natural con RUC o Representante legal.');
      return false;
    }
    if (!solicitudForm.tipoDocumento.trim() || !solicitudForm.identificacion.trim() || (solicitudForm.tipoDocumento === 'CEDULA' && !solicitudForm.codigoDactilar.trim()) || !solicitudForm.nombres.trim() || !solicitudForm.primerApellido.trim() || !solicitudForm.fechaNacimiento.trim() || !solicitudForm.sexo.trim() || !solicitudForm.celular.trim() || !solicitudForm.correo.trim() || !solicitudForm.provincia.trim() || !solicitudForm.canton.trim() || !solicitudForm.direccion.trim()) {
      Alert.alert('Datos incompletos', 'Completa los datos obligatorios del solicitante.');
      return false;
    }
    if (parseSolicitudAge() < 18) {
      Alert.alert('Edad no válida', 'El solicitante debe ser mayor de edad.');
      return false;
    }
    if (!validateEmail(solicitudForm.correo).valid) {
      Alert.alert('Correo no válido', 'Ingresa un correo principal válido.');
      return false;
    }
    if (solicitudForm.correoSecundario.trim() && !validateEmail(solicitudForm.correoSecundario).valid) {
      Alert.alert('Correo no válido', 'Ingresa un correo secundario válido.');
      return false;
    }
    const identificacionValidation = validateIdentificacion(tipoIdentificacionSolicitud(solicitudForm.tipoDocumento), solicitudForm.identificacion);
    if (!identificacionValidation.valid) {
      Alert.alert('Identificación no válida', identificacionValidation.message ?? 'Verifica la identificación.');
      return false;
    }
    if (!telefonoSolicitudValido(solicitudForm.celular) || (solicitudForm.telefonoSecundario.trim() && !telefonoSolicitudValido(solicitudForm.telefonoSecundario))) {
      Alert.alert('Teléfono no válido', 'Ingresa teléfonos de entre 7 y 15 dígitos.');
      return false;
    }
    if (!textoSolicitudValido(solicitudForm.nombres) || !textoSolicitudValido(solicitudForm.primerApellido) || (solicitudForm.segundoApellido.trim() && !textoSolicitudValido(solicitudForm.segundoApellido))) {
      Alert.alert('Nombre no válido', 'Los nombres y apellidos solo permiten letras y caracteres habituales.');
      return false;
    }
    if (solicitudForm.direccion.trim().length < 5 || solicitudForm.direccion.trim().length > 300) {
      Alert.alert('Dirección no válida', 'La dirección debe tener entre 5 y 300 caracteres.');
      return false;
    }
    if (solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc) {
      const rucValidation = validateIdentificacion('RUC', solicitudForm.ruc);
      if (!rucValidation.valid) {
        Alert.alert('RUC no válido', rucValidation.message ?? 'Ingresa un RUC válido.');
        return false;
      }
    }
    if (solicitudPersona === 'Representante legal' && (!textoSolicitudValido(solicitudForm.razonSocialEmpresa, 150) || !textoSolicitudValido(solicitudForm.departamento) || !textoSolicitudValido(solicitudForm.cargo) || !textoSolicitudValido(solicitudForm.motivoFirma, 250))) {
      Alert.alert('Datos de empresa no válidos', 'Revisa los textos de empresa, departamento, cargo y motivo.');
      return false;
    }
    if (solicitudPersona === 'Representante legal' && (!solicitudForm.razonSocialEmpresa.trim() || !solicitudForm.departamento.trim() || !solicitudForm.cargo.trim() || !solicitudForm.motivoFirma.trim() || !solicitudForm.representanteTipoDocumento.trim() || !solicitudForm.representanteIdentificacion.trim() || !solicitudForm.representanteNombres.trim() || !solicitudForm.representanteApellidos.trim())) {
      Alert.alert('Datos incompletos', 'Completa los datos de empresa y representante legal.');
      return false;
    }
    if (solicitudPersona === 'Representante legal') {
      const representanteValidation = validateIdentificacion(tipoIdentificacionSolicitud(solicitudForm.representanteTipoDocumento), solicitudForm.representanteIdentificacion);
      if (!representanteValidation.valid || !textoSolicitudValido(solicitudForm.representanteNombres) || !textoSolicitudValido(solicitudForm.representanteApellidos)) {
        Alert.alert('Representante no válido', representanteValidation.message ?? 'Revisa la identificación, nombres y apellidos del representante.');
        return false;
      }
    }
    const missingFile = solicitudDocumentoItems.find((item) => item.label.includes('*') && !solicitudFiles[item.key]);
    if (missingFile) {
      Alert.alert('Documento pendiente', `Adjunta: ${missingFile.label.replace(' *', '')}.`);
      return false;
    }
    return true;
  };
  const avanzarSolicitudPaso = () => {
    if (solicitudStep === 2 && !solicitudPersona) {
      Alert.alert('Selecciona el titular', 'Elige el tipo de persona para continuar.');
      return;
    }
    if (solicitudStep === 3) {
      const faltanDatos = !solicitudForm.tipoDocumento || !solicitudForm.identificacion || !solicitudForm.nombres || !solicitudForm.primerApellido || !solicitudForm.fechaNacimiento || !solicitudForm.sexo || !solicitudForm.celular || !solicitudForm.correo || !solicitudForm.provincia || !solicitudForm.canton || !solicitudForm.direccion;
      if (faltanDatos) {
        Alert.alert('Datos incompletos', 'Completa los datos obligatorios del solicitante antes de continuar.');
        return;
      }
    }
    if (solicitudStep === 4) {
      const pendiente = solicitudDocumentoItems.find((item) => item.label.includes('*') && !solicitudFiles[item.key]);
      if (pendiente) {
        Alert.alert('Documento pendiente', `Adjunta: ${pendiente.label.replace(' *', '')}.`);
        return;
      }
    }
    setSolicitudStep((current) => Math.min(5, current + 1));
  };
  const openPaymentSummary = async () => {
    if (!validateSolicitudBeforePayment()) return;
    setSolicitudSaving(true);
    try {
      const response = await crearERubricaSolicitud(buildSolicitudFormData());
      const createdId = Number((response as Record<string, unknown>).solicitudId);
      if (!createdId) throw new Error('empty-solicitud-id');
      setSolicitudId(createdId);
      setPaymentModalOpen(true);
    } catch (error) {
      Alert.alert('No se pudo crear la solicitud', error instanceof ApiError ? error.message : 'Revisa los datos y documentos adjuntos.');
    } finally {
      setSolicitudSaving(false);
    }
  };
  const pickTransferReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;
    const extension = asset.fileName?.split('.').pop()?.toLowerCase();
    const extensionValida = ['jpg', 'jpeg', 'png'].includes(extension ?? '');
    const mimeValido = ['image/jpeg', 'image/png'].includes(asset.mimeType ?? '');
    if ((asset.fileSize ?? 0) <= 0 || (asset.fileSize ?? 0) > 5 * 1024 * 1024 || (!extensionValida && !mimeValido)) {
      Alert.alert('Comprobante no valido', 'Selecciona una imagen JPG o PNG de maximo 5MB.');
      return;
    }
    setTransferReceipt(asset);
  };
  const payERubricaRequest = async () => {
    setPaymentLoading(true);
    try {
      if (!solicitudId) {
        Alert.alert('Solicitud pendiente', 'Primero crea la solicitud para continuar con el pago.');
        return;
      }
      if (paymentMethod === 'deuna') {
        const payment = await iniciarPagoERubricaSolicitud(solicitudId);
        const url = payment.paymentUrl ?? payment.checkoutUrl ?? payment.url;
        if (!url) throw new Error('empty-payment-url');
        await Linking.openURL(url);
        setPaymentModalOpen(false);
        Alert.alert('Pago en línea', 'Checkout abierto. La solicitud se acreditará al aprobarse el pago.');
        return;
      }
      if (!transferForm.banco || !transferForm.titular.trim() || !transferForm.cuenta.trim() || !transferForm.comprobante.trim() || !transferReceipt) {
        Alert.alert('Transferencia incompleta', 'Completa los datos de pago y adjunta el comprobante.');
        return;
      }
      if (!textoSolicitudValido(transferForm.titular, 120) || !/^\d{6,25}$/.test(transferForm.cuenta.trim()) || !/^[A-Za-z0-9\-]{4,50}$/.test(transferForm.comprobante.trim())) {
        Alert.alert('Transferencia no válida', 'Revisa el titular, cuenta y número de comprobante.');
        return;
      }
      const form = new FormData();
      form.append('solicitudId', String(solicitudId));
      form.append('banco', transferForm.banco);
      form.append('titularCuenta', transferForm.titular.trim());
      form.append('cuentaOrigen', transferForm.cuenta.trim());
      form.append('numeroComprobante', transferForm.comprobante.trim());
      appendERubricaFile(form, 'comprobante', { uri: transferReceipt.uri, name: transferReceipt.fileName || 'comprobante.jpg' });
      await enviarTransferenciaERubricaSolicitud(form);
      setPaymentModalOpen(false);
      Alert.alert('Transferencia enviada', 'Tu comprobante fue enviado para validación.');
    } catch (error) {
      Alert.alert('No se pudo procesar el pago', error instanceof ApiError ? error.message : 'Revisa la información e intenta nuevamente.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <View style={styles.portalStack}>
      {message ? <MessageBox message={message} /> : null}

      {tab === 'inicio' ? (
        <View style={styles.erubricaHomeStack}>
          <View style={styles.erubricaDashboardBannerPanel} onLayout={({ nativeEvent }) => setBannerWidth(nativeEvent.layout.width)}>
            <Image source={require('../../../assets/erubrica-dashboard-banner.png')} style={[styles.erubricaDashboardBanner, { height: bannerHeight }]} resizeMode="contain" />
            <Pressable accessibilityRole="button" accessibilityLabel="Solicitar firma electrónica" style={[styles.erubricaDashboardBannerAction, styles.erubricaDashboardRequestAction]} onPress={() => selectTab('nueva-solicitud')} />
            <Pressable accessibilityRole="button" accessibilityLabel="Firmar PDF" style={[styles.erubricaDashboardBannerAction, styles.erubricaDashboardSignAction]} onPress={() => selectTab('firmar')} />
          </View>
          <View style={styles.erubricaHomeStateCard}><View style={styles.erubricaHomeSectionHeader}><Text style={styles.erubricaHomeSectionTitle}>Estado de la firma</Text><Text style={styles.erubricaHomeSectionHint}>Solicitud más reciente</Text></View><View style={styles.erubricaHomeStateGrid}><View style={styles.erubricaHomeStateItem}><View style={styles.erubricaHomeStateIcon}><MaterialCommunityIcons name="cash-check" size={18} color="#079349" /></View><View><Text style={styles.erubricaHomeStateLabel}>Estado de pago</Text><Text style={styles.erubricaHomeStateValue}>{pagoInicio}</Text></View></View><View style={styles.erubricaHomeStateItem}><View style={[styles.erubricaHomeStateIcon, styles.erubricaHomeStateIconBlue]}><MaterialCommunityIcons name="send-outline" size={18} color="#2563B8" /></View><View><Text style={styles.erubricaHomeStateLabel}>Estado Uanataca</Text><Text style={styles.erubricaHomeStateValue}>{uanatacaInicio}</Text></View></View></View></View>
          <View style={styles.erubricaHomeQuickGrid}>{[['file-sign', 'Firmar documento', 'Firma tus documentos en pocos pasos', 'firmar'], ['cart-outline', 'Comprar / Renovar firma', 'Adquiere o renueva tu firma electrónica', 'plan-disponible'], ['folder-open-outline', 'Mis documentos', 'Accede a tus documentos firmados', 'historial-documentos'], ['shield-check-outline', 'Validar firma', 'Verifica documentos firmados', 'validar-firma']].map(([icon, title, description, destination], index) => <Pressable key={destination} style={[styles.erubricaHomeQuickCard, index === 0 && styles.erubricaHomeQuickCardPrimary]} onPress={() => selectTab(destination as ERubricaTab)}><View style={styles.erubricaHomeQuickIcon}><MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={index === 0 ? '#FFFFFF' : ERUBRICA_COLORS.primary} /></View><View style={styles.erubricaHomeQuickCopy}><Text style={[styles.erubricaHomeQuickTitle, index === 0 && styles.erubricaHomeQuickTitlePrimary]}>{title}</Text><Text style={[styles.erubricaHomeQuickText, index === 0 && styles.erubricaHomeQuickTextPrimary]}>{description}</Text></View><MaterialCommunityIcons name="chevron-right" size={20} color={index === 0 ? '#FFFFFF' : '#607887'} /></Pressable>)}</View>
          <View style={styles.erubricaHomeOverviewCard}><Text style={styles.erubricaHomeSectionTitle}>Resumen de firmas y documentos</Text><View style={styles.erubricaHomeOverviewContent}><View style={styles.erubricaHomeRing}><Text style={styles.erubricaHomeRingValue}>{solicitudHistoryItems.length}</Text><Text style={styles.erubricaHomeRingLabel}>TOTAL</Text></View><View style={styles.erubricaHomeLegend}><Text style={styles.erubricaHomeLegendText}>● Pendientes: {solicitudesPendientes}</Text><Text style={styles.erubricaHomeLegendText}>● Pagadas: {solicitudesPagadas}</Text><Text style={styles.erubricaHomeLegendText}>● Firmados: {historialDocumentos.length}</Text></View></View><View style={styles.erubricaHomeMetricsGrid}>{[[porFirmarInicio, 'Por firmar'], [historialDocumentos.length, 'Firmados'], [signedMonthCount, 'Firmas del mes']].map(([value, title]) => <View key={String(title)} style={[styles.erubricaHomeMetric, inicioCompacto && styles.erubricaHomeMetricCompact]}><Text style={styles.erubricaHomeMetricValue}>{value}</Text><Text style={styles.erubricaHomeMetricLabel}>{title}</Text></View>)}</View></View>
          <View style={styles.erubricaHomeRecentCard}><View style={styles.erubricaHomeSectionHeader}><Text style={styles.erubricaHomeSectionTitle}>Documentos recientes</Text><Pressable onPress={() => selectTab('historial-documentos')}><Text style={styles.erubricaHomeLink}>Ver todos</Text></Pressable></View>{recientesInicio.length ? recientesInicio.map((item, index) => { const fecha = formatSignedDate(item); return <Pressable key={`${itemValue(item, ['id', 'nombre', 'fileName'])}-${index}`} style={styles.erubricaHomeRecentRow} onPress={() => selectTab('historial-documentos')}><View style={styles.erubricaHomeRecentIcon}><MaterialCommunityIcons name="file-pdf-box" size={20} color="#F04444" /></View><View style={styles.erubricaHomeRecentCopy}><Text style={styles.erubricaHomeRecentName} numberOfLines={1}>{label(item, ['nombreDocumento', 'nombreArchivo', 'fileName', 'nombre'], 'Documento firmado')}</Text><Text style={styles.erubricaHomeRecentMeta}>PDF firmado desde E-RÚBRICA · {fecha.date}</Text></View><View style={styles.erubricaHomeValidPill}><Text style={styles.erubricaHomeValidText}>VÁLIDO</Text></View></Pressable>; }) : <Text style={styles.erubricaHomeEmpty}>Todavía no tienes documentos firmados.</Text>}</View>
        </View>
      ) : null}

      {loading ? <View style={styles.directoryLoading}><ActivityIndicator color={ERUBRICA_COLORS.primary} /><Text style={styles.mutedText}>Cargando E-RÚBRICA...</Text></View> : null}
      {contentTab === 'firmar' ? (
        <View style={styles.erubricaSignFlow}>
          <View style={styles.erubricaSignCard}>
            <View style={styles.erubricaSignHeader}>
              <View style={styles.erubricaSignTitleBlock}>
                <Text style={styles.erubricaSignStep}>1. PDF a estampar</Text>
                <Text style={styles.erubricaSignHint}>Selecciona el archivo PDF que recibirá el sello.</Text>
              </View>
              <Pressable style={styles.erubricaSignedDocsButton} onPress={() => { setPendingDocumentsModalOpen(true); void cargarDocumentosPendientes(); }}>
                <MaterialCommunityIcons name="folder-open-outline" size={15} color="#FFFFFF" />
                <Text style={styles.erubricaSignedDocsText}>Documentos cargados</Text>
              </Pressable>
            </View>
            <Pressable style={styles.erubricaDropzone} onPress={pickPdfToSign}>
              <View style={styles.erubricaDropIcon}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={ERUBRICA_COLORS.primary} />
              </View>
              <Text style={styles.erubricaDropTitle}>{pdfFile ? pdfFile.name : 'Arrastra tu archivo PDF aquí'}</Text>
              <Text style={styles.erubricaDropText}>o selecciona un archivo</Text>
              <View style={styles.erubricaDropButton}>
                <MaterialCommunityIcons name="file-pdf-box" size={18} color="#FFFFFF" />
                <Text style={styles.erubricaDropButtonText}>Seleccionar PDF</Text>
              </View>
              <Text style={styles.erubricaDropMeta}>Formato PDF · Máx. 10 MB</Text>
            </Pressable>
          </View>

          <View style={styles.erubricaSignCard}>
            <View style={styles.erubricaSignHeader}>
              <View style={styles.erubricaSignTitleBlock}>
                <Text style={styles.erubricaSignStep}>2. Vista previa del documento</Text>
                <Text style={styles.erubricaSignHint}>Revisa el PDF seleccionado antes de firmarlo.</Text>
              </View>
            </View>
            {pdfFile ? (
              <>
                <PdfPageToolbar page={signaturePage} pageCount={signaturePageCount} onPageChange={setSignaturePage} />
                {signaturePlacements.length === 1 && signaturePlacementLimit === 1 ? <Pressable onPress={agregarSegundaUbicacionFirma} style={{ alignSelf: 'flex-end', marginBottom: 8 }}><Text style={{ color: ERUBRICA_COLORS.primary, fontSize: 12, fontWeight: '800' }}>Agregar firma en otra página</Text></Pressable> : null}
                <PdfDocumentPreview
                  uri={pdfFile.uri}
                  selectable
                  page={signaturePage}
                  position={signaturePosition}
                  placements={signatureMarkers.map((placement, index) => ({ ...placement, label: `Firma ${index + 1}` }))}
                  onPositionChange={registrarUbicacionFirma}
                  onPlacementMove={moverUbicacionFirma}
                  onPlacementDelete={eliminarUbicacionFirma}
                  onPageSizeChange={setSignaturePageSize}
                  onPageCountChange={(count) => { setSignaturePageCount(count); setSignaturePage((current) => Math.min(Math.max(1, current), count)); }}
                  onDragChange={onPdfPositionDragChange}
                />
              </>
            ) : (
              <View style={styles.erubricaEmptyPreview}>
                <View style={styles.erubricaPreviewCenter}>
                  <MaterialCommunityIcons name="file-pdf-box" size={42} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaPreviewTitle}>Vista previa del documento</Text>
                  <Text style={styles.erubricaPreviewText}>Después de cargar el PDF podrás revisarlo aquí.</Text>
                </View>
              </View>
            )}
          </View>

           {firmasConfiguradas.length > 1 ? (
             <View style={styles.erubricaSignCard}>
               <Text style={styles.erubricaSignStep}>Certificado con el que se firmará</Text>
               <Text style={styles.erubricaSignHint}>Usa uno de los certificados cargados previamente.</Text>
               <CompactSelect
                 title="Seleccionar certificado"
                 placeholder="Selecciona un certificado"
                 value={firmaEmisorSeleccionadoId ? String(firmaEmisorSeleccionadoId) : ''}
                 options={firmasConfiguradas.map((item) => ({
                   label: item.nomComercial || item.razonSocial || item.ruc || `Emisor ${item.id}`,
                   value: String(item.id),
                 }))}
                 disabled={signing}
                 onValueChange={(value) => {
                   const id = Number(value);
                   setFirmaEmisorSeleccionadoId(Number.isFinite(id) ? id : null);
                 }}
               />
             </View>
           ) : null}

           <View style={styles.erubricaAdviceCard}>
            <View style={styles.erubricaAdviceHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#D77416" />
              <Text style={styles.erubricaAdviceTitle}>Consejos y validación</Text>
            </View>
             {['Revisa que el documento seleccionado sea el correcto.', 'Verifica que el contenido sea legible antes de firmar.', 'Se utilizará el certificado y la clave cargados previamente; no se solicitarán otra vez.'].map((tip) => (
              <View key={tip} style={styles.erubricaAdviceRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={15} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaAdviceText}>{tip}</Text>
              </View>
            ))}
          </View>

          {validatingPdf ? <ActivityIndicator color={ERUBRICA_COLORS.primary} /> : null}
          {pdfValidation ? <Text style={styles.clientDetailValue}>{JSON.stringify(pdfValidation, null, 2)}</Text> : null}

          <View style={styles.erubricaSignActions}>
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Limpiar formulario" onPress={() => {
              limpiarPdfTemporal();
            }} />
            <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Revisar y firmar PDF" loading={signing} onPress={confirmSignPdfDocument} />
          </View>
          {signedFileUri ? <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Compartir documento firmado" loading={false} onPress={shareSignedDocument} /> : null}
        </View>
      ) : null}
      {tab === 'validar-firma' ? (
        <View style={styles.erubricaSignFlow}>
          <View style={styles.erubricaValidatePanel}>
            <View style={styles.erubricaValidateHeader}>
              <View style={styles.erubricaValidateTitleRow}>
                <MaterialCommunityIcons name="file-lock-outline" size={18} color={ERUBRICA_COLORS.text} />
                <Text style={styles.erubricaSignStep}>1. Documento</Text>
              </View>
              <Pressable style={styles.erubricaSignedDocsButton} onPress={() => setSignedDocumentsModalOpen(true)}>
                <MaterialCommunityIcons name="folder-lock-outline" size={15} color="#FFFFFF" />
                <Text style={styles.erubricaSignedDocsText}>Documentos Firmados</Text>
              </Pressable>
            </View>

            <Pressable style={styles.erubricaDropzone} onPress={pickPdfToValidate}>
              <View style={styles.erubricaDropIcon}>
                <MaterialCommunityIcons name="file-pdf-box" size={27} color={ERUBRICA_COLORS.primary} />
              </View>
              <Text style={styles.erubricaDropTitle}>{pdfFile ? pdfFile.name : 'Arrastra tu archivo PDF aquí'}</Text>
              <Text style={styles.erubricaDropText}>o selecciona un archivo desde tu dispositivo</Text>
              <View style={styles.erubricaDropButton}>
                <MaterialCommunityIcons name="file-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.erubricaDropButtonText}>Seleccionar PDF</Text>
              </View>
              <View style={styles.erubricaValidateMetaRow}>
                <View style={styles.erubricaValidateMetaItem}>
                  <MaterialCommunityIcons name="file-pdf-box" size={18} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaDropMeta}>Formato: PDF</Text>
                </View>
                <View style={styles.erubricaValidateMetaItem}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaDropMeta}>Máximo: 10 MB</Text>
                </View>
                <View style={styles.erubricaValidateMetaItem}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaDropMeta}>Páginas: ilimitado</Text>
                </View>
              </View>
            </Pressable>

            {pdfFile ? <>
              <PdfPageToolbar page={validationPage} pageCount={validationPageCount} onPageChange={setValidationPage} />
              <PdfDocumentPreview uri={pdfFile.uri} page={validationPage} onPageCountChange={(count) => { setValidationPageCount(count); setValidationPage((current) => Math.min(Math.max(1, current), count)); }} />
            </> : (
              <View style={styles.erubricaEmptyPreview}>
                <View style={styles.erubricaPreviewCenter}>
                  <MaterialCommunityIcons name="file-pdf-box" size={34} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaPreviewTitle}>Previsualización del PDF</Text>
                  <Text style={styles.erubricaPreviewText}>Selecciona un documento firmado para verlo aquí.</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.erubricaValidatePrimaryAction}>
            <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Analizar firma digital" loading={validatingPdf} onPress={validatePdfSignature} />
          </View>

          {pdfValidation ? (() => {
            const unwrap = (input: unknown): Record<string, unknown> => {
              if (typeof input === 'string') { try { return unwrap(JSON.parse(input)); } catch { return {}; } }
              return input && typeof input === 'object' ? input as Record<string, unknown> : {};
            };
            const root = unwrap(pdfValidation);
            const payload = unwrap(root.data ?? root.Data ?? root);
            const validation = unwrap(payload.validation ?? payload.Validation ?? payload);
            const firmasRaw = validation.firmas ?? validation.Firmas ?? payload.firmas ?? payload.Firmas;
            const firmasValidacion = Array.isArray(firmasRaw) ? firmasRaw.map(unwrap) : [];
            const value = (source: Record<string, unknown>, ...keys: string[]) => {
              const raw = keys.map((key) => source[key]).find((item) => item !== null && item !== undefined && item !== '');
              return raw === true ? 'Sí' : raw === false ? 'No' : String(raw ?? 'No disponible');
            };
            const esValida = Boolean(validation.valido ?? validation.Valido ?? firmasValidacion.every((item) => Boolean(item.valida ?? item.Valida)));
            return <View style={styles.erubricaSignCard}>
              <View style={styles.erubricaConfigStatusCard}><MaterialCommunityIcons name={esValida ? 'check-circle-outline' : 'alert-circle-outline'} size={22} color={esValida ? ERUBRICA_COLORS.primary : '#B7791F'} /><View style={styles.erubricaPendingDocCopy}><Text style={styles.erubricaConfigStatusTitle}>{esValida ? 'Firma válida' : 'Firma con validación inconclusa'}</Text><Text style={styles.erubricaConfigStatusText}>{esValida ? 'El PDF tiene firma digital válida.' : value(validation, 'resumen', 'Resumen', 'mensaje', 'Mensaje')}</Text></View></View>
              <View style={styles.erubricaSignatureInfoGrid}>{[['Firmas', value(validation, 'cantidadFirmas', 'CantidadFirmas')], ['Documento completo', value(validation, 'documentoCompletoCubierto', 'DocumentoCompletoCubierto')]].map(([title, detail]) => <View key={title} style={styles.erubricaSignatureInfoCell}><Text style={styles.erubricaHistoryMetricLabel}>{title}</Text><Text style={styles.erubricaRequestHistoryValue}>{detail}</Text></View>)}</View>
              {firmasValidacion.map((firma, index) => { const certificado = firma.certificadoDesde || firma.CertificadoDesde ? `Vigente: ${formatDocumentDate(String(firma.certificadoDesde ?? firma.CertificadoDesde))} - ${formatDocumentDate(String(firma.certificadoHasta ?? firma.CertificadoHasta))}` : value(firma, 'certificadoVigente', 'CertificadoVigente'); return <View key={`firma-validacion-${index}`} style={styles.erubricaHistoryPanel}><Text style={styles.erubricaSignStep}>Firma {index + 1}</Text><View style={styles.erubricaSignatureInfoGrid}>{[['Firmante', value(firma, 'firmante', 'Firmante')], ['Integridad', value(firma, 'integridadValida', 'IntegridadValida') === 'Sí' ? 'OK' : 'No'], ['Certificado', certificado], ['Revocación', value(firma, 'estadoRevocacion', 'EstadoRevocacion')], ['Sello de tiempo', value(firma, 'selloTiempoValido', 'SelloTiempoValido')]].map(([title, detail]) => <View key={title} style={styles.erubricaSignatureInfoCell}><Text style={styles.erubricaHistoryMetricLabel}>{title}</Text><Text style={styles.erubricaRequestHistoryValue}>{detail}</Text></View>)}</View></View>; })}
            </View>;
          })() : null}
        </View>
      ) : null}
      {tab === 'documentos-por-firmar' ? (
        <View style={styles.erubricaHistoryStack}>
          <View style={styles.erubricaPendingHeader}>
            <View style={styles.erubricaHistoryHeroCopy}>
              <Text style={styles.erubricaHistoryEyebrow}>DOCUMENTOS ELECTRÓNICOS</Text>
              <Text style={styles.erubricaHistoryTitle}>Documentos por Firmar</Text>
              <Text style={styles.erubricaHistorySubtitle}>Administra los PDF subidos y elige el documento que vas a firmar.</Text>
            </View>
            <Pressable style={[styles.erubricaPendingLoadButton, styles.erubricaPendingLoadButtonPrimary]} onPress={() => void cargarNuevoDocumentoPendiente()}>
              <MaterialCommunityIcons name="folder-upload-outline" size={15} color="#FFFFFF" />
              <Text style={[styles.erubricaPendingLoadText, styles.erubricaPendingLoadTextPrimary]}>{loadingDocumentosPendientes ? 'Cargando...' : 'Cargar documento'}</Text>
            </Pressable>
          </View>


          <View style={styles.erubricaHistoryPanel}>
            <View style={styles.erubricaHistoryFilters}>
              <View style={styles.erubricaHistorySearchBox}>
                <MaterialCommunityIcons name="magnify" size={19} color="#5C748A" />
                <TextInput
                  value={historialQuery}
                  onChangeText={setHistorialQuery}
                  placeholder="Buscar por nombre de documento..."
                  placeholderTextColor="#8AA0B5"
                  style={styles.erubricaHistoryInput}
                />
              </View>
            </View>
            {documentosPendientes.length === 0 ? <EmptyState title="Sin documentos por firmar" text="Carga un PDF para prepararlo y firmarlo." /> : documentosPendientes.slice(0, 10).map((item, index) => {
              const documentName = item.nombreDocumento;
              const documentCode = item.codigo || `DOC-${index + 1}`;
              const signedDate = formatDocumentDate(item.fecha);
              const status = item.estado || 'Pendiente';
              return (
                <View key={`erubrica-pendiente-${index}`} style={styles.erubricaPendingRow}>
                  <View style={styles.erubricaPendingPdfBadge}>
                    <Text style={styles.erubricaPendingPdfText}>PDF</Text>
                  </View>
                  <View style={styles.erubricaPendingDocCopy}>
                    <Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{documentName}</Text>
                    <Text style={styles.erubricaHistoryDocMeta} numberOfLines={1}>{documentCode}</Text>
                    <Text style={styles.erubricaHistoryDetailText}>{signedDate}</Text>
                  </View>
                  <View style={styles.erubricaPendingSide}>
                    <View style={styles.erubricaPendingStatusPill}>
                      <Text style={styles.erubricaPendingStatusText}>{status}</Text>
                    </View>
                    <View style={styles.erubricaPendingActionRow}>
                      <Pressable style={styles.erubricaPendingPreviewButton} onPress={() => eliminarDocumentoPendiente(item)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color="#B4232D" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            <Text style={styles.erubricaHistoryFooter}>Mostrando {Math.min(documentosPendientes.length, 10)} de {documentosPendientes.length} documentos</Text>
          </View>
        </View>
      ) : null}
      {contentTab === 'nueva-solicitud' ? (
        <View style={styles.erubricaRequestStack}>
          {guidedByVoice ? <View style={styles.erubricaValidationStrip}>
            <MaterialCommunityIcons name="microphone-outline" size={18} color={ERUBRICA_COLORS.primary} />
            <Text style={styles.erubricaValidationStripText}>Númi continúa contigo por voz. Adjunta aquí únicamente los documentos que te solicite.</Text>
          </View> : null}
          {!guidedByVoice ? <View style={styles.erubricaPendingHeader}>
            <View style={styles.erubricaHistoryHeroCopy}>
              <Text style={styles.erubricaHistoryEyebrow}>FIRMA ELECTRÓNICA</Text>
              <Text style={styles.erubricaHistoryTitle}>Nueva solicitud de firma</Text>
              <Text style={styles.erubricaHistorySubtitle}>Completa la información para generar tu solicitud de firma electrónica.</Text>
            </View>
            <Pressable style={styles.erubricaPendingLoadButton} disabled={loadingSolicitudBorradores} onPress={() => void cargarSolicitudBorradores()}>
              <MaterialCommunityIcons name="account-group-outline" size={15} color={ERUBRICA_COLORS.text} />
              <Text style={styles.erubricaPendingLoadText}>{loadingSolicitudBorradores ? 'Cargando...' : 'Solicitudes de clientes'}</Text>
            </Pressable>
          </View> : null}

          {!guidedByVoice ? <View style={styles.erubricaRequestSteps}>
            {['Configuración', 'Titular', 'Información', 'Documentos', 'Confirmación'].map((step, index) => {
              const active = solicitudStep >= index + 1;
              return (
                <Pressable key={step} style={styles.erubricaRequestStep} onPress={() => { if (index + 1 <= solicitudStep) setSolicitudStep(index + 1); }}>
                  <View style={[styles.erubricaRequestStepCircle, active && styles.erubricaRequestStepCircleActive]}>
                    <Text style={[styles.erubricaRequestStepNumber, active && styles.erubricaRequestStepNumberActive]}>{index + 1}</Text>
                  </View>
                  <Text style={styles.erubricaRequestStepLabel}>{step}</Text>
                </Pressable>
              );
            })}
          </View> : null}

          {solicitudStep === 1 ? <View style={styles.erubricaRequestPanel}>
            <Text style={styles.erubricaSignStep}>Configura tu firma electrónica</Text>
            <Text style={styles.erubricaSignHint}>Selecciona el formato y la vigencia antes de completar los datos del titular.</Text>
            <View style={styles.erubricaRequestOptionActive}>
              <MaterialCommunityIcons name="file-certificate-outline" size={19} color="#FFFFFF" />
              <View style={styles.erubricaPendingDocCopy}>
                <Text style={styles.erubricaRequestOptionTitle}>Archivo .P12</Text>
                <Text style={styles.erubricaRequestOptionText}>Descargable para usarlo desde tu equipo.</Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={18} color={ERUBRICA_COLORS.primary} />
            </View>

            <View style={styles.erubricaRequestPlanGrid}>
              {[
                { label: '7 días', price: 9 },
                { label: '30 días', price: 12 },
                { label: '1 año', price: 21 },
                { label: '2 años', price: 31 },
                { label: '3 años', price: 40 },
                { label: '4 años', price: 49 },
                { label: '5 años', price: 57 },
              ].map((plan) => {
                const active = solicitudPlan.label === plan.label;
                return (
                  <Pressable key={plan.label} style={[styles.erubricaRequestPlan, active && styles.erubricaRequestPlanActive]} onPress={() => { setSolicitudPlan(plan); setSolicitudId(null); }}>
                    <Text style={styles.erubricaRequestPlanTitle}>{plan.label}</Text>
                    <Text style={styles.erubricaRequestPlanPrice}>${plan.price.toFixed(2)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.erubricaRequestTaxNote}>Precios sin IVA. El total final se mostrará en el pago con el IVA correspondiente.</Text>
          </View> : null}

          {solicitudStep === 2 ? <View style={styles.erubricaRequestPersonGrid}>
            {['Persona natural con cédula', 'Persona natural con RUC', 'Representante legal'].map((option) => {
              const active = solicitudPersona === option;
              return (
              <Pressable key={option} style={[styles.erubricaRequestPerson, active && styles.erubricaRequestPersonActive]} onPress={() => { setSolicitudPersona(option); setSolicitudForm(buildSolicitudFormFromProfile(option)); setSolicitudFiles(SOLICITUD_FILES_INITIAL); setSolicitudId(null); }}>
                  <MaterialCommunityIcons name={active ? 'check-circle' : 'card-account-details-outline'} size={18} color={active ? ERUBRICA_COLORS.primary : '#607887'} />
                  <Text style={styles.erubricaRequestOptionTitle}>{option}</Text>
                </Pressable>
              );
            })}
          </View> : null}

          {solicitudStep === 3 && solicitudPersona ? <>
          <View style={styles.erubricaRequestPanel}>
            <Text style={styles.erubricaHistoryEyebrow}>DATOS PERSONALES</Text>
            <Text style={styles.erubricaSignStep}>Completa la información del solicitante</Text>
            <Text style={styles.clientDetailLabel}>Tipo de documento *</Text>
            <CompactSelect title="Tipo de documento" placeholder="Selecciona un documento" value={solicitudForm.tipoDocumento} options={[{ label: 'Cédula', value: 'CEDULA' }, { label: 'Pasaporte', value: 'PASAPORTE' }]} onValueChange={(value) => setSolicitudForm((current) => ({ ...current, tipoDocumento: value, identificacion: '', codigoDactilar: '' }))} />
            <Field label="Identificación *" value={solicitudForm.identificacion} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, identificacion: value }))} />
            {solicitudForm.tipoDocumento === 'CEDULA' ? <Field label="Código dactilar *" value={solicitudForm.codigoDactilar} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, codigoDactilar: value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))} autoCapitalize="characters" /> : null}
            {solicitudPersona !== 'Persona natural con cédula' ? <>
            <Text style={styles.clientDetailLabel}>¿Posee RUC? *</Text>
            <View style={styles.erubricaPendingActionRow}>
              <Pressable style={[styles.erubricaRequestPerson, (solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc) && styles.erubricaRequestPersonActive]} onPress={() => setSolicitudForm((current) => ({ ...current, poseeRuc: true }))}>
                <MaterialCommunityIcons name={(solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc) ? 'check-circle' : 'circle-outline'} size={18} color={ERUBRICA_COLORS.primary} /><Text style={styles.erubricaRequestOptionTitle}>Sí</Text>
              </Pressable>
              <Pressable disabled style={[styles.erubricaRequestPerson, !(solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc) && styles.erubricaRequestPersonActive]}>
                <MaterialCommunityIcons name={!(solicitudPersona === 'Representante legal' || solicitudForm.poseeRuc) ? 'check-circle' : 'circle-outline'} size={18} color={ERUBRICA_COLORS.primary} /><Text style={styles.erubricaRequestOptionTitle}>No</Text>
              </Pressable>
            </View>
            <Field label="RUC *" value={solicitudForm.ruc} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, ruc: value.replace(/\D/g, '') }))} keyboardType="number-pad" />
            </> : null}
            <Field label="Nombres *" value={solicitudForm.nombres} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, nombres: value }))} />
            <Field label="Primer apellido *" value={solicitudForm.primerApellido} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, primerApellido: value }))} />
            <Field label="Segundo apellido (opcional)" value={solicitudForm.segundoApellido} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, segundoApellido: value }))} />
            <Text style={styles.clientDetailLabel}>Fecha de nacimiento *</Text>
            <Pressable style={styles.erubricaHistorySearchBox} onPress={() => setShowSolicitudBirthDate(true)}><Text style={[styles.erubricaHistoryInput, !solicitudForm.fechaNacimiento && { color: '#8AA0B5' }]}>{solicitudForm.fechaNacimiento || 'Seleccionar fecha'}</Text><MaterialCommunityIcons name="calendar" size={19} color={ERUBRICA_COLORS.primary} /></Pressable>
            {showSolicitudBirthDate ? <DateTimePicker value={solicitudForm.fechaNacimiento ? new Date(`${solicitudForm.fechaNacimiento}T12:00:00`) : new Date(1990, 0, 1)} mode="date" maximumDate={new Date()} onValueChange={(_, date) => { if (Platform.OS !== 'ios') setShowSolicitudBirthDate(false); if (date) setSolicitudForm((current) => ({ ...current, fechaNacimiento: date.toISOString().slice(0, 10) })); }} onDismiss={() => setShowSolicitudBirthDate(false)} /> : null}
            <Text style={styles.clientDetailLabel}>Sexo *</Text>
            <CompactSelect title="Sexo" placeholder="Selecciona" value={solicitudForm.sexo} options={[{ label: 'Femenino', value: 'F' }, { label: 'Masculino', value: 'M' }]} onValueChange={(value) => setSolicitudForm((current) => ({ ...current, sexo: value }))} />
            <Text style={styles.clientDetailLabel}>Nacionalidad *</Text>
            <CompactSelect title="Nacionalidad" placeholder="Selecciona una nacionalidad" value={solicitudForm.nacionalidad} options={solicitudCatalogos.nacionalidades.map((item) => ({ label: item, value: item }))} onValueChange={(value) => setSolicitudForm((current) => ({ ...current, nacionalidad: value }))} />
            <Field label="Celular *" value={solicitudForm.celular} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, celular: value }))} keyboardType="phone-pad" />
            <Field label="Correo principal *" value={solicitudForm.correo} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, correo: value }))} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Teléfono secundario (opcional)" value={solicitudForm.telefonoSecundario} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, telefonoSecundario: value }))} keyboardType="phone-pad" />
            <Field label="Correo secundario (opcional)" value={solicitudForm.correoSecundario} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, correoSecundario: value }))} autoCapitalize="none" keyboardType="email-address" />
            <Text style={styles.clientDetailLabel}>Provincia *</Text>
            <CompactSelect title="Provincia" placeholder="Selecciona una provincia" value={solicitudForm.provincia} options={solicitudCatalogos.provincias.map((item) => ({ label: item.nombre, value: item.nombre }))} onValueChange={(value) => setSolicitudForm((current) => ({ ...current, provincia: value, canton: '' }))} />
            <Text style={styles.clientDetailLabel}>Cantón *</Text>
            <CompactSelect title="Cantón" placeholder={cantonesSolicitud.length ? 'Selecciona un cantón' : 'Selecciona una provincia'} value={solicitudForm.canton} options={cantonesSolicitud.map((item) => ({ label: item, value: item }))} disabled={cantonesSolicitud.length === 0} onValueChange={(value) => setSolicitudForm((current) => ({ ...current, canton: value }))} />
            <Field label="Dirección *" value={solicitudForm.direccion} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, direccion: value }))} />
          </View>

          {solicitudPersona === 'Representante legal' ? (
            <>
              <View style={styles.erubricaRequestPanel}>
                <Text style={styles.erubricaHistoryEyebrow}>DATOS DE LA EMPRESA</Text>
                <Text style={styles.erubricaSignStep}>Información corporativa</Text>
                <Field label="Razón social de la empresa *" value={solicitudForm.razonSocialEmpresa} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, razonSocialEmpresa: value }))} />
            <Field label="Departamento (opcional)" value={solicitudForm.departamento} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, departamento: value }))} />
                <Field label="Cargo *" value={solicitudForm.cargo} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, cargo: value }))} />
                <Field label="Motivo de firma *" value={solicitudForm.motivoFirma} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, motivoFirma: value }))} />
              </View>
              <View style={styles.erubricaRequestPanel}>
                <Text style={styles.erubricaHistoryEyebrow}>REPRESENTANTE LEGAL</Text>
                <Text style={styles.erubricaSignStep}>Información del representante</Text>
                <Field label="Tipo de documento *" value={solicitudForm.representanteTipoDocumento} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, representanteTipoDocumento: value }))} />
                <Field label="Identificación *" value={solicitudForm.representanteIdentificacion} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, representanteIdentificacion: value }))} />
                <Field label="Nombres del representante *" value={solicitudForm.representanteNombres} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, representanteNombres: value }))} />
                <Field label="Apellidos del representante *" value={solicitudForm.representanteApellidos} onChangeText={(value) => setSolicitudForm((current) => ({ ...current, representanteApellidos: value }))} />
              </View>
            </>
          ) : null}

          </> : null}

          {solicitudStep === 4 && (solicitudPersona || guidedByVoice) ? <View style={styles.erubricaRequestPanel}>
            <Text style={styles.erubricaHistoryEyebrow}>DOCUMENTOS DE SOPORTE</Text>
            <Text style={styles.erubricaSignStep}>Adjunta los archivos requeridos</Text>
            {solicitudDocumentoItems.map((item) => {
              const file = solicitudFiles[item.key];
              return (
                <Pressable key={item.key} style={styles.erubricaRequestDocument} onPress={() => pickSolicitudFile(item.key, item.types)}>
                  <MaterialCommunityIcons name={file ? 'check-circle' : 'cloud-upload-outline'} size={20} color={file ? ERUBRICA_COLORS.primary : '#607887'} />
                  <View style={styles.erubricaPendingDocCopy}>
                    <Text style={styles.erubricaRequestOptionTitle}>{item.label}</Text>
                    <Text style={styles.erubricaRequestOptionText}>{file?.name || 'JPG, JPEG, PNG o PDF. Máximo 10 MB.'}</Text>
                  </View>
                  <Text style={styles.erubricaRequestDocumentAction}>{file ? 'Cambiar' : 'Subir'}</Text>
                </Pressable>
              );
            })}
          </View> : null}

          {!guidedByVoice && solicitudStep === 5 ? <>
            <View style={styles.erubricaRequestPanel}>
              <Text style={styles.erubricaHistoryEyebrow}>REVISIÓN</Text>
              <Text style={styles.erubricaSignStep}>Confirma la información de la solicitud</Text>
              <Text style={styles.erubricaSignHint}>{solicitudPlan.label} · {solicitudPersona}</Text>
              <Text style={styles.erubricaRequestOptionTitle}>{[solicitudForm.nombres, solicitudForm.primerApellido, solicitudForm.segundoApellido].filter(Boolean).join(' ')}</Text>
              <Text style={styles.erubricaRequestOptionText}>{solicitudForm.identificacion} · {solicitudForm.correo}</Text>
            </View>
            <View style={styles.erubricaSignActions}>
              <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Anterior" onPress={() => setSolicitudStep(4)} />
              <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Guardar solicitud" onPress={() => void guardarSolicitudBorrador()} />
              <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Confirmar y pagar" loading={solicitudSaving} onPress={openPaymentSummary} />
            </View>
          </> : !guidedByVoice ? <View style={styles.erubricaSignActions}>
            {solicitudStep > 1 ? <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Anterior" onPress={() => setSolicitudStep((current) => Math.max(1, current - 1))} /> : <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Limpiar formulario" onPress={() => { setSolicitudPersona(null); setSolicitudForm(SOLICITUD_FORM_INITIAL); setSolicitudFiles(SOLICITUD_FILES_INITIAL); setSolicitudId(null); }} />}
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Guardar solicitud" onPress={() => void guardarSolicitudBorrador()} />
            <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Siguiente" loading={false} onPress={avanzarSolicitudPaso} />
          </View> : <View style={styles.erubricaSignActions}>
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Continuar con Númi" onPress={() => { setAssistantActionTab(null); voiceControlsRef?.current?.startHandsFree(); }} />
          </View>}
        </View>
      ) : null}
      {tab === 'historial-solicitudes' ? (
        <View style={styles.erubricaHistoryStack}>
          <View style={styles.erubricaRequestHistoryHeader}>
            <View style={styles.erubricaHistoryHeroCopy}>
              <Text style={styles.erubricaHistoryEyebrow}>FIRMA ELECTRÓNICA</Text>
              <Text style={styles.erubricaHistoryTitle}>Historial de solicitudes</Text>
              <Text style={styles.erubricaHistorySubtitle}>Consulta el pago y el estado actualizado de tus solicitudes enviadas a Uanataca.</Text>
            </View>
            <View style={styles.erubricaRequestHistoryCounters}>
              <View style={styles.erubricaRequestHistoryCounter}><Text style={styles.erubricaRequestHistoryCounterText}>Total: {solicitudHistoryItems.length}</Text></View>
              <View style={styles.erubricaRequestHistoryCounter}><Text style={styles.erubricaRequestHistoryCounterText}>Pagados: {solicitudesPagadas}</Text></View>
              <View style={[styles.erubricaRequestHistoryCounter, styles.erubricaRequestHistoryCounterPending]}><Text style={styles.erubricaRequestHistoryCounterText}>Pendientes: {solicitudesPendientes}</Text></View>
            </View>
          </View>

          <View style={styles.erubricaHistoryPanel}>
            <View style={styles.erubricaHistoryFilters}>
              <View style={styles.erubricaHistorySearchBox}>
                <MaterialCommunityIcons name="magnify" size={19} color="#5C748A" />
                <TextInput
                  value={historialQuery}
                  onChangeText={(value) => setHistorialQuery(value)}
                  placeholder="Buscar por titular o referencia..."
                  placeholderTextColor="#8AA0B5"
                  style={styles.erubricaHistoryInput}
                />
              </View>
            </View>
            <Text style={styles.erubricaHistoryFooter}>{filteredHistorialSolicitudes.length} resultado(s)</Text>
            {filteredHistorialSolicitudes.length === 0 ? <EmptyState title="Sin historial" text="No hay solicitudes registradas con los filtros actuales." /> : <ResultCollection
              items={filteredHistorialSolicitudes}
              pageSize={5}
              variant="plain"
              tone="green"
              resetKey={historialQuery}
              keyExtractor={(item, index) => `erubrica-historial-solicitud-${itemValue(item, ['solId', 'SolId', 'id']) || index}`}
              renderItem={(item) => {
              const date = formatSignedDate(item);
              const titular = buildSolicitudTitular(item);
              const firma = label(item, ['firma', 'formato', 'solFormatoFirma', 'SolFormatoFirma', 'producto', 'descripcion'], 'Archivo .P12');
              const vigencia = label(item, ['vigencia', 'duracion', 'plan', 'solVigencia', 'SolVigencia'], '');
              const monto = Number(itemValue(item, ['subtotal', 'subTotal', 'valorSubtotal', 'solMontoPago', 'SolMontoPago']));
              const subtotal = Number.isFinite(monto) ? `$${monto.toFixed(2).replace('.', ',')}` : '$0,00';
              const iva = label(item, ['iva', 'valorIva'], '$0,00');
              const total = Number.isFinite(monto) ? `$${monto.toFixed(2).replace('.', ',')}` : label(item, ['total', 'valorTotal', 'monto'], '$0,00');
              const estadoSolicitud = label(item, ['estadoSolicitud', 'EstadoSolicitud', 'estado', 'status', 'solEstado'], 'Pendiente');
              const soporte = label(item, ['soporte', 'ultimaNotificacion', 'UltimaNotificacion', 'observacion', 'mensaje'], 'Sin avisos');
              const solicitudId = Number(itemValue(item, ['solId', 'SolId', 'id']));
              const pagada = /^(true|1|si|sí)$/i.test(itemValue(item, ['solPagoExitoso', 'SolPagoExitoso', 'pagoExitoso']));
              const estadoPagoRegistrado = label(item, ['estadoPago', 'pago', 'referenciaPago'], '');
              const pago = pagada
                ? 'Pago confirmado'
                : /^(true|false|0|1)$/i.test(estadoPagoRegistrado) || !estadoPagoRegistrado
                  ? 'Pendiente de pago'
                  : estadoPagoRegistrado;
              const estadoUanataca = pagada
                ? label(item, ['estadoUanataca', 'solUanatacaStatusText', 'SolUanatacaStatusText', 'uanataca', 'estadoProveedor'], 'Pendiente de emisión')
                : 'En espera de confirmar el pago';
              return (
                <View style={styles.erubricaRequestHistoryRow}>
                  <View style={styles.erubricaRequestHistoryRowTop}>
                    <View style={styles.erubricaPendingDocCopy}>
                      <Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{titular}</Text>
                      <Text style={styles.erubricaHistoryDocMeta}>{date.date} {date.time}</Text>
                    </View>
                    <View style={styles.erubricaPendingStatusPill}>
                      <Text style={styles.erubricaPendingStatusText}>{estadoSolicitud}</Text>
                    </View>
                  </View>
                  <View style={styles.erubricaRequestHistoryGrid}>
                    <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>FIRMA</Text><Text style={styles.erubricaRequestHistoryValue}>{firma}{vigencia ? `\n${vigencia}` : ''}</Text></View>
                    <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>SUBTOTAL</Text><Text style={styles.erubricaRequestHistoryValue}>{subtotal}</Text></View>
                    <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>IVA</Text><Text style={styles.erubricaRequestHistoryValue}>{iva}</Text></View>
                    <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>TOTAL</Text><Text style={styles.erubricaRequestHistoryValue}>{total}</Text></View>
                  </View>
                  <View style={styles.erubricaRequestHistoryStatusGrid}>
                    <View style={styles.erubricaRequestHistoryPaymentPill}><Text style={styles.erubricaRequestHistoryPaymentText}>Pago: {pago}</Text></View>
                    <View style={styles.erubricaRequestHistoryUanatacaPill}><Text style={styles.erubricaRequestHistoryUanatacaText}>Uanataca: {estadoUanataca}</Text></View>
                    <Text style={styles.erubricaHistorySigner}>{soporte}</Text>
                  </View>
                  {solicitudId > 0 && pagada ? <View style={styles.erubricaPendingActionRow}>
                    <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label={syncingSolicitudId === solicitudId ? 'Actualizando...' : 'Actualizar estado'} onPress={() => void sincronizarSolicitudHistorial(solicitudId)} />
                    <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Descargar .p12" onPress={() => void descargarFirmaSolicitud(solicitudId)} />
                  </View> : <Text style={styles.erubricaHistorySigner}>La actualización se habilita cuando el pago esté aprobado.</Text>}
                </View>
              );
            }}
            />}
          </View>
        </View>
      ) : null}
      {tab === 'renovacion' ? (
        <View style={styles.clientCard}>
          <Text style={styles.clientDetailLabel}>Renovación de firma</Text>
          <Text style={styles.clientMeta}>Consulta la vigencia de tus certificados y las renovaciones pendientes.</Text>
          <Text style={styles.clientDetailValue}>{renovacionActual ? JSON.stringify(renovacionActual, null, 2) : 'Cargando información de renovación...'}</Text>
        </View>
      ) : null}
      {tab === 'catalogos' ? (
        <View style={styles.clientCard}>
          <Text style={styles.clientDetailLabel}>Productos y saldo</Text>
          <Text style={styles.clientMeta}>Saldo disponible: {saldo === null ? 'Cargando...' : saldo}</Text>
          {catalogos.length === 0 ? <EmptyState title="Sin productos" text="No hay productos disponibles para tu cuenta." /> : catalogos.slice(0, 20).map((item, index) => <Text key={`erubrica-producto-${index}`} style={styles.clientDetailValue}>{label(item, ['nombre', 'descripcion', 'name'], 'Producto')}</Text>)}
        </View>
      ) : null}
      {contentTab === 'plan-disponible' ? (
        <View style={styles.erubricaPlanStack}>
          <View style={styles.erubricaPlanHeader}>
            <View style={styles.erubricaPlanHeaderTop}>
              <View style={styles.erubricaPlanHeaderBadge}>
                <MaterialCommunityIcons name="card-account-details-star-outline" size={15} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaPlanHeaderEyebrow}>CONFIGURACIÓN</Text>
              </View>
              <Pressable style={styles.erubricaPlanBackButton} onPress={() => selectTab('inicio')}>
                <MaterialCommunityIcons name="arrow-left" size={15} color={ERUBRICA_COLORS.text} />
                <Text style={styles.erubricaPendingLoadText}>Volver al inicio</Text>
              </Pressable>
            </View>
            <Text style={styles.erubricaPlanHeaderTitle}>Mi Plan Disponible</Text>
            <Text style={styles.erubricaPlanHeaderSubtitle}>Consulta los detalles de tu suscripción activa para firma y validación de documentos electrónicos.</Text>
            <View style={styles.erubricaPlanHeaderStatusRow}>
              <View style={styles.erubricaPlanHeaderStatusPill}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaPlanHeaderStatusText}>{planEstado}</Text>
              </View>
              <Text style={styles.erubricaPlanHeaderDate}>Vence: {planFechaVencimiento}</Text>
            </View>
          </View>

          <View style={styles.erubricaPlanCard}>
            <View style={styles.erubricaPlanHero}>
              <View style={styles.erubricaPlanPills}>
              <Text style={styles.erubricaPlanPill}>{label(planDisponible, ['tieneFirmaPagada'], 'false') === 'true' && planEstado.toLowerCase() === 'activo' ? 'Firma vigente' : 'Sin firma vigente'}</Text>
                <Text style={styles.erubricaPlanPillAlt}>Servicio: E-RÚBRICA</Text>
              </View>
              <View style={styles.erubricaPlanHeroBody}>
                <View style={styles.erubricaPlanIcon}>
                  <MaterialCommunityIcons name="key-variant" size={25} color="#CFF8D8" />
                </View>
                <View style={styles.erubricaHistoryHeroCopy}>
                  <Text style={styles.erubricaHistoryEyebrow}>TU ACCESO DIGITAL</Text>
                  <Text style={styles.erubricaPlanTitle}>Plan de E-RÚBRICA</Text>
                  <Text style={styles.erubricaPlanText}>Firma, valida y protege tus documentos con respaldo legal.</Text>
                </View>
              </View>
              <View style={styles.erubricaPlanDaysCircle}>
                <Text style={styles.erubricaPlanDays}>{planDiasRestantes}</Text>
                <Text style={styles.erubricaPlanDaysLabel}>DÍAS RESTANTES</Text>
              </View>
            </View>
            <View style={styles.erubricaPlanDetails}>
              <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>FECHA DE VENCIMIENTO</Text><Text style={styles.erubricaRequestHistoryValue}>{planFechaVencimiento}</Text></View>
              <View style={styles.erubricaRequestHistoryCell}><Text style={styles.erubricaHistoryMetricLabel}>ESTADO DEL ACCESO</Text><Text style={[styles.erubricaRequestHistoryValue, { color: ERUBRICA_COLORS.primary }]}>{planEstado}</Text></View>
            </View>
            <View style={styles.erubricaPendingActionRow}>
              <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label={planEstado.toLowerCase() === 'activo' ? 'Renovar firma' : 'Solicitar Nueva Firma'} loading={false} onPress={() => selectTab('nueva-solicitud')} />
              <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Ver Mis Trámites" onPress={() => selectTab('historial-solicitudes')} />
            </View>
          </View>

          <View style={styles.erubricaBenefitsCard}>
            <Text style={styles.erubricaSignStep}>Beneficios Incluidos</Text>
            {[
              ['Firmado de PDF ilimitado', 'Firma digitalmente todos los contratos y documentos que necesites.'],
              ['Estándar XAdES / PAdES', 'Garantiza plena validez legal ante el SRI, aduanas y juzgados del Ecuador.'],
              ['Seguridad y Respaldo', 'Tus firmas y contraseñas no se almacenan, garantizando confidencialidad.'],
              ['Soporte Prioritario', 'Atención técnica preferencial para resolver bloqueos o dudas del certificado.'],
            ].map(([title, text]) => (
              <View key={title} style={styles.erubricaBenefitRow}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={ERUBRICA_COLORS.primary} />
                <View style={styles.erubricaPendingDocCopy}>
                  <Text style={styles.erubricaRequestOptionTitle}>{title}</Text>
                  <Text style={styles.erubricaRequestOptionText}>{text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {tab === 'firma-config' ? (
        <View style={styles.erubricaConfigStack}>
          <View style={styles.erubricaConfigIntroCard}>
            <View style={styles.erubricaConfigIntroIcon}>
              <MaterialCommunityIcons name="file-check-outline" size={31} color={ERUBRICA_COLORS.primary} />
              <View style={styles.erubricaConfigShieldBadge}>
                <MaterialCommunityIcons name="shield-check-outline" size={18} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.erubricaConfigIntroAccent} />
            <View style={styles.erubricaConfigIntroCopy}>
              <Text style={styles.erubricaConfigTitle}>Configura tu firma electrónica</Text>
              <Text style={styles.erubricaConfigSubtitle}>Carga tu certificado digital y configura su clave de acceso para firmar documentos de forma segura.</Text>
            </View>
          </View>

      <View style={styles.erubricaConfigStatusCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={19} color={ERUBRICA_COLORS.primary} />
            <View style={styles.erubricaPendingDocCopy}>
              <Text style={styles.erubricaConfigStatusTitle}>{firmaEfactValida ? 'Firma vigente' : firmaEfact ? 'Firma configurada' : 'Firma pendiente'}</Text>
              <Text style={styles.erubricaConfigStatusText}>{firmaEfactValida ? `${firmaEfact?.diasRestantes ?? 'Sin dato'} días para renovar. Expira el ${firmaEfactExpira}.` : firmaEfact?.mensaje ?? 'Carga un certificado .p12 para habilitar la firma electrónica.'}</Text>
              {firmaEfact ? <Text style={styles.erubricaConfigStatusText}>Titular: {firmaTitular}</Text> : null}
            </View>
           </View>

           {firmaEmisorOptions.length > 1 ? (
             <View style={styles.erubricaConfigStepCard}>
               <Text style={styles.erubricaConfigStepTitle}>Emisor de la firma</Text>
               <Text style={styles.erubricaConfigStepHint}>Selecciona el emisor donde está o quedará cargado el certificado.</Text>
               <CompactSelect
                 title="Seleccionar emisor"
                 placeholder="Selecciona un emisor"
                 value={firmaEmisorSeleccionadoId ? String(firmaEmisorSeleccionadoId) : ''}
                 options={firmaEmisorOptions}
                 disabled={savingConfiguredSignature}
                 onValueChange={(value) => {
                   const id = Number(value);
                   setFirmaEmisorSeleccionadoId(Number.isFinite(id) ? id : null);
                   setFirmaDetalleActiva(null);
                 }}
               />
             </View>
           ) : null}

           <View style={styles.erubricaConfigStepCard}>
            <View style={styles.erubricaConfigStepHeader}>
              <View style={styles.erubricaConfigStepNumber}><Text style={styles.erubricaConfigStepNumberText}>1</Text></View>
              <View style={styles.erubricaPendingDocCopy}>
                <Text style={styles.erubricaConfigStepTitle}>Certificado digital</Text>
                <Text style={styles.erubricaConfigStepHint}>{firmaEfact ? 'Ya se detectó una firma configurada. Selecciona otro archivo solo para reemplazarla.' : 'Selecciona tu archivo de certificado digital en formato .p12'}</Text>
              </View>
              <Pressable style={styles.erubricaConfigSelectButton} onPress={pickCertificate}>
                <MaterialCommunityIcons name="file-upload-outline" size={15} color="#FFFFFF" />
                <Text style={styles.erubricaConfigSelectText}>{firmaEfact ? 'Reemplazar' : 'Seleccionar'}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.erubricaConfigFileRow} onPress={pickCertificate}>
              <View style={styles.erubricaDropIcon}>
                <MaterialCommunityIcons name="file-lock-outline" size={20} color={ERUBRICA_COLORS.primary} />
              </View>
              <View style={styles.erubricaPendingDocCopy}>
                <Text style={styles.erubricaRequestHistoryValue} numberOfLines={1}>{certificateFile ? certificateFile.name : firmaEfact ? 'Certificado configurado' : 'Selecciona tu certificado .p12'}</Text>
                <Text style={styles.erubricaRequestOptionText}>{firmaEfact ? (firmaEfactValida ? 'Validado automáticamente' : 'Requiere validación') : 'Formato .p12'}</Text>
              </View>
              {certificateFile ? <MaterialCommunityIcons name="check-circle" size={18} color={ERUBRICA_COLORS.primary} /> : null}
              {certificateFile ? (
                <Pressable style={styles.erubricaConfigDeleteButton} onPress={() => setCertificateFile(null)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={17} color="#5C748A" />
                </Pressable>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.erubricaConfigStepCard}>
            <View style={styles.erubricaConfigStepHeader}>
              <View style={styles.erubricaConfigStepNumber}><Text style={styles.erubricaConfigStepNumberText}>2</Text></View>
              <View style={styles.erubricaPendingDocCopy}>
                <Text style={styles.erubricaConfigStepTitle}>Clave de acceso</Text>
                <Text style={styles.erubricaConfigStepHint}>Ingresa la clave del certificado (.p12) para habilitar la firma electrónica.</Text>
              </View>
            </View>
            <Field label="Clave del certificado *" value={certificatePassword} onChangeText={setCertificatePassword} secureTextEntry />
            {certificatePassword.trim() ? (
              <View style={styles.erubricaConfigSuccessRow}>
                <MaterialCommunityIcons name="shield-check-outline" size={15} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaConfigSuccessText}>Clave configurada correctamente.</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.erubricaConfigSideGrid}>
            <View style={styles.erubricaConfigSideCard}>
              <Text style={styles.erubricaConfigSideTitle}>Resumen de validación</Text>
              {[
                ['file-check-outline', certificateFile || firmaEfact ? 'Archivo detectado' : 'Archivo pendiente', certificateFile?.name ?? (firmaEfact ? 'Certificado configurado' : 'Selecciona el certificado .p12')],
                ['check-circle-outline', certificateFile || firmaEfactValida ? 'Formato válido' : 'Formato por validar', firmaEfactValida ? 'Certificado validado' : 'Certificado .p12 reconocido'],
                ['key-outline', certificatePassword.trim() || firmaEfact ? 'Clave configurada' : 'Clave pendiente', certificatePassword.trim() || firmaEfact ? 'Configurada' : 'Requerida para guardar'],
                ['circle', certificateFile && certificatePassword.trim() || firmaEfactValida ? 'Lista para usar' : 'Pendiente de completar', firmaEfactValida ? 'Disponible para firmar' : 'Guarda para confirmar'],
              ].map(([icon, title, text]) => (
                <View key={title} style={styles.erubricaConfigSummaryRow}>
                  <View style={styles.erubricaDropIcon}><MaterialCommunityIcons name={icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={17} color={ERUBRICA_COLORS.primary} /></View>
                  <View style={styles.erubricaPendingDocCopy}>
                    <Text style={styles.erubricaRequestOptionTitle}>{title}</Text>
                    <Text style={styles.erubricaRequestOptionText} numberOfLines={1}>{text}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.erubricaConfigSideCard}>
              <View style={styles.erubricaConfigProtectedHeader}>
                <View style={styles.erubricaPendingDocCopy}>
                  <Text style={styles.erubricaConfigSideTitle}>Tu información está protegida</Text>
                  <Text style={styles.erubricaRequestOptionText}>Usamos cifrado de nivel empresarial para proteger tu certificado y clave de acceso.</Text>
                </View>
                <View style={styles.erubricaConfigProtectedIcon}>
                  <MaterialCommunityIcons name="shield-check-outline" size={23} color="#FFFFFF" />
                </View>
              </View>
              {['La clave no se almacena en texto plano', 'Conexiones seguras y cifradas', 'Cumplimos estándares de seguridad'].map((item) => (
                <View key={item} style={styles.erubricaAdviceRow}>
                  <MaterialCommunityIcons name="check-circle-outline" size={15} color={ERUBRICA_COLORS.primary} />
                  <Text style={styles.erubricaAdviceText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.erubricaConfigActionBar}>
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label={loadingFirmaDetalle ? "Validando..." : "Validar ahora"} onPress={() => void cargarFirmaActiva(true)} />
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Cancelar" onPress={() => selectTab('inicio')} />
            <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Limpiar" onPress={() => { setCertificateFile(null); setCertificatePassword(''); }} />
            <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Guardar firma" loading={savingConfiguredSignature} onPress={() => void saveConfiguredSignature()} />
          </View>
        </View>
      ) : null}
      {tab === 'proveedor' ? (
        <View style={styles.clientCard}>
          <Text style={styles.clientDetailLabel}>Solicitudes del proveedor</Text>
          <Text style={styles.clientMeta}>Consulta el estado de solicitudes asociadas al proveedor de firma.</Text>
          <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Buscar solicitudes" loading={false} onPress={async () => { try { setProveedorItems(await buscarERubricaSolicitudesProveedor()); } catch (error) { Alert.alert('No se pudo consultar', error instanceof ApiError ? error.message : 'Intenta nuevamente.'); } }} />
          {proveedorItems.length === 0 ? <EmptyState title="Sin resultados" text="No se encontraron solicitudes del proveedor." /> : proveedorItems.slice(0, 20).map((item, index) => <Text key={`erubrica-proveedor-${index}`} style={styles.clientDetailValue}>{label(item, ['status', 'estado', 'uuid', 'id'], 'Solicitud')}</Text>)}
        </View>
      ) : null}
      {tab === 'soporte' ? (
        <View style={styles.clientCard}>
          <Text style={styles.clientDetailLabel}>Soporte E-RÚBRICA</Text>
          <Text style={styles.clientMeta}>Para firmar: carga un PDF, usa tu firma configurada o un .p12 temporal y verifica la clave. Si el certificado está vencido, renuévalo antes de estampar.</Text>
          <Text style={styles.clientDetailValue}>El acceso web también dispone de ayuda y administración avanzada de roles, usuarios y planes.</Text>
        </View>
      ) : null}
      {tab === 'solicitudes' && !loading && solicitudes.length === 0 ? <EmptyState title="Sin solicitudes" text="No hay solicitudes de firma para mostrar." /> : null}
      {tab === 'solicitudes' && !loading && solicitudes.slice(0, 8).map((item, index) => (
        <View key={`erubrica-solicitud-${index}`} style={[styles.clientCard, { borderLeftColor: ERUBRICA_COLORS.primary, borderColor: ERUBRICA_COLORS.border }]}>
            <View style={styles.clientCardHeader}>
            <View style={styles.clientHeroTitleBlock}>
              <Text style={styles.clientDetailLabel}>{label(item, ['solId', 'SolId', 'id', 'numero', 'solicitud'], 'Solicitud de firma')}</Text>
              <Text style={styles.clientMeta}>{label(item, ['estado', 'status', 'solEstado', 'estadoSolicitud', 'EstadoSolicitud'], 'Pendiente')}</Text>
            </View>
            <MaterialCommunityIcons name="file-sign" size={25} color={ERUBRICA_COLORS.primary} />
          </View>
              <Text style={styles.clientDetailValue}>{label(item, ['solFormatoFirma', 'SolFormatoFirma', 'formato', 'producto', 'descripcion'], 'Solicitud E-RÚBRICA')}</Text>
              {Number(label(item, ['solId', 'SolId', 'id'], '0')) > 0 ? <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Descargar firma .p12" onPress={async () => {
                try {
              const solId = Number(label(item, ['solId', 'SolId', 'id'], '0'));
                  const result = await descargarERubricaFirmaP12(solId);
                  const uri = writeBinaryCacheFile(`firma-${solId}.p12`, result.bytes);
                  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/x-pkcs12', dialogTitle: 'Compartir firma .p12' });
                } catch (error) { Alert.alert('No se pudo descargar', error instanceof ApiError ? error.message : 'La firma no está disponible.'); }
              }} /> : null}
        </View>
      ))}

      {tab === 'historial-documentos' ? (
        <View style={styles.erubricaHistoryStack}>
          <View style={styles.erubricaHistoryHero}>
            <View style={styles.erubricaHistoryHeroCopy}>
              <Text style={styles.erubricaHistoryEyebrow}>DOCUMENTOS ELECTRÓNICOS</Text>
              <Text style={styles.erubricaHistoryTitle}>Historial documentos</Text>
              <Text style={styles.erubricaHistorySubtitle}>Consulta, descarga o valida los PDF que has firmado electrónicamente.</Text>
            </View>
            <View style={styles.erubricaHistoryHeroActions}>
              <Pressable style={styles.erubricaHistoryValidateButton} onPress={() => void cargarDocumentosFirmados()} disabled={loadingDocumentosFirmados}>
                <MaterialCommunityIcons name="refresh" size={14} color={ERUBRICA_COLORS.text} />
                <Text style={styles.erubricaHistoryValidateText}>{loadingDocumentosFirmados ? 'Actualizando...' : 'Actualizar'}</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.erubricaHistoryPanel}>
            <View style={styles.erubricaHistoryFilters}>
              <View style={styles.erubricaHistorySearchBox}>
                <TextInput
                  value={historialQuery}
                  onChangeText={setHistorialQuery}
                  placeholder="Buscar por nombre de documento..."
                  placeholderTextColor="#8AA0B5"
                  style={styles.erubricaHistoryInput}
                />
                <MaterialCommunityIcons name="magnify" size={19} color="#5C748A" />
              </View>
            </View>
            {filteredFirmas.length === 0 ? (
              <EmptyState title="Sin documentos firmados" text="No se encontraron documentos con los filtros actuales." />
            ) : <ResultCollection
              items={filteredFirmas}
              pageSize={5}
              variant="plain"
              tone="green"
              resetKey={historialQuery}
              keyExtractor={(item, index) => `erubrica-historial-${itemValue(item, ['id', 'nombreArchivo', 'fileName']) || index}`}
              renderItem={(item) => {
              const signedDate = formatSignedDate(item);
              const documentName = label(item, ['nombreDocumento', 'documento', 'archivo', 'fileName', 'solFormatoFirma', 'SolFormatoFirma', 'nombre', 'descripcion'], 'Documento firmado');
              const signedBy = buildSolicitudTitular(item, 'Usuario');
              const signerEmail = label(item, ['email', 'correo', 'correoUsuario', 'solCorreo1', 'SolCorreo1'], '');
              const size = label(item, ['tamano', 'tamaño', 'size', 'peso'], 'No disponible');
              const status = label(item, ['estado', 'status', 'estadoFirma', 'estadoSolicitud', 'EstadoSolicitud'], 'Válido');
              const previewUrl = itemValue(item, ['previewUrl', 'url', 'downloadUrl', 'documentoUrl', 'ruta', 'archivoUrl']);
              const downloadUrl = itemValue(item, ['downloadUrl', 'url', 'documentoUrl', 'ruta', 'archivoUrl']);
              return (
                <View style={styles.erubricaHistoryRow}>
                  <View style={styles.erubricaHistoryDocIcon}>
                    <MaterialCommunityIcons name="file-pdf-box" size={19} color="#5C748A" />
                  </View>
                  <View style={styles.erubricaHistoryDocCopy}>
                    <Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{documentName}</Text>
                    <Text style={styles.erubricaHistoryDocMeta} numberOfLines={1}>PDF firmado desde e-rubrica</Text>
                    <View style={styles.erubricaHistoryDocDetails}>
                      <Text style={styles.erubricaHistoryDetailText}>{signedDate.date} {signedDate.time}</Text>
                      <Text style={styles.erubricaHistoryDetailText}>{size}</Text>
                    </View>
                    <Text style={styles.erubricaHistorySigner} numberOfLines={1}>{signedBy}{signerEmail ? ` · ${signerEmail}` : ''}</Text>
                  </View>
                  <View style={styles.erubricaHistoryRowSide}>
                    <View style={styles.erubricaHistoryStatusPill}>
                      <Text style={styles.erubricaHistoryStatusText}>✓ {status}</Text>
                    </View>
                    <View style={styles.erubricaHistoryActionRow}>
                      <Pressable style={styles.erubricaHistoryIconButton} onPress={() => downloadUrl ? onDownloadRemotePdf(downloadUrl, documentName) : Alert.alert('Descarga no disponible', 'Este registro no incluye un PDF para descargar.')}>
                        <MaterialCommunityIcons name="download-outline" size={17} color="#5C748A" />
                      </Pressable>
                      <Pressable style={styles.erubricaHistoryIconButton} onPress={() => previewUrl ? onPreviewRemotePdf(previewUrl, documentName) : Alert.alert('Compartir no disponible', 'Este registro no incluye un PDF para compartir.')}>
                        <MaterialCommunityIcons name="share-variant-outline" size={17} color={ERUBRICA_COLORS.primary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            }}
            />}
          </View>
        </View>
      ) : null}

      {tab === 'ver-mis-firmas' && !loading ? (
        <View style={styles.erubricaSignatureStack}>
          <View style={styles.erubricaSignatureHero}>
            <View style={styles.erubricaSignatureHeroCopy}>
              <Text style={styles.erubricaSignatureEyebrow}>SEGURIDAD DE FIRMA</Text>
              <Text style={styles.erubricaSignatureTitle}>Tu firma electrónica, clara y bajo control</Text>
              <Text style={styles.erubricaSignatureText}>Consulta la firma activa de tu cuenta o valida temporalmente otro archivo sin reemplazar tu configuración.</Text>
              <Pressable style={styles.erubricaSignatureRefreshButton} onPress={() => void cargarFirmaActiva(true)} disabled={loadingFirmaDetalle}>
                <MaterialCommunityIcons name="refresh" size={14} color={ERUBRICA_COLORS.text} />
                <Text style={styles.erubricaPendingLoadText}>{loadingFirmaDetalle ? 'Actualizando...' : 'Actualizar información'}</Text>
              </Pressable>
            </View>
            <View style={styles.erubricaSignatureStatusPanel}>
              <View style={styles.erubricaSignatureStatusIcon}>
                <MaterialCommunityIcons name="check-decagram" size={29} color="#88F0B1" />
              </View>
              <Text style={styles.erubricaSignatureStatusLabel}>ESTADO ACTUAL</Text>
              <Text style={styles.erubricaSignatureStatusText}>{firmaEfact ? firmaEfactValida ? 'Firma válida y vigente' : 'Firma requiere revisión' : 'Sin firma activa'}</Text>
              <Text style={styles.erubricaSignatureStatusName} numberOfLines={2}>{firmaTitular}</Text>
            </View>
          </View>

          <View style={styles.erubricaSignatureGrid}>
            <View style={styles.erubricaSignatureCard}>
              <View style={styles.erubricaAdviceHeader}>
                <View style={styles.erubricaDropIcon}>
                  <MaterialCommunityIcons name="card-account-details-outline" size={20} color={ERUBRICA_COLORS.primary} />
                </View>
                <View style={styles.erubricaPendingDocCopy}>
                  <Text style={styles.erubricaHistoryEyebrow}>FIRMA ACTIVA DE LA CUENTA</Text>
                  <Text style={styles.erubricaSignStep}>Información del certificado</Text>
                  <Text style={styles.erubricaSignHint}>Datos obtenidos directamente desde la API de validación de firma.</Text>
                </View>
              </View>
              {!firmaEfact ? <EmptyState title="Sin firma configurada" text="Configura un certificado .p12 para consultar su vigencia y sus datos." /> : (
                <>
                  <View style={styles.erubricaSignatureVerified}>
                    <MaterialCommunityIcons name="check-circle" size={19} color={ERUBRICA_COLORS.primary} />
                    <View style={styles.erubricaPendingDocCopy}>
                      <Text style={styles.erubricaHistoryMetricLabel}>CERTIFICADO VERIFICADO</Text>
                      <Text style={styles.erubricaRequestHistoryValue}>{firmaTitular}</Text>
                      <Text style={styles.erubricaRequestOptionText}>{firmaDetalleActiva?.mensaje || (firmaEfactValida ? 'La firma configurada es correcta y se encuentra vigente.' : 'La firma configurada requiere revisión.')}</Text>
                    </View>
                    <Text style={styles.erubricaSignatureValidPill}>{firmaEstado}</Text>
                  </View>
                  <View style={styles.erubricaSignatureInfoGrid}>
                    {[
                      ['Titular', firmaTitular],
                      ['Identificación', firmaIdentificacion],
                      ['Emitida', firmaEmision],
                      ['Expira', firmaExpira],
                      ['Vigencia restante', firmaDiasRestantes],
                      ['Autoridad emisora', firmaAutoridad],
                      ['Número de serie', firmaSerie],
                      ['Huella digital', firmaHuella],
                    ].map(([title, value]) => (
                      <View key={title} style={styles.erubricaSignatureInfoCell}>
                        <Text style={styles.erubricaHistoryMetricLabel}>{title}</Text>
                        <Text style={styles.erubricaRequestHistoryValue} numberOfLines={title === 'Huella digital' ? 3 : 2}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.erubricaSignatureCard}>
              <View style={styles.erubricaAdviceHeader}>
                <View style={styles.erubricaDropIcon}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color={ERUBRICA_COLORS.primary} />
                </View>
                <View style={styles.erubricaPendingDocCopy}>
                  <Text style={styles.erubricaHistoryEyebrow}>VALIDACIÓN TEMPORAL</Text>
                  <Text style={styles.erubricaSignStep}>Comprueba un archivo y su clave</Text>
                  <Text style={styles.erubricaSignHint}>El archivo se usa una sola vez y no modifica la firma activa.</Text>
                </View>
              </View>
              <View style={styles.erubricaValidationStrip}>
                <MaterialCommunityIcons name="incognito" size={16} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaValidationStripText}>Ni el archivo ni la clave se guardan después de la validación.</Text>
              </View>
              <Pressable style={styles.erubricaDropzone} onPress={pickCertificate}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={24} color={ERUBRICA_COLORS.primary} />
                <Text style={styles.erubricaDropTitle}>{certificateFile ? certificateFile.name : 'Selecciona tu archivo .p12'}</Text>
                <Text style={styles.erubricaDropText}>Haz clic para buscar · Máximo 5 MB</Text>
              </Pressable>
               <Field label="Clave del certificado *" value={certificatePassword} onChangeText={setCertificatePassword} secureTextEntry />
              <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Validar archivo y clave" loading={validandoFirmaTemporal} onPress={() => void validarFirmaTemporal()} />
            </View>
          </View>
        </View>
      ) : null}

      {tab === 'firmas' && !loading && firmas.length === 0 ? <EmptyState title="Sin firmas" text="No hay certificados o firmas disponibles." /> : null}
      {tab === 'firmas' && !loading && firmas.slice(0, 8).map((item, index) => (
        <View key={`erubrica-firma-${index}`} style={[styles.clientCard, { borderLeftColor: ERUBRICA_COLORS.primary, borderColor: ERUBRICA_COLORS.border }]}>
          <Text style={styles.clientDetailLabel}>{label(item, ['nombreTitular', 'titular', 'razonSocial'], 'Firma electrónica')}</Text>
          <Text style={styles.clientMeta}>{label(item, ['estado', 'estadoVigencia', 'status'], 'Estado no disponible')}</Text>
          <Text style={styles.clientDetailValue}>{label(item, ['fechaExpiracion', 'diasRestantes', 'numeroSerie'], 'Sin detalle adicional')}</Text>
        </View>
      ))}

      {['solicitudes', 'proveedor'].includes(tab) ? <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label="Sincronizar solicitudes pendientes" loading={false} onPress={onSync} /> : null}
      <Modal visible={solicitudBorradoresOpen} transparent animationType="fade" onRequestClose={() => setSolicitudBorradoresOpen(false)}>
        <View style={styles.erubricaPaymentOverlay}>
          <View style={styles.erubricaPaymentModal}>
            <View style={styles.erubricaPaymentHeader}>
              <View style={styles.erubricaHistoryHeroCopy}>
                <Text style={styles.erubricaHistoryEyebrow}>SOLICITUDES DE CLIENTES</Text>
                <Text style={styles.erubricaPaymentTitle}>Borradores guardados</Text>
                <Text style={styles.erubricaHistorySubtitle}>Disponibles también en la web con esta misma cuenta.</Text>
              </View>
              <Pressable style={styles.erubricaPaymentClose} onPress={() => setSolicitudBorradoresOpen(false)}><MaterialCommunityIcons name="close" size={20} color="#1787D5" /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.portalStack}>
              {solicitudBorradores.length === 0 ? <EmptyState title="Sin solicitudes guardadas" text="Guarda una solicitud para continuarla luego desde cualquier dispositivo." /> : solicitudBorradores.map((item) => (
                <View key={item.id} style={styles.erubricaHistoryRow}>
                  <View style={styles.erubricaHistoryDocIcon}><MaterialCommunityIcons name="file-document-edit-outline" size={19} color={ERUBRICA_COLORS.primary} /></View>
                  <View style={styles.erubricaHistoryDocCopy}>
                    <Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{item.titulo}</Text>
                    <Text style={styles.erubricaHistoryDetailText}>Guardada {formatDocumentDate(item.fechaGuardado)}</Text>
                  </View>
                  <Pressable style={styles.erubricaSignedDocsButton} onPress={() => usarSolicitudBorrador(item)}><Text style={styles.erubricaSignedDocsText}>Usar</Text></Pressable>
                  <Pressable style={styles.erubricaPaymentClose} onPress={() => void eliminarSolicitudBorrador(item)}><MaterialCommunityIcons name="trash-can-outline" size={18} color="#B4232D" /></Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={signedDocumentsModalOpen} transparent animationType="fade" onRequestClose={() => setSignedDocumentsModalOpen(false)}>
        <View style={styles.erubricaPaymentOverlay}>
          <View style={styles.erubricaPaymentModal}>
            <View style={styles.erubricaPaymentHeader}>
              <View style={styles.erubricaHistoryHeroCopy}>
                <Text style={styles.erubricaHistoryEyebrow}>HISTORIAL DE DOCUMENTOS</Text>
                <Text style={styles.erubricaPaymentTitle}>Seleccionar documento firmado</Text>
              </View>
              <Pressable style={styles.erubricaPaymentClose} onPress={() => setSignedDocumentsModalOpen(false)}>
                <MaterialCommunityIcons name="close" size={20} color="#1787D5" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.portalStack}>
              {documentosFirmados.length === 0 ? <EmptyState title="Sin documentos firmados" text="Cuando firmes un PDF, aparecerá aquí para validarlo." /> : documentosFirmados.map((item, index) => {
                const documentName = label(item, ['nombreDocumento', 'documento', 'archivo', 'fileName'], 'Documento firmado.pdf');
                const signedDate = formatSignedDate(item);
                const size = label(item, ['tamano', 'tamaño', 'size', 'peso'], '');
                return (
                  <View key={`validar-firmado-${index}`} style={styles.erubricaHistoryRow}>
                    <View style={styles.erubricaHistoryDocIcon}><MaterialCommunityIcons name="file-pdf-box" size={19} color="#5C748A" /></View>
                    <View style={styles.erubricaHistoryDocCopy}>
                      <Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{documentName}</Text>
                      <Text style={styles.erubricaHistoryDetailText}>{signedDate.date} {signedDate.time}{size ? ` · ${size}` : ''}</Text>
                    </View>
                    <Pressable style={styles.erubricaSignedDocsButton} disabled={loadingSignedDocument} onPress={() => void useSignedDocumentForValidation(item)}>
                      {loadingSignedDocument ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.erubricaSignedDocsText}>Usar</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={pendingDocumentsModalOpen} transparent animationType="fade" onRequestClose={() => setPendingDocumentsModalOpen(false)}>
        <View style={styles.erubricaPaymentOverlay}>
          <View style={styles.erubricaPaymentModal}>
            <View style={styles.erubricaPaymentHeader}>
              <View style={styles.erubricaHistoryHeroCopy}><Text style={styles.erubricaHistoryEyebrow}>REPOSITORIO</Text><Text style={styles.erubricaPaymentTitle}>Documentos cargados</Text><Text style={styles.erubricaHistorySubtitle}>Selecciona un documento por firmar o carga uno nuevo.</Text></View>
              <Pressable style={styles.erubricaPaymentClose} onPress={() => setPendingDocumentsModalOpen(false)}><MaterialCommunityIcons name="close" size={20} color="#1787D5" /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.portalStack} keyboardShouldPersistTaps="handled">
              <Pressable style={[styles.erubricaPendingLoadButton, styles.erubricaPendingLoadButtonPrimary]} onPress={() => void cargarNuevoDocumentoPendiente()}><MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#FFFFFF" /><Text style={[styles.erubricaPendingLoadText, styles.erubricaPendingLoadTextPrimary]}>Subir documento para firmar</Text></Pressable>
              {loadingDocumentosPendientes ? <ActivityIndicator color={ERUBRICA_COLORS.primary} /> : null}
              {!loadingDocumentosPendientes && documentosPendientes.length === 0 ? <EmptyState title="Sin documentos cargados" text="Carga un PDF y se conservará su nombre original." /> : documentosPendientes.map((item, index) => <View key={`firmar-pendiente-${item.nombreArchivo}-${index}`} style={styles.erubricaHistoryRow}><View style={styles.erubricaHistoryDocIcon}><MaterialCommunityIcons name="file-pdf-box" size={19} color="#5C748A" /></View><View style={styles.erubricaHistoryDocCopy}><Text style={styles.erubricaHistoryDocName} numberOfLines={2}>{item.nombreDocumento}</Text><Text style={styles.erubricaHistoryDetailText}>{formatDocumentDate(item.fecha)}</Text></View><Pressable style={styles.erubricaSignedDocsButton} onPress={() => { setPendingDocumentsModalOpen(false); void usarDocumentoPendiente(item); }}><Text style={styles.erubricaSignedDocsText}>Usar</Text></Pressable></View>)}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={paymentModalOpen} transparent animationType="fade" onRequestClose={() => setPaymentModalOpen(false)}>
        <View style={styles.erubricaPaymentOverlay}>
          <View style={styles.erubricaPaymentModal}>
            <View style={styles.erubricaPaymentHeader}>
              <View style={styles.erubricaHistoryHeroCopy}>
                <Text style={styles.erubricaHistoryEyebrow}>RESUMEN DE PAGO</Text>
                <Text style={styles.erubricaPaymentTitle}>Firma electrónica {solicitudPlan.label}</Text>
                <Text style={styles.erubricaHistorySubtitle}>Elige pagar en línea o registrar una transferencia para aprobación.</Text>
              </View>
              <Pressable style={styles.erubricaPaymentClose} onPress={() => setPaymentModalOpen(false)}>
                <MaterialCommunityIcons name="close" size={20} color="#1787D5" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.erubricaPaymentContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            <View style={styles.erubricaPaymentSummaryGrid}>
              <View style={styles.erubricaPaymentSummaryBox}><Text style={styles.erubricaHistoryMetricLabel}>SERVICIO</Text><Text style={styles.erubricaPaymentSummaryValue}>E-RÚBRICA</Text></View>
              <View style={styles.erubricaPaymentSummaryBox}><Text style={styles.erubricaHistoryMetricLabel}>SUBTOTAL</Text><Text style={styles.erubricaPaymentSummaryValue}>USD {solicitudSubtotal.toFixed(2)}</Text></View>
              <View style={styles.erubricaPaymentSummaryBox}><Text style={styles.erubricaHistoryMetricLabel}>IVA 15%</Text><Text style={styles.erubricaPaymentSummaryValue}>USD {solicitudIva.toFixed(2)}</Text></View>
              <View style={[styles.erubricaPaymentSummaryBox, styles.erubricaPaymentTotalBox]}><Text style={styles.erubricaHistoryMetricLabel}>TOTAL</Text><Text style={styles.erubricaPaymentSummaryValue}>USD {solicitudTotal.toFixed(2)}</Text></View>
            </View>
            <View style={styles.erubricaPaymentMethodGrid}>
              <Pressable style={[styles.erubricaPaymentMethod, paymentMethod === 'deuna' && styles.erubricaPaymentMethodActive]} onPress={() => setPaymentMethod('deuna')}>
                <MaterialCommunityIcons name="cellphone-check" size={22} color="#1787D5" />
                <View style={styles.erubricaPendingDocCopy}><Text style={styles.erubricaRequestOptionTitle}>DeUna / Pago en línea</Text><Text style={styles.erubricaRequestOptionText}>Abre el checkout seguro y se acredita al aprobarse.</Text></View>
              </Pressable>
              <Pressable style={[styles.erubricaPaymentMethod, paymentMethod === 'transferencia' && styles.erubricaPaymentMethodActive]} onPress={() => setPaymentMethod('transferencia')}>
                <MaterialCommunityIcons name="bank-outline" size={22} color="#1787D5" />
                <View style={styles.erubricaPendingDocCopy}><Text style={styles.erubricaRequestOptionTitle}>Transferencia bancaria</Text><Text style={styles.erubricaRequestOptionText}>Se valida manualmente en un plazo máximo de 24 horas.</Text></View>
              </Pressable>
            </View>
            {paymentMethod === 'transferencia' ? (
              <View style={styles.erubricaPaymentTransferGrid}>
                <View style={styles.erubricaRequestPanel}>
                  <Text style={styles.erubricaPaymentTitle}>Información de pago</Text>
                  <Text style={styles.clientFilterLabel}>Banco *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                    {['Banco Pichincha', 'Banco Guayaquil', 'Banco Internacional', 'Banco Pacifico', 'Banco Produbanco', 'Banco Bolivariano', 'Cooperativa JEP', 'Otra institucion'].map((banco) => (
                      <Pressable key={banco} style={[styles.clientFilterChip, transferForm.banco === banco && styles.clientFilterChipActive]} onPress={() => setTransferForm((current) => ({ ...current, banco }))}><Text style={[styles.clientFilterChipText, transferForm.banco === banco && styles.clientFilterChipTextActive]}>{banco}</Text></Pressable>
                    ))}
                  </ScrollView>
                  <Field label="Banco *" value={transferForm.banco} onChangeText={(value) => setTransferForm((current) => ({ ...current, banco: value }))} />
                  <Field label="Titular de la cuenta *" value={transferForm.titular} onChangeText={(value) => setTransferForm((current) => ({ ...current, titular: value }))} />
                  <Field label="N. cuenta de origen *" value={transferForm.cuenta} onChangeText={(value) => setTransferForm((current) => ({ ...current, cuenta: value.replace(/\D/g, '') }))} keyboardType="number-pad" />
                  <Field label="N. comprobante *" value={transferForm.comprobante} onChangeText={(value) => setTransferForm((current) => ({ ...current, comprobante: value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50) }))} autoCapitalize="characters" />
                  <Pressable style={styles.erubricaDropzone} onPress={pickTransferReceipt}>
                    <MaterialCommunityIcons name="image-plus" size={24} color="#1787D5" />
                    <Text style={styles.erubricaDropTitle}>{transferReceipt?.fileName ?? 'Arrastra o selecciona el comprobante'}</Text>
                    <Text style={styles.erubricaDropText}>JPG o PNG. Máximo 5MB.</Text>
                  </Pressable>
                </View>
                <View style={styles.erubricaPaymentBankBox}>
                  <Text style={styles.erubricaRequestOptionTitle}>Total a pagar</Text>
                  <Text style={styles.erubricaPaymentBankText}>Subtotal USD {solicitudSubtotal.toFixed(2)}{`\n`}IVA 15% USD {solicitudIva.toFixed(2)}{`\n`}Total USD {solicitudTotal.toFixed(2)}</Text>
                  <Text style={styles.erubricaRequestOptionTitle}>Pagar a</Text>
                  <Text style={styles.erubricaPaymentBankText}>Banco: Banco Pichincha{`\n`}Tipo de cuenta: Cuenta corriente{`\n`}Número de cuenta: 2100346647{`\n`}RUC: 1793233799001{`\n`}Nombre: NUMERICASOFTWARE S.A.S.{`\n`}e-mail: contabilidad@numericasoftware.com</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.erubricaPaymentActions}>
              <SecondaryButton accentColor={ERUBRICA_COLORS.primary} label="Cancelar" onPress={() => setPaymentModalOpen(false)} />
              <PrimaryButton accentColor={ERUBRICA_COLORS.primary} label={paymentMethod === 'deuna' ? 'Pagar con DeUna' : 'Enviar transferencia'} loading={paymentLoading} onPress={payERubricaRequest} />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
