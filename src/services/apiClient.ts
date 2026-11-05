import { API_BASE_URL } from '../config/api';

type RequestOptions = RequestInit & {
  timeoutMs?: number;
  suppressErrorLog?: boolean;
};

const REQUEST_TIMEOUT_MS = 20000;
const DEFAULT_ERROR_MESSAGE = 'No se pudo completar la solicitud. Intenta nuevamente.';

let authSessionCookie: string | null = null;
let authFailureHandler: (() => void) | null = null;

export function clearAuthSession() {
  authSessionCookie = null;
}

export function getAuthSessionCookie() {
  return authSessionCookie;
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  authFailureHandler = handler;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs, suppressErrorLog, headers, signal: externalSignal, ...requestOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
  const controller = new AbortController();
  const requestTimeoutMs = timeoutMs ?? REQUEST_TIMEOUT_MS;
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const abortExternal = () => controller.abort();
  const cleanup = () => {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortExternal);
  };
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abortExternal, { once: true });

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(authSessionCookie ? { Cookie: authSessionCookie } : {}),
        ...headers,
      },
    });
  } catch (error) {
    cleanup();
    if (!suppressErrorLog) logApiNetworkError(path, requestOptions.method, Date.now() - startedAt, requestTimeoutMs, error);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'La conexion con el servidor tardo demasiado.');
    }

    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  const setCookie = response.headers.get('set-cookie');
  const authCookie = setCookie?.match(/(?:^|,\s*)(Auth_Session=[^;,]+)/i)?.[1];
  if (authCookie) authSessionCookie = authCookie;

  const contentType = response.headers.get('content-type') ?? '';
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    cleanup();
    if (!suppressErrorLog) logApiNetworkError(path, requestOptions.method, Date.now() - startedAt, requestTimeoutMs, error);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'La conexion con el servidor tardo demasiado.');
    }
    throw new ApiError(0, 'No se pudo leer la respuesta del servidor.');
  }
  cleanup();
  const body = contentType.includes('application/json') && text ? safeParseJson(text) : text;

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
      if (!path.startsWith('/api/auth/')) authFailureHandler?.();
    }
    const message = getErrorMessage(response.status, body, path);
    if (!suppressErrorLog) {
      logApiError(path, response.status, body, {
        contentType,
        elapsedMs: Date.now() - startedAt,
        method: requestOptions.method,
        timeoutMs: requestTimeoutMs,
        userMessage: message,
      });
    }

    throw new ApiError(response.status, message);
  }

  return body as T;
}

export async function apiRequestBinary(path: string, options: RequestOptions = {}) {
  const { timeoutMs, suppressErrorLog, headers, ...requestOptions } = options;
  const controller = new AbortController();
  const requestTimeoutMs = timeoutMs ?? REQUEST_TIMEOUT_MS;
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...requestOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/pdf, application/json',
        ...(authSessionCookie ? { Cookie: authSessionCookie } : {}),
        ...headers,
      },
    });
  } catch (error) {
    clearTimeout(timeout);
    if (!suppressErrorLog) logApiNetworkError(path, requestOptions.method, Date.now() - startedAt, requestTimeoutMs, error);

    if (error instanceof Error && error.name === 'AbortError') throw new ApiError(0, 'La conexion con el servidor tardo demasiado.');
    throw new ApiError(0, 'No se pudo conectar con el servidor.');
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
      if (!path.startsWith('/api/auth/')) authFailureHandler?.();
    }
    let text: string;
    try {
      text = await response.text();
    } finally {
      clearTimeout(timeout);
    }
    const message = getErrorMessage(response.status, text, path);
    if (!suppressErrorLog) {
      logApiError(path, response.status, text, {
        contentType: response.headers.get('content-type') ?? '',
        elapsedMs: Date.now() - startedAt,
        method: requestOptions.method,
        timeoutMs: requestTimeoutMs,
        userMessage: message,
      });
    }
    throw new ApiError(response.status, message);
  }

  try {
    const bytes = await response.arrayBuffer();
    clearTimeout(timeout);
    return { bytes, contentType: response.headers.get('content-type') ?? 'application/pdf' };
  } catch (error) {
    clearTimeout(timeout);
    if (!suppressErrorLog) logApiNetworkError(path, requestOptions.method, Date.now() - startedAt, requestTimeoutMs, error);
    if (error instanceof Error && error.name === 'AbortError') throw new ApiError(0, 'La conexion con el servidor tardo demasiado.');
    throw new ApiError(0, 'No se pudo leer la respuesta del servidor.');
  }
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(status: number, body: unknown, path: string) {
  const bodyMessage = getBodyErrorMessage(body);
  const normalizedPath = path.toLowerCase().replace(/\/+$/, '');

  if (status === 401 && normalizedPath === '/api/auth/login') {
    return getLoginErrorMessage(bodyMessage);
  }

  if (status === 401 && normalizedPath.includes('/api/auth/recover-password')) {
    return 'No encontramos una cuenta asociada a ese correo.';
  }

  if (status === 401 && normalizedPath.includes('/api/auth/change-password')) {
    return 'La clave temporal o actual no es correcta.';
  }

  if (status === 429) {
    return 'Se alcanzó el límite temporal de solicitudes. Espera unos segundos e inténtalo nuevamente.';
  }

  if (status === 404) {
    return 'No se encontró el recurso solicitado. Intenta nuevamente.';
  }

  if (status >= 500) {
    return bodyMessage || 'El servidor no pudo completar la operación. Intenta nuevamente.';
  }

  if (status === 401) {
    return 'Tu sesión expiró. Inicia sesión nuevamente.';
  }

  if (status === 403) {
    return 'No tienes permisos para realizar esta operación.';
  }

  return bodyMessage || DEFAULT_ERROR_MESSAGE;
}

