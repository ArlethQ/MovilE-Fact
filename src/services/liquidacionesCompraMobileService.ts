import { ApiError, apiRequest } from './apiClient';
import { Cliente } from '../types/business';
import { FacturaPreparacion, FacturaProducto, buscarFacturaProductos, normalizeFacturaPreparacion } from './facturasMobileService';
import type { DocumentPdfFormat } from '../utils/documentFormatting';

type ApiRow = Record<string, unknown>;

export type LiquidacionCompraListItem = {
  codLiquidacion: number;
  numero?: string | null;
  fecha?: string | null;
  proveedor?: string | null;
  identificacionProveedor?: string | null;
  estadoSri?: string | null;
  autorizado?: boolean | null;
  numeroAutorizacion?: string | null;
  mensajeSri?: string | null;
  retencionDisponible?: boolean | null;
  numeroRetencion?: string | null;
  base?: number | null;
  iva?: number | null;
  total?: number | null;
  baseIva?: number | null;
  baseRenta?: number | null;
};

export type LiquidacionCompraLineaInput = {
  producto: FacturaProducto;
  cantidad: number;
  precio: number;
  descuento: number;
  tarifa: number;
  codigoPorcentaje: number;
  detalle?: string | null;
};

export type LiquidacionCompraGuardarInput = {
  idUsuario: number;
  proveedor: Cliente;
  serie?: string | null;
  numero?: string | null;
  codemisor?: number | null;
  formaPago?: string | null;
  diasCredito?: number | null;
  correos?: string[];
  correosGuardar?: string[];
  detalles: LiquidacionCompraLineaInput[];
};

export function getLiquidacionCodigoPorcentaje(producto: FacturaProducto, tarifa: number) {
  const codigoProducto = Number(String(producto.codigoImpuestoSri ?? '').trim());
  if (String(producto.codigoImpuestoSri ?? '').trim() && [0, 4, 5, 6, 7, 8].includes(codigoProducto)) return codigoProducto;

  if (tarifa === 15) return 4;
  if (tarifa === 5) return 5;
  if (tarifa === 8) return 8;
  return 0;
}

export function getLiquidacionCompraPreparacion(userId: number) {
  return requestWithFallback<Record<string, unknown>>([
    `/api/liquidaciones-compra/preparacion?idUsuario=${userId}`,
    `/api/liquidacion-compra/preparacion?idUsuario=${userId}`,
    `/api/compras/liquidaciones/preparacion?idUsuario=${userId}`,
    `/api/facturas/preparacion?idUsuario=${userId}`,
  ]).then(normalizeLiquidacionPreparacion).then((response) => normalizeFacturaPreparacion(response as FacturaPreparacion & Record<string, unknown>));
}

export async function getLiquidacionesCompra(userId: number, top = 0) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/liquidaciones-compra?idUsuario=${userId}&top=${top}`,
    `/api/liquidacion-compra?idUsuario=${userId}&top=${top}`,
    `/api/compras/liquidaciones?idUsuario=${userId}&top=${top}`,
  ]);
  return normalizeRows(response).map(toLiquidacionListItem);
}

export async function buscarLiquidacionProveedores(userId: number, filtro: string) {
  const response = await requestWithFallback<ApiRow[] | Record<string, unknown>>([
    `/api/liquidaciones-compra/proveedores?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
    `/api/liquidacion-compra/proveedores?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`,
  ]);
  return normalizeRows(response).map(toProveedor);
}

export function buscarLiquidacionProductos(userId: number, filtro: string) {
  return buscarFacturaProductos(userId, filtro);
}

