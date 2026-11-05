import { BOT_CHAT_PATH, BOT_HISTORY_FILE_PREFIX, BOT_SESSION_ID, BOT_SESSION_STORAGE_PREFIX } from '../config/bot';
import { ApiError, apiRequest } from './apiClient';
import type { BotFeedbackState, BotMessage, BotProgressStep } from '../types/bot';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

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

function toBase64(bytes: Uint8Array) {
  if (typeof globalThis.btoa !== 'function') return null;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

function fromBase64(value: string) {
  if (typeof globalThis.atob !== 'function') return null;
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getHistoryKey(userId: number, scope: BotSessionScope, create: boolean) {
  if (userId <= 0 || !(await SecureStore.isAvailableAsync())) return null;
  try {
    const stored = await SecureStore.getItemAsync(historyKey(userId, scope));
    if (stored) return stored;
    if (!create || !globalThis.crypto?.getRandomValues) return null;
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const generated = toBase64(bytes);
    if (!generated) return null;
    await SecureStore.setItemAsync(historyKey(userId, scope), generated);
    return generated;
  } catch {
    return null;
  }
}

async function encryptHistory(userId: number, scope: BotSessionScope, value: string) {
  const cryptoApi = globalThis.crypto;
  const keyValue = await getHistoryKey(userId, scope, true);
  if (!cryptoApi?.subtle || !cryptoApi.getRandomValues || !keyValue) return null;
  const rawKey = fromBase64(keyValue);
  if (!rawKey) return null;

  const key = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = new Uint8Array(12);
  cryptoApi.getRandomValues(iv);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  );
  const encodedIv = toBase64(iv);
  const encodedData = toBase64(new Uint8Array(encrypted));
  return encodedIv && encodedData ? `v1.${encodedIv}.${encodedData}` : null;
}

async function decryptHistory(userId: number, scope: BotSessionScope, value: string) {
  const cryptoApi = globalThis.crypto;
  const keyValue = await getHistoryKey(userId, scope, false);
  if (!cryptoApi?.subtle || !keyValue || !value.startsWith('v1.')) return null;
  const [, encodedIv, encodedData] = value.split('.');
  const iv = encodedIv ? fromBase64(encodedIv) : null;
  const encrypted = encodedData ? fromBase64(encodedData) : null;
  const rawKey = fromBase64(keyValue);
  if (!iv || !encrypted || !rawKey) return null;

  const key = await cryptoApi.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

function sanitizeHistoryMessage(message: BotMessage): BotMessage {
  return {
    ...message,
    text: message.text
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo oculto]')
      .replace(/\b\d{10,13}\b/g, '[identificación oculta]'),
  };
}

function isBotMessage(value: unknown): value is BotMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BotMessage>;
  return typeof candidate.id === 'string' && (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.text === 'string';
}

export async function loadBotHistory(userId: number, scope: BotSessionScope = 'efact') {
  const uri = historyFileUri(userId, scope);
  let storedWorkflow: BotWorkflowState | null = null;
  if (userId > 0 && await SecureStore.isAvailableAsync()) {
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
    if (!parsed.savedAt || Date.now() - parsed.savedAt > BOT_HISTORY_TTL_MS) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await resetBotSession(userId, scope);
      return storedWorkflow ? { messages: [], feedbackByMessage: {}, workflow: storedWorkflow } : null;
    }
    const messages = Array.isArray(parsed.messages) ? parsed.messages.filter(isBotMessage).slice(-100) : [];
    const feedbackByMessage: BotFeedbackState = {};
    if (parsed.feedbackByMessage && typeof parsed.feedbackByMessage === 'object') {
      for (const [id, value] of Object.entries(parsed.feedbackByMessage)) {
        if (value === 'like' || value === 'dislike') feedbackByMessage[id] = value;
      }
    }
    return { messages, feedbackByMessage, workflow: normalizeWorkflow(parsed.workflow) ?? storedWorkflow };
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
    workflow,
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

export function clearBotHistory(userId: number, scope: BotSessionScope = 'efact') {
  const uri = historyFileUri(userId, scope);
  botHistoryWrite = botHistoryWrite
    .then(async () => {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      if (userId > 0 && await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(historyKey(userId, scope));
        await SecureStore.deleteItemAsync(storageKey(userId, scope));
        await SecureStore.deleteItemAsync(workflowStorageKey(userId, scope));
      }
    })
    .catch(() => undefined);
  if (activeBotSession?.userId === userId && activeBotSession.scope === scope) activeBotSession = null;
  return botHistoryWrite;
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
