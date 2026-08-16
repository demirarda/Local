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

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];

const toDate = (r) => new Date(r?.start_time || Date.now());
const toKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const fmtHM = (r) => `${toDate(r).getHours().toString().padStart(2, '0')}:${toDate(r).getMinutes().toString().padStart(2, '0')}`;
const venue = (r, city) => r?.venue_name || r?.location_name || city;

const isLive = (r) => {
  const s = String(r?.status || '').toLowerCase();
  const t = String(r?.time_state || '').toLowerCase();
  if (s === 'live' || t === 'live_now') return true;
  const mins = Math.floor((Date.now() - toDate(r).getTime()) / 60000);
  return mins >= 0 && mins <= Math.max(90, Number(r?.duration || 90));
};

export default function PulseThisWeekExactContent({
  rituals = [],
  city,
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const now = new Date();
  const weekDays = useMemo(() => {
    const arr = [];
    const start = new Date(now);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      arr.push(d);
    }
    return arr;
  }, [now.getDate()]);

  const weekMap = useMemo(() => {
    const out = new Map();
    weekDays.forEach((d) => out.set(toKey(d), []));
    rituals.forEach((r) => {
      const key = toKey(toDate(r));
      if (out.has(key)) out.get(key).push(r);
    });
    weekDays.forEach((d) => out.get(toKey(d)).sort((a, b) => toDate(a) - toDate(b)));
    return out;
  }, [rituals, weekDays]);

  const liveCount = rituals.filter(isLive).length;
  const specialCount = rituals.filter((r) => r.is_special_event || r.type === 'Special Event').length;
  const friendCount = rituals.filter((r) => Number(r.friends_here || 0) > 0).length;
  const recurring = rituals.filter((r) => r.is_recurring);
  const progress = Math.min(100, Math.max(0, Math.round(((now.getDay() || 7) / 7) * 100)));
  const dayTitle = DAY_NAMES_TR[now.getDay()];

  const openRitual = (r) => r?.id && navigation.navigate('RitualDetail', { ritualId: r.id });

  const renderCompact = (r, idx, tone = 'n') => {
    const cap = Number(r.capacity || 0);
    const joined = Number(r.current_attendees || 0);
    const locked = cap > 0 && joined >= cap;
    return (
      <TouchableOpacity
        key={`compact-${r.id || idx}`}
        style={[
          styles.compact,
          tone === 'friends' && styles.compactFriends,
          tone === 'recurring' && styles.compactTeal,
          locked && styles.compactLocked,
          isDark && styles.cardDark,
        ]}
        onPress={() => !locked && openRitual(r)}
        activeOpacity={0.9}
      >
      <View style={styles.thumb}><Text style={styles.thumbText}>◉</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.compactTime}>
          {tone === 'friends' ? `👥 ${r.friends_here || 1} Arkadas` : tone === 'recurring' ? 'Seri' : fmtHM(r)}
        </Text>
        <Text style={[styles.compactTitle, isDark && styles.titleDark]} numberOfLines={1}>{r.title || 'Ritual'}</Text>
        <View style={styles.tags}>
          <Text style={styles.tag}>{venue(r, city)}</Text>
          {Number(r.capacity || 0) > 0 ? <Text style={styles.tag}>{`${Number(r.current_attendees || 0)}/${Number(r.capacity || 0)}`}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.compactBtn, locked ? styles.btnOff : tone === 'friends' ? styles.btnPurple : tone === 'recurring' ? styles.btnTeal : styles.btnNavy]}
        onPress={() => !locked && openRitual(r)}
      >
        <Text style={styles.compactBtnText}>{locked ? 'Bekle' : 'Katil'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
    );
  };

  const todayRows = weekMap.get(toKey(weekDays[0])) || [];
  const tomorrowRows = weekMap.get(toKey(weekDays[1])) || [];
  const sundayRows = weekMap.get(toKey(weekDays[6])) || [];
  const heroToday = todayRows.find(isLive) || todayRows[0] || null;
  const heroSunday = sundayRows[0] || null;
  const specialTomorrow = tomorrowRows.find((r) => r.is_special_event || r.type === 'Special Event');
  const toneFor = (r) => {
    if (!r) return '#d1d5db';
    if (isLive(r)) return '#dc2626';
    if (r.is_special_event || r.type === 'Special Event') return '#C8A96A';
    if (Number(r.friends_here || 0) > 0) return '#7c3aed';
    if (r.is_recurring) return '#0F766E';
    return '#9ca3af';
  };

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.banner, isDark && styles.cardDark]}>
        <View style={styles.bannerTop}>
          <View style={styles.bannerPattern} />
          <Text style={styles.bannerLabel}>📅 Bu Hafta · {city}</Text>
          <Text style={styles.bannerTitle}>{`${weekDays[0].getDate()} - ${weekDays[6].getDate()} Nisan`}</Text>
          <Text style={styles.bannerSub}>{`${rituals.length} Ritual bulundu`}</Text>
          <View style={styles.bannerStats}>
            <Text style={styles.bannerPill}>📅 7 gun</Text>
            <Text style={styles.bannerPill}>{`${rituals.length} Ritual`}</Text>
            <Text style={styles.bannerPill}>{`★ ${specialCount} Super Event`}</Text>
            <Text style={styles.bannerPill}>{`👥 ${friendCount} arkadas`}</Text>
          </View>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Haftanin ilerlemesi</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
          <Text style={styles.progressVal}>{dayTitle}</Text>
        </View>
      </View>

      <View style={styles.calStrip}>
        {weekDays.map((d, i) => {
          const rows = weekMap.get(toKey(d)) || [];
          const today = i === 0;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const hasLive = rows.some(isLive);
          return (
            <View key={`day-${toKey(d)}`} style={[styles.calDay, isWeekend && styles.calWeekend, today && styles.calToday]}>
              <Text style={[styles.calName, today && styles.calNameToday]}>{DAYS_TR[d.getDay()]}</Text>
              <Text style={[styles.calNum, today && styles.calNumToday]}>{d.getDate()}</Text>
              <Text style={[styles.calCount, hasLive && styles.calCountLive, today && styles.calCountToday]}>{rows.length}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.overview, isDark && styles.cardDark]}>
        <Text style={[styles.overviewTitle, isDark && styles.titleDark]}>Haftanin Genel Gorunumu</Text>
        <Text style={styles.overviewSub}>Kayitli ve planlanan Rituals</Text>
        <View style={styles.overviewGrid}>
          {weekDays.slice(0, 4).map((d) => {
            const rows = weekMap.get(toKey(d)) || [];
            const topRows = rows.slice(0, 2);
            const remaining = Math.max(0, rows.length - topRows.length);
            return (
              <View key={`ov-${toKey(d)}`} style={styles.ovCell}>
                <Text style={styles.ovDay}>{`${DAYS_TR[d.getDay()]} ${d.getDate()} · ${rows.length}`}</Text>
                {topRows.length === 0 ? <Text style={styles.ovEventMuted}>Plan yok</Text> : null}
                {topRows.map((r, idx) => (
                  <View key={`ovr-${r.id || idx}`} style={styles.ovEventRow}>
                    <View style={[styles.ovDot, { backgroundColor: toneFor(r) }]} />
                    <Text style={styles.ovEvent} numberOfLines={1}>{r.title || 'Ritual'}</Text>
                  </View>
                ))}
                {remaining > 0 ? (
                  <View style={styles.ovEventRow}>
                    <View style={[styles.ovDot, { backgroundColor: '#d4d4d8' }]} />
                    <Text style={styles.ovEventMuted}>{`+${remaining} daha`}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.dayHeader}>
        <View>
          <Text style={[styles.dayTitle, isDark && styles.titleDark]}>Bugun · {DAY_NAMES_TR[weekDays[0].getDay()]}</Text>
          <Text style={styles.daySub}>{`${weekDays[0].getDate()} Nisan 2026 · ${fmtHM({ start_time: now })}`}</Text>
        </View>
        <Text style={[styles.dayBadge, styles.dayBadgeToday]}>{todayRows.length} Ritual</Text>
      </View>

      {heroToday ? (
        <TouchableOpacity style={[styles.heroCard, isDark && styles.cardDark]} onPress={() => openRitual(heroToday)} activeOpacity={0.9}>
          <ImageBackground source={{ uri: heroToday.image_url || heroToday.cover_image_url || heroToday.venue_image_url || 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=900&q=80' }} style={styles.hero} imageStyle={styles.heroImg}>
            <View style={styles.heroOverlay} />
            <View style={styles.heroTop}>
              <Text style={[styles.heroChip, isLive(heroToday) ? styles.heroChipLive : styles.heroChipSoft]}>{isLive(heroToday) ? '● CANLI' : fmtHM(heroToday)}</Text>
              <Text style={styles.heroChipSoft}>{`${Number(heroToday.current_attendees || 0)} / ${Number(heroToday.capacity || 0) || '-'}`}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroName}>{heroToday.title || 'Ritual'}</Text>
              <Text style={styles.heroVenue}>{`📍 ${venue(heroToday, city)}`}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ) : null}

      {todayRows.slice(heroToday ? 1 : 0, 5).map((r, i) => renderCompact(r, i, Number(r.friends_here || 0) > 0 ? 'friends' : (r.is_recurring ? 'recurring' : 'n')))}

      <View style={styles.dayHeader}>
        <View>
          <Text style={[styles.dayTitle, isDark && styles.titleDark]}>Yarin · {DAY_NAMES_TR[weekDays[1].getDay()]}</Text>
          <Text style={styles.daySub}>{`${weekDays[1].getDate()} Nisan 2026`}</Text>
        </View>
        <Text style={[styles.dayBadge, styles.dayBadgeSe]}>★ Super Event</Text>
      </View>

      {specialTomorrow ? (
        <TouchableOpacity style={styles.seBanner} onPress={() => openRitual(specialTomorrow)} activeOpacity={0.92}>
          <Text style={styles.seTop}>★ SUPER EVENT</Text>
          <Text style={styles.seName}>{specialTomorrow.title || 'Super Event'}</Text>
          <Text style={styles.seMeta}>{`📍 ${venue(specialTomorrow, city)} · ${fmtHM(specialTomorrow)}`}</Text>
        </TouchableOpacity>
      ) : null}

      {tomorrowRows.filter((r) => r.id !== specialTomorrow?.id).slice(0, 3).map((r, i) => renderCompact(r, i + 10, r.is_recurring ? 'recurring' : 'n'))}

      {heroSunday ? (
        <>
          <View style={styles.dayHeader}>
            <View>
              <Text style={[styles.dayTitle, isDark && styles.titleDark]}>{DAY_NAMES_TR[weekDays[6].getDay()]}</Text>
              <Text style={styles.daySub}>{`${weekDays[6].getDate()} Nisan 2026`}</Text>
            </View>
            <Text style={[styles.dayBadge, styles.dayBadgeWeekend]}>{sundayRows.length} Ritual</Text>
          </View>
          {renderCompact(heroSunday, 100, heroSunday.is_recurring ? 'recurring' : 'n')}
        </>
      ) : null}

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={styles.sectionText}>Bu Hafta Seri</Text><View style={styles.line} /><Text style={styles.count}>{recurring.length}</Text></View>
      {recurring.slice(0, 4).map((r, i) => renderCompact(r, i + 200, 'recurring'))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden', marginBottom: 14 },
  bannerTop: { backgroundColor: '#0F766E', padding: 16, position: 'relative', overflow: 'hidden' },
  bannerPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
    backgroundColor: '#ffffff',
  },
  bannerLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  bannerTitle: { fontSize: 24, color: '#fff', marginBottom: 3, fontWeight: '500' },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 10 },
  bannerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bannerPill: { fontSize: 10, color: 'rgba(255,255,255,0.86)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '600' },
  progressRow: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { fontSize: 10, color: '#737373' },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#14B8A6' },
  progressVal: { fontSize: 10, color: '#0F766E', fontWeight: '700' },
  calStrip: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  calDay: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 10 },
  calWeekend: { backgroundColor: '#faf5ff' },
  calToday: { backgroundColor: '#1B2E4A' },
  calName: { fontSize: 8, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase' },
  calNameToday: { color: 'rgba(255,255,255,0.7)' },
  calNum: { fontSize: 18, color: '#111827', fontWeight: '500' },
  calNumToday: { color: '#fff' },
  calCount: { fontSize: 8, color: '#9ca3af' },
  calCountLive: { color: '#dc2626' },
  calCountToday: { color: 'rgba(255,255,255,0.55)' },
  overview: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12, marginBottom: 10 },
  overviewTitle: { fontSize: 16, color: '#111827', marginBottom: 2 },
  overviewSub: { fontSize: 10, color: '#9ca3af', marginBottom: 9 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ovCell: { width: '48%', backgroundColor: '#fafafa', borderRadius: 10, padding: 9 },
  ovDay: { fontSize: 9, color: '#6b7280', fontWeight: '700', marginBottom: 4 },
  ovEventRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ovDot: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  ovEvent: { fontSize: 10, color: '#374151', flex: 1 },
  ovEventMuted: { fontSize: 10, color: '#9ca3af' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  dayTitle: { fontSize: 17, color: '#111827', fontWeight: '500' },
  daySub: { fontSize: 11, color: '#a3a3a3', marginTop: 1 },
  dayBadge: { fontSize: 9, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontWeight: '700' },
  dayBadgeToday: { color: '#fff', backgroundColor: '#1B2E4A' },
  dayBadgeSe: { backgroundColor: 'rgba(200,169,106,0.2)', color: '#92400E' },
  dayBadgeWeekend: { backgroundColor: '#ede9fe', color: '#7c3aed' },
  heroCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  hero: { height: 140, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  heroTop: { paddingTop: 10, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 9 },
  heroName: { fontSize: 17, color: '#fff', fontWeight: '500', lineHeight: 21 },
  heroVenue: { fontSize: 10, color: 'rgba(255,255,255,0.58)' },
  heroChip: { fontSize: 9, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontWeight: '700' },
  heroChipLive: { backgroundColor: '#DC2626', color: '#fff' },
  heroChipSoft: { backgroundColor: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.9)' },
  compact: { marginHorizontal: 16, marginBottom: 5, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactFriends: { borderColor: 'rgba(124,58,237,0.2)' },
  compactTeal: { borderColor: 'rgba(15,118,110,0.2)' },
  compactLocked: { opacity: 0.55 },
  thumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbText: { color: '#fff', fontSize: 11 },
  compactTime: { fontSize: 9, color: '#9ca3af', fontWeight: '700', marginBottom: 2 },
  compactTitle: { fontSize: 13, color: '#111827', fontWeight: '600', marginBottom: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { fontSize: 7, color: '#6b7280', backgroundColor: '#f3f4f6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '600' },
  compactBtn: { borderRadius: 8, paddingHorizontal: 13, paddingVertical: 6, minWidth: 58, alignItems: 'center' },
  btnNavy: { backgroundColor: '#1B2E4A' },
  btnTeal: { backgroundColor: '#0F766E' },
  btnPurple: { backgroundColor: '#7c3aed' },
  btnOff: { backgroundColor: '#e5e7eb' },
  compactBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  seBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, backgroundColor: '#111827', padding: 12 },
  seTop: { color: '#C8A96A', fontSize: 9, fontWeight: '700', marginBottom: 4 },
  seName: { color: '#fff', fontSize: 19, marginBottom: 2 },
  seMeta: { color: 'rgba(255,255,255,0.58)', fontSize: 9 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 6, marginTop: 8 },
  line: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  sectionText: { fontSize: 9, color: '#0F766E', fontWeight: '700', textTransform: 'uppercase' },
  count: { fontSize: 9, color: '#a3a3a3', backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  titleDark: { color: '#f9fafb' },
});

