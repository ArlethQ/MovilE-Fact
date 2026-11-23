import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path, require) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const context = { exports: {}, require };
  vm.runInNewContext(outputText, context);
  return context.exports;
}

const sourceUri = 'content://com.android.providers.downloads.documents/document/1';
const cacheUri = 'file:///experience-cache';
const options = { type: ['image/*', 'application/pdf'], extensions: ['jpg', 'pdf'], maxBytes: 10, invalidSelection: 'Archivo no válido' };

function setup({ platform = 'android', asset = { uri: sourceUri, name: 'documento.JPG' }, cachedSize = 6, copyError } = {}) {
  const calls = [];

  class File {
    constructor(base, name) {
      this.uri = name ? `${base}/${name}` : base;
      this.size = cachedSize;
    }
    async copy(destination) {
      calls.push(['copy', this.uri, destination.uri]);
      if (copyError) throw copyError;
    }
    delete() {
      calls.push(['delete', this.uri]);
    }
  }

  const fileSystem = { File, Paths: { cache: cacheUri } };
  const { pickReadableDocument } = loadModule('../src/utils/readableDocument.ts', (name) => {
    if (name === 'expo-file-system') return fileSystem;
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === './fileUtils') return { buildDeviceFileName: (_, extension) => `adjunto.${extension}` };
    assert.equal(name, 'expo-document-picker');
    return {
      async getDocumentAsync({ type, copyToCacheDirectory }) {
        calls.push(['picker', type, copyToCacheDirectory]);
        return asset ? { canceled: false, assets: [asset] } : { canceled: true };
      },
    };
  });
  const { appendMobileFile } = loadModule('../src/services/mobileFileUpload.ts', () => fileSystem);
  return { pickReadableDocument, appendMobileFile, calls };
}

test('Android adjunta la copia del documento en la caché de la experiencia con el nombre original', async () => {
  const { pickReadableDocument, appendMobileFile, calls } = setup();
  const file = await pickReadableDocument(options);
  assert.deepEqual(calls, [
    ['picker', options.type, false],
    ['copy', sourceUri, `${cacheUri}/adjunto.jpg`],
  ]);
  assert.equal(file.size, 6);
  appendMobileFile({
    append(field, blob, filename) {
      assert.equal(field, 'cedulaFrontal');
      assert.equal(blob.uri, `${cacheUri}/adjunto.jpg`);
      assert.equal(filename, 'documento.JPG');
    },
  }, 'cedulaFrontal', file);
});

test('iOS conserva la copia del selector y cancelar no crea un archivo', async () => {
  const asset = { uri: 'file:///picker/documento.pdf', name: 'documento.pdf', size: 6 };
  const ios = setup({ platform: 'ios', asset });
  assert.equal(await ios.pickReadableDocument(options), asset);
  assert.deepEqual(ios.calls, [['picker', options.type, true]]);

  const canceled = setup({ asset: null });
  assert.equal(await canceled.pickReadableDocument(options), null);
  assert.deepEqual(canceled.calls, [['picker', options.type, false]]);
});

test('Android rechaza extensiones inválidas antes de copiar y elimina copias vacías o demasiado grandes', async () => {
  const invalid = setup({ asset: { uri: sourceUri, name: 'documento.exe', size: 6 } });
  await assert.rejects(invalid.pickReadableDocument(options), /Archivo no válido/);
  assert.equal(invalid.calls.length, 1);

  for (const cachedSize of [0, 11]) {
    const tooLarge = setup({ cachedSize });
    await assert.rejects(tooLarge.pickReadableDocument(options), /Archivo no válido/);
    assert.deepEqual(tooLarge.calls.at(-1), ['delete', `${cacheUri}/adjunto.jpg`]);
  }
});

test('Si Android rechaza el acceso al documento, la selección devuelve un error antes del envío', async () => {
  const copyError = new Error('Missing READ permission');
  const { pickReadableDocument } = setup({ copyError });
  await assert.rejects(pickReadableDocument(options), (error) => {
    assert.equal(error.cause, copyError);
    assert.match(error.message, /Vuelve a seleccionarlo/);
    return true;
  });
});