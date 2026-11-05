import { apiRequest } from './apiClient';
import { RETENCIONES_GENERADAS_PATH } from '../config/api';
import type { DocumentPdfFormat } from '../utils/documentFormatting';

type ApiRow = Record<string, unknown>;

const RETENCION_BASE_KEYS = [
  'base',
  'Base',
  'baseImponible',
  'BaseImponible',
  'baseimp',
  'BaseImp',
  'baseRetencion',
  'BaseRetencion',
  'baseImponibleRetencion',
  'BaseImponibleRetencion',
  'subtotal',
  'Subtotal',
  'subtotalBase',
  'SubtotalBase',
  'subtotalSinImpuestos',
  'SubtotalSinImpuestos',
  'totalSinImpuestos',
  'TotalSinImpuestos',
  'baseGravada',
  'BaseGravada',
  'valorBase',
  'ValorBase',
  'importeBase',
  'ImporteBase',
  'baseTotal',
  'BaseTotal',
];

const RETENIDO_KEYS = [
  'retenido',
  'Retenido',
  'valorRetenido',
  'ValorRetenido',
  'valorretenido',
  'Valorretenido',
  'totalRetenido',
  'TotalRetenido',
  'valorRetencion',
  'ValorRetencion',
  'valorretencion',
  'Valorretencion',
  'totalRetencion',
  'TotalRetencion',
  'montoRetenido',
  'MontoRetenido',
  'importeRetenido',
  'ImporteRetenido',
  'importeRetencion',
  'ImporteRetencion',
  'valorRet',
  'ValorRet',
  'valRetenido',
  'ValRetenido',
  'valret',
  'Valret',
  'totalRetenido',
  'TotalRetenido',
  'valRetencion',
  'ValRetencion',
  'impuestoRetenido',
  'ImpuestoRetenido',
  'valorReteRenta',
  'ValorReteRenta',
  'valorRetIva',
  'ValorRetIva',
  'valor',
  'Valor',
  'importe',
  'Importe',
];

const RETENCION_DETAIL_KEYS = [
  'detalles',
  'Detalles',
  'detalle',
  'Detalle',
  'impuestos',
  'Impuestos',
  'retenciones',
  'Retenciones',
  'detalleRetencion',
  'DetalleRetencion',
  'detallesRetencion',
  'DetallesRetencion',
  'items',
  'Items',
  'conceptos',
  'Conceptos',
];

export type RetencionListItem = {
  codRetencion: number;
  numero?: string | null;
  fecha?: string | null;
  documentoSustento?: string | null;
  proveedor?: string | null;
  identificacionProveedor?: string | null;
  tipoIdentificacionProveedor?: string | null;
  estadoSri?: string | null;
  autorizado?: boolean | null;
  base?: number | null;
  retenido?: number | null;
  claveAcceso?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  numeroAutorizacion?: string | null;
  mensajeSri?: string | null;
};

export type RetencionCatalogItem = {
  codigo: string;
  descripcion: string;
  valor?: number | null;
};

export type LiquidacionRetencionInput = {
  tipo: 'IVA' | 'RENTA';
  idRet: number;
  codigoRetencion: string;
  descripcionRet: string;
  base: number;
  porcentajeRetencion: number;
  valorRetenido: number;
  valor: number;
};

const EFACT_RETENCION_IVA_VALORES = new Set([20, 70, 100]);
const EFACT_RETENCION_RENTA_CODIGO = '311';

export async function getRetenciones(userId: number, top = 0) {
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(
    withQuery(RETENCIONES_GENERADAS_PATH, { idUsuario: userId, top }),
  );
  const rows = normalizeRows(response);
  const retenciones = rows.filter(isRetencionRow);
  return deduplicateRetenciones((retenciones.length ? retenciones : rows).map(toRetencionListItem));
}

export function getRetencionPdf(userId: number, codRetencion: number, formato: DocumentPdfFormat = 'A4') {
  return apiRequest<{ url: string }>(`/api/retenciones/${codRetencion}/pdf?idUsuario=${userId}&formato=${formato}`);
}

export function getRetencionXml(userId: number, codRetencion: number) {
  return apiRequest<{ url: string }>(`/api/retenciones/${codRetencion}/xml?idUsuario=${userId}`);
}

export function enviarRetencionCorreo(userId: number, codRetencion: number) {
  return apiRequest<void>(`/api/retenciones/${codRetencion}/enviar-correo?idUsuario=${userId}`, {
    method: 'POST',
    body: JSON.stringify({ idUsuario: userId, forzarReenvio: true, correosCopia: [] }),
  });
}

export function emitirRetencionSri(userId: number, codRetencion: number) {
  return apiRequest<ApiRow>(`/api/retenciones/${codRetencion}/emitir?idUsuario=${userId}`, { method: 'POST' }).then((response) => ({
    estado: text(pickValue(response, ['estado', 'Estado'])),
    mensaje: text(pickValue(response, ['mensaje', 'Mensaje', 'message', 'Message'])),
    autorizacion: text(pickValue(response, ['autorizacion', 'Autorizacion', 'numeroAutorizacion', 'NumeroAutorizacion'])),
  }));
}

