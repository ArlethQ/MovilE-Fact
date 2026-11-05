import { CompraDocumentosEstado, OperationalMobileItem, OperationalModule } from '../../services/operationalMobileService';
import { formatDocumentDate } from '../../utils/documentFormatting';
import { pickRecordValue, textValue } from '../../utils/workspaceData';
import { hasFirmaConfigured } from '../../utils/emisorDisplay';
import { normalizeSerieCode } from '../../utils/documentSeries';
import type { WorkspaceView } from './AuthFlow';
import type { CategoriaFormState, EmisorFormState, ProductoFormState, SubcategoriaFormState } from '../../types/directoryForms';
import type { ClienteLookups, Emisor, FirmaEstado, PerfilUsuario, PuntoEmision } from '../../types/business';
import type { NuevaFacturaFormState } from '../../types/invoices';
import { PrivacyPolicyScreen } from '../legal/PrivacyPolicyScreen';
import { CotizacionesMobileScreen } from '../cotizaciones/CotizacionesMobileScreen';
import { getCotizacionPdfUrl } from '../../services/cotizacionesMobileService';

type OperationalFormState = { codigo: string; facturaId: string; descripcion: string; valor: string; observacion: string };
type PerfilFormState = { nombres: string; apellidos: string; nombreEmpresa: string; email: string; avatarUrl: string; avatarUploadUri: string; avatarUploadName: string; avatarUploadMimeType: string; identificacion: string; tipoCliente: number; idTipoIdentificacion: number | null; direccionEmpresa: string; celular: string; nuevaPassword: string; confirmarPassword: string; cambiarClave: boolean };
type PuntoFormState = { puntoEmision: string };
type BusinessHomeLayoutContext = any;

export function getDocumentPlanStatus(data: CompraDocumentosEstado | null) {
  const historial = Array.isArray(data?.historial) ? data.historial : [];
  const unlimitedPlan = historial.find((item) => {
    const row = item as Record<string, unknown>;
    const estado = textValue(pickRecordValue(row, ['estado', 'Estado'])).toLowerCase();
    return Boolean(pickRecordValue(row, ['esIlimitado', 'EsIlimitado']))
      && (Boolean(pickRecordValue(row, ['saldoAplicado', 'SaldoAplicado'])) || estado.includes('apro') || estado.includes('pag'));
  }) as Record<string, unknown> | undefined;
  const expires = textValue(pickRecordValue(unlimitedPlan, ['vigenciaHasta', 'VigenciaHasta', 'fechaVence', 'FechaVence', 'fecha', 'Fecha']));
  const saldo = Number(data?.saldoDocumentos ?? 0);

  const tone: 'success' | 'warning' | 'danger' = unlimitedPlan || saldo >= 5 ? 'success' : saldo > 0 ? 'warning' : 'danger';
  return {
    unlimited: Boolean(unlimitedPlan),
    label: unlimitedPlan ? 'Ilimitado' : Number.isFinite(saldo) ? String(saldo) : '-',
    caption: unlimitedPlan ? (expires ? `Vence: ${formatDocumentDate(expires)}` : 'Plan activo') : 'Documentos disponibles',
    tone,
  };
}

const EXPORT_GREEN = '#18B889';
const BOTTOM_NAV_CONTENT_INSET = 120;

export function getFirmaSummary(emisores: Emisor[], estados: Record<number, FirmaEstado>) {
  const configured = emisores.filter((emisor) => hasFirmaConfigured(emisor) || estados[emisor.codigo]?.tieneCertificado === true);
  const valid = configured.find((emisor) => estados[emisor.codigo]?.esValida);
  const fallback = valid ?? configured[0];
  const estado = fallback ? estados[fallback.codigo] : undefined;
  const hasInvalidState = Boolean(fallback && estado && estado.esValida === false);
  const active = Boolean(valid || (fallback && !estado && hasFirmaConfigured(fallback)));

  const tone: 'success' | 'warning' | 'danger' = active ? 'success' : hasInvalidState ? 'danger' : 'warning';
  return {
    active,
    label: active ? 'Activa' : hasInvalidState ? estado?.estadoVigencia === 'CADUCADA' ? 'Caducada' : 'No válida' : 'Pendiente',
    caption: hasInvalidState && estado?.mensaje ? estado.mensaje : estado?.fechaExpiracion ? `Vence: ${formatDocumentDate(estado.fechaExpiracion)}` : fallback ? 'Certificado configurado' : 'Sin firma',
    tone,
  };
}

export function operationalItemToForm(item: OperationalMobileItem): OperationalFormState {
  return {
    codigo: item.id ?? '',
    facturaId: '',
    descripcion: item.title ?? '',
    valor: item.meta ?? '',
    observacion: item.detail ?? '',
  };
}

export function operationalFormToPayload(form: OperationalFormState) {
  return {
    codigo: form.codigo.trim() || null,
    descripcion: form.descripcion.trim(),
    valor: form.valor.trim() || null,
    observacion: form.observacion.trim() || null,
  };
}

export function operationalFormToPayloadForContext(module: OperationalModule, tab: string, form: OperationalFormState) {
  const codigo = Number(form.codigo.trim());
  const valor = Number(form.valor.replace(',', '.'));

  if (module === 'cuentas-cobrar' && tab === 'Abonos') {
    const facturaId = Number(form.facturaId.trim());
    return {
      idCliente: Number.isFinite(codigo) ? codigo : 0,
      idFactura: Number.isFinite(facturaId) ? facturaId : 0,
      montoRecibido: Number.isFinite(valor) ? valor : 0,
      observacion: form.observacion.trim() || form.descripcion.trim(),
    };
  }

  if (module === 'recargas' && tab === 'Comprar documentos') {
    return {
      documentos: Number.isFinite(codigo) ? codigo : 0,
      montoTotal: Number.isFinite(valor) ? valor : 0,
      descripcion: form.descripcion.trim() || 'Recarga personalizada',
      emailDestino: form.observacion.trim() || null,
      esIlimitado: form.descripcion.toLowerCase().includes('ilimit'),
    };
  }

  return operationalFormToPayload(form);
}

export function getTipoClienteLabel(tipoCliente?: number | null, lookups?: ClienteLookups | null) {
  if (tipoCliente === 1) return 'Persona Natural';
  if (tipoCliente === 2) return 'Persona Juridica';

  const fromLookup = lookups?.tipos.find((tipo) => tipo.tclCodigo === tipoCliente)?.descripcion;
  if (fromLookup?.trim()) return fromLookup.trim();

  return 'Sin tipo';
}

export function perfilToForm(perfil?: PerfilUsuario | null): PerfilFormState {
  return {
    nombres: perfil?.nombres ?? '',
    apellidos: perfil?.apellidos ?? '',
    nombreEmpresa: perfil?.nombreEmpresa ?? '',
    email: perfil?.email ?? '',
    avatarUrl: perfil?.avatarUrl ?? '',
    avatarUploadUri: '',
    avatarUploadName: '',
    avatarUploadMimeType: '',
    identificacion: perfil?.identificacion ?? '',
    tipoCliente: perfil?.tipoCliente ?? 0,
    idTipoIdentificacion: perfil?.idTipoIdentificacion ?? null,
    direccionEmpresa: perfil?.direccionEmpresa ?? '',
    celular: perfil?.celular ?? '',
    nuevaPassword: '',
    confirmarPassword: '',
    cambiarClave: false,
  };
}

