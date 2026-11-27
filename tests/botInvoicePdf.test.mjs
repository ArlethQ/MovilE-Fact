import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadSource(file, dependencies = {}) {
  const source = readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const sandbox = { exports: {}, require: (path) => dependencies[path] ?? {}, URLSearchParams };
  vm.runInNewContext(outputText, sandbox);
  return sandbox.exports;
}

class ApiError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

function setup(apiRequest) {
  const api = { ApiError, apiRequest };
  const facturas = loadSource('services/facturasMobileService', { './apiClient': api });
  return loadSource('services/botService', {
    './apiClient': api,
    './facturasMobileService': facturas,
    '../utils/botInvoiceDate': loadSource('utils/botInvoiceDate'),
  });
}

test('Entiende las variantes de última factura y consulta solo un registro', async () => {
  const signal = new AbortController().signal;
  const bot = setup(async (path, options) => {
    assert.equal(path, '/api/facturas?idUsuario=42&top=1');
    assert.equal(options.signal, signal);
    return [{ Codfactura: 81, Numfactura: '001-001-000004382', Serie: '001001' }];
  });
  const commands = [
    'Muéstrame el PDF de la última factura generada',
    'En el historial general muéstrame la última factura con el visor pdf',
    '¿Podrías abrirme en el visor la factura más reciente de mi cuenta?',
    'Por favor, genera el PDF de la última factura emitida',
    'La última factura guardada, muéstramela en PDF',
    'PDF de la última factura',
    'Necesito el PDF de la última de mis facturas',
    'Enséñame la última factura generada de Mis facturas en P D F',
  ];
  commands.forEach((command) => assert.equal(bot.parseBotInvoicePdfRequest(command), 'latest', command));
  const [invoice] = await bot.findBotInvoicePdfs(42, bot.parseBotInvoicePdfRequest(commands[0]), signal);
  assert.equal(invoice.id, 81);
  assert.equal(invoice.numeroFactura, '001-001-000004382');
});

test('Resuelve el número completo por serie y admite ambas formas de guardarlo', async () => {
  const attempts = [];
  const bot = setup(async (path) => {
    const url = new URL(path, 'http://localhost');
    assert.equal(url.pathname, '/api/facturas/por-numero');
    assert.equal(url.searchParams.get('serie'), '001001');
    attempts.push(url.searchParams.get('numFactura'));
    if (attempts.length === 1) throw new ApiError(404);
    return { Factura: { Codfactura: 81 } };
  });
  const request = bot.parseBotInvoicePdfRequest('Ver PDF de la factura 001-001-000004382');
  const [invoice] = await bot.findBotInvoicePdfs(42, request, new AbortController().signal);
  assert.deepEqual(attempts, ['000004382', '001-001-000004382']);
  assert.equal(invoice.id, 81);
});

test('Distingue referencias, preguntas de aclaración, respuestas con número y acciones de escritura', () => {
  const bot = setup(async () => assert.fail('El análisis de texto no consulta la API'));
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la factura que acabas de emitir'), 'reference');
  assert.equal(bot.parseBotInvoicePdfRequest('Ábreme el PDF de esa factura'), 'reference');
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la última factura de María'), 'clarify');
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la última factura generada para María'), 'clarify');
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la factura'), 'clarify');
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la factura del borrador'), 'clarify');
  assert.equal(bot.parseBotInvoicePdfRequest('4382'), null);
  assert.equal(bot.parseBotInvoicePdfRequest('4382', true).number, '4382');
  assert.equal(bot.parseBotInvoicePdfRequest('Es la 001 - 001 - 4382', true).number, '001-001-000004382');
  assert.equal(bot.parseBotInvoicePdfRequest('la última', true), 'latest');
  assert.equal(bot.parseBotInvoicePdfRequest('No me muestres el PDF de la última factura'), null);
  assert.equal(bot.parseBotInvoicePdfRequest('Anula la última factura y muéstrame su PDF'), null);
  assert.equal(bot.parseBotInvoicePdfRequest('Crea una factura y muéstrame el PDF'), null);
  assert.equal(bot.parseBotInvoicePdfRequest('Muéstrame el PDF de la última nota de crédito'), null);
  assert.equal(bot.getBotEmittedInvoiceNumber('confirmar_emision', true, 'Factura 001-001-000004382 autorizada.'), '001-001-000004382');
  assert.equal(bot.getBotEmittedInvoiceNumber('consultar_facturas', true, 'Factura 001-001-000004382.'), undefined);
});

