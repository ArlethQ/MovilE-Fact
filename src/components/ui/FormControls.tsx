import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type MessageState = { type: 'success' | 'error' | 'info'; text: string } | null;

export function Field({ label, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, secureTextEntry && styles.inputWithAction]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !visible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor="#8B98A6"
        />
        {secureTextEntry ? <Pressable accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} hitSlop={8} style={styles.passwordToggle} onPress={() => setVisible((current) => !current)}>
          <MaterialCommunityIcons name={visible ? 'eye-outline' : 'eye-off-outline'} size={21} color="#52718A" />
        </Pressable> : null}
      </View>
    </View>
  );
}

export function SearchField({ label, value, onChangeText, placeholder, resultCount, totalCount, loading, onSubmit, predictive = false, suggestions = [], onSelectSuggestion }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
  loading?: boolean;
  onSubmit?: () => void;
  predictive?: boolean;
  suggestions?: Array<{ id: string; title: string; subtitle?: string }>;
  onSelectSuggestion?: (suggestion: { id: string; title: string; subtitle?: string }) => void;
}) {
  const hasQuery = value.trim().length > 0;
  const lastInputValue = useRef(value);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const handleChangeText = (nextValue: string) => {
    lastInputValue.current = nextValue;
    onChangeText(nextValue);
  };
  useEffect(() => {
    if (!predictive || !value.trim() || !submitRef.current) return;
    if (lastInputValue.current !== value) {
      lastInputValue.current = value;
      return;
    }
    const timer = setTimeout(() => submitRef.current?.(), 350);
    return () => clearTimeout(timer);
  }, [predictive, value]);
  const countLabel = loading ? 'Buscando' : typeof resultCount === 'number' ? `${resultCount} ${resultCount === 1 ? 'resultado' : 'resultados'}` : undefined;
  return (
    <View style={styles.searchCard}>
      <View style={styles.searchHeaderRow}>
        <View style={styles.searchTitleBlock}>
          <Text style={styles.searchEyebrow}>{hasQuery ? 'Filtro activo' : 'Busqueda rapida'}</Text>
          <Text style={styles.searchTitle}>{label}</Text>
        </View>
        {countLabel ? <View style={styles.searchCountBadge}>{loading ? <ActivityIndicator color="#00649D" size="small" /> : null}<Text style={styles.searchCountText}>{countLabel}</Text></View> : null}
      </View>
      <View style={styles.searchInputShell}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} enterKeyHint="search" placeholder={placeholder ?? label} placeholderTextColor="#8191A2" returnKeyType="search" style={styles.searchInput} value={value} onChangeText={handleChangeText} onSubmitEditing={onSubmit} />
        {value ? <Pressable accessibilityLabel="Limpiar busqueda" hitSlop={8} style={styles.searchClearButton} onPress={() => handleChangeText('')}><Text style={styles.searchClearText}>×</Text></Pressable> : null}
        {onSubmit ? <Pressable accessibilityLabel="Ejecutar busqueda" style={styles.searchSubmitButton} onPress={onSubmit}><Text style={styles.searchSubmitText}>Buscar</Text></Pressable> : null}
      </View>
      {predictive && hasQuery && suggestions.length > 0 ? <View style={styles.searchSuggestions}>
        {suggestions.slice(0, 5).map((suggestion) => <Pressable key={suggestion.id} style={styles.searchSuggestion} onPress={() => onSelectSuggestion?.(suggestion)}>
          <Text style={styles.searchSuggestionTitle} numberOfLines={1}>{suggestion.title}</Text>
          {suggestion.subtitle ? <Text style={styles.searchSuggestionSubtitle} numberOfLines={1}>{suggestion.subtitle}</Text> : null}
        </Pressable>)}
      </View> : null}
      <Text style={styles.searchHelper}>{hasQuery && typeof resultCount === 'number' ? `Mostrando ${resultCount}${typeof totalCount === 'number' ? ` de ${totalCount}` : ''}. Toca × para ver todo.` : placeholder ?? 'Escribe para filtrar los registros.'}</Text>
    </View>
  );
}

export function PrimaryButton({ label, loading, onPress, accentColor }: { label: string; loading: boolean; onPress: () => void; accentColor?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} style={[styles.primaryButton, accentColor ? { backgroundColor: accentColor } : null, loading && styles.disabledButton]} onPress={onPress}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{label}</Text>}</Pressable>;
}

export function SecondaryButton({ label, onPress, accentColor }: { label: string; onPress: () => void; accentColor?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.secondaryButton, accentColor ? { borderColor: accentColor, backgroundColor: `${accentColor}15` } : null]} onPress={onPress}><Text style={[styles.secondaryButtonText, accentColor ? { color: accentColor } : null]}>{label}</Text></Pressable>;
}

export function BiometricButton({ label, loading, onPress }: { label: string; loading: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} disabled={loading} style={styles.biometricButton} onPress={onPress}>{loading ? <ActivityIndicator color="#00649D" /> : <MaterialCommunityIcons name="fingerprint" size={25} color="#00649D" />}<Text style={styles.biometricButtonText}>{label}</Text></Pressable>;
}

