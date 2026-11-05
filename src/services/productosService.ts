import { apiRequest } from './apiClient';
import { PRODUCTOS_PATH } from '../config/api';
import { CategoriaLookup, Producto, ProductoLookups, ProductoTipo, ProductoUpsert, SubcategoriaLookup, TarifaLookup } from '../types/business';

type ProductoApi = Producto & {
  [key: string]: unknown;
  Codproducto?: number;
  CodProducto?: number;
  IdProducto?: number;
  ProCodigo?: number;
  procodigo?: number;
  codigoInterno?: number;
  Tipo?: ProductoTipo | string | number | null;
  TipoCompravena?: string | null;
  tipoCompravena?: string | null;
  Nombre?: string | null;
  ProNombre?: string | null;
  proNombre?: string | null;
  pronombre?: string | null;
  Descripcion?: string | null;
  Codigo?: number | string | null;
  CodigoPrincipal?: string | null;
  codigoPrincipal?: string | null;
  CodAuxiliar?: string | null;
  codAuxiliar?: string | null;
  ProCodigoAuxiliar?: string | null;
  CodigoAuxiliar?: string | null;
  proCodigoAuxiliar?: string | null;
  Procodigoauxiliar?: string | null;
  procodigoauxiliar?: string | null;
  ProCodigoBarras?: string | null;
  CodigoBarras?: string | null;
  codigoBarras?: string | null;
  procodigobarras?: string | null;
  ProCodigoPrincipal?: string | null;
  PrecioBase?: number | string | null;
  Precio?: number | string | null;
  PrecioUnitario?: number | string | null;
  ValorUnitario?: number | string | null;
  valorUnitario?: number | string | null;
  Precio2?: number | string | null;
  precio2?: number | string | null;
  Precio3?: number | string | null;
  precio3?: number | string | null;
  Pvp?: number | string | null;
  PVP?: number | string | null;
  ProPrecio?: number | string | null;
  proPrecio?: number | string | null;
  proprecio?: number | string | null;
  Precios?: Array<number | string> | null;
  precios?: Array<number | string> | null;
  PreciosAdicionales?: Array<number | string> | null;
  preciosAdicionales?: Array<number | string> | null;
  Iva?: boolean | null;
  IVA?: boolean | null;
  TieneIva?: boolean | null;
  AplicaIva?: boolean | null;
  UsaIva?: boolean | null;
  GrabaIva?: boolean | null;
  ProGrabaIva?: boolean | number | string | null;
  PROGRABAIVA?: boolean | number | string | null;
  proGrabaIva?: boolean | number | string | null;
  ProGrabaIVA?: boolean | number | string | null;
  proGrabaIVA?: boolean | number | string | null;
  pro_graba_iva?: boolean | number | string | null;
  pro_grabaiva?: boolean | number | string | null;
  proIva?: boolean | number | string | null;
  ProIva?: boolean | number | string | null;
  PROIVA?: boolean | number | string | null;
  pro_iva?: boolean | number | string | null;
  Tarifa?: number | null;
  IdTarifa?: number | null;
  IdTarifaIva?: number | null;
  TarifaIva?: number | null;
  TarifaIVA?: number | null;
  IdIva?: number | null;
  IdIVA?: number | null;
  IvaTarifa?: number | null;
  IVAId?: number | null;
  IdPorcentajeIva?: number | null;
  PorcentajeIva?: number | null;
  IvaCodigo?: number | null;
  ivaCodigo?: number | string | null;
  PorCodigo?: number | string | null;
  porCodigo?: number | string | null;
  porcodigo?: number | string | null;
  PORCODIGO?: number | string | null;
  por_codigo?: number | string | null;
  Codigoimpuesto?: string | null;
  codigoimpuesto?: string | null;
  Porcentajeimpuesto?: string | number | null;
  porcentajeimpuesto?: string | number | null;
  TarifaDescripcion?: string | null;
  DescripcionTarifa?: string | null;
  TarifaIvaDescripcion?: string | null;
  PorcentajeIvaDescripcion?: string | null;
  Categoria?: number | null;
  TipoProducto?: number | null;
  tipoProducto?: number | null;
  CategoriaId?: number | null;
  IdCategoria?: number | null;
  IdCategoriaProducto?: number | null;
  CatCodigo?: number | null;
  catCodigo?: number | null;
  catcodigo?: number | null;
  CategoriaDescripcion?: string | null;
  DescripcionCategoria?: string | null;
  ProCategoria?: number | string | null;
  proCategoria?: number | string | null;
  pro_categoria?: number | string | null;
  CatDescripcion?: string | null;
  catDescripcion?: string | null;
  catdescripcion?: string | null;
  Subcategoria?: number | null;
  Idsubtipo?: number | null;
  idsubtipo?: number | null;
  SubcategoriaId?: number | null;
  IdSubcategoria?: number | null;
  IdSubcategoriaProducto?: number | null;
  SubCodigo?: number | null;
  subCodigo?: number | null;
  subcodigo?: number | null;
  SubcategoriaDescripcion?: string | null;
  DescripcionSubcategoria?: string | null;
  ProSubcategoria?: number | string | null;
  proSubcategoria?: number | string | null;
  pro_subcategoria?: number | string | null;
  SubDescripcion?: string | null;
  subDescripcion?: string | null;
  subdescripcion?: string | null;
  Estado?: boolean | null;
  Observacion?: string | null;
  observacion?: string | null;
};

