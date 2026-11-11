import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const requests = [];
const source = readFileSync(new URL('../src/services/erubricaMobileService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const binaryResult = { bytes: new ArrayBuffer(0) };
const sandbox = { exports: {}, require: () => ({
  apiRequestBinary: async (path, options) => { requests.push({ path, options }); return binaryResult; },
}) };
vm.runInNewContext(compiled, sandbox);

for (const [mode, expected] of [[undefined, 'false'], [false, 'false'], [true, 'true']]) {
  const form = new FormData();
  form.append('pdf', new Blob(['%PDF-1.7']), 'contrato.pdf');
  form.append('idEmisor', '42');
  form.append('documentoPendiente', 'borrador.pdf');
  const result = await sandbox.exports.firmarERubricaDocumento(form, mode);
  const request = requests.at(-1);
  assert.equal(result, binaryResult);
  assert.equal(request.path, '/api/mobile/e-rubrica/documentos/firmar');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.body, form);
  assert.equal(request.options.headers, undefined);
  assert.deepEqual(form.getAll('selloAvanzado'), [expected]);
  assert.equal(form.get('pdf').name, 'contrato.pdf');
  assert.equal(form.get('idEmisor'), '42');
  assert.equal(form.get('documentoPendiente'), 'borrador.pdf');
}
