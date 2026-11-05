import { apiRequest } from './apiClient';
import { Cliente } from '../types/business';
import { normalizeCliente } from './clientesService';
import type { DocumentPdfFormat } from '../utils/documentFormatting';

const FACTURA_SAVE_TIMEOUT_MS = 120000;

export type FacturaListItem = {
  codfactura: number;
  numfactura?: string | null;
  numeroCompleto?: string | null;
  serie?: string | null;
  fechaEmision?: string | null;
  estadoSri?: string | null;
  autorizado?: boolean | null;
  numeroAutorizacion?: string | null;
  mensajeSri?: string | null;
  total?: number | null;
  totalAbonado?: number | null;
  saldoPendiente?: number | null;
  tipopago?: string | null;
  estadoPago?: string | null;
  cliente?: string | null;
  identificacionCliente?: string | null;
  estado?: boolean | null;
};

export type FacturaDetalle = {
  factura?: ApiRow | null;
  cliente?: Cliente | null;
  detalles?: ApiRow[];
};

export type FacturaProducto = {
  codproducto: number;
  codprincipal?: string | null;
  codauxiliar?: string | null;
  descripcion?: string | null;
  precioUnitario?: number;
  costo?: number;
  tarifaIva?: number;
  codigoImpuestoSri?: string | null;
};

export type FacturaPreparacion = {
  direccionOrigen?: string | null;
  emisores?: { codemisor?: number; codigo?: number; ruc?: string | null; razonsocial?: string | null; razonSocial?: string | null }[];
  porcentajesIva?: { codigo?: string | number | null; descripcion?: string | null; valor?: number | null; valorCalculo?: number | null }[];
  tiposCliente?: { codigo?: number | null; descripcion?: string | null }[];
  paises?: unknown[];
  caja?: {
    serieFactura?: string | null;
    serieGuia?: string | null;
    serieNotasCred?: string | null;
    serieNotasDeb?: string | null;
    serieLiquidacion?: string | null;
    serieLiquidacionCompra?: string | null;
    numCaja?: number | null;
    sec?: number | null;
    secuencial?: number | null;
    siguiente?: string | number | null;
    proximo?: string | number | null;
    numeroSecuencia?: string | number | null;
    codemisor?: number | null;
  } | null;
  series?: {
    serieRaw?: string | null;
    serieVisual?: string | null;
    codemisor?: number | null;
    numCaja?: number | null;
    sec?: number | null;
    secuencial?: number | null;
    siguiente?: string | number | null;
    proximo?: string | number | null;
    numeroSecuencia?: string | number | null;
  }[];
  formasPago?: { id?: number; codigo?: string | number | null; descripcion?: string | null; descripcionSri?: string | null }[];
};

type ApiRow = Record<string, unknown>;

export type FacturaLineaInput = {
  producto: FacturaProducto;
  cantidad: number;
  precio: number;
  descuento: number;
  tarifa: number;
  detalle?: string | null;
};

export type FacturaGuardarInput = {
  idUsuario: number;
  requestId?: string;
  cliente: Cliente;
  serie?: string | null;
  codemisor?: number | null;
  formaPago?: string | null;
  referencia?: string | null;
  correos?: string[];
  detalles: FacturaLineaInput[];
};

export async function getFacturaPreparacion(userId: number) {
  const response = await apiRequest<FacturaPreparacion>(`/api/facturas/preparacion?idUsuario=${userId}`);
  return normalizeFacturaPreparacion(response as FacturaPreparacion & Record<string, unknown>);
}

