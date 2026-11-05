import { useEffect, useState } from 'react';
import { FacturaPreparacion } from '../services/facturasMobileService';
import { PuntoEmision, PuntosEmisionData } from '../types/business';

export type DocumentSeriesKind = 'factura' | 'notaCredito' | 'notaDebito' | 'liquidacion' | 'guia' | 'retencion';

type FacturaSerieOption = NonNullable<FacturaPreparacion['series']>[number];
type DocumentSerieOption = FacturaSerieOption & {
  esPrincipal?: boolean;
  sequenceInitialized?: boolean | null;
  previousSequence?: string | null;
};

function numberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function sequenceCandidate(item?: Record<string, unknown> | null) {
  if (!item) return 0;
  const value = numberValue(item.siguiente ?? item.proximo ?? item.secuencial ?? item.numeroSecuencia ?? item.previousSequence);
  return value > 0 ? value : 0;
}

function hasSequenceCandidate(item?: DocumentSerieOption | null) {
  if (!item) return false;
  if (item.sequenceInitialized === false) return false;
  return sequenceCandidate(item as Record<string, unknown>) > 0 || item.sequenceInitialized === true || Boolean(item.previousSequence);
}

function mergeSerieOption(existing: DocumentSerieOption, incoming: DocumentSerieOption): DocumentSerieOption {
  const merged = { ...existing };
  if (!hasSequenceCandidate(existing) && hasSequenceCandidate(incoming)) {
    merged.siguiente = incoming.siguiente;
    merged.proximo = incoming.proximo;
    merged.secuencial = incoming.secuencial;
    merged.numeroSecuencia = incoming.numeroSecuencia;
    merged.previousSequence = incoming.previousSequence;
    if (incoming.sequenceInitialized !== undefined) merged.sequenceInitialized = incoming.sequenceInitialized;
  }
  if (merged.sequenceInitialized === undefined && incoming.sequenceInitialized !== undefined) merged.sequenceInitialized = incoming.sequenceInitialized;
  if (!merged.codemisor && incoming.codemisor) merged.codemisor = incoming.codemisor;
  if (!merged.numCaja && incoming.numCaja) merged.numCaja = incoming.numCaja;
  merged.esPrincipal = Boolean(existing.esPrincipal || incoming.esPrincipal);
  return merged;
}

export function normalizeSerieCode(value?: string | number | null) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? digits.padStart(3, '0').slice(-3) : '';
}

export function normalizeSerieDisplay(value?: string | number | null) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.includes('-')) {
    const [establecimiento, punto] = text.split('-');
    return `${normalizeSerieCode(establecimiento)}-${normalizeSerieCode(punto)}`;
  }
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 6) return `${normalizeSerieCode(digits.slice(0, 3))}-${normalizeSerieCode(digits.slice(3, 6))}`;
  return text;
}

export function getPuntoSerie(punto: PuntoEmision) {
  if (punto.establecimiento && punto.puntoEmision) return `${normalizeSerieCode(punto.establecimiento)}-${normalizeSerieCode(punto.puntoEmision)}`;
  const serie = punto.serieFactura ?? punto.serieNotasCred ?? punto.serieGuia ?? '';
  if (serie.includes('-')) return serie;
  return normalizeSerieCode(punto.puntoEmision ?? punto.numCaja);
}

function getPuntoSequenceValue(punto: PuntoEmision, keys: string[]) {
  const row = punto as PuntoEmision & Record<string, unknown>;
  const value = keys.map((key) => row[key]).find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim());
  if (value === undefined) return '-';
  const numeric = numberValue(value);
  return numeric > 0 ? String(numeric).padStart(9, '0') : String(value);
}

