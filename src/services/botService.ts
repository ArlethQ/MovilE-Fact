import { BOT_CHAT_PATH, BOT_HISTORY_FILE_PREFIX, BOT_SESSION_ID, BOT_SESSION_STORAGE_PREFIX } from '../config/bot';
import { ApiError, apiRequest } from './apiClient';
import { getFacturaPorNumeroCompleto, getFacturas, getFacturasParaNumi, type FacturaListItem } from './facturasMobileService';
import { getInvoiceDateKey, parseBotInvoiceDate } from '../utils/botInvoiceDate';
import type { BotInvoiceConversation, BotInvoiceFilters, BotInvoiceQuery, BotInvoiceTurn } from '../utils/botInvoiceConversation';
import type { BotFeedbackState, BotInvoicePdf, BotMessage, BotProgressStep } from '../types/bot';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { AESEncryptionKey, AESKeySize, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

export type BotUsageTurn = {
  id: string;
  startedAt: string;
  scope: BotSessionScope;
  mode: 'voz' | 'texto';
  completed: boolean;
  calls: Array<{
    startedAt: string;
    model: string;
    httpStatus: number | null;
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    estimatedUsd: number | null;
  }>;
};

export async function getBotUsage(signal: AbortSignal) {
  const turns = await apiRequest<BotUsageTurn[]>('/api/asistente-facturacion/consumo-openai', { signal });
  if (!Array.isArray(turns)) throw new Error('Respuesta inválida de consumo de Númi.');
  return turns;
}

type BotInvoiceDateRequest = { date: string; listOnly: boolean; latest: boolean };
export type BotInvoicePdfRequest = 'latest' | 'reference' | 'clarify' | 'invalidDate' | { number: string } | BotInvoiceDateRequest;

const fullInvoiceNumber = /\b(\d{3})\s*[-–—]\s*(\d{3})\s*[-–—]\s*(\d{1,9})\b/;

function invoiceNumber(text: string) {
  const full = fullInvoiceNumber.exec(text);
  return full ? `${full[1]}-${full[2]}-${full[3].padStart(9, '0')}` : undefined;
}

export function parseBotInvoicePdfRequest(message: string, awaitingNumber = false): BotInvoicePdfRequest | null {
  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[¿¡!?,:#]|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim().replace(/\bp d f\b/g, 'pdf');
  if (/^(?:numi )?no (?:me |quiero |necesito |debes? )/.test(text)) return null;
  if (awaitingNumber && /^(?:la )?(?:ultima|mas reciente)(?: factura)?(?: por favor)?$/.test(text)) return 'latest';
  if (awaitingNumber && /^(?:(?:la )?factura |(?:es la |numero ))?(?:\d{1,9}|\d{3}\s*[-–—]\s*\d{3}\s*[-–—]\s*\d{1,9})(?: por favor)?$/.test(text)) {
    const number = invoiceNumber(text) ?? /\b\d{1,9}\b/.exec(text)?.[0];
    if (number) return { number };
  }
  if (awaitingNumber && /^(?:(?:del?|el|dia|la fecha|es del) )?(?:\d|hoy\b|ayer\b|anteayer\b)/.test(text)) {
    const date = parseBotInvoiceDate(text);
    if (date !== undefined) return date ? { date, listOnly: false, latest: false } : 'invalidDate';
  }

  const query = text
    .replace(/\b(?:genera|generar|generame|generarme|crea|crear|creame|elabora|elaborar|haz|hazme|hacer|prepara|preparar) (?:el |un )?pdf\b/g, 'mostrar pdf')
    .replace(/\bultima de mis facturas\b/g, 'ultima factura de mi cuenta');
  const justIssued = /\b(?:que )?(?:acabas?(?:te)? de|acabo de) (?:emitir|generar|crear|guardar)\b/g;
  if (/\b(?:anula|anular|cancela|cancelar|elimina|eliminar|crea|crear|creame|crearme|emite|emitir|emiteme|genera|generar|generame|generarme|haz|hazme|hacer|prepara|preparar|nota de credito|nota de debito|retencion|guia de remision|cotizacion|proforma|liquidacion)\b/.test(query.replace(justIssued, ''))) return null;
  const hasInvoice = /\b(?:facturas?|ultimo comprobante)\b/.test(query);
  const hasPdf = /\b(?:pdf|visor|previsualizacion|vista previa)\b/.test(query);
  const openAction = /\b(?:abre|abreme|abrelo|abrir|abrirme|muestra|muestras|muestrame|muestramelo|muestramela|mostrar|mostrarme|mostrame|muestres|consulta|consultar|busca|buscar|dame|ver|visualiza|visualizar|ensena|ensename|ensenar|ensenarme|pasame|pasa|enviame|descarga|descargar|quiero|necesito)\b/.test(query);
  const shorthand = /^(?:numi )?(?:(?:el )?pdf\b|(?:la )?(?:ultima|mas reciente) factura\b)/.test(query);
  const date = hasInvoice && !/\b(?:entre|hasta|rango)\b/.test(query) ? parseBotInvoiceDate(query) : undefined;
  if (date !== undefined && !invoiceNumber(query)) {
    if (date === null) return 'invalidDate';
    const qualified = /\b(?:a nombre de|del cliente|para el cliente|de la serie|de la sucursal|pendientes|pagadas|anuladas)\b/.test(query)
      || /\bfacturas? (?:de|del) [a-z]+ /.test(query) && !/\bfacturas? (?:de|del) (?:hoy|ayer|anteayer|dia|la fecha|historial)\b/.test(query);
    const latest = !qualified && /\b(?:ultima|mas reciente)\b/.test(query);
    return { date, listOnly: qualified || (!hasPdf && /\b(?:facturas|lista|listado|cuantas|cuantos)\b/.test(query)), latest };
  }
  if (!hasPdf || (!openAction && !shorthand)) return null;
  if (!hasInvoice && !/\b(?:el pdf(?: de (?:esa|esta|la ultima))?|pdf por favor|(?:abrelo|muestramelo|muestramela) en pdf)\s*$/.test(query)) return null;

  if (/\bborrador\b/.test(query)) return 'clarify';
  const full = invoiceNumber(query);
  if (full) return { number: full };
  const short = /\bfactura\s+(?:(?:numero|nro|no|secuencial|terminada en|que termina en)\s+)?(\d{1,9})(?![\d-])/.exec(query);
  if (short) return { number: short[1] };

  const reference = /\b(?:(?:esta|esa) factura|pdf de (?:esta|esa)|esta conversacion|(?:acabas|acabo) de (?:emitir|generar|crear|guardar)|que (?:emitiste|emiti|generaste|genere|creaste|cree|guardaste|guarde)|(?:emitida|generada) por (?:ti|numi))\b/.test(query);
  if (reference) return 'reference';
  const latest = /\b(?:(?:ultima|mas reciente) factura|factura mas reciente|ultimo comprobante)\b/.test(query);
  if (!latest) return !hasInvoice || /\bfactura (?:generada|emitida|guardada)(?: por favor)?$/.test(query) ? 'reference' : 'clarify';
  const general = query.replace(/\b(?:de mi cuenta|de mis facturas|del historial(?: general)?|de e[- ]fact|de todas(?: las facturas)?|en (?:el historial(?: general)?|mis facturas))\b/g, '');
  return /\b(?:cliente|ayer|hoy|mes|semana|ano|serie|sucursal|entre|hasta|rango)\b|\bfactura(?: (?:generada|emitida|creada|guardada))? (?:de|del|por|para|a nombre de)\b/.test(general)
    ? 'clarify' : 'latest';
}

function toBotInvoicePdf(factura: FacturaListItem): BotInvoicePdf {
  const stored = factura.numfactura?.trim() ?? '';
  const display = factura.numeroCompleto?.trim() ?? '';
  const series = factura.serie?.replace(/\D/g, '') ?? '';
  const number = invoiceNumber(stored) ?? invoiceNumber(display)
    ?? (series.length === 6 && /^\d{1,9}$/.test(stored)
      ? `${series.slice(0, 3)}-${series.slice(3)}-${stored.padStart(9, '0')}`
      : display || stored);
  return { id: factura.codfactura, numeroFactura: number, date: getInvoiceDateKey(factura.fechaEmision), client: factura.cliente ?? undefined, total: factura.total ?? undefined };
}

export async function searchBotInvoicePage(userId: number, filters: BotInvoiceFilters, cursor: number | null,
  limit: number, signal: AbortSignal): Promise<{ rows: BotInvoicePdf[]; next?: number }> {
  const page = await getFacturasParaNumi(filters, cursor, limit, signal);
  if (page) return { rows: page.items.filter((item) => item.codfactura > 0).map(toBotInvoicePdf), next: page.next };

  // Compatibility with servers that have not deployed the bounded search endpoint.
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const client = normalize(filters.cliente ?? '');
  const fullNumber = filters.numero && invoiceNumber(filters.numero);
  const exactDate = filters.desde === filters.hasta ? filters.desde : undefined;
  const singleLatest = cursor === null && limit === 1 && !(filters.desde || filters.hasta || filters.cliente || filters.numero);
  const invoices = await getFacturas(userId, singleLatest ? 1 : 0, signal, exactDate);
  const matches = invoices.filter((item) => {
    if (item.codfactura <= 0 || (cursor !== null && item.codfactura >= cursor)) return false;
    if (client && !normalize(item.cliente ?? '').includes(client) && item.identificacionCliente !== filters.cliente) return false;
    if (filters.numero) {
      const itemNumber = toBotInvoicePdf(item).numeroFactura;
      if (fullNumber ? itemNumber !== fullNumber
        : itemNumber.split('-').at(-1)?.replace(/^0+(?=\d)/, '') !== filters.numero.replace(/^0+(?=\d)/, '')) return false;
    }
    const day = getInvoiceDateKey(item.fechaEmision);
    return (!(filters.desde || filters.hasta) || Boolean(day &&
      (!filters.desde || day >= filters.desde) && (!filters.hasta || day <= filters.hasta)));
  }).slice(0, limit + 1);
  return {
    rows: matches.slice(0, limit).map(toBotInvoicePdf),
    next: matches.length > limit ? matches[limit - 1].codfactura : undefined,
  };
}

export async function interpretBotInvoiceQuery(message: string, mode: 'texto' | 'voz',
  signal: AbortSignal): Promise<BotInvoiceQuery | null> {
  try {
    const result = await apiRequest<BotInvoiceQuery | null>('/api/asistente-facturacion/interpretar-consulta-facturas', {
      method: 'POST', body: JSON.stringify({ mensaje: message, modo: mode }), signal, timeoutMs: 20000, suppressErrorLog: true,
    });
    if (!result || !['listar', 'abrir', 'ultima'].includes(result.accion)) return null;
    if (result.cliente && (typeof result.cliente !== 'string' || result.cliente.length > 100)) return null;
    if (result.numero && (typeof result.numero !== 'string' || !/^(?:\d{1,9}|\d{3}-\d{3}-\d{1,9})$/.test(result.numero))) return null;
    if ([result.desde, result.hasta].some((value) => value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) return null;
    if (result.desde && result.hasta && result.desde > result.hasta) return null;
    return {
      accion: result.accion, cliente: result.cliente || undefined, numero: result.numero || undefined,
      desde: result.desde || undefined, hasta: result.hasta || undefined,
    };
  } catch (error) {
    if (error instanceof ApiError && [0, 404, 429, 503].includes(error.status) && !signal.aborted) return null;
    throw error;
  }
}

export async function resolveBotInvoiceTurn(turn: BotInvoiceTurn, userId: number, message: string,
  mode: 'texto' | 'voz', current: BotInvoiceConversation | undefined, signal: AbortSignal): Promise<{
  context?: BotInvoiceConversation; rows: BotInvoicePdf[]; autoOpen?: BotInvoicePdf; notice?: string;
}> {
  if (turn === 'invalidDate') {
    return { context: current, rows: [], notice: 'Esa fecha no es válida. Puedes escribirla como 20/11/2026 o 20 de noviembre.' };
  }
  if (typeof turn === 'object' && 'kind' in turn) {
    if (!current) return { rows: [], notice: 'Busca primero las facturas que quieres consultar.' };
    if (turn.kind === 'open') {
      const selected = turn.index === -1 ? current.first
        : turn.index === -2 ? current.selected ?? (current.rows.length === 1 ? current.rows[0] : undefined)
        : current.rows[turn.index];
      return selected ? { context: current, rows: [selected], autoOpen: selected }
        : { context: current, rows: current.rows, notice: 'Elige una factura de la lista que tienes en pantalla.' };
    }
    if (!current.filters || (turn.forward ? current.next === undefined : current.cursors.length < 2)) {
      return { context: current, rows: current.rows, notice: turn.forward ? 'Ya estás en la última página.' : 'Ya estás en la primera página.' };
    }
    const cursors = turn.forward ? [...current.cursors, current.next!] : current.cursors.slice(0, -1);
    const page = await searchBotInvoicePage(userId, current.filters, cursors[cursors.length - 1], 20, signal);
    return { context: { ...current, ...page, cursors }, rows: page.rows };
  }

  const query = turn === 'interpret' ? await interpretBotInvoiceQuery(message, mode, signal) : turn;
  if (!query) return { rows: [], notice: 'No pude identificar el filtro de esa consulta. Prueba con el cliente, la fecha o el número de la factura.' };
  const { accion, ...filters } = query;
  const page = await searchBotInvoicePage(userId, filters, null, accion === 'ultima' ? 1 : 20, signal);
  const context = { ...page, next: accion === 'ultima' ? undefined : page.next, filters, cursors: [null], first: page.rows[0] };
  return {
    context, rows: page.rows,
    autoOpen: accion !== 'listar' && page.rows.length === 1 && (accion === 'ultima' || page.next === undefined) ? page.rows[0] : undefined,
  };
}

export async function findBotInvoicePdfs(
  userId: number,
  request: 'latest' | { number: string } | BotInvoiceDateRequest,
  signal: AbortSignal,
): Promise<BotInvoicePdf[]> {
  if (request === 'latest') {
    const [latest] = await getFacturas(userId, 1, signal);
    return latest?.codfactura > 0 ? [toBotInvoicePdf(latest)] : [];
  }
  if ('date' in request) {
    // Filter again for older servers that ignore the optional date range.
    const invoices = await getFacturas(userId, 0, signal, request.date);
    const matches = invoices.filter((invoice) => invoice.codfactura > 0 && getInvoiceDateKey(invoice.fechaEmision) === request.date);
    return (request.latest ? matches.slice(0, 1) : matches).map(toBotInvoicePdf);
  }
  const full = invoiceNumber(request.number);
  if (full) {
    const exact = await getFacturaPorNumeroCompleto(userId, full, signal);
    if (exact?.codfactura && exact.codfactura > 0) return [{ id: exact.codfactura, numeroFactura: full }];
  }
  // The general invoice list includes paid invoices and all series in the account.
  const invoices = await getFacturas(userId, 0, signal);
  const matches = invoices.filter((invoice) => invoice.codfactura > 0).map(toBotInvoicePdf).filter((invoice) => {
    if (full) return invoice.numeroFactura === full;
    const sequence = invoice.numeroFactura.split('-').at(-1);
    return sequence?.replace(/^0+(?=\d)/, '') === request.number.replace(/^0+(?=\d)/, '');
  });
  return [...new Map(matches.map((invoice) => [invoice.id, invoice])).values()];
}

export function getBotEmittedInvoiceNumber(action: string | null | undefined, emitted: boolean, answer: string) {
  return emitted && (action === 'confirmar_emision' || action === 'emitir_factura' || action === 'emitirfactura')
    ? invoiceNumber(answer) : undefined;
}
export type BotChatResponse = {
  requestId?: string;
  sessionId?: string;
  estadoVersion?: number;
  respuesta?: string;
  response?: string;
  mensaje?: string;
  message?: string;
  estado?: string;
  facturaDraft?: BotFacturaDraft;
  requiereConfirmacion?: boolean;
  emitida?: boolean;
  facturasPdf?: BotInvoicePdf[];
  codigoError?: string | null;
  accionDetectada?: string | null;
  accionUi?: string | null;
  rutaSugerida?: string | null;
  rutasSugeridas?: string[];
  seleccionPendienteTipo?: string | null;
  seleccionPendienteMensaje?: string | null;
  opcionesSeleccion?: BotSelectionOption[];
  data?: { respuesta?: string; response?: string; mensaje?: string; message?: string };
  progreso?: BotProgressStep[];
  datosFaltantes?: string[];
  operacionPendiente?: { tipo?: string; resumen?: string; expiraEn?: string | null } | null;
};

export type BotSessionScope = 'efact' | 'erubrica';

export function inferERubricaAttachmentAction(answer: string, recentMessages: string[]) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const response = normalize(answer);
  if (!/\b(adjunt\w*|seleccion\w*|sub[ei]\w*|carg\w*|envi\w*)\b/.test(response)
      || !/\b(pdf|archivo|documento|cedula|ruc|selfie|certificado|p12|comprobante)\b/.test(response)) return undefined;
  if (/\b(comprobante|recibo)\b/.test(response)) return 'adjuntar_comprobante_pago';
  if (/\b(p12)\b/.test(response) || (/\b(certificado)\b/.test(response) && !/\b(pdf)\b/.test(response))) return 'abrir_configuracion_firma';
  if (/\b(cedula|ruc|selfie|nombramiento|constitucion|solicitud)\b/.test(response)) return 'abrir_solicitud';
  const intent = [...recentMessages, answer].reverse().map(normalize)
    .find((message) => /\b(valid\w*|firmar|firma\w*|solicitud|certificado)\b/.test(message)) ?? response;
  if (/\b(valid\w*)\b/.test(intent)) return 'abrir_validar_firma';
  if (/\b(solicitud)\b/.test(intent)) return 'abrir_solicitud';
  return 'abrir_firma_pdf';
}

export type BotWorkflowState = {
  invoiceDraft: BotFacturaDraft | null;
  missingData: string[];
  requiresConfirmation: boolean;
  invoiceState: string;
  selectionOptions: BotSelectionOption[];
  progress: BotProgressStep[];
  configurationRoutes: string[];
  pendingOperation: { tipo?: string; resumen?: string; expiraEn?: string | null } | null;
  workflowStale: boolean;
};

export type BotFacturaDraft = {
  cliente?: { id?: number; nombre?: string; identificacion?: string | null } | null;
  items?: Array<{
    id?: string;
    descripcion?: string;
    cantidad?: number;
    precioUnitario?: number;
    tarifaPorcentaje?: number;
    impuesto?: number;
    total?: number;
  }>;
  subtotal?: number;
  impuesto?: number;
  total?: number;
  formaPago?: string | null;
};

export type BotSelectionOption = {
  indice: number;
  tipo: string;
  etiqueta: string;
  descripcion?: string | null;
  cliente?: { id?: number; nombre?: string; identificacion?: string | null } | null;
  producto?: { id?: number; nombre?: string; precioUnitario?: number; tarifaPorcentaje?: number; codigoPrincipal?: string | null } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeClient(value: unknown) {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  return {
    id: asNumber(value.id),
    nombre: asString(value.nombre),
    identificacion: value.identificacion === null ? null : asString(value.identificacion),
  };
}

function normalizeInvoiceDraft(value: unknown): BotFacturaDraft | undefined {
  if (!isRecord(value)) return undefined;
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item) => ({
      id: asString(item.id),
      descripcion: asString(item.descripcion),
      cantidad: asNumber(item.cantidad),
      precioUnitario: asNumber(item.precioUnitario),
      tarifaPorcentaje: asNumber(item.tarifaPorcentaje),
      impuesto: asNumber(item.impuesto),
      total: asNumber(item.total),
    }))
    : undefined;

  return {
    cliente: normalizeClient(value.cliente),
    items,
    subtotal: asNumber(value.subtotal),
    impuesto: asNumber(value.impuesto),
    total: asNumber(value.total),
    formaPago: value.formaPago === null ? null : asString(value.formaPago),
  };
}

function normalizeSelectionOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || asNumber(item.indice) === undefined || !asString(item.tipo) || !asString(item.etiqueta)) return [];
    return [{
      indice: asNumber(item.indice) as number,
      tipo: asString(item.tipo) as string,
      etiqueta: asString(item.etiqueta) as string,
      descripcion: item.descripcion === null ? null : asString(item.descripcion),
      cliente: normalizeClient(item.cliente),
      producto: isRecord(item.producto)
        ? {
          id: asNumber(item.producto.id),
          nombre: asString(item.producto.nombre),
          precioUnitario: asNumber(item.producto.precioUnitario),
          tarifaPorcentaje: asNumber(item.producto.tarifaPorcentaje),
          codigoPrincipal: item.producto.codigoPrincipal === null ? null : asString(item.producto.codigoPrincipal),
        }
        : item.producto === null ? null : undefined,
    }];
  });
}