export function normalizeFacturaPreparacion(response: FacturaPreparacion & Record<string, unknown>): FacturaPreparacion {
  const raw = response as FacturaPreparacion & Record<string, unknown>;
  const emisores = pickValue(raw, ['emisores', 'Emisores']);
  const formasPago = (response.formasPago ?? raw.FormasPago ?? []) as Record<string, unknown>[];
  const porcentajesIva = pickValue(raw, ['porcentajesIva', 'PorcentajesIva', 'porcentajesIVA', 'PorcentajesIVA']);
  const tiposCliente = pickValue(raw, ['tiposCliente', 'TiposCliente', 'tiposcliente']);

  return {
    ...response,
    emisores: Array.isArray(emisores)
      ? emisores
        .map((value) => {
          const row = isRecord(value) ? value : {};
          const codigo = numberValue(pickValue(row, ['codemisor', 'Codemisor', 'codEmisor', 'CodEmisor', 'codigo', 'Codigo'])) ?? undefined;
          return {
            codemisor: codigo,
            codigo,
            ruc: text(pickValue(row, ['ruc', 'Ruc', 'RUC'])) || null,
            razonsocial: text(pickValue(row, ['razonsocial', 'Razonsocial', 'RazonSocial'])) || null,
            razonSocial: text(pickValue(row, ['razonSocial', 'RazonSocial', 'razonsocial', 'Razonsocial'])) || null,
          };
        })
        .filter((item) => (item.codemisor ?? 0) > 0)
      : [],
    porcentajesIva: Array.isArray(porcentajesIva) ? porcentajesIva.map(normalizePorcentajeIva) : [],
    tiposCliente: Array.isArray(tiposCliente) ? tiposCliente.map(normalizeTipoCliente) : [],
    formasPago: formasPago
      .map((item) => ({
        id: Number(item.id ?? item.Id) || undefined,
        codigo: pickValue(item, ['codigo', 'Codigo', 'codigoFormaPago', 'CodigoFormaPago']) as string | number | null,
        descripcion: text(pickValue(item, ['descripcion', 'Descripcion', 'nombre', 'Nombre', 'descripcionFormaPago', 'DescripcionFormaPago'])) || null,
        descripcionSri: text(pickValue(item, ['descripcionSri', 'DescripcionSri', 'DescripcionSRI', 'descripcionSRI', 'nombreSri', 'NombreSri'])) || null,
      }))
      .filter((item) => item.codigo !== null && item.codigo !== undefined && String(item.codigo).trim() !== ''),
  };
}

export async function getFacturas(userId: number, top = 0) {
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(`/api/facturas?idUsuario=${userId}&top=${top}`);
  return normalizeFacturaRows(response).map(toFacturaListItem);
}

export async function getFacturaDetalle(userId: number, codfactura: number): Promise<FacturaDetalle> {
  const response = await apiRequest<ApiRow>(`/api/facturas/${codfactura}?idUsuario=${userId}`);
  const factura = pickValue(response, ['factura', 'Factura']);
  const cliente = pickValue(response, ['cliente', 'Cliente']);
  const detalles = pickValue(response, ['detalles', 'Detalles']);

  return {
    factura: isRecord(factura) ? factura : response,
    cliente: isRecord(cliente) ? cliente as Cliente : null,
    detalles: Array.isArray(detalles) ? detalles.filter(isRecord) : [],
  };
}

export async function buscarFacturaClientes(userId: number, filtro: string) {
  const response = await apiRequest<(Cliente & Record<string, unknown>)[]>(`/api/facturas/clientes/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`);
  return response.map(normalizeCliente);
}

export async function buscarFacturaProductos(userId: number, filtro: string) {
  const response = await apiRequest<ApiRow[] | ApiRow>(`/api/facturas/productos/buscar?idUsuario=${userId}&filtro=${encodeURIComponent(filtro)}`);
  return normalizeFacturaRows(response).map(normalizeFacturaProducto).filter((producto) => producto.descripcion || producto.codprincipal);
}

export function getSiguienteFactura(userId: number, codemisor?: number | null, serie?: string | null) {
  const params = new URLSearchParams({ idUsuario: String(userId) });
  if (codemisor) params.set('codEmisor', String(codemisor));
  if (serie) params.set('serie', serie);
  return apiRequest<{ proximo: string }>(`/api/facturas/siguiente-secuencial?${params.toString()}`);
}

