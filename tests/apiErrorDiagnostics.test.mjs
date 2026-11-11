import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function createClient(body, development = true) {
  const logs = [];
  const requests = [];
  const context = {
    exports: {},
    require: () => ({ API_BASE_URL: 'https://efact.example.test' }),
    __DEV__: development,
    console: { error: (...args) => logs.push(args) },
    AbortController, FormData, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return url.endsWith('/api/auth/login')
        ? new Response('{}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'Auth_Session=test-session; Path=/; Secure' } })
        : new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json' } });
    },
  };
  vm.runInNewContext(compiled, context);
  return { ...context.exports, logs, requests };
}

test('Distingue el 400 de E-FACT del 500 del servicio de estampado y conserva la sesión', async () => {
  const client = createClient({ mensaje: 'An error occurred while processing your request.', estado: 500 });
  await client.apiRequest('/api/auth/login', { method: 'POST', body: '{}' });
  const form = new FormData();
  form.append('pdf', new Blob(['%PDF-1.7']), 'contrato.pdf');
  await assert.rejects(client.apiRequestBinary('/api/mobile/e-rubrica/documentos/firmar', { method: 'POST', body: form }), error => {
    assert.equal(error.status, 400);
    assert.equal(error.message, 'An error occurred while processing your request.');
    return true;
  });
  const [label, details] = client.logs[0];
  assert.equal(label, '[API ERROR]');
  assert.equal(details.status, 400);
  assert.equal(details.upstreamStatus, 500);
  assert.equal(details.bodyLength, 75);
  assert.equal(client.requests[1].options.credentials, 'include');
  assert.equal(client.requests[1].options.headers.Cookie, 'Auth_Session=test-session');
  assert.equal(client.requests[1].options.body, form);
  assert.equal(client.requests[1].options.headers['Content-Type'], undefined);
});

test('El diagnóstico incluye un identificador de seguimiento y excluye claves, certificados y cookies', async () => {
  const client = createClient({ mensaje: 'Error del servicio', estado: 422, traceId: '00-aabbcc-112233-00',
    clave: 'secret-test-password', certificado: 'secret-test-certificate', cookie: 'secret-test-cookie' });
  await assert.rejects(client.apiRequestBinary('/firmar', { method: 'POST', body: new FormData() }));
  assert.equal(client.logs[0][1].traceId, '00-aabbcc-112233-00');
  assert.equal(client.logs[0][1].upstreamStatus, 422);
  assert.doesNotMatch(JSON.stringify(client.logs), /secret-test-/);
});

test('No interpreta estados de negocio ni valores fuera del rango HTTP como errores del servicio', async () => {
  for (const estado of ['activo', '500', -1, 42, 600, 500.5]) {
    const client = createClient({ mensaje: 'Error', estado, traceId: 'untrusted\nlog entry' });
    await assert.rejects(client.apiRequestBinary('/firmar'));
    assert.equal(client.logs[0][1].upstreamStatus, undefined);
    assert.equal(client.logs[0][1].traceId, undefined);
  }
});

test('El diagnóstico sigue desactivado fuera de desarrollo', async () => {
  const client = createClient({ mensaje: 'Error', estado: 500 }, false);
  await assert.rejects(client.apiRequestBinary('/firmar'));
  assert.equal(client.logs.length, 0);
});
