import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../../styles/appStyles';

export function DirectoryHero({
  eyebrow,
  title,
  subtitle,
  icon,
  metrics: _metrics,
  onCreate,
  createLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  metrics: { value: string | number; label: string }[];
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <View style={styles.clientBankSummary}>
      <View style={styles.clientBankSummaryHeader}>
        <View style={styles.clientHeroTitleBlock}>
          <View style={styles.clientHeroIcon}>
            <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
          </View>
          <View style={styles.clientHeroCopy}>
            <Text style={styles.clientBankEyebrow}>{eyebrow}</Text>
            <Text style={styles.clientBankTitle}>{title}</Text>
            <Text style={styles.clientHeroSubtitle}>{subtitle}</Text>
          </View>
        </View>
        {onCreate ? (
          <Pressable style={styles.clientHeroAddButton} onPress={onCreate} accessibilityLabel={createLabel ?? 'Nuevo registro'}>
            <Text style={styles.clientHeroAddGlyph}>+</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
