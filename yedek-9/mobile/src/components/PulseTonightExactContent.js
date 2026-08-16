import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { PULSE } from '../constants/pulseTheme';

const toStart = (r) => new Date(r?.start_time || Date.now());
const fmtTime = (r) => `${toStart(r).getHours().toString().padStart(2, '0')}:${toStart(r).getMinutes().toString().padStart(2, '0')}`;
const minsToStart = (r) => Math.floor((toStart(r).getTime() - Date.now()) / 60000);
const getVenue = (r, city) => r?.venue_name || r?.location_name || city;
const isLive = (r) => {
  const status = String(r?.status || '').toLowerCase();
  const ts = String(r?.time_state || '').toLowerCase();
  if (status === 'live' || ts === 'live_now') return true;
  const m = minsToStart(r);
  return m <= 0 && m >= -120;
};
const isTonight = (r) => {
  const h = toStart(r).getHours();
  return h >= 18 || h < 3;
};

export default function PulseTonightExactContent({
  rituals = [],
  city,
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const tonightRituals = useMemo(
    () => rituals.filter(isTonight).sort((a, b) => toStart(a).getTime() - toStart(b).getTime()),
    [rituals]
  );
  const live = tonightRituals.filter(isLive);
  const upcoming = tonightRituals.filter((r) => !isLive(r));
  const friends = tonightRituals.filter((r) => Number(r.friends_here || 0) > 0);
  const special = tonightRituals.find((r) => r.is_special_event || r.type === 'Special Event');

  const slots = ['18:00', '19:00', '20:30', '21:00', '22:00', '00:00+'];
  const now = new Date();
  const liveSlot = live.length > 0 ? slots.find((s) => slotHasAnyLive(s, live)) : null;
  const activeSlot = slots.find((s) => slotIsCurrentOrNext(s, tonightRituals, now)) || '20:30';
  const slotCounts = useMemo(() => {
    const map = {};
    slots.forEach((s) => { map[s] = 0; });
    tonightRituals.forEach((r) => {
      const h = toStart(r).getHours();
      if (h < 19) map['18:00'] += 1;
      else if (h < 20) map['19:00'] += 1;
      else if (h < 21) map['20:30'] += 1;
      else if (h < 22) map['21:00'] += 1;
      else if (h < 24) map['22:00'] += 1;
      else map['00:00+'] += 1;
    });
    return map;
  }, [tonightRituals]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timelineMeta = slots.map((slot) => {
    const slotMins = slotStartMinutes(slot);
    const cnt = slotCounts[slot] || 0;
    const isPast = slot !== '00:00+' && slotMins + 45 < currentMinutes;
    const hasLive = liveSlot === slot;
    const isActive = activeSlot === slot && !hasLive;
    let countText = `${cnt} Ritual`;
    if (hasLive) countText = `${Math.max(1, live.length)} canlı`;
    else if (isPast) countText = cnt > 0 ? `${cnt} bitti` : '0 bitti';
    return { slot, cnt, isPast, hasLive, isActive, countText };
  });

  const openRitual = (r) => r?.id && navigation.navigate('RitualDetail', { ritualId: r.id });
  const ended = rituals
    .filter((r) => !isTonight(r) && minsToStart(r) < -60)
    .sort((a, b) => toStart(b).getTime() - toStart(a).getTime());

  const renderCard = (r, idx, tone = 'normal', hero = false) => (
    <TouchableOpacity
      key={r.id || `night-${idx}`}
      style={[
        styles.card,
        tone === 'live' && styles.cardLive,
        tone === 'friends' && styles.cardFriends,
        tone === 'special' && styles.cardSpecial,
        isDark && styles.cardDark,
      ]}
      onPress={() => openRitual(r)}
      activeOpacity={0.93}
    >
      {hero ? (
        <ImageBackground
          source={{ uri: r.image_url || r.cover_image_url || r.venue_image_url || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80' }}
          style={styles.hero}
          imageStyle={styles.heroImg}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroTop}>
            <Text style={[styles.status, tone === 'live' ? styles.statusLive : tone === 'friends' ? styles.statusFriends : tone === 'special' ? styles.statusSpecial : styles.statusSoon]}>
              {tone === 'live' ? '● CANLI' : tone === 'friends' ? `👥 ${r.friends_here || 1} Arkadaş` : tone === 'special' ? '★ SUPER EVENT' : fmtTime(r)}
            </Text>
            <Text style={styles.chip}>{`${Number(r.current_attendees || 0)} / ${Number(r.capacity || 0) || '-'}`}</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={1}>{r.title || 'Ritual'}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>{`📍 ${getVenue(r, city)} · ${fmtTime(r)}`}</Text>
          </View>
        </ImageBackground>
      ) : null}
      <View style={styles.body}>
        {!hero ? <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>{r.title || 'Ritual'}</Text> : null}
        <Text style={styles.sub} numberOfLines={1}>{`📍 ${getVenue(r, city)} · ${fmtTime(r)}`}</Text>
        <View style={styles.tags}>
          {isLive(r) ? <Text style={styles.tag}>● Canlı</Text> : <Text style={styles.tag}>{`⏱ ${Math.max(0, minsToStart(r))} dk`}</Text>}
          {r.is_host_verified ? <Text style={styles.tag}>✓ Verified</Text> : null}
          {r.is_special_event ? <Text style={styles.tag}>★ Pivot</Text> : null}
          {Number(r.friends_here || 0) > 0 ? <Text style={styles.tag}>{`👥 ${r.friends_here}`}</Text> : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>{isLive(r) ? 'Gece canlı devam ediyor' : 'Bu gece başlıyor'}</Text>
          <TouchableOpacity style={styles.joinBtn} onPress={() => openRitual(r)}>
            <Text style={styles.joinBtnText}>Katıl</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMini = (r, idx, tone = 'n') => (
    <TouchableOpacity
      key={`mini-${r.id || idx}`}
      style={[styles.miniCard, isDark && styles.cardDark]}
      onPress={() => openRitual(r)}
      activeOpacity={0.9}
    >
      <ImageBackground
        source={{ uri: r.image_url || r.cover_image_url || r.venue_image_url || 'https://images.unsplash.com/photo-1461783436728-0a9217714694?w=700&q=80' }}
        style={styles.miniHero}
        imageStyle={styles.miniHeroImg}
      >
        <View style={styles.miniOverlay} />
        <View style={styles.miniTop}>
          <Text style={[styles.miniStatus, tone === 'r' ? styles.statusLive : tone === 'a' ? styles.statusSoon : styles.statusFriends]}>
            {tone === 'r' ? 'Canlı' : tone === 'a' ? `⏱ ${Math.max(0, minsToStart(r))} dk` : fmtTime(r)}
          </Text>
        </View>
        <View style={styles.miniBottom}>
          <Text style={styles.miniTitle} numberOfLines={1}>{r.title || 'Ritual'}</Text>
          <Text style={styles.miniSub} numberOfLines={1}>{getVenue(r, city)}</Text>
        </View>
      </ImageBackground>
      <View style={styles.miniBody}>
        <Text style={styles.miniTime}>{isLive(r) ? '● Devam' : fmtTime(r)}</Text>
        <TouchableOpacity style={[styles.miniBtn, tone === 'r' ? styles.miniBtnRed : styles.miniBtnNavy]} onPress={() => openRitual(r)}>
          <Text style={styles.miniBtnText}>Katıl</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.banner}>
        <View style={styles.bannerSky} />
        <View style={styles.bannerLayer1} />
        <View style={styles.bannerLayer2} />
        <View style={styles.bannerLayer3} />
        <View style={styles.moon} />
        <View style={styles.starA} />
        <View style={styles.starB} />
        <View style={styles.starC} />
        <View style={styles.starD} />
        <View style={styles.starE} />
        <Text style={styles.bannerLabel}>🌙 Bu Gece · {city}</Text>
        <Text style={styles.bannerTitle}>İyi geceler{'\n'}başlıyor</Text>
        <Text style={styles.bannerSub}>{`${new Date().toLocaleDateString('tr-TR')} · ${tonightRituals.length} Ritual`}</Text>
        <View style={styles.bannerStats}>
          <Text style={styles.bannerPill}>{`● ${live.length} canlı`}</Text>
          <Text style={styles.bannerPill}>{`⏱ ${upcoming.length} başlayacak`}</Text>
          <Text style={styles.bannerPill}>{`👥 ${friends.length} arkadaşlı`}</Text>
        </View>
      </View>

      <View style={styles.timelineWrap}>
        <Text style={styles.timelineLabel}>Gece Haritası</Text>
        <View style={styles.timelineRow}>
          <View style={styles.timelineLine} />
          {timelineMeta.map((item) => (
            <View key={`slot-${item.slot}`} style={styles.tlItem}>
              <View
                style={[
                  styles.tlDot,
                  item.hasLive && styles.tlDotLive,
                  item.isActive && styles.tlDotActive,
                  item.isPast && styles.tlDotPast,
                ]}
              >
                <Text
                  style={[
                    styles.tlDotText,
                    (item.hasLive || item.isActive) && styles.tlDotTextOn,
                    item.isPast && styles.tlDotTextPast,
                  ]}
                >
                  {item.hasLive ? '●' : item.slot === '00:00+' ? '00' : item.slot.slice(0, 2)}
                </Text>
              </View>
              <Text
                style={[
                  styles.tlTime,
                  item.hasLive && styles.tlTimeLive,
                  item.isActive && styles.tlTimeActive,
                ]}
              >
                {item.slot}
              </Text>
              <Text
                style={[
                  styles.tlCount,
                  item.hasLive && styles.tlCountStrong,
                  item.isActive && styles.tlCountStrong,
                ]}
              >
                {item.countText}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {live.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#dc2626' }]}>● Şu An Canlı</Text><View style={styles.line} /><Text style={styles.count}>{live.length}</Text></View>
          {renderCard(live[0], 0, 'live', true)}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniRow}>
            {live.slice(1, 4).map((r, i) => renderMini(r, i + 1, 'r'))}
          </ScrollView>
        </View>
      ) : null}

      {friends.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#7c3aed' }]}>20:30 · Arkadaşlar Gidiyor</Text><View style={styles.line} /><Text style={styles.count}>{friends.length}</Text></View>
          {renderCard(friends[0], 10, 'friends', true)}
        </View>
      ) : null}

      {special ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#92400e' }]}>★ Bu Haftanın Super Event'i</Text><View style={styles.line} /></View>
          {renderCard(special, 20, 'special', true)}
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><View style={styles.line} /><Text style={styles.sectionText}>21:00 Sonrası · Gece Devam</Text><View style={styles.line} /><Text style={styles.count}>{upcoming.length}</Text></View>
          {upcoming.slice(0, 3).map((r, i) => renderCard(r, i + 30, 'normal', i === 0))}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniRow}>
            {upcoming.slice(1, 4).map((r, i) => renderMini(r, i + 40, 'a'))}
          </ScrollView>
        </View>
      ) : null}

      {ended[0] ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#a3a3a3' }]}>Bu Gece Biten Rituals</Text><View style={styles.line} /><Text style={styles.count}>1</Text></View>
          <TouchableOpacity style={styles.ghost} onPress={() => openRitual(ended[0])} activeOpacity={0.85}>
            <View style={styles.ghostThumb}><Text style={styles.ghostThumbText}>⊘</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ghostTitle} numberOfLines={1}>{ended[0].title || 'Ritual'}</Text>
              <Text style={styles.ghostSub} numberOfLines={1}>{`${getVenue(ended[0], city)} · Tamamlandı`}</Text>
            </View>
            <Text style={styles.ghostBadge}>Bitti</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.summary}>
        <Text style={styles.summaryIcon}>🌙</Text>
        <Text style={styles.summaryTitle}>Bu gece var oldu</Text>
        <Text style={styles.summarySub}>{`${live.length} Ritual canlı · ${friends.length} arkadaşın bir yerde`}</Text>
        <TouchableOpacity style={styles.summaryBtn} onPress={() => navigation.navigate(isDark ? 'CityRhythmDark' : 'CityRhythm')}>
          <Text style={styles.summaryBtnText}>🗺 Haritada Gör →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2A4470',
    borderWidth: 1,
    borderColor: '#2c3f63',
    padding: 18,
    minHeight: 110,
    position: 'relative',
  },
  bannerSky: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1B2E4A',
  },
  bannerLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2A4470',
    opacity: 0.7,
  },
  bannerLayer2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    bottom: 0,
    backgroundColor: '#4A3060',
    opacity: 0.55,
  },
  bannerLayer3: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '62%',
    bottom: 0,
    backgroundColor: '#B85C4A',
    opacity: 0.45,
  },
  moon: {
    position: 'absolute',
    right: 18,
    top: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5D98E',
  },
  starA: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#fff', opacity: 0.35, top: 22, left: 34 },
  starB: { position: 'absolute', width: 1.8, height: 1.8, borderRadius: 1, backgroundColor: '#fff', opacity: 0.28, top: 34, left: 132 },
  starC: { position: 'absolute', width: 1.6, height: 1.6, borderRadius: 1, backgroundColor: '#fff', opacity: 0.25, top: 18, left: 210 },
  starD: { position: 'absolute', width: 1.7, height: 1.7, borderRadius: 1, backgroundColor: '#fff', opacity: 0.22, top: 54, left: 260 },
  starE: { position: 'absolute', width: 1.5, height: 1.5, borderRadius: 1, backgroundColor: '#fff', opacity: 0.24, top: 40, left: 80 },
  bannerLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700', marginBottom: 7, letterSpacing: 1.2, textTransform: 'uppercase' },
  bannerTitle: { fontSize: 30, lineHeight: 31, color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.52)', marginBottom: 10 },
  bannerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bannerPill: { fontSize: 10, color: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontWeight: '600' },
  timelineWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  timelineLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '700', marginBottom: 7 },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 2, position: 'relative' },
  timelineLine: { position: 'absolute', left: 14, right: 14, top: 11, height: 1, backgroundColor: '#e5e7eb' },
  tlItem: { alignItems: 'center' },
  tlDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#d4d4d8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tlDotLive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  tlDotActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  tlDotPast: { backgroundColor: '#f5f5f5', borderColor: '#e5e7eb' },
  tlDotText: { fontSize: 8, color: '#9ca3af', fontWeight: '700' },
  tlDotTextOn: { color: '#fff' },
  tlDotTextPast: { color: '#c4c4c4' },
  tlTime: { fontSize: 8, color: '#6b7280', fontWeight: '600' },
  tlTimeLive: { color: '#dc2626' },
  tlTimeActive: { color: '#7c3aed' },
  tlCount: { fontSize: 7, color: '#a3a3a3' },
  tlCountStrong: { color: '#525252' },
  section: { marginBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  line: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  sectionText: { fontSize: 9, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' },
  count: { fontSize: 9, color: '#a3a3a3', backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  cardLive: { borderColor: 'rgba(220,38,38,0.2)' },
  cardFriends: { borderColor: 'rgba(124,58,237,0.2)' },
  cardSpecial: { borderColor: 'rgba(200,169,106,0.3)' },
  hero: { height: 150, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  status: { fontSize: 8, fontWeight: '700', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusLive: { backgroundColor: '#dc2626', color: '#fff' },
  statusSoon: { backgroundColor: '#d97706', color: '#fff' },
  statusFriends: { backgroundColor: '#7c3aed', color: '#fff' },
  statusSpecial: { backgroundColor: '#C8A96A', color: '#000' },
  chip: { fontSize: 8, color: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 9 },
  heroTitle: { fontSize: 18, color: '#fff', fontWeight: '500', marginBottom: 2 },
  heroSub: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  body: { paddingHorizontal: 13, paddingTop: 10, paddingBottom: 6 },
  title: { fontSize: 15, color: '#111827', fontWeight: '600', marginBottom: 2 },
  titleDark: { color: '#f9fafb' },
  sub: { fontSize: 10, color: '#9ca3af', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tag: { fontSize: 8, color: '#525252', backgroundColor: '#f3f4f6', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  footer: { borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 6, paddingTop: 7, paddingBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 10, color: '#6b7280', flex: 1 },
  joinBtn: { backgroundColor: '#1B2E4A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, minWidth: 74, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  summary: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 15, alignItems: 'center' },
  summaryIcon: { fontSize: 26, marginBottom: 6 },
  summaryTitle: { fontSize: 16, color: '#111827', marginBottom: 4 },
  summarySub: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginBottom: 10 },
  summaryBtn: { backgroundColor: '#E8EDF4', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  summaryBtnText: { color: '#1B2E4A', fontSize: 11, fontWeight: '700' },
  miniRow: { paddingHorizontal: 16, gap: 10, marginBottom: 4 },
  miniCard: { width: 160, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  miniHero: { height: 88, justifyContent: 'space-between' },
  miniHeroImg: { resizeMode: 'cover' },
  miniOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  miniTop: { paddingTop: 6, paddingLeft: 7 },
  miniStatus: { fontSize: 7, fontWeight: '700', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, color: '#fff', alignSelf: 'flex-start' },
  miniBottom: { paddingHorizontal: 7, paddingBottom: 6 },
  miniTitle: { fontSize: 12, color: '#fff', fontWeight: '600' },
  miniSub: { fontSize: 8, color: 'rgba(255,255,255,0.65)' },
  miniBody: { paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniTime: { fontSize: 9, color: '#9ca3af', fontWeight: '600' },
  miniBtn: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, minWidth: 44, alignItems: 'center' },
  miniBtnRed: { backgroundColor: '#dc2626' },
  miniBtnNavy: { backgroundColor: '#1B2E4A' },
  miniBtnText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  ghost: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fafafa', borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.65 },
  ghostThumb: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  ghostThumbText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  ghostTitle: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 2 },
  ghostSub: { fontSize: 10, color: '#9ca3af' },
  ghostBadge: { fontSize: 9, color: '#9ca3af', backgroundColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontWeight: '700' },
});

function slotStartMinutes(slot) {
  if (slot === '00:00+') return 24 * 60;
  const [h, m] = slot.split(':').map(Number);
  return h * 60 + (m || 0);
}

function slotHourForLive(slot) {
  if (slot === '20:30') return 20;
  if (slot === '00:00+') return 0;
  return Number(slot.slice(0, 2));
}

function slotHasAnyLive(slot, liveRows) {
  const h = slotHourForLive(slot);
  return liveRows.some((r) => toStart(r).getHours() === h);
}

function slotIsCurrentOrNext(slot, rows, now) {
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = slotStartMinutes(slot);
  if (targetMins < currentMins - 45) return false;
  const hasRows = rows.some((r) => {
    const t = toStart(r);
    const mins = t.getHours() * 60 + t.getMinutes();
    if (slot === '00:00+') return mins >= 24 * 60 || mins < 60;
    const slotStart = targetMins;
    const next = slotStart + 60;
    return mins >= slotStart && mins < next;
  });
  if (hasRows) return true;
  return Math.abs(targetMins - currentMins) <= 40;
}

function slotIsPast(slot, now) {
  if (slot === '00:00+') return false;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return slotStartMinutes(slot) + 45 < currentMins;
}

