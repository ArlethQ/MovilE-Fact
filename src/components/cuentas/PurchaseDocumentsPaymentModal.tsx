import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { TRANSFER_DESTINATION_DETAILS, TRANSFER_ORIGIN_BANKS } from '../../config/bankTransfer';
import type { CompraDocumentosTransferenciaInput, CompraDocumentosPagoInput } from '../../services/operationalMobileService';
import { styles } from '../../styles/appStyles';
import { formatMoney } from '../../utils/documentFormatting';
import { Field, MessageBox, PrimaryButton, SecondaryButton, type MessageState } from '../ui/FormControls';
import { DropdownField } from '../ui/FormShared';

type TransferDetails = Omit<CompraDocumentosTransferenciaInput, keyof CompraDocumentosPagoInput>;

const BANK_OPTIONS = TRANSFER_ORIGIN_BANKS.map((label, value) => ({ label, value }));
const PAYMENT_METHODS = [
  { id: 'online', label: 'DeUna / Pago en línea', icon: 'cellphone-check' },
  { id: 'transfer', label: 'Transferencia bancaria', icon: 'bank-outline' },
] as const;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

type Props = {
  documents: number;
  unlimited: boolean;
  total: number;
  saving: boolean;
  message?: MessageState;
  onSave: (transfer?: TransferDetails) => Promise<boolean | undefined>;
  onClose: () => void;
};

