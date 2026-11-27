import type { BotInvoicePdf } from '../types/bot';
import { parseInvoiceConversationPeriod } from './botInvoiceDate';

export type BotInvoiceFilters = { cliente?: string; numero?: string; desde?: string; hasta?: string };
export type BotInvoiceQuery = BotInvoiceFilters & { accion: 'listar' | 'abrir' | 'ultima' };
type BotInvoiceReference = { kind: 'open'; index: number } | { kind: 'page'; forward: boolean };
export type BotInvoiceTurn = BotInvoiceQuery | BotInvoiceReference | 'interpret' | 'invalidDate';
export type BotInvoiceConversation = {
  filters?: BotInvoiceFilters;
  rows: BotInvoicePdf[];
  first?: BotInvoicePdf;
  selected?: BotInvoicePdf;
  cursors: Array<number | null>;
  next?: number;
};

const writeIntent = /\b(?:crea(?:r|me)?|genera(?:r|me)?|emite|emitir|anula(?:r)?|cancela(?:r)?|elimina(?:r)?|modifica(?:r)?|edita(?:r)?|haz(?:me)?|hacer|prepara(?:r)?|guarda(?:r)?|registra(?:r)?|envia(?:r|me)?|reenvia(?:r)?|confirma(?:r|me)?|corrige|corregir)\b/;
const viewIntent = /\b(?:muestra|muestrame|muestramela|muestramelo|muestres|ver|abre|abreme|abrela|abrir|ensena|ensename|visualiza|quiero|quisiera|necesito|dame|consulta|consultar|busca|buscar|revisa|revisar|recupera|recuperame|lista|listar|cuales|que|cuantas|pdf)\b/;

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿¡!?]/g, '').trim();
}

