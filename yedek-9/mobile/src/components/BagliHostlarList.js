/**
 * sonMD §2C — "Bağlı Hostlar" listesi.
 * Friends bileşeni KULLANILMAZ.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function BagliHostlarList({ hosts = [], onPressHost, title = 'Bağlı Hostlar' }) {
  const list = Array.isArray(hosts) ? hosts : [];
  if (list.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>Henüz bağlı host yok</Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {list.map((h) => {
        const key = h.user_id || h.id;
        const label = h.name || h.username || 'Host';
        return (
          <TouchableOpacity
            key={String(key)}
            style={styles.row}
            activeOpacity={0.85}
            onPress={() => onPressHost?.(h)}
            disabled={!onPressHost}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{String(label).slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{label}</Text>
              <Text style={styles.meta}>{h.type === 'BRAND_ADMIN' ? 'Brand admin' : 'Üni bağlı'}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 8 },
  empty: { fontSize: 13, color: '#6b7280' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '600', color: '#111' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
