import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SERIF, PULSE } from '../constants/pulseTheme';

const IMG = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=900&q=80';
const imgOf = (r) => r?.image_url || r?.venue_image_url || IMG;
const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PulseFreeEntryExactContent({
  filteredRituals = [],
  city = '',
  navigation,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const [sub, setSub] = useState('all');
  const open = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const now = Date.now();

  const live = useMemo(
    () =>
      filteredRituals.filter((r) => {
        const st = String(r.status || '').toLowerCase();
        const ts = String(r.time_state || '').toLowerCase();
        return st === 'live' || ts === 'live_now';
      }),
    [filteredRituals]
  );
  const soon = useMemo(
    () =>
      filteredRituals.filter((r) => {
        const t = new Date(r.start_time || now).getTime();
        const diff = Math.floor((t - now) / 60000);
        return diff >= 0 && diff <= 180;
      }),
    [filteredRituals, now]
  );
  const today = useMemo(
    () =>
      filteredRituals.filter((r) => {
        const d = new Date(r.start_time || now);
        const n0 = new Date(now);
        return d.toDateString() === n0.toDateString();
      }),
    [filteredRituals, now]
  );
  const week = filteredRituals;

  const pool = sub === 'live' ? live : sub === 'soon' ? soon : sub === 'today' ? today : sub === 'week' ? week : filteredRituals;
  const heroLive = live[0];
  const heroSoon = soon[0];
  const heroWeek = week.find((r) => !live.includes(r) && !soon.includes(r)) || week[0];
  const late = week.filter((r) => {
    const h = new Date(r.start_time || now).getHours();
    return h >= 22 || h < 2;
  });

  const p = isDark
    ? { bg: PULSE.screenDark, card: '#111827', border: '#273246', line: '#2B3549', txt: '#F9FAFB', mute: '#9CA3AF' }
    : { bg: PULSE.screenLight, card: '#fff', border: '#E5E5E5', line: '#E5E5E5', txt: '#000', mute: '#A3A3A3' };

  const SectionHead = ({ title, count, color }) => (
    <View style={styles.sec}>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secTxt, { color: color || p.mute }]}>{title}</Text>
      <View style={[styles.line, { backgroundColor: p.line }]} />
      <Text style={[styles.secCount, { color: p.mute, backgroundColor: isDark ? '#1F2937' : '#F5F5F5' }]}>{count}</Text>
    </View>
  );

  const HeroCard = ({ r, liveCard = false, weekCard = false }) =>
    r ? (
      <TouchableOpacity style={[styles.card, { backgroundColor: p.card, borderColor: p.border }, liveCard && styles.cardLive, !liveCard && styles.cardFree, weekCard && styles.cardPivot]} onPress={() => open(r.id)}>
        <ImageBackground source={{ uri: imgOf(r) }} style={styles.hero}>
          <LinearGradient colors={['rgba(0,0,0,.06)', 'rgba(0,0,0,.88)']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.topRow}>
            <View style={styles.topBadges}>
              {liveCard ? <Text style={styles.bLive}>● CANLI</Text> : null}
              {weekCard ? <Text style={styles.bGold}>★ Pivot Host</Text> : null}
              <Text style={styles.bFree}>🆓 Ücretsiz</Text>
            </View>
            <Text style={styles.bChip}>{liveCard ? `${n(r.current_attendees, 0)} / ${n(r.capacity, 12)}` : `⏱ ${hhmm(r.start_time)}`}</Text>
          </View>
          <View style={styles.bot}>
            <Text style={styles.name}>{r.title || 'Ücretsiz Ritual'}</Text>
            <Text style={styles.venue}>📍 {r.venue_name || city}</Text>
          </View>
        </ImageBackground>
        <View style={[styles.body, { borderTopColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          <View style={styles.occRow}>
            <View style={styles.occBg}>
              <View style={[styles.occFill, { width: `${Math.min(100, Math.round((n(r.current_attendees, 0) / Math.max(1, n(r.capacity, 12))) * 100))}%`, backgroundColor: liveCard ? '#D97706' : '#16A34A' }]} />
            </View>
            <Text style={[styles.occLbl, { color: liveCard ? '#D97706' : '#16A34A' }]}>{Math.max(0, n(r.capacity, 12) - n(r.current_attendees, 0))} yer</Text>
          </View>
          <View style={styles.cardRow}>
            <View style={styles.tags}>
              <Text style={styles.tagFree}>🆓 Ücretsiz</Text>
              {r.is_pivot_host ? <Text style={styles.tagDark}>★ Pivot</Text> : null}
              {liveCard ? <Text style={styles.tagLive}>● Canlı</Text> : null}
            </View>
            <Text style={liveCard ? styles.btnRed : styles.btnGreen}>Katıl →</Text>
          </View>
        </View>
        <View style={[styles.footer, { borderTopColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
          <Text style={[styles.footerText, isDark && styles.footerTextDark]}>Check-in yeterli · Bilet gerekmez</Text>
        </View>
      </TouchableOpacity>
    ) : null;

  return (
    <ScrollView style={[styles.root, { backgroundColor: p.bg }]} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.banner}>
        <LinearGradient colors={['#052e16', '#166534']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.bannerBody}>
          <Text style={styles.fbLabel}>🆓 Ucretsiz Giris · Bugun & Bu Hafta</Text>
          <View style={styles.fbRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fbTitle}>Ucret yok,{'\n'}kural basit.</Text>
              <Text style={styles.fbSub}>Bilet yok · Ucret yok · Check-in yeterli · {filteredRituals.length} Ritual</Text>
            </View>
            <View style={styles.bigBadge}>
              <Text style={styles.bigBadgeIcon}>🆓</Text>
              <Text style={styles.bigBadgeText}>Ucretsiz</Text>
            </View>
          </View>
          <View style={styles.fbStats}>
            <Text style={styles.fbStat}>● {live.length} su an canli</Text>
            <Text style={styles.fbStat}>⏱ {soon.length} baslamak uzere</Text>
            <Text style={styles.fbStat}>📍 {Math.min(6, filteredRituals.length)} yurume mesafesi</Text>
            <Text style={styles.fbStat}>👥 {Math.min(4, filteredRituals.length)} arkadasin bir yerde</Text>
          </View>
        </View>
      </View>

      <View style={[styles.rs0Card, isDark && styles.rs0CardDark]}>
        <View style={[styles.rs0Icon, isDark && styles.rs0IconDark]}><Text style={styles.rs0IconTxt}>🆓</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rs0Label, isDark && styles.rs0LabelDark]}>ACIK GIRIS</Text>
          <Text style={[styles.rs0Title, isDark && styles.rs0TitleDark]}>Herkese acik baslangic alanlari</Text>
          <Text style={[styles.rs0Sub, isDark && styles.rs0SubDark]}>Topluluga yeni katilanlar icin hizli uyum noktasi.</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.rs0Num, isDark && styles.rs0NumDark]}>{pool.length}</Text>
          <Text style={[styles.rs0NumLbl, isDark && styles.rs0NumLblDark]}>Ritual</Text>
        </View>
      </View>

      <View style={[styles.subFilter, { backgroundColor: p.card, borderColor: p.border }]}>
        {[
          ['all', 'Tümü', filteredRituals.length],
          ['live', '● Canlı', live.length],
          ['soon', '⏱ Yakında', soon.length],
          ['today', 'Bugün', today.length],
          ['week', 'Bu Hafta', week.length],
        ].map(([k, label, c]) => (
          <TouchableOpacity
            key={k}
            style={[
              styles.sfBtn,
              isDark && styles.sfBtnDark,
              sub === k && styles.sfBtnOn,
              { borderRightColor: p.border },
            ]}
            onPress={() => setSub(k)}
          >
            <Text style={[styles.sfText, isDark && styles.sfTextDark, sub === k && styles.sfTextOn]}>{label}</Text>
            <Text style={[styles.sfCount, isDark && styles.sfCountDark, sub === k && styles.sfCountOn]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionHead title="● SU AN CANLI · UCRETSIZ" count={live.length} color="#DC2626" />
      <HeroCard r={heroLive} liveCard />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {live.slice(1, 5).map((r, i) => (
          <TouchableOpacity key={`live-h-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hBot}>
                <Text style={styles.hName}>{r.title}</Text>
                <Text style={styles.hVenue}>{r.venue_name || city}</Text>
              </View>
            </ImageBackground>
            <View style={styles.hBody}><Text style={styles.hBtn}>Katıl</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionHead title="⏱ BASLAMAK UZERE · UCRETSIZ" count={soon.length} color="#D97706" />
      <HeroCard r={heroSoon} />
      {soon.slice(1, 4).map((r, i) => (
        <TouchableOpacity key={`soon-c-${i}`} style={[styles.compact, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={styles.compactAccent} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.cThumb} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cTime, { color: p.mute }]}>🆓 Ücretsiz · {hhmm(r.start_time)}</Text>
            <Text style={[styles.cName, { color: p.txt }]} numberOfLines={1}>{r.title}</Text>
          </View>
          <Text style={styles.cBtn}>Katıl</Text>
        </TouchableOpacity>
      ))}

      <SectionHead title="BU AKSAM GEC · UCRETSIZ" count={late.length} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {late.slice(0, 4).map((r, i) => (
          <TouchableOpacity key={`late-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hBot}>
                <Text style={styles.hName}>{r.title}</Text>
                <Text style={styles.hVenue}>{hhmm(r.start_time)}</Text>
              </View>
            </ImageBackground>
            <View style={styles.hBody}><Text style={styles.hBtn}>Katıl</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionHead title="BU HAFTA · UCRETSIZ" count={pool.length} />
      <HeroCard r={heroWeek} weekCard />

      <View style={[styles.explainer, { backgroundColor: p.card, borderColor: p.border }]}>
        <View style={styles.expHead}>
          <Text style={styles.expIcon}>ℹ️</Text>
          <View>
            <Text style={styles.expTitle}>Ucretsiz Giris Nedir?</Text>
            <Text style={styles.expSub}>Hangi Rituals bu filtrede gorunur?</Text>
          </View>
        </View>
        <View style={styles.expBody}>
          <Text style={[styles.expRow, { color: p.mute }]}>Bilet gerektirmez: Ucret ve on odeme yok, check-in yeterli.</Text>
          <Text style={[styles.expRow, { color: p.mute }]}>Host katilim kosulu ayri belirleyebilir; ucretsiz giris her zaman garanti degildir.</Text>
          <Text style={[styles.expRow, { color: p.mute }]}>Acik hava dahil: park/sahil/meydan etkinlikleri de dahildir.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden' },
  bannerBody: { padding: 16 },
  fbLabel: { color: 'rgba(255,255,255,.45)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 7 },
  fbRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  fbTitle: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 24, lineHeight: 28 },
  fbSub: { color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 3 },
  bigBadge: { backgroundColor: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  bigBadgeIcon: { fontSize: 22, marginBottom: 3 },
  bigBadgeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,.7)' },
  fbStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fbStat: { backgroundColor: 'rgba(255,255,255,.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,.15)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, color: 'rgba(255,255,255,.75)', fontSize: 10, fontWeight: '600' },

  subFilter: { marginHorizontal: 16, marginBottom: 14, borderRadius: 12, borderWidth: 1, overflow: 'hidden', flexDirection: 'row' },
  sfBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRightWidth: 1 },
  sfBtnDark: { backgroundColor: '#0F172A' },
  sfBtnOn: { backgroundColor: '#16A34A' },
  sfText: { fontSize: 10, color: '#737373', fontWeight: '600' },
  sfTextDark: { color: '#CBD5E1' },
  sfTextOn: { color: '#fff' },
  sfCount: { fontSize: 8, color: '#A3A3A3', fontWeight: '700', marginTop: 1 },
  sfCountDark: { color: '#94A3B8' },
  sfCountOn: { color: 'rgba(255,255,255,.6)' },
  rs0Card: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(22,163,74,.2)', backgroundColor: '#EAF3DE', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rs0CardDark: { backgroundColor: '#0E2A1A', borderColor: 'rgba(34,197,94,.32)' },
  rs0Icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  rs0IconDark: { backgroundColor: '#15803D' },
  rs0IconTxt: { fontSize: 22 },
  rs0Label: { fontSize: 9, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  rs0LabelDark: { color: '#86EFAC' },
  rs0Title: { fontFamily: FONT_SERIF, fontSize: 16, color: '#000', marginBottom: 3 },
  rs0TitleDark: { color: '#F0FDF4' },
  rs0Sub: { fontSize: 10, color: '#737373', lineHeight: 15 },
  rs0SubDark: { color: '#BBF7D0' },
  rs0Num: { fontFamily: FONT_SERIF, fontSize: 28, color: '#16A34A', lineHeight: 28 },
  rs0NumDark: { color: '#86EFAC' },
  rs0NumLbl: { fontSize: 8, color: '#A3A3A3', fontWeight: '600' },
  rs0NumLblDark: { color: '#DCFCE7' },

  sec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginBottom: 6, marginTop: 3 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  secTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, color: '#A3A3A3' },
  secCount: { fontSize: 9, fontWeight: '600', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },

  card: { marginHorizontal: 16, marginBottom: 9, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardLive: { borderColor: 'rgba(220,38,38,.2)' },
  cardFree: { borderColor: 'rgba(22,163,74,.2)' },
  cardPivot: { borderColor: 'rgba(200,169,106,.3)' },
  hero: { height: 152, justifyContent: 'space-between' },
  topRow: { paddingTop: 10, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  topBadges: { flexDirection: 'row', gap: 5 },
  bLive: { backgroundColor: '#DC2626', color: '#fff', fontSize: 8, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  bFree: { backgroundColor: 'rgba(22,163,74,.92)', color: '#fff', fontSize: 9, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999 },
  bGold: { backgroundColor: 'rgba(200,169,106,.9)', color: '#000', fontSize: 8, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  bChip: { backgroundColor: 'rgba(0,0,0,.5)', borderColor: 'rgba(255,255,255,.18)', borderWidth: 1, color: 'rgba(255,255,255,.8)', fontSize: 9, fontWeight: '600', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  bot: { paddingHorizontal: 13, paddingBottom: 9 },
  name: { color: '#fff', fontSize: 17, lineHeight: 21, fontFamily: FONT_SERIF },
  venue: { color: 'rgba(255,255,255,.55)', fontSize: 10, marginTop: 2 },
  body: { paddingHorizontal: 13, paddingVertical: 10, borderTopWidth: 1 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  occBg: { flex: 1, height: 4, backgroundColor: '#F5F5F5', borderRadius: 2, overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 2 },
  occLbl: { fontSize: 9, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  tags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', flex: 1 },
  tagFree: { fontSize: 8, fontWeight: '600', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#EAF3DE', color: '#14532D', borderWidth: 1, borderColor: 'rgba(22,163,74,.2)' },
  tagDark: { fontSize: 8, fontWeight: '600', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#000', color: '#fff' },
  tagLive: { fontSize: 8, fontWeight: '600', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#FEE2E2', color: '#DC2626' },
  btnRed: { backgroundColor: '#DC2626', color: '#fff', fontSize: 11, fontWeight: '700', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnGreen: { backgroundColor: '#16A34A', color: '#fff', fontSize: 11, fontWeight: '700', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  footer: { marginTop: 6, paddingTop: 7, paddingBottom: 10, borderTopWidth: 1, paddingHorizontal: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 10, color: '#737373', flex: 1 },
  footerTextDark: { color: '#9CA3AF' },
  footerBtns: { flexDirection: 'row', gap: 5, marginLeft: 8 },
  footerReact: { fontSize: 11, backgroundColor: '#F5F5F5', borderColor: '#E5E5E5', borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, color: '#525252' },
  footerReactDark: { backgroundColor: '#1F2937', borderColor: '#334155', color: '#D1D5DB' },
  footerSave: { fontSize: 13, backgroundColor: '#fff', borderColor: '#E5E5E5', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  footerSaveDark: { backgroundColor: '#111827', borderColor: '#334155', color: '#E5E7EB' },

  hRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  hCard: { width: 155, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  hImg: { height: 86, justifyContent: 'flex-end' },
  hBot: { paddingHorizontal: 7, paddingBottom: 6 },
  hName: { color: '#fff', fontSize: 12, fontFamily: FONT_SERIF },
  hVenue: { color: 'rgba(255,255,255,.55)', fontSize: 8 },
  hBody: { paddingHorizontal: 9, paddingVertical: 8, alignItems: 'flex-end' },
  hBtn: { backgroundColor: '#16A34A', color: '#fff', fontSize: 9, fontWeight: '700', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },

  compact: { marginHorizontal: 16, marginBottom: 6, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  compactAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: '#16A34A' },
  cThumb: { width: 44, height: 44, borderRadius: 10, overflow: 'hidden' },
  cTime: { fontSize: 9, marginBottom: 2 },
  cName: { fontSize: 13, fontWeight: '600' },
  cBtn: { backgroundColor: '#16A34A', color: '#fff', fontSize: 10, fontWeight: '700', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 6 },

  explainer: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  expHead: { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  expIcon: { fontSize: 18 },
  expTitle: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 14 },
  expSub: { color: 'rgba(255,255,255,.65)', fontSize: 10 },
  expBody: { paddingHorizontal: 14, paddingVertical: 10 },
  expRow: { fontSize: 10, lineHeight: 16, marginBottom: 6 },
});