export function planBotInvoiceTurn(message: string, context?: BotInvoiceConversation): BotInvoiceTurn | null {
  const text = normalize(message)
    .replace(/\b(?:genera|generar|generame|crea|crear|haz|hazme|prepara|preparar) (?:el |un )?pdf\b/g, 'mostrar pdf')
    .replace(/\b(?:que )?(?:acabo|acabas) de (?:emitir|crear|generar|guardar)\b/g, 'emitida');
  if (/^(?:numi )?no\b/.test(text) || writeIntent.test(text)
      || /\b(?:nota de credito|nota de debito|cotizacion|retencion|guia de remision|liquidacion|borrador)\b/.test(text)) return null;

  const simple = text.replace(/^(?:numi )?(?:(?:por favor )|(?:(?:puedes|podrias) ))?/, '')
    .replace(/[.,]/g, '').replace(/ por favor$/, '');
  if (/^(?:abre|abrir|ir a|llevame a) (?:mis facturas|facturacion)$/.test(simple)) return null;
  if (context) {
    if (/^(?:(?:muestra|ver|dame) )?(?:las |los )?siguientes(?: facturas)?$/.test(simple)) return { kind: 'page', forward: true };
    if (/^(?:(?:vuelve a|regresa a|muestra|ver) )?(?:las |los )?anteriores(?: facturas)?$/.test(simple)) return { kind: 'page', forward: false };
    const ordinal = /^(?:(?:abre(?:me)?|muestra(?:me)?|ver|quiero ver) )?(?:la |el )?(?:(?:opcion|numero) )?(primera?|segund[oa]|tercer[oa]|cuart[oa]|quint[oa]|[1-9]\d?)(?: factura)?(?: en pdf)?$/.exec(simple);
    if (ordinal) {
      const index = ['primer', 'segund', 'tercer', 'cuart', 'quint'].findIndex((word) => ordinal[1].startsWith(word));
      return { kind: 'open', index: index >= 0 ? index : Number(ordinal[1]) - 1 };
    }
    if (/^(?:(?:abre(?:me)?|muestra(?:me)?|ver|quiero ver) )?(?:el pdf de )?la (?:ultima|mas reciente)(?: en pdf)?$/.test(simple)) {
      return { kind: 'open', index: -1 };
    }
    if (/^(?:(?:abre(?:me)?|muestra(?:me)?|ver|quiero ver) )?(?:el pdf de )?(?:esa|esta)(?: factura)?(?: en pdf)?$/.test(simple)) {
      return { kind: 'open', index: -2 };
    }
    if (context.filters && /^(?:y )?(?:del? |de la |en |la de )?(?:\d|hoy\b|ayer\b|anteayer\b|semana\b|viernes\b|lunes\b|martes\b|miercoles\b|jueves\b|sabado\b|domingo\b)/.test(simple)) {
      const period = parseInvoiceConversationPeriod(simple);
      if (period) return { cliente: context.filters.cliente, ...period, accion: 'listar' };
      if (period === null) return 'invalidDate';
    }
  }

  if (!/\b(?:facturas?|facture|comprobantes? emitidos?)\b/.test(text) ||
      (!viewIntent.test(text) && !/^(?:mis |las? )?facturas?\b/.test(text))) return null;

  if (/\b(?:pendientes?|pagadas?|anuladas?|vencidas?|vencimiento|estado sri|emisor|sucursal|forma de pago|autorizadas?|entre|desde|hasta|rango|a nombre de|(?:mes|ano|trimestre) (?:pasado|anterior|actual)|(?:este|del) (?:mes|ano|trimestre))\b/.test(text)) return 'interpret';
  const full = /\b(\d{3})\s*[-–—]\s*(\d{3})\s*[-–—]\s*(\d{1,9})\b/.exec(text);
  const numero = full ? `${full[1]}-${full[2]}-${full[3].padStart(9, '0')}`
    : /\bfactura (?:numero |nro |secuencial )?(\d{1,9})(?:\s|$)/.exec(text)?.[1];

  const period = parseInvoiceConversationPeriod(full ? text.replace(full[0], '') : text);
  if (period === null) return 'invalidDate';
  const original = message.replace(/[¿¡!?]/g, '').trim();
  const clientMatch = /\bfacturas?\s+(?:de(?:l)?|para)\s+(?:el cliente\s+|la clienta\s+|cliente\s+)?(.+?)(?=\s+(?:de hoy|de ayer|de anteayer|de la semana|del? (?:\d|dia\b|lunes\b|martes\b|mi[eé]rcoles\b|jueves\b|viernes\b|s[aá]bado\b|domingo\b)|hoy\b|ayer\b|anteayer\b|en pdf|por favor)|$)/i.exec(original);
  const rawClient = clientMatch?.[1].trim().replace(/[.,]$/, '');
  const cliente = rawClient && !/^(?:\d{1,2}[/.-]|\d{4}[-/]|\d{1,2} de |hoy\b|ayer\b|anteayer\b|la fecha\b|dia\b|lunes\b|martes\b|miercoles\b|jueves\b|viernes\b|sabado\b|domingo\b|la semana\b|mi cuenta\b|mis facturas\b|historial\b|esta conversacion\b|esa\b|esta\b)/.test(normalize(rawClient))
    ? rawClient : undefined;
  if (!cliente && (/\b(?:cliente|clienta|para)\b/.test(text) || (period && rawClient &&
      /(?:\d|\b(?:hoy|ayer|anteayer|pasado|anterior))\s+de(?:l)?\s+[a-z]/.test(normalize(rawClient)) &&
      !/^\d{1,2} de [a-z]+(?: (?:del? )?\d{4})?$/.test(normalize(rawClient))))) return 'interpret';
  if (!cliente && !period && !numero) {
    if (/^(?:(?:muestrame|lista|listar|consulta|ver|busca) )?(?:las |mis )?facturas$/.test(simple)) return { accion: 'listar' };
    const general = text.replace(/\b(?:(?:en el |del )historial(?: general)?|de mi cuenta|(?:en|de) mis facturas)\b/g, '');
    if (/\b(?:(?:ultima|mas reciente) factura|factura mas reciente)\b/.test(general) &&
        !/\b(?:de|del|para|por|cliente|mes|semana|ano|serie|esta conversacion)\b/.test(
          general.replace(/\b(?:el )?pdf de\b|\bpor favor\b/g, ''))) return { accion: 'ultima' };
    return 'interpret';
  }
  const accion = /\b(?:ultima|mas reciente)\b/.test(text) ? 'ultima'
    : /\bfacturas\b/.test(text) && !/\b(?:abre|abrir|pdf)\b/.test(text) ? 'listar' : 'abrir';
  return { accion, ...(period || {}), cliente, numero };
}
