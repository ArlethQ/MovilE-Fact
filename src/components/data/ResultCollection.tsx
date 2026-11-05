import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type ResultCollectionProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  resetKey?: string;
  pageSize?: number;
  variant?: 'default' | 'plain';
  tone?: 'blue' | 'green';
};

export function ResultCollection<T>({
  items,
  renderItem,
  keyExtractor,
  resetKey,
  pageSize = 6,
  variant = 'default',
  tone = 'blue',
}: ResultCollectionProps<T>) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  if (items.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleItems = items.slice(start, start + pageSize);
  const firstPage = Math.max(0, Math.min(safePage - 2, totalPages - 3));
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).slice(firstPage, firstPage + 3);

  return (
    <View style={[styles.collection, variant === 'plain' && styles.collectionPlain]}>
      <View style={styles.header}>
        <Text style={styles.title}>Resultados</Text>
        <Text style={styles.meta}>Página {safePage} de {totalPages} · {items.length} registros</Text>
      </View>
      <View style={styles.items}>
        {visibleItems.map((item, index) => (
          <View key={keyExtractor(item, start + index)}>{renderItem(item, start + index)}</View>
        ))}
      </View>
      <View style={[styles.pagination, tone === 'green' && styles.paginationGreen]}>
        <Pressable
          accessibilityLabel="Página anterior"
          style={[styles.pageButton, tone === 'green' && styles.pageButtonGreen, safePage === 1 && styles.disabled]}
          disabled={safePage === 1}
          onPress={() => setPage((current) => Math.max(1, current - 1))}
        >
          <Text style={[styles.arrow, tone === 'green' && styles.arrowGreen]}>‹</Text>
        </Pressable>
        <View style={styles.pages}>
          {pages.map((pageNumber) => (
            <Pressable key={pageNumber} style={[styles.page, pageNumber === safePage && styles.activePage, pageNumber === safePage && tone === 'green' && styles.activePageGreen]} onPress={() => setPage(pageNumber)}>
              <Text style={[styles.pageText, pageNumber === safePage && styles.activePageText]}>{pageNumber}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityLabel="Página siguiente"
          style={[styles.pageButton, tone === 'green' && styles.pageButtonGreen, safePage === totalPages && styles.disabled]}
          disabled={safePage === totalPages}
          onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          <Text style={[styles.arrow, tone === 'green' && styles.arrowGreen]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ItemDetailModal({
  visible,
  title,
  values,
  onClose,
}: {
  visible: boolean;
  title: string;
  values: string[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.titleWrap}>
              <Text style={styles.eyebrow}>DETALLE DEL REGISTRO</Text>
              <Text style={styles.modalTitle} numberOfLines={2}>{title}</Text>
            </View>
            <Pressable accessibilityLabel="Cerrar detalle" style={styles.close} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            {values.length ? values.map((value, index) => (
              <View key={`${value}-${index}`} style={styles.row}>
                <View style={styles.marker} />
                <Text style={styles.value}>{value}</Text>
              </View>
            )) : <Text style={styles.empty}>Sin información adicional.</Text>}
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  collection: { backgroundColor: '#EFF6FB', borderColor: '#D5E5F0', borderRadius: 20, borderWidth: 1, gap: 12, padding: 9 },
  collectionPlain: { backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, paddingTop: 3 },
  title: { color: '#263A4F', fontSize: 15, fontWeight: '900' },
  meta: { color: '#617A90', fontSize: 11, fontWeight: '800' },
  items: { gap: 12 },
  pagination: { alignItems: 'center', borderTopColor: '#DCE8F1', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  paginationGreen: { borderTopColor: '#CBE9D7' },
  pages: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  pageButton: { alignItems: 'center', backgroundColor: '#EAF5FC', borderColor: '#B9D8EE', borderRadius: 9, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  pageButtonGreen: { backgroundColor: '#EFFAF2', borderColor: '#B9E3C9' },
  disabled: { opacity: 0.4 },
  arrow: { color: '#00649D', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  arrowGreen: { color: '#087C3A' },
  page: { alignItems: 'center', borderRadius: 9, height: 32, justifyContent: 'center', width: 32 },
  activePage: { backgroundColor: '#0072BD' },
  activePageGreen: { backgroundColor: '#087C3A' },
  pageText: { color: '#617A90', fontSize: 12, fontWeight: '900' },
  activePageText: { color: '#FFFFFF' },
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 35, 60, 0.48)' },
  modalCard: { backgroundColor: '#FFFFFF', borderColor: '#B9D8EE', borderRadius: 22, borderWidth: 1, gap: 18, maxHeight: '80%', padding: 20, shadowColor: '#002C50', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 8 },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  titleWrap: { flex: 1, gap: 4 },
  eyebrow: { color: '#0072BD', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  modalTitle: { color: '#263A4F', fontSize: 19, fontWeight: '900' },
  close: { alignItems: 'center', backgroundColor: '#EEF5F9', borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  closeText: { color: '#38566D', fontSize: 23, lineHeight: 25 },
  body: { backgroundColor: '#F5F9FC', borderColor: '#E0EAF2', borderRadius: 14, borderWidth: 1, gap: 12, padding: 14 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  marker: { backgroundColor: '#00A8D6', borderRadius: 4, height: 8, marginTop: 5, width: 8 },
  value: { color: '#405C72', flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  empty: { color: '#72879A', fontSize: 13, fontWeight: '700' },
  closeButton: { alignItems: 'center', backgroundColor: '#0072BD', borderRadius: 12, justifyContent: 'center', minHeight: 44 },
  closeButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
