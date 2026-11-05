import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import type { FacturaListItem, FacturaPreparacion, FacturaProducto } from '../../services/facturasMobileService';
import type { Cliente, PuntosEmisionData } from '../../types/business';
import type { NotaCreditoFormState, NuevaFacturaLinea } from '../../types/invoices';
import { EmptyState } from '../ui/FeedbackStates';
import { Field, MessageBox, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import type { MessageState } from '../ui/FormControls';
import { DropdownField } from '../ui/FormShared';
import { InvoiceProgressSteps as SharedInvoiceProgressSteps, InvoiceSummaryRow } from './InvoiceShared';
import { styles } from '../../styles/appStyles';
import { getDocumentSerieOptions, getEffectiveDocumentSerie, getNextSequence, getNextSequenceFromOptions, getSelectedDocumentSerieOption, getSerieLabel, getSerieLabelFromOptions, usePreferredDocumentSerie } from '../../utils/documentSeries';
import { formatMoney } from '../../utils/documentFormatting';
import { getClienteDisplayName } from '../../utils/clientDisplay';
import { getIvaOptionValue, getIvaOptions, getTipoClienteOptions } from '../../utils/facturaOptions';

export function NuevaNotaCreditoMobileScreen({
  form,
  preparacion,
  puntosData,
  factura,
  facturas,
  cliente,
  clientes,
  lineas,
  loading,
  saving,
  message,
  onChange,
  onSearchClientes,
  onSelectCliente,
  onSearchFacturas,
  onSelectFactura,
  onImportXml,
  onUpdateLinea,
  onRemoveLinea,
  onClear,
  onHistory,
  onSave,
}: {
  form: NotaCreditoFormState;
  preparacion: FacturaPreparacion | null;
  puntosData: PuntosEmisionData | null;
  factura: FacturaListItem | null;
  facturas: FacturaListItem[];
  cliente: Cliente | null;
  clientes: Cliente[];
  lineas: NuevaFacturaLinea[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  onChange: (field: keyof NotaCreditoFormState, value: string) => void;
  onSearchClientes: () => void;
  onSelectCliente: (cliente: Cliente) => void;
  onSearchFacturas: () => void;
  onSelectFactura: (factura: FacturaListItem) => void | Promise<void>;
  onImportXml: (uri: string) => Promise<void>;
  onUpdateLinea: (index: number, field: keyof Omit<NuevaFacturaLinea, 'producto'>, value: string) => void;
  onRemoveLinea: (index: number) => void;
  onClear: () => void;
  onHistory: () => void;
  onSave: () => void | Promise<void>;
}) {
  const toNumber = (value: string) => Number(value.replace(',', '.')) || 0;
  const totals = lineas.reduce(
    (acc, item) => {
      const base = Math.max(toNumber(item.cantidad) * toNumber(item.precio) - toNumber(item.descuento), 0);
      const iva = base * (toNumber(item.tarifa) / 100);
      return {
        subtotal: acc.subtotal + base,
        descuento: acc.descuento + toNumber(item.descuento),
        iva: acc.iva + iva,
        ivaZero: toNumber(item.tarifa) <= 0 ? acc.ivaZero + base : acc.ivaZero,
        total: acc.total + base + iva,
      };
    },
    { subtotal: 0, descuento: 0, iva: 0, ivaZero: 0, total: 0 },
  );
  const serieOptions = getDocumentSerieOptions(preparacion, puntosData, 'notaCredito');
  usePreferredDocumentSerie(serieOptions, form.serie, (serie) => onChange('serie', serie));
  const effectiveSerie = getEffectiveDocumentSerie(serieOptions, form.serie) || form.serie;
  const serieLabel = getSerieLabelFromOptions(serieOptions, effectiveSerie, getSerieLabel(preparacion, effectiveSerie, '001-002'));
  const optionNotaNumber = getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
  const notaNumber = effectiveSerie ? form.numeroFactura || optionNotaNumber || (puntosData?.cajas?.length ? '' : getNextSequence(preparacion, effectiveSerie)) : '';
  const tipoClienteOptions = getTipoClienteOptions(preparacion);
  const ivaOptions = getIvaOptions(preparacion);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const handleClear = () => {
    onClear();
    setStep(1);
  };
  const handleSave = () => {
    if (saving || submitting) return;
    setSubmitting(true);
    void (async () => {
      try {
        await onSave();
      } catch (error) {
        Alert.alert('No se pudo generar la nota de credito', error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <>
      <View style={[styles.adminHeroCard, styles.invoiceHeroCard]}>
        <View style={styles.invoiceHeroText}>
          <Text style={styles.heroEyebrow}>Documento de ajuste</Text>
          <Text style={styles.heroTitle}>Nueva nota de credito</Text>
          <Text style={styles.heroText}>Parte de la factura original, corrige el detalle y conserva una vista clara.</Text>
        </View>
        <View style={styles.invoiceHeaderActions}>
          <View style={styles.invoiceHeaderBox}>
            <DropdownField
              label="Serie *"
              options={serieOptions.map((item, index) => ({ label: item.serieVisual || item.serieRaw || `Serie ${index + 1}`, value: index + 1 }))}
              value={Math.max(serieOptions.findIndex((item) => item === getSelectedDocumentSerieOption(serieOptions, effectiveSerie)) + 1, 0) || (serieOptions.length ? 1 : null)}
              onChange={(value) => onChange('serie', value ? serieOptions[value - 1]?.serieRaw ?? serieOptions[value - 1]?.serieVisual ?? effectiveSerie : effectiveSerie)}
            />
          </View>
          <View style={styles.invoiceHeaderBox}>
            <Text style={styles.invoiceMiniLabel}>Nota de credito</Text>
            <Text style={styles.invoiceHeaderValue}>{notaNumber}</Text>
          </View>
          <SecondaryButton label="Historial" onPress={onHistory} />
          <SecondaryButton label="Limpiar pantalla" onPress={handleClear} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Factura', 'Detalle']} activeIndex={Math.max(step - 1, 0)} />
      {message ? <MessageBox message={message} /> : null}
      {submitting ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>{saving ? 'Generando nota de credito y enviandola al SRI...' : 'Validando datos de la nota de credito...'}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando notas de credito...</Text>
        </View>
      ) : null}
      {step === 1 ? <>
        <View style={styles.formSectionBox}>
          <Text style={styles.clientFormSubtitle}>Buscador de factura</Text>
          <Text style={styles.invoiceSectionHelp}>Selecciona la factura modificada. El cliente, los datos de sustento y los detalles se cargarán automáticamente.</Text>
          <SearchField label="Encontrar factura *" placeholder="Número completo o secuencial" value={form.facturaBusqueda} onChangeText={(value) => onChange('facturaBusqueda', value)} resultCount={facturas.length} onSubmit={onSearchFacturas} predictive suggestions={facturas.slice(0, 5).map((item, index) => ({ id: `nota-credito-factura-${item.codfactura}-${index}`, title: item.numeroCompleto ?? item.numfactura ?? `Factura ${item.codfactura}`, subtitle: `${item.cliente ?? 'Consumidor final'} · ${formatMoney(item.total)}` }))} onSelectSuggestion={(suggestion) => { const item = facturas.find((candidate, index) => `nota-credito-factura-${candidate.codfactura}-${index}` === suggestion.id); if (item) onSelectFactura(item); }} />
          <Text style={styles.invoiceSearchHint}>Si no aparece, ya fue anulada totalmente o no tiene saldo disponible.</Text>
          {factura ? <Text style={styles.profileValue}>Factura seleccionada: {factura.numeroCompleto ?? factura.numfactura ?? '-'} · {cliente ? getClienteDisplayName(cliente) : 'Cargando cliente'}</Text> : null}
        </View>
        {factura && cliente ? <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}>
            <Text style={styles.invoicePanelTitle}>Informacion del Cliente</Text>
            <Text style={styles.invoicePanelPill}>Cargado desde factura</Text>
          </View>
          <View style={styles.invoiceGrid}>
            <Field label="Tipo identificacion *" value={form.tipoIdentificacion} onChangeText={(value) => onChange('tipoIdentificacion', value)} />
            <Field label="Numero identificacion *" value={form.numeroIdentificacion} onChangeText={(value) => onChange('numeroIdentificacion', value)} />
          </View>
          <View style={styles.invoiceGrid}>
            <DropdownField label="Tipo cliente *" options={tipoClienteOptions} value={Number(form.tipoCliente) || null} onChange={(value) => onChange('tipoCliente', value === null ? '' : String(value))} />
            <Field label="Obligado a llevar contabilidad *" value={form.obligadoContabilidad} onChangeText={(value) => onChange('obligadoContabilidad', value)} />
          </View>
          <Field label="Nombre / razon social *" value={form.clienteBusqueda} onChangeText={(value) => onChange('clienteBusqueda', value)} />
          <Field label="Direccion (max 100) *" value={form.direccion} onChangeText={(value) => onChange('direccion', value)} />
          <View style={styles.invoiceGrid}>
            <Field label="Telefono (opcional)" value={form.telefono} onChangeText={(value) => onChange('telefono', value)} keyboardType="phone-pad" />
            <Field label="Correo electronico principal (opcional)" value={form.correoPrincipal} onChangeText={(value) => onChange('correoPrincipal', value)} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <Field label="Correo adicional (opcional, solo esta nota)" value={form.correoAdicional} onChangeText={(value) => onChange('correoAdicional', value)} autoCapitalize="none" keyboardType="email-address" />
          <View style={styles.invoiceGrid}>
            <DropdownField
              label="Motivo de la nota de credito"
              options={[
                { label: 'Anular operaciones', value: 1 },
                { label: 'Devolucion parcial', value: 2 },
                { label: 'Descuento o bonificacion', value: 3 },
                { label: 'Correccion de valores', value: 4 },
              ]}
              value={Math.max(['Anular operaciones', 'Devolucion parcial', 'Descuento o bonificacion', 'Correccion de valores'].findIndex((item) => item === form.motivo) + 1, 1)}
              onChange={(value) => onChange('motivo', ['Anular operaciones', 'Devolucion parcial', 'Descuento o bonificacion', 'Correccion de valores'][(value ?? 1) - 1])}
            />
          <Field label="Observacion (opcional, max 250 caracteres)" value={form.observacion} onChangeText={(value) => onChange('observacion', value.slice(0, 250))} />
          </View>
        </View> : null}
        <View style={styles.formActions}>
          {factura ? <SecondaryButton label="Limpiar pantalla" onPress={handleClear} /> : null}
          {factura && cliente ? <PrimaryButton label="Continuar con detalle" loading={false} onPress={() => setStep(2)} /> : null}
        </View>
      </> : null}
      {step === 2 ? <>
        <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}>
            <Text style={styles.invoicePanelTitle}>Detalle de Nota de Credito</Text>
          </View>
          {lineas.length === 0 ? <EmptyState title="Sin detalle" text="Agrega el detalle que sera ajustado por la nota de credito." /> : null}
          {lineas.map((linea, index) => {
            const base = Math.max(toNumber(linea.cantidad) * toNumber(linea.precio) - toNumber(linea.descuento), 0);
            const total = base + base * (toNumber(linea.tarifa) / 100);
            return (
              <View key={`linea-nota-credito-${index}`} style={styles.invoiceLineCard}>
                <View style={styles.clientCardHeader}>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName} numberOfLines={2}>{linea.producto.descripcion ?? linea.producto.codprincipal}</Text>
                    <Text style={styles.clientMeta} numberOfLines={1}>Codigo: {linea.producto.codprincipal ?? linea.producto.codproducto}</Text>
                  </View>
                  <Text style={styles.invoiceLineTotal}>{formatMoney(total)}</Text>
                </View>
                <Field label="Detalle de la línea (opcional)" value={linea.detalle ?? ''} onChangeText={(value) => onUpdateLinea(index, 'detalle', value)} />
                <View style={styles.invoiceLineFieldsGrid}>
                  <View style={styles.invoiceLineField}><Field label="Cantidad *" value={linea.cantidad} onChangeText={(value) => onUpdateLinea(index, 'cantidad', value)} keyboardType="number-pad" /></View>
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
          <Text style={styles.invoiceSectionHelp}>Totales del comprobante</Text>
          <InvoiceSummaryRow label="Subtotal" value={totals.subtotal} />
          <InvoiceSummaryRow label="Descuento" value={totals.descuento} danger />
          <InvoiceSummaryRow label="Subtotal + ICE" value={totals.subtotal} />
          <InvoiceSummaryRow label="ICE" value={0} />
          <InvoiceSummaryRow label="IVA" value={totals.iva} />
          <InvoiceSummaryRow label="IVA 0%" value={totals.ivaZero} />
          <View style={styles.invoiceTotalRow}>
            <Text style={styles.invoiceTotalLabel}>Total</Text>
            <Text style={styles.invoiceTotalValue}>{formatMoney(totals.total)}</Text>
          </View>
        </View>
        <View style={styles.formActions}>
          <SecondaryButton label="Volver al cliente" onPress={() => setStep(1)} />
          <SecondaryButton label="Cancelar / limpiar" onPress={handleClear} />
          <PrimaryButton label="Generar Nota de Credito" loading={saving || submitting} onPress={handleSave} />
        </View>
      </> : null}
    </>
  );
}
