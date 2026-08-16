import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SERIF, PULSE } from '../constants/pulseTheme';

const IMG = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=900&q=80';
const imgOf = (r) => r?.image_url || r?.venue_image_url || IMG;
const clean = (v) => String(v || '').replace(/^\[[^\]]+\]\s*/g, '').trim();
const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const daysAgo = (v) => {
  const t = new Date(v || Date.now()).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

export default function PulseLocalNewExactContent({
  rituals = [],
  city = '',
  navigation,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const [cat, setCat] = useState('all');
  const open = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const p = isDark
    ? { bg: PULSE.screenDark, card: '#111827', border: '#334155', txt: '#F9FAFB', mute: '#9CA3AF', line: '#2B3549' }
    : { bg: PULSE.screenLight, card: '#fff', border: 'rgba(234,88,12,.22)', txt: '#000', mute: '#A3A3A3', line: '#E5E5E5' };

  const hosts = useMemo(() => {
    const map = new Map();
    rituals.forEach((r) => {
      const k = String(r.host_id || r.host_name || 'host');
      const prev = map.get(k) || { host_name: r.host_name || 'Yeni Host', rituals: [] };
      prev.rituals.push(r);
      map.set(k, prev);
    });
    return Array.from(map.values()).slice(0, 3);
  }, [rituals]);

  const venues = useMemo(() => {
    const map = new Map();
    rituals.forEach((r) => {
      const k = String(r.venue_id || r.venue_name || 'venue');
      const prev = map.get(k) || { ...r, count: 0 };
      prev.count += 1;
      map.set(k, prev);
    });
    return Array.from(map.values()).slice(0, 2);
  }, [rituals]);

  const live = rituals.filter((r) => String(r.status || '').toLowerCase() === 'live' || String(r.time_state || '').toLowerCase() === 'live_now');
  const newRituals = rituals;
  const list =
    cat === 'ritual'
      ? newRituals
      : cat === 'host'
      ? hosts.flatMap((h) => h.rituals.slice(0, 1))
      : cat === 'venue'
      ? venues
      : newRituals;

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
      <View style={styles.banner}>
        <LinearGradient colors={['#431407', '#EA580C']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.nbGlow} />
        <Text style={styles.nbLabel}>🆕 LOCAL'de Yeni</Text>
        <View style={styles.nbRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nbTitle}>Yeni Rituals,{'\n'}<Text style={styles.nbTitleEm}>yeni yüzler.</Text></Text>
            <Text style={styles.nbSub}>Son 30 gün içinde eklenenler</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.nbCount}>{rituals.length}</Text>
            <Text style={styles.nbCountLbl}>YENİ İÇERİK</Text>
          </View>
        </View>
        <View style={styles.nbStats}>
          <Text style={styles.nbStat}>🆕 {newRituals.length} yeni Ritual</Text>
          <Text style={styles.nbStat}>👤 {hosts.length} yeni host</Text>
          <Text style={styles.nbStat}>🏛 {venues.length} yeni mekan</Text>
          <Text style={styles.nbStat}>● {live.length} canlı</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {[
          ['all', 'Tümü', rituals.length],
          ['ritual', '🎯 Yeni Ritual', newRituals.length],
          ['host', '👤 Yeni Host', hosts.length],
          ['venue', '🏛 Yeni Mekan', venues.length],
        ].map(([k, l, c]) => (
          <TouchableOpacity key={k} style={[styles.cat, cat === k && styles.catOn]} onPress={() => setCat(k)}>
            <Text style={[styles.catTxt, cat === k && styles.catTxtOn]}>{l}</Text>
            <Text style={[styles.catCnt, cat === k && styles.catCntOn]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <View style={styles.ctaRow}>
          <View style={styles.ctaIcon}><Text style={{ fontSize: 22 }}>🎯</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaLabel}>Senin için seçildi</Text>
            <Text style={styles.ctaTitle}>İlk LOCAL Ritualine hazır mısın?</Text>
            <Text style={styles.ctaSub}>Buradaki Rituals yeni — hem sen hem Ritual ilk adımını atıyor.</Text>
          </View>
        </View>
        <Text style={styles.ctaBtn}>Keşfetmeye Başla →</Text>
      </View>

      <Section title="🆕 YENİ RİTÜELLER" count={list.length} color="#EA580C" />
      {list.slice(0, 2).map((r, i) => (
        <TouchableOpacity key={`n-${i}`} style={[styles.newCard, { backgroundColor: p.card, borderColor: p.border }, i === 0 && live.includes(r) && styles.newCardLive]} onPress={() => open(r.id)}>
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.hero}>
            <LinearGradient colors={['rgba(0,0,0,.06)', 'rgba(0,0,0,.9)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroTop}>
              <View style={styles.heroBadges}>
                <Text style={styles.bNew}>🆕 {daysAgo(r.created_at || r.start_time)} gün</Text>
                {live.includes(r) ? <Text style={styles.bLive}>● CANLI</Text> : null}
              </View>
              <Text style={styles.bChip}>{n(r.current_attendees, 0)} / {n(r.capacity, 10)} kişi</Text>
            </View>
            <View style={styles.heroBot}>
              <Text style={styles.heroName}>{clean(r.title)}</Text>
              <Text style={styles.heroVenue}>📍 {r.venue_name || city}</Text>
            </View>
          </ImageBackground>
          <View style={styles.newBody}>
            <View style={styles.tags}><Text style={styles.tagOrange}>🆕 LOCAL'de yeni</Text></View>
            <Text style={live.includes(r) ? styles.btnRed : styles.btnOrange}>Katıl</Text>
          </View>
          <View style={[styles.newFooter, { borderTopColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
            <Text style={[styles.newFooterTxt, { color: p.mute }]}>Bu Ritualin ilk katılımcılarından ol</Text>
            <View style={styles.newFooterRight}>
              <Text style={[styles.newReact, isDark && styles.newReactDark]}>🎲 3</Text>
              <Text style={[styles.newSave, isDark && styles.newSaveDark]}>🔖</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {list.slice(2, 5).map((r, i) => (
          <TouchableOpacity key={`h-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.04)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hTop}><Text style={styles.bNewSmall}>🆕 {daysAgo(r.created_at || r.start_time)} gün</Text></View>
              <View style={styles.hBot}><Text style={styles.hName}>{clean(r.title)}</Text><Text style={styles.hVenue}>{r.venue_name || city}</Text></View>
            </ImageBackground>
            <View style={styles.hBody}><Text style={styles.hBtn}>Katıl</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Section title="👤 YENİ VERIFIED HOSTLAR" count={hosts.length} color="#EA580C" />
      {hosts.map((h, i) => (
        <TouchableOpacity key={`host-${i}`} style={[styles.hostCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(h.rituals[0]?.id)}>
          <View style={styles.hostAv}><Text style={styles.hostAvTxt}>{String(h.host_name || 'H').slice(0, 1)}</Text><Text style={styles.hostNew}>🆕 Yeni</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hostName, { color: p.txt }]}>{h.host_name}</Text>
            <Text style={[styles.hostSub, { color: p.mute }]}>{h.rituals.length} Ritual · {city}</Text>
          </View>
          <Text style={[styles.hostBtn, isDark && styles.hostBtnDark]}>+ Takip</Text>
        </TouchableOpacity>
      ))}

      <Section title="🏛 YENİ MEKANLAR" count={venues.length} color="#EA580C" />
      {venues.map((v, i) => (
        <TouchableOpacity key={`venue-${i}`} style={[styles.venueRow, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(v.id)}>
          <ImageBackground source={{ uri: imgOf(v) }} style={styles.venueThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.venueAge}>🆕 {daysAgo(v.created_at || v.start_time)} gün önce</Text>
            <Text style={[styles.venueName, { color: p.txt }]}>{v.venue_name || city}</Text>
            <Text style={[styles.venueMeta, { color: p.mute }]}>{city} · Kap: {n(v.capacity, 12)}</Text>
          </View>
          <Text style={[styles.venueBtn, isDark && styles.venueBtnDark]}>Gör →</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden', minHeight: 145, padding: 16 },
  nbGlow: { position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,.06)' },
  nbLabel: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.25)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 9 },
  nbRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  nbTitle: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 24, lineHeight: 28, letterSpacing: -0.3 },
  nbTitleEm: { opacity: 0.7 },
  nbSub: { color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 3 },
  nbCount: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 40, lineHeight: 40 },
  nbCountLbl: { color: 'rgba(255,255,255,.5)', fontSize: 8, fontWeight: '700' },
  nbStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nbStat: { backgroundColor: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontSize: 10, color: 'rgba(255,255,255,.8)', fontWeight: '600' },

  catRow: { paddingHorizontal: 16, gap: 6, paddingBottom: 14 },
  cat: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 999, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 7 },
  catOn: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  catTxt: { fontSize: 10, fontWeight: '600', color: '#737373' },
  catTxtOn: { color: '#fff' },
  catCnt: { fontSize: 8, color: '#A3A3A3', fontWeight: '700' },
  catCntOn: { color: 'rgba(255,255,255,.55)' },

  cta: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(234,88,12,.22)', backgroundColor: '#FFF7ED', padding: 14 },
  ctaRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  ctaIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EA580C', alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontSize: 9, fontWeight: '700', color: '#EA580C', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  ctaTitle: { fontFamily: FONT_SERIF, fontSize: 15, color: '#000', marginBottom: 3 },
  ctaSub: { fontSize: 10, color: '#737373', lineHeight: 15 },
  ctaBtn: { marginTop: 10, textAlign: 'center', backgroundColor: '#EA580C', color: '#fff', borderRadius: 11, fontSize: 12, fontWeight: '700', paddingVertical: 10 },

  sec: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, marginBottom: 6, marginTop: 3 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  secTxt: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7, color: '#A3A3A3' },
  secCount: { fontSize: 9, fontWeight: '600', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },

  newCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1.5, overflow: 'hidden' },
  newCardLive: { borderColor: 'rgba(220,38,38,.2)' },
  hero: { height: 155, justifyContent: 'space-between' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroBadges: { flexDirection: 'row', gap: 5 },
  bNew: { backgroundColor: '#EA580C', color: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 8, fontWeight: '700' },
  bLive: { backgroundColor: '#DC2626', color: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 8, fontWeight: '700' },
  bChip: { backgroundColor: 'rgba(0,0,0,.5)', borderColor: 'rgba(255,255,255,.18)', borderWidth: 1, color: 'rgba(255,255,255,.8)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 9, fontWeight: '600' },
  heroBot: { paddingHorizontal: 13, paddingBottom: 9 },
  heroName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 17, lineHeight: 21 },
  heroVenue: { color: 'rgba(255,255,255,.55)', fontSize: 10 },
  newBody: { paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newFooter: { paddingHorizontal: 13, paddingVertical: 9, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  newFooterTxt: { fontSize: 10, flex: 1 },
  newFooterRight: { flexDirection: 'row', gap: 5, marginLeft: 6 },
  newReact: { fontSize: 11, borderRadius: 7, borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#F5F5F5', color: '#525252', paddingHorizontal: 8, paddingVertical: 3 },
  newReactDark: { borderColor: '#334155', backgroundColor: '#1F2937', color: '#E5E7EB' },
  newSave: { fontSize: 13, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E5E5', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 3 },
  newSaveDark: { borderColor: '#334155', backgroundColor: '#111827', color: '#E5E7EB' },
  tags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tagOrange: { fontSize: 8, fontWeight: '600', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: '#FFF7ED', color: '#C2410C', borderWidth: 1, borderColor: 'rgba(234,88,12,.22)' },
  btnOrange: { backgroundColor: '#EA580C', color: '#fff', borderRadius: 11, fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 9 },
  btnRed: { backgroundColor: '#DC2626', color: '#fff', borderRadius: 11, fontSize: 11, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 9 },

  hRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  hCard: { width: 155, borderRadius: 14, borderWidth: 1.5, overflow: 'hidden' },
  hImg: { height: 86, justifyContent: 'space-between' },
  hTop: { paddingHorizontal: 7, paddingTop: 6 },
  bNewSmall: { alignSelf: 'flex-start', backgroundColor: '#EA580C', color: '#fff', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, fontSize: 7, fontWeight: '700' },
  hBot: { paddingHorizontal: 7, paddingBottom: 6 },
  hName: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 12 },
  hVenue: { color: 'rgba(255,255,255,.55)', fontSize: 8 },
  hBody: { paddingHorizontal: 9, paddingVertical: 8, alignItems: 'flex-end' },
  hBtn: { backgroundColor: '#EA580C', color: '#fff', borderRadius: 7, fontSize: 9, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4 },

  hostCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hostAv: { width: 52, height: 52, borderRadius: 26, borderWidth: 2.5, borderColor: 'rgba(234,88,12,.2)', backgroundColor: '#2a1040', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  hostAvTxt: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 21 },
  hostNew: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#EA580C', borderColor: '#fff', borderWidth: 2, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1, fontSize: 7, fontWeight: '700', color: '#fff' },
  hostName: { fontFamily: FONT_SERIF, fontSize: 15, color: '#000' },
  hostSub: { fontSize: 10, color: '#A3A3A3', marginTop: 3, lineHeight: 14 },
  hostBtn: { borderWidth: 1.5, borderColor: 'rgba(234,88,12,.22)', backgroundColor: '#FFF7ED', color: '#C2410C', borderRadius: 10, fontSize: 11, fontWeight: '700', paddingHorizontal: 15, paddingVertical: 9 },
  hostBtnDark: { borderColor: '#7C2D12', backgroundColor: '#431407', color: '#FDBA74' },

  venueRow: { marginHorizontal: 16, marginBottom: 6, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  venueThumb: { width: 48, height: 48, borderRadius: 11, overflow: 'hidden' },
  venueAge: { fontSize: 9, fontWeight: '700', color: '#EA580C', marginBottom: 2 },
  venueName: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 2 },
  venueMeta: { fontSize: 10, color: '#A3A3A3', lineHeight: 14 },
  venueBtn: { borderWidth: 1, borderColor: 'rgba(234,88,12,.22)', backgroundColor: '#FFF7ED', color: '#C2410C', borderRadius: 8, fontSize: 10, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 5 },
  venueBtnDark: { borderColor: '#7C2D12', backgroundColor: '#431407', color: '#FDBA74' },
});
