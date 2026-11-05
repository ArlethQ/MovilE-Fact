import type { Cliente, Emisor, FirmaEstado, Producto } from '../types/business';
import type { GuiaRemisionDetalle } from '../types/workspaceForms';
import type { NuevaFacturaFormState, NuevaFacturaLinea } from '../types/invoices';
import type { FacturaListItem, FacturaProducto } from '../services/facturasMobileService';

import { formatDocumentDate, formatMoney } from './documentFormatting';
import { getClienteDisplayName, getClienteEmail, getClienteIdentification } from './clientDisplay';
import { getFirmaFileName, hasFirmaConfigured } from './emisorDisplay';
import { validateIdentificacion } from './authValidation';

function normalizeText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

export function getClienteDetailValues(cliente: Cliente, tipoClienteLabel: string, facturas: FacturaListItem[] = []) {
  const stats = getClienteFacturaStats(cliente, facturas);
  const values = [
    `Identificacion: ${getClienteIdentification(cliente) || 'Sin identificacion'}`,
    `Tipo: ${tipoClienteLabel}`,
    `Correo: ${getClienteEmail(cliente) || 'Sin correo'}`,
    `Telefono: ${cliente.celular || cliente.telefonoconvencional || 'Sin telefono'}`,
    `Direccion: ${cliente.direccion || 'Sin direccion'}`,
    `Facturas emitidas: ${stats.facturasEmitidas}`,
    `Saldo pendiente: ${formatMoney(stats.saldoPendiente)}`,
    `Estado: ${cliente.estado === false ? 'Inactivo' : 'Activo'}`,
    cliente.esProveedor ? 'Perfil: Proveedor' : 'Perfil: Cliente',
    cliente.oblgconta ? `Obligado a contabilidad: ${cliente.oblgconta}` : '',
    typeof cliente.diasCredito === 'number' ? `Dias de credito: ${cliente.diasCredito}` : '',
    cliente.observaciones ? `Observaciones: ${cliente.observaciones}` : '',
  ];

  return values.filter(Boolean);
}

export function getClienteFacturaStats(cliente: Cliente, facturas: FacturaListItem[]) {
  const row = cliente as Cliente & Record<string, unknown>;
  const directFacturas = numberValue(
    row.facturasEmitidas ??
      row.FacturasEmitidas ??
      row.totalFacturas ??
      row.TotalFacturas,
  );
  const directSaldo = numberValue(
    row.saldoPendiente ??
      row.SaldoPendiente ??
      row.saldo ??
      row.Saldo,
  );
  const identification = getClienteIdentification(cliente).trim();
  const matched = identification
    ? facturas.filter((factura) => String(factura.identificacionCliente ?? '').trim() === identification)
    : [];

  return {
    facturasEmitidas: directFacturas || matched.length,
    saldoPendiente: directSaldo || matched.reduce((sum, factura) => sum + Number(factura.saldoPendiente ?? 0), 0),
  };
}

export function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function percentageValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

export function getProductoPrice(producto: Producto) {
  return [producto.precioBase, ...(producto.precios ?? [])]
    .map((value) => numberValue(value))
    .find((value) => value > 0) ?? 0;
}

export function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function pickRecordValue(row: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) return row[key];
  }
  const normalized = keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalized.includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')))?.[1];
}

