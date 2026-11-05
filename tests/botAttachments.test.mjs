import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/botService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, require: () => ({}), globalThis };
vm.runInNewContext(compiled, sandbox);
const { inferERubricaAttachmentAction: infer } = sandbox.exports;

assert.equal(infer('Adjunta el archivo PDF.', ['Quiero firmar un contrato']), 'abrir_firma_pdf');
assert.equal(infer('Selecciona el PDF.', ['Quiero validar la firma de un documento']), 'abrir_validar_firma');
assert.equal(infer('Sube el RUC en PDF.', []), 'abrir_solicitud');
assert.equal(infer('Adjunta la cédula frontal.', []), 'abrir_solicitud');
assert.equal(infer('Selecciona el archivo .p12.', []), 'abrir_configuracion_firma');
assert.equal(infer('Adjunta el comprobante de pago.', []), 'adjuntar_comprobante_pago');
assert.equal(infer('El documento fue firmado.', []), undefined);
assert.equal(infer('Puedes consultar los planes disponibles.', []), undefined);
console.log('Adjuntos: firma, validación, solicitud, certificado y comprobante correctos.');
