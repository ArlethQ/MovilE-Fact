import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiError, clearAuthSession, getAuthSessionCookie, setAuthFailureHandler } from '../../services/apiClient';
import { clearBotHistory, loadBotHistory, saveBotHistory, sendBotMessage } from '../../services/botService';
import type { BotWorkflowState } from '../../services/botService';
import { API_BASE_URL } from '../../config/api';
import { AdminMobileItem, getAdminMobileModule } from '../../services/adminMobileService';
import { changePassword, checkAuth, login, logout as logoutSession, recoverPassword, register } from '../../services/authService';
import { createCategoria, createSubcategoria, deleteCategoria, deleteSubcategoria, getCategorias, getSubcategorias, updateCategoria, updateSubcategoria } from '../../services/categoriasService';
import { createCliente, deleteCliente, getCiudades, getClienteLookups, getClientes, getProvincias, updateCliente } from '../../services/clientesService';
import { consultarEmisorSri, createEmisor, deleteEmisor, getEmisor, getEmisores, getFirmaEstado, updateEmisor, uploadFirmaArchivo } from '../../services/emisoresService';
import { anularFactura, buscarFacturaClientes, buscarFacturaProductos, enviarFacturaCorreo, FacturaDetalle, FacturaListItem, FacturaPreparacion, FacturaProducto, getFacturaDetalle, getFacturaPdf, getFacturas, getFacturaPreparacion, getFacturaXml, guardarFactura, reintentarFacturaSri } from '../../services/facturasMobileService';
import { anularGuiaRemision, buscarGuiaClientes, buscarGuiaFacturas, buscarGuiaProductos, buscarGuiaTransportistas, emitirGuiaRemision, enviarGuiaRemisionCorreo, getGuiaRemisionPdf, getGuiaRemisionPreparacion, getGuiaTransportista, getGuiasRemision, getGuiaRemisionXml, guardarGuiaRemision, GuiaRemisionDetalleInput, GuiaRemisionListItem } from '../../services/guiasRemisionMobileService';
import { getMenusByRol, hasMenusByRolEndpoint } from '../../services/menuService';
import { buscarLiquidacionProductos, buscarLiquidacionProveedores, emitirLiquidacionCompra, enviarLiquidacionCompraCorreo, getLiquidacionCompraPdf, getLiquidacionCompraPreparacion, getLiquidacionesCompra, getLiquidacionCompraRetencionBases, getLiquidacionCompraXml, guardarLiquidacionCompra, getLiquidacionCodigoPorcentaje, LiquidacionCompraListItem } from '../../services/liquidacionesCompraMobileService';
import { anularNotaCredito, buscarNotaCreditoFacturas, emitirNotaCredito, emitirNotaCreditoAutomatica, enviarNotaCreditoCorreo, getNotaCreditoDetallesDisponibles, getNotaCreditoPdf, getNotaCreditoPreparacion, getNotasCredito, getNotaCreditoXml, guardarNotaCredito, NotaCreditoListItem } from '../../services/notasCreditoMobileService';
import { anularNotaDebito, buscarNotaDebitoFacturas, emitirNotaDebito, enviarNotaDebitoCorreo, getNotaDebitoPdf, getNotaDebitoPreparacion, getNotasDebito, getNotaDebitoXml, guardarNotaDebito, NotaDebitoListItem } from '../../services/notasDebitoMobileService';
import { dismissNotifications, getNotificaciones, NotificacionItem } from '../../services/notificacionesService';
import { syncDeviceNotifications } from '../../services/deviceNotificationsService';
import { CompraDocumentosEstado, CompraDocumentosTransferenciaInput, createOperationalItem, deleteOperationalItem, getCompraDocumentosEstado, getEstadoCuentaDetalle, getEstadoCuentaExcel, getEstadoCuentaListadoExcel, getEstadoCuentaPdf, getOperationalMobileModule, iniciarPagoCompraDocumentos, OperationalMobileItem, OperationalModule, registrarTransferenciaCompraDocumentos, updateOperationalItem } from '../../services/operationalMobileService';
import { getPerfil, updatePerfil, uploadPerfilAvatar } from '../../services/perfilService';
import { createPuntoEmision, deletePuntoEmision, getPuntoEmisionSiguienteSecuencial, getPuntosEmision, markPuntoPrincipal, PuntoDocumentoKey, savePuntoEmisionSecuenciaInicial, updatePuntoEmision } from '../../services/puntosEmisionService';
import { createProducto, deleteProducto, getProducto, getProductoLookups, getProductos, getProductoSubcategorias, updateProducto } from '../../services/productosService';
import { crearRetencionDesdeLiquidacion, emitirRetencionSri, enviarRetencionCorreo, getRetencionCatalogo, getRetencionPdf, getRetenciones, getRetencionXml, LiquidacionRetencionInput, RetencionCatalogItem, RetencionListItem } from '../../services/retencionesMobileService';
import { ERubricaDashboard, getERubricaDashboard, sincronizarERubricaPendientes } from '../../services/erubricaMobileService';
import { ChangePasswordRequest, DynamicMenu, LoginResponse, RegisterRequest, ServiceAccess, TipoDocumento } from '../../types/auth';
import { CategoriaCatalogo, CiudadLookup, Cliente, ClienteLookups, Emisor, FirmaEstado, PerfilLookup, PerfilUsuario, Producto, ProductoLookups, ProductoTipo, ProvinciaLookup, PuntoEmision, PuntosEmisionData, SubcategoriaCatalogo, SubcategoriaLookup } from '../../types/business';
import {
  sanitizeIdentificacion,
  validateChangePassword,
  validateEmail,
  validateIdentificacion,
  validateLogin,
  validateRegisterForm,
} from '../../utils/authValidation';
import { ItemDetailModal, ResultCollection } from '../../components/data/ResultCollection';
import { ClienteForm as ExtractedClienteForm } from '../../components/clientes/ClienteForm';
import { AccountStatementScreen as ExtractedAccountStatementScreen, AccountsReceivableScreen as ExtractedAccountsReceivableScreen, getAccountStatementClientId, getAccountStatementNumber, OperationalForm as ExtractedOperationalForm, PurchaseDocumentsScreen as ExtractedPurchaseDocumentsScreen } from '../../components/cuentas/OperationalFinancialScreens';
import { RechargeHistoryScreen as ExtractedRechargeHistoryScreen } from '../../components/recargas/RechargeHistoryScreen';
import { ExternalLink, Field, InlineSwitch, LoginActionTiles, MessageBox, PrimaryButton, SearchField, SecondaryButton, SecurityNotice, SegmentButton, TextLink } from '../../components/ui/FormControls';
import type { BotFeedbackState, BotMessage } from '../../types/bot';
import { GlobalSearchModal as ExtractedGlobalSearchModal } from '../../components/search/GlobalSearchModal';
import type { GlobalSearchResult as ExtractedGlobalSearchResult } from '../../types/globalSearch';
import { InvoiceProgressSteps as SharedInvoiceProgressSteps, InvoiceSummaryRow } from '../../components/facturacion/InvoiceShared';
import { styles } from '../../styles/appStyles';
import { DocumentActionsMenu } from '../../components/documents/DocumentActionsMenu';
import { EfactBotScreen } from '../../components/bot/EfactBotScreen';
import type { BotVoiceControls } from '../../components/bot/EfactBotScreen';
import { InitialSequenceModal } from '../../components/documentos/InitialSequenceModal';
import { PuntosEmisionScreen } from '../../components/puntos/PuntosEmisionScreen';
import { DirectoryTabButton, DropdownField, FormTopBar, ToggleRow } from '../../components/ui/FormShared';
import { DashboardHomeScreen as ExtractedDashboardHomeScreen } from '../../components/dashboard/DashboardHomeScreen';
import { ERubricaMobileScreen, PdfDocumentPreview } from '../../components/erubrica/ERubricaMobileScreen';
import { getERubricaTabTitle, type ERubricaTab } from '../../features/erubrica/erubricaTypes';
import { EmptyState } from '../../components/ui/FeedbackStates';
import { NuevaFacturaMobileScreen } from '../../components/facturacion/NuevaFacturaMobileScreen';
import { ModuleCard, NavButton, PortalBottomNav, PortalHeaderAvatar } from '../../components/portal/PortalNavigation';
import { PortalServiceCard } from '../../components/portal/PortalServiceCard';
import { GlobalWorkspaceHeader } from '../../components/portal/GlobalWorkspaceHeader';
import { CatalogCard, SubcategoriaCard } from '../../components/catalog/CatalogCards';
import { InitialsAvatar, MenuItem } from '../../components/ui/MenuItem';
import { BiometricSetupModal, BrandLockup, BrandMark, LoadingScreen, ScreenFrame } from '../../components/auth/AuthWidgets';
import { AppLaunchScreen, AuthCard, ScreenTransition } from '../../components/auth/AuthShell';
import { AVATARS, EFACT_MODULES, INVOICE_DRAFT_KEY_PREFIX, avatarImageSource, avatarPath, exportRowsToCsv, formatDashboardMoney, getAuthorizedViews, getCajaSerieForDocument, getClaimNumber, getDisplayFirstName, getInitialMenus, getInitials, getNotificationTone, getNotificationView, getProfileAvatarUrl, getServicesFromUser, initialsAvatarDataUri, isERubricaService, isInitialsAvatar, isPersonalPhoto, isSuperAdmin, normalizeSriState, normalizeText, saveBinaryFileToDevice, saveFileToDevice, resolveImageUrl, useReducedMotion } from '../../components/auth/AuthFlow';
import type { WorkspaceView } from '../../components/auth/AuthFlow';
import { BusinessHomeLayout, getDocumentPlanStatus, getFirmaSummary, getNextPuntoCode, getTipoClienteLabel, operationalFormToPayload, operationalFormToPayloadForContext, operationalItemToForm, perfilFormToPayload, perfilToForm, puntoToForm } from '../../components/auth/BusinessHomeLayout';
import { AdminModuleScreen, getAdminModuleConfig, getAdminModuleSlug, isAdminMobileView } from '../../components/admin/AdminModuleScreen';
import { EFACT_THEME, ERUBRICA_COLORS } from '../../styles/theme';
import { getDocumentSerieOptions, getEffectiveDocumentSerie, getNextSequence, getNextSequenceFromOptions, getPuntoSerie, getSelectedDocumentSerieOption, getSerieCodemisorFromOptions, getSerieLabel, getSerieLabelFromOptions, getSerieValue, normalizeSerieCode, normalizeSerieDisplay, serieNeedsInitialSequence, usePreferredDocumentSerie } from '../../utils/documentSeries';
import type { NuevaFacturaFormState, NuevaFacturaLinea } from '../../types/invoices';
import type { GuiaRemisionDetalle, GuiaRemisionFormState, LiquidacionCompraFormState } from '../../types/workspaceForms';
import { NuevaNotaCreditoMobileScreen } from '../../components/facturacion/NuevaNotaCreditoMobileScreen';
import { NuevaNotaDebitoMobileScreen } from '../../components/facturacion/NuevaNotaDebitoMobileScreen';
import { MisNotasDebitoMobileScreen } from '../../components/documents/MisNotasDebitoMobileScreen';
import { MisFacturasMobileScreen, MisGuiasRemisionMobileScreen, MisLiquidacionesCompraMobileScreen, MisNotasCreditoMobileScreen, MisRetencionesMobileScreen, NuevaGuiaRemisionMobileScreen, NuevaLiquidacionCompraMobileScreen, RetencionLiquidacionMobileScreen } from '../../components/documents/DocumentHistoryScreens';
import { formatDocumentDate, formatMoney, listItemKey } from '../../utils/documentFormatting';
import { arrayBufferToBase64, buildDeviceFileName } from '../../utils/fileUtils';
import { getClienteDisplayName, getClienteEmail, getClienteIdentification, getClienteKey, isConsumidorFinal } from '../../utils/clientDisplay';
import { getFirmaFileName, hasFirmaConfigured } from '../../utils/emisorDisplay';
import { getIvaOptionValue, getIvaOptions } from '../../utils/facturaOptions';
import { parseDocumentNumber, validateDateRange, validateFiscalLine, validatePositiveTotal } from '../../utils/documentValidation';
import { buildClienteFromFactura, decodeXmlValue, detalleFacturaToGuiaDetalle, detalleFacturaToNotaCreditoLinea, getClienteDetailValues, getClienteFacturaStats, getEmisorDetailValues, getFirmaDetailValues, getProductoDetailValues, getProductoPrice, getTipoIdentificacionCode, getTipoIdentificacionLabel, manualClienteFromForm, manualFacturaFromForm, mergeFacturaDetalle, numberFromXml, numberValue, parseFacturaXml, percentageValue, pickRecordValue, textValue, validateClientIdentification, validateDocumentClientFields, xmlSections, xmlTag } from '../../utils/workspaceData';
import { InvoiceHistoryMetric, getInvoiceStatusStyle, getInvoiceStatusTextStyle } from '../../components/documents/DocumentHistoryShared';
import type { CategoriaFormMode, CategoriaFormState, EmisorFormMode, EmisorFormState, ProductoFormMode, ProductoFormState, SubcategoriaFormState } from '../../types/directoryForms';
import { CategoriaCard, ClienteCard, EmisorCard, FirmaCard, ProductoCard } from '../../components/directorios/DirectoryCards';
import { CategoriaForm, EmisorForm, FirmaForm, ProductoForm, SubcategoriaForm } from '../../components/directorios/DirectoryForms';
import { DirectoryHero } from '../../components/directorios/DirectoryHero';
import { DirectoryWorkspace } from '../../components/directorios/DirectoryWorkspace';
import { PerfilForm, ProfileInfoTile } from '../../components/perfil/PerfilForm';
import { calculateMobileRechargeDocuments, calculateMobileRechargeTotal, getOperationalDefaultTab, getOperationalModuleSlug, getOperationalScreenConfig, isOperationalMobileView, OperationalModuleScreen } from '../../components/operational/OperationalModuleScreen';