export function LoginActionTiles({ active, biometricLabel, onPassword, onBiometric }: { active: 'password' | 'biometric'; biometricLabel: string | null; onPassword: () => void; onBiometric: () => void }) {
  const platformBiometricLabel = Platform.OS === 'ios' ? 'Face ID' : 'Huella digital';
  return <View style={styles.loginActionTiles}><LoginActionTile active={active === 'password'} icon="account-outline" label="Usuario / contraseña" onPress={onPassword} /><LoginActionTile active={active === 'biometric'} icon="fingerprint" label={biometricLabel || platformBiometricLabel} onPress={onBiometric} /></View>;
}

function LoginActionTile({ active, icon, label, onPress }: { active: boolean; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.loginActionTile, active && styles.loginActionTileActive]} onPress={onPress}><MaterialCommunityIcons name={icon} size={27} color={active ? '#0072BD' : '#668196'} /><Text style={[styles.loginActionLabel, active && styles.loginActionLabelActive]}>{label}</Text></Pressable>;
}

export function SegmentButton({ active, label, description, icon, onPress, accentColor }: { active: boolean; label: string; description?: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onPress: () => void; accentColor?: string }) {
  return <Pressable accessibilityLabel={description ? `${label}. ${description}` : label} accessibilityState={{ selected: active }} style={[styles.segmentButton, active && styles.segmentButtonActive, active && accentColor ? { backgroundColor: `${accentColor}15`, borderColor: accentColor } : null]} onPress={onPress}>
    {icon ? <MaterialCommunityIcons name={icon} size={20} color={active ? accentColor ?? '#0072BD' : '#668196'} /> : null}
    <View style={styles.segmentCopy}><Text style={[styles.segmentText, active && styles.segmentTextActive, active && accentColor ? { color: accentColor } : null]}>{label}</Text>{description ? <Text style={[styles.segmentDescription, active && styles.segmentDescriptionActive]}>{description}</Text> : null}</View>
  </Pressable>;
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress}><Text style={styles.link}>{label}</Text></Pressable>; }
export function InlineSwitch({ muted, action, onPress }: { muted: string; action: string; onPress: () => void }) { return <View style={styles.inlineSwitch}><Text style={styles.mutedText}>{muted} </Text><TextLink label={action} onPress={onPress} /></View>; }
export function MessageBox({ message }: { message: Exclude<MessageState, null> }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => setVisible(true), [message.type, message.text]);

  const title = message.type === 'error' ? 'No se pudo completar' : message.type === 'success' ? 'Operación completada' : 'Información';
  const icon = message.type === 'error' ? 'alert-circle-outline' : message.type === 'success' ? 'check-circle-outline' : 'information-outline';
  const color = message.type === 'error' ? '#A51D2D' : message.type === 'success' ? '#0F6B32' : '#00649D';

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.feedbackOverlay} onPress={() => setVisible(false)}>
        <Pressable style={[styles.feedbackPanel, styles[`message_${message.type}`]]} onPress={(event) => event.stopPropagation()} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <View style={styles.feedbackHeader}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
            <Text style={styles.feedbackTitle}>{title}</Text>
          </View>
          <Text style={styles.messageText}>{message.text}</Text>
          <Pressable style={styles.feedbackCloseButton} onPress={() => setVisible(false)} accessibilityRole="button" accessibilityLabel="Cerrar mensaje">
            <Text style={styles.feedbackCloseText}>Cerrar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
export function ExternalLink({ label, url }: { label: string; url: string }) { return <Pressable style={styles.externalLink} onPress={() => Linking.openURL(url)}><Text style={styles.externalLinkText}>{label}</Text></Pressable>; }
export function SecurityNotice() { return <View style={styles.securityNotice}><Text style={styles.securityIcon}>✓</Text><Text style={styles.securityText}>Acceso protegido por Numérica Software</Text></View>; }

