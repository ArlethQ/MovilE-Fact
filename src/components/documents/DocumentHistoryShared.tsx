import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { NotaDebitoListItem } from '../../services/notasDebitoMobileService';
import { styles } from '../../styles/appStyles';

export function InvoiceHistoryMetric({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.invoiceHistoryMetric}>
      <Text style={styles.invoiceHistoryMetricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.invoiceHistoryMetricLabel}>{label}</Text>
    </View>
  );
}

export function DocumentHistoryHero({
  title,
  text: description,
  metrics,
}: {
  eyebrow: string;
  title: string;
  text: string;
  metrics: Array<{ value: string | number; label: string }>;
}) {
  const primaryMetric = metrics[0];
  return (
    <View style={styles.invoiceHistoryHeader}>
      <View style={styles.invoiceHistoryHeaderTop}>
        <View style={styles.invoiceHistoryHeaderIcon}>
          <MaterialCommunityIcons name="file-document-multiple-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.invoiceHistoryHeaderCopy}>
          <Text style={styles.invoiceHistoryEyebrow}>LISTADO</Text>
          <Text style={styles.invoiceHistoryTitle}>{title}</Text>
          <Text style={styles.invoiceHistoryText}>{description}</Text>
        </View>
        {primaryMetric ? (
          <View style={styles.invoiceHistoryRecordsControl}>
            <Text style={styles.invoiceHistoryRecordsLabel}>Ver</Text>
            <Text style={styles.invoiceHistoryRecordsValue}>{primaryMetric.value}</Text>
            <Text style={styles.invoiceHistoryRecordsLabel}>registros</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.invoiceHistoryStats}>
        {metrics.map((metric) => <InvoiceHistoryMetric key={metric.label} value={metric.value} label={metric.label} />)}
      </View>
    </View>
  );
}

export function getInvoiceStatusStyle(status: string) {
  const normalized = status.toLowerCase();
  if (isInvoiceStatusRejected(normalized)) return styles.invoiceHistoryStatusDanger;
  if (normalized.includes('autoriz') && !normalized.includes('no autoriz')) return styles.invoiceHistoryStatusOk;
  return styles.invoiceHistoryStatusPending;
}

export function getInvoiceStatusTextStyle(status: string) {
  const normalized = status.toLowerCase();
  if (isInvoiceStatusRejected(normalized)) return styles.invoiceHistoryStatusTextDanger;
  if (normalized.includes('autoriz') && !normalized.includes('no autoriz')) return styles.invoiceHistoryStatusTextOk;
  return styles.invoiceHistoryStatusTextPending;
}

function isInvoiceStatusRejected(normalizedStatus: string) {
  return normalizedStatus.includes('no autoriz')
    || normalizedStatus.includes('sin autoriz')
    || normalizedStatus.includes('anul')
    || normalizedStatus.includes('rech')
    || normalizedStatus.includes('error');
}

export function isNotaDebitoAuthorized(nota: NotaDebitoListItem) {
  const status = String(nota.estadoSri ?? '').toUpperCase();
  return nota.autorizado === true || (status.includes('AUTORIZ') && !status.includes('NO AUTORIZ'));
}
