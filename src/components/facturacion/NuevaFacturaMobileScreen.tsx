import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import type { FacturaPreparacion, FacturaProducto } from '../../services/facturasMobileService';
import type { Cliente, PuntosEmisionData } from '../../types/business';
import type { NuevaFacturaFormState, NuevaFacturaLinea } from '../../types/invoices';
import { EmptyState } from '../ui/FeedbackStates';
import { Field, MessageBox, MessageState, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { DropdownField } from '../ui/FormShared';
import { InvoiceProgressSteps as SharedInvoiceProgressSteps, InvoiceSummaryRow } from './InvoiceShared';
import { styles } from '../../styles/appStyles';
import { getDocumentSerieOptions, getEffectiveDocumentSerie, getNextSequence, getNextSequenceFromOptions, getSerieLabel, getSerieLabelFromOptions, usePreferredDocumentSerie } from '../../utils/documentSeries';
import { formatMoney } from '../../utils/documentFormatting';
import { getClienteDisplayName, getClienteIdentification, getClienteKey, getFacturaProductoKey } from '../../utils/clientDisplay';
import { getIvaOptionValue, getIvaOptions, getTipoClienteOptions } from '../../utils/facturaOptions';

export function NuevaFacturaMobileScreen({
  form,
  preparacion,
  puntosData,
  cliente,
  clientes,
  productos,
  lineas,
  loading,
  saving,
  message,
  draftSaved,
  onChange,
  onSearchClientes,
  onSelectCliente,
  onSearchProductos,
  onAddProducto,
  onUpdateLinea,
  onRemoveLinea,
  onClear,
  onHistory,
  onSave,
}: {
  form: NuevaFacturaFormState;
  preparacion: FacturaPreparacion | null;
  puntosData: PuntosEmisionData | null;
  cliente: Cliente | null;
  clientes: Cliente[];
  productos: FacturaProducto[];
  lineas: NuevaFacturaLinea[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  draftSaved: boolean;
  onChange: (field: keyof NuevaFacturaFormState, value: string) => void;
  onSearchClientes: () => void;
  onSelectCliente: (cliente: Cliente) => void;
  onSearchProductos: () => void;
  onAddProducto: (producto: FacturaProducto) => void;
  onUpdateLinea: (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => void;
  onRemoveLinea: (index: number) => void;
  onClear: () => void;
  onHistory: () => void;
  onSave: () => void | Promise<void>;
}) {
  const toNumber = (value: string) => Number(value.replace(',', '.')) || 0;
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const totals = lineas.reduce(
    (acc, item) => {
      const quantity = toNumber(item.cantidad);
      const price = toNumber(item.precio);
      const discount = toNumber(item.descuento);
      const rate = toNumber(item.tarifa);
      const base = roundMoney(Math.max(quantity * price - discount, 0));
      const tax = roundMoney(base * (rate / 100));
      const key = rate <= 0 ? 'baseZero' : 'baseTaxed';
      return {
        ...acc,
        [key]: acc[key] + base,
        discount: acc.discount + roundMoney(discount),
        iva: acc.iva + tax,
        total: acc.total + roundMoney(base + tax),
      };
    },
    { baseTaxed: 0, baseZero: 0, discount: 0, iva: 0, total: 0 },
  );
  const serieOptions = getDocumentSerieOptions(preparacion, puntosData, 'factura');
  usePreferredDocumentSerie(serieOptions, form.serie, (serie) => onChange('serie', serie));
  const effectiveSerie = getEffectiveDocumentSerie(serieOptions, form.serie) || form.serie;
  const formaPagoOptions = preparacion?.formasPago ?? [];
  const ivaOptions = getIvaOptions(preparacion);
  const tipoClienteOptions = getTipoClienteOptions(preparacion);
  const serieLabel = getSerieLabelFromOptions(serieOptions, effectiveSerie, getSerieLabel(preparacion, effectiveSerie, '001-001'));
  const optionInvoiceNumber = getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
  const invoiceNumber = effectiveSerie ? form.numeroFactura || optionInvoiceNumber || (puntosData?.cajas?.length ? '' : getNextSequence(preparacion, effectiveSerie, 1)) : '';
  const referenciaWords = form.referencia.trim().split(/\s+/).filter(Boolean).length;
  const displayProductos = productos.length > 0 ? productos.slice(0, 2) : lineas.map((item) => item.producto).slice(0, 2);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const nextStep = () => {
    if (step === 0 && !cliente) return;
    if (step === 1 && lineas.length === 0) return;
    setStep((current) => Math.min(current + 1, 2));
  };
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
        Alert.alert('No se pudo generar la factura', error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <>
      <View style={[styles.adminHeroCard, styles.invoiceHeroCard]}>
        <View style={styles.invoiceHeroText}>
          <Text style={styles.heroEyebrow}>Documento de venta</Text>
          <Text style={styles.heroTitle}>Nueva factura</Text>
          <Text style={styles.heroText}>Completa cliente, detalle y cobro con una vista ordenada.</Text>
          {draftSaved ? <View style={styles.invoiceDraftStatus}><MaterialCommunityIcons name="cloud-check-outline" size={15} color="#0F8A4B" /><Text style={styles.invoiceDraftStatusText}>Borrador guardado automáticamente</Text></View> : null}
        </View>
        <View style={styles.invoiceHeaderActions}>
          <View style={styles.invoiceHeaderBox}>
            <DropdownField
              label="Serie *"
              options={serieOptions.map((item, index) => ({ label: item.serieVisual || item.serieRaw || `Serie ${index + 1}`, value: index + 1 }))}
              value={Math.max(serieOptions.findIndex((item) => item.serieRaw === form.serie || item.serieVisual === form.serie) + 1, 0) || null}
              onChange={(value) => onChange('serie', value ? serieOptions[value - 1]?.serieRaw ?? serieOptions[value - 1]?.serieVisual ?? '' : '')}
              allowClear
            />
          </View>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Numero de factura</Text>
            <Text style={styles.invoiceHeaderValue}>{invoiceNumber}</Text>
          </View>
          <SecondaryButton label="Historial" onPress={onHistory} />
          <SecondaryButton label="Limpiar pantalla" onPress={handleClear} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Cliente', 'Productos', 'Revisión']} activeIndex={step} />
      {message ? <MessageBox message={message} /> : null}
      {submitting ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>{saving ? 'Generando factura y enviandola al SRI...' : 'Validando datos de la factura...'}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando facturacion...</Text>
        </View>
      ) : null}
      {step === 0 ? <>
        <View style={styles.formSectionBox}>
          <Text style={styles.clientFormSubtitle}>Buscador de cliente</Text>
          <Text style={styles.invoiceSectionHelp}>Busca por nombre, RUC o cédula. Solo necesitas seleccionar un resultado.</Text>
          <SearchField label="Encontrar cliente *" placeholder="Identificacion, nombres, apellidos o razon social" value={form.clienteBusqueda} onChangeText={(value) => onChange('clienteBusqueda', value)} resultCount={clientes.length} onSubmit={onSearchClientes} predictive suggestions={clientes.slice(0, 5).map((item, index) => ({ id: `factura-cliente-${getClienteKey(item, index)}`, title: getClienteDisplayName(item), subtitle: getClienteIdentification(item) || 'Sin identificacion' }))} onSelectSuggestion={(suggestion) => { const item = clientes.find((candidate, index) => `factura-cliente-${getClienteKey(candidate, index)}` === suggestion.id); if (item) onSelectCliente(item); }} />
          {cliente ? <Text style={styles.profileValue}>Seleccionado: {getClienteDisplayName(cliente)} - {cliente.numeroidentificacion}</Text> : null}
        </View>
        {cliente ? <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}>
            <Text style={styles.invoicePanelTitle}>Informacion del Cliente</Text>
            <Text style={styles.invoicePanelPill}>Datos del cliente seleccionado</Text>
          </View>
          <View style={styles.invoiceGrid}>
            <Field label="Tipo identificacion *" value={form.tipoIdentificacion} onChangeText={(value) => onChange('tipoIdentificacion', value)} />
            <Field label="Numero de identificacion *" value={cliente?.numeroidentificacion ?? form.numeroIdentificacion} onChangeText={(value) => onChange('numeroIdentificacion', value)} />
          </View>
          <View style={styles.invoiceGrid}>
            <DropdownField label="Tipo cliente *" options={tipoClienteOptions} value={Number(form.tipoCliente) || null} onChange={(value) => onChange('tipoCliente', value ? String(value) : '')} />
            <Field label="Obligado a llevar contabilidad *" value={form.obligadoContabilidad} onChangeText={(value) => onChange('obligadoContabilidad', value)} />
          </View>
          <Field label="Direccion (max 100) *" value={form.direccion} onChangeText={(value) => onChange('direccion', value)} />
          <View style={styles.invoiceGrid}>
            <Field label="Telefono (opcional)" value={form.telefono} onChangeText={(value) => onChange('telefono', value)} keyboardType="phone-pad" />
            <Field label="Correo electronico principal (opcional)" value={form.correoPrincipal} onChangeText={(value) => onChange('correoPrincipal', value)} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <Field label="Correo adicional (opcional, solo esta factura)" value={form.correoAdicional} onChangeText={(value) => onChange('correoAdicional', value)} autoCapitalize="none" keyboardType="email-address" />
        </View> : null}
        <View style={styles.formActions}><PrimaryButton label="Continuar con productos" loading={false} onPress={nextStep} /></View>
      </> : null}
      {step === 1 ? <>
        <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}><Text style={styles.invoicePanelTitle}>Detalle de Factura</Text></View>
          <SearchField label="Encontrar producto o servicio *" placeholder="Codigo, nombre o descripcion" value={form.productoBusqueda} onChangeText={(value) => onChange('productoBusqueda', value)} resultCount={productos.length} onSubmit={onSearchProductos} predictive suggestions={productos.slice(0, 5).map((item, index) => ({ id: getFacturaProductoKey(item, index), title: item.descripcion ?? item.codprincipal ?? 'Producto', subtitle: item.codprincipal ?? 'Sin codigo' }))} onSelectSuggestion={(suggestion) => { const item = productos.find((candidate, index) => getFacturaProductoKey(candidate, index) === suggestion.id); if (item) onAddProducto(item); }} />
          <Text style={styles.invoiceSectionHelp}>Busca un producto, selecciónalo y ajusta cantidad o precio si hace falta.</Text>
          {lineas.length === 0 ? <EmptyState title="Sin detalle" text="Agrega al menos un producto o servicio para emitir la factura." /> : null}
          {lineas.map((linea, index) => {
            const quantity = toNumber(linea.cantidad);
            const price = toNumber(linea.precio);
            const discount = toNumber(linea.descuento);
            const base = roundMoney(Math.max(quantity * price - discount, 0));
            const rate = toNumber(linea.tarifa);
            const total = roundMoney(base + roundMoney(base * (rate / 100)));
            return (
              <View key={`linea-factura-${index}`} style={styles.invoiceLineCard}>
                <View style={styles.clientCardHeader}><View style={styles.clientInfo}><Text style={styles.clientName} numberOfLines={2}>{linea.producto.descripcion ?? linea.producto.codprincipal}</Text><Text style={styles.clientMeta} numberOfLines={1}>Codigo: {linea.producto.codprincipal ?? linea.producto.codproducto}</Text></View><Text style={styles.invoiceLineTotal}>{formatMoney(total)}</Text></View>
                <Field label="Detalle de la línea (opcional)" value={linea.detalle ?? ''} onChangeText={(value) => onUpdateLinea(index, 'detalle', value)} />
                <View style={styles.invoiceLineFieldsGrid}><View style={styles.invoiceLineField}><Field label="Cantidad *" value={linea.cantidad} onChangeText={(value) => onUpdateLinea(index, 'cantidad', value)} keyboardType="number-pad" /></View><View style={styles.invoiceLineField}><Field label="Precio *" value={linea.precio} onChangeText={(value) => onUpdateLinea(index, 'precio', value)} keyboardType="decimal-pad" /></View></View>
                <View style={styles.invoiceLineFieldsGrid}><View style={styles.invoiceLineField}><Field label="Descuento (opcional)" value={linea.descuento} onChangeText={(value) => onUpdateLinea(index, 'descuento', value)} keyboardType="decimal-pad" /></View><View style={styles.invoiceLineField}>{ivaOptions.length > 0 ? <DropdownField label="IVA *" options={ivaOptions} value={getIvaOptionValue(ivaOptions, rate)} onChange={(value) => onUpdateLinea(index, 'tarifa', value === null ? '0' : String(value))} allowClear /> : <Field label="IVA % *" value={linea.tarifa} onChangeText={(value) => onUpdateLinea(index, 'tarifa', value)} keyboardType="decimal-pad" />}</View></View>
                <View style={styles.clientDetailGrid}><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Desc. apl.</Text><Text style={styles.clientDetailValue}>{formatMoney(discount)}</Text></View><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Base imp.</Text><Text style={styles.clientDetailValue}>{formatMoney(base)}</Text></View></View>
                <SecondaryButton label="Quitar linea" onPress={() => onRemoveLinea(index)} />
              </View>
            );
          })}
        </View>
        <View style={styles.formActions}><SecondaryButton label="Volver al cliente" onPress={() => setStep(0)} /><PrimaryButton label="Continuar con revisión" loading={false} onPress={nextStep} /></View>
      </> : null}
      {step === 2 ? <>
        <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}><Text style={styles.invoicePanelTitle}>Cobro y datos finales</Text><Text style={styles.invoicePanelPill}>Último paso</Text></View>
          <View style={styles.invoiceChargeBox}><Text style={styles.clientFormSubtitle}>Forma de pago</Text><DropdownField label="Forma de pago (SRI) *" options={formaPagoOptions.map((item, index) => ({ label: String(item.descripcionSri || item.descripcion || item.codigo || `Forma ${index + 1}`), value: index + 1 }))} value={Math.max(formaPagoOptions.findIndex((item) => String(item.codigo ?? '') === form.formaPago) + 1, 0) || null} onChange={(value) => onChange('formaPago', value ? String(formaPagoOptions[value - 1]?.codigo ?? '') : '')} allowClear /></View>
          <View style={styles.invoiceReferenceHeader}><Text style={styles.clientFormSubtitle}>Nota o referencia</Text><Text style={styles.invoicePanelPill}>{referenciaWords} / 100 palabras</Text></View>
          <Field label="Observaciones (opcional)" value={form.referencia} onChangeText={(value) => onChange('referencia', value)} />
        </View>
        <View style={styles.invoiceBottomGrid}>
          <View style={[styles.formSectionBox, styles.invoiceFrequentBox]}><Text style={styles.clientFormSubtitle}>Productos frecuentes del cliente</Text><Text style={styles.invoiceSectionHelp}>Selecciona un cliente para usar sus productos habituales</Text>{displayProductos.length === 0 ? <Text style={styles.clientMeta}>Busca productos para mostrarlos aqui.</Text> : null}{displayProductos.map((producto, index) => <Pressable key={getFacturaProductoKey(producto, index, 'producto-frecuente')} style={styles.invoiceFrequentItem} onPress={() => onAddProducto(producto)}><Text style={styles.clientName}>{producto.descripcion ?? producto.codprincipal ?? 'Producto'}</Text><Text style={styles.clientMeta}>{producto.codprincipal ?? 'Sin codigo'} - {formatMoney(producto.precioUnitario)}</Text></Pressable>)}</View>
          <View style={[styles.formSectionBox, styles.invoiceSummaryBox]}><Text style={styles.clientFormSubtitle}>Resumen</Text><Text style={styles.invoiceSectionHelp}>Totales del comprobante</Text><InvoiceSummaryRow label="Subtotal base gravada" value={totals.baseTaxed} /><InvoiceSummaryRow label="Subtotal base 0%" value={totals.baseZero} /><InvoiceSummaryRow label="Subtotal no objeto IVA" value={0} /><InvoiceSummaryRow label="Subtotal exento IVA" value={0} /><InvoiceSummaryRow label="Descuento" value={totals.discount} danger /><InvoiceSummaryRow label="Subtotal con descuento" value={totals.baseTaxed + totals.baseZero} /><InvoiceSummaryRow label="IVA" value={totals.iva} /><InvoiceSummaryRow label="ICE" value={0} /><InvoiceSummaryRow label="Servicio 10%" value={0} /><InvoiceSummaryRow label="IRBPNR" value={0} /><View style={styles.invoiceTotalRow}><Text style={styles.invoiceTotalLabel}>Total</Text><Text style={styles.invoiceTotalValue}>{formatMoney(totals.total)}</Text></View></View>
        </View>
        <View style={styles.formActions}><SecondaryButton label="Volver a productos" onPress={() => setStep(1)} /><SecondaryButton label="Limpiar" onPress={handleClear} /><PrimaryButton label="Generar factura" loading={saving || submitting} onPress={handleSave} /></View>
      </> : null}
    </>
  );
}
