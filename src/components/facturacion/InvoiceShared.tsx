import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function InvoiceSummaryRow({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, danger && styles.summaryDanger]}>{formatMoney(value)}</Text>
    </View>
  );
}

export function InvoiceProgressSteps({ labels, activeIndex }: { labels: string[]; activeIndex: number }) {
  return (
    <View style={styles.steps}>
      {labels.map((label, index) => (
        <View key={label} style={styles.stepItem}>
          <View style={[styles.stepNumber, index <= activeIndex && styles.stepNumberActive]}>
            <Text style={[styles.stepNumberText, index <= activeIndex && styles.stepNumberTextActive]}>{index + 1}</Text>
          </View>
          <Text style={[styles.stepLabel, index === activeIndex && styles.stepLabelActive]}>{label}</Text>
          {index < labels.length - 1 ? <MaterialCommunityIcons name="chevron-right" size={15} color={index < activeIndex ? '#21BF73' : '#AFC2CF'} /> : null}
        </View>
      ))}
    </View>
  );
}

function formatMoney(value: number) {
  return `$ ${Number(value || 0).toFixed(2)}`;
}

const styles = StyleSheet.create({
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { color: '#668198', flex: 1, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#294D69', fontSize: 12, fontWeight: '900' },
  summaryDanger: { color: '#B4232D' },
  steps: { alignItems: 'center', backgroundColor: '#F7FBFE', borderColor: '#D7EAF3', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 10, paddingVertical: 10 },
  stepItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 5, justifyContent: 'center' },
  stepNumber: { alignItems: 'center', backgroundColor: '#E6F0F5', borderRadius: 999, height: 27, justifyContent: 'center', width: 27 },
  stepNumberActive: { backgroundColor: '#0878C9' },
  stepNumberText: { color: '#7890A1', fontSize: 12, fontWeight: '900' },
  stepNumberTextActive: { color: '#FFFFFF' },
  stepLabel: { color: '#7890A1', fontSize: 10, fontWeight: '800' },
  stepLabelActive: { color: '#0878C9', fontWeight: '900' },
});
