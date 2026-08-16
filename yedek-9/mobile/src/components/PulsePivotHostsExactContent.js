import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SERIF, PULSE } from '../constants/pulseTheme';

const IMG = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=900&q=80';
const imgOf = (r) => r?.image_url || r?.venue_image_url || IMG;
const hhmm = (v) => {
  const d = new Date(v || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function PulsePivotHostsExactContent({
  filteredRituals = [],
  city = '',
  navigation,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const open = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const p = isDark
    ? { bg: PULSE.screenDark, card: '#111827', border: '#334155', txt: '#F9FAFB', mute: '#9CA3AF', line: '#2B3549' }
    : { bg: PULSE.screenLight, card: '#fff', border: 'rgba(200,169,106,.18)', txt: '#000', mute: '#A3A3A3', line: '#E5E5E5' };

  const hosts = useMemo(() => {
    const map = new Map();
    filteredRituals.forEach((r) => {
      const key = String(r.host_id || r.host_name || 'host');
      const prev = map.get(key) || {
        host_name: r.host_name || 'Pivot Host',
        host_initial: String(r.host_name || 'P').slice(0, 1).toUpperCase(),
        ritual_count: 0,
        rituals: [],
      };
      prev.rituals.push(r);
      prev.ritual_count = prev.rituals.length;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.ritual_count - a.ritual_count);
  }, [filteredRituals]);

  const live = filteredRituals.filter((r) => {
    const st = String(r.status || '').toLowerCase();
    const ts = String(r.time_state || '').toLowerCase();
    return st === 'live' || ts === 'live_now';
  });
  const soon = filteredRituals.filter((r) => !live.includes(r)).slice(0, 6);

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
        <LinearGradient colors={['#1B2E4A', '#2A4470']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.shimmer} />
        <Text style={styles.pbLabel}>★ Pivot Host</Text>
        <View style={styles.pbRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pbTitle}>LOCAL'in{'\n'}<Text style={styles.pbTitleEm}>secilmis onculeri.</Text></Text>
            <Text style={styles.pbSub}>{city} · {hosts.length} Pivot Host · {filteredRituals.length} Ritual</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.pbNum}>{hosts.length}</Text>
            <Text style={styles.pbNumLbl}>PIVOT HOST</Text>
          </View>
        </View>
        <View style={styles.pbStats}>
          <Text style={styles.pbStat}>● {live.length} su an canli</Text>
          <Text style={styles.pbStat}>⏱ {soon.length} baslamak uzere</Text>
          <Text style={styles.pbStat}>★ Hepsini takip ediyorsun</Text>
        </View>
      </View>

      <Text style={[styles.kicker, { color: p.mute }]}>{hosts.length} Pivot Host · {city}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hostRow}>
        {hosts.map((h, i) => {
          const top = h.rituals[0];
          const isLive = live.includes(top);
          return (
            <TouchableOpacity key={`host-${i}`} style={[styles.hostCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(top?.id)}>
              <ImageBackground source={{ uri: imgOf(top) }} style={styles.hostPhoto}>
                <LinearGradient colors={['rgba(0,0,0,.05)', 'rgba(27,46,74,.75)']} style={StyleSheet.absoluteFillObject} />
              </ImageBackground>
              <View style={styles.hostAvWrap}>
                <View style={styles.hostAv}><Text style={styles.hostAvTxt}>{h.host_initial}</Text></View>
              </View>
              <View style={styles.hostInfo}>
                <Text style={[styles.hostName, { color: p.txt }]} numberOfLines={1}>{h.host_name}</Text>
                <Text style={[styles.hostMeta, { color: p.mute }]} numberOfLines={2}>★ {h.rituals.length} Ritual</Text>
                <Text style={[styles.hostRit, { color: isLive ? '#DC2626' : '#D97706' }]}>{isLive ? '● Su an canli' : `⏱ ${hhmm(top?.start_time)}`}</Text>
                <Text style={styles.hostBtn}>✓ Takipte</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.defCard, { backgroundColor: p.card, borderColor: p.border }]}>
        <View style={styles.defHead}>
          <LinearGradient colors={['#1B2E4A', '#2A4470']} style={StyleSheet.absoluteFillObject} />
          <Text style={styles.defIcon}>★</Text>
          <View>
            <Text style={styles.defTitle}>Pivot Host nedir?</Text>
            <Text style={styles.defSub}>LOCAL ekibinin sectigi topluluk onculeri</Text>
          </View>
        </View>
        <View style={styles.defBody}>
          <Text style={[styles.defRow, { color: p.mute }]}>🏆 LOCAL ekibi tarafindan secilen, guvenilir topluluk onculeri.</Text>
          <Text style={[styles.defRow, { color: p.mute }]}>🤝 LOCAL ile dogrudan iletisimde, yeni formatlari acan onculer.</Text>
          <Text style={[styles.defRow, { color: p.mute }]}>📢 Seri Ritual ve duyuru yetkisi bu profile ozeldir.</Text>
        </View>
      </View>

      <Section title="● SU AN CANLI" count={live.length} color="#DC2626" />
      {live.slice(0, 2).map((r, i) => (
        <TouchableOpacity key={`live-${i}`} style={[styles.card, { backgroundColor: p.card, borderColor: 'rgba(220,38,38,.2)' }]} onPress={() => open(r.id)}>
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.hero}>
            <LinearGradient colors={['rgba(0,0,0,.06)', 'rgba(0,0,0,.9)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroTop}>
              <View style={styles.hostStrip}><Text style={styles.hostStripTxt}>★ Pivot Host</Text></View>
              <Text style={styles.liveBadge}>● CANLI</Text>
            </View>
            <View style={styles.heroBot}>
              <Text style={styles.heroName}>{r.title}</Text>
              <Text style={styles.heroVenue}>📍 {r.venue_name || city}</Text>
            </View>
          </ImageBackground>
          <View style={styles.cardBody}>
            <View style={styles.tags}><Text style={styles.tagLive}>● Canlı</Text><Text style={styles.tagGold}>★ Pivot Host</Text></View>
            <Text style={styles.joinBtn}>Katıl →</Text>
          </View>
          <View style={[styles.cardFooter, { borderTopColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
            <Text style={[styles.cardFooterText, isDark && styles.cardFooterTextDark]}>
              {(r.friends_here || 0) > 0 ? `${r.friends_here} arkadas orada` : 'Canli etkinlik devam ediyor'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}

      <Section title="⏱ BASLAMAK UZERE" count={soon.length} color="#D97706" />
      {soon.slice(0, 3).map((r, i) => (
        <TouchableOpacity key={`soon-${i}`} style={[styles.compact, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
          <View style={styles.compactAccent} />
          <ImageBackground source={{ uri: imgOf(r) }} style={styles.cThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cHost}>★ Pivot Host</Text>
            <Text style={[styles.cName, { color: p.txt }]} numberOfLines={1}>{r.title}</Text>
            <Text style={[styles.cMeta, { color: p.mute }]}>{r.venue_name || city} · {hhmm(r.start_time)}</Text>
          </View>
          <Text style={styles.cBtn}>Gör →</Text>
        </TouchableOpacity>
      ))}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {soon.slice(3, 6).map((r, i) => (
          <TouchableOpacity key={`h-${i}`} style={[styles.hCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(r.id)}>
            <ImageBackground source={{ uri: imgOf(r) }} style={styles.hImg}>
              <LinearGradient colors={['rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.hTop}><Text style={styles.hPivot}>★ Pivot</Text></View>
              <View style={styles.hBot}>
                <Text style={styles.hName}>{r.title}</Text>
                <Text style={styles.hVenue}>{r.host_name || 'Pivot Host'} · {hhmm(r.start_time)}</Text>
              </View>
            </ImageBackground>
            <View style={styles.hBody}>
              <Text style={[styles.hSeats, isDark && styles.hSeatsDark]}>{Math.max(0, Number(r.capacity || 10) - Number(r.current_attendees || 0))} yer</Text>
              <Text style={[styles.hBtn, isDark && styles.hBtnDark]}>Katıl</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Section title="★ PIVOT HOST PROFILLERI" count={Math.min(2, hosts.length)} color="#92400E" />
      {hosts.slice(0, 2).map((h, i) => {
        const rows = h.rituals.slice(0, 3);
        const top = rows[0];
        return (
          <TouchableOpacity key={`full-${i}`} style={[styles.fullCard, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => open(top?.id)}>
            <View style={styles.fullHead}>
              <LinearGradient colors={['#1B2E4A', '#2A4470']} style={StyleSheet.absoluteFillObject} />
              <View style={styles.fullAv}><Text style={styles.fullAvTxt}>{h.host_initial}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullName}>{h.host_name}</Text>
                <Text style={styles.fullRole}>★ Pivot Host · {h.ritual_count} Ritual</Text>
              </View>
            </View>
            <View style={styles.fullBody}>
              <Text style={[styles.fullLabel, { color: p.mute }]}>Aktif Rituals</Text>
              {rows.map((r, idx) => (
                <View key={`full-r-${i}-${idx}`} style={[styles.fullRow, idx === rows.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={[styles.fullTime, String(r.status || '').toLowerCase() === 'live' && { color: '#DC2626' }]}>
                    {String(r.status || '').toLowerCase() === 'live' ? '● Canlı' : hhmm(r.start_time)}
                  </Text>
                  <Text style={[styles.fullRitual, { color: p.txt }]} numberOfLines={1}>{r.title}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.fullFoot, { borderTopColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <Text style={[styles.fullFollow, isDark && styles.fullFollowDark]}>✓ Takipte</Text>
              <Text style={[styles.fullView, isDark && styles.fullViewDark]}>Tüm Rituals →</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden', minHeight: 150, padding: 16 },
  shimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,.03)' },
  pbLabel: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.25)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 9 },
  pbRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  pbTitle: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  pbTitleEm: { fontStyle: 'italic' },
  pbSub: { color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 3 },
  pbNum: { color: '#fff', fontFamily: FONT_SERIF, fontSize: 32, lineHeight: 31 },
  pbNumLbl: { color: 'rgba(255,255,255,.45)', fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  pbStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pbStat: { backgroundColor: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.22)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontSize: 10, color: 'rgba(255,255,255,.85)', fontWeight: '600' },
  kicker: { marginHorizontal: 16, marginBottom: 10, fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  hostRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  hostCard: { width: 160, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  hostPhoto: { height: 88 },
  hostAvWrap: { position: 'absolute', top: 72, left: 12 },
  hostAv: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1B2E4A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  hostAvTxt: { color: '#fff', fontWeight: '700' },
  hostInfo: { padding: 12, paddingTop: 22, gap: 2 },
  hostName: { fontSize: 14, fontWeight: '700' },
  hostMeta: { fontSize: 11 },
  hostRit: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  hostBtn: { marginTop: 6, fontSize: 10, fontWeight: '700', color: '#16A34A' },
  defCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  defHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, overflow: 'hidden' },
  defIcon: { fontSize: 22, color: '#fff' },
  defTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  defSub: { color: 'rgba(255,255,255,.7)', fontSize: 11, marginTop: 2 },
  defBody: { padding: 14, gap: 8 },
  defRow: { fontSize: 12, lineHeight: 18 },
  sec: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 10 },
  line: { flex: 1, height: 1 },
  secTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  secCount: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  hero: { height: 180, padding: 14, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hostStrip: { backgroundColor: 'rgba(27,46,74,.85)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  hostStripTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  liveBadge: { color: '#FCA5A5', fontSize: 11, fontWeight: '800' },
  heroBot: { gap: 4 },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroVenue: { color: 'rgba(255,255,255,.75)', fontSize: 12 },
  cardBody: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tags: { flexDirection: 'row', gap: 6 },
  tagLive: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  tagGold: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  joinBtn: { fontSize: 12, fontWeight: '700', color: '#1B2E4A' },
  cardFooter: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  cardFooterText: { fontSize: 11, color: '#6B7280' },
  cardFooterTextDark: { color: '#9CA3AF' },
  compact: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  compactAccent: { width: 4, alignSelf: 'stretch', backgroundColor: '#D97706' },
  cThumb: { width: 72, height: 72 },
  cHost: { fontSize: 10, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  cName: { fontSize: 14, fontWeight: '700' },
  cMeta: { fontSize: 11, marginTop: 2 },
  cBtn: { paddingHorizontal: 12, fontSize: 12, fontWeight: '700', color: '#1B2E4A' },
  hRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  hCard: { width: 180, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  hImg: { height: 110, padding: 10, justifyContent: 'space-between' },
  hTop: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,.45)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  hPivot: { color: '#fff', fontSize: 9, fontWeight: '700' },
  hBot: { gap: 2 },
  hName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hVenue: { color: 'rgba(255,255,255,.8)', fontSize: 10 },
  hBody: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hSeats: { fontSize: 11, color: '#6B7280' },
  hSeatsDark: { color: '#9CA3AF' },
  hBtn: { fontSize: 11, fontWeight: '700', color: '#1B2E4A' },
  hBtnDark: { color: '#BFDBFE' },
  fullCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  fullHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, overflow: 'hidden' },
  fullAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  fullAvTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fullName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fullRole: { color: 'rgba(255,255,255,.75)', fontSize: 11, marginTop: 2 },
  fullBody: { padding: 14 },
  fullLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },
  fullRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  fullTime: { width: 72, fontSize: 11, fontWeight: '700', color: '#D97706' },
  fullRitual: { flex: 1, fontSize: 13, fontWeight: '600' },
  fullFoot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, padding: 12 },
  fullFollow: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  fullFollowDark: { color: '#86EFAC' },
  fullView: { fontSize: 11, fontWeight: '700', color: '#1B2E4A' },
  fullViewDark: { color: '#BFDBFE' },
});
