import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { buildSignatureConfirmation } from '../src/utils/signatureConfirmation.ts';

const source = readFileSync(new URL('../src/components/erubrica/ERubricaMobileScreen.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ERubricaMobileScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function loadFunction(name, bindings) {
  let target;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) target = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) target = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(target, `Missing function: ${name}`);
  const compiled = ts.transpileModule(`exports.action = ${target.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, Uint8Array, ...bindings };
  vm.runInNewContext(compiled, context);
  return context.exports.action;
}

function confirmationFlow(overrides = {}) {
  const alerts = [];
  const previews = [];
  let signatures = 0;
  const confirm = loadFunction('confirmSignPdfDocument', {
    pdfFile: { uri: 'file:///cache/contrato.pdf', name: 'contrato.pdf' },
    signaturePlacements: [{ pagina: 2, xMm: 10, yMm: 15, anchoMm: 50.3, rotacion: 0 }],
    selloAvanzado: false,
    firmaDetalleActiva: { nombreTitular: 'Titular Ejemplo' },
    firmaEmisores: [],
    buildSignatureConfirmation,
    Alert: { alert: (...args) => alerts.push(args) },
    onPreviewPdf: file => previews.push(file),
    signPdfDocument: async () => { signatures++; },
    ...overrides,
  });
  confirm();
  return { alerts, previews, get signatures() { return signatures; } };
}

test('Revisar abre el PDF seleccionado sin ejecutar una firma en ninguno de los modos', () => {
  for (const selloAvanzado of [false, true]) {
    const flow = confirmationFlow({ selloAvanzado });
    const [, message, buttons] = flow.alerts[0];
    assert.match(message, selloAvanzado ? /Firma avanzada/ : /Firma simple/);
    assert.equal(flow.signatures, 0);
    buttons.find(button => button.text === 'Revisar').onPress();
    assert.equal(flow.previews.length, 1);
    assert.equal(flow.previews[0].uri, 'file:///cache/contrato.pdf');
    assert.equal(flow.previews[0].name, 'contrato.pdf');
    assert.equal(flow.previews[0].mimeType, 'application/pdf');
    assert.equal(flow.signatures, 0);
  }
});

test('Firmar ahora ejecuta la firma solo después de confirmar', () => {
  const flow = confirmationFlow();
  assert.equal(flow.signatures, 0);
  flow.alerts[0][2].find(button => button.text === 'Firmar ahora').onPress();
  assert.equal(flow.signatures, 1);
  assert.equal(flow.previews.length, 0);
});

test('La confirmación sigue requiriendo un PDF y al menos una ubicación', () => {
  for (const overrides of [{ pdfFile: null }, { signaturePlacements: [] }]) {
    const flow = confirmationFlow(overrides);
    assert.equal(flow.alerts.length, 1);
    assert.equal(flow.alerts[0][2], undefined);
    assert.equal(flow.previews.length, 0);
    assert.equal(flow.signatures, 0);
  }
});

test('La URI del archivo de caché se entrega después de completar la escritura', async () => {
  let finish;
  let written;
  const pendingWrite = new Promise(resolve => { finish = resolve; });
  const write = loadFunction('writeBinaryCacheFile', {
    File: class {
      uri = 'file:///cache/firmado.pdf';
      write(bytes) { written = bytes; return pendingWrite; }
    },
    Paths: { cache: {} },
  });
  let completed = false;
  const result = write('firmado.pdf', Uint8Array.of(37, 80, 68, 70).buffer).then(uri => {
    completed = true;
    return uri;
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  assert.deepEqual([...written], [37, 80, 68, 70]);
  finish();
  assert.equal(await result, 'file:///cache/firmado.pdf');
});

test('Un fallo al guardar el archivo se propaga y no devuelve una URI prematura', async () => {
  const failure = new Error('No space left');
  const write = loadFunction('writeBinaryCacheFile', {
    File: class { async write() { throw failure; } },
    Paths: { cache: {} },
  });
  await assert.rejects(write('firmado.pdf', new ArrayBuffer(0)), error => error === failure);
});