const styles = StyleSheet.create({
  field: { gap: 7 }, label: { color: '#34465B', fontSize: 12, fontWeight: '900' }, inputShell: { alignItems: 'center', backgroundColor: '#F8FBFD', borderColor: '#D9E5EE', borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 48 }, input: { color: '#263A4F', flex: 1, fontSize: 14, paddingHorizontal: 13, paddingVertical: 11, textAlign: 'left', textAlignVertical: 'top' }, inputWithAction: { paddingRight: 4 }, passwordToggle: { padding: 10 },
  searchCard: { backgroundColor: '#F7FAFD', borderColor: '#DCE8F1', borderRadius: 14, borderWidth: 1, gap: 8, padding: 11 }, searchHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, searchTitleBlock: { flex: 1, gap: 2 }, searchEyebrow: { color: '#0072BD', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' }, searchTitle: { color: '#263A4F', fontSize: 14, fontWeight: '900' }, searchCountBadge: { alignItems: 'center', backgroundColor: '#EAF5FC', borderRadius: 10, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 6 }, searchCountText: { color: '#00649D', fontSize: 11, fontWeight: '900' }, searchInputShell: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D9E5EE', borderRadius: 11, borderWidth: 1, flexDirection: 'row', minHeight: 45 }, searchIcon: { color: '#0072BD', fontSize: 21, paddingLeft: 11 }, searchInput: { color: '#263A4F', flex: 1, fontSize: 13, paddingHorizontal: 8, paddingVertical: 10 }, searchClearButton: { paddingHorizontal: 8 }, searchClearText: { color: '#5B7489', fontSize: 21, fontWeight: '800' }, searchSubmitButton: { backgroundColor: '#0072BD', borderRadius: 8, marginRight: 5, paddingHorizontal: 9, paddingVertical: 7 }, searchSubmitText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, searchSuggestions: { backgroundColor: '#FFFFFF', borderColor: '#D9E5EE', borderRadius: 10, borderWidth: 1, marginTop: -2, overflow: 'hidden' }, searchSuggestion: { borderBottomColor: '#EDF2F6', borderBottomWidth: 1, paddingHorizontal: 11, paddingVertical: 9 }, searchSuggestionTitle: { color: '#173E61', fontSize: 13, fontWeight: '900' }, searchSuggestionSubtitle: { color: '#718497', fontSize: 11, fontWeight: '700', marginTop: 2 }, searchHelper: { color: '#718497', fontSize: 11, fontWeight: '700' },
  primaryButton: { alignItems: 'center', backgroundColor: '#0072BD', borderRadius: 12, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 }, disabledButton: { opacity: 0.55 }, primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, secondaryButton: { alignItems: 'center', backgroundColor: '#EFF5F9', borderColor: '#D5E2EB', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 }, secondaryButtonText: { color: '#315A7A', fontSize: 13, fontWeight: '900' }, biometricButton: { alignItems: 'center', borderColor: '#B9D8EE', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 }, biometricButtonText: { color: '#00649D', fontSize: 13, fontWeight: '900' },
  loginActionTiles: { flexDirection: 'row', gap: 8 }, loginActionTile: { alignItems: 'center', backgroundColor: '#F4F8FC', borderColor: '#DCE8F1', borderRadius: 12, borderWidth: 1, flex: 1, gap: 6, justifyContent: 'center', minHeight: 76, paddingHorizontal: 4 }, loginActionTileActive: { backgroundColor: '#EAF5FC', borderColor: '#0072BD' }, loginActionLabel: { color: '#668196', fontSize: 11, fontWeight: '800', textAlign: 'center' }, loginActionLabelActive: { color: '#00649D' }, segmentButton: { alignItems: 'center', backgroundColor: '#F6F9FC', borderColor: '#E1EAF2', borderRadius: 12, borderWidth: 1, flex: 1, gap: 4, justifyContent: 'center', minHeight: 70, paddingHorizontal: 8, paddingVertical: 8 }, segmentButtonActive: { backgroundColor: '#EAF5FC', borderColor: '#0A75B6' }, segmentCopy: { alignItems: 'center', gap: 2 }, segmentText: { color: '#536476', fontSize: 12, fontWeight: '800', textAlign: 'center' }, segmentTextActive: { color: '#00649D' }, segmentDescription: { color: '#8191A0', fontSize: 9, fontWeight: '700', textAlign: 'center' }, segmentDescriptionActive: { color: '#24729B' },
  link: { color: '#0072BD', fontSize: 12, fontWeight: '900' }, inlineSwitch: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 20 }, mutedText: { color: '#6D8192', fontSize: 12, fontWeight: '700' }, message: { borderRadius: 14, marginTop: 16, padding: 14 }, message_success: { backgroundColor: '#E8F7EF' }, message_error: { backgroundColor: '#FDEBEC' }, message_info: { backgroundColor: '#EAF4FE' }, messageText: { color: '#244153', fontSize: 13, fontWeight: '800', lineHeight: 18 }, feedbackOverlay: { alignItems: 'center', backgroundColor: '#07152299', flex: 1, justifyContent: 'center', padding: 22 }, feedbackPanel: { borderRadius: 18, elevation: 8, maxWidth: 460, padding: 18, shadowColor: '#001522', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, width: '100%' }, feedbackHeader: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 10 }, feedbackTitle: { color: '#173E61', flex: 1, fontSize: 16, fontWeight: '900' }, feedbackCloseButton: { alignSelf: 'flex-end', backgroundColor: '#FFFFFFAA', borderColor: '#BFD2DF', borderRadius: 10, borderWidth: 1, marginTop: 16, paddingHorizontal: 14, paddingVertical: 9 }, feedbackCloseText: { color: '#14547C', fontSize: 12, fontWeight: '900' }, externalLink: { alignSelf: 'center', marginTop: 10 }, externalLinkText: { color: '#0072BD', fontSize: 12, fontWeight: '800' }, securityNotice: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 18 }, securityIcon: { color: '#18B889', fontSize: 14, fontWeight: '900' }, securityText: { color: '#5C6D80', flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 16, textAlign: 'center' },
});
