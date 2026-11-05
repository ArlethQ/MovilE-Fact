import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { EFACT_THEME } from '../../styles/theme';
import { styles } from '../../styles/appStyles';

type DashboardModule = { title: string; description: string };
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function DashboardMetric({ value, label }: { value: string | number; label: string }) {
  return <View style={styles.dashboardMetric}><Text style={styles.dashboardMetricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text><Text style={styles.dashboardMetricLabel}>{label}</Text></View>;
}

export function DashboardPrimaryAction({ icon, label, text, primary, centered, onPress }: { icon: IconName; label: string; text: string; primary?: boolean; centered?: boolean; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.dashboardPrimaryAction, primary && styles.dashboardPrimaryActionMain, centered && styles.dashboardPrimaryActionCentered, pressed && styles.dashboardFavoritePressed]} onPress={onPress}><View style={[styles.dashboardPrimaryActionIcon, primary && styles.dashboardPrimaryActionIconMain]}><MaterialCommunityIcons name={icon} size={22} color={primary ? '#FFFFFF' : EFACT_THEME.colors.primary} /></View><Text style={[styles.dashboardPrimaryActionLabel, primary && styles.dashboardPrimaryActionLabelMain, centered && styles.dashboardPrimaryActionTextCentered]} numberOfLines={1}>{label}</Text><Text style={[styles.dashboardPrimaryActionText, primary && styles.dashboardPrimaryActionTextMain, centered && styles.dashboardPrimaryActionTextCentered]} numberOfLines={2}>{text}</Text></Pressable>;
}

export function DashboardFavorite({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.dashboardFavorite, pressed && styles.dashboardFavoritePressed]} onPress={onPress}><View style={[styles.dashboardFavoriteIcon, { backgroundColor: `${color}16` }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View><Text style={styles.dashboardFavoriteLabel} numberOfLines={2}>{label}</Text><Text style={[styles.dashboardFavoriteArrow, { color }]}>›</Text></Pressable>;
}

export function DashboardStatCard({ accent, compact, kind, value, label, trend }: { accent: string; compact?: boolean; kind: string; value: string | number; label: string; trend: string }) {
  return <View style={[styles.dashboardStatCard, compact && styles.dashboardStatCardCompact]}><View style={[styles.dashboardStatIcon, { backgroundColor: `${accent}18` }]}><Text style={[styles.dashboardStatIconText, { color: accent }]}>{kind === 'money' ? '$' : kind === 'people' ? '••' : kind === 'box' ? '+' : '▤'}</Text></View><Text style={styles.dashboardStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{value}</Text><Text style={styles.dashboardStatLabel} numberOfLines={2}>{label}</Text><Text style={styles.dashboardStatTrend} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>↗ {trend} vs mes anterior</Text></View>;
}

export function DashboardQuickAction({ color, label, onPress }: { color: string; label: string; onPress: () => void }) {
  return <Pressable style={styles.dashboardQuickAction} onPress={onPress}><View style={[styles.dashboardQuickIcon, { backgroundColor: color }]}><Text style={styles.dashboardQuickIconText}>+</Text></View><Text style={styles.dashboardQuickLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{label}</Text><Text style={styles.dashboardQuickArrow}>›</Text></Pressable>;
}

export function DashboardServiceRow({ module, index, onPress }: { module: DashboardModule; index: number; onPress: () => void }) {
  const colors = [EFACT_THEME.colors.primary, EFACT_THEME.colors.secondary, EFACT_THEME.colors.info, EFACT_THEME.colors.warning, EFACT_THEME.colors.primaryDark];
  const color = colors[index % colors.length];
  return <Pressable style={({ pressed }) => [styles.dashboardServiceRow, pressed && styles.dashboardFavoritePressed]} onPress={onPress}><View style={[styles.dashboardServiceIcon, { backgroundColor: `${color}16` }]}><MaterialCommunityIcons name="chevron-right-circle-outline" size={22} color={color} /></View><View style={styles.dashboardServiceCopy}><Text style={styles.dashboardServiceTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{module.title}</Text><Text style={styles.dashboardServiceText} numberOfLines={2}>{module.description}</Text></View><MaterialCommunityIcons name="chevron-right" size={22} color={EFACT_THEME.colors.textMuted} /></Pressable>;
}

export function DashboardActivityItem({ color, title, subtitle, amount, status }: { color: string; title: string; subtitle: string; amount?: string; status?: string }) {
  return <View style={styles.dashboardActivityItem}><View style={[styles.dashboardActivityIcon, { backgroundColor: `${color}28` }]}><Text style={[styles.dashboardActivityIconText, { color }]}>✓</Text></View><View style={styles.dashboardActivityCopy}><Text style={styles.dashboardActivityTitle} numberOfLines={2}>{title}</Text><Text style={styles.dashboardActivityText} numberOfLines={2}>{subtitle}</Text></View>{amount || status ? <View style={styles.dashboardActivityMeta}>{amount ? <Text style={styles.dashboardActivityAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{amount}</Text> : null}{status ? <Text style={styles.dashboardActivityStatus} numberOfLines={1}>{status}</Text> : null}</View> : null}</View>;
}
