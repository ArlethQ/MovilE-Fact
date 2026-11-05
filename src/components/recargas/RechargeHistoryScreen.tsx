import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { OperationalMobileItem } from '../../services/operationalMobileService';
import { EmptyState } from '../ui/FeedbackStates';
import { MessageBox, MessageState, SearchField } from '../ui/FormControls';
import { ResultCollection } from '../data/ResultCollection';
import { styles } from '../../styles/appStyles';
import { formatDocumentDate, formatMoney } from '../../utils/documentFormatting';

export function RechargeHistoryScreen({
  search,
  items,
  loading,
  message,
  placeholder,
  onRefresh,
  onSearch,
  onView,
}: {
  search: string;
  items: OperationalMobileItem[];
  loading: boolean;
  message?: MessageState;
  placeholder: string;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onView: (item: OperationalMobileItem) => void;
}) {
  return (
    <>
      <View style={styles.rechargeHistoryHeader}>
        <View style={styles.rechargeHistoryHeaderIcon}>
          <MaterialCommunityIcons name="history" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.rechargeHistoryHeaderCopy}>
          <Text style={styles.rechargeHistoryHeaderEyebrow}>Mi historial de compras</Text>
          <Text style={styles.rechargeHistoryHeaderTitle}>Ultimos movimientos</Text>
          <Text style={styles.rechargeHistoryHeaderText}>Consulta tus recargas realizadas y el saldo aplicado.</Text>
        </View>
        <View style={styles.rechargeHistoryCountPill}>
          <Text style={styles.rechargeHistoryCountValue}>{items.length}</Text>
          <Text style={styles.rechargeHistoryCountLabel}>compras</Text>
        </View>
      </View>
      <View style={styles.rechargeHistoryToolbar}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
            <Text style={styles.clientFormTitle}>Historial</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label="Buscar en Historial" placeholder={placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        {message ? <MessageBox message={message} /> : null}
      </View>
      {loading ? <EmptyState title="Cargando recargas" text="Consultando tu historial de compras..." /> : null}
      {!loading && !message && items.length === 0 ? <EmptyState title="Sin recargas para mostrar" text="Cuando compres documentos, apareceran aqui." /> : null}
      {!loading && items.length > 0 ? (
        <ResultCollection
          items={items}
          resetKey={`recargas-historial-${search}`}
          keyExtractor={(item, index) => `recarga-${item.id || 'item'}-${index}`}
          renderItem={(item) => <RechargeHistoryItemCard item={item} onPress={() => onView(item)} />}
        />
      ) : null}
    </>
  );
}

function RechargeHistoryItemCard({ item, onPress }: { item: OperationalMobileItem; onPress: () => void }) {
  const dateSource = getRechargeValue(item, ['fecha', 'Fecha', 'fechaCompra', 'FechaCompra', 'fechaRegistro', 'FechaRegistro', 'createdAt', 'CreatedAt']) || item.subtitle;
  const status = getRechargeStatus(item);

  return (
    <Pressable style={styles.rechargeHistoryCard} onPress={onPress}>
      <View style={styles.rechargeHistoryCardTop}>
        <View>
          <Text style={styles.rechargeHistoryDate}>{formatRechargeDate(dateSource)}</Text>
          <Text style={styles.rechargeHistoryTime}>{formatRechargeTime(dateSource)}</Text>
        </View>
        <View style={[styles.rechargeHistoryStatusPill, getRechargeStatusStyle(status)]}>
          <Text style={getRechargeStatusTextStyle(status)}>{status}</Text>
        </View>
      </View>
      <Text style={styles.rechargeHistoryTitle}>{item.title || 'Recarga documental'}</Text>
      <Text style={styles.rechargeHistorySubtitle}>Recarga documental</Text>
      <View style={styles.rechargeHistoryMetrics}>
        <View style={styles.rechargeHistoryMetric}>
          <Text style={styles.rechargeHistoryMetricLabel}>Documentos</Text>
          <Text style={styles.rechargeHistoryMetricValue}>{getRechargeDocuments(item)}</Text>
        </View>
        <View style={styles.rechargeHistoryMetric}>
          <Text style={styles.rechargeHistoryMetricLabel}>Total</Text>
          <Text style={styles.rechargeHistoryMetricValue}>{getRechargeTotal(item)}</Text>
        </View>
      </View>
      <View style={styles.rechargeHistoryFoot}>
        <RechargeHistoryDetail label="Saldo aplicado" value={getRechargeValue(item, ['saldoAplicado', 'SaldoAplicado', 'aplicado', 'Aplicado']) || 'No'} />
        <RechargeHistoryDetail label="Referencia" value={getRechargeValue(item, ['referencia', 'Referencia', 'comprobante', 'Comprobante']) || 'Sin referencia'} />
        <RechargeHistoryDetail label="Autorizacion" value={getRechargeValue(item, ['autorizacion', 'Autorizacion', 'numeroAutorizacion', 'NumeroAutorizacion']) || item.detail || 'Sin autorizacion'} />
      </View>
    </Pressable>
  );
}

function RechargeHistoryDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rechargeHistoryFootRow}>
      <Text style={styles.rechargeHistoryFootLabel}>{label}</Text>
      <Text style={styles.rechargeHistoryFootValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function getRechargeValue(item: OperationalMobileItem, keys: string[]) {
  const row = item.raw ?? {};
  const normalizedKeys = keys.map(normalizeRechargeKey);
  const entry = Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalizedKeys.includes(normalizeRechargeKey(key)));
  if (entry?.[1] !== null && entry?.[1] !== undefined) return String(entry[1]);
  return '';
}

function normalizeRechargeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getRechargeDocuments(item: OperationalMobileItem) {
  return getRechargeValue(item, ['documentos', 'Documentos', 'cantidadDocumentos', 'CantidadDocumentos', 'cantidad', 'Cantidad']) || item.meta || '-';
}

function getRechargeTotal(item: OperationalMobileItem) {
  const total = getRechargeValue(item, ['total', 'Total', 'monto', 'Monto', 'valor', 'Valor', 'valorRecarga', 'ValorRecarga', 'montoTotal', 'MontoTotal']);
  const parsed = Number(String(total || item.meta || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? formatMoney(parsed) : total || item.meta || '-';
}

function getRechargeStatus(item: OperationalMobileItem) {
  return getRechargeValue(item, ['estado', 'Estado', 'status', 'Status']) || item.status || 'Pendiente';
}

function getRechargeStatusStyle(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('apro') || normalized.includes('pag') || normalized.includes('aplic')) return styles.rechargeHistoryStatusOk;
  if (normalized.includes('rech') || normalized.includes('anul') || normalized.includes('error')) return styles.rechargeHistoryStatusDanger;
  return styles.rechargeHistoryStatusPending;
}

function getRechargeStatusTextStyle(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('apro') || normalized.includes('pag') || normalized.includes('aplic')) return styles.rechargeHistoryStatusTextOk;
  if (normalized.includes('rech') || normalized.includes('anul') || normalized.includes('error')) return styles.rechargeHistoryStatusTextDanger;
  return styles.rechargeHistoryStatusTextPending;
}

function formatRechargeDate(value?: string | null) {
  if (!value) return '-';
  return formatDocumentDate(value);
}

function formatRechargeTime(value?: string | null) {
  if (!value) return '--:--';
  const source = String(value);
  const dotNetMatch = /\/Date\((\d+)\)\//.exec(source);
  const date = dotNetMatch ? new Date(Number(dotNetMatch[1])) : new Date(source);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
  }
  const timeMatch = /(\d{1,2}:\d{2})/.exec(source);
  return timeMatch?.[1] ?? '--:--';
}
