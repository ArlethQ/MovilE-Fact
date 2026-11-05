import { apiRequest } from './apiClient';

export type AdminMobileItem = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  meta?: string | null;
  status?: string | null;
  detail?: string | null;
};

export type AdminMobileResponse = {
  items: AdminMobileItem[];
};

type ApiRow = Record<string, unknown>;

const endpoints: Record<string, (tab: string) => string> = {
  'cajas-secuencias': () => '/api/cajas-secuencias',
  'roles-permisos': () => '/api/roles-permisos/roles',
  impuestos: (tab) => (tab === 'Porcentajes IVA' ? '/api/impuestos/iva' : '/api/impuestos/codigos'),
  usuarios: () => '/api/usuarios-admin',
  identificaciones: () => '/api/identificaciones',
  'formas-pago': (tab) => (tab === 'Tipos de Documento' ? '/api/formas-pago/tipos-documento' : '/api/formas-pago'),
  'logs-inicio': () => '/api/logs-inicio',
  retenciones: (tab) => (tab === 'ISD' ? '/api/retenciones-catalogo/isd' : tab === 'Renta' ? '/api/retenciones-catalogo/renta' : '/api/retenciones-catalogo/iva'),
  'sql-auditoria': () => '/api/sql-auditoria',
};

export async function getAdminMobileModule(module: string, search = '', tab = '') {
  const endpoint = endpoints[module]?.(tab);
  if (!endpoint) return { items: [] };

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  const query = params.toString();
  const response = await apiRequest<ApiRow[] | Record<string, unknown>>(`${endpoint}${query ? `?${query}` : ''}`);
  const data = normalizeRows(response, module, tab);

  return { items: data.map((row) => toAdminItem(module, tab, row)) };
}

function normalizeRows(response: ApiRow[] | Record<string, unknown>, module: string, tab: string): ApiRow[] {
  if (Array.isArray(response)) return response;

  const tabKey = normalizeKey(tab);
  const moduleKey = normalizeKey(module);
  const values = [
    ...getTabValues(response, tabKey),
    response.items,
    response.Items,
    response.data,
    response.Data,
    response.registros,
    response.Registros,
    response.result,
    response.Result,
    response.results,
    response.Results,
    response[module],
    response[moduleKey],
    response[moduleKey.replace(/-/g, '')],
    response.retenciones,
    response.Retenciones,
  ];

  for (const value of values) {
    if (Array.isArray(value)) return value as ApiRow[];
    if (isRecord(value)) {
      const nestedRows = normalizeRows(value, module, tab);
      if (nestedRows.length) return nestedRows;
    }
  }

  const firstArray = Object.values(response).find(Array.isArray);
  if (Array.isArray(firstArray)) return firstArray as ApiRow[];

  if (Object.keys(response).length) {
    return [response];
  }

  return [];
}

function getTabValues(row: ApiRow, normalizedTab: string) {
  if (!normalizedTab) return [];

  return Object.entries(row)
    .filter(([key]) => normalizeKey(key).includes(normalizedTab))
    .map(([, value]) => value);
}