export function getPuntoDocumentSequences(punto: PuntoEmision) {
  const serie = getPuntoSerie(punto) || 'Sin serie';
  return [
    { label: 'Factura', serie: punto.serieFactura || serie, secuencia: getPuntoSequenceForDocument(punto, 'factura') },
    { label: 'Nota credito', serie: punto.serieNotasCred || serie, secuencia: getPuntoSequenceForDocument(punto, 'notaCredito') },
    { label: 'Nota debito', serie: punto.serieNotasDeb || serie, secuencia: getPuntoSequenceForDocument(punto, 'notaDebito') },
    { label: 'Guia', serie: punto.serieGuia || serie, secuencia: getPuntoSequenceForDocument(punto, 'guia') },
    { label: 'Retencion', serie: punto.serieLiquidacion || punto.serieLiquidacionCompra || punto.serieRetencion || serie, secuencia: punto.secuenciaRetencionInicializada === false ? '-' : getPuntoSequenceValue(punto, ['secRetencion', 'secuencialRetencion', 'secuenciaRetencion', 'siguienteRetencion', 'proximoRetencion', 'numRetencion', 'numeroRetencion']) },
    { label: 'Liquidacion', serie: punto.serieLiquidacion || punto.serieLiquidacionCompra || serie, secuencia: getPuntoSequenceForDocument(punto, 'liquidacion') },
  ];
}

export function getSerieValue(item?: DocumentSerieOption) {
  const row = item as (DocumentSerieOption & Record<string, unknown>) | undefined;
  return String(
    item?.serieRaw ??
      item?.serieVisual ??
      row?.serie ??
      row?.Serie ??
      row?.serieFactura ??
      row?.SerieFactura ??
      '',
  );
}

function getSelectedSerie(preparacion: FacturaPreparacion | null, serie: string) {
  const options = preparacion?.series ?? [];
  const normalized = normalizeSerieDisplay(serie);
  return options.find((item) => normalizeSerieDisplay(item.serieRaw) === normalized || normalizeSerieDisplay(item.serieVisual) === normalized);
}

export function getSerieLabel(preparacion: FacturaPreparacion | null, serie: string, fallback = '001-001') {
  const selected = getSelectedSerie(preparacion, serie);
  return selected?.serieVisual || selected?.serieRaw || serie || preparacion?.caja?.serieFactura || fallback;
}

export function getNextSequence(preparacion: FacturaPreparacion | null, serie: string, fallbackStart = 0) {
  const selected = getSelectedSerie(preparacion, serie);
  const row = selected as Record<string, unknown> | undefined;
  const caja = preparacion?.caja as Record<string, unknown> | null | undefined;
  const candidate = numberValue(
    row?.siguiente ??
      row?.proximo ??
      row?.secuencial ??
      row?.numeroSecuencia ??
      caja?.siguiente ??
      caja?.proximo ??
      caja?.secuencial ??
      caja?.numeroSecuencia,
  );
  const next = candidate > 0 ? candidate + (row?.siguiente || row?.proximo || caja?.siguiente || caja?.proximo ? 0 : 1) : fallbackStart + 1;
  return String(next).padStart(9, '0');
}

function getSerieCodemisor(preparacion: FacturaPreparacion | null, serie: string) {
  return getActiveEmisorCode(preparacion)
    ?? getSelectedSerie(preparacion, serie)?.codemisor
    ?? preparacion?.caja?.codemisor;
}

function getActiveEmisorCode(preparacion: FacturaPreparacion | null) {
  const emisor = preparacion?.emisores?.find((item) => Number(item.codemisor ?? item.codigo) > 0);
  const codigo = Number(emisor?.codemisor ?? emisor?.codigo ?? 0);
  return codigo > 0 ? codigo : null;
}

export function getSerieCodemisorFromOptions(options: DocumentSerieOption[], serie: string, preparacion: FacturaPreparacion | null) {
  const selected = getSelectedDocumentSerieOption(options, serie);
  return getActiveEmisorCode(preparacion) ?? selected?.codemisor ?? getSerieCodemisor(preparacion, serie);
}

function getPuntoSerieForDocument(punto: PuntoEmision, kind: DocumentSeriesKind) {
  const row = punto as PuntoEmision & Record<string, unknown>;
  const byKind =
    kind === 'notaCredito' ? punto.serieNotasCred ?? row.serieNotaCredito :
    kind === 'notaDebito' ? punto.serieNotasDeb ?? row.serieNotaDebito :
    kind === 'liquidacion' ? punto.serieLiquidacion ?? punto.serieLiquidacionCompra ?? row.serieLiquidacionCompra :
    kind === 'guia' ? punto.serieGuia :
    kind === 'retencion' ? punto.serieLiquidacion ?? punto.serieLiquidacionCompra ?? punto.serieRetencion :
    punto.serieFactura;
  return String(byKind || getPuntoSerie(punto) || '');
}

