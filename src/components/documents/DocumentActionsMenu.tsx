import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../../styles/appStyles';

type DocumentAction = {
  label: string;
  icon: string;
  tone: 'primary' | 'success' | 'danger' | 'warning' | 'purple';
  onPress: () => void;
};

export function DocumentActionsMenu({ actions }: { actions: DocumentAction[] }) {
  const [open, setOpen] = useState(false);
  const toneColor = (tone: DocumentAction['tone']) => {
    if (tone === 'success') return '#0F6B32';
    if (tone === 'danger') return '#8A1B1B';
    if (tone === 'warning') return '#8A4B12';
    if (tone === 'purple') return '#5630A8';
    return '#004F88';
  };

  return (
    <View style={styles.documentActionWrap}>
      <Pressable style={styles.documentActionTrigger} onPress={() => setOpen((value) => !value)} accessibilityLabel="Ver acciones">
        <MaterialCommunityIcons name="dots-horizontal" size={21} color="#294D69" />
      </Pressable>
      {open ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.documentActionOverlay} onPress={() => setOpen(false)}>
            <Pressable style={styles.documentActionMenu} onPress={(event) => event.stopPropagation()}>
              {actions.map((action) => {
                const color = toneColor(action.tone);
                return (
                  <Pressable
                    key={action.label}
                    style={styles.documentActionItem}
                    onPress={() => {
                      setOpen(false);
                      action.onPress();
                    }}
                  >
                    <View style={styles.documentActionIcon}>
                      <MaterialCommunityIcons name={action.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={16} color={color} />
                    </View>
                    <Text style={[styles.documentActionText, { color }]}>{action.label}</Text>
                  </Pressable>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

