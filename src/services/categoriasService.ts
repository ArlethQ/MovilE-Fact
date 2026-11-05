import { apiRequest } from './apiClient';
import { CATEGORIAS_PATH, PRODUCTOS_PATH, SUBCATEGORIAS_PATH } from '../config/api';
import { CategoriaCatalogo, CategoriaUpsert, SubcategoriaCatalogo, SubcategoriaUpsert } from '../types/business';

type CategoriaApi = CategoriaCatalogo & {
  [key: string]: unknown;
  IdCategoria?: number;
  Codigo?: number;
  CodCategoria?: number;
  CatCodigo?: number;
  catCodigo?: number;
  catcodigo?: number;
  Descripcion?: string | null;
  Nombre?: string | null;
  Estado?: boolean | null;
};

type SubcategoriaApi = SubcategoriaCatalogo & {
  [key: string]: unknown;
  IdSubcategoria?: number;
  Codigo?: number;
  CodSubcategoria?: number;
  SubCodigo?: number;
  subCodigo?: number;
  subcodigo?: number;
  IdCategoria?: number | null;
  Categoria?: number | null;
  DescripcionCategoria?: string | null;
  CategoriaDescripcion?: string | null;
  Descripcion?: string | null;
  Nombre?: string | null;
  Estado?: boolean | null;
};

const CATALOG_TIMEOUT_MS = 8000;

type ApiListResponse<T> = T[] | {
  data?: T[];
  Data?: T[];
  datos?: T[];
  Datos?: T[];
  items?: T[];
  Items?: T[];
  registros?: T[];
  Registros?: T[];
  result?: T[] | ApiListResponse<T>;
  Result?: T[] | ApiListResponse<T>;
  value?: T[];
  Value?: T[];
};

function unwrapList<T>(response: ApiListResponse<T>) {
  if (Array.isArray(response)) return response;

  const list =
    response.data ??
    response.Data ??
    response.datos ??
    response.Datos ??
    response.items ??
    response.Items ??
    response.registros ??
    response.Registros ??
    response.result ??
    response.Result ??
    response.value ??
    response.Value;

  if (!list) return [];
  if (Array.isArray(list)) return list;

  return unwrapList(list);
}

function pickValue<T>(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value as T;
  }

  return undefined;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeCategoria(categoria: CategoriaApi): CategoriaCatalogo {
  return {
    idCategoria: normalizeOptionalNumber(pickValue(categoria, ['idCategoria', 'IdCategoria', 'codCategoria', 'CodCategoria', 'codigo', 'Codigo', 'CatCodigo', 'catCodigo', 'catcodigo'])) ?? 0,
    descripcion: String(pickValue(categoria, ['descripcion', 'Descripcion', 'nombre', 'Nombre']) ?? ''),
    estado: categoria.estado ?? categoria.Estado,
  };
}

function normalizeSubcategoria(subcategoria: SubcategoriaApi): SubcategoriaCatalogo {
  return {
    idSubcategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idSubcategoria', 'IdSubcategoria', 'codSubcategoria', 'CodSubcategoria', 'codigo', 'Codigo', 'SubCodigo', 'subCodigo', 'subcodigo'])) ?? 0,
    idCategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idCategoria', 'IdCategoria', 'categoria', 'Categoria', 'categoriaId', 'CategoriaId'])),
    categoriaDescripcion:
      subcategoria.categoriaDescripcion ??
      subcategoria.CategoriaDescripcion ??
      subcategoria.DescripcionCategoria,
    descripcion: String(pickValue(subcategoria, ['descripcion', 'Descripcion', 'nombre', 'Nombre']) ?? ''),
    estado: subcategoria.estado ?? subcategoria.Estado,
  };
}

async function requestFirstList<T>(paths: string[]) {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const response = await apiRequest<ApiListResponse<T>>(path, { timeoutMs: CATALOG_TIMEOUT_MS, suppressErrorLog: true });
      return unwrapList(response);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function getCategorias(userId: number, incluirInactivos = false) {
  const params = `userId=${userId}&incluirInactivos=${incluirInactivos}`;
  const categorias = await requestFirstList<CategoriaApi>([
    `${CATEGORIAS_PATH}?${params}`,
    `${PRODUCTOS_PATH}/categorias?${params}`,
    `${PRODUCTOS_PATH}/categorias?${params.replace('userId=', 'idUsuario=')}`,
  ]);

  return categorias.map(normalizeCategoria);
}

export async function createCategoria(userId: number, categoria: CategoriaUpsert) {
  return apiRequest<{ idCategoria?: number; IdCategoria?: number }>(`${CATEGORIAS_PATH}?userId=${userId}`, {
    method: 'POST',
    body: JSON.stringify(categoria),
  });
}

export async function updateCategoria(userId: number, idCategoria: number, categoria: CategoriaUpsert) {
  return apiRequest<void>(`${CATEGORIAS_PATH}/${idCategoria}?userId=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(categoria),
  });
}

export async function deleteCategoria(userId: number, idCategoria: number) {
  return apiRequest<void>(`${CATEGORIAS_PATH}/${idCategoria}/desactivar?userId=${userId}`, {
    method: 'PUT',
  });
}

export async function getSubcategorias(userId: number, incluirInactivos = false) {
  const params = `userId=${userId}&incluirInactivos=${incluirInactivos}`;
  const subcategorias = await requestFirstList<SubcategoriaApi>([
    `${SUBCATEGORIAS_PATH}?${params}`,
    `${PRODUCTOS_PATH}/subcategorias?${params}`,
    `${PRODUCTOS_PATH}/subcategorias?${params.replace('userId=', 'idUsuario=')}`,
  ]);

  return subcategorias.map(normalizeSubcategoria);
}

export async function createSubcategoria(userId: number, subcategoria: SubcategoriaUpsert) {
  return apiRequest<{ idSubcategoria?: number; IdSubcategoria?: number }>(`${SUBCATEGORIAS_PATH}?userId=${userId}`, {
    method: 'POST',
    body: JSON.stringify(subcategoria),
  });
}

export async function updateSubcategoria(userId: number, idSubcategoria: number, subcategoria: SubcategoriaUpsert) {
  return apiRequest<void>(`${SUBCATEGORIAS_PATH}/${idSubcategoria}?userId=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(subcategoria),
  });
}

export async function deleteSubcategoria(userId: number, idSubcategoria: number) {
  return apiRequest<void>(`${SUBCATEGORIAS_PATH}/${idSubcategoria}/desactivar?userId=${userId}`, {
    method: 'PUT',
  });
}