import { categoriaToForm, clienteFormToPayload, clienteToForm, emisorFormToPayload, emisorToForm, getDocumentAssetUrl, initialCategoriaForm, initialClienteForm, initialEmisorForm, initialGuiaRemisionForm, initialLiquidacionCompraForm, initialNotaCreditoForm, initialNotaDebitoForm, initialNotaDebitoLinea, initialNuevaFacturaForm, initialOperationalForm, initialPerfilForm, initialProductoForm, initialPuntoForm, initialSubcategoriaForm, normalizeFacturaIva, productoFormToPayload, productoToForm, subcategoriaToForm, useDebouncedValue, validarTelefono, validarTextoObligatorio } from './workspaceState';
import type { CategoriaCatalogTab, ClienteFormMode, ClienteFormState, DrawerMenuNode, MessageState, MobileModule, NotaCreditoFormState, NotaDebitoFormState, NotaDebitoLinea, OperationalFormMode, OperationalFormState, PerfilFormState, PuntoFormMode, PuntoFormState, SequencePromptState } from './workspaceState';
import { getWorkspaceTitle } from './workspaceNavigation';
export function BusinessHome({ currentUser, incomingPdfUri, onIncomingPdfHandled, onLogout }: { currentUser: LoginResponse; incomingPdfUri?: string | null; onIncomingPdfHandled?: () => void; onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const [activeView, setActiveView] = useState<WorkspaceView>(() => {
    if (incomingPdfUri) return 'e-rubrica';
    if (isSuperAdmin(currentUser)) return 'portal';
    return getAuthorizedViews(getInitialMenus(currentUser)).has('dashboard') ? 'dashboard' : 'e-rubrica';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const botVoiceControlsRef = useRef<BotVoiceControls | null>(null);
  const reduceMotion = useReducedMotion();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<NotificacionItem[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsMessage, setNotificationsMessage] = useState<MessageState>(null);
  const [menus, setMenus] = useState<DynamicMenu[]>(getInitialMenus(currentUser));
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [menuMessage, setMenuMessage] = useState<MessageState>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaCatalogo[]>([]);
  const [subcategorias, setSubcategorias] = useState<SubcategoriaCatalogo[]>([]);
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [firmaEstados, setFirmaEstados] = useState<Record<number, FirmaEstado>>({});
  const [loadingFirma, setLoadingFirma] = useState(false);
  const [erubricaData, setErubricaData] = useState<ERubricaDashboard | null>(null);
  const [loadingErubrica, setLoadingErubrica] = useState(false);
  const [erubricaInitialPdf, setErubricaInitialPdf] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ uri: string; name: string } | null>(null);
  const [erubricaTabRequest, setErubricaTabRequest] = useState<ERubricaTab | null>(() => incomingPdfUri ? 'firmar' : null);
  const [perfilData, setPerfilData] = useState<PerfilLookup | null>(null);
  const [puntosData, setPuntosData] = useState<PuntosEmisionData | null>(null);
  const [clienteLookups, setClienteLookups] = useState<ClienteLookups | null>(null);
  const [productoLookups, setProductoLookups] = useState<ProductoLookups | null>(null);
  const [provincias, setProvincias] = useState<ProvinciaLookup[]>([]);
  const [ciudades, setCiudades] = useState<CiudadLookup[]>([]);
  const [subcategoriasProducto, setSubcategoriasProducto] = useState<SubcategoriaLookup[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [loadingEmisores, setLoadingEmisores] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [loadingPuntos, setLoadingPuntos] = useState(false);
  const [loadingAdminItems, setLoadingAdminItems] = useState(false);
  const [loadingOperationalItems, setLoadingOperationalItems] = useState(false);
  const [loadingClienteLookups, setLoadingClienteLookups] = useState(false);
  const [loadingProductoLookups, setLoadingProductoLookups] = useState(false);
  const [directoryMessage, setDirectoryMessage] = useState<MessageState>(null);
  const [search, setSearch] = useState('');
  const [clienteTipoFiltro, setClienteTipoFiltro] = useState<'todos' | 'personas' | 'empresas'>('todos');
  const [clienteProveedorFiltro, setClienteProveedorFiltro] = useState<'todos' | 'proveedores'>('todos');
  const [clienteEstadoFiltro, setClienteEstadoFiltro] = useState<'activos' | 'inactivos' | 'todos'>('activos');
  const [productoTipoFiltro, setProductoTipoFiltro] = useState<'todos' | ProductoTipo>('todos');
  const [productoCategoriaFiltro, setProductoCategoriaFiltro] = useState<number | null>(null);
  const [productoSubcategoriaFiltro, setProductoSubcategoriaFiltro] = useState<number | null>(null);
  const [productoEstadoFiltro, setProductoEstadoFiltro] = useState<'activos' | 'inactivos' | 'todos'>('activos');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [reloadKey, setReloadKey] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const [adminItems, setAdminItems] = useState<AdminMobileItem[]>([]);
  const [adminTabByView, setAdminTabByView] = useState<Record<string, string>>({});
  const [operationalItems, setOperationalItems] = useState<OperationalMobileItem[]>([]);
  const [operationalCounts, setOperationalCounts] = useState<Partial<Record<WorkspaceView, number>>>({});
  const [compraDocumentosEstado, setCompraDocumentosEstado] = useState<CompraDocumentosEstado | null>(null);
  const [loadingCompraDocumentosEstado, setLoadingCompraDocumentosEstado] = useState(true);
  const [operationalTabByView, setOperationalTabByView] = useState<Record<string, string>>({});
  const [operationalFormMode, setOperationalFormMode] = useState<OperationalFormMode>(null);
  const [selectedOperationalItem, setSelectedOperationalItem] = useState<OperationalMobileItem | null>(null);
  const [operationalForm, setOperationalForm] = useState<OperationalFormState>(initialOperationalForm);
  const [savingOperational, setSavingOperational] = useState(false);
  const [facturaPreparacion, setFacturaPreparacion] = useState<FacturaPreparacion | null>(null);
  const [facturasList, setFacturasList] = useState<FacturaListItem[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [savingFactura, setSavingFactura] = useState(false);
  const savingFacturaRef = useRef(false);
  const pendingFacturaRetryRef = useRef<{ startedAt: number; expectedTotal: number; identificacion: string } | null>(null);
  const pendingGuiaRetryRef = useRef<number | null>(null);
  const [checkingGuia, setCheckingGuia] = useState(false);
  const previousGuiaViewRef = useRef<WorkspaceView | null>(null);
  const pendingNotaDebitoRetryRef = useRef<number | null>(null);
  const pendingRetencionEmitRef = useRef<number | null>(null);
  const [facturaForm, setFacturaForm] = useState<NuevaFacturaFormState>(initialNuevaFacturaForm);
  const [facturaCliente, setFacturaCliente] = useState<Cliente | null>(null);
  const [facturaClientes, setFacturaClientes] = useState<Cliente[]>([]);
  const [facturaProductos, setFacturaProductos] = useState<FacturaProducto[]>([]);
  const [facturaLineas, setFacturaLineas] = useState<NuevaFacturaLinea[]>([]);
  const [invoiceDraftReady, setInvoiceDraftReady] = useState(false);
  const [invoiceDraftSaved, setInvoiceDraftSaved] = useState(false);
  const invoiceDraftStorageRef = useRef<Promise<void>>(Promise.resolve());
  const facturaRequestIdRef = useRef<string | null>(null);
  const [notaCreditoPreparacion, setNotaCreditoPreparacion] = useState<FacturaPreparacion | null>(null);
  const [notasCreditoList, setNotasCreditoList] = useState<NotaCreditoListItem[]>([]);
  const [notaCreditoFacturas, setNotaCreditoFacturas] = useState<FacturaListItem[]>([]);
  const [notaCreditoFactura, setNotaCreditoFactura] = useState<FacturaListItem | null>(null);
  const [notaCreditoCliente, setNotaCreditoCliente] = useState<Cliente | null>(null);
  const [notaCreditoClientes, setNotaCreditoClientes] = useState<Cliente[]>([]);
  const [notaCreditoForm, setNotaCreditoForm] = useState<NotaCreditoFormState>(initialNotaCreditoForm);
  const [notaCreditoLineas, setNotaCreditoLineas] = useState<NuevaFacturaLinea[]>([]);
  const [loadingNotasCredito, setLoadingNotasCredito] = useState(false);
  const [savingNotaCredito, setSavingNotaCredito] = useState(false);
  const [processingNotaCreditoAutomatica, setProcessingNotaCreditoAutomatica] = useState(false);
  const [notaDebitoPreparacion, setNotaDebitoPreparacion] = useState<FacturaPreparacion | null>(null);
  const [notasDebitoList, setNotasDebitoList] = useState<NotaDebitoListItem[]>([]);
  const [notaDebitoFacturas, setNotaDebitoFacturas] = useState<FacturaListItem[]>([]);
  const [notaDebitoFactura, setNotaDebitoFactura] = useState<FacturaListItem | null>(null);
  const [notaDebitoCliente, setNotaDebitoCliente] = useState<Cliente | null>(null);
  const [notaDebitoForm, setNotaDebitoForm] = useState<NotaDebitoFormState>(initialNotaDebitoForm);
  const [notaDebitoLineas, setNotaDebitoLineas] = useState<NotaDebitoLinea[]>([initialNotaDebitoLinea]);
  const [loadingNotasDebito, setLoadingNotasDebito] = useState(false);
  const [savingNotaDebito, setSavingNotaDebito] = useState(false);
  const [liquidacionPreparacion, setLiquidacionPreparacion] = useState<FacturaPreparacion | null>(null);
  const [liquidacionesList, setLiquidacionesList] = useState<LiquidacionCompraListItem[]>([]);
  const [liquidacionProveedores, setLiquidacionProveedores] = useState<Cliente[]>([]);
  const [liquidacionProveedor, setLiquidacionProveedor] = useState<Cliente | null>(null);
  const [liquidacionProductos, setLiquidacionProductos] = useState<FacturaProducto[]>([]);
  const [liquidacionForm, setLiquidacionForm] = useState<LiquidacionCompraFormState>(initialLiquidacionCompraForm);
  const [liquidacionLineas, setLiquidacionLineas] = useState<NuevaFacturaLinea[]>([]);
  const [loadingLiquidaciones, setLoadingLiquidaciones] = useState(false);
  const [savingLiquidacion, setSavingLiquidacion] = useState(false);
  const [liquidacionRetencion, setLiquidacionRetencion] = useState<LiquidacionCompraListItem | null>(null);
  const [retencionesIvaCatalogo, setRetencionesIvaCatalogo] = useState<RetencionCatalogItem[]>([]);
  const [retencionesRentaCatalogo, setRetencionesRentaCatalogo] = useState<RetencionCatalogItem[]>([]);
  const [loadingLiquidacionRetencion, setLoadingLiquidacionRetencion] = useState(false);
  const [savingLiquidacionRetencion, setSavingLiquidacionRetencion] = useState(false);
  const [guiaPreparacion, setGuiaPreparacion] = useState<FacturaPreparacion | null>(null);
  const [guiasList, setGuiasList] = useState<GuiaRemisionListItem[]>([]);
  const [guiaTransportistas, setGuiaTransportistas] = useState<Cliente[]>([]);
  const [guiaTransportista, setGuiaTransportista] = useState<Cliente | null>(null);
  const [guiaClientes, setGuiaClientes] = useState<Cliente[]>([]);
  const [guiaCliente, setGuiaCliente] = useState<Cliente | null>(null);
  const [guiaFacturas, setGuiaFacturas] = useState<FacturaListItem[]>([]);
  const [guiaFactura, setGuiaFactura] = useState<FacturaListItem | null>(null);
  const [guiaProductos, setGuiaProductos] = useState<FacturaProducto[]>([]);
  const [guiaForm, setGuiaForm] = useState<GuiaRemisionFormState>(initialGuiaRemisionForm);
  const [guiaDetalles, setGuiaDetalles] = useState<GuiaRemisionDetalle[]>([]);
  const [loadingGuias, setLoadingGuias] = useState(false);
  const [loadingGuiaSearch, setLoadingGuiaSearch] = useState(false);
  const [savingGuia, setSavingGuia] = useState(false);
  const [sequencePrompt, setSequencePrompt] = useState<SequencePromptState | null>(null);
  const [sequencePromptSaving, setSequencePromptSaving] = useState(false);
  const [sequencePromptMessage, setSequencePromptMessage] = useState<string | null>(null);
  const [retencionesList, setRetencionesList] = useState<RetencionListItem[]>([]);
  const [loadingRetenciones, setLoadingRetenciones] = useState(false);
  const [clienteFormMode, setClienteFormMode] = useState<ClienteFormMode>(null);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [viewingProducto, setViewingProducto] = useState<Producto | null>(null);
  const [viewingCategoria, setViewingCategoria] = useState<CategoriaCatalogo | null>(null);
  const [viewingSubcategoria, setViewingSubcategoria] = useState<SubcategoriaCatalogo | null>(null);
  const [viewingEmisor, setViewingEmisor] = useState<Emisor | null>(null);
  const [viewingFirma, setViewingFirma] = useState<Emisor | null>(null);
  const [clienteForm, setClienteForm] = useState<ClienteFormState>(initialClienteForm);
  const [savingCliente, setSavingCliente] = useState(false);
  const [productoFormMode, setProductoFormMode] = useState<ProductoFormMode>(null);
  const [selectedProducto, setSelectedProducto] = useState<Producto | null>(null);
  const [productoForm, setProductoForm] = useState<ProductoFormState>(initialProductoForm);
  const [loadingProductoDetail, setLoadingProductoDetail] = useState(false);
  const [savingProducto, setSavingProducto] = useState(false);
  const [categoriaTab, setCategoriaTab] = useState<CategoriaCatalogTab>('categorias');
  const [subcategoriaCategoriaFiltro, setSubcategoriaCategoriaFiltro] = useState<number | null>(null);
  const [categoriaFormMode, setCategoriaFormMode] = useState<CategoriaFormMode>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaCatalogo | null>(null);
  const [categoriaForm, setCategoriaForm] = useState<CategoriaFormState>(initialCategoriaForm);
  const [subcategoriaFormMode, setSubcategoriaFormMode] = useState<CategoriaFormMode>(null);
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<SubcategoriaCatalogo | null>(null);
  const [subcategoriaForm, setSubcategoriaForm] = useState<SubcategoriaFormState>(initialSubcategoriaForm);
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [emisorFormMode, setEmisorFormMode] = useState<EmisorFormMode>(null);
  const [selectedEmisor, setSelectedEmisor] = useState<Emisor | null>(null);
  const [emisorForm, setEmisorForm] = useState<EmisorFormState>(initialEmisorForm);
  const [savingEmisor, setSavingEmisor] = useState(false);
  const [consultandoSriEmisor, setConsultandoSriEmisor] = useState(false);
  const [perfilForm, setPerfilForm] = useState<PerfilFormState>(initialPerfilForm);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [puntoFormMode, setPuntoFormMode] = useState<PuntoFormMode>(null);
  const [selectedPunto, setSelectedPunto] = useState<PuntoEmision | null>(null);
  const [puntoForm, setPuntoForm] = useState<PuntoFormState>(initialPuntoForm);
  const [savingPunto, setSavingPunto] = useState(false);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [botDraft, setBotDraft] = useState('');
  const [botFeedbackByMessage, setBotFeedbackByMessage] = useState<BotFeedbackState>({});
  const [botWorkflow, setBotWorkflow] = useState<BotWorkflowState | null>(null);
  const [pdfPositionDragging, setPdfPositionDragging] = useState(false);
  const botHistoryReadyRef = useRef(false);
  const [portalServiceQuery, setPortalServiceQuery] = useState('');
  const [privacyReturnView, setPrivacyReturnView] = useState<'perfil' | 'perfil-e-rubrica'>('perfil');

  const userId = getClaimNumber(currentUser, 'idUsuario') ?? 0;
  const catalogUserId = getClaimNumber(currentUser, 'idJefe') ?? userId;
  const queueInvoiceDraftStorage = (operation: () => Promise<void>) => {
    const queued = invoiceDraftStorageRef.current.then(operation);
    invoiceDraftStorageRef.current = queued.catch(() => undefined);
    return queued;
  };
  const idTipoUsuario = getClaimNumber(currentUser, 'idTipoUsuario');
  const authorizedViews = useMemo(() => {
    const views = getAuthorizedViews(menus);
    views.add('cotizaciones');
    return views;
  }, [menus]);
  const canUseEfact = authorizedViews.has('dashboard');
  const services = useMemo(() => getServicesFromUser(currentUser, menus), [currentUser, menus]);
  const canUseERubrica = userId > 0;
  const canUseFirma = userId > 0;
  const canUsePortal = userId > 0;
  const portalFirstName = getDisplayFirstName(currentUser, perfilData?.perfil);
  const portalAvatarUrl = getProfileAvatarUrl(currentUser, perfilData?.perfil);
  const portalServiceCards = useMemo(() => [
    {
      title: 'E-FACT',
      description: 'Facturación electrónica móvil y más.',
      enabled: canUseEfact,
      onPress: () => openView('dashboard'),
    },
    {
      title: 'E-RÚBRICA',
      description: 'Firma y valida documentos de forma segura.',
      enabled: canUseERubrica,
      onPress: () => openView('e-rubrica'),
    },
  ], [canUseEfact, canUseERubrica]);
  const filteredPortalServiceCards = useMemo(() => {
    const query = normalizeText(portalServiceQuery);
    if (!query) return portalServiceCards;
    return portalServiceCards.filter((service) => normalizeText(`${service.title} ${service.description}`).includes(query));
  }, [portalServiceCards, portalServiceQuery]);
  const visibleNotifications = useMemo(() => notifications.filter((notification) => !dismissedNotificationIds.has(notification.id)), [dismissedNotificationIds, notifications]);
  const unreadNotifications = visibleNotifications.filter((notification) => !notification.read).length;

  const syncDocumentSequence = (
    expectedView: WorkspaceView,
    documento: PuntoDocumentoKey,
    documentLabel: string,
    kind: 'factura' | 'notaCredito' | 'notaDebito' | 'liquidacion' | 'guia',
    serie: string,
    preparacion: FacturaPreparacion | null,
    setForm: (updater: (current: any) => any) => void,
  ) => {
    if (activeView !== expectedView || !catalogUserId) return () => undefined;

    let mounted = true;
    const serieOptions = getDocumentSerieOptions(preparacion, puntosData, kind);
    const effectiveSerie = getEffectiveDocumentSerie(serieOptions, serie) || serie;
    if (!effectiveSerie) return () => undefined;
    const sameSerie = (value?: string) => normalizeSerieDisplay(value) === normalizeSerieDisplay(effectiveSerie);
    const preparedSequence = kind === 'liquidacion'
      ? getNextSequenceFromOptions(preparacion?.series ?? [], effectiveSerie, '')
      : '';
    const knownSequence = preparedSequence || getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
    if (!sameSerie(serie)) {
      setForm((current) => sameSerie(current.serie) ? current : { ...current, serie: effectiveSerie });
    }
    if (preparedSequence) {
      setForm((current) => sameSerie(current.serie) && current.numeroFactura !== preparedSequence ? { ...current, serie: effectiveSerie, numeroFactura: preparedSequence } : current);
      setSequencePrompt((current) => current?.documento === documento && current?.serie === effectiveSerie ? null : current);
      return () => {
        mounted = false;
      };
    }
    const codemisor = getSerieCodemisorFromOptions(serieOptions, effectiveSerie, preparacion);
    const openInitialPrompt = () => {
      setForm((current) => sameSerie(current.serie) && current.numeroFactura ? { ...current, serie: effectiveSerie, numeroFactura: '' } : current);
      setSequencePrompt((current) => (
        current?.documento === documento && current?.serie === effectiveSerie
          ? current
          : { documento, documentLabel, serie: effectiveSerie, codemisor, form: kind }
      ));
    };

    getPuntoEmisionSiguienteSecuencial(catalogUserId, documento, effectiveSerie, codemisor)
      .then((response) => {
        if (!mounted) return;
        const proximo = response.inicializada ? response.proximo?.trim() ?? '' : '';
        setForm((current) => sameSerie(current.serie) && current.numeroFactura !== proximo ? { ...current, serie: effectiveSerie, numeroFactura: proximo } : current);
        if (response.requiereConfiguracionInicial && !knownSequence) {
          openInitialPrompt();
        } else {
          setSequencePrompt((current) => current?.documento === documento && current?.serie === effectiveSerie ? null : current);
        }
      })
      .catch(() => {
        if (mounted && !knownSequence && serieNeedsInitialSequence(serieOptions, effectiveSerie)) openInitialPrompt();
      });

    return () => {
      mounted = false;
    };
  };

  useEffect(
    () => syncDocumentSequence('nueva-factura', 'factura', 'facturas', 'factura', facturaForm.serie, facturaPreparacion, setFacturaForm),
    [activeView, catalogUserId, facturaForm.serie, facturaPreparacion, puntosData, reloadKey],
  );

  useEffect(
    () => syncDocumentSequence('nueva-nota-credito', 'nota-credito', 'notas de crédito', 'notaCredito', notaCreditoForm.serie, notaCreditoPreparacion, setNotaCreditoForm),
    [activeView, catalogUserId, notaCreditoForm.serie, notaCreditoPreparacion, puntosData, reloadKey],
  );

  useEffect(
    () => syncDocumentSequence('nueva-nota-debito', 'nota-debito', 'notas de débito', 'notaDebito', notaDebitoForm.serie, notaDebitoPreparacion, setNotaDebitoForm),
    [activeView, catalogUserId, notaDebitoForm.serie, notaDebitoPreparacion, puntosData, reloadKey],
  );

  useEffect(
    () => syncDocumentSequence('nueva-liquidacion-compra', 'liquidacion-compra', 'liquidaciones de compra', 'liquidacion', liquidacionForm.serie, liquidacionPreparacion, setLiquidacionForm),
    [activeView, catalogUserId, liquidacionForm.serie, liquidacionPreparacion, puntosData, reloadKey],
  );

  useEffect(
    () => syncDocumentSequence('nueva-guia-remision', 'guia-remision', 'guías de remisión', 'guia', guiaForm.serie, guiaPreparacion, setGuiaForm),
    [activeView, catalogUserId, guiaForm.serie, guiaPreparacion, puntosData, reloadKey],
  );

  useEffect(() => {
    if (activeView !== 'nueva-factura' || !catalogUserId) return;
    let mounted = true;
    const draftKey = `${INVOICE_DRAFT_KEY_PREFIX}.${catalogUserId}`;
    setInvoiceDraftReady(false);
    setInvoiceDraftSaved(false);
    SecureStore.getItemAsync(draftKey).then((raw) => {
      if (!mounted) return;
      if (raw) {
        try {
          const draft = JSON.parse(raw) as { form?: NuevaFacturaFormState; cliente?: Cliente | null; lineas?: NuevaFacturaLinea[] };
          if (draft.form) setFacturaForm(draft.form);
          if (draft.cliente) setFacturaCliente(draft.cliente);
          if (draft.lineas) setFacturaLineas(draft.lineas);
          setInvoiceDraftSaved(Boolean(draft.form || draft.lineas?.length));
        } catch {
          queueInvoiceDraftStorage(() => SecureStore.deleteItemAsync(draftKey));
        }
      }
      setInvoiceDraftReady(true);
    }).catch(() => {
      if (mounted) setInvoiceDraftReady(true);
    });
    return () => { mounted = false; };
  }, [activeView, catalogUserId]);

  useEffect(() => {
    if (activeView !== 'nueva-factura' || !catalogUserId || !invoiceDraftReady) return;
    const draftKey = `${INVOICE_DRAFT_KEY_PREFIX}.${catalogUserId}`;
    const timer = setTimeout(() => {
      const hasDraft = Boolean(facturaCliente || facturaLineas.length || facturaForm.clienteBusqueda || facturaForm.productoBusqueda || facturaForm.referencia || facturaForm.correoAdicional);
      if (!hasDraft) return;
      queueInvoiceDraftStorage(() => SecureStore.setItemAsync(draftKey, JSON.stringify({ form: facturaForm, cliente: facturaCliente, lineas: facturaLineas }))).then(() => setInvoiceDraftSaved(true)).catch(() => undefined);
    }, 650);
    return () => clearTimeout(timer);
  }, [activeView, catalogUserId, facturaCliente, facturaForm, facturaLineas, invoiceDraftReady]);
  const globalSearchResults = useMemo<ExtractedGlobalSearchResult[]>(() => {
    const term = globalSearchQuery.trim().toLowerCase();
    if (!term) return [];
    const matches = (value: unknown) => String(value ?? '').toLowerCase().includes(term);
    const clientResults = clientes.filter((cliente) => [getClienteDisplayName(cliente), cliente.numeroidentificacion, cliente.correo].some(matches)).slice(0, 5).map((cliente) => ({
      id: `cliente-${cliente.codcliente ?? cliente.numeroidentificacion}`,
      title: getClienteDisplayName(cliente),
      subtitle: `${cliente.numeroidentificacion ?? 'Sin identificación'} · Cliente`,
      icon: 'account-outline' as const,
      view: 'clientes' as WorkspaceView,
    }));
    const productResults = productos.filter((producto) => [producto.nombre, producto.codigo, producto.tipo].some(matches)).slice(0, 5).map((producto) => ({
      id: `producto-${producto.codproducto ?? producto.codigo}`,
      title: producto.nombre || producto.codigo || 'Producto',
      subtitle: `${producto.codigo ?? 'Sin código'} · Producto`,
      icon: 'package-variant-closed' as const,
      view: 'productos' as WorkspaceView,
    }));
    const invoiceResults = facturasList.filter((factura) => [factura.numeroCompleto, factura.numfactura, factura.cliente, factura.identificacionCliente].some(matches)).slice(0, 5).map((factura) => ({
      id: `factura-${factura.codfactura ?? factura.numeroCompleto}`,
      title: factura.numeroCompleto ?? factura.numfactura ?? 'Factura',
      subtitle: `${factura.cliente ?? 'Cliente'} · Factura`,
      icon: 'file-document-outline' as const,
      view: 'mis-facturas' as WorkspaceView,
    }));
    return [...clientResults, ...productResults, ...invoiceResults].slice(0, 12);
  }, [clientes, facturasList, globalSearchQuery, productos]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const previousState = appStateRef.current;
      appStateRef.current = state;
      if (state === 'active' && previousState === 'background') {
        setReloadKey((value) => value + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (activeView !== 'bot') {
      void Speech.stop();
    }
  }, [activeView]);

  useEffect(() => {
    let mounted = true;
    botHistoryReadyRef.current = false;
    setBotMessages([]);
    setBotFeedbackByMessage({});
    setBotWorkflow(null);
    if (!userId) {
      botHistoryReadyRef.current = true;
      return () => { mounted = false; };
    }
    void loadBotHistory(userId).then((history) => {
      if (!mounted) return;
      if (history?.messages.length) {
        setBotMessages((current) => {
          const currentWithoutWelcome = current.filter((message) => message.id !== 'welcome');
          return currentWithoutWelcome.length ? [...history.messages, ...currentWithoutWelcome] : history.messages;
        });
        setBotFeedbackByMessage((current) => ({ ...history.feedbackByMessage, ...current }));
      }
      setBotWorkflow(history?.workflow ?? null);
      botHistoryReadyRef.current = true;
    }).catch(() => {
      if (mounted) botHistoryReadyRef.current = true;
    });
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !botHistoryReadyRef.current) return;
    void saveBotHistory(userId, botMessages, botFeedbackByMessage, botWorkflow);
  }, [userId, botMessages, botFeedbackByMessage, botWorkflow]);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    setLoadingNotifications(true);
    setNotificationsMessage(null);

    getNotificaciones(userId)
      .then((items) => {
        if (mounted) {
          setDismissedNotificationIds(new Set());
          setNotifications(items);
        }
        void syncDeviceNotifications(userId, items);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudieron cargar las notificaciones.';
        if (mounted) {
          setNotifications([]);
          setNotificationsMessage({ type: 'info', text });
        }
      })
      .finally(() => {
        if (mounted) setLoadingNotifications(false);
      });

    return () => {
      mounted = false;
    };
  }, [reloadKey, userId]);

  useEffect(() => {
    if (!userId || !hasMenusByRolEndpoint()) return;

    let mounted = true;
    setLoadingMenus(true);
    setMenuMessage(null);

    getMenusByRol(userId, idTipoUsuario)
      .then((data) => {
        if (mounted && data.length > 0) setMenus(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudieron cargar los menus asignados.';
        if (mounted) setMenuMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingMenus(false);
      });

    return () => {
      mounted = false;
    };
  }, [idTipoUsuario, userId]);

  useEffect(() => {
    const module = getAdminModuleSlug(activeView);
    if (!module || !authorizedViews.has(activeView)) return;

    let mounted = true;
    const activeTab = adminTabByView[activeView] ?? getAdminModuleConfig(activeView).tabs?.[0] ?? '';
    setLoadingAdminItems(true);
    setDirectoryMessage(null);

    getAdminMobileModule(module, debouncedSearch, activeTab)
      .then((data) => {
        if (mounted) setAdminItems(data.items ?? []);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar el modulo administrativo.';
        if (mounted) {
          setAdminItems([]);
          setDirectoryMessage({ type: 'error', text });
        }
      })
      .finally(() => {
        if (mounted) setLoadingAdminItems(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, adminTabByView, authorizedViews, debouncedSearch, reloadKey]);

  useEffect(() => {
    const module = getOperationalModuleSlug(activeView);
    if (!module || !authorizedViews.has(activeView) || activeView === 'comprar-documentos') return;

    let mounted = true;
    const config = getOperationalScreenConfig(activeView, module);
    const activeTab = operationalTabByView[activeView] ?? getOperationalDefaultTab(activeView, module);
    setLoadingOperationalItems(true);
    setDirectoryMessage(null);

    getOperationalMobileModule(module, debouncedSearch, activeTab, { userId: catalogUserId })
      .then((data) => {
        if (mounted) setOperationalItems(data.items ?? []);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar el modulo operativo.';
        if (mounted) {
          setOperationalItems([]);
          setDirectoryMessage({ type: 'error', text });
        }
      })
      .finally(() => {
        if (mounted) setLoadingOperationalItems(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, operationalTabByView, authorizedViews, catalogUserId, debouncedSearch, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView)) return;
    if (activeView !== 'nueva-factura' && activeView !== 'mis-facturas') return;

    let mounted = true;
    setLoadingFacturas(true);
    setDirectoryMessage(null);

    if (activeView === 'nueva-factura') {
      getFacturaPreparacion(catalogUserId)
        .then((data) => {
          if (!mounted) return;
          setFacturaPreparacion(data);
          const serie = getSerieValue(data.series?.[0]) || data.caja?.serieFactura || '';
          const formaPago = data.formasPago?.[0]?.codigo == null ? '' : String(data.formasPago[0].codigo);
          setFacturaForm((current) => ({ ...current, serie, formaPago }));
        })
        .catch((error) => {
          const text = error instanceof ApiError ? error.message : 'No se pudo cargar facturacion.';
          if (mounted) setDirectoryMessage({ type: 'error', text });
        })
        .finally(() => {
          if (mounted) setLoadingFacturas(false);
        });
    } else {
      getFacturas(catalogUserId, 0)
        .then((data) => {
          if (mounted) setFacturasList(data ?? []);
        })
        .catch((error) => {
          const text = error instanceof ApiError ? error.message : 'No se pudo cargar facturacion.';
          if (mounted) setDirectoryMessage({ type: 'error', text });
        })
        .finally(() => {
          if (mounted) setLoadingFacturas(false);
        });

      getNotasCredito(catalogUserId, 0)
        .then((data) => {
          if (mounted) setNotasCreditoList(data ?? []);
        })
        .catch(() => {
          if (mounted) {
            setNotasCreditoList([]);
            setDirectoryMessage({ type: 'info', text: 'Las facturas se cargaron, pero no se pudieron consultar las notas de credito.' });
          }
        });
    }

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView) || activeView !== 'retenciones') return;

    let mounted = true;
    setLoadingRetenciones(true);
    setDirectoryMessage(null);

    getRetenciones(catalogUserId, 0)
      .then((data) => {
        if (mounted) setRetencionesList(data ?? []);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar retenciones.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingRetenciones(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView)) return;
    if (activeView !== 'nueva-guia-remision' && activeView !== 'mis-guias-remision') return;

    let mounted = true;
    setLoadingGuias(true);
    const enteredGuiaView = previousGuiaViewRef.current !== activeView;
    previousGuiaViewRef.current = activeView;
    if (enteredGuiaView) setDirectoryMessage(null);

    const request = activeView === 'nueva-guia-remision'
      ? getGuiaRemisionPreparacion(catalogUserId).then((data) => {
          if (!mounted) return;
          setGuiaPreparacion(data);
          const serie = getSerieValue(data.series?.[0]) || data.caja?.serieFactura || '';
          setGuiaForm((current) => ({ ...current, serie, direccionOrigen: current.direccionOrigen || data.direccionOrigen || '' }));
        })
      : getGuiasRemision(catalogUserId, 0).then((data) => {
          if (mounted) setGuiasList(data ?? []);
        });

    request
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar guias de remision.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingGuias(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView)) return;
    if (activeView !== 'nueva-liquidacion-compra' && activeView !== 'mis-liquidaciones-compra') return;

    let mounted = true;
    setLoadingLiquidaciones(true);
    setDirectoryMessage(null);

    const request = activeView === 'nueva-liquidacion-compra'
      ? getLiquidacionCompraPreparacion(catalogUserId).then((data) => {
          if (!mounted) return;
          setLiquidacionPreparacion(data);
          const serie = getSerieValue(data.series?.[0]) || getCajaSerieForDocument(data, 'liquidacion') || '';
          const formaPago = data.formasPago?.[0]?.codigo == null ? '' : String(data.formasPago[0].codigo);
          setLiquidacionForm((current) => ({ ...current, serie, formaPago }));
        })
      : getLiquidacionesCompra(catalogUserId, 0).then((data) => {
          if (mounted) setLiquidacionesList(data ?? []);
        });

    request
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar liquidaciones.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingLiquidaciones(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView)) return;
    if (activeView !== 'nueva-nota-debito' && activeView !== 'mis-notas-debito') return;

    let mounted = true;
    setLoadingNotasDebito(true);
    setDirectoryMessage(null);

    const request = activeView === 'nueva-nota-debito'
      ? getNotaDebitoPreparacion(catalogUserId).then((data) => {
          if (!mounted) return;
          setNotaDebitoPreparacion(data);
          const serie = getSerieValue(data.series?.[0]) || getCajaSerieForDocument(data, 'notaDebito') || '';
          setNotaDebitoForm((current) => ({ ...current, serie }));
        })
      : getNotasDebito(catalogUserId, 0).then((data) => {
          if (mounted) setNotasDebitoList(Array.isArray(data) ? data : []);
        });

    request
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar notas de debito.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingNotasDebito(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has(activeView)) return;
    if (activeView !== 'nueva-nota-credito' && activeView !== 'mis-notas-credito') return;

    let mounted = true;
    setLoadingNotasCredito(true);
    setDirectoryMessage(null);

    const request = activeView === 'nueva-nota-credito'
      ? getNotaCreditoPreparacion(catalogUserId).then((data) => {
          if (!mounted) return;
          setNotaCreditoPreparacion(data);
          const serie = getSerieValue(data.series?.[0]) || getCajaSerieForDocument(data, 'notaCredito') || '';
          setNotaCreditoForm((current) => ({ ...current, serie }));
        })
      : getNotasCredito(catalogUserId, 0).then((data) => {
          if (mounted) setNotasCreditoList(data ?? []);
        });

    request
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar notas de credito.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingNotasCredito(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !authorizedViews.has('dashboard') || activeView === 'dashboard') return;

    let mounted = true;
    const views: WorkspaceView[] = ['cuentas-cobrar', 'estado-cuenta', 'comprar-documentos', 'recargas', 'centro-normativo'];

    Promise.all(
      views.map(async (view) => {
        const module = getOperationalModuleSlug(view);
        if (!module || !authorizedViews.has(view)) return [view, undefined] as const;

        const tab = getOperationalDefaultTab(view, module);
        try {
          const data = await getOperationalMobileModule(module, '', tab, { userId: catalogUserId });
          return [view, data.items?.length ?? 0] as const;
        } catch {
          return [view, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (!mounted) return;
      setOperationalCounts(
        entries.reduce<Partial<Record<WorkspaceView, number>>>((acc, [view, count]) => {
          if (typeof count === 'number') acc[view] = count;
          return acc;
        }, {}),
      );
    });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || !canUseEfact) return;

    let mounted = true;
    setLoadingCompraDocumentosEstado(true);
    getCompraDocumentosEstado(catalogUserId)
      .then((data) => {
        if (mounted) setCompraDocumentosEstado(data);
      })
      .catch(() => {
        if (mounted) setCompraDocumentosEstado(null);
      })
      .finally(() => {
        if (mounted) setLoadingCompraDocumentosEstado(false);
      });

    return () => { mounted = false; };
  }, [canUseEfact, catalogUserId, reloadKey]);

  useEffect(() => {
    if (!canUseERubrica || activeView !== 'e-rubrica') return;

    let mounted = true;
    setLoadingErubrica(true);
    setDirectoryMessage(null);
    getERubricaDashboard()
      .then((data) => { if (mounted) setErubricaData(data); })
      .catch((error) => {
        if (mounted) setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo cargar E-RÚBRICA.' });
      })
      .finally(() => { if (mounted) setLoadingErubrica(false); });

    return () => { mounted = false; };
  }, [activeView, authorizedViews, canUseERubrica, reloadKey]);

  useEffect(() => {
    if (loadingMenus) return;

    if (!canUsePortal && activeView === 'portal') setActiveView(canUseEfact ? 'dashboard' : 'no-autorizado');
    if (activeView === 'dashboard' && !canUseEfact) setActiveView('no-autorizado');
    if (
      activeView !== 'portal' &&
      activeView !== 'dashboard' &&
      activeView !== 'no-autorizado' &&
      activeView !== 'nuevo-cliente' &&
      activeView !== 'nuevo-producto' &&
      activeView !== 'nueva-categoria' &&
      activeView !== 'nueva-subcategoria' &&
      activeView !== 'nuevo-emisor' &&
      activeView !== 'nueva-firma' &&
       activeView !== 'nuevo-punto-emision' &&
       activeView !== 'politica-privacidad' &&
       !(['e-rubrica', 'perfil-e-rubrica'].includes(activeView) ? canUseERubrica : activeView === 'firma' ? canUseFirma : authorizedViews.has(activeView))
    ) {
      setActiveView('no-autorizado');
    }
  }, [activeView, authorizedViews, canUseEfact, canUseERubrica, canUseFirma, canUsePortal, loadingMenus]);

  useEffect(() => {
    if (!userId || !authorizedViews.has('clientes') || activeView !== 'clientes') return;

    let mounted = true;
    setLoadingClientes(true);
    setDirectoryMessage(null);

    getClientes(userId, true)
      .then((data) => {
        if (mounted) setClientes(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar clientes.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingClientes(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, reloadKey, userId]);

  useEffect(() => {
    if (!authorizedViews.has('clientes') || clienteLookups) return;

    let mounted = true;
    setLoadingClienteLookups(true);

    getClienteLookups()
      .then((data) => {
        if (mounted) setClienteLookups(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudieron cargar los catalogos de clientes.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingClienteLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, [authorizedViews, clienteLookups]);

  useEffect(() => {
    const needsCatalog = ['productos', 'nuevo-producto', 'categorias', 'nueva-categoria', 'nueva-subcategoria', 'nueva-factura'].includes(activeView);
    if (!catalogUserId || !needsCatalog || (!authorizedViews.has('productos') && !authorizedViews.has('categorias'))) return;

    let mounted = true;
    setLoadingProductos(true);
    setDirectoryMessage(null);

    getProductos(catalogUserId, true)
      .then((data) => {
        if (mounted) setProductos(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar productos.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingProductos(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    const needsCatalog = ['productos', 'nuevo-producto', 'categorias', 'nueva-categoria', 'nueva-subcategoria', 'nueva-factura'].includes(activeView);
    if (!catalogUserId || !needsCatalog || (!authorizedViews.has('productos') && !authorizedViews.has('categorias')) || productoLookups) return;

    let mounted = true;
    setLoadingProductoLookups(true);

    getProductoLookups(catalogUserId)
      .then((data) => {
        if (mounted) setProductoLookups(data);
      })
      .catch(() => {
        if (mounted && authorizedViews.has('categorias')) {
          setLoadingCategorias(false);
        }
      })
      .finally(() => {
        if (mounted) setLoadingProductoLookups(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, productoLookups]);

  useEffect(() => {
    const needsCategories = ['categorias', 'nueva-categoria', 'nueva-subcategoria', 'productos', 'nuevo-producto'].includes(activeView);
    if (!catalogUserId || !needsCategories || !authorizedViews.has('categorias')) return;

    let mounted = true;
    setLoadingCategorias(true);
    setDirectoryMessage(null);

    Promise.allSettled([getCategorias(catalogUserId), getSubcategorias(catalogUserId)])
      .then(([categoriasResult, subcategoriasResult]) => {
        if (mounted) {
          const categoriasData = categoriasResult.status === 'fulfilled' ? categoriasResult.value : [];
          const subcategoriasData = subcategoriasResult.status === 'fulfilled' ? subcategoriasResult.value : [];

          setCategorias(categoriasData);
          setSubcategorias(subcategoriasData);

          const errors = [categoriasResult, subcategoriasResult]
            .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
            .map((result) => result.reason);
          const non404Error = errors.find((error) => !(error instanceof ApiError && error.status === 404));

          if (non404Error) {
            const text = non404Error instanceof ApiError ? non404Error.message : 'No se pudieron cargar categorias.';
            setDirectoryMessage({ type: 'error', text });
          }
        }
      })
      .finally(() => {
        if (mounted) setLoadingCategorias(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, productoLookups, reloadKey]);

  useEffect(() => {
    if (!catalogUserId || (!authorizedViews.has('emisor') && !authorizedViews.has('firma'))) return;

    let mounted = true;
    setLoadingEmisores(true);
    setDirectoryMessage(null);

    getEmisores(catalogUserId)
      .then((data) => {
        if (mounted) setEmisores(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar emisores.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingEmisores(false);
      });

    return () => {
      mounted = false;
    };
  }, [authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    const needsProfile = ['perfil', 'perfil-e-rubrica', 'e-rubrica'].includes(activeView);
    if (!userId || !needsProfile || (!authorizedViews.has('perfil') && !canUseERubrica)) return;

    let mounted = true;
    setLoadingPerfil(true);
    setDirectoryMessage(null);

    getPerfil(userId)
      .then((data) => {
        if (!mounted) return;
        setPerfilData(data);
        setPerfilForm(perfilToForm(data.perfil));
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar el perfil.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingPerfil(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, canUseERubrica, reloadKey, userId]);

  useEffect(() => {
    const needsPuntos = authorizedViews.has('punto-emision') || ['nueva-factura', 'nueva-nota-credito', 'nueva-nota-debito', 'nueva-liquidacion-compra', 'nueva-guia-remision'].includes(activeView);
    if (!catalogUserId || !needsPuntos) return;

    let mounted = true;
    setLoadingPuntos(true);
    setDirectoryMessage(null);

    getPuntosEmision(catalogUserId)
      .then((data) => {
        if (mounted) setPuntosData(data);
      })
      .catch((error) => {
        const text = error instanceof ApiError ? error.message : 'No se pudo cargar puntos de emision.';
        if (mounted) setDirectoryMessage({ type: 'error', text });
      })
      .finally(() => {
        if (mounted) setLoadingPuntos(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, catalogUserId, reloadKey]);

  useEffect(() => {
    const isInsideEfact = activeView !== 'portal' && activeView !== 'e-rubrica' && activeView !== 'perfil-e-rubrica' && activeView !== 'no-autorizado';
    const needsFirma = ['emisor', 'nuevo-emisor', 'firma', 'nueva-firma'].includes(activeView);
    if (!catalogUserId || !needsFirma || (!canUseFirma && !authorizedViews.has('emisor')) || !isInsideEfact) return;

    let mounted = true;
    setLoadingFirma(true);
    setDirectoryMessage(null);

    Promise.allSettled(
      emisores
        .filter(hasFirmaConfigured)
        .map(async (emisor) => [emisor.codigo, await getFirmaEstado(catalogUserId, emisor.codigo)] as const),
    )
      .then((results) => {
        if (!mounted) return;
        const estados: Record<number, FirmaEstado> = {};
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [codigo, estado] = result.value;
            estados[codigo] = estado;
          }
        });
        setFirmaEstados(estados);
      })
      .catch((error) => {
        if (mounted) {
          setFirmaEstados({});
          setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo cargar el estado de las firmas.' });
        }
      })
      .finally(() => {
        if (mounted) setLoadingFirma(false);
      });

    return () => {
      mounted = false;
    };
  }, [activeView, authorizedViews, canUseFirma, catalogUserId, emisores, reloadKey]);

  useEffect(() => {
    if (!clienteForm.pais) {
      setProvincias([]);
      setCiudades([]);
      return;
    }

    let mounted = true;
    getProvincias(clienteForm.pais)
      .then((data) => {
        if (mounted) setProvincias(data);
      })
      .catch(() => {
        if (mounted) setProvincias([]);
      });

    return () => {
      mounted = false;
    };
  }, [clienteForm.pais]);

  useEffect(() => {
    if (!clienteForm.provincia) {
      setCiudades([]);
      return;
    }

    let mounted = true;
    getCiudades(clienteForm.provincia)
      .then((data) => {
        if (mounted) setCiudades(data);
      })
      .catch(() => {
        if (mounted) setCiudades([]);
      });

    return () => {
      mounted = false;
    };
  }, [clienteForm.provincia]);

  useEffect(() => {
    if (!productoForm.categoria) {
      setSubcategoriasProducto([]);
      return;
    }

    const local = productoLookups?.subcategorias.filter((item) => item.idCategoria === productoForm.categoria) ?? [];
    if (local.length) {
      setSubcategoriasProducto(local);
      return;
    }

    let mounted = true;
    getProductoSubcategorias(catalogUserId, productoForm.categoria)
      .then((data) => {
        if (mounted) setSubcategoriasProducto(data);
      })
      .catch(() => {
        if (mounted) setSubcategoriasProducto([]);
      });

    return () => {
      mounted = false;
    };
  }, [productoForm.categoria, productoLookups]);

  const filteredClientes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((cliente) =>
      (!term || [
        cliente.nombres,
        cliente.apellidos,
        cliente.nombrerazonsocial,
        cliente.nombrecomercial,
        cliente.numeroidentificacion,
        cliente.correo,
        cliente.celular,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))) &&
      (clienteTipoFiltro === 'todos' || (clienteTipoFiltro === 'personas' ? cliente.tipoCliente === 1 : cliente.tipoCliente === 2)) &&
      (clienteProveedorFiltro === 'todos' || cliente.esProveedor === true) &&
      (clienteEstadoFiltro === 'todos' || (clienteEstadoFiltro === 'activos' ? cliente.estado !== false : cliente.estado === false)),
    );
  }, [clientes, search, clienteTipoFiltro, clienteProveedorFiltro, clienteEstadoFiltro]);

  const clientesActivos = useMemo(() => clientes.filter((cliente) => cliente.estado !== false).length, [clientes]);
  const clientesProveedores = useMemo(() => clientes.filter((cliente) => cliente.esProveedor === true).length, [clientes]);

  const productosConCatalogos = useMemo(() => {
    return productos.map((producto) => ({
      ...producto,
      tarifaDescripcion:
        producto.tarifaDescripcion ??
        productoLookups?.tarifas.find((tarifa) => tarifa.idTarifa === producto.tarifa)?.descripcion,
      categoriaDescripcion:
        producto.categoriaDescripcion ??
        productoLookups?.categorias.find((categoria) => categoria.idCategoria === producto.categoria)?.descripcion,
      subcategoriaDescripcion:
        producto.subcategoriaDescripcion ??
        productoLookups?.subcategorias.find((subcategoria) => subcategoria.idSubcategoria === producto.subcategoria)?.descripcion,
    }));
  }, [productoLookups, productos]);

  const productoCategoriasFiltro = useMemo(() => {
    const map = new Map<number, string>();
    productosConCatalogos.forEach((producto) => {
      if (producto.categoria !== null && producto.categoria !== undefined) {
        map.set(producto.categoria, producto.categoriaDescripcion || `Categoria ${producto.categoria}`);
      }
    });
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [productosConCatalogos]);

  const productoSubcategoriasFiltro = useMemo(() => {
    const map = new Map<number, string>();
    productosConCatalogos.forEach((producto) => {
      if (productoCategoriaFiltro !== null && producto.categoria !== productoCategoriaFiltro) return;
      if (producto.subcategoria !== null && producto.subcategoria !== undefined) {
        map.set(producto.subcategoria, producto.subcategoriaDescripcion || `Subcategoria ${producto.subcategoria}`);
      }
    });
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [productoCategoriaFiltro, productosConCatalogos]);

  const filteredProductos = useMemo(() => {
    return productosConCatalogos.filter((producto) =>
      (productoTipoFiltro === 'todos' || producto.tipo === productoTipoFiltro) &&
      (productoCategoriaFiltro === null || producto.categoria === productoCategoriaFiltro) &&
      (productoSubcategoriaFiltro === null || producto.subcategoria === productoSubcategoriaFiltro) &&
      (productoEstadoFiltro === 'todos' || (productoEstadoFiltro === 'activos' ? producto.estado !== false : producto.estado === false)),
    );
  }, [productoCategoriaFiltro, productoEstadoFiltro, productoSubcategoriaFiltro, productoTipoFiltro, productosConCatalogos]);

  const filteredCategorias = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categorias;

    return categorias.filter((categoria) => categoria.descripcion.toLowerCase().includes(term));
  }, [categorias, search]);

  const filteredSubcategorias = useMemo(() => {
    const term = search.trim().toLowerCase();
    return subcategorias.filter((subcategoria) =>
      (subcategoriaCategoriaFiltro === null || subcategoria.idCategoria === subcategoriaCategoriaFiltro) &&
      (!term || [subcategoria.descripcion, subcategoria.categoriaDescripcion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))),
    );
  }, [subcategoriaCategoriaFiltro, subcategorias, search]);

  const updateClienteForm = <K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) => {
    setClienteForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'pais' ? { provincia: null, ciudad: null } : {}),
      ...(key === 'provincia' ? { ciudad: null } : {}),
      ...(key === 'esProveedor' && value === true
        ? {
            cuentaContableProveedor: current.cuentaContableProveedor || '21311 - Proveedores',
            creditoTributarioProveedor: current.creditoTributarioProveedor || '01',
          }
        : {}),
    }));
  };

  const updateProductoForm = <K extends keyof ProductoFormState>(key: K, value: ProductoFormState[K]) => {
    setProductoForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'categoria' ? { subcategoria: null } : {}),
    }));
  };

  const updateCategoriaForm = <K extends keyof CategoriaFormState>(key: K, value: CategoriaFormState[K]) => {
    setCategoriaForm((current) => ({ ...current, [key]: value }));
  };

  const updateSubcategoriaForm = <K extends keyof SubcategoriaFormState>(key: K, value: SubcategoriaFormState[K]) => {
    setSubcategoriaForm((current) => ({ ...current, [key]: value }));
  };

  const updateEmisorForm = <K extends keyof EmisorFormState>(key: K, value: EmisorFormState[K]) => {
    setEmisorForm((current) => ({ ...current, [key]: value }));
  };

  const consultarSriEmisor = async () => {
    const ruc = emisorForm.ruc.replace(/\D/g, '');
    if (ruc.length !== 13) {
      setDirectoryMessage({ type: 'error', text: 'El RUC debe tener 13 digitos para consultar al SRI.' });
      return;
    }

    setConsultandoSriEmisor(true);
    setDirectoryMessage(null);
    try {
      const resultado = await consultarEmisorSri(ruc);
      if (!resultado.found) {
        setDirectoryMessage({ type: 'info', text: resultado.mensaje || 'El SRI no devolvio informacion para este RUC.' });
        return;
      }

      setEmisorForm((current) => ({
        ...current,
        ruc: resultado.ruc ?? ruc,
        razonSocial: resultado.razonSocial ?? current.razonSocial,
        nomComercial: resultado.nomComercial ?? current.nomComercial,
        dirEstablecimiento: resultado.dirEstablecimiento ?? current.dirEstablecimiento,
        direccionMatriz: resultado.direccionMatriz ?? current.direccionMatriz,
        codEstablecimiento: resultado.codEstablecimiento ?? current.codEstablecimiento,
        llevaContabilidad: resultado.llevaContabilidad === 'SI' ? 'SI' : 'NO',
        retenciones: resultado.retenciones ?? 'NO',
      }));
      setDirectoryMessage({ type: 'success', text: resultado.mensaje || 'Datos del SRI cargados correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo consultar el RUC en el SRI.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setConsultandoSriEmisor(false);
    }
  };

  const updatePerfilForm = <K extends keyof PerfilFormState>(key: K, value: PerfilFormState[K]) => {
    setPerfilForm((current) => ({ ...current, [key]: value }));
  };

  const selectPerfilAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    setSavingPerfil(true);
    setDirectoryMessage(null);

    try {
      const uploaded = await uploadPerfilAvatar(
        userId,
        asset.uri,
        asset.fileName ?? `avatar.${mimeType.includes('png') ? 'png' : 'jpg'}`,
        mimeType,
      );
      const nextForm = {
        ...perfilForm,
        avatarUrl: uploaded.avatarUrl,
        avatarUploadUri: '',
        avatarUploadName: '',
        avatarUploadMimeType: '',
      };
      setPerfilForm(nextForm);
      setPerfilData((current) => current ? { ...current, perfil: { ...current.perfil, avatarUrl: uploaded.avatarUrl } } : current);
      setDirectoryMessage({ type: 'success', text: 'Foto actualizada correctamente.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo subir la foto.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingPerfil(false);
    }
  };

  const selectPresetPerfilAvatar = async (avatar: string) => {
    const avatarUrl = avatarPath(avatar);
    const nextForm = {
      ...perfilForm,
      avatarUrl,
      avatarUploadUri: '',
      avatarUploadName: '',
      avatarUploadMimeType: '',
    };

    setPerfilForm(nextForm);
    setSavingPerfil(true);
    setDirectoryMessage(null);

    try {
      await updatePerfil(userId, perfilFormToPayload(nextForm, perfilData?.perfil));
      setPerfilData((current) => current ? { ...current, perfil: { ...current.perfil, avatarUrl } } : current);
      setDirectoryMessage({ type: 'success', text: 'Avatar actualizado correctamente.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el avatar.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingPerfil(false);
    }
  };

  const selectInitialsPerfilAvatar = async () => {
    const initialsUrl = initialsAvatarDataUri(perfilForm.nombres, perfilForm.apellidos, perfilForm.nombreEmpresa);
    const nextForm = {
      ...perfilForm,
      avatarUrl: initialsUrl,
      avatarUploadUri: '',
      avatarUploadName: '',
      avatarUploadMimeType: '',
    };

    setPerfilForm(nextForm);
    setSavingPerfil(true);
    setDirectoryMessage(null);

    try {
      await updatePerfil(userId, perfilFormToPayload(nextForm, perfilData?.perfil));
      setPerfilData((current) => current ? { ...current, perfil: { ...current.perfil, avatarUrl: initialsUrl } } : current);
      setDirectoryMessage({ type: 'success', text: 'Iniciales actualizadas correctamente.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el avatar de iniciales.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingPerfil(false);
    }
  };

  const updatePuntoForm = <K extends keyof PuntoFormState>(key: K, value: PuntoFormState[K]) => {
    setPuntoForm((current) => ({ ...current, [key]: value }));
  };

  const openNewCliente = () => {
    setSelectedCliente(null);
    setClienteForm(initialClienteForm);
    setClienteFormMode('create');
    setDirectoryMessage(null);
    openView('nuevo-cliente');
  };

  const openNewProveedor = () => {
    setSelectedCliente(null);
    setClienteForm({ ...initialClienteForm, esProveedor: true });
    setClienteFormMode('create');
    setDirectoryMessage(null);
    openView('nuevo-cliente');
  };

  const openEditCliente = (cliente: Cliente) => {
    if (isConsumidorFinal(cliente)) {
      setDirectoryMessage({ type: 'info', text: 'Consumidor final es un registro del sistema y no se puede editar.' });
      return;
    }

    setSelectedCliente(cliente);
    setClienteForm(clienteToForm(cliente));
    setClienteFormMode('edit');
    setDirectoryMessage(null);
    openView('nuevo-cliente');
  };

  const closeClienteForm = () => {
    setSelectedCliente(null);
    setClienteForm(initialClienteForm);
    setClienteFormMode(null);
    openView('clientes');
  };

  const saveCliente = async () => {
    if (!userId || savingCliente) return;

    const nombre = clienteForm.tipoCliente === 2 ? clienteForm.nombrerazonsocial : `${clienteForm.nombres} ${clienteForm.apellidos}`;
    const empresaSinNombreComercial = clienteForm.tipoCliente === 2 && !clienteForm.nombrecomercial.trim();
    if (!clienteForm.tipoCliente || !nombre.trim() || empresaSinNombreComercial || !clienteForm.numeroidentificacion.trim() || !clienteForm.correo.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa tipo, identificacion, nombre y correo.' });
      return;
    }

    const identificacionLookup = clienteLookups?.identificaciones.find((item) => item.ideSec === clienteForm.tipoidentificacion);
    const identificacionError = validateClientIdentification(
      identificacionLookup?.ideCodigo ?? clienteForm.tipoidentificacion,
      identificacionLookup?.ideDescripcion,
      clienteForm.numeroidentificacion,
    );
    if (identificacionError) {
      setDirectoryMessage({ type: 'error', text: identificacionError });
      return;
    }

    if (clienteForm.direccion.trim().length < 5 || clienteForm.direccion.trim().length > 100) {
      setDirectoryMessage({ type: 'error', text: 'La direccion debe tener entre 5 y 100 caracteres.' });
      return;
    }

    const errorNombre = validarTextoObligatorio(nombre, clienteForm.tipoCliente === 2 ? 'La razón social' : 'El nombre del cliente', 150, clienteForm.tipoCliente === 2);
    if (errorNombre) {
      setDirectoryMessage({ type: 'error', text: errorNombre });
      return;
    }

    if (!validateEmail(clienteForm.correo.trim()).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo principal no tiene un formato válido.' });
      return;
    }

    if (clienteForm.tipoContactoTelefonico === 'CELULAR' && clienteForm.celular.trim() && !/^[0-9+()\-\s]{7,20}$/.test(clienteForm.celular.trim())) {
      setDirectoryMessage({ type: 'error', text: 'El celular no tiene un formato válido.' });
      return;
    }

    if (clienteForm.tipoContactoTelefonico === 'CONVENCIONAL' && clienteForm.telefonoconvencional.trim() && !/^[0-9+()\-\s]{7,20}$/.test(clienteForm.telefonoconvencional.trim())) {
      setDirectoryMessage({ type: 'error', text: 'El telefono convencional no tiene un formato válido.' });
      return;
    }

    for (const correo of clienteForm.correosAdicionales) {
      if (correo.trim() && !validateEmail(correo).valid) {
        setDirectoryMessage({ type: 'error', text: 'Uno de los correos adicionales no tiene un formato válido.' });
        return;
      }
    }
    const correosAdicionales = clienteForm.correosAdicionales.map((correo) => correo.trim().toLowerCase()).filter(Boolean);
    const correoPrincipal = clienteForm.correo.trim().toLowerCase();
    if (correosAdicionales.includes(correoPrincipal) || new Set(correosAdicionales).size !== correosAdicionales.length) {
      setDirectoryMessage({ type: 'error', text: 'Los correos adicionales no pueden repetirse ni coincidir con el correo principal.' });
      return;
    }

    if (!clienteForm.oblgconta) {
      setDirectoryMessage({ type: 'error', text: 'Indica si esta obligado a llevar contabilidad.' });
      return;
    }

    if (clienteForm.diasCredito.trim() && Number(clienteForm.diasCredito.trim()) < 0) {
      setDirectoryMessage({ type: 'error', text: 'Los dias de credito no pueden ser negativos.' });
      return;
    }

    setSavingCliente(true);
    setDirectoryMessage(null);

    try {
      const payload = clienteFormToPayload(clienteForm);

      if (clienteFormMode === 'edit' && selectedCliente) {
        await updateCliente(userId, selectedCliente.codcliente, payload);
        setDirectoryMessage({ type: 'success', text: 'Cliente actualizado correctamente.' });
      } else {
        await createCliente(userId, payload);
        setDirectoryMessage({ type: 'success', text: 'Cliente registrado correctamente.' });
      }

      closeClienteForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el cliente.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingCliente(false);
    }
  };

  const confirmDeleteCliente = (cliente: Cliente) => {
    if (isConsumidorFinal(cliente)) {
      setDirectoryMessage({ type: 'info', text: 'Consumidor final es un registro del sistema y no se puede eliminar.' });
      return;
    }

    const name =
      cliente.nombrerazonsocial ||
      cliente.nombrecomercial ||
      [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ') ||
      'este cliente';

    Alert.alert('Eliminar cliente', `Deseas eliminar ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCliente(userId, cliente.codcliente);
            setDirectoryMessage({ type: 'success', text: 'Cliente eliminado correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar el cliente.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const openNewProducto = () => {
    setSelectedProducto(null);
    setProductoForm(initialProductoForm);
    setProductoFormMode('create');
    setDirectoryMessage(null);
    openView('nuevo-producto');
  };

  const openEditProducto = async (producto: Producto) => {
    setSelectedProducto(producto);
    setProductoForm(productoToForm(producto));
    setProductoFormMode('edit');
    setDirectoryMessage(null);
    setLoadingProductoDetail(true);
    openView('nuevo-producto');

    try {
      const detalle = await getProducto(catalogUserId, producto.codproducto);
      setSelectedProducto(detalle);
      setProductoForm(productoToForm(detalle));
    } catch {
      setProductoForm(productoToForm(producto));
    } finally {
      setLoadingProductoDetail(false);
    }
  };

  const closeProductoForm = () => {
    setSelectedProducto(null);
    setProductoForm(initialProductoForm);
    setProductoFormMode(null);
    openView('productos');
  };

  const saveProducto = async () => {
    if (!catalogUserId || savingProducto) return;

    const precios = productoForm.precios.map((precio) => Number(precio.replace(',', '.')));
    const precioBase = precios[0];
    if (!productoForm.tipo || !productoForm.nombre.trim() || !productoForm.precios[0]?.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa tipo, nombre y precio base.' });
      return;
    }

    if (precios.some((precio) => !Number.isFinite(precio) || precio < 0)) {
      setDirectoryMessage({ type: 'error', text: 'Todos los precios deben ser numeros validos mayores o iguales a cero.' });
      return;
    }

    if (productoForm.iva && productoForm.tarifa === null) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona la tarifa de IVA.' });
      return;
    }

    const nombreProductoError = validarTextoObligatorio(productoForm.nombre, 'El nombre del producto', 300, true);
    if (nombreProductoError) {
      setDirectoryMessage({ type: 'error', text: nombreProductoError });
      return;
    }
    if (productoForm.codigo.trim() && !/^[A-Za-z0-9._\-]{1,50}$/.test(productoForm.codigo.trim())) {
      setDirectoryMessage({ type: 'error', text: 'El código solo permite letras, números, punto, guion y guion bajo; máximo 50 caracteres.' });
      return;
    }
    if (productoForm.categoria === null || productoForm.categoria === undefined) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona una categoría para el producto.' });
      return;
    }

    setSavingProducto(true);
    setDirectoryMessage(null);

    try {
      const payload = productoFormToPayload(productoForm);

      if (productoFormMode === 'edit' && selectedProducto) {
        await updateProducto(catalogUserId, selectedProducto.codproducto, payload);
        setDirectoryMessage({ type: 'success', text: 'Producto actualizado correctamente.' });
      } else {
        await createProducto(catalogUserId, payload);
        setDirectoryMessage({ type: 'success', text: 'Producto registrado correctamente.' });
      }

      closeProductoForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el producto.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingProducto(false);
    }
  };

  const confirmDeleteProducto = (producto: Producto) => {
    const name = producto.nombre || 'este producto';

    Alert.alert('Eliminar producto', `Deseas eliminar ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProducto(catalogUserId, producto.codproducto);
            setDirectoryMessage({ type: 'success', text: 'Producto eliminado correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar el producto.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const openNewCategoria = () => {
    setSelectedCategoria(null);
    setCategoriaForm(initialCategoriaForm);
    setCategoriaFormMode('create');
    setDirectoryMessage(null);
    openView('nueva-categoria');
  };

  const openEditCategoria = (categoria: CategoriaCatalogo) => {
    setSelectedCategoria(categoria);
    setCategoriaForm(categoriaToForm(categoria));
    setCategoriaFormMode('edit');
    setDirectoryMessage(null);
    openView('nueva-categoria');
  };

  const closeCategoriaForm = () => {
    setSelectedCategoria(null);
    setCategoriaForm(initialCategoriaForm);
    setCategoriaFormMode(null);
    openView('categorias');
  };

  const saveCategoria = async () => {
    if (!catalogUserId || savingCategoria) return;

    if (!categoriaForm.descripcion.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa la descripcion de la categoria.' });
      return;
    }

    const categoriaError = validarTextoObligatorio(categoriaForm.descripcion, 'La descripción de la categoría', 100, true);
    if (categoriaError) {
      setDirectoryMessage({ type: 'error', text: categoriaError });
      return;
    }

    setSavingCategoria(true);
    setDirectoryMessage(null);

    try {
      const payload = { descripcion: categoriaForm.descripcion.trim(), estado: categoriaForm.estado };

      if (categoriaFormMode === 'edit' && selectedCategoria) {
        await updateCategoria(catalogUserId, selectedCategoria.idCategoria, payload);
        setDirectoryMessage({ type: 'success', text: 'Categoria actualizada correctamente.' });
      } else {
        await createCategoria(catalogUserId, payload);
        setDirectoryMessage({ type: 'success', text: 'Categoria registrada correctamente.' });
      }

      closeCategoriaForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la categoria.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingCategoria(false);
    }
  };

  const confirmDeleteCategoria = (categoria: CategoriaCatalogo) => {
    Alert.alert('Eliminar categoria', `Deseas eliminar ${categoria.descripcion}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategoria(catalogUserId, categoria.idCategoria);
            setDirectoryMessage({ type: 'success', text: 'Categoria eliminada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar la categoria.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const openNewSubcategoria = () => {
    setSelectedSubcategoria(null);
    setSubcategoriaForm(initialSubcategoriaForm);
    setSubcategoriaFormMode('create');
    setDirectoryMessage(null);
    openView('nueva-subcategoria');
  };

  const openEditSubcategoria = (subcategoria: SubcategoriaCatalogo) => {
    setSelectedSubcategoria(subcategoria);
    setSubcategoriaForm(subcategoriaToForm(subcategoria));
    setSubcategoriaFormMode('edit');
    setDirectoryMessage(null);
    openView('nueva-subcategoria');
  };

  const closeSubcategoriaForm = () => {
    setSelectedSubcategoria(null);
    setSubcategoriaForm(initialSubcategoriaForm);
    setSubcategoriaFormMode(null);
    openView('categorias');
  };

  const saveSubcategoria = async () => {
    if (!catalogUserId || savingCategoria) return;

    if (!subcategoriaForm.descripcion.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa la descripcion de la subcategoria.' });
      return;
    }

    if (!subcategoriaForm.idCategoria) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona la categoria de la subcategoria.' });
      return;
    }

    const subcategoriaError = validarTextoObligatorio(subcategoriaForm.descripcion, 'La descripción de la subcategoría', 100, true);
    if (subcategoriaError) {
      setDirectoryMessage({ type: 'error', text: subcategoriaError });
      return;
    }

    setSavingCategoria(true);
    setDirectoryMessage(null);

    try {
      const payload = {
        descripcion: subcategoriaForm.descripcion.trim(),
        idCategoria: subcategoriaForm.idCategoria,
        estado: subcategoriaForm.estado,
      };

      if (subcategoriaFormMode === 'edit' && selectedSubcategoria) {
        await updateSubcategoria(catalogUserId, selectedSubcategoria.idSubcategoria, payload);
        setDirectoryMessage({ type: 'success', text: 'Subcategoria actualizada correctamente.' });
      } else {
        await createSubcategoria(catalogUserId, payload);
        setDirectoryMessage({ type: 'success', text: 'Subcategoria registrada correctamente.' });
      }

      closeSubcategoriaForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la subcategoria.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingCategoria(false);
    }
  };

  const confirmDeleteSubcategoria = (subcategoria: SubcategoriaCatalogo) => {
    Alert.alert('Eliminar subcategoria', `Deseas eliminar ${subcategoria.descripcion}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubcategoria(catalogUserId, subcategoria.idSubcategoria);
            setDirectoryMessage({ type: 'success', text: 'Subcategoria eliminada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar la subcategoria.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const savePerfil = async () => {
    if (!userId || savingPerfil) return;

    const esEmpresa = perfilForm.tipoCliente === 2;
    if (!perfilForm.tipoCliente || !perfilForm.idTipoIdentificacion || !perfilForm.identificacion.trim() || !perfilForm.direccionEmpresa.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa tipo de cliente, identificacion y direccion.' });
      return;
    }

    if (esEmpresa && !perfilForm.nombreEmpresa.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa la razon social o nombre de empresa.' });
      return;
    }

    if (!esEmpresa && (!perfilForm.nombres.trim() || !perfilForm.apellidos.trim())) {
      setDirectoryMessage({ type: 'error', text: 'Completa nombres y apellidos.' });
      return;
    }

    const perfilNombreError = esEmpresa
      ? validarTextoObligatorio(perfilForm.nombreEmpresa, 'La razón social', 150, true)
      : validarTextoObligatorio(`${perfilForm.nombres} ${perfilForm.apellidos}`, 'Los nombres y apellidos', 150);
    if (perfilNombreError) {
      setDirectoryMessage({ type: 'error', text: perfilNombreError });
      return;
    }

    const identificacionPerfil = perfilData?.tiposIdentificacion.find((item) => item.idTipoIdentificacion === perfilForm.idTipoIdentificacion);
    const identificacionPerfilError = validateClientIdentification(
      identificacionPerfil?.nombreTipo ?? perfilForm.idTipoIdentificacion,
      identificacionPerfil?.descripcion,
      perfilForm.identificacion,
    );
    if (identificacionPerfilError) {
      setDirectoryMessage({ type: 'error', text: identificacionPerfilError });
      return;
    }

    if (perfilForm.direccionEmpresa.trim().length < 5 || perfilForm.direccionEmpresa.trim().length > 300) {
      setDirectoryMessage({ type: 'error', text: 'La dirección debe tener entre 5 y 300 caracteres.' });
      return;
    }

    if (perfilForm.celular.trim() && !validarTelefono(perfilForm.celular)) {
      setDirectoryMessage({ type: 'error', text: 'El teléfono debe tener entre 7 y 15 dígitos.' });
      return;
    }

    if (perfilForm.email.trim() && !validateEmail(perfilForm.email.trim()).valid) {
      setDirectoryMessage({ type: 'error', text: 'El formato del correo electronico no es valido.' });
      return;
    }

    if (perfilForm.cambiarClave) {
      if (!perfilForm.nuevaPassword || !perfilForm.confirmarPassword) {
        setDirectoryMessage({ type: 'error', text: 'Completa la nueva clave y su confirmacion.' });
        return;
      }

      if (perfilForm.nuevaPassword !== perfilForm.confirmarPassword) {
        setDirectoryMessage({ type: 'error', text: 'Las claves no coinciden.' });
        return;
      }

      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{10,}$/.test(perfilForm.nuevaPassword)) {
        setDirectoryMessage({ type: 'error', text: 'La nueva clave debe tener 10 caracteres, mayúscula, minúscula, número y símbolo.' });
        return;
      }
    }

    setSavingPerfil(true);
    setDirectoryMessage(null);

    try {
      let formToSave = perfilForm;
      if (perfilForm.avatarUploadUri) {
        const uploaded = await uploadPerfilAvatar(
          userId,
          perfilForm.avatarUploadUri,
          perfilForm.avatarUploadName || 'avatar.jpg',
          perfilForm.avatarUploadMimeType || 'image/jpeg',
        );
        formToSave = {
          ...perfilForm,
          avatarUrl: uploaded.avatarUrl,
          avatarUploadUri: '',
          avatarUploadName: '',
          avatarUploadMimeType: '',
        };
        setPerfilForm(formToSave);
      }

      await updatePerfil(userId, perfilFormToPayload(formToSave, perfilData?.perfil));
      setDirectoryMessage({ type: 'success', text: 'Perfil actualizado correctamente.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el perfil.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingPerfil(false);
    }
  };

  const openNewPunto = () => {
    if (!puntosData?.emisor) {
      setDirectoryMessage({ type: 'info', text: 'Primero registra un emisor para crear puntos de emision.' });
      return;
    }

    setSelectedPunto(null);
    setPuntoForm({ puntoEmision: getNextPuntoCode(puntosData.cajas) });
    setPuntoFormMode('create');
    setDirectoryMessage(null);
    openView('nuevo-punto-emision');
  };

  const openEditPunto = (punto: PuntoEmision) => {
    setSelectedPunto(punto);
    setPuntoForm(puntoToForm(punto));
    setPuntoFormMode('edit');
    setDirectoryMessage(null);
    openView('nuevo-punto-emision');
  };

  const closePuntoForm = () => {
    setSelectedPunto(null);
    setPuntoForm(initialPuntoForm);
    setPuntoFormMode(null);
    openView('punto-emision');
  };

  const savePunto = async () => {
    if (!catalogUserId || savingPunto) return;

    const punto = normalizeSerieCode(puntoForm.puntoEmision);
    if (!punto) {
      setDirectoryMessage({ type: 'error', text: 'Ingresa el punto de emision.' });
      return;
    }

    if (!/^\d{3}$/.test(punto)) {
      setDirectoryMessage({ type: 'error', text: 'El punto de emisión debe tener exactamente 3 dígitos.' });
      return;
    }

    setSavingPunto(true);
    setDirectoryMessage(null);

    try {
      if (puntoFormMode === 'edit' && selectedPunto) {
        await updatePuntoEmision(catalogUserId, selectedPunto.sec, punto);
        setDirectoryMessage({ type: 'success', text: 'Punto de emision actualizado correctamente.' });
      } else {
        await createPuntoEmision(catalogUserId, punto, puntosData?.emisor?.codEstablecimiento);
        setDirectoryMessage({ type: 'success', text: 'Punto de emision registrado correctamente.' });
      }

      closePuntoForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el punto de emision.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingPunto(false);
    }
  };

  const confirmDeletePunto = (punto: PuntoEmision) => {
    Alert.alert('Eliminar punto de emision', `Deseas eliminar la serie ${getPuntoSerie(punto)}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePuntoEmision(catalogUserId, punto.sec);
            setDirectoryMessage({ type: 'success', text: 'Punto de emision eliminado correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar el punto de emision.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const makePuntoPrincipal = async (punto: PuntoEmision) => {
    if (!catalogUserId) return;

    try {
      await markPuntoPrincipal(catalogUserId, punto.sec);
      setDirectoryMessage({ type: 'success', text: 'Punto principal actualizado correctamente.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo marcar como principal.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const openNewEmisor = () => {
    if (emisores.some((emisor) => emisor.estado !== false)) {
      setDirectoryMessage({ type: 'info', text: 'Ya existe un emisor registrado. Puedes editar el emisor actual.' });
      return;
    }

    setSelectedEmisor(null);
    setEmisorForm(initialEmisorForm);
    setEmisorFormMode('create');
    setDirectoryMessage(null);
    openView('nuevo-emisor');
  };

  const openEditEmisor = async (emisor: Emisor) => {
    setSelectedEmisor(emisor);
    setEmisorForm(emisorToForm(emisor));
    setEmisorFormMode('edit');
    setDirectoryMessage(null);
    openView('nuevo-emisor');

    try {
      const detalle = await getEmisor(catalogUserId, emisor.codigo);
      setSelectedEmisor(detalle);
      setEmisorForm(emisorToForm(detalle));
    } catch {
      setEmisorForm(emisorToForm(emisor));
    }
  };

  const closeEmisorForm = () => {
    setSelectedEmisor(null);
    setEmisorForm(initialEmisorForm);
    setEmisorFormMode(null);
    openView(activeView === 'nueva-firma' ? 'firma' : 'emisor');
  };

  const saveEmisor = async () => {
    if (!catalogUserId || savingEmisor) return;

    const ruc = emisorForm.ruc.replace(/\D/g, '');
    if (!emisorForm.razonSocial.trim() || !emisorForm.nomComercial.trim() || !ruc) {
      setDirectoryMessage({ type: 'error', text: 'Completa razon social, nombre comercial y RUC.' });
      return;
    }

    if (ruc.length !== 13) {
      setDirectoryMessage({ type: 'error', text: 'El RUC debe tener 13 digitos.' });
      return;
    }

    const rucValidation = validateIdentificacion('RUC', ruc);
    if (!rucValidation.valid) {
      setDirectoryMessage({ type: 'error', text: rucValidation.message ?? 'El RUC no es válido.' });
      return;
    }

    if (!emisorForm.dirEstablecimiento.trim() || !emisorForm.direccionMatriz.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa las direcciones del emisor.' });
      return;
    }

    if (emisorForm.dirEstablecimiento.trim().length < 5 || emisorForm.dirEstablecimiento.trim().length > 300 || emisorForm.direccionMatriz.trim().length < 5 || emisorForm.direccionMatriz.trim().length > 300) {
      setDirectoryMessage({ type: 'error', text: 'Las direcciones deben tener entre 5 y 300 caracteres.' });
      return;
    }

    if (!validarTelefono(emisorForm.telefono)) {
      setDirectoryMessage({ type: 'error', text: 'El teléfono debe tener entre 7 y 15 dígitos.' });
      return;
    }

    const razonSocialError = validarTextoObligatorio(emisorForm.razonSocial, 'La razón social', 300, true)
      ?? validarTextoObligatorio(emisorForm.nomComercial, 'El nombre comercial', 300, true);
    if (razonSocialError) {
      setDirectoryMessage({ type: 'error', text: razonSocialError });
      return;
    }

    if (emisorForm.email.trim() && !validateEmail(emisorForm.email.trim()).valid) {
      setDirectoryMessage({ type: 'error', text: 'El formato del correo electronico no es valido.' });
      return;
    }

    if (activeView === 'firma' || activeView === 'nueva-firma') {
      const firmaPath = emisorForm.pathCertificado.trim();
      const tieneArchivoNuevo = Boolean(emisorForm.firmaArchivoUri);
      const tieneClave = Boolean(emisorForm.claveCertificado.trim() || selectedEmisor?.tieneClaveCertificadoConfigurada);

      if ((!firmaPath && !tieneArchivoNuevo) || !tieneClave) {
        setDirectoryMessage({ type: 'error', text: 'Agrega el archivo .p12 y la clave del certificado.' });
        return;
      }

      const nombreArchivo = emisorForm.firmaArchivoNombre || firmaPath;
      if (!nombreArchivo.toLowerCase().endsWith('.p12')) {
        setDirectoryMessage({ type: 'error', text: 'El archivo de firma debe ser .p12.' });
        return;
      }
    }

    setSavingEmisor(true);
    setDirectoryMessage(null);

    try {
      let formToSave = emisorForm;

      if ((activeView === 'firma' || activeView === 'nueva-firma') && selectedEmisor && emisorForm.firmaArchivoUri) {
        const uploaded = await uploadFirmaArchivo(catalogUserId, selectedEmisor.codigo, {
          uri: emisorForm.firmaArchivoUri,
          name: emisorForm.firmaArchivoNombre,
          mimeType: emisorForm.firmaArchivoMimeType,
        });
        formToSave = {
          ...emisorForm,
          pathCertificado: uploaded.pathCertificado,
          firmaArchivoUri: '',
          firmaArchivoNombre: uploaded.nombreArchivo ?? emisorForm.firmaArchivoNombre,
          firmaArchivoMimeType: '',
          eliminarClaveCertificado: false,
        };
        setEmisorForm(formToSave);
      }

      const payload = emisorFormToPayload(formToSave, selectedEmisor);

      if (emisorFormMode === 'edit' && selectedEmisor) {
        await updateEmisor(catalogUserId, selectedEmisor.codigo, payload);
        setDirectoryMessage({ type: 'success', text: activeView === 'firma' || activeView === 'nueva-firma' ? 'Firma guardada correctamente.' : 'Emisor actualizado correctamente.' });
      } else {
        await createEmisor(catalogUserId, payload);
        setDirectoryMessage({ type: 'success', text: 'Emisor registrado correctamente.' });
      }

      closeEmisorForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el emisor.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingEmisor(false);
    }
  };

  const openFirmaForm = (emisor: Emisor) => {
    setSelectedEmisor(emisor);
    setEmisorForm(emisorToForm(emisor));
    setEmisorFormMode('edit');
    setDirectoryMessage(null);
    openView('nueva-firma');
  };

  const openAddFirma = () => {
    const emisor = emisores.find((item) => !hasFirmaConfigured(item)) ?? emisores[0];
    if (!emisor) {
      setDirectoryMessage({ type: 'info', text: 'Primero registra un emisor para agregar la firma.' });
      return;
    }

    openFirmaForm(emisor);
  };

  const clearFirmaFields = () => {
    setEmisorForm((current) => ({
      ...current,
      pathCertificado: '',
      firmaArchivoUri: '',
      firmaArchivoNombre: '',
      firmaArchivoMimeType: '',
      claveCertificado: '',
      eliminarClaveCertificado: true,
    }));
  };

  const confirmDeleteFirma = (emisor: Emisor) => {
    const title = emisor.nomComercial || emisor.razonSocial || 'este emisor';
    Alert.alert('Eliminar firma', `Deseas quitar la firma configurada de ${title}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!catalogUserId) return;
          try {
            const form = {
              ...emisorToForm(emisor),
              pathCertificado: '',
              firmaArchivoUri: '',
              firmaArchivoNombre: '',
              firmaArchivoMimeType: '',
              claveCertificado: '',
              eliminarClaveCertificado: true,
            };
            await updateEmisor(catalogUserId, emisor.codigo, emisorFormToPayload(form, emisor));
            setDirectoryMessage({ type: 'success', text: 'Firma eliminada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar la firma.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const selectFirmaArchivo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      if (!asset.name.toLowerCase().endsWith('.p12')) {
        setDirectoryMessage({ type: 'error', text: 'Solo se permiten archivos .p12.' });
        return;
      }

      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setDirectoryMessage({ type: 'error', text: 'El archivo de firma no debe superar 5 MB.' });
        return;
      }

      setEmisorForm((current) => ({
        ...current,
        pathCertificado: current.pathCertificado,
        firmaArchivoUri: asset.uri,
        firmaArchivoNombre: asset.name,
        firmaArchivoMimeType: asset.mimeType || 'application/x-pkcs12',
        eliminarClaveCertificado: false,
      }));
      setDirectoryMessage({ type: 'info', text: 'Archivo .p12 seleccionado. Ingresa la clave y guarda la firma.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No se pudo seleccionar el archivo .p12.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const selectEmisorLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setDirectoryMessage({ type: 'error', text: 'Se necesita permiso para seleccionar el logo.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 1],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.base64) {
        setDirectoryMessage({ type: 'error', text: 'No se pudo leer la imagen seleccionada.' });
        return;
      }

      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        setDirectoryMessage({ type: 'error', text: 'El logo no debe superar 2 MB.' });
        return;
      }

      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType = asset.mimeType || (extension === 'png' ? 'image/png' : 'image/jpeg');
      if (!['image/jpeg', 'image/png'].includes(mimeType)) {
        setDirectoryMessage({ type: 'error', text: 'El logo debe ser JPG, JPEG o PNG.' });
        return;
      }

      setEmisorForm((current) => ({
        ...current,
        logoImagen: `data:${mimeType};base64,${asset.base64}`,
      }));
      setDirectoryMessage({ type: 'info', text: 'Logo seleccionado. Revisa la vista previa y guarda el emisor.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'No se pudo seleccionar el logo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const confirmDeleteEmisor = (emisor: Emisor) => {
    const name = emisor.razonSocial || emisor.nomComercial || 'este emisor';

    Alert.alert('Eliminar emisor', `Deseas eliminar ${name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEmisor(catalogUserId, emisor.codigo);
            setDirectoryMessage({ type: 'success', text: 'Emisor eliminado correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar el emisor.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const showAdminItemDetail = (item: AdminMobileItem) => {
    Alert.alert(item.title || 'Detalle', [item.subtitle, item.meta, item.detail].filter(Boolean).join('\n') || item.id);
  };

  const openNewOperational = () => {
    setSelectedOperationalItem(null);
    setOperationalForm(initialOperationalForm);
    setOperationalFormMode('create');
    setDirectoryMessage(null);
  };

  const openAccountPaymentFromStatement = (item: OperationalMobileItem) => {
    setSelectedOperationalItem(null);
    setOperationalForm({
      ...initialOperationalForm,
      codigo: getAccountStatementClientId(item),
      facturaId: String(getAccountStatementNumber(item, ['idFactura', 'IdFactura', 'codFactura', 'CodFactura'], 0) || ''),
      descripcion: item.title ? `Abono de ${item.title}` : 'Abono de cliente',
      observacion: item.title ? `Cliente: ${item.title}` : '',
    });
    setOperationalFormMode('create');
    setOperationalTabByView((current) => ({ ...current, 'cuentas-cobrar': 'Abonos' }));
    setSearch('');
    setDirectoryMessage(null);
    setActiveView('cuentas-cobrar');
  };

  const openEditOperational = (item: OperationalMobileItem) => {
    setSelectedOperationalItem(item);
    setOperationalForm(operationalItemToForm(item));
    setOperationalFormMode('edit');
    setDirectoryMessage(null);
  };

  const closeOperationalForm = () => {
    setOperationalFormMode(null);
    setSelectedOperationalItem(null);
    setOperationalForm(initialOperationalForm);
  };

  const updateOperationalForm = (field: keyof OperationalFormState, value: string) => {
    setOperationalForm((current) => ({ ...current, [field]: value }));
  };

  const updateRechargeForm = (field: 'codigo' | 'valor', rawValue: string) => {
    setOperationalForm((current) => {
      if (field === 'codigo') {
        const codigo = rawValue.replace(/\D/g, '');
        const documentos = Number(codigo) || 0;
        return {
          ...current,
          codigo,
          valor: documentos > 0 ? calculateMobileRechargeTotal(documentos).toFixed(2) : '',
          descripcion: documentos > 0 ? `Recarga de ${documentos} documentos` : '',
        };
      }

      const valor = rawValue.replace(/[^\d,.]/g, '');
      const monto = Number(valor.replace(',', '.')) || 0;
      const documentos = calculateMobileRechargeDocuments(monto);
      return {
        ...current,
        valor,
        codigo: documentos > 0 ? String(documentos) : '',
        descripcion: documentos > 0 ? `Recarga de ${documentos} documentos` : '',
      };
    });
  };

  const selectRechargePlan = (documents: number, amount: number, unlimited: boolean) => {
    setOperationalForm((current) => ({
      ...current,
      codigo: unlimited ? '0' : String(documents),
      valor: amount.toFixed(2),
      descripcion: unlimited ? 'Documentos ilimitados por 1 año' : `Recarga de ${documents} documentos`,
    }));
  };

  const getCurrentOperationalContext = () => {
    const module = getOperationalModuleSlug(activeView);
    if (!module) return null;
    const tab = operationalTabByView[activeView] ?? getOperationalDefaultTab(activeView, module);

    return { module, tab };
  };

  const saveOperational = async () => {
    const context = getCurrentOperationalContext();
    if (!context) return;

    if (!operationalForm.descripcion.trim() && !(context.module === 'recargas' && context.tab === 'Comprar documentos')) {
      setDirectoryMessage({ type: 'error', text: 'Completa la descripcion del registro.' });
      return;
    }

    if (operationalForm.descripcion.trim() && operationalForm.descripcion.trim().length > 250) {
      setDirectoryMessage({ type: 'error', text: 'La descripción no puede superar 250 caracteres.' });
      return;
    }
    if (operationalForm.observacion.trim().length > 1000) {
      setDirectoryMessage({ type: 'error', text: 'La observación no puede superar 1000 caracteres.' });
      return;
    }
    if (operationalForm.valor.trim() && (!/^\d+(?:[,.]\d{1,2})?$/.test(operationalForm.valor.trim()) || Number(operationalForm.valor.replace(',', '.')) < 0)) {
      setDirectoryMessage({ type: 'error', text: 'El valor debe ser un número válido con máximo dos decimales.' });
      return;
    }

    if (context.module === 'cuentas-cobrar' && context.tab === 'Abonos') {
      if (!(Number(operationalForm.codigo) > 0) || !(Number(operationalForm.facturaId) > 0)) {
        setDirectoryMessage({ type: 'error', text: 'Selecciona un cliente y una factura para registrar el abono.' });
        return;
      }
      if (!(Number(operationalForm.valor.replace(',', '.')) > 0)) {
        setDirectoryMessage({ type: 'error', text: 'Ingresa un monto de abono mayor a cero.' });
        return;
      }
    }

    if (context.module === 'recargas' && context.tab === 'Comprar documentos') {
      const documentos = Number(operationalForm.codigo);
      const monto = Number(operationalForm.valor.replace(',', '.'));
      if (!Number.isInteger(documentos) || documentos < 0 || !Number.isFinite(monto) || monto <= 0) {
        setDirectoryMessage({ type: 'error', text: 'Selecciona un plan o ingresa una cantidad y valor de recarga válidos.' });
        return;
      }
    }

    setSavingOperational(true);
    setDirectoryMessage(null);

    try {
      const payload = operationalFormToPayloadForContext(context.module, context.tab, operationalForm);
      if (context.module === 'recargas' && context.tab === 'Comprar documentos' && catalogUserId) {
        const payment = await iniciarPagoCompraDocumentos(catalogUserId, {
          documentos: Number(operationalForm.codigo.trim()) || 0,
          montoTotal: Number(operationalForm.valor.replace(',', '.')) || 0,
          descripcion: operationalForm.descripcion.trim() || 'Recarga personalizada',
          emailDestino: operationalForm.observacion.trim() || null,
          esIlimitado: operationalForm.descripcion.toLowerCase().includes('ilimit'),
        });
        await Linking.openURL(payment.paymentUrl);
        setDirectoryMessage({ type: 'success', text: 'Checkout de Pagomedios abierto. La recarga se acreditara al aprobar el pago.' });
        return;
      }
      if (operationalFormMode === 'edit' && selectedOperationalItem?.id) {
        await updateOperationalItem(context.module, context.tab, selectedOperationalItem.id, payload, { userId: catalogUserId });
      } else {
        await createOperationalItem(context.module, context.tab, payload, { userId: catalogUserId });
      }

      setDirectoryMessage({ type: 'success', text: 'Registro guardado correctamente.' });
      closeOperationalForm();
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar el registro.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingOperational(false);
    }
  };

  const showOperationalItemDetail = (item: OperationalMobileItem) => {
    Alert.alert(item.title || 'Detalle', [item.subtitle, item.meta, item.status, item.detail].filter(Boolean).join('\n') || item.id);
  };

  const confirmDeleteOperational = (item: OperationalMobileItem) => {
    const context = getCurrentOperationalContext();
    if (!context) return;

    Alert.alert('Eliminar registro', `Deseas eliminar ${item.title || item.id || 'este registro'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOperationalItem(context.module, context.tab, item.id, { userId: catalogUserId });
            setDirectoryMessage({ type: 'success', text: 'Registro eliminado correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo eliminar el registro.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const updateFacturaForm = (field: keyof NuevaFacturaFormState, value: string) => {
    setFacturaForm((current) => ({ ...current, [field]: value }));
  };

  const mapProductoToFacturaProducto = (producto: Producto): FacturaProducto => ({
    codproducto: producto.codproducto,
    codprincipal: producto.codigo ?? null,
    descripcion: producto.nombre,
    precioUnitario: getProductoPrice(producto),
    costo: getProductoPrice(producto),
    tarifaIva: normalizeFacturaIva(producto.tarifa ?? (producto.iva ? 12 : 0)),
  });

  const searchLocalFacturaProductos = (rawFilter: string) => {
    const term = normalizeText(rawFilter.trim());
    if (!term) return [];
    return productos
      .filter((producto) => producto.estado !== false)
      .filter((producto) => [
        producto.nombre,
        producto.codigo,
        producto.tipo,
        producto.categoriaDescripcion,
        producto.subcategoriaDescripcion,
        producto.tarifaDescripcion,
      ].some((value) => normalizeText(value).includes(term)))
      .slice(0, 20)
      .map(mapProductoToFacturaProducto);
  };

  const getUsableFacturaProductos = (items: FacturaProducto[]) =>
    items.filter((producto) => {
      const descripcion = normalizeText(producto.descripcion);
      return Boolean(producto.codprincipal || producto.codauxiliar || (producto.codproducto && producto.codproducto > 0) || (descripcion && descripcion !== 'producto'));
    });

  const ensureFacturaProducto = (producto: FacturaProducto): FacturaProducto => ({
    ...producto,
    codproducto: producto.codproducto || 0,
    codprincipal: producto.codprincipal || producto.codauxiliar || null,
    descripcion: producto.descripcion || producto.codprincipal || producto.codauxiliar || 'Producto',
    precioUnitario: producto.precioUnitario ?? 0,
    tarifaIva: producto.tarifaIva ?? 0,
  });

  const searchFacturaClientes = async () => {
    if (!catalogUserId || !facturaForm.clienteBusqueda.trim()) return;
    setLoadingFacturas(true);
    setDirectoryMessage(null);
    try {
      setFacturaClientes(await buscarFacturaClientes(catalogUserId, facturaForm.clienteBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar clientes.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingFacturas(false);
    }
  };

  const searchFacturaProductos = async () => {
    if (!catalogUserId || !facturaForm.productoBusqueda.trim()) return;
    setLoadingFacturas(true);
    setDirectoryMessage(null);
    try {
      const remoteProductos = await buscarFacturaProductos(catalogUserId, facturaForm.productoBusqueda);
      const usableRemote = getUsableFacturaProductos(remoteProductos);
      setFacturaProductos(usableRemote.length > 0 ? usableRemote : searchLocalFacturaProductos(facturaForm.productoBusqueda));
    } catch (error) {
      const localProductos = searchLocalFacturaProductos(facturaForm.productoBusqueda);
      if (localProductos.length > 0) {
        setFacturaProductos(localProductos);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar productos.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingFacturas(false);
    }
  };

  const addFacturaProducto = (producto: FacturaProducto) => {
    const selectedProduct = ensureFacturaProducto(producto);
    if (!selectedProduct.descripcion?.trim()) {
      setDirectoryMessage({ type: 'error', text: 'El producto seleccionado no tiene datos completos.' });
      return;
    }
    setFacturaLineas((current) => [
      ...current,
      {
        producto: selectedProduct,
        cantidad: '1',
        precio: String(selectedProduct.precioUnitario ?? 0),
        descuento: '0',
        tarifa: String(selectedProduct.tarifaIva ?? 0),
        detalle: '',
      },
    ]);
    setFacturaProductos([]);
    setFacturaForm((current) => ({ ...current, productoBusqueda: '' }));
  };

  const updateFacturaLinea = (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => {
    setFacturaLineas((current) => current.map((linea, currentIndex) => currentIndex === index ? { ...linea, [field]: value } : linea));
  };

  const removeFacturaLinea = (index: number) => {
    setFacturaLineas((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const clearFacturaForm = () => {
    setFacturaForm(initialNuevaFacturaForm);
    setFacturaCliente(null);
    setFacturaClientes([]);
    setFacturaProductos([]);
    setFacturaLineas([]);
    setInvoiceDraftSaved(false);
    facturaRequestIdRef.current = null;
    if (catalogUserId) queueInvoiceDraftStorage(() => SecureStore.deleteItemAsync(`${INVOICE_DRAFT_KEY_PREFIX}.${catalogUserId}`));
    setDirectoryMessage(null);
  };

  const tryAuthorizeAfterSave = async (emit: () => Promise<{ estado?: string; mensaje?: string }>) => {
    try {
      return { sri: await emit(), failed: false };
    } catch (error) {
      return {
        sri: null,
        failed: true,
        error: error instanceof ApiError || error instanceof Error ? error.message : 'No se pudo confirmar la respuesta del SRI.',
      };
    }
  };

  const getSriEmissionMessage = (documentLabel: string, estado?: string, failed = false) => {
    const normalized = normalizeSriState(estado);
    if (failed) return `${documentLabel} guardada, pero no se pudo confirmar la respuesta del SRI.`;
    if (normalized === 'AUTORIZADO') return `${documentLabel} autorizada por el SRI.`;
    if (normalized === 'ANULADO') return `${documentLabel} anulada.`;
    if (normalized === 'ERROR') return `${documentLabel} presentó un error en el SRI.`;
    if (normalized === 'RECHAZADO') return `${documentLabel} rechazada por el SRI.`;
    return `${documentLabel} emitida, pendiente de autorización SRI.`;
  };

  const getSriMessageType = (estado?: string, failed = false): NonNullable<MessageState>['type'] => {
    const normalized = normalizeSriState(estado);
    if (failed || !normalized || normalized === 'PENDIENTE') return 'info';
    if (normalized === 'AUTORIZADO') return 'success';
    return normalized === 'RECHAZADO' || normalized === 'ERROR' ? 'error' : 'info';
  };

  const validateEmissionPrerequisites = async () => {
    const hasActiveEmitter = emisores.some((emisor) => emisor.estado !== false);
    const hasValidSignature = Object.values(firmaEstados).some((estado) => estado.esValida === true);
    if (loadingEmisores) return 'Espera a que termine la carga del emisor antes de emitir.';
    if (!hasActiveEmitter && !hasValidSignature) return 'No se puede emitir: configura un emisor activo y una firma electrónica válida y vigente.';
    if (!hasActiveEmitter) return 'No se puede emitir: configura un emisor activo antes de continuar.';
    if (loadingFirma) return 'Espera a que termine la validación de la firma electrónica.';
    if (!hasValidSignature) {
      return 'No se puede emitir: configura una firma electrónica válida y vigente.';
    }

    let documentosEstado = compraDocumentosEstado;
    if (!documentosEstado && catalogUserId) {
      try {
        documentosEstado = await getCompraDocumentosEstado(catalogUserId);
        setCompraDocumentosEstado(documentosEstado);
      } catch {
        return 'No se pudo verificar el saldo de documentos. Intenta nuevamente.';
      }
    }

    const saldoDocumentos = Number(documentosEstado?.saldoDocumentos);
    if (!getDocumentPlanStatus(documentosEstado).unlimited && (!Number.isFinite(saldoDocumentos) || saldoDocumentos < 1)) {
      return 'No se puede emitir: no tienes documentos disponibles. Compra o recarga documentos para continuar.';
    }

    return null;
  };

  const validateFacturaDraft = () => {
    const parse = parseDocumentNumber;
    const correoPrincipal = (facturaForm.correoPrincipal.trim() || facturaCliente?.correo?.trim() || '').toLowerCase();
    const correoAdicional = facturaForm.correoAdicional.trim().toLowerCase();
    const direccion = facturaForm.direccion.trim() || facturaCliente?.direccion?.trim() || '';

    if (!facturaForm.serie.trim()) return 'Selecciona una serie antes de emitir la factura.';
    const clienteError = facturaCliente ? validateDocumentClientFields(facturaForm, facturaCliente) : 'Selecciona un cliente para la factura.';
    if (clienteError) return clienteError;
    if (!direccion) return 'Ingresa la dirección del cliente antes de emitir la factura.';
    if (direccion.length > 100) return 'La dirección del cliente no puede superar 100 caracteres.';
    if (!facturaForm.formaPago.trim()) return 'Selecciona la forma de pago antes de emitir la factura.';
    if (correoPrincipal && !validateEmail(correoPrincipal).valid) return 'El correo principal no tiene un formato válido.';
    if (correoAdicional && !validateEmail(correoAdicional).valid) return 'El correo adicional no tiene un formato válido.';
    if (correoPrincipal && correoAdicional && correoPrincipal === correoAdicional) return 'El correo adicional debe ser diferente al correo principal.';
    if (facturaForm.referencia.trim().split(/\s+/).filter(Boolean).length > 100) return 'Las observaciones no pueden superar 100 palabras.';

    let total = 0;
    const allowedIva = getIvaOptions(facturaPreparacion).map((item) => item.value);
    for (const [index, linea] of facturaLineas.entries()) {
      const cantidad = parse(linea.cantidad);
      const precio = parse(linea.precio);
      const descuento = parse(linea.descuento);
      const tarifa = parse(linea.tarifa);
      const base = cantidad * precio;

      if (!linea.producto || linea.producto.codproducto <= 0) return `El producto de la línea ${index + 1} no es válido.`;
      if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isInteger(cantidad)) return `La cantidad de la línea ${index + 1} debe ser un número entero mayor que cero.`;
      if (!Number.isFinite(precio) || precio <= 0) return `El precio de la línea ${index + 1} debe ser mayor que cero.`;
      if (!Number.isFinite(descuento) || descuento < 0 || descuento > base) return `El descuento de la línea ${index + 1} no es válido.`;
      if (!Number.isFinite(tarifa) || tarifa < 0 || tarifa > 100) return `El IVA de la línea ${index + 1} no es válido.`;
      if (allowedIva.length > 0 && !allowedIva.includes(tarifa)) return `La tarifa de IVA de la línea ${index + 1} no está disponible.`;

      const subtotal = base - descuento;
      total += subtotal + subtotal * (tarifa / 100);
    }

    return total > 0 ? null : 'El total de la factura debe ser mayor que cero.';
  };

  const findFacturaSavedAfterTimeout = async (startedAt: number, expectedTotal: number, cliente: Cliente) => {
    const identificacion = normalizeText(cliente.numeroidentificacion);
    if (!identificacion) return null;
    const facturas = await getFacturas(catalogUserId ?? 0, 0);
    return facturas.find((factura) => {
      const fecha = factura.fechaEmision ? Date.parse(factura.fechaEmision) : NaN;
      const reciente = Number.isFinite(fecha) && fecha >= startedAt - 120000 && fecha <= Date.now() + 120000;
      return reciente && normalizeText(factura.identificacionCliente) === identificacion && Math.abs(Number(factura.total ?? 0) - expectedTotal) < 0.01;
    }) ?? null;
  };

  const showAuthorizationAlert = (documentLabel: string, destinationView: WorkspaceView, destinationLabel: string) => {
    Alert.alert(
      `${documentLabel} autorizada`,
      `Tu ${documentLabel.toLowerCase()} se ha autorizado correctamente por el SRI.`,
      [
        { text: 'Continuar en la vista', style: 'cancel' },
        { text: `Ir a ${destinationLabel}`, onPress: () => openView(destinationView) },
      ],
    );
  };

  const saveNuevaFactura = async () => {
    if (!catalogUserId || savingFacturaRef.current) return;
    if (!facturaCliente) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona un cliente para la factura.' });
      return;
    }
    if (facturaLineas.length === 0) {
      setDirectoryMessage({ type: 'error', text: 'Agrega al menos un producto o servicio.' });
      return;
    }
    const validationError = validateFacturaDraft();
    if (validationError) {
      setDirectoryMessage({ type: 'error', text: validationError });
      return;
    }
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    const parse = (value: string) => Number(value.replace(',', '.'));
    const expectedTotal = facturaLineas.reduce((sum, linea) => {
      const cantidad = parse(linea.cantidad);
      const precio = parse(linea.precio);
      const descuento = parse(linea.descuento);
      const tarifa = parse(linea.tarifa);
      const subtotal = cantidad * precio - descuento;
      return sum + subtotal + subtotal * (tarifa / 100);
    }, 0);
    const saveStartedAt = Date.now();
    const requestId = facturaRequestIdRef.current ?? `factura-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    facturaRequestIdRef.current = requestId;
    const correoPrincipal = (facturaForm.correoPrincipal.trim() || facturaCliente.correo?.trim() || '').toLowerCase();
    const correoAdicional = facturaForm.correoAdicional.trim().toLowerCase();
    const pendingRetry = pendingFacturaRetryRef.current;
    if (pendingRetry && pendingRetry.identificacion === normalizeText(facturaCliente.numeroidentificacion) && Math.abs(pendingRetry.expectedTotal - expectedTotal) < 0.01) {
      try {
        const facturaGuardada = await findFacturaSavedAfterTimeout(pendingRetry.startedAt, pendingRetry.expectedTotal, facturaCliente);
        if (facturaGuardada) {
          pendingFacturaRetryRef.current = null;
          clearFacturaForm();
          setDirectoryMessage({
            type: 'info',
            text: `La factura ${facturaGuardada.numeroCompleto ?? facturaGuardada.numfactura ?? ''} ya fue guardada. No la vuelvas a emitir.`.trim(),
          });
          setReloadKey((value) => value + 1);
          return;
        }
      } catch {
        setDirectoryMessage({ type: 'info', text: 'No se pudo confirmar el intento anterior. Verifica el historial antes de volver a emitir.' });
        return;
      }
      pendingFacturaRetryRef.current = null;
    }

    savingFacturaRef.current = true;
    setSavingFactura(true);
    setDirectoryMessage(null);
    try {
      const result = await guardarFactura({
        idUsuario: catalogUserId,
        requestId,
        cliente: {
          ...facturaCliente,
          tipoidentificacion: getTipoIdentificacionCode(facturaForm.tipoIdentificacion) || facturaCliente.tipoidentificacion || null,
          tipoCliente: Number(facturaForm.tipoCliente) || facturaCliente.tipoCliente || null,
          oblgconta: facturaForm.obligadoContabilidad.trim() || facturaCliente.oblgconta || null,
          direccion: facturaForm.direccion.trim() || facturaCliente.direccion || null,
          celular: facturaForm.telefono.trim() || facturaCliente.celular || null,
          correo: facturaForm.correoPrincipal.trim() || facturaCliente.correo || null,
        },
        serie: facturaForm.serie,
        codemisor: getSerieCodemisorFromOptions(getDocumentSerieOptions(facturaPreparacion, puntosData, 'factura'), facturaForm.serie, facturaPreparacion),
        formaPago: facturaForm.formaPago,
        referencia: facturaForm.referencia,
        correos: correoAdicional && correoAdicional !== correoPrincipal ? [correoAdicional] : [],
        detalles: facturaLineas.map((linea) => ({
          producto: linea.producto,
          cantidad: parse(linea.cantidad),
          precio: parse(linea.precio),
          descuento: parse(linea.descuento),
          tarifa: parse(linea.tarifa),
          detalle: linea.detalle,
        })),
      });
      clearFacturaForm();
      pendingFacturaRetryRef.current = null;
      const sriEstado = result.sri?.estado?.toUpperCase();
      setDirectoryMessage({
        type: getSriMessageType(sriEstado),
        text: `${result.mensaje ?? 'Factura guardada.'} ${result.numeroComprobante ?? ''} ${getSriEmissionMessage('Factura', sriEstado)}`.trim(),
      });
      setReloadKey((value) => value + 1);
      if (sriEstado === 'AUTORIZADO') {
        showAuthorizationAlert('Factura', 'mis-facturas', 'Mis Facturas');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        pendingFacturaRetryRef.current = {
          startedAt: saveStartedAt,
          expectedTotal,
          identificacion: normalizeText(facturaCliente.numeroidentificacion),
        };
        try {
          const facturaGuardada = await findFacturaSavedAfterTimeout(saveStartedAt, expectedTotal, facturaCliente);
          if (facturaGuardada) {
            pendingFacturaRetryRef.current = null;
            clearFacturaForm();
            setDirectoryMessage({
              type: 'info',
              text: `La factura ${facturaGuardada.numeroCompleto ?? facturaGuardada.numfactura ?? ''} ya fue guardada. No la vuelvas a emitir.`.trim(),
            });
            setReloadKey((value) => value + 1);
            return;
          }
        } catch {
          // Se conserva el error original si la consulta de confirmación también falla.
        }
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la factura.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      savingFacturaRef.current = false;
      setSavingFactura(false);
    }
  };

  const getDocumentAssetUrl = (response: { url?: string | null } | string) => {
    const value = typeof response === 'string' ? response : response.url;
    if (!value) return '';
    return value.startsWith('http') ? value : `${API_BASE_URL.replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
  };

  const openFacturaAsset = async (loader: () => Promise<{ url?: string | null } | string>) => {
    try {
      const response = await loader();
      const url = getDocumentAssetUrl(response);
      if (!url) throw new Error('empty-url');
      await Linking.openURL(url);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo abrir el documento.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const sendFacturaCorreo = async (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarFacturaCorreo(catalogUserId, factura.codfactura);
      setDirectoryMessage({ type: 'success', text: 'Correo enviado correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo enviar el correo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const confirmAnularFactura = (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    Alert.alert('Anular factura', `Deseas anular ${factura.numeroCompleto ?? factura.numfactura ?? 'esta factura'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await anularFactura(catalogUserId, factura.codfactura);
            setDirectoryMessage({ type: 'success', text: 'Factura anulada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo anular la factura.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const updateNotaCreditoForm = (field: keyof NotaCreditoFormState, value: string) => {
    setNotaCreditoForm((current) => ({ ...current, [field]: value }));
  };

  const fillNotaCreditoCliente = (cliente: Cliente) => {
    setNotaCreditoCliente(cliente);
    setNotaCreditoClientes([]);
    setNotaCreditoForm((current) => ({
      ...current,
      clienteBusqueda: getClienteDisplayName(cliente),
      correoPrincipal: getClienteEmail(cliente),
      tipoIdentificacion: getTipoIdentificacionLabel(cliente.tipoidentificacion),
      numeroIdentificacion: getClienteIdentification(cliente),
      tipoCliente: String(cliente.tipoCliente ?? ''),
      obligadoContabilidad: cliente.oblgconta ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.celular || cliente.telefonoconvencional || '',
    }));
  };

  const searchNotaCreditoClientes = async () => {
    if (!catalogUserId || !notaCreditoForm.clienteBusqueda.trim()) return;
    setLoadingNotasCredito(true);
    setDirectoryMessage(null);
    try {
      setNotaCreditoClientes(await buscarFacturaClientes(catalogUserId, notaCreditoForm.clienteBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar clientes.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingNotasCredito(false);
    }
  };

  const searchNotaCreditoFacturas = async () => {
    if (!catalogUserId || !notaCreditoForm.facturaBusqueda.trim()) return;
    setLoadingNotasCredito(true);
    setDirectoryMessage(null);
    try {
      setNotaCreditoFacturas(await buscarNotaCreditoFacturas(catalogUserId, notaCreditoForm.facturaBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar facturas.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingNotasCredito(false);
    }
  };

  const selectNotaCreditoFactura = async (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    const cliente = buildClienteFromFactura(factura);
    setNotaCreditoFactura(factura);
    setNotaCreditoCliente(cliente);
    setNotaCreditoLineas([]);
    setNotaCreditoFacturas([]);
    setNotaCreditoForm((current) => ({
      ...current,
      facturaBusqueda: factura.numeroCompleto ?? factura.numfactura ?? '',
      clienteBusqueda: getClienteDisplayName(cliente),
      correoPrincipal: getClienteEmail(cliente),
      tipoIdentificacion: getTipoIdentificacionLabel(cliente.tipoidentificacion),
      numeroIdentificacion: getClienteIdentification(cliente),
      tipoCliente: String(cliente.tipoCliente ?? ''),
      obligadoContabilidad: cliente.oblgconta ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.celular || cliente.telefonoconvencional || '',
    }));

    try {
      const detalle = await getFacturaDetalle(catalogUserId, factura.codfactura);
      const facturaCompleta = mergeFacturaDetalle(factura, detalle.factura);
      const clienteCompleto = buildClienteFromFactura(facturaCompleta, detalle.cliente, detalle.factura);
      const detallesDisponibles = await getNotaCreditoDetallesDisponibles(catalogUserId, factura.codfactura);
      const detalleRows = detallesDisponibles;
      setNotaCreditoFactura(facturaCompleta);
      setNotaCreditoCliente(clienteCompleto);
      setNotaCreditoForm((current) => ({
        ...current,
        facturaBusqueda: facturaCompleta.numeroCompleto ?? facturaCompleta.numfactura ?? '',
        clienteBusqueda: getClienteDisplayName(clienteCompleto),
        correoPrincipal: getClienteEmail(clienteCompleto),
        tipoIdentificacion: getTipoIdentificacionLabel(clienteCompleto.tipoidentificacion),
        numeroIdentificacion: getClienteIdentification(clienteCompleto),
        tipoCliente: String(clienteCompleto.tipoCliente ?? ''),
        obligadoContabilidad: clienteCompleto.oblgconta ?? '',
        direccion: clienteCompleto.direccion ?? '',
        telefono: clienteCompleto.celular || clienteCompleto.telefonoconvencional || '',
      }));
      setNotaCreditoLineas(detalleRows.map((row) => detalleFacturaToNotaCreditoLinea(row as Record<string, unknown>)));
      if (detalleRows.length === 0) {
        setDirectoryMessage({ type: 'info', text: 'La factura no tiene cantidades disponibles para generar una nota de crédito.' });
      }
    } catch (error) {
      setNotaCreditoLineas([]);
      const text = error instanceof ApiError ? error.message : 'No se pudo cargar el detalle completo de la factura.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const retryFacturaSri = async (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    if (factura.autorizado || normalizeSriState(factura.estadoSri) === 'AUTORIZADO') {
      setDirectoryMessage({ type: 'info', text: 'Esta factura ya fue autorizada por el SRI y no se puede volver a emitir.' });
      return;
    }
    try {
      const result = await reintentarFacturaSri(catalogUserId, factura.codfactura);
      const estado = normalizeSriState(result.estado);
      setDirectoryMessage({ type: getSriMessageType(estado), text: result.mensaje?.trim() || getSriEmissionMessage('Factura', estado) });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Factura', 'mis-facturas', 'Mis Facturas');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo reintentar la emision de la factura.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const updateNotaCreditoLinea = (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => {
    setNotaCreditoLineas((current) => current.map((linea, currentIndex) => currentIndex === index ? { ...linea, [field]: value } : linea));
  };

  const removeNotaCreditoLinea = (index: number) => {
    setNotaCreditoLineas((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const clearNotaCreditoForm = () => {
    setNotaCreditoForm(initialNotaCreditoForm);
    setNotaCreditoFactura(null);
    setNotaCreditoCliente(null);
    setNotaCreditoClientes([]);
    setNotaCreditoFacturas([]);
    setNotaCreditoLineas([]);
    setDirectoryMessage(null);
  };

  const emitirNotaCreditoAutomaticaDesdeFactura = async (factura: FacturaListItem) => {
    if (!catalogUserId || processingNotaCreditoAutomatica) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    setProcessingNotaCreditoAutomatica(true);
    setDirectoryMessage({ type: 'info', text: 'Generando y autorizando la nota de credito automatica...' });
    try {
      const result = await emitirNotaCreditoAutomatica(catalogUserId, factura.codfactura);
      if (!result.success) {
        setDirectoryMessage({ type: 'error', text: result.message || 'No se pudo emitir la nota de credito automatica.' });
        return;
      }

      const estadoSri = normalizeSriState(result.estadoSri || (result.autorizada ? 'AUTORIZADO' : undefined));
      setDirectoryMessage({
        type: getSriMessageType(estadoSri),
        text: [
          result.message || 'Nota de credito automatica procesada.',
          result.numeroCompleto || result.numeroNotaCredito ? `NC: ${result.numeroCompleto || result.numeroNotaCredito}` : '',
          getSriEmissionMessage('Nota de crédito', estadoSri),
          result.numeroAutorizacion ? `Autorizacion: ${result.numeroAutorizacion}` : '',
        ].filter(Boolean).join(' '),
      });
      setReloadKey((value) => value + 1);
      if (estadoSri === 'AUTORIZADO') {
        showAuthorizationAlert('Nota de credito', 'mis-notas-credito', 'Mis Notas de Credito');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0 && error.message.includes('tardo demasiado')) {
        setDirectoryMessage({
          type: 'info',
          text: 'La solicitud tardó más de lo esperado. La nota de crédito puede seguir procesándose; no la vuelvas a emitir y revisa Mis notas de crédito en unos instantes.',
        });
        setReloadKey((value) => value + 1);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo emitir la nota de credito automatica.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setProcessingNotaCreditoAutomatica(false);
    }
  };

  const openFacturaCuentasCobrar = (factura: FacturaListItem) => {
    setSearch(factura.numeroCompleto ?? factura.numfactura ?? '');
    setActiveView('cuentas-cobrar');
  };

  const saveNuevaNotaCredito = async () => {
    if (!catalogUserId) return;
    if (!notaCreditoFactura) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona la factura que será modificada para generar la nota de crédito.' });
      return;
    }
    const facturaParaGuardar = notaCreditoFactura;
    if (!notaCreditoCliente) {
      setDirectoryMessage({ type: 'error', text: 'No se pudo cargar el cliente de la factura seleccionada. Vuelve a seleccionarla.' });
      return;
    }
    if (notaCreditoLineas.length === 0) {
      setDirectoryMessage({ type: 'error', text: 'Agrega al menos un detalle para la nota de credito.' });
      return;
    }

    if (!notaCreditoForm.serie.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona una serie antes de emitir la nota de crédito.' });
      return;
    }
    const clienteError = validateDocumentClientFields(notaCreditoForm, notaCreditoCliente);
    if (clienteError) {
      setDirectoryMessage({ type: 'error', text: clienteError });
      return;
    }
    if (!['Anular operaciones', 'Devolucion parcial', 'Descuento o bonificacion', 'Correccion de valores'].includes(notaCreditoForm.motivo.trim())) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona un motivo válido para la nota de crédito.' });
      return;
    }
    if (notaCreditoForm.observacion.length > 250) {
      setDirectoryMessage({ type: 'error', text: 'La observación no puede superar 250 caracteres.' });
      return;
    }

    const parse = parseDocumentNumber;
    const correoPrincipal = (notaCreditoForm.correoPrincipal.trim() || notaCreditoCliente.correo?.trim() || '').toLowerCase();
    const correoAdicional = notaCreditoForm.correoAdicional.trim().toLowerCase();
    if (correoPrincipal && !validateEmail(correoPrincipal).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo principal de la nota de crédito no tiene un formato válido.' });
      return;
    }
    if (correoAdicional && !validateEmail(correoAdicional).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional de la nota de crédito no tiene un formato válido.' });
      return;
    }
    if (correoPrincipal && correoPrincipal === correoAdicional) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional debe ser diferente al correo principal.' });
      return;
    }

    const detalles = notaCreditoLineas.map((linea) => {
      const cantidad = parse(linea.cantidad);
      const precio = parse(linea.precio);
      const descuento = parse(linea.descuento);
      const tarifa = parse(linea.tarifa);
      return {
        linea,
        cantidad,
        precio,
        descuento,
        tarifa,
        total: Math.max(cantidad * precio - descuento, 0) * (1 + tarifa / 100),
      };
    });
    const allowedIva = getIvaOptions(notaCreditoPreparacion).map((option) => option.value);
    for (const [index, item] of detalles.entries()) {
      const disponible = item.linea.cantidadDisponible === undefined ? null : parse(item.linea.cantidadDisponible);
      if (!item.linea.producto.codproducto || item.linea.producto.codproducto <= 0) {
        setDirectoryMessage({ type: 'error', text: `La línea ${index + 1} no corresponde a un detalle válido de la factura original.` });
        return;
      }
      if (disponible !== null && (!Number.isFinite(disponible) || item.cantidad > disponible)) {
        setDirectoryMessage({ type: 'error', text: `La cantidad de la línea ${index + 1} supera la disponible en la factura original.` });
        return;
      }
      const fiscalError = validateFiscalLine({
        quantity: item.cantidad,
        price: item.precio,
        discount: item.descuento,
        iva: item.tarifa,
        allowedIva: allowedIva.length > 0 ? allowedIva : undefined,
        requireIntegerQuantity: true,
      });
      if (fiscalError) {
        setDirectoryMessage({ type: 'error', text: `La línea ${index + 1}: ${fiscalError}` });
        return;
      }
    }
    const totalError = validatePositiveTotal(detalles.reduce((sum, item) => sum + item.total, 0), 'la nota de crédito');
    if (totalError) {
      setDirectoryMessage({ type: 'error', text: totalError });
      return;
    }
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    const clienteParaGuardar: Cliente = {
      ...notaCreditoCliente,
      nombrerazonsocial: notaCreditoForm.clienteBusqueda.trim() || notaCreditoCliente.nombrerazonsocial || null,
      tipoidentificacion: getTipoIdentificacionCode(notaCreditoForm.tipoIdentificacion) || notaCreditoCliente.tipoidentificacion || null,
      numeroidentificacion: notaCreditoForm.numeroIdentificacion.trim() || notaCreditoCliente.numeroidentificacion || null,
      tipoCliente: Number(notaCreditoForm.tipoCliente) || notaCreditoCliente.tipoCliente || null,
      oblgconta: notaCreditoForm.obligadoContabilidad.trim() || notaCreditoCliente.oblgconta || null,
      direccion: notaCreditoForm.direccion.trim() || notaCreditoCliente.direccion || null,
      celular: notaCreditoForm.telefono.trim() || notaCreditoCliente.celular || null,
      correo: correoPrincipal || notaCreditoCliente.correo || null,
    };

    setSavingNotaCredito(true);
    setDirectoryMessage(null);
    try {
      const result = await guardarNotaCredito({
        idUsuario: catalogUserId,
        cliente: clienteParaGuardar,
        facturaModificada: facturaParaGuardar,
        serie: notaCreditoForm.serie,
        codemisor: getSerieCodemisorFromOptions(getDocumentSerieOptions(notaCreditoPreparacion, puntosData, 'notaCredito'), notaCreditoForm.serie, notaCreditoPreparacion),
        motivo: notaCreditoForm.motivo,
        observacion: notaCreditoForm.observacion,
        correos: correoAdicional ? [correoAdicional] : [],
        detalles: detalles.map((item) => ({
          producto: item.linea.producto,
          cantidad: item.cantidad,
          precio: item.precio,
          descuento: item.descuento,
          tarifa: item.tarifa,
          detalle: item.linea.detalle,
        })),
      });
      const secNotaCredito = result.codNotaCredito ?? result.sec;
      const sriResult = secNotaCredito
        ? await tryAuthorizeAfterSave(() => emitirNotaCredito(catalogUserId, secNotaCredito))
        : { sri: null, failed: true };
      clearNotaCreditoForm();
      setDirectoryMessage({
        type: getSriMessageType(sriResult.sri?.estado, sriResult.failed),
        text: `${result.mensaje ?? 'Nota de credito guardada.'} ${getSriEmissionMessage('Nota de crédito', sriResult.sri?.estado, sriResult.failed)}`.trim(),
      });
      setReloadKey((value) => value + 1);
      if (!sriResult.failed && sriResult.sri?.estado?.toUpperCase() === 'AUTORIZADO') {
        showAuthorizationAlert('Nota de credito', 'mis-notas-credito', 'Mis Notas de Credito');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la nota de credito.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingNotaCredito(false);
    }
  };

  const sendNotaCreditoCorreo = async (nota: NotaCreditoListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarNotaCreditoCorreo(catalogUserId, nota.codNotaCredito);
      setDirectoryMessage({ type: 'success', text: 'Correo enviado correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo enviar el correo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const emitNotaCreditoSri = async (nota: NotaCreditoListItem) => {
    if (!catalogUserId) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    try {
      const result = await emitirNotaCredito(catalogUserId, nota.codNotaCredito);
      const estado = normalizeSriState(result.estado);
      setDirectoryMessage({ type: getSriMessageType(estado), text: result.mensaje?.trim() || getSriEmissionMessage('Nota de crédito', estado) });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Nota de credito', 'mis-notas-credito', 'Mis Notas de Credito');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo emitir la nota de credito.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const confirmAnularNotaCredito = (nota: NotaCreditoListItem) => {
    if (!catalogUserId) return;
    Alert.alert('Anular nota de credito', `Deseas anular ${nota.numeroNota ?? 'esta nota de credito'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await anularNotaCredito(catalogUserId, nota.codNotaCredito);
            setNotasCreditoList((current) => current.map((item) => item.codNotaCredito === nota.codNotaCredito
              ? { ...item, estado: false, estadoSri: 'ANULADO' }
              : item));
            setDirectoryMessage({ type: 'success', text: 'Nota de credito anulada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo anular la nota de credito.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const updateNotaDebitoForm = (field: keyof NotaDebitoFormState, value: string) => {
    setNotaDebitoForm((current) => ({ ...current, [field]: value }));
  };

  const searchNotaDebitoFacturas = async () => {
    if (!catalogUserId || !notaDebitoForm.facturaBusqueda.trim()) return;
    setLoadingNotasDebito(true);
    setDirectoryMessage(null);
    try {
      setNotaDebitoFacturas(await buscarNotaDebitoFacturas(catalogUserId, notaDebitoForm.facturaBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar facturas.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingNotasDebito(false);
    }
  };

  const selectNotaDebitoFactura = async (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    const cliente = buildClienteFromFactura(factura);
    setNotaDebitoFactura(factura);
    setNotaDebitoCliente(cliente);
    setNotaDebitoFacturas([]);
    setNotaDebitoForm((current) => ({
      ...current,
      facturaBusqueda: factura.numeroCompleto ?? factura.numfactura ?? '',
      clienteBusqueda: getClienteDisplayName(cliente),
      correoPrincipal: getClienteEmail(cliente),
      tipoIdentificacion: getTipoIdentificacionLabel(cliente.tipoidentificacion),
      numeroIdentificacion: getClienteIdentification(cliente),
      tipoCliente: String(cliente.tipoCliente ?? ''),
      obligadoContabilidad: cliente.oblgconta ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.celular || cliente.telefonoconvencional || '',
    }));

    try {
      const detalle = await getFacturaDetalle(catalogUserId, factura.codfactura);
      const facturaCompleta = mergeFacturaDetalle(factura, detalle.factura);
      const clienteCompleto = buildClienteFromFactura(facturaCompleta, detalle.cliente, detalle.factura);
      setNotaDebitoFactura(facturaCompleta);
      setNotaDebitoCliente(clienteCompleto);
      setNotaDebitoForm((current) => ({
        ...current,
        facturaBusqueda: facturaCompleta.numeroCompleto ?? facturaCompleta.numfactura ?? '',
        clienteBusqueda: getClienteDisplayName(clienteCompleto),
        correoPrincipal: getClienteEmail(clienteCompleto),
        tipoIdentificacion: getTipoIdentificacionLabel(clienteCompleto.tipoidentificacion),
        numeroIdentificacion: getClienteIdentification(clienteCompleto),
        tipoCliente: String(clienteCompleto.tipoCliente ?? ''),
        obligadoContabilidad: clienteCompleto.oblgconta ?? '',
        direccion: clienteCompleto.direccion ?? '',
        telefono: clienteCompleto.celular || clienteCompleto.telefonoconvencional || '',
      }));
      setNotaDebitoLineas([initialNotaDebitoLinea]);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo cargar el detalle completo de la factura.';
      setDirectoryMessage({ type: 'info', text });
    }
  };

  const openKnownDocumentAsset = async (urlOrPath?: string | null) => {
    if (!urlOrPath) {
      setDirectoryMessage({ type: 'error', text: 'No se encontro la ruta del documento.' });
      return;
    }

    try {
      await Linking.openURL(getDocumentAssetUrl(urlOrPath));
    } catch {
      setDirectoryMessage({ type: 'error', text: 'No se pudo abrir el documento.' });
    }
  };

  const importNotaCreditoXml = async (uri: string) => {
    try {
      const parsed = parseFacturaXml(await FileSystem.readAsStringAsync(uri));
      if (!parsed) {
        setDirectoryMessage({ type: 'error', text: 'No se pudo leer la informacion de la factura en el XML.' });
        return;
      }
      setNotaCreditoFactura(parsed.factura);
      setNotaCreditoCliente(parsed.cliente);
      setNotaCreditoFacturas([]);
      setNotaCreditoLineas(parsed.detalles.length ? parsed.detalles : []);
      setNotaCreditoForm((current) => ({
        ...current,
        facturaBusqueda: parsed.factura.numeroCompleto ?? parsed.factura.numfactura ?? '',
        clienteBusqueda: getClienteDisplayName(parsed.cliente),
        correoPrincipal: getClienteEmail(parsed.cliente),
        tipoIdentificacion: getTipoIdentificacionLabel(parsed.cliente.tipoidentificacion),
        numeroIdentificacion: getClienteIdentification(parsed.cliente),
        tipoCliente: String(parsed.cliente.tipoCliente ?? ''),
        obligadoContabilidad: parsed.cliente.oblgconta ?? '',
        direccion: parsed.cliente.direccion ?? '',
        telefono: parsed.cliente.celular || parsed.cliente.telefonoconvencional || '',
      }));
      setDirectoryMessage({ type: 'success', text: 'XML cargado correctamente. Revisa los datos antes de guardar.' });
    } catch {
      setDirectoryMessage({ type: 'error', text: 'No se pudo procesar el XML seleccionado.' });
    }
  };

  const importNotaDebitoXml = async (uri: string) => {
    try {
      const parsed = parseFacturaXml(await FileSystem.readAsStringAsync(uri));
      if (!parsed) {
        setDirectoryMessage({ type: 'error', text: 'No se pudo leer la informacion de la factura en el XML.' });
        return;
      }
      setNotaDebitoFactura(parsed.factura);
      setNotaDebitoCliente(parsed.cliente);
      setNotaDebitoFacturas([]);
      setNotaDebitoLineas([initialNotaDebitoLinea]);
      setNotaDebitoForm((current) => ({
        ...current,
        facturaBusqueda: parsed.factura.numeroCompleto ?? parsed.factura.numfactura ?? '',
        clienteBusqueda: getClienteDisplayName(parsed.cliente),
        correoPrincipal: getClienteEmail(parsed.cliente),
        tipoIdentificacion: getTipoIdentificacionLabel(parsed.cliente.tipoidentificacion),
        numeroIdentificacion: getClienteIdentification(parsed.cliente),
        tipoCliente: String(parsed.cliente.tipoCliente ?? ''),
        obligadoContabilidad: parsed.cliente.oblgconta ?? '',
        direccion: parsed.cliente.direccion ?? '',
        telefono: parsed.cliente.celular || parsed.cliente.telefonoconvencional || '',
      }));
      setDirectoryMessage({ type: 'success', text: 'XML cargado correctamente. Revisa los datos antes de guardar.' });
    } catch {
      setDirectoryMessage({ type: 'error', text: 'No se pudo procesar el XML seleccionado.' });
    }
  };

  const updateNotaDebitoLinea = (index: number, field: keyof NotaDebitoLinea, value: string) => {
    setNotaDebitoLineas((current) => current.map((linea, currentIndex) => currentIndex === index ? { ...linea, [field]: value } : linea));
  };

  const clearNotaDebitoForm = () => {
    setNotaDebitoForm(initialNotaDebitoForm);
    setNotaDebitoFactura(null);
    setNotaDebitoCliente(null);
    setNotaDebitoFacturas([]);
    setNotaDebitoLineas([initialNotaDebitoLinea]);
    pendingNotaDebitoRetryRef.current = null;
    setDirectoryMessage(null);
  };

  const saveNuevaNotaDebito = async () => {
    if (!catalogUserId || savingNotaDebito) return;
    if (pendingNotaDebitoRetryRef.current) {
      Alert.alert(
        'Nota de debito posiblemente guardada',
        'La solicitud anterior tardo demasiado. Revisa el historial antes de volver a emitir para evitar duplicados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver historial', onPress: () => { pendingNotaDebitoRetryRef.current = null; openView('mis-notas-debito'); } },
          { text: 'Emitir otra vez', style: 'destructive', onPress: () => { pendingNotaDebitoRetryRef.current = null; void saveNuevaNotaDebito(); } },
        ],
      );
      return;
    }
    if (!notaDebitoFactura) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona la factura autorizada que será modificada.' });
      return;
    }
    if (!notaDebitoCliente) {
      setDirectoryMessage({ type: 'error', text: 'No se pudo cargar el cliente de la factura seleccionada.' });
      return;
    }
    if (notaDebitoLineas.length === 0) {
      setDirectoryMessage({ type: 'error', text: 'Agrega al menos un motivo para la nota de debito.' });
      return;
    }

    if (!notaDebitoForm.serie.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona una serie antes de emitir la nota de débito.' });
      return;
    }
    const clienteError = validateDocumentClientFields(notaDebitoForm, notaDebitoCliente);
    if (clienteError) {
      setDirectoryMessage({ type: 'error', text: clienteError });
      return;
    }
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    const parse = parseDocumentNumber;
    const correoPrincipal = (notaDebitoForm.correoPrincipal.trim() || notaDebitoCliente.correo?.trim() || '').toLowerCase();
    const correoAdicional = notaDebitoForm.correoAdicional.trim().toLowerCase();
    if (correoPrincipal && !validateEmail(correoPrincipal).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo principal no tiene un formato válido.' });
      return;
    }
    if (correoAdicional && !validateEmail(correoAdicional).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional no tiene un formato válido.' });
      return;
    }
    if (correoPrincipal && correoPrincipal === correoAdicional) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional debe ser diferente al principal.' });
      return;
    }

    const clienteParaGuardar: Cliente = {
      ...notaDebitoCliente,
      nombrerazonsocial: notaDebitoForm.clienteBusqueda.trim() || notaDebitoCliente.nombrerazonsocial || null,
      tipoidentificacion: getTipoIdentificacionCode(notaDebitoForm.tipoIdentificacion) || notaDebitoCliente.tipoidentificacion || null,
      numeroidentificacion: notaDebitoForm.numeroIdentificacion.trim() || notaDebitoCliente.numeroidentificacion || null,
      tipoCliente: Number(notaDebitoForm.tipoCliente) || notaDebitoCliente.tipoCliente || null,
      oblgconta: notaDebitoForm.obligadoContabilidad.trim() || notaDebitoCliente.oblgconta || null,
      direccion: notaDebitoForm.direccion.trim() || notaDebitoCliente.direccion || null,
      celular: notaDebitoForm.telefono.trim() || notaDebitoCliente.celular || null,
      correo: correoPrincipal || notaDebitoCliente.correo || null,
    };
    if (!clienteParaGuardar.numeroidentificacion || !clienteParaGuardar.direccion || !clienteParaGuardar.oblgconta) {
      setDirectoryMessage({ type: 'error', text: 'Completa identificacion, direccion y obligado a llevar contabilidad del cliente.' });
      return;
    }

    const detalles = notaDebitoLineas.map((linea) => ({
      linea,
      precio: parse(linea.precio),
      tarifa: parse(linea.tarifa),
      valorIce: parse(linea.valorIce),
    }));
    const configuredIva = getIvaOptions(notaDebitoPreparacion).map((option) => option.value);
    const allowedIva = configuredIva.length > 0 ? configuredIva : [0, 5, 8, 12, 13, 14, 15];
    for (const [index, item] of detalles.entries()) {
      if (!item.linea.descripcion.trim()) {
        setDirectoryMessage({ type: 'error', text: `Ingresa la descripcion del motivo ${index + 1}.` });
        return;
      }
      if (item.linea.descripcion.trim().length > 300) {
        setDirectoryMessage({ type: 'error', text: `La descripcion del motivo ${index + 1} no puede superar 300 caracteres.` });
        return;
      }
       const fiscalError = validateFiscalLine({
         price: item.precio,
         iva: item.tarifa,
          allowedIva,
         ice: item.valorIce,
       });
       if (fiscalError) {
         setDirectoryMessage({ type: 'error', text: `El motivo ${index + 1}: ${fiscalError}` });
         return;
       }
     }
    const totalNotaDebito = detalles.reduce((sum, item) => sum + item.precio + item.valorIce + (item.precio + item.valorIce) * item.tarifa / 100, 0);
    const totalNotaDebitoError = validatePositiveTotal(totalNotaDebito, 'la nota de débito');
    if (totalNotaDebitoError) {
      setDirectoryMessage({ type: 'error', text: totalNotaDebitoError });
      return;
    }

    setSavingNotaDebito(true);
    setDirectoryMessage(null);
    const saveStartedAt = Date.now();
    try {
      const result = await guardarNotaDebito({
        idUsuario: catalogUserId,
        cliente: clienteParaGuardar,
        facturaModificada: notaDebitoFactura,
        serie: notaDebitoForm.serie,
        numeroNotaDebito: notaDebitoForm.numeroFactura,
        codemisor: getSerieCodemisorFromOptions(getDocumentSerieOptions(notaDebitoPreparacion, puntosData, 'notaDebito'), notaDebitoForm.serie, notaDebitoPreparacion),
        correos: correoAdicional ? [correoAdicional] : [],
        detalles: detalles.map((item) => ({
          descripcion: item.linea.descripcion.trim(),
          precio: item.precio,
          tarifa: item.tarifa,
          impuestoIce: item.linea.impuestoIce,
          valorIce: item.valorIce,
        })),
      });
      const secNotaDebito = result.codNotaDebito;
      pendingNotaDebitoRetryRef.current = null;
      const sriResult = secNotaDebito
        ? await tryAuthorizeAfterSave(() => emitirNotaDebito(catalogUserId, secNotaDebito))
        : { sri: null, failed: true };
      clearNotaDebitoForm();
      setDirectoryMessage({
        type: getSriMessageType(sriResult.sri?.estado, sriResult.failed),
        text: `${result.mensaje ?? 'Nota de debito guardada.'} ${getSriEmissionMessage('Nota de débito', sriResult.sri?.estado, sriResult.failed)}`.trim(),
      });
      setReloadKey((value) => value + 1);
      if (!sriResult.failed && sriResult.sri?.estado?.toUpperCase() === 'AUTORIZADO') {
        showAuthorizationAlert('Nota de debito', 'mis-notas-debito', 'Mis Notas de Debito');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        pendingNotaDebitoRetryRef.current = saveStartedAt;
        setDirectoryMessage({ type: 'info', text: 'La solicitud tardo mas de lo esperado. La nota puede haberse guardado; revisa el historial antes de volver a emitir.' });
        setReloadKey((value) => value + 1);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la nota de debito.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingNotaDebito(false);
    }
  };

  const sendNotaDebitoCorreo = async (nota: NotaDebitoListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarNotaDebitoCorreo(catalogUserId, nota.codNotaDebito);
      setDirectoryMessage({ type: 'success', text: 'Correo enviado correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo enviar el correo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const emitNotaDebitoSri = async (nota: NotaDebitoListItem) => {
    if (!catalogUserId) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    try {
      const result = await emitirNotaDebito(catalogUserId, nota.codNotaDebito);
      const estado = normalizeSriState(result.estado);
      setDirectoryMessage({ type: getSriMessageType(estado), text: result.mensaje?.trim() || getSriEmissionMessage('Nota de débito', estado) });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Nota de debito', 'mis-notas-debito', 'Mis Notas de Debito');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo emitir la nota de debito.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const confirmAnularNotaDebito = (nota: NotaDebitoListItem) => {
    if (!catalogUserId) return;
    Alert.alert('Anular nota de debito', `Deseas anular ${nota.numeroNota ?? 'esta nota de debito'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await anularNotaDebito(catalogUserId, nota.codNotaDebito);
            setDirectoryMessage({ type: 'success', text: 'Nota de debito anulada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo anular la nota de debito.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const updateLiquidacionForm = (field: keyof LiquidacionCompraFormState, value: string) => {
    setLiquidacionForm((current) => ({ ...current, [field]: value }));
  };

  const searchLiquidacionProveedores = async () => {
    if (!catalogUserId || !liquidacionForm.clienteBusqueda.trim()) return;
    setLoadingLiquidaciones(true);
    setDirectoryMessage(null);
    try {
      setLiquidacionProveedores(await buscarLiquidacionProveedores(catalogUserId, liquidacionForm.clienteBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar proveedores.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingLiquidaciones(false);
    }
  };

  const searchLiquidacionProductos = async () => {
    if (!catalogUserId || !liquidacionForm.productoBusqueda.trim()) return;
    setLoadingLiquidaciones(true);
    setDirectoryMessage(null);
    try {
      const remoteProductos = await buscarLiquidacionProductos(catalogUserId, liquidacionForm.productoBusqueda);
      const usableRemote = getUsableFacturaProductos(remoteProductos);
      setLiquidacionProductos(usableRemote.length > 0 ? usableRemote : searchLocalFacturaProductos(liquidacionForm.productoBusqueda));
    } catch (error) {
      const localProductos = searchLocalFacturaProductos(liquidacionForm.productoBusqueda);
      if (localProductos.length > 0) {
        setLiquidacionProductos(localProductos);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar productos.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingLiquidaciones(false);
    }
  };

  const selectLiquidacionProveedor = (proveedor: Cliente) => {
    setLiquidacionProveedor(proveedor);
    setLiquidacionProveedores([]);
    setLiquidacionForm((current) => ({
      ...current,
      clienteBusqueda: getClienteDisplayName(proveedor),
      tipoIdentificacion: getTipoIdentificacionLabel(proveedor.tipoidentificacion),
      numeroIdentificacion: getClienteIdentification(proveedor),
      direccion: proveedor.direccion ?? '',
      telefono: proveedor.celular || proveedor.telefonoconvencional || '',
      correoPrincipal: getClienteEmail(proveedor),
    }));
  };

  const addLiquidacionProducto = (producto: FacturaProducto) => {
    const selectedProduct = ensureFacturaProducto(producto);
    setLiquidacionLineas((current) => [...current, {
      producto: selectedProduct,
      cantidad: '1',
      precio: String(selectedProduct.precioUnitario ?? 0),
      descuento: '0',
      tarifa: String(selectedProduct.tarifaIva ?? 15),
    }]);
    setLiquidacionProductos([]);
    setLiquidacionForm((current) => ({ ...current, productoBusqueda: '' }));
  };

  const updateLiquidacionLinea = (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => {
    setLiquidacionLineas((current) => current.map((linea, currentIndex) => currentIndex === index ? { ...linea, [field]: value } : linea));
  };

  const removeLiquidacionLinea = (index: number) => {
    setLiquidacionLineas((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const clearLiquidacionForm = () => {
    setLiquidacionForm(initialLiquidacionCompraForm);
    setLiquidacionProveedor(null);
    setLiquidacionProveedores([]);
    setLiquidacionProductos([]);
    setLiquidacionLineas([]);
    setDirectoryMessage(null);
  };

  const prepararRetencionLiquidacion = async (liquidacion: LiquidacionCompraListItem) => {
    const autorizado = liquidacion.autorizado || String(liquidacion.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
    if (!autorizado) {
      setDirectoryMessage({ type: 'error', text: 'La liquidacion debe estar autorizada por el SRI antes de generar la retencion.' });
      return;
    }
    if (liquidacion.retencionDisponible) {
      setDirectoryMessage({ type: 'info', text: 'La liquidacion seleccionada ya tiene una retencion registrada.' });
      return;
    }

    setLiquidacionRetencion(liquidacion);
    setLoadingLiquidacionRetencion(true);
    try {
      const [iva, renta, bases] = await Promise.all([
        getRetencionCatalogo('IVA'),
        getRetencionCatalogo('RENTA'),
        getLiquidacionCompraRetencionBases(catalogUserId, liquidacion.codLiquidacion),
      ]);
      setRetencionesIvaCatalogo(iva);
      setRetencionesRentaCatalogo(renta);
      setLiquidacionRetencion((current) => current ? {
        ...current,
        baseIva: bases.baseIva ?? current.iva,
        baseRenta: bases.baseRenta ?? current.base,
      } : current);
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudieron cargar los catalogos de retencion.' });
    } finally {
      setLoadingLiquidacionRetencion(false);
    }
  };

  const continuarRetencionLiquidacion = (liquidacion: LiquidacionCompraListItem) => {
    setActiveView('nueva-liquidacion-compra');
    void prepararRetencionLiquidacion(liquidacion);
  };

  const saveRetencionLiquidacion = async (retenciones: LiquidacionRetencionInput[]) => {
    if (!catalogUserId || !liquidacionRetencion) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    setSavingLiquidacionRetencion(true);
    setDirectoryMessage(null);
    try {
      const liquidacionGuardada = liquidacionRetencion;
      const result = await crearRetencionDesdeLiquidacion(catalogUserId, liquidacionGuardada.codLiquidacion, retenciones);
      const codRetencion = result.codRetencion;
      if (!codRetencion) throw new Error('No se encontro la retencion generada para emitirla al SRI.');

      setLiquidacionRetencion(null);
      setDirectoryMessage({ type: 'info', text: `Retencion ${result.numeroRetencion ?? 'generada'} de la liquidacion ${liquidacionGuardada.numero ?? liquidacionGuardada.codLiquidacion}. Enviandola al SRI...` });
      setReloadKey((value) => value + 1);
      await emitRetencionSri({ codRetencion });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo generar la retencion de la liquidacion.' });
    } finally {
      setSavingLiquidacionRetencion(false);
    }
  };

  const saveNuevaLiquidacion = async () => {
    if (!catalogUserId) return;
    if (!liquidacionProveedor) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona un proveedor para la liquidacion.' });
      return;
    }
    if (liquidacionLineas.length === 0) {
      setDirectoryMessage({ type: 'error', text: 'Agrega al menos un producto o servicio.' });
      return;
    }

    const parseDecimal = (value: string) => Number(value.replace(',', '.'));
    const detalles = liquidacionLineas.map((linea) => ({
      producto: linea.producto,
      cantidad: parseDecimal(linea.cantidad),
      precio: parseDecimal(linea.precio),
      descuento: parseDecimal(linea.descuento),
      tarifa: parseDecimal(linea.tarifa),
    }));
    const detalleInvalido = detalles.find((item) =>
      !Number.isFinite(item.cantidad) || item.cantidad <= 0 ||
      !Number.isFinite(item.precio) || item.precio <= 0 ||
      !Number.isFinite(item.descuento) || item.descuento < 0 || item.descuento > item.cantidad * item.precio ||
      !Number.isFinite(item.tarifa) || item.tarifa < 0,
    );
    if (detalleInvalido) {
      setDirectoryMessage({ type: 'error', text: 'Revisa cantidad, precio, descuento e IVA de cada detalle.' });
      return;
    }

    const correoPrincipal = liquidacionForm.correoPrincipal.trim();
    const correoAdicional = liquidacionForm.correoAdicional.trim();
    if (correoPrincipal && !validateEmail(correoPrincipal).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo del proveedor no tiene un formato valido.' });
      return;
    }
    if (correoAdicional && !validateEmail(correoAdicional).valid) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional no tiene un formato valido.' });
      return;
    }
    if (correoAdicional && correoPrincipal.toLowerCase() === correoAdicional.toLowerCase()) {
      setDirectoryMessage({ type: 'error', text: 'El correo adicional debe ser diferente al correo principal.' });
      return;
    }
    if (liquidacionForm.direccion.trim().length < 5 || liquidacionForm.direccion.trim().length > 100) {
      setDirectoryMessage({ type: 'error', text: 'La dirección del proveedor debe tener entre 5 y 100 caracteres.' });
      return;
    }
    if (liquidacionForm.telefono.trim() && !validarTelefono(liquidacionForm.telefono)) {
      setDirectoryMessage({ type: 'error', text: 'El teléfono del proveedor debe tener entre 7 y 15 dígitos.' });
      return;
    }
    if (!liquidacionForm.formaPago.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona una forma de pago.' });
      return;
    }
    if (liquidacionForm.numeroFactura.trim() && !/^\d{1,9}$/.test(liquidacionForm.numeroFactura.trim())) {
      setDirectoryMessage({ type: 'error', text: 'El secuencial debe contener solo numeros y tener hasta 9 digitos.' });
      return;
    }
    if (liquidacionForm.diasCredito.trim() && (!/^\d{1,3}$/.test(liquidacionForm.diasCredito.trim()) || Number(liquidacionForm.diasCredito) > 365)) {
      setDirectoryMessage({ type: 'error', text: 'Los días de crédito deben estar entre 0 y 365.' });
      return;
    }

    const total = detalles.reduce((sum, item) => {
      const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
      return sum + base + base * (item.tarifa / 100);
    }, 0);
    if (total <= 0) {
      setDirectoryMessage({ type: 'error', text: 'El total de la liquidacion debe ser mayor a cero.' });
      return;
    }
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }

    const proveedor = {
      ...liquidacionProveedor,
      direccion: liquidacionForm.direccion.trim(),
      celular: liquidacionForm.telefono.trim() || liquidacionProveedor.celular,
      correo: correoPrincipal || liquidacionProveedor.correo,
    };
    setSavingLiquidacion(true);
    setDirectoryMessage(null);
    try {
      const result = await guardarLiquidacionCompra({
        idUsuario: catalogUserId,
        proveedor,
        serie: liquidacionForm.serie,
        numero: liquidacionForm.numeroFactura,
        codemisor: getSerieCodemisorFromOptions(getDocumentSerieOptions(liquidacionPreparacion, puntosData, 'liquidacion'), liquidacionForm.serie, liquidacionPreparacion),
        formaPago: liquidacionForm.formaPago,
        diasCredito: Number(liquidacionForm.diasCredito) || 0,
        correos: correoAdicional ? [correoAdicional] : [],
        correosGuardar: correoAdicional ? [correoAdicional] : [],
        detalles: detalles.map((item) => ({
          ...item,
          codigoPorcentaje: getLiquidacionCodigoPorcentaje(item.producto, item.tarifa),
          detalle: liquidacionForm.detalleLinea,
        })),
      });
      const codLiquidacion = result.codLiquidacion;
      const sriResult = codLiquidacion
        ? await tryAuthorizeAfterSave(() => emitirLiquidacionCompra(catalogUserId, codLiquidacion))
        : { sri: null, failed: true };
      const ivaLiquidacion = detalles.reduce((sum, item) => {
        const base = Math.max(item.cantidad * item.precio - item.descuento, 0);
        return sum + base * (item.tarifa / 100);
      }, 0);
      const liquidacionAutorizada: LiquidacionCompraListItem = {
        codLiquidacion: codLiquidacion ?? 0,
        numero: liquidacionForm.numeroFactura || undefined,
        fecha: new Date().toISOString(),
        proveedor: getClienteDisplayName(proveedor),
        identificacionProveedor: proveedor.numeroidentificacion,
        estadoSri: 'AUTORIZADO',
        autorizado: true,
        base: Math.max(total - ivaLiquidacion, 0),
        iva: ivaLiquidacion,
        total,
      };
      clearLiquidacionForm();
      setDirectoryMessage({
        type: sriResult.failed ? 'info' : sriResult.sri?.estado?.toUpperCase() === 'AUTORIZADO' ? 'success' : 'info',
        text: `${result.mensaje ?? 'Liquidacion guardada.'} ${getSriEmissionMessage('Liquidación de compra', sriResult.sri?.estado, sriResult.failed)}`.trim(),
      });
      setReloadKey((value) => value + 1);
      if (!sriResult.failed && sriResult.sri?.estado?.toUpperCase() === 'AUTORIZADO') {
        void prepararRetencionLiquidacion(liquidacionAutorizada);
        Alert.alert(
          'Liquidacion autorizada',
          'La liquidacion fue autorizada por el SRI. Ya puedes continuar con la retencion.',
          [
            { text: 'Continuar con retencion', onPress: () => setActiveView('nueva-liquidacion-compra') },
            { text: 'Ir a Mis Liquidaciones', onPress: () => openView('mis-liquidaciones-compra') },
            { text: 'Ahora no', style: 'cancel' },
          ],
        );
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la liquidacion.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingLiquidacion(false);
    }
  };

  const sendLiquidacionCorreo = async (liquidacion: LiquidacionCompraListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarLiquidacionCompraCorreo(catalogUserId, liquidacion.codLiquidacion);
      setDirectoryMessage({ type: 'success', text: 'Correo enviado correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo enviar el correo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const emitLiquidacionSri = async (liquidacion: LiquidacionCompraListItem) => {
    if (!catalogUserId) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    try {
      const result = await emitirLiquidacionCompra(catalogUserId, liquidacion.codLiquidacion);
      const estado = normalizeSriState(result.estado);
      setDirectoryMessage({
        type: getSriMessageType(estado),
        text: result.mensaje?.trim() || getSriEmissionMessage('Liquidación de compra', estado),
      });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Liquidacion de compra', 'mis-liquidaciones-compra', 'Mis Liquidaciones');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo emitir la liquidacion.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const updateGuiaForm = (field: keyof GuiaRemisionFormState, value: string | boolean) => {
    setGuiaForm((current) => ({ ...current, [field]: value }));
  };

  const searchGuiaTransportistas = async () => {
    if (!catalogUserId || !guiaForm.transportistaBusqueda.trim()) return;
    setLoadingGuiaSearch(true);
    setDirectoryMessage(null);
    try {
      setGuiaTransportistas(await buscarGuiaTransportistas(catalogUserId, guiaForm.transportistaBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar transportistas.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingGuiaSearch(false);
    }
  };

  const searchGuiaClientes = async () => {
    if (!catalogUserId || !guiaForm.clienteBusquedaGuia.trim()) return;
    setLoadingGuiaSearch(true);
    setDirectoryMessage(null);
    try {
      setGuiaClientes(await buscarGuiaClientes(catalogUserId, guiaForm.clienteBusquedaGuia));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar clientes.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingGuiaSearch(false);
    }
  };

  const searchGuiaFacturas = async () => {
    if (!catalogUserId || !guiaForm.facturaBusqueda.trim()) return;
    setLoadingGuiaSearch(true);
    setDirectoryMessage(null);
    try {
      setGuiaFacturas(await buscarGuiaFacturas(catalogUserId, guiaForm.facturaBusqueda));
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar facturas.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingGuiaSearch(false);
    }
  };

  const searchGuiaProductos = async () => {
    if (!catalogUserId || !guiaForm.productoBusqueda.trim()) return;
    setLoadingGuiaSearch(true);
    setDirectoryMessage(null);
    try {
      const remoteProductos = await buscarGuiaProductos(catalogUserId, guiaForm.productoBusqueda);
      const usableRemote = getUsableFacturaProductos(remoteProductos);
      setGuiaProductos(usableRemote.length > 0 ? usableRemote : searchLocalFacturaProductos(guiaForm.productoBusqueda));
    } catch (error) {
      const localProductos = searchLocalFacturaProductos(guiaForm.productoBusqueda);
      if (localProductos.length > 0) {
        setGuiaProductos(localProductos);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo buscar productos.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setLoadingGuiaSearch(false);
    }
  };

  const selectGuiaTransportista = async (transportista: Cliente) => {
    const applyTransportista = (selected: Cliente) => {
      setGuiaTransportista(selected);
      setGuiaForm((current) => ({
        ...current,
        transportistaBusqueda: getClienteDisplayName(selected),
        tipoIdentificacion: getTipoIdentificacionLabel(selected.tipoidentificacion),
        numeroIdentificacion: getClienteIdentification(selected),
        direccion: selected.direccion ?? current.direccion,
        telefono: selected.celular || selected.telefonoconvencional || current.telefono,
        correoPrincipal: getClienteEmail(selected) || current.correoPrincipal,
      }));
    };

    applyTransportista(transportista);
    setGuiaTransportistas([]);
    const identificacion = getClienteIdentification(transportista).trim();
    if (!catalogUserId || !identificacion || transportista.direccion?.trim()) return;

    try {
      const detalle = await getGuiaTransportista(catalogUserId, identificacion);
      if (detalle) applyTransportista({
        ...transportista,
        ...detalle,
        nombrerazonsocial: detalle.nombrerazonsocial || transportista.nombrerazonsocial,
        numeroidentificacion: detalle.numeroidentificacion || transportista.numeroidentificacion,
        direccion: detalle.direccion || transportista.direccion,
      });
    } catch {
      // La selección original se mantiene; la validación mostrará el dato faltante.
    }
  };

  const selectGuiaCliente = (cliente: Cliente) => {
    setGuiaCliente(cliente);
    setGuiaClientes([]);
    setGuiaForm((current) => ({
      ...current,
      clienteBusquedaGuia: getClienteDisplayName(cliente),
      tipoIdentificacion: getTipoIdentificacionLabel(cliente.tipoidentificacion),
      numeroIdentificacion: getClienteIdentification(cliente),
      direccion: cliente.direccion ?? current.direccion,
      telefono: cliente.celular || cliente.telefonoconvencional || current.telefono,
      correoPrincipal: getClienteEmail(cliente) || current.correoPrincipal,
    }));
  };

  const selectGuiaFactura = async (factura: FacturaListItem) => {
    if (!catalogUserId) return;
    setGuiaFactura(factura);
    setGuiaDetalles([]);
    setGuiaFacturas([]);
    setGuiaForm((current) => ({ ...current, facturaBusqueda: factura.numeroCompleto ?? factura.numfactura ?? '', clienteBusquedaGuia: factura.cliente ?? current.clienteBusquedaGuia }));
    if (!guiaCliente && factura.cliente) {
      setGuiaCliente(buildClienteFromFactura(factura));
    }

    try {
      const detalle = await getFacturaDetalle(catalogUserId, factura.codfactura);
      const facturaCompleta = mergeFacturaDetalle(factura, detalle.factura);
      const cliente = buildClienteFromFactura(facturaCompleta, detalle.cliente, detalle.factura);
      setGuiaFactura(facturaCompleta);
      setGuiaCliente(cliente);
      setGuiaForm((current) => ({
        ...current,
        facturaBusqueda: facturaCompleta.numeroCompleto ?? facturaCompleta.numfactura ?? '',
        clienteBusquedaGuia: getClienteDisplayName(cliente),
        numeroIdentificacion: getClienteIdentification(cliente),
      }));
      if (detalle.detalles?.length) {
        setGuiaDetalles(detalle.detalles.map((row) => detalleFacturaToGuiaDetalle(row)));
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo cargar el detalle completo de la factura.';
      setDirectoryMessage({ type: 'info', text });
    }
  };

  const addGuiaProducto = (producto: FacturaProducto) => {
    if (guiaFactura) {
      setDirectoryMessage({ type: 'info', text: 'Al vincular una factura, los detalles se cargan desde esa factura.' });
      return;
    }
    setGuiaDetalles((current) => [...current, { producto: ensureFacturaProducto(producto), cantidad: '1' }]);
    setGuiaProductos([]);
    setGuiaForm((current) => ({ ...current, productoBusqueda: '' }));
  };

  const updateGuiaDetalle = (index: number, value: string) => {
    setGuiaDetalles((current) => current.map((detalle, currentIndex) => currentIndex === index ? { ...detalle, cantidad: value } : detalle));
  };

  const removeGuiaDetalle = (index: number) => {
    setGuiaDetalles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const clearGuiaForm = () => {
    setGuiaForm(initialGuiaRemisionForm);
    setGuiaTransportista(null);
    setGuiaCliente(null);
    setGuiaFactura(null);
    setGuiaTransportistas([]);
    setGuiaClientes([]);
    setGuiaFacturas([]);
    setGuiaProductos([]);
    setGuiaDetalles([]);
    pendingGuiaRetryRef.current = null;
    setDirectoryMessage(null);
  };

  const applySequenceNumberToForm = (form: SequencePromptState['form'], proximo: string) => {
    if (form === 'factura') setFacturaForm((current) => ({ ...current, numeroFactura: proximo }));
    if (form === 'notaCredito') setNotaCreditoForm((current) => ({ ...current, numeroFactura: proximo }));
    if (form === 'notaDebito') setNotaDebitoForm((current) => ({ ...current, numeroFactura: proximo }));
    if (form === 'liquidacion') setLiquidacionForm((current) => ({ ...current, numeroFactura: proximo }));
    if (form === 'guia') setGuiaForm((current) => ({ ...current, numeroFactura: proximo }));
  };

  const saveInitialSequence = async (input: { habiaGenerado: boolean; secuenciaAnterior: string }) => {
    if (!catalogUserId || !sequencePrompt) return;

    setSequencePromptSaving(true);
    setSequencePromptMessage(null);
    try {
      const response = await savePuntoEmisionSecuenciaInicial({
        userId: catalogUserId,
        documento: sequencePrompt.documento,
        serie: sequencePrompt.serie,
        codemisor: sequencePrompt.codemisor,
        habiaGenerado: input.habiaGenerado,
        secuenciaAnterior: input.secuenciaAnterior,
      });
      applySequenceNumberToForm(sequencePrompt.form, response.proximo?.trim() ?? '');
      setSequencePrompt(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la secuencia inicial.';
      setSequencePromptMessage(text);
    } finally {
      setSequencePromptSaving(false);
    }
  };

  const saveNuevaGuia = async () => {
    if (!catalogUserId) {
      setDirectoryMessage({ type: 'error', text: 'No se pudo identificar al usuario. Cierra sesión e ingresa nuevamente.' });
      return;
    }
    if (savingGuia) return;
    if (pendingGuiaRetryRef.current) {
      Alert.alert(
        'Guia posiblemente guardada',
        'La solicitud anterior tardo demasiado. Revisa el historial antes de volver a emitir para evitar duplicados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ver historial', onPress: () => { pendingGuiaRetryRef.current = null; openView('mis-guias-remision'); } },
          { text: 'Emitir otra vez', style: 'destructive', onPress: () => { pendingGuiaRetryRef.current = null; void saveNuevaGuia(); } },
        ],
      );
      return;
    }
    if (!guiaTransportista) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona un transportista para la guia.' });
      return;
    }
    if (!guiaCliente) {
      setDirectoryMessage({ type: 'error', text: 'Selecciona un destinatario con direccion valida.' });
      return;
    }
    const identificacionTransportista = getClienteIdentification(guiaTransportista).trim();
    const identificacionDestinatario = getClienteIdentification(guiaCliente).trim();
    const direccionTransportista = (guiaTransportista.direccion?.trim() || guiaForm.direccion.trim()).trim();
    if (!getClienteDisplayName(guiaTransportista).trim() || !identificacionTransportista || !direccionTransportista) {
      setDirectoryMessage({ type: 'error', text: 'Completa razon social, identificacion y direccion del transportista.' });
      return;
    }
    if (!getClienteDisplayName(guiaCliente).trim() || !identificacionDestinatario || !guiaCliente.direccion?.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa razon social, identificacion y direccion del destinatario.' });
      return;
    }
    if (!guiaForm.placa.trim() || !guiaForm.direccionOrigen.trim() || !guiaForm.referencia.trim()) {
      setDirectoryMessage({ type: 'error', text: 'Completa placa, direccion de origen y motivo de traslado.' });
      return;
    }
    if (!/^[A-Z]{2,3}[0-9]{3,4}$/i.test(guiaForm.placa.trim().replace(/[-\s]/g, ''))) {
      setDirectoryMessage({ type: 'error', text: 'La placa debe contener 2 o 3 letras y de 3 a 4 dígitos.' });
      return;
    }
    if (guiaForm.direccionOrigen.trim().length < 5 || guiaForm.direccionOrigen.trim().length > 300 || guiaForm.referencia.trim().length < 3 || guiaForm.referencia.trim().length > 300) {
      setDirectoryMessage({ type: 'error', text: 'Revisa las longitudes de dirección de origen y motivo de traslado.' });
      return;
    }
    const fechaError = validateDateRange(guiaForm.fechaInicioTraslado, guiaForm.fechaFinTraslado);
    if (!guiaForm.fechaEmision || fechaError) {
      setDirectoryMessage({ type: 'error', text: fechaError ?? 'Revisa la fecha de emisión.' });
      return;
    }
    if (guiaDetalles.length === 0) {
      setDirectoryMessage({ type: 'error', text: 'Agrega al menos un detalle de traslado.' });
      return;
    }
    if (guiaFactura && guiaFactura.codfactura <= 0) {
      setDirectoryMessage({ type: 'error', text: 'La factura seleccionada no tiene un identificador valido. Vuelve a buscarla y selecciona el resultado nuevamente.' });
      return;
    }
    const guiaCodemisor = getSerieCodemisorFromOptions(
      getDocumentSerieOptions(guiaPreparacion, puntosData, 'guia'),
      guiaForm.serie,
      guiaPreparacion,
    ) ?? emisores.find((emisor) => emisor.estado !== false)?.codigo ?? null;
    if (!guiaCodemisor) {
      setDirectoryMessage({ type: 'error', text: 'No hay un emisor activo asociado a la guia. Configura el emisor y vuelve a intentarlo.' });
      return;
    }
    const detalleKeys = new Set<string>();
    let detalles: GuiaRemisionDetalleInput[];
    try {
      detalles = guiaDetalles.map((detalle) => {
        const cantidad = parseDocumentNumber(detalle.cantidad);
        const key = `${detalle.producto.codprincipal ?? detalle.producto.codproducto}|${detalle.producto.codauxiliar ?? ''}`;
        const fiscalError = validateFiscalLine({ quantity: cantidad, requireIntegerQuantity: true });
        if (fiscalError) throw new Error(fiscalError);
        if (detalleKeys.has(key)) throw new Error('No repitas el mismo producto en los detalles de la guia.');
        detalleKeys.add(key);
        if (!detalle.producto.descripcion?.trim()) throw new Error('Cada detalle debe tener una descripcion.');
        return { producto: detalle.producto, cantidad };
      });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof Error ? error.message : 'Revisa los detalles de la guia.' });
      return;
    }
    setSavingGuia(true);
    setDirectoryMessage({ type: 'info', text: 'Guardando la guia de remision...' });
    const saveStartedAt = Date.now();
    try {
      const result = await guardarGuiaRemision({
        idUsuario: catalogUserId,
        transportista: { ...guiaTransportista, direccion: direccionTransportista },
        destinatario: guiaCliente,
        factura: guiaFactura,
        serie: guiaForm.serie,
        codemisor: guiaCodemisor,
        placa: guiaForm.placa,
        contribuyenteEspecial: guiaForm.contribuyenteEspecial,
        obligadoContabilidad: guiaForm.transportistaObligadoContabilidad,
        fechaEmision: guiaForm.fechaEmision,
        fechaInicioTraslado: guiaForm.fechaInicioTraslado,
        fechaFinTraslado: guiaForm.fechaFinTraslado,
        detalle: guiaForm.referencia,
        direccionOrigen: guiaForm.direccionOrigen,
        puntoEmision: guiaForm.serie,
        detalles,
      });
      const secGuia = result.codGuia;
      if (!secGuia) {
        throw new ApiError(502, 'El servidor no devolvio el identificador de la guia guardada. Revisa Mis Guias antes de volver a intentarlo.');
      }
      pendingGuiaRetryRef.current = null;
      setDirectoryMessage({ type: 'info', text: 'Guia guardada. Enviandola al SRI...' });
      const sriResult = await tryAuthorizeAfterSave(() => emitirGuiaRemision(catalogUserId, secGuia));
      clearGuiaForm();
      setDirectoryMessage({
        type: getSriMessageType(sriResult.sri?.estado, sriResult.failed),
        text: `${result.mensaje ?? 'Guia de remision guardada.'} ${sriResult.error ? `No se pudo autorizar la guia: ${sriResult.error}` : getSriEmissionMessage('Guía de remisión', sriResult.sri?.estado, sriResult.failed)}`.trim(),
      });
      setReloadKey((value) => value + 1);
      if (!sriResult.failed && sriResult.sri?.estado?.toUpperCase() === 'AUTORIZADO') {
        showAuthorizationAlert('Guia de remision', 'mis-guias-remision', 'Mis Guias de Remision');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        pendingGuiaRetryRef.current = saveStartedAt;
        setDirectoryMessage({ type: 'info', text: 'La solicitud tardo mas de lo esperado. La guia puede haberse guardado; revisa el historial antes de volver a emitir.' });
        setReloadKey((value) => value + 1);
        return;
      }
      const text = error instanceof ApiError ? error.message : 'No se pudo guardar la guia de remision.';
      setDirectoryMessage({ type: 'error', text });
    } finally {
      setSavingGuia(false);
    }
  };

  const sendGuiaCorreo = async (guia: GuiaRemisionListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarGuiaRemisionCorreo(catalogUserId, guia.codGuia);
      setDirectoryMessage({ type: 'success', text: 'Correo enviado correctamente.' });
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo enviar el correo.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const emitGuiaSri = async (guia: GuiaRemisionListItem) => {
    if (!catalogUserId) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    try {
      const result = await emitirGuiaRemision(catalogUserId, guia.codGuia);
      const estado = normalizeSriState(result.estado);
      setDirectoryMessage({ type: getSriMessageType(estado), text: result.mensaje?.trim() || getSriEmissionMessage('Guía de remisión', estado) });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Guia de remision', 'mis-guias-remision', 'Mis Guias de Remision');
      }
    } catch (error) {
      const text = error instanceof ApiError ? error.message : 'No se pudo emitir la guia de remision.';
      setDirectoryMessage({ type: 'error', text });
    }
  };

  const confirmAnularGuia = (guia: GuiaRemisionListItem) => {
    if (!catalogUserId) return;
    Alert.alert('Anular guia de remision', `Deseas anular ${guia.numero ?? 'esta guia de remision'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          try {
            await anularGuiaRemision(catalogUserId, guia.codGuia);
            setDirectoryMessage({ type: 'success', text: 'Guia de remision anulada correctamente.' });
            setReloadKey((value) => value + 1);
          } catch (error) {
            const text = error instanceof ApiError ? error.message : 'No se pudo anular la guia de remision.';
            setDirectoryMessage({ type: 'error', text });
          }
        },
      },
    ]);
  };

  const modules: MobileModule[] = EFACT_MODULES.map((module) => {
    const count =
      module.view === 'clientes'
        ? clientes.length
        : module.view === 'productos'
          ? productos.length
            : module.view === 'categorias'
              ? categorias.length + subcategorias.length
              : module.view === 'mis-facturas'
                ? facturasList.length
                : module.view === 'cotizaciones'
                  ? undefined
                : module.view === 'nueva-factura'
                  ? facturaLineas.length
                  : module.view === 'mis-notas-credito'
                    ? notasCreditoList.length
                    : module.view === 'nueva-nota-credito'
                      ? notaCreditoLineas.length
                      : module.view === 'mis-notas-debito'
                        ? notasDebitoList.length
                        : module.view === 'nueva-nota-debito'
                          ? notaDebitoLineas.length
                          : module.view === 'mis-liquidaciones-compra'
                            ? liquidacionesList.length
                            : module.view === 'nueva-liquidacion-compra'
                              ? liquidacionLineas.length
                              : module.view === 'mis-guias-remision'
                                ? guiasList.length
                                : module.view === 'nueva-guia-remision'
                                  ? guiaDetalles.length
                                  : module.view === 'retenciones'
                                    ? retencionesList.length
            : module.view === 'emisor'
              ? emisores.length
              : module.view === 'firma'
                ? emisores.filter(hasFirmaConfigured).length
                : module.view === 'perfil'
                  ? perfilData?.perfil ? 1 : 0
                  : module.view === 'punto-emision'
                    ? puntosData?.cajas.length ?? 0
                    : getOperationalModuleSlug(module.view)
                      ? operationalCounts[module.view]
                : undefined;

    return {
      ...module,
      count,
      enabled: [
        'clientes',
        'productos',
        'categorias',
        'nueva-factura',
        'mis-facturas',
        'cotizaciones',
        'nueva-nota-credito',
        'mis-notas-credito',
        'nueva-nota-debito',
        'mis-notas-debito',
        'nueva-liquidacion-compra',
        'mis-liquidaciones-compra',
        'nueva-guia-remision',
        'mis-guias-remision',
        'retenciones',
        'emisor',
         'firma',
         'e-rubrica',
        'perfil',
        'perfil-e-rubrica',
        'punto-emision',
        'cuentas-cobrar',
        'estado-cuenta',
        'comprar-documentos',
         'recargas',
         'centro-normativo',
         'bot',
      ].includes(module.view),
    };
  });

  const openView = (view: WorkspaceView) => {
    botVoiceControlsRef.current?.dismiss();
    setMenuOpen(false);
    setSearch('');

    if (!initialSetupLoading && !initialSetupComplete && !initialSetupAllowedViews.has(view)) {
      setActiveView('dashboard');
      setDirectoryMessage({ type: 'info', text: 'Completa primero emisor, punto de emisión, firma y saldo de documentos.' });
      return;
    }

    if (view === 'portal' && canUsePortal) {
      setActiveView(view);
      return;
    }

    if (view === 'dashboard' && canUseEfact) {
      setActiveView(view);
      return;
    }

    if (view === 'politica-privacidad') {
      setPrivacyReturnView(activeView === 'perfil-e-rubrica' ? 'perfil-e-rubrica' : 'perfil');
      setActiveView(view);
      return;
    }

    if (view === 'firma' && canUseFirma) {
      setActiveView(view);
      return;
    }

    if (view === 'nuevo-cliente' && authorizedViews.has('clientes')) {
      setActiveView(view);
      return;
    }

    if (view === 'nuevo-producto' && authorizedViews.has('productos')) {
      setActiveView(view);
      return;
    }

    if (['nueva-categoria', 'nueva-subcategoria'].includes(view) && authorizedViews.has('categorias')) {
      setActiveView(view);
      return;
    }

    if (view === 'nuevo-emisor' && authorizedViews.has('emisor')) {
      setActiveView(view);
      return;
    }

    if (view === 'nueva-firma' && canUseFirma) {
      setActiveView(view);
      return;
    }

    if (view === 'nuevo-punto-emision' && authorizedViews.has('punto-emision')) {
      setActiveView(view);
      return;
    }

    if (view === 'bot' && canUseEfact) {
      setActiveView(view);
      return;
    }

    if (view === 'e-rubrica' && canUseERubrica) {
      setErubricaTabRequest(null);
      setActiveView(view);
      return;
    }

    if (view === 'perfil-e-rubrica' && canUseERubrica) {
      setActiveView(view);
      return;
    }

    if (authorizedViews.has(view)) {
      setActiveView(view);
      return;
    }

    setActiveView('no-autorizado');
  };

  const handleBotNavigate = (route: string) => {
    const routeMap: Record<string, WorkspaceView> = {
      '/dashboard': 'dashboard',
      '/facturacion': 'nueva-factura',
      '/facturacion/nueva': 'nueva-factura',
      '/facturacion/nota-credito': 'nueva-nota-credito',
      '/cotizaciones': 'cotizaciones',
      '/facturacion/notas-credito': 'nueva-nota-credito',
      '/facturacion/notas-credito-generadas': 'mis-notas-credito',
      '/facturacion/nota-debito': 'nueva-nota-debito',
      '/facturacion/notas-debito': 'nueva-nota-debito',
      '/facturacion/notas-debito-generadas': 'mis-notas-debito',
      '/facturacion/retenciones': 'retenciones',
      '/facturacion/retenciones-generadas': 'retenciones',
      '/facturacion/guia-remision': 'nueva-guia-remision',
      '/compras/importar-xml': 'retenciones',
      '/compras/nueva-liquidacion': 'nueva-liquidacion-compra',
      '/compras/liquidaciones-generadas': 'mis-liquidaciones-compra',
      '/facturas': 'mis-facturas',
      '/clientes': 'clientes',
      '/productos': 'productos',
      '/categorias': 'categorias',
      '/notas-credito': 'mis-notas-credito',
      '/notas-debito': 'mis-notas-debito',
      '/guias-remision': 'mis-guias-remision',
      '/compras': 'compras',
      '/proveedores': 'proveedores',
      '/perfil': 'perfil',
      '/reportes': 'reportes',
      '/reportes/documentos': 'reportes',
      '/e-rubrica': 'e-rubrica',
      '/cuentas-cobrar': 'cuentas-cobrar',
      '/estado-cuenta': 'estado-cuenta',
      '/recargas': 'recargas',
      '/comprar-documentos': 'comprar-documentos',
      '/centro-normativo': 'centro-normativo',
      '/emisor': 'emisor',
      '/nuevo-emisor': 'nuevo-emisor',
      '/firma': 'firma',
      '/nueva-firma': 'firma',
      '/punto-emision': 'punto-emision',
    };
    const normalizedRoute = route.trim().toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';
    const erubricaRouteMap: Record<string, ERubricaTab> = {
      '/e-rubrica/configuracion/firma': 'firma-config',
      '/e-rubrica/configuracion/plan': 'plan-disponible',
      '/e-rubrica/plan-disponible': 'plan-disponible',
      '/e-rubrica/mis-firmas': 'ver-mis-firmas',
      '/solicitud/pagos': 'historial-solicitudes',
      '/solicitud/nueva': 'nueva-solicitud',
      '/e-rubrica/documentos': 'historial-documentos',
      '/e-rubrica/documentos-por-firmar': 'documentos-por-firmar',
      '/e-rubrica/documentos/por-firmar': 'documentos-por-firmar',
      '/e-rubrica/documentos/firmar': 'firmar',
      '/e-rubrica/documentos/validar-firma': 'validar-firma',
    };
    const erubricaTab = erubricaRouteMap[normalizedRoute];
    if (erubricaTab) {
      openERubricaTab(erubricaTab);
      return;
    }
    const view = routeMap[normalizedRoute] ?? routeMap[`/${normalizedRoute.replace(/^\/+/, '')}`];
    if (view) {
      openView(view);
      return;
    }
    setDirectoryMessage({ type: 'info', text: 'Númi no encontró esa sección. Abre el menú para continuar.' });
  };

  const dismissNotificationLocal = (notificationId: string) => {
    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      next.add(notificationId);
      return next;
    });
  };

  const dismissNotification = (notificationId: string) => {
    dismissNotificationLocal(notificationId);
    void dismissNotifications([notificationId]).catch(() => setNotificationsMessage({ type: 'info', text: 'No se pudo guardar el descarte. Inténtalo nuevamente.' }));
  };

  const clearVisibleNotifications = () => {
    const notificationIds = visibleNotifications.map((notification) => notification.id);
    if (!notificationIds.length) return;
    Alert.alert('Borrar notificaciones', 'Se ocultarán todas las notificaciones visibles.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: () => {
          void dismissNotifications(notificationIds).catch(() => setNotificationsMessage({ type: 'info', text: 'No se pudo guardar el descarte. Inténtalo nuevamente.' }));
          setDismissedNotificationIds((current) => {
            const next = new Set(current);
            notificationIds.forEach((notificationId) => next.add(notificationId));
            return next;
          });
        },
      },
    ]);
  };

  const openNotificationTarget = (notification: NotificacionItem) => {
    const targetView = getNotificationView(notification);
    void dismissNotification(notification.id);
    setNotificationsOpen(false);
    if (targetView) openView(targetView);
  };

  useEffect(() => {
    if (!menuOpen) {
      drawerProgress.setValue(0);
      return;
    }

    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerProgress, menuOpen, reduceMotion]);

  const toggleMenuSection = (key: string) => {
    setExpandedMenus((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasActiveEmisor = emisores.some((emisor) => emisor.estado !== false);
  const hasConfiguredFirma = emisores.some(hasFirmaConfigured);
  const documentPlan = getDocumentPlanStatus(compraDocumentosEstado);
  const hasEmissionPoint = Boolean(puntosData?.emisor && puntosData.cajas?.length);
  const hasDocumentsAvailable = documentPlan.unlimited || Number(compraDocumentosEstado?.saldoDocumentos ?? 0) > 0;
  const initialSetupComplete = hasActiveEmisor && hasEmissionPoint && hasConfiguredFirma && hasDocumentsAvailable;
  const initialSetupLoading = loadingEmisores || loadingPuntos || loadingCompraDocumentosEstado;
  const initialSetupAllowedViews = new Set<WorkspaceView>(['dashboard', 'emisor', 'nuevo-emisor', 'firma', 'nueva-firma', 'punto-emision', 'nuevo-punto-emision', 'clientes', 'nuevo-cliente', 'productos', 'nuevo-producto', 'categorias', 'nueva-categoria', 'nueva-subcategoria', 'cotizaciones', 'comprar-documentos', 'recargas', 'perfil', 'portal', 'e-rubrica', 'perfil-e-rubrica', 'politica-privacidad']);
  const firmaSummary = getFirmaSummary(emisores, firmaEstados);
  const moduleByView = new Map<WorkspaceView, MobileModule>(modules.map((module) => [module.view, module]));
  const menuNode = (view: WorkspaceView, label?: string, icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']): DrawerMenuNode => {
    const module = moduleByView.get(view);
    return {
      key: `${view}-${label ?? module?.title ?? getWorkspaceTitle(view)}`,
      label: label ?? module?.title ?? getWorkspaceTitle(view),
      view,
      icon,
      count: module?.count,
      disabled: module ? !module.enabled : !authorizedViews.has(view),
    };
  };
  const fullEfactDrawerMenu: DrawerMenuNode[] = [
    menuNode('clientes', 'Clientes / Proveedores'),
    {
      key: 'facturas',
      label: 'Facturas',
      children: [
        menuNode('nueva-factura', 'Nueva Factura'),
        menuNode('mis-facturas', 'Mis Facturas'),
      ],
    },
    menuNode('cotizaciones', 'Cotizaciones'),
    {
      key: 'otros-documentos',
      label: 'Emision de otros Documentos',
      children: [
        menuNode('nueva-guia-remision', 'Guia de Remision'),
        menuNode('nueva-liquidacion-compra', 'Liquidacion de Compra'),
        menuNode('nueva-nota-credito', 'Nota de Credito'),
        menuNode('nueva-nota-debito', 'Nota de Debito'),
      ],
    },
    {
      key: 'cuentas-cobrar',
      label: 'Cuentas Por Cobrar',
      view: 'cuentas-cobrar',
      count: operationalCounts['cuentas-cobrar'],
      disabled: !authorizedViews.has('cuentas-cobrar'),
      children: [menuNode('estado-cuenta', 'Estado de cuenta')],
    },
    {
      key: 'productos',
      label: 'Productos',
      view: 'productos',
      count: productos.length,
      disabled: !authorizedViews.has('productos'),
      children: [
        menuNode('categorias', 'Categorias'),
      ],
    },
    {
      key: 'recargas',
      label: 'Recargas',
      view: 'comprar-documentos',
      count: operationalCounts.recargas,
      disabled: !authorizedViews.has('recargas'),
      children: [menuNode('recargas', 'Mis recargas')],
    },
    {
      key: 'documentos-generados',
      label: 'Documentos Generados',
      children: [
        menuNode('mis-notas-credito', 'Mis Notas de Credito'),
        menuNode('retenciones', 'Mis Retenciones'),
        menuNode('mis-guias-remision', 'Mis Guias de Remision'),
        menuNode('mis-liquidaciones-compra', 'Mis Liquidaciones Compras'),
        menuNode('mis-notas-debito', 'Mis Notas de Debito'),
      ],
    },
    {
      key: 'configuracion',
      label: 'Configuracion',
      children: [
        menuNode('emisor', 'Emisor'),
        menuNode('punto-emision', 'Pto. Emision'),
        menuNode('centro-normativo', 'Centro normativo'),
      ],
    },
  ];
  const efactDrawerMenu: DrawerMenuNode[] = initialSetupComplete || initialSetupLoading ? fullEfactDrawerMenu : [
    menuNode('emisor', 'Emisor'),
    { key: 'firma-configuracion', label: 'Firma', view: 'firma', disabled: !canUseFirma },
    menuNode('punto-emision', 'Pto. Emision'),
    menuNode('clientes', 'Clientes / Proveedores'),
    menuNode('productos', 'Productos'),
    menuNode('cotizaciones', 'Cotizaciones'),
    menuNode('comprar-documentos', 'Comprar documentos'),
    menuNode('perfil', 'Mi perfil'),
  ];
  const openERubricaTab = (tab: ERubricaTab) => {
    setErubricaTabRequest(tab);
    setMenuOpen(false);
    setSearch('');
    if (canUseERubrica) {
      setActiveView('e-rubrica');
      return;
    }
    setActiveView('no-autorizado');
  };

  useEffect(() => {
    if (!incomingPdfUri) return;
    let mounted = true;
    const openIncomingPdf = async () => {
      try {
        const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!baseDirectory) throw new Error('missing-directory');
        const target = `${baseDirectory}external-${Date.now()}.pdf`;
        await FileSystem.copyAsync({ from: incomingPdfUri, to: target });
        if (!mounted) return;
        setErubricaInitialPdf({ uri: target, name: 'Documento recibido.pdf', mimeType: 'application/pdf' });
        openERubricaTab('firmar');
        onIncomingPdfHandled?.();
      } catch {
        if (mounted) setDirectoryMessage({ type: 'error', text: 'No se pudo cargar el PDF recibido.' });
      }
    };

    void openIncomingPdf();
    return () => {
      mounted = false;
    };
  }, [incomingPdfUri, canUseERubrica]);

  const downloadPdfForPreview = async (url: string, target: string) => {
    const cookie = getAuthSessionCookie();
    const response = await fetch(url, {
      credentials: 'include',
      headers: cookie ? { Cookie: cookie } : undefined,
    });
    if (!response.ok) throw new ApiError(response.status, 'No se pudo descargar el PDF.');
    const bytes = await response.arrayBuffer();
    await FileSystem.writeAsStringAsync(target, arrayBufferToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
    return { status: response.status, uri: target };
  };

  const openPdfPreview = async (loader: () => Promise<{ url?: string | null } | string>, fileName: string) => {
    try {
      const response = await loader();
      const url = getDocumentAssetUrl(response);
      if (!url) throw new Error('empty-url');
      const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDirectory) throw new Error('missing-directory');
      const target = `${baseDirectory}preview-${Date.now()}-${fileName.replace(/[^a-z0-9._-]/gi, '-')}`;
      const download = await downloadPdfForPreview(url, target);
      const fileInfo = await FileSystem.getInfoAsync(download.uri);
      const signature = fileInfo.exists
        ? await FileSystem.readAsStringAsync(download.uri, { encoding: FileSystem.EncodingType.Base64 })
        : '';
      if (download.status !== 200 || !fileInfo.exists || (fileInfo.size ?? 0) < 16 || !signature.startsWith('JVBERi0')) {
        throw new Error('invalid-pdf-download');
      }
      setPdfPreview({ uri: download.uri, name: fileName });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo cargar la previsualización del PDF.' });
    }
  };
  const downloadPdf = async (loader: () => Promise<{ url?: string | null } | string>, fileName: string) => {
    try {
      const response = await loader();
      const url = getDocumentAssetUrl(response);
      if (!url) throw new Error('empty-url');
      const safeName = buildDeviceFileName(fileName, '.pdf');
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) throw new Error('missing-directory');
      const cookie = getAuthSessionCookie();
      const download = await FileSystem.downloadAsync(url, `${cacheDirectory}${safeName}`, cookie ? { headers: { Cookie: cookie } } : undefined);
      const savedUri = await saveFileToDevice(download.uri, safeName, 'application/pdf');
      setDirectoryMessage({
        type: savedUri ? 'success' : 'info',
        text: savedUri ? `PDF guardado en el dispositivo: ${safeName}` : 'Selecciona una carpeta para guardar el PDF.',
      });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo descargar el PDF.' });
    }
  };
  const openOrDownloadPdf = (loader: () => Promise<{ url?: string | null } | string>, fileName: string, descargar = false) => {
    return descargar ? downloadPdf(loader, fileName) : openPdfPreview(loader, fileName);
  };
  const openLocalPdfInDeviceViewer = async (uri: string) => {
    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/pdf',
        flags: 1,
      });
      return;
    }

    await Linking.openURL(uri);
  };
  const openPdfInDeviceViewer = async (loader: () => Promise<{ url?: string | null } | string>, fileName: string) => {
    try {
      const response = await loader();
      const url = getDocumentAssetUrl(response);
      if (!url) throw new Error('empty-url');
      const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDirectory) throw new Error('missing-directory');
      const download = await downloadPdfForPreview(
        url,
        `${cacheDirectory}preview-${Date.now()}-${buildDeviceFileName(fileName, '.pdf')}`
      );
      const fileInfo = await FileSystem.getInfoAsync(download.uri);
      const signature = fileInfo.exists
        ? await FileSystem.readAsStringAsync(download.uri, { encoding: FileSystem.EncodingType.Base64 })
        : '';
      if (download.status !== 200 || !fileInfo.exists || (fileInfo.size ?? 0) < 16 || !signature.startsWith('JVBERi0')) {
        throw new Error('invalid-pdf-download');
      }
      await openLocalPdfInDeviceViewer(download.uri);
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo abrir el PDF.' });
    }
  };
  const sharePdf = async (loader: () => Promise<{ url?: string | null } | string>, fileName: string) => {
    try {
      const response = await loader();
      const url = getDocumentAssetUrl(response);
      if (!url) throw new Error('empty-url');
      if (!(await Sharing.isAvailableAsync())) {
        setDirectoryMessage({ type: 'error', text: 'No hay aplicaciones disponibles para compartir el PDF.' });
        return;
      }
      const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!cacheDirectory) throw new Error('missing-directory');
      const cookie = getAuthSessionCookie();
      const safeName = buildDeviceFileName(fileName, '.pdf');
      const download = await FileSystem.downloadAsync(url, `${cacheDirectory}${safeName}`, cookie ? { headers: { Cookie: cookie } } : undefined);
      await Sharing.shareAsync(download.uri, { mimeType: 'application/pdf', dialogTitle: `Compartir ${fileName}` });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo compartir el PDF.' });
    }
  };
  const openPdfWithExternalViewer = async () => {
    if (!pdfPreview) return;

    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(pdfPreview.uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/pdf',
          flags: 1,
        });
        return;
      }

      await Linking.openURL(pdfPreview.uri);
    } catch {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfPreview.uri, { mimeType: 'application/pdf', dialogTitle: 'Abrir PDF con otra aplicación' });
        return;
      }

      setDirectoryMessage({ type: 'error', text: 'No hay una aplicación disponible para visualizar este PDF.' });
    }
  };
  const downloadEstadoCuentaFile = async (item: OperationalMobileItem, format: 'pdf' | 'excel') => {
    if (!catalogUserId) return;
    const idCliente = Number(item.id);
    if (!Number.isInteger(idCliente) || idCliente <= 0) {
      setDirectoryMessage({ type: 'error', text: 'No se pudo identificar el cliente del estado de cuenta.' });
      return;
    }

    try {
      const response = format === 'pdf'
        ? await getEstadoCuentaPdf(catalogUserId, idCliente)
        : await getEstadoCuentaExcel(catalogUserId, idCliente);
      const saved = await saveBinaryFileToDevice(
        response.bytes,
        `estado-cuenta-${idCliente}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
        format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      setDirectoryMessage({
        type: saved ? 'success' : 'info',
        text: saved ? `Archivo guardado en el dispositivo: ${saved.name}` : 'Selecciona una carpeta para guardar el archivo.',
      });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo guardar el archivo del estado de cuenta.' });
    }
  };
  const sendRetencionCorreo = async (retencion: RetencionListItem) => {
    if (!catalogUserId) return;
    try {
      await enviarRetencionCorreo(catalogUserId, retencion.codRetencion);
      setDirectoryMessage({ type: 'success', text: 'Correo de retencion enviado correctamente.' });
    } catch (error) {
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo enviar el correo de la retencion.' });
    }
  };
  const emitRetencionSri = async (retencion: RetencionListItem) => {
    if (!catalogUserId) return;
    const prerequisitesError = await validateEmissionPrerequisites();
    if (prerequisitesError) {
      setDirectoryMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    if (pendingRetencionEmitRef.current === retencion.codRetencion) {
      Alert.alert(
        'Emisión no confirmada',
        'La solicitud anterior tardó demasiado. Revisa el historial antes de volver a enviarla.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Actualizar historial', onPress: () => setReloadKey((value) => value + 1) },
          { text: 'Emitir otra vez', style: 'destructive', onPress: () => { pendingRetencionEmitRef.current = null; void emitRetencionSri(retencion); } },
        ],
      );
      return;
    }
    pendingRetencionEmitRef.current = retencion.codRetencion;
    try {
      const result = await emitirRetencionSri(catalogUserId, retencion.codRetencion);
      const estado = normalizeSriState(result.estado);
      pendingRetencionEmitRef.current = null;
      setDirectoryMessage({ type: getSriMessageType(estado), text: result.mensaje?.trim() || getSriEmissionMessage('Retención', estado) });
      setReloadKey((value) => value + 1);
      if (estado === 'AUTORIZADO') {
        showAuthorizationAlert('Retencion', 'retenciones', 'Mis Retenciones');
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 0)) pendingRetencionEmitRef.current = null;
      setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo emitir la retencion.' });
    }
  };
  const isERubricaWorkspace = activeView === 'e-rubrica' || activeView === 'perfil-e-rubrica';
  const renovacionFirma = erubricaData?.renovacion as { esValida?: boolean; EsValida?: boolean; estado?: string; Estado?: string; diasRestantes?: number | null; DiasRestantes?: number | null; fechaExpiracion?: string | null; FechaExpiracion?: string | null; mensaje?: string; Mensaje?: string } | null | undefined;
  const estadoFirmaERubrica = renovacionFirma?.estado ?? renovacionFirma?.Estado;
  const diasFirmaERubrica = renovacionFirma?.diasRestantes ?? renovacionFirma?.DiasRestantes;
  const fechaFirmaERubrica = renovacionFirma?.fechaExpiracion ?? renovacionFirma?.FechaExpiracion;
  const vigenciaFirmaERubrica = diasFirmaERubrica !== undefined && diasFirmaERubrica !== null
    ? `${diasFirmaERubrica} días restantes${fechaFirmaERubrica ? ` · Vence: ${formatDocumentDate(fechaFirmaERubrica)}` : ''}`
    : null;
  const firmaResumenVisible = isERubricaWorkspace
    ? {
        active: Boolean(renovacionFirma?.esValida ?? renovacionFirma?.EsValida),
        label: renovacionFirma ? (renovacionFirma.esValida ?? renovacionFirma.EsValida) ? estadoFirmaERubrica || 'Vigente' : estadoFirmaERubrica || 'Requiere revisión' : 'Sin firma configurada',
        caption: vigenciaFirmaERubrica ?? renovacionFirma?.mensaje ?? renovacionFirma?.Mensaje ?? 'Configura tu certificado .p12 y su clave.',
        tone: ((renovacionFirma?.esValida ?? renovacionFirma?.EsValida) ? 'success' : renovacionFirma ? 'warning' : 'danger') as 'success' | 'warning' | 'danger',
      }
    : firmaSummary;
  const drawerMenu: DrawerMenuNode[] = isERubricaWorkspace ? [
    {
      key: 'erubrica-documentos',
      label: 'Documentos Electrónicos',
      icon: 'file-document-multiple',
      children: [
        { key: 'erubrica-firmar-pdf', label: 'Firmar PDF', icon: 'file-sign', activeWhen: erubricaTabRequest === 'firmar', action: () => openERubricaTab('firmar') },
        { key: 'erubrica-historial-documentos', label: 'Historial Documentos Firmados', icon: 'file-clock-outline', activeWhen: erubricaTabRequest === 'historial-documentos', action: () => openERubricaTab('historial-documentos') },
        { key: 'erubrica-validar-firma', label: 'Validar Firma', icon: 'file-check-outline', activeWhen: erubricaTabRequest === 'validar-firma', action: () => openERubricaTab('validar-firma') },
        { key: 'erubrica-documentos-por-firmar', label: 'Documentos por Firmar', icon: 'file-document-edit-outline', activeWhen: erubricaTabRequest === 'documentos-por-firmar', action: () => openERubricaTab('documentos-por-firmar') },
      ],
    },
    {
      key: 'erubrica-firma-electronica',
      label: 'Firma Electrónica',
      icon: 'draw-pen',
      children: [
        { key: 'erubrica-nueva-solicitud', label: 'Nueva Solicitud', icon: 'file-plus-outline', activeWhen: erubricaTabRequest === 'nueva-solicitud', action: () => openERubricaTab('nueva-solicitud') },
        { key: 'erubrica-historial-solicitudes', label: 'Historial de solicitudes', icon: 'history', activeWhen: erubricaTabRequest === 'historial-solicitudes', action: () => openERubricaTab('historial-solicitudes') },
      ],
    },
    {
      key: 'erubrica-configuracion',
      label: 'Configuracion',
      icon: 'cog-outline',
      children: [
        { key: 'erubrica-perfil', label: 'Perfil', view: 'perfil-e-rubrica', icon: 'account-cog-outline', disabled: !canUseERubrica },
        { key: 'erubrica-plan', label: 'Plan disponible', icon: 'card-text-outline', activeWhen: erubricaTabRequest === 'plan-disponible', action: () => openERubricaTab('plan-disponible') },
        { key: 'erubrica-firma-config', label: 'Firma', icon: 'file-certificate-outline', activeWhen: erubricaTabRequest === 'firma-config', action: () => openERubricaTab('firma-config') },
      ],
    },
  ] : efactDrawerMenu;
  const isDrawerNodeActive = (node: DrawerMenuNode): boolean => Boolean(
    node.activeWhen || node.view === activeView || node.children?.some(isDrawerNodeActive),
  );
  return (
    <BusinessHomeLayout context={{
      drawerMenu,
      getWorkspaceTitle,
      modules,
      AVATARS,
      ActivityIndicator,
      Animated,
      ApiError,
      DirectoryWorkspace,
      EFACT_THEME,
      ERUBRICA_COLORS,
      ERubricaMobileScreen,
      EfactBotScreen,
      EmptyState,
      ExtractedDashboardHomeScreen,
      ExtractedGlobalSearchModal,
      ExtractedPurchaseDocumentsScreen,
      GlobalWorkspaceHeader,
      Image,
      InitialSequenceModal,
      ItemDetailModal,
      KeyboardAvoidingView,
      MaterialCommunityIcons,
      MenuItem,
      MessageBox,
      Modal,
      OperationalModuleScreen,
      PdfDocumentPreview,
      Platform,
      PortalBottomNav,
      PortalServiceCard,
      Pressable,
      PrimaryButton,
      RefreshControl,
      SafeAreaView,
      ScreenTransition,
      ScrollView,
      SecondaryButton,
      Sharing,
      StatusBar,
      Text,
      TextInput,
      View,
      activeView,
      addFacturaProducto,
      addGuiaProducto,
      addLiquidacionProducto,
      adminItems,
      adminTabByView,
      applySequenceNumberToForm,
      authorizedViews,
      avatarImageSource,
      botDraft,
      botFeedbackByMessage,
      botHistoryReadyRef,
      botMessages,
      botWorkflow,
      botVoiceControlsRef,
      canUseERubrica,
      canUseEfact,
      canUseFirma,
      canUsePortal,
      catalogUserId,
      categoriaForm,
      categoriaFormMode,
      categoriaTab,
      categorias,
      ciudades,
      clearFacturaForm,
      clearFirmaFields,
      clearGuiaForm,
      clearLiquidacionForm,
      clearNotaCreditoForm,
      clearNotaDebitoForm,
      clearVisibleNotifications,
      clienteEstadoFiltro,
      clienteForm,
      clienteFormMode,
      clienteLookups,
      clienteProveedorFiltro,
      clienteTipoFiltro,
      clientes,
      clientesActivos,
      clientesProveedores,
      closeCategoriaForm,
      closeClienteForm,
      closeEmisorForm,
      closeOperationalForm,
      closeProductoForm,
      closePuntoForm,
      closeSubcategoriaForm,
      compraDocumentosEstado,
      confirmAnularFactura,
      confirmAnularGuia,
      confirmAnularNotaCredito,
      confirmAnularNotaDebito,
      confirmDeleteCategoria,
      confirmDeleteCliente,
      confirmDeleteEmisor,
      confirmDeleteFirma,
      confirmDeleteOperational,
      confirmDeleteProducto,
      confirmDeletePunto,
      confirmDeleteSubcategoria,
      consultandoSriEmisor,
      consultarSriEmisor,
      continuarRetencionLiquidacion,
      currentUser,
      debouncedSearch,
      diasFirmaERubrica,
      directoryMessage,
      dismissNotification,
      dismissNotificationLocal,
      dismissedNotificationIds,
      documentPlan,
      downloadEstadoCuentaFile,
      downloadPdf,
      drawerProgress,
      emisorForm,
      emisorFormMode,
      emisorToForm,
      emisores,
      emitGuiaSri,
      emitLiquidacionSri,
      emitNotaCreditoSri,
      emitNotaDebitoSri,
      emitRetencionSri,
      emitirNotaCreditoAutomaticaDesdeFactura,
      ensureFacturaProducto,
      erubricaData,
      erubricaInitialPdf,
      erubricaTabRequest,
      estadoFirmaERubrica,
      expandedMenus,
      exportRowsToCsv,
      facturaCliente,
      facturaClientes,
      facturaForm,
      facturaLineas,
      facturaPreparacion,
      facturaProductos,
      facturaRequestIdRef,
      facturasList,
      fechaFirmaERubrica,
      fillNotaCreditoCliente,
      filteredCategorias,
      filteredClientes,
      filteredPortalServiceCards,
      filteredProductos,
      filteredSubcategorias,
      findFacturaSavedAfterTimeout,
      firmaEstados,
      firmaResumenVisible,
      firmaSummary,
      getClienteDetailValues,
      getClienteDisplayName,
      getClienteEmail,
      getClienteFacturaStats,
      getClienteIdentification,
      getCurrentOperationalContext,
      getDocumentAssetUrl,
      getERubricaTabTitle,
      getEmisorDetailValues,
      getFacturaDetalle,
      getFacturaPdf,
      getFacturaXml,
      getFirmaDetailValues,
      getLiquidacionCompraPdf,
      getLiquidacionCompraXml,
      getGuiaRemisionPdf,
      getGuiaRemisionXml,
      getInitials,
      getNextPuntoCode,
      getNotaCreditoPdf,
      getNotaCreditoXml,
      getNotaDebitoPdf,
      getNotaDebitoXml,
      getNotificationTone,
      getNotificationView,
      getProductoDetailValues,
      getRetencionPdf,
      getRetencionXml,
      getSriEmissionMessage,
      getSriMessageType,
      getTipoClienteLabel,
      getTipoIdentificacionLabel,
      getUsableFacturaProductos,
      globalSearchOpen,
      globalSearchQuery,
      globalSearchResults,
      guiaCliente,
      guiaClientes,
      guiaDetalles,
      guiaFactura,
      guiaFacturas,
      guiaForm,
      guiaPreparacion,
      guiaProductos,
      guiaTransportista,
      guiaTransportistas,
      guiasList,
      handleBotNavigate,
      hasActiveEmisor,
      hasConfiguredFirma,
      hasEmissionPoint,
      hasDocumentsAvailable,
      initialSetupComplete,
      initialSetupLoading,
      hasFirmaConfigured,
      idTipoUsuario,
      importNotaCreditoXml,
      importNotaDebitoXml,
      initialCategoriaForm,
      initialClienteForm,
      initialEmisorForm,
      initialProductoForm,
      initialSubcategoriaForm,
      insets,
      invoiceDraftReady,
      invoiceDraftSaved,
      invoiceDraftStorageRef,
      isDrawerNodeActive,
      isERubricaWorkspace,
      isInitialsAvatar,
      isOperationalMobileView,
      isPersonalPhoto,
      isSuperAdmin,
      liquidacionForm,
      liquidacionLineas,
      liquidacionPreparacion,
      liquidacionProductos,
      liquidacionProveedor,
      liquidacionProveedores,
      liquidacionRetencion,
      liquidacionesList,
      loadingAdminItems,
      loadingCategorias,
      loadingClienteLookups,
      loadingClientes,
      loadingEmisores,
      loadingErubrica,
      loadingFacturas,
      loadingFirma,
      loadingGuiaSearch,
      loadingGuias,
      loadingLiquidacionRetencion,
      loadingLiquidaciones,
      loadingMenus,
      loadingNotasCredito,
      loadingNotasDebito,
      loadingNotifications,
      loadingOperationalItems,
      loadingPerfil,
      loadingProductoDetail,
      loadingProductoLookups,
      loadingProductos,
      loadingPuntos,
      loadingRetenciones,
      makePuntoPrincipal,
      mapProductoToFacturaProducto,
      menuMessage,
      menuNode,
      menuOpen,
      menus,
      moduleByView,
      notaCreditoCliente,
      notaCreditoClientes,
      notaCreditoFactura,
      notaCreditoFacturas,
      notaCreditoForm,
      notaCreditoLineas,
      notaCreditoPreparacion,
      notaDebitoCliente,
      notaDebitoFactura,
      notaDebitoFacturas,
      notaDebitoForm,
      notaDebitoLineas,
      notaDebitoPreparacion,
      notasCreditoList,
      notasDebitoList,
      notifications,
      notificationsMessage,
      notificationsOpen,
      onLogout,
      openAccountPaymentFromStatement,
      openAddFirma,
      openERubricaTab,
      openEditCategoria,
      openEditCliente,
      openEditEmisor,
      openEditOperational,
      openEditProducto,
      openEditPunto,
      openEditSubcategoria,
      openFacturaAsset,
      openFacturaCuentasCobrar,
      openFirmaForm,
      openKnownDocumentAsset,
      openLocalPdfInDeviceViewer,
      openNewCategoria,
      openNewCliente,
      openNewEmisor,
      openNewOperational,
      openNewProducto,
      openNewProveedor,
      openNewPunto,
      openNewSubcategoria,
      openNotificationTarget,
      openOrDownloadPdf,
      openPdfInDeviceViewer,
      openPdfPreview,
      openPdfWithExternalViewer,
      openView,
      operationalCounts,
      operationalForm,
      operationalFormMode,
      operationalItems,
      operationalTabByView,
      pdfPositionDragging,
      pdfPreview,
      pendingFacturaRetryRef,
      pendingGuiaRetryRef,
      pendingNotaDebitoRetryRef,
      pendingRetencionEmitRef,
      perfilData,
      perfilForm,
      perfilToForm,
      portalAvatarUrl,
      portalFirstName,
      portalServiceCards,
      portalServiceQuery,
      privacyReturnView,
      prepararRetencionLiquidacion,
      processingNotaCreditoAutomatica,
      productoCategoriaFiltro,
      productoCategoriasFiltro,
      productoEstadoFiltro,
      productoForm,
      productoFormMode,
      productoLookups,
      productoSubcategoriaFiltro,
      productoSubcategoriasFiltro,
      productoTipoFiltro,
      productos,
      productosConCatalogos,
      provincias,
      puntoForm,
      puntoFormMode,
      puntoToForm,
      puntosData,
      queueInvoiceDraftStorage,
      reduceMotion,
      reloadKey,
      removeFacturaLinea,
      removeGuiaDetalle,
      removeLiquidacionLinea,
      removeNotaCreditoLinea,
      renovacionFirma,
      resolveImageUrl,
      retencionesIvaCatalogo,
      retencionesList,
      retencionesRentaCatalogo,
      retryFacturaSri,
      saveCategoria,
      saveCliente,
      saveEmisor,
      saveInitialSequence,
      saveNuevaFactura,
      saveNuevaGuia,
      saveNuevaLiquidacion,
      saveNuevaNotaCredito,
      saveNuevaNotaDebito,
      saveOperational,
      savePerfil,
      saveProducto,
      savePunto,
      saveRetencionLiquidacion,
      saveSubcategoria,
      savingCategoria,
      savingCliente,
      savingEmisor,
      savingFactura,
      savingFacturaRef,
      checkingGuia,
      savingGuia,
      savingLiquidacion,
      savingLiquidacionRetencion,
      savingNotaCredito,
      savingNotaDebito,
      savingOperational,
      savingPerfil,
      savingProducto,
      savingPunto,
      search,
      searchFacturaClientes,
      searchFacturaProductos,
      searchGuiaClientes,
      searchGuiaFacturas,
      searchGuiaProductos,
      searchGuiaTransportistas,
      searchLiquidacionProductos,
      searchLiquidacionProveedores,
      searchLocalFacturaProductos,
      searchNotaCreditoClientes,
      searchNotaCreditoFacturas,
      searchNotaDebitoFacturas,
      selectEmisorLogo,
      selectFirmaArchivo,
      selectGuiaCliente,
      selectGuiaFactura,
      selectGuiaTransportista,
      selectInitialsPerfilAvatar,
      selectLiquidacionProveedor,
      selectNotaCreditoFactura,
      selectNotaDebitoFactura,
      selectPerfilAvatar,
      selectPresetPerfilAvatar,
      selectRechargePlan,
      selectedCategoria,
      selectedCliente,
      selectedEmisor,
      selectedOperationalItem,
      selectedProducto,
      selectedPunto,
      selectedSubcategoria,
      sendFacturaCorreo,
      sendGuiaCorreo,
      sendLiquidacionCorreo,
      sendNotaCreditoCorreo,
      sendNotaDebitoCorreo,
      sendRetencionCorreo,
      sequencePrompt,
      sequencePromptMessage,
      sequencePromptSaving,
      services,
      setActiveView,
      setAdminItems,
      setAdminTabByView,
      setBotDraft,
      setBotFeedbackByMessage,
      setBotMessages,
      setBotWorkflow,
      setCategoriaForm,
      setCategoriaFormMode,
      setCategoriaTab,
      setCategorias,
      setCiudades,
      setClienteEstadoFiltro,
      setClienteForm,
      setClienteFormMode,
      setClienteLookups,
      setClienteProveedorFiltro,
      setClienteTipoFiltro,
      setClientes,
      setCompraDocumentosEstado,
      setConsultandoSriEmisor,
      setDirectoryMessage,
      setDismissedNotificationIds,
      setEmisorForm,
      setEmisorFormMode,
      setEmisores,
      setErubricaData,
      setErubricaInitialPdf,
      setErubricaTabRequest,
      setExpandedMenus,
      setFacturaCliente,
      setFacturaClientes,
      setFacturaForm,
      setFacturaLineas,
      setFacturaPreparacion,
      setFacturaProductos,
      setFacturasList,
      setFirmaEstados,
      setGlobalSearchOpen,
      setGlobalSearchQuery,
      setGuiaCliente,
      setGuiaClientes,
      setGuiaDetalles,
      setGuiaFactura,
      setGuiaFacturas,
      setGuiaForm,
      setGuiaPreparacion,
      setGuiaProductos,
      setGuiaTransportista,
      setGuiaTransportistas,
      setGuiasList,
      setInvoiceDraftReady,
      setInvoiceDraftSaved,
      setLiquidacionForm,
      setLiquidacionLineas,
      setLiquidacionPreparacion,
      setLiquidacionProductos,
      setLiquidacionProveedor,
      setLiquidacionProveedores,
      setLiquidacionRetencion,
      setLiquidacionesList,
      setLoadingAdminItems,
      setLoadingCategorias,
      setLoadingClienteLookups,
      setLoadingClientes,
      setLoadingEmisores,
      setLoadingErubrica,
      setLoadingFacturas,
      setLoadingFirma,
      setLoadingGuiaSearch,
      setLoadingGuias,
      setLoadingLiquidacionRetencion,
      setLoadingLiquidaciones,
      setLoadingMenus,
      setLoadingNotasCredito,
      setLoadingNotasDebito,
      setLoadingNotifications,
      setLoadingOperationalItems,
      setLoadingPerfil,
      setLoadingProductoDetail,
      setLoadingProductoLookups,
      setLoadingProductos,
      setLoadingPuntos,
      setLoadingRetenciones,
      setMenuMessage,
      setMenuOpen,
      setMenus,
      setNotaCreditoCliente,
      setNotaCreditoClientes,
      setNotaCreditoFactura,
      setNotaCreditoFacturas,
      setNotaCreditoForm,
      setNotaCreditoLineas,
      setNotaCreditoPreparacion,
      setNotaDebitoCliente,
      setNotaDebitoFactura,
      setNotaDebitoFacturas,
      setNotaDebitoForm,
      setNotaDebitoLineas,
      setNotaDebitoPreparacion,
      setNotasCreditoList,
      setNotasDebitoList,
      setNotifications,
      setNotificationsMessage,
      setNotificationsOpen,
      setOperationalCounts,
      setOperationalForm,
      setOperationalFormMode,
      setOperationalItems,
      setOperationalTabByView,
      setPdfPositionDragging,
      setPdfPreview,
      setPerfilData,
      setPerfilForm,
      setPortalServiceQuery,
      setProcessingNotaCreditoAutomatica,
      setProductoCategoriaFiltro,
      setProductoEstadoFiltro,
      setProductoForm,
      setProductoFormMode,
      setProductoLookups,
      setProductoSubcategoriaFiltro,
      setProductoTipoFiltro,
      setProductos,
      setProvincias,
      setPuntoForm,
      setPuntoFormMode,
      setPuntosData,
      setReloadKey,
      setRetencionesIvaCatalogo,
      setRetencionesList,
      setRetencionesRentaCatalogo,
      setSavingCategoria,
      setSavingCliente,
      setSavingEmisor,
      setSavingFactura,
      setSavingGuia,
      setSavingLiquidacion,
      setSavingLiquidacionRetencion,
      setSavingNotaCredito,
      setSavingNotaDebito,
      setSavingOperational,
      setSavingPerfil,
      setSavingProducto,
      setSavingPunto,
      setSearch,
      setSelectedCategoria,
      setSelectedCliente,
      setSelectedEmisor,
      setSelectedOperationalItem,
      setSelectedProducto,
      setSelectedPunto,
      setSelectedSubcategoria,
      setSequencePrompt,
      setSequencePromptMessage,
      setSequencePromptSaving,
      setSubcategoriaCategoriaFiltro,
      setSubcategoriaForm,
      setSubcategoriaFormMode,
      setSubcategorias,
      setSubcategoriasProducto,
      setViewingCategoria,
      setViewingCliente,
      setViewingEmisor,
      setViewingFirma,
      setViewingProducto,
      setViewingSubcategoria,
      sharePdf,
      showAdminItemDetail,
      showAuthorizationAlert,
      showOperationalItemDetail,
      sincronizarERubricaPendientes,
      styles,
      subcategoriaCategoriaFiltro,
      subcategoriaForm,
      subcategoriaFormMode,
      subcategorias,
      subcategoriasProducto,
      syncDocumentSequence,
      toggleMenuSection,
      tryAuthorizeAfterSave,
      unreadNotifications,
      updateCategoriaForm,
      updateClienteForm,
      updateEmisorForm,
      updateFacturaForm,
      updateFacturaLinea,
      updateGuiaDetalle,
      updateGuiaForm,
      updateLiquidacionForm,
      updateLiquidacionLinea,
      updateNotaCreditoForm,
      updateNotaCreditoLinea,
      updateNotaDebitoForm,
      updateNotaDebitoLinea,
      updateOperationalForm,
      updatePerfilForm,
      updateProductoForm,
      updatePuntoForm,
      updateRechargeForm,
      updateSubcategoriaForm,
      userId,
      validateEmissionPrerequisites,
      validateFacturaDraft,
      viewingCategoria,
      viewingCliente,
      viewingEmisor,
      viewingFirma,
      viewingProducto,
      viewingSubcategoria,
      vigenciaFirmaERubrica,
      visibleNotifications,
       }} />
  );
}
