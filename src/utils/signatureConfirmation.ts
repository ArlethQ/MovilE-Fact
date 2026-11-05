export function buildSignatureConfirmation(input: {
  documentName: string;
  placementCount: number;
  certificateHolder?: string | null;
}) {
  const placementLabel = input.placementCount === 1 ? '1 ubicación' : `${input.placementCount} ubicaciones`;
  const certificate = input.certificateHolder?.trim() || 'certificado previamente configurado';

  return {
    title: 'Confirmar firma',
    message: `Vas a firmar ${input.documentName} en ${placementLabel} con el certificado de ${certificate}. Esta acción generará un nuevo PDF firmado.`,
  };
}