export function guardarFactura(input: FacturaGuardarInput) {
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const getBase = (item: FacturaLineaInput) => roundMoney(Math.max(item.cantidad * item.precio - item.descuento, 0));
  const totalBase12 = input.detalles.reduce((sum, item) => sum + (item.tarifa > 0 ? getBase(item) : 0), 0);
  const totalBase0 = input.detalles.reduce((sum, item) => sum + (item.tarifa <= 0 ? getBase(item) : 0), 0);
  const totalBase = roundMoney(totalBase12 + totalBase0);
  const totalIva = input.detalles.reduce((sum, item) => {
    return sum + roundMoney(getBase(item) * (item.tarifa / 100));
  }, 0);

  const factura = {
    codemisor: input.codemisor,
    coddocumento: 1,
    tipodocumento: 1,
    serie: input.serie?.replace(/-/g, '') || null,
    tipopago: input.formaPago || null,
    ambiente: 2,
    estado: true,
    autorizado: false,
    fechaentrega: new Date().toISOString(),
    notas: input.referencia || null,
    subtotal12: roundMoney(totalBase12),
    subtotal0: roundMoney(totalBase0),
    subtotal: totalBase,
    descuentos: roundMoney(input.detalles.reduce((sum, item) => sum + item.descuento, 0)),
    iva: roundMoney(totalIva),
    valortotal: roundMoney(totalBase + totalIva),
  };

  const detalles = input.detalles.map((item) => {
    const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
    const baseRedondeada = roundMoney(base);
    const iva = roundMoney(baseRedondeada * (item.tarifa / 100));
    return {
      codproducto: item.producto.codproducto,
      codprincipal: item.producto.codprincipal,
      codauxiliar: item.producto.codauxiliar,
      cantproducto: item.cantidad,
      descripproducto: [item.producto.descripcion, item.detalle?.trim()].filter(Boolean).join(' - '),
      precioproducto: item.precio,
      descuento: item.descuento,
      valortproducto: baseRedondeada,
      valoriva: iva,
      valortotal: roundMoney(baseRedondeada + iva),
      tarifa: item.tarifa,
      costo: item.producto.costo ?? 0,
    };
  });

  return apiRequest<{ mensaje: string; codfactura: number; numeroComprobante?: string | null; sri?: { estado?: string; mensaje?: string; autorizacion?: string | null } }>(
    '/api/facturas/guardar-completa',
    {
      method: 'POST',
      body: JSON.stringify({
        idUsuario: input.idUsuario,
        requestId: input.requestId,
        factura,
        cliente: input.cliente,
        detalles,
        correosFactura: input.correos?.filter(Boolean).map((correo) => ({ correo, guardarEnCliente: false })) ?? [],
      }),
      timeoutMs: FACTURA_SAVE_TIMEOUT_MS,
    },
  );
}

export function getFacturaPdf(userId: number, codfactura: number, formato: DocumentPdfFormat = 'A4') {
  return apiRequest<{ url: string }>(`/api/facturas/${codfactura}/pdf?idUsuario=${userId}&formato=${formato}`);
}

export function getFacturaXml(userId: number, codfactura: number) {
  return apiRequest<{ url: string }>(`/api/facturas/${codfactura}/xml?idUsuario=${userId}`);
}

export function enviarFacturaCorreo(userId: number, codfactura: number) {
  return apiRequest<void>(`/api/facturas/${codfactura}/enviar-correo`, {
    method: 'POST',
    body: JSON.stringify({ idUsuario: userId, forzarReenvio: true, correosCopia: [] }),
  });
}

export function anularFactura(userId: number, codfactura: number) {
  return apiRequest<void>(`/api/facturas/${codfactura}?idUsuario=${userId}`, { method: 'DELETE' });
}

export function reintentarFacturaSri(userId: number, codfactura: number) {
  return apiRequest<{ estado?: string; mensaje?: string }>(`/api/facturas/${codfactura}/reintentar-sri?idUsuario=${userId}`, { method: 'POST' });
}

function normalizeFacturaRows(response: ApiRow[] | Record<string, unknown>): ApiRow[] {
  if (Array.isArray(response)) return response;

  const values = [
    response.items,
    response.Items,
    response.data,
    response.Data,
    response.facturas,
    response.Facturas,
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
      const nestedRows = normalizeFacturaRows(value);
      if (nestedRows.length) return nestedRows;
    }
  }

  const firstArray = Object.values(response).find(Array.isArray);
  if (Array.isArray(firstArray)) return firstArray as ApiRow[];

  return Object.keys(response).length ? [response] : [];
}

