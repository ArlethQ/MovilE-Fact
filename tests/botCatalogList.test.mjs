import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const sandbox = { exports: {}, URLSearchParams, require: (path) => imports[path] ?? {} };
  vm.runInNewContext(outputText, sandbox);
  return sandbox.exports;
}

const dates = load('utils/botInvoiceDate.ts', {});
const { planOperationalRead } = load('utils/botOperationalRead.ts', { './botInvoiceDate': dates });
const makeService = (apiRequest) => load('services/botOperationalService.ts', {
  './apiClient': { apiRequest },
  '../utils/botInvoiceDate': dates,
});

test('Númi distingue pedidos operativos y conserva el flujo de facturas y escrituras', () => {
  const cases = [
    ['Muéstrame la lista general de todos los clientes', 'clientes', undefined, undefined],
    ['¿Puedes listar los productos inactivos?', 'productos', undefined, 'inactivo'],
    ['Busca el producto por código ABC-123', 'productos', 'abc-123', undefined],
    ['Quiero ver los proveedores de María', 'proveedores', 'maria', undefined],
    ['Muéstrame las subcategorías de limpieza', 'subcategorias', 'limpieza', undefined],
    ['Enséñame las compras del 20/11/2026', 'compras', undefined, undefined],
    ['Muéstrame las guías de remisión pendientes', 'guias-remision', undefined, 'pendiente'],
    ['Dime el estado SRI de la factura 001-001-000000123', 'facturas', '001-001-000000123', undefined],
    ['Dime cuánto me debe María', 'cartera', 'maria', undefined],
    ['Dame el estado de cuenta de María', 'estado-cuenta', 'maria', undefined],
    ['Quisiera ver los documentos recibidos', 'reportes', undefined, undefined],
  ];
  for (const [text, module, term, status] of cases) {
    const planned = planOperationalRead(text);
    assert.equal(planned?.modulo, module, text);
    assert.equal(planned?.termino, term, text);
    assert.equal(planned?.estado, status, text);
  }
  assert.equal(planOperationalRead('Enséñame las compras del 20/11/2026').desde, '2026-11-20');
  assert.equal(planOperationalRead('Muéstrame servicios con IVA del 15 %').tipo, 'servicio');
  assert.equal(planOperationalRead('Muéstrame servicios con IVA del 15 %').iva, 15);
  assert.equal(planOperationalRead('Muéstrame servicios con IVA del 15 %').termino, undefined);
  assert.equal(planOperationalRead('Quisiera ver los documentos recibidos').tipo, 'recibidos');
  assert.equal(planOperationalRead('Dame la última nota de crédito').reciente, true);
  assert.equal(planOperationalRead('Dime el saldo del cliente María').modulo, 'estado-cuenta');
  assert.equal(planOperationalRead('¿Me puedes mostrar las compras de hoy?').modulo, 'compras');
  const previousQuery = planOperationalRead('Enséñame las compras de María');
  const refined = planOperationalRead('Y las del 21/11/2026', { query: previousQuery, inicio: 0 });
  assert.equal(refined.termino, 'maria');
  assert.equal(refined.hasta, '2026-11-21');
  assert.equal(planOperationalRead('¿Cuántos clientes tengo registrados?').resumen, true);
  assert.equal(planOperationalRead('¿Cuántos clientes tengo registrados?').termino, undefined);
  assert.equal(planOperationalRead('Muéstrame la última factura generada'), null);
  assert.equal(planOperationalRead('Muéstrame las facturas de un cliente'), null);
  assert.equal(planOperationalRead('Anula la nota de crédito 001-001-000000123'), null);
  assert.equal(planOperationalRead('Crea un cliente que se llama María'), null);
});

test('Un catálogo de 300 registros se recorre en diez páginas sin llamadas a OpenAI', async () => {
  const signal = new AbortController().signal;
  const starts = [];
  const service = makeService(async (path, options) => {
    const url = new URL(path, 'http://localhost');
    assert.equal(url.pathname, '/api/asistente-facturacion/consultas-operativas');
    assert.equal(options.method, undefined);
    assert.equal(options.signal, signal);
    assert.equal(url.searchParams.get('modulo'), 'productos');
    assert.equal(url.searchParams.get('estado'), 'activo');
    assert.equal(url.searchParams.has('userId'), false);
    assert.equal(url.searchParams.has('idUsuario'), false);
    const inicio = Number(url.searchParams.get('inicio'));
    starts.push(inicio);
    return {
      total: 300,
      items: Array.from({ length: 30 }, (_, index) => ({ nombre: `Producto ${inicio + index + 1}` })),
      siguiente: inicio < 270 ? inicio + 30 : null,
    };
  });
  let result = await service.resolveOperationalRead(planOperationalRead('Muestra los productos activos'), '', 'texto', undefined, signal);
  assert.match(result.answer, /300 resultados/);
  const items = [...result.list.rows];
  while (result.context.siguiente !== undefined) {
    const next = planOperationalRead('Muéstrame los siguientes', result.context);
    result = await service.resolveOperationalRead(next, '', 'texto', result.context, signal);
    items.push(...result.list.rows);
  }
  assert.deepEqual(starts, Array.from({ length: 10 }, (_, index) => index * 30));
  assert.equal(items.at(-1).name, 'Producto 300');
  assert.equal(result.list.inicio, 270);
  const previous = await service.resolveOperationalRead('previous', '', 'voz', result.context, signal);
  assert.equal(previous.list.inicio, 240);
  assert.equal(planOperationalRead('Ahora solo inactivos', previous.context).estado, 'inactivo');
});

