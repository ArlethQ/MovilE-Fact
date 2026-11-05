import { ApiError, apiRequest } from './apiClient';
import { Cliente } from '../types/business';
import { FacturaListItem, FacturaPreparacion, FacturaProducto, buscarFacturaClientes, buscarFacturaProductos, getFacturaDetalle, normalizeFacturaPreparacion } from './facturasMobileService';
import { getNotasCredito } from './notasCreditoMobileService';
import type { DocumentPdfFormat } from '../utils/documentFormatting';

type ApiRow = Record<string, unknown>;

export type GuiaRemisionListItem = {
  codGuia: number;
  numero?: string | null;
  fecha?: string | null;
  destinatario?: string | null;
  identificacionDestinatario?: string | null;
  transportista?: string | null;
  motivoTraslado?: string | null;
  fechaTraslado?: string | null;
  estadoSri?: string | null;
  autorizado?: boolean | null;
  numeroAutorizacion?: string | null;
  mensajeSri?: string | null;
};

export type GuiaRemisionDetalleInput = {
  producto: FacturaProducto;
  cantidad: number;
};

export type GuiaRemisionGuardarInput = {
  idUsuario: number;
  transportista: Cliente;
  destinatario?: Cliente | null;
  factura?: FacturaListItem | null;
  serie?: string | null;
  codemisor?: number | null;
  placa?: string | null;
  contribuyenteEspecial?: string | null;
  obligadoContabilidad?: boolean;
  fechaEmision?: string | null;
  fechaInicioTraslado?: string | null;
  fechaFinTraslado?: string | null;
  detalle?: string | null;
  direccionOrigen?: string | null;
  puntoEmision?: string | null;
  detalles: GuiaRemisionDetalleInput[];
};

export function getGuiaRemisionPreparacion(userId: number) {
  return requestWithFallback<FacturaPreparacion & Record<string, unknown>>([
    `/api/guias-remision/preparacion?idUsuario=${userId}`,
    `/api/guia-remision/preparacion?idUsuario=${userId}`,
    `/api/facturas/preparacion?idUsuario=${userId}`,
  ]).then((response) => {
    const normalized = normalizeFacturaPreparacion(response);
    return {
      ...normalized,
      direccionOrigen: normalized.direccionOrigen || text(pickValue(response, [
        'direccionOrigen',
        'DireccionOrigen',
        'direccionPartida',
        'DireccionPartida',
        'dirEstablecimiento',
        'DirEstablecimiento',
        'direccionMatriz',
        'DireccionMatriz',
      ])) || null,
    };
  });
}

