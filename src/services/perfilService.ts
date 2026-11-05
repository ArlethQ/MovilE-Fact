import { apiRequest } from './apiClient';
import { appendMobileFile } from './mobileFileUpload';
import { ClienteTipoLookup, PerfilLookup, PerfilUpsert } from '../types/business';

type TipoClienteApi = {
  tclCodigo?: number;
  descripcion?: string;
  TclCodigo?: number;
  TclDescripcion?: string | null;
};

type PerfilApi = Omit<PerfilLookup, 'tiposCliente'> & {
  tiposCliente: TipoClienteApi[];
};

function normalizePerfilLookup(data: PerfilApi): PerfilLookup {
  return {
    perfil: data.perfil,
    tiposCliente: data.tiposCliente.map((tipo) => {
      const id = tipo.tclCodigo ?? tipo.TclCodigo ?? 0;
      return {
        tclCodigo: id,
        descripcion: id === 1 ? 'Persona Natural' : id === 2 ? 'Persona Juridica' : tipo.descripcion ?? tipo.TclDescripcion ?? '',
      };
    }),
    tiposIdentificacion: data.tiposIdentificacion ?? [],
  };
}

export async function getPerfil(userId: number) {
  const data = await apiRequest<PerfilApi>(`/api/perfil?idUsuario=${userId}`);
  return normalizePerfilLookup(data);
}

export function updatePerfil(userId: number, perfil: PerfilUpsert) {
  return apiRequest<void>(`/api/perfil/${userId}?idUsuario=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(perfil),
  });
}

export function uploadPerfilAvatar(userId: number, uri: string, fileName = 'avatar.jpg', mimeType = 'image/jpeg') {
  const formData = new FormData();
  appendMobileFile(formData, 'file', { uri, name: fileName });

  return apiRequest<{ avatarUrl: string }>(`/api/perfil/${userId}/avatar?idUsuario=${userId}`, {
    method: 'POST',
    body: formData,
  });
}