export async function guardarLiquidacionCompra(input: LiquidacionCompraGuardarInput) {
  const subtotal0 = input.detalles.reduce((sum, item) => sum + (item.tarifa <= 0 ? Math.max(item.cantidad * item.precio - item.descuento, 0) : 0), 0);
  const subtotal15 = input.detalles.reduce((sum, item) => sum + (item.tarifa > 0 ? Math.max(item.cantidad * item.precio - item.descuento, 0) : 0), 0);
  const subtotal = subtotal0 + subtotal15;
  const iva = input.detalles.reduce((sum, item) => {
    const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
    return sum + base * (item.tarifa / 100);
  }, 0);

  const serie = input.serie?.replace(/\D/g, '') || '';
  const estab = serie.slice(0, 3) || '001';
  const ptoEmi = serie.slice(3, 6) || '001';

  const detalles = input.detalles.map((item) => {
    const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
    const valorIva = base * (item.tarifa / 100);
    return {
      CodProducto: item.producto.codproducto,
      CodigoPrincipal: item.producto.codprincipal || String(item.producto.codproducto || ''),
      CodigoAuxiliar: item.producto.codauxiliar || '',
      Descripcion: [item.producto.descripcion, item.detalle?.trim()].filter(Boolean).join(' - ') || 'Producto',
      Cantidad: item.cantidad,
      PrecioUnitario: item.precio,
      PorcentajeDescuento: item.precio > 0 && item.cantidad > 0 ? (item.descuento / (item.cantidad * item.precio)) * 100 : 0,
      Descuento: item.descuento,
      PrecioTotalSinImpuesto: base,
      CodigoPorcentaje: item.codigoPorcentaje,
      Tarifa: item.tarifa,
      BaseImponible: base,
      ValorIva: valorIva,
      Total: base + valorIva,
    };
  });

  const response = await apiRequest<{ codFactura?: number; CodFactura?: number; mensaje?: string }>(
    `/api/liquidaciones-compra?idUsuario=${input.idUsuario}`,
    {
      method: 'POST',
      body: JSON.stringify({
        Usuario: input.idUsuario,
        CodEmisor: input.codemisor,
        Estab: estab,
        PtoEmi: ptoEmi,
        Secuencial: input.numero || '',
        FechaEmision: new Date().toISOString(),
        TipoIdentificacionProveedor: tipoIdentificacionCode(input.proveedor.tipoidentificacion) || '04',
        IdentificacionProveedor: input.proveedor.numeroidentificacion || '',
        RazonSocialProveedor: input.proveedor.nombrerazonsocial || input.proveedor.nombrecomercial || '',
        DireccionProveedor: input.proveedor.direccion || '',
        TelefonoFijoProveedor: input.proveedor.telefonoconvencional || '',
        TelefonoProveedor: input.proveedor.celular || '',
        EmailProveedor: input.proveedor.correo || '',
        CorreosAdicionalesProveedor: input.correos?.filter(Boolean) ?? [],
        CorreosAdicionalesProveedorGuardar: input.correosGuardar?.filter(Boolean) ?? [],
        CodProveedor: input.proveedor.codcliente || null,
        FormaPago: input.formaPago || '01',
        Plazo: input.diasCredito ?? 0,
        UnidadTiempo: 'dias',
        Moneda: 'DOLAR',
        Subtotal0: subtotal0,
        Subtotal15: subtotal15,
        TotalSinImpuestos: subtotal,
        TotalDescuento: input.detalles.reduce((sum, item) => sum + item.descuento, 0),
        Iva15: iva,
        IvaTotal: iva,
        ImporteTotal: subtotal + iva,
        Detalles: detalles,
      }),
    },
  );

  const codLiquidacion = response.codFactura ?? response.CodFactura;
  return { mensaje: response.mensaje ?? 'Liquidacion guardada correctamente.', codLiquidacion, numeroComprobante: null };
}

export function getLiquidacionCompraPdf(userId: number, codLiquidacion: number, formato: DocumentPdfFormat = 'A4') {
  return apiRequest<{ url: string }>(`/api/liquidaciones-compra/${codLiquidacion}/pdf?idUsuario=${userId}&formato=${formato}`);
}

export function getLiquidacionCompraXml(userId: number, codLiquidacion: number) {
  return apiRequest<{ url: string }>(`/api/liquidaciones-compra/${codLiquidacion}/xml?idUsuario=${userId}`);
}

export async function getLiquidacionCompraRetencionBases(userId: number, codLiquidacion: number) {
  const response = await apiRequest<ApiRow>(`/api/liquidaciones-compra/${codLiquidacion}?idUsuario=${userId}`);
  const preview = isRecord(response.preview) ? response.preview : isRecord(response.Preview) ? response.Preview : response;
  const detallesValue = pickValue(preview, ['detalles', 'Detalles']);
  const detalles = Array.isArray(detallesValue) ? detallesValue.filter(isRecord) : [];

  return {
    baseIva: detalles.length
      ? detalles.reduce((total, detalle) => total + (numberValue(pickValue(detalle, ['valorIva', 'ValorIva', 'valorIVA', 'ValorIVA'])) ?? 0), 0)
      : numberValue(pickValue(preview, ['ivaTotal', 'IvaTotal', 'iva', 'Iva'])),
    baseRenta: detalles.length
      ? detalles.reduce((total, detalle) => total + (numberValue(pickValue(detalle, ['precioTotalSinImpuesto', 'PrecioTotalSinImpuesto'])) ?? 0), 0)
      : numberValue(pickValue(preview, ['totalSinImpuestos', 'TotalSinImpuestos'])),
  };
}

