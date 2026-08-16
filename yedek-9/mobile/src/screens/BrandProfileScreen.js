/**
 * Brand profile — §12
 * Aura + dağılım + Series + yaşandığı yerler + arşiv
 * TRUST YOK · slot YOK · feed YOK · ortalama YOK · arşiv gizlenemez
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchBrandProfile } from '../services/api';
import BagliHostlarList from '../components/BagliHostlarList';

const PRIMARY = '#f9a13d';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';

export default function BrandProfileScreen({ route, navigation }) {
  const brandId = route.params?.brandId;
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchBrandProfile(brandId);
        if (!cancelled) setBrand(data);
      } catch (e) {
        if (!cancelled) Alert.alert('Hata', e?.message || 'Brand yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  const lived = brand?.lived_venues || [];
  const archive = brand?.archive || [];
  const series = brand?.series_strip || [];
  const dist = brand?.distribution?.categories || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <MaterialIcons name="arrow-back" size={22} color={TEXT} />
      </TouchableOpacity>
      <Text style={styles.eyebrow}>BRAND</Text>
      <View style={styles.headerRow}>
        {brand?.logo_url ? (
          <Image source={{ uri: brand.logo_url }} style={styles.logo} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{brand?.name || 'Brand'}</Text>
          {brand?.one_liner ? <Text style={styles.muted}>{brand.one_liner}</Text> : null}
          {brand?.category ? <Text style={styles.chip}>{brand.category}</Text> : null}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Aura</Text>
        <Text style={styles.panelBody}>
          {brand?.aura?.score != null ? Number(brand.aura.score).toFixed(2) : '—'}
        </Text>
        <Text style={styles.muted}>Trust yok · slot yok · feed yok · ortalama yok</Text>
      </View>

      <BagliHostlarList
        hosts={brand?.affiliated_hosts || []}
        onPressHost={(h) => navigation.navigate('SocialPassport', { userId: h.user_id })}
      />

      <Text style={styles.section}>Dağılım</Text>
      {dist.length === 0 ? (
        <Text style={styles.muted}>Henüz yok</Text>
      ) : (
        dist.map((d) => (
          <View key={d.category} style={styles.row}>
            <Text style={styles.rowTitle}>{d.category}</Text>
            <Text style={styles.rowMeta}>
              {d.n} ritüel
              {d.rq_avg != null ? ` · RQ ${Number(d.rq_avg).toFixed(2)}` : ''}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.section}>Series</Text>
      {series.length === 0 ? (
        <Text style={styles.muted}>Series yok</Text>
      ) : (
        series.map((s) => (
          <TouchableOpacity
            key={s.series_id}
            style={styles.row}
            onPress={() =>
              navigation.navigate('RitualDetail', { ritualId: s.ritual_id })
            }
          >
            <Text style={styles.rowTitle}>{s.series_name || s.title}</Text>
            <Text style={styles.rowMeta}>
              {s.series_week != null ? `Hafta ${s.series_week}` : 'Seri'}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.section}>Yaşandığı yerler</Text>
      {lived.length === 0 ? (
        <Text style={styles.muted}>Henüz yok</Text>
      ) : (
        lived.map((v) => (
          <TouchableOpacity
            key={v.venue_id}
            style={styles.row}
            onPress={() => navigation.navigate('VenueDetail', { venueId: v.venue_id })}
          >
            <Text style={styles.rowTitle}>{v.name}</Text>
            <Text style={styles.rowMeta}>
              {v.city || '—'}
              {v.trust_score != null ? ` · Trust ${Number(v.trust_score).toFixed(1)}` : ''}
              {v.aura_score != null ? ` · Aura ${Number(v.aura_score).toFixed(1)}` : ''}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.section}>Arşiv (gizlenemez)</Text>
      {archive.length === 0 ? (
        <Text style={styles.muted}>Arşiv boş</Text>
      ) : (
        archive.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.row}
            onPress={() => navigation.navigate('MemoryDetail', { memoryId: m.id })}
          >
            <Text style={styles.rowTitle} numberOfLines={2}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf9f6' },
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: PRIMARY },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  logo: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#eee' },
  title: { fontSize: 26, fontWeight: '700', color: TEXT },
  chip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '700',
  },
  panel: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ecece8',
  },
  panelTitle: { fontSize: 12, fontWeight: '700', color: MUTED, letterSpacing: 0.4 },
  panelBody: { fontSize: 28, fontWeight: '700', color: TEXT, marginTop: 4 },
  section: { marginTop: 22, marginBottom: 8, fontSize: 16, fontWeight: '700', color: TEXT },
  muted: { fontSize: 13, color: MUTED, marginTop: 4 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e0',
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: TEXT },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 2 },
});
