import { Image, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { styles } from '../../styles/appStyles';
import type { CategoriaCatalogo, Cliente, Emisor, FirmaEstado, Producto, ProductoTipo, SubcategoriaCatalogo } from '../../types/business';
import { DirectoryTabButton } from '../ui/FormShared';
import { EmptyState } from '../ui/FeedbackStates';
import { MessageBox, SearchField } from '../ui/FormControls';
import { ResultCollection } from '../data/ResultCollection';
import { ClienteForm as ExtractedClienteForm } from '../clientes/ClienteForm';
import { CatalogCard, SubcategoriaCard } from '../catalog/CatalogCards';
import { CategoriaCard, ClienteCard, EmisorCard, FirmaCard, ProductoCard } from './DirectoryCards';
import { CategoriaForm, EmisorForm, FirmaForm, ProductoForm, SubcategoriaForm } from './DirectoryForms';
import { PuntosEmisionScreen } from '../puntos/PuntosEmisionScreen';
import { AdminModuleScreen } from '../admin/AdminModuleScreen';
import { isAdminMobileView } from '../admin/AdminModuleScreen';
import { isOperationalMobileView } from '../operational/OperationalModuleScreen';
import { NuevaFacturaMobileScreen } from '../facturacion/NuevaFacturaMobileScreen';
import { NuevaNotaCreditoMobileScreen } from '../facturacion/NuevaNotaCreditoMobileScreen';
import { NuevaNotaDebitoMobileScreen } from '../facturacion/NuevaNotaDebitoMobileScreen';
import { MisFacturasMobileScreen, MisGuiasRemisionMobileScreen, MisLiquidacionesCompraMobileScreen, MisNotasCreditoMobileScreen, NuevaGuiaRemisionMobileScreen, NuevaLiquidacionCompraMobileScreen, RetencionLiquidacionMobileScreen } from '../documents/DocumentHistoryScreens';
import { MisNotasDebitoMobileScreen } from '../documents/MisNotasDebitoMobileScreen';
import { MisRetencionesMobileScreen } from '../documents/DocumentHistoryScreens';
import { DirectoryHero } from './DirectoryHero';
import { PerfilForm } from '../perfil/PerfilForm';
import { getClienteDisplayName, getClienteEmail, getClienteIdentification } from '../../utils/clientDisplay';
import { getClienteFacturaStats, getTipoIdentificacionLabel } from '../../utils/workspaceData';
import { hasFirmaConfigured } from '../../utils/emisorDisplay';

type DirectoryWorkspaceContext = any;

const directoryViewsWithContent = new Set([
  'nuevo-cliente', 'clientes', 'nuevo-producto', 'productos', 'nueva-categoria', 'nueva-subcategoria', 'categorias',
  'nuevo-emisor', 'emisor', 'nueva-firma', 'firma', 'perfil', 'perfil-e-rubrica', 'punto-emision', 'nuevo-punto-emision',
  'nueva-factura', 'mis-facturas', 'nueva-nota-credito', 'mis-notas-credito', 'nueva-nota-debito', 'mis-notas-debito',
  'nueva-liquidacion-compra', 'mis-liquidaciones-compra', 'nueva-guia-remision', 'mis-guias-remision', 'retenciones',
]);

export function DirectoryWorkspace({ context }: { context: DirectoryWorkspaceContext }) {
  const { activeView, clienteForm, clienteFormMode, savingCliente, clienteLookups, provincias, ciudades, loadingClienteLookups, closeClienteForm, updateClienteForm, initialClienteForm, setClienteForm, saveCliente, openNewCliente, clientes, clientesActivos, clientesProveedores, filteredClientes, search, setSearch, clienteTipoFiltro, clienteProveedorFiltro, clienteEstadoFiltro, setClienteTipoFiltro, setClienteProveedorFiltro, setClienteEstadoFiltro, exportRowsToCsv, getClienteDisplayName, getTipoClienteLabel, getClienteEmail, getClienteFacturaStats, facturasList, setViewingCliente, openEditCliente, confirmDeleteCliente, loadingClientes, productoForm, productoFormMode, savingProducto, productoLookups, subcategoriasProducto, loadingProductoLookups, loadingProductoDetail, closeProductoForm, updateProductoForm, initialProductoForm, setProductoForm, saveProducto, openNewProducto, productos, filteredProductos, productoTipoFiltro, productoCategoriaFiltro, productoSubcategoriaFiltro, productoEstadoFiltro, productoCategoriasFiltro, productoSubcategoriasFiltro, setProductoTipoFiltro, setProductoCategoriaFiltro, setProductoSubcategoriaFiltro, setProductoEstadoFiltro, setViewingProducto, openEditProducto, confirmDeleteProducto, loadingProductos, categoriaForm, categoriaFormMode, savingCategoria, closeCategoriaForm, updateCategoriaForm, setCategoriaForm, initialCategoriaForm, saveCategoria, subcategoriaForm, subcategoriaFormMode, categorias, closeSubcategoriaForm, updateSubcategoriaForm, setSubcategoriaForm, initialSubcategoriaForm, saveSubcategoria, subcategorias, categoriaTab, setCategoriaTab, subcategoriaCategoriaFiltro, setSubcategoriaCategoriaFiltro, filteredCategorias, filteredSubcategorias, setViewingCategoria, openEditCategoria, confirmDeleteCategoria, setViewingSubcategoria, openEditSubcategoria, confirmDeleteSubcategoria, emisorForm, emisorFormMode, savingEmisor, closeEmisorForm, updateEmisorForm, selectedEmisor, initialEmisorForm, selectEmisorLogo, consultarSriEmisor, consultandoSriEmisor, saveEmisor, openNewEmisor, hasActiveEmisor, emisores, hasFirmaConfigured, loadingEmisores, setViewingEmisor, openEditEmisor, confirmDeleteEmisor, firmaEstados, openAddFirma, hasConfiguredFirma, loadingFirma, clearFirmaFields, selectFirmaArchivo, setViewingFirma, openFirmaForm, confirmDeleteFirma, perfilForm, perfilData, loadingPerfil, savingPerfil, updatePerfilForm, perfilToForm, setPerfilForm, selectPerfilAvatar, selectInitialsPerfilAvatar, selectPresetPerfilAvatar, savePerfil, AVATARS, avatarImageSource, resolveImageUrl, getInitials, isInitialsAvatar, isPersonalPhoto, puntosData, loadingPuntos, puntoForm, puntoFormMode, savePunto, openNewPunto, closePuntoForm, updatePuntoForm, selectedPunto, getNextPuntoCode, puntoToForm, openEditPunto, confirmDeletePunto, makePuntoPrincipal, reloadKey, facturaForm, facturaPreparacion, facturaCliente, facturaClientes, facturaProductos, facturaLineas, loadingFacturas, savingFactura, invoiceDraftSaved, updateFacturaForm, searchFacturaClientes, setFacturaCliente, setFacturaClientes, getTipoIdentificacionLabel, getClienteIdentification, setFacturaForm, searchFacturaProductos, addFacturaProducto, updateFacturaLinea, removeFacturaLinea, clearFacturaForm, openView, saveNuevaFactura, notasCreditoList, getFacturaDetalle, getFacturaPdf, openOrDownloadPdf, openPdfInDeviceViewer, sharePdf, getFacturaXml, openFacturaAsset, sendFacturaCorreo, retryFacturaSri, confirmAnularFactura, openFacturaCuentasCobrar, emitirNotaCreditoAutomaticaDesdeFactura, notaCreditoForm, notaCreditoPreparacion, notaCreditoFactura, notaCreditoFacturas, notaCreditoCliente, notaCreditoClientes, notaCreditoLineas, loadingNotasCredito, savingNotaCredito, updateNotaCreditoForm, fillNotaCreditoCliente, searchNotaCreditoFacturas, selectNotaCreditoFactura, importNotaCreditoXml, updateNotaCreditoLinea, removeNotaCreditoLinea, clearNotaCreditoForm, saveNuevaNotaCredito, emitNotaCreditoSri, confirmAnularNotaCredito, notaDebitoForm, notaDebitoPreparacion, notaDebitoFactura, notaDebitoFacturas, notaDebitoLineas, loadingNotasDebito, savingNotaDebito, updateNotaDebitoForm, searchNotaDebitoFacturas, selectNotaDebitoFactura, importNotaDebitoXml, updateNotaDebitoLinea, clearNotaDebitoForm, saveNuevaNotaDebito, emitNotaDebitoSri, confirmAnularNotaDebito, liquidacionForm, liquidacionPreparacion, liquidacionProveedor, liquidacionProveedores, liquidacionProductos, liquidacionLineas, loadingLiquidaciones, savingLiquidacion, liquidacionRetencion, retencionesIvaCatalogo, retencionesRentaCatalogo, loadingLiquidacionRetencion, savingLiquidacionRetencion, updateLiquidacionForm, searchLiquidacionProveedores, selectLiquidacionProveedor, searchLiquidacionProductos, addLiquidacionProducto, updateLiquidacionLinea, removeLiquidacionLinea, clearLiquidacionForm, saveNuevaLiquidacion, saveRetencionLiquidacion, continuarRetencionLiquidacion, nuevaGuia, guiaForm, guiaPreparacion, guiaTransportista, guiaTransportistas, guiaCliente, guiaClientes, guiaFactura, guiaFacturas, guiaProductos, guiaDetalles, loadingGuias, loadingGuiaSearch, checkingGuia, savingGuia, updateGuiaForm, searchGuiaTransportistas, selectGuiaTransportista, searchGuiaClientes, selectGuiaCliente, searchGuiaFacturas, selectGuiaFactura, searchGuiaProductos, addGuiaProducto, updateGuiaDetalle, removeGuiaDetalle, clearGuiaForm, saveNuevaGuia, guiasList, getGuiaRemisionPdf, getGuiaRemisionXml, sendGuiaCorreo, emitGuiaSri, confirmAnularGuia, retencionesList, loadingRetenciones, getRetencionPdf, getRetencionXml, openKnownDocumentAsset, sendRetencionCorreo, emitRetencionSri, retencionList } = context;
  const { portalFirstName, userId, botVoiceControlsRef, handleBotNavigate, botMessages, setBotMessages, botDraft, setBotDraft, botFeedbackByMessage, setBotFeedbackByMessage, directoryMessage, openNewCategoria, openNewSubcategoria, loadingCategorias, setEmisorForm, emisorToForm, savingPunto, setPuntoForm, setReloadKey, catalogUserId, processingNotaCreditoAutomatica, searchNotaCreditoClientes, getNotaCreditoPdf, getNotaCreditoXml, sendNotaCreditoCorreo, notaDebitoCliente, notasDebitoList, getNotaDebitoPdf, getNotaDebitoXml, sendNotaDebitoCorreo, setLiquidacionRetencion, liquidacionesList, getLiquidacionCompraPdf, getLiquidacionCompraXml, sendLiquidacionCorreo, emitLiquidacionSri, setActiveView, adminItems, loadingAdminItems, adminTabByView, setAdminTabByView, showAdminItemDetail } = context;
  return (
<View style={[styles.directoryCard, activeView === 'clientes' && styles.clientDirectoryCard]}>
             {activeView === 'nuevo-cliente' ? (
                <ExtractedClienteForm
                 form={clienteForm}
                 mode={clienteFormMode ?? 'create'}
                 saving={savingCliente}
                 lookups={clienteLookups}
                 provincias={provincias}
                 ciudades={ciudades}
                 loadingLookups={loadingClienteLookups}
                 onCancel={closeClienteForm}
                 onChange={updateClienteForm}
                 onReset={() => setClienteForm(initialClienteForm)}
                 onSave={saveCliente}
               />
             ) : activeView === 'clientes' ? (
               <>
                 <DirectoryHero
                   eyebrow="TU CARTERA COMERCIAL"
                   title="Clientes"
                   subtitle="Personas y empresas en un solo lugar"
                   icon="account-group-outline"
                   metrics={[
                     { value: clientes.length, label: 'Clientes' },
                     { value: clientesActivos, label: 'Activos' },
                     { value: clientesProveedores, label: 'Proveedores' },
                   ]}
                   onCreate={openNewCliente}
                   createLabel="Nuevo cliente"
                 />
                 <View style={styles.clientToolsPanel}>
                   <View style={styles.clientToolsHeader}>
                     <View>
                       <Text style={styles.clientToolsEyebrow}>Filtros</Text>
                       <Text style={styles.clientToolsTitle}>Clientes registrados</Text>
                     </View>
                     <Pressable style={styles.clientFilterResetButton} onPress={() => { setClienteTipoFiltro('todos'); setClienteProveedorFiltro('todos'); setClienteEstadoFiltro('activos'); setSearch(''); }}>
                       <MaterialCommunityIcons name="filter-remove-outline" size={17} color="#00649D" />
                       <Text style={styles.clientFilterClear}>Limpiar</Text>
                     </Pressable>
                   </View>
                   <View style={styles.clientSearchBar}>
                     <MaterialCommunityIcons name="magnify" size={21} color="#0072BD" />
                     <TextInput
                       accessibilityLabel="Buscar clientes"
                       autoCapitalize="none"
                       autoCorrect={false}
                       placeholder="Nombre, RUC, correo..."
                       placeholderTextColor="#8191A2"
                       style={styles.clientSearchInput}
                       value={search}
                       onChangeText={setSearch}
                     />
                     {search ? (
                       <Pressable accessibilityLabel="Limpiar busqueda" hitSlop={8} onPress={() => setSearch('')}>
                         <MaterialCommunityIcons name="close-circle" size={19} color="#8AA0B2" />
                       </Pressable>
                     ) : null}
                     <View style={styles.clientSearchCount}>
                       <Text style={styles.clientSearchCountText}>{filteredClientes.length}</Text>
                     </View>
                   </View>
                   <View style={styles.clientFilterPanel}>
                     <View style={styles.clientFilterLine}>
                       <Text style={styles.clientFilterLabel}>Perfil</Text>
                     <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                      {([['todos', 'Todos'], ['personas', 'Persona Natural'], ['empresas', 'Persona Juridica'], ['proveedores', 'Proveedores']] as const).map(([value, label]) => {
                        const active = value === 'proveedores' ? clienteProveedorFiltro === 'proveedores' : clienteTipoFiltro === value;
                        return (
                          <Pressable key={value} style={[styles.clientFilterChip, active && styles.clientFilterChipActive]} onPress={() => value === 'proveedores' ? setClienteProveedorFiltro(active ? 'todos' : 'proveedores') : setClienteTipoFiltro(value as 'todos' | 'personas' | 'empresas')}>
                            <Text style={[styles.clientFilterChipText, active && styles.clientFilterChipTextActive]}>{label}</Text>
                          </Pressable>
                        );
                       })}
                     </ScrollView>
                     </View>
                     <View style={styles.clientFilterLine}>
                       <Text style={styles.clientFilterLabel}>Estado</Text>
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        {([['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']] as const).map(([value, label]) => (
                          <Pressable key={value} style={[styles.clientFilterChip, clienteEstadoFiltro === value && styles.clientFilterChipActive]} onPress={() => setClienteEstadoFiltro(value)}>
                            <Text style={[styles.clientFilterChipText, clienteEstadoFiltro === value && styles.clientFilterChipTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                       </ScrollView>
                     </View>
                   </View>
                 </View>
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingClientes ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Cargando clientes...</Text>
                  </View>
                ) : null}
                {!loadingClientes && filteredClientes.length === 0 ? (
                  <EmptyState title={search ? 'Sin coincidencias' : 'Sin clientes para mostrar'} text={search ? 'Prueba con otro nombre, identificacion o correo.' : 'Cuando existan registros, apareceran aqui.'} />
                ) : null}
                <View style={styles.clientListPanel}>
                  <View style={styles.clientListHeader}>
                    <View>
                      <Text style={styles.clientListEyebrow}>Listado</Text>
                      <Text style={styles.clientListTitle}>Clientes registrados</Text>
                    </View>
                    <View style={styles.clientListActions}>
                      <Pressable
                        style={[styles.clientFilterResetButton, styles.clientExportButton]}
                        onPress={() => exportRowsToCsv('clientes.csv', filteredClientes.map((cliente: Cliente) => ({
                          Identificacion: cliente.numeroidentificacion,
                          Nombre: getClienteDisplayName(cliente),
                          Tipo: getTipoClienteLabel(cliente.tipoCliente, clienteLookups),
                          Correo: getClienteEmail(cliente),
                          Telefono: cliente.celular || cliente.telefonoconvencional || '',
                          Proveedor: cliente.esProveedor ? 'Si' : 'No',
                          Estado: cliente.estado === false ? 'Inactivo' : 'Activo',
                        })))}
                      >
                        <MaterialCommunityIcons name="file-excel-outline" size={17} color="#128A46" />
                        <Text style={[styles.clientFilterClear, styles.clientExportText]}>Exportar listado</Text>
                      </Pressable>
                      <Text style={styles.clientListCount}>{filteredClientes.length}</Text>
                    </View>
                  </View>
                  <ResultCollection<Cliente>
                    items={filteredClientes}
                    variant="plain"
                    resetKey={`${search}-${clienteTipoFiltro}-${clienteProveedorFiltro}-${clienteEstadoFiltro}`}
                    pageSize={8}
                    keyExtractor={(cliente, index) => `cliente-${cliente.codcliente}-${cliente.numeroidentificacion ?? index}`}
                    renderItem={(cliente) => (
                      <ClienteCard
                        cliente={cliente}
                        tipoClienteLabel={getTipoClienteLabel(cliente.tipoCliente, clienteLookups)}
                        stats={getClienteFacturaStats(cliente, facturasList)}
                        onView={() => setViewingCliente(cliente)}
                        onEdit={() => openEditCliente(cliente)}
                        onDelete={() => confirmDeleteCliente(cliente)}
                      />
                    )}
                  />
                </View>
              </>
            ) : null}

             {activeView === 'nuevo-producto' ? (
               <ProductoForm
                 form={productoForm}
                 mode={productoFormMode ?? 'create'}
                 saving={savingProducto}
                 lookups={productoLookups}
                 subcategorias={subcategoriasProducto}
                 loadingLookups={loadingProductoLookups || loadingProductoDetail}
                 onCancel={closeProductoForm}
                 onChange={updateProductoForm}
                 onReset={() => setProductoForm(initialProductoForm)}
                 onSave={saveProducto}
               />
             ) : activeView === 'productos' ? (
              <>
                <DirectoryHero
                  eyebrow="CATALOGO COMERCIAL"
                  title="Productos"
                  subtitle="Productos y servicios listos para facturar"
                  icon="package-variant-closed"
                  metrics={[
                    { value: productos.length, label: 'Registros' },
                    { value: productos.filter((producto: Producto) => producto.tipo === 'PRODUCTO').length, label: 'Productos' },
                    { value: productos.filter((producto: Producto) => producto.tipo === 'SERVICIO').length, label: 'Servicios' },
                  ]}
                  onCreate={openNewProducto}
                  createLabel="Nuevo producto"
                />
                <View style={styles.clientToolsPanel}>
                  <View style={styles.clientToolsHeader}>
                    <View>
                      <Text style={styles.clientToolsEyebrow}>Filtros</Text>
                      <Text style={styles.clientToolsTitle}>Productos registrados</Text>
                    </View>
                    <Pressable
                      style={styles.clientFilterResetButton}
                      onPress={() => {
                        setProductoTipoFiltro('todos');
                        setProductoCategoriaFiltro(null);
                        setProductoSubcategoriaFiltro(null);
                        setProductoEstadoFiltro('activos');
                      }}
                    >
                      <MaterialCommunityIcons name="filter-remove-outline" size={17} color="#00649D" />
                      <Text style={styles.clientFilterClear}>Limpiar</Text>
                    </Pressable>
                  </View>
                  <View style={styles.clientFilterPanel}>
                    <View style={styles.clientFilterLine}>
                      <Text style={styles.clientFilterLabel}>Tipo</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        {([['todos', 'Todos'], ['PRODUCTO', 'Productos'], ['SERVICIO', 'Servicios']] as const).map(([value, label]) => {
                          const active = productoTipoFiltro === value;
                          return (
                            <Pressable key={value} style={[styles.clientFilterChip, active && styles.clientFilterChipActive]} onPress={() => setProductoTipoFiltro(value as 'todos' | ProductoTipo)}>
                              <Text style={[styles.clientFilterChipText, active && styles.clientFilterChipTextActive]}>{label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <View style={styles.clientFilterLine}>
                      <Text style={styles.clientFilterLabel}>Categoria</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        <Pressable style={[styles.clientFilterChip, productoCategoriaFiltro === null && styles.clientFilterChipActive]} onPress={() => { setProductoCategoriaFiltro(null); setProductoSubcategoriaFiltro(null); }}>
                          <Text style={[styles.clientFilterChipText, productoCategoriaFiltro === null && styles.clientFilterChipTextActive]}>Todas</Text>
                        </Pressable>
                        {productoCategoriasFiltro.map((categoria: { id: number; label: string }) => {
                          const active = productoCategoriaFiltro === categoria.id;
                          return (
                            <Pressable key={`producto-categoria-${categoria.id}`} style={[styles.clientFilterChip, active && styles.clientFilterChipActive]} onPress={() => { setProductoCategoriaFiltro(categoria.id); setProductoSubcategoriaFiltro(null); }}>
                              <Text style={[styles.clientFilterChipText, active && styles.clientFilterChipTextActive]} numberOfLines={1}>{categoria.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <View style={styles.clientFilterLine}>
                      <Text style={styles.clientFilterLabel}>Subcategoria</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        <Pressable style={[styles.clientFilterChip, productoSubcategoriaFiltro === null && styles.clientFilterChipActive]} onPress={() => setProductoSubcategoriaFiltro(null)}>
                          <Text style={[styles.clientFilterChipText, productoSubcategoriaFiltro === null && styles.clientFilterChipTextActive]}>Todas</Text>
                        </Pressable>
                        {productoSubcategoriasFiltro.map((subcategoria: { id: number; label: string }) => {
                          const active = productoSubcategoriaFiltro === subcategoria.id;
                          return (
                            <Pressable key={`producto-subcategoria-${subcategoria.id}`} style={[styles.clientFilterChip, active && styles.clientFilterChipActive]} onPress={() => setProductoSubcategoriaFiltro(subcategoria.id)}>
                              <Text style={[styles.clientFilterChipText, active && styles.clientFilterChipTextActive]} numberOfLines={1}>{subcategoria.label}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    <View style={styles.clientFilterLine}>
                      <Text style={styles.clientFilterLabel}>Estado</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        {([['activos', 'Activos'], ['inactivos', 'Inactivos'], ['todos', 'Todos']] as const).map(([value, label]) => (
                          <Pressable key={value} style={[styles.clientFilterChip, productoEstadoFiltro === value && styles.clientFilterChipActive]} onPress={() => setProductoEstadoFiltro(value)}>
                            <Text style={[styles.clientFilterChipText, productoEstadoFiltro === value && styles.clientFilterChipTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </View>
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingProductos ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Cargando productos...</Text>
                  </View>
                ) : null}
                {!loadingProductos && filteredProductos.length === 0 ? (
                  <EmptyState title="Sin productos para mostrar" text="Prueba con otra categoria, subcategoria o tipo." />
                ) : null}
                <View style={styles.clientListPanel}>
                  <View style={styles.clientListHeader}>
                    <View>
                      <Text style={styles.clientListEyebrow}>Listado</Text>
                      <Text style={styles.clientListTitle}>Productos y servicios</Text>
                    </View>
                    <View style={styles.clientListActions}>
                      <Pressable
                        style={[styles.clientFilterResetButton, styles.clientExportButton]}
                        onPress={() => exportRowsToCsv('productos.csv', filteredProductos.map((producto: Producto) => ({
                          Codigo: producto.codigo || producto.codproducto,
                          Nombre: producto.nombre,
                          Tipo: producto.tipo,
                          Categoria: producto.categoriaDescripcion,
                          Subcategoria: producto.subcategoriaDescripcion,
                          Tarifa: producto.tarifaDescripcion,
                          Precio: producto.precioBase,
                        })))}
                      >
                        <MaterialCommunityIcons name="file-excel-outline" size={17} color="#128A46" />
                        <Text style={[styles.clientFilterClear, styles.clientExportText]}>Exportar listado</Text>
                      </Pressable>
                      <Text style={styles.clientListCount}>{filteredProductos.length}</Text>
                    </View>
                  </View>
                  <ResultCollection<Producto>
                    items={filteredProductos}
                    variant="plain"
                    resetKey={`${productoTipoFiltro}-${productoCategoriaFiltro ?? 'todas'}-${productoSubcategoriaFiltro ?? 'todas'}-${productoEstadoFiltro}`}
                    keyExtractor={(producto, index) => `producto-${producto.codproducto}-${producto.codigo ?? producto.nombre}-${index}`}
                    renderItem={(producto) => (
                      <ProductoCard
                        producto={producto}
                        onView={() => setViewingProducto(producto)}
                        onEdit={() => openEditProducto(producto)}
                        onDelete={() => confirmDeleteProducto(producto)}
                      />
                    )}
                  />
                </View>
              </>
             ) : null}

            {activeView === 'nueva-categoria' ? (
              <CategoriaForm
                form={categoriaForm}
                mode={categoriaFormMode ?? 'create'}
                saving={savingCategoria}
                onCancel={closeCategoriaForm}
                onChange={updateCategoriaForm}
                onReset={() => setCategoriaForm(initialCategoriaForm)}
                onSave={saveCategoria}
              />
            ) : null}

            {activeView === 'nueva-subcategoria' ? (
              <SubcategoriaForm
                form={subcategoriaForm}
                mode={subcategoriaFormMode ?? 'create'}
                saving={savingCategoria}
                categorias={categorias}
                onCancel={closeSubcategoriaForm}
                onChange={updateSubcategoriaForm}
                onReset={() => setSubcategoriaForm(initialSubcategoriaForm)}
                onSave={saveSubcategoria}
              />
            ) : null}

            {activeView === 'categorias' ? (
              <>
                <DirectoryHero
                  eyebrow="CLASIFICACION"
                  title={categoriaTab === 'categorias' ? 'Categorias' : 'Subcategorias'}
                  subtitle="Ordena tu catalogo para facturar mas rapido"
                  icon="shape-outline"
                  metrics={[
                    { value: categorias.length, label: 'Categorias' },
                    { value: subcategorias.length, label: 'Subcategorias' },
                    { value: categoriaTab === 'categorias' ? filteredCategorias.length : filteredSubcategorias.length, label: 'Filtrados' },
                  ]}
                  onCreate={categoriaTab === 'categorias' ? openNewCategoria : openNewSubcategoria}
                  createLabel={categoriaTab === 'categorias' ? 'Nueva categoria' : 'Nueva subcategoria'}
                />
                <View style={styles.clientToolsPanel}>
                  <View style={styles.clientToolsHeader}>
                    <View>
                      <Text style={styles.clientToolsEyebrow}>Catalogo</Text>
                      <Text style={styles.clientToolsTitle}>Categorias y subcategorias</Text>
                    </View>
                  </View>
                  <View style={styles.directoryTabs}>
                    <DirectoryTabButton active={categoriaTab === 'categorias'} label="Categorias" onPress={() => setCategoriaTab('categorias')} />
                    <DirectoryTabButton active={categoriaTab === 'subcategorias'} label="Subcategorias" onPress={() => setCategoriaTab('subcategorias')} />
                  </View>
                  {categoriaTab === 'subcategorias' ? (
                    <View style={styles.clientFilterLine}>
                      <Text style={styles.clientFilterLabel}>Categoria</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clientFilterRow}>
                        <Pressable style={[styles.clientFilterChip, subcategoriaCategoriaFiltro === null && styles.clientFilterChipActive]} onPress={() => setSubcategoriaCategoriaFiltro(null)}>
                          <Text style={[styles.clientFilterChipText, subcategoriaCategoriaFiltro === null && styles.clientFilterChipTextActive]}>Todas</Text>
                        </Pressable>
                        {categorias.map((categoria: CategoriaCatalogo) => {
                          const active = subcategoriaCategoriaFiltro === categoria.idCategoria;
                          return (
                            <Pressable key={`subcategoria-filtro-${categoria.idCategoria}`} style={[styles.clientFilterChip, active && styles.clientFilterChipActive]} onPress={() => setSubcategoriaCategoriaFiltro(categoria.idCategoria)}>
                              <Text style={[styles.clientFilterChipText, active && styles.clientFilterChipTextActive]} numberOfLines={1}>{categoria.descripcion}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}
                  <SearchField
                    label={categoriaTab === 'categorias' ? 'Buscar categorias' : 'Buscar subcategorias'}
                    placeholder="Escribe una descripcion"
                    value={search}
                    onChangeText={setSearch}
                    resultCount={categoriaTab === 'categorias' ? filteredCategorias.length : filteredSubcategorias.length}
                    totalCount={categoriaTab === 'categorias' ? categorias.length : subcategorias.length}
                  />
                </View>
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingCategorias ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Cargando categorias...</Text>
                  </View>
                ) : null}
                {!loadingCategorias && categoriaTab === 'categorias' && filteredCategorias.length === 0 ? (
                  <EmptyState title="Sin categorias para mostrar" text="Cuando existan registros, apareceran aqui." />
                ) : null}
                {!loadingCategorias && categoriaTab === 'subcategorias' && filteredSubcategorias.length === 0 ? (
                  <EmptyState title="Sin subcategorias para mostrar" text="No es obligatorio crear subcategorias." />
                ) : null}
                {categoriaTab === 'categorias' ? (
                  <View style={styles.clientListPanel}>
                    <View style={styles.clientListHeader}>
                      <View>
                        <Text style={styles.clientListEyebrow}>Listado</Text>
                        <Text style={styles.clientListTitle}>Categorias</Text>
                      </View>
                      <Text style={styles.clientListCount}>{filteredCategorias.length}</Text>
                    </View>
                    <ResultCollection<CategoriaCatalogo>
                      items={filteredCategorias}
                      variant="plain"
                      resetKey={`${categoriaTab}-${search}`}
                      keyExtractor={(categoria, index) => `categoria-${categoria.idCategoria}-${categoria.descripcion}-${index}`}
                      renderItem={(categoria) => (
                          <CategoriaCard
                          categoria={categoria}
                          onView={() => setViewingCategoria(categoria)}
                          onEdit={() => openEditCategoria(categoria)}
                          onDelete={() => confirmDeleteCategoria(categoria)}
                        />
                      )}
                    />
                  </View>
                ) : (
                  <View style={styles.clientListPanel}>
                    <View style={styles.clientListHeader}>
                      <View>
                        <Text style={styles.clientListEyebrow}>Listado</Text>
                        <Text style={styles.clientListTitle}>Subcategorias</Text>
                      </View>
                      <Text style={styles.clientListCount}>{filteredSubcategorias.length}</Text>
                    </View>
                    <ResultCollection<SubcategoriaCatalogo>
                      items={filteredSubcategorias}
                      variant="plain"
                      resetKey={`${categoriaTab}-${search}`}
                      keyExtractor={(subcategoria, index) => `subcategoria-${subcategoria.idSubcategoria}-${subcategoria.descripcion}-${index}`}
                      renderItem={(subcategoria) => (
                          <SubcategoriaCard
                            subcategoria={subcategoria}
                            categoriaDescripcion={
                              subcategoria.categoriaDescripcion ??
                              categorias.find((categoria: CategoriaCatalogo) => categoria.idCategoria === subcategoria.idCategoria)?.descripcion
                            }
                            onView={() => setViewingSubcategoria(subcategoria)}
                            onEdit={() => openEditSubcategoria(subcategoria)}
                            onDelete={() => confirmDeleteSubcategoria(subcategoria)}
                          />
                      )}
                    />
                  </View>
                )}
              </>
            ) : null}

            {activeView === 'nuevo-emisor' ? (
              <EmisorForm
                form={emisorForm}
                mode={emisorFormMode ?? 'create'}
                saving={savingEmisor}
                onCancel={closeEmisorForm}
                onChange={updateEmisorForm}
                onReset={() => setEmisorForm(selectedEmisor ? emisorToForm(selectedEmisor) : initialEmisorForm)}
                onSelectLogo={selectEmisorLogo}
                onConsultarSri={consultarSriEmisor}
                consultandoSri={consultandoSriEmisor}
                onSave={saveEmisor}
              />
            ) : null}

            {activeView === 'emisor' ? (
              <>
                <DirectoryHero
                  eyebrow="DATOS TRIBUTARIOS"
                  title="Emisor"
                  subtitle="Identidad fiscal para emitir comprobantes"
                  icon="domain"
                  metrics={[
                    { value: emisores.length, label: 'Emisores' },
                    { value: emisores.filter((emisor: Emisor) => emisor.estado !== false).length, label: 'Activos' },
                    { value: emisores.filter(hasFirmaConfigured).length, label: 'Con firma' },
                  ]}
                  onCreate={!hasActiveEmisor ? openNewEmisor : undefined}
                  createLabel="Nuevo emisor"
                />
                {emisorFormMode ? (
                  <EmisorForm
                    form={emisorForm}
                    mode={emisorFormMode}
                    saving={savingEmisor}
                    onCancel={closeEmisorForm}
                    onChange={updateEmisorForm}
                    onReset={() => setEmisorForm(selectedEmisor ? emisorToForm(selectedEmisor) : initialEmisorForm)}
                    onSelectLogo={selectEmisorLogo}
                    onConsultarSri={consultarSriEmisor}
                    consultandoSri={consultandoSriEmisor}
                    onSave={saveEmisor}
                  />
                ) : null}
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingEmisores ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Cargando emisores...</Text>
                  </View>
                ) : null}
                {!loadingEmisores && emisores.length === 0 ? (
                  <EmptyState title="Sin emisores para mostrar" text="Cuando existan registros, apareceran aqui." />
                ) : null}
                <View style={styles.clientListPanel}>
                  <View style={styles.clientListHeader}>
                    <View>
                      <Text style={styles.clientListEyebrow}>Listado</Text>
                      <Text style={styles.clientListTitle}>Emisores</Text>
                    </View>
                    <Text style={styles.clientListCount}>{emisores.length}</Text>
                  </View>
                  <ResultCollection<Emisor>
                    items={emisores}
                    variant="plain"
                    resetKey={`emisor-${reloadKey}`}
                    keyExtractor={(emisor, index) => `emisor-${emisor.codigo}-${emisor.ruc ?? index}`}
                    renderItem={(emisor) => (
                      <EmisorCard
                        emisor={emisor}
                        onView={() => setViewingEmisor(emisor)}
                        onEdit={() => openEditEmisor(emisor)}
                        onDelete={() => confirmDeleteEmisor(emisor)}
                      />
                    )}
                  />
                </View>
              </>
            ) : null}

            {activeView === 'nueva-firma' && selectedEmisor ? (
              <FirmaForm
                emisor={selectedEmisor}
                form={emisorForm}
                saving={savingEmisor}
                estado={firmaEstados[selectedEmisor.codigo]}
                onCancel={closeEmisorForm}
                onChange={updateEmisorForm}
                onClear={clearFirmaFields}
                onSelectArchivo={selectFirmaArchivo}
                onSave={saveEmisor}
              />
            ) : null}

            {activeView === 'firma' ? (
              <>
                <DirectoryHero
                  eyebrow="SEGURIDAD TRIBUTARIA"
                  title="Firma electronica"
                  subtitle="Certificados, vigencia y clave para comprobantes"
                  icon="file-certificate-outline"
                  metrics={[
                    { value: emisores.length, label: 'Emisores' },
                    { value: emisores.filter(hasFirmaConfigured).length, label: 'Firmas' },
                    { value: Object.values(firmaEstados as Record<string, FirmaEstado>).filter((estado) => estado.esValida).length, label: 'Vigentes' },
                  ]}
                  onCreate={!hasConfiguredFirma ? openAddFirma : undefined}
                  createLabel="Agregar firma"
                />
                {emisorFormMode && selectedEmisor ? (
                  <FirmaForm
                    emisor={selectedEmisor}
                    form={emisorForm}
                    saving={savingEmisor}
                      estado={firmaEstados[selectedEmisor.codigo]}
                    onCancel={closeEmisorForm}
                    onChange={updateEmisorForm}
                    onClear={clearFirmaFields}
                    onSelectArchivo={selectFirmaArchivo}
                    onSave={saveEmisor}
                  />
                ) : null}
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingEmisores || loadingFirma ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Consultando vigencia de la firma...</Text>
                  </View>
                ) : null}
                {!loadingEmisores && emisores.length === 0 ? (
                  <EmptyState title="Sin emisores para firma" text="Primero registra los datos del emisor." />
                ) : null}
                <View style={styles.clientListPanel}>
                  <View style={styles.clientListHeader}>
                    <View>
                      <Text style={styles.clientListEyebrow}>Listado</Text>
                      <Text style={styles.clientListTitle}>Firmas</Text>
                    </View>
                    <Text style={styles.clientListCount}>{emisores.length}</Text>
                  </View>
                  <ResultCollection<Emisor>
                    items={emisores}
                    variant="plain"
                    resetKey={`firma-${reloadKey}`}
                    keyExtractor={(emisor, index) => `firma-${emisor.codigo}-${emisor.ruc ?? index}`}
                    renderItem={(emisor) => (
                      <FirmaCard
                        emisor={emisor}
                        estado={firmaEstados[emisor.codigo]}
                        onView={() => setViewingFirma(emisor)}
                        onEdit={() => openFirmaForm(emisor)}
                        onDelete={() => confirmDeleteFirma(emisor)}
                      />
                    )}
                  />
                </View>
              </>
            ) : null}

            {(activeView === 'perfil' || activeView === 'perfil-e-rubrica') ? (
              <>
                {directoryMessage ? <MessageBox message={directoryMessage} /> : null}
                {loadingPerfil ? (
                  <View style={styles.directoryLoading}>
                    <ActivityIndicator color="#0072BD" />
                    <Text style={styles.mutedText}>Cargando perfil...</Text>
                  </View>
                ) : null}
                {!loadingPerfil ? (
                  <PerfilForm
                    service={activeView === 'perfil-e-rubrica' ? 'erubrica' : 'efact'}
                    form={perfilForm}
                    lookup={perfilData}
                    saving={savingPerfil}
                    onChange={updatePerfilForm}
                    onReset={() => setPerfilForm(perfilToForm(perfilData?.perfil))}
                    onSelectAvatar={selectPerfilAvatar}
                    onSelectInitialsAvatar={selectInitialsPerfilAvatar}
                    onSelectPresetAvatar={selectPresetPerfilAvatar}
                    onSave={savePerfil}
                    onOpenPrivacy={() => openView('politica-privacidad')}
                    avatars={AVATARS}
                    avatarImageSource={avatarImageSource}
                    resolveImageUrl={resolveImageUrl}
                    getInitials={getInitials}
                    isInitialsAvatar={isInitialsAvatar}
                    isPersonalPhoto={isPersonalPhoto}
                    getTipoClienteLabel={(tipoCliente) => getTipoClienteLabel(tipoCliente)}
                  />
                ) : null}
              </>
            ) : null}

            {(activeView === 'punto-emision' || activeView === 'nuevo-punto-emision') ? (
              <PuntosEmisionScreen
                data={puntosData}
                loading={loadingPuntos}
                message={directoryMessage}
                search={search}
                form={puntoForm}
                formMode={puntoFormMode}
                saving={savingPunto}
                onSearchChange={setSearch}
                onCreate={openNewPunto}
                onCancelForm={closePuntoForm}
                onChangeForm={updatePuntoForm}
                onResetForm={() => setPuntoForm(selectedPunto ? puntoToForm(selectedPunto) : { puntoEmision: getNextPuntoCode(puntosData?.cajas ?? []) })}
                onSaveForm={savePunto}
                onEdit={openEditPunto}
                onDelete={confirmDeletePunto}
                onMakePrincipal={makePuntoPrincipal}
              />
            ) : null}

            {activeView === 'nueva-factura' ? (
              <NuevaFacturaMobileScreen
                form={facturaForm}
                preparacion={facturaPreparacion}
                puntosData={puntosData}
                cliente={facturaCliente}
                clientes={facturaClientes}
                productos={facturaProductos}
                lineas={facturaLineas}
                loading={loadingFacturas}
                saving={savingFactura}
                message={directoryMessage}
                draftSaved={invoiceDraftSaved}
                onChange={updateFacturaForm}
                onSearchClientes={searchFacturaClientes}
                onSelectCliente={(cliente) => {
                  setFacturaCliente(cliente);
                  setFacturaClientes([]);
                  setFacturaForm((current: any) => ({
                    ...current,
                    clienteBusqueda: getClienteDisplayName(cliente),
                    tipoIdentificacion: getTipoIdentificacionLabel(cliente.tipoidentificacion),
                    numeroIdentificacion: getClienteIdentification(cliente),
                    tipoCliente: String(cliente.tipoCliente ?? ''),
                    obligadoContabilidad: cliente.oblgconta ?? '',
                    direccion: cliente.direccion ?? '',
                    telefono: cliente.celular || cliente.telefonoconvencional || '',
                    correoPrincipal: getClienteEmail(cliente),
                  }));
                }}
                onSearchProductos={searchFacturaProductos}
                onAddProducto={addFacturaProducto}
                onUpdateLinea={updateFacturaLinea}
                onRemoveLinea={removeFacturaLinea}
                onClear={clearFacturaForm}
                onHistory={() => openView('mis-facturas')}
                onSave={saveNuevaFactura}
              />
            ) : null}

            {activeView === 'mis-facturas' ? (
              <MisFacturasMobileScreen
                facturas={facturasList}
                notasCredito={notasCreditoList}
                onExportCsv={exportRowsToCsv}
                 loading={loadingFacturas}
                 message={directoryMessage}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onDetail={(factura) => catalogUserId ? getFacturaDetalle(catalogUserId, factura.codfactura) : Promise.reject(new Error('missing-user'))}
                 onPdf={(factura, descargar = false) => catalogUserId && (descargar
                   ? openOrDownloadPdf(() => getFacturaPdf(catalogUserId, factura.codfactura, 'A4'), `${factura.numeroCompleto ?? 'factura'}.pdf`, true)
                   : openPdfInDeviceViewer(() => getFacturaPdf(catalogUserId, factura.codfactura, 'A4'), `${factura.numeroCompleto ?? 'factura'}.pdf`))}
                 onSharePdf={(factura) => catalogUserId && sharePdf(() => getFacturaPdf(catalogUserId, factura.codfactura, 'A4'), `${factura.numeroCompleto ?? 'factura'}.pdf`)}
                 onXml={(factura) => catalogUserId && openFacturaAsset(() => getFacturaXml(catalogUserId, factura.codfactura))}
                onEmail={sendFacturaCorreo}
                onRetrySri={retryFacturaSri}
                onAnular={confirmAnularFactura}
                 onCuentasCobrar={openFacturaCuentasCobrar}
                  onNotaCredito={emitirNotaCreditoAutomaticaDesdeFactura}
                  processingNotaCreditoAutomatica={processingNotaCreditoAutomatica}
               />
            ) : null}

            {activeView === 'nueva-nota-credito' ? (
              <NuevaNotaCreditoMobileScreen
                form={notaCreditoForm}
                preparacion={notaCreditoPreparacion}
                puntosData={puntosData}
                factura={notaCreditoFactura}
                facturas={notaCreditoFacturas}
                cliente={notaCreditoCliente}
                clientes={notaCreditoClientes}
                lineas={notaCreditoLineas}
                loading={loadingNotasCredito}
                saving={savingNotaCredito}
                message={directoryMessage}
                onChange={updateNotaCreditoForm}
                onSearchClientes={searchNotaCreditoClientes}
                onSelectCliente={fillNotaCreditoCliente}
                onSearchFacturas={searchNotaCreditoFacturas}
                onSelectFactura={selectNotaCreditoFactura}
                onImportXml={importNotaCreditoXml}
                onUpdateLinea={updateNotaCreditoLinea}
                onRemoveLinea={removeNotaCreditoLinea}
                onClear={clearNotaCreditoForm}
                onHistory={() => openView('mis-notas-credito')}
                onSave={saveNuevaNotaCredito}
              />
            ) : null}

            {activeView === 'mis-notas-credito' ? (
              <MisNotasCreditoMobileScreen
                notas={notasCreditoList}
                loading={loadingNotasCredito}
                message={directoryMessage}
                onExportCsv={exportRowsToCsv}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onPdf={(nota, descargar = false) => catalogUserId && (descargar ? openOrDownloadPdf(() => getNotaCreditoPdf(catalogUserId, nota.codNotaCredito, 'A4'), 'nota-credito.pdf', true) : openPdfInDeviceViewer(() => getNotaCreditoPdf(catalogUserId, nota.codNotaCredito, 'A4'), 'nota-credito.pdf'))}
                 onSharePdf={(nota) => catalogUserId && sharePdf(() => getNotaCreditoPdf(catalogUserId, nota.codNotaCredito, 'A4'), 'nota-credito.pdf')}
                 onXml={(nota) => catalogUserId && openFacturaAsset(() => getNotaCreditoXml(catalogUserId, nota.codNotaCredito))}
                onEmail={sendNotaCreditoCorreo}
                onEmitir={emitNotaCreditoSri}
                onAnular={confirmAnularNotaCredito}
              />
            ) : null}

            {activeView === 'nueva-nota-debito' ? (
              <NuevaNotaDebitoMobileScreen
                form={notaDebitoForm}
                preparacion={notaDebitoPreparacion}
                puntosData={puntosData}
                factura={notaDebitoFactura}
                facturas={notaDebitoFacturas}
                cliente={notaDebitoCliente}
                lineas={notaDebitoLineas}
                loading={loadingNotasDebito}
                saving={savingNotaDebito}
                message={directoryMessage}
                onChange={updateNotaDebitoForm}
                onSearchFacturas={searchNotaDebitoFacturas}
                onSelectFactura={selectNotaDebitoFactura}
                onImportXml={importNotaDebitoXml}
                onUpdateLinea={updateNotaDebitoLinea}
                onClear={clearNotaDebitoForm}
                onHistory={() => openView('mis-notas-debito')}
                onSave={saveNuevaNotaDebito}
              />
            ) : null}

            {activeView === 'mis-notas-debito' ? (
              <MisNotasDebitoMobileScreen
                notas={notasDebitoList}
                loading={loadingNotasDebito}
                message={directoryMessage}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onPdf={(nota, descargar = false) => catalogUserId && (descargar ? openOrDownloadPdf(() => getNotaDebitoPdf(catalogUserId, nota.codNotaDebito, 'A4'), 'nota-debito.pdf', true) : openPdfInDeviceViewer(() => getNotaDebitoPdf(catalogUserId, nota.codNotaDebito, 'A4'), 'nota-debito.pdf'))}
                 onSharePdf={(nota) => catalogUserId && sharePdf(() => getNotaDebitoPdf(catalogUserId, nota.codNotaDebito, 'A4'), 'nota-debito.pdf')}
                 onXml={(nota) => catalogUserId && openFacturaAsset(() => getNotaDebitoXml(catalogUserId, nota.codNotaDebito))}
                 onExportCsv={exportRowsToCsv}
                 onEmail={sendNotaDebitoCorreo}
                onEmitir={emitNotaDebitoSri}
                onAnular={confirmAnularNotaDebito}
              />
            ) : null}

            {activeView === 'nueva-liquidacion-compra' ? (
              <NuevaLiquidacionCompraMobileScreen
                form={liquidacionForm}
                preparacion={liquidacionPreparacion}
                puntosData={puntosData}
                proveedor={liquidacionProveedor}
                proveedores={liquidacionProveedores}
                productos={liquidacionProductos}
                lineas={liquidacionLineas}
                loading={loadingLiquidaciones}
                saving={savingLiquidacion}
                message={directoryMessage}
                retencionLiquidacion={liquidacionRetencion}
                retencionesIva={retencionesIvaCatalogo}
                retencionesRenta={retencionesRentaCatalogo}
                loadingRetencion={loadingLiquidacionRetencion}
                savingRetencion={savingLiquidacionRetencion}
                onChange={updateLiquidacionForm}
                onSearchProveedores={searchLiquidacionProveedores}
                onSelectProveedor={selectLiquidacionProveedor}
                onSearchProductos={searchLiquidacionProductos}
                onAddProducto={addLiquidacionProducto}
                onUpdateLinea={updateLiquidacionLinea}
                onRemoveLinea={removeLiquidacionLinea}
                onClear={clearLiquidacionForm}
                onHistory={() => openView('mis-liquidaciones-compra')}
                onSave={saveNuevaLiquidacion}
                onSaveRetencion={saveRetencionLiquidacion}
                onCloseRetencion={() => setLiquidacionRetencion(null)}
              />
            ) : null}

            {activeView === 'mis-liquidaciones-compra' ? (
              <MisLiquidacionesCompraMobileScreen
                liquidaciones={liquidacionesList}
                loading={loadingLiquidaciones}
                message={directoryMessage}
                onExportCsv={exportRowsToCsv}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onPdf={(liquidacion, descargar = false) => catalogUserId && (descargar ? openOrDownloadPdf(() => getLiquidacionCompraPdf(catalogUserId, liquidacion.codLiquidacion, 'A4'), 'liquidacion-compra.pdf', true) : openPdfInDeviceViewer(() => getLiquidacionCompraPdf(catalogUserId, liquidacion.codLiquidacion, 'A4'), 'liquidacion-compra.pdf'))}
                 onSharePdf={(liquidacion) => catalogUserId && sharePdf(() => getLiquidacionCompraPdf(catalogUserId, liquidacion.codLiquidacion, 'A4'), 'liquidacion-compra.pdf')}
                 onXml={(liquidacion) => catalogUserId && openFacturaAsset(() => getLiquidacionCompraXml(catalogUserId, liquidacion.codLiquidacion))}
                 onEmail={sendLiquidacionCorreo}
                 onEmitir={emitLiquidacionSri}
                 onRetenciones={() => setActiveView('retenciones')}
                 onContinuarRetencion={continuarRetencionLiquidacion}
              />
            ) : null}

            {activeView === 'nueva-guia-remision' ? (
              <NuevaGuiaRemisionMobileScreen
                form={guiaForm}
                preparacion={guiaPreparacion}
                puntosData={puntosData}
                transportista={guiaTransportista}
                transportistas={guiaTransportistas}
                cliente={guiaCliente}
                clientes={guiaClientes}
                factura={guiaFactura}
                facturas={guiaFacturas}
                productos={guiaProductos}
                detalles={guiaDetalles}
                loading={loadingGuias}
                loadingSearch={loadingGuiaSearch}
                saving={savingGuia || checkingGuia}
                message={directoryMessage}
                onChange={updateGuiaForm}
                onSearchTransportistas={searchGuiaTransportistas}
                onSelectTransportista={selectGuiaTransportista}
                onSearchClientes={searchGuiaClientes}
                onSelectCliente={selectGuiaCliente}
                onSearchFacturas={searchGuiaFacturas}
                onSelectFactura={selectGuiaFactura}
                onSearchProductos={searchGuiaProductos}
                onAddProducto={addGuiaProducto}
                onUpdateDetalle={updateGuiaDetalle}
                onRemoveDetalle={removeGuiaDetalle}
                onClear={clearGuiaForm}
                onHistory={() => openView('mis-guias-remision')}
                onSave={saveNuevaGuia}
              />
            ) : null}

            {activeView === 'mis-guias-remision' ? (
              <MisGuiasRemisionMobileScreen
                guias={guiasList}
                loading={loadingGuias}
                message={directoryMessage}
                onExportCsv={exportRowsToCsv}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onPdf={(guia, descargar = false) => catalogUserId && (descargar ? openOrDownloadPdf(() => getGuiaRemisionPdf(catalogUserId, guia.codGuia, 'A4'), 'guia-remision.pdf', true) : openPdfInDeviceViewer(() => getGuiaRemisionPdf(catalogUserId, guia.codGuia, 'A4'), 'guia-remision.pdf'))}
                 onSharePdf={(guia) => catalogUserId && sharePdf(() => getGuiaRemisionPdf(catalogUserId, guia.codGuia, 'A4'), 'guia-remision.pdf')}
                 onXml={(guia) => catalogUserId && openFacturaAsset(() => getGuiaRemisionXml(catalogUserId, guia.codGuia))}
                onEmail={sendGuiaCorreo}
                onEmitir={emitGuiaSri}
                onAnular={confirmAnularGuia}
              />
            ) : null}

            {activeView === 'retenciones' ? (
              <MisRetencionesMobileScreen
                retenciones={retencionesList}
                loading={loadingRetenciones}
                message={directoryMessage}
                onExportCsv={exportRowsToCsv}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                 onPdf={(retencion, descargar = false) => catalogUserId && (descargar ? openOrDownloadPdf(() => retencion.pdfUrl ? Promise.resolve({ url: retencion.pdfUrl }) : getRetencionPdf(catalogUserId, retencion.codRetencion, 'A4'), 'retencion.pdf', true) : openPdfInDeviceViewer(() => retencion.pdfUrl ? Promise.resolve({ url: retencion.pdfUrl }) : getRetencionPdf(catalogUserId, retencion.codRetencion, 'A4'), 'retencion.pdf'))}
                 onSharePdf={(retencion) => sharePdf(() => retencion.pdfUrl ? Promise.resolve({ url: retencion.pdfUrl }) : catalogUserId ? getRetencionPdf(catalogUserId, retencion.codRetencion, 'A4') : Promise.reject(new Error('missing-user')), 'retencion.pdf')}
                 onXml={(retencion) => retencion.xmlUrl ? openKnownDocumentAsset(retencion.xmlUrl) : catalogUserId && openFacturaAsset(() => getRetencionXml(catalogUserId, retencion.codRetencion))}
                onEmail={sendRetencionCorreo}
                onEmitir={emitRetencionSri}
              />
            ) : null}

            {isAdminMobileView(activeView) ? (
              <AdminModuleScreen
                view={activeView}
                search={search}
                items={adminItems}
                loading={loadingAdminItems}
                message={directoryMessage}
                activeTab={adminTabByView[activeView]}
                 onRefresh={() => setReloadKey((value: number) => value + 1)}
                onSearch={setSearch}
                onTabChange={(tab) => setAdminTabByView((current: any) => ({ ...current, [activeView]: tab }))}
                onView={showAdminItemDetail}
              />
            ) : null}
             {!directoryViewsWithContent.has(activeView) && !isAdminMobileView(activeView) && !isOperationalMobileView(activeView) ? (
               <EmptyState
                 title="Módulo no disponible"
                 text="Esta sección todavía no tiene una vista móvil configurada."
               />
             ) : null}
        </View>
  );
}
