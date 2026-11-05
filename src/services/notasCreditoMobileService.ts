import { ApiError, apiRequest } from './apiClient';
import { Cliente } from '../types/business';
import { FacturaListItem, FacturaPreparacion, FacturaProducto, normalizeFacturaPreparacion } from './facturasMobileService';
import type { DocumentPdfFormat } from '../utils/documentFormatting';

type ApiRow = Record<string, unknown>;

export type NotaCreditoListItem = {
  codNotaCredito: number;
  documentoModificadoId?: number | null;
  serie?: string | null;
  numeroNota?: string | null;
  numeroCompleto?: string | null;
  facturaModificada?: string | null;
  numeroDocModificado?: string | null;
  fechaSustento?: string | null;
  fechaDocumentoModificado?: string | null;
  cliente?: string | null;
  identificacionCliente?: string | null;
  tipoIdentificacionCliente?: string | null;
  estadoSri?: string | null;
  autorizado?: boolean | null;
  numeroAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  claveAcceso?: string | null;
  mensajeSri?: string | null;
  subtotal?: number | null;
  subtotalIva?: number | null;
  subtotalCero?: number | null;
  descuentos?: number | null;
  iva?: number | null;
  ice?: number | null;
  motivo?: string | null;
  total?: number | null;
  fechaVencimientoDocumento?: string | null;
  saldoPendienteDocumento?: number | null;
  xmlUrl?: string | null;
  estado?: boolean | null;
};

export type NotaCreditoLineaInput = {
  producto: FacturaProducto;
  cantidad: number;
  precio: number;
  descuento: number;
  tarifa: number;
  detalle?: string | null;
};

export type NotaCreditoDetalleDisponible = {
  producto: FacturaProducto;
  cantidad: number;
  precio: number;
  descuento: number;
  tarifa: number;
};

export type NotaCreditoGuardarInput = {
  idUsuario: number;
  cliente: Cliente;
  facturaModificada?: FacturaListItem | null;
  serie?: string | null;
  codemisor?: number | null;
  motivo?: string | null;
  observacion?: string | null;
  correos?: string[];
  detalles: NotaCreditoLineaInput[];
};

export function getNotaCreditoPreparacion(userId: number) {
  return requestWithFallback<FacturaPreparacion & Record<string, unknown>>([
    `/api/notas-credito/preparacion?idUsuario=${userId}`,
    `/api/nota-credito/preparacion?idUsuario=${userId}`,
    `/api/facturas/preparacion?idUsuario=${userId}`,
  ]).then(normalizeFacturaPreparacion);
}

