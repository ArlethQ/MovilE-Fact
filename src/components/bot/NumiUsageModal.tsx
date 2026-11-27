import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { getBotUsage, type BotUsageTurn } from '../../services/botService';
import { ApiError } from '../../services/apiClient';

export function NumiUsageModal({ onClose }: { onClose: () => void }) {
  const [turns, setTurns] = useState<BotUsageTurn[]>([]);
  const [error, setError] = useState<{ message: string; canRetry: boolean }>();
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError(undefined);
    void getBotUsage(request.signal).then((result) => {
      if (!request.signal.aborted) setTurns(result);
    }).catch((failure: unknown) => {
      if (request.signal.aborted) return;
      setTurns([]);
      const status = failure instanceof ApiError ? failure.status : undefined;
      if (status === 404) {
        setError({ message: 'El servidor conectado aún no ofrece el consumo de Númi. Usa un servidor de pruebas con la API actualizada.', canRetry: false });
      } else if (status === 403) {
        setError({ message: 'El consumo de Númi está disponible solo para superadministradores.', canRetry: false });
      } else {
        setError({ message: 'No se pudo consultar el consumo. Intenta nuevamente.', canRetry: true });
      }
    }).finally(() => {
      if (!request.signal.aborted) setLoading(false);
    });
    return () => request.abort();
  }, [refresh]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sheet.container}>
        <View style={sheet.header}>
          <Text accessibilityRole="header" style={sheet.title}>Consumo de Númi</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}><Text style={sheet.action}>Cerrar</Text></Pressable>
        </View>
        <Text style={sheet.secondary}>Hasta 100 turnos recientes de esta instancia del servidor.</Text>
        {loading && turns.length === 0 ? <ActivityIndicator accessibilityLabel="Consultando consumo" /> : null}
        {error ? <Text accessibilityRole="alert" style={sheet.secondary}>{error.message}</Text> : null}
        {error?.canRetry ? (
          <Pressable accessibilityRole="button" onPress={() => setRefresh((value) => value + 1)}>
            <Text style={sheet.action}>Reintentar</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={turns}
          keyExtractor={(turn) => turn.id}
          refreshing={loading && turns.length > 0}
          onRefresh={() => setRefresh((value) => value + 1)}
          ListEmptyComponent={!loading && !error ? <Text style={sheet.secondary}>Aún no hay turnos registrados.</Text> : undefined}
          renderItem={({ item }) => <UsageTurn turn={item} />}
        />
      </View>
    </Modal>
  );
}

function UsageTurn({ turn }: { turn: BotUsageTurn }) {
  const measured = turn.calls.filter((call) => call.totalTokens != null);
  const tokens = measured.reduce((sum, call) => sum + (call.totalTokens ?? 0), 0);
  const count = turn.calls.length;
  return (
    <View style={sheet.card}>
      <Text style={sheet.label}>{new Date(turn.startedAt).toLocaleString('es-EC')} · {turn.scope === 'erubrica' ? 'E-Rúbrica' : 'E-FACT'} · {turn.mode}</Text>
      <Text style={sheet.secondary}>
        {count} {count === 1 ? 'llamada' : 'llamadas'} · {tokens} tokens registrados
        {measured.length < count ? ` · ${count - measured.length} sin medición` : ''}
        {turn.completed ? '' : ' · Turno interrumpido'}
      </Text>
      {turn.calls.map((call, index) => (
        <View key={index} style={sheet.call}>
          <Text style={sheet.label}>{index + 1}. {call.model} · {call.httpStatus == null ? 'Sin respuesta HTTP' : `HTTP ${call.httpStatus}`}</Text>
          <Text style={sheet.secondary}>{new Date(call.startedAt).toLocaleTimeString('es-EC')} · Entrada {call.inputTokens ?? '—'} · Caché {call.cachedInputTokens ?? '—'} · Salida {call.outputTokens ?? '—'} · Total {call.totalTokens ?? '—'}</Text>
          {call.estimatedUsd != null ? <Text style={sheet.secondary}>USD {call.estimatedUsd.toFixed(6)} estimados</Text> : null}
        </View>
      ))}
    </View>
  );
}

const sheet = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FC', padding: 20, paddingTop: 40, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#15344F' },
  action: { fontWeight: '700', color: '#0878C9', paddingVertical: 6 },
  card: { padding: 12, borderRadius: 10, backgroundColor: '#FFFFFF', marginBottom: 8, gap: 4 },
  label: { fontWeight: '600', color: '#15344F' },
  secondary: { color: '#435E73' },
  call: { marginTop: 4, paddingTop: 6, borderTopColor: '#D8E7F0', borderTopWidth: 1 },
});