export async function getGuiasRemision(userId: number, top = 0) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/guias-remision?idUsuario=${userId}&top=${top}`,
    `/api/guia-remision?idUsuario=${userId}&top=${top}`,
    `/api/guiasremision?idUsuario=${userId}&top=${top}`,
  ]);
  return normalizeRows(response).map(toGuiaListItem);
}

export async function buscarGuiaClientes(userId: number, filtro: string) {
  return buscarFacturaClientes(userId, filtro);
}

export async function buscarGuiaTransportistas(userId: number, filtro: string) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/guias-remision/transportistas?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
    `/api/guias-remision/transportistas/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
    `/api/guia-remision/transportistas/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
  ]);
  return normalizeRows(response).map(toCliente);
}

export async function getGuiaTransportista(userId: number, identificacion: string) {
  const response = await requestWithFallback<ApiRow | ApiRow[]>([
    `/api/guias-remision/transportistas/por-identificacion?idUsuario=${userId}&identificacion=${encodeURIComponent(identificacion)}`,
    `/api/guia-remision/transportistas/por-identificacion?idUsuario=${userId}&identificacion=${encodeURIComponent(identificacion)}`,
  ]);
  const row = normalizeRows(response)[0];
  return row ? toCliente(row) : null;
}

export async function buscarGuiaFacturas(userId: number, filtro: string) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/guias-remision/facturas/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
    `/api/guia-remision/facturas/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
  ]);
  const candidates = normalizeFacturaRows(response);
  if (!candidates.length) return candidates;

  let notasCredito;
  try {
    notasCredito = await getNotasCredito(userId, 0);
  } catch {
    return candidates;
  }

  const notasPorFactura = new Map<number, typeof notasCredito>();
  notasCredito.forEach((nota) => {
    if (!nota.documentoModificadoId || nota.estado === false) return;
    const current = notasPorFactura.get(nota.documentoModificadoId) ?? [];
    current.push(nota);
    notasPorFactura.set(nota.documentoModificadoId, current);
  });

  return (await Promise.all(candidates.map(async (factura) => {
    const notas = notasPorFactura.get(factura.codfactura);
    if (!notas?.length) return factura;

    let totalFactura = factura.total ?? null;
    if (totalFactura === null) {
      try {
        const detalle = await getFacturaDetalle(userId, factura.codfactura);
        totalFactura = numberValue(pickValue(detalle.factura ?? {}, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalFactura', 'TotalFactura', 'valorDocumento', 'ValorDocumento']));
      } catch {
        totalFactura = null;
      }
    }

    if (totalFactura !== null && notas.reduce((sum, nota) => sum + (nota.total ?? 0), 0) >= totalFactura) return null;

    try {
      const disponibles = await apiRequest<ApiRow[] | Record<string, unknown>>(`/api/notas-credito/facturas/${factura.codfactura}/detalles-disponibles?idUsuario=${userId}`, { suppressErrorLog: true });
      if (!normalizeRows(disponibles).length) return null;
    } catch {
      // El API de guías sigue siendo la validación final si este endpoint no existe.
    }

    return factura;
  }))).filter((factura): factura is FacturaListItem => Boolean(factura));
}

export function buscarGuiaProductos(userId: number, filtro: string) {
  return buscarFacturaProductos(userId, filtro);
}

export async function guardarGuiaRemision(input: GuiaRemisionGuardarInput) {
  const transportistaRow = input.transportista as Cliente & Record<string, unknown>;
  const placaTransportista = text(pickValue(transportistaRow, ['placa', 'Placa']));
  const guia = {
    CodEmisor: input.codemisor,
    Serie: input.serie?.replace(/-/g, '') || null,
    Placa: input.placa || placaTransportista || null,
    Fecha: input.fechaEmision || new Date().toISOString(),
    FechaIniTransporte: input.fechaInicioTraslado || input.fechaEmision || new Date().toISOString(),
    FechaFinTransporte: input.fechaFinTraslado || input.fechaInicioTraslado || input.fechaEmision || new Date().toISOString(),
    DireccionPartida: input.direccionOrigen || input.transportista.direccion || null,
    Codfactura: input.factura?.codfactura || null,
    Ambiente: 2,
  };

  const detalles = input.detalles.map((item) => ({
    CodInterno: item.producto.codprincipal || String(item.producto.codproducto || ''),
    CodAdicional: item.producto.codauxiliar || null,
    Descripcion: item.producto.descripcion,
    Cantidad: item.cantidad,
  }));

  const response = await apiRequest<{ mensaje?: string; sec?: number; secGuiaRemision?: number; SecGuiaRemision?: number; Sec?: number; codGuia?: number; CodGuia?: number; numeroComprobante?: string | null; numeroCompleto?: string | null }>(
    '/api/guias-remision',
    {
      method: 'POST',
      body: JSON.stringify({
        IdUsuario: input.idUsuario,
        CodFactura: input.factura?.codfactura || null,
        CodEmisor: input.codemisor,
        Transportista: {
          Codigo: input.transportista.codcliente || 0,
          RazonSocial: input.transportista.nombrerazonsocial || input.transportista.nombrecomercial || null,
          TipoIdentificacion: tipoIdentificacionCode(input.transportista.tipoidentificacion) || null,
          NumeroIdentificacion: input.transportista.numeroidentificacion || null,
          Correo: input.transportista.correo || null,
          Placa: input.placa || placaTransportista || null,
          OblCont: input.obligadoContabilidad ? 'SI' : 'NO',
          ContribuyenteEsp: input.contribuyenteEspecial || null,
          Direccion: input.transportista.direccion || null,
          Telefono: input.transportista.celular || input.transportista.telefonoconvencional || null,
        },
        Guia: guia,
        Destinatario: {
          IdDestinatario: input.destinatario?.numeroidentificacion || input.factura?.identificacionCliente || null,
          RazonSocial: input.destinatario?.nombrerazonsocial || input.factura?.cliente || null,
          Direccion: input.destinatario?.direccion || null,
          MotivoTraslado: input.detalle || 'Traslado de mercaderia',
          NumDocSustento: input.factura?.numeroCompleto ?? input.factura?.numfactura ?? null,
          FechaEmiSustento: input.factura?.fechaEmision || null,
          SerieDocSustento: input.factura?.serie || null,
          CodDocSustento: input.factura ? '01' : null,
        },
        Detalles: detalles,
      }),
    },
  );

  const sec = response.secGuiaRemision ?? response.SecGuiaRemision ?? response.sec ?? response.Sec ?? response.codGuia ?? response.CodGuia;
  return { mensaje: response.mensaje ?? 'Guia de remision guardada correctamente.', codGuia: sec, numeroComprobante: response.numeroComprobante ?? response.numeroCompleto ?? null };
}

export function emitirGuiaRemision(userId: number, sec: number) {
  return apiRequest<{ estado?: string; mensaje?: string; autorizacion?: string }>(`/api/guias-remision/${sec}/emitir?idUsuario=${userId}`, { method: 'POST' });
}

export function getGuiaRemisionPdf(userId: number, codGuia: number, formato: DocumentPdfFormat = 'A4') {
  return requestWithFallback<{ url: string }>([
    `/api/guias-remision/${codGuia}/pdf?idUsuario=${userId}&formato=${formato}`,
    `/api/guia-remision/${codGuia}/pdf?idUsuario=${userId}&formato=${formato}`,
    `/api/guiasremision/${codGuia}/pdf?idUsuario=${userId}&formato=${formato}`,
  ]);
}

export function getGuiaRemisionXml(userId: number, codGuia: number) {
  return requestWithFallback<{ url: string }>([
    `/api/guias-remision/${codGuia}/xml?idUsuario=${userId}`,
    `/api/guia-remision/${codGuia}/xml?idUsuario=${userId}`,
    `/api/guiasremision/${codGuia}/xml?idUsuario=${userId}`,
  ]);
}

export function enviarGuiaRemisionCorreo(userId: number, codGuia: number) {
  return apiRequest<void>(`/api/guias-remision/${codGuia}/enviar-correo`, {
    method: 'POST',
    body: JSON.stringify({ IdUsuario: userId, ForzarReenvio: true }),
  });
}

export function anularGuiaRemision(userId: number, codGuia: number) {
  return apiRequest<void>(`/api/guias-remision/${codGuia}?idUsuario=${userId}`, { method: 'DELETE' });
}

async function requestWithFallback<T>(paths: string[]) {
  let lastError: unknown;
  for (const path of paths) {
    try {
      return await apiRequest<T>(path, { suppressErrorLog: true });
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 0)) throw error;
    }
  }
  throw lastError;
}