test('El secuencial parcial conserva las coincidencias entre series', async () => {
  const bot = setup(async (path) => {
    assert.equal(path, '/api/facturas?idUsuario=42&top=0');
    return [
      { Codfactura: 81, Numfactura: '000004382', Serie: '001001' },
      { Codfactura: 82, Numfactura: '001-002-000004382', Serie: '001002' },
      { Codfactura: 83, Numfactura: '000044382', Serie: '001001' },
    ];
  });
  const request = bot.parseBotInvoicePdfRequest('Abre en PDF la factura número 4382');
  const matches = await bot.findBotInvoicePdfs(42, request, new AbortController().signal);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].numeroFactura, '001-001-000004382');
  assert.equal(matches[1].numeroFactura, '001-002-000004382');
});

test('Si la búsqueda exacta da 404, busca por número completo en Mis facturas', async () => {
  const bot = setup(async (path) => {
    if (path.startsWith('/api/facturas/por-numero?')) throw new ApiError(404);
    assert.equal(path, '/api/facturas?idUsuario=42&top=0');
    return [
      { Codfactura: 10, Numfactura: '4382', Serie: '001-002' },
      { Codfactura: 20, Numfactura: '4382', Serie: '001-001' },
    ];
  });
  const matches = await bot.findBotInvoicePdfs(42, { number: '001-001-000004382' }, new AbortController().signal);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 20);
});

test('Un error de permisos interrumpe la búsqueda sin consultar otras rutas', async () => {
  let attempts = 0;
  const bot = setup(async () => {
    attempts++;
    throw new ApiError(403);
  });
  await assert.rejects(bot.findBotInvoicePdfs(42, { number: '001-001-000004382' }, new AbortController().signal), { status: 403 });
  assert.equal(attempts, 1);
});

test('Reconoce fechas en texto, como respuesta breve y sin mencionar PDF', () => {
  const bot = setup(async () => assert.fail('Analizar la orden no consulta la API'));
  const commands = [
    'Muéstrame la factura del 20 de noviembre de 2026',
    'Quiero ver la factura de la fecha 20/11/2026',
    'Abre la factura del 2026-11-20',
    'Muéstrame el PDF de la factura del 20.11.2026',
  ];
  for (const phrase of commands) {
    const request = bot.parseBotInvoicePdfRequest(phrase);
    assert.equal(request.date, '2026-11-20', phrase);
    assert.equal(request.listOnly, false, phrase);
  }
  assert.equal(bot.parseBotInvoicePdfRequest('Facturas del 20/11/2026').listOnly, true);
  assert.equal(bot.parseBotInvoicePdfRequest('La última factura del 20/11/2026').latest, true);
  assert.equal(bot.parseBotInvoicePdfRequest('Del 20 de noviembre de 2026', true).date, '2026-11-20');
  assert.equal(bot.parseBotInvoicePdfRequest('Factura del 31/02/2026'), 'invalidDate');
  assert.equal(bot.parseBotInvoicePdfRequest('Crea una factura con fecha 20/11/2026'), null);
});

test('Resuelve hoy y ayer con el día calendario de Ecuador', () => {
  const { parseBotInvoiceDate } = loadSource('utils/botInvoiceDate');
  const now = new Date('2026-11-21T02:00:00Z');
  assert.equal(parseBotInvoiceDate('hoy', now), '2026-11-20');
  assert.equal(parseBotInvoiceDate('ayer', now), '2026-11-19');
  assert.equal(parseBotInvoiceDate('20 de noviembre', now), '2026-11-20');
});