function toAdminItem(module: string, tab: string, row: ApiRow): AdminMobileItem {
  if (module === 'cajas-secuencias') {
    return {
      id: getRowId(row),
      title: `Caja ${text(row.numCaja) || '-'}`,
      subtitle: text(row.idUsuario) ? `Usuario ${text(row.idUsuario)}` : 'Sin usuario',
      meta: text(row.serieFactura),
      detail: text(row.ultimoSecuencialFactura) ? `FAC ${text(row.ultimoSecuencialFactura)}` : '',
    };
  }

  if (module === 'roles-permisos') {
    return { id: getRowId(row), title: text(row.nombre), subtitle: text(row.descripcion), meta: 'Rol' };
  }

  if (module === 'impuestos') {
    const descripcion = text(pickValue(row, ['descripcion', 'Descripcion', 'nombre', 'Nombre']));
    const codigo = text(pickValue(row, ['codigo', 'Codigo', 'codSri', 'CodSri', 'codigoSri', 'CodigoSri']));
    const valor = text(pickValue(row, ['valor', 'Valor', 'porcentaje', 'Porcentaje']));
    const valorCalculo = text(pickValue(row, ['valorCalculo', 'ValorCalculo', 'calculo', 'Calculo']));

    return {
      id: getRowId(row),
      title: descripcion || codigo,
      subtitle: tab === 'Porcentajes IVA' ? `Valor ${valor}` : `Codigo ${codigo}`,
      meta: tab === 'Porcentajes IVA' ? valor : codigo,
      detail: tab === 'Porcentajes IVA' && valorCalculo ? `Calculo ${valorCalculo}` : '',
    };
  }

  if (module === 'usuarios') {
    return {
      id: getRowId(row),
      title: `${text(row.nombres)} ${text(row.apellidos)}`.trim(),
      subtitle: text(row.email),
      meta: text(row.rol) || (text(row.idTipoUsuario) ? `Rol ${text(row.idTipoUsuario)}` : ''),
      status: row.cuentaBloqueada === true ? 'Bloqueada' : '',
    };
  }

  if (module === 'identificaciones') {
    return { id: getRowId(row), title: text(row.descripcion), subtitle: `Codigo ${text(row.codigo)}`, meta: text(row.codigo) };
  }

  if (module === 'formas-pago') {
    return {
      id: getRowId(row),
      title: text(row.descripcion),
      subtitle: text(row.descripcionSri) || `Codigo ${text(row.codigo)}`,
      meta: text(row.codigo),
      detail: [row.tipoVenta === true ? 'Venta' : '', row.tipoCompra === true ? 'Compra' : ''].filter(Boolean).join(' '),
    };
  }

  if (module === 'logs-inicio') {
    return {
      id: getRowId(row),
      title: text(row.usuario),
      subtitle: text(row.correo),
      meta: formatDate(row.fechaAcceso),
      status: row.exitoso === true ? 'Exitoso' : 'Fallido',
      detail: text(row.direccionIp) || text(row.detalleError),
    };
  }

  if (module === 'retenciones') {
    const codigo = text(pickValue(row, ['codigo', 'Codigo', 'codigoRetencion', 'CodigoRetencion', 'codRetencion', 'CodRetencion', 'codSri', 'CodSri', 'codigoSri', 'CodigoSri']));
    const descripcion = text(pickValue(row, ['descripcion', 'Descripcion', 'nombre', 'Nombre', 'concepto', 'Concepto', 'sustento', 'Sustento']));
    const valor = text(pickValue(row, ['valor', 'Valor', 'porcentaje', 'Porcentaje', 'porcentajeRetencion', 'PorcentajeRetencion', 'tarifa', 'Tarifa']));
    const detalle = text(pickValue(row, ['informacionExtra', 'InformacionExtra', 'detalle', 'Detalle', 'descripcionSri', 'DescripcionSri', 'tipo', 'Tipo']));

    return {
      id: getRowId(row),
      title: descripcion || codigo,
      subtitle: [tab || 'IVA', codigo ? `Codigo ${codigo}` : ''].filter(Boolean).join(' - '),
      meta: valor,
      detail: detalle,
    };
  }

  return {
    id: getRowId(row),
    title: text(row.usuario),
    subtitle: text(row.accion),
    meta: formatDate(row.fecha),
    status: text(row.accion),
    detail: text(row.detalles),
  };
}

function getRowId(row: ApiRow) {
  return text(row.id) ||
    text(row.Id) ||
    text(row.ID) ||
    text(row.idRetencion) ||
    text(row.IdRetencion) ||
    text(row.codigoRetencion) ||
    text(row.CodigoRetencion) ||
    text(row.codigo) ||
    text(row.Codigo) ||
    text(row.sec) ||
    text(row.Sec) ||
    text(row.idLog) ||
    text(row.idUsuario);
}

function pickValue(row: ApiRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) return row[key];
  }

  const normalizedKeys = keys.map(normalizeKey);
  const entry = Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalizedKeys.includes(normalizeKey(key)));

  return entry?.[1];
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isRecord(value: unknown): value is ApiRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatDate(value: unknown) {
  const source = text(value);
  if (!source) return '';
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return source;
  return date.toLocaleString();
}
