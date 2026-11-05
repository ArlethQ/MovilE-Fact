import type { FacturaPreparacion } from '../services/facturasMobileService';

export function getTipoClienteOptions(preparacion: FacturaPreparacion | null) {
  const options = (preparacion?.tiposCliente ?? [])
    .map((item) => ({ label: item.descripcion || `Tipo ${item.codigo}`, value: Number(item.codigo) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  return options.length > 0 ? options : [
    { label: 'Persona Natural', value: 1 },
    { label: 'Persona Jurídica', value: 2 },
  ];
}

export function getIvaOptions(preparacion: FacturaPreparacion | null) {
  const options = (preparacion?.porcentajesIva ?? []).map((item, index) => {
    const raw = item as Record<string, unknown>;
    const rates = [raw.valorCalculo, raw.valor, raw.porcentaje, raw.porcentajeIva, raw.tarifa]
      .map((value) => percentageValue(value))
      .filter((value): value is number => value !== null);
    const rate = rates.find((value) => value > 0) ?? rates.find((value) => value === 0) ?? index;
    return { label: `${rate}%`, value: rate };
  });
  return options.filter((option, index, current) => current.findIndex((item) => item.value === option.value) === index);
}

export function getIvaOptionValue(options: { label: string; value: number }[], rate: number) {
  return options.some((option) => option.value === rate) ? rate : null;
}

function percentageValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed === null ? null : parsed > 0 && parsed <= 1 ? parsed * 100 : parsed;
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