export function perfilFormToPayload(form: PerfilFormState, current?: PerfilUsuario | null) {
  return {
    idUsuario: current?.idUsuario ?? 0,
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    nombreEmpresa: form.nombreEmpresa.trim() || null,
    email: form.email.trim(),
    avatarUrl: form.avatarUrl || current?.avatarUrl || null,
    identificacion: form.identificacion.trim(),
    tipoCliente: form.tipoCliente,
    idTipoIdentificacion: form.idTipoIdentificacion,
    direccionEmpresa: form.direccionEmpresa.trim(),
    celular: form.celular.trim(),
    nuevaPassword: form.cambiarClave ? form.nuevaPassword.trim() || null : null,
    confirmarPassword: form.cambiarClave ? form.confirmarPassword.trim() || null : null,
  };
}

export function puntoToForm(punto?: PuntoEmision | null): PuntoFormState {
  return {
    puntoEmision: normalizeSerieCode(punto?.puntoEmision ?? ''),
  };
}

export function getNextPuntoCode(cajas: PuntoEmision[]) {
  const used = cajas
    .map((caja) => Number(normalizeSerieCode(caja.puntoEmision ?? caja.numCaja)))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return normalizeSerieCode(next);
}


export function BusinessHomeLayout({ context }: { context: BusinessHomeLayoutContext }) {
  const { AVATARS, ActivityIndicator, Animated, ApiError, DirectoryWorkspace, EFACT_THEME, ERUBRICA_COLORS, ERubricaMobileScreen, EfactBotScreen, EmptyState, ExtractedDashboardHomeScreen, ExtractedGlobalSearchModal, ExtractedPurchaseDocumentsScreen, GlobalWorkspaceHeader, Image, InitialSequenceModal, ItemDetailModal, KeyboardAvoidingView, MaterialCommunityIcons, MenuItem, MessageBox, Modal, OperationalModuleScreen, PdfDocumentPreview, Platform, PortalBottomNav, PortalServiceCard, Pressable, PrimaryButton, RefreshControl, SafeAreaView, ScreenTransition, ScrollView, SecondaryButton, Sharing, StatusBar, Text, TextInput, View, activeView, addFacturaProducto, addGuiaProducto, addLiquidacionProducto, adminItems, adminTabByView, applySequenceNumberToForm, authorizedViews, avatarImageSource, botDraft, botFeedbackByMessage, botHistoryReadyRef, botMessages, botVoiceControlsRef, canUseERubrica, canUseEfact, canUseFirma, canUsePortal, catalogUserId, categoriaForm, categoriaFormMode, categoriaTab, categorias, ciudades, clearFacturaForm, clearFirmaFields, clearGuiaForm, clearLiquidacionForm, clearNotaCreditoForm, clearNotaDebitoForm, clearVisibleNotifications, clienteEstadoFiltro, clienteForm, clienteFormMode, clienteLookups, clienteProveedorFiltro, clienteTipoFiltro, clientes, clientesActivos, clientesProveedores, closeCategoriaForm, closeClienteForm, closeEmisorForm, closeOperationalForm, closeProductoForm, closePuntoForm, closeSubcategoriaForm, compraDocumentosEstado, confirmAnularFactura, confirmAnularGuia, confirmAnularNotaCredito, confirmAnularNotaDebito, confirmDeleteCategoria, confirmDeleteCliente, confirmDeleteEmisor, confirmDeleteFirma, confirmDeleteOperational, confirmDeleteProducto, confirmDeletePunto, confirmDeleteSubcategoria, consultandoSriEmisor, consultarSriEmisor, continuarRetencionLiquidacion, currentUser, debouncedSearch, diasFirmaERubrica, directoryMessage, dismissNotification, dismissNotificationLocal, dismissedNotificationIds, documentPlan, downloadEstadoCuentaFile, downloadPdf, drawerProgress, emisorForm, emisorFormMode, emisores, emitGuiaSri, emitLiquidacionSri, emitNotaCreditoSri, emitNotaDebitoSri, emitRetencionSri, emitirNotaCreditoAutomaticaDesdeFactura, ensureFacturaProducto, erubricaData, erubricaInitialPdf, erubricaTabRequest, estadoFirmaERubrica, expandedMenus, exportRowsToCsv, facturaCliente, facturaClientes, facturaForm, facturaLineas, facturaPreparacion, facturaProductos, facturaRequestIdRef, facturasList, fechaFirmaERubrica, fillNotaCreditoCliente, filteredCategorias, filteredClientes, filteredPortalServiceCards, filteredProductos, filteredSubcategorias, findFacturaSavedAfterTimeout, firmaEstados, firmaResumenVisible, firmaSummary, getClienteDetailValues, getClienteDisplayName, getClienteEmail, getClienteFacturaStats, getClienteIdentification, getCurrentOperationalContext, getDocumentAssetUrl, getERubricaTabTitle, getEmisorDetailValues, getFacturaDetalle, getFacturaPdf, getFacturaXml, getFirmaDetailValues, getGuiaRemisionPdf, getGuiaRemisionXml, getInitials, getNextPuntoCode, getNotificationTone, getNotificationView, getProductoDetailValues, getRetencionPdf, getRetencionXml, getSriEmissionMessage, getSriMessageType, getTipoClienteLabel, getTipoIdentificacionLabel, getUsableFacturaProductos, globalSearchOpen, globalSearchQuery, globalSearchResults, guiaCliente, guiaClientes, guiaDetalles, guiaFactura, guiaFacturas, guiaForm, guiaPreparacion, guiaProductos, guiaTransportista, guiaTransportistas, guiasList, handleBotNavigate, hasActiveEmisor, hasConfiguredFirma, hasFirmaConfigured, idTipoUsuario, importNotaCreditoXml, importNotaDebitoXml, initialCategoriaForm, initialClienteForm, initialEmisorForm, initialProductoForm, initialSubcategoriaForm, insets, invoiceDraftReady, invoiceDraftSaved, invoiceDraftStorageRef, isDrawerNodeActive, isERubricaWorkspace, isInitialsAvatar, isOperationalMobileView, isPersonalPhoto, isSuperAdmin, liquidacionForm, liquidacionLineas, liquidacionPreparacion, liquidacionProductos, liquidacionProveedor, liquidacionProveedores, liquidacionRetencion, liquidacionesList, loadingAdminItems, loadingCategorias, loadingClienteLookups, loadingClientes, loadingEmisores, loadingErubrica, loadingFacturas, loadingFirma, loadingGuiaSearch, loadingGuias, loadingLiquidacionRetencion, loadingLiquidaciones, loadingMenus, loadingNotasCredito, loadingNotasDebito, loadingNotifications, loadingOperationalItems, loadingPerfil, loadingProductoDetail, loadingProductoLookups, loadingProductos, loadingPuntos, loadingRetenciones, makePuntoPrincipal, mapProductoToFacturaProducto, menuMessage, menuNode, menuOpen, menus, moduleByView, notaCreditoCliente, notaCreditoClientes, notaCreditoFactura, notaCreditoFacturas, notaCreditoForm, notaCreditoLineas, notaCreditoPreparacion, notaDebitoCliente, notaDebitoFactura, notaDebitoFacturas, notaDebitoForm, notaDebitoLineas, notaDebitoPreparacion, notasCreditoList, notasDebitoList, notifications, notificationsMessage, notificationsOpen, onLogout, openAccountPaymentFromStatement, openAddFirma, openERubricaTab, openEditCategoria, openEditCliente, openEditEmisor, openEditOperational, openEditProducto, openEditPunto, openEditSubcategoria, openFacturaAsset, openFacturaCuentasCobrar, openFirmaForm, openKnownDocumentAsset, openLocalPdfInDeviceViewer, openNewCategoria, openNewCliente, openNewEmisor, openNewOperational, openNewProducto, openNewProveedor, openNewPunto, openNewSubcategoria, openNotificationTarget, openOrDownloadPdf, openPdfInDeviceViewer, openPdfPreview, openPdfWithExternalViewer, openView, operationalCounts, operationalForm, operationalFormMode, operationalItems, operationalTabByView, pdfPositionDragging, pdfPreview, pendingFacturaRetryRef, pendingGuiaRetryRef, pendingNotaDebitoRetryRef, pendingRetencionEmitRef, perfilData, perfilForm, perfilToForm, portalAvatarUrl, portalFirstName, portalServiceCards, portalServiceQuery, prepararRetencionLiquidacion, processingNotaCreditoAutomatica, productoCategoriaFiltro, productoCategoriasFiltro, productoEstadoFiltro, productoForm, productoFormMode, productoLookups, productoSubcategoriaFiltro, productoSubcategoriasFiltro, productoTipoFiltro, productos, productosConCatalogos, provincias, puntoForm, puntoFormMode, puntoToForm, puntosData, queueInvoiceDraftStorage, reduceMotion, reloadKey, removeFacturaLinea, removeGuiaDetalle, removeLiquidacionLinea, removeNotaCreditoLinea, renderDrawerNode, renovacionFirma, resolveImageUrl, retencionesIvaCatalogo, retencionesList, retencionesRentaCatalogo, retryFacturaSri, saveCategoria, saveCliente, saveEmisor, saveInitialSequence, saveNuevaFactura, saveNuevaGuia, saveNuevaLiquidacion, saveNuevaNotaCredito, saveNuevaNotaDebito, saveOperational, savePerfil, saveProducto, savePunto, saveRetencionLiquidacion, saveSubcategoria, savingCategoria, savingCliente, savingEmisor, savingFactura, savingFacturaRef, savingGuia, savingLiquidacion, savingLiquidacionRetencion, savingNotaCredito, savingNotaDebito, savingOperational, savingPerfil, savingProducto, savingPunto, search, searchFacturaClientes, searchFacturaProductos, searchGuiaClientes, searchGuiaFacturas, searchGuiaProductos, searchGuiaTransportistas, searchLiquidacionProductos, searchLiquidacionProveedores, searchLocalFacturaProductos, searchNotaCreditoClientes, searchNotaCreditoFacturas, searchNotaDebitoFacturas, selectEmisorLogo, selectFirmaArchivo, selectGuiaCliente, selectGuiaFactura, selectGuiaTransportista, selectInitialsPerfilAvatar, selectLiquidacionProveedor, selectNotaCreditoFactura, selectNotaDebitoFactura, selectPerfilAvatar, selectPresetPerfilAvatar, selectRechargePlan, selectedCategoria, selectedCliente, selectedEmisor, selectedOperationalItem, selectedProducto, selectedPunto, selectedSubcategoria, sendFacturaCorreo, sendGuiaCorreo, sendLiquidacionCorreo, sendNotaCreditoCorreo, sendNotaDebitoCorreo, sendRetencionCorreo, sequencePrompt, sequencePromptMessage, sequencePromptSaving, services, setActiveView, setAdminItems, setAdminTabByView, setBotDraft, setBotFeedbackByMessage, setBotMessages, setCategoriaForm, setCategoriaFormMode, setCategoriaTab, setCategorias, setCiudades, setClienteEstadoFiltro, setClienteForm, setClienteFormMode, setClienteLookups, setClienteProveedorFiltro, setClienteTipoFiltro, setClientes, setCompraDocumentosEstado, setConsultandoSriEmisor, setDirectoryMessage, setDismissedNotificationIds, setEmisorForm, setEmisorFormMode, setEmisores, setErubricaData, setErubricaInitialPdf, setErubricaTabRequest, setExpandedMenus, setFacturaCliente, setFacturaClientes, setFacturaForm, setFacturaLineas, setFacturaPreparacion, setFacturaProductos, setFacturasList, setFirmaEstados, setGlobalSearchOpen, setGlobalSearchQuery, setGuiaCliente, setGuiaClientes, setGuiaDetalles, setGuiaFactura, setGuiaFacturas, setGuiaForm, setGuiaPreparacion, setGuiaProductos, setGuiaTransportista, setGuiaTransportistas, setGuiasList, setInvoiceDraftReady, setInvoiceDraftSaved, setLiquidacionForm, setLiquidacionLineas, setLiquidacionPreparacion, setLiquidacionProductos, setLiquidacionProveedor, setLiquidacionProveedores, setLiquidacionRetencion, setLiquidacionesList, setLoadingAdminItems, setLoadingCategorias, setLoadingClienteLookups, setLoadingClientes, setLoadingEmisores, setLoadingErubrica, setLoadingFacturas, setLoadingFirma, setLoadingGuiaSearch, setLoadingGuias, setLoadingLiquidacionRetencion, setLoadingLiquidaciones, setLoadingMenus, setLoadingNotasCredito, setLoadingNotasDebito, setLoadingNotifications, setLoadingOperationalItems, setLoadingPerfil, setLoadingProductoDetail, setLoadingProductoLookups, setLoadingProductos, setLoadingPuntos, setLoadingRetenciones, setMenuMessage, setMenuOpen, setMenus, setNotaCreditoCliente, setNotaCreditoClientes, setNotaCreditoFactura, setNotaCreditoFacturas, setNotaCreditoForm, setNotaCreditoLineas, setNotaCreditoPreparacion, setNotaDebitoCliente, setNotaDebitoFactura, setNotaDebitoFacturas, setNotaDebitoForm, setNotaDebitoLineas, setNotaDebitoPreparacion, setNotasCreditoList, setNotasDebitoList, setNotifications, setNotificationsMessage, setNotificationsOpen, setOperationalCounts, setOperationalForm, setOperationalFormMode, setOperationalItems, setOperationalTabByView, setPdfPositionDragging, setPdfPreview, setPerfilData, setPerfilForm, setPortalServiceQuery, setProcessingNotaCreditoAutomatica, setProductoCategoriaFiltro, setProductoEstadoFiltro, setProductoForm, setProductoFormMode, setProductoLookups, setProductoSubcategoriaFiltro, setProductoTipoFiltro, setProductos, setProvincias, setPuntoForm, setPuntoFormMode, setPuntosData, setReloadKey, setRetencionesIvaCatalogo, setRetencionesList, setRetencionesRentaCatalogo, setSavingCategoria, setSavingCliente, setSavingEmisor, setSavingFactura, setSavingGuia, setSavingLiquidacion, setSavingLiquidacionRetencion, setSavingNotaCredito, setSavingNotaDebito, setSavingOperational, setSavingPerfil, setSavingProducto, setSavingPunto, setSearch, setSelectedCategoria, setSelectedCliente, setSelectedEmisor, setSelectedOperationalItem, setSelectedProducto, setSelectedPunto, setSelectedSubcategoria, setSequencePrompt, setSequencePromptMessage, setSequencePromptSaving, setSubcategoriaCategoriaFiltro, setSubcategoriaForm, setSubcategoriaFormMode, setSubcategorias, setSubcategoriasProducto, setViewingCategoria, setViewingCliente, setViewingEmisor, setViewingFirma, setViewingProducto, setViewingSubcategoria, sharePdf, showAdminItemDetail, showAuthorizationAlert, showOperationalItemDetail, sincronizarERubricaPendientes, styles, subcategoriaCategoriaFiltro, subcategoriaForm, subcategoriaFormMode, subcategorias, subcategoriasProducto, syncDocumentSequence, toggleMenuSection, tryAuthorizeAfterSave, unreadNotifications, updateCategoriaForm, updateClienteForm, updateEmisorForm, updateFacturaForm, updateFacturaLinea, updateGuiaDetalle, updateGuiaForm, updateLiquidacionForm, updateLiquidacionLinea, updateNotaCreditoForm, updateNotaCreditoLinea, updateNotaDebitoForm, updateNotaDebitoLinea, updateOperationalForm, updatePerfilForm, updateProductoForm, updatePuntoForm, updateRechargeForm, updateSubcategoriaForm, userId, validateEmissionPrerequisites, validateFacturaDraft, viewingCategoria, viewingCliente, viewingEmisor, viewingFirma, viewingProducto, viewingSubcategoria, vigenciaFirmaERubrica, visibleNotifications } = context;
  const { hasEmissionPoint, hasDocumentsAvailable, initialSetupComplete, initialSetupLoading } = context;
  const botWorkflow = context.botWorkflow;
  const setBotWorkflow = context.setBotWorkflow;
  const privacyReturnView = context.privacyReturnView as 'perfil' | 'perfil-e-rubrica' | undefined;
  const drawerMenu = context.drawerMenu;
  const getWorkspaceTitle = context.getWorkspaceTitle;
  const checkingGuia = context.checkingGuia;
  const emisorToForm = context.emisorToForm;
  const getNotaCreditoPdf = context.getNotaCreditoPdf;
  const getNotaCreditoXml = context.getNotaCreditoXml;
  const getNotaDebitoPdf = context.getNotaDebitoPdf;
  const getNotaDebitoXml = context.getNotaDebitoXml;
  const getLiquidacionCompraPdf = context.getLiquidacionCompraPdf;
  const getLiquidacionCompraXml = context.getLiquidacionCompraXml;
  const renderBusinessDrawerNode = (node: any, inset = false) => {
    const active = isDrawerNodeActive(node);
    const enabledChildren = node.children?.filter((child: any) => !child.disabled) ?? [];
    const disabled = node.disabled && enabledChildren.length === 0;
    const hasChildren = Boolean(node.children?.length);
    const expanded = hasChildren && (expandedMenus.has(node.key) || (!isERubricaWorkspace && active));

    return (
      <View key={node.key} style={node.children?.length ? styles.menuSection : undefined}>
        <MenuItem
          accentColor={isERubricaWorkspace ? ERUBRICA_COLORS.primary : undefined}
          active={active}
          disabled={disabled}
          expanded={expanded}
          hasChildren={hasChildren}
          icon={node.icon}
          inset={inset}
          label={node.label}
          onToggle={() => toggleMenuSection(node.key)}
          onPress={() => {
            if (hasChildren && !node.view) {
              toggleMenuSection(node.key);
              return;
            }
            if (node.action && !disabled) node.action();
            else if (node.view && !disabled) openView(node.view);
          }}
        />
        {expanded ? (
          <View style={styles.menuChildren}>
            {node.children?.map((child: any) => renderBusinessDrawerNode(child, true))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.workspaceSafeArea, activeView === 'portal' && styles.portalSafeArea, isERubricaWorkspace && styles.erubricaSafeArea]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
      <View style={styles.workspaceChrome}>
        <GlobalWorkspaceHeader
          title={activeView === 'e-rubrica' ? getERubricaTabTitle(erubricaTabRequest ?? 'inicio') : getWorkspaceTitle(activeView)}
          subtitle={activeView === 'firma' ? 'Gestiona tu firma y certificados' : activeView === 'portal' ? 'Selecciona tu servicio' : activeView === 'perfil-e-rubrica' ? 'Mi cuenta de firma electronica' : ''}
          unreadNotifications={unreadNotifications}
          documentPlan={documentPlan}
          firmaSummary={firmaResumenVisible}
          portalMode={activeView === 'portal'}
          erubricaMode={isERubricaWorkspace}
          onSearch={() => { setGlobalSearchQuery(''); setGlobalSearchOpen(true); }}
          onNotifications={() => setNotificationsOpen(true)}
          onMenu={() => setMenuOpen(true)}
          onDocuments={() => openView('comprar-documentos')}
          onFirma={() => isERubricaWorkspace ? openERubricaTab('nueva-solicitud') : openView('firma')}
          onLogout={onLogout}
        />

        <View style={styles.workspaceBodyFrame}>
        {activeView !== 'bot' ? <ScrollView
          style={styles.workspaceBodyScroll}
          scrollEnabled={!pdfPositionDragging}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.workspaceCanvasWithBottomNav, activeView === 'dashboard' && styles.efactHomeWorkspaceCanvas, { paddingBottom: activeView === 'portal' ? 20 + insets.bottom : BOTTOM_NAV_CONTENT_INSET + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          nestedScrollEnabled
          automaticallyAdjustKeyboardInsets={activeView !== 'bot'}
          horizontal={false}
          bounces={false}
          alwaysBounceHorizontal={false}
          directionalLockEnabled
          overScrollMode="never"
          refreshControl={<RefreshControl refreshing={loadingMenus} onRefresh={() => setReloadKey((value: number) => value + 1)} tintColor={isERubricaWorkspace ? ERUBRICA_COLORS.primary : EFACT_THEME.colors.primary} colors={[isERubricaWorkspace ? ERUBRICA_COLORS.primary : EFACT_THEME.colors.primary]} />}
        >
        <ScreenTransition key={activeView} reduceMotion={reduceMotion}>
        {menuMessage ? <MessageBox message={menuMessage} /> : null}

        {loadingMenus && activeView !== 'dashboard' ? (
          <View style={styles.directoryLoading}>
            <ActivityIndicator color="#0072BD" />
            <Text style={styles.mutedText}>Cargando menus autorizados...</Text>
          </View>
        ) : null}

        {!loadingMenus && activeView === 'portal' ? (
          <View style={styles.portalStack}>
            <View style={styles.portalServicesPanel}>
              <View style={styles.portalWebHero}>
                <View style={styles.portalWebHeroShapeTop} />
                <View style={styles.portalWebHeroShapeBottom} />
                <View style={styles.portalWebTitleRow}>
                  <View style={styles.portalWebLogoShell}>
                    <Image source={{ uri: resolveImageUrl(portalAvatarUrl) }} style={styles.portalWebLogo} />
                  </View>
                  <View style={styles.portalWebTitleCopy}>
                    <Text style={styles.portalWelcomeEyebrow}>Numerica Software</Text>
                    <Text style={styles.portalWebTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>Te damos la bienvenida, {portalFirstName}</Text>
                    <Text style={styles.portalWebSubtitle}>Tus servicios activos estan listos para usarse</Text>
                  </View>
                </View>
              </View>

              <View style={styles.portalServicesHeader}>
                <Text style={styles.portalServicesTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>Mis servicios</Text>
                <View style={styles.portalSearchPill}>
                  <MaterialCommunityIcons name="magnify" size={19} color="#61738A" />
                  <TextInput
                    style={styles.portalSearchInput}
                    value={portalServiceQuery}
                    onChangeText={setPortalServiceQuery}
                    placeholder="Buscar servicio..."
                    placeholderTextColor="#63758B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                </View>
              </View>

              <View style={styles.portalServiceGrid}>
                {filteredPortalServiceCards.map((service: any, index: number) => (
                  <PortalServiceCard
                    key={service.title}
                    title={service.title}
                    description={service.description}
                    enabled={service.enabled}
                    onPress={service.onPress}
                    index={index}
                  />
                ))}
              </View>
              {filteredPortalServiceCards.length === 0 ? <Text style={styles.portalEmptySearchText}>No encontramos servicios con ese nombre.</Text> : null}
            </View>
          </View>
        ) : null}

        {!loadingMenus && activeView === 'no-autorizado' ? (
          <EmptyState
            title="No autorizado"
            text="Tu usuario no tiene permisos suficientes para acceder a esta ruta desde la app movil."
          />
        ) : null}

        {activeView === 'dashboard' ? (
          <ExtractedDashboardHomeScreen
            facturas={facturasList}
            initialSetup={{
              loading: initialSetupLoading,
              issuer: hasActiveEmisor && hasEmissionPoint,
              signature: hasConfiguredFirma,
              documents: hasDocumentsAvailable,
              documentLabel: documentPlan.unlimited ? 'Plan ilimitado activo' : `${documentPlan.label} disponibles`,
            }}
            onOpenView={(view: any) => openView(view as WorkspaceView)}
            onOpenERubricaRequest={() => openERubricaTab('nueva-solicitud')}
            onOpenVoice={() => openView('bot')}
          />
        ) : null}

        {!loadingMenus && activeView === 'cotizaciones' ? (
          <CotizacionesMobileScreen
            userId={userId}
            onValidateEmission={validateEmissionPrerequisites}
            onPdf={(cotizacion) => void openPdfInDeviceViewer(async () => getCotizacionPdfUrl(userId, cotizacion.id), `${cotizacion.titulo}.pdf`)}
            onSharePdf={(cotizacion) => void sharePdf(async () => getCotizacionPdfUrl(userId, cotizacion.id), `${cotizacion.titulo}.pdf`)}
          />
        ) : null}

        {!loadingMenus && activeView === 'e-rubrica' ? (
          <ERubricaMobileScreen
            data={erubricaData}
            puedeFirmarSinPlan={isSuperAdmin(currentUser) || hasDocumentsAvailable}
            initialPdf={erubricaInitialPdf}
            requestedTab={erubricaTabRequest}
            loading={loadingErubrica}
            message={directoryMessage}
            onTabChange={setErubricaTabRequest}
            onRefresh={() => setReloadKey((value: number) => value + 1)}
            onPreviewPdf={(file: any) => setPdfPreview({ uri: file.uri, name: file.name || 'Documento PDF' })}
            onPreviewRemotePdf={(urlOrPath: any, fileName: string) => openPdfPreview(async () => urlOrPath, fileName)}
            onDownloadRemotePdf={(urlOrPath: any, fileName: string) => downloadPdf(async () => urlOrPath, fileName)}
            onOpenBot={() => setErubricaTabRequest('asistente')}
            onPdfPositionDragChange={setPdfPositionDragging}
            voiceControlsRef={botVoiceControlsRef}
            userName={portalFirstName}
            userId={userId}
            solicitudPrefill={{
              nombres: perfilForm.nombres,
              apellidos: perfilForm.apellidos,
              identificacion: perfilForm.identificacion,
              correo: perfilForm.email,
              celular: perfilForm.celular,
            }}
            onSync={async () => {
              try {
                await sincronizarERubricaPendientes();
                setDirectoryMessage({ type: 'success', text: 'Solicitudes pendientes sincronizadas.' });
                setReloadKey((value: number) => value + 1);
              } catch (error: any) {
                setDirectoryMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo sincronizar E-RÚBRICA.' });
              }
            }}
          />
        ) : null}

        {!loadingMenus && activeView === 'politica-privacidad' ? (
          <PrivacyPolicyScreen onClose={() => openView(privacyReturnView ?? 'perfil')} />
        ) : null}

        {!loadingMenus && activeView !== 'portal' && activeView !== 'dashboard' && activeView !== 'e-rubrica' && activeView !== 'cotizaciones' && activeView !== 'no-autorizado' && activeView !== 'politica-privacidad' ? (
          <>
           <DirectoryWorkspace context={{
             activeView,
             clienteForm,
             clienteFormMode,
             savingCliente,
             clienteLookups,
             provincias,
             ciudades,
             loadingClienteLookups,
             closeClienteForm,
             updateClienteForm,
             initialClienteForm,
             setClienteForm,
             saveCliente,
             openNewCliente,
             clientes,
             clientesActivos,
             clientesProveedores,
             filteredClientes,
             search,
             setSearch,
             clienteTipoFiltro,
             clienteProveedorFiltro,
             clienteEstadoFiltro,
             setClienteTipoFiltro,
             setClienteProveedorFiltro,
             setClienteEstadoFiltro,
             exportRowsToCsv,
             getClienteDisplayName,
             getTipoClienteLabel,
             getClienteEmail,
             getClienteFacturaStats,
             facturasList,
             setViewingCliente,
             openEditCliente,
             confirmDeleteCliente,
             loadingClientes,
             productoForm,
             productoFormMode,
             savingProducto,
             productoLookups,
             subcategoriasProducto,
             loadingProductoLookups,
             loadingProductoDetail,
             closeProductoForm,
             updateProductoForm,
             initialProductoForm,
             setProductoForm,
             saveProducto,
             openNewProducto,
             productos,
             filteredProductos,
             productoTipoFiltro,
             productoCategoriaFiltro,
             productoSubcategoriaFiltro,
             productoEstadoFiltro,
             productoCategoriasFiltro,
             productoSubcategoriasFiltro,
             setProductoTipoFiltro,
             setProductoCategoriaFiltro,
             setProductoSubcategoriaFiltro,
             setProductoEstadoFiltro,
             setViewingProducto,
             openEditProducto,
             confirmDeleteProducto,
             loadingProductos,
             categoriaForm,
             categoriaFormMode,
             savingCategoria,
             closeCategoriaForm,
             updateCategoriaForm,
             setCategoriaForm,
             initialCategoriaForm,
             saveCategoria,
             subcategoriaForm,
             subcategoriaFormMode,
             categorias,
             closeSubcategoriaForm,
             updateSubcategoriaForm,
             setSubcategoriaForm,
             initialSubcategoriaForm,
             saveSubcategoria,
             subcategorias,
             categoriaTab,
             setCategoriaTab,
             subcategoriaCategoriaFiltro,
             setSubcategoriaCategoriaFiltro,
             filteredCategorias,
             filteredSubcategorias,
             setViewingCategoria,
             openEditCategoria,
             confirmDeleteCategoria,
             setViewingSubcategoria,
             openEditSubcategoria,
             confirmDeleteSubcategoria,
             emisorForm,
             emisorFormMode,
             savingEmisor,
             closeEmisorForm,
             updateEmisorForm,
             selectedEmisor,
             initialEmisorForm,
             selectEmisorLogo,
             consultarSriEmisor,
             consultandoSriEmisor,
             saveEmisor,
             openNewEmisor,
             hasActiveEmisor,
             emisores,
             hasFirmaConfigured,
             loadingEmisores,
             setViewingEmisor,
             openEditEmisor,
             confirmDeleteEmisor,
             firmaEstados,
             openAddFirma,
             hasConfiguredFirma,
             loadingFirma,
             clearFirmaFields,
             selectFirmaArchivo,
             setViewingFirma,
             openFirmaForm,
             confirmDeleteFirma,
             perfilForm,
             perfilData,
             loadingPerfil,
             savingPerfil,
             updatePerfilForm,
             perfilToForm,
             setPerfilForm,
             selectPerfilAvatar,
             selectInitialsPerfilAvatar,
             selectPresetPerfilAvatar,
             savePerfil,
             AVATARS,
             avatarImageSource,
             resolveImageUrl,
             getInitials,
             isInitialsAvatar,
             isPersonalPhoto,
             puntosData,
             loadingPuntos,
             puntoForm,
             puntoFormMode,
             savePunto,
             openNewPunto,
             closePuntoForm,
             updatePuntoForm,
             selectedPunto,
             getNextPuntoCode,
             puntoToForm,
             openEditPunto,
             confirmDeletePunto,
             makePuntoPrincipal,
             reloadKey,
             facturaForm,
             facturaPreparacion,
             facturaCliente,
             facturaClientes,
             facturaProductos,
             facturaLineas,
             loadingFacturas,
             savingFactura,
             invoiceDraftSaved,
             updateFacturaForm,
             searchFacturaClientes,
             setFacturaCliente,
             setFacturaClientes,
             getTipoIdentificacionLabel,
             getClienteIdentification,
             setFacturaForm,
             searchFacturaProductos,
             addFacturaProducto,
             updateFacturaLinea,
             removeFacturaLinea,
             clearFacturaForm,
             openView,
             saveNuevaFactura,
             notasCreditoList,
             getFacturaDetalle,
             getFacturaPdf,
             openOrDownloadPdf,
             openPdfInDeviceViewer,
             sharePdf,
             getFacturaXml,
             openFacturaAsset,
             sendFacturaCorreo,
             retryFacturaSri,
             confirmAnularFactura,
             openFacturaCuentasCobrar,
             emitirNotaCreditoAutomaticaDesdeFactura,
             notaCreditoForm,
             notaCreditoPreparacion,
             notaCreditoFactura,
             notaCreditoFacturas,
             notaCreditoCliente,
             notaCreditoClientes,
             notaCreditoLineas,
             loadingNotasCredito,
             savingNotaCredito,
             updateNotaCreditoForm,
             fillNotaCreditoCliente,
             searchNotaCreditoFacturas,
             selectNotaCreditoFactura,
             importNotaCreditoXml,
             updateNotaCreditoLinea,
             removeNotaCreditoLinea,
             clearNotaCreditoForm,
             saveNuevaNotaCredito,
             emitNotaCreditoSri,
              confirmAnularNotaCredito,
              notaDebitoForm,
              notaDebitoPreparacion,
              notaDebitoFactura,
              notaDebitoFacturas,
              notaDebitoLineas,
              notasDebitoList,
              loadingNotasDebito,
             savingNotaDebito,
             updateNotaDebitoForm,
             searchNotaDebitoFacturas,
             selectNotaDebitoFactura,
             importNotaDebitoXml,
             updateNotaDebitoLinea,
             clearNotaDebitoForm,
             saveNuevaNotaDebito,
             emitNotaDebitoSri,
             confirmAnularNotaDebito,
             liquidacionForm,
             liquidacionPreparacion,
             liquidacionProveedor,
             liquidacionProveedores,
             liquidacionProductos,
             liquidacionLineas,
             loadingLiquidaciones,
             savingLiquidacion,
             liquidacionRetencion,
             retencionesIvaCatalogo,
             retencionesRentaCatalogo,
             loadingLiquidacionRetencion,
             savingLiquidacionRetencion,
             updateLiquidacionForm,
             searchLiquidacionProveedores,
             selectLiquidacionProveedor,
             searchLiquidacionProductos,
             addLiquidacionProducto,
             updateLiquidacionLinea,
             removeLiquidacionLinea,
             clearLiquidacionForm,
             saveNuevaLiquidacion,
             saveRetencionLiquidacion,
             continuarRetencionLiquidacion,
             guiaForm,
             guiaPreparacion,
             guiaTransportista,
             guiaTransportistas,
             guiaCliente,
             guiaClientes,
             guiaFactura,
             guiaFacturas,
             guiaProductos,
             guiaDetalles,
             loadingGuias,
             loadingGuiaSearch,
             savingGuia,
             updateGuiaForm,
             searchGuiaTransportistas,
             selectGuiaTransportista,
             searchGuiaClientes,
             selectGuiaCliente,
             searchGuiaFacturas,
             selectGuiaFactura,
             searchGuiaProductos,
             addGuiaProducto,
             updateGuiaDetalle,
             removeGuiaDetalle,
             clearGuiaForm,
             saveNuevaGuia,
             guiasList,
             getGuiaRemisionPdf,
             getGuiaRemisionXml,
             sendGuiaCorreo,
             emitGuiaSri,
             confirmAnularGuia,
             retencionesList,
             loadingRetenciones,
             getRetencionPdf,
             getRetencionXml,
             openKnownDocumentAsset,
             sendRetencionCorreo,
             emitRetencionSri,
             portalFirstName,
             userId,
             botVoiceControlsRef,
             handleBotNavigate,
             botMessages,
             setBotMessages,
             botDraft,
             setBotDraft,
             botFeedbackByMessage,
             setBotFeedbackByMessage,
             directoryMessage,
             openNewCategoria,
             openNewSubcategoria,
             loadingCategorias,
             setEmisorForm,
             emisorToForm,
             savingPunto,
             setPuntoForm,
             catalogUserId,
             processingNotaCreditoAutomatica,
             searchNotaCreditoClientes,
             notaDebitoCliente,
             getNotaCreditoPdf,
             getNotaCreditoXml,
             sendNotaCreditoCorreo,
             getNotaDebitoPdf,
             getNotaDebitoXml,
             sendNotaDebitoCorreo,
             setLiquidacionRetencion,
             liquidacionesList,
             getLiquidacionCompraPdf,
             getLiquidacionCompraXml,
             sendLiquidacionCorreo,
             emitLiquidacionSri,
             setActiveView,
             adminItems,
             loadingAdminItems,
             adminTabByView,
             setAdminTabByView,
             showAdminItemDetail,
             checkingGuia,
             setReloadKey,
           }} />
            {isOperationalMobileView(activeView) ? (
              activeView === 'comprar-documentos' ? (
                <ExtractedPurchaseDocumentsScreen
                  form={operationalForm}
                  saving={savingOperational}
                  message={directoryMessage}
                onChange={updateRechargeForm}
                onSelectPlan={selectRechargePlan}
                onSave={saveOperational}
               />
              ) : (
                <OperationalModuleScreen
                view={activeView}
                search={search}
                items={operationalItems}
                loading={loadingOperationalItems}
                saving={savingOperational}
                message={directoryMessage}
                activeTab={operationalTabByView[activeView]}
                formMode={operationalFormMode}
                form={operationalForm}
                onRefresh={() => setReloadKey((value: number) => value + 1)}
                onSearch={setSearch}
                onTabChange={(tab: any) => {
                  closeOperationalForm();
                  setOperationalTabByView((current: any) => ({ ...current, [activeView]: tab }));
                }}
                onCreate={openNewOperational}
                onCancel={closeOperationalForm}
                onChange={updateOperationalForm}
                onSave={saveOperational}
                onView={showOperationalItemDetail}
                onEdit={openEditOperational}
                onDelete={confirmDeleteOperational}
                onRegisterPayment={openAccountPaymentFromStatement}
                onDownloadStatementFile={downloadEstadoCuentaFile}
                />
              )
            ) : null}

          </>
        ) : null}
        </ScreenTransition>

        </ScrollView> : null}
        {canUseEfact && !isERubricaWorkspace ? (
          <EfactBotScreen
            voiceOnly={activeView !== 'bot'}
            embedded={activeView === 'bot'}
            viewKey={activeView}
            bottomInset={activeView === 'bot' ? BOTTOM_NAV_CONTENT_INSET + insets.bottom : 0}
            userName={portalFirstName}
            userId={userId}
            reduceMotion={reduceMotion}
            voiceControlsRef={botVoiceControlsRef}
            onNavigate={handleBotNavigate}
            messages={botMessages}
            setMessages={setBotMessages}
            draft={botDraft}
            setDraft={setBotDraft}
            feedbackByMessage={botFeedbackByMessage}
            setFeedbackByMessage={setBotFeedbackByMessage}
            workflow={botWorkflow}
            onWorkflowChange={setBotWorkflow}
          />
        ) : null}
        </View>
      </View>
      </KeyboardAvoidingView>
      {activeView !== 'portal' ? (
        <PortalBottomNav
          bottomInset={insets.bottom}
           activeView={activeView === 'e-rubrica' ? `e-rubrica-${erubricaTabRequest ?? 'inicio'}` : activeView}
           mode={isERubricaWorkspace ? 'erubrica' : 'efact'}
           onServices={() => canUsePortal ? openView('portal') : setMenuOpen(true)}
          onHome={() => isERubricaWorkspace ? openView('e-rubrica') : openView('dashboard')}
          onNew={() => openView(initialSetupComplete ? 'nueva-factura' : 'dashboard')}
          onFirma={() => isERubricaWorkspace ? setMenuOpen(true) : openView('firma')}
          onProfile={() => isERubricaWorkspace ? openView('perfil-e-rubrica') : openView('perfil')}
          onMenu={() => setMenuOpen(true)}
          onSolicitudes={() => openERubricaTab('nueva-solicitud')}
          onFirmar={() => openERubricaTab('firmar')}
          onValidar={() => openERubricaTab('validar')}
        />
      ) : null}
      <InitialSequenceModal
        visible={Boolean(sequencePrompt)}
        documentLabel={sequencePrompt?.documentLabel ?? 'documentos'}
        serie={sequencePrompt?.serie ?? ''}
        saving={sequencePromptSaving}
        message={sequencePromptMessage}
        onClose={() => {
          setSequencePrompt(null);
          setSequencePromptMessage(null);
        }}
        onSave={saveInitialSequence}
      />
      <ItemDetailModal
        visible={Boolean(viewingCliente)}
        title={viewingCliente ? getClienteDisplayName(viewingCliente) : 'Cliente'}
        values={viewingCliente ? getClienteDetailValues(viewingCliente, getTipoClienteLabel(viewingCliente.tipoCliente, clienteLookups), facturasList) : []}
        onClose={() => setViewingCliente(null)}
      />
      <ItemDetailModal
        visible={Boolean(viewingProducto)}
        title={viewingProducto?.nombre || 'Producto'}
        values={viewingProducto ? getProductoDetailValues(viewingProducto) : []}
        onClose={() => setViewingProducto(null)}
      />
      <ItemDetailModal
        visible={Boolean(viewingCategoria)}
        title={viewingCategoria?.descripcion || 'Categoria'}
        values={viewingCategoria ? [`Estado: ${viewingCategoria.estado === false ? 'Inactiva' : 'Activa'}`] : []}
        onClose={() => setViewingCategoria(null)}
      />
      <ItemDetailModal
        visible={Boolean(viewingSubcategoria)}
        title={viewingSubcategoria?.descripcion || 'Subcategoria'}
        values={viewingSubcategoria ? [
          `Categoria: ${viewingSubcategoria.categoriaDescripcion ?? categorias.find((categoria: any) => categoria.idCategoria === viewingSubcategoria.idCategoria)?.descripcion ?? 'Sin categoria asociada'}`,
          `Estado: ${viewingSubcategoria.estado === false ? 'Inactiva' : 'Activa'}`,
        ] : []}
        onClose={() => setViewingSubcategoria(null)}
      />
      <ItemDetailModal
        visible={Boolean(viewingEmisor)}
        title={viewingEmisor?.razonSocial || viewingEmisor?.nomComercial || 'Emisor'}
        values={viewingEmisor ? getEmisorDetailValues(viewingEmisor) : []}
        onClose={() => setViewingEmisor(null)}
      />
      <ItemDetailModal
        visible={Boolean(viewingFirma)}
        title={viewingFirma?.razonSocial || viewingFirma?.nomComercial || 'Firma'}
        values={viewingFirma ? getFirmaDetailValues(viewingFirma, firmaEstados[viewingFirma.codigo]) : []}
        onClose={() => setViewingFirma(null)}
      />
      <Modal visible={notificationsOpen} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setNotificationsOpen(false)}>
        <View style={styles.notificationsOverlay}>
          <Pressable style={styles.notificationsBackdrop} onPress={() => setNotificationsOpen(false)} />
          <View style={[styles.notificationsPanel, { marginTop: Math.max(16, insets.top + 12), marginBottom: Math.max(16, insets.bottom + 12) }]}>
            <View style={styles.notificationsHeader}>
              <View>
                <Text style={styles.notificationsTitle}>NOTIFICACIONES</Text>
                <Text style={styles.notificationsSubtitle}>{loadingNotifications ? 'Cargando actividad...' : `${visibleNotifications.length} registros del sistema`}</Text>
              </View>
              <View style={styles.notificationsHeaderActions}>
                {visibleNotifications.length > 0 ? (
                  <Pressable style={styles.notificationsClearButton} onPress={clearVisibleNotifications}>
                    <Text style={styles.notificationsClearText}>Borrar todo</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.menuCloseButton} onPress={() => setNotificationsOpen(false)}>
                  <Text style={styles.menuCloseText}>×</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsList}>
              {notificationsMessage ? <MessageBox message={notificationsMessage} /> : null}
              {loadingNotifications ? (
                <View style={styles.notificationsLoading}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.notificationText}>Cargando notificaciones...</Text>
                </View>
              ) : null}
              {!loadingNotifications && !visibleNotifications.length && !notificationsMessage ? (
                <View style={styles.notificationEmpty}>
                  <Text style={styles.notificationTitle}>Sin notificaciones</Text>
                  <Text style={styles.notificationText}>No hay actividad pendiente para mostrar.</Text>
                </View>
              ) : null}
              {!loadingNotifications ? visibleNotifications.map((notification: any) => {
                const tone = getNotificationTone(notification);
                const targetView = getNotificationView(notification);
                const itemToneStyle = tone === 'danger'
                  ? styles.notificationItemDanger
                  : tone === 'warning'
                    ? styles.notificationItemWarning
                    : tone === 'success'
                      ? styles.notificationItemSuccess
                      : styles.notificationItemInfo;
                const bulletToneStyle = tone === 'danger'
                  ? styles.notificationBulletDanger
                  : tone === 'warning'
                    ? styles.notificationBulletWarning
                    : tone === 'success'
                      ? styles.notificationBulletSuccess
                      : styles.notificationBulletInfo;
                return (
                <View key={notification.id} style={[styles.notificationItem, itemToneStyle, notification.read && styles.notificationItemRead]}>
                  <View style={[styles.notificationBullet, bulletToneStyle]} />
                  <View style={styles.notificationCopy}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationText}>{notification.text}</Text>
                    {notification.date ? <Text style={styles.notificationMeta}>{notification.date}</Text> : null}
                    <View style={styles.notificationActions}>
                      {targetView ? (
                        <Pressable style={styles.notificationActionPrimary} onPress={() => openNotificationTarget(notification)}>
                          <Text style={styles.notificationActionPrimaryText}>Ir</Text>
                        </Pressable>
                      ) : null}
                      <Pressable style={styles.notificationActionGhost} onPress={() => dismissNotification(notification.id)}>
                        <Text style={styles.notificationActionGhostText}>Descartar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
              }) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <ExtractedGlobalSearchModal
        visible={globalSearchOpen}
        query={globalSearchQuery}
        results={globalSearchResults}
        onChangeQuery={setGlobalSearchQuery}
        onClose={() => setGlobalSearchOpen(false)}
        onOpenResult={(result: any) => { setGlobalSearchOpen(false); openView(result.view as WorkspaceView); }}
      />
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <Animated.View style={[styles.menuBackdropWrap, { opacity: drawerProgress }]}>
            <Pressable accessibilityLabel="Cerrar menu" accessibilityRole="button" style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.menuDrawer,
              { transform: [{ translateX: drawerProgress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] },
            ]}
          >
            <View style={[styles.menuHeader, isERubricaWorkspace && styles.erubricaMenuHeader]}>
              <View>
                <Text style={styles.menuTitle}>Menu</Text>
                <Text style={[styles.menuSubtitle, isERubricaWorkspace && styles.erubricaMenuSubtitle]}>{isERubricaWorkspace ? 'E-RÚBRICA' : 'Numérica Software'}</Text>
              </View>
              <Pressable accessibilityLabel="Cerrar menu" accessibilityRole="button" hitSlop={6} style={[styles.menuCloseButton, isERubricaWorkspace && styles.erubricaMenuCloseButton]} onPress={() => setMenuOpen(false)}>
                <Text style={styles.menuCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.menuList} showsVerticalScrollIndicator={false}>
              {drawerMenu.map((node: any) => renderBusinessDrawerNode(node))}
            </ScrollView>
            <Pressable
              accessibilityLabel="Cerrar sesion"
              accessibilityRole="button"
              style={styles.menuLogoutButton}
              onPress={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              <Text style={styles.menuLogoutText}>Salir</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
      <Modal visible={Boolean(pdfPreview)} animationType="slide" transparent onRequestClose={() => setPdfPreview(null)}>
        <View style={styles.pdfPreviewOverlay}>
          <View style={styles.pdfPreviewPanel}>
            <View style={styles.pdfPreviewHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pdfPreviewEyebrow}>PREVISUALIZACIÓN</Text>
                <Text style={styles.pdfPreviewTitle} numberOfLines={1}>{pdfPreview?.name ?? 'Documento PDF'}</Text>
              </View>
              <Pressable style={styles.menuCloseButton} onPress={() => setPdfPreview(null)}><Text style={styles.menuCloseText}>×</Text></Pressable>
            </View>
            {pdfPreview ? <PdfDocumentPreview uri={pdfPreview.uri} /> : null}
            <View style={styles.pdfPreviewActions}>
              <SecondaryButton label="Cerrar" onPress={() => setPdfPreview(null)} />
              <SecondaryButton label="Compartir PDF" onPress={async () => {
                if (!pdfPreview || !(await Sharing.isAvailableAsync())) return;
                await Sharing.shareAsync(pdfPreview.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir PDF' });
              }} />
              <PrimaryButton label="Abrir con otra app" loading={false} onPress={openPdfWithExternalViewer} />
            </View>
          </View>
        </View>
      </Modal>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
