import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { MessageState } from '../ui/FormControls';
import { EmptyState } from '../ui/FeedbackStates';
import { MessageBox, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { DropdownField } from '../ui/FormShared';
import { DocumentActionsMenu } from './DocumentActionsMenu';
import { ItemDetailModal } from '../data/ResultCollection';
import type { NotaDebitoListItem } from '../../services/notasDebitoMobileService';
import { styles } from '../../styles/appStyles';
import { formatDocumentDate, formatMoney, listItemKey } from '../../utils/documentFormatting';
import { DocumentHistoryHero, getInvoiceStatusStyle, getInvoiceStatusTextStyle, isNotaDebitoAuthorized } from './DocumentHistoryShared';

export function MisNotasDebitoMobileScreen({
  notas,
  loading,
  message,
  onRefresh,
  onPdf,
  onSharePdf,
  onXml,
  onEmail,
  onEmitir,
  onAnular,
  onExportCsv,
}: {
  notas: NotaDebitoListItem[];
  loading: boolean;
  message?: MessageState;
  onRefresh: () => void;
  onPdf: (nota: NotaDebitoListItem, descargar?: boolean) => void;
  onSharePdf: (nota: NotaDebitoListItem) => void;
  onXml: (nota: NotaDebitoListItem) => void;
  onEmail: (nota: NotaDebitoListItem) => void;
  onEmitir: (nota: NotaDebitoListItem) => void;
  onAnular: (nota: NotaDebitoListItem) => void;
  onExportCsv: (filename: string, rows: Record<string, unknown>[]) => void | Promise<void>;
}) {
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(1);
  const [selectedNota, setSelectedNota] = useState<NotaDebitoListItem | null>(null);
  const safeNotas = Array.isArray(notas) ? notas : [];
  const visibleNotas = safeNotas.filter((nota) => {
    const term = filter.trim().toLowerCase();
    const matchesText = !term || [nota.numeroNota, nota.facturaModificada, nota.motivo, nota.cliente, nota.identificacionCliente, nota.estadoSri].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    const isAuthorized = isNotaDebitoAuthorized(nota);
    const matchesStatus = statusFilter === 1 || (statusFilter === 2 && isAuthorized) || (statusFilter === 3 && !isAuthorized);
    return matchesText && matchesStatus;
  });
  const total = visibleNotas.reduce((sum, nota) => sum + Number(nota.total ?? 0), 0);
  const autorizadas = visibleNotas.filter(isNotaDebitoAuthorized).length;

  return (
    <>
      <DocumentHistoryHero eyebrow="Cargos emitidos" title="Mis notas de debito" text="Filtra por cliente, documento modificado o motivo, exporta tu consulta y abre cada comprobante." metrics={[{ value: visibleNotas.length, label: 'Notas filtradas' }, { value: formatMoney(total), label: 'Total filtrado' }, { value: autorizadas, label: 'Autorizadas' }]} />
      <View style={styles.invoiceHistoryFilterPanel}>
        <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
        <Text style={styles.clientName}>Notas de debito generadas</Text>
        <SearchField label="Buscar notas de debito" placeholder="Numero, factura, cliente o identificacion" value={filter} onChangeText={setFilter} resultCount={visibleNotas.length} totalCount={safeNotas.length} />
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
          <SecondaryButton
            label="Descargar Excel"
            accentColor="#18B889"
            onPress={() => {
              void onExportCsv('notas-debito.csv', visibleNotas.map((nota) => ({
                Nota: nota.numeroNota ?? '',
                FacturaModificada: nota.facturaModificada ?? '',
                Motivo: nota.motivo ?? '',
                Cliente: nota.cliente ?? '',
                Identificacion: nota.identificacionCliente ?? '',
                FechaSustento: formatDocumentDate(nota.fechaSustento),
                Estado: nota.estadoSri ?? (nota.autorizado ? 'AUTORIZADO' : 'PENDIENTE'),
                Total: formatMoney(nota.total),
              })));
            }}
          />
          <PrimaryButton label="Refrescar" loading={loading} onPress={onRefresh} />
        </View>
      </View>
      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando notas de debito...</Text>
        </View>
      ) : null}
      {!loading && visibleNotas.length === 0 ? <EmptyState title="Sin notas de debito" text="Cuando generes notas de debito, apareceran aqui." /> : null}
      <View style={styles.listStack}>
        {visibleNotas.map((nota, index) => {
          const notaKey = listItemKey('mis-notas-debito', [nota.codNotaDebito, nota.numeroNota, nota.facturaModificada], index);
          const statusLabel = nota.estadoSri ?? (nota.autorizado ? 'AUTORIZADO' : 'PENDIENTE');
          const isAuthorized = isNotaDebitoAuthorized(nota);
          return (
            <View key={notaKey} style={styles.invoiceHistoryCard}>
              <View style={styles.invoiceHistoryCardHeader}>
                <View style={styles.invoiceHistoryIdentityRow}>
                  <View style={styles.invoiceHistoryDocIcon}>
                    <MaterialCommunityIcons name="file-plus-outline" size={21} color="#0072BD" />
                  </View>
                  <View style={styles.invoiceHistoryCardInfo}>
                    <Text style={styles.invoiceHistoryNumber} numberOfLines={1} adjustsFontSizeToFit>{nota.numeroNota ?? `Nota ${nota.codNotaDebito}`}</Text>
                    <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(statusLabel)]}>
                      <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(statusLabel)]}>{statusLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.invoiceHistoryClientBlock}>
                  <Text style={styles.invoiceHistoryClient} numberOfLines={1}>{nota.cliente ?? 'Consumidor final'}</Text>
                  <Text style={styles.invoiceHistoryId}>Factura modificada: {nota.facturaModificada ?? '-'}</Text>
                </View>
              </View>
              <View style={styles.invoiceHistoryDetailGrid}>
                <View style={styles.invoiceHistoryDetailItem}><Text style={styles.invoiceHistoryDetailLabel}>Fecha sustento</Text><Text style={styles.invoiceHistoryDetailValue}>{formatDocumentDate(nota.fechaSustento)}</Text></View>
                <View style={styles.invoiceHistoryDetailItem}><Text style={styles.invoiceHistoryDetailLabel}>Total</Text><Text style={styles.invoiceHistoryAmount}>{formatMoney(nota.total)}</Text></View>
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
                  { label: 'Ver PDF A4', icon: 'eye-outline', tone: 'primary', onPress: () => onPdf(nota) },
                  { label: 'Descargar PDF A4', icon: 'file-pdf-box', tone: 'danger', onPress: () => onPdf(nota, true) },
                  { label: 'Reenviar correo', icon: 'email-outline', tone: 'warning', onPress: () => onEmail(nota) },
                  ...(!isAuthorized ? [{ label: 'Emitir SRI', icon: 'send-check-outline', tone: 'primary' as const, onPress: () => onEmitir(nota) }] : []),
                  { label: 'Anular', icon: 'trash-can-outline', tone: 'danger', onPress: () => onAnular(nota) },
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <ItemDetailModal
        visible={Boolean(selectedNota)}
        title={selectedNota?.numeroNota ?? 'Detalle de nota de debito'}
        values={selectedNota ? [
          `Factura modificada: ${selectedNota.facturaModificada ?? '-'}`,
          `Cliente: ${selectedNota.cliente ?? 'Consumidor final'}`,
          `Identificacion: ${selectedNota.identificacionCliente ?? 'Sin identificacion'}`,
          `Fecha sustento: ${formatDocumentDate(selectedNota.fechaSustento)}`,
          `Estado SRI: ${selectedNota.estadoSri ?? (selectedNota.autorizado ? 'AUTORIZADO' : 'PENDIENTE')}`,
          `Motivo: ${selectedNota.motivo ?? 'No disponible'}`,
          selectedNota.numeroAutorizacion ? `Autorización: ${selectedNota.numeroAutorizacion}` : '',
          selectedNota.mensajeSri ? `Mensaje SRI: ${selectedNota.mensajeSri}` : '',
          `Total: ${formatMoney(selectedNota.total)}`,
        ] : []}
        onClose={() => setSelectedNota(null)}
      />
    </>
  );
}