export function buildClienteFromFactura(factura: FacturaListItem, cliente?: Cliente | null, facturaRow?: Record<string, unknown> | null): Cliente {
  const clienteRow = isPlainRecord(cliente) ? cliente as Cliente & Record<string, unknown> : null;
  const facturaClienteRow = isPlainRecord(pickRecordValue(facturaRow, ['cliente', 'Cliente']))
    ? pickRecordValue(facturaRow, ['cliente', 'Cliente']) as Record<string, unknown>
    : null;
  const valueFromClienteOrFactura = (keys: string[]) => pickRecordValue(clienteRow, keys) ?? pickRecordValue(facturaClienteRow, keys) ?? pickRecordValue(facturaRow, keys);
  return {
    ...(cliente ?? {}),
    codcliente: numberValue(cliente?.codcliente ?? valueFromClienteOrFactura(['codcliente', 'Codcliente', 'CodCliente', 'codclientes', 'Codclientes', 'codClientes', 'CodClientes'])),
    nombrerazonsocial: (cliente?.nombrerazonsocial ?? textValue(valueFromClienteOrFactura(['nombrerazonsocial', 'NombreRazonSocial', 'razonSocial', 'RazonSocial', 'nombreCliente', 'NombreCliente']) ?? factura.cliente)) || null,
    numeroidentificacion: (cliente?.numeroidentificacion ?? textValue(valueFromClienteOrFactura(['numeroidentificacion', 'NumeroIdentificacion', 'ruc', 'Ruc', 'identificacionCliente', 'IdentificacionCliente']) ?? factura.identificacionCliente)) || null,
    tipoidentificacion: getTipoIdentificacionLabel(cliente?.tipoidentificacion ?? textValue(valueFromClienteOrFactura(['tipoidentificacion', 'Tipoidentificacion', 'tipoIdentificacion', 'TipoIdentificacion']))) || null,
    direccion: (cliente?.direccion ?? textValue(valueFromClienteOrFactura(['direccion', 'Direccion', 'direccionCliente', 'DireccionCliente']))) || null,
    celular: (cliente?.celular ?? textValue(valueFromClienteOrFactura(['celular', 'Celular', 'telefono', 'Telefono']))) || null,
    telefonoconvencional: (cliente?.telefonoconvencional ?? textValue(valueFromClienteOrFactura(['telefonoconvencional', 'TelefonoConvencional']))) || null,
    correo: (cliente?.correo ?? textValue(valueFromClienteOrFactura(['correo', 'Correo', 'email', 'Email']))) || null,
    tipoCliente: normalizeTipoCliente(cliente?.tipoCliente ?? valueFromClienteOrFactura(['tipoCliente', 'TipoCliente', 'tipoClienteCodigo', 'TipoClienteCodigo', 'tclCodigo', 'TclCodigo', 'tipoClienteDescripcion', 'TipoClienteDescripcion'])),
    oblgconta: normalizeObligadoContabilidad(cliente?.oblgconta ?? valueFromClienteOrFactura(['oblgconta', 'Oblgconta', 'obligadoContabilidad', 'ObligadoContabilidad', 'obligado', 'Obligado'])),
  };
}

export function normalizeObligadoContabilidad(value: unknown) {
  if (typeof value === 'boolean') return value ? 'SI' : 'NO';
  const normalized = normalizeText(textValue(value));
  if (['si', 's', 'true', '1', 'obligado'].includes(normalized)) return 'SI';
  if (['no', 'n', 'false', '0', 'no-obligado'].includes(normalized)) return 'NO';
  return textValue(value);
}

export function normalizeTipoCliente(value: unknown) {
  const numeric = numberValue(value);
  if (numeric > 0) return numeric;
  const normalized = normalizeText(textValue(value));
  if (normalized.includes('juridica') || normalized.includes('empresa')) return 2;
  if (normalized.includes('natural') || normalized.includes('persona')) return 1;
  return null;
}

export function mergeFacturaDetalle(factura: FacturaListItem, facturaRow?: Record<string, unknown> | null): FacturaListItem {
  return {
    ...factura,
    codfactura: numberValue(pickRecordValue(facturaRow, ['codfactura', 'Codfactura', 'CodFactura']) ?? factura.codfactura) || factura.codfactura,
    numfactura: textValue(pickRecordValue(facturaRow, ['numfactura', 'Numfactura', 'NumFactura']) ?? factura.numfactura) || factura.numfactura,
    serie: textValue(pickRecordValue(facturaRow, ['serie', 'Serie']) ?? factura.serie) || factura.serie,
    fechaEmision: textValue(pickRecordValue(facturaRow, ['fechaentrega', 'Fechaentrega', 'fechaEntrega', 'FechaEntrega', 'fechaEmision', 'FechaEmision']) ?? factura.fechaEmision) || factura.fechaEmision,
    total: numberValue(pickRecordValue(facturaRow, ['valortotal', 'Valortotal', 'valorTotal', 'ValorTotal']) ?? factura.total) || factura.total,
  };
}

