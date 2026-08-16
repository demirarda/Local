import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { PULSE } from '../constants/pulseTheme';

const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PulseVerifiedExactContent({
  filteredRituals = [],
  city = '',
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const hosts = useMemo(() => {
    const map = new Map();
    filteredRituals.forEach((r) => {
      if (!r.is_host_verified) return;
      const key = r.host_id || r.host_name || `h-${r.id}`;
      if (!map.has(key)) map.set(key, r);
    });
    return Array.from(map.values());
  }, [filteredRituals]);

  const venues = useMemo(() => {
    const map = new Map();
    filteredRituals.forEach((r) => {
      if (!r.is_venue_verified) return;
      const key = r.venue_id || r.venue_name || `v-${r.id}`;
      if (!map.has(key)) map.set(key, r);
    });
    return Array.from(map.values());
  }, [filteredRituals]);

  const openRitual = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const liveCount = filteredRituals.filter((r) => String(r.status || '').toLowerCase() === 'live').length;

  return (
    <ScrollView
      style={[styles.root, isDark && styles.rootDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>✓ DOGRULANMISLAR</Text>
        <Text style={styles.bannerTitle}>Host + Mekan{"\n"}tek ekranda</Text>
        <Text style={styles.bannerSub}>
          {city} · {hosts.length} host · {venues.length} mekan · {liveCount} canli
        </Text>
      </View>

      <View style={styles.sectionHead}>
        <View style={styles.line} />
        <Text style={styles.sectionText}>DOGRULANMIS HOSTLAR</Text>
        <View style={styles.line} />
      </View>
      {hosts.length === 0 ? (
        <Text style={styles.emptyText}>Dogrulanmis host bulunamadi.</Text>
      ) : (
        hosts.slice(0, 8).map((r, i) => (
          <TouchableOpacity key={`h-${r.id || i}`} style={styles.row} onPress={() => openRitual(r.id)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{String(r.host_name || 'H').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.host_name || 'Verified Host'}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {r.title || 'Ritual'} · {hhmm(r.start_time)}
              </Text>
            </View>
            <Text style={styles.tag}>✓ HOST</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={styles.sectionHead}>
        <View style={styles.line} />
        <Text style={styles.sectionText}>DOGRULANMIS MEKANLAR</Text>
        <View style={styles.line} />
      </View>
      {venues.length === 0 ? (
        <Text style={styles.emptyText}>Dogrulanmis mekan bulunamadi.</Text>
      ) : (
        venues.slice(0, 10).map((r, i) => (
          <TouchableOpacity key={`v-${r.id || i}`} style={styles.row} onPress={() => openRitual(r.id)}>
            <View style={[styles.avatar, styles.venueAvatar]}>
              <Text style={styles.avatarText}>M</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.venue_name || city}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {r.title || 'Ritual'} · {hhmm(r.start_time)}
              </Text>
            </View>
            <Text style={styles.tag}>✓ MEKAN</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  rootDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#1B2E4A',
    padding: 14,
    borderWidth: 1,
    borderColor: '#30486d',
  },
  bannerLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: 1, fontWeight: '700' },
  bannerTitle: { fontSize: 24, color: '#fff', marginTop: 6, lineHeight: 28 },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginTop: 6, marginBottom: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  sectionText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#9CA3AF' },
  row: {
    marginHorizontal: 16,
    marginBottom: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8EDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueAvatar: { backgroundColor: '#D1FAE5' },
  avatarText: { fontSize: 13, color: '#1B2E4A', fontWeight: '700' },
  rowTitle: { fontSize: 13, color: '#000', fontWeight: '600' },
  rowSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  tag: {
    fontSize: 8,
    fontWeight: '700',
    color: '#1B2E4A',
    backgroundColor: '#E8EDF4',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  emptyText: { marginHorizontal: 18, color: '#9CA3AF', fontSize: 11, marginBottom: 8 },
});
