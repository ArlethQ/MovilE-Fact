import { Image, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EFACT_THEME, ERUBRICA_COLORS } from '../../styles/theme';
import { styles } from '../../styles/appStyles';

function normalizeText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function getPortalServiceVisual(title: string, index: number) {
  const normalized = normalizeText(title);
  if (normalized.includes('fact')) return { kind: 'efact', accent: EFACT_THEME.colors.primary, surface: '#EAF7FF' };
  if (normalized.includes('cont')) return { kind: 'orange', accent: '#F97316', surface: '#FFF3E8' };
  if (normalized.includes('declara')) return { kind: 'green', accent: '#08A889', surface: '#E8FBF7' };
  if (normalized.includes('rubrica') || normalized.includes('sign')) return { kind: 'rubrica', accent: ERUBRICA_COLORS.primary, surface: '#EAFBF4' };
  if (normalized.includes('back')) return { kind: 'purple', accent: '#6847FF', surface: '#F0EDFF' };

  const palette = [
    { kind: 'purple', accent: '#6847FF', surface: '#F0EDFF' },
    { kind: 'orange', accent: '#F97316', surface: '#FFF3E8' },
    { kind: 'green', accent: '#08A889', surface: '#E8FBF7' },
  ];
  return palette[index % palette.length];
}

export function PortalServiceCard({
  title,
  description,
  enabled,
  onPress,
  index,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onPress: () => void;
  index: number;
}) {
  const visual = getPortalServiceVisual(title, index);

  return (
    <Pressable
      disabled={!enabled}
      style={[styles.portalServiceCard, { backgroundColor: visual.surface, borderColor: visual.accent }, !enabled && styles.portalServiceCardDisabled]}
      onPress={onPress}
    >
      <View style={styles.portalServiceLogoPlate}>
        {visual.kind === 'efact' ? <Image source={require('../../../assets/logo-numerica.png')} style={styles.portalServiceLogo} /> : null}
        {visual.kind === 'orange' ? <Image source={require('../../../assets/logo-numerica-naranja.png')} style={styles.portalServiceLogo} /> : null}
        {visual.kind === 'green' ? <Image source={require('../../../assets/logo-numerica-verde.png')} style={styles.portalServiceLogo} /> : null}
        {visual.kind === 'purple' ? <Image source={require('../../../assets/logo-numerica-morado.png')} style={styles.portalServiceLogo} /> : null}
        {visual.kind === 'rubrica' ? <Image source={require('../../../assets/logo-numerica-rubrica.png')} style={styles.portalServiceLogoWide} /> : null}
        {['document', 'calculator', 'pencil', 'briefcase'].includes(visual.kind) ? <PortalServiceGlyph kind={visual.kind} /> : null}
      </View>
      <View style={styles.portalServiceCopy}>
        <Text style={styles.portalServiceTitle}>{title}</Text>
        <Text style={styles.portalServiceDescription}>{description}</Text>
        <View style={[styles.portalServiceButton, { backgroundColor: enabled ? visual.surface : '#EEF3F7' }]}>
          <Text style={[styles.portalServiceButtonText, { color: enabled ? visual.accent : '#7A8A99' }]}>{enabled ? 'Ingresar' : 'No disponible'}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color={enabled ? visual.accent : '#7A8A99'} />
        </View>
      </View>
    </Pressable>
  );
}

function PortalServiceGlyph({ kind }: { kind: string }) {
  if (kind === 'calculator') {
    return (
      <View style={styles.portalGlyphCalculator}>
        <View style={styles.portalGlyphCalculatorScreen} />
        <View style={styles.portalGlyphCalculatorGrid}>
          {Array.from({ length: 9 }).map((_, index) => <View key={`calc-dot-${index}`} style={styles.portalGlyphCalculatorDot} />)}
        </View>
      </View>
    );
  }

  if (kind === 'pencil') {
    return (
      <View style={styles.portalGlyphPencilWrap}>
        <Text style={styles.portalGlyphPencil}>✎</Text>
        <View style={styles.portalGlyphPencilLine} />
      </View>
    );
  }

  if (kind === 'briefcase') {
    return (
      <View style={styles.portalGlyphBriefcase}>
        <View style={styles.portalGlyphBriefcaseHandle} />
        <View style={styles.portalGlyphBriefcaseBody} />
      </View>
    );
  }

  return (
    <View style={styles.portalGlyphDocument}>
      <View style={styles.portalGlyphDocumentFold} />
      <View style={styles.portalGlyphDocumentLine} />
      <View style={styles.portalGlyphDocumentLine} />
      <Text style={styles.portalGlyphDocumentMoney}>$</Text>
    </View>
  );
}
