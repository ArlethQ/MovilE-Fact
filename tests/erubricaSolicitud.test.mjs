import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const typesSource = read('../src/features/erubrica/erubricaTypes.ts');
const screen = ts.createSourceFile('ERubricaMobileScreen.tsx', read('../src/components/erubrica/ERubricaMobileScreen.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function load(source, globals = {}) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const context = { exports: {}, ...globals };
  vm.runInNewContext(outputText, context);
  return context.exports;
}

function handler(name, globals) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(screen) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(screen);
  assert.ok(initializer, name);
  return load(`export const handler = ${initializer.getText(screen)};`, globals).handler;
}

const { SOLICITUD_FORM_INITIAL, SOLICITUD_FILES_INITIAL } = load(typesSource);

function prepareSubmission(solicitudPersona, solicitudForm, solicitudPlan, requiereRuc = false) {
  return handler('buildSolicitudFormData', {
    FormData, solicitudPersona, solicitudForm, solicitudPlan, requiereRuc,
    appendSolicitudFile: () => {},
  })();
}

test('Una solicitud nueva deja vacíos los datos personales y envía el formato P12 al confirmar', () => {
  let form;
  const select = handler('selectSolicitudPersona', {
    solicitudPersona: null, SOLICITUD_FORM_INITIAL, SOLICITUD_FILES_INITIAL,
    setSolicitudPersona: () => {}, setSolicitudFiles: () => {}, setSolicitudId: () => {},
    setSolicitudForm: (value) => { form = value; },
  });
  select('Persona natural con cédula');
  for (const [key, value] of Object.entries(form)) {
    if (key !== 'poseeRuc') assert.equal(value, '', key);
  }

  const payload = prepareSubmission('Persona natural con cédula', { ...form, nombres: 'Nombre de prueba' }, { label: '7 días' });
  assert.equal(payload.get('formatoFirma'), 'ARCHIVO_P12');
  assert.equal(payload.get('vigencia'), '7 días');
  assert.equal(payload.get('nombres'), 'Nombre de prueba');
});

test('Volver a seleccionar el titular de un borrador conserva lo escrito y los adjuntos', () => {
  const unexpectedReset = () => assert.fail('Se reinició una solicitud con el mismo tipo de titular');
  const select = handler('selectSolicitudPersona', {
    solicitudPersona: 'Persona natural con RUC', SOLICITUD_FORM_INITIAL, SOLICITUD_FILES_INITIAL,
    setSolicitudPersona: unexpectedReset, setSolicitudForm: unexpectedReset,
    setSolicitudFiles: unexpectedReset, setSolicitudId: unexpectedReset,
  });
  select('Persona natural con RUC');
});

test('Los borradores móviles y web conservan los datos y envían el formato exigido por la API', () => {
  const recover = handler('recuperarSolicitudBorrador', { SOLICITUD_FORM_INITIAL });
  const drafts = [
    { solicitudPlan: { label: '2 años', price: 31 }, solicitudPersona: 'Persona natural con RUC', solicitudForm: { nombres: 'Nombre guardado', nacionalidad: 'COLOMBIANA' } },
    { solVigencia: '2 ANIOS', solTipoPersona: 'NATURAL', solTieneRuc: true, solNombres: 'Nombre guardado', solNacionalidad: 'COLOMBIANA' },
  ];
  for (const draft of drafts) {
    const { persona, plan, form } = recover(JSON.stringify(draft));
    const payload = prepareSubmission(persona, { ...SOLICITUD_FORM_INITIAL, ...form }, plan, true);
    assert.equal(payload.get('formatoFirma'), 'ARCHIVO_P12');
    assert.equal(payload.get('tipoPersona'), 'Persona natural con RUC');
    assert.equal(payload.get('poseeRuc'), 'true');
    assert.equal(payload.get('vigencia'), '2 años');
    assert.equal(payload.get('nombres'), 'Nombre guardado');
    assert.equal(payload.get('nacionalidad'), 'COLOMBIANA');
  }
  const incomplete = recover(JSON.stringify({ SolTipoPersona: 'NATURAL' }));
  assert.equal(incomplete.form.nacionalidad, '');
});

test('La vigencia incompatible para un representante regresa al primer paso', () => {
  let step;
  const validate = handler('validateSolicitudPlan', {
    vigenciaValidaParaTitular: false,
    setSolicitudStep: (value) => { step = value; },
    Alert: { alert: (_, message) => assert.match(message, /al menos 1 año/) },
  });
  assert.equal(validate(), false);
  assert.equal(step, 1);
});