export function detalleFacturaToGuiaDetalle(row: Record<string, unknown>): GuiaRemisionDetalle {
  const productoRow = isPlainRecord(row.producto) ? row.producto : row;
  const precioRaw = pickRecordValue(row, ['precio', 'Precio', 'preciounitario', 'Preciounitario', 'precioUnitario', 'PrecioUnitario', 'precioVenta', 'PrecioVenta', 'valorUnitario', 'ValorUnitario']) ?? pickRecordValue(productoRow, ['precioUnitario', 'PrecioUnitario', 'precioVenta', 'PrecioVenta', 'precio', 'Precio']);
  const tarifaRaw = pickRecordValue(row, ['tarifa', 'Tarifa', 'iva', 'Iva', 'tarifaIva', 'TarifaIva', 'porcentajeIva', 'PorcentajeIva']) ?? pickRecordValue(productoRow, ['tarifaIva', 'TarifaIva', 'tarifa', 'Tarifa', 'iva', 'Iva']);
  return {
    producto: {
      codproducto: numberValue(pickRecordValue(productoRow, ['codproducto', 'Codproducto', 'codProducto', 'CodProducto'])),
      codprincipal: textValue(pickRecordValue(productoRow, ['codprincipal', 'Codprincipal', 'codPrincipal', 'CodPrincipal', 'codigoPrincipal', 'CodigoPrincipal'])) || null,
      codauxiliar: textValue(pickRecordValue(productoRow, ['codauxiliar', 'Codauxiliar', 'codAuxiliar', 'CodAuxiliar', 'codigoAuxiliar', 'CodigoAuxiliar'])) || null,
      descripcion: textValue(pickRecordValue(productoRow, ['descripproducto', 'Descripproducto', 'descripcion', 'Descripcion', 'nombre', 'Nombre'])) || null,
      precioUnitario: numberValue(precioRaw),
      tarifaIva: percentageValue(tarifaRaw),
    },
    cantidad: String(numberValue(pickRecordValue(row, ['cantproducto', 'Cantproducto', 'cantidad', 'Cantidad'])) || numberValue(pickRecordValue(productoRow, ['cantidad', 'Cantidad'])) || 1),
  };

}

export function detalleFacturaToNotaCreditoLinea(row: Record<string, unknown>): NuevaFacturaLinea {
  const productoRow = isPlainRecord(row.producto) ? row.producto : row;
  const precioRaw = pickRecordValue(row, ['precio', 'Precio', 'preciounitario', 'Preciounitario', 'precioUnitario', 'PrecioUnitario', 'precioVenta', 'PrecioVenta']) ?? pickRecordValue(productoRow, ['precioUnitario', 'PrecioUnitario', 'precioVenta', 'PrecioVenta', 'precio', 'Precio']);
  const tarifaRaw = pickRecordValue(row, ['tarifa', 'Tarifa', 'iva', 'Iva', 'tarifaIva', 'TarifaIva']) ?? pickRecordValue(productoRow, ['tarifaIva', 'TarifaIva', 'tarifa', 'Tarifa', 'iva', 'Iva']);
  return {
    producto: {
      codproducto: numberValue(pickRecordValue(productoRow, ['codproducto', 'Codproducto', 'codProducto', 'CodProducto'])),
      codprincipal: textValue(pickRecordValue(productoRow, ['codprincipal', 'Codprincipal', 'codPrincipal', 'CodPrincipal', 'codigoPrincipal', 'CodigoPrincipal'])) || null,
      codauxiliar: textValue(pickRecordValue(productoRow, ['codauxiliar', 'Codauxiliar', 'codAuxiliar', 'CodAuxiliar', 'codigoAuxiliar', 'CodigoAuxiliar'])) || null,
      descripcion: textValue(pickRecordValue(productoRow, ['descripproducto', 'Descripproducto', 'descripcion', 'Descripcion', 'nombre', 'Nombre'])) || null,
      precioUnitario: numberValue(precioRaw),
      tarifaIva: percentageValue(tarifaRaw),
    },
    cantidad: String(numberValue(pickRecordValue(row, ['cantidadDisponible', 'CantidadDisponible', 'cantproducto', 'Cantproducto', 'cantidad', 'Cantidad'])) || 1),
    cantidadDisponible: String(numberValue(pickRecordValue(row, ['cantidadDisponible', 'CantidadDisponible', 'cantproducto', 'Cantproducto', 'cantidad', 'Cantidad'])) || 0),
    precio: String(numberValue(precioRaw)),
    descuento: String(numberValue(pickRecordValue(row, ['descuento', 'Descuento']))),
    tarifa: String(percentageValue(tarifaRaw)),
    detalle: textValue(pickRecordValue(row, ['detalle', 'Detalle', 'detalleAdicional', 'DetalleAdicional'])) || '',
  };
}

