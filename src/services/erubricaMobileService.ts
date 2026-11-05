import { apiRequest, apiRequestBinary } from './apiClient';
import { FirmaEstado } from '../types/business';
import { ERUBRICA_SOLICITUD_PAGO_PATH, ERUBRICA_SOLICITUD_PATH, ERUBRICA_SOLICITUD_TRANSFERENCIA_PATH } from '../config/api';
import { appendMobileFile } from './mobileFileUpload';

export type ERubricaDashboard = {
  solicitudes?: unknown[];
  firmas?: unknown[];
  notificaciones?: unknown[];
  entregasFirma?: unknown[];
  renovacion?: unknown;
  menus?: unknown[];
};

export type ERubricaEmisor = {
  id: number;
  codigo?: number;
  Codigo?: number;
  Id?: number;
  razonSocial?: string | null;
  RazonSocial?: string | null;
  ruc?: string | null;
  Ruc?: string | null;
  RUC?: string | null;
  nomComercial?: string | null;
  NomComercial?: string | null;
  email?: string | null;
  telefono?: string | null;
  tieneCertificado?: boolean;
  tieneClave?: boolean;
  esValida?: boolean;
  estadoVigencia?: string | null;
  fechaExpiracion?: string | null;
  diasRestantes?: number | null;
  mensaje?: string | null;
};

export type ERubricaFirmaEstado = {
  tieneCertificado: boolean;
  tieneClave: boolean;
  esValida: boolean;
  estadoVigencia?: string | null;
  fechaExpiracion?: string | null;
  diasRestantes?: number | null;
  mensaje?: string | null;
  nombreTitular?: string | null;
  identificacion?: string | null;
  fechaEmision?: string | null;
  numeroSerie?: string | null;
  huellaDigital?: string | null;
  emisor?: string | null;
};

const ROOT = '/api/mobile/e-rubrica';

export const appendERubricaFile = (form: FormData, field: string, file: { uri: string; name: string }) => {
  appendMobileFile(form, field, file);
};

export const getERubricaDashboard = (take = 8) =>
  apiRequest<ERubricaDashboard>(`${ROOT}/dashboard?take=${Math.max(1, Math.min(50, take))}`);

export const getERubricaEmisores = async () => {
  const response = await apiRequest<ERubricaEmisor[] | { emisores?: ERubricaEmisor[] }>(`${ROOT}/emisores`);
  const items = Array.isArray(response) ? response : response.emisores ?? [];
  return items.map((item) => ({
    ...item,
    id: item.id ?? item.Id ?? item.codigo ?? item.Codigo ?? 0,
    razonSocial: item.razonSocial ?? item.RazonSocial,
    ruc: item.ruc ?? item.Ruc ?? item.RUC,
    nomComercial: item.nomComercial ?? item.NomComercial,
  }));
};

export const getERubricaFirmaEstado = (id: number): Promise<ERubricaFirmaEstado> =>
  apiRequest<Record<string, unknown>>(`${ROOT}/emisores/${id}/firma/estado`, { timeoutMs: 12000 }).then((item) => ({
    tieneCertificado: Boolean(item.tieneCertificado ?? item.TieneCertificado),
    tieneClave: Boolean(item.tieneClave ?? item.TieneClave),
    esValida: Boolean(item.esValida ?? item.EsValida),
    estadoVigencia: (item.estadoVigencia ?? item.EstadoVigencia) as string | null | undefined,
    fechaExpiracion: (item.fechaExpiracion ?? item.FechaExpiracion) as string | null | undefined,
    diasRestantes: (item.diasRestantes ?? item.DiasRestantes) as number | null | undefined,
    mensaje: (item.mensaje ?? item.Mensaje) as string | null | undefined,
    nombreTitular: (item.nombreTitular ?? item.NombreTitular) as string | null | undefined,
    identificacion: (item.identificacion ?? item.Identificacion) as string | null | undefined,
    fechaEmision: (item.fechaEmision ?? item.FechaEmision) as string | null | undefined,
    numeroSerie: (item.numeroSerie ?? item.NumeroSerie) as string | null | undefined,
    huellaDigital: (item.huellaDigital ?? item.HuellaDigital) as string | null | undefined,
    emisor: (item.emisor ?? item.Emisor) as string | null | undefined,
  }));