export function enviarLiquidacionCompraCorreo(userId: number, codLiquidacion: number) {
  return apiRequest<void>(`/api/liquidaciones-compra/${codLiquidacion}/enviar-correo?idUsuario=${userId}`, { method: 'POST' });
}

export function emitirLiquidacionCompra(userId: number, codLiquidacion: number) {
  return apiRequest<{ estado?: string; mensaje?: string; autorizacion?: string }>(`/api/liquidaciones-compra/${codLiquidacion}/emitir?idUsuario=${userId}`, { method: 'POST' });
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

function normalizeLiquidacionPreparacion(response: Record<string, unknown>): FacturaPreparacion {
  const preview = isRecord(response.preview) ? response.preview : isRecord(response.Preview) ? response.Preview : null;
  if (!preview) return response as FacturaPreparacion;

  const serieVisual = text(pickValue(preview, ['SerieVisual', 'serieVisual']));
  const serieRaw = text(pickValue(preview, ['Serie', 'serie']));
  const secuencial = text(pickValue(preview, ['Secuencial', 'secuencial']));
  const codemisor = numberValue(pickValue(preview, ['CodEmisor', 'codemisor', 'codEmisor']));
  const normalized = response as FacturaPreparacion;

  return {
    ...normalized,
    caja: {
      ...(normalized.caja ?? {}),
      serieLiquidacion: serieVisual || serieRaw || normalized.caja?.serieLiquidacion,
      serieLiquidacionCompra: serieVisual || serieRaw || normalized.caja?.serieLiquidacionCompra,
      siguiente: secuencial || normalized.caja?.siguiente,
      proximo: secuencial || normalized.caja?.proximo,
      codemisor: codemisor ?? normalized.caja?.codemisor,
    },
    series: [
      {
        serieRaw: serieVisual || serieRaw,
        serieVisual: serieVisual || serieRaw,
        codemisor: codemisor ?? null,
        siguiente: secuencial || null,
        proximo: secuencial || null,
      },
      ...(normalized.series ?? []),
    ].filter((item) => Boolean(item.serieRaw || item.serieVisual)),
    formasPago: normalizeFormasPago(response.formasPago ?? response.FormasPago) ?? normalized.formasPago,
  };
}

function normalizeFormasPago(value: unknown): FacturaPreparacion['formasPago'] {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord).map((row) => ({
    codigo: text(pickValue(row, ['codigo', 'Codigo'])) || null,
    descripcion: text(pickValue(row, ['descripcion', 'Descripcion'])) || null,
  }));
}