function normalizeProgress(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !asString(item.id) || !asString(item.label)) return [];
    const status: BotProgressStep['status'] = item.status === 'pending' || item.status === 'completed' || item.status === 'warning' ? item.status : undefined;
    return [{ id: asString(item.id) as string, label: asString(item.label) as string, detail: asString(item.detail), status }];
  });
}

function normalizePendingOperation(value: unknown) {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  return { tipo: asString(value.tipo), resumen: asString(value.resumen), expiraEn: value.expiraEn === null ? null : asString(value.expiraEn) };
}

function normalizeWorkflow(value: unknown): BotWorkflowState | null {
  if (!isRecord(value)) return null;
  return {
    invoiceDraft: normalizeInvoiceDraft(value.invoiceDraft) ?? null,
    missingData: Array.isArray(value.missingData) ? value.missingData.filter((item): item is string => typeof item === 'string') : [],
    requiresConfirmation: value.requiresConfirmation === true,
    invoiceState: asString(value.invoiceState) ?? '',
    selectionOptions: normalizeSelectionOptions(value.selectionOptions),
    progress: normalizeProgress(value.progress),
    configurationRoutes: Array.isArray(value.configurationRoutes) ? value.configurationRoutes.filter((item): item is string => typeof item === 'string') : [],
    pendingOperation: normalizePendingOperation(value.pendingOperation) ?? null,
    workflowStale: value.workflowStale === true,
  };
}

