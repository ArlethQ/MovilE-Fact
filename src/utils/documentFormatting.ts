export function formatMoney(value?: number | null) {
  return `$ ${Number(value ?? 0).toFixed(2)}`;
}

export function formatDocumentDate(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '-';
  const source = String(value);
  const dotNetMatch = /\/Date\((\d+)\)\//.exec(source);
  const date = dotNetMatch ? new Date(Number(dotNetMatch[1])) : new Date(source);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('es-EC');
  return source.slice(0, 10);
}

export function listItemKey(prefix: string, parts: Array<string | number | null | undefined>, index: number) {
  const stable = parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== '' && String(part).trim() !== '0')
    .map((part) => String(part).trim().replace(/\s+/g, '-'))
    .join('-');
  return `${prefix}-${stable || 'item'}-${index}`;
}

export type DocumentPdfFormat = 'A4';
