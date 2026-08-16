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

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const toStart = (r) => new Date(r?.start_time || Date.now());
const minsToStart = (r) => Math.max(0, Math.floor((toStart(r).getTime() - Date.now()) / 60000));
const fmtCountdown = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}s ${mins % 60}dk` : `${mins} dk`);

const spotMeta = (ritual) => {
  const cap = toNum(ritual.capacity, 0);
  const joined = toNum(ritual.current_attendees, 0);
  const left = Math.max(0, cap - joined);
  const ratio = cap > 0 ? left / cap : 1;
  if (left <= 2) return { tone: 'few', label: left <= 1 ? 'Son 1 yer!' : `Son ${left} yer!`, ratio };
  if (ratio <= 0.6) return { tone: 'some', label: `${left} yer kaldı`, ratio };
  return { tone: 'plenty', label: `${left} yer var`, ratio };
};

export default function PulseSeatsAvailableExactContent({
  rituals = [],
  city,
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const sorted = useMemo(() => {
    return [...rituals].sort((a, b) => {
      const sa = spotMeta(a);
      const sb = spotMeta(b);
      const rank = { few: 0, some: 1, plenty: 2 };
      if (rank[sa.tone] !== rank[sb.tone]) return rank[sa.tone] - rank[sb.tone];
      return minsToStart(a) - minsToStart(b);
    });
  }, [rituals]);

  const few = sorted.filter((r) => spotMeta(r).tone === 'few');
  const some = sorted.filter((r) => spotMeta(r).tone === 'some');
  const plenty = sorted.filter((r) => spotMeta(r).tone === 'plenty');
  const total = sorted.length;

  const openRitual = (r) => {
    if (!r?.id) return;
    navigation.navigate('RitualDetail', { ritualId: r.id });
  };

  const renderMainCard = (ritual, idx) => {
    const meta = spotMeta(ritual);
    const cap = toNum(ritual.capacity, 0);
    const joined = toNum(ritual.current_attendees, 0);
    const left = Math.max(0, cap - joined);
    const progress = Math.max(8, Math.min(100, Math.round((joined / Math.max(cap, 1)) * 100)));
    const isHero = idx === 0;
    return (
      <TouchableOpacity
        key={ritual.id || `card-${idx}`}
        style={[
          styles.card,
          meta.tone === 'few' && styles.cardFew,
          meta.tone === 'some' && styles.cardSome,
          meta.tone === 'plenty' && styles.cardPlenty,
          isDark && styles.cardDark,
        ]}
        onPress={() => openRitual(ritual)}
        activeOpacity={0.92}
      >
        {isHero ? (
          <ImageBackground
            source={{ uri: ritual.image_url || ritual.cover_image_url || ritual.venue_image_url || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80' }}
            style={styles.hero}
            imageStyle={styles.heroImg}
          >
            <View style={styles.heroOverlay} />
            <View style={styles.heroTop}>
              <Text style={[styles.spotBadge, meta.tone === 'few' && styles.spotBadgeFew, meta.tone === 'some' && styles.spotBadgeSome, meta.tone === 'plenty' && styles.spotBadgePlenty]}>
                {meta.label}
              </Text>
              <Text style={styles.heroTime}>{`${fmtCountdown(minsToStart(ritual))}`}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroTitle} numberOfLines={1}>{ritual.title || 'Ritual'}</Text>
              <Text style={styles.heroVenue} numberOfLines={1}>{`📍 ${ritual.venue_name || city}`}</Text>
            </View>
          </ImageBackground>
        ) : null}
        <View style={styles.body}>
          {!isHero ? (
            <View style={styles.cardHead}>
              <Text style={[styles.spotBadge, meta.tone === 'few' && styles.spotBadgeFew, meta.tone === 'some' && styles.spotBadgeSome, meta.tone === 'plenty' && styles.spotBadgePlenty]}>
                {meta.label}
              </Text>
              <Text style={styles.minisub}>{fmtCountdown(minsToStart(ritual))}</Text>
            </View>
          ) : null}
          {!isHero ? <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>{ritual.title || 'Ritual'}</Text> : null}
          <Text style={styles.venue} numberOfLines={1}>{`📍 ${ritual.venue_name || city}`}</Text>
          <View style={styles.occRow}>
            <View style={styles.occBg}>
              <View style={[styles.occFill, progress >= 75 ? styles.occFillFew : progress >= 45 ? styles.occFillSome : styles.occFillPlenty, { width: `${progress}%` }]} />
            </View>
            <Text style={[styles.occText, meta.tone === 'few' && styles.occTextFew, meta.tone === 'some' && styles.occTextSome, meta.tone === 'plenty' && styles.occTextPlenty]}>
              {`${joined} / ${cap || '-'} · ${left} yer`}
            </Text>
          </View>
          <View style={styles.tags}>
            <Text style={styles.tag}>{ritual.is_special_event ? '★ Super Event' : 'Yer Var'}</Text>
            {ritual.is_host_verified ? <Text style={styles.tag}>✓ Verified Host</Text> : null}
            {ritual.friends_here > 0 ? <Text style={styles.tag}>{`👥 ${ritual.friends_here} arkadaş`}</Text> : null}
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{ritual.friends_here > 0 ? `${ritual.friends_here} arkadaş orada` : 'Bağlantın yok'}</Text>
            <TouchableOpacity
              style={[styles.joinBtn, meta.tone === 'few' && styles.joinBtnFew, meta.tone === 'some' && styles.joinBtnSome, meta.tone === 'plenty' && styles.joinBtnPlenty]}
              onPress={() => openRitual(ritual)}
            >
              <Text style={styles.joinBtnText}>{meta.tone === 'few' ? 'Son Yer → Al' : 'Katıl'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMiniCard = (ritual, idx) => {
    const meta = spotMeta(ritual);
    const cap = toNum(ritual.capacity, 0);
    const joined = toNum(ritual.current_attendees, 0);
    const left = Math.max(0, cap - joined);
    return (
      <TouchableOpacity key={ritual.id || `mini-${idx}`} style={[styles.miniCard, isDark && styles.cardDark]} onPress={() => openRitual(ritual)} activeOpacity={0.92}>
        <ImageBackground
          source={{ uri: ritual.image_url || ritual.cover_image_url || ritual.venue_image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80' }}
          style={styles.miniHero}
          imageStyle={styles.miniHeroImg}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.miniTop}><Text style={[styles.miniSpot, meta.tone === 'plenty' ? styles.miniSpotGreen : styles.miniSpotAmber]}>{`${left} yer`}</Text></View>
          <View style={styles.miniBottom}>
            <Text style={styles.miniTitle} numberOfLines={1}>{ritual.title || 'Ritual'}</Text>
            <Text style={styles.miniVenue} numberOfLines={1}>{`📍 ${ritual.venue_name || city}`}</Text>
          </View>
        </ImageBackground>
        <View style={styles.miniBody}>
          <Text style={[styles.miniCount, meta.tone === 'plenty' ? styles.occTextPlenty : styles.occTextSome]}>{`${joined}/${cap || '-'}`}</Text>
          <TouchableOpacity style={[styles.miniBtn, meta.tone === 'plenty' ? styles.joinBtnPlenty : styles.joinBtnSome]} onPress={() => openRitual(ritual)}>
            <Text style={styles.miniBtnText}>Katıl</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.banner, isDark && styles.bannerDark]}>
        <View style={styles.bannerTop}>
          <View>
            <Text style={styles.bannerLabel}>◎ Yer Var Filtresi</Text>
            <Text style={[styles.bannerTitle, isDark && styles.titleDark]}>Seni bekleyen{'\n'}Rituals</Text>
            <Text style={styles.bannerSub}>{`Bugün ve bu hafta · ${city}`}</Text>
          </View>
          <View style={styles.totalWrap}>
            <Text style={styles.totalNum}>{total}</Text>
            <Text style={styles.totalUnit}>Ritual</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.statPill}>{`🟢 ${plenty.length} çok yer var`}</Text>
          <Text style={styles.statPill}>{`🟡 ${some.length} az yer`}</Text>
          <Text style={styles.statPill}>{`🔴 ${few.length} son 1-2`}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔴 Son 1-2 yer · Acil</Text>
        {few.slice(0, 2).map((r, i) => renderMainCard(r, i))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleAmber}>🟡 Az Yer Kaldı</Text>
        {some.slice(0, 1).map((r, i) => renderMainCard(r, i))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {some.slice(1, 7).map((r, i) => renderMiniCard(r, i))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleGreen}>🟢 Çok Yer Var</Text>
        {plenty.slice(0, 2).map((r, i) => renderMainCard(r, i))}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
          {plenty.slice(2, 9).map((r, i) => renderMiniCard(r, i))}
        </ScrollView>
      </View>

      {sorted.length === 0 ? (
        <View style={[styles.empty, isDark && styles.cardDark]}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Yer var Ritual yok</Text>
          <Text style={styles.venue}>Bu filtre için uygun Ritual gelmedi.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(22,163,74,0.2)',
    backgroundColor: '#f0fdf4',
    padding: 13,
  },
  bannerDark: { backgroundColor: '#052e1a', borderColor: '#166534' },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bannerLabel: { fontSize: 9, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  bannerTitle: { fontSize: 22, lineHeight: 24, color: '#111827' },
  bannerSub: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  totalWrap: { alignItems: 'flex-end' },
  totalNum: { fontSize: 34, color: '#16a34a', lineHeight: 34 },
  totalUnit: { fontSize: 9, color: '#16a34a', opacity: 0.7, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statPill: {
    fontSize: 9,
    color: '#16a34a',
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.2)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontWeight: '700',
  },
  section: { marginBottom: 6 },
  sectionTitle: { paddingHorizontal: 18, paddingBottom: 6, fontSize: 10, color: '#dc2626', fontWeight: '700' },
  sectionTitleAmber: { paddingHorizontal: 18, paddingBottom: 6, fontSize: 10, color: '#d97706', fontWeight: '700' },
  sectionTitleGreen: { paddingHorizontal: 18, paddingBottom: 6, fontSize: 10, color: '#16a34a', fontWeight: '700' },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  cardFew: { borderColor: 'rgba(220,38,38,0.22)' },
  cardSome: { borderColor: 'rgba(217,119,6,0.22)' },
  cardPlenty: { borderColor: 'rgba(22,163,74,0.22)' },
  hero: { height: 150, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 2 },
  heroVenue: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  heroTime: { color: 'rgba(255,255,255,0.85)', fontSize: 9, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  body: { padding: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  spotBadge: { color: '#fff', fontSize: 10, fontWeight: '700', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  spotBadgeFew: { backgroundColor: 'rgba(220,38,38,0.95)' },
  spotBadgeSome: { backgroundColor: 'rgba(217,119,6,0.95)' },
  spotBadgePlenty: { backgroundColor: 'rgba(22,163,74,0.95)' },
  minisub: { fontSize: 10, color: '#6b7280' },
  title: { fontSize: 15, color: '#111827', fontWeight: '600', marginBottom: 3 },
  titleDark: { color: '#f9fafb' },
  venue: { fontSize: 10, color: '#9ca3af', marginBottom: 8 },
  occRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  occBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' },
  occFill: { height: '100%', borderRadius: 3 },
  occFillFew: { backgroundColor: '#dc2626' },
  occFillSome: { backgroundColor: '#d97706' },
  occFillPlenty: { backgroundColor: '#16a34a' },
  occText: { fontSize: 10, fontWeight: '600' },
  occTextFew: { color: '#dc2626' },
  occTextSome: { color: '#d97706' },
  occTextPlenty: { color: '#16a34a' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tag: { fontSize: 8, color: '#525252', backgroundColor: '#f5f5f5', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  footerText: { fontSize: 10, color: '#6b7280', flex: 1 },
  joinBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  joinBtnFew: { backgroundColor: '#dc2626' },
  joinBtnSome: { backgroundColor: '#d97706' },
  joinBtnPlenty: { backgroundColor: '#16a34a' },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  hScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  miniCard: {
    width: 176,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  miniHero: { height: 85, justifyContent: 'space-between' },
  miniHeroImg: { resizeMode: 'cover' },
  miniTop: { paddingHorizontal: 7, paddingTop: 6 },
  miniSpot: { fontSize: 7, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  miniSpotGreen: { color: '#fff', backgroundColor: 'rgba(22,163,74,0.95)' },
  miniSpotAmber: { color: '#fff', backgroundColor: 'rgba(217,119,6,0.95)' },
  miniBottom: { paddingHorizontal: 7, paddingBottom: 6 },
  miniTitle: { color: '#fff', fontSize: 12, fontWeight: '600' },
  miniVenue: { color: 'rgba(255,255,255,0.65)', fontSize: 8 },
  miniBody: { paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniCount: { fontSize: 10, fontWeight: '700' },
  miniBtn: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  miniBtnText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  empty: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});

