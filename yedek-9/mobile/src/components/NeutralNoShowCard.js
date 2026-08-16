import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * sonMD §2 — kapı kapandıktan sonra gelmeyenlere nötr kart.
 * Ceza dili yok: "katılamadın · kapı XX:XX'te kapandı"
 */
export default function NeutralNoShowCard({ doorClosesAt, tableLabel }) {
  let timeLabel = null;
  if (doorClosesAt) {
    try {
      timeLabel = new Date(doorClosesAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_e) {
      timeLabel = null;
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Katılamadın</Text>
      <Text style={styles.body}>
        {timeLabel
          ? `Kapı ${timeLabel}'te kapandı`
          : 'Giriş kapısı kapandı'}
        {tableLabel ? ` · ${tableLabel}` : ''}
      </Text>
      <Text style={styles.hint}>
        Window ve memory bu ritüelde açılmaz. Bu bir ceza kartı değil — nötr kayıt.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  body: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  hint: { marginTop: 8, fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
});
