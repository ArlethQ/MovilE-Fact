import { ApiError, apiRequest } from './apiClient';
import { PuntoEmision, PuntosEmisionData } from '../types/business';

export type PuntoDocumentoKey = 'factura' | 'nota-credito' | 'nota-debito' | 'liquidacion-compra' | 'guia-remision' | 'retencion';

type PuntoSecuencialResponse = {
  documento: string;
  serie: string;
  inicializada: boolean;
  secuenciaAnterior?: string | null;
  proximo?: string | null;
  requiereConfiguracionInicial?: boolean;
};

export async function getPuntosEmision(userId: number) {
  const data = await apiRequest<PuntosEmisionData>(`/api/cajas?idUsuario=${userId}`);
  return enrichPuntosEmisionSequences(userId, data);
}

export async function getPuntoEmisionSiguienteSecuencial(userId: number, documento: PuntoDocumentoKey, serie: string, codemisor?: number | null) {
  const params = new URLSearchParams({
    idUsuario: String(userId),
    documento,
    serie,
  });
  if (codemisor) params.set('codEmisor', String(codemisor));

  const notaResponse = await getNotaDedicatedSiguienteSecuencial(userId, documento, serie);
  if (notaResponse) return notaResponse;

  try {
    const response = await apiRequest<PuntoSecuencialResponse>(`/api/cajas/siguiente-secuencial?${params.toString()}`);
    return {
      ...response,
      requiereConfiguracionInicial: response.inicializada === false,
    };
  } catch (error) {
    if (!isFallbackStatus(error)) throw error;
    return getLegacySiguienteSecuencial(userId, documento, serie, codemisor);
  }
}

async function getNotaDedicatedSiguienteSecuencial(userId: number, documento: PuntoDocumentoKey, serie: string) {
  if (documento !== 'nota-credito' && documento !== 'nota-debito') return null;

  const rawSerie = serie.replace(/\D/g, '');
  const path = documento === 'nota-credito'
    ? `/api/facturas/nc/next-secuencial?idUsuario=${userId}&serie=${encodeURIComponent(rawSerie || serie)}`
    : `/api/facturas/nd/next-secuencial?idUsuario=${userId}&serie=${encodeURIComponent(rawSerie || serie)}`;

  try {
    const response = await apiRequest<{ proximo?: string | number | null }>(path, { suppressErrorLog: true });
    const proximo = normalizeSequence(response.proximo);
    if (!proximo) return null;

    return {
      documento,
      serie,
      inicializada: true,
      secuenciaAnterior: null,
      proximo,
      requiereConfiguracionInicial: false,
    };
  } catch (error) {
    if (!isFallbackStatus(error)) throw error;
    return null;
  }
}

async function getLegacySiguienteSecuencial(userId: number, documento: PuntoDocumentoKey, serie: string, codemisor?: number | null) {
  const rawSerie = serie.replace(/\D/g, '');
  const common = new URLSearchParams({ idUsuario: String(userId), serie: rawSerie || serie });
  if (codemisor) common.set('codEmisor', String(codemisor));

  const paths = legacySequencePaths(documento, common);
  for (const path of paths) {
    try {
      const response = await apiRequest<unknown>(path);
      const direct = response as { proximo?: string | number | null; siguiente?: string | number | null };
      const proximo = normalizeSequence(direct.proximo ?? direct.siguiente) || getNextSequenceFromLegacyRows(response, serie);
      const hasInitializedSequence = Boolean(proximo);
      return {
        documento,
        serie,
        inicializada: hasInitializedSequence,
        secuenciaAnterior: null,
        proximo: hasInitializedSequence ? proximo : null,
        requiereConfiguracionInicial: !hasInitializedSequence,
      };
    } catch (error) {
      if (!isFallbackStatus(error)) throw error;
    }
  }

  return {
    documento,
    serie,
    inicializada: false,
    secuenciaAnterior: null,
    proximo: null,
    requiereConfiguracionInicial: true,
  };
}

function legacySequencePaths(documento: PuntoDocumentoKey, params: URLSearchParams) {
  const query = params.toString();
  if (documento === 'factura') return [`/api/facturas/siguiente-secuencial?${query}`];
  if (documento === 'liquidacion-compra') {
    return [
      `/api/liquidaciones-compra?${query}&top=0`,
      `/api/liquidacion-compra?${query}&top=0`,
      `/api/compras/liquidaciones?${query}&top=0`,
    ];
  }
  if (documento === 'guia-remision') {
    return [
      `/api/guias-remision?${query}&top=0`,
      `/api/guia-remision?${query}&top=0`,
      `/api/guiasremision?${query}&top=0`,
    ];
  }
  if (documento === 'retencion') return [`/api/retenciones?${query}`];
  return [];
}

