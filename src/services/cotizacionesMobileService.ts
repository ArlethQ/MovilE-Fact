import { API_BASE_URL } from '../config/api';
import { apiRequest } from './apiClient';

export type CotizacionDetalle = {
  codigoProducto: number;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
  descuento: number;
  tarifaIva: number;
  detalle?: string | null;
  totalLinea: number;
};

export type Cotizacion = {
  id: number;
  titulo: string;
  idCliente?: number | null;
  nombreCliente: string;
  identificacionCliente?: string | null;
  fechaCreacion?: string | null;
  fechaAprobacion?: string | null;
  fechaVigencia?: string | null;
  estado: string;
  formaPago?: string | null;
  detalle?: string | null;
  codFactura?: number | null;
  totalEstimado: number;
  detalles: CotizacionDetalle[];
};

export type CotizacionDetalleInput = {
  codigoProducto: number;
  precioUnitario: number;
  cantidad: number;
  descuento: number;
  tarifaIva?: number | null;
  detalle?: string | null;
};

export type CotizacionInput = {
  titulo: string;
  idCliente: number;
  formaPago: string;
  detalle?: string | null;
  fechaVigencia?: string | null;
  detalles: CotizacionDetalleInput[];
};

type ApiRow = Record<string, unknown>;

const value = (row: ApiRow, keys: string[]) => keys.map((key) => row[key]).find((item) => item !== undefined);
const text = (row: ApiRow, keys: string[]) => {
  const item = value(row, keys);
  return item === null || item === undefined ? '' : String(item);
};
const number = (row: ApiRow, keys: string[]) => {
  const parsed = Number(value(row, keys));
  return Number.isFinite(parsed) ? parsed : 0;
};

function normalizeDetalle(source: unknown): CotizacionDetalle {
  const row = (source && typeof source === 'object' ? source : {}) as ApiRow;
  return {
    codigoProducto: number(row, ['codigoProducto', 'CodigoProducto']),
    nombreProducto: text(row, ['nombreProducto', 'NombreProducto']) || 'Producto / servicio',
    precioUnitario: number(row, ['precioUnitario', 'PrecioUnitario']),
    cantidad: number(row, ['cantidad', 'Cantidad']),
    descuento: number(row, ['descuento', 'Descuento']),
    tarifaIva: number(row, ['tarifaIva', 'TarifaIva']),
    detalle: text(row, ['detalle', 'Detalle']) || null,
    totalLinea: number(row, ['totalLinea', 'TotalLinea']),
  };
}

export function normalizeCotizacion(source: unknown): Cotizacion {
  const row = (source && typeof source === 'object' ? source : {}) as ApiRow;
  const rawDetalles = value(row, ['detalles', 'Detalles']);
  return {
    id: number(row, ['id', 'Id']),
    titulo: text(row, ['titulo', 'Titulo']) || 'Proforma',
    idCliente: number(row, ['idCliente', 'IdCliente']) || null,
    nombreCliente: text(row, ['nombreCliente', 'NombreCliente']) || 'Sin cliente',
    identificacionCliente: text(row, ['identificacionCliente', 'IdentificacionCliente']) || null,
    fechaCreacion: text(row, ['fechaCreacion', 'FechaCreacion']) || null,
    fechaAprobacion: text(row, ['fechaAprobacion', 'FechaAprobacion']) || null,
    fechaVigencia: text(row, ['fechaVigencia', 'FechaVigencia']) || null,
    estado: text(row, ['estado', 'Estado']) || 'Pendiente',
    formaPago: text(row, ['formaPago', 'FormaPago']) || null,
    detalle: text(row, ['detalle', 'Detalle']) || null,
    codFactura: number(row, ['codFactura', 'CodFactura']) || null,
    totalEstimado: number(row, ['totalEstimado', 'TotalEstimado']),
    detalles: Array.isArray(rawDetalles) ? rawDetalles.map(normalizeDetalle) : [],
  };
}

export async function getCotizaciones(userId: number) {
  const response = await apiRequest<unknown>(`/api/cotizaciones?userId=${userId}`);
  const rows = Array.isArray(response) ? response : [];
  return rows.map(normalizeCotizacion);
}

export function createCotizacion(userId: number, input: CotizacionInput) {
  return apiRequest<Cotizacion>(`/api/cotizaciones?userId=${userId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCotizacion(userId: number, id: number, input: CotizacionInput) {
  return apiRequest<Cotizacion>(`/api/cotizaciones/${id}?userId=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function aprobarCotizacion(userId: number, id: number) {
  return apiRequest<{ mensaje?: string }>(`/api/cotizaciones/${id}/aprobar?userId=${userId}`, { method: 'POST' });
}

export function darDeBajaCotizacion(userId: number, id: number) {
  return apiRequest<{ mensaje?: string }>(`/api/cotizaciones/${id}/dar-baja?userId=${userId}`, { method: 'POST' });
}

export function emitirCotizacion(userId: number, id: number, codEmisor: number, serie: string) {
  return apiRequest<{ mensaje?: string; codfactura?: number; numeroComprobante?: string | null }>(`/api/cotizaciones/${id}/emitir`, {
    method: 'POST',
    body: JSON.stringify({ idUsuario: userId, codEmisor, serie }),
  });
}

export function getCotizacionPdfUrl(userId: number, id: number) {
  return `${API_BASE_URL.replace(/\/$/, '')}/api/cotizaciones/${id}/pdf?userId=${userId}`;
}
