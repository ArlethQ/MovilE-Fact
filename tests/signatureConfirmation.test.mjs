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
