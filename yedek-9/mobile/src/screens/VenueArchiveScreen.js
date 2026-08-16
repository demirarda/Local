import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchVenueArchive, setVenueFeaturedMemories, getVenue } from '../services/api';

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';
const TEXT = '#1a1a1a';

export default function VenueArchiveScreen({ route, navigation }) {
  const { venueId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [featuredIds, setFeaturedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const [venue, archive] = await Promise.all([
        getVenue(venueId),
        fetchVenueArchive(venueId, { limit: 50 }),
      ]);
      const manage = Boolean(venue?.can_manage || venue?.profile?.can_manage);
      setCanManage(manage);
      setMemories(archive?.memories || []);
      setTotal(archive?.total || 0);
      const featured = venue?.vitrine?.featured_memory_ids
        || venue?.profile?.vitrine?.featured_memory_ids
        || [];
      setFeaturedIds(featured.map(String));
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Arsiv yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const toggleFeatured = (memoryId) => {
    const id = String(memoryId);
    setFeaturedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 12) {
        Alert.alert('Limit', 'En fazla 12 one cikan memory secilebilir');
        return prev;
      }
      return [...prev, id];
    });
  };

  const saveFeatured = async () => {
    setSaving(true);
    try {
      await setVenueFeaturedMemories(venueId, featuredIds);
      Alert.alert('Tamam', 'One cikan anilar guncellendi');
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[PRIMARY]} />}
    >
      <Text style={styles.heading}>Memory Arsivi</Text>
      <Text style={styles.sub}>
        PUBLIC anilar gizlenemez · {total} kayit
        {!canManage ? ' · tam liste yalnizca yoneticiye acik' : ''}
      </Text>

      {canManage ? (
        <TouchableOpacity style={styles.saveBtn} onPress={saveFeatured} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Kaydediliyor…' : 'One Cikanlari Kaydet'}</Text>
        </TouchableOpacity>
      ) : null}

      {memories.length === 0 ? (
        <Text style={styles.muted}>Henuz PUBLIC memory yok</Text>
      ) : (
        memories.map((m) => {
          const isFeatured = featuredIds.includes(String(m.id)) || m.is_featured;
          return (
            <TouchableOpacity
              key={m.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('MemoryDetail', { memory: m, memoryId: m.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {m.caption || m.ritual_title || 'Memory'}
                </Text>
                {isFeatured ? (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredText}>One cikan</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.meta}>
                {m.user_name || 'Kullanici'}
                {m.ritual_type ? ` · ${m.ritual_type}` : ''}
              </Text>
              {canManage ? (
                <TouchableOpacity
                  style={styles.featureBtn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    toggleFeatured(m.id);
                  }}
                >
                  <MaterialIcons
                    name={featuredIds.includes(String(m.id)) ? 'star' : 'star-border'}
                    size={18}
                    color={PRIMARY}
                  />
                  <Text style={styles.featureBtnText}>
                    {featuredIds.includes(String(m.id)) ? 'One cikandan cikar' : 'One cikar'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: TEXT },
  sub: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 16 },
  muted: { color: MUTED, fontSize: 14 },
  saveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT },
  featuredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featuredText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  meta: { fontSize: 12, color: MUTED, marginTop: 6 },
  featureBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  featureBtnText: { fontSize: 13, color: TEXT, fontWeight: '600' },
});
