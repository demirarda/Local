import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { buildQrBumpPayload, qrBumpFriend } from '../services/api';

const PRIMARY = '#1B2E4A';

/**
 * son-part.md §4.1 — QR-BUMP as lightweight sheet (not full screen).
 */
export default function QRBumpSheet({ visible, onClose }) {
  const { user } = useAuthStore();
  const [scanInput, setScanInput] = useState('');
  const [loading, setLoading] = useState(false);

  const myPayload = useMemo(() => (user?.id ? buildQrBumpPayload(user.id) : ''), [user?.id]);

  const handleShare = async () => {
    if (!myPayload) return;
    try {
      await Share.share({ message: `LOCAL QR-Bump kodum:\n${myPayload}` });
    } catch (_e) {}
  };

  const handleBump = async () => {
    const payload = scanInput.trim();
    if (!payload) {
      Alert.alert('Kod gerekli', 'Karsidaki kisinin QR kodunu yapistir veya okut.');
      return;
    }
    setLoading(true);
    try {
      const result = await qrBumpFriend({ qrPayload: payload });
      Alert.alert(
        'Baglanti',
        result?.message || 'Arkadaslik istegi gonderildi veya zaten baglisiniz.',
        [{ text: 'Tamam', onPress: () => { setScanInput(''); onClose?.(); } }]
      );
    } catch (e) {
      Alert.alert('Hata', e.message || 'QR bump basarisiz');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setScanInput('');
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>QR-Bump</Text>
            <TouchableOpacity onPress={handleDismiss} hitSlop={12}>
              <MaterialIcons name="close" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Mevcut arkadas-ekle akisina kisa yol — yeni ekran degil, hafif sheet.
          </Text>

          <Text style={styles.label}>Benim kodum</Text>
          <Text style={styles.code} selectable>{myPayload || '—'}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
            <Text style={styles.secondaryBtnText}>Kodu Paylas</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16 }]}>Karsi tarafin kodu</Text>
          <TextInput
            style={styles.input}
            value={scanInput}
            onChangeText={setScanInput}
            placeholder="LOCAL:USER:..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleBump} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Baglan</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  code: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: PRIMARY,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: PRIMARY, fontWeight: '700' },
});