type TarifaApi = TarifaLookup & {
  [key: string]: unknown;
  IdTarifa?: number;
  Codigo?: number;
  Descripcion?: string;
  Valor?: string | number | null;
  valor?: string | number | null;
};

type CategoriaApi = CategoriaLookup & {
  [key: string]: unknown;
  IdCategoria?: number;
  Idtipoproducto?: number;
  idtipoproducto?: number;
  Codigo?: number;
  CatCodigo?: number;
  catCodigo?: number;
  catcodigo?: number;
  Descripcion?: string;
};

type SubcategoriaApi = SubcategoriaLookup & {
  [key: string]: unknown;
  IdSubcategoria?: number;
  Idsubtipo?: number;
  idsubtipo?: number;
  IdCategoria?: number | null;
  Idtipoproducto?: number | null;
  idtipoproducto?: number | null;
  Codigo?: number;
  SubCodigo?: number;
  subCodigo?: number;
  subcodigo?: number;
  Descripcion?: string;
};

type ProductoLookupsApi = {
  data?: ProductoLookupsApi;
  Data?: ProductoLookupsApi;
  result?: ProductoLookupsApi;
  Result?: ProductoLookupsApi;
  tarifas?: TarifaApi[];
  Tarifas?: TarifaApi[];
  ivas?: TarifaApi[];
  Ivas?: TarifaApi[];
  categorias?: CategoriaApi[];
  Categorias?: CategoriaApi[];
  tipos?: CategoriaApi[];
  Tipos?: CategoriaApi[];
  subcategorias?: SubcategoriaApi[];
  Subcategorias?: SubcategoriaApi[];
  subtipos?: SubcategoriaApi[];
  Subtipos?: SubcategoriaApi[];
};

type ApiList<T> = T[] | { data?: T[]; Data?: T[]; datos?: T[]; Datos?: T[]; items?: T[]; Items?: T[]; registros?: T[]; Registros?: T[]; result?: T[] | ApiList<T>; Result?: T[] | ApiList<T>; value?: T[]; Value?: T[] };

function unwrapList<T>(response: ApiList<T>) {
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

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickByPattern(source: Record<string, unknown>, include: string[], exclude: string[] = []) {
  const normalizedInclude = include.map(normalizeKey);
  const normalizedExclude = exclude.map(normalizeKey);

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;

    const normalized = normalizeKey(key);
    if (
      normalizedInclude.every((part) => normalized.includes(part)) &&
      !normalizedExclude.some((part) => normalized.includes(part))
    ) {
      return value;
    }
  }

  return undefined;
}

function normalizeTipo(value: ProductoApi['Tipo']): ProductoTipo {
  if (value === 2 || String(value ?? '').toUpperCase() === 'SERVICIO') {
    return 'SERVICIO';
  }

  return 'PRODUCTO';
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = normalizeNumber(value as number | string);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 's' || normalized === 'yes' || normalized === 'y';
  }

  return false;
}

function normalizePrices(...sources: Array<Array<number | string> | null | undefined>) {
  return sources
    .flatMap((source) => source ?? [])
    .map((value) => normalizeNumber(value))
    .filter((value) => Number.isFinite(value));
}

