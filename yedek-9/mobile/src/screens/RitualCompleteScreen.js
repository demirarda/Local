import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchRitualDetail } from '../services/api';
import useAuthStore from '../store/authStore';

export default function RitualCompleteScreen({ route, navigation }) {
  const { ritualId, ritual: ritualParam } = route.params || {};
  const { user } = useAuthStore();
  const viewerId = user?.id || null;

  const [ritual, setRitual] = useState(ritualParam || null);
  const [loading, setLoading] = useState(Boolean(ritualId && !ritualParam));
  const [error, setError] = useState(null);
  const [feedbackChoice, setFeedbackChoice] = useState('Y');
  const [windowHours, setWindowHours] = useState(24);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!ritualId || ritualParam) return;
      try {
        setLoading(true);
        setError(null);
        const data = await fetchRitualDetail(ritualId, viewerId);
        if (!isMounted) return;
        setRitual(data);
      } catch (e) {
        if (!isMounted) return;
        setError(e?.message || 'Ritual yuklenemedi.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [ritualId, ritualParam, viewerId]);

  const summary = useMemo(() => {
    const title = ritual?.title || 'Ritual';
    const venue = ritual?.venue_name || ritual?.venue?.name || null;

    const startTime = ritual?.start_time ? new Date(ritual.start_time) : null;
    const timeText = startTime
      ? startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

    return { title, venue, timeText };
  }, [ritual]);
  const rsDeltaPreview = useMemo(() => {
    if (feedbackChoice === 'Y') return '+0.08';
    if (feedbackChoice === 'S') return '+0.01';
    return '-0.06';
  }, [feedbackChoice]);

  const goToPulse = () => {
    // Ana sekmelere don (Pulse ilk sekme).
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const viewRitual = () => {
    if (ritual?.id) {
      navigation.navigate('RitualDetail', { ritualId: ritual.id });
      return;
    }
    if (ritualId) {
      navigation.navigate('RitualDetail', { ritualId });
      return;
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={goToPulse}
            activeOpacity={0.85}
          >
            <MaterialIcons name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ritual</Text>
          <View style={{ width: 42, height: 42 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.heroCard}>
            <LinearGradient
              colors={[COLORS.goldStart, COLORS.goldEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroTop}
            >
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.heroEyebrow}>Ritual tamamlandı</Text>
                  <Text style={styles.heroTitle}>Güzel iş çıkardın.</Text>
                </View>
                <View style={styles.heroIconWrap}>
                  <MaterialIcons name="check-circle" size={28} color="#fff" />
                </View>
              </View>
            </LinearGradient>

            <View style={styles.heroBody}>
              <Text style={styles.heroBodyText}>
                Geri bildirimin alındı. Bu sinyaller, Ritualsi daha güvenli ve kaliteli hale getirmemize
                yardımcı olur.
              </Text>

              <View style={styles.grid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoEyebrow}>ÖZET</Text>
                  {loading ? (
                    <View style={{ paddingTop: 10 }}>
                      <ActivityIndicator color={COLORS.primary} />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.infoTitle} numberOfLines={2}>
                        {summary.title}
                      </Text>
                      <Text style={styles.infoMeta} numberOfLines={2}>
                        {[summary.venue, summary.timeText].filter(Boolean).join(' · ') || '—'}
                      </Text>
                    </>
                  )}
                  {!!error && <Text style={styles.errorText}>{error}</Text>}
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoEyebrow}>SONRAKİ ADIM</Text>
                  <Text style={styles.infoTitle} numberOfLines={2}>
                    Pulse’a dön
                  </Text>
                  <Text style={styles.infoMeta} numberOfLines={2}>
                    Şehir akışında yeni Ritualsi keşfet.
                  </Text>
                </View>
              </View>
              <View style={styles.inlineBlock}>
                <Text style={styles.infoEyebrow}>RT-08 · RS DELTA ONIZLEME</Text>
                <Text style={styles.inlineDelta}>Tahmini RS Degisimi: {rsDeltaPreview}</Text>
                <Text style={styles.inlineLabel}>Window suresi</Text>
                <View style={styles.inlineOptions}>
                  {[12, 24, 48].map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.inlineChip, windowHours === h && styles.inlineChipActive]}
                      onPress={() => setWindowHours(h)}
                    >
                      <Text style={[styles.inlineChipText, windowHours === h && styles.inlineChipTextActive]}>{h}s</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inlineLabel}>Satir ici geri bildirim</Text>
                <View style={styles.inlineOptions}>
                  {[
                    { key: 'Y', label: 'Y' },
                    { key: 'S', label: 'S' },
                    { key: 'K', label: 'K' },
                  ].map((x) => (
                    <TouchableOpacity
                      key={x.key}
                      style={[styles.inlineChip, feedbackChoice === x.key && styles.inlineChipActive]}
                      onPress={() => setFeedbackChoice(x.key)}
                    >
                      <Text style={[styles.inlineChipText, feedbackChoice === x.key && styles.inlineChipTextActive]}>{x.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity activeOpacity={0.9} onPress={goToPulse} style={styles.primaryWrap}>
              <LinearGradient
                colors={[COLORS.goldStart, COLORS.goldEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryLabel}>Pulse’a geri dön</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.9} onPress={viewRitual} style={styles.secondaryBtn}>
              <Text style={styles.secondaryLabel}>Rituali görüntüle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#f6f3ed',
  surface: '#ffffff',
  softSurface: '#fbfaf7',
  softBorder: '#eee8dd',
  text: '#111827',
  muted: '#6b7280',
  primary: '#c59d5f',
  goldStart: '#d4af6d',
  goldEnd: '#b89252',
};

const TOP_PAD = Platform.OS === 'android' ? 8 : 0;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: TOP_PAD,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  heroCard: {
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroTop: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    padding: 18,
  },
  heroBodyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    lineHeight: 18,
  },
  grid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.softSurface,
    borderColor: COLORS.softBorder,
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
  },
  infoEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#9ca3af',
  },
  infoTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    lineHeight: 18,
  },
  infoMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    lineHeight: 16,
  },
  errorText: {
    marginTop: 8,
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
  },
  inlineBlock: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#fff',
  },
  inlineDelta: { marginTop: 8, fontSize: 14, fontWeight: '800', color: COLORS.text },
  inlineLabel: { marginTop: 10, fontSize: 12, fontWeight: '700', color: COLORS.muted },
  inlineOptions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  inlineChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    backgroundColor: COLORS.softSurface,
  },
  inlineChipActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  inlineChipText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  inlineChipTextActive: { color: '#fff' },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  primaryWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  primaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
});