async function enrichPuntosEmisionSequences(userId: number, data: PuntosEmisionData) {
  if (!data?.cajas?.length) return data;

  const cajas = await Promise.all(data.cajas.map(async (punto) => {
    const enriched: PuntoEmision = { ...punto };
    const documents: { key: PuntoDocumentoKey; serie?: string | null; secKey: keyof PuntoEmision; initializedKey: keyof PuntoEmision }[] = [
      { key: 'factura', serie: punto.serieFactura, secKey: 'secFactura', initializedKey: 'secuenciaFacturaInicializada' },
      { key: 'nota-credito', serie: punto.serieNotasCred, secKey: 'secNotaCredito', initializedKey: 'secuenciaNotaCreditoInicializada' },
      { key: 'nota-debito', serie: punto.serieNotasDeb, secKey: 'secNotaDebito', initializedKey: 'secuenciaNotaDebitoInicializada' },
      { key: 'guia-remision', serie: punto.serieGuia, secKey: 'secGuia', initializedKey: 'secuenciaGuiaInicializada' },
      { key: 'liquidacion-compra', serie: punto.serieLiquidacion ?? punto.serieLiquidacionCompra, secKey: 'secLiquidacion', initializedKey: 'secuenciaLiquidacionInicializada' },
      { key: 'retencion', serie: punto.serieLiquidacion ?? punto.serieLiquidacionCompra ?? punto.serieRetencion, secKey: 'secRetencion', initializedKey: 'secuenciaRetencionInicializada' },
    ];

    await Promise.all(documents.map(async (item) => {
      if (hasRealSequence(enriched[item.secKey]) || !item.serie) return;
      if (enriched[item.initializedKey] === false) return;
      try {
        const response = await getPuntoEmisionSiguienteSecuencial(userId, item.key, item.serie, data.emisor?.codigo ?? null);
        const proximo = normalizeSequence(response.proximo);
        if (response.inicializada && proximo) {
          (enriched as Record<string, unknown>)[item.secKey] = proximo;
          (enriched as Record<string, unknown>)[item.initializedKey] = true;
        } else if (response.requiereConfiguracionInicial) {
          (enriched as Record<string, unknown>)[item.initializedKey] = false;
        }
      } catch {
        (enriched as Record<string, unknown>)[item.initializedKey] = undefined;
      }
    }));

    return enriched;
  }));

  return { ...data, cajas };
}

function hasRealSequence(value: unknown) {
  return Boolean(normalizeSequence(value));
}

function normalizeSequence(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits || Number(digits) <= 0) return '';
  return digits.padStart(9, '0').slice(-9);
}

function getNextSequenceFromLegacyRows(response: unknown, serie: string) {
  const rows = normalizeRows(response);
  if (!rows.length) return '';

  const serieDigits = serie.replace(/\D/g, '');
  let max = 0;
  rows.forEach((row) => {
    const rowSerie = String(row.serie ?? row.Serie ?? row.serieVisual ?? row.SerieVisual ?? row.numeroCompleto ?? row.numero ?? '').replace(/\D/g, '').slice(0, 6);
    if (serieDigits && rowSerie && rowSerie !== serieDigits) return;

    const rawNumber = row.secuencial ?? row.Secuencial ?? row.numFactura ?? row.NumFactura ?? row.numeroFactura ?? row.NumeroFactura ?? row.numfactura ?? row.Numfactura ?? row.numRetencion ?? row.NumRetencion ?? row.numeroRetencion ?? row.NumeroRetencion ?? row.numero ?? row.Numero ?? row.numeroCompleto ?? row.NumeroCompleto;
    const sequence = extractSequence(rawNumber);
    if (sequence > max) max = sequence;
  });

  return max > 0 ? String(max + 1).padStart(9, '0') : '';
}

function normalizeRows(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  const candidates = [response.data, response.items, response.resultados, response.retenciones, response.Retenciones, response.liquidaciones, response.guias, response.notas, response.facturas];
  const rows = candidates.find(Array.isArray);
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function extractSequence(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const sequence = digits.length > 9 ? digits.slice(-9) : digits;
  const parsed = Number(sequence);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFallbackStatus(error: unknown) {
  return error instanceof ApiError && [0, 404, 405].includes(error.status);
}

export function savePuntoEmisionSecuenciaInicial(input: {
  userId: number;
  documento: PuntoDocumentoKey;
  serie: string;
  codemisor?: number | null;
  habiaGenerado: boolean;
  secuenciaAnterior?: string | null;
}) {
  return apiRequest<{
    documento: string;
    serie: string;
    inicializada: boolean;
    secuenciaAnterior?: string | null;
    proximo?: string | null;
  }>(`/api/cajas/secuencia-inicial?idUsuario=${input.userId}`, {
    method: 'POST',
    body: JSON.stringify({
      documento: input.documento,
      serie: input.serie,
      codEmisor: input.codemisor,
      habiaGenerado: input.habiaGenerado,
      secuenciaAnterior: input.secuenciaAnterior,
    }),
  });
}

export function createPuntoEmision(userId: number, puntoEmision: string, establecimiento?: string | null) {
  return apiRequest<void>(`/api/cajas?idUsuario=${userId}`, {
    method: 'POST',
    body: JSON.stringify({ puntoEmision, establecimiento }),
  });
}

export function updatePuntoEmision(userId: number, sec: number, puntoEmision: string) {
  return apiRequest<void>(`/api/cajas/${sec}?idUsuario=${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ puntoEmision }),
  });
}

export function markPuntoPrincipal(userId: number, sec: number) {
  return apiRequest<void>(`/api/cajas/${sec}/principal?idUsuario=${userId}`, {
    method: 'PUT',
  });
}

export function deletePuntoEmision(userId: number, sec: number) {
  return apiRequest<void>(`/api/cajas/${sec}?idUsuario=${userId}`, {
    method: 'DELETE',
  });
}
