import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import { styles } from '../../styles/appStyles';
import { PortalHeaderAvatar } from './PortalNavigation';

function statusToneStyles(tone: 'success' | 'warning' | 'danger') {
  if (tone === 'danger') return { card: styles.unifiedStatusCardDanger, icon: styles.unifiedStatusIconDanger, color: '#D92D3A' };
  if (tone === 'warning') return { card: styles.unifiedStatusCardWarning, icon: styles.unifiedStatusIconWarning, color: '#D77416' };
  return { card: styles.unifiedStatusCardSuccess, icon: styles.unifiedStatusIconSuccess, color: '#0F9D58' };
}

export function GlobalWorkspaceHeader({
  title,
  subtitle,
  unreadNotifications,
  documentPlan,
  firmaSummary,
  portalMode = false,
  erubricaMode = false,
  onSearch,
  onNotifications,
  onMenu,
  onDocuments,
  onFirma,
  onLogout,
}: {
  title: string;
  subtitle: string;
  unreadNotifications: number;
  documentPlan: { tone: 'success' | 'warning' | 'danger'; label: string; caption: string };
  firmaSummary: { tone: 'success' | 'warning' | 'danger'; label: string; caption: string };
  portalMode?: boolean;
  erubricaMode?: boolean;
  onSearch: () => void;
  onNotifications: () => void;
  onMenu: () => void;
  onDocuments: () => void;
  onFirma: () => void;
  onLogout?: () => void;
}) {
  const compact = useWindowDimensions().width < 380;
  const documentTone = statusToneStyles(documentPlan.tone);
  const firmaTone = statusToneStyles(firmaSummary.tone);
  return (
    <View style={[styles.unifiedTopBar, erubricaMode && styles.erubricaTopBar]}>
      <View style={styles.unifiedHeaderRow}>
        <View style={styles.unifiedBrandBlock}>
          <PortalHeaderAvatar service={erubricaMode ? 'erubrica' : 'efact'} />
          <View style={styles.unifiedTitleBlock}>
            <Text style={styles.unifiedTitle} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
            {subtitle ? <Text style={[styles.unifiedSubtitle, erubricaMode && styles.erubricaHeaderSubtitle]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>
        {!portalMode ? (
          <View style={styles.unifiedHeaderActions}>
            {!erubricaMode ? (
              <>
                <Pressable style={styles.unifiedIconButton} onPress={onSearch} accessibilityLabel="Buscar en toda la operación">
                  <MaterialCommunityIcons name="magnify" size={22} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.unifiedIconButton} onPress={onNotifications} accessibilityLabel="Notificaciones">
                  <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
                  {unreadNotifications > 0 ? <View style={styles.dashboardNotificationDot} /> : null}
                </Pressable>
              </>
            ) : null}
            <Pressable style={styles.unifiedIconButton} onPress={onMenu} accessibilityLabel="Menu">
              <MaterialCommunityIcons name="menu" size={25} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.portalLogoutButton} onPress={onLogout} accessibilityLabel="Salir">
            <MaterialCommunityIcons name="door-open" size={20} color="#FFFFFF" />
            <Text style={styles.portalLogoutText}>Salir</Text>
          </Pressable>
        )}
      </View>
      {!portalMode ? <View style={[styles.unifiedStatusGrid, compact && styles.unifiedStatusGridCompact]}>
        {!erubricaMode ? <Pressable style={[styles.unifiedStatusCard, compact && styles.unifiedStatusCardStacked, documentTone.card]} onPress={onDocuments}>
          <View style={[styles.unifiedStatusIcon, documentTone.icon]}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={documentTone.color} />
          </View>
          <View style={styles.unifiedStatusCopy}>
            <Text style={styles.unifiedStatusLabel}>Total documentos</Text>
            <Text style={[styles.unifiedStatusValue, { color: documentTone.color }]}>{documentPlan.label}</Text>
            <Text style={styles.unifiedStatusCaption}>{documentPlan.caption}</Text>
          </View>
        </Pressable> : null}
        <Pressable style={[styles.unifiedStatusCard, compact && styles.unifiedStatusCardStacked, erubricaMode && styles.unifiedStatusCardFull, firmaTone.card]} onPress={onFirma}>
          <View style={[styles.unifiedStatusIcon, styles.unifiedFirmaIcon, firmaTone.icon]}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={firmaTone.color} />
          </View>
          <View style={styles.unifiedStatusCopy}>
            <Text style={styles.unifiedStatusLabel}>{erubricaMode ? 'Estado de firma' : 'Firma electronica'}</Text>
            <Text style={[styles.unifiedStatusValue, { color: firmaTone.color }]}>{firmaSummary.label}</Text>
            <Text style={styles.unifiedStatusCaption}>{firmaSummary.caption}</Text>
          </View>
        </Pressable>
      </View> : null}
    </View>
  );
}

