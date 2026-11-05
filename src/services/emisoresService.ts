import { apiRequest } from './apiClient';
import { appendMobileFile } from './mobileFileUpload';
import { Emisor, EmisorUpsert, FirmaEstado } from '../types/business';

type EmisorApi = Emisor & {
  id?: number;
  Id?: number;
  Codigo?: number;
  RazonSocial?: string | null;
  Ruc?: string | null;
  RUC?: string | null;
  NomComercial?: string | null;
  DirEstablecimiento?: string | null;
  Email?: string | null;
  LlevaContabilidad?: string | null;
  llevacontabilidad?: string | null;
  LogoImagen?: string | null;
  DireccionMatriz?: string | null;
  ClaveInterna?: string | null;
  Retenciones?: string | null;
  PathCertificado?: string | null;
  ClaveCertificado?: string | null;
  TieneClaveCertificadoConfigurada?: boolean;
  tieneClaveCertificadoConfigurada?: boolean;
  EliminarClaveCertificado?: boolean;
  Telefono?: string | null;
  Estado?: boolean | null;
  IdUsuario?: number | null;
  CodEstablecimiento?: string | null;
  CodPuntoEmision?: string | null;
};

export type EmisorSriLookup = {
  found: boolean;
  mensaje?: string | null;
  ruc?: string | null;
  razonSocial?: string | null;
  nomComercial?: string | null;
  dirEstablecimiento?: string | null;
  direccionMatriz?: string | null;
  codEstablecimiento?: string | null;
  llevaContabilidad?: string | null;
  retenciones?: string | null;
};

function normalizeEmisor(emisor: EmisorApi): Emisor {
  return {
    codigo: emisor.codigo ?? emisor.Codigo ?? 0,
    id: emisor.id ?? emisor.Id ?? emisor.codigo ?? emisor.Codigo ?? 0,
    razonSocial: emisor.razonSocial ?? emisor.RazonSocial,
    ruc: emisor.ruc ?? emisor.Ruc ?? emisor.RUC,
    nomComercial: emisor.nomComercial ?? emisor.NomComercial,
    dirEstablecimiento: emisor.dirEstablecimiento ?? emisor.DirEstablecimiento,
    email: emisor.email ?? emisor.Email,
    llevaContabilidad: emisor.llevaContabilidad ?? emisor.LlevaContabilidad ?? emisor.llevacontabilidad,
    logoImagen: emisor.logoImagen ?? emisor.LogoImagen,
    direccionMatriz: emisor.direccionMatriz ?? emisor.DireccionMatriz,
    claveInterna: emisor.claveInterna ?? emisor.ClaveInterna,
    retenciones: emisor.retenciones ?? emisor.Retenciones,
    pathCertificado: emisor.pathCertificado ?? emisor.PathCertificado,
    claveCertificado: emisor.claveCertificado ?? emisor.ClaveCertificado,
    tieneClaveCertificadoConfigurada:
      emisor.tieneClaveCertificadoConfigurada ?? emisor.TieneClaveCertificadoConfigurada ?? false,
    eliminarClaveCertificado: emisor.eliminarClaveCertificado ?? emisor.EliminarClaveCertificado ?? false,
    telefono: emisor.telefono ?? emisor.Telefono,
    estado: emisor.estado ?? emisor.Estado,
    idUsuario: emisor.idUsuario ?? emisor.IdUsuario,
    codEstablecimiento: emisor.codEstablecimiento ?? emisor.CodEstablecimiento,
    codPuntoEmision: emisor.codPuntoEmision ?? emisor.CodPuntoEmision,
  };
}

function toApiPayload(emisor: EmisorUpsert) {
  return {
    Codigo: emisor.codigo,
    RazonSocial: emisor.razonSocial,
    Ruc: emisor.ruc,
    NomComercial: emisor.nomComercial,
    DirEstablecimiento: emisor.dirEstablecimiento,
    Email: emisor.email,
    LlevaContabilidad: emisor.llevaContabilidad,
    LogoImagen: emisor.logoImagen,
    DireccionMatriz: emisor.direccionMatriz,
    ClaveInterna: emisor.claveInterna,
    Retenciones: emisor.retenciones,
    PathCertificado: emisor.pathCertificado,
    ClaveCertificado: emisor.claveCertificado,
    EliminarClaveCertificado: emisor.eliminarClaveCertificado ?? false,
    Telefono: emisor.telefono,
    Estado: emisor.estado ?? true,
    IdUsuario: emisor.idUsuario,
    CodEstablecimiento: emisor.codEstablecimiento,
    CodPuntoEmision: emisor.codPuntoEmision,
  };
}

export async function getEmisores(userId: number) {
  const emisores = await apiRequest<EmisorApi[]>(`/api/emisores?idUsuario=${userId}`);
  return emisores.map(normalizeEmisor);
}

export async function getEmisor(userId: number, codigo: number) {
  const emisor = await apiRequest<EmisorApi>(`/api/emisores/${codigo}?idUsuario=${userId}`);
  return normalizeEmisor(emisor);
}

export function consultarEmisorSri(ruc: string) {
  const rucNormalizado = ruc.replace(/\D/g, '');
  return apiRequest<EmisorSriLookup>(`/api/emisores/consulta-ruc?ruc=${encodeURIComponent(rucNormalizado)}`, {
    timeoutMs: 15000,
  });
}

export async function createEmisor(userId: number, emisor: EmisorUpsert) {
  const response = await apiRequest<EmisorApi>('/api/emisores', {
    method: 'POST',
    body: JSON.stringify(toApiPayload({ ...emisor, idUsuario: userId, estado: true })),
  });
  return normalizeEmisor(response);
}

export function updateEmisor(userId: number, codigo: number, emisor: EmisorUpsert) {
  return apiRequest<void>(`/api/emisores/${codigo}`, {
    method: 'PUT',
    body: JSON.stringify(toApiPayload({ ...emisor, codigo, idUsuario: userId })),
  });
}

export function deleteEmisor(userId: number, codigo: number) {
  return apiRequest<void>(`/api/emisores/${codigo}/desactivar?idUsuario=${userId}`, {
    method: 'PUT',
  });
}

export function getFirmaEstado(userId: number, codigo: number) {
  return apiRequest<FirmaEstado>(`/api/emisores/${codigo}/firma/estado?idUsuario=${userId}`, {
    timeoutMs: 12000,
  });
}

export type FirmaArchivoUpload = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export async function uploadFirmaArchivo(userId: number, codigo: number, archivo: FirmaArchivoUpload) {
  const formData = new FormData();
  appendMobileFile(formData, 'archivo', archivo);

  return apiRequest<{ pathCertificado: string; nombreArchivo?: string }>(`/api/emisores/${codigo}/firma/archivo?idUsuario=${userId}`, {
    method: 'POST',
    body: formData,
    timeoutMs: 30000,
  });
}