function normalizeFacturaCliente(cliente: Cliente & Record<string, unknown>): Cliente {
  const row = cliente as ApiRow;
  return {
    ...cliente,
    codcliente: numberValue(pickValue(row, ['codcliente', 'Codcliente', 'CodCliente'])) ?? 0,
    apellidos: text(pickValue(row, ['apellidos', 'Apellidos'])) || null,
    nombres: text(pickValue(row, ['nombres', 'Nombres'])) || null,
    nombrecomercial: text(pickValue(row, ['nombrecomercial', 'Nombrecomercial', 'NombreComercial'])) || null,
    nombrerazonsocial: text(pickValue(row, ['nombrerazonsocial', 'Nombrerazonsocial', 'NombreRazonSocial'])) || null,
    numeroidentificacion: text(pickValue(row, ['numeroidentificacion', 'Numeroidentificacion', 'NumeroIdentificacion'])) || null,
    direccion: text(pickValue(row, ['direccion', 'Direccion'])) || null,
    telefonoconvencional: text(pickValue(row, ['telefonoconvencional', 'Telefonoconvencional', 'TelefonoConvencional'])) || null,
    celular: text(pickValue(row, ['celular', 'Celular'])) || null,
    correo: text(pickValue(row, ['correo', 'Correo', 'Email'])) || null,
    oblgconta: text(pickValue(row, ['oblgconta', 'Oblgconta', 'ObligadoContabilidad'])) || null,
    tipoCliente: numberValue(pickValue(row, ['tipoCliente', 'TipoCliente', 'tclCodigo', 'TclCodigo'])),
    tipoidentificacion: text(pickValue(row, ['tipoidentificacion', 'Tipoidentificacion', 'TipoIdentificacion'])) || null,
  };
}

function normalizeFacturaProducto(row: ApiRow): FacturaProducto {
  return {
    codproducto: numberValue(pickValue(row, ['codproducto', 'Codproducto', 'CodProducto', 'idProducto', 'IdProducto', 'idproducto', 'Idproducto', 'productoId', 'ProductoId', 'id', 'Id'])) ?? 0,
    codprincipal: text(pickValue(row, ['codprincipal', 'Codprincipal', 'CodPrincipal', 'codigoPrincipal', 'CodigoPrincipal', 'codigoProducto', 'CodigoProducto', 'codigo', 'Codigo', 'sku', 'Sku', 'referencia', 'Referencia', 'codigoBarra', 'CodigoBarra'])) || null,
    codauxiliar: text(pickValue(row, ['codauxiliar', 'Codauxiliar', 'CodAuxiliar', 'codigoAuxiliar', 'CodigoAuxiliar', 'codigoAlterno', 'CodigoAlterno'])) || null,
    descripcion: text(pickValue(row, ['descripcion', 'Descripcion', 'nombreProducto', 'NombreProducto', 'producto', 'Producto', 'nombre', 'Nombre', 'descripproducto', 'DescripProducto', 'descripProducto', 'descripcionProducto', 'DescripcionProducto', 'detalle', 'Detalle', 'concepto', 'Concepto', 'item', 'Item', 'label', 'Label', 'text', 'Text'])) || null,
    precioUnitario: pickNumberValue(row, ['precioUnitario', 'PrecioUnitario', 'valorUnitario', 'ValorUnitario', 'precioVenta', 'PrecioVenta', 'pvp', 'Pvp', 'PVP', 'precio1', 'Precio1', 'precioproducto', 'PrecioProducto', 'precioProducto', 'precioBase', 'PrecioBase', 'valor', 'Valor', 'precio', 'Precio', 'monto', 'Monto', 'importe', 'Importe']) ?? 0,
    costo: numberValue(pickValue(row, ['costo', 'Costo', 'costoProducto', 'CostoProducto'])) ?? 0,
    tarifaIva: percentageValue(pickNumberValue(row, ['tarifaIva', 'TarifaIva', 'tarifaIVA', 'TarifaIVA', 'porcentajeIva', 'PorcentajeIva', 'porcentajeIVA', 'porcentajeImpuesto', 'PorcentajeImpuesto', 'tarifa', 'Tarifa', 'iva', 'Iva', 'IVA'])) ?? 0,
    codigoImpuestoSri: text(pickValue(row, ['codigoImpuestoSri', 'CodigoImpuestoSri', 'codigoimpuesto', 'Codigoimpuesto'])) || null,
  };
}

