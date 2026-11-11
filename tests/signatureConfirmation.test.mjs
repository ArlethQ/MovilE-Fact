import assert from 'node:assert/strict';

const { buildSignatureConfirmation } = await import('../src/utils/signatureConfirmation.ts');

const confirmation = buildSignatureConfirmation({
  documentName: 'contrato-septiembre.pdf',
  placementCount: 2,
  certificateHolder: 'Comercial Ejemplo S.A.',
});

assert.equal(confirmation.title, 'Confirmar firma');
assert.match(confirmation.message, /contrato-septiembre\.pdf/);
assert.match(confirmation.message, /2 ubicaciones/);
assert.match(confirmation.message, /Comercial Ejemplo S\.A\./);
assert.match(confirmation.message, /Firma simple/);

const advanced = buildSignatureConfirmation({
  documentName: 'contrato.pdf',
  placementCount: 1,
  certificateHolder: '  Titular Ejemplo  ',
  selloAvanzado: true,
});
assert.match(advanced.message, /Firma avanzada/);
assert.match(advanced.message, /1 ubicación con el certificado de Titular Ejemplo\./);
assert.doesNotMatch(advanced.message, /Firma simple/);

const simple = buildSignatureConfirmation({ documentName: 'anexo.pdf', placementCount: 2, selloAvanzado: false });
assert.match(simple.message, /Firma simple/);
assert.match(simple.message, /certificado previamente configurado/);