export async function getRetencionCatalogo(tipo: 'IVA' | 'RENTA') {
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(`/api/retenciones-catalogo/${tipo.toLowerCase()}`);
  const items = normalizeRows(response).map((row) => ({
    codigo: text(pickValue(row, ['codigo', 'Codigo', 'id', 'Id'])).trim(),
    descripcion: text(pickValue(row, ['descripcion', 'Descripcion', 'nombre', 'Nombre'])) || 'Retencion',
    valor: numberValue(pickValue(row, ['valorFinal', 'ValorFinal', 'valor', 'Valor', 'porcentaje', 'Porcentaje'])),
  })).filter((item) => item.codigo);
  const unique = new Map<string, RetencionCatalogItem>();
  items.forEach((item) => unique.set(item.codigo, unique.get(item.codigo) ?? item));
  const catalogo = Array.from(unique.values());
  if (tipo === 'IVA') {
    return catalogo.filter((item) => EFACT_RETENCION_IVA_VALORES.has(Number(item.valor ?? 0)));
  }

  return catalogo
    .filter((item) => item.codigo.trim() === EFACT_RETENCION_RENTA_CODIGO)
    .map((item) => ({ ...item, valor: 3 }));
}

export async function crearRetencionDesdeLiquidacion(userId: number, codLiquidacion: number, retenciones: LiquidacionRetencionInput[]) {
  const response = await apiRequest<ApiRow>(
    `/api/liquidaciones-compra/${codLiquidacion}/retencion?idUsuario=${userId}`,
    {
      method: 'POST',
      body: JSON.stringify({ Retenciones: retenciones }),
    },
  );
  return {
    codLiquidacion: numberValue(pickValue(response, ['codLiquidacion', 'CodLiquidacion'])),
    codRetencion: numberValue(pickValue(response, ['codRetencion', 'CodRetencion', 'secRetencion', 'SecRetencion'])),
    numeroRetencion: text(pickValue(response, ['numeroRetencion', 'NumeroRetencion', 'numRetencion', 'NumRetencion'])) || undefined,
  };
}

function normalizeRows(response: ApiRow[] | Record<string, unknown>): ApiRow[] {
  if (Array.isArray(response)) return response;
  const values = [response.items, response.Items, response.data, response.Data, response.retenciones, response.Retenciones, response.registros, response.Registros, response.result, response.Result, response.results, response.Results];
  for (const value of values) {
    if (Array.isArray(value)) return value as ApiRow[];
    if (isRecord(value)) {
      const nestedRows = normalizeRows(value);
      if (nestedRows.length) return nestedRows;
    }
  }
  const firstArray = Object.values(response).find(Array.isArray);
  if (Array.isArray(firstArray)) return firstArray as ApiRow[];
  return Object.keys(response).length ? [response] : [];
}

function withQuery(path: string, params: Record<string, string | number>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => query.set(key, String(value)));
  return `${path}${path.includes('?') ? '&' : '?'}${query.toString()}`;
}

function isRetencionRow(row: ApiRow) {
  const codDocumento = text(pickValue(row, ['coddocumento', 'CodDocumento', 'tipoDocumento', 'TipoDocumento', 'documentType', 'DocumentType']));
  if (['7', '07'].includes(codDocumento.trim())) return true;
  if (['numeroRetencion', 'NumeroRetencion', 'numRetencion', 'NumRetencion', 'codRetencion', 'CodRetencion', 'secRetencion', 'SecRetencion'].some((key) => row[key] !== null && row[key] !== undefined)) return true;

  const values = [
    pickValue(row, ['tipo', 'Tipo', 'tipoComprobante', 'TipoComprobante', 'documento', 'Documento', 'descripcion', 'Descripcion']),
    pickValue(row, ['numeroRetencion', 'NumeroRetencion', 'numRetencion', 'NumRetencion', 'codRetencion', 'CodRetencion']),
  ]
    .map(text)
    .join(' ')
    .toLowerCase();

  return values.includes('retencion') || values.includes('retención');
}

