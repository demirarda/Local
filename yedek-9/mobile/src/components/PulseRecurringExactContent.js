import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SERIF, PULSE } from '../constants/pulseTheme';

const IMG = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=900&q=80';
const imgOf = (r) => r?.image_url || r?.venue_image_url || IMG;
const cleanTitle = (v) => String(v || '').replace(/^\[[^\]]+\]\s*/g, '').trim();
const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const freqOf = (r) => {
  const rule = String(r?.recurrence_rule || '').toLowerCase();
  const days = Array.isArray(r?.repeat_days) ? r.repeat_days.length : 0;
  if (rule.includes('month')) return 'monthly';
  if (rule.includes('day')) return 'daily';
  if (rule.includes('week') && rule.includes('2')) return 'biweekly';
  if (rule.includes('week') || days >= 1) return 'weekly';
  return 'weekly';
};

export default function PulseRecurringExactContent({
  rituals = [],
  city = '',
  navigation,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const [freq, setFreq] = useState('all');
  const open = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const p = isDark
    ? { bg: PULSE.screenDark, card: '#111827', border: '#334155', txt: '#F9FAFB', mute: '#9CA3AF', line: '#2B3549' }
    : { bg: PULSE.screenLight, card: '#fff', border: '#E5E5E5', txt: '#000', mute: '#A3A3A3', line: '#E5E5E5' };

  const buckets = useMemo(() => {
    const out = { daily: [], weekly: [], biweekly: [], monthly: [], live: [] };
    rituals.forEach((r) => {
      const f = freqOf(r);
      out[f].push(r);
      const st = String(r.status || '').toLowerCase();
      const ts = String(r.time_state || '').toLowerCase();
      if (st === 'live' || ts === 'live_now') out.live.push(r);
    });
    return out;
  }, [rituals]);

  const visible =
    freq === 'all' ? rituals : freq === 'live' ? buckets.live : buckets[freq] || [];

  const mine = rituals.slice(0, 4);
  const weeklyPool = buckets.weekly.length ? buckets.weekly : rituals.filter((r) => freqOf(r) !== 'monthly');
  const weekly = (freq === 'all' ? weeklyPool : visible).slice(0, 4);
  const weeklyHero = weekly[0];
  const weeklyCompact = weekly.slice(1, 4);
  const monthly = buckets.monthly.slice(0, 3);

  const Section = ({ title, count, color }) => (
    <View style={styles.sec}>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secTxt, { color: color || p.mute }]}>{title}</Text>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secCount, { color: p.mute, backgroundColor: isDark ? '#1F2937' : '#F5F5F5' }]}>{count}</Text>
    </View>
  );

  return (
    <ScrollView style={[styles.root, { backgroundColor: p.bg }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={[styles.banner, { backgroundColor: p.card, borderColor: p.border }]}>
        <View style={styles.calBg} />
        <Text style={styles.rbLabel}>Seri</Text>
        <View style={styles.rbRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rbTitle, { color: p.txt }]}>Alışkanlık haline{'\n'}gelen buluşmalar.</Text>
            <Text style={[styles.rbSub, { color: p.mute }]}>Her hafta, her ay — aynı yerde, yeni yüzler</Text>
          </View>
          <View style={styles.rbCycle}><Text style={{ fontSize: 24 }}>🔄</Text></View>
        </View>
        <View style={styles.rbStats}>
          <Text style={styles.rbStat}>🔄 {rituals.length} aktif Ritual</Text>
          <Text style={styles.rbStat}>📅 {weekly.length} bu hafta</Text>
          <Text style={styles.rbStat}>✓ {mine.length} kayıtlı</Text>
        </View>
      </View>

      <Text style={[styles.kicker, { color: p.mute }]}>Bu Hafta Seriler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
        {['Pzt', 'Sal', 'Çar', 'Per', 'Bugün', 'Cmt', 'Paz'].map((d, i) => (
          <View key={d} style={styles.dayCol}>
            <Text style={[styles.dayLbl, d === 'Bugün' && styles.dayLblToday]}>{d}</Text>
            <View style={[styles.dayBubble, i % 2 ? styles.bAmber : styles.bNavy]}><Text style={styles.dayTxt}>{i % 2 ? 'Yoga' : 'Kahve'}</Text></View>
            {i % 3 === 0 ? <View style={[styles.dayBubble, styles.bGreen]}><Text style={styles.dayTxt}>Koşu</Text></View> : null}
            {d === 'Bugün' ? <View style={styles.todayDot} /> : null}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.freq, { backgroundColor: p.card, borderColor: p.border }]}>
        {[
          ['all', '🔄', 'Tümü', rituals.length],
          ['daily', '☀️', 'Her Gün', buckets.daily.length],
          ['weekly', '📅', 'Haftalık', buckets.weekly.length],
          ['biweekly', '🗓', '2 Haftada', buckets.biweekly.length],
          ['monthly', '🌙', 'Aylık', buckets.monthly.length],
        ].map(([k, ic, l, c]) => (
          <TouchableOpacity key={k} style={[styles.ffBtn, freq === k && styles.ffOn, { borderRightColor: p.border }]} onPress={() => setFreq(k)}>
            <Text style={styles.ffIc}>{ic}</Text>
            <Text style={[styles.ffLabel, freq === k && styles.ffLabelOn]}>{l}</Text>
            <Text style={[styles.ffCount, freq === k && styles.ffCountOn]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Section title="🔄 KAYITLI OLDUKLARIM" count={mine.length} color="#475569" />
      {mine.map((r, i) => (
        <TouchableOpacity key={`m-${i}`} style={styles.myCard} onPress={() => open(r.id)}>
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.myThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.myFreq}>🔄 {freqOf(r) === 'monthly' ? 'Aylık' : freqOf(r) === 'daily' ? 'Her Gün' : 'Haftalık'}</Text>
            <Text style={[styles.myName, { color: p.txt }]} numberOfLines={1}>{cleanTitle(r.title)}</Text>
            <Text style={[styles.mySub, { color: p.mute }]}>{r.venue_name || city} · {hhmm(r.start_time)}</Text>
            <View style={styles.streakRow}>
              <View style={[styles.streakDot, styles.streakOn]} />
              <View style={[styles.streakDot, styles.streakOn]} />
              <View style={[styles.streakDot, styles.streakOn]} />
              <View style={[styles.streakDot, styles.streakToday]} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={styles.myStreakNum}>{4 + i}</Text>
            <Text style={styles.myPill}>Kayıtlı</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Section title="📅 HAFTALIK · KESFET" count={weekly.length} />
      {weeklyHero ? (
        <TouchableOpacity style={[styles.recCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(weeklyHero.id)}>
          <ImageBackground source={{ uri: imgOf(weeklyHero) }} style={styles.hero}>
            <LinearGradient colors={['rgba(0,0,0,.06)', 'rgba(0,0,0,.88)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroTop}>
              <Text style={styles.freqBadge}>🔄 Haftalık</Text>
              <Text style={styles.nextChip}>⏱ {hhmm(weeklyHero.start_time)}</Text>
            </View>
            <View style={styles.heroBot}>
              <Text style={styles.heroName}>{cleanTitle(weeklyHero.title)}</Text>
              <Text style={styles.heroVenue}>📍 {weeklyHero.venue_name || city}</Text>
            </View>
          </ImageBackground>
          <View style={styles.recBody}>
            <View style={styles.streakCard}>
              <Text style={styles.streakLabel}>Bu Ritualde ortalama katılım</Text>
              <Text style={styles.streakSub}>Son 8 haftada stabil devam ediyor</Text>
            </View>
            <Text style={styles.joinBtn}>Katıl</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {weeklyCompact.map((r, i) => (
        <TouchableOpacity key={`wc-${i}`} style={[styles.compactWeekly, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={styles.compWeeklyAccent} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.compThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.compWeeklyFreq}>🔄 Her Hafta</Text>
            <Text style={[styles.compName, { color: p.txt }]} numberOfLines={1}>{cleanTitle(r.title)}</Text>
            <Text style={[styles.compSub, { color: p.mute }]}>{r.venue_name || city} · {hhmm(r.start_time)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.compNext}>Yarın</Text>
            <Text style={styles.compBtnSlate}>Katıl</Text>
          </View>
        </TouchableOpacity>
      ))}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {weekly.slice(0, 3).map((r, i) => (
          <TouchableOpacity key={`h-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hTop}><Text style={styles.hBadge}>🔄 Haftalık</Text></View>
              <View style={styles.hBot}>
                <Text style={styles.hName}>{cleanTitle(r.title)}</Text>
                <Text style={styles.hVenue}>{r.venue_name || city}</Text>
              </View>
            </ImageBackground>
            <View style={styles.hBody}>
              <Text style={styles.hNext}>Bugün</Text>
              <Text style={styles.hBtn}>Katıl</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Section title="🌙 AYLIK" count={monthly.length} color="#92400E" />
      {monthly.map((r, i) => (
        <TouchableOpacity key={`mo-${i}`} style={[styles.compact, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={[styles.compAccent, { backgroundColor: '#C8A96A' }]} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.compThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.compFreq}>🌙 Aylık</Text>
            <Text style={[styles.compName, { color: p.txt }]} numberOfLines={1}>{cleanTitle(r.title)}</Text>
            <Text style={[styles.compSub, { color: p.mute }]}>{r.venue_name || city}</Text>
          </View>
          <Text style={styles.compBtn}>{String(r.status || '').toLowerCase() === 'ended' ? 'Sona Erdi' : 'Katıl'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
  calBg: { position: 'absolute', right: 0, top: 0, width: 120, height: '100%', backgroundColor: 'rgba(71,85,105,.06)' },
  rbLabel: { fontSize: 9, fontWeight: '700', color: '#A3A3A3', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 7 },
  rbRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  rbTitle: { fontFamily: FONT_SERIF, fontSize: 22, lineHeight: 26, color: '#000', letterSpacing: -0.3 },
  rbSub: { fontSize: 11, color: '#A3A3A3', marginTop: 3 },
  rbCycle: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#1B2E4A', alignItems: 'center', justifyContent: 'center', shadowColor: '#1B2E4A', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  rbStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rbStat: { backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontSize: 10, color: '#525252', fontWeight: '600' },

  kicker: { paddingHorizontal: 18, paddingBottom: 8, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  weekRow: { paddingHorizontal: 16, gap: 4, paddingBottom: 14 },
  dayCol: { alignItems: 'center', gap: 3 },
  dayLbl: { fontSize: 8, fontWeight: '700', color: '#A3A3A3' },
  dayLblToday: { color: '#475569' },
  dayBubble: { width: 30, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  bNavy: { backgroundColor: '#E8EDF4' },
  bAmber: { backgroundColor: '#FEF3C7' },
  bGreen: { backgroundColor: '#EAF3DE' },
  dayTxt: { fontSize: 8, fontWeight: '700', color: '#475569' },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#475569' },

  freq: { marginHorizontal: 16, marginBottom: 14, borderRadius: 12, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  ffBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 9, paddingBottom: 8, borderRightWidth: 1 },
  ffOn: { backgroundColor: '#475569' },
  ffIc: { fontSize: 12, marginBottom: 2 },
  ffLabel: { fontSize: 9, fontWeight: '700', color: '#737373' },
  ffLabelOn: { color: '#fff' },
  ffCount: { fontSize: 8, color: '#A3A3A3' },
  ffCountOn: { color: 'rgba(255,255,255,.7)' },

  sec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginBottom: 6, marginTop: 4 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  secTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, color: '#A3A3A3' },
  secCount: { fontSize: 9, fontWeight: '600', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },

  myCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(71,85,105,.18)', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  myThumb: { width: 42, height: 42, borderRadius: 10, overflow: 'hidden' },
  myFreq: { fontSize: 9, fontWeight: '700', color: '#475569', marginBottom: 1 },
  myName: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  mySub: { fontSize: 10 },
  myStreakNum: { fontFamily: FONT_SERIF, fontSize: 22, color: '#475569', lineHeight: 22 },
  streakRow: { marginTop: 6, flexDirection: 'row', gap: 3 },
  streakDot: { width: 14, height: 6, borderRadius: 3, backgroundColor: '#D4D4D4' },
  streakOn: { backgroundColor: '#475569' },
  streakToday: { backgroundColor: '#1B2E4A' },
  myPill: { fontSize: 10, fontWeight: '700', color: '#475569', backgroundColor: '#E8EDF4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },

  recCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  hero: { height: 148, justifyContent: 'space-between' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  freqBadge: { backgroundColor: 'rgba(71,85,105,.85)', color: '#fff', fontSize: 9, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  nextChip: { backgroundColor: 'rgba(0,0,0,.5)', borderColor: 'rgba(255,255,255,.18)', borderWidth: 1, color: 'rgba(255,255,255,.85)', fontSize: 9, fontWeight: '600', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  heroBot: { paddingHorizontal: 13, paddingBottom: 9 },
  heroName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 17, lineHeight: 21, letterSpacing: -0.2 },
  heroVenue: { color: 'rgba(255,255,255,.55)', fontSize: 10 },
  recBody: { paddingHorizontal: 13, paddingVertical: 10, alignItems: 'flex-end' },
  streakCard: { alignSelf: 'stretch', backgroundColor: '#F1F5F9', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, marginBottom: 8 },
  streakLabel: { fontSize: 9, fontWeight: '700', color: '#475569' },
  streakSub: { fontSize: 8, color: '#A3A3A3', marginTop: 1 },
  joinBtn: { backgroundColor: '#475569', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: '700', paddingHorizontal: 15, paddingVertical: 9 },

  compactWeekly: { marginHorizontal: 16, marginBottom: 6, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  compWeeklyAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#475569' },
  compWeeklyFreq: { fontSize: 9, fontWeight: '600', color: '#475569', marginBottom: 2 },
  compNext: { fontSize: 9, fontWeight: '700', color: '#D97706' },
  compBtnSlate: { backgroundColor: '#475569', color: '#fff', borderRadius: 8, fontSize: 10, fontWeight: '700', paddingHorizontal: 13, paddingVertical: 6 },

  hRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  hCard: { width: 155, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  hImg: { height: 84, justifyContent: 'space-between' },
  hTop: { paddingHorizontal: 7, paddingTop: 6 },
  hBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(71,85,105,.85)', color: '#fff', fontSize: 7, fontWeight: '700', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  hBot: { paddingHorizontal: 7, paddingBottom: 6 },
  hName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 12, lineHeight: 14 },
  hVenue: { color: 'rgba(255,255,255,.55)', fontSize: 8 },
  hBody: { paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hNext: { fontSize: 9, fontWeight: '700', color: '#475569' },
  hBtn: { backgroundColor: '#475569', color: '#fff', borderRadius: 7, fontSize: 9, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4 },

  compact: { marginHorizontal: 16, marginBottom: 6, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  compAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  compThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  compFreq: { fontSize: 9, fontWeight: '600', color: '#92400E', marginBottom: 2 },
  compName: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  compSub: { fontSize: 10 },
  compBtn: { backgroundColor: '#C8A96A', color: '#000', borderRadius: 8, fontSize: 10, fontWeight: '700', paddingHorizontal: 13, paddingVertical: 6 },
});
