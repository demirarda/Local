import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { fetchHostLedger } from '../services/api';

export default function HostHistoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthStore();
  const userId = route.params?.userId || user?.id;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    hosted: 0,
    avg_fill_pct: 0,
    on_time_pct: 0,
    no_show_pct: 0,
    rituals: [],
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await fetchHostLedger(userId);
        if (cancelled) return;
        setStats({
          hosted: data.hosted || 0,
          avg_fill_pct: data.avg_fill_pct || 0,
          on_time_pct: data.on_time_pct || 0,
          no_show_pct: data.no_show_pct || 0,
          rituals: Array.isArray(data.rituals) ? data.rituals : [],
        });
      } catch (e) {
        if (!cancelled) setError(e.message || 'Yuklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <MaterialIcons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.title}>Host Gecmisi</Text>
      <Text style={styles.sub}>Yalniz sana ozel — doluluk, zamaninda gelis ve no-show.</Text>
      {loading ? (
        <ActivityIndicator color="#f59e0b" style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.hosted}</Text>
              <Text style={styles.statLabel}>Host edildigi</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.avg_fill_pct}%</Text>
              <Text style={styles.statLabel}>Ort. doluluk</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.on_time_pct}%</Text>
              <Text style={styles.statLabel}>Zamaninda</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.no_show_pct}%</Text>
              <Text style={styles.statLabel}>Gelmeme</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ritual gecmisi</Text>
            {stats.rituals.length === 0 ? (
              <Text style={styles.meta}>Henuz host edilmis ritual yok.</Text>
            ) : (
              stats.rituals.map((x) => (
                <TouchableOpacity
                  key={x.id}
                  style={styles.historyRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('RitualDetail', { ritualId: x.id })}
                >
                  <Text style={styles.row}>{x.title || 'Ritual'}</Text>
                  <Text style={styles.delta}>
                    {x.attendees}/{x.capacity || '—'} · doluluk{' '}
                    {x.fill_pct != null ? `${x.fill_pct}%` : '—'}
                  </Text>
                  <Text style={styles.eval}>
                    {x.status}
                    {x.noshows ? ` · ${x.noshows} no-show` : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 40 },
  backBtn: { marginBottom: 8, width: 36 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  error: { color: '#b91c1c', marginTop: 16 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flexGrow: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111827' },
  historyRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  row: { fontSize: 15, fontWeight: '600', color: '#111827' },
  delta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  eval: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  meta: { fontSize: 13, color: '#6b7280' },
});