function toRetencionListItem(row: ApiRow): RetencionListItem {
  const serie = text(pickValue(row, ['serie', 'Serie']));
  const numero = text(pickValue(row, ['numero', 'Numero', 'numeroRetencion', 'NumeroRetencion', 'numRetencion', 'NumRetencion', 'secuencial', 'Secuencial']));
  const numeroCompleto = text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']));
  const base = numberValue(pickValue(row, [...RETENCION_BASE_KEYS, 'baseTotal', 'BaseTotal'])) ?? sumNestedNumbers(row, RETENCION_DETAIL_KEYS, RETENCION_BASE_KEYS);
  const retenido = numberValue(pickValue(row, RETENIDO_KEYS)) ?? sumNestedNumbers(row, RETENCION_DETAIL_KEYS, RETENIDO_KEYS);

  const autorizado = booleanValue(pickValue(row, ['autorizado', 'Autorizado'])) === true;

  return {
    codRetencion: numberValue(pickValue(row, ['codRetencion', 'CodRetencion', 'codretencion', 'codFactura', 'CodFactura', 'codfactura', 'secRetencion', 'SecRetencion', 'sec', 'Sec', 'idRetencion', 'IdRetencion', 'id', 'Id'])) ?? 0,
    numero: numeroCompleto || [serie, numero].filter(Boolean).join('-') || numero || null,
    fecha: text(pickValue(row, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fechaDocumento', 'FechaDocumento', 'fechaSustento', 'FechaSustento', 'fechaRetencion', 'FechaRetencion', 'fechaCreacion', 'FechaCreacion', 'fechaAutorizacion', 'FechaAutorizacion'])) || null,
    documentoSustento: text(pickValue(row, ['documentoSustento', 'DocumentoSustento', 'sustento', 'Sustento', 'numeroSustento', 'NumeroSustento', 'factura', 'Factura'])) || null,
    proveedor: text(pickValue(row, ['proveedor', 'Proveedor', 'nombreProveedor', 'NombreProveedor', 'razonSocial', 'RazonSocial'])) || null,
    identificacionProveedor: text(pickValue(row, ['identificacionProveedor', 'IdentificacionProveedor', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
    tipoIdentificacionProveedor: text(pickValue(row, ['tipoIdentificacionProveedor', 'TipoIdentificacionProveedor'])) || null,
    estadoSri: normalizeRetencionState(pickValue(row, ['estadoSri', 'EstadoSri', 'estadoSRI', 'EstadoSRI', 'estado', 'Estado']), autorizado),
    autorizado,
    base,
    retenido,
    claveAcceso: text(pickValue(row, ['claveAcceso', 'ClaveAcceso', 'clave', 'Clave'])) || null,
    pdfUrl: text(pickValue(row, ['pdfUrl', 'PdfUrl', 'urlPdf', 'UrlPdf'])) || null,
    xmlUrl: text(pickValue(row, ['xmlUrl', 'XmlUrl', 'urlXml', 'UrlXml'])) || null,
    numeroAutorizacion: text(pickValue(row, ['numeroAutorizacion', 'NumeroAutorizacion', 'numAutorizacion', 'NumAutorizacion'])) || null,
    mensajeSri: text(pickValue(row, ['mensajeSri', 'MensajeSri', 'mensajeSRI', 'MensajeSRI', 'mensaje', 'Mensaje', 'errorSri', 'ErrorSri', 'observacion', 'Observacion'])) || null,
  };
}

function deduplicateRetenciones(items: RetencionListItem[]) {
  const unique = new Map<string, RetencionListItem>();
  items.forEach((item) => {
    const key = item.codRetencion > 0
      ? `id:${item.codRetencion}`
      : `doc:${[item.numero, item.documentoSustento, item.identificacionProveedor, item.fecha].map((value) => text(value).trim().toLowerCase()).join('|')}`;
    const existing = unique.get(key);
    unique.set(key, existing ? mergeRetencion(existing, item) : item);
  });
  return Array.from(unique.values());
}

function mergeRetencion(existing: RetencionListItem, incoming: RetencionListItem) {
  return Object.fromEntries(Object.entries(existing).map(([key, value]) => [key, value ?? incoming[key as keyof RetencionListItem]])) as RetencionListItem;
}

function normalizeRetencionState(value: unknown, autorizado: boolean) {
  const normalized = text(value).trim().toUpperCase().replace(/-/g, '_');
  if (autorizado || normalized.includes('AUTORIZ')) return 'AUTORIZADO';
  if (normalized.includes('ERROR') || normalized.includes('FALL') || normalized.includes('EXCEPTION')) return 'ERROR';
  if (normalized.includes('RECHAZ') || normalized.includes('DEVUELT') || normalized.includes('NO_AUTORIZ') || normalized.includes('NEGAD')) return 'RECHAZADO';
  return 'PENDIENTE';
}

function pickValue(row: ApiRow, keys: string[]) {
  for (const key of keys) if (row[key] !== null && row[key] !== undefined) return row[key];
  const normalizedKeys = keys.map(normalizeKey);
  return Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalizedKeys.includes(normalizeKey(key)))?.[1];
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isRecord(value: unknown): value is ApiRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sumNestedNumbers(row: ApiRow, containerKeys: string[], valueKeys: string[]) {
  const containers = containerKeys
    .map((key) => pickValue(row, [key]))
    .filter((value) => value !== null && value !== undefined);

  const values = containers.flatMap(collectRecords).map((item) => numberValue(pickValue(item, valueKeys))).filter((value): value is number => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function collectRecords(value: unknown): ApiRow[] {
  if (Array.isArray(value)) return value.flatMap(collectRecords);
  if (!isRecord(value)) return [];

  const nested = Object.values(value).flatMap((nestedValue) => (Array.isArray(nestedValue) || isRecord(nestedValue) ? collectRecords(nestedValue) : []));
  return [value, ...nested];
}

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let normalized = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    normalized = lastComma > lastDot ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '');
  } else if (lastComma > -1) {
    normalized = normalized.replace(',', '.');
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 's', 'a', 't', 'autorizado'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'pendiente', 'no autorizado', 'inactivo'].includes(normalized)) return false;
  }
  return null;
}
