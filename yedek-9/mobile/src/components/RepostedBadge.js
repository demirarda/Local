import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * son-part.md §8.1 — orijinal Rituale "reposted" işareti
 */
export default function RepostedBadge({ repostCount, repostedAt, compact = false }) {
  if (!repostedAt && !(repostCount > 0)) return null;

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <MaterialIcons name="repeat" size={compact ? 11 : 12} color="#92400e" />
      <Text style={[styles.text, compact && styles.textCompact]}>
        Reposted{repostCount > 0 ? ` · ${repostCount}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  textCompact: {
    fontSize: 10,
  },
});