export function manualClienteFromForm(form: NuevaFacturaFormState): Cliente {
  return {
    codcliente: 0,
    nombrerazonsocial: form.clienteBusqueda.trim() || 'Cliente manual',
    numeroidentificacion: form.numeroIdentificacion.trim() || null,
    tipoidentificacion: getTipoIdentificacionCode(form.tipoIdentificacion) || null,
    tipoCliente: Number(form.tipoCliente) || null,
    oblgconta: form.obligadoContabilidad.trim() || null,
    direccion: form.direccion.trim() || null,
    celular: form.telefono.trim() || null,
    correo: form.correoPrincipal.trim() || null,
  };
}

export function manualFacturaFromForm(form: { facturaBusqueda: string; numeroFactura: string; clienteBusqueda: string; numeroIdentificacion: string }): FacturaListItem | null {
  const numero = form.facturaBusqueda.trim() || form.numeroFactura.trim();
  if (!numero) return null;

  return {
    codfactura: 0,
    numeroCompleto: numero,
    numfactura: numero,
    cliente: form.clienteBusqueda.trim() || null,
    identificacionCliente: form.numeroIdentificacion.trim() || null,
    fechaEmision: new Date().toISOString(),
    total: 0,
  };
}

export function getTipoIdentificacionLabel(value?: string | number | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const map: Record<string, string> = {
    '04': 'RUC',
    '4': 'RUC',
    '05': 'CÉDULA',
    '5': 'CÉDULA',
    '06': 'PASAPORTE',
    '6': 'PASAPORTE',
    '07': 'CONSUMIDOR FINAL',
    '7': 'CONSUMIDOR FINAL',
    '08': 'IDENTIFICACIÓN DEL EXTERIOR',
    '8': 'IDENTIFICACIÓN DEL EXTERIOR',
  };
  if (map[normalized]) return map[normalized];
  if (normalized.includes('cedula') || normalized.includes('cédula')) return 'CÉDULA';
  if (normalized.includes('ruc')) return 'RUC';
  if (normalized.includes('pasaporte')) return 'PASAPORTE';
  if (normalized.includes('consumidor')) return 'CONSUMIDOR FINAL';
  return String(value ?? '');
}