export function PurchaseDocumentsPaymentModal({ documents, unlimited, total, saving, message, onSave, onClose }: Props) {
  const [method, setMethod] = useState<'online' | 'transfer'>('online');
  const [bank, setBank] = useState<number | null>(null);
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; base64: string } | null>(null);
  const [localError, setLocalError] = useState('');
  const [showSaveError, setShowSaveError] = useState(false);
  const [pickingReceipt, setPickingReceipt] = useState(false);
  const busyRef = useRef(false);
  const transferring = method === 'transfer';
  const busy = saving || pickingReceipt;
  const subtotal = Math.round((total / 1.15) * 100) / 100;

  const pickReceipt = async () => {
    if (busyRef.current) return;

    busyRef.current = true;
    setPickingReceipt(true);
    setLocalError('');
    setShowSaveError(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true });
      if (result.canceled) return;

      setReceipt(null);
      const { base64, uri, fileSize } = result.assets[0];
      const isSupportedImage = base64?.startsWith('/9j/') || base64?.startsWith('iVBORw0KGgo');
      const bytes = base64 ? Math.floor(base64.replace(/=+$/, '').length * 3 / 4) : 0;
      if (!base64 || !isSupportedImage || bytes < 8 || bytes > MAX_RECEIPT_BYTES || (fileSize ?? 0) > MAX_RECEIPT_BYTES) {
        setLocalError('Selecciona un comprobante JPG o PNG de máximo 5 MB.');
        return;
      }

      setReceipt({ uri, base64 });
    } catch {
      setLocalError('No se pudo leer el comprobante. Vuelve a seleccionarlo.');
    } finally {
      setPickingReceipt(false);
      busyRef.current = false;
    }
  };

  const submit = async () => {
    if (busyRef.current) return;

    setLocalError('');
    setShowSaveError(false);
    let transfer: TransferDetails | undefined;

    if (transferring) {
      if (bank === null || !holder.trim() || !account || !reference || !receipt) {
        setLocalError('Completa los datos de la transferencia y adjunta el comprobante.');
        return;
      }
      const nameParts = holder.trim().split(' ').filter((part) => /^\p{L}{3,}$/u.test(part));
      if (nameParts.length < 2) {
        setLocalError('Ingresa al menos un nombre y un apellido de tres letras cada uno.');
        return;
      }

      transfer = {
        banco: TRANSFER_ORIGIN_BANKS[bank],
        titular: holder.trim(),
        cuentaOrigen: account,
        numeroComprobante: reference,
        comprobanteBase64: receipt.base64,
      };
    }

    busyRef.current = true;
    try {
      if (await onSave(transfer)) {
        onClose();
      } else {
        setShowSaveError(true);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const close = () => {
    if (!busyRef.current) onClose();
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={paymentStyles.overlay}>
        <View style={paymentStyles.dialog} accessibilityViewIsModal>
          <Text style={styles.rechargeSummaryTitle}>Método de pago</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={paymentStyles.content}>
            <View>
              <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>Documentos</Text><Text style={styles.rechargeSummaryValue}>{unlimited ? 'Ilimitados por 1 año' : documents}</Text></View>
              <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>Subtotal</Text><Text style={styles.rechargeSummaryValue}>{formatMoney(subtotal)}</Text></View>
              <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>IVA 15%</Text><Text style={styles.rechargeSummaryValue}>{formatMoney(total - subtotal)}</Text></View>
              <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>Total a pagar</Text><Text style={styles.rechargeSummaryValue}>USD {formatMoney(total)}</Text></View>
            </View>
            <View pointerEvents={busy ? 'none' : 'auto'} style={paymentStyles.content}>
              <View accessibilityRole="radiogroup" style={paymentStyles.content}>
                {PAYMENT_METHODS.map(({ id, label, icon }) => (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: method === id, disabled: busy }}
                    disabled={busy}
                    onPress={() => {
                      setMethod(id);
                      setLocalError('');
                      setShowSaveError(false);
                    }}
                    style={[paymentStyles.method, method === id && paymentStyles.selectedMethod]}
                  >
                    <MaterialCommunityIcons name={icon} size={22} color="#0072BD" />
                    <Text style={styles.rechargeSummaryValue}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {transferring ? (
                <>
                  <View style={styles.rechargeInputBlock}>
                    <Text style={styles.rechargeSummaryValue}>Pagar a</Text>
                    <Text style={paymentStyles.bankDetails} selectable>{TRANSFER_DESTINATION_DETAILS}</Text>
                    <Text style={styles.rechargeHint}>Realiza la transferencia y envía el comprobante para validación.</Text>
                  </View>
                  <DropdownField label="Banco de origen *" options={BANK_OPTIONS} value={bank} onChange={setBank} />
                  <Field label="Titular de la cuenta *" value={holder} onChangeText={setHolder} autoCapitalize="words" />
                  <Field label="Número de cuenta de origen *" value={account} onChangeText={(value) => setAccount(value.replace(/\D/g, ''))} keyboardType="number-pad" />
                  <Field label="Número de comprobante *" value={reference} onChangeText={(value) => setReference(value.replace(/[^\p{L}\p{Nd}]/gu, '').toUpperCase().slice(0, 50))} autoCapitalize="characters" />
                  {receipt ? <Image source={{ uri: receipt.uri }} style={paymentStyles.preview} resizeMode="contain" accessibilityLabel="Vista previa del comprobante" /> : null}
                  <SecondaryButton label={receipt ? 'Cambiar comprobante' : 'Adjuntar comprobante'} onPress={pickReceipt} />
                  <Text style={styles.rechargeHint}>JPG o PNG, máximo 5 MB.</Text>
                </>
              ) : (
                <Text style={styles.rechargeHint}>Continúa al checkout de Pagomedios para pagar con DeUna.</Text>
              )}
            </View>
            {localError ? <MessageBox message={{ type: 'error', text: localError }} /> : null}
            {showSaveError && message?.type === 'error' ? <MessageBox message={message} /> : null}
          </ScrollView>
          <View style={paymentStyles.actions}>
            <PrimaryButton label={transferring ? 'Enviar transferencia' : 'Pagar con DeUna'} loading={busy} onPress={submit} />
            {!busy ? <SecondaryButton label="Cancelar" onPress={close} /> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const paymentStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: '#0B1A2B99' },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '92%', padding: 16, gap: 12, borderRadius: 16, backgroundColor: '#FFFFFF' },
  content: { gap: 10 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: '#CFE0EF', borderRadius: 10 },
  selectedMethod: { borderColor: '#0072BD', backgroundColor: '#EAF5FC' },
  bankDetails: { color: '#29425D', fontSize: 13, lineHeight: 20 },
  preview: { height: 100, width: '100%' },
  actions: { gap: 8 },
});