function normalizeRows(response: ApiRow[] | Record<string, unknown>): ApiRow[] {
  if (Array.isArray(response)) return response;
  const values = [response.items, response.Items, response.data, response.Data, response.liquidaciones, response.Liquidaciones, response.registros, response.Registros, response.result, response.Result, response.results, response.Results];
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

function toProveedor(row: ApiRow): Cliente {
  return {
    codcliente: numberValue(pickValue(row, ['codcliente', 'CodCliente', 'codProveedor', 'CodProveedor', 'id', 'Id'])) ?? 0,
    nombrerazonsocial: text(pickValue(row, ['nombrerazonsocial', 'NombreRazonSocial', 'razonSocial', 'RazonSocial', 'proveedor', 'Proveedor', 'nombre', 'Nombre'])) || null,
    numeroidentificacion: text(pickValue(row, ['numeroidentificacion', 'NumeroIdentificacion', 'identificacion', 'Identificacion', 'ruc', 'Ruc'])) || null,
    tipoidentificacion: text(pickValue(row, ['tipoidentificacion', 'TipoIdentificacion', 'tipoIdentificacion'])) || null,
    correo: text(pickValue(row, ['correo', 'Correo', 'email', 'Email'])) || null,
    direccion: text(pickValue(row, ['direccion', 'Direccion'])) || null,
    telefonoconvencional: text(pickValue(row, ['telefonoconvencional', 'TelefonoConvencional', 'telefonoFijo', 'TelefonoFijo'])) || null,
    celular: text(pickValue(row, ['celular', 'Celular', 'telefonoMovil', 'TelefonoMovil', 'telefono', 'Telefono'])) || null,
    esProveedor: true,
  };
}

function toLiquidacionListItem(row: ApiRow): LiquidacionCompraListItem {
  const serie = text(pickValue(row, ['serie', 'Serie']));
  const numero = text(pickValue(row, ['numero', 'Numero', 'numLiquidacion', 'NumLiquidacion', 'secuencial', 'Secuencial']));
  const numeroCompleto = text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']));
  const numeroRetencion = text(pickValue(row, ['numeroRetencion', 'NumeroRetencion', 'numRetencion', 'NumRetencion']));
  const autorizado = booleanValue(pickValue(row, ['autorizado', 'Autorizado']));
  const estadoSri = text(pickValue(row, ['estadoSri', 'EstadoSri', 'estadoSRI', 'EstadoSRI', 'estado', 'Estado']));
  return {
    codLiquidacion: numberValue(pickValue(row, ['codLiquidacion', 'CodLiquidacion', 'codliquidacion', 'codFactura', 'CodFactura', 'codfactura', 'secLiquidacion', 'SecLiquidacion', 'sec', 'Sec', 'idLiquidacion', 'IdLiquidacion', 'id', 'Id'])) ?? 0,
    numero: numeroCompleto || [serie, numero].filter(Boolean).join('-') || numero || null,
    fecha: text(pickValue(row, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fechaDocumento', 'FechaDocumento', 'fechaSustento', 'FechaSustento', 'fechaCompra', 'FechaCompra', 'fechaCreacion', 'FechaCreacion', 'fechaAutorizacion', 'FechaAutorizacion'])) || null,
    proveedor: text(pickValue(row, ['proveedor', 'Proveedor', 'nombreProveedor', 'NombreProveedor', 'razonSocial', 'RazonSocial'])) || null,
    identificacionProveedor: text(pickValue(row, ['identificacionProveedor', 'IdentificacionProveedor', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc'])) || null,
    estadoSri: normalizeLiquidacionEstado(estadoSri, autorizado),
    autorizado,
    numeroAutorizacion: text(pickValue(row, ['numeroAutorizacion', 'NumeroAutorizacion', 'numAutorizacion', 'NumAutorizacion', 'claveAcceso', 'ClaveAcceso'])) || null,
    mensajeSri: text(pickValue(row, ['mensajeSri', 'MensajeSri', 'mensajeSRI', 'MensajeSRI', 'mensaje', 'Mensaje', 'errorSri', 'ErrorSri', 'observacion', 'Observacion'])) || null,
    retencionDisponible: booleanValue(pickValue(row, ['retencionDisponible', 'RetencionDisponible', 'tieneRetencion', 'TieneRetencion'])) === true || Boolean(numeroRetencion),
    numeroRetencion: numeroRetencion || null,
    base: numberValue(pickValue(row, ['base', 'Base', 'baseImponible', 'BaseImponible', 'subtotal', 'Subtotal', 'subtotalBase', 'SubtotalBase', 'subtotalSinImpuestos', 'SubtotalSinImpuestos', 'totalSinImpuestos', 'TotalSinImpuestos', 'baseGravada', 'BaseGravada', 'valorBase', 'ValorBase', 'importeBase', 'ImporteBase'])),
    iva: numberValue(pickValue(row, ['iva', 'Iva', 'IVA', 'valorIva', 'ValorIva', 'valorIVA', 'ValorIVA', 'totalIva', 'TotalIva', 'totalIVA', 'TotalIVA', 'importeIva', 'ImporteIva'])),
    total: numberValue(pickValue(row, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalLiquidacion', 'TotalLiquidacion', 'totalComprobante', 'TotalComprobante', 'totalDocumento', 'TotalDocumento', 'montoTotal', 'MontoTotal', 'importeTotal', 'ImporteTotal', 'valorDocumento', 'ValorDocumento', 'totalGeneral', 'TotalGeneral', 'monto', 'Monto', 'importe', 'Importe', 'valor', 'Valor'])),
  };
}

function normalizeLiquidacionEstado(estadoSri: string, autorizado: boolean | null) {
  const normalized = estadoSri.trim().toUpperCase();
  if (autorizado === true || (normalized.includes('AUTORIZ') && !normalized.includes('NO AUTORIZ'))) return 'AUTORIZADO';
  if (!normalized || normalized.length <= 2) return 'PENDIENTE';
  if (normalized.includes('NO AUTORIZ') || normalized.includes('RECHAZ') || normalized.includes('DEVUELT') || normalized.includes('NEGAD') || normalized.includes('ERROR') || normalized.includes('ANULAD') || normalized.includes('CANCELAD')) {
    return 'NO AUTORIZADO';
  }
  return estadoSri.trim();
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
    if (['true', '1', 'si', 'sí', 's', 'a', 't', 'autorizado', 'activo', 'disponible'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'pendiente', 'no autorizado', 'inactivo', 'no disponible'].includes(normalized)) return false;
  }
  return null;
}
