import type { Emisor } from '../types/business';

export function getFirmaFileName(path?: string | null) {
  if (!path?.trim()) return null;
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

export function hasFirmaConfigured(emisor: Emisor) {
  return Boolean(emisor.pathCertificado?.trim() && emisor.tieneClaveCertificadoConfigurada);
}