function normalizeBotResponse(value: unknown): BotChatResponse | string | null {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return null;
  const data = isRecord(value.data)
    ? { respuesta: asString(value.data.respuesta), response: asString(value.data.response), mensaje: asString(value.data.mensaje), message: asString(value.data.message) }
    : undefined;
  return {
    requestId: asString(value.requestId),
    sessionId: asString(value.sessionId),
    estadoVersion: asNumber(value.estadoVersion),
    respuesta: asString(value.respuesta),
    response: asString(value.response),
    mensaje: asString(value.mensaje),
    message: asString(value.message),
    estado: asString(value.estado),
    facturaDraft: normalizeInvoiceDraft(value.facturaDraft),
    requiereConfirmacion: typeof value.requiereConfirmacion === 'boolean' ? value.requiereConfirmacion : undefined,
    emitida: typeof value.emitida === 'boolean' ? value.emitida : undefined,
    facturasPdf: Array.isArray(value.facturasPdf) ? value.facturasPdf.flatMap((item: unknown) => {
      if (!isRecord(item) || typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0) return [];
      return [{ id: item.id, numeroFactura: asString(item.numeroFactura) ?? '' }];
    }) : [],
    codigoError: value.codigoError === null ? null : asString(value.codigoError),
    accionDetectada: value.accionDetectada === null ? null : asString(value.accionDetectada),
    accionUi: value.accionUi === null ? null : asString(value.accionUi),
    rutaSugerida: value.rutaSugerida === null ? null : asString(value.rutaSugerida),
    rutasSugeridas: Array.isArray(value.rutasSugeridas) ? value.rutasSugeridas.filter((item): item is string => typeof item === 'string') : [],
    seleccionPendienteTipo: value.seleccionPendienteTipo === null ? null : asString(value.seleccionPendienteTipo),
    seleccionPendienteMensaje: value.seleccionPendienteMensaje === null ? null : asString(value.seleccionPendienteMensaje),
    opcionesSeleccion: normalizeSelectionOptions(value.opcionesSeleccion),
    data,
    progreso: normalizeProgress(value.progreso),
    datosFaltantes: Array.isArray(value.datosFaltantes) ? value.datosFaltantes.filter((item): item is string => typeof item === 'string') : [],
    operacionPendiente: normalizePendingOperation(value.operacionPendiente),
  };
}