function normalizeProducto(producto: ProductoApi): Producto {
  const precios = normalizePrices(producto.precios, producto.Precios, producto.preciosAdicionales, producto.PreciosAdicionales);
  const preciosDirectos = [producto.precioBase, producto.PrecioBase, producto.Precio, producto.PrecioUnitario, producto.ValorUnitario, producto.valorUnitario, producto.Precio2, producto.precio2, producto.Precio3, producto.precio3, producto.Pvp, producto.PVP, producto.ProPrecio, producto.proPrecio, producto.proprecio]
    .map((value) => normalizeOptionalNumber(value))
    .filter((value): value is number => value !== null);
  const precioBase = preciosDirectos.find((value) => value > 0) ?? precios.find((value) => value > 0) ?? preciosDirectos[0] ?? precios[0] ?? 0;
  const codigoImpuesto = producto.Codigoimpuesto ?? producto.codigoimpuesto;
  const tarifa =
    normalizeOptionalNumber(pickValue(producto, ['Porcentajeimpuesto', 'porcentajeimpuesto', 'tarifa', 'Tarifa', 'idTarifa', 'IdTarifa', 'idTarifaIva', 'IdTarifaIva', 'TarifaIva', 'TarifaIVA', 'IdIva', 'IdIVA', 'IvaTarifa', 'IVAId', 'IdPorcentajeIva', 'PorcentajeIva', 'IvaCodigo', 'ivaCodigo', 'PorCodigo', 'porCodigo', 'porcodigo', 'PORCODIGO', 'por_codigo'])) ??
    normalizeOptionalNumber(pickByPattern(producto, ['tarifa'], ['descripcion'])) ??
    normalizeOptionalNumber(pickByPattern(producto, ['por', 'codigo'])) ??
    normalizeOptionalNumber(pickByPattern(producto, ['iva', 'codigo']));
  const tarifaDescripcion =
    producto.tarifaDescripcion ??
    producto.TarifaDescripcion ??
    producto.DescripcionTarifa ??
    producto.TarifaIvaDescripcion ??
    producto.PorcentajeIvaDescripcion ??
    (String(pickValue(producto, ['porDescripcion', 'PorDescripcion', 'PORDESCRIPCION', 'por_descripcion']) ?? pickByPattern(producto, ['tarifa', 'descripcion']) ?? pickByPattern(producto, ['por', 'descripcion']) ?? '') || null);
  const categoria =
    normalizeOptionalNumber(pickValue(producto, ['categoria', 'Categoria', 'categoriaId', 'CategoriaId', 'idCategoria', 'IdCategoria', 'IdCategoriaProducto', 'ProCategoria', 'proCategoria', 'pro_categoria', 'CatCodigo', 'catCodigo', 'catcodigo'])) ??
    normalizeOptionalNumber(pickByPattern(producto, ['cat', 'codigo']));
  const subcategoria =
    normalizeOptionalNumber(pickValue(producto, ['subcategoria', 'Subcategoria', 'subcategoriaId', 'SubcategoriaId', 'idSubcategoria', 'IdSubcategoria', 'IdSubcategoriaProducto', 'ProSubcategoria', 'proSubcategoria', 'pro_subcategoria', 'SubCodigo', 'subCodigo', 'subcodigo'])) ??
    normalizeOptionalNumber(pickByPattern(producto, ['sub', 'codigo']));

  return {
    codproducto: normalizeOptionalNumber(producto.codproducto ?? producto.Codproducto ?? producto.CodProducto ?? producto.IdProducto ?? producto.Codigo ?? producto.ProCodigo ?? producto.procodigo ?? producto.codigoInterno) ?? 0,
    tipo: normalizeTipo(producto.tipo ?? producto.Tipo ?? producto.TipoCompravena ?? producto.tipoCompravena),
    nombre: producto.nombre ?? producto.Nombre ?? producto.ProNombre ?? producto.proNombre ?? producto.pronombre ?? producto.Descripcion ?? '',
    codigo:
      producto.codigo ??
      producto.CodigoPrincipal ??
      producto.ProCodigoPrincipal ??
      producto.codigoPrincipal ??
      producto.CodAuxiliar ??
      producto.ProCodigoAuxiliar ??
      producto.CodigoAuxiliar ??
      producto.proCodigoAuxiliar ??
      producto.Procodigoauxiliar ??
      producto.procodigoauxiliar ??
      producto.ProCodigoBarras ??
      producto.CodigoBarras ??
      producto.codigoBarras ??
      producto.procodigobarras ??
      String(producto.codproducto ?? producto.Codproducto ?? producto.CodProducto ?? producto.IdProducto ?? producto.Codigo ?? producto.ProCodigo ?? producto.procodigo ?? ''),
    precioBase,
    precios: precios.some((value) => value > 0) ? precios : [precioBase],
    iva: normalizeBoolean(pickValue(producto, ['iva', 'Iva', 'IVA', 'tieneIva', 'TieneIva', 'aplicaIva', 'AplicaIva', 'usaIva', 'UsaIva', 'grabaIva', 'GrabaIva', 'proIva', 'ProIva', 'PROIVA', 'pro_iva', 'proGrabaIva', 'ProGrabaIva', 'PROGRABAIVA', 'proGrabaIVA', 'ProGrabaIVA', 'pro_graba_iva', 'pro_grabaiva']) ?? pickByPattern(producto, ['iva'], ['codigo', 'descripcion']) ?? (codigoImpuesto === '2' || tarifa !== null)),
    tarifa,
    tarifaDescripcion,
    categoria: categoria ?? normalizeOptionalNumber(producto.TipoProducto ?? producto.tipoProducto),
    categoriaDescripcion: producto.categoriaDescripcion ?? producto.CategoriaDescripcion ?? producto.DescripcionCategoria ?? producto.CatDescripcion ?? producto.catDescripcion ?? producto.catdescripcion ?? (String(pickByPattern(producto, ['cat', 'descripcion']) ?? '') || null),
    subcategoria: subcategoria ?? normalizeOptionalNumber(producto.Idsubtipo ?? producto.idsubtipo),
    subcategoriaDescripcion: producto.subcategoriaDescripcion ?? producto.SubcategoriaDescripcion ?? producto.DescripcionSubcategoria ?? producto.SubDescripcion ?? producto.subDescripcion ?? producto.subdescripcion ?? (String(pickByPattern(producto, ['sub', 'descripcion']) ?? '') || null),
    estado: producto.estado ?? producto.Estado,
    observacion: producto.observacion ?? producto.Observacion,
  };
}

