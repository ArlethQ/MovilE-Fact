import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ApiError } from '../../services/apiClient';
import type { FacturaDetalle, FacturaListItem, FacturaPreparacion, FacturaProducto } from '../../services/facturasMobileService';
import type { GuiaRemisionListItem } from '../../services/guiasRemisionMobileService';
import type { LiquidacionCompraListItem } from '../../services/liquidacionesCompraMobileService';
import type { NotaCreditoListItem } from '../../services/notasCreditoMobileService';
import type { LiquidacionRetencionInput, RetencionCatalogItem, RetencionListItem } from '../../services/retencionesMobileService';
import type { Cliente, PuntosEmisionData } from '../../types/business';
import type { NuevaFacturaFormState, NuevaFacturaLinea } from '../../types/invoices';
import type { GuiaRemisionDetalle, GuiaRemisionFormState, LiquidacionCompraFormState } from '../../types/workspaceForms';
import type { MessageState } from '../ui/FormControls';
import { EmptyState } from '../ui/FeedbackStates';
import { Field, MessageBox, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { DropdownField, ToggleRow } from '../ui/FormShared';
import { DocumentActionsMenu } from './DocumentActionsMenu';
import { ItemDetailModal } from '../data/ResultCollection';
import { DocumentHistoryHero, getInvoiceStatusStyle, getInvoiceStatusTextStyle } from './DocumentHistoryShared';
import { InvoiceProgressSteps as SharedInvoiceProgressSteps, InvoiceSummaryRow } from '../facturacion/InvoiceShared';
import { styles } from '../../styles/appStyles';
import { formatDocumentDate, formatMoney, listItemKey } from '../../utils/documentFormatting';
import { getClienteDisplayName, getClienteIdentification, getClienteKey } from '../../utils/clientDisplay';
import { getIvaOptionValue, getIvaOptions } from '../../utils/facturaOptions';
import { getDocumentSerieOptions, getEffectiveDocumentSerie, getNextSequence, getNextSequenceFromOptions, getSelectedDocumentSerieOption, getSerieLabel, getSerieLabelFromOptions, usePreferredDocumentSerie } from '../../utils/documentSeries';
import { parseDocumentNumber } from '../../utils/documentValidation';

function normalizeText(value?: string | null) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSriState(value?: string | null) {
  const state = normalizeText(value);
  if (state === 'a' || state.includes('autoriz')) return 'AUTORIZADO';
  if (state === 'p' || state === 'i' || state === 'enviado' || state === 'pendiente') return 'PENDIENTE';
  if (state === 'n' || state.includes('rechaz') || state.includes('no autoriz')) return 'RECHAZADO';
  if (state === 'anulada' || state === 'anulado' || state === 'cancelado') return 'ANULADO';
  return value?.trim() || 'PENDIENTE';
}

export function MisNotasCreditoMobileScreen({
  notas,
  loading,
  message,
  onRefresh,
  onExportCsv,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onEmitir,
  onAnular,
}: {
  notas: NotaCreditoListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
  onPdf: (nota: NotaCreditoListItem, descargar?: boolean) => void;
  onSharePdf: (nota: NotaCreditoListItem) => void;
  onXml: (nota: NotaCreditoListItem) => void;
  onEmail: (nota: NotaCreditoListItem) => void;
  onEmitir: (nota: NotaCreditoListItem) => void;
  onAnular: (nota: NotaCreditoListItem) => void;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [selectedNota, setSelectedNota] = useState<NotaCreditoListItem | null>(null);
  const visibleNotas = notas.filter((nota) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [
      nota.numeroNota,
      nota.facturaModificada,
      nota.cliente,
      nota.identificacionCliente,
      nota.estadoSri,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const isAuthorized = nota.autorizado || String(nota.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
    const matchesStatus = statusFilter === 1 || (statusFilter === 2 && isAuthorized) || (statusFilter === 3 && !isAuthorized);
    return matchesText && matchesStatus;
  });
  const total = visibleNotas.reduce((sum, nota) => sum + Number(nota.total ?? 0), 0);
  const autorizadas = visibleNotas.filter((nota) => nota.autorizado || String(nota.estadoSri ?? '').toUpperCase().includes('AUTORIZ')).length;

  return (
    <>
      <DocumentHistoryHero eyebrow="Ajustes emitidos" title="Mis notas de credito" text="Busca por cliente, documento modificado o motivo, exporta el resultado visible y abre el XML o PDF desde la misma vista." metrics={[{ value: visibleNotas.length, label: 'Notas filtradas' }, { value: formatMoney(total), label: 'Total filtrado' }, { value: autorizadas, label: 'Autorizadas' }]} />
      <View style={styles.invoiceHistoryFilterPanel}>
        <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
        <Text style={styles.clientName}>Notas de credito generadas</Text>
        <SearchField label="Buscar notas de credito" placeholder="Numero, factura, cliente o identificacion" value={filter} onChangeText={setFilter} resultCount={visibleNotas.length} totalCount={notas.length} />
        <DropdownField
          label="Estado SRI"
          options={[
            { label: 'Todos', value: 1 },
            { label: 'Autorizadas', value: 2 },
            { label: 'No autorizadas', value: 3 },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value ?? 1)}
        />
        <View style={styles.formActions}>
          <SecondaryButton label="Descargar Excel" accentColor="#18B889" onPress={() => onExportCsv('notas-credito.csv', visibleNotas.map((nota) => ({
            Nota: nota.numeroNota ?? '',
            FacturaModificada: nota.facturaModificada ?? '',
            Cliente: nota.cliente ?? '',
            Identificacion: nota.identificacionCliente ?? '',
            FechaSustento: formatDocumentDate(nota.fechaSustento),
            Estado: nota.estadoSri ?? (nota.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO'),
            Total: formatMoney(nota.total),
          })))} />
          <PrimaryButton label="Refrescar" loading={loading} onPress={onRefresh} />
        </View>
      </View>
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando notas de credito...</Text>
        </View>
      ) : null}
      {!loading && visibleNotas.length === 0 ? <EmptyState title="Sin notas de credito" text="Cuando generes notas de credito, apareceran aqui." /> : null}
      <View style={styles.listStack}>
        {visibleNotas.map((nota, index) => {
          const notaKey = listItemKey('mis-notas-credito', [nota.codNotaCredito, nota.numeroNota, nota.facturaModificada], index);
          const isAnulada = nota.estado === false || String(nota.estadoSri ?? '').toUpperCase().includes('ANUL');
          const statusLabel = isAnulada ? 'ANULADA' : nota.estadoSri ?? (nota.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO');
          const isAuthorized = !isAnulada && (nota.autorizado || String(nota.estadoSri ?? '').toUpperCase().includes('AUTORIZ'));
          return (
            <View key={notaKey} style={styles.invoiceHistoryCard}>
              <View style={styles.invoiceHistoryCardHeader}>
                <View style={styles.invoiceHistoryIdentityRow}>
                  <View style={styles.invoiceHistoryDocIcon}>
                    <MaterialCommunityIcons name="file-undo-outline" size={21} color="#0072BD" />
                  </View>
                  <View style={styles.invoiceHistoryCardInfo}>
                    <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{nota.numeroNota ?? `Nota ${nota.codNotaCredito}`}</Text>
                    <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(statusLabel)]}>
                      <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(statusLabel)]}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invoiceHistoryClientBlock}>
                  <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{nota.cliente ?? 'Consumidor final'}</Text>
                  <Text style={styles.invoiceHistoryId}>{nota.identificacionCliente ?? 'Sin identificacion'}</Text>
                  <Text style={styles.invoiceHistoryId}>Factura modificada: {nota.numeroDocModificado ?? nota.facturaModificada ?? '-'}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Fecha sustento</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(nota.fechaSustento)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Total</Text>
                  <Text style={styles.invoiceHistoryAmount}>{formatMoney(nota.total)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Subtotal</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatMoney(nota.subtotal)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Descuentos</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatMoney(nota.descuentos)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>IVA</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatMoney(nota.iva)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>ICE</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatMoney(nota.ice)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryAuthorization}>
                <View style={styles.invoiceHistoryAuthorizationTextBlock}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Motivo</Text>
                  <Text style={styles.invoiceHistoryAuthorizationText} numberOfLines={2}>{nota.motivo ?? 'No disponible'}</Text>
                </View>
                <DocumentActionsMenu actions={[
                  { label: 'Detalle', icon: 'information-outline', tone: 'primary', onPress: () => setSelectedNota(nota) },
                  { label: 'Compartir PDF', icon: 'share-variant-outline', tone: 'primary', onPress: () => onSharePdf(nota) },
                  { label: 'Descargar XML', icon: 'file-code-outline', tone: 'success', onPress: () => onXml(nota) },
                  { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(nota, true) },
                  { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(nota) },
                  ...(!isAuthorized && !isAnulada ? [{ label: 'Emitir SRI', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onEmitir(nota) }] : []),
                  ...(!isAnulada ? [{ label: 'Anular', icon: 'trash-can-outline', tone: 'danger' as const, onPress: () => onAnular(nota) }] : []),
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <ItemDetailModal
        visible={Boolean(selectedNota)}
        title={selectedNota?.numeroNota ?? 'Detalle de nota de credito'}
        values={selectedNota ? [
          `Serie: ${selectedNota.serie ?? '-'}`,
          `Factura modificada: ${selectedNota.numeroDocModificado ?? selectedNota.facturaModificada ?? '-'}`,
          `Cliente: ${selectedNota.cliente ?? 'Consumidor final'}`,
          `Identificacion: ${selectedNota.identificacionCliente ?? 'Sin identificacion'}`,
          `Fecha sustento: ${formatDocumentDate(selectedNota.fechaSustento)}`,
          `Estado SRI: ${selectedNota.estadoSri ?? (selectedNota.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO')}`,
          `Motivo: ${selectedNota.motivo ?? 'No disponible'}`,
          `Subtotal: ${formatMoney(selectedNota.subtotal)}`,
          `Descuentos: ${formatMoney(selectedNota.descuentos)}`,
          `IVA: ${formatMoney(selectedNota.iva)}`,
          `ICE: ${formatMoney(selectedNota.ice)}`,
          selectedNota.numeroAutorizacion ? `Autorización: ${selectedNota.numeroAutorizacion}` : '',
          selectedNota.fechaAutorizacion ? `Fecha autorización: ${formatDocumentDate(selectedNota.fechaAutorizacion)}` : '',
          selectedNota.claveAcceso ? `Clave de acceso: ${selectedNota.claveAcceso}` : '',
          selectedNota.mensajeSri ? `Mensaje SRI: ${selectedNota.mensajeSri}` : '',
          `Total: ${formatMoney(selectedNota.total)}`,
        ] : []}
        onClose={() => setSelectedNota(null)}
      />
    </>
  );
}

export function NuevaLiquidacionCompraMobileScreen({
  form,
  preparacion,
  puntosData,
  proveedor,
  proveedores,
  productos,
  lineas,
  loading,
  saving,
  message,
  retencionLiquidacion,
  retencionesIva,
  retencionesRenta,
  loadingRetencion,
  savingRetencion,
  onChange,
  onSearchProveedores,
  onSelectProveedor,
  onSearchProductos,
  onAddProducto,
  onUpdateLinea,
  onRemoveLinea,
  onClear,
  onHistory,
  onSave,
  onSaveRetencion,
  onCloseRetencion,
}: {
  form: LiquidacionCompraFormState;
  preparacion: FacturaPreparacion | null;
  puntosData: PuntosEmisionData | null;
  proveedor: Cliente | null;
  proveedores: Cliente[];
  productos: FacturaProducto[];
  lineas: NuevaFacturaLinea[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  retencionLiquidacion: LiquidacionCompraListItem | null;
  retencionesIva: RetencionCatalogItem[];
  retencionesRenta: RetencionCatalogItem[];
  loadingRetencion: boolean;
  savingRetencion: boolean;
  onChange: (field: keyof LiquidacionCompraFormState, value: string) => void;
  onSearchProveedores: () => void;
  onSelectProveedor: (proveedor: Cliente) => void;
  onSearchProductos: () => void;
  onAddProducto: (producto: FacturaProducto) => void;
  onUpdateLinea: (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => void;
  onRemoveLinea: (index: number) => void;
  onClear: () => void;
  onHistory: () => void;
  onSave: () => void;
  onSaveRetencion: (retenciones: LiquidacionRetencionInput[]) => void;
  onCloseRetencion: () => void;
}) {
  const toNumber = (value: string) => Number(value.replace(',', '.')) || 0;
  const totals = lineas.reduce(
    (acc, item) => {
      const base = Math.max(toNumber(item.cantidad) * toNumber(item.precio) - toNumber(item.descuento), 0);
      const iva = base * (toNumber(item.tarifa) / 100);
      return { subtotal: acc.subtotal + base, descuento: acc.descuento + toNumber(item.descuento), iva: acc.iva + iva, total: acc.total + base + iva };
    },
    { subtotal: 0, descuento: 0, iva: 0, total: 0 },
  );
  const serieOptions = getDocumentSerieOptions(preparacion, puntosData, 'liquidacion');
  usePreferredDocumentSerie(serieOptions, form.serie, (serie) => onChange('serie', serie));
  const formaPagoOptions = preparacion?.formasPago ?? [];
  const effectiveSerie = getEffectiveDocumentSerie(serieOptions, form.serie) || form.serie;
  const ivaOptions = getIvaOptions(preparacion);
  const serieLabel = getSerieLabelFromOptions(serieOptions, effectiveSerie, getSerieLabel(preparacion, effectiveSerie, '001-002'));
  const optionLiquidacionNumber = getNextSequenceFromOptions(preparacion?.series ?? [], effectiveSerie, '') || getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
  const liquidacionNumber = effectiveSerie ? form.numeroFactura || optionLiquidacionNumber || (puntosData?.cajas?.length ? '' : getNextSequence(preparacion, effectiveSerie)) : '';
  const retencionSerieOptions = getDocumentSerieOptions(preparacion, puntosData, 'retencion');
  const retencionSerie = getEffectiveDocumentSerie(retencionSerieOptions, retencionSerieOptions[0]?.serieRaw ?? '');
  const retencionNumero = getNextSequenceFromOptions(retencionSerieOptions, retencionSerie, '');
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const handleClear = () => {
    onClear();
    setStep(0);
  };
  const handleSave = () => {
    if (saving || submitting) return;
    setSubmitting(true);
    void (async () => {
      try {
        await onSave();
      } catch (error) {
        Alert.alert('No se pudo generar la liquidacion', error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  if (retencionLiquidacion) {
    return (
      <RetencionLiquidacionMobileScreen
        liquidacion={retencionLiquidacion}
        ivaCatalogo={retencionesIva}
        rentaCatalogo={retencionesRenta}
        loading={loadingRetencion}
        saving={savingRetencion}
        message={message}
        onSave={onSaveRetencion}
        onClose={onCloseRetencion}
        retencionSerie={retencionSerie}
        retencionNumero={retencionNumero}
      />
    );
  }

  return (
    <>
      <View style={[styles.adminHeroCard, styles.invoiceHeroCard]}>
        <View style={styles.invoiceHeroText}>
          <Text style={styles.heroEyebrow}>Documento de compra</Text>
          <Text style={styles.heroTitle}>Nueva liquidacion de compra</Text>
          <Text style={styles.heroText}>Completa proveedor, detalle y forma de pago con una vista limpia.</Text>
        </View>
        <View style={styles.invoiceHeaderActions}>
          <View style={styles.invoiceHeaderBox}>
            <DropdownField
              label="Serie"
              options={serieOptions.map((item, index) => ({ label: item.serieVisual || item.serieRaw || `Serie ${index + 1}`, value: index + 1 }))}
              value={Math.max(serieOptions.findIndex((item) => item === getSelectedDocumentSerieOption(serieOptions, effectiveSerie)) + 1, 0) || (serieOptions.length ? 1 : null)}
              onChange={(value) => onChange('serie', value ? serieOptions[value - 1]?.serieRaw ?? serieOptions[value - 1]?.serieVisual ?? effectiveSerie : effectiveSerie)}
            />
          </View>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Liquidacion</Text>
            <Text style={styles.invoiceHeaderValue}>{liquidacionNumber}</Text>
          </View>
          <SecondaryButton label="Historial" onPress={onHistory} />
          <SecondaryButton label="Limpiar pantalla" onPress={handleClear} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Proveedor', 'Detalle', 'Revision']} activeIndex={step} />
      {message ? <MessageBox message={message} /> : null}
      {submitting ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>{saving ? 'Generando liquidacion y enviandola al SRI...' : 'Validando datos de la liquidacion...'}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando liquidaciones...</Text>
        </View>
      ) : null}
      {step === 0 ? <>
      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Buscador de proveedor</Text>
        <Text style={styles.invoiceSectionHelp}>Encuentra o completa el proveedor de la liquidacion</Text>
        <SearchField label="Encontrar proveedor *" placeholder="Identificacion o nombre" value={form.clienteBusqueda} onChangeText={(value) => onChange('clienteBusqueda', value)} resultCount={proveedores.length} onSubmit={onSearchProveedores} predictive suggestions={proveedores.slice(0, 5).map((item, index) => ({ id: `liquidacion-proveedor-${getClienteKey(item, index)}`, title: getClienteDisplayName(item), subtitle: getClienteIdentification(item) || 'Sin identificacion' }))} onSelectSuggestion={(suggestion) => { const item = proveedores.find((candidate, index) => `liquidacion-proveedor-${getClienteKey(candidate, index)}` === suggestion.id); if (item) onSelectProveedor(item); }} />
      </View>
      <View style={styles.formActions}>
        <PrimaryButton label="Continuar con datos" loading={false} onPress={() => proveedor ? setStep(1) : Alert.alert('Proveedor requerido', 'Selecciona primero un proveedor.')} />
      </View>
      </> : null}
      {step === 1 ? <>
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <Text style={styles.invoicePanelTitle}>Datos del Documento</Text>
          <Text style={styles.invoicePanelPill}>Datos de proveedor y forma de pago de la liquidacion.</Text>
        </View>
        <View style={styles.invoiceGrid}>
          <Field label="Identificacion" value={proveedor?.numeroidentificacion ?? ''} onChangeText={() => undefined} />
          <Field label="Nombre proveedor *" value={proveedor ? getClienteDisplayName(proveedor) : form.clienteBusqueda} onChangeText={(value) => onChange('clienteBusqueda', value)} />
          <Field label="Telefono (opcional)" value={form.telefono} onChangeText={(value) => onChange('telefono', value)} keyboardType="phone-pad" />
        </View>
        <View style={styles.invoiceGrid}>
          <Field label="Correo electronico principal (opcional)" value={form.correoPrincipal} onChangeText={(value) => onChange('correoPrincipal', value)} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Direccion *" value={form.direccion} onChangeText={(value) => onChange('direccion', value)} />
        </View>
        <SecondaryButton label="Agregar correo" onPress={() => onChange('correoAdicional', form.correoPrincipal)} />
        <View style={styles.invoiceGrid}>
          <DropdownField
            label="Forma de pago *"
            options={formaPagoOptions.map((item, index) => ({ label: String(item.descripcionSri || item.descripcion || item.codigo || `Forma ${index + 1}`), value: index + 1 }))}
            value={Math.max(formaPagoOptions.findIndex((item) => String(item.codigo ?? '') === form.formaPago) + 1, 0) || null}
            onChange={(value) => onChange('formaPago', value ? String(formaPagoOptions[value - 1]?.codigo ?? '') : '')}
            allowClear
          />
          <Field label="Dias de credito (opcional)" value={form.diasCredito} onChangeText={(value) => onChange('diasCredito', value.replace(/[^\d]/g, ''))} keyboardType="number-pad" />
        </View>
      </View>
      <View style={styles.formActions}>
        <SecondaryButton label="Volver a proveedor" onPress={() => setStep(0)} />
        <PrimaryButton label="Continuar con detalle" loading={false} onPress={() => setStep(2)} />
      </View>
      </> : null}
      {step === 2 ? <>
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <Text style={styles.invoicePanelTitle}>Detalle de la Liquidacion</Text>
          <Text style={styles.invoicePanelPill}>Registra los productos o servicios adquiridos.</Text>
        </View>
        <SearchField label="Encontrar producto o servicio *" placeholder="Codigo, nombre o descripcion" value={form.productoBusqueda} onChangeText={(value) => onChange('productoBusqueda', value)} resultCount={productos.length} onSubmit={onSearchProductos} predictive suggestions={productos.slice(0, 5).map((item) => ({ id: `liquidacion-producto-${item.codproducto}`, title: item.descripcion ?? item.codprincipal ?? 'Producto', subtitle: item.codprincipal ?? 'Sin codigo' }))} onSelectSuggestion={(suggestion) => { const item = productos.find((candidate) => `liquidacion-producto-${candidate.codproducto}` === suggestion.id); if (item) onAddProducto(item); }} />
        {lineas.length === 0 ? <EmptyState title="Sin detalle" text="Agrega al menos un producto o servicio para emitir la liquidacion." /> : null}
        {lineas.map((linea, index) => {
          const base = Math.max(toNumber(linea.cantidad) * toNumber(linea.precio) - toNumber(linea.descuento), 0);
          const total = base + base * (toNumber(linea.tarifa) / 100);
          return (
            <View key={`linea-liquidacion-${index}`} style={styles.invoiceLineCard}>
              <View style={styles.clientCardHeader}>
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName} numberOfLines={2}>{linea.producto.descripcion ?? linea.producto.codprincipal}</Text>
                  <Text style={styles.clientMeta} numberOfLines={1}>Codigo: {linea.producto.codprincipal ?? linea.producto.codproducto}</Text>
                </View>
                <Text style={styles.invoiceLineTotal}>{formatMoney(total)}</Text>
              </View>
              <Field label="Detalle adicional o concepto extendido (opcional)" value={form.detalleLinea} onChangeText={(value) => onChange('detalleLinea', value)} />
              <View style={styles.invoiceLineFieldsGrid}>
                <View style={styles.invoiceLineField}><Field label="Cantidad *" value={linea.cantidad} onChangeText={(value) => onUpdateLinea(index, 'cantidad', value)} keyboardType="decimal-pad" /></View>
                <View style={styles.invoiceLineField}><Field label="Precio *" value={linea.precio} onChangeText={(value) => onUpdateLinea(index, 'precio', value)} keyboardType="decimal-pad" /></View>
              </View>
              <View style={styles.invoiceLineFieldsGrid}>
                <View style={styles.invoiceLineField}><Field label="Descuento (opcional)" value={linea.descuento} onChangeText={(value) => onUpdateLinea(index, 'descuento', value)} keyboardType="decimal-pad" /></View>
                <View style={styles.invoiceLineField}>
                {ivaOptions.length > 0 ? (
                  <DropdownField label="IVA *" options={ivaOptions} value={getIvaOptionValue(ivaOptions, toNumber(linea.tarifa))} onChange={(value) => onUpdateLinea(index, 'tarifa', value === null ? '0' : String(value))} allowClear />
                ) : (
                  <Field label="IVA % *" value={linea.tarifa} onChangeText={(value) => onUpdateLinea(index, 'tarifa', value)} keyboardType="decimal-pad" />
                )}
                </View>
              </View>
              <SecondaryButton label="Quitar linea" onPress={() => onRemoveLinea(index)} />
            </View>
          );
        })}
      </View>
      <View style={[styles.formSectionBox, styles.invoiceSummaryBox]}>
        <Text style={styles.clientFormSubtitle}>Resumen</Text>
        <InvoiceSummaryRow label="Subtotal" value={totals.subtotal} />
        <InvoiceSummaryRow label="Descuento" value={totals.descuento} danger />
        <InvoiceSummaryRow label="Base imponible" value={totals.subtotal} />
        <InvoiceSummaryRow label="IVA" value={totals.iva} />
        <View style={styles.invoiceTotalRow}>
          <Text style={styles.invoiceTotalLabel}>Total</Text>
          <Text style={styles.invoiceTotalValue}>{formatMoney(totals.total)}</Text>
        </View>
      </View>
      <View style={styles.formActions}>
        <PrimaryButton label="Generar Liquidacion" loading={saving || submitting} onPress={handleSave} />
        <SecondaryButton label="Volver a datos" onPress={() => setStep(1)} />
        <SecondaryButton label="Cancelar / limpiar" onPress={handleClear} />
      </View>
      </> : null}
    </>
  );
}

export function RetencionLiquidacionMobileScreen({
  liquidacion,
  ivaCatalogo,
  rentaCatalogo,
  loading,
  saving,
  message,
  onSave,
  onClose,
  retencionSerie,
  retencionNumero,
}: {
  liquidacion: LiquidacionCompraListItem;
  ivaCatalogo: RetencionCatalogItem[];
  rentaCatalogo: RetencionCatalogItem[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  onSave: (retenciones: LiquidacionRetencionInput[]) => void | Promise<void>;
  onClose: () => void;
  retencionSerie: string;
  retencionNumero: string;
}) {
  const ivaOpciones = ivaCatalogo;
  const rentaOpciones = rentaCatalogo;
  const [ivaCodigoIndex, setIvaCodigoIndex] = useState(0);
  const [rentaCodigoIndex, setRentaCodigoIndex] = useState(0);
  const [baseIva, setBaseIva] = useState(String(Number(liquidacion.baseIva ?? liquidacion.iva ?? 0)));
  const [baseRenta, setBaseRenta] = useState(String(Number(liquidacion.baseRenta ?? liquidacion.base ?? 0)));
  const [submitting, setSubmitting] = useState(false);
  const ivaCodigo = ivaOpciones[ivaCodigoIndex - 1];
  const rentaCodigo = rentaOpciones[rentaCodigoIndex - 1];
  const ivaPorcentaje = Number(ivaCodigo?.valor ?? 0);
  const rentaPorcentaje = Number(rentaCodigo?.valor ?? 0);
  const baseIvaNumerica = Number(baseIva.replace(',', '.')) || 0;
  const baseRentaNumerica = Number(baseRenta.replace(',', '.')) || 0;
  const ivaRetenido = Math.round((baseIvaNumerica * ivaPorcentaje / 100 + Number.EPSILON) * 100) / 100;
  const rentaRetenida = Math.round((baseRentaNumerica * rentaPorcentaje / 100 + Number.EPSILON) * 100) / 100;

  useEffect(() => {
    setIvaCodigoIndex(ivaOpciones.length ? 1 : 0);
  }, [ivaOpciones.length]);

  useEffect(() => {
    setRentaCodigoIndex(rentaOpciones.length ? 1 : 0);
  }, [rentaOpciones.length]);

  useEffect(() => {
    setBaseIva(String(Number(liquidacion.baseIva ?? liquidacion.iva ?? 0)));
    setBaseRenta(String(Number(liquidacion.baseRenta ?? liquidacion.base ?? 0)));
  }, [liquidacion.baseIva, liquidacion.iva, liquidacion.baseRenta, liquidacion.base]);

  const guardar = async () => {
    if (saving || submitting) return;
    const retenciones: LiquidacionRetencionInput[] = [];
    if (ivaCodigo) {
      const idRet = Number(String(ivaCodigo.codigo).replace(/\D/g, ''));
      if (idRet <= 0 || baseIvaNumerica <= 0 || baseIvaNumerica > Number(liquidacion.baseIva ?? liquidacion.iva ?? 0)) {
        Alert.alert('Base IVA no valida', `La base IVA debe estar entre cero y ${formatMoney(liquidacion.baseIva ?? liquidacion.iva)}.`);
        return;
      }
      retenciones.push({ tipo: 'IVA', idRet, codigoRetencion: ivaCodigo.codigo, descripcionRet: ivaCodigo.descripcion, base: baseIvaNumerica, porcentajeRetencion: ivaPorcentaje, valorRetenido: ivaRetenido, valor: ivaPorcentaje });
    }
    if (rentaCodigo) {
      const idRet = Number(String(rentaCodigo.codigo).replace(/\D/g, ''));
      if (idRet <= 0 || baseRentaNumerica <= 0 || baseRentaNumerica > Number(liquidacion.baseRenta ?? liquidacion.base ?? 0)) {
        Alert.alert('Base Renta no valida', `La base Renta debe estar entre cero y ${formatMoney(liquidacion.baseRenta ?? liquidacion.base)}.`);
        return;
      }
      retenciones.push({ tipo: 'RENTA', idRet, codigoRetencion: rentaCodigo.codigo, descripcionRet: rentaCodigo.descripcion, base: baseRentaNumerica, porcentajeRetencion: rentaPorcentaje, valorRetenido: rentaRetenida, valor: rentaPorcentaje });
    }
    if (!retenciones.length) {
      Alert.alert('Retencion requerida', 'Selecciona al menos una retencion de IVA o Renta.');
      return;
    }
    setSubmitting(true);
    try {
      await onSave(retenciones);
    } catch (error) {
      Alert.alert('No se pudo generar la retencion', error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View style={[styles.adminHeroCard, styles.invoiceHeroCard]}>
        <View style={styles.invoiceHeroText}>
          <Text style={styles.heroEyebrow}>Documento de retencion</Text>
          <Text style={styles.heroTitle}>Nueva retencion</Text>
          <Text style={styles.heroText}>Completa las retenciones de IVA y Renta de la liquidacion autorizada.</Text>
        </View>
        <View style={styles.invoiceHeaderActions}>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Retencion</Text>
            <Text style={styles.invoiceHeaderValue}>{retencionSerie && retencionNumero ? `${retencionSerie}-${retencionNumero}` : 'Se asigna al guardar'}</Text>
          </View>
          <SecondaryButton label="Cerrar" onPress={onClose} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Liquidacion', 'Retencion', 'Emision']} activeIndex={1} />
      {message ? <MessageBox message={message} /> : null}
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <View style={styles.invoicePanelHeaderCopy}>
            <Text style={styles.invoicePanelTitle}>Datos de la retencion</Text>
            <Text style={styles.invoicePanelHeaderHelp}>IVA y Renta se emitiran juntas en un solo comprobante.</Text>
          </View>
        </View>
      <View style={styles.clientDetailGrid}>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Liquidacion sustento</Text><Text style={styles.clientDetailValue}>{liquidacion.numero ?? liquidacion.codLiquidacion}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Proveedor</Text><Text style={styles.clientDetailValue}>{liquidacion.proveedor ?? 'Proveedor'}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Proxima retencion</Text><Text style={styles.clientDetailValue}>{retencionSerie && retencionNumero ? `${retencionSerie}-${retencionNumero}` : 'Se asigna al guardar'}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Total</Text><Text style={styles.invoiceHistoryAmount}>{formatMoney(liquidacion.total)}</Text></View>
      </View>
      {loading ? (
        <View style={styles.directoryLoading}><ActivityIndicator color="#0072BD" /><Text style={styles.mutedText}>Cargando codigos de retencion...</Text></View>
      ) : (
        <>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Retencion IVA</Text>
            <Text style={styles.invoiceSectionHelp}>E-Fact calcula la base IVA con el IVA total de la liquidacion.</Text>
            <DropdownField label="Codigo IVA" options={ivaOpciones.map((item, index) => ({ label: `${Number(item.valor ?? 0).toFixed(0)}%`, value: index + 1 }))} value={ivaCodigoIndex || null} onChange={(value) => setIvaCodigoIndex(value ?? 0)} allowClear />
            <View style={styles.invoiceGrid}>
              <Field label="Base imponible IVA" value={baseIva} onChangeText={setBaseIva} keyboardType="decimal-pad" />
              <Field label="Porcentaje IVA" value={`${ivaPorcentaje.toFixed(2)}%`} onChangeText={() => undefined} />
            </View>
            <View style={styles.invoiceTotalRow}><Text style={styles.invoiceTotalLabel}>Valor retenido IVA</Text><Text style={styles.invoiceTotalValue}>{formatMoney(ivaRetenido)}</Text></View>
          </View>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Retencion Renta</Text>
            <Text style={styles.invoiceSectionHelp}>En liquidaciones integradas se usa el codigo 311 al 3%.</Text>
            <DropdownField label="Codigo Renta" options={rentaOpciones.map((item, index) => ({ label: `${item.codigo} - ${item.descripcion}`.trim(), value: index + 1 }))} value={rentaCodigoIndex || null} onChange={(value) => setRentaCodigoIndex(value ?? 0)} allowClear />
            <View style={styles.invoiceGrid}>
              <Field label="Base imponible Renta" value={baseRenta} onChangeText={setBaseRenta} keyboardType="decimal-pad" />
              <Field label="Porcentaje Renta" value={`${rentaPorcentaje.toFixed(2)}%`} onChangeText={() => undefined} />
            </View>
            <View style={styles.invoiceTotalRow}><Text style={styles.invoiceTotalLabel}>Valor retenido Renta</Text><Text style={styles.invoiceTotalValue}>{formatMoney(rentaRetenida)}</Text></View>
          </View>
          {submitting ? (
            <View style={styles.directoryLoading}>
              <ActivityIndicator color="#0072BD" />
              <Text style={styles.mutedText}>{saving ? 'Generando retencion y enviandola al SRI...' : 'Validando datos de la retencion...'}</Text>
            </View>
          ) : null}
          <View style={styles.formActions}>
            <SecondaryButton label="Cancelar" onPress={onClose} />
            <PrimaryButton label="Generar y emitir retencion" loading={saving || submitting} onPress={guardar} />
          </View>
        </>
      )}
      </View>
    </>
  );
}

export function MisLiquidacionesCompraMobileScreen({
  liquidaciones,
  loading,
  message,
  onRefresh,
  onExportCsv,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onEmitir,
  onRetenciones,
  onContinuarRetencion,
}: {
  liquidaciones: LiquidacionCompraListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
  onPdf: (liquidacion: LiquidacionCompraListItem, descargar?: boolean) => void;
  onSharePdf: (liquidacion: LiquidacionCompraListItem) => void;
  onXml: (liquidacion: LiquidacionCompraListItem) => void;
  onEmail: (liquidacion: LiquidacionCompraListItem) => void;
  onEmitir: (liquidacion: LiquidacionCompraListItem) => void;
  onRetenciones: () => void;
  onContinuarRetencion: (liquidacion: LiquidacionCompraListItem) => void;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [selectedLiquidacion, setSelectedLiquidacion] = useState<LiquidacionCompraListItem | null>(null);
  const visibleLiquidaciones = liquidaciones.filter((liquidacion) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [liquidacion.numero, liquidacion.fecha, liquidacion.proveedor, liquidacion.identificacionProveedor, liquidacion.estadoSri].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const isAuthorized = liquidacion.autorizado || String(liquidacion.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
    const matchesStatus = statusFilter === 1 || (statusFilter === 2 && isAuthorized) || (statusFilter === 3 && !isAuthorized);
    return matchesText && matchesStatus;
  });
  const total = visibleLiquidaciones.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
  const autorizadas = visibleLiquidaciones.filter((item) => item.autorizado || String(item.estadoSri ?? '').toUpperCase().includes('AUTORIZ')).length;

  return (
    <>
      <DocumentHistoryHero eyebrow="Compras emitidas" title="Mis liquidaciones" text="Filtra por proveedor, numero o identificacion, exporta tu consulta y abre cada comprobante." metrics={[{ value: visibleLiquidaciones.length, label: 'Liquidaciones filtradas' }, { value: formatMoney(total), label: 'Total filtrado' }, { value: autorizadas, label: 'Autorizadas' }]} />
      <View style={styles.invoiceHistoryFilterPanel}>
        <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
        <Text style={styles.clientName}>Liquidaciones de compra generadas</Text>
        <SearchField label="Buscar liquidaciones" placeholder="Numero, proveedor o identificacion" value={filter} onChangeText={setFilter} resultCount={visibleLiquidaciones.length} totalCount={liquidaciones.length} />
        <DropdownField
          label="Estado SRI"
          options={[{ label: 'Todos', value: 1 }, { label: 'Autorizadas', value: 2 }, { label: 'No autorizadas', value: 3 }]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value ?? 1)}
        />
        <View style={styles.formActions}>
          <SecondaryButton label="Descargar Excel" accentColor="#18B889" onPress={() => onExportCsv('liquidaciones-compra.csv', visibleLiquidaciones.map((liquidacion) => ({
            Numero: liquidacion.numero ?? '',
            Fecha: formatDocumentDate(liquidacion.fecha),
            Proveedor: liquidacion.proveedor ?? '',
            Identificacion: liquidacion.identificacionProveedor ?? '',
            Estado: liquidacion.estadoSri ?? (liquidacion.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO'),
            Base: formatMoney(liquidacion.base),
            IVA: formatMoney(liquidacion.iva),
            Total: formatMoney(liquidacion.total),
          })))} />
          <PrimaryButton label="Refrescar" loading={loading} onPress={onRefresh} />
        </View>
      </View>
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando liquidaciones...</Text>
        </View>
      ) : null}
      {!loading && visibleLiquidaciones.length === 0 ? <EmptyState title="Sin liquidaciones" text="Cuando generes liquidaciones de compra, apareceran aqui." /> : null}
      <View style={styles.listStack}>
        {visibleLiquidaciones.map((liquidacion, index) => {
          const key = listItemKey('mis-liquidaciones', [liquidacion.codLiquidacion, liquidacion.numero, liquidacion.identificacionProveedor], index);
          const statusLabel = liquidacion.estadoSri ?? (liquidacion.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO');
          const isAuthorized = liquidacion.autorizado || String(liquidacion.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
          return (
            <View key={key} style={styles.invoiceHistoryCard}>
              <View style={styles.invoiceHistoryCardHeader}>
                <View style={styles.invoiceHistoryIdentityRow}>
                  <View style={styles.invoiceHistoryDocIcon}>
                    <MaterialCommunityIcons name="file-percent-outline" size={21} color="#0072BD" />
                  </View>
                  <View style={styles.invoiceHistoryCardInfo}>
                    <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{liquidacion.numero ?? `Liquidacion ${liquidacion.codLiquidacion}`}</Text>
                    <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(statusLabel)]}>
                      <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(statusLabel)]}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invoiceHistoryClientBlock}>
                  <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{liquidacion.proveedor ?? 'Proveedor'}</Text>
                  <Text style={styles.invoiceHistoryId}>{liquidacion.identificacionProveedor ?? 'Sin identificacion'}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Fecha</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(liquidacion.fecha)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Total</Text>
                  <Text style={styles.invoiceHistoryAmount}>{formatMoney(liquidacion.total)}</Text>
                </View>
              </View>
              <View style={styles.clientDetailGrid}>
                <View style={styles.clientDetailItem}>
                  <Text style={styles.clientDetailLabel}>Base</Text>
                  <Text style={styles.clientDetailValue}>{formatMoney(liquidacion.base)}</Text>
                </View>
                <View style={styles.clientDetailItem}>
                  <Text style={styles.clientDetailLabel}>IVA</Text>
                  <Text style={styles.clientDetailValue}>{formatMoney(liquidacion.iva)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryAuthorization}>
                <View style={styles.invoiceHistoryAuthorizationTextBlock}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Autorizacion</Text>
                  <Text style={styles.invoiceHistoryAuthorizationText} numberOfLines={2}>{liquidacion.numeroAutorizacion || (liquidacion.autorizado ? 'Autorizado sin numero registrado' : 'Pendiente de autorizacion')} · Retencion {liquidacion.retencionDisponible ? `disponible${liquidacion.numeroRetencion ? ` (${liquidacion.numeroRetencion})` : ''}` : 'no disponible'}</Text>
                </View>
                <DocumentActionsMenu actions={[
                  { label: 'Detalle', icon: 'information-outline', tone: 'primary', onPress: () => setSelectedLiquidacion(liquidacion) },
                  { label: 'Compartir PDF', icon: 'share-variant-outline', tone: 'primary', onPress: () => onSharePdf(liquidacion) },
                  { label: 'Descargar XML', icon: 'file-code-outline', tone: 'success', onPress: () => onXml(liquidacion) },
                  { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(liquidacion, true) },
                  { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(liquidacion) },
                   ...(liquidacion.retencionDisponible ? [{ label: 'Ver retenciones', icon: 'file-percent-outline', tone: 'success' as const, onPress: onRetenciones }] : []),
                   ...(!liquidacion.retencionDisponible && isAuthorized ? [{ label: 'Continuar con retencion', icon: 'receipt-text-plus-outline', tone: 'success' as const, onPress: () => onContinuarRetencion(liquidacion) }] : []),
                  ...(!isAuthorized ? [{ label: 'Emitir SRI', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onEmitir(liquidacion) }] : []),
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <ItemDetailModal
        visible={Boolean(selectedLiquidacion)}
        title={selectedLiquidacion?.numero ?? 'Detalle de liquidacion'}
        values={selectedLiquidacion ? [
          `Proveedor: ${selectedLiquidacion.proveedor ?? 'Proveedor'}`,
          `Identificacion: ${selectedLiquidacion.identificacionProveedor ?? 'Sin identificacion'}`,
          `Fecha: ${formatDocumentDate(selectedLiquidacion.fecha)}`,
          `Estado SRI: ${selectedLiquidacion.estadoSri ?? (selectedLiquidacion.autorizado ? 'AUTORIZADO' : 'NO AUTORIZADO')}`,
          selectedLiquidacion.numeroAutorizacion ? `Autorización: ${selectedLiquidacion.numeroAutorizacion}` : '',
          selectedLiquidacion.numeroRetencion ? `Retención: ${selectedLiquidacion.numeroRetencion}` : '',
          selectedLiquidacion.mensajeSri ? `Mensaje SRI: ${selectedLiquidacion.mensajeSri}` : '',
          `Base: ${formatMoney(selectedLiquidacion.base)}`,
          `IVA: ${formatMoney(selectedLiquidacion.iva)}`,
          `Total: ${formatMoney(selectedLiquidacion.total)}`,
          `Retencion: ${selectedLiquidacion.retencionDisponible ? 'Disponible' : 'No disponible'}`,
        ] : []}
        onClose={() => setSelectedLiquidacion(null)}
      />
    </>
  );
}

export function NuevaGuiaRemisionMobileScreen({
  form,
  preparacion,
  puntosData,
  transportista,
  transportistas,
  cliente,
  clientes,
  factura,
  facturas,
  productos,
  detalles,
  loading,
  loadingSearch,
  saving,
  message,
  onChange,
  onSearchTransportistas,
  onSelectTransportista,
  onSearchClientes,
  onSelectCliente,
  onSearchFacturas,
  onSelectFactura,
  onSearchProductos,
  onAddProducto,
  onUpdateDetalle,
  onRemoveDetalle,
  onClear,
  onHistory,
  onSave,
}: {
  form: GuiaRemisionFormState;
  preparacion: FacturaPreparacion | null;
  puntosData: PuntosEmisionData | null;
  transportista: Cliente | null;
  transportistas: Cliente[];
  cliente: Cliente | null;
  clientes: Cliente[];
  factura: FacturaListItem | null;
  facturas: FacturaListItem[];
  productos: FacturaProducto[];
  detalles: GuiaRemisionDetalle[];
  loading: boolean;
  loadingSearch: boolean;
  saving: boolean;
  message?: MessageState;
  onChange: (field: keyof GuiaRemisionFormState, value: string | boolean) => void;
  onSearchTransportistas: () => void;
  onSelectTransportista: (transportista: Cliente) => void;
  onSearchClientes: () => void;
  onSelectCliente: (cliente: Cliente) => void;
  onSearchFacturas: () => void;
  onSelectFactura: (factura: FacturaListItem) => void;
  onSearchProductos: () => void;
  onAddProducto: (producto: FacturaProducto) => void;
  onUpdateDetalle: (index: number, value: string) => void;
  onRemoveDetalle: (index: number) => void;
  onClear: () => void;
  onHistory: () => void;
  onSave: () => void | Promise<void>;
}) {
  const serieOptions = getDocumentSerieOptions(preparacion, puntosData, 'guia');
  usePreferredDocumentSerie(serieOptions, form.serie, (serie) => onChange('serie', serie));
  const effectiveSerie = getEffectiveDocumentSerie(serieOptions, form.serie) || form.serie;
  const serieLabel = getSerieLabelFromOptions(serieOptions, effectiveSerie, getSerieLabel(preparacion, effectiveSerie, '001-002'));
  const optionGuiaNumber = getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
  const guiaNumber = effectiveSerie ? form.numeroFactura || optionGuiaNumber || (puntosData?.cajas?.length ? '' : getNextSequence(preparacion, effectiveSerie)) : '';
  const totals = detalles.reduce(
    (acc, item) => {
      const cantidad = parseDocumentNumber(item.cantidad);
      const precio = Number(item.producto.precioUnitario ?? item.producto.costo ?? 0) || 0;
      const base = cantidad * precio;
      const iva = base * ((Number(item.producto.tarifaIva) || 0) / 100);
      return { cantidad: acc.cantidad + cantidad, subtotal: acc.subtotal + base, iva: acc.iva + iva, total: acc.total + base + iva };
    },
    { cantidad: 0, subtotal: 0, iva: 0, total: 0 },
  );
  const totalDocumento = totals.total > 0 ? totals.total : Number(factura?.total ?? 0) || 0;
  const subtotalDocumento = totals.subtotal > 0 ? totals.subtotal : Math.max(totalDocumento - totals.iva, 0);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const handleClear = () => {
    onClear();
    setStep(0);
  };
  const handleSave = () => {
    if (saving || submitting) return;
    setSubmitting(true);
    void (async () => {
      try {
        await onSave();
      } catch (error) {
        Alert.alert(
          'No se pudo generar la guia',
          error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.',
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <>
      <View style={[styles.adminHeroCard, styles.invoiceHeroCard]}>
        <View style={styles.invoiceHeroText}>
          <Text style={styles.heroEyebrow}>Auto carga desde factura</Text>
          <Text style={styles.heroTitle}>Nueva guia de remision</Text>
          <Text style={styles.heroText}>Carga la factura de origen, valida el traslado y guarda la guia de remision.</Text>
        </View>
        <View style={styles.invoiceHeaderActions}>
          <View style={styles.invoiceHeaderBox}>
            <DropdownField
              label="Serie guia"
              options={serieOptions.map((item, index) => ({ label: item.serieVisual || item.serieRaw || `Serie ${index + 1}`, value: index + 1 }))}
              value={Math.max(serieOptions.findIndex((item) => item === getSelectedDocumentSerieOption(serieOptions, effectiveSerie)) + 1, 0) || (serieOptions.length ? 1 : null)}
              onChange={(value) => onChange('serie', value ? serieOptions[value - 1]?.serieRaw ?? serieOptions[value - 1]?.serieVisual ?? effectiveSerie : effectiveSerie)}
            />
          </View>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Numero de guia</Text>
            <Text style={styles.invoiceHeaderValue}>{guiaNumber}</Text>
          </View>
          <SecondaryButton label="Historial" onPress={onHistory} />
          <SecondaryButton label="Limpiar pantalla" onPress={handleClear} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Transporte', 'Destino', 'Detalle']} activeIndex={step} />
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando guias de remision...</Text>
        </View>
      ) : null}
      {step === 0 ? <>
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <Text style={styles.invoicePanelTitle}>Datos operativos de la guia</Text>
          <Text style={styles.invoicePanelPill}>Selecciona transportista</Text>
        </View>
        <SearchField label="Encontrar transportista *" placeholder="Identificacion o razon social" value={form.transportistaBusqueda} onChangeText={(value) => onChange('transportistaBusqueda', value)} resultCount={transportistas.length} loading={loadingSearch} onSubmit={onSearchTransportistas} predictive suggestions={transportistas.slice(0, 5).map((item, index) => ({ id: `guia-transportista-${getClienteKey(item, index)}`, title: getClienteDisplayName(item), subtitle: getClienteIdentification(item) || 'Sin identificacion' }))} onSelectSuggestion={(suggestion) => { const item = transportistas.find((candidate, index) => `guia-transportista-${getClienteKey(candidate, index)}` === suggestion.id); if (item) onSelectTransportista(item); }} />
        {transportista ? <Text style={styles.profileValue}>Transportista: {getClienteDisplayName(transportista)}</Text> : null}
      </View>
      <View style={styles.formActions}>
        <PrimaryButton label="Continuar con destino" loading={false} onPress={() => transportista ? setStep(1) : Alert.alert('Transportista requerido', 'Selecciona primero un transportista.')} />
      </View>
      </> : null}
      {step === 1 ? <>
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <Text style={styles.invoicePanelTitle}>Destino y traslado</Text>
          <Text style={styles.invoicePanelPill}>Cliente, factura y fechas</Text>
        </View>
        <SearchField label="Encontrar destinatario *" placeholder="Identificacion o nombre del cliente" value={form.clienteBusquedaGuia} onChangeText={(value) => onChange('clienteBusquedaGuia', value)} resultCount={clientes.length} loading={loadingSearch} onSubmit={onSearchClientes} predictive suggestions={clientes.slice(0, 5).map((item, index) => ({ id: `guia-cliente-${getClienteKey(item, index)}`, title: getClienteDisplayName(item), subtitle: getClienteIdentification(item) || 'Sin identificacion' }))} onSelectSuggestion={(suggestion) => { const item = clientes.find((candidate, index) => `guia-cliente-${getClienteKey(candidate, index)}` === suggestion.id); if (item) onSelectCliente(item); }} />
        <SearchField label="Vincular factura (opcional)" placeholder="Numero completo o secuencial" value={form.facturaBusqueda} onChangeText={(value) => onChange('facturaBusqueda', value)} resultCount={facturas.length} loading={loadingSearch} onSubmit={onSearchFacturas} predictive suggestions={facturas.slice(0, 5).map((item, index) => ({ id: `guia-factura-${item.codfactura}-${index}`, title: item.numeroCompleto ?? item.numfactura ?? `Factura ${item.codfactura}`, subtitle: item.cliente ?? 'Consumidor final' }))} onSelectSuggestion={(suggestion) => { const item = facturas.find((candidate, index) => `guia-factura-${candidate.codfactura}-${index}` === suggestion.id); if (item) onSelectFactura(item); }} />
        <View style={styles.invoiceGrid}>
          <Field label="Placa *" value={form.placa} onChangeText={(value) => onChange('placa', value)} autoCapitalize="characters" />
        </View>
        <View style={styles.invoiceBottomGrid}>
          <View style={styles.clientCard}>
            <Text style={styles.clientName}>Informacion del Transportista</Text>
            <Field label="Identificacion" value={transportista?.numeroidentificacion ?? ''} onChangeText={() => undefined} />
            <Field label="Razon social" value={transportista ? getClienteDisplayName(transportista) : ''} onChangeText={() => undefined} />
            <Field label="Direccion del transportista *" value={form.direccion} onChangeText={(value) => onChange('direccion', value)} />
            <Field label="Contribuyente especial (opcional)" value={form.contribuyenteEspecial} onChangeText={(value) => onChange('contribuyenteEspecial', value)} />
            <ToggleRow label="Obligado a llevar contabilidad" text="Marca si aplica para el transportista." value={form.transportistaObligadoContabilidad} onChange={(value) => onChange('transportistaObligadoContabilidad', value)} />
            <View style={styles.invoiceGrid}>
              <Field label="Fecha emision *" value={form.fechaEmision} onChangeText={(value) => onChange('fechaEmision', value)} />
              <Field label="Fecha inicio traslado *" value={form.fechaInicioTraslado} onChangeText={(value) => onChange('fechaInicioTraslado', value)} />
            </View>
            <View style={styles.invoiceGrid}>
              <Field label="Fecha fin traslado *" value={form.fechaFinTraslado} onChangeText={(value) => onChange('fechaFinTraslado', value)} />
              <Field label="Detalle *" value={form.referencia} onChangeText={(value) => onChange('referencia', value)} />
            </View>
            <Field label="Direccion de origen *" value={form.direccionOrigen} onChangeText={(value) => onChange('direccionOrigen', value)} />
          </View>
          <View style={styles.clientCard}>
            <Text style={styles.clientName}>Informacion de cliente o factura</Text>
            <Text style={styles.clientMeta}>Destinatario: {cliente ? getClienteDisplayName(cliente) : factura?.cliente ?? '-'}</Text>
            <Text style={styles.clientMeta}>Identificacion: {cliente?.numeroidentificacion ?? factura?.identificacionCliente ?? '-'}</Text>
            <Text style={styles.clientMeta}>Factura: {factura?.numeroCompleto ?? factura?.numfactura ?? '-'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.formActions}>
        <SecondaryButton label="Volver a transporte" onPress={() => setStep(0)} />
        <PrimaryButton label="Continuar con detalle" loading={false} onPress={() => setStep(2)} />
      </View>
      </> : null}
      {step === 2 ? <>
      <View style={[styles.formSectionBox, styles.invoicePanel]}>
        <View style={styles.invoicePanelHeader}>
          <Text style={styles.invoicePanelTitle}>Detalles de traslado</Text>
          <Text style={styles.invoicePanelPill}>Se cargan automaticamente desde la factura y puedes ajustar cantidades.</Text>
        </View>
        {factura ? <Text style={styles.invoiceSectionHelp}>Los detalles se cargaron desde la factura vinculada. Solo puedes ajustar cantidades.</Text> : <>
        <SearchField label="Encontrar producto o detalle *" placeholder="Codigo, nombre o descripcion" value={form.productoBusqueda} onChangeText={(value) => onChange('productoBusqueda', value)} resultCount={productos.length} loading={loadingSearch} onSubmit={onSearchProductos} predictive suggestions={productos.slice(0, 5).map((item) => ({ id: `guia-producto-${item.codproducto}`, title: item.descripcion ?? item.codprincipal ?? 'Producto', subtitle: item.codprincipal ?? 'Sin codigo' }))} onSelectSuggestion={(suggestion) => { const item = productos.find((candidate) => `guia-producto-${candidate.codproducto}` === suggestion.id); if (item) onAddProducto(item); }} />
          <View style={styles.formActions}>
            <SecondaryButton label="Agregar detalle" onPress={onSearchProductos} />
          </View>
        </>}
        {detalles.length === 0 ? <EmptyState title="Sin detalles" text="Agrega productos del catalogo o registra un detalle manual." /> : null}
        {detalles.map((detalle, index) => (
          <View key={`guia-detalle-${index}`} style={styles.invoiceLineCard}>
            <Text style={styles.clientName} numberOfLines={2}>{detalle.producto.descripcion ?? detalle.producto.codprincipal}</Text>
            <View style={styles.invoiceLineFieldsGrid}>
              <View style={styles.clientDetailItem}>
                <Text style={styles.clientDetailLabel}>Codigo interno</Text>
                <Text style={styles.clientDetailValue}>{detalle.producto.codprincipal ?? detalle.producto.codproducto}</Text>
              </View>
              <View style={styles.invoiceLineField}><Field label="Cantidad *" value={detalle.cantidad} onChangeText={(value) => onUpdateDetalle(index, value)} keyboardType="number-pad" /></View>
            </View>
            <SecondaryButton label="Quitar detalle" onPress={() => onRemoveDetalle(index)} />
          </View>
        ))}
      </View>
      <View style={[styles.formSectionBox, styles.invoiceSummaryBox]}>
        <Text style={styles.clientFormSubtitle}>Resumen</Text>
        <Text style={styles.invoiceSectionHelp}>Totales del traslado</Text>
         <InvoiceSummaryRow label="Subtotal bruto" value={subtotalDocumento} />
         <InvoiceSummaryRow label="Subtotal con descuento" value={subtotalDocumento} />
         <InvoiceSummaryRow label="IVA" value={totals.iva} />
         <InvoiceSummaryRow label="Total documento" value={totalDocumento} />
         <View style={styles.invoiceTotalRow}>
           <Text style={styles.invoiceTotalLabel}>Total items</Text>
           <Text style={styles.invoiceTotalValue}>{totals.cantidad.toFixed(2)}</Text>
        </View>
      </View>
      <View style={styles.formActions}>
        <SecondaryButton label="Volver al destino" onPress={() => setStep(1)} />
        <SecondaryButton label="Cancelar / limpiar" onPress={handleClear} />
        {submitting ? (
          <View style={styles.directoryLoading}>
            <ActivityIndicator color="#0072BD" />
            <Text style={styles.mutedText}>{saving ? 'Generando guia de remision...' : 'Validando datos de la guia...'}</Text>
          </View>
        ) : null}
        <PrimaryButton label="Generar Guia de Remision" loading={saving || submitting} onPress={handleSave} />
      </View>
      </> : null}
    </>
  );
}

export function MisGuiasRemisionMobileScreen({
  guias,
  loading,
  message,
  onRefresh,
  onExportCsv,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onEmitir,
  onAnular,
}: {
  guias: GuiaRemisionListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
  onPdf: (guia: GuiaRemisionListItem, descargar?: boolean) => void;
  onSharePdf: (guia: GuiaRemisionListItem) => void;
  onXml: (guia: GuiaRemisionListItem) => void;
  onEmail: (guia: GuiaRemisionListItem) => void;
  onEmitir: (guia: GuiaRemisionListItem) => void;
  onAnular: (guia: GuiaRemisionListItem) => void;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [selectedGuia, setSelectedGuia] = useState<GuiaRemisionListItem | null>(null);
  const visibleGuias = guias.filter((guia) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [guia.numero, guia.destinatario, guia.identificacionDestinatario, guia.transportista, guia.estadoSri].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const isAuthorized = guia.autorizado || normalizeSriState(guia.estadoSri) === 'AUTORIZADO';
    const matchesStatus = statusFilter === 1 || (statusFilter === 2 && isAuthorized) || (statusFilter === 3 && !isAuthorized);
    return matchesText && matchesStatus;
  });
  const autorizadas = visibleGuias.filter((guia) => guia.autorizado || normalizeSriState(guia.estadoSri) === 'AUTORIZADO').length;

  return (
    <>
      <DocumentHistoryHero eyebrow="Traslados emitidos" title="Mis guias de remision" text="Filtra por destinatario, transportista o numero, exporta tu consulta y abre cada comprobante." metrics={[{ value: visibleGuias.length, label: 'Guias filtradas' }, { value: autorizadas, label: 'Autorizadas' }, { value: visibleGuias.length, label: 'Guias visibles' }]} />
      <View style={styles.invoiceHistoryFilterPanel}>
        <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
        <Text style={styles.clientName}>Guias de remision generadas</Text>
        <SearchField label="Buscar guias" placeholder="Guia, destinatario, identificacion o transportista" value={filter} onChangeText={setFilter} resultCount={visibleGuias.length} totalCount={guias.length} />
        <DropdownField
          label="Estado SRI"
          options={[{ label: 'Todos', value: 1 }, { label: 'Autorizadas', value: 2 }, { label: 'No autorizadas', value: 3 }]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value ?? 1)}
        />
        <View style={styles.formActions}>
          <SecondaryButton label="Descargar Excel" accentColor="#18B889" onPress={() => onExportCsv('guias-remision.csv', visibleGuias.map((guia) => ({
            Guia: guia.numero ?? '',
            Fecha: formatDocumentDate(guia.fecha),
            Destinatario: guia.destinatario ?? '',
            Identificacion: guia.identificacionDestinatario ?? '',
            Transportista: guia.transportista ?? '',
            Traslado: formatDocumentDate(guia.fechaTraslado),
            Estado: normalizeSriState(guia.estadoSri ?? (guia.autorizado ? 'AUTORIZADO' : 'PENDIENTE')),
          })))} />
          <PrimaryButton label="Refrescar" loading={loading} onPress={onRefresh} />
        </View>
      </View>
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando guias de remision...</Text>
        </View>
      ) : null}
      {!loading && visibleGuias.length === 0 ? <EmptyState title="Sin guias" text="Cuando generes guias de remision, apareceran aqui." /> : null}
      <View style={styles.listStack}>
        {visibleGuias.map((guia, index) => {
          const key = listItemKey('mis-guias', [guia.codGuia, guia.numero, guia.identificacionDestinatario], index);
          const statusLabel = normalizeSriState(guia.estadoSri ?? (guia.autorizado ? 'AUTORIZADO' : 'PENDIENTE'));
          const isAuthorized = guia.autorizado || statusLabel === 'AUTORIZADO';
          return (
            <View key={key} style={styles.invoiceHistoryCard}>
              <View style={styles.invoiceHistoryCardHeader}>
                <View style={styles.invoiceHistoryIdentityRow}>
                  <View style={styles.invoiceHistoryDocIcon}>
                    <MaterialCommunityIcons name="truck-delivery-outline" size={21} color="#0072BD" />
                  </View>
                  <View style={styles.invoiceHistoryCardInfo}>
                    <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{guia.numero ?? `Guia ${guia.codGuia}`}</Text>
                    <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(statusLabel)]}>
                      <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(statusLabel)]}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invoiceHistoryClientBlock}>
                  <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{guia.destinatario ?? 'Destinatario'}</Text>
                  <Text style={styles.invoiceHistoryId}>{guia.identificacionDestinatario ?? 'Sin identificacion'}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Fecha</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(guia.fecha)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Traslado</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(guia.fechaTraslado)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryAuthorization}>
                <View style={styles.invoiceHistoryAuthorizationTextBlock}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Transportista</Text>
                  <Text style={styles.invoiceHistoryAuthorizationText} numberOfLines={2}>{guia.transportista ?? 'No disponible'}</Text>
                </View>
                <DocumentActionsMenu actions={[
                  { label: 'Detalle', icon: 'information-outline', tone: 'primary', onPress: () => setSelectedGuia(guia) },
                  { label: 'Compartir PDF', icon: 'share-variant-outline', tone: 'primary', onPress: () => onSharePdf(guia) },
                  { label: 'Descargar XML', icon: 'file-code-outline', tone: 'success', onPress: () => onXml(guia) },
                  { label: 'Ver PDF A4', icon: 'eye-outline', tone: 'danger', onPress: () => onPdf(guia) },
                  { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(guia, true) },
                  { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(guia) },
                  ...(!isAuthorized ? [{ label: 'Emitir SRI', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onEmitir(guia) }] : []),
                  { label: 'Anular', icon: 'trash-can-outline', tone: 'danger', onPress: () => onAnular(guia) },
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <ItemDetailModal
        visible={Boolean(selectedGuia)}
        title={selectedGuia?.numero ?? 'Detalle de guia de remision'}
        values={selectedGuia ? [
          `Destinatario: ${selectedGuia.destinatario ?? 'Destinatario'}`,
          `Identificacion: ${selectedGuia.identificacionDestinatario ?? 'Sin identificacion'}`,
          `Transportista: ${selectedGuia.transportista ?? 'No disponible'}`,
          `Fecha: ${formatDocumentDate(selectedGuia.fecha)}`,
          `Traslado: ${formatDocumentDate(selectedGuia.fechaTraslado)}`,
          `Estado SRI: ${normalizeSriState(selectedGuia.estadoSri ?? (selectedGuia.autorizado ? 'AUTORIZADO' : 'PENDIENTE'))}`,
          selectedGuia.numeroAutorizacion ? `Autorización: ${selectedGuia.numeroAutorizacion}` : '',
          selectedGuia.mensajeSri ? `Mensaje SRI: ${selectedGuia.mensajeSri}` : '',
        ] : []}
        onClose={() => setSelectedGuia(null)}
      />
    </>
  );
}
export function MisRetencionesMobileScreen({
  retenciones,
  loading,
  message,
  onRefresh,
  onExportCsv,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onEmitir,
}: {
  retenciones: RetencionListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
  onPdf: (retencion: RetencionListItem, descargar?: boolean) => void;
  onSharePdf: (retencion: RetencionListItem) => void;
  onXml: (retencion: RetencionListItem) => void;
  onEmail: (retencion: RetencionListItem) => void;
  onEmitir: (retencion: RetencionListItem) => void;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [selectedRetencion, setSelectedRetencion] = useState<RetencionListItem | null>(null);
  const visibleRetenciones = retenciones.filter((retencion) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [retencion.numero, retencion.documentoSustento, retencion.proveedor, retencion.identificacionProveedor, retencion.tipoIdentificacionProveedor, retencion.numeroAutorizacion, retencion.claveAcceso, retencion.estadoSri].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const estado = normalizeSriState(retencion.estadoSri);
    const matchesStatus = statusFilter === 1
      || (statusFilter === 2 && estado === 'AUTORIZADO')
      || (statusFilter === 3 && estado === 'PENDIENTE')
      || (statusFilter === 4 && estado === 'RECHAZADO')
      || (statusFilter === 5 && estado === 'ERROR');
    return matchesText && matchesStatus;
  });
  const base = visibleRetenciones.reduce((sum, item) => sum + Number(item.base ?? 0), 0);
  const autorizadas = visibleRetenciones.filter((item) => normalizeSriState(item.estadoSri) === 'AUTORIZADO').length;

  return (
    <>
      <DocumentHistoryHero eyebrow="Retenciones emitidas" title="Mis retenciones" text="Busca por proveedor, comprobante o documento sustento, revisa el estado y exporta la consulta visible." metrics={[{ value: visibleRetenciones.length, label: 'Retenciones filtradas' }, { value: formatMoney(base), label: 'Base filtrada' }, { value: autorizadas, label: 'Autorizadas' }]} />
      <View style={styles.invoiceHistoryFilterPanel}>
        <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
        <Text style={styles.clientName}>Retenciones generadas</Text>
        <SearchField label="Buscar retenciones" placeholder="Numero, sustento, proveedor o identificacion" value={filter} onChangeText={setFilter} resultCount={visibleRetenciones.length} totalCount={retenciones.length} />
        <DropdownField
          label="Estado SRI"
          options={[{ label: 'Todos', value: 1 }, { label: 'Autorizadas', value: 2 }, { label: 'Pendientes', value: 3 }, { label: 'Rechazadas', value: 4 }, { label: 'Errores', value: 5 }]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value ?? 1)}
        />
        <View style={styles.formActions}>
          <SecondaryButton label="Descargar Excel" accentColor="#18B889" onPress={() => onExportCsv('retenciones.csv', visibleRetenciones.map((retencion) => ({
            Numero: retencion.numero ?? '',
            Fecha: formatDocumentDate(retencion.fecha),
            DocumentoSustento: retencion.documentoSustento ?? '',
            Proveedor: retencion.proveedor ?? '',
            Identificacion: retencion.identificacionProveedor ?? '',
            TipoIdentificacion: retencion.tipoIdentificacionProveedor ?? '',
            Estado: normalizeSriState(retencion.estadoSri),
            ClaveAcceso: retencion.claveAcceso ?? '',
            Base: formatMoney(retencion.base),
            Retenido: formatMoney(retencion.retenido),
          })))} />
          <PrimaryButton label="Refrescar" loading={loading} onPress={onRefresh} />
        </View>
      </View>
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando retenciones...</Text>
        </View>
      ) : null}
      {!loading && visibleRetenciones.length === 0 ? <EmptyState title="Sin retenciones" text="Cuando existan retenciones generadas, apareceran aqui." /> : null}
      <View style={styles.listStack}>
        {visibleRetenciones.map((retencion, index) => {
          const key = listItemKey('mis-retenciones', [retencion.codRetencion, retencion.numero, retencion.documentoSustento, retencion.identificacionProveedor], index);
          const statusLabel = normalizeSriState(retencion.estadoSri);
          const isAuthorized = statusLabel === 'AUTORIZADO';
          return (
            <View key={key} style={styles.invoiceHistoryCard}>
              <View style={styles.invoiceHistoryCardHeader}>
                <View style={styles.invoiceHistoryIdentityRow}>
                  <View style={styles.invoiceHistoryDocIcon}>
                    <MaterialCommunityIcons name="file-check-outline" size={21} color="#0072BD" />
                  </View>
                  <View style={styles.invoiceHistoryCardInfo}>
                    <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{retencion.numero ?? `Retencion ${retencion.codRetencion}`}</Text>
                    <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(statusLabel)]}>
                      <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(statusLabel)]}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invoiceHistoryClientBlock}>
                  <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{retencion.proveedor ?? 'Proveedor'}</Text>
                  <Text style={styles.invoiceHistoryId}>{retencion.identificacionProveedor ?? 'Sin identificacion'}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Fecha</Text>
                  <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(retencion.fecha)}</Text>
                </View>
                <View style={styles.invoiceHistoryDetailItem}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Retenido</Text>
                  <Text style={styles.invoiceHistoryAmount}>{formatMoney(retencion.retenido)}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryAuthorization}>
                <View style={styles.invoiceHistoryAuthorizationTextBlock}>
                  <Text style={styles.invoiceHistoryDetailLabel}>Documento sustento</Text>
                  <Text style={styles.invoiceHistoryAuthorizationText} numberOfLines={2}>{retencion.numeroAutorizacion || (isAuthorized ? 'Autorizado sin numero registrado' : 'Pendiente de autorizacion')} · Sustento {retencion.documentoSustento ?? 'No disponible'} · Base {formatMoney(retencion.base)}</Text>
                </View>
                <DocumentActionsMenu actions={[
                  { label: 'Detalle', icon: 'information-outline', tone: 'primary', onPress: () => setSelectedRetencion(retencion) },
                  { label: 'Compartir PDF', icon: 'share-variant-outline', tone: 'primary', onPress: () => onSharePdf(retencion) },
                  { label: 'Descargar XML', icon: 'file-code-outline', tone: 'success', onPress: () => onXml(retencion) },
                  { label: 'Ver PDF A4', icon: 'eye-outline', tone: 'danger', onPress: () => onPdf(retencion) },
                  { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(retencion, true) },
                  { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(retencion) },
                  ...(!isAuthorized ? [{ label: 'Emitir retención', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onEmitir(retencion) }] : []),
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <ItemDetailModal
        visible={Boolean(selectedRetencion)}
        title={selectedRetencion?.numero ?? 'Detalle de retencion'}
        values={selectedRetencion ? [
          `Documento sustento: ${selectedRetencion.documentoSustento ?? 'No disponible'}`,
          `Proveedor: ${selectedRetencion.proveedor ?? 'Proveedor'}`,
          `Identificacion: ${selectedRetencion.identificacionProveedor ?? 'Sin identificacion'}`,
          selectedRetencion.tipoIdentificacionProveedor ? `Tipo de identificacion: ${selectedRetencion.tipoIdentificacionProveedor}` : '',
          `Fecha: ${formatDocumentDate(selectedRetencion.fecha)}`,
          `Estado SRI: ${normalizeSriState(selectedRetencion.estadoSri)}`,
          selectedRetencion.numeroAutorizacion ? `Autorización: ${selectedRetencion.numeroAutorizacion}` : '',
          selectedRetencion.claveAcceso ? `Clave de acceso: ${selectedRetencion.claveAcceso}` : '',
          selectedRetencion.mensajeSri ? `Mensaje SRI: ${selectedRetencion.mensajeSri}` : '',
          `Base: ${formatMoney(selectedRetencion.base)}`,
          `Retenido: ${formatMoney(selectedRetencion.retenido)}`,
        ] : []}
        onClose={() => setSelectedRetencion(null)}
      />
    </>
  );
}

export function MisFacturasMobileScreen({
  facturas,
  notasCredito,
  loading,
  message,
  onRefresh,
  onExportCsv,
  onDetail,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onRetrySri,
  onAnular,
  onCuentasCobrar,
  onNotaCredito,
  processingNotaCreditoAutomatica,
}: {
  facturas: FacturaListItem[];
  notasCredito: NotaCreditoListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
  onDetail: (factura: FacturaListItem) => Promise<FacturaDetalle>;
  onPdf: (factura: FacturaListItem, descargar?: boolean) => void;
  onSharePdf: (factura: FacturaListItem) => void;
  onXml: (factura: FacturaListItem) => void;
  onEmail: (factura: FacturaListItem) => void;
  onRetrySri: (factura: FacturaListItem) => void;
  onAnular: (factura: FacturaListItem) => void;
  onCuentasCobrar: (factura: FacturaListItem) => void;
  onNotaCredito: (factura: FacturaListItem) => void;
  processingNotaCreditoAutomatica: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [page, setPage] = useState(1);
  const [selectedFactura, setSelectedFactura] = useState<FacturaListItem | null>(null);
  const [selectedFacturaDetail, setSelectedFacturaDetail] = useState<FacturaDetalle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const filteredFacturas = facturas.filter((factura) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [
      factura.numeroCompleto,
      factura.numfactura,
      factura.cliente,
      factura.identificacionCliente,
      factura.estadoSri,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const isAuthorized = factura.autorizado || String(factura.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
    const matchesStatus = statusFilter === 1 || (statusFilter === 2 && isAuthorized) || (statusFilter === 3 && !isAuthorized);
    return matchesText && matchesStatus;
  });
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredFacturas.length / pageSize));
  const visibleFacturas = filteredFacturas.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filter, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const viewFactura = async (factura: FacturaListItem) => {
    setSelectedFactura(factura);
    setSelectedFacturaDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
    try {
      setSelectedFacturaDetail(await onDetail(factura));
    } catch (error) {
      setDetailError(error instanceof ApiError ? error.message : 'No se pudo cargar el detalle de la factura.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <>
      <View style={styles.invoiceHistoryHeader}>
        <View style={styles.invoiceHistoryHeaderTop}>
          <View style={styles.invoiceHistoryHeaderIcon}>
            <MaterialCommunityIcons name="file-document-multiple-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.invoiceHistoryHeaderCopy}>
            <Text style={styles.invoiceHistoryEyebrow}>LISTADO</Text>
            <Text style={styles.invoiceHistoryTitle}>Mis facturas</Text>
            <Text style={styles.invoiceHistoryText}>Consulta tus comprobantes emitidos y ejecuta acciones del documento.</Text>
          </View>
        </View>
      </View>
      <View style={styles.invoiceHistoryFilterPanel}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
            <Text style={styles.clientFormTitle}>Facturas generadas</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label="Buscar facturas" placeholder="Numero, cliente, identificacion o estado" value={filter} onChangeText={setFilter} resultCount={visibleFacturas.length} totalCount={facturas.length} />
        <DropdownField
          label="Estado SRI"
          options={[
            { label: 'Todos', value: 1 },
            { label: 'Autorizadas', value: 2 },
            { label: 'No autorizadas', value: 3 },
          ]}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value ?? 1)}
        />
        <View style={styles.formActions}>
          <SecondaryButton label="Limpiar filtros" onPress={() => { setFilter(''); setStatusFilter(1); }} />
          <SecondaryButton label="Descargar Excel" accentColor="#18B889" onPress={() => onExportCsv('facturas.csv', filteredFacturas.map((factura) => ({
            Numero: factura.numeroCompleto ?? factura.numfactura ?? '',
            Fecha: formatDocumentDate(factura.fechaEmision),
            Cliente: factura.cliente ?? '',
            Identificacion: factura.identificacionCliente ?? '',
            Estado: factura.estadoSri ?? (factura.autorizado ? 'AUTORIZADO' : 'PENDIENTE'),
            Total: formatMoney(factura.total),
            SaldoPendiente: formatMoney(factura.saldoPendiente),
          })))} />
        </View>
      </View>
      {message && !processingNotaCreditoAutomatica ? <MessageBox message={message} /> : null}
      {processingNotaCreditoAutomatica ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Generando y autorizando la nota de credito automatica...</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando facturas...</Text>
        </View>
      ) : null}
      {!loading && visibleFacturas.length === 0 ? <EmptyState title={filter || statusFilter !== 1 ? 'Sin coincidencias' : 'Sin facturas'} text={filter || statusFilter !== 1 ? 'Prueba con otros terminos o cambia el estado seleccionado.' : 'Cuando generes facturas, apareceran aqui.'} /> : null}
      <View style={styles.listStack}>
        {visibleFacturas.map((factura, index) => {
          const facturaKey = listItemKey('mis-facturas', [factura.codfactura, factura.numeroCompleto, factura.numfactura, factura.serie, factura.fechaEmision], index);
          const status = factura.estadoSri ?? (factura.autorizado ? 'AUTORIZADO' : 'PENDIENTE');
          const isAuthorized = factura.autorizado || String(factura.estadoSri ?? '').toUpperCase().includes('AUTORIZ');
          const totalNotasCredito = notasCredito
            .filter((nota) => nota.documentoModificadoId === factura.codfactura && nota.estado !== false && (
              nota.autorizado || String(nota.estadoSri ?? '').toUpperCase().includes('AUTORIZ')
            ))
            .reduce((sum, nota) => sum + Number(nota.total ?? 0), 0);
          const paymentType = normalizeText(String(factura.tipopago ?? ''));
          const isCredit = paymentType === '19' || paymentType.includes('credito') || paymentType.includes('credit');
          const totalFactura = Number(factura.total ?? 0);
          const saldoFactura = Math.max(Number(factura.saldoPendiente ?? (totalFactura - Number(factura.totalAbonado ?? 0))), 0);
          const puedeCuentasCobrar = isCredit && saldoFactura - totalNotasCredito > 0.005;
          const puedeGenerarNotaCreditoAutomatica = isAuthorized && Number(factura.total ?? 0) - totalNotasCredito > 0.005;

          return (
          <View key={facturaKey} style={styles.invoiceHistoryCard}>
            <View style={styles.invoiceHistoryCardHeader}>
              <View style={styles.invoiceHistoryIdentityRow}>
                <View style={styles.invoiceHistoryDocIcon}>
                  <MaterialCommunityIcons name="file-document-outline" size={21} color="#0072BD" />
                </View>
                <View style={styles.invoiceHistoryCardInfo}>
                  <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{factura.numeroCompleto ?? factura.numfactura ?? `Factura ${factura.codfactura}`}</Text>
                  <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(status)]}>
                    <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(status)]}>{status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.invoiceHistoryClientBlock}>
                <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{factura.cliente ?? 'Consumidor final'}</Text>
                <Text style={styles.invoiceHistoryId}>{factura.identificacionCliente ?? 'Sin identificacion'}</Text>
              </View>
            </View>
            <View style={styles.invoiceHistoryDetailGrid}>
              <View style={styles.invoiceHistoryDetailItem}>
                <Text style={styles.invoiceHistoryDetailLabel}>Fecha</Text>
                <Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(factura.fechaEmision)}</Text>
              </View>
              <View style={styles.invoiceHistoryDetailItem}>
                <Text style={styles.invoiceHistoryDetailLabel}>Total</Text>
                <Text style={styles.invoiceHistoryAmount}>{formatMoney(factura.total)}</Text>
              </View>
            </View>
            <View style={styles.invoiceHistoryAuthorization}>
              <View style={styles.invoiceHistoryAuthorizationTextBlock}>
                <Text style={styles.invoiceHistoryDetailLabel}>Autorizacion</Text>
                <Text style={styles.invoiceHistoryAuthorizationText} numberOfLines={2}>
                  {factura.numeroAutorizacion || factura.mensajeSri || (factura.autorizado ? 'Autorizado sin numero registrado' : 'No disponible')}
                </Text>
              </View>
              <DocumentActionsMenu actions={[
                { label: 'Ver factura', icon: 'information-outline', tone: 'primary', onPress: () => { void viewFactura(factura); } },
                ...(puedeCuentasCobrar ? [{ label: 'Cuentas por cobrar', icon: 'cash-check', tone: 'success' as const, onPress: () => onCuentasCobrar(factura) }] : []),
                ...(puedeGenerarNotaCreditoAutomatica ? [{ label: 'NC automática', icon: 'file-undo-outline', tone: 'primary' as const, onPress: () => onNotaCredito(factura) }] : []),
                { label: 'Compartir PDF', icon: 'share-variant-outline', tone: 'primary', onPress: () => onSharePdf(factura) },
                { label: 'Descargar XML', icon: 'file-code-outline', tone: 'success', onPress: () => onXml(factura) },
                { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(factura, true) },
                { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(factura) },
                ...(!isAuthorized ? [{ label: 'Reenviar al SRI', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onRetrySri(factura) }] : []),
                { label: 'Anular factura', icon: 'trash-can-outline', tone: 'danger', onPress: () => onAnular(factura) },
              ]} />
            </View>
          </View>
          );
        })}
      </View>
      {filteredFacturas.length > pageSize ? (
        <View style={styles.documentPagination}>
          <Pressable style={[styles.documentPaginationButton, page === 1 && styles.documentPaginationButtonDisabled]} disabled={page === 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={page === 1 ? '#AFC2CF' : '#0878C9'} />
          </Pressable>
          <Text style={styles.documentPaginationText}>Página {page} de {totalPages} · {filteredFacturas.length} facturas</Text>
          <Pressable style={[styles.documentPaginationButton, page === totalPages && styles.documentPaginationButtonDisabled]} disabled={page === totalPages} onPress={() => setPage((value) => Math.min(totalPages, value + 1))}>
            <MaterialCommunityIcons name="chevron-right" size={20} color={page === totalPages ? '#AFC2CF' : '#0878C9'} />
          </Pressable>
        </View>
      ) : null}
      <ItemDetailModal
        visible={Boolean(selectedFactura)}
        title={selectedFactura?.numeroCompleto ?? selectedFactura?.numfactura ?? 'Detalle de factura'}
        values={loadingDetail ? ['Cargando detalle de la factura...'] : detailError ? [detailError] : selectedFactura ? [
          `Cliente: ${selectedFactura.cliente ?? 'Consumidor final'}`,
          `Identificación: ${selectedFactura.identificacionCliente ?? 'Sin identificación'}`,
          `Fecha de emisión: ${formatDocumentDate(selectedFactura.fechaEmision)}`,
          `Total: ${formatMoney(selectedFactura.total)}`,
          `Estado SRI: ${selectedFactura.estadoSri ?? (selectedFactura.autorizado ? 'AUTORIZADO' : 'PENDIENTE')}`,
          `Estado de pago: ${selectedFactura.estadoPago ?? 'Sin información'}`,
          `Detalles: ${selectedFacturaDetail?.detalles?.length ?? 0}`,
          selectedFactura.numeroAutorizacion ? `Autorización: ${selectedFactura.numeroAutorizacion}` : '',
          selectedFactura.mensajeSri ? `Mensaje SRI: ${selectedFactura.mensajeSri}` : '',
        ].filter(Boolean) : []}
        onClose={() => setSelectedFactura(null)}
      />
    </>
  );
}
