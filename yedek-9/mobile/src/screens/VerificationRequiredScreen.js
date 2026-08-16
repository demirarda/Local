import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export default function VerificationRequiredScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const message =
    route?.params?.message ||
    'Bu aksiyon icin dogrulama zorunlu: universite e-postasi (Serit A) veya kimlik KYC (Serit B).';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <MaterialIcons name="arrow-back" size={22} color="#f9fafb" />
      </TouchableOpacity>
      <View style={styles.body}>
        <Text style={styles.emoji}>🔐</Text>
        <Text style={styles.title}>Dogrulama Gerekli</Text>
        <Text style={styles.sub}>{message}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('VerifyEmail')}>
          <Text style={styles.btnText}>Universite e-postasi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => navigation.navigate('OnboardingIdentityKyc')}
        >
          <Text style={styles.btnSecondaryText}>Kimlik ile dogrula</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>Geri Don</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', paddingHorizontal: 24 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 42, marginBottom: 12 },
  title: { color: '#f9fafb', fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 10, color: '#d1d5db', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  btn: { marginTop: 20, backgroundColor: '#f59e0b', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 },
  btnText: { color: '#111827', fontWeight: '800' },
  btnSecondary: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  btnSecondaryText: { color: '#fbbf24', fontWeight: '800' },
  secondaryBtn: { marginTop: 12, paddingVertical: 10 },
  secondaryText: { color: '#9ca3af', fontWeight: '600' },
});