function normalizeLookups(lookups: ProductoLookupsApi): ProductoLookups {
  const source = lookups.data ?? lookups.Data ?? lookups.result ?? lookups.Result ?? lookups;

  return {
    tarifas: (source.tarifas ?? source.Tarifas ?? source.ivas ?? source.Ivas ?? []).map((tarifa) => {
      const valor = pickValue<string | number>(tarifa, ['valor', 'Valor']);
      const descripcion = String(pickValue(tarifa, ['descripcion', 'Descripcion', 'nombre', 'Nombre', 'porDescripcion', 'PorDescripcion']) ?? '');

      return {
      idTarifa: normalizeOptionalNumber(pickValue(tarifa, ['idTarifa', 'IdTarifa', 'codigo', 'Codigo', 'ivaCodigo', 'IvaCodigo', 'porCodigo', 'PorCodigo', 'porcodigo'])) ?? 0,
      descripcion: valor !== undefined && valor !== null && String(valor) !== '' ? `${descripcion} (${valor}%)` : descripcion,
      };
    }),
    categorias: (source.categorias ?? source.Categorias ?? source.tipos ?? source.Tipos ?? []).map((categoria) => ({
      idCategoria: normalizeOptionalNumber(pickValue(categoria, ['idCategoria', 'IdCategoria', 'Idtipoproducto', 'idtipoproducto', 'codigo', 'Codigo', 'CatCodigo', 'catCodigo', 'catcodigo'])) ?? 0,
      descripcion: String(pickValue(categoria, ['descripcion', 'Descripcion', 'nombre', 'Nombre', 'catDescripcion', 'CatDescripcion', 'catdescripcion']) ?? ''),
    })),
    subcategorias: (source.subcategorias ?? source.Subcategorias ?? source.subtipos ?? source.Subtipos ?? []).map((subcategoria) => ({
      idSubcategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idSubcategoria', 'IdSubcategoria', 'Idsubtipo', 'idsubtipo', 'codigo', 'Codigo', 'SubCodigo', 'subCodigo', 'subcodigo'])) ?? 0,
      idCategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idCategoria', 'IdCategoria', 'Idtipoproducto', 'idtipoproducto', 'categoria', 'Categoria', 'categoriaId', 'CategoriaId'])),
      descripcion: String(pickValue(subcategoria, ['descripcion', 'Descripcion', 'nombre', 'Nombre', 'subDescripcion', 'SubDescripcion', 'subdescripcion']) ?? ''),
    })),
  };
}

