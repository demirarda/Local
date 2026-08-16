import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ProfileAccessStateScreen({ route }) {
  const { title = 'Profile State', description = '', bullets = [] } = route.params || {};
  const isUP04 = String(title).includes('UP-04');
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {isUP04 ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Core Circle Warning</Text>
          <Text style={styles.warningText}>Bu gorunum L2 baglanti seviyesi icin acik. Core Circle ozellikleri L3+/Core seviyesinde aktiflesir.</Text>
        </View>
      ) : null}
      <View style={styles.card}>
        {bullets.map((b) => (
          <Text key={b} style={styles.row}>• {b}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 10 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  description: { color: '#4b5563', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, gap: 6 },
  row: { color: '#111827', fontWeight: '600' },
  warningCard: { backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', padding: 12 },
  warningTitle: { color: '#92400e', fontWeight: '800', marginBottom: 6 },
  warningText: { color: '#92400e' },
});