export async function getNotasCredito(userId: number, top = 0) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/notas-credito?idUsuario=${userId}&top=${top}`,
    `/api/nota-credito?idUsuario=${userId}&top=${top}`,
    `/api/notascredito?idUsuario=${userId}&top=${top}`,
  ]);

  return normalizeRows(response).map(toNotaCreditoListItem);
}

export async function buscarNotaCreditoFacturas(userId: number, filtro: string) {
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(
    `/api/notas-credito/buscar-facturas?idUsuario=${userId}&texto=${encodeURIComponent(filtro)}`,
  );

  return normalizeFacturaRows(response);
}

export async function getNotaCreditoDetallesDisponibles(userId: number, codfactura: number): Promise<NotaCreditoDetalleDisponible[]> {
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(`/api/notas-credito/facturas/${codfactura}/detalles-disponibles?idUsuario=${userId}`);
  return normalizeRows(response).map(toNotaCreditoDetalleDisponible).filter((item) => item.cantidad > 0 && item.precio > 0);
}

export async function guardarNotaCredito(input: NotaCreditoGuardarInput) {
  const subtotal = input.detalles.reduce((sum, item) => sum + Math.max(item.cantidad * item.precio - item.descuento, 0), 0);
  const iva = input.detalles.reduce((sum, item) => {
    const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
    return sum + base * (item.tarifa / 100);
  }, 0);

  const notaCredito = {
    CodEmisor: input.codemisor,
    CodClientes: input.cliente.codcliente || null,
    CodDocumento: '04',
    IdDocModificado: input.facturaModificada?.codfactura || null,
    NumDocModificado: input.facturaModificada?.numeroCompleto ?? input.facturaModificada?.numfactura ?? null,
    CodDocModificado: '01',
    FechaEmiDocModificado: input.facturaModificada?.fechaEmision || null,
    Serie: input.serie?.replace(/-/g, '') || null,
    Motivo: input.motivo || 'Correccion de valores',
    Observacion: input.observacion || null,
    Estado: true,
    Autorizado: 'N',
    Subtotal: subtotal,
    Descuentos: input.detalles.reduce((sum, item) => sum + item.descuento, 0),
    Iva: iva,
    ValorTotal: subtotal + iva,
  };

  const detalles = input.detalles.map((item) => {
    const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
    const valorIva = base * (item.tarifa / 100);
    return {
      Codproducto: item.producto.codproducto,
      Codprincipal: item.producto.codprincipal,
      Codauxiliar: item.producto.codauxiliar,
      Descripcion: item.producto.descripcion ?? 'Producto',
      Detalle: item.detalle?.trim() || null,
      Cantidad: item.cantidad,
      Preciounitario: item.precio,
      Descuento: item.descuento,
      Subtotal: base,
      Iva: Math.round(item.tarifa),
      Total: base + valorIva,
    };
  });

  return apiRequest<{ mensaje?: string; sec?: number; codNotaCredito?: number; numeroComprobante?: string | null }>(
    '/api/notas-credito',
    {
      method: 'POST',
      body: JSON.stringify({
        IdUsuario: input.idUsuario,
        NotaCredito: notaCredito,
        Cliente: input.cliente,
        Detalles: detalles,
        Correos: input.correos?.filter(Boolean).map((correo) => ({ correo, guardarEnCliente: false })) ?? [],
      }),
    },
  );
}

export function emitirNotaCredito(userId: number, sec: number) {
  return apiRequest<{ estado?: string; mensaje?: string; autorizacion?: string }>(`/api/notas-credito/${sec}/emitir?idUsuario=${userId}`, { method: 'POST' });
}

export function emitirNotaCreditoAutomatica(userId: number, codfactura: number) {
  return apiRequest<{
    success?: boolean;
    autorizada?: boolean;
    sec?: number | null;
    numeroNotaCredito?: string;
    numeroCompleto?: string;
    numeroAutorizacion?: string;
    estadoSri?: string;
    message?: string;
  }>(`/api/notas-credito/automatica/${codfactura}?idUsuario=${userId}`, { method: 'POST', timeoutMs: 180000 });
}

export function getNotaCreditoPdf(userId: number, codNotaCredito: number, formato: DocumentPdfFormat = 'A4') {
  return apiRequest<{ url: string }>(`/api/notas-credito/${codNotaCredito}/pdf?idUsuario=${userId}&formato=${formato}`);
}

export function getNotaCreditoXml(userId: number, codNotaCredito: number) {
  return apiRequest<{ url: string }>(`/api/notas-credito/${codNotaCredito}/xml?idUsuario=${userId}`);
}

export function enviarNotaCreditoCorreo(userId: number, codNotaCredito: number) {
  return apiRequest<void>(`/api/notas-credito/${codNotaCredito}/enviar-correo?idUsuario=${userId}`, { method: 'POST' });
}

export function anularNotaCredito(userId: number, codNotaCredito: number) {
  return apiRequest<void>(`/api/notas-credito/${codNotaCredito}?idUsuario=${userId}`, { method: 'DELETE' });
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

  const values = [
    response.items,
    response.Items,
    response.data,
    response.Data,
    response.notasCredito,
    response.NotasCredito,
    response.notas,
    response.Notas,
    response.registros,
    response.Registros,
    response.result,
    response.Result,
    response.results,
    response.Results,
  ];

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
    fechaEmision: text(pickValue(row, ['fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fecha', 'Fecha', 'fechaDocumento', 'FechaDocumento', 'fechaSustento', 'FechaSustento', 'fechaCreacion', 'FechaCreacion'])) || null,
    total: numberValue(pickValue(row, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalFactura', 'TotalFactura', 'totalComprobante', 'TotalComprobante', 'totalDocumento', 'TotalDocumento', 'montoTotal', 'MontoTotal', 'importeTotal', 'ImporteTotal', 'valorDocumento', 'ValorDocumento', 'totalGeneral', 'TotalGeneral', 'monto', 'Monto', 'importe', 'Importe'])),
    cliente: text(pickValue(row, ['cliente', 'Cliente', 'clienteNombre', 'ClienteNombre', 'nombreCliente', 'NombreCliente', 'razonSocial', 'RazonSocial'])) || null,
    identificacionCliente: text(pickValue(row, ['identificacionCliente', 'IdentificacionCliente', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
  }));
}

function toNotaCreditoDetalleDisponible(row: ApiRow): NotaCreditoDetalleDisponible {
  const cantidad = numberValue(pickValue(row, ['cantidad', 'Cantidad', 'cantProducto', 'CantProducto'])) ?? 0;
  const precio = numberValue(pickValue(row, ['preciounitario', 'Preciounitario', 'precioUnitario', 'PrecioUnitario', 'precioVenta', 'PrecioVenta', 'precioproducto', 'PrecioProducto', 'valorUnitario', 'ValorUnitario', 'precio', 'Precio'])) ?? 0;
  const descuento = numberValue(pickValue(row, ['descuento', 'Descuento'])) ?? 0;
  const tarifaRaw = numberValue(pickValue(row, ['iva', 'Iva', 'tarifa', 'Tarifa', 'tarifaIva', 'TarifaIva'])) ?? 0;
  const tarifa = tarifaRaw > 0 && tarifaRaw <= 1 ? tarifaRaw * 100 : tarifaRaw;

  return {
    producto: {
      codproducto: numberValue(pickValue(row, ['codproducto', 'Codproducto', 'codProducto', 'CodProducto'])) ?? 0,
      codprincipal: text(pickValue(row, ['codprincipal', 'Codprincipal', 'codPrincipal', 'CodPrincipal', 'codigoInterno', 'CodigoInterno'])) || null,
      codauxiliar: text(pickValue(row, ['codauxiliar', 'Codauxiliar', 'codAuxiliar', 'CodAuxiliar'])) || null,
      descripcion: text(pickValue(row, ['descripcion', 'Descripcion', 'descripproducto', 'Descripproducto', 'detalle', 'Detalle', 'nombre', 'Nombre'])) || null,
      precioUnitario: precio,
      tarifaIva: tarifa,
    },
    cantidad,
    precio,
    descuento,
    tarifa,
  };
}

function toNotaCreditoListItem(row: ApiRow): NotaCreditoListItem {
  const serie = text(pickValue(row, ['serie', 'Serie']));
  const numero = text(pickValue(row, ['numeroNota', 'NumeroNota', 'numNotaCredito', 'NumNotaCredito', 'numero', 'Numero', 'secuencial', 'Secuencial']));
  const numeroCompleto = text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']));
  const autorizadoRaw = pickValue(row, ['autorizado', 'Autorizado', 'estaAutorizado', 'EstaAutorizado']);
  const autorizado = booleanValue(autorizadoRaw);
  const estadoGenerico = pickValue(row, ['estado', 'Estado', 'activo', 'Activo']);
  const estado = booleanValue(estadoGenerico);
  const estadoSri = estado === false
    ? 'ANULADO'
    : text(pickValue(row, ['estadoSri', 'EstadoSri', 'estadoSRI', 'EstadoSRI', 'estadoAutorizacion', 'EstadoAutorizacion']))
      || (typeof estadoGenerico === 'string' && !['true', 'false', '1', '0'].includes(estadoGenerico.trim().toLowerCase()) ? estadoGenerico : '')
      || (autorizado === true ? 'AUTORIZADO' : 'PENDIENTE');

  return {
    codNotaCredito: numberValue(pickValue(row, ['codNotaCredito', 'CodNotaCredito', 'codnotacredito', 'codNota', 'CodNota', 'secNotaCredito', 'SecNotaCredito', 'sec', 'Sec', 'idNotaCredito', 'IdNotaCredito', 'id', 'Id'])) ?? 0,
    documentoModificadoId: numberValue(pickValue(row, ['documentoModificadoId', 'DocumentoModificadoId', 'idDocModificado', 'IdDocModificado'])),
    serie: serie || null,
    numeroNota: numeroCompleto || [serie, numero].filter(Boolean).join('-') || numero || null,
    numeroCompleto: numeroCompleto || [serie, numero].filter(Boolean).join('-') || numero || null,
    facturaModificada: text(pickValue(row, ['facturaModificada', 'FacturaModificada', 'numeroDocModificado', 'NumeroDocModificado', 'numeroFactura', 'NumeroFactura', 'factura', 'Factura'])) || null,
    numeroDocModificado: text(pickValue(row, ['numeroDocModificado', 'NumeroDocModificado', 'facturaModificada', 'FacturaModificada', 'numeroFactura', 'NumeroFactura', 'factura', 'Factura'])) || null,
    fechaSustento: text(pickValue(row, ['fechaSustento', 'FechaSustento', 'fechaDocumentoModificado', 'FechaDocumentoModificado', 'fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fechaDocumento', 'FechaDocumento', 'fechaFactura', 'FechaFactura', 'fecha', 'Fecha', 'fechaCreacion', 'FechaCreacion'])) || null,
    fechaDocumentoModificado: text(pickValue(row, ['fechaDocumentoModificado', 'FechaDocumentoModificado', 'fechaSustento', 'FechaSustento', 'fechaFactura', 'FechaFactura'])) || null,
    cliente: text(pickValue(row, ['cliente', 'Cliente', 'nombreCliente', 'NombreCliente', 'razonSocial', 'RazonSocial'])) || null,
    identificacionCliente: text(pickValue(row, ['identificacionCliente', 'IdentificacionCliente', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
    tipoIdentificacionCliente: text(pickValue(row, ['tipoIdentificacionCliente', 'TipoIdentificacionCliente'])) || null,
    estadoSri,
    autorizado,
    numeroAutorizacion: text(pickValue(row, ['numeroAutorizacion', 'NumeroAutorizacion', 'numAutorizacion', 'NumAutorizacion'])) || null,
    fechaAutorizacion: text(pickValue(row, ['fechaAutorizacion', 'FechaAutorizacion'])) || null,
    claveAcceso: text(pickValue(row, ['claveAcceso', 'ClaveAcceso', 'codClave', 'CodClave'])) || null,
    mensajeSri: text(pickValue(row, ['mensajeSri', 'MensajeSri', 'mensajeSRI', 'MensajeSRI', 'mensaje', 'Mensaje', 'errorSri', 'ErrorSri', 'observacion', 'Observacion'])) || null,
    subtotal: numberValue(pickValue(row, ['subtotal', 'Subtotal'])),
    subtotalIva: numberValue(pickValue(row, ['subtotalIva', 'SubtotalIva'])),
    subtotalCero: numberValue(pickValue(row, ['subtotalCero', 'SubtotalCero'])),
    descuentos: numberValue(pickValue(row, ['descuentos', 'Descuentos', 'descuento', 'Descuento'])),
    iva: numberValue(pickValue(row, ['iva', 'Iva', 'valorIva', 'ValorIva'])),
    ice: numberValue(pickValue(row, ['ice', 'Ice', 'valorIce', 'ValorIce'])),
    motivo: text(pickValue(row, ['motivo', 'Motivo'])) || null,
    total: numberValue(pickValue(row, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalNotaCredito', 'TotalNotaCredito', 'totalComprobante', 'TotalComprobante', 'totalDocumento', 'TotalDocumento', 'montoTotal', 'MontoTotal', 'importeTotal', 'ImporteTotal', 'valorDocumento', 'ValorDocumento', 'totalGeneral', 'TotalGeneral', 'monto', 'Monto', 'importe', 'Importe', 'valor', 'Valor'])),
    fechaVencimientoDocumento: text(pickValue(row, ['fechaVencimientoDocumento', 'FechaVencimientoDocumento'])) || null,
    saldoPendienteDocumento: numberValue(pickValue(row, ['saldoPendienteDocumento', 'SaldoPendienteDocumento'])),
    xmlUrl: text(pickValue(row, ['xmlUrl', 'XmlUrl'])) || null,
    estado,
  };
}

function pickValue(row: ApiRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) return row[key];
  }

  const normalizedKeys = keys.map(normalizeKey);
  const entry = Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalizedKeys.includes(normalizeKey(key)));

  return entry?.[1];
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
    if (['false', '0', 'no', 'n', 'pendiente', 'no autorizado', 'inactivo', 'anulado'].includes(normalized)) return false;
  }

  return null;
}
