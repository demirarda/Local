import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { fetchVenueMarketShare } from '../services/api';

export default function VenueCityPartnerScreen({ route, navigation }) {
  const venueId = route?.params?.venueId;
  const venueName = route?.params?.venueName || 'Mekan';
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!venueId) {
        setError('venueId gerekli');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await fetchVenueMarketShare(venueId);
        if (cancelled) return;
        setPayload(data);
        setError(null);
        setLocked(false);
      } catch (e) {
        if (cancelled) return;
        setLocked(e.status === 403);
        setError(e.message || 'Yuklenemedi');
        setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const districts = useMemo(() => {
    const raw =
      payload?.districts ||
      payload?.district_breakdown ||
      payload?.clusters ||
      [];
    return Array.isArray(raw) ? raw : [];
  }, [payload]);

  const maxIntensity = Math.max(...districts.map((x) => Number(x.intensity) || 0), 1);
  const sharePct = payload?.share_pct ?? payload?.sharePct ?? payload?.percent ?? null;
  const tier = String(payload?.venue?.package_tier || payload?.tier || 'free').toLowerCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bolge radari</Text>
      <Text style={styles.subtitle}>
        {venueName} — sehir payi ve kume yogunlugu (HAKİM).
      </Text>

      {loading ? (
        <ActivityIndicator color="#111827" style={{ marginTop: 24 }} />
      ) : locked ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>HAKİM kilitli</Text>
          <Text style={styles.apiNote}>
            Pazar Payi ve Bolge Radari HAKİM paketinde acilir. OPERATÖR itibar sekmesinde
            kilitli teaser olarak gorunur.
          </Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() =>
              navigation?.navigate?.('VenueBusiness', { venueId, venueName })
            }
          >
            <Text style={styles.upgradeText}>Paket yukselt</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pazar payi</Text>
            <Text style={styles.shareValue}>
              {sharePct != null ? `%${sharePct}` : '—'}
            </Text>
            <Text style={styles.apiNote}>
              {payload?.venue_ritual_count ?? payload?.venueRitualCount ?? 0} ritual sende ·{' '}
              {payload?.city_ritual_count ?? payload?.cityRitualCount ?? 0} sehirde · paket:{' '}
              {tier.toUpperCase()}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kume analizi</Text>
            {districts.length === 0 ? (
              <Text style={styles.apiNote}>Bu pencerede bolge verisi yok.</Text>
            ) : (
              districts.map((row) => {
                const name = row.name || row.district || 'Bolge';
                const intensity = Number(row.intensity) || 0;
                const ritualsCount = row.ritualsCount ?? row.rituals_count ?? 0;
                const attendees = row.attendees ?? 0;
                return (
                  <View key={name} style={styles.row}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowName}>{name}</Text>
                      <Text style={styles.rowMeta}>
                        {ritualsCount} Ritual · {attendees} katilimci
                      </Text>
                    </View>
                    <View style={styles.track}>
                      <View
                        style={[
                          styles.fill,
                          {
                            width: `${Math.max(
                              8,
                              Math.round((intensity / maxIntensity) * 100)
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.intensity}>Yogunluk {intensity}</Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  error: { color: '#b91c1c', marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  shareValue: { fontSize: 36, fontWeight: '800', color: '#111827' },
  row: { marginBottom: 12 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowName: { fontWeight: '700', color: '#111827' },
  rowMeta: { fontSize: 12, color: '#6b7280' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: '#111827' },
  intensity: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  apiNote: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  upgradeBtn: {
    marginTop: 12,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeText: { color: '#fff', fontWeight: '700' },
});
