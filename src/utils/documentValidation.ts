export type FiscalLineInput = {
  quantity?: number;
  price?: number;
  discount?: number;
  iva?: number;
  allowedIva?: readonly number[];
  ice?: number;
  requireIntegerQuantity?: boolean;
};

export function parseDocumentNumber(value: string) {
  return Number(value.trim().replace(',', '.'));
}

export function validateFiscalLine(line: FiscalLineInput) {
  if (line.quantity !== undefined && (!Number.isFinite(line.quantity) || line.quantity <= 0)) {
    return 'La cantidad debe ser mayor que cero.';
  }
  if (line.requireIntegerQuantity && line.quantity !== undefined && !Number.isInteger(line.quantity)) {
    return 'La cantidad debe ser un número entero.';
  }
  if (line.price !== undefined && (!Number.isFinite(line.price) || line.price <= 0)) {
    return 'El precio debe ser mayor que cero.';
  }
  if (line.discount !== undefined && (!Number.isFinite(line.discount) || line.discount < 0)) {
    return 'El descuento no es válido.';
  }
  if (line.price !== undefined && line.quantity !== undefined && line.discount !== undefined && line.discount > line.quantity * line.price) {
    return 'El descuento no puede superar el valor de la línea.';
  }
  if (line.iva !== undefined && (!Number.isFinite(line.iva) || line.iva < 0 || line.iva > 100)) {
    return 'El IVA no es válido.';
  }
  if (line.iva !== undefined && line.allowedIva && !line.allowedIva.includes(line.iva)) {
    return 'La tarifa de IVA no es válida.';
  }
  if (line.ice !== undefined && (!Number.isFinite(line.ice) || line.ice < 0)) {
    return 'El ICE no es válido.';
  }
  return null;
}

export function validatePositiveTotal(total: number, label: string) {
  return Number.isFinite(total) && total > 0 ? null : `El total de ${label} debe ser mayor que cero.`;
}

export function validateDateRange(start: string, end: string) {
  const startTime = Date.parse(`${start}T00:00:00`);
  const endTime = Date.parse(`${end}T00:00:00`);
  if (!start || !end || Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return 'Revisa las fechas de emisión y traslado.';
  }
  return endTime < startTime ? 'La fecha final no puede ser anterior a la fecha inicial.' : null;
}
