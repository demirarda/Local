import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { fetchDsDashboard } from '../services/api';

function Row({ label, value }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const pct = Math.max(0, Math.min(1, Number(value)));
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.rowValue}>{pct.toFixed(2)}</Text>
    </View>
  );
}

export default function DSUserDashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const dash = await fetchDsDashboard();
        if (mounted) {
          setData(dash);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'DS paneli yuklenemedi');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const dsFull = Number(data?.ds_full_ema ?? 0);
  const dsAdjusted = Number(data?.ds_ema ?? 0);
  const tierLabel = data?.ds_tier_label || data?.ds_tier || '—';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>DS Gosterge Paneli</Text>
        <View style={{ width: 18 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1B2E4A" /></View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorHint}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <Text style={styles.heroKicker}>DS FULL (private radar)</Text>
            <Text style={styles.heroValue}>{dsFull.toFixed(2)} / 1.00</Text>
            <Text style={styles.heroSub}>Tier: {tierLabel}</Text>
            <Text style={styles.heroMeta}>
              DS adjusted (RS carpani): {dsAdjusted.toFixed(2)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bilesen Cubuklari (son 5 Ritual)</Text>
            <Row label="Kisi cesitliligi (PD)" value={data?.pd_score} />
            <Row label="Ritual tipi (CtxD)" value={data?.ctxd_score} />
            <Row label="Mekan cesitliligi (VD)" value={data?.vd_score} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>RS Carpani</Text>
            <Text style={styles.meta}>
              DS multiplier: {Number(data?.ds_multiplier || 1).toFixed(3)}
            </Text>
            <Text style={styles.metaSmall}>
              FL3 + Regular dislanir; kapali cekirdekte guncelleme atlanir.
            </Text>
            {data?.last_updated_at ? (
              <Text style={styles.metaSmall}>
                Son guncelleme: {new Date(data.last_updated_at).toLocaleString('tr-TR')}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 22, color: '#111' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  content: { padding: 16, paddingBottom: 40 },
  errorHint: { color: '#b45309', fontSize: 14, textAlign: 'center' },
  hero: {
    backgroundColor: '#1B2E4A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  heroKicker: { color: '#93c5fd', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  heroSub: { color: '#dbeafe', marginTop: 6, fontSize: 13, fontWeight: '600' },
  heroMeta: { color: 'rgba(255,255,255,0.65)', marginTop: 8, fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, color: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowLabel: { width: 130, fontSize: 12, color: '#525252' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#1B2E4A' },
  rowValue: { width: 36, fontSize: 11, color: '#111', textAlign: 'right' },
  meta: { fontSize: 14, color: '#374151' },
  metaSmall: { fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 16 },
});
