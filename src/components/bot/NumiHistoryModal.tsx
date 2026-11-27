import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getBotMessageDate, loadArchivedBotChats, type ArchivedBotChat, type BotSessionScope } from '../../services/botService';
import type { BotMessage } from '../../types/bot';
import { NumiCatalogList } from './NumiCatalogList';

export function NumiHistoryModal({ userId, scope, messages, sending, onNewChat, onClose }: {
  userId: number;
  scope: BotSessionScope;
  messages: BotMessage[];
  sending: boolean;
  onNewChat: (eraseHistory?: boolean) => Promise<boolean>;
  onClose: () => void;
}) {
  const [archive, setArchive] = useState<ArchivedBotChat[]>();
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selected, setSelected] = useState<ArchivedBotChat>();

  useEffect(() => {
    let active = true;
    void loadArchivedBotChats(userId, scope).then((chats) => {
      if (active) setArchive(chats);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [userId, scope]);

  const current = messages.filter((message) => message.id !== 'welcome');
  const archived = (archive ?? []).filter((chat) => chat.id !== current[0]?.id);
  const changeConversation = async (eraseHistory = false) => {
    if (saving || sending) return;
    setSaving(true);
    setActionError('');
    if (await onNewChat(eraseHistory)) {
      onClose();
      return;
    }
    setActionError(eraseHistory ? 'No se pudo borrar el historial.' : 'No se pudo guardar la conversación.');
    setSaving(false);
  };
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.row}>
          <Text accessibilityRole="header" style={styles.heading}>Historial de Númi</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}><Text style={styles.link}>Cerrar</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list} nestedScrollEnabled>
          {selected ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setSelected(undefined)}><Text style={styles.link}>Volver al historial</Text></Pressable>
              {selected.messages.map((message) => (
                <View key={message.id} style={styles.card}>
                  <Text style={styles.label}>{message.role === 'user' ? 'Tú' : 'Númi'} · {formatDate(message)}</Text>
                  <Text style={styles.body}>{message.text}</Text>
                  {message.catalogList ? <NumiCatalogList {...message.catalogList} /> : null}
                </View>
              ))}
            </>
          ) : (
            <>
              <View style={styles.row}>
                <Pressable accessibilityRole="button" disabled={sending || saving} onPress={() => void changeConversation()}>
                  <Text style={[styles.link, (sending || saving) && styles.disabled]}>Nueva conversación</Text>
                </Pressable>
                {current.length || archived.length || error ? (
                  <Pressable accessibilityRole="button" disabled={sending || saving} onPress={() => {
                    Alert.alert('Borrar historial', 'Se borrarán las conversaciones de Númi guardadas en este dispositivo.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Borrar', style: 'destructive', onPress: () => void changeConversation(true) },
                    ]);
                  }}>
                    <Text style={[styles.danger, (sending || saving) && styles.disabled]}>Borrar historial</Text>
                  </Pressable>
                ) : null}
              </View>
              {actionError ? <Text accessibilityRole="alert" style={styles.body}>{actionError}</Text> : null}
              {!archive && !error ? <ActivityIndicator accessibilityLabel="Cargando conversaciones" /> : null}
              {error ? <Text accessibilityRole="alert" style={styles.body}>No se pudieron cargar las conversaciones guardadas.</Text> : null}
              {current.length ? <ChatEntry chat={{ id: 'current', messages: current }} current onSelect={setSelected} /> : null}
              {archived.map((chat) => <ChatEntry key={chat.id} chat={chat} onSelect={setSelected} />)}
              {archive && !current.length && !archived.length ? <Text style={styles.body}>Aún no hay conversaciones.</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ChatEntry({ chat, current, onSelect }: {
  chat: ArchivedBotChat;
  current?: boolean;
  onSelect: (chat: ArchivedBotChat) => void;
}) {
  const first = chat.messages[0];
  if (!first) return null;
  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={() => onSelect(chat)}>
      <Text style={styles.label}>{formatDate(first)}{current ? ' · Actual' : ''}</Text>
      <Text style={styles.body} numberOfLines={2}>{first.text}</Text>
    </Pressable>
  );
}

function formatDate(message: BotMessage) {
  const value = getBotMessageDate(message);
  return value === undefined ? 'Sin fecha' : new Date(value).toLocaleString('es-EC');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FC', padding: 20, paddingTop: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { color: '#15344F', fontSize: 22, fontWeight: '700' },
  link: { color: '#0878C9', fontWeight: '700', paddingVertical: 8 },
  danger: { color: '#A32728', fontWeight: '700', paddingVertical: 8 },
  disabled: { opacity: 0.5 },
  list: { gap: 10, paddingTop: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, gap: 4 },
  label: { color: '#15344F', fontWeight: '700' },
  body: { color: '#435E73' },
});