function getPuntoSequenceInitialized(punto: PuntoEmision, kind: DocumentSeriesKind) {
  if (kind === 'notaCredito') return punto.secuenciaNotaCreditoInicializada;
  if (kind === 'notaDebito') return punto.secuenciaNotaDebitoInicializada;
  if (kind === 'liquidacion') return punto.secuenciaLiquidacionInicializada;
  if (kind === 'guia') return punto.secuenciaGuiaInicializada;
  if (kind === 'retencion') return punto.secuenciaRetencionInicializada;
  return punto.secuenciaFacturaInicializada;
}

function getPuntoSequenceForDocument(punto: PuntoEmision, kind: DocumentSeriesKind) {
  const initialized = getPuntoSequenceInitialized(punto, kind);
  if (initialized === false) return '-';

  if (kind === 'notaCredito') return getPuntoSequenceValue(punto, ['secNotaCredito', 'secuencialNotaCredito', 'secuenciaNotaCredito', 'siguienteNotaCredito', 'proximoNotaCredito', 'secNC', 'numNotaCredito', 'numeroNotaCredito']);
  if (kind === 'notaDebito') return getPuntoSequenceValue(punto, ['secNotaDebito', 'secuencialNotaDebito', 'secuenciaNotaDebito', 'siguienteNotaDebito', 'proximoNotaDebito', 'secND', 'numNotaDebito', 'numeroNotaDebito']);
  if (kind === 'liquidacion') return getPuntoSequenceValue(punto, ['secLiquidacion', 'secuencialLiquidacion', 'secuenciaLiquidacion', 'siguienteLiquidacion', 'proximoLiquidacion', 'secLiquidacionCompra', 'numLiquidacion', 'numeroLiquidacion']);
  if (kind === 'guia') return getPuntoSequenceValue(punto, ['secGuia', 'secuencialGuia', 'secuenciaGuia', 'siguienteGuia', 'proximoGuia', 'numGuia', 'numeroGuia']);
  if (kind === 'retencion') return getPuntoSequenceValue(punto, ['secRetencion', 'secuencialRetencion', 'secuenciaRetencion', 'siguienteRetencion', 'proximoRetencion', 'numRetencion', 'numeroRetencion']);
  return getPuntoSequenceValue(punto, ['secFactura', 'secuencialFactura', 'secuenciaFactura', 'siguienteFactura', 'proximoFactura', 'numFactura', 'numeroFactura']);
}

function compareDocumentSerieOptions(a: DocumentSerieOption, b: DocumentSerieOption) {
  const initialized = Number(hasSequenceCandidate(b)) - Number(hasSequenceCandidate(a));
  if (initialized !== 0) return initialized;

  const principal = Number(Boolean(b.esPrincipal)) - Number(Boolean(a.esPrincipal));
  if (principal !== 0) return principal;

  const caja = Number(a.numCaja ?? 0) - Number(b.numCaja ?? 0);
  if (caja !== 0) return caja;

  const aSequence = sequenceCandidate(a as Record<string, unknown>);
  const bSequence = sequenceCandidate(b as Record<string, unknown>);
  return bSequence - aSequence;
}

export function getSelectedDocumentSerieOption(options: DocumentSerieOption[], serie: string) {
  const normalized = normalizeSerieDisplay(serie);
  return options.find((item) => normalizeSerieDisplay(item.serieRaw) === normalized || normalizeSerieDisplay(item.serieVisual) === normalized);
}

export function getEffectiveDocumentSerie(options: DocumentSerieOption[], serie: string) {
  const selected = getSelectedDocumentSerieOption(options, serie);
  return getSerieValue(selected ?? options[0]);
}

export function serieNeedsInitialSequence(options: DocumentSerieOption[], serie: string) {
  const selected = getSelectedDocumentSerieOption(options, serie);
  if (!selected) return false;
  return selected.sequenceInitialized === false;
}