test('Una consulta compleja usa una interpretación y mantiene el ámbito de solo lectura', async () => {
  const signal = new AbortController().signal;
  const phrase = '¿Cuántas notas de crédito emití entre octubre y noviembre?';
  const turn = planOperationalRead(phrase);
  assert.equal(turn.interpretar, 'notas-credito');
  const urls = [];
  const service = makeService(async (path, options) => {
    const url = new URL(path, 'http://localhost');
    urls.push(url.pathname);
    if (options.method === 'POST') {
      assert.deepEqual(JSON.parse(options.body), { modulo: 'notas-credito', mensaje: phrase, modo: 'voz' });
      return { aplica: true, desde: '2026-10-01', hasta: '2026-11-30', resumen: true, iva: null, modulo: 'productos' };
    }
    assert.equal(url.searchParams.get('modulo'), 'notas-credito');
    assert.equal(url.searchParams.get('desde'), '2026-10-01');
    assert.equal(url.searchParams.get('hasta'), '2026-11-30');
    assert.equal(url.searchParams.get('resumen'), 'true');
    assert.equal(url.searchParams.has('iva'), false);
    return { total: 4, importe: 32.14, items: [] };
  });
  const result = await service.resolveOperationalRead(turn, phrase, 'voz', undefined, signal);
  assert.match(result.answer, /4 resultados/);
  assert.equal(result.list, undefined);
  assert.deepEqual(urls, ['/api/asistente-facturacion/consultas-operativas/interpretar', '/api/asistente-facturacion/consultas-operativas']);
});

test('Un rechazo de acceso no usa el chat ni intenta otra ruta', async () => {
  const forbidden = new Error('403');
  const urls = [];
  const service = makeService(async (path) => { urls.push(path); throw forbidden; });
  const turn = planOperationalRead('Muéstrame la cartera');
  await assert.rejects(service.resolveOperationalRead(turn, '', 'texto', undefined, new AbortController().signal), forbidden);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /consultas-operativas\?modulo=cartera/);
});

test('La lista tiene altura limitada y el desplazamiento expone las 300 filas numeradas', () => {
  let visibleCount;
  const jsx = (type, props) => ({ type, props });
  const { NumiCatalogList } = load('components/bot/NumiCatalogList.tsx', {
    react: { useState: (initial) => [visibleCount ??= initial, (update) => { visibleCount = update(visibleCount); }] },
    '../../services/botOperationalService': { operationalLabels: {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } },
  });
  const rows = Array.from({ length: 300 }, (_, index) => ({ name: `Producto ${index + 1}` }));
  let list = NumiCatalogList({ kind: 'productos', rows });
  assert.equal(list.props.accessibilityLabel, 'Lista de productos');
  assert.ok(list.props.style.maxHeight > 0 && list.props.style.maxHeight < 300);
  assert.equal(list.props.nestedScrollEnabled, true);
  assert.equal(list.props.children.length, 30);
  for (let batch = 1; batch < 10; batch++) {
    list.props.onScroll({ nativeEvent: {
      contentOffset: { y: 1090 }, layoutMeasurement: { height: 230 }, contentSize: { height: 1320 },
    } });
    list = NumiCatalogList({ kind: 'productos', rows });
  }
  assert.equal(list.props.children.length, 300);
  assert.equal(list.props.children.at(-1).props.children[0].props.children[0], 300);
  assert.equal(list.props.onScroll, undefined);
  let more = false;
  const page = NumiCatalogList({ kind: 'productos', rows: rows.slice(30, 60), inicio: 30, onMore: () => { more = true; } });
  assert.equal(page.props.children[0].props.children[0].props.children[0], 31);
  page.props.children.at(-1).props.onPress();
  assert.equal(more, true);
});

test('Una fila de facturas selecciona la coincidencia tocada', () => {
  const jsx = (type, props) => ({ type, props });
  const { NumiCatalogList } = load('components/bot/NumiCatalogList.tsx', {
    react: { useState: (initial) => [initial, () => {}] },
    '../../services/botOperationalService': { operationalLabels: {} },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } },
  });
  let selected;
  const list = NumiCatalogList({
    kind: 'facturas',
    rows: [{ name: '001-001-000000001', detail: 'Cliente A' }, { name: '001-001-000000002', detail: 'Cliente B' }],
    onSelect: (index) => { selected = index; },
  });
  const second = list.props.children[1];
  assert.equal(second.type, 'Pressable');
  assert.match(second.props.accessibilityLabel, /001-001-000000002, Cliente B/);
  second.props.onPress();
  assert.equal(selected, 1);
});