export const validarERubricaFirmaTemporal = (archivo: { uri: string; name: string; mimeType?: string | null }, clave: string) => {
  const form = new FormData();
  appendERubricaFile(form, 'archivo', archivo);
  form.append('clave', clave);
  return apiRequest<ERubricaFirmaEstado>(`${ROOT}/emisores/firma/validar-temporal`, { method: 'POST', body: form, timeoutMs: 60000 });
};

export const configurarERubricaFirma = (id: number, certificado: { uri: string; name: string; mimeType?: string | null }, clave: string) => {
  const form = new FormData();
  appendERubricaFile(form, 'certificado', certificado);
  form.append('clave', clave);
  return apiRequest<unknown>(`${ROOT}/emisores/${id}/firma/configurar`, { method: 'POST', body: form, timeoutMs: 60000 });
};

export const getERubricaSolicitudes = () => apiRequest<unknown[]>(`${ROOT}/solicitudes`);

export type ERubricaSolicitudBorrador = {
  id: string;
  titulo: string;
  fechaGuardado: string;
  datosJson: string;
};

export const getERubricaSolicitudBorradores = () =>
  apiRequest<ERubricaSolicitudBorrador[]>(`${ROOT}/solicitudes/borradores`);

export const guardarERubricaSolicitudBorrador = (titulo: string, datosJson: string) =>
  apiRequest<ERubricaSolicitudBorrador>(`${ROOT}/solicitudes/borradores`, {
    method: 'POST',
    body: JSON.stringify({ titulo, datosJson }),
  });

