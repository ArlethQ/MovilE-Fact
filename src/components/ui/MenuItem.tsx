import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../../styles/appStyles';

export function MenuItem({ accentColor, active, disabled, expanded, hasChildren, icon, inset, label, onPress, onToggle }: { accentColor?: string; active: boolean; disabled?: boolean; expanded?: boolean; hasChildren?: boolean; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; inset?: boolean; label: string; onPress: () => void; onToggle?: () => void }) {
  const iconColor = active ? '#FFFFFF' : '#637587';
  return <Pressable accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled), expanded: hasChildren ? Boolean(expanded) : undefined, selected: active }} disabled={disabled} style={[styles.menuItem, inset && styles.menuItemInset, active && styles.menuItemActive, active && accentColor && { backgroundColor: accentColor, borderColor: accentColor }, disabled && styles.menuItemDisabled]} onPress={onPress}>{icon ? <View style={[styles.menuItemIconShell, active && styles.menuItemIconShellActive]}><MaterialCommunityIcons name={icon} size={inset ? 17 : 18} color={iconColor} /></View> : null}<Text style={[styles.menuItemText, active && styles.menuItemTextActive]} numberOfLines={2}>{label}</Text>{hasChildren ? <Pressable accessibilityLabel={`${expanded ? 'Contraer' : 'Expandir'} ${label}`} accessibilityRole="button" hitSlop={10} onPress={(event) => { event.stopPropagation(); onToggle?.(); }}><Text style={[styles.menuItemChevron, expanded && styles.menuItemChevronExpanded, active && styles.menuItemTextActive]}>⌄</Text></Pressable> : null}</Pressable>;
}

export function InitialsAvatar({ initials, size }: { initials: string; size: number }) {
  const colors = ['#6C63FF', '#006BB5', '#2C3E50', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#34495E', '#2980B9'];
  const hash = initials.split('').reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return <View style={[styles.initialsAvatar, { backgroundColor: colors[Math.abs(hash) % colors.length], borderRadius: Math.round(size * 0.22), height: size, width: size }]}><Text style={[styles.initialsAvatarText, { fontSize: Math.max(16, Math.round(size * 0.42)) }]}>{initials}</Text></View>;
}