test('Consulta por fecha y verifica las coincidencias también con servidores anteriores', async () => {
  const signal = new AbortController().signal;
  const bot = setup(async (path, options) => {
    assert.equal(path, '/api/facturas?idUsuario=42&top=0&fechaDesde=2026-11-20&fechaHasta=2026-11-20');
    assert.equal(options.signal, signal);
    return [
      { Codfactura: 44, Numfactura: '000004383', Serie: '001001', FechaEmision: '2026-11-21T00:00:00' },
      { Codfactura: 42, Numfactura: '000004382', Serie: '001001', FechaEmision: '2026-11-20T23:45:00', Cliente: 'Cliente A', Total: 125.75 },
      { Codfactura: 41, Numfactura: '000004381', Serie: '001001', FechaEmision: '2026-11-20T09:00:00' },
    ];
  });
  const invoices = await bot.findBotInvoicePdfs(42, { date: '2026-11-20', listOnly: false, latest: false }, signal);
  assert.equal(invoices.length, 2);
  assert.equal(invoices[0].id, 42);
  assert.equal(invoices[0].client, 'Cliente A');
  assert.equal(invoices[0].total, 125.75);
  const latest = await bot.findBotInvoicePdfs(42, { date: '2026-11-20', listOnly: false, latest: true }, signal);
  assert.equal(latest.length, 1);
  assert.equal(latest[0].id, 42);
});

test('Separa los resultados de una consulta sin tocar fechas, números ni montos', () => {
  const { formatBotAnswer } = loadSource('utils/botAnswerFormatting');
  assert.equal(formatBotAnswer('Resultados: 1. Factura 001-001-000004382 ($ 123.45) 2. Factura 001-001-000004383 ($ 25.00)'),
    'Resultados:\n1. Factura 001-001-000004382 ($ 123.45)\n2. Factura 001-001-000004383 ($ 25.00)');
  assert.equal(formatBotAnswer('Encontré Ana (0123), María (0456) y Juan (0789).'),
    'Encontré Ana (0123)\nMaría (0456)\nJuan (0789).');
  assert.equal(formatBotAnswer('El total es $ 123.45, con fecha 20/11/2026.'), 'El total es $ 123.45, con fecha 20/11/2026.');
});

test('Mantiene cliente y fecha al paginar o elegir la segunda y la última sin llamadas al modelo', async () => {
  const { planBotInvoiceTurn } = loadSource('utils/botInvoiceConversation', { './botInvoiceDate': loadSource('utils/botInvoiceDate') });
  const signal = new AbortController().signal;
  let queries = 0;
  const bot = setup(async (path, options) => {
    queries++;
    const url = new URL(path, 'http://localhost');
    assert.equal(url.pathname, '/api/facturas/consulta-numi');
    assert.equal(url.searchParams.has('idUsuario'), false);
    assert.equal(url.searchParams.get('cliente'), 'María');
    assert.equal(url.searchParams.get('fechaDesde'), '2026-11-20');
    assert.equal(url.searchParams.get('fechaHasta'), '2026-11-20');
    assert.equal(options.signal, signal);
    return url.searchParams.has('antesDe') ? { items: [{ codfactura: 70 }] }
      : { items: [{ codfactura: 72 }, { codfactura: 71 }], antesDe: 71 };
  });
  const command = 'Busca las facturas de María del 20/11/2026';
  const turn = planBotInvoiceTurn(command);
  assert.equal(turn.cliente, 'María');
  assert.equal(turn.accion, 'listar');
  const first = await bot.resolveBotInvoiceTurn(turn, 42, command, 'texto', undefined, signal);
  assert.equal(first.rows.length, 2);
  const second = await bot.resolveBotInvoiceTurn(planBotInvoiceTurn('Abre la segunda', first.context), 42, '', 'voz', first.context, signal);
  assert.equal(second.autoOpen.id, 71);
  const next = await bot.resolveBotInvoiceTurn(planBotInvoiceTurn('Las siguientes', second.context), 42, '', 'voz', second.context, signal);
  assert.equal(next.rows[0].id, 70);
  const latest = await bot.resolveBotInvoiceTurn(planBotInvoiceTurn('Ábreme la última', next.context), 42, '', 'voz', next.context, signal);
  assert.equal(latest.autoOpen.id, 72);
  const previous = await bot.resolveBotInvoiceTurn(planBotInvoiceTurn('Vuelve a las anteriores', next.context), 42, '', 'texto', next.context, signal);
  assert.equal(previous.rows[0].id, 72);
  const changedDate = planBotInvoiceTurn('Y del 21/11/2026', first.context);
  assert.equal(changedDate.cliente, 'María');
  assert.equal(changedDate.desde, '2026-11-21');
  assert.equal(planBotInvoiceTurn('Abre la segunda', undefined), null);
  assert.equal(planBotInvoiceTurn('Abre mis facturas', first.context), null);
  assert.equal(planBotInvoiceTurn('Envíame al correo las facturas de María', first.context), null);
  assert.equal(planBotInvoiceTurn('Muéstrame el PDF de la última factura generada').accion, 'ultima');
  assert.equal(planBotInvoiceTurn('En el historial general muéstrame la última factura con el visor PDF').accion, 'ultima');
  assert.equal(planBotInvoiceTurn('Muéstrame la última factura pagada en PDF'), 'interpret');
  assert.equal(planBotInvoiceTurn('Dame el PDF de las facturas desde el 20/11/2026'), 'interpret');
  assert.equal(planBotInvoiceTurn('Dame la factura del 31/11/2026'), 'invalidDate');
  const invalid = await bot.resolveBotInvoiceTurn('invalidDate', 42, '', 'texto', first.context, signal);
  assert.match(invalid.notice, /fecha no es válida/);
  assert.equal(invalid.context, first.context);
  assert.equal(queries, 3);
});

