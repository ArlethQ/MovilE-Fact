import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BotCatalogList } from '../../types/bot';
import { operationalLabels } from '../../services/botOperationalService';

const ROWS_PER_BATCH = 30;

export function NumiCatalogList({ kind, rows, inicio = 0, onSelect, onMore }: {
  kind: BotCatalogList['kind'] | 'facturas';
  rows: BotCatalogList['rows'];
  inicio?: number;
  onSelect?: (index: number) => void;
  onMore?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_BATCH);
  const Row = onSelect ? Pressable : View;

  const visibleRows = rows.slice(0, visibleCount).map((row, index) => (
    <Row key={index} style={[styles.row, index > 0 && styles.rowDivider]} {...(onSelect ? {
      accessibilityRole: 'button' as const,
      accessibilityLabel: `Ver PDF de la factura ${row.name}${row.detail ? `, ${row.detail}` : ''}`,
      onPress: () => onSelect(index),
    } : {})}>
      <Text style={styles.index}>{inicio + index + 1}.</Text>
      <View style={styles.details}>
        <Text style={styles.name}>{row.name}</Text>
        {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
        {onSelect ? <Text style={styles.action}>Ver PDF</Text> : null}
      </View>
    </Row>
  ));

  return (
    <ScrollView
      accessibilityLabel={`Lista de ${kind === 'facturas' ? kind : operationalLabels[kind] ?? kind}`}
      style={styles.viewport}
      nestedScrollEnabled
      persistentScrollbar={rows.length > 4}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={64}
      onScroll={visibleCount < rows.length ? ({ nativeEvent }) => {
        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
        if (contentOffset.y + layoutMeasurement.height < contentSize.height - 120) return;
        setVisibleCount((count) => count === visibleCount ? count + ROWS_PER_BATCH : count);
      } : undefined}
    >
      {onMore ? [...visibleRows,
        <Pressable key="next" style={[styles.row, styles.rowDivider]} accessibilityRole="button" onPress={onMore}>
          <Text style={styles.action}>Ver siguientes</Text>
        </Pressable>,
      ] : visibleRows}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  viewport: { alignSelf: 'stretch', maxHeight: 230, marginTop: 8, borderWidth: 1, borderColor: '#D8E7F0', borderRadius: 10 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 9, paddingHorizontal: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C9DCE9' },
  index: { minWidth: 27, textAlign: 'right', color: '#356482', fontSize: 13, fontWeight: '700' },
  details: { flex: 1, gap: 2 },
  name: { color: '#15344F', fontSize: 14, fontWeight: '600' },
  detail: { color: '#435E73', fontSize: 12 },
  action: { color: '#0878C9', fontSize: 12, fontWeight: '700' },
});