function getLoginErrorMessage(bodyMessage: string) {
  const normalized = bodyMessage
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/(usuario|cuenta)\s+no\s+(?:esta\s+)?(?:registrad[oa]|encontrad[oa]|existe)|no\s+(?:existe|se\s+encuentra|se\s+encontro)\s+(?:el\s+)?(usuario|cuenta)/i.test(normalized)) {
    return 'Usuario no encontrado.';
  }

  if (/contrasena|clave|password/.test(normalized) && /(incorrect|inval|errone|no\s+valida)/i.test(normalized)) {
    return 'La contraseña es incorrecta.';
  }

  return 'Usuario o contraseña incorrectos.';
}

function getBodyErrorMessage(body: unknown): string {
  if (typeof body === 'string') {
    const message = body.trim();
    if (!message || looksLikeHtml(message)) return '';
    const parsed = safeParseJson(message);
    if (parsed !== message) return getBodyErrorMessage(parsed);
    return sanitizeUserMessage(message, '');
  }

  if (!body || typeof body !== 'object') return '';

  const errorBody = body as Record<string, unknown>;
  const directMessage = [errorBody.mensaje, errorBody.message, errorBody.title, errorBody.detail, errorBody.error]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (directMessage) return sanitizeUserMessage(directMessage, '');

  const errors = errorBody.errors;
  if (errors && typeof errors === 'object') {
    const validationMessage = Object.values(errors)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (validationMessage) return sanitizeUserMessage(validationMessage, '');
  }

  return '';
}

function sanitizeUserMessage(value: string, fallback = DEFAULT_ERROR_MESSAGE) {
  const message = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!message || message.length > 280 || /<[^>]+>|\b(stack trace|exception| at |innerexception|system\.)\b/i.test(message)) {
    return fallback;
  }

  return message;
}

function looksLikeHtml(value: string) {
  return /^\s*<!doctype html/i.test(value) || /^\s*<html[\s>]/i.test(value);
}

function logApiError(
  path: string,
  status: number,
  body: unknown,
  context: { contentType?: string; elapsedMs?: number; method?: string; timeoutMs?: number; userMessage?: string } = {},
) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  const bodyText = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  const preview = sanitizeDiagnosticBody(bodyText);
  console.error('[API ERROR]', {
    baseUrl: API_BASE_URL,
    path,
    method: context.method ?? 'GET',
    status,
    elapsedMs: context.elapsedMs,
    timeoutMs: context.timeoutMs,
    contentType: context.contentType,
    body: context.userMessage ?? preview ?? DEFAULT_ERROR_MESSAGE,
    bodyLength: bodyText.length,
  });

  logLocalApiErrorDetails(path, status, bodyText, context);
}

function sanitizeDiagnosticBody(bodyText: string) {
  if (!bodyText.trim()) return undefined;
  const message = safeParseJson(bodyText);
  if (message && typeof message === 'object') {
    const value = message as { mensaje?: unknown; message?: unknown; title?: unknown; detail?: unknown; error?: unknown };
    return sanitizeUserMessage(String(value.mensaje ?? value.message ?? value.title ?? value.detail ?? value.error ?? ''));
  }

  return sanitizeUserMessage(bodyText);
}

function getLocalApiErrorDebug(bodyText: string) {
  if (!looksLikeHtml(bodyText)) return undefined;

  return {
    requestId: extractHtmlText(bodyText, /<strong>\s*Request ID:\s*<\/strong>\s*<code>(.*?)<\/code>/is),
    title: extractHtmlText(bodyText, /<title>(.*?)<\/title>/is),
    heading: extractHtmlText(bodyText, /<h1[^>]*>(.*?)<\/h1>/is),
    message: extractHtmlText(bodyText, /<h2[^>]*>(.*?)<\/h2>/is),
  };
}

function logLocalApiErrorDetails(
  path: string,
  status: number,
  bodyText: string,
  context: { contentType?: string; elapsedMs?: number; method?: string; timeoutMs?: number; userMessage?: string } = {},
) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  const debug = getLocalApiErrorDebug(bodyText);
  if (!debug) return;

  console.error('[API LOCAL DEBUG]', {
    url: `${API_BASE_URL}${path}`,
    method: context.method ?? 'GET',
    status,
    elapsedMs: context.elapsedMs,
    timeoutMs: context.timeoutMs,
    contentType: context.contentType,
    requestId: debug.requestId,
    title: debug.title,
    message: debug.message,
    hint: 'Busca este requestId en los logs del backend ASP.NET para ver la excepcion exacta.',
  });
}

function extractHtmlText(html: string, pattern: RegExp) {
  const value = html.match(pattern)?.[1];
  if (!value) return undefined;

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function logApiNetworkError(path: string, method: string | undefined, elapsedMs: number, timeoutMs: number, error: unknown) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  console.error('[API NETWORK ERROR]', {
    url: `${API_BASE_URL}${path}`,
    method: method ?? 'GET',
    elapsedMs,
    timeoutMs,
    error: error instanceof Error ? error.message : String(error),
  });
}