test('La interpretación usa una sola llamada de lectura y aplica todos los filtros resultantes', async () => {
  const { planBotInvoiceTurn } = loadSource('utils/botInvoiceConversation', { './botInvoiceDate': loadSource('utils/botInvoiceDate') });
  const urls = [];
  const phrase = '¿Qué le facturé a María entre octubre y noviembre?';
  const bot = setup(async (path, options) => {
    const url = new URL(path, 'http://localhost');
    urls.push(url.pathname);
    if (options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body), { mensaje: phrase, modo: 'voz' });
      return { accion: 'listar', cliente: 'María', numero: null, desde: '2026-10-01', hasta: '2026-11-30' };
    }
    assert.equal(url.searchParams.get('cliente'), 'María');
    assert.equal(url.searchParams.get('fechaDesde'), '2026-10-01');
    assert.equal(url.searchParams.get('fechaHasta'), '2026-11-30');
    return { items: [] };
  });
  const turn = planBotInvoiceTurn(phrase);
  assert.equal(turn, 'interpret');
  await bot.resolveBotInvoiceTurn(turn, 42, phrase, 'voz', undefined, new AbortController().signal);
  assert.deepEqual(urls, ['/api/asistente-facturacion/interpretar-consulta-facturas', '/api/facturas/consulta-numi']);
  assert.equal(planBotInvoiceTurn('Crea una factura para María', undefined), null);
});

test('Una búsqueda sin acceso se detiene y un servidor anterior filtra solo dentro de Mis facturas', async () => {
  const signal = new AbortController().signal;
  let calls = 0;
  const denied = setup(async () => { calls++; throw new ApiError(403); });
  await assert.rejects(denied.searchBotInvoicePage(42, { cliente: 'María' }, null, 20, signal), { status: 403 });
  assert.equal(calls, 1);
  const legacy = setup(async (path) => {
    if (path.startsWith('/api/facturas/consulta-numi?')) throw new ApiError(404);
    assert.equal(path, '/api/facturas?idUsuario=42&top=0');
    return [{ Codfactura: 5, Cliente: 'María', FechaEmision: '2026-11-20' },
      { Codfactura: 4, Cliente: 'Otro cliente', FechaEmision: '2026-11-20' }];
  });
  const page = await legacy.searchBotInvoicePage(42, { cliente: 'Maria', desde: '2026-11-20' }, null, 20, signal);
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].id, 5);
  const offline = setup(async (path) => {
    assert.equal(path, '/api/asistente-facturacion/interpretar-consulta-facturas');
    throw new ApiError(404);
  });
  const unavailable = await offline.resolveBotInvoiceTurn('interpret', 42, 'consulta', 'texto', undefined, signal);
  assert.equal(unavailable.rows.length, 0);
  assert.match(unavailable.notice, /No pude identificar/);
});
