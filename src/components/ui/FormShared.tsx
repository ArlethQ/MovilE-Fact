import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { styles } from '../../styles/appStyles';

export function DirectoryTabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.directoryTab, active && styles.directoryTabActive]} onPress={onPress}><Text style={[styles.directoryTabText, active && styles.directoryTabTextActive]}>{label}</Text></Pressable>;
}

export function DropdownField({ label, options, value, onChange, placeholder, allowClear }: {
  label: string;
  options: { label: string; value: number }[];
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.dropdownField}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dropdownButton} onPress={() => setOpen(true)}>
        <Text style={[styles.dropdownButtonText, !selected && styles.dropdownPlaceholder]} numberOfLines={1}>{selected?.label ?? placeholder ?? `Seleccione ${label.toLowerCase()}`}</Text>
        <Text style={styles.dropdownChevron}>v</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownOverlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownTitle}>{label}</Text>
            <ScrollView style={styles.dropdownList} contentContainerStyle={styles.dropdownListContent}>
              {allowClear ? <Pressable style={[styles.dropdownOption, value === null && styles.dropdownOptionActive]} onPress={() => { onChange(null); setOpen(false); }}><Text style={[styles.dropdownOptionText, value === null && styles.dropdownOptionTextActive]}>{placeholder ?? '-- Sin seleccionar --'}</Text></Pressable> : null}
              {options.map((option, index) => <Pressable key={`${label}-${option.value}-${option.label}-${index}`} style={[styles.dropdownOption, value === option.value && styles.dropdownOptionActive]} onPress={() => { onChange(option.value); setOpen(false); }}><Text style={[styles.dropdownOptionText, value === option.value && styles.dropdownOptionTextActive]}>{option.label}</Text></Pressable>)}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ToggleRow({ label, text, value, onChange }: { label: string; text: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}><View style={[styles.toggleBox, value && styles.toggleBoxActive]}>{value ? <Text style={styles.toggleCheck}>OK</Text> : null}</View><View style={styles.toggleTextBlock}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleHelp}>{text}</Text></View></Pressable>;
}

export function FormTopBar({ onBack, onDiscard }: { onBack: () => void; onDiscard: () => void }) {
  return <View style={styles.clientFormTopBar}><Pressable accessibilityLabel="Volver" style={styles.clientFormBackButton} onPress={onBack}><MaterialCommunityIcons name="arrow-left" size={19} color="#00649D" /><Text style={styles.clientFormBackText}>Volver</Text></Pressable><Pressable accessibilityLabel="Descartar cambios" style={styles.clientFormDiscardButton} onPress={onDiscard}><MaterialCommunityIcons name="close" size={17} color="#6B7D8C" /><Text style={styles.clientFormDiscardText}>Descartar</Text></Pressable></View>;
}
