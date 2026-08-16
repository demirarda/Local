import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SERIF, PULSE } from '../constants/pulseTheme';

const IMG = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&q=80';
const imgOf = (r) => r?.image_url || r?.venue_image_url || IMG;
const clean = (v) => String(v || '').replace(/^\[[^\]]+\]\s*/g, '').trim();
const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const isLive = (r) => {
  const st = String(r?.status || '').toLowerCase();
  const ts = String(r?.time_state || '').toLowerCase();
  return st === 'live' || ts === 'live_now';
};

export default function PulseMorningExactContent({
  rituals = [],
  city = '',
  navigation,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const [timeBand, setTimeBand] = useState('all');
  const p = isDark
    ? { bg: PULSE.screenDark, card: '#111827', border: '#334155', txt: '#F9FAFB', mute: '#9CA3AF', line: '#2B3549', tab: '#1F2937' }
    : { bg: PULSE.screenLight, card: '#fff', border: '#E5E5E5', txt: '#000', mute: '#A3A3A3', line: '#E5E5E5', tab: '#fff' };
  const open = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });

  const filtered = useMemo(() => {
    return rituals.filter((r) => {
      const h = new Date(r.start_time || Date.now()).getHours();
      if (timeBand === 'early') return h >= 6 && h < 8;
      if (timeBand === 'mid') return h >= 8 && h < 10;
      if (timeBand === 'late') return h >= 10 && h < 12;
      return h >= 6 && h < 12;
    });
  }, [rituals, timeBand]);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = (r) => {
    const d = new Date(r.start_time || Date.now());
    return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
  };
  const withinWeek = (r) => {
    const d = new Date(r.start_time || Date.now());
    const diff = d.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  };

  const live = filtered.filter(isLive);
  const tmr = filtered.filter((r) => !isLive(r) && isTomorrow(r));
  const week = filtered.filter((r) => !isLive(r) && !isTomorrow(r) && withinWeek(r));
  const weatherSuggested = filtered.slice(0, 3);

  const Section = ({ title, count, color }) => (
    <View style={styles.sec}>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secTxt, { color: color || p.mute }]}>{title}</Text>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secCount, { color: p.mute, backgroundColor: isDark ? '#1F2937' : '#F5F5F5' }]}>{count}</Text>
    </View>
  );

  const Card = ({ r, tone = 'sky' }) => {
    const tones = {
      sky: { bd: 'rgba(2,132,199,.18)', top: '#0284C7', btnBg: '#0284C7', btnTx: '#fff', occ: '#0284C7' },
      dawn: { bd: 'rgba(245,158,11,.2)', top: '#F59E0B', btnBg: '#1B2E4A', btnTx: '#fff', occ: '#16A34A' },
      live: { bd: 'rgba(220,38,38,.2)', top: '#DC2626', btnBg: '#DC2626', btnTx: '#fff', occ: '#DC2626' },
    }[tone];
    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: p.card, borderColor: tones.bd || p.border }]} onPress={() => open(r.id)}>
        <View style={[styles.cardTopLine, { backgroundColor: tones.top }]} />
        <ImageBackground source={{ uri: imgOf(r) }} style={styles.hero}>
          <LinearGradient colors={['rgba(0,0,0,.06)', 'rgba(0,0,0,.88)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.heroTop}>
            <Text style={[styles.timeBadge, { backgroundColor: tone === 'live' ? '#DC2626' : tone === 'dawn' ? 'rgba(245,158,11,.9)' : 'rgba(2,132,199,.88)', color: tone === 'dawn' ? '#000' : '#fff' }]}>
              {tone === 'live' ? '● CANLI' : `☀️ ${hhmm(r.start_time)} · ${isTomorrow(r) ? 'Yarın' : 'Bu Hafta'}`}
            </Text>
            <Text style={styles.heroChip}>{n(r.current_attendees, 0)} / {n(r.capacity, 10)} kişi</Text>
          </View>
          <View style={styles.heroBot}>
            <Text style={styles.heroName}>{clean(r.title)}</Text>
            <Text style={styles.heroVenue}>📍 {r.venue_name || city}</Text>
          </View>
        </ImageBackground>
        <View style={styles.cardBody}>
          <View style={styles.occRow}>
            <View style={styles.occBg}><View style={[styles.occFill, { width: `${Math.min(100, Math.round((n(r.current_attendees, 0) / Math.max(1, n(r.capacity, 10))) * 100))}%`, backgroundColor: tones.occ }]} /></View>
            <Text style={[styles.occLbl, { color: tones.occ }]}>{Math.max(0, n(r.capacity, 10) - n(r.current_attendees, 0))} yer kaldı</Text>
          </View>
          <View style={styles.cardRow}>
            <View style={styles.tags}>
              <Text style={styles.tag}>🌅 Sabah</Text>
              {r.is_host_verified ? <Text style={[styles.tag, styles.tagBlue]}>✓ Verified Host</Text> : null}
              {r.is_free_entry ? <Text style={[styles.tag, styles.tagGreen]}>Bilet gerekmez</Text> : null}
              {n(r.friends_here, 0) > 0 ? <Text style={[styles.tag, styles.tagFriend]}>👥 {n(r.friends_here, 0)} Arkadaş</Text> : null}
            </View>
            <Text style={[styles.joinBtn, { backgroundColor: tones.btnBg, color: tones.btnTx }]}>Katıl</Text>
          </View>
        </View>
        <View style={[styles.cardFooter, { borderTopColor: isDark ? '#1F2937' : '#F5F5F5' }]}>
          <Text style={[styles.footerTxt, { color: p.mute }]}>{r.is_free_entry ? 'Bilet gerekmez · Herkese açık' : 'Topluluk Rituali · Açık katılım'}</Text>
          <View style={styles.footerRight}>
            <Text style={[styles.reactPill, isDark && styles.reactPillDark]}>⚡ {n(r.reaction_count, 9)}</Text>
            <Text style={[styles.savePill, isDark && styles.savePillDark]}>🔖</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.root, { backgroundColor: p.bg }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.banner}>
        <LinearGradient colors={isDark ? ['#0B1F3A', '#0E7490', '#F59E0B'] : ['#0C4A6E', '#0284C7', '#FCA5A5']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.bannerRays} />
        <View style={styles.sun} />
        <Text style={styles.bannerLabel}>🌅 06:00 — 12:00</Text>
        <View style={styles.bannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Güne nasıl{'\n'}başlamak istersin?</Text>
            <Text style={styles.bannerSub}>Sabah Ritualsi · Yarın & Bu Hafta</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bannerClock}>{tmr[0] ? hhmm(tmr[0].start_time) : '07:30'}</Text>
            <Text style={styles.bannerClockLabel}>YARININ PIKI</Text>
          </View>
        </View>
        <View style={styles.bannerStats}>
          <Text style={styles.bannerStat}>☀️ {filtered.length} sabah Rituali</Text>
          <Text style={styles.bannerStat}>{filtered.filter((r) => r.is_recurring).length} seri</Text>
          <Text style={styles.bannerStat}>👥 {filtered.filter((r) => n(r.friends_here, 0) > 0).length} arkadaş gidiyor</Text>
        </View>
      </View>

      <View style={[styles.weather, { backgroundColor: p.card, borderColor: p.border }]}>
        <LinearGradient colors={['#0284C7', '#38BDF8']} style={styles.weatherTop}>
          <View>
            <Text style={styles.weatherTemp}>17°C</Text>
            <Text style={styles.weatherDesc}>Yarın sabah · Parçalı bulutlu</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.weatherLabel}>SABAH SPORU</Text>
            <Text style={styles.weatherOk}>✓ Uygun hava</Text>
          </View>
        </LinearGradient>
        <View style={styles.weatherBody}>
          <Text style={[styles.weatherBodyLabel, { color: p.mute }]}>Hava durumuna göre öneriler</Text>
          {weatherSuggested.map((r, i) => (
            <TouchableOpacity key={`w-${i}`} style={[styles.weatherRow, { backgroundColor: isDark ? '#0F172A' : '#F0F9FF' }]} onPress={() => open(r.id)}>
              <View>
                <Text style={[styles.weatherName, { color: p.txt }]}>{clean(r.title)}</Text>
                <Text style={[styles.weatherMeta, { color: p.mute }]}>{r.venue_name || city} · {n(r.current_attendees, 0)} kişi</Text>
              </View>
              <Text style={styles.weatherTime}>{hhmm(r.start_time)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.streak, { backgroundColor: isDark ? '#0F172A' : '#fff', borderColor: 'rgba(2,132,199,.2)' }]}>
        <Text style={styles.streakTitle}>Sabahçılık Serisi · Bu hafta {week.length + tmr.length + live.length}</Text>
        <View style={styles.streakDots}>
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d, i) => (
            <View key={d} style={styles.dayCell}>
              <View style={[styles.dayDot, i < Math.min(5, week.length + tmr.length + live.length) && styles.dayDotOn, i === 4 && styles.dayDotToday]} />
              <Text style={[styles.dayLbl, i === 4 && styles.dayLblToday]}>{d}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.timeFilter, { backgroundColor: p.tab, borderColor: p.border }]}>
        {[
          ['all', '🌅', 'Tümü', '06–12'],
          ['early', '🌄', 'Erken', '06–08'],
          ['mid', '☀️', 'Sabah', '08–10'],
          ['late', '🍳', 'Geç', '10–12'],
        ].map(([k, ic, l, rg]) => (
          <TouchableOpacity key={k} style={[styles.tfBtn, timeBand === k && styles.tfOn, { borderRightColor: p.border }]} onPress={() => setTimeBand(k)}>
            <Text style={styles.tfIc}>{ic}</Text>
            <Text style={[styles.tfLabel, timeBand === k && styles.tfLabelOn]}>{l}</Text>
            <Text style={[styles.tfRange, timeBand === k && styles.tfRangeOn]}>{rg}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Section title="● ŞU AN CANLI · SABAH" count={live.length} color="#DC2626" />
      {live.slice(0, 1).map((r, i) => <Card key={`l-${i}`} r={r} tone="live" />)}

      <Section title="☀️ YARIN SABAH" count={tmr.length} color="#0284C7" />
      {tmr.slice(0, 1).map((r, i) => <Card key={`t-${i}`} r={r} tone="sky" />)}
      {tmr.slice(1, 3).map((r, i) => (
        <TouchableOpacity key={`tc-${i}`} style={[styles.compact, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={styles.compAccent} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.compThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.compTime}>☀️ {hhmm(r.start_time)} · Yarın</Text>
            <Text style={[styles.compName, { color: p.txt }]} numberOfLines={1}>{clean(r.title)}</Text>
            <View style={styles.compMetaRow}>
              <Text style={[styles.compMeta, { color: p.mute }]} numberOfLines={1}>{r.venue_name || city}</Text>
              <View style={[styles.compMetaDot, { backgroundColor: isDark ? '#475569' : '#D4D4D4' }]} />
              <Text style={[styles.compMeta, { color: p.mute }]}>🔄 Haftalık</Text>
            </View>
          </View>
          <Text style={styles.compBtn}>Katıl</Text>
        </TouchableOpacity>
      ))}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {tmr.slice(3, 6).map((r, i) => (
          <TouchableOpacity key={`th-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.04)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hTop}><Text style={styles.hBadge}>☀️ {hhmm(r.start_time)}</Text></View>
              <View style={styles.hBot}><Text style={styles.hName}>{clean(r.title)}</Text><Text style={styles.hVenue}>{r.venue_name || city}</Text></View>
            </ImageBackground>
            <View style={styles.hBody}><Text style={styles.hBtn}>Katıl</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Section title="BU HAFTA SABAH RITÜELLERI" count={week.length} />
      {week.slice(0, 1).map((r, i) => <Card key={`w-${i}`} r={r} tone="dawn" />)}
      {week.slice(1, 4).map((r, i) => (
        <TouchableOpacity key={`wc-${i}`} style={[styles.compact, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={[styles.compAccent, { backgroundColor: i % 2 ? '#16A34A' : '#F59E0B' }]} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.compThumb} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.compTime, { color: i % 2 ? '#16A34A' : '#D97706' }]}>🌅 {hhmm(r.start_time)} · Bu Hafta</Text>
            <Text style={[styles.compName, { color: p.txt }]} numberOfLines={1}>{clean(r.title)}</Text>
            <View style={styles.compMetaRow}>
              <Text style={[styles.compMeta, { color: p.mute }]} numberOfLines={1}>{r.venue_name || city}</Text>
              {(r.friends_here || 0) > 0 ? (
                <>
                  <View style={[styles.compMetaDot, { backgroundColor: isDark ? '#475569' : '#D4D4D4' }]} />
                  <Text style={[styles.compMeta, { color: p.mute }]}>{r.friends_here} arkadas</Text>
                </>
              ) : null}
            </View>
          </View>
          <Text style={[styles.compBtn, { backgroundColor: i % 2 ? '#16A34A' : '#1B2E4A' }]}>Katıl</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden', minHeight: 150, padding: 16 },
  bannerRays: { ...StyleSheet.absoluteFillObject, top: '48%', backgroundColor: 'rgba(255,255,255,.02)' },
  sun: { position: 'absolute', bottom: -20, left: '50%', marginLeft: -32, width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(253,230,138,.6)' },
  bannerLabel: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.25)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 9 },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  bannerTitle: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  bannerSub: { color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 3 },
  bannerClock: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 32, lineHeight: 31 },
  bannerClockLabel: { color: 'rgba(255,255,255,.45)', fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  bannerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bannerStat: { backgroundColor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontSize: 10, color: 'rgba(255,255,255,.85)', fontWeight: '600' },

  weather: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  weatherTop: { paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', justifyContent: 'space-between' },
  weatherTemp: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 22 },
  weatherDesc: { color: 'rgba(255,255,255,.7)', fontSize: 10 },
  weatherLabel: { color: 'rgba(255,255,255,.6)', fontSize: 9, fontWeight: '700', marginBottom: 3 },
  weatherOk: { color: '#fff', fontSize: 11, fontWeight: '700' },
  weatherBody: { paddingHorizontal: 14, paddingVertical: 9 },
  weatherBodyLabel: { fontSize: 9, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  weatherRow: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  weatherName: { fontSize: 11, fontWeight: '600' },
  weatherMeta: { fontSize: 9, marginTop: 1 },
  weatherTime: { fontSize: 10, fontWeight: '700', color: '#0284C7' },

  streak: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1.5, padding: 12 },
  streakTitle: { color: '#0284C7', fontSize: 11, fontWeight: '700', marginBottom: 9 },
  streakDots: { flexDirection: 'row', gap: 4 },
  dayCell: { alignItems: 'center', flex: 1 },
  dayDot: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#D4D4D4', marginBottom: 3 },
  dayDotOn: { backgroundColor: '#0284C7' },
  dayDotToday: { backgroundColor: '#1B2E4A' },
  dayLbl: { fontSize: 7, fontWeight: '700', color: '#A3A3A3' },
  dayLblToday: { color: '#1B2E4A' },

  timeFilter: { marginHorizontal: 16, marginBottom: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  tfBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 9, paddingBottom: 9, borderRightWidth: 1 },
  tfOn: { backgroundColor: '#0284C7' },
  tfIc: { fontSize: 12, marginBottom: 2 },
  tfLabel: { fontSize: 9, fontWeight: '700', color: '#737373', letterSpacing: 0.2 },
  tfLabelOn: { color: '#fff' },
  tfRange: { fontSize: 8, color: '#A3A3A3' },
  tfRangeOn: { color: 'rgba(255,255,255,.7)' },

  sec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginBottom: 6, marginTop: 4 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  secTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, color: '#A3A3A3', textTransform: 'uppercase' },
  secCount: { fontSize: 9, fontWeight: '600', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },

  card: { marginHorizontal: 16, marginBottom: 9, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardTopLine: { height: 2 },
  hero: { height: 152, justifyContent: 'space-between' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  timeBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 9, fontWeight: '700' },
  heroChip: { backgroundColor: 'rgba(0,0,0,.5)', borderColor: 'rgba(255,255,255,.18)', borderWidth: 1, color: 'rgba(255,255,255,.8)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 9, fontWeight: '600' },
  heroBot: { paddingHorizontal: 13, paddingBottom: 9 },
  heroName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 17 },
  heroVenue: { color: 'rgba(255,255,255,.55)', fontSize: 10 },
  cardBody: { paddingHorizontal: 13, paddingVertical: 10 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  occBg: { flex: 1, height: 4, borderRadius: 3, backgroundColor: '#F5F5F5', overflow: 'hidden' },
  occFill: { height: '100%' },
  occLbl: { fontSize: 10, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  tag: { fontSize: 8, fontWeight: '600', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F0F9FF', color: '#0369A1' },
  tagBlue: { backgroundColor: '#E8EDF4', color: '#1B2E4A' },
  tagGreen: { backgroundColor: '#EAF3DE', color: '#16A34A' },
  tagFriend: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  joinBtn: { borderRadius: 11, fontSize: 11, fontWeight: '700', paddingHorizontal: 15, paddingVertical: 8 },
  cardFooter: { borderTopWidth: 1, paddingHorizontal: 13, paddingTop: 7, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerTxt: { fontSize: 10, flex: 1 },
  footerRight: { flexDirection: 'row', gap: 5, marginLeft: 7 },
  reactPill: { fontSize: 11, borderRadius: 7, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#F5F5F5', color: '#525252', paddingHorizontal: 8, paddingVertical: 3 },
  reactPillDark: { borderColor: '#334155', backgroundColor: '#1F2937', color: '#E5E7EB' },
  savePill: { fontSize: 13, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3 },
  savePillDark: { borderColor: '#334155', backgroundColor: '#111827', color: '#E5E7EB' },

  compact: { marginHorizontal: 16, marginBottom: 6, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  compAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#0284C7' },
  compThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  compTime: { fontSize: 10, fontWeight: '700', color: '#0284C7', marginBottom: 2 },
  compName: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  compMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  compMetaDot: { width: 3, height: 3, borderRadius: 2 },
  compMeta: { fontSize: 10, lineHeight: 13 },
  compBtn: { borderRadius: 9, fontSize: 10, fontWeight: '700', color: '#fff', backgroundColor: '#0284C7', paddingHorizontal: 13, paddingVertical: 6 },

  hRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  hCard: { width: 152, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  hImg: { height: 84, justifyContent: 'space-between' },
  hTop: { paddingHorizontal: 7, paddingTop: 6 },
  hBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontSize: 7, fontWeight: '700', color: '#fff', backgroundColor: 'rgba(2,132,199,.88)' },
  hBot: { paddingHorizontal: 7, paddingBottom: 6 },
  hName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 12 },
  hVenue: { color: 'rgba(255,255,255,.55)', fontSize: 8 },
  hBody: { paddingHorizontal: 9, paddingVertical: 8, alignItems: 'flex-end' },
  hBtn: { backgroundColor: '#0284C7', color: '#fff', borderRadius: 7, fontSize: 9, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4 },
});