function toFacturaListItem(row: ApiRow): FacturaListItem {
  const serie = text(pickValue(row, ['serie', 'Serie', 'serieFactura', 'SerieFactura']));
  const numero = text(pickValue(row, ['numfactura', 'NumFactura', 'numeroFactura', 'NumeroFactura', 'numero', 'Numero', 'secuencial', 'Secuencial']));
  const numeroCompleto = text(pickValue(row, ['numeroCompleto', 'NumeroCompleto', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento', 'comprobante', 'Comprobante']));

  return {
    codfactura: numberValue(pickValue(row, ['codfactura', 'CodFactura', 'codFactura', 'idFactura', 'IdFactura', 'id', 'Id', 'codigo', 'Codigo', 'sec', 'Sec'])) ?? 0,
    numfactura: numero || null,
    numeroCompleto: numeroCompleto || [serie, numero].filter(Boolean).join('-') || null,
    serie: serie || null,
    fechaEmision: text(pickValue(row, ['fechaEmision', 'FechaEmision', 'fechaemision', 'Fechaemision', 'fecha', 'Fecha', 'fechaDocumento', 'FechaDocumento', 'fechaSustento', 'FechaSustento', 'fechaentrega', 'FechaEntrega', 'fechaCreacion', 'FechaCreacion', 'createdAt', 'CreatedAt'])) || null,
    estadoSri: normalizeFacturaSriState(row),
    autorizado: booleanValue(pickValue(row, ['autorizado', 'Autorizado', 'estaAutorizado', 'EstaAutorizado'])),
    numeroAutorizacion: text(pickValue(row, ['numeroAutorizacion', 'NumeroAutorizacion', 'autorizacion', 'Autorizacion'])) || null,
    mensajeSri: text(pickValue(row, ['mensajeSri', 'MensajeSri', 'mensajeSRI', 'MensajeSRI', 'mensaje', 'Mensaje'])) || null,
    total: numberValue(pickValue(row, ['total', 'Total', 'valortotal', 'ValorTotal', 'valorTotal', 'totalFactura', 'TotalFactura', 'totalComprobante', 'TotalComprobante', 'totalDocumento', 'TotalDocumento', 'montoTotal', 'MontoTotal', 'importeTotal', 'ImporteTotal', 'valorDocumento', 'ValorDocumento', 'totalGeneral', 'TotalGeneral', 'monto', 'Monto', 'importe', 'Importe'])),
    totalAbonado: numberValue(pickValue(row, ['totalAbonado', 'TotalAbonado', 'abonado', 'Abonado', 'valorAbonado', 'ValorAbonado', 'montoAbonado', 'MontoAbonado'])),
    saldoPendiente: numberValue(pickValue(row, ['saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo', 'valorPendiente', 'ValorPendiente', 'montoPendiente', 'MontoPendiente'])),
    tipopago: text(pickValue(row, ['tipopago', 'TipoPago', 'tipoPago', 'formaPago', 'FormaPago', 'descripcionFormaPago', 'DescripcionFormaPago', 'nombreFormaPago', 'NombreFormaPago', 'tipoPagoDescripcion', 'TipoPagoDescripcion'])) || null,
    estadoPago: text(pickValue(row, ['estadoPago', 'EstadoPago'])) || null,
    cliente: text(pickValue(row, ['cliente', 'Cliente', 'clienteNombre', 'ClienteNombre', 'nombreCliente', 'NombreCliente', 'razonSocial', 'RazonSocial', 'nombrerazonsocial', 'NombreRazonSocial'])) || null,
    identificacionCliente: text(pickValue(row, ['identificacionCliente', 'IdentificacionCliente', 'numeroIdentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc', 'cedula', 'Cedula'])) || null,
    estado: booleanValue(pickValue(row, ['estado', 'Estado', 'activo', 'Activo'])),
  };
}

function normalizeFacturaSriState(row: ApiRow) {
  const explicitState = pickValue(row, ['estadoSri', 'EstadoSri', 'estadoSRI', 'EstadoSRI', 'estadoAutorizacion', 'EstadoAutorizacion']);
  const genericState = pickValue(row, ['estado', 'Estado']);
  const value = explicitState ?? (typeof genericState === 'string' ? genericState : null);
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim().toLowerCase();
  if (['true', 'false', '1', '0'].includes(normalized)) return null;
  return normalized ? String(value).trim() : null;
}

function toFacturaProducto(row: ApiRow): FacturaProducto {
  return {
    codproducto: numberValue(pickValue(row, ['codproducto', 'Codproducto', 'CodProducto', 'id', 'Id', 'codigo', 'Codigo'])) ?? 0,
    codprincipal: text(pickValue(row, ['codprincipal', 'Codprincipal', 'CodPrincipal', 'codigoPrincipal', 'CodigoPrincipal'])) || null,
    codauxiliar: text(pickValue(row, ['codauxiliar', 'Codauxiliar', 'CodAuxiliar', 'codigoAuxiliar', 'CodigoAuxiliar'])) || null,
    descripcion: text(pickValue(row, ['descripcion', 'Descripcion', 'descripproducto', 'Descripproducto', 'nombre', 'Nombre'])) || null,
    precioUnitario: pickNumberValue(row, ['precioUnitario', 'PrecioUnitario', 'preciounitario', 'Preciounitario', 'valorUnitario', 'ValorUnitario', 'precioVenta', 'PrecioVenta', 'pvp', 'Pvp', 'PVP', 'precio1', 'Precio1', 'precio', 'Precio', 'precioBase', 'PrecioBase', 'valor', 'Valor']) ?? 0,
    costo: numberValue(pickValue(row, ['costo', 'Costo'])) ?? 0,
    tarifaIva: percentageValue(pickNumberValue(row, ['tarifaIva', 'TarifaIva', 'tarifa', 'Tarifa', 'iva', 'Iva'])) ?? 0,
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

function pickNumberValue(row: ApiRow, keys: string[]) {
  const normalizedKeys = keys.map(normalizeKey);
  const values = Object.entries(row)
    .filter(([key, value]) => value !== null && value !== undefined && (keys.includes(key) || normalizedKeys.includes(normalizeKey(key))))
    .map(([, value]) => numberValue(value))
    .filter((value): value is number => value !== null);
  return values.find((value) => value > 0) ?? values.find((value) => value === 0) ?? null;
}

function normalizePorcentajeIva(value: unknown) {
  const row = isRecord(value) ? value : {};
  const values = [
    pickValue(row, ['valorCalculo', 'ValorCalculo']),
    pickValue(row, ['valor', 'Valor']),
    pickValue(row, ['porcentaje', 'Porcentaje', 'porcentajeIva', 'PorcentajeIva', 'tarifa', 'Tarifa']),
  ];
  const porcentaje = values.map(percentageValue).find((item) => item !== null && item > 0) ?? values.map(percentageValue).find((item) => item !== null) ?? percentageValue(pickValue(row, ['descripcion', 'Descripcion'])) ?? 0;
  return {
    codigo: pickValue(row, ['codigo', 'Codigo', 'codigoPorcentaje', 'CodigoPorcentaje']) as string | number | null,
    descripcion: `${porcentaje}%`,
    valor: porcentaje,
    valorCalculo: porcentaje,
  };
}

function normalizeTipoCliente(value: unknown) {
  const row = isRecord(value) ? value : {};
  return {
    codigo: numberValue(pickValue(row, ['codigo', 'Codigo', 'tclCodigo', 'TclCodigo'])) ?? 0,
    descripcion: text(pickValue(row, ['descripcion', 'Descripcion', 'tclDescripcion', 'TclDescripcion'])) || 'Sin tipo',
  };
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

function percentageValue(value: unknown) {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

function booleanValue(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 's', 'autorizado', 'activo'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'pendiente', 'inactivo', 'anulado'].includes(normalized)) return false;
  }

  return null;
}
