import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { EFACT_THEME, ERUBRICA_COLORS } from '../../styles/theme';
import { styles } from '../../styles/appStyles';

type PortalView = string;
type PortalIcon = 'home' | 'grid' | 'document' | 'profile' | 'settings' | 'bot' | 'signature' | 'new' | 'file-sign';

export function PortalHeaderAvatar({ service = 'efact' }: { service?: 'efact' | 'erubrica' }) {
  const source = service === 'erubrica'
    ? require('../../../assets/logo-numerica-rubrica.png')
    : require('../../../assets/logo-numerica.png');
  return <Image source={source} style={styles.portalHeaderLogo} />;
}

export function PortalBottomNav({ bottomInset, activeView, mode = 'efact', onServices, onHome, onNew, onFirma, onProfile, onMenu, onSolicitudes, onFirmar, onValidar }: {
  bottomInset: number;
  activeView: PortalView;
  mode?: 'efact' | 'erubrica';
  onServices: () => void;
  onHome: () => void;
  onNew: () => void;
  onFirma: () => void;
  onProfile: () => void;
  onMenu?: () => void;
  onSolicitudes?: () => void;
  onFirmar?: () => void;
  onValidar?: () => void;
}) {
  const erubrica = mode === 'erubrica';
  const compact = useWindowDimensions().width < 360;
  const accentColor = erubrica ? ERUBRICA_COLORS.primary : EFACT_THEME.colors.primary;
  return <View style={[styles.portalBottomNav, compact && styles.portalBottomNavCompact, erubrica && styles.portalBottomNavERubrica, { bottom: Math.max(8, bottomInset + 4) }]}>
    <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'portal'} icon="grid" label="Portal" onPress={onServices} />
    {erubrica ? <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'e-rubrica-inicio'} icon="home" label="Inicio" onPress={onHome} /> : <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'dashboard'} icon="home" label="Inicio" onPress={onHome} />}
    {erubrica ? <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'e-rubrica-nueva-solicitud'} icon="new" label="Solicitar firma" featured onPress={onSolicitudes ?? onNew} /> : <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'nueva-factura'} icon="new" label="Nuevo" featured onPress={onNew} />}
    {erubrica ? <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'e-rubrica-firmar'} icon="file-sign" label="Firmar" onPress={onFirmar ?? onMenu ?? onFirma} /> : <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'firma'} icon="signature" label="Firma" onPress={onFirma} />}
    <PortalTabButton compact={compact} accentColor={accentColor} active={activeView === 'perfil' || activeView === 'perfil-e-rubrica'} icon="profile" label="Perfil" onPress={onProfile} />
  </View>;
}

function VoicePortalTabButton({ accentColor, available, onPressIn, onPressOut }: { accentColor: string; available: boolean; onPressIn?: () => void; onPressOut?: () => void }) {
  return <Pressable
    hitSlop={6}
    accessibilityRole="button"
    accessibilityLabel={available ? 'Mantén presionado para hablar con Númi' : 'Reconocimiento de voz no disponible'}
    disabled={!available}
    style={styles.portalTabButton}
    onPressIn={onPressIn}
    onPressOut={onPressOut}
  >
    <View style={[styles.portalTabIcon, styles.portalTabIconFeatured, !available && { opacity: 0.45 }]}>
      <MaterialCommunityIcons name="microphone-outline" size={25} color="#FFFFFF" />
    </View>
    <Text style={[styles.portalTabText, styles.portalTabTextFeatured, { color: accentColor }]} numberOfLines={1}>Hablar</Text>
  </Pressable>;
}

function PortalTabButton({ compact, accentColor, active, featured, icon, label, onPress }: { compact?: boolean; accentColor: string; active: boolean; featured?: boolean; icon: PortalIcon | 'shield-check' | 'menu'; label: string; onPress: () => void }) {
  const iconName: React.ComponentProps<typeof MaterialCommunityIcons>['name'] = icon === 'home' ? 'home-variant-outline' : icon === 'grid' ? 'view-grid-outline' : icon === 'document' ? 'file-document-outline' : icon === 'signature' ? 'draw-pen' : icon === 'shield-check' ? 'shield-check-outline' : icon === 'profile' ? 'account-circle-outline' : icon === 'settings' ? 'cog-outline' : icon === 'menu' ? 'menu' : icon === 'new' ? 'file-document-plus-outline' : icon === 'file-sign' ? 'file-sign' : 'robot-outline';
  return <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={[styles.portalTabButton, compact && styles.portalTabButtonCompact, active && !featured && styles.portalTabButtonActive, active && !featured && { backgroundColor: `${accentColor}18` }, featured && styles.portalTabButtonFeatured, featured && compact && styles.portalTabButtonFeaturedCompact]} onPress={onPress}><View style={[styles.portalTabIcon, compact && styles.portalTabIconCompact, active && styles.portalTabIconBubble, featured && styles.portalTabIconFeatured, featured && compact && styles.portalTabIconFeaturedCompact, (active || featured) && { backgroundColor: accentColor, shadowColor: accentColor }]}><MaterialCommunityIcons name={iconName} size={featured ? compact ? 22 : 25 : compact ? 20 : 22} color={active || featured ? '#FFFFFF' : EFACT_THEME.colors.textMuted} /></View><Text style={[styles.portalTabText, compact && styles.portalTabTextCompact, active && styles.portalTabTextActive, featured && styles.portalTabTextFeatured, (active || featured) && { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{label}</Text></Pressable>;
}

export function ModuleCard({ title, description, count, enabled, onPress }: { title: string; description: string; count?: number; enabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityHint={enabled ? `Abre ${title}` : 'Esta opcion aun no esta disponible'} disabled={!enabled} style={[styles.moduleCard, !enabled && styles.moduleCardDisabled]} onPress={onPress}><View style={styles.moduleTopRow}><Text style={styles.moduleTitle}>{title}</Text>{typeof count === 'number' ? <Text style={styles.moduleCount}>{count}</Text> : null}</View><Text style={styles.moduleDescription}>{description}</Text><Text style={styles.moduleAction}>{enabled ? 'Abrir' : 'Proximamente'}</Text></Pressable>;
}

export function NavButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.navButton, active && styles.navButtonActive]} onPress={onPress}><Text style={[styles.navButtonText, active && styles.navButtonTextActive]}>{label}</Text></Pressable>;
}
