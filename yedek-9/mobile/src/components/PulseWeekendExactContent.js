import React, { useMemo, useState } from 'react';
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

const toDate = (r) => new Date(r?.start_time || Date.now());
const fmtHM = (r) => `${toDate(r).getHours().toString().padStart(2, '0')}:${toDate(r).getMinutes().toString().padStart(2, '0')}`;
const venue = (r, city) => r?.venue_name || r?.location_name || city;
const isLive = (r) => {
  const s = String(r?.status || '').toLowerCase();
  const t = String(r?.time_state || '').toLowerCase();
  if (s === 'live' || t === 'live_now') return true;
  const mins = Math.floor((Date.now() - toDate(r).getTime()) / 60000);
  return mins >= 0 && mins <= Math.max(90, Number(r?.duration || 90));
};

export default function PulseWeekendExactContent({
  rituals = [],
  city,
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const [activeDay, setActiveDay] = useState('sat');
  const saturday = useMemo(() => rituals.filter((r) => toDate(r).getDay() === 6).sort((a, b) => toDate(a) - toDate(b)), [rituals]);
  const sunday = useMemo(() => rituals.filter((r) => toDate(r).getDay() === 0).sort((a, b) => toDate(a) - toDate(b)), [rituals]);
  const rows = activeDay === 'sat' ? saturday : sunday;
  const special = rows.find((r) => r.is_special_event || r.type === 'Special Event');
  const hero = rows.find((r) => !r.is_special_event) || rows[0] || null;
  const friends = rows.filter((r) => Number(r.friends_here || 0) > 0).length;
  const morning = rows.filter((r) => toDate(r).getHours() < 12).length;
  const night = rows.filter((r) => toDate(r).getHours() >= 19).length;

  const openRitual = (r) => r?.id && navigation.navigate('RitualDetail', { ritualId: r.id });
  const pills = activeDay === 'sat'
    ? [
        `★ ${special ? 'Super Event' : 'Hafta Sonu'}`,
        `👥 ${friends} arkadas`,
        `🌅 ${morning} sabah`,
        `🌙 ${night} gece`,
      ]
    : [
        '🥞 Pazar',
        `👥 ${friends} arkadas`,
        `🌆 ${night} aksam`,
        `${rows.length} Ritual`,
      ];

  const renderCompact = (r, idx) => {
    const cap = Number(r.capacity || 0);
    const joined = Number(r.current_attendees || 0);
    const locked = cap > 0 && joined >= cap;
    const tone = Number(r.friends_here || 0) > 0 ? 'friends' : (r.is_special_event ? 'gold' : 'orange');
    return (
      <TouchableOpacity
        key={`wk-row-${r.id || idx}`}
        style={[
          styles.compact,
          tone === 'friends' && styles.compactFriends,
          tone === 'gold' && styles.compactGold,
          tone === 'orange' && styles.compactOrange,
          locked && styles.compactLocked,
          isDark && styles.cardDark,
        ]}
        onPress={() => !locked && openRitual(r)}
        activeOpacity={0.9}
      >
        <View style={[styles.compactAccent, tone === 'friends' ? styles.accentFriends : tone === 'gold' ? styles.accentGold : styles.accentOrange]} />
        <View style={styles.thumb}><Text style={styles.thumbText}>◉</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.compactTime}>{`${fmtHM(r)} · ${Number(r.friends_here || 0) > 0 ? `${r.friends_here} arkadas` : 'Hafta Sonu'}`}</Text>
          <Text style={[styles.compactTitle, isDark && styles.titleDark]} numberOfLines={1}>{r.title || 'Ritual'}</Text>
          <View style={styles.tags}>
            <Text style={styles.tag}>{venue(r, city)}</Text>
            {cap > 0 ? <Text style={styles.tag}>{`${joined}/${cap}`}</Text> : null}
          </View>
        </View>
        <TouchableOpacity style={[styles.compactBtn, locked ? styles.btnOff : Number(r.friends_here || 0) > 0 ? styles.btnPurple : styles.btnOrange]} onPress={() => !locked && openRitual(r)}>
          <Text style={styles.compactBtnText}>{locked ? 'Bekle' : 'Katil'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.banner}>
        <View style={styles.bannerPattern} />
        <View style={styles.bannerOverlay} />
        <Text style={styles.bannerLabel}>☀ Hafta Sonu · {city}</Text>
        <Text style={styles.bannerTitle}>Cumartesi &{'\n'}Pazar</Text>
        <Text style={styles.bannerSub}>{`${rituals.length} Ritual · Ozgur ol`}</Text>
        <View style={styles.bannerStats}>
          <Text style={styles.bannerPill}>{`★ ${special ? 1 : 0} Super Event`}</Text>
          <Text style={styles.bannerPill}>{`👥 ${friends} arkadas`}</Text>
          <Text style={styles.bannerPill}>{`🌅 ${morning} sabah`}</Text>
          <Text style={styles.bannerPill}>{`🌙 ${night} gece`}</Text>
        </View>
      </View>

      <View style={[styles.dayTabs, isDark && styles.cardDark]}>
        <TouchableOpacity style={[styles.dayTab, activeDay === 'sat' && styles.dayTabActive]} onPress={() => setActiveDay('sat')}>
          <Text style={[styles.dayTabName, activeDay === 'sat' && styles.dayTabNameActive]}>Cmt</Text>
          <Text style={[styles.dayTabNum, activeDay === 'sat' && styles.dayTabNumActive]}>19</Text>
          <Text style={[styles.dayTabCount, activeDay === 'sat' && styles.dayTabCountActive]}>{`${saturday.length} Ritual`}</Text>
          <View style={[styles.dayDot, activeDay === 'sat' && styles.dayDotActive, special ? styles.dayDotGold : null]} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dayTab, activeDay === 'sun' && styles.dayTabActive]} onPress={() => setActiveDay('sun')}>
          <Text style={[styles.dayTabName, activeDay === 'sun' && styles.dayTabNameActive]}>Paz</Text>
          <Text style={[styles.dayTabNum, activeDay === 'sun' && styles.dayTabNumActive]}>20</Text>
          <Text style={[styles.dayTabCount, activeDay === 'sun' && styles.dayTabCountActive]}>{`${sunday.length} Ritual`}</Text>
          <View style={[styles.dayDot, activeDay === 'sun' && styles.dayDotActive]} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
        {pills.map((p) => <Text key={p} style={styles.ctxPill}>{p}</Text>)}
      </ScrollView>

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={styles.sectionText}>{activeDay === 'sat' ? '☀ Cumartesi 19 Nisan' : '🌿 Pazar 20 Nisan'}</Text><View style={styles.line} /><Text style={styles.count}>{rows.length}</Text></View>

      {special ? (
        <TouchableOpacity style={styles.seCard} onPress={() => openRitual(special)} activeOpacity={0.9}>
          <Text style={styles.seTop}>★ SUPER EVENT</Text>
          <Text style={styles.seName}>{special.title || 'Super Event'}</Text>
          <Text style={styles.seMeta}>{`📍 ${venue(special, city)} · ${fmtHM(special)}`}</Text>
          <View style={styles.sePill}>
            <View style={styles.sePillDot} />
            <Text style={styles.sePillNum}>{Math.max(1, Number(special.current_attendees || 0))}</Text>
            <Text style={styles.sePillLbl}>sub-ritual</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {hero ? (
        <TouchableOpacity style={[styles.heroCard, isDark && styles.cardDark]} onPress={() => openRitual(hero)} activeOpacity={0.92}>
          <ImageBackground source={{ uri: hero.image_url || hero.cover_image_url || hero.venue_image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80' }} style={styles.hero} imageStyle={styles.heroImg}>
            <View style={styles.heroOverlay} />
            <View style={styles.heroTop}>
              <Text style={[styles.heroChip, isLive(hero) ? styles.heroChipLive : styles.heroChipOrange]}>{isLive(hero) ? '● CANLI' : `☀ ${fmtHM(hero)}`}</Text>
              <Text style={styles.heroChipSoft}>{`${Number(hero.current_attendees || 0)} / ${Number(hero.capacity || 0) || '-'}`}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroName}>{hero.title || 'Ritual'}</Text>
              <Text style={styles.heroVenue}>{`📍 ${venue(hero, city)}`}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ) : null}

      {rows.filter((r) => r.id !== hero?.id && r.id !== special?.id).slice(0, 5).map((r, i) => renderCompact(r, i))}

      <View style={styles.hTitleWrap}>
        <Text style={styles.hTitle}>{activeDay === 'sat' ? '🌙 Cumartesi Gece' : '🌆 Pazar Aksami'}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {rows.slice(0, 3).map((r, i) => (
          <TouchableOpacity key={`h-${r.id || i}`} style={[styles.hCard, isDark && styles.cardDark]} onPress={() => openRitual(r)} activeOpacity={0.9}>
            <View style={styles.hImg} />
            <View style={styles.hBody}>
              <Text style={[styles.hName, isDark && styles.titleDark]} numberOfLines={1}>{r.title || 'Ritual'}</Text>
              <Text style={styles.hMeta} numberOfLines={1}>{`${fmtHM(r)} · ${venue(r, city)}`}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeDay === 'sat' ? (
        <View style={[styles.moodCard, isDark && styles.cardDark]}>
          <View style={styles.moodHead}>
            <View>
              <Text style={styles.moodLabel}>Bu Cumartesi Icin</Text>
              <Text style={styles.moodTitle}>Nasil hissediyorsun?</Text>
            </View>
            <Text style={styles.moodIcon}>✨</Text>
          </View>
          <Text style={styles.moodText}>Ruh haline gore onerimiz olsun.</Text>
          <View style={styles.moodChips}>
            {['⚡ Enerjik', '🧘 Sakin', '🥂 Sosyal', '🎨 Kulturel'].map((m) => <Text key={m} style={styles.moodChip}>{m}</Text>)}
          </View>
        </View>
      ) : (
        <View style={styles.sundayCard}>
          <Text style={styles.sundayIcon}>🌿</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.sundayLabel}>Pazar Sabahi</Text>
            <Text style={styles.sundayTitle}>Yavas Bir Baslangic</Text>
            <Text style={styles.sundaySub}>{`${rows.length} Ritual · Huzurlu bir gun`}</Text>
          </View>
          <TouchableOpacity style={styles.sundayBtn}><Text style={styles.sundayBtnText}>Kesfet</Text></TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  banner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden', padding: 16, backgroundColor: '#EA580C' },
  bannerPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.07, backgroundColor: '#ffffff' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  bannerLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1.5 },
  bannerTitle: { fontSize: 26, color: '#fff', lineHeight: 31, marginBottom: 3, letterSpacing: -0.4 },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 10 },
  bannerStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bannerPill: { fontSize: 10, color: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontWeight: '600' },
  dayTabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  dayTab: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  dayTabActive: { backgroundColor: '#EA580C' },
  dayTabName: { fontSize: 10, color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  dayTabNameActive: { color: 'rgba(255,255,255,0.75)' },
  dayTabNum: { fontSize: 22, color: '#111827' },
  dayTabNumActive: { color: '#fff' },
  dayTabCount: { fontSize: 9, color: '#a3a3a3' },
  dayTabCountActive: { color: 'rgba(255,255,255,0.62)' },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EA580C', marginTop: 2 },
  dayDotActive: { backgroundColor: 'rgba(255,255,255,0.65)' },
  dayDotGold: { backgroundColor: '#C8A96A' },
  pillsRow: { paddingHorizontal: 16, gap: 6, marginBottom: 10 },
  ctxPill: { fontSize: 10, color: '#ea580c', backgroundColor: '#ffedd5', borderColor: 'rgba(234,88,12,0.25)', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  line: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  sectionText: { fontSize: 9, color: '#ea580c', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  count: { fontSize: 9, color: '#a3a3a3', backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  seCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, backgroundColor: '#111827', padding: 12 },
  seTop: { fontSize: 8, color: '#C8A96A', fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  seName: { fontSize: 20, color: '#fff', marginBottom: 2, lineHeight: 24 },
  seMeta: { fontSize: 9, color: 'rgba(255,255,255,0.55)' },
  sePill: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  sePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C8A96A' },
  sePillNum: { fontSize: 9, color: '#fff', fontWeight: '700' },
  sePillLbl: { fontSize: 8, color: 'rgba(255,255,255,0.45)' },
  heroCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', backgroundColor: '#fff' },
  hero: { height: 160, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroTop: { paddingTop: 10, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  heroBottom: { paddingHorizontal: 13, paddingBottom: 10 },
  heroName: { fontSize: 19, color: '#fff', marginBottom: 2, lineHeight: 23 },
  heroVenue: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  heroChip: { fontSize: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontWeight: '700' },
  heroChipLive: { backgroundColor: '#DC2626', color: '#fff' },
  heroChipOrange: { backgroundColor: '#EA580C', color: '#fff' },
  heroChipSoft: { fontSize: 8, color: 'rgba(255,255,255,0.82)', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, fontWeight: '600' },
  compact: { marginHorizontal: 16, marginBottom: 5, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  compactFriends: { borderColor: 'rgba(124,58,237,0.2)' },
  compactGold: { borderColor: 'rgba(200,169,106,0.3)' },
  compactOrange: { borderColor: 'rgba(234,88,12,0.2)' },
  compactLocked: { opacity: 0.55 },
  compactAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  accentFriends: { backgroundColor: '#7c3aed' },
  accentGold: { backgroundColor: '#C8A96A' },
  accentOrange: { backgroundColor: '#EA580C' },
  thumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  thumbText: { color: '#fff', fontSize: 11 },
  compactTime: { fontSize: 9, color: '#9ca3af', fontWeight: '600', marginBottom: 2 },
  compactTitle: { fontSize: 13, color: '#111827', fontWeight: '600', marginBottom: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  tag: { fontSize: 7, color: '#6b7280', backgroundColor: '#f3f4f6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '600' },
  compactBtn: { borderRadius: 8, paddingHorizontal: 13, paddingVertical: 6, minWidth: 58, alignItems: 'center' },
  btnOrange: { backgroundColor: '#EA580C' },
  btnPurple: { backgroundColor: '#7c3aed' },
  btnOff: { backgroundColor: '#e5e7eb' },
  compactBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  hTitleWrap: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 },
  hTitle: { fontSize: 9, color: '#a3a3a3', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.7 },
  hRow: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  hCard: { width: 165, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  hImg: { height: 90, backgroundColor: '#cbd5e1' },
  hBody: { padding: 10 },
  hName: { fontSize: 12, color: '#111827', marginBottom: 3 },
  hMeta: { fontSize: 9, color: '#6b7280' },
  moodCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  moodHead: { paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#A855F7', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moodLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 },
  moodTitle: { fontSize: 16, color: '#fff' },
  moodIcon: { fontSize: 22 },
  moodText: { paddingHorizontal: 14, paddingTop: 10, color: '#525252', fontSize: 12, marginBottom: 8 },
  moodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  moodChip: { fontSize: 10, color: '#ea580c', backgroundColor: '#ffedd5', borderColor: 'rgba(234,88,12,0.25)', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, fontWeight: '600' },
  sundayCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(22,163,74,0.18)', backgroundColor: '#dcfce7', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sundayIcon: { fontSize: 28 },
  sundayLabel: { fontSize: 10, color: '#16a34a', textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  sundayTitle: { fontSize: 15, color: '#111827', marginBottom: 2 },
  sundaySub: { fontSize: 10, color: '#737373' },
  sundayBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  sundayBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  titleDark: { color: '#f9fafb' },
});

