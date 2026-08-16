import React, { useCallback, useState } from 'react';
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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  fetchRitualSeries,
  updateRitualSeriesSchedule,
  followRitualSeries,
  unfollowRitualSeries,
  cancelRitualSeries,
  transferRitualSeries,
} from '../services/api';
import PeopleSearchPicker from '../components/PeopleSearchPicker';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';

const CADENCES = [
  { value: 'WEEKLY', label: 'Her hafta' },
  { value: 'BIWEEKLY', label: 'Iki haftada bir' },
];
const END_OPTIONS = [
  { value: null, label: 'Acik uclu' },
  { value: 4, label: '4 tekrar' },
  { value: 8, label: '8 tekrar' },
  { value: 12, label: '12 tekrar' },
];

function formatInstanceDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** v2 §7 SERIES — hafta sayaci, gecmis instance arsivi, takip zili, iptal, host devri */
export default function SeriesDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const seriesId = route.params?.seriesId;

  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchRitualSeries(seriesId);
      setSeries(data || null);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Seri yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [seriesId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const isHost = !!series?.is_host;
  const following = !!series?.follow?.following;
  const weekCount = Number(series?.week_count) || 0;

  const handleFollowToggle = async () => {
    try {
      setBusy(true);
      if (following) await unfollowRitualSeries(seriesId);
      else await followRitualSeries(seriesId, true);
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Islem basarisiz');
    } finally {
      setBusy(false);
    }
  };

  const handleSchedule = async (patch) => {
    try {
      setBusy(true);
      await updateRitualSeriesSchedule(seriesId, patch);
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kadans guncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Seriyi iptal et', 'Gelecek tekrarlar duser; gecmis arsiv kalir.', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Iptal et',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            const r = await cancelRitualSeries(seriesId);
            Alert.alert('Tamam', `${r?.cancelled || 0} gelecek tekrar iptal edildi`);
            await load();
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Iptal basarisiz');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleTransfer = async (person) => {
    try {
      await transferRitualSeries(seriesId, person.id);
      setTransferOpen(false);
      Alert.alert('Host devri', `${person.label} artik seri hostu`);
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Devir basarisiz');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Seri</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.empty}>Seri bulunamadi</Text>
        </View>
      </View>
    );
  }

  const past = series.past_instances || [];
  const upcoming = series.upcoming_instances || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {series.name || 'Seri'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.weekCounter}>{weekCount}. hafta</Text>
          <Text style={styles.cardSub}>
            {series.cadence_label || 'Her hafta'} ·{' '}
            {series.open_ended
              ? 'acik uclu'
              : `${series.end_after_weeks} tekrar · ${series.weeks_remaining} kaldi`}
          </Text>
          <Text style={styles.cardSub}>
            Host: {series.host_name || '—'} · {series.follower_count || 0} takipci
          </Text>
          {!series.active ? <Text style={styles.inactive}>Seri kapali</Text> : null}
          <Text style={styles.note}>
            Her tekrar ayri Ritual · kayit / kod / window / feedback bagimsiz
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={handleFollowToggle}
          disabled={busy}
        >
          <Text style={styles.primaryText}>
            {following ? 'Zili kapat (takibi birak)' : 'Seriyi takip et (zil)'}
          </Text>
        </TouchableOpacity>

        {isHost ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tekrar Ayarlari</Text>
            <View style={styles.chipRow}>
              {CADENCES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.chip, series.cadence === c.value && styles.chipActive]}
                  onPress={() => handleSchedule({ cadence: c.value })}
                  disabled={busy}
                >
                  <Text
                    style={[
                      styles.chipText,
                      series.cadence === c.value && styles.chipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.cardTitle}>Bitis</Text>
            <View style={styles.chipRow}>
              {END_OPTIONS.map((opt) => {
                const active = (series.end_after_weeks ?? null) === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleSchedule({ endAfterWeeks: opt.value })}
                    disabled={busy}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {upcoming.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Gelecek</Text>
            {upcoming.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.instanceRow}
                onPress={() => navigation.push('RitualDetail', { ritualId: item.id })}
              >
                <Text style={styles.instanceTitle} numberOfLines={1}>
                  {item.series_week ? `${item.series_week}. hafta` : item.title}
                </Text>
                <Text style={styles.instanceMeta}>
                  {formatInstanceDate(item.start_time)} · {item.status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gecmis Tekrarlar</Text>
          {past.length ? (
            past.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.instanceRow}
                onPress={() => navigation.push('RitualDetail', { ritualId: item.id })}
              >
                <Text style={styles.instanceTitle} numberOfLines={1}>
                  {item.series_week ? `${item.series_week}. hafta` : item.title}
                </Text>
                <Text style={styles.instanceMeta}>
                  {formatInstanceDate(item.start_time)} · {item.status}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.empty}>Henuz gecmis tekrar yok</Text>
          )}
        </View>

        {isHost ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Host Islemleri</Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate('Collaborators', {
                  scope: 'series',
                  scopeId: seriesId,
                  canManage: true,
                })
              }
            >
              <Text style={styles.secondaryText}>Collaborators</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setTransferOpen(true)}>
              <Text style={styles.secondaryText}>Host devret</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, styles.dangerBtn]}
              onPress={handleCancel}
              disabled={busy}
            >
              <Text style={[styles.secondaryText, styles.dangerText]}>Seriyi iptal et</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <PeopleSearchPicker
        visible={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSelect={handleTransfer}
        title="Host devret"
        hint="Gelecek tekrarlar yeni hosta gecer; gecmis arsiv sende kalir."
        confirmLabel="Devret"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  back: { padding: 8, marginRight: 8 },
  backText: { fontSize: 22, color: '#000' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 8 },
  weekCounter: { fontSize: 28, fontWeight: '800', color: '#111' },
  cardSub: { fontSize: 13, color: '#666', marginTop: 4 },
  inactive: { fontSize: 13, color: '#991b1b', fontWeight: '600', marginTop: 6 },
  note: { fontSize: 12, color: '#999', marginTop: 10, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  chipTextActive: { color: '#fff' },
  instanceRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  instanceTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  instanceMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  primaryBtn: {
    backgroundColor: '#111',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  secondaryText: { fontWeight: '700', color: '#111', fontSize: 14 },
  dangerBtn: { backgroundColor: '#fee2e2' },
  dangerText: { color: '#991b1b' },
  empty: { color: '#999', fontSize: 14 },
});
