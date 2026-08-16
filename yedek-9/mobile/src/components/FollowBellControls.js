import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * §13 Zil 🔔 — follow'un üstünde anlık tetik
 */
export default function FollowBellControls({
  following,
  bell,
  followLoading = false,
  bellLoading = false,
  onToggleBell,
  onToggleFollow,
  followLabel = 'Takip Et',
  followingLabel = 'Takiptesin',
}) {
  return (
    <View style={styles.wrap}>
      {following ? (
        <TouchableOpacity
          style={[styles.bellBtn, bell && styles.bellBtnOn]}
          onPress={onToggleBell}
          disabled={bellLoading}
        >
          <MaterialIcons
            name={bell ? 'notifications-active' : 'notifications-none'}
            size={18}
            color={bell ? '#0f766e' : '#6b6b6b'}
          />
          <Text style={[styles.bellText, bell && styles.bellTextOn]}>
            {bellLoading ? '…' : bell ? 'Zil açık' : 'Bildirim aç'}
          </Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={[styles.followBtn, following && styles.followBtnActive]}
        onPress={onToggleFollow}
        disabled={followLoading}
      >
        <Text style={[styles.followText, following && styles.followTextActive]}>
          {followLoading ? '…' : following ? followingLabel : followLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  bellBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    backgroundColor: '#fff',
  },
  bellBtnOn: { borderColor: '#99f6e4', backgroundColor: '#f0fdfa' },
  bellText: { fontSize: 13, fontWeight: '700', color: '#6b6b6b' },
  bellTextOn: { color: '#0f766e' },
  followBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f9a13d',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  followBtnActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f9a13d' },
  followText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followTextActive: { color: '#f9a13d' },
});
