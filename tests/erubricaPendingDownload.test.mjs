import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const baseUrl = 'https://efact.example.test';
const pdf = new TextEncoder().encode('%PDF-1.7\nDocumento de prueba');

function loadModule(path, require, bindings = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require, ...bindings };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

function downloadClient(reply, visibleCookie = true) {
  const requests = [];
  let authFailures = 0;
  const client = loadModule('../src/services/apiClient.ts', () => ({ API_BASE_URL: baseUrl }), {
    __DEV__: false, AbortController, FormData, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return url.endsWith('/api/auth/login')
        ? new Response('{}', { headers: visibleCookie ? { 'set-cookie': 'Auth_Session=test-session; Path=/; Secure' } : {} })
        : reply();
    },
  });
  client.setAuthFailureHandler(() => { authFailures++; });
  const service = loadModule('../src/services/erubricaMobileService.ts', name => {
    if (name === './apiClient') return client;
    return {};
  });
  return { client, service, requests, get authFailures() { return authFailures; } };
}

for (const visibleCookie of [true, false]) {
  test(`Descarga por E-FACT con la sesión del cliente, cookie visible: ${visibleCookie}`, async () => {
    const flow = downloadClient(() => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }), visibleCookie);
    await flow.client.apiRequest('/api/auth/login', { method: 'POST', body: '{}' });
    const name = 'Documento #1 & anexo.pdf';
    const result = await flow.service.descargarERubricaDocumentoPendiente(name);
    const request = flow.requests.at(-1);
    assert.equal(request.url, `${baseUrl}/api/mobile/e-rubrica/documentos/pendientes/archivo?nombreArchivo=${encodeURIComponent(name)}`);
    assert.equal(request.options.credentials, 'include');
    assert.equal(request.options.headers.Cookie, visibleCookie ? 'Auth_Session=test-session' : undefined);
    assert.deepEqual([...new Uint8Array(result.bytes)], [...pdf]);
  });
}

test('Una sesión vencida conserva el 401 y activa el manejo de autenticación existente', async () => {
  const flow = downloadClient(() => new Response('{"mensaje":"Sesión vencida"}', {
    status: 401, headers: { 'content-type': 'application/json' },
  }));
  await flow.client.apiRequest('/api/auth/login', { method: 'POST', body: '{}' });
  await assert.rejects(flow.service.descargarERubricaDocumentoPendiente('documento.pdf'), error => error.status === 401);
  assert.equal(flow.authFailures, 1);
  assert.equal(flow.client.getAuthSessionCookie(), null);
});

for (const [content, contentType, expected] of [
  ['<!doctype html><html>Acceso</html>', 'text/html; charset=utf-8', /página web/],
  ['{"mensaje":"Documento no disponible"}', 'application/json', /PDF válido/],
  ['%PD', 'application/pdf', /PDF válido/],
  ['', 'application/pdf', /PDF válido/],
]) {
  test(`Rechaza contenido que no es PDF aunque la descarga responda 200: ${contentType}, ${content.length} bytes`, async () => {
    const flow = downloadClient(() => new Response(content, { headers: { 'content-type': contentType } }));
    await assert.rejects(flow.service.descargarERubricaDocumentoPendiente('documento.pdf'), error => {
      assert.ok(error instanceof flow.client.ApiError);
      assert.match(error.message, expected);
      return true;
    });
  });
}

test('Acepta un PDF válido aunque el servidor use application/octet-stream', async () => {
  const flow = downloadClient(() => new Response(pdf, { headers: { 'content-type': 'application/octet-stream' } }));
  const result = await flow.service.descargarERubricaDocumentoPendiente('documento.pdf');
  assert.deepEqual([...new Uint8Array(result.bytes)], [...pdf]);
});

const screenSource = readFileSync(new URL('../src/components/erubrica/ERubricaMobileScreen.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('screen.tsx', screenSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let selectionSource;
function findSelection(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'usarDocumentoPendiente') {
    selectionSource = node.initializer.getText(ast);
  }
  ts.forEachChild(node, findSelection);
}
findSelection(ast);
assert.ok(selectionSource);
const compiledSelection = ts.transpileModule(`exports.select = ${selectionSource};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function selectionFlow(flow, write) {
  const state = { writes: [], alerts: [], loading: [] };
  const context = {
    exports: {}, ApiError: flow.client.ApiError,
    descargarERubricaDocumentoPendiente: flow.service.descargarERubricaDocumentoPendiente,
    writeBinaryCacheFile: async (name, bytes) => {
      state.writes.push({ name, bytes });
      await write?.();
      return 'file:///project-cache/documento.pdf';
    },
    buildDeviceFileName: name => name,
    setLoadingDocumentosPendientes: value => state.loading.push(value),
    selectTab: value => { state.tab = value; },
    setPdfFile: value => { state.pdf = value; },
    setDocumentoPendienteSeleccionado: value => { state.pending = value; },
    setSignedFileUri: value => { state.signed = value; },
    setValidationPage: value => { state.page = value; },
    setValidationPageCount: value => { state.pageCount = value; },
    reiniciarUbicacionesFirma: () => { state.reset = true; },
    seleccionarCantidadUbicaciones: () => { state.locations = true; },
    Alert: { alert: (...args) => state.alerts.push(args) },
  };
  vm.runInNewContext(compiledSelection, context);
  return { select: context.exports.select, state };
}

const document = { nombreArchivo: 'guardado.pdf', nombreDocumento: 'Contrato.pdf', url: 'http://127.0.0.1/documento.pdf' };

test('Selecciona el documento y restablece su vista solo cuando termina de guardar el PDF', async () => {
  let finish;
  const pendingWrite = new Promise(resolve => { finish = resolve; });
  const flow = downloadClient(() => new Response(pdf, { headers: { 'content-type': 'application/pdf' } }));
  const selection = selectionFlow(flow, () => pendingWrite);
  const result = selection.select(document);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(selection.state.tab, undefined);
  assert.equal(selection.state.pdf, undefined);
  finish();
  await result;
  assert.equal(selection.state.pdf.uri, 'file:///project-cache/documento.pdf');
  assert.equal(selection.state.pending, 'guardado.pdf');
  assert.equal(selection.state.tab, 'firmar');
  assert.equal(selection.state.signed, null);
  assert.equal(selection.state.page, 1);
  assert.equal(selection.state.pageCount, 1);
  assert.equal(selection.state.reset, true);
  assert.equal(selection.state.locations, true);
  assert.deepEqual(selection.state.loading, [true, false]);
  assert.ok(flow.requests[0].url.startsWith(baseUrl));
});

test('No guarda ni selecciona una respuesta HTML como documento pendiente', async () => {
  const flow = downloadClient(() => new Response('<html>Acceso</html>', { headers: { 'content-type': 'text/html' } }));
  const selection = selectionFlow(flow);
  await selection.select(document);
  assert.equal(selection.state.writes.length, 0);
  assert.equal(selection.state.pdf, undefined);
  assert.equal(selection.state.pending, undefined);
  assert.match(selection.state.alerts[0][1], /página web/);
  assert.deepEqual(selection.state.loading, [true, false]);
});