export async function getProductos(userId: number, incluirInactivos = false) {
  const response = await apiRequest<ApiList<ProductoApi>>(`${PRODUCTOS_PATH}?userId=${userId}&incluirInactivos=${incluirInactivos}`);
  return unwrapList(response).map(normalizeProducto);
}

export async function getProducto(userId: number, codproducto: number) {
  const paths = [
    `${PRODUCTOS_PATH}/${codproducto}?userId=${userId}`,
    `${PRODUCTOS_PATH}/detalle/${codproducto}?userId=${userId}`,
    `${PRODUCTOS_PATH}/detalle?codproducto=${codproducto}&userId=${userId}`,
    `${PRODUCTOS_PATH}/detalle?idProducto=${codproducto}&userId=${userId}`,
    `${PRODUCTOS_PATH}/obtener?codproducto=${codproducto}&userId=${userId}`,
    `${PRODUCTOS_PATH}/obtener?idProducto=${codproducto}&userId=${userId}`,
  ];
  let lastError: unknown;
  let response: ProductoApi | { data?: ProductoApi; Data?: ProductoApi; result?: ProductoApi; Result?: ProductoApi };

  for (const path of paths) {
    try {
      response = await apiRequest<ProductoApi | { data?: ProductoApi; Data?: ProductoApi; result?: ProductoApi; Result?: ProductoApi }>(path, {
        timeoutMs: 8000,
      });
      const wrapped = response as { data?: ProductoApi; Data?: ProductoApi; result?: ProductoApi; Result?: ProductoApi };
      return normalizeProducto(wrapped.data ?? wrapped.Data ?? wrapped.result ?? wrapped.Result ?? (response as ProductoApi));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function createProducto(userId: number, producto: ProductoUpsert) {
  return apiRequest<{ Codproducto?: number; codproducto?: number; idProducto?: number }>(`${PRODUCTOS_PATH}?userId=${userId}`, {
    method: 'POST',
    body: JSON.stringify(producto),
  });
}

export async function updateProducto(userId: number, codproducto: number, producto: ProductoUpsert) {
  return apiRequest<void>(`${PRODUCTOS_PATH}/${codproducto}?userId=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(producto),
  });
}

export async function deleteProducto(userId: number, codproducto: number) {
  return apiRequest<void>(`${PRODUCTOS_PATH}/${codproducto}/desactivar?userId=${userId}`, {
    method: 'PUT',
  });
}

export async function getProductoLookups(userId: number) {
  const lookups = await apiRequest<ProductoLookupsApi>(`${PRODUCTOS_PATH}/lookups?userId=${userId}`);
  return normalizeLookups(lookups);
}

export async function getProductoSubcategorias(userId: number, categoriaId: number) {
  const paths = [
    `${PRODUCTOS_PATH}/subcategorias?userId=${userId}&categoriaId=${categoriaId}`,
    `/api/subcategorias?userId=${userId}&categoriaId=${categoriaId}`,
  ];
  let lastError: unknown;

  for (const path of paths) {
    try {
      const response = await apiRequest<ApiList<SubcategoriaApi>>(path, { timeoutMs: 8000, suppressErrorLog: true });
      return unwrapList(response).map((subcategoria) => ({
        idSubcategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idSubcategoria', 'IdSubcategoria', 'codigo', 'Codigo', 'SubCodigo', 'subCodigo', 'subcodigo'])) ?? 0,
        idCategoria: normalizeOptionalNumber(pickValue(subcategoria, ['idCategoria', 'IdCategoria', 'categoria', 'Categoria', 'categoriaId', 'CategoriaId'])),
        descripcion: String(pickValue(subcategoria, ['descripcion', 'Descripcion', 'nombre', 'Nombre']) ?? ''),
      }));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