export function getDocumentSerieOptions(preparacion: FacturaPreparacion | null, puntosData: PuntosEmisionData | null, kind: DocumentSeriesKind) {
  const orderedPuntos = [...(puntosData?.cajas ?? [])].sort((a, b) => Number(a.numCaja ?? 0) - Number(b.numCaja ?? 0));
  const puntos = orderedPuntos
    .map((punto) => {
      const row = punto as PuntoEmision & Record<string, unknown>;
      const serie = normalizeSerieDisplay(getPuntoSerieForDocument(punto, kind));
      if (!serie) return null;
      const secuencia = getPuntoSequenceForDocument(punto, kind);
      const initialized = getPuntoSequenceInitialized(punto, kind);
      return {
        serieRaw: serie,
        serieVisual: serie,
        codemisor: numberValue(row.codemisor ?? row.codEmisor ?? row.codigoEmisor ?? preparacion?.caja?.codemisor) || null,
        sec: secuencia === '-' ? null : numberValue(secuencia),
        proximo: secuencia === '-' ? null : secuencia,
        numCaja: punto.numCaja,
        esPrincipal: punto.esPrincipal,
        sequenceInitialized: initialized ?? secuencia !== '-',
        previousSequence: null,
      } as DocumentSerieOption;
    })
    .filter(Boolean) as DocumentSerieOption[];

  const prepared = (preparacion?.series ?? []).map((item, index) => {
    const value = normalizeSerieDisplay(getSerieValue(item));
    if (value && !value.toLowerCase().startsWith('serie ')) return { ...item, serieRaw: value, serieVisual: value };
    return puntos.length > 0 ? null : item;
  }).filter((item): item is DocumentSerieOption => Boolean(item));
  const source = puntos.length > 0 ? [...puntos, ...prepared] : prepared;
  const unique = new Map<string, DocumentSerieOption>();
  source.forEach((item) => {
    const key = normalizeSerieDisplay(getSerieValue(item));
    if (!key) return;
    const normalized = { ...item, serieRaw: key, serieVisual: key };
    const existing = unique.get(key);
    unique.set(key, existing ? mergeSerieOption(existing, normalized) : normalized);
  });

  return Array.from(unique.values()).sort(compareDocumentSerieOptions);
}

export function usePreferredDocumentSerie(serieOptions: DocumentSerieOption[], currentSerie: string, onSelectSerie: (serie: string) => void) {
  const [appliedKey, setAppliedKey] = useState('');

  useEffect(() => {
    const preferredOption = serieOptions[0];
    const preferred = getSerieValue(preferredOption);
    if (!preferred) return;
    const key = `${preferred}:${sequenceCandidate(preferredOption as Record<string, unknown>)}:${preferredOption?.esPrincipal ? 'principal' : 'fallback'}`;
    if (appliedKey === key) return;
    const hasCurrentSerie = Boolean(getSelectedDocumentSerieOption(serieOptions, currentSerie));
    if (!currentSerie || !hasCurrentSerie || getSerieValue(getSelectedDocumentSerieOption(serieOptions, currentSerie)) !== preferred) onSelectSerie(preferred);
    setAppliedKey(key);
  }, [appliedKey, currentSerie, serieOptions]);
}

export function getSerieLabelFromOptions(options: DocumentSerieOption[], serie: string, fallback: string) {
  const selected = getSelectedDocumentSerieOption(options, serie);
  return selected?.serieVisual || selected?.serieRaw || serie || fallback;
}

export function getNextSequenceFromOptions(options: DocumentSerieOption[], serie: string, fallback: string) {
  const selected = getSelectedDocumentSerieOption(options, serie);
  const row = selected as (DocumentSerieOption & Record<string, unknown>) | undefined;
  const candidate = sequenceCandidate(row);
  if (selected && candidate <= 0) return '';
  if (candidate <= 0) return fallback;
  const alreadyNext = row?.siguiente || row?.proximo;
  return String(alreadyNext ? candidate : candidate + 1).padStart(9, '0');
}
