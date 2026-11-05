export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://efact.numericasoftware.com';
export const DOCUMENTOS_COMPRA_PAGO_PATH = process.env.EXPO_PUBLIC_DOCUMENTOS_COMPRA_PAGO_PATH?.trim() || '/api/documentos/compra/pago';
export const ERUBRICA_SOLICITUD_PATH = process.env.EXPO_PUBLIC_ERUBRICA_SOLICITUD_PATH?.trim() || '/api/mobile/e-rubrica/solicitudes';
export const ERUBRICA_SOLICITUD_PAGO_PATH = process.env.EXPO_PUBLIC_ERUBRICA_SOLICITUD_PAGO_PATH?.trim() || '/api/mobile/e-rubrica/solicitudes/pago';
export const ERUBRICA_SOLICITUD_TRANSFERENCIA_PATH = process.env.EXPO_PUBLIC_ERUBRICA_SOLICITUD_TRANSFERENCIA_PATH?.trim() || '/api/mobile/e-rubrica/solicitudes/transferencia';
// Se configura cuando el backend publique el equivalente movil de MenuService.GetMenusByRol.
export const MENUS_BY_ROLE_PATH = process.env.EXPO_PUBLIC_MENUS_BY_ROLE_PATH?.trim() || '/api/mobile/menus';
export const PRODUCTOS_PATH = process.env.EXPO_PUBLIC_PRODUCTOS_PATH?.trim() || '/api/productos';
export const CATEGORIAS_PATH = process.env.EXPO_PUBLIC_CATEGORIAS_PATH?.trim() || '/api/categorias';
export const SUBCATEGORIAS_PATH = process.env.EXPO_PUBLIC_SUBCATEGORIAS_PATH?.trim() || '/api/subcategorias';
export const RETENCIONES_GENERADAS_PATH = process.env.EXPO_PUBLIC_RETENCIONES_GENERADAS_PATH?.trim() || '/api/retenciones';
