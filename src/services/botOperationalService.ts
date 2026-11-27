import type { BotCatalogList } from '../types/bot';
import { formatInvoiceDateKey, getInvoiceDateKey } from '../utils/botInvoiceDate';
import type { OperationalReadContext, OperationalReadModule, OperationalReadQuery, OperationalReadTurn } from '../utils/botOperationalRead';
import { apiRequest } from './apiClient';

const path = '/api/asistente-facturacion/consultas-operativas';
const pageSize = 30;
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
type OperationalRow = { nombre?: string; detalle?: string; estado?: string; fecha?: string; valor?: number; iva?: number };
type OperationalPage = { items: OperationalRow[]; total: number; siguiente?: number; importe?: number };

export const operationalLabels: Record<OperationalReadModule, string> = {
  clientes: 'clientes',
  proveedores: 'proveedores',
  productos: 'productos y servicios',
  categorias: 'categorías',
  subcategorias: 'subcategorías',
  compras: 'documentos de compra',
  cartera: 'cuentas por cobrar',
  'estado-cuenta': 'estado de cuenta',
  reportes: 'comprobantes del reporte',
  facturas: 'facturas',
  'notas-credito': 'notas de crédito',
  'notas-debito': 'notas de débito',
  'guias-remision': 'guías de remisión',
  retenciones: 'retenciones',
  'liquidaciones-compra': 'liquidaciones de compra',
};

export function getOperationalReadModule(turn: OperationalReadTurn | null, current?: OperationalReadContext) {
  if (typeof turn === 'object' && turn) return 'interpretar' in turn ? turn.interpretar : turn.modulo;
  return turn === 'next' || turn === 'previous' ? current?.query.modulo : undefined;
}

async function requestPage(query: OperationalReadQuery, inicio: number, signal: AbortSignal) {
  const params = new URLSearchParams({ modulo: query.modulo, inicio: String(inicio) });
  if (query.termino) params.set('termino', query.termino);
  if (query.estado) params.set('estado', query.estado);
  if (query.tipo) params.set('tipo', query.tipo);
  if (query.desde) params.set('desde', query.desde);
  if (query.hasta) params.set('hasta', query.hasta);
  if (query.iva !== undefined) params.set('iva', String(query.iva));
  if (query.resumen) params.set('resumen', 'true');
  if (query.reciente) params.set('reciente', 'true');
  const result = await apiRequest<OperationalPage>(`${path}?${params}`, { signal, suppressErrorLog: true });
  if (!result || !Array.isArray(result.items) || !Number.isSafeInteger(result.total) ||
      (result.siguiente != null && (!Number.isSafeInteger(result.siguiente) || result.siguiente <= inicio))) {
    throw new Error('Respuesta inválida de la consulta.');
  }
  return result;
}

export async function resolveOperationalRead(turn: OperationalReadTurn, message: string, mode: 'texto' | 'voz',
  current: OperationalReadContext | undefined, signal: AbortSignal): Promise<{
    answer: string; context?: OperationalReadContext; list?: BotCatalogList;
  }> {
  const clarify = 'Puedo buscar por nombre, código, fecha o estado, según el módulo. Indícame qué quieres consultar.';
  if (turn === 'clarify') return { answer: clarify, context: current };
  const isPaging = turn === 'next' || turn === 'previous';
  if (isPaging && (!current || (turn === 'next' ? current.siguiente == null : current.inicio === 0))) {
    return { context: current, answer: turn === 'next' ? 'Ya estás en la última página.' : 'Ya estás en la primera página.' };
  }

  let query: OperationalReadQuery;
  let inicio = 0;
  if (typeof turn === 'string') {
    if (!current) return { answer: clarify };
    query = current.query;
    inicio = turn === 'next' ? current.siguiente! : Math.max(0, current.inicio - pageSize);
  } else if ('interpretar' in turn) {
    const result = await apiRequest<(Omit<OperationalReadQuery, 'modulo'> & { aplica: boolean }) | null>(`${path}/interpretar`, {
      method: 'POST', body: JSON.stringify({ modulo: turn.interpretar, mensaje: message, modo: mode }),
      timeoutMs: 20000, signal, suppressErrorLog: true,
    });
    if (!result?.aplica) return { answer: clarify, context: current };
    query = { ...result, modulo: turn.interpretar, iva: result.iva ?? undefined };
  } else {
    query = turn;
  }

  const page = await requestPage(query, inicio, signal);
  const context = { query, inicio, siguiente: page.siguiente ?? undefined };
  const label = operationalLabels[query.modulo];
  if (!page.total) return { context, answer: `No encontré resultados en ${label} con esos filtros.` };
  const rows = page.items.map((row) => {
    const date = getInvoiceDateKey(row.fecha);
    return {
      name: row.nombre?.trim() || 'Sin nombre',
      detail: [row.detalle, date && formatInvoiceDateKey(date), row.estado,
        typeof row.valor === 'number' && money.format(row.valor),
        typeof row.iva === 'number' && `IVA ${row.iva} %`].filter(Boolean).join(' · '),
    };
  });
  const count = `${page.total} ${page.total === 1 ? 'resultado' : 'resultados'}`;
  const amount = typeof page.importe === 'number'
    ? ` El ${query.modulo === 'cartera' || query.modulo === 'estado-cuenta' ? 'saldo' : 'importe'} total de las coincidencias es ${money.format(page.importe)}.`
    : '';
  return {
    context: query.resumen ? undefined : context,
    answer: `Encontré ${count} en ${label}.${amount}`,
    list: rows.length ? { kind: query.modulo, rows, inicio, siguiente: context.siguiente } : undefined,
  };
}
