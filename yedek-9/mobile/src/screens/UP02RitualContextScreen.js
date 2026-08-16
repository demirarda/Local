import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function UP02RitualContextScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>Ritual Baglami</Text>
        <Text style={styles.bannerTitle}>Ayni Ritualde karsilastiniz</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.name}>Yabanci Kullanici</Text>
        <Text style={styles.rs}>RS 6.2 / 10.0</Text>
        <Text style={styles.meta}>Baglam: Bu profil yalnizca ortak Ritual icinde gorunur.</Text>
        <TouchableOpacity style={styles.cta} onPress={() => navigation.goBack()}>
          <Text style={styles.ctaText}>Arkadas Ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  banner: { backgroundColor: '#111827', borderRadius: 14, padding: 14, marginBottom: 12 },
  bannerLabel: { color: '#9ca3af', fontSize: 11, fontWeight: '700' },
  bannerTitle: { color: '#f9fafb', fontSize: 18, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  name: { color: '#111827', fontSize: 18, fontWeight: '800' },
  rs: { marginTop: 6, color: '#1f2937', fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 8, color: '#4b5563', lineHeight: 20 },
  cta: { marginTop: 14, backgroundColor: '#111827', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  ctaText: { color: '#fff', fontWeight: '700' },
});