let activeBotSession: { userId: number; scope: BotSessionScope; sessionId: string } | null = null;
let botHistoryWrite = Promise.resolve();
const BOT_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const BOT_HISTORY_KEY_PREFIX = 'efact.bot.history.key.';
const BOT_WORKFLOW_STORAGE_PREFIX = 'efact.bot.workflow.';

function historyFileUri(userId: number, scope: BotSessionScope = 'efact') {
  return userId > 0 && FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${BOT_HISTORY_FILE_PREFIX}${scope === 'efact' ? '' : `${scope}.`}${userId}.json`
    : null;
}

function historyKey(userId: number, scope: BotSessionScope = 'efact') {
  return `${BOT_HISTORY_KEY_PREFIX}${scope === 'efact' ? '' : `${scope}.`}${userId}`;
}

async function getHistoryKey(userId: number, scope: BotSessionScope, create: boolean) {
  if (userId <= 0 || !(await SecureStore.isAvailableAsync())) return null;
  try {
    const stored = await SecureStore.getItemAsync(historyKey(userId, scope));
    if (stored) return stored;
    if (!create) return null;
    const key = await AESEncryptionKey.generate(AESKeySize.AES256);
    const generated = await key.encoded('base64');
    await SecureStore.setItemAsync(historyKey(userId, scope), generated);
    return generated;
  } catch {
    return null;
  }
}

async function encryptHistory(userId: number, scope: BotSessionScope, value: string) {
  const keyValue = await getHistoryKey(userId, scope, true);
  if (!keyValue) return null;
  const key = await AESEncryptionKey.import(keyValue, 'base64');
  const encrypted = await aesEncryptAsync(new TextEncoder().encode(value), key);
  return `v2.${await encrypted.combined('base64')}`;
}

async function decryptHistory(userId: number, scope: BotSessionScope, value: string) {
  const keyValue = await getHistoryKey(userId, scope, false);
  const [version, first, second] = value.split('.');
  if (!keyValue || !first) return null;
  const sealed = version === 'v2' ? AESSealedData.fromCombined(first)
    : version === 'v1' && second ? AESSealedData.fromParts(first, second) : null;
  if (!sealed) return null;
  const key = await AESEncryptionKey.import(keyValue, 'base64');
  return new TextDecoder().decode(await aesDecryptAsync(sealed, key));
}

function sanitizeHistoryMessage(message: BotMessage): BotMessage {
  const redact = (text: string) => text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo oculto]')
    .replace(/\b\d{10,13}\b/g, '[identificación oculta]');
  return {
    ...message,
    text: redact(message.text),
    invoicePdfs: message.invoicePdfs?.map((invoice) => ({
      ...invoice,
      client: invoice.client ? redact(invoice.client) : undefined,
    })),
    catalogList: message.catalogList?.kind === 'clientes'
      ? { kind: 'clientes', rows: message.catalogList.rows.map(({ name }) => ({ name: redact(name) })) }
      : message.catalogList?.kind === 'productos' ? { kind: 'productos', rows: message.catalogList.rows } : undefined,
  };
}

function isBotMessage(value: unknown): value is BotMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BotMessage>;
  return typeof candidate.id === 'string' && (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.text === 'string';
}

function restoreHistoryMessage(message: BotMessage & { clientRows?: Array<{ name: string }> }): BotMessage {
  if (!Array.isArray(message.clientRows)) return message;
  const { clientRows, ...current } = message;
  return { ...current, catalogList: current.catalogList ?? { kind: 'clientes', rows: clientRows.map(({ name }) => ({ name })) } };
}

export async function loadBotHistory(userId: number, scope: BotSessionScope = 'efact') {
  await botHistoryWrite;
  const uri = historyFileUri(userId, scope);
  const hasSession = Boolean(await readStoredSession(userId, scope));
  let storedWorkflow: BotWorkflowState | null = null;
  if (hasSession && userId > 0 && await SecureStore.isAvailableAsync()) {
    try {
      const rawWorkflow = await SecureStore.getItemAsync(workflowStorageKey(userId, scope));
      if (rawWorkflow) {
        const parsedWorkflow = JSON.parse(rawWorkflow) as { savedAt?: number; workflow?: unknown };
        if (parsedWorkflow.savedAt && Date.now() - parsedWorkflow.savedAt <= BOT_HISTORY_TTL_MS) {
          storedWorkflow = normalizeWorkflow(parsedWorkflow.workflow);
        }
      }
    } catch {
      storedWorkflow = null;
    }
  }
  if (!uri) return storedWorkflow ? { messages: [], feedbackByMessage: {}, workflow: storedWorkflow } : null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return storedWorkflow ? { messages: [], feedbackByMessage: {}, workflow: storedWorkflow } : null;
    const decrypted = await decryptHistory(userId, scope, await FileSystem.readAsStringAsync(uri));
    if (!decrypted) return storedWorkflow ? { messages: [], feedbackByMessage: {}, workflow: storedWorkflow } : null;
    const parsed = JSON.parse(decrypted) as { savedAt?: number; messages?: unknown; feedbackByMessage?: unknown; workflow?: unknown };
    const fresh = Boolean(parsed.savedAt && Date.now() - parsed.savedAt <= BOT_HISTORY_TTL_MS);
    if (hasSession && !fresh) {
      await resetBotSession(userId, scope);
    }
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter(isBotMessage).slice(-100).map(restoreHistoryMessage) : [];
    const feedbackByMessage: BotFeedbackState = {};
    if (parsed.feedbackByMessage && typeof parsed.feedbackByMessage === 'object') {
      for (const [id, value] of Object.entries(parsed.feedbackByMessage)) {
        if (value === 'like' || value === 'dislike') feedbackByMessage[id] = value;
      }
    }
    return { messages, feedbackByMessage, workflow: hasSession && fresh ? normalizeWorkflow(parsed.workflow) ?? storedWorkflow : storedWorkflow };
  } catch {
    return storedWorkflow ? { messages: [], feedbackByMessage: {}, workflow: storedWorkflow } : null;
  }
}

export function saveBotHistory(userId: number, messages: BotMessage[], feedbackByMessage: BotFeedbackState, workflow: BotWorkflowState | null = null, scope: BotSessionScope = 'efact') {
  const uri = historyFileUri(userId, scope);
  if (!uri && userId <= 0) return Promise.resolve();
  const value = JSON.stringify({
    savedAt: Date.now(),
    messages: messages.slice(-100).map(sanitizeHistoryMessage),
    feedbackByMessage,
  });
  botHistoryWrite = botHistoryWrite
    .then(async () => {
      if (await SecureStore.isAvailableAsync()) {
        if (workflow) await SecureStore.setItemAsync(workflowStorageKey(userId, scope), JSON.stringify({ savedAt: Date.now(), workflow }));
        else await SecureStore.deleteItemAsync(workflowStorageKey(userId, scope));
      }
      const encrypted = await encryptHistory(userId, scope, value);
      if (encrypted && uri) await FileSystem.writeAsStringAsync(uri, encrypted);
    })
    .catch(() => undefined);
  return botHistoryWrite;
}

export type ArchivedBotChat = { id: string; messages: BotMessage[] };

export function endBotAccountSession(userId: number) {
  if (userId <= 0) return;
  if (activeBotSession?.userId === userId) activeBotSession = null;
  botHistoryWrite = botHistoryWrite.then(async () => {
    if (!(await SecureStore.isAvailableAsync())) return;
    for (const scope of ['efact', 'erubrica'] as const) {
      await SecureStore.deleteItemAsync(storageKey(userId, scope));
      await SecureStore.deleteItemAsync(workflowStorageKey(userId, scope));
    }
  }).catch(() => undefined);
}

export function getBotMessageDate(message: BotMessage) {
  if (typeof message.createdAt === 'number' && Number.isFinite(message.createdAt)) return message.createdAt;
  const previous = /^(?:user|assistant)-(\d{13})-/.exec(message.id);
  return previous ? Number(previous[1]) : undefined;
}

async function readBotArchive(userId: number, scope: BotSessionScope, uri: string) {
  if (!(await FileSystem.getInfoAsync(uri)).exists) return [];
  const decrypted = await decryptHistory(userId, scope, await FileSystem.readAsStringAsync(uri));
  if (!decrypted) throw new Error('No se pudo leer el historial de Númi.');
  const chats = JSON.parse(decrypted) as ArchivedBotChat[];
  return chats.map((chat) => ({ ...chat, messages: chat.messages.map(restoreHistoryMessage) }));
}

export async function loadArchivedBotChats(userId: number, scope: BotSessionScope) {
  await botHistoryWrite;
  const uri = historyFileUri(userId, scope);
  return uri ? readBotArchive(userId, scope, `${uri}.archive`) : [];
}

export function startNewBotChat(userId: number, scope: BotSessionScope, messages: BotMessage[], eraseHistory = false) {
  const uri = historyFileUri(userId, scope);
  const transcript = messages.filter((message) => message.id !== 'welcome').slice(-100).map(sanitizeHistoryMessage);
  const write = botHistoryWrite
    .then(async () => {
      if (eraseHistory && uri) {
        await FileSystem.deleteAsync(`${uri}.archive`, { idempotent: true });
      } else if (transcript.length) {
        if (!uri) throw new Error('El almacenamiento seguro de Númi no está disponible.');
        const archiveUri = `${uri}.archive`;
        const id = transcript[0].id;
        const chats = await readBotArchive(userId, scope, archiveUri);
        const next = [{ id, messages: transcript }, ...chats.filter((chat) => chat.id !== id)].slice(0, 20);
        const encrypted = await encryptHistory(userId, scope, JSON.stringify(next));
        if (!encrypted) throw new Error('El almacenamiento seguro de Númi no está disponible.');
        await FileSystem.writeAsStringAsync(archiveUri, encrypted);
      }
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      if (userId > 0 && await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(workflowStorageKey(userId, scope));
      }
      await resetBotSession(userId, scope);
    });
  botHistoryWrite = write.catch(() => undefined);
  return write;
}

function buildSessionId(userId: number) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `mobile-${userId}-${Date.now().toString(36)}-${randomPart}`;
}

function buildRequestId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageKey(userId: number, scope: BotSessionScope) {
  return `${BOT_SESSION_STORAGE_PREFIX}${scope}.${userId}`;
}

function workflowStorageKey(userId: number, scope: BotSessionScope) {
  return `${BOT_WORKFLOW_STORAGE_PREFIX}${scope}.${userId}`;
}

async function readStoredSession(userId: number, scope: BotSessionScope) {
  if (userId <= 0 || !(await SecureStore.isAvailableAsync())) return null;
  try {
    return await SecureStore.getItemAsync(storageKey(userId, scope));
  } catch {
    return null;
  }
}

async function saveStoredSession(userId: number, scope: BotSessionScope, sessionId: string) {
  if (userId <= 0 || !(await SecureStore.isAvailableAsync())) return;
  try {
    await SecureStore.setItemAsync(storageKey(userId, scope), sessionId);
  } catch {
    // La sesión sigue funcionando en memoria si el dispositivo no permite almacenamiento seguro.
  }
}

export async function getOrCreateBotSessionId(userId: number, scope: BotSessionScope = 'efact') {
  if (activeBotSession?.userId === userId && activeBotSession.scope === scope) return activeBotSession.sessionId;

  const stored = await readStoredSession(userId, scope);
  const sessionId = stored?.trim() || (BOT_SESSION_ID && userId <= 0 && scope === 'efact' ? BOT_SESSION_ID : buildSessionId(userId));
  activeBotSession = { userId, scope, sessionId };
  if (sessionId !== stored) await saveStoredSession(userId, scope, sessionId);
  return sessionId;
}

export async function resetBotSession(userId: number, scope: BotSessionScope = 'efact') {
  const sessionId = buildSessionId(userId);
  activeBotSession = { userId, scope, sessionId };
  await saveStoredSession(userId, scope, sessionId);
  return sessionId;
}

export async function sendBotMessage(input: { message: string; userId?: number; sessionId?: string; sessionScope?: BotSessionScope; contexto?: string; modo?: 'texto' | 'voz'; requestId?: string; signal?: AbortSignal }) {
  const message = input.message.trim();
  if (!message) throw new Error('Escribe una instrucción para Númi.');
  if (message.length > 800) throw new Error('La instrucción no puede superar 800 caracteres.');
  const sessionScope = input.sessionScope ?? 'efact';
  const sessionId = input.sessionId ?? await getOrCreateBotSessionId(input.userId ?? 0, sessionScope);
  const requestId = input.requestId?.trim() || buildRequestId();
  const requestOptions = {
    method: 'POST' as const,
    timeoutMs: 60000,
    signal: input.signal,
    body: JSON.stringify({
      requestId,
      sessionId,
      scope: sessionScope,
      mensaje: message,
      modo: input.modo ?? 'texto',
      contexto: input.contexto,
    }),
  };
  let rawResponse: unknown;
  for (let attempt = 0; ; attempt += 1) {
    try {
      rawResponse = await apiRequest<unknown>(BOT_CHAT_PATH, requestOptions);
      break;
    } catch (error) {
      if (input.signal?.aborted || attempt >= 2 || !isRetryableBotError(error)) throw error;
      await waitBeforeBotRetry(attempt, input.signal);
    }
  }
  const response = normalizeBotResponse(rawResponse);

  if (!response) throw new Error('El bot devolvió una respuesta inválida.');

  const answer = typeof response === 'string' ? response : [
    response.respuesta,
    response.response,
    response.mensaje,
    response.message,
    response.data?.respuesta,
    response.data?.response,
    response.data?.mensaje,
    response.data?.message,
  ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!answer?.trim()) throw new Error('El bot no devolvió una respuesta válida.');
  const responseSessionId = typeof response === 'string' ? sessionId : response.sessionId?.trim() || sessionId;
  if (input.userId && input.userId > 0) {
    activeBotSession = { userId: input.userId, scope: sessionScope, sessionId: responseSessionId };
    await saveStoredSession(input.userId, sessionScope, responseSessionId);
  }
  return {
    requestId: typeof response === 'string' ? requestId : response.requestId?.trim() || requestId,
    sessionId: responseSessionId,
    estadoVersion: typeof response === 'string' ? undefined : response.estadoVersion,
    answer: answer.trim(),
    progress: typeof response === 'string' ? [] : response.progreso ?? [],
    missing: typeof response === 'string' ? [] : response.datosFaltantes ?? [],
    estado: typeof response === 'string' ? undefined : response.estado,
    draft: typeof response === 'string' ? undefined : response.facturaDraft,
    requiresConfirmation: typeof response === 'string' ? false : response.requiereConfirmacion === true,
    emitted: typeof response === 'string' ? false : response.emitida === true,
    invoicePdfs: typeof response === 'string' ? [] : response.facturasPdf ?? [],
    errorCode: typeof response === 'string' ? undefined : response.codigoError ?? undefined,
    action: typeof response === 'string' ? undefined : response.accionDetectada,
    uiAction: typeof response === 'string' ? undefined : response.accionUi ?? undefined,
    pendingSelectionType: typeof response === 'string' ? undefined : response.seleccionPendienteTipo,
    pendingSelectionMessage: typeof response === 'string' ? undefined : response.seleccionPendienteMensaje,
    selectionOptions: typeof response === 'string' ? [] : response.opcionesSeleccion ?? [],
    suggestedRoute: typeof response === 'string' ? undefined : response.rutaSugerida,
    suggestedRoutes: typeof response === 'string' ? [] : response.rutasSugeridas ?? [],
    pendingOperation: typeof response === 'string' ? null : response.operacionPendiente ?? null,
  };
}

function isRetryableBotError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

function waitBeforeBotRetry(attempt: number, signal?: AbortSignal) {
  const delay = attempt === 0 ? 700 : 1500;
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    let abort = () => undefined;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const complete = () => {
      cleanup();
      resolve();
    };
    const timerAbort = () => {
      cleanup();
      reject(new Error('Solicitud cancelada.'));
    };
    abort = () => {
      clearTimeout(timer);
      timerAbort();
    };
    timer = setTimeout(complete, delay);
    if (signal?.aborted) {
      clearTimeout(timer);
      timerAbort();
    }
    else signal?.addEventListener('abort', abort, { once: true });
  });
}