export const eliminarERubricaSolicitudBorrador = (id: string) =>
  apiRequest<{ eliminado: boolean }>(`${ROOT}/solicitudes/borradores/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const getERubricaFirmas = () => apiRequest<unknown[]>(`${ROOT}/firmas`);

export type ERubricaDocumentoFirmado = {
  nombreDocumento: string;
  nombreArchivo: string;
  fechaFirma: string;
  estado: string;
  tamano: string;
  downloadUrl: string;
  previewUrl: string;
};

export const getERubricaDocumentosFirmados = () => apiRequest<ERubricaDocumentoFirmado[]>(`${ROOT}/documentos/firmados`);

export type ERubricaDocumentoPendiente = {
  id: string;
  nombreDocumento: string;
  nombreArchivo: string;
  codigo: string;
  tamanoBytes: number;
  fecha: string;
  estado: string;
  url: string;
};

export const getERubricaDocumentosPendientes = () =>
  apiRequest<ERubricaDocumentoPendiente[]>(`${ROOT}/documentos/pendientes`);

export const cargarERubricaDocumentoPendiente = (pdf: { uri: string; name: string; mimeType?: string | null }) => {
  const form = new FormData();
  appendERubricaFile(form, 'pdf', { uri: pdf.uri, name: pdf.name || 'documento.pdf' });
  form.append('nombreOriginal', pdf.name || 'documento.pdf');
  return apiRequest<ERubricaDocumentoPendiente>(`${ROOT}/documentos/pendientes`, { method: 'POST', body: form, timeoutMs: 60000 });
};

export const eliminarERubricaDocumentoPendiente = (nombreArchivo: string) =>
  apiRequest<{ eliminado: boolean }>(`${ROOT}/documentos/pendientes/${encodeURIComponent(nombreArchivo)}`, { method: 'DELETE' });

export const getERubricaRenovacion = () => apiRequest<unknown>(`${ROOT}/renovacion`);

export type ERubricaSolicitudCatalogos = {
  nacionalidades: string[];
  provincias: Array<{ nombre: string; cantones: string[] }>;
};

export const getERubricaSolicitudCatalogos = () =>
  apiRequest<ERubricaSolicitudCatalogos>(`${ROOT}/catalogos/solicitud`);

export type ERubricaPlan = {
  tieneFirmaPagada: boolean;
  solicitudId?: number;
  vigencia?: string | null;
  fechaInicio?: string | null;
  fechaVencimiento?: string | null;
  diasRestantes: number;
  estado: string;
};

export const getERubricaPlan = () => apiRequest<ERubricaPlan>(`${ROOT}/plan`);

export const getERubricaNotificaciones = (take = 8) =>
  apiRequest<unknown[]>(`${ROOT}/notificaciones?take=${Math.max(1, Math.min(50, take))}`);

export const getERubricaEntregas = (take = 8) =>
  apiRequest<unknown[]>(`${ROOT}/entregas-firma?take=${Math.max(1, Math.min(50, take))}`);

export const descargarERubricaFirmaP12 = (solId: number) =>
  apiRequestBinary(`${ROOT}/solicitudes/${solId}/firma-p12`);

export const getERubricaProductos = () => apiRequest<unknown[]>(`${ROOT}/catalogos/productos`);

export const getERubricaStakeholderProductos = (stakeholderUuid?: string) =>
  apiRequest<unknown[]>(`${ROOT}/catalogos/stakeholder-productos${stakeholderUuid ? `?stakeholderUuid=${encodeURIComponent(stakeholderUuid)}` : ''}`);

export const getERubricaSaldo = () => apiRequest<{ balance?: number }>(`${ROOT}/catalogos/saldo`);

export const buscarERubricaSolicitudesProveedor = (params: { q?: string; status?: string; uuid?: string } = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value?.trim()) query.set(key, value.trim()); });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<unknown[]>(`${ROOT}/proveedor/solicitudes${suffix}`);
};

export const sincronizarERubricaPendientes = () =>
  apiRequest<unknown>(`${ROOT}/solicitudes/sincronizar-pendientes`, { method: 'POST' });

export const sincronizarERubricaSolicitud = (solId: number) =>
  apiRequest<unknown>(`${ROOT}/solicitudes/${solId}/sincronizar`, { method: 'POST' });

export const marcarEntregaERubricaVista = (observacionId: number) =>
  apiRequest<unknown>(`${ROOT}/notificaciones/entregas/${observacionId}/vista`, { method: 'POST' });

export const validarERubricaQr = (entrada: string) =>
  apiRequest<unknown>(`${ROOT}/documentos/validar-qr?entrada=${encodeURIComponent(entrada)}`);

export const validarERubricaFirmaPdf = (pdf: { uri: string; name: string; mimeType?: string | null }) => {
  const form = new FormData();
  appendERubricaFile(form, 'pdf', { uri: pdf.uri, name: pdf.name || 'documento.pdf' });
  return apiRequest<unknown>(`${ROOT}/documentos/validar-firma`, { method: 'POST', body: form, timeoutMs: 30000 });
};

export const firmarERubricaDocumento = (form: FormData) =>
  apiRequestBinary(`${ROOT}/documentos/firmar`, { method: 'POST', body: form, timeoutMs: 60000 });

export type ERubricaPagoResponse = {
  paymentUrl?: string | null;
  checkoutUrl?: string | null;
  url?: string | null;
  solicitudId?: string | number | null;
  status?: string | null;
};

export const crearERubricaSolicitud = (form: FormData) =>
  apiRequest<ERubricaPagoResponse | Record<string, unknown>>(ERUBRICA_SOLICITUD_PATH, {
    method: 'POST',
    body: form,
    timeoutMs: 60000,
  });

export const iniciarPagoERubricaSolicitud = (solicitudId: number) =>
  apiRequest<ERubricaPagoResponse>(ERUBRICA_SOLICITUD_PAGO_PATH, {
    method: 'POST',
    body: JSON.stringify({ solicitudId }),
    timeoutMs: 30000,
  });

export const enviarTransferenciaERubricaSolicitud = (form: FormData) =>
  apiRequest<ERubricaPagoResponse>(ERUBRICA_SOLICITUD_TRANSFERENCIA_PATH, {
    method: 'POST',
    body: form,
    timeoutMs: 30000,
  });
