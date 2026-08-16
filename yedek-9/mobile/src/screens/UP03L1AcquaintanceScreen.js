import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const sharedRituals = [
  { id: 'r1', title: 'Morning Coffee Circle', when: 'Dun 09:30' },
  { id: 'r2', title: 'Campus Walk', when: 'Gecen hafta 18:00' },
  { id: 'r3', title: 'Book Hour', when: '2 hafta once 19:15' },
];

const friendsOnlyMemories = Array.from({ length: 6 }).map((_, i) => ({ id: `m-${i + 1}` }));

export default function UP03L1AcquaintanceScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>UP-03 · L1 Tansik Profili</Text>
      <Text style={styles.sub}>
        L1 seviyesinde RS gorunur, paylasilan Ritual gecmisi acilir ve friends-only anilar goruntulenebilir.
      </Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AD</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Aylin Demir</Text>
          <Text style={styles.uni}>Politecnico di Milano</Text>
          <View style={styles.badgesRow}>
            <Text style={styles.l1Badge}>L1 TANISIK</Text>
            <Text style={styles.rsBadge}>RS 7.2</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Paylasilan Ritual Gecmisi</Text>
        {sharedRituals.map((r) => (
          <View key={r.id} style={styles.ritualRow}>
            <Text style={styles.ritualTitle}>{r.title}</Text>
            <Text style={styles.ritualWhen}>{r.when}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Friends-only Anilar (Acik)</Text>
        <View style={styles.grid}>
          {friendsOnlyMemories.map((m) => (
            <View key={m.id} style={styles.tile}>
              <Text style={styles.tileText}>MEM</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Bu gorunumde friends-only icerik L1+ oldugu icin aciktir.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sub: { color: '#4b5563', lineHeight: 20 },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', color: '#111827' },
  name: { fontSize: 16, fontWeight: '800', color: '#111827' },
  uni: { marginTop: 2, color: '#6b7280', fontSize: 12, fontWeight: '600' },
  badgesRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  l1Badge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
  },
  rsBadge: {
    backgroundColor: '#eef2ff',
    color: '#3730a3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
  },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  sectionTitle: { fontSize: 12, color: '#6b7280', fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  ritualRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  ritualTitle: { color: '#111827', fontSize: 14, fontWeight: '700' },
  ritualWhen: { marginTop: 2, color: '#6b7280', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#111827', fontWeight: '800', fontSize: 12 },
  note: { marginTop: 10, color: '#374151', fontSize: 12, fontWeight: '600' },
});
