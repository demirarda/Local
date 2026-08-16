import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

/**
 * PENDING_WITNESS — mühürlülere tek-tık kart: "X masada mı?"
 */
export default function PendingWitnessCard({
  pending = [],
  onConfirm,
  confirmingId = null,
  isDark = true,
}) {
  const list = Array.isArray(pending) ? pending.filter((p) => p?.pending_witness || p?.checkin_phase === 'pending_witness') : [];
  if (!list.length) return null;

  return (
    <View style={[styles.wrap, !isDark && styles.wrapLight]}>
      <Text style={[styles.title, !isDark && styles.titleLight]}>Tanık onayı</Text>
      <Text style={[styles.sub, !isDark && styles.subLight]}>
        GPS doğrulanamadı — masadaki mühürlüler onaylar
      </Text>
      {list.map((p) => {
        const id = p.id || p.user_id;
        const name = p.name || p.user_name || 'Katılımcı';
        const needed = Number(p.witness_required) || 1;
        const got = Number(p.witness_count) || 0;
        const busy = confirmingId && String(confirmingId) === String(id);
        return (
          <View key={String(id)} style={[styles.row, !isDark && styles.rowLight]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, !isDark && styles.nameLight]}>{name} masada mı?</Text>
              <Text style={[styles.meta, !isDark && styles.metaLight]}>
                Tanık {got}/{needed}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, busy && styles.btnBusy]}
              disabled={busy || !onConfirm}
              onPress={() => onConfirm?.(id)}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Evet</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  wrapLight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  title: { color: '#FBBF24', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  titleLight: { color: '#B45309' },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 10 },
  subLight: { color: '#92400E' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  rowLight: { borderTopColor: '#FDE68A' },
  name: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  nameLight: { color: '#111827' },
  meta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  metaLight: { color: '#6B7280' },
  btn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  btnBusy: { opacity: 0.7 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