export function validateClientIdentification(value: string | number | null | undefined, description: string | null | undefined, identification: string) {
  const rawValue = String(value ?? '').trim();
  const type = normalizeText(`${rawValue} ${description ?? ''}`);
  const normalizedIdentification = identification.trim();

  if (type.includes('ruc') || rawValue === '1' || rawValue === '04') {
    const validation = validateIdentificacion('RUC', normalizedIdentification);
    return validation.valid ? null : validation.message ?? 'El RUC no es válido.';
  }

  if (type.includes('cedula') || rawValue === '2' || rawValue === '05' || rawValue === '5') {
    const validation = validateIdentificacion('CEDULA', normalizedIdentification);
    return validation.valid ? null : validation.message ?? 'La cédula no es válida.';
  }

  if (type.includes('consumidor')) {
    return normalizedIdentification === '9999999999999' ? null : 'La identificación de consumidor final no es válida.';
  }

  if (type.includes('pasaporte') || type.includes('exterior') || rawValue === '3' || rawValue === '06' || rawValue === '6' || rawValue === '4' || rawValue === '08' || rawValue === '8') {
    return /^[a-z0-9]{3,20}$/i.test(normalizedIdentification) ? null : 'La identificación debe tener entre 3 y 20 caracteres alfanuméricos.';
  }

  if (!type.trim()) return 'Selecciona el tipo de identificación.';
  return normalizedIdentification ? null : 'La identificación es obligatoria.';
}

export function validateDocumentClientFields(form: Pick<NuevaFacturaFormState, 'clienteBusqueda' | 'tipoIdentificacion' | 'numeroIdentificacion' | 'tipoCliente' | 'obligadoContabilidad' | 'direccion'>, cliente: Cliente) {
  const name = form.clienteBusqueda.trim() || getClienteDisplayName(cliente).trim();
  if (!name) return 'El nombre o razón social del cliente es obligatorio.';

  const identificationType = form.tipoIdentificacion.trim() || getTipoIdentificacionLabel(cliente.tipoidentificacion);
  const identification = form.numeroIdentificacion.trim() || getClienteIdentification(cliente).trim();
  const identificationError = validateClientIdentification(identificationType, undefined, identification);
  if (identificationError) return identificationError;

  if (!(Number(form.tipoCliente) || cliente.tipoCliente || 0)) return 'Selecciona el tipo de cliente.';

  const obliged = (form.obligadoContabilidad.trim() || cliente.oblgconta?.trim() || '').toUpperCase();
  if (obliged !== 'SI' && obliged !== 'NO') return 'Indica si el cliente está obligado a llevar contabilidad.';

  const address = form.direccion.trim() || cliente.direccion?.trim() || '';
  if (!address) return 'Ingresa la dirección del cliente antes de emitir.';
  if (address.length > 100) return 'La dirección del cliente no puede superar 100 caracteres.';

  return null;
}

export function getTipoIdentificacionCode(value?: string | number | null) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
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

export function decodeXmlValue(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

export function xmlTag(source: string, tag: string) {
  const match = source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlValue(match[1]) : '';
}

export function xmlSections(source: string, tag: string) {
  return Array.from(source.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))).map((match) => match[1]);
}

