import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState, type ComponentType } from 'react';
import { AccessibilityInfo, Alert, Image, ImageSourcePropType, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ApiError, clearAuthSession, setAuthFailureHandler } from '../../services/apiClient';
import { clearBotHistory } from '../../services/botService';
import { API_BASE_URL } from '../../config/api';
import { acceptPrivacyPolicy, changePassword, checkAuth, login, logout as logoutSession, recoverPassword, register } from '../../services/authService';
import { ChangePasswordRequest, DynamicMenu, LoginResponse, RegisterRequest, ServiceAccess, TipoDocumento } from '../../types/auth';
import { FacturaPreparacion } from '../../services/facturasMobileService';
import { NotificacionItem } from '../../services/notificacionesService';
import { PerfilUsuario } from '../../types/business';
import type { NuevaFacturaFormState } from '../../types/invoices';
import type { PuntoDocumentoKey } from '../../services/puntosEmisionService';
import { sanitizeIdentificacion, validateChangePassword, validateEmail, validateLogin, validateRegisterForm } from '../../utils/authValidation';
import { buildDeviceFileName } from '../../utils/fileUtils';
import { AppLaunchScreen, AuthCard } from './AuthShell';
import { BiometricSetupModal, BrandLockup, BrandMark, LoadingScreen, OfflineScreen, ScreenFrame } from './AuthWidgets';
import { Field, InlineSwitch, LoginActionTiles, MessageBox, PrimaryButton, SecondaryButton, SegmentButton, TextLink } from '../ui/FormControls';
import { InitialsAvatar } from '../ui/MenuItem';
import { styles } from '../../styles/appStyles';
import { PrivacyPolicyScreen } from '../legal/PrivacyPolicyScreen';

type AuthMode = 'login' | 'register' | 'forgot' | 'change';
type MessageState = { type: 'success' | 'error' | 'info'; text: string } | null;
type MobileModule = { view: WorkspaceView; title: string; description: string };
type BusinessHomeProps = { currentUser: LoginResponse; incomingPdfUri?: string | null; onIncomingPdfHandled?: () => void; onLogout: () => void };

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}

export type WorkspaceView =
  | 'portal'
  | 'dashboard'
  | 'perfil'
  | 'perfil-e-rubrica'
  | 'politica-privacidad'
  | 'emisor'
  | 'firma'
  | 'e-rubrica'
  | 'punto-emision'
  | 'admin-cajas-secuencias'
  | 'admin-roles-permisos'
  | 'admin-impuestos'
  | 'admin-usuarios'
  | 'admin-identificaciones'
  | 'admin-formas-pago'
  | 'admin-logs-inicio'
  | 'admin-retenciones'
  | 'admin-sql-auditoria'
  | 'clientes'
  | 'nuevo-cliente'
  | 'nuevo-producto'
  | 'nueva-categoria'
  | 'nueva-subcategoria'
  | 'nuevo-emisor'
  | 'nueva-firma'
  | 'nuevo-punto-emision'
  | 'proveedores'
  | 'productos'
  | 'categorias'
  | 'facturacion'
  | 'nueva-factura'
  | 'mis-facturas'
  | 'cotizaciones'
  | 'notas-credito'
  | 'nueva-nota-credito'
  | 'mis-notas-credito'
  | 'notas-debito'
  | 'nueva-nota-debito'
  | 'mis-notas-debito'
  | 'retenciones'
  | 'guias-remision'
  | 'nueva-guia-remision'
  | 'mis-guias-remision'
  | 'compras'
  | 'nueva-liquidacion-compra'
  | 'mis-liquidaciones-compra'
  | 'cuentas-cobrar'
  | 'estado-cuenta'
  | 'recargas'
  | 'comprar-documentos'
  | 'reportes'
  | 'configuracion'
  | 'soporte'
  | 'bot'
  | 'tutoriales'
  | 'centro-normativo'
  | 'no-autorizado';

const NUMERICA_URL = 'https://numericasoftware.com/';
const EFACT_PUBLIC_URL = 'https://efact.numericasoftware.com';
const AVATAR_BASE_URL = 'https://efact.numericasoftware.com/images/Avatars';
const LAUNCH_DURATION_MS = 2_000;
const BIOMETRIC_CREDENTIALS_KEY = 'efact.biometric.credentials';
export const INVOICE_DRAFT_KEY_PREFIX = 'efact.invoice.draft';
const BACKOFFICE_UNAVAILABLE_MESSAGE = 'Esta función de backoffice no está disponible en móvil. Úsala desde la web.';

type BiometricCredentials = { username: string; password: string };

async function readBiometricCredentials() {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<BiometricCredentials>;
    if (typeof parsed.username !== 'string' || typeof parsed.password !== 'string' || !parsed.username.trim() || !parsed.password) {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      return null;
    }
    return { username: parsed.username, password: parsed.password };
  } catch {
    await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY).catch(() => undefined);
    return null;
  }
}

