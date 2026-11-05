import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function InitialSequenceModal({
  visible,
  documentLabel,
  serie,
  saving,
  message,
  onClose,
  onSave,
}: {
  visible: boolean;
  documentLabel: string;
  serie: string;
  saving?: boolean;
  message?: string | null;
  onClose: () => void;
  onSave: (input: { habiaGenerado: boolean; secuenciaAnterior: string }) => void;
}) {
  const [habiaGenerado, setHabiaGenerado] = useState<boolean | null>(null);
  const [secuenciaAnterior, setSecuenciaAnterior] = useState('');
  useEffect(() => {
    if (visible) {
      setHabiaGenerado(null);
      setSecuenciaAnterior('');
    }
  }, [documentLabel, serie, visible]);

  const cleanedSequence = secuenciaAnterior.replace(/\D/g, '').slice(0, 9);
  const nextHint = useMemo(() => {
    const current = Number(cleanedSequence);
    if (!current) return '';
    return String(current + 1).padStart(9, '0');
  }, [cleanedSequence]);
  const canSave = habiaGenerado !== null && (!habiaGenerado || cleanedSequence.length > 0);

  const handleSave = () => {
    if (!canSave || saving) return;
    onSave({ habiaGenerado: Boolean(habiaGenerado), secuenciaAnterior: cleanedSequence });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CONFIGURACIÓN DEL DOCUMENTO</Text>
              <Text style={styles.title}>Configurar secuencia</Text>
              <Text style={styles.help}>Esta serie no tiene secuencia. Indica si ya emitiste {documentLabel} antes.</Text>
            </View>
            <View style={styles.serieBox}>
              <Text style={styles.serieValue}>{serie || '---'}</Text>
              <Text style={styles.serieLabel}>SERIE</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#31516E" />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.step}>PASO 1</Text>
                <Text style={styles.badge}>{habiaGenerado ? 'Continuar secuencia' : habiaGenerado === false ? 'Empezar desde cero' : 'Selecciona'}</Text>
              </View>
              <Text style={styles.question}>¿YA HABÍAS GENERADO {documentLabel.toUpperCase()} ANTES?</Text>
              <View style={styles.choiceRow}>
                <Pressable accessibilityRole="radio" accessibilityState={{ selected: habiaGenerado === true }} style={[styles.choice, habiaGenerado === true && styles.choiceActive]} onPress={() => setHabiaGenerado(true)}>
                  <Text style={[styles.choiceText, habiaGenerado === true && styles.choiceTextActive]}>Sí</Text>
                </Pressable>
                <Pressable accessibilityRole="radio" accessibilityState={{ selected: habiaGenerado === false }} style={[styles.choice, habiaGenerado === false && styles.choiceActive]} onPress={() => setHabiaGenerado(false)}>
                  <Text style={[styles.choiceText, habiaGenerado === false && styles.choiceTextActive]}>No</Text>
                </Pressable>
              </View>
              <Text style={styles.note}>Si respondes “Sí”, continuamos desde el último número usado.</Text>
            </View>

            {habiaGenerado ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.step}>SECUENCIA ANTERIOR</Text>
                  <Text style={styles.badge}>9 dígitos</Text>
                </View>
                <Text style={styles.question}>INGRESA LA SECUENCIA DONDE TE QUEDASTE</Text>
                <TextInput
                  value={cleanedSequence}
                  onChangeText={(value) => setSecuenciaAnterior(value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="Ej: 000000125"
                  keyboardType="number-pad"
                  maxLength={9}
                  style={styles.input}
                />
                {nextHint ? <Text style={styles.nextHint}>Si te quedaste en la {Number(cleanedSequence)}, la siguiente será la {Number(nextHint)}.</Text> : null}
              </View>
            ) : null}

            {habiaGenerado === false ? (
              <View style={styles.section}>
                <Text style={styles.question}>Se iniciará la numeración normal.</Text>
                <Text style={styles.note}>La siguiente emisión iniciará desde la numeración normal.</Text>
              </View>
            ) : null}

            {message ? <Text style={styles.error}>{message}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerCopy}>
              <Text style={styles.footerTitle}>Configuración única</Text>
              <Text style={styles.note}>Solo se pide una vez por serie y documento.</Text>
            </View>
            <Pressable style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar y continuar'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 25, 42, 0.55)',
    justifyContent: 'center',
    padding: 14,
  },
  card: {
    maxHeight: '82%',
    borderRadius: 22,
    backgroundColor: '#F8FCFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBE1F3',
  },
  header: {
    padding: 16,
    backgroundColor: '#EEF8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#D5E6F4',
    flexDirection: 'row',
    gap: 10,
  },
  headerCopy: { flex: 1, gap: 6, paddingRight: 4 },
  eyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#D6ECFA',
    color: '#006AAE',
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 10,
  },
  title: { color: '#132D45', fontSize: 22, fontWeight: '900' },
  help: { color: '#5C7186', fontSize: 13, lineHeight: 19 },
  serieBox: {
    minWidth: 82,
    height: 82,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#B8D8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5FE',
    marginTop: 18,
  },
  serieValue: { color: '#006AAE', fontSize: 16, fontWeight: '900' },
  serieLabel: { color: '#4C6D8B', fontSize: 10, fontWeight: '900', marginTop: 5 },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBE1F3',
  },
  body: { maxHeight: 360 },
  bodyContent: { padding: 14, gap: 12 },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBE1F3',
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  step: {
    borderRadius: 999,
    backgroundColor: '#E6F4FD',
    color: '#006AAE',
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#E6F4FD',
    color: '#006AAE',
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
  },
  question: { color: '#17324D', fontSize: 13, fontWeight: '900' },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBE1F3',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F5FAFE',
  },
  choiceActive: { borderColor: '#0781C8', backgroundColor: '#E8F6FF' },
  choiceText: { color: '#52687D', fontWeight: '900', fontSize: 15 },
  choiceTextActive: { color: '#006AAE' },
  note: { color: '#5C7186', fontSize: 12, lineHeight: 18 },
  input: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8BC7F0',
    backgroundColor: '#FFFFFF',
    color: '#132D45',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '800',
  },
  nextHint: {
    borderRadius: 16,
    backgroundColor: '#DDF0FC',
    color: '#006AAE',
    fontWeight: '800',
    padding: 10,
    fontSize: 12,
  },
  error: { color: '#9D1C1C', fontWeight: '800' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#D5E6F4',
    padding: 14,
    gap: 12,
  },
  footerCopy: { flex: 1, gap: 5 },
  footerTitle: { color: '#132D45', fontWeight: '900', fontSize: 14 },
  saveButton: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#168AD0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
