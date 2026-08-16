import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function UP04L2FriendScreen() {
  const sharedGrid = Array.from({ length: 6 }).map((_, i) => ({ id: i }));
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>UP-04 · L2 Friend</Text>
      <Text style={styles.sub}>L2 seviyesinde profil gorunurlugu aciktir; Core Circle ozellikleri L3+/Core seviyesinde acilir.</Text>

      <View style={styles.card}>
        <Text style={styles.name}>Aylin Demir</Text>
        <Text style={styles.meta}>RS 7.6 · FL2</Text>
        <View style={styles.badgesRow}>
          <Text style={styles.badge}>Friendship</Text>
          <Text style={styles.badge}>Verified Host</Text>
        </View>
      </View>

      <View style={styles.warnCard}>
        <Text style={styles.warnTitle}>Core Circle Warning</Text>
        <Text style={styles.warnText}>Core Circle davetleri ve tam cekirdek rozetleri bu seviyede gorunmez.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Paylasilan Izgara</Text>
        <View style={styles.grid}>
          {sharedGrid.map((x) => (
            <View key={x.id} style={styles.tile}>
              <Text style={styles.tileText}>IMG</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sub: { color: '#4b5563', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  name: { fontSize: 18, fontWeight: '800', color: '#111827' },
  meta: { marginTop: 4, color: '#4b5563', fontWeight: '700' },
  badgesRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  badge: { backgroundColor: '#eef2ff', color: '#3730a3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '800' },
  warnCard: { backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', padding: 12 },
  warnTitle: { color: '#92400e', fontWeight: '800', marginBottom: 6 },
  warnText: { color: '#92400e' },
  sectionTitle: { fontSize: 12, color: '#6b7280', fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#111827', fontWeight: '800' },
});
