import { parseInvoiceConversationPeriod } from './botInvoiceDate';

export const operationalViews = {
  clientes: 'clientes',
  proveedores: 'clientes',
  productos: 'productos',
  categorias: 'categorias',
  subcategorias: 'categorias',
  compras: 'compras',
  cartera: 'cuentas-cobrar',
  'estado-cuenta': 'estado-cuenta',
  reportes: 'reportes',
  facturas: 'mis-facturas',
  'notas-credito': 'mis-notas-credito',
  'notas-debito': 'mis-notas-debito',
  'guias-remision': 'mis-guias-remision',
  retenciones: 'retenciones',
  'liquidaciones-compra': 'mis-liquidaciones-compra',
} as const;

export type OperationalReadModule = keyof typeof operationalViews;
export type OperationalReadQuery = {
  modulo: OperationalReadModule;
  termino?: string;
  estado?: string;
  tipo?: string;
  desde?: string;
  hasta?: string;
  iva?: number;
  resumen?: boolean;
  reciente?: boolean;
};
export type OperationalReadTurn = OperationalReadQuery | { interpretar: OperationalReadModule } | 'next' | 'previous' | 'clarify';
export type OperationalReadContext = { query: OperationalReadQuery; inicio: number; siguiente?: number };

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[¿¡!?]/g, '').trim().replace(/\s+/g, ' ');