function normalizeRows(response: ApiRow[] | Record<string, unknown>): ApiRow[] {
  if (Array.isArray(response)) return response;
  const values = [response.items, response.Items, response.data, response.Data, response.guias, response.Guias, response.registros, response.Registros, response.result, response.Result, response.results, response.Results];
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

function normalizeFacturaRows(response: ApiRow[] | Record<string, unknown>): FacturaListItem[] {
  return normalizeRows(response).map((row) => ({
    codfactura: numberValue(pickValue(row, ['codfactura', 'CodFactura', 'codFactura', 'idFactura', 'IdFactura', 'id', 'Id'])) ?? 0,
    numfactura: text(pickValue(row, ['numfactura', 'NumFactura', 'numeroFactura', 'NumeroFactura', 'numero', 'Numero'])) || null,
    numeroCompleto: text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento'])) || null,
    serie: text(pickValue(row, ['serie', 'Serie'])) || null,
    total: numberValue(pickValue(row, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalFactura', 'TotalFactura', 'totalDocumento', 'TotalDocumento', 'valorDocumento', 'ValorDocumento'])),
    cliente: text(pickValue(row, ['cliente', 'Cliente', 'clienteNombre', 'ClienteNombre', 'nombreCliente', 'NombreCliente', 'razonSocial', 'RazonSocial'])) || null,
    identificacionCliente: text(pickValue(row, ['identificacionCliente', 'IdentificacionCliente', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
  }));
}

function toCliente(row: ApiRow): Cliente {
  return {
    codcliente: numberValue(pickValue(row, ['codcliente', 'CodCliente', 'codigo', 'Codigo', 'id', 'Id'])) ?? 0,
    nombrerazonsocial: text(pickValue(row, ['nombrerazonsocial', 'NombreRazonSocial', 'razonSocial', 'RazonSocial', 'razonSocialTransportista', 'RazonSocialTransportista', 'nombreTransportista', 'NombreTransportista', 'nombre', 'Nombre'])) || null,
    numeroidentificacion: text(pickValue(row, ['numeroidentificacion', 'NumeroIdentificacion', 'numeroIdentificacionTransportista', 'NumeroIdentificacionTransportista', 'identificacionTransportista', 'IdentificacionTransportista', 'identificacion', 'Identificacion', 'ruc', 'Ruc'])) || null,
    direccion: text(pickValue(row, ['direccion', 'Direccion', 'direccionTransportista', 'DireccionTransportista', 'domicilio', 'Domicilio'])) || null,
    celular: text(pickValue(row, ['celular', 'Celular', 'telefono', 'Telefono'])) || null,
    correo: text(pickValue(row, ['correo', 'Correo', 'email', 'Email'])) || null,
    tipoidentificacion: text(pickValue(row, ['tipoidentificacion', 'TipoIdentificacion', 'tipoIdentificacion'])) || null,
    oblgconta: text(pickValue(row, ['oblgconta', 'OblCont', 'oblCont'])) || null,
  };
}

function toGuiaListItem(row: ApiRow): GuiaRemisionListItem {
  const serie = text(pickValue(row, ['serie', 'Serie']));
  const numero = text(pickValue(row, ['numero', 'Numero', 'numeroGuiaRemision', 'NumeroGuiaRemision', 'numGuia', 'NumGuia', 'secuencial', 'Secuencial']));
  const numeroCompleto = text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']));
  const estadoSri = text(pickValue(row, ['estadoSri', 'EstadoSri', 'estadoSRI', 'EstadoSRI', 'estado', 'Estado']));
  return {
    codGuia: numberValue(pickValue(row, ['codGuia', 'CodGuia', 'codguia', 'secGuiaRemision', 'SecGuiaRemision', 'secGuia', 'SecGuia', 'sec', 'Sec', 'idGuia', 'IdGuia', 'id', 'Id'])) ?? 0,
    numero: numeroCompleto || [serie, numero].filter(Boolean).join('-') || numero || null,
    fecha: text(pickValue(row, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fechaDocumento', 'FechaDocumento', 'fechaGuia', 'FechaGuia', 'fechaCreacion', 'FechaCreacion', 'fechaAutorizacion', 'FechaAutorizacion'])) || null,
    destinatario: text(pickValue(row, ['destinatario', 'Destinatario', 'cliente', 'Cliente', 'razonSocial', 'RazonSocial'])) || null,
    identificacionDestinatario: text(pickValue(row, ['identificacionDestinatario', 'IdentificacionDestinatario', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
    transportista: text(pickValue(row, ['transportista', 'Transportista', 'nombreTransportista', 'NombreTransportista'])) || null,
    motivoTraslado: text(pickValue(row, ['motivoTraslado', 'MotivoTraslado', 'motivo', 'Motivo'])) || null,
    fechaTraslado: text(pickValue(row, ['fechaTraslado', 'FechaTraslado', 'fechaInicioTraslado', 'FechaInicioTraslado', 'fechaInicioTransporte', 'FechaInicioTransporte', 'fechaIniTraslado', 'FechaIniTraslado', 'fechaSalida', 'FechaSalida'])) || null,
    estadoSri: normalizeGuiaEstado(estadoSri),
    autorizado: booleanValue(pickValue(row, ['autorizado', 'Autorizado'])),
    numeroAutorizacion: text(pickValue(row, ['numeroAutorizacion', 'NumeroAutorizacion', 'numAutorizacion', 'NumAutorizacion', 'claveAcceso', 'ClaveAcceso'])) || null,
    mensajeSri: text(pickValue(row, ['mensajeSri', 'MensajeSri', 'mensajeSRI', 'MensajeSRI', 'mensaje', 'Mensaje', 'errorSri', 'ErrorSri', 'observacion', 'Observacion'])) || null,
  };
}

function normalizeGuiaEstado(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'A' || normalized.includes('AUTORIZ')) return 'AUTORIZADO';
  if (normalized === 'N' || normalized.includes('RECHAZ') || normalized.includes('NO AUTORIZ')) return 'RECHAZADO';
  if (normalized === 'ANULADA' || normalized === 'ANULADO' || normalized === 'CANCELADO') return 'ANULADO';
  if (normalized === 'P' || normalized === 'I' || normalized === 'ENVIADO' || normalized === 'PENDIENTE') return 'PENDIENTE';
  return value.trim() || null;
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

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function tipoIdentificacionCode(value?: string | number | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const map: Record<string, string> = {
    '04': '04',
    '4': '04',
    ruc: '04',
    '05': '05',
    '5': '05',
    cedula: '05',
    'cédula': '05',
    '06': '06',
    '6': '06',
    pasaporte: '06',
    '07': '07',
    '7': '07',
    'consumidor final': '07',
    '08': '08',
    '8': '08',
    'identificacion del exterior': '08',
    'identificación del exterior': '08',
  };
  return map[normalized] ?? String(value ?? '');
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
    if (['true', '1', 'si', 'sí', 's', 'autorizado', 'activo'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'pendiente', 'no autorizado', 'inactivo'].includes(normalized)) return false;
  }
  return null;
}
