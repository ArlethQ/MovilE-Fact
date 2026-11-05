import { DynamicMenu } from '../types/auth';
import { MENUS_BY_ROLE_PATH } from '../config/api';
import { apiRequest } from './apiClient';

type MenuResponse = DynamicMenu[] | { menus?: DynamicMenu[]; data?: DynamicMenu[]; items?: DynamicMenu[] };

export function hasMenusByRolEndpoint() {
  return Boolean(MENUS_BY_ROLE_PATH);
}

export async function getMenusByRol(userId: number, idTipoUsuario?: number) {
  if (!MENUS_BY_ROLE_PATH) {
    return [];
  }

  const params = [`userId=${encodeURIComponent(String(userId))}`];

  if (idTipoUsuario) {
    params.push(`idTipoUsuario=${encodeURIComponent(String(idTipoUsuario))}`);
  }

  const separator = MENUS_BY_ROLE_PATH.includes('?') ? '&' : '?';
  const response = await apiRequest<MenuResponse>(`${MENUS_BY_ROLE_PATH}${separator}${params.join('&')}`);

  if (Array.isArray(response)) {
    return response;
  }

  return response.menus ?? response.data ?? response.items ?? [];
}
