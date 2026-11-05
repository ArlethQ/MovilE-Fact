import type { WorkspaceView } from '../../components/auth/AuthFlow';

const WORKSPACE_TITLES: Partial<Record<WorkspaceView, string>> = {
  portal: 'Portal de Servicios', dashboard: 'Inicio', perfil: 'Perfil', 'perfil-e-rubrica': 'Mi perfil',
  'politica-privacidad': 'Política de privacidad', emisor: 'Emisor', firma: 'Mi firma', 'e-rubrica': 'E-RÚBRICA',
  'punto-emision': 'Punto de emision / caja', 'admin-cajas-secuencias': 'Cajas y secuencias',
  'admin-roles-permisos': 'Roles y Permisos', 'admin-impuestos': 'Impuestos', 'admin-usuarios': 'Usuarios',
  'admin-identificaciones': 'Identificaciones', 'admin-formas-pago': 'Formas de Pago', 'admin-logs-inicio': 'Logs de Inicio',
  'admin-retenciones': 'Retenciones', 'admin-sql-auditoria': 'SQL Auditoria', clientes: 'Clientes',
  'nuevo-cliente': 'Clientes', 'nuevo-producto': 'Productos', 'nueva-categoria': 'Categorias',
  'nueva-subcategoria': 'Categorias', 'nuevo-emisor': 'Emisor', 'nueva-firma': 'Firma electronica',
  'nuevo-punto-emision': 'Punto de emision', proveedores: 'Proveedores', productos: 'Productos',
  categorias: 'Categorias', facturacion: 'Facturacion', 'nueva-factura': 'Nueva Factura',
  'mis-facturas': 'Mis Facturas', cotizaciones: 'Cotizaciones', 'notas-credito': 'Notas de credito',
  'nueva-nota-credito': 'Nueva Nota de Credito', 'mis-notas-credito': 'Mis Notas de Credito',
  'notas-debito': 'Notas de debito', 'nueva-nota-debito': 'Nueva Nota de Debito',
  'mis-notas-debito': 'Mis Notas de Debito', retenciones: 'Retenciones', 'guias-remision': 'Guias de remision',
  'nueva-guia-remision': 'Nueva Guia de Remision', 'mis-guias-remision': 'Mis Guias de Remision',
  compras: 'Liquidacion de Compra', 'nueva-liquidacion-compra': 'Nueva Liquidacion de Compra',
  'mis-liquidaciones-compra': 'Mis Liquidaciones de Compra', 'cuentas-cobrar': 'Cuentas por cobrar',
  'estado-cuenta': 'Estado de cuenta', recargas: 'Mis recargas', 'comprar-documentos': 'Comprar documentos',
  reportes: 'Reportes', configuracion: 'Configuracion', soporte: 'Soporte', bot: 'Númi Bot',
  tutoriales: 'Tutoriales', 'centro-normativo': 'Centro normativo', 'no-autorizado': 'No autorizado',
};

export function getWorkspaceTitle(view: WorkspaceView) {
  return WORKSPACE_TITLES[view] ?? 'No autorizado';
}
