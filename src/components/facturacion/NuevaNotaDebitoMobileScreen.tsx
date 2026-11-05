import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import type { FacturaListItem, FacturaPreparacion } from '../../services/facturasMobileService';
import type { Cliente, PuntosEmisionData } from '../../types/business';
import type { NotaDebitoFormState, NotaDebitoLinea } from '../../types/invoices';
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

export function NuevaNotaDebitoMobileScreen({
  form,
  preparacion,
  puntosData,
  factura,
  facturas,
  cliente,
  lineas,
  loading,
  saving,
  message,
  onChange,
  onSearchFacturas,
  onSelectFactura,
  onImportXml,
  onUpdateLinea,
  onClear,
  onHistory,
  onSave,
}: {
  form: NotaDebitoFormState;
  preparacion: FacturaPreparacion | null;
  puntosData: PuntosEmisionData | null;
  factura: FacturaListItem | null;
  facturas: FacturaListItem[];
  cliente: Cliente | null;
  lineas: NotaDebitoLinea[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  onChange: (field: keyof NotaDebitoFormState, value: string) => void;
  onSearchFacturas: () => void;
  onSelectFactura: (factura: FacturaListItem) => void | Promise<void>;
  onImportXml: (uri: string) => Promise<void>;
  onUpdateLinea: (index: number, field: keyof NotaDebitoLinea, value: string) => void;
  onClear: () => void;
  onHistory: () => void;
  onSave: () => void | Promise<void>;
}) {
  const toNumber = (value: string) => Number(value.replace(',', '.')) || 0;
  const totals = lineas.reduce(
    (acc, item) => {
      const base = toNumber(item.precio);
      const ice = toNumber(item.valorIce);
      const iva = (base + ice) * (toNumber(item.tarifa) / 100);
      return {
        subtotal: acc.subtotal + base,
        ice: acc.ice + ice,
        iva: acc.iva + iva,
        ivaZero: toNumber(item.tarifa) <= 0 ? acc.ivaZero + base + ice : acc.ivaZero,
        total: acc.total + base + ice + iva,
      };
    },
    { subtotal: 0, ice: 0, iva: 0, ivaZero: 0, total: 0 },
  );
  const serieOptions = getDocumentSerieOptions(preparacion, puntosData, 'notaDebito');
  usePreferredDocumentSerie(serieOptions, form.serie, (serie) => onChange('serie', serie));
  const effectiveSerie = getEffectiveDocumentSerie(serieOptions, form.serie) || form.serie;
  const serieLabel = getSerieLabelFromOptions(serieOptions, effectiveSerie, getSerieLabel(preparacion, effectiveSerie, '001-002'));
  const optionNotaNumber = getNextSequenceFromOptions(serieOptions, effectiveSerie, '');
  const notaNumber = effectiveSerie ? form.numeroFactura || optionNotaNumber || (puntosData?.cajas?.length ? '' : getNextSequence(preparacion, effectiveSerie, 1158)) : '';
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
        Alert.alert('No se pudo generar la nota de debito', error instanceof Error && error.message ? error.message : 'Ocurrio un error inesperado. Intenta nuevamente.');
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
          <Text style={styles.heroTitle}>Nueva nota de debito</Text>
          <Text style={styles.heroText}>Emite cargos por intereses, costos o gastos posteriores a la factura.</Text>
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
            <Text style={styles.invoiceMiniLabel}>Nota de debito</Text>
            <Text style={styles.invoiceHeaderValue}>{notaNumber}</Text>
          </View>
          <SecondaryButton label="Historial" onPress={onHistory} />
          <SecondaryButton label="Limpiar pantalla" onPress={handleClear} />
        </View>
      </View>
      <SharedInvoiceProgressSteps labels={['Factura', 'Motivo y valor']} activeIndex={Math.max(step - 1, 0)} />
      {message ? <MessageBox message={message} /> : null}
      {submitting ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>{saving ? 'Generando nota de debito y enviandola al SRI...' : 'Validando datos de la nota de debito...'}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando notas de debito...</Text>
        </View>
      ) : null}
      {step === 1 ? <>
        <View style={styles.formSectionBox}>
          <Text style={styles.clientFormSubtitle}>Factura base</Text>
          <Text style={styles.invoiceSectionHelp}>Busca y selecciona la factura modificada que origina este cargo adicional.</Text>
          <SearchField label="Encontrar factura *" placeholder="Número completo o secuencial" value={form.facturaBusqueda} onChangeText={(value) => onChange('facturaBusqueda', value)} resultCount={facturas.length} onSubmit={onSearchFacturas} predictive suggestions={facturas.slice(0, 5).map((item, index) => ({ id: `nota-debito-factura-${item.codfactura}-${index}`, title: item.numeroCompleto ?? item.numfactura ?? `Factura ${item.codfactura}`, subtitle: `${item.cliente ?? 'Consumidor final'} · ${formatMoney(item.total)}` }))} onSelectSuggestion={(suggestion) => { const item = facturas.find((candidate, index) => `nota-debito-factura-${candidate.codfactura}-${index}` === suggestion.id); if (item) onSelectFactura(item); }} />
          {factura ? <View style={[styles.formSectionBox, styles.invoicePanel]}>
            <Text style={styles.invoicePanelTitle}>Factura seleccionada</Text>
            <Text style={styles.profileValue}>{factura.numeroCompleto ?? factura.numfactura ?? `Factura ${factura.codfactura}`}</Text>
            <Text style={styles.clientMeta}>Cliente: {cliente ? getClienteDisplayName(cliente) : factura.cliente ?? 'Consumidor final'}</Text>
            <Text style={styles.clientMeta}>Total de la factura: {formatMoney(factura.total)}</Text>
          </View> : <Text style={styles.clientMeta}>Selecciona una factura para continuar.</Text>}
        </View>
        <View style={styles.formActions}>
          {factura ? <SecondaryButton label="Limpiar pantalla" onPress={handleClear} /> : null}
          {factura ? <PrimaryButton label="Continuar con detalle" loading={false} onPress={() => setStep(2)} /> : null}
        </View>
      </> : null}
      {step === 2 ? <>
        <View style={[styles.formSectionBox, styles.invoicePanel]}>
          <View style={styles.invoicePanelHeader}>
            <Text style={styles.invoicePanelTitle}>Motivo de la Nota de Debito</Text>
          </View>
          {lineas.slice(0, 1).map((linea, index) => {
            const base = toNumber(linea.precio);
            const ice = toNumber(linea.valorIce);
            const iva = (base + ice) * (toNumber(linea.tarifa) / 100);
            const total = base + ice + iva;
            return (
              <View key={`linea-nota-debito-${index}`} style={styles.invoiceLineCard}>
                <View style={styles.clientCardHeader}>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName} numberOfLines={2}>{linea.descripcion || 'Ingresa el motivo'}</Text>
                    <Text style={styles.clientMeta} numberOfLines={1}>Tarifa IVA {linea.tarifa || '0'}% - ICE {formatMoney(ice)}</Text>
                  </View>
                  <Text style={styles.invoiceLineTotal}>{formatMoney(total)}</Text>
                </View>
                <Field label="Motivo *" value={linea.descripcion} onChangeText={(value) => onUpdateLinea(index, 'descripcion', value.slice(0, 300))} />
                <View style={styles.invoiceLineFieldsGrid}>
                  <View style={styles.invoiceLineField}><Field label="Precio *" value={linea.precio} onChangeText={(value) => onUpdateLinea(index, 'precio', value)} keyboardType="decimal-pad" /></View>
                  <View style={styles.invoiceLineField}>
                    {ivaOptions.length > 0 ? (
                      <DropdownField label="IVA *" options={ivaOptions} value={getIvaOptionValue(ivaOptions, toNumber(linea.tarifa))} onChange={(value) => onUpdateLinea(index, 'tarifa', value === null ? '0' : String(value))} allowClear />
                    ) : (
                      <Field label="Tarifa IVA *" value={linea.tarifa} onChangeText={(value) => onUpdateLinea(index, 'tarifa', value)} keyboardType="decimal-pad" />
                    )}
                  </View>
                </View>
                <View style={styles.invoiceLineFieldsGrid}>
                  <View style={styles.invoiceLineField}><Field label="Valor ICE (opcional)" value={linea.valorIce} onChangeText={(value) => onUpdateLinea(index, 'valorIce', value)} keyboardType="decimal-pad" /></View>
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.formSectionBox, styles.invoiceSummaryBox]}>
          <Text style={styles.clientFormSubtitle}>Resumen</Text>
          <Text style={styles.invoiceSectionHelp}>Totales del comprobante</Text>
          <InvoiceSummaryRow label="Subtotal" value={totals.subtotal} />
          <InvoiceSummaryRow label="Descuento" value={0} danger />
          <InvoiceSummaryRow label="Subtotal + ICE" value={totals.subtotal + totals.ice} />
          <InvoiceSummaryRow label="ICE" value={totals.ice} />
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
          <PrimaryButton label="Generar Nota de Debito" loading={saving || submitting} onPress={handleSave} />
        </View>
      </> : null}
    </>
  );
}
