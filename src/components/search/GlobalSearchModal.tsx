import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { GlobalSearchResult } from '../../types/globalSearch';

export function GlobalSearchModal({ visible, query, results, onChangeQuery, onClose, onOpenResult }: {
  visible: boolean;
  query: string;
  results: GlobalSearchResult[];
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onOpenResult: (result: GlobalSearchResult) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 120);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.titleBlock}><Text style={styles.eyebrow}>BUSCADOR INTELIGENTE</Text><Text style={styles.title}>¿Qué necesitas encontrar?</Text></View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Cerrar búsqueda"><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <View style={styles.inputShell}>
            <MaterialCommunityIcons name="magnify" size={22} color="#0878C9" />
            <TextInput ref={inputRef} value={query} onChangeText={onChangeQuery} placeholder="Cliente, producto, factura o RUC..." placeholderTextColor="#8DA1B4" style={styles.input} returnKeyType="search" />
            {query ? <Pressable onPress={() => onChangeQuery('')} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={19} color="#9AB0C1" /></Pressable> : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.results}>
            {!query.trim() ? <View style={styles.empty}><MaterialCommunityIcons name="text-search" size={38} color="#9DDCF3" /><Text style={styles.emptyTitle}>Busca en toda tu operación</Text><Text style={styles.emptyText}>Clientes, productos y comprobantes desde un solo lugar.</Text></View> : results.length ? results.map((result) => (
              <Pressable key={result.id} style={({ pressed }) => [styles.result, pressed && styles.resultPressed]} onPress={() => onOpenResult(result)}>
                <View style={styles.resultIcon}><MaterialCommunityIcons name={result.icon} size={21} color="#0878C9" /></View>
                <View style={styles.resultCopy}><Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text><Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#9AB0C1" />
              </Pressable>
            )) : <View style={styles.empty}><MaterialCommunityIcons name="magnify-close" size={38} color="#9AB0C1" /><Text style={styles.emptyTitle}>Sin resultados</Text><Text style={styles.emptyText}>Prueba con otro nombre, número o identificación.</Text></View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', flex: 1, justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 56 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 24, 44, 0.62)' },
  panel: { backgroundColor: '#F7FBFE', borderColor: '#9BDFF5', borderRadius: 24, borderWidth: 1, maxHeight: '78%', maxWidth: 500, padding: 18, shadowColor: '#001F38', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 18, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 14 },
  titleBlock: { flex: 1 },
  eyebrow: { color: '#0878C9', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#173E61', fontSize: 20, fontWeight: '900', marginTop: 3 },
  closeButton: { alignItems: 'center', backgroundColor: '#E7F5FC', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: '#0878C9', fontSize: 25, lineHeight: 28 },
  inputShell: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#B9DFF2', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 50, paddingHorizontal: 13 },
  input: { color: '#263A4F', flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 10 },
  results: { gap: 8, paddingBottom: 4, paddingTop: 14 },
  result: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E0EDF4', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 10 },
  resultPressed: { backgroundColor: '#EAF7FD', borderColor: '#8DDCF6' },
  resultIcon: { alignItems: 'center', backgroundColor: '#E7F5FC', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { color: '#173E61', fontSize: 13, fontWeight: '900' },
  resultSubtitle: { color: '#71869A', fontSize: 11, fontWeight: '600', marginTop: 2 },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 35 },
  emptyTitle: { color: '#173E61', fontSize: 15, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  emptyText: { color: '#71869A', fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 4, textAlign: 'center' },
});
