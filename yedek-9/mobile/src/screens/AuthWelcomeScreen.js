import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function AuthWelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>L.</Text>
      <Text style={styles.brand}>LOCAL</Text>
      <Text style={styles.tagline}>Gercek anlarda gercek baglantilar...</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('OnboardingName')}>
        <Text style={styles.primaryText}>Üniversiteli</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.kycBtn} onPress={() => navigation.navigate('OnboardingIdentityKyc')}>
        <Text style={styles.kycText}>Kimlik ile doğrula</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.secondaryText}>Giris Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 88, fontWeight: '900', color: '#111827', lineHeight: 88 },
  brand: { marginTop: 4, fontSize: 14, fontWeight: '700', letterSpacing: 4, color: '#374151' },
  tagline: { marginTop: 16, color: '#4b5563', textAlign: 'center', fontSize: 15, marginBottom: 24 },
  primaryBtn: { width: '100%', maxWidth: 360, backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  kycBtn: { width: '100%', maxWidth: 360, marginTop: 10, borderWidth: 1, borderColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  kycText: { color: '#111827', fontWeight: '800' },
  secondaryBtn: { width: '100%', maxWidth: 360, marginTop: 10, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: '#111827', fontWeight: '700' },
});
