import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { t } from '../i18n/stringTable';

/** Memory action row — v3 §15: ▲ sayı · ▼ (sayı yok) · Söz · Yankı */
export default function MemoryActionRow({
  upvotes = 0,
  downvotes: _downvotes = 0,
  quotes = 0,
  echoes = 0,
  onUpvote,
  onDownvote,
  onSoz,
  onEcho,
  lang = 'tr',
  style,
}) {
  const sozLabel = t('soz', lang);
  const yankiLabel = t('yanki', lang);

  return (
    <View style={[styles.row, style]}>
      <Pressable onPress={onUpvote} hitSlop={8} disabled={!onUpvote}>
        <Text style={styles.action}>▲ {Number(upvotes) || 0}</Text>
      </Pressable>
      <Pressable onPress={onDownvote} hitSlop={8} disabled={!onDownvote}>
        <Text style={styles.action}>▼</Text>
      </Pressable>
      <Pressable onPress={onSoz} hitSlop={8} disabled={!onSoz}>
        <Text style={styles.action}>
          {sozLabel} {quotes}
        </Text>
      </Pressable>
      <Pressable onPress={onEcho} hitSlop={8} disabled={!onEcho}>
        <Text style={styles.action}>
          {yankiLabel} {echoes}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
});