const modules: Array<[OperationalReadModule, RegExp]> = [
  ['estado-cuenta', /\b(?:estados? de cuenta|saldo(?: total)?(?= (?:de|del) ))\b/],
  ['cartera', /\b(?:cartera|cuentas? por cobrar|saldos? (?:por cobrar|pendientes?)|por cobrar|me debe(?:n)?|(?:facturas? )?(?:vencidas?|por vencer))\b/],
  ['reportes', /\b(?:reportes?|(?:documentos|comprobantes) (?:fiscales|electronicos|emitidos|recibidos))\b/],
  ['liquidaciones-compra', /\bliquidacion(?:es)? (?:de )?compras?\b/],
  ['notas-credito', /\bnotas? (?:de )?credito\b/],
  ['notas-debito', /\bnotas? (?:de )?debito\b/],
  ['guias-remision', /\bguias? (?:de )?remision\b/],
  ['retenciones', /\bretencion(?:es)?\b/],
  ['compras', /\b(?:facturas? de compra|compras|documentos de compra)\b/],
  ['proveedores', /\bproveedor(?:es|a|as)?\b/],
  ['clientes', /\bclient(?:e|es|a|as)\b/],
  ['productos', /\b(?:productos?|servicios?|articulos?)\b/],
  ['subcategorias', /\bsubcategorias?\b/],
  ['categorias', /\bcategorias?\b/],
  ['facturas', /\bfacturas?\b/],
];
const readPrefix = /^(?:por favor[, ]+)?(?:numi[, ]+)?(?:(?:me puedes|podrias|puedes|me podrias|quiero que|quisiera que) )?(?:(?:quiero|quisiera|necesito|me gustaria) (?:ver|saber|consultar|buscar|que me muestres)\b|(?:dime|decirme|indicame|indicarme|cuentame|muestrame|muestra|mostrar(?:me)?|ver|ensena(?:r|me)?|consulta(?:r|me)?|busca(?:r|me)?|encuentra|localiza|listar|lista(?:me)?|revisa|dame|cuales|cuantos?|cuantas?|cuanto|que|tengo|tienes|hay|cual es)\b)/;
const writes = /\b(?:crea(?:r|me)?|registra(?:r|me)?|agrega(?:r|me)?|anula(?:r)?|elimina(?:r)?|edita(?:r)?|modifica(?:r)?|actualiza(?:r)?|paga(?:r|me)?|abonar|aplica(?:r)?|desactiva(?:r)?|activa(?:r)?|emite|emitir|envia(?:r|me)?|nuevo|nueva|confirma(?:r)?|corrige|corregir)\b/;
const statePattern = /\b(inactiv[oa]s?|activ[oa]s?|no autorizad[oa]s?|autorizad[oa]s?|pendientes?|rechazad[oa]s?|anulad[oa]s?|vencid[oa]s?|pagad[oa]s?)\b/;
const ivaPattern = /\b(?:con )?iva\s+(?:del? )?(\d{1,2}(?:[,.]\d+)?)\b(?:\s*%| por ciento)?/;
const temporal = /\b(?:hoy|ayer|anteayer|semana|mes|ano|trimestre|entre|desde|hasta|rango|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b|\d{1,4}[/.]\d/;
const summary = /\b(?:cuant[oa]s?|saldo total|total de|suma de|importe total)\b/;

function parseState(value: string) {
  const word = statePattern.exec(value)?.[1];
  if (!word) return undefined;
  if (word.startsWith('no autorizad')) return 'rechazado';
  return word.endsWith('e') || word.endsWith('es') ? 'pendiente' : word.replace(/[oa]s?$/, 'o');
}

export function planOperationalRead(message: string, current?: OperationalReadContext): OperationalReadTurn | null {
  const text = normalize(message).replace(/[.,]+$/, '').replace(/ por favor$/, '');
  if (text.length > 800 || /^(?:numi )?no\b/.test(text) || writes.test(text)) return null;
  const short = text.replace(/^(?:numi )?(?:(?:muestrame|muestra|ver|dame|ahora) )?/, '');
  if (current) {
    if (/^(?:las |los )?siguientes(?: resultados)?$/.test(short)) return 'next';
    if (/^(?:vuelve a |regresa a )?(?:las |los )?anteriores(?: resultados)?$/.test(short)) return 'previous';
    if (/^(?:y )?(?:solo |los |las )?(?:inactiv[oa]s?|activ[oa]s?|autorizad[oa]s?|pendientes?|vencid[oa]s?|pagad[oa]s?)$/.test(short)) {
      return { ...current.query, estado: parseState(short), resumen: false };
    }
    if (!/^(?:clientes|proveedores|productos|categorias|subcategorias)$/.test(current.query.modulo) &&
        /^(?:y |solo )?(?:(?:los|las) )?(?:del? |para )?(?:\d|hoy\b|ayer\b|anteayer\b|(?:esta|la) semana\b|(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b)/.test(short)) {
      const period = parseInvoiceConversationPeriod(short);
      if (period === null) return 'clarify';
      if (period) return { ...current.query, ...period };
    }
  }
  if (!readPrefix.test(text) && !/^(?:(?:mis|las|los|mi|el) )?(?:clientes|proveedores|productos|servicios|categorias|subcategorias|compras|cartera|reportes|estado de cuenta)(?:\b|$)/.test(text)) return null;
  const hits = modules.flatMap(([modulo, pattern]) => {
    const match = pattern.exec(text);
    return match ? [{ modulo, match }] : [];
  }).sort((a, b) => a.match.index - b.match.index || b.match[0].length - a.match[0].length);
  const hit = hits[0];
  if (!hit) return null;

  let modulo = hit.modulo;
  if (modulo === 'facturas' && hits.some((entry) => entry.modulo === 'cartera' && /\b(?:vencidas?|por cobrar)\b/.test(entry.match[0]))) modulo = 'cartera';
  const estado = parseState(text);
  const resumen = summary.test(text) || (modulo === 'estado-cuenta' && hit.match[0].startsWith('saldo'));
  if (modulo === 'facturas' && !estado && !resumen && !/\bestado\b/.test(text)) return null;
  if (modulo === 'facturas' && estado === 'pagado') modulo = 'estado-cuenta';
  if (/\b(?:pdf|xml|visor|adjunt[oa]|descarg[ae]|enviar|por pagar|pagos realizados)\b/.test(text)) return modulo === 'facturas' ? null : 'clarify';

  const reciente = /\b(?:ultim[oa]|mas reciente)\b/.test(text);
  const query: OperationalReadQuery = { modulo, estado, resumen, reciente };
  if (modulo === 'productos') {
    if (/^servicios?$/.test(hit.match[0])) query.tipo = 'servicio';
    const iva = ivaPattern.exec(text);
    if (iva) query.iva = Number(iva[1].replace(',', '.'));
    if (/\bsin iva\b/.test(text)) query.iva = 0;
  }
  if (modulo === 'reportes') {
    if (/\brecibidos?\b/.test(text)) query.tipo = 'recibidos';
    if (/\bemitidos?\b/.test(text)) query.tipo = 'emitidos';
  }

  const isCatalog = /^(?:clientes|proveedores|productos|categorias|subcategorias)$/.test(modulo);
  if (!isCatalog) {
    if (/\b(?:entre|desde|hasta|rango|mes|ano|trimestre)\b/.test(text)) return { interpretar: modulo };
    const dateText = text.replace(/\b\d{3}-\d{3}-\d{1,9}\b/g, '');
    if (temporal.test(dateText) || /\b\d{1,2} de [a-z]+/.test(dateText) || /\b\d{4}-\d{2}-\d{2}\b/.test(dateText)) {
      const period = parseInvoiceConversationPeriod(dateText);
      if (period === null) return 'clarify';
      if (!period) return { interpretar: modulo };
      Object.assign(query, period);
    }
  }

  const suffix = text.slice(hit.match.index + hit.match[0].length).trim();
  if (/\b(?:que (?:se llamen?|tengan?|contengan?|esten?)|con (?:el|la) mismo|asociad[oa]s? a)\b/.test(suffix)) return { interpretar: modulo };
  const base = suffix
    .replace(/^(?:(?:generad[oa]s?|vigentes?|electronic[oa]s?|fiscales|emitid[oa]s?|recibid[oa]s?|general|complet[oa]s?)\s*)+\b/, '')
    .replace(statePattern, '')
    .replace(/\b(?:ultim[oa]|mas reciente)\b/, '')
    .replace(ivaPattern, '').replace(/\bsin iva\b/, '')
    .replace(/\s+(?:del? )?(?:hoy|ayer|anteayer|(?:esta|la) semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b.*$/, '')
    .trim();
  const term = base
    .replace(/^(?:(?:de(?:l)?|para|a nombre de|llamad[oa]s?|con|por)\s+)?(?:(?:la |el )?(?:cliente|proveedor|razon social|nombre|codigo|categoria|subcategoria|numero|ruc|cedula|identificacion|fecha)\s+)?/, '')
    .replace(/^["“']|["”']$/g, '').trim();
  if (term && !/^(?:todos?|todas?|mis|es|son|esta|estan|(?:que )?(?:hay|tengo|tienes)(?: registrad[oa]s?)?|en el sistema|de mi cuenta|del historial)$/.test(term)) {
    const startsWithDate = /^(?:\d{1,2}[/.]|\d{4}-\d{2}-|\d{1,2} de |hoy\b|ayer\b|anteayer\b|lunes\b|martes\b|miercoles\b|jueves\b|viernes\b|sabado\b|domingo\b|esta semana\b|la semana\b)/;
    if (!isCatalog && startsWithDate.test(term)) {
      if (!query.desde) return { interpretar: modulo };
    } else if (/\b(?:mayor(?:es)?|menor(?:es)?|mas (?:caros?|baratos?)|distint[oa]s?|excepto|sin contar|compar[ae]|agrupa(?:dos)?)\b/.test(term)) {
      return 'clarify';
    } else {
      query.termino = term.replace(/\s+(?:del? )?(?:\d{1,2}[/.]\d.*|\d{4}-\d{2}-\d{2}|\d{1,2} de [a-z]+.*)$/, '').trim();
    }
  }
  return query;
}
