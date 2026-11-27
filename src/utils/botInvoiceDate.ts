const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const writtenDate = new RegExp(`\\b(\\d{1,2}) de (${[...months, 'setiembre'].join('|')})(?: (?:del? )?(\\d{4}))?\\b`);
const ecuadorDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function calendarDate(value: Date) {
  if (!Number.isFinite(value.getTime())) return undefined;
  const parts = Object.fromEntries(ecuadorDate.formatToParts(value).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKey(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function parseBotInvoiceDate(text: string, now = new Date()): string | null | undefined {
  const iso = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/.exec(text);
  if (iso) return dateKey(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const today = calendarDate(now);
  const currentYear = Number(today?.slice(0, 4));
  const numeric = /\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{4}|\d{2}))?\b/.exec(text);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3]) + (numeric[3].length === 2 ? 2000 : 0) : currentYear;
    return dateKey(year, Number(numeric[2]), Number(numeric[1]));
  }
  const written = writtenDate.exec(text);
  if (written) {
    const month = written[2] === 'setiembre' ? 9 : months.indexOf(written[2]) + 1;
    return dateKey(written[3] ? Number(written[3]) : currentYear, month, Number(written[1]));
  }
  const relative = /\b(hoy|ayer|anteayer)\b/.exec(text);
  if (!relative || !today) return undefined;
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (relative[1] === 'anteayer' ? 2 : relative[1] === 'ayer' ? 1 : 0));
  return date.toISOString().slice(0, 10);
}

export function getInvoiceDateKey(value?: string | null): string | undefined {
  if (!value) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (iso) return iso[0];
  const legacy = /^\/Date\((\d+)(?:[+-]\d+)?\)\/$/.exec(value);
  return legacy ? calendarDate(new Date(Number(legacy[1]))) : parseBotInvoiceDate(value) ?? undefined;
}

export function formatInvoiceDateKey(value: string) {
  return value.split('-').reverse().join('/');
}

const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export function parseInvoiceConversationPeriod(text: string, now = new Date()) {
  const today = calendarDate(now);
  if (!today) return undefined;
  const anchor = new Date(`${today}T00:00:00Z`);
  if (/\b(?:semana pasada|semana anterior|esta semana)\b/.test(text)) {
    const isPrevious = !/\besta semana\b/.test(text);
    anchor.setUTCDate(anchor.getUTCDate() - ((anchor.getUTCDay() + 6) % 7) - (isPrevious ? 7 : 0));
    const desde = anchor.toISOString().slice(0, 10);
    anchor.setUTCDate(anchor.getUTCDate() + 6);
    return { desde, hasta: isPrevious ? anchor.toISOString().slice(0, 10) : today };
  }
  const weekday = new RegExp(`\\b(${weekdays.join('|')})(?: (pasado|anterior))?\\b`).exec(text);
  if (weekday) {
    const delta = (anchor.getUTCDay() - weekdays.indexOf(weekday[1]) + 7) % 7;
    anchor.setUTCDate(anchor.getUTCDate() - (weekday[2] && delta === 0 ? 7 : delta));
    const day = anchor.toISOString().slice(0, 10);
    return { desde: day, hasta: day };
  }
  const day = parseBotInvoiceDate(text, now);
  if (!day) return day === null ? null : undefined;
  return { desde: day, hasta: day };
}
