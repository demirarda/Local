import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PULSE } from '../constants/pulseTheme';

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80';

const formatClock = (dateString) => {
  if (!dateString) return '--:--';
  const d = new Date(dateString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const minsSinceStart = (dateString) => {
  if (!dateString) return 0;
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  return Math.max(0, diff);
};

const seatsMeta = (ritual) => {
  const current = Number(ritual?.current_attendees || 0);
  const capacity = Number(ritual?.capacity || 0);
  return { current, capacity, left: Math.max(0, capacity - current) };
};

export default function PulseLiveNowPerfectContent({
  liveRituals = [],
  city,
  navigation,
  loading,
  refreshing,
  onRefresh,
  isDark = false,
}) {
  const hero = liveRituals[0];
  const list = liveRituals;
  const navToRitual = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });

  const renderLiveBanner = () => {
    if (!hero) return null;
    const friends = Number(hero.friends_here || 0);
    const startedMins = minsSinceStart(hero.start_time);
    return (
      <TouchableOpacity style={[styles.liveBanner, isDark && styles.liveBannerDark]} onPress={() => navToRitual(hero.id)} activeOpacity={0.9}>
        <View style={styles.liveBannerLeftIcon}>
          <View style={styles.liveDotBig} />
        </View>
        <View style={styles.liveBannerInfo}>
          <View style={styles.liveBannerRow}>
            <Text style={styles.liveBannerTag}>CANLI</Text>
            <Text style={[styles.liveBannerMuted, isDark && styles.liveBannerMutedDark]}>
              {friends > 0 ? `${friends} arkadasin burada` : 'Canli Window acik'}
            </Text>
          </View>
          <Text style={styles.liveBannerTitle} numberOfLines={1}>{hero.title}</Text>
          <Text style={[styles.liveBannerSub, isDark && styles.liveBannerSubDark]} numberOfLines={1}>
            {`📍 ${hero.venue_name || ''} · ${formatClock(hero.start_time)} · ${startedMins} dk once basladi`}
          </Text>
        </View>
        <TouchableOpacity style={styles.joinMiniBtn} onPress={() => navToRitual(hero.id)}>
          <Text style={styles.joinMiniBtnText}>Katil</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderContext = () => (
    <View style={[styles.contextBanner, isDark && styles.contextBannerDark]}>
      <Text style={styles.contextIcon}>●</Text>
      <View style={styles.contextBody}>
        <Text style={styles.contextLabel}>Su an {city} icinde {liveRituals.length} Ritual canli</Text>
        <Text style={styles.contextSub}>
          Arkadaslarin farkli Ritualerde aktif, canli filtre acik
        </Text>
      </View>
      <Text style={styles.contextCount}>{liveRituals.length}</Text>
    </View>
  );

  const renderFirstLiveCard = (ritual) => {
    const meta = seatsMeta(ritual);
    const startedMins = minsSinceStart(ritual.start_time);
    return (
      <TouchableOpacity
        key={ritual.id || 'live-first'}
        style={[styles.card, styles.cardLive]}
        onPress={() => navToRitual(ritual.id)}
        activeOpacity={0.93}
      >
        <View style={styles.heroArea}>
          <ImageBackground source={{ uri: ritual.image_url || DEFAULT_IMG }} style={styles.heroImage} imageStyle={styles.heroImageInner} />
          <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={styles.heroOverlay}>
            <View style={styles.heroTop}>
              <View style={styles.livePill}>
                <View style={styles.livePillDot} />
                <Text style={styles.livePillText}>{`CANLI · ${startedMins} dk`}</Text>
              </View>
              <Text style={styles.seatPill}>{`${meta.current} / ${meta.capacity || '-'}`}</Text>
            </View>
            <View>
              <Text style={styles.heroName}>{ritual.title}</Text>
              <Text style={styles.heroVenue}>{`📍 ${ritual.venue_name || ''} · ${city}`}</Text>
            </View>
          </LinearGradient>
        </View>
        <View style={styles.body}>
          <View style={styles.rowBetween}>
            <View style={styles.tagsRow}>
              <Text style={[styles.tag, styles.tagLive]}>● Canli</Text>
              {ritual.is_host_verified ? <Text style={[styles.tag, styles.tagGreen]}>Verified</Text> : null}
              {ritual.is_special_event ? <Text style={[styles.tag, styles.tagGold]}>Special</Text> : null}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navToRitual(ritual.id)}>
              <Text style={styles.primaryBtnText}>Katil</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={[styles.footerText, isDark && styles.footerTextDark]}>
            {ritual.friends_here > 0 ? `${ritual.friends_here} arkadasi orada` : 'Canli etkinlik devam ediyor'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLiveCard = (ritual, index) => {
    if (index === 0) return renderFirstLiveCard(ritual);
    const meta = seatsMeta(ritual);
    return (
      <TouchableOpacity key={ritual.id || index} style={[styles.card, styles.cardLive]} onPress={() => navToRitual(ritual.id)} activeOpacity={0.93}>
        <View style={styles.bodyCompact}>
          <View style={styles.rowBetween}>
            <View style={styles.leftCol}>
              <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>{ritual.title}</Text>
              <Text style={styles.venue} numberOfLines={1}>
                {`📍 ${ritual.venue_name || ''} · ${city} · ${minsSinceStart(ritual.start_time)} dk once basladi`}
              </Text>
              <View style={styles.tagsRow}>
                <Text style={[styles.tag, styles.tagLive]}>● Canli</Text>
                {meta.capacity > 0 ? <Text style={[styles.tag, styles.tagGrey]}>{`${meta.current} / ${meta.capacity}`}</Text> : null}
                {ritual.is_venue_verified ? <Text style={[styles.tag, styles.tagNavy]}>Mekan Verified</Text> : null}
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navToRitual(ritual.id)}>
              <Text style={styles.primaryBtnText}>Katil</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {ritual.friends_here > 0 ? `${ritual.friends_here} arkadas orada` : 'Canli Window acik'}
          </Text>
          <Text style={styles.footerReact}>⚡</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const empty = !loading && liveRituals.length === 0;

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {renderLiveBanner()}
      {!empty && renderContext()}

      {!empty && (
        <View style={styles.sectionLabelWrap}>
          <Text style={styles.sectionLabel}>● Su an canli</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionCount}>{liveRituals.length}</Text>
        </View>
      )}

      {list.map((r, i) => renderLiveCard(r, i))}

      {empty && (
        <View style={[styles.emptyBox, isDark && styles.emptyBoxDark]}>
          <Text style={[styles.emptyTitle, isDark && styles.titleDark]}>Canli Ritual yok</Text>
          <Text style={styles.emptySub}>
            Su an canli Ritual gorunmuyor. Biraz sonra tekrar bak veya City Rhythm'e gec.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate(isDark ? 'CityRhythmDark' : 'CityRhythm')}>
            <Text style={styles.emptyBtnText}>City Rhythm'e bak</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#ffffff' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },

  liveBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: '#1B2E4A',
    borderWidth: 1,
    borderColor: '#2A4470',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBannerDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  liveBannerLeftIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220,38,38,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.5)',
  },
  liveDotBig: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  liveBannerInfo: { flex: 1 },
  liveBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  liveBannerTag: {
    color: '#DC2626',
    backgroundColor: 'rgba(220,38,38,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 8,
    fontWeight: '700',
  },
  liveBannerMuted: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  liveBannerMutedDark: { color: '#9ca3af' },
  liveBannerTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  liveBannerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  liveBannerSubDark: { color: '#9ca3af' },
  joinMiniBtn: { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  joinMiniBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  contextBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#1B2E4A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contextBannerDark: { backgroundColor: '#0f172a' },
  contextIcon: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
  contextBody: { flex: 1 },
  contextLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  contextSub: { color: 'rgba(255,255,255,0.45)', fontSize: 9, marginTop: 1 },
  contextCount: { color: '#DC2626', fontSize: 24, fontWeight: '500' },

  sectionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#F0F0F0' },
  sectionCount: {
    fontSize: 9,
    fontWeight: '600',
    color: '#A3A3A3',
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardLive: { borderColor: 'rgba(220,38,38,0.22)' },
  heroArea: { height: 170 },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroImageInner: { resizeMode: 'cover' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  livePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  livePillText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  seatPill: {
    color: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 8,
    fontWeight: '600',
  },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 2 },
  heroVenue: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },

  body: { paddingHorizontal: 13, paddingVertical: 10 },
  bodyCompact: { paddingHorizontal: 13, paddingVertical: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  leftCol: { flex: 1, minWidth: 0 },
  title: { color: '#000', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  titleDark: { color: '#f3f4f6' },
  venue: { color: '#A3A3A3', fontSize: 10, marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  tag: { fontSize: 8, fontWeight: '600', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  tagLive: { color: '#DC2626', backgroundColor: '#FEE2E2' },
  tagGreen: { color: '#166534', backgroundColor: '#EAF3DE' },
  tagNavy: { color: '#1B2E4A', backgroundColor: '#E8EDF4' },
  tagGold: { color: '#92400E', backgroundColor: 'rgba(200,169,106,0.2)' },
  tagGrey: { color: '#737373', backgroundColor: '#F5F5F5' },
  primaryBtn: { borderRadius: 10, backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 8 },
  primaryBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: { color: '#737373', fontSize: 10 },
  footerReact: { fontSize: 12 },

  emptyBox: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyBoxDark: { backgroundColor: '#111827', borderColor: '#1f2937' },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#000', marginBottom: 6 },
  emptySub: { fontSize: 11, color: '#A3A3A3', textAlign: 'center', marginBottom: 14, lineHeight: 17 },
  emptyBtn: { borderRadius: 12, backgroundColor: '#000', paddingHorizontal: 18, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