export function numberFromXml(value: string) {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseFacturaXml(xml: string) {
  const estab = xmlTag(xml, 'estab');
  const ptoEmi = xmlTag(xml, 'ptoEmi');
  const secuencial = xmlTag(xml, 'secuencial');
  const numeroCompleto = [estab, ptoEmi, secuencial].filter(Boolean).join('-');
  const razonSocial = xmlTag(xml, 'razonSocialComprador');
  const identificacion = xmlTag(xml, 'identificacionComprador');
  if (!razonSocial && !identificacion && !numeroCompleto) return null;

  const cliente: Cliente = {
    codcliente: 0,
    tipoidentificacion: getTipoIdentificacionLabel(xmlTag(xml, 'tipoIdentificacionComprador')) || null,
    numeroidentificacion: identificacion || null,
    nombrerazonsocial: razonSocial || null,
    nombrecomercial: razonSocial || null,
    direccion: xmlTag(xml, 'direccionComprador') || null,
    correo: xmlTag(xml, 'email') || xmlTag(xml, 'correo') || null,
    oblgconta: '',
  } as Cliente;
  const factura: FacturaListItem = {
    codfactura: 0,
    numfactura: secuencial || numeroCompleto || null,
    numeroCompleto: numeroCompleto || secuencial || null,
    serie: [estab, ptoEmi].filter(Boolean).join('-') || null,
    fechaEmision: xmlTag(xml, 'fechaEmision') || null,
    total: numberFromXml(xmlTag(xml, 'importeTotal') || xmlTag(xml, 'valorModificacion')),
    cliente: razonSocial || null,
    identificacionCliente: identificacion || null,
    autorizado: true,
  };
  const detalles = xmlSections(xml, 'detalle')
    .filter((section) => xmlTag(section, 'descripcion'))
    .map((section, index) => {
      const precio = numberFromXml(xmlTag(section, 'precioUnitario'));
      const tarifa = numberFromXml(xmlTag(section, 'tarifa'));
      const producto: FacturaProducto = {
        codproducto: 0,
        codprincipal: xmlTag(section, 'codigoPrincipal') || `XML-${index + 1}`,
        codauxiliar: xmlTag(section, 'codigoAuxiliar') || null,
        descripcion: xmlTag(section, 'descripcion') || 'Producto XML',
        precioUnitario: precio,
        tarifaIva: tarifa,
      };
      return {
        producto,
        cantidad: String(numberFromXml(xmlTag(section, 'cantidad')) || 1),
        precio: String(precio),
        descuento: String(numberFromXml(xmlTag(section, 'descuento'))),
        tarifa: String(tarifa),
      };
    });

  return { cliente, factura, detalles };
}

export function getProductoDetailValues(producto: Producto) {
  return [
    `Tipo: ${producto.tipo === 'SERVICIO' ? 'Servicio' : 'Producto'}`,
    `Codigo: ${producto.codigo || 'Sin codigo'}`,
    `Precio base: ${formatMoney(producto.precioBase)}`,
    `IVA: ${producto.iva ? 'Si' : 'No'}`,
    `Tarifa: ${producto.tarifaDescripcion ?? producto.tarifa ?? 'Sin tarifa'}`,
    `Categoria: ${producto.categoriaDescripcion || 'Sin categoria'}`,
    `Subcategoria: ${producto.subcategoriaDescripcion || 'Sin subcategoria'}`,
    `Estado: ${producto.estado === false ? 'Inactivo' : 'Activo'}`,
    producto.observacion ? `Observacion: ${producto.observacion}` : '',
  ].filter(Boolean);
}

export function getEmisorDetailValues(emisor: Emisor) {
  return [
    `RUC: ${emisor.ruc || 'Sin RUC'}`,
    `Nombre comercial: ${emisor.nomComercial || 'Sin nombre comercial'}`,
    `Correo: ${emisor.email || 'Sin correo'}`,
    `Telefono: ${emisor.telefono || 'Sin telefono'}`,
    `Direccion establecimiento: ${emisor.dirEstablecimiento || 'Sin direccion'}`,
    `Direccion matriz: ${emisor.direccionMatriz || 'Sin direccion'}`,
    `Lleva contabilidad: ${emisor.llevaContabilidad || 'NO'}`,
    `Retenciones: ${emisor.retenciones || 'NO'}`,
    `Estado: ${emisor.estado === false ? 'Inactivo' : 'Activo'}`,
  ];
}

export function getFirmaDetailValues(emisor: Emisor, estado?: FirmaEstado) {
  return [
    `Emisor: ${emisor.razonSocial || emisor.nomComercial || 'Sin emisor'}`,
    `RUC: ${emisor.ruc || 'Sin RUC'}`,
    `Archivo: ${getFirmaFileName(emisor.pathCertificado) || 'Sin archivo'}`,
    `Estado: ${estado?.esValida ? 'Vigente' : estado ? 'No valida' : hasFirmaConfigured(emisor) ? 'Configurada' : 'Pendiente'}`,
    estado?.diasRestantes !== null && estado?.diasRestantes !== undefined ? `Dias restantes: ${estado.diasRestantes}` : '',
    estado?.fechaExpiracion ? `Expira: ${formatDocumentDate(estado.fechaExpiracion)}` : '',
    estado?.nombreTitular ? `Titular: ${estado.nombreTitular}` : '',
    estado?.identificacion ? `Identificacion: ${estado.identificacion}` : '',
  ].filter(Boolean);
}