async function getBiometricLabel() {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (Platform.OS === 'ios' && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (Platform.OS === 'android' && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Huella digital';
    if (Platform.OS === 'ios') return 'Face ID';
    if (Platform.OS === 'android') return 'Huella digital';
    return 'Biometría';
  } catch {
    return null;
  }
}

const SUPER_ADMIN_TIPO_USUARIO = 2;
const BASE_EFACT_MOBILE_MENUS: DynamicMenu[] = [
  { id: -1001, nombre: 'Inicio', ruta: '/dashboard', icono: 'ri-dashboard-line', orden: 1, estado: true },
  { id: -1002, nombre: 'Mi Perfil', ruta: '/perfil', icono: 'ri-user-settings-line', orden: 2, estado: true },
  { id: -1003, nombre: 'Emisor', ruta: '/emisor', icono: 'ri-building-line', orden: 3, estado: true },
  { id: -1004, nombre: 'Firma', ruta: '/firma', icono: 'ri-shield-check-line', orden: 4, estado: true },
  { id: -1005, nombre: 'Pto. Emision', ruta: '/mi-caja', icono: 'ri-store-2-line', orden: 5, estado: true },
  { id: -1006, nombre: 'Clientes / Proveedores', ruta: '/clientes', icono: 'ri-group-line', orden: 6, estado: true },
  { id: -1007, nombre: 'Productos', ruta: '/productos', icono: 'ri-shopping-bag-line', orden: 7, estado: true },
  { id: -1008, nombre: 'Categorias', ruta: '/categorias', icono: 'ri-grid-line', orden: 8, estado: true },
  { id: -1009, nombre: 'Facturacion', ruta: '/facturacion', icono: 'ri-file-text-line', orden: 9, estado: true },
  { id: -1010, nombre: 'Notas de credito', ruta: '/notas-credito', icono: 'ri-refund-line', orden: 10, estado: true },
  { id: -1011, nombre: 'Notas de debito', ruta: '/notas-debito', icono: 'ri-bill-line', orden: 11, estado: true },
  { id: -1012, nombre: 'Retenciones', ruta: '/retenciones', icono: 'ri-bank-line', orden: 12, estado: true },
  { id: -1013, nombre: 'Guias de remision', ruta: '/guias-remision', icono: 'ri-truck-line', orden: 13, estado: true },
  { id: -1014, nombre: 'Cuentas por cobrar', ruta: '/cuentas-cobrar', icono: 'ri-money-dollar-circle-line', orden: 14, estado: true },
  { id: -1015, nombre: 'Estado de cuenta', ruta: '/estado-cuenta', icono: 'ri-file-chart-line', orden: 15, estado: true },
  { id: -1016, nombre: 'Comprar documentos', ruta: '/comprar-documentos', icono: 'ri-file-add-line', orden: 16, estado: true },
  { id: -1018, nombre: 'Historial de recargas', ruta: '/recargas', icono: 'ri-history-line', orden: 18, estado: true },
  { id: -1019, nombre: 'Centro normativo', ruta: '/centro-normativo', icono: 'ri-book-open-line', orden: 19, estado: true },
  { id: -1020, nombre: 'Configuracion', ruta: '/configuracion', icono: 'ri-settings-3-line', orden: 20, estado: true },
  { id: -1021, nombre: 'Soporte', ruta: '/soporte', icono: 'ri-customer-service-2-line', orden: 21, estado: true },
  { id: -1024, nombre: 'Númi Bot', ruta: '/bot', icono: 'ri-robot-line', orden: 22, estado: true },
  { id: -1022, nombre: 'Tutoriales', ruta: '/tutoriales', icono: 'ri-graduation-cap-line', orden: 22, estado: true },
  { id: -1023, nombre: 'Liquidacion de Compra', ruta: '/compras', icono: 'ri-file-add-line', orden: 23, estado: true },
  { id: -1025, nombre: 'Cotizaciones', ruta: '/cotizaciones', icono: 'ri-file-list-3-line', orden: 24, estado: true },
];
const ADMIN_EFACT_MOBILE_MENUS: DynamicMenu[] = [
  { id: -1101, nombre: 'Cajas y secuencias', ruta: '/administracion/cajas-secuencias', icono: 'ri-stack-line', orden: 101, estado: true },
  { id: -1102, nombre: 'Roles y Permisos', ruta: '/configuracion/seguridad', icono: 'ri-user-shield-line', orden: 102, estado: true },
  { id: -1103, nombre: 'Impuestos', ruta: '/configuracion/impuestos', icono: 'ri-percent-line', orden: 103, estado: true },
  { id: -1104, nombre: 'Usuarios', ruta: '/configuracion/usuarios', icono: 'ri-user-line', orden: 104, estado: true },
  { id: -1105, nombre: 'Identificaciones', ruta: '/configuracion/identificaciones', icono: 'ri-id-card-line', orden: 105, estado: true },
  { id: -1106, nombre: 'Formas de Pago', ruta: '/configuracion/general', icono: 'ri-bank-card-line', orden: 106, estado: true },
  { id: -1107, nombre: 'Logs de Inicio', ruta: '/reportes/logs', icono: 'ri-file-list-line', orden: 107, estado: true },
  { id: -1108, nombre: 'Retenciones', ruta: '/configuracion/retenciones', icono: 'ri-bank-line', orden: 108, estado: true },
  { id: -1109, nombre: 'SQL Auditoria', ruta: '/reportes/auditoria-sql', icono: 'ri-shield-check-line', orden: 109, estado: true },
];
const SUPER_ADMIN_SERVICE_CATALOG: ServiceAccess[] = [
  { codigo: 'e-fact', nombre: 'E-FACT', ruta: '/dashboard', estado: true, habilitado: true },
  { codigo: 'e-conta', nombre: 'E-CONTAX', ruta: '/e-contax', estado: true, habilitado: true },
  { codigo: 'e-declara', nombre: 'E-DECLARA', ruta: '/e-declara', estado: true, habilitado: true },
  { codigo: 'e-rubrica', nombre: 'E-RÚBRICA', ruta: '/e-rubrica', estado: true, habilitado: true },
];

export const AVATARS = [
  'Bandera-Argentina.png',
  'Bandera-Bolivia.png',
  'Bandera-Brazil.png',
  'Bandera-Chile.png',
  'Bandera-Colombia.png',
  'Bandera-Ecuador.png',
  'Bandera-Paraguay.png',
  'Bandera-Peru.png',
  'Bandera-Uruguay.png',
  'Bandera-Venezuela.png',
  'avatar-soccer-ball.png',
  'avatar1.png',
  'avatar2.png',
  'avatar3.png',
  'avatar4.png',
  'avatar5.png',
  'avatar6.png',
  'avatar7.png',
  'avatar8.png',
  'avatar9.png',
  'avatar10.png',
  'avatar11.png',
  'numi-efact.jpg',
];
const AVATAR_CATEGORIES = ['Todos', 'Países', 'Personajes', 'Especiales'] as const;
type AvatarCategory = typeof AVATAR_CATEGORIES[number];

function getAvatarCategory(avatar: string): AvatarCategory {
  if (avatar.startsWith('Bandera-')) return 'Países';
  if (avatar === 'avatar-soccer-ball.png') return 'Especiales';
  if (avatar.startsWith('avatar')) return 'Personajes';
  return 'Especiales';
}
const LOCAL_AVATAR_SOURCES: Record<string, ImageSourcePropType> = {
  'numi-efact.jpg': require('../../../assets/numi-efact.jpg'),
};

function avatarUrl(fileName: string) {
  return `${AVATAR_BASE_URL}/${fileName}`;
}

export function avatarImageSource(fileName: string): ImageSourcePropType {
  return LOCAL_AVATAR_SOURCES[fileName] ?? { uri: avatarUrl(fileName) };
}

export function resolveImageUrl(value?: string | null) {
  const source = value?.trim();
  if (!source) return avatarUrl('Avatar-Boy.jpg');
  if (/^https?:\/\//i.test(source) || source.startsWith('data:image/')) return source;
  const normalized = source.replace(/\\/g, '/').replace(/^~?\//, '');
  if (normalized.toLowerCase().startsWith('images/avatars/')) {
    return `${EFACT_PUBLIC_URL}/${normalized}`;
  }
  return `${API_BASE_URL.replace(/\/$/, '')}/${normalized.replace(/^\//, '')}`;
}

export function avatarPath(fileName: string) {
  return `images/Avatars/${fileName}`;
}

export function getInitials(nombres?: string | null, apellidos?: string | null, razonSocial?: string | null) {
  const first = nombres?.trim().split(/\s+/)[0]?.charAt(0) ?? razonSocial?.trim().split(/\s+/)[0]?.charAt(0) ?? '';
  const last = apellidos?.trim().split(/\s+/)[0]?.charAt(0) ?? razonSocial?.trim().split(/\s+/)[1]?.charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

function getInitialsColor(initials: string) {
  const colors = ['#6C63FF', '#006BB5', '#2C3E50', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#34495E', '#2980B9'];
  const hash = initials.split('').reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return colors[Math.abs(hash) % colors.length];
}

export function initialsAvatarDataUri(nombres?: string | null, apellidos?: string | null, razonSocial?: string | null) {
  const initials = getInitials(nombres, apellidos, razonSocial);
  const bgColor = getInitialsColor(initials);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='100' height='100'><rect width='100' height='100' fill='${bgColor}'/><text x='50%' y='55%' font-family='Arial, sans-serif' font-size='40' font-weight='bold' fill='#ffffff' text-anchor='middle' dominant-baseline='middle'>${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function isInitialsAvatar(value?: string | null) {
  const source = value?.trim().toLowerCase() ?? '';
  return !source || source.includes('avatar_initials_') || source.startsWith('data:image/svg+xml');
}

export function isPersonalPhoto(value?: string | null) {
  const source = value?.trim().toLowerCase() ?? '';
  return source.includes('images/avatars/uploads/') && !source.includes('avatar_initials_');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const initialRegisterForm: RegisterRequest = {
  nombres: '',
  apellidos: '',
  razonSocial: '',
  email: '',
  direccion: '',
  celular: '',
  tipoDocumento: 'CEDULA',
  identificacion: '',
  password: '',
  avatarUrl: '',
  tipoCliente: 1,
};

const initialChangeForm: ChangePasswordRequest = {
  idUsuario: 0,
  claveActual: '',
  nuevaClave: '',
  confirmarClave: '',
};

export const EFACT_MODULES: Omit<MobileModule, 'count' | 'enabled'>[] = [
  { view: 'perfil', title: 'Perfil', description: 'Datos de usuario, avatar y preferencias.' },
  { view: 'emisor', title: 'Emisor', description: 'Datos fiscales del emisor.' },
  { view: 'firma', title: 'Firma / certificado', description: 'Certificado digital para emitir documentos.' },
  { view: 'e-rubrica', title: 'E-RÚBRICA', description: 'Solicitudes, documentos y validación de firmas electrónicas.' },
  { view: 'punto-emision', title: 'Punto de emision / caja', description: 'Caja, establecimiento y secuenciales.' },
  { view: 'clientes', title: 'Clientes', description: 'Clientes, proveedores y contactos comerciales.' },
  { view: 'productos', title: 'Productos', description: 'Catalogo de productos y servicios.' },
  { view: 'categorias', title: 'Categorias', description: 'Categorias y subcategorias del catalogo comercial.' },
  { view: 'facturacion', title: 'Facturacion', description: 'Facturas, secuenciales, PDF, correo y autorizacion.' },
  { view: 'nueva-factura', title: 'Nueva Factura', description: 'Emision de facturas desde el movil.' },
  { view: 'mis-facturas', title: 'Mis Facturas', description: 'Consulta, PDF, XML, correo y anulacion.' },
  { view: 'cotizaciones', title: 'Cotizaciones', description: 'Crea proformas, apruébalas y conviértelas en factura.' },
  { view: 'nueva-nota-credito', title: 'Nueva Nota de Credito', description: 'Emision de notas de credito desde factura modificada.' },
  { view: 'mis-notas-credito', title: 'Mis Notas de Credito', description: 'Consulta, PDF, XML y correo de notas de credito.' },
  { view: 'nueva-nota-debito', title: 'Nueva Nota de Debito', description: 'Emision de notas de debito desde factura modificada.' },
  { view: 'mis-notas-debito', title: 'Mis Notas de Debito', description: 'Consulta, PDF, XML y correo de notas de debito.' },
  { view: 'retenciones', title: 'Retenciones', description: 'Configuracion, generadas, PDF y correo.' },
  { view: 'nueva-guia-remision', title: 'Nueva Guia de Remision', description: 'Emision de guias de remision desde factura o manual.' },
  { view: 'mis-guias-remision', title: 'Mis Guias de Remision', description: 'Consulta, PDF, XML y correo de guias.' },
  { view: 'nueva-liquidacion-compra', title: 'Nueva Liquidacion de Compra', description: 'Emision de liquidaciones de compra a proveedores.' },
  { view: 'mis-liquidaciones-compra', title: 'Mis Liquidaciones de Compra', description: 'Consulta, PDF, XML y correo de liquidaciones.' },
  { view: 'cuentas-cobrar', title: 'Cuentas por cobrar', description: 'Facturas pendientes y registro de abonos.' },
  { view: 'estado-cuenta', title: 'Estado de cuenta', description: 'Saldos, movimientos y resumen por cliente.' },
  { view: 'comprar-documentos', title: 'Comprar documentos', description: 'Compra paquetes y revisa el saldo disponible.' },
  { view: 'recargas', title: 'Historial de recargas', description: 'Recargas y paquetes de documentos.' },
  { view: 'centro-normativo', title: 'Centro normativo', description: 'Identificaciones, categorias, impuestos y normativa.' },
  { view: 'configuracion', title: 'Configuracion', description: 'Usuarios, roles, permisos, impuestos y parametros.' },
  { view: 'soporte', title: 'Soporte', description: 'Canales de ayuda para e-fact.' },
  { view: 'bot', title: 'Númi Bot', description: 'Asistente de e-fact para resolver tus dudas.' },
  { view: 'tutoriales', title: 'Tutoriales', description: 'Guias de uso disponibles para el usuario.' },
  { view: 'admin-cajas-secuencias', title: 'Cajas y secuencias', description: 'Consulta puntos de emision y ultimos secuenciales.' },
  { view: 'admin-roles-permisos', title: 'Roles y Permisos', description: 'Panel de seguridad, perfiles y permisos.' },
  { view: 'admin-impuestos', title: 'Impuestos', description: 'Codigos de impuesto y porcentajes IVA.' },
  { view: 'admin-usuarios', title: 'Usuarios', description: 'Control de usuarios, roles y seguridad operativa.' },
  { view: 'admin-identificaciones', title: 'Identificaciones', description: 'Catalogo de tipos de identificacion.' },
  { view: 'admin-formas-pago', title: 'Formas de Pago', description: 'Formas de pago y tipos de documento.' },
  { view: 'admin-logs-inicio', title: 'Logs de Inicio', description: 'Historial de accesos y eventos fallidos.' },
  { view: 'admin-retenciones', title: 'Retenciones', description: 'Catalogos fiscales de retenciones IVA, ISD y renta.' },
  { view: 'admin-sql-auditoria', title: 'SQL Auditoria', description: 'Eventos de auditoria SQL y trazabilidad.' },
];

const VIEW_ROUTE_ALIASES: Partial<Record<Exclude<WorkspaceView, 'portal' | 'dashboard' | 'no-autorizado' | 'nuevo-cliente' | 'nuevo-producto' | 'nueva-categoria' | 'nueva-subcategoria' | 'nuevo-emisor' | 'nueva-firma' | 'nuevo-punto-emision'>, string[]>> = {
  perfil: ['perfil', 'profile'],
  emisor: ['emisor', 'empresa'],
  firma: ['firma', 'certificado'],
  'e-rubrica': ['e-rubrica', 'erubrica', 'e-sign', 'firma electronica', 'documentos firmados'],
  'punto-emision': ['punto-emision', 'puntos-emision', 'caja', 'secuencial'],
  'admin-cajas-secuencias': ['cajas-secuencias', 'cajas-y-secuencias', 'caja', 'secuencial'],
  'admin-roles-permisos': ['roles-permisos', 'roles-y-permisos', 'seguridad', 'permisos'],
  'admin-impuestos': ['configuracion-impuestos', 'impuestos', 'porcentajes-iva', 'codigos-impuesto'],
  'admin-usuarios': ['configuracion-usuarios', 'usuarios', 'usuario'],
  'admin-identificaciones': ['identificaciones', 'tipo-identificacion'],
  'admin-formas-pago': ['configuracion-general', 'formas-pago', 'formas-de-pago', 'tipo-documento', 'tipos-documento', 'general'],
  'admin-logs-inicio': ['reportes-logs', 'logs-inicio', 'logs-de-inicio', 'log-inicio'],
  'admin-retenciones': ['configuracion-retenciones', 'retenciones', 'retencion'],
  'admin-sql-auditoria': ['reportes-auditoria-sql', 'auditoria-sql', 'sql-auditoria', 'auditoria'],
  clientes: ['clientes', 'cliente'],
  proveedores: ['proveedores', 'proveedor'],
  productos: ['productos', 'producto', 'servicios'],
  categorias: ['categorias', 'categoria', 'subcategorias', 'subcategoria'],
  facturacion: ['facturacion', 'factura', 'facturas'],
  'nueva-factura': ['facturacion/nueva', 'nueva-factura', 'facturacion', 'factura'],
  'mis-facturas': ['facturas', 'mis-facturas', 'facturacion'],
  cotizaciones: ['cotizaciones', 'cotizacion', 'proformas', 'proforma'],
  'notas-credito': ['nota-credito', 'notas-credito', 'credito'],
  'nueva-nota-credito': ['facturacion/nota-credito', 'nota-credito', 'nueva-nota-credito', 'credito'],
  'mis-notas-credito': ['facturacion/notas-credito-generadas', 'notas-credito-generadas', 'mis-notas-credito', 'notas-credito', 'credito'],
  'notas-debito': ['nota-debito', 'notas-debito', 'debito'],
  'nueva-nota-debito': ['facturacion/nota-debito', 'nota-debito', 'nueva-nota-debito', 'debito'],
  'mis-notas-debito': ['facturacion/notas-debito-generadas', 'notas-debito-generadas', 'mis-notas-debito', 'notas-debito', 'debito'],
  retenciones: ['retenciones', 'retencion'],
  'guias-remision': ['guia-remision', 'guias-remision', 'remision'],
  'nueva-guia-remision': ['facturacion/guia-remision', 'guia-remision', 'nueva-guia-remision', 'remision'],
  'mis-guias-remision': ['facturacion/guias-remision-generadas', 'guias-remision-generadas', 'mis-guias-remision', 'guias-remision'],
  compras: ['compras', 'compra', 'liquidacion'],
  'nueva-liquidacion-compra': ['compras/nueva-liquidacion', 'nueva-liquidacion', 'liquidacion-compra', 'liquidacion-de-compra'],
  'mis-liquidaciones-compra': ['compras/liquidaciones-generadas', 'liquidaciones-generadas', 'mis-liquidaciones', 'liquidaciones-compra'],
  'cuentas-cobrar': ['cuentas-cobrar', 'cuentas-por-cobrar', 'cobrar', 'cxc', 'abonos', 'registro-abonos'],
  'estado-cuenta': ['estado-cuenta', 'cuentas-por-cobrar/estado-cuenta', 'cuenta-cliente'],
  'comprar-documentos': ['compra-documentos', 'comprar-documentos', 'documentos-compra'],
  recargas: ['recargas', 'historial-recargas'],
  reportes: ['reportes', 'logs', 'auditoria'],
  configuracion: ['configuracion', 'usuarios', 'roles', 'permisos', 'impuestos'],
  soporte: ['soporte', 'ayuda'],
  bot: ['bot', 'numi', 'asistente', 'chat'],
  tutoriales: ['tutoriales', 'tutorial'],
  'centro-normativo': ['centro-normativo', 'normativo', 'identificaciones', 'categorias'],
};

const ADMIN_ROUTE_VIEW_MAP: Record<string, WorkspaceView> = {
  'administracion-cajas-secuencias': 'admin-cajas-secuencias',
  'configuracion-seguridad': 'admin-roles-permisos',
  'configuracion-impuestos': 'admin-impuestos',
  'configuracion-usuarios': 'admin-usuarios',
  'configuracion-identificaciones': 'admin-identificaciones',
  'configuracion-general': 'admin-formas-pago',
  'reportes-logs': 'admin-logs-inicio',
  'configuracion-retenciones': 'admin-retenciones',
  'reportes-auditoria-sql': 'admin-sql-auditoria',
};

export function getClaimNumber(user: LoginResponse, key: 'idTipoUsuario' | 'tipoCliente' | 'idUsuario' | 'idJefe') {
  const claims = user.claims;
  const upperKey = key.charAt(0).toUpperCase() + key.slice(1);
  const value = (user[key] ?? claims?.[key] ?? claims?.[upperKey as keyof typeof claims]) as unknown;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getClaimBoolean(user: LoginResponse, key: 'estadoAsociado') {
  const claims = user.claims;
  const value = user[key] ?? claims?.[key] ?? claims?.EstadoAsociado;
  return typeof value === 'boolean' ? value : undefined;
}

export function isSuperAdmin(user: LoginResponse) {
  return getClaimNumber(user, 'idTipoUsuario') === SUPER_ADMIN_TIPO_USUARIO;
}

function flattenMenus(menus: DynamicMenu[]): DynamicMenu[] {
  return menus.flatMap((menu) => {
    const children = menu.hijos ?? menu.children ?? [];
    return [menu, ...flattenMenus(children)];
  });
}

function isMenuEnabled(menu: DynamicMenu) {
  return menu.estado !== false && menu.habilitado !== false;
}

export function normalizeText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

export function normalizeSriState(value?: string | null) {
  const normalized = (value ?? '').trim().toUpperCase().replace(/-/g, '_');
  if (normalized === 'A' || normalized === 'AUTORIZADO' || normalized === 'AUTHORIZED') return 'AUTORIZADO';
  if (normalized === 'P') return 'PENDIENTE';
  if (normalized === 'I' || normalized === 'ENVIADO') return 'PENDIENTE';
  if (normalized === 'ANULADA' || normalized === 'ANULADO' || normalized === 'CANCELADO') return 'ANULADO';
  if (normalized === 'N') return 'RECHAZADO';
  if (normalized === 'ERROR' || normalized === 'FALLIDO' || normalized === 'FAILED') return 'ERROR';
  if (['RECHAZADO', 'DEVUELTA', 'NO_AUTORIZADO', 'NO AUTORIZADO', 'REJECTED'].includes(normalized)) return 'RECHAZADO';
  return normalized === 'PENDIENTE' ? 'PENDIENTE' : normalized;
}

function getServiceDisplayName(service: Pick<ServiceAccess, 'codigo' | 'nombre'>) {
  const rawName = service.nombre ?? service.codigo ?? 'Servicio';
  const normalized = normalizeText(`${service.codigo ?? ''} ${service.nombre ?? ''}`);
  if (normalized.includes('e-sign') || normalized.includes('e-sing') || normalized.includes('e-rubrica')) {
    return 'E-RÚBRICA';
  }

  return rawName.toLocaleUpperCase('es-EC');
}

export function isERubricaService(service: Pick<ServiceAccess, 'codigo' | 'nombre' | 'ruta'>) {
  const source = normalizeText(`${service.codigo ?? ''} ${service.nombre ?? ''} ${service.ruta ?? ''}`);
  return source.includes('e-rubrica') || source.includes('erubrica') || source.includes('e-sign') || source.includes('rubrica');
}

export function getNotificationTone(notification: NotificacionItem) {
  const source = normalizeText(`${notification.type ?? ''} ${notification.title} ${notification.text}`);
  if (source.includes('error') || source.includes('rechaz') || source.includes('anulad') || source.includes('fall') || source.includes('vencid')) return 'danger';
  if (source.includes('advert') || source.includes('pendient') || source.includes('proces') || source.includes('revision') || source.includes('alert')) return 'warning';
  if (source.includes('exito') || source.includes('correct') || source.includes('autoriz') || source.includes('aprob') || source.includes('emitid')) return 'success';
  return 'info';
}

export function getNotificationView(notification: NotificacionItem): WorkspaceView | null {
  const source = normalizeText(`${notification.view ?? ''} ${notification.route ?? ''} ${notification.module ?? ''} ${notification.type ?? ''} ${notification.title} ${notification.text}`);
  const routeMap: Array<[WorkspaceView, string[]]> = [
    ['mis-notas-credito', ['nota-credito', 'notas-credito', 'credito']],
    ['mis-notas-debito', ['nota-debito', 'notas-debito', 'debito']],
    ['mis-liquidaciones-compra', ['liquidacion', 'liquidaciones', 'compra']],
    ['mis-guias-remision', ['guia-remision', 'guias-remision', 'remision']],
    ['retenciones', ['retencion', 'retenciones']],
    ['mis-facturas', ['factura', 'facturas']],
    ['clientes', ['cliente', 'clientes', 'proveedor', 'proveedores']],
    ['productos', ['producto', 'productos', 'categoria', 'subcategoria']],
    ['firma', ['firma', 'certificado']],
    ['punto-emision', ['punto-emision', 'puntos-emision', 'caja', 'serie', 'secuencia']],
    ['cuentas-cobrar', ['cuentas-cobrar', 'cobrar', 'saldo']],
    ['e-rubrica', ['rubrica', 'e-sign']],
    ['bot', ['numi', 'bot', 'asistente']],
  ];
  return routeMap.find(([, terms]) => terms.some((term) => source.includes(term)))?.[0] ?? null;
}

export function getDisplayFirstName(user: LoginResponse, perfil?: PerfilUsuario | null) {
  const value = perfil?.nombres || user.nombres || user.email || 'Usuario';
  return value.split(' ')[0].toLocaleUpperCase('es-EC');
}

export function getProfileAvatarUrl(user: LoginResponse, perfil?: PerfilUsuario | null) {
  return perfil?.avatarUrl || user.avatarUrl || null;
}

export function formatDashboardMoney(value?: number | null) {
  return `$${Math.round(Number(value ?? 0)).toLocaleString('es-EC')}`;
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function saveFileToDevice(sourceUri: string, fileName: string, mimeType: string) {
  if (Platform.OS === 'android') {
    const storage = FileSystem.StorageAccessFramework;
    const permissions = await storage.requestDirectoryPermissionsAsync(storage.getUriForDirectoryInRoot('Download'));
    if (!permissions.granted) return null;

    const target = await storage.createFileAsync(permissions.directoryUri, fileName, mimeType);
    new File(target).write(await new File(sourceUri).bytes());
    return target;
  }

  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error('missing-directory');
  const target = `${documentDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

export async function saveBinaryFileToDevice(bytes: ArrayBuffer, fileName: string, mimeType: string) {
  const extension = /\.[a-z0-9]+$/i.exec(fileName)?.[0] ?? '.bin';
  const safeName = buildDeviceFileName(fileName, extension);
  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDirectory) throw new Error('missing-directory');

  const sourceUri = `${baseDirectory}${safeName}`;
  new File(sourceUri).write(new Uint8Array(bytes));
  const savedUri = await saveFileToDevice(sourceUri, safeName, mimeType);
  return savedUri ? { name: safeName, uri: savedUri, shareUri: sourceUri } : null;
}

export async function exportRowsToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    Alert.alert('Exportar Excel', 'No hay registros para exportar.');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(',')),
  ].join('\n');
  const fileName = buildDeviceFileName(filename, '.csv');
  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDirectory) {
    Alert.alert('Exportar Excel', 'No se encontró almacenamiento disponible en el dispositivo.');
    return;
  }
  try {
    const uri = `${baseDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv);
    const savedUri = await saveFileToDevice(uri, fileName, 'text/csv');
    Alert.alert(
      savedUri ? 'Excel guardado' : 'Exportar Excel',
      savedUri ? `Archivo guardado en el dispositivo: ${fileName}` : 'Selecciona una carpeta para guardar el archivo.',
    );
  } catch {
    Alert.alert('Exportar Excel', 'No se pudo guardar el archivo en el dispositivo.');
  }
}

function menuMatchesView(menu: DynamicMenu, view: Exclude<WorkspaceView, 'portal' | 'dashboard' | 'no-autorizado' | 'nuevo-cliente' | 'nuevo-producto' | 'nueva-categoria' | 'nueva-subcategoria' | 'nuevo-emisor' | 'nueva-firma' | 'nuevo-punto-emision'>) {
  const normalizedRoute = normalizeText(menu.ruta);
  if (ADMIN_ROUTE_VIEW_MAP[normalizedRoute] === view) return true;

  const source = `${normalizedRoute} ${normalizeText(menu.nombre)} ${normalizeText(menu.descripcion)}`;
  return (VIEW_ROUTE_ALIASES[view] ?? []).some((alias) => source.includes(alias));
}

export function getAuthorizedViews(menus: DynamicMenu[]) {
  const activeMenus = flattenMenus(menus).filter(isMenuEnabled);
  const views = new Set<WorkspaceView>();

  EFACT_MODULES.forEach((module) => {
    if (activeMenus.some((menu) => menuMatchesView(menu, module.view as Exclude<WorkspaceView, 'portal' | 'dashboard' | 'no-autorizado' | 'nuevo-cliente' | 'nuevo-producto' | 'nueva-categoria' | 'nueva-subcategoria' | 'nuevo-emisor' | 'nueva-firma' | 'nuevo-punto-emision'>))) {
      views.add(module.view);
    }
  });

  if (activeMenus.some((menu) => menuMatchesView(menu, 'compras'))) {
    views.add('compras');
    views.add('nueva-liquidacion-compra');
    views.add('mis-liquidaciones-compra');
  }

  if (activeMenus.some((menu) => menuMatchesView(menu, 'guias-remision'))) {
    views.add('nueva-guia-remision');
    views.add('mis-guias-remision');
  }

  if (activeMenus.some((menu) => menuMatchesView(menu, 'notas-credito'))) {
    views.add('nueva-nota-credito');
    views.add('mis-notas-credito');
  }

  if (activeMenus.some((menu) => menuMatchesView(menu, 'notas-debito'))) {
    views.add('nueva-nota-debito');
    views.add('mis-notas-debito');
  }

  if (views.size > 0) {
    views.add('dashboard');
    views.add('bot');
    views.add('cuentas-cobrar');
    views.add('estado-cuenta');
  }

  return views;
}

function getLoginMenus(user: LoginResponse) {
  return user.menus ?? user.menuItems ?? [];
}

function hasAdminMenu(menus: DynamicMenu[]) {
  return flattenMenus(menus).some((menu) => {
    const route = normalizeText(menu.ruta);
    const source = `${route} ${normalizeText(menu.nombre)} ${normalizeText(menu.descripcion)}`;
    return route.startsWith('administracion') || route.startsWith('configuracion') || source.includes('administracion');
  });
}

function isBackofficeOnlyUser(user: LoginResponse) {
  const activeMenus = flattenMenus(getLoginMenus(user)).filter(isMenuEnabled);
  return activeMenus.length > 0 && hasAdminMenu(activeMenus) && activeMenus.every(isAdministrationMenu);
}

function mergeMobileBaseMenus(menus: DynamicMenu[], includeAdmin = false) {
  const visibleMenus = menus.filter((menu) => !isAdministrationMenu(menu));
  const existingRoutes = new Set(visibleMenus.map((menu) => normalizeText(menu.ruta || menu.nombre)));
  const baseMenus = BASE_EFACT_MOBILE_MENUS;
  const missingBaseMenus = baseMenus.filter((menu) => !existingRoutes.has(normalizeText(menu.ruta || menu.nombre)));

  return [...visibleMenus, ...missingBaseMenus];
}

function isAdministrationMenu(menu: DynamicMenu) {
  const route = normalizeText(menu.ruta);
  const name = normalizeText(menu.nombre);
  return route.startsWith('administracion') ||
    route.startsWith('configuracion/seguridad') ||
    route.startsWith('configuracion/impuestos') ||
    route.startsWith('configuracion/usuarios') ||
    route.startsWith('configuracion/identificaciones') ||
    route.startsWith('configuracion/general') ||
    route.startsWith('configuracion/retenciones') ||
    route.startsWith('reportes/logs') ||
    route.startsWith('reportes/auditoria-sql') ||
    name.includes('roles') ||
    name.includes('sql auditoria');
}

export function getInitialMenus(user: LoginResponse) {
  const loginMenus = getLoginMenus(user);

  if (loginMenus.length > 0) {
    return loginMenus;
  }

  return getClaimNumber(user, 'idUsuario') ? mergeMobileBaseMenus([], isSuperAdmin(user)) : [];
}

export function getServicesFromUser(user: LoginResponse, menus: DynamicMenu[]) {
  const explicit = user.servicios ?? [];
  const fromMenus: ServiceAccess[] = flattenMenus(menus)
    .filter((menu) => menu.codigoServicio || menu.servicio)
    .map((menu) => ({
      codigo: menu.codigoServicio ?? menu.servicio ?? undefined,
      nombre: menu.servicio ?? menu.codigoServicio ?? menu.nombre,
      ruta: menu.ruta,
      estado: menu.estado,
      habilitado: menu.habilitado,
    }));

  const fallbackServices = isSuperAdmin(user) && explicit.length === 0 && fromMenus.length === 0 ? SUPER_ADMIN_SERVICE_CATALOG : [];

  const unique = new Map<string, ServiceAccess>();
  [...explicit, ...fromMenus, ...fallbackServices]
    .filter((service) => service.estado !== false && service.habilitado !== false)
    .forEach((service) => {
      const key = normalizeText(getServiceDisplayName(service));
      if (!unique.has(key)) unique.set(key, service);
    });

  return Array.from(unique.values());
}

export function getCajaSerieForDocument(preparacion: FacturaPreparacion | null, kind: 'factura' | 'notaCredito' | 'notaDebito' | 'liquidacion' | 'guia') {
  const caja = preparacion?.caja;
  if (!caja) return '';

  if (kind === 'notaCredito') return caja.serieNotasCred || caja.serieFactura || '';
  if (kind === 'notaDebito') return caja.serieNotasDeb || caja.serieFactura || '';
  if (kind === 'liquidacion') return caja.serieLiquidacion || caja.serieLiquidacionCompra || caja.serieFactura || '';
  if (kind === 'guia') return caja.serieGuia || caja.serieFactura || '';
  return caja.serieFactura || '';
}

export function AppContent({ BusinessHome }: { BusinessHome: ComponentType<BusinessHomeProps> }) {
  const reduceMotion = useReducedMotion();
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [currentUser, setCurrentUser] = useState<LoginResponse | null>(null);
  const [registerStep, setRegisterStep] = useState(0);
  const [avatarGalleryOpen, setAvatarGalleryOpen] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<AvatarCategory>('Todos');
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [biometricCredentials, setBiometricCredentials] = useState<BiometricCredentials | null>(null);
  const [biometricPendingLogin, setBiometricPendingLogin] = useState<{ response: LoginResponse; credentials: BiometricCredentials } | null>(null);
  const [privacyPendingLogin, setPrivacyPendingLogin] = useState<{ idUsuario: number; username: string; password: string; recordarme: boolean } | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  const [incomingPdfUri, setIncomingPdfUri] = useState<string | null>(null);
  const [networkAvailable, setNetworkAvailable] = useState<boolean | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'biometric'>('password');

  const [registerForm, setRegisterForm] = useState<RegisterRequest>(initialRegisterForm);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [changeForm, setChangeForm] = useState<ChangePasswordRequest>(initialChangeForm);

  useEffect(() => {
    const captureIncomingPdf = (uri: string | null) => {
      if (uri?.startsWith('content://') || uri?.startsWith('file://')) setIncomingPdfUri(uri);
    };
    void Linking.getInitialURL().then(captureIncomingPdf).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => captureIncomingPdf(url));
    return () => subscription.remove();
  }, []);

  const resetLocalSession = (removeBiometric = false) => {
    const activeUserId = currentUser?.idUsuario ?? 0;
    if (activeUserId > 0) void clearBotHistory(activeUserId);
    clearAuthSession();
    setCurrentUser(null);
    setPassword('');
    setMessage(null);
    setMode('login');
    setBiometricPendingLogin(null);
    setPrivacyPendingLogin(null);
    setPrivacyAccepted(false);
    setPrivacyMessage(null);
    if (removeBiometric) {
      const accountUserId = currentUser ? getClaimNumber(currentUser, 'idJefe') ?? activeUserId : activeUserId;
      if (accountUserId > 0) void SecureStore.deleteItemAsync(`${INVOICE_DRAFT_KEY_PREFIX}.${accountUserId}`).catch(() => undefined);
      void SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY).catch(() => undefined);
      setBiometricCredentials(null);
    }
  };

  useEffect(() => {
    setAuthFailureHandler(() => resetLocalSession(false));
    return () => setAuthFailureHandler(null);
  }, [currentUser]);

  useEffect(() => {
    let mounted = true;
    const minSplash = delay(LAUNCH_DURATION_MS);

    const authCheck = checkAuth()
      .then((response) => {
        if (!mounted || !response?.authenticated) return;
        if (isBackofficeOnlyUser(response)) {
          clearAuthSession();
          setMessage({ type: 'error', text: BACKOFFICE_UNAVAILABLE_MESSAGE });
          return;
        }
        setCurrentUser(response);
      })
      .catch(() => undefined);

    Promise.all([minSplash, authCheck]).finally(() => {
      if (mounted) setBooting(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const updateNetworkState = (state: NetInfoState) => {
      if (mounted) {
        setNetworkAvailable(state.isConnected ?? true);
      }
    };
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);
    void NetInfo.fetch().then(updateNetworkState).catch(() => undefined);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([getBiometricLabel(), readBiometricCredentials()])
      .then(([label, credentials]) => {
        if (!mounted) return;
        setBiometricLabel(label);
        setBiometricCredentials(credentials);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const runRequest = async (action: () => Promise<void>) => {
    if (loading) return;

    setLoading(true);
    setMessage(null);

    try {
      await action();
    } catch (error) {
      const text =
        error instanceof ApiError ? error.message : 'No se pudo completar la solicitud. Intenta nuevamente.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = () =>
    runRequest(async () => {
      const validation = validateLogin(username, password);
      if (!validation.valid) {
        setMessage({ type: 'error', text: validation.message ?? '' });
        return;
      }

      setAuthenticating(true);

      try {
        const response = await login({ username, password, recordarme });
        await delay(350);

        if (isBackofficeOnlyUser(response)) {
          clearAuthSession();
          setMessage({ type: 'error', text: BACKOFFICE_UNAVAILABLE_MESSAGE });
          return;
        }

        if (response.requierePoliticas) {
          setPrivacyPendingLogin({ idUsuario: response.idUsuario ?? 0, username, password, recordarme });
          setPrivacyAccepted(false);
          setPrivacyMessage(null);
          return;
        }

        if (response.requiereCambioClave && response.idUsuario) {
          setChangeForm((current) => ({ ...current, idUsuario: response.idUsuario ?? 0 }));
          setMode('change');
          setMessage({ type: 'info', text: 'Ingresa el codigo de acceso o clave temporal para crear una nueva clave.' });
          return;
        }

        if (biometricLabel && !biometricCredentials) {
          setBiometricPendingLogin({ response, credentials: { username, password } });
        } else if (recordarme && biometricLabel) {
          await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify({ username, password }));
          setBiometricCredentials({ username, password });
        } else if (!recordarme) {
          await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
          setBiometricCredentials(null);
        }

        if (biometricLabel && !biometricCredentials) return;
        setCurrentUser(response);
      } finally {
        setAuthenticating(false);
      }
    });

  const submitBiometricLogin = () =>
    runRequest(async () => {
      if (!biometricCredentials || !biometricLabel) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Acceder a e-fact con ${biometricLabel}`,
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      if (!result.success) return;
      setAuthenticating(true);
      try {
        const response = await login({ ...biometricCredentials, recordarme: true });
        if (isBackofficeOnlyUser(response)) {
          clearAuthSession();
          setMessage({ type: 'error', text: BACKOFFICE_UNAVAILABLE_MESSAGE });
          return;
        }
        if (response.requierePoliticas) {
          setPrivacyPendingLogin({ idUsuario: response.idUsuario ?? 0, username: biometricCredentials.username, password: biometricCredentials.password, recordarme: true });
          setPrivacyAccepted(false);
          setPrivacyMessage(null);
          return;
        }
        setCurrentUser(response);
      } finally {
        setAuthenticating(false);
      }
    });

  const submitRegister = () =>
    runRequest(async () => {
      const validation = validateRegisterForm(registerForm);
      if (!validation.valid) {
        setMessage({ type: 'error', text: validation.message ?? '' });
        return;
      }

      const response = await register({
        ...registerForm,
        avatarUrl: registerForm.avatarUrl || initialsAvatarDataUri(registerForm.nombres, registerForm.apellidos, registerForm.razonSocial),
      });
      setMessage({ type: 'success', text: response.message ?? 'Cuenta creada correctamente.' });
      setRegisterStep(0);
      setMode('login');
    });

  const submitRecover = () =>
    runRequest(async () => {
      const validation = validateEmail(recoverEmail);
      if (!validation.valid) {
        setMessage({ type: 'error', text: validation.message ?? '' });
        return;
      }

      const response = await recoverPassword({ email: recoverEmail });
      if (response.idUsuario) {
        setChangeForm((current) => ({ ...current, idUsuario: response.idUsuario ?? 0 }));
        setMode('change');
      }

      setMessage({
        type: 'success',
        text: response.message ?? 'Se envio un mensaje a tu correo para recuperar tu clave.',
      });
    });

  const submitChangePassword = () =>
    runRequest(async () => {
      const validation = validateChangePassword(changeForm);
      if (!validation.valid) {
        setMessage({ type: 'error', text: validation.message ?? '' });
        return;
      }

      const response = await changePassword(changeForm);
      setMessage({ type: 'success', text: response.message ?? 'Clave actualizada correctamente.' });
      setChangeForm(initialChangeForm);
      setMode('login');
    });

  const updateRegister = <K extends keyof RegisterRequest>(key: K, value: RegisterRequest[K]) => {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  };

  const selectRegisterAvatar = (value: string, label: string) => {
    updateRegister('avatarUrl', value);
    setAvatarGalleryOpen(false);
    Alert.alert('Avatar seleccionado', `${label} quedó aplicado a tu cuenta.`);
  };

  const continueRegister = () => {
    const validation = registerStep === 0
      ? validateRegisterForm({ ...registerForm, email: 'paso@efact.local', direccion: 'Direccion temporal', password: 'Aa1!aaaa' })
      : registerStep === 1
        ? validateRegisterForm({ ...registerForm, password: 'Aa1!aaaa' })
        : validateRegisterForm(registerForm);

    if (registerStep === 1 && (!registerForm.email.trim() || !registerForm.direccion.trim() || registerForm.direccion.trim().length < 5)) {
      setMessage({ type: 'error', text: 'Completa un correo y una direccion valida para continuar.' });
      return;
    }
    if (!validation.valid && registerStep < 2) {
      setMessage({ type: 'error', text: validation.message ?? 'Revisa los datos de este paso.' });
      return;
    }
    setMessage(null);
    setRegisterStep((step) => Math.min(step + 1, 2));
  };

  const updateChange = <K extends keyof ChangePasswordRequest>(key: K, value: ChangePasswordRequest[K]) => {
    setChangeForm((current) => ({ ...current, [key]: value }));
  };

  const selectedAvatar = registerForm.avatarUrl.split('/').pop() || '';
  const registerInitials = getInitials(registerForm.nombres, registerForm.apellidos, registerForm.razonSocial);
  const visibleAvatars = avatarCategory === 'Todos' ? AVATARS : AVATARS.filter((avatar) => getAvatarCategory(avatar) === avatarCategory);

  const continueAfterBiometricOffer = async (enable: boolean) => {
    if (!biometricPendingLogin) return;
    if (enable) {
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(biometricPendingLogin.credentials));
      setBiometricCredentials(biometricPendingLogin.credentials);
    }
    setCurrentUser(biometricPendingLogin.response);
    setBiometricPendingLogin(null);
  };

  const retryNetwork = async () => {
    setCheckingNetwork(true);
    try {
      const state = await NetInfo.fetch();
      setNetworkAvailable(state.isConnected ?? true);
    } finally {
      setCheckingNetwork(false);
    }
  };

  const confirmPrivacyPolicy = () => runRequest(async () => {
    if (!privacyPendingLogin) return;
    if (!privacyAccepted) {
      setPrivacyMessage('Debes marcar la aceptación para continuar.');
      return;
    }
    await acceptPrivacyPolicy(privacyPendingLogin);
    const response = await login({
      username: privacyPendingLogin.username,
      password: privacyPendingLogin.password,
      recordarme: privacyPendingLogin.recordarme,
    });
    setPrivacyPendingLogin(null);
    setPrivacyAccepted(false);
    setPrivacyMessage(null);
    if (response.requiereCambioClave && response.idUsuario) {
      setChangeForm((current) => ({ ...current, idUsuario: response.idUsuario ?? 0 }));
      setMode('change');
      setMessage({ type: 'info', text: 'Ingresa el código de acceso o clave temporal para crear una nueva clave.' });
      return;
    }
    setCurrentUser(response);
  });

  if (booting) {
    return <AppLaunchScreen reduceMotion={reduceMotion} />;
  }

  if (networkAvailable === false) {
    return <OfflineScreen checking={checkingNetwork} onRetry={retryNetwork} onOpenSettings={() => { void Linking.openSettings().catch(() => undefined); }} />;
  }

  if (authenticating) {
    return <LoadingScreen />;
  }

  if (privacyPendingLogin) {
    return <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}><PrivacyPolicyScreen requireAcceptance accepted={privacyAccepted} saving={loading} message={privacyMessage} onToggleAccepted={() => { setPrivacyAccepted((value) => !value); setPrivacyMessage(null); }} onAccept={confirmPrivacyPolicy} /></ScrollView>;
  }

  if (currentUser) {
    return (
      <BusinessHome
        currentUser={currentUser}
        incomingPdfUri={incomingPdfUri}
        onIncomingPdfHandled={() => setIncomingPdfUri(null)}
        onLogout={() => {
          void logoutSession().catch(() => undefined).finally(() => resetLocalSession(false));
        }}
      />
    );
  }

  return (
    <>
      <ScreenFrame centered={mode !== 'register'}>
        <AuthCard key={mode} wide={mode === 'register'} login={mode === 'login'} reduceMotion={reduceMotion}>
        {mode === 'login' ? (
          <>
            <View style={styles.loginBrand}>
              <BrandMark />
              <View>
                <Text style={styles.loginProductName}>NUMÉRICA SOFTWARE</Text>
                <Text style={styles.loginProductCaption}>Soluciones digitales</Text>
              </View>
            </View>
            <Text style={[styles.title, styles.loginTitle]}>Te damos la bienvenida</Text>
            <Text style={[styles.subtitle, styles.loginSubtitle]}>Ingresa para continuar con tu gestión</Text>
            <LoginActionTiles
              active={loginMethod}
              biometricLabel={biometricLabel}
              onPassword={() => setLoginMethod('password')}
              onBiometric={() => {
                setLoginMethod('biometric');
                if (biometricCredentials && biometricLabel) submitBiometricLogin();
                else setMessage({ type: 'info', text: 'Activa el acceso biométrico después de iniciar sesión por primera vez.' });
              }}
            />
            {message ? <MessageBox message={message} /> : null}
            {loginMethod === 'password' ? <View style={styles.form}>
              <Field label="Usuario / Correo *" value={username} onChangeText={setUsername} autoCapitalize="none" />
              <Field label="Contraseña *" value={password} onChangeText={setPassword} secureTextEntry />
              <View style={styles.rowBetween}>
                <Pressable style={styles.checkRow} onPress={() => setRecordarme((value) => !value)}>
                  <View style={[styles.checkbox, recordarme && styles.checkboxChecked]}>
                    {recordarme ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <Text style={styles.rememberText}>Recordarme</Text>
                </Pressable>
                <TextLink label="Olvidaste tu clave?" onPress={() => setMode('forgot')} />
              </View>
              <PrimaryButton label="Ingresar ahora" loading={loading} onPress={submitLogin} />
            </View> : null}
            <InlineSwitch muted="No tienes cuenta?" action="Solicitar Registro" onPress={() => setMode('register')} />
          </>
        ) : null}

        {mode === 'register' ? (
          <>
            <View style={styles.loginBrand}>
              <BrandMark />
              <View>
                <Text style={styles.loginProductName}>NUMÉRICA SOFTWARE</Text>
                <Text style={styles.loginProductCaption}>Soluciones digitales</Text>
              </View>
            </View>
            <Text style={styles.title}>Crear tu cuenta</Text>
            <Text style={styles.subtitle}>Te guiaremos paso a paso para dejar tu cuenta lista.</Text>
            {message ? <MessageBox message={message} /> : null}

            <View style={styles.registerProgress}>
              <View style={styles.stepper}>
              {['Datos', 'Contacto', 'Perfil'].map((step, index) => (
                <View key={step} style={styles.stepItem}>
                  <View style={[styles.stepDot, index <= registerStep && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, index <= registerStep && styles.stepDotTextActive]}>{index < registerStep ? '✓' : index + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, index === registerStep && styles.stepLabelActive]}>{step}</Text>
                </View>
              ))}
              </View>
              <View style={styles.stepProgressTrack}>
                <View style={[styles.stepProgressFill, { width: `${(registerStep / 2) * 100}%` }]} />
              </View>
              <Text style={styles.stepProgressCaption}>Paso {registerStep + 1} de 3</Text>
            </View>

            {registerStep === 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>¿Cómo vas a usar e-fact?</Text>
                <Text style={styles.sectionHint}>Elige el tipo de cuenta que mejor describe tu negocio.</Text>
                <View style={styles.segment}>
                  <SegmentButton active={registerForm.tipoCliente === 1} icon="account-outline" label="Persona Natural" description="Para una persona" onPress={() => updateRegister('tipoCliente', 1)} />
                  <SegmentButton active={registerForm.tipoCliente === 2} icon="domain" label="Empresa" description="Para un negocio" onPress={() => updateRegister('tipoCliente', 2)} />
                </View>
                <Text style={styles.fieldGroupHint}>Selecciona un documento de identificación</Text>
                <View style={styles.documentOptions}>
                  <View style={styles.documentOptionRow}>
                    {([['CEDULA', 'Cédula ecuatoriana', 'card-account-details-outline'], ['RUC', 'Registro tributario', 'file-document-outline']] as [TipoDocumento, string, React.ComponentProps<typeof MaterialCommunityIcons>['name']][]).map(([tipo, description, icon]) => (
                      <SegmentButton
                        key={tipo}
                        active={registerForm.tipoDocumento === tipo}
                        label={tipo}
                        description={description}
                        icon={icon}
                        onPress={() =>
                          setRegisterForm((current) => ({
                            ...current,
                            tipoDocumento: tipo,
                            identificacion: sanitizeIdentificacion(tipo, current.identificacion),
                          }))
                        }
                      />
                    ))}
                  </View>
                  <View style={styles.documentOptionRow}>
                    <SegmentButton
                      active={registerForm.tipoDocumento === 'PASAPORTE'}
                      label="Identificación del exterior"
                      description="Para documentos extranjeros"
                      icon="passport"
                      onPress={() =>
                        setRegisterForm((current) => ({
                          ...current,
                          tipoDocumento: 'PASAPORTE',
                          identificacion: sanitizeIdentificacion('PASAPORTE', current.identificacion),
                        }))
                      }
                    />
                  </View>
                </View>
                {registerForm.tipoCliente === 2 ? (
                  <Field label="Razon social *" value={registerForm.razonSocial} onChangeText={(value) => updateRegister('razonSocial', value)} />
                ) : (
                  <>
                    <Field label="Nombres *" value={registerForm.nombres} onChangeText={(value) => updateRegister('nombres', value)} />
                    <Field label="Apellidos *" value={registerForm.apellidos} onChangeText={(value) => updateRegister('apellidos', value)} />
                  </>
                )}
                <Field
                  label="Identificacion *"
                  value={registerForm.identificacion}
                  onChangeText={(value) => updateRegister('identificacion', sanitizeIdentificacion(registerForm.tipoDocumento, value))}
                  autoCapitalize="characters"
                />
              </View>
            ) : null}

            {registerStep === 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>¿Cómo te contactamos?</Text>
                <Text style={styles.sectionHint}>Usaremos estos datos para avisarte sobre tus documentos y cuenta.</Text>
                <Field label="Celular *" value={registerForm.celular} onChangeText={(value) => updateRegister('celular', value)} keyboardType="phone-pad" />
                <Field label="Email *" value={registerForm.email} onChangeText={(value) => updateRegister('email', value)} autoCapitalize="none" keyboardType="email-address" />
                <Field label="Direccion *" value={registerForm.direccion} onChangeText={(value) => updateRegister('direccion', value)} />
              </View>
            ) : null}

            {registerStep === 2 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Protege y personaliza tu cuenta</Text>
                <Text style={styles.sectionHint}>Crea una contraseña segura y elige cómo quieres identificarte.</Text>
                <View style={styles.registerReviewCard}>
                  <Text style={styles.registerReviewTitle}>Revisa tu información</Text>
                  <Text style={styles.registerReviewValue}>{registerForm.tipoCliente === 2 ? registerForm.razonSocial : `${registerForm.nombres} ${registerForm.apellidos}`}</Text>
                  <Text style={styles.registerReviewMeta}>{registerForm.email} · {registerForm.identificacion}</Text>
                </View>
                <Field label="Contraseña segura *" value={registerForm.password} onChangeText={(value) => updateRegister('password', value)} secureTextEntry />
                <Text style={styles.passwordHint}>Mínimo 8 caracteres: mayúscula, minúscula, número y símbolo.</Text>
                <Pressable accessibilityLabel="Abrir galería de avatares" style={styles.avatarPreview} onPress={() => setAvatarGalleryOpen(true)}>
                  {isInitialsAvatar(registerForm.avatarUrl) ? (
                    <InitialsAvatar initials={registerInitials} size={56} />
                  ) : (
                    <Image source={avatarImageSource(selectedAvatar)} style={styles.avatarTileImage} />
                  )}
                  <View style={styles.avatarInfo}>
                    <Text style={styles.avatarTitle}>{isInitialsAvatar(registerForm.avatarUrl) ? 'Iniciales del nombre' : 'Avatar seleccionado'}</Text>
                    <Text style={styles.mutedText}>{AVATARS.length} avatares disponibles</Text>
                    <Text style={styles.avatarTapHint}>Toca aquí para cambiarlo</Text>
                  </View>
                </Pressable>
                <Modal visible={avatarGalleryOpen} transparent animationType="slide" onRequestClose={() => setAvatarGalleryOpen(false)}>
                  <View style={styles.avatarModalOverlay}>
                    <Pressable style={styles.avatarModalBackdrop} onPress={() => setAvatarGalleryOpen(false)} />
                    <View style={styles.avatarModalCard}>
                      <View style={styles.avatarModalHeader}>
                        <View>
                          <Text style={styles.avatarModalEyebrow}>PERSONALIZA TU CUENTA</Text>
                          <Text style={styles.avatarModalTitle}>Elige tu avatar</Text>
                        </View>
                        <Pressable style={styles.avatarModalClose} onPress={() => setAvatarGalleryOpen(false)}>
                          <Text style={styles.avatarModalCloseText}>×</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.avatarModalHint}>Toca una opción para seleccionarla.</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarCategoryTabs}>
                        {AVATAR_CATEGORIES.map((category) => (
                          <Pressable key={category} style={[styles.avatarCategoryTab, avatarCategory === category && styles.avatarCategoryTabActive]} onPress={() => setAvatarCategory(category)}>
                            <Text numberOfLines={1} style={[styles.avatarCategoryText, avatarCategory === category && styles.avatarCategoryTextActive]}>{category}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <ScrollView style={styles.avatarGalleryScroll} contentContainerStyle={styles.avatarGalleryGrid} showsVerticalScrollIndicator={false}>
                        {avatarCategory === 'Todos' || avatarCategory === 'Especiales' ? (
                          <Pressable
                            style={[styles.avatarGalleryItem, isInitialsAvatar(registerForm.avatarUrl) && styles.avatarChoiceActive]}
                            onPress={() => selectRegisterAvatar('', 'Mis iniciales')}
                          >
                            <InitialsAvatar initials={registerInitials} size={62} />
                            <Text numberOfLines={2} style={styles.avatarGalleryLabel}>Mis iniciales</Text>
                          </Pressable>
                        ) : null}
                        {visibleAvatars.map((avatar) => (
                          <Pressable
                            key={avatar}
                            style={[styles.avatarGalleryItem, selectedAvatar === avatar && styles.avatarChoiceActive]}
                            onPress={() => selectRegisterAvatar(avatarPath(avatar), avatar.replace(/[-_]/g, ' '))}
                          >
                            <Image source={avatarImageSource(avatar)} style={styles.avatarGalleryImage} />
                            <Text numberOfLines={2} style={styles.avatarGalleryLabel}>{avatar.replace(/[-_]/g, ' ')}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </View>
            ) : null}

            <View style={styles.registerActions}>
              {registerStep > 0 ? <SecondaryButton label="Volver al paso anterior" onPress={() => setRegisterStep((step) => step - 1)} /> : null}
              {registerStep < 2 ? (
                <PrimaryButton label={registerStep === 0 ? 'Continuar a contacto' : 'Continuar a seguridad'} loading={false} onPress={continueRegister} />
              ) : (
                <PrimaryButton label="Crear mi cuenta" loading={loading} onPress={submitRegister} />
              )}
            </View>
            <InlineSwitch muted="Ya tienes cuenta?" action="Inicia sesion" onPress={() => setMode('login')} />
          </>
        ) : null}

        {mode === 'forgot' ? (
          <>
            <BrandLockup />
            <Text style={styles.title}>Recuperar acceso</Text>
            <Text style={styles.subtitle}>Ingresa tu correo para recibir instrucciones y volver a entrar a tu cuenta.</Text>
            {message ? <MessageBox message={message} /> : null}
            <View style={styles.recoveryInfoCard}>
              <MaterialCommunityIcons name="information-outline" size={19} color="#0072BD" />
              <Text style={styles.recoveryInfoText}>Usa el correo registrado en e-fact. Revisa también tu carpeta de spam.</Text>
            </View>
            <View style={styles.form}>
              <Field label="Correo electrónico registrado *" value={recoverEmail} onChangeText={setRecoverEmail} autoCapitalize="none" keyboardType="email-address" />
              <PrimaryButton label="Enviar instrucciones" loading={loading} onPress={submitRecover} />
            </View>
            <InlineSwitch muted="¿Recordaste tu contraseña?" action="Volver al inicio de sesión" onPress={() => setMode('login')} />
          </>
        ) : null}

        {mode === 'change' ? (
          <>
            <BrandLockup />
            <Text style={styles.title}>Cambiar contraseña</Text>
            <Text style={styles.subtitle}>Actualiza tu acceso para continuar de forma segura.</Text>
            {message ? <MessageBox message={message} /> : null}
            <View style={styles.changeSecurityCard}>
              <View style={styles.changeSecurityIcon}>
                <MaterialCommunityIcons name="shield-lock-outline" size={23} color="#0072BD" />
              </View>
              <View style={styles.changeSecurityCopy}>
                <Text style={styles.changeSecurityTitle}>Protege tu cuenta</Text>
                <Text style={styles.changeSecurityText}>Usa una clave que no hayas utilizado antes y mantenla en un lugar seguro.</Text>
              </View>
            </View>
            <View style={styles.form}>
              <View style={styles.changeFieldsCard}>
                <Text style={styles.changeFieldsEyebrow}>DATOS DE ACCESO</Text>
                <Text style={styles.changeFieldsHint}>Completa los datos para definir tu nueva clave.</Text>
                <Field label="Id usuario *" value={changeForm.idUsuario ? String(changeForm.idUsuario) : ''} onChangeText={(value) => updateChange('idUsuario', Number(value.replace(/\D/g, '')))} keyboardType="number-pad" />
                <Field label="Codigo o clave temporal *" value={changeForm.claveActual} onChangeText={(value) => updateChange('claveActual', value)} secureTextEntry />
                <Field label="Nueva clave *" value={changeForm.nuevaClave} onChangeText={(value) => updateChange('nuevaClave', value)} secureTextEntry />
                <Field label="Confirmar clave *" value={changeForm.confirmarClave} onChangeText={(value) => updateChange('confirmarClave', value)} secureTextEntry />
                <Text style={styles.changePasswordHint}>Mínimo 10 caracteres: mayúscula, minúscula, número y símbolo.</Text>
              </View>
              <PrimaryButton label="Actualizar clave" loading={loading} onPress={submitChangePassword} />
            </View>
            <InlineSwitch muted="Volver a" action="Login" onPress={() => setMode('login')} />
          </>
        ) : null}
        </AuthCard>
      </ScreenFrame>
      {biometricPendingLogin && biometricLabel ? (
        <BiometricSetupModal label={biometricLabel} onChoose={continueAfterBiometricOffer} />
      ) : null}
    </>
  );
}
