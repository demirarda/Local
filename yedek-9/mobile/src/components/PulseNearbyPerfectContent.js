/**
 * Nearby tab content matching pulse-nearby-perfect.html layout and design.
 * Data from PulseScreen: rituals (location-based when useNearby), location, city.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PULSE_SOCIAL_TAGS } from '../constants/pulseSocialTags';
import { PULSE } from '../constants/pulseTheme';

const { width } = Dimensions.get('window');
const PAD = 16;
const GAP = 12;
const CARD_WIDTH = (width - PAD * 2 - GAP) / 2;
const HERO_HEIGHT = 240;
const CARD_IMG = 70;
const SPECIAL_IMG = 100;
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&q=80';
const BADGE_NEARBY = '#2d9d8f';

const formatTime = (dateString) => {
  if (!dateString) return '--:--';
  const d = new Date(dateString);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
const formatTimeLabel = (dateString) => {
  if (!dateString) return 'Bugün';
  const d = new Date(dateString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  if (isToday) return `Bugün ${formatTime(dateString)}`;
  if (isTomorrow) return `Yarın ${formatTime(dateString)}`;
  return `Bu Gece ${formatTime(dateString)}`;
};

export default function PulseNearbyPerfectContent({
  rituals = [],
  city = '',
  location,
  radiusKm = 2,
  navigation,
  loading,
  refreshing,
  onRefresh,
  onMapPress,
  isDark = false,
}) {
  const navToRitual = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });

  const heroRitual = rituals[0];
  const gridRituals = rituals.slice(1, 25);
  const afterGrid = rituals.slice(25);
  const specialRitual = afterGrid.find(r => r.is_special_event || r.type === 'Special Event') || null;
  const restRituals = specialRitual ? afterGrid.filter(r => r.id !== specialRitual.id).slice(0, 12) : afterGrid.slice(0, 12);
  const empty = !loading && rituals.length === 0;

  const getDistance = (r) => r.distance_km != null ? `${(r.distance_km * 1000).toFixed(0)}m uzaklıkta` : r.distance_meters ? `${r.distance_meters}m uzaklıkta` : null;
  const getWalkTime = (r) => r.walk_minutes != null ? `${r.walk_minutes} dk yürüyüş` : null;
  const getDistanceBadge = (r) => {
    const d = getDistance(r);
    const w = getWalkTime(r);
    if (d && w) return `${d} · ${w}`;
    if (d) return d;
    if (r.distance_km != null) return `${(r.distance_km * 1000).toFixed(0)}m uzaklıkta`;
    return null;
  };

  const renderHero = () => {
    if (!heroRitual) return null;
    const imgUri = heroRitual.image_url || heroRitual.venue_image_url || DEFAULT_IMG;
    const seatsLeft = Math.max(0, (heroRitual.capacity || 0) - (heroRitual.current_attendees || 0));
    const distanceStr = getDistanceBadge(heroRitual) || '350m uzaklıkta · 5 dk yürüyüş';

    return (
      <TouchableOpacity style={styles.hero} onPress={() => navToRitual(heroRitual.id)} activeOpacity={0.95}>
        <ImageBackground source={{ uri: imgUri }} style={styles.heroBg} imageStyle={styles.heroBgImg} />
        <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']} style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <View style={styles.heroBadges}>
            <View style={styles.badgeNearby}><Text style={styles.badgeNearbyText}>{PULSE_SOCIAL_TAGS.NEARBY}</Text></View>
            <View style={styles.distanceBadge}><Text style={styles.distanceBadgeText}>{distanceStr}</Text></View>
          </View>
          <Text style={styles.heroTime}>15 dk içinde başlıyor</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>{heroRitual.title}</Text>
          <Text style={styles.heroLocation}>📍 {heroRitual.venue_name || city}</Text>
          <Text style={styles.heroSeats}>{seatsLeft} koltuk kaldı</Text>
          <View style={styles.heroTags}>
            <View style={styles.tagWhite}><Text style={styles.tagWhiteText}>Sosyal</Text></View>
            <View style={styles.tagWhite}><Text style={styles.tagWhiteText}>Sakin</Text></View>
          </View>
          <TouchableOpacity style={styles.btnWhite} onPress={() => navToRitual(heroRitual.id)}><Text style={styles.btnWhiteText}>Şimdi Katıl</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSmallCard = (ritual, index) => {
    const imgUri = ritual.image_url || ritual.venue_image_url || DEFAULT_IMG;
    const isLive = ritual.time_state === 'live_now';
    const distanceStr = getDistanceBadge(ritual);
    const locationLine = distanceStr ? `📍 ${ritual.venue_name || city} · ${getWalkTime(ritual) || ''}`.trim() : `📍 ${ritual.venue_name || city}`;
    const seatsLeft = Math.max(0, (ritual.capacity || 0) - (ritual.current_attendees || 0));
    const friendsHere = ritual.friends_here || 0;

    return (
      <TouchableOpacity key={`nearby-${index}`} style={[styles.card, { width: CARD_WIDTH }]} onPress={() => navToRitual(ritual.id)} activeOpacity={0.9}>
        <Image source={{ uri: imgUri }} style={styles.cardImg} resizeMode="cover" />
        <View style={styles.cardContent}>
          <View style={styles.cardBadges}>
            <View style={styles.badgeNearby}><Text style={styles.badgeNearbyText}>{PULSE_SOCIAL_TAGS.NEARBY}</Text></View>
            {isLive && <Text style={styles.liveIndicator}>{`${PULSE_SOCIAL_TAGS.NEARBY} · ${PULSE_SOCIAL_TAGS.LIVE} · ${formatTime(ritual.start_time)}`}</Text>}
          </View>
          {!isLive && distanceStr ? <Text style={styles.cardInfo} numberOfLines={1}>{distanceStr}</Text> : null}
          {!isLive && !distanceStr && ritual.start_time ? <Text style={styles.cardInfo} numberOfLines={1}>{formatTimeLabel(ritual.start_time)}</Text> : null}
          <Text style={styles.cardTitle} numberOfLines={2}>{ritual.title}</Text>
          <Text style={styles.cardLocation} numberOfLines={1}>{locationLine}</Text>
          {isLive && (seatsLeft > 0 ? <View style={styles.cardFriends}><View style={styles.avatars}><View style={[styles.avatar, styles.avatarFirst]} /><View style={styles.avatar} /></View><Text style={styles.friendsText}>{seatsLeft} koltuk kaldı</Text></View> : friendsHere > 0 ? <View style={styles.cardFriends}><View style={styles.avatars}><View style={[styles.avatar, styles.avatarFirst]} /><View style={styles.avatar} /></View><Text style={styles.friendsText}>{friendsHere} arkadaş burada</Text></View> : null)}
          {!isLive && ritual.capacity && <Text style={styles.cardInfo}>{(ritual.current_attendees || 0)}/{(ritual.capacity)} koltuk dolu</Text>}
          {!isLive && (ritual.type || ritual.entry_type) && (
            <View style={styles.cardTags}>
              {!!ritual.type && <View style={styles.tag}><Text style={styles.tagText}>{ritual.type}</Text></View>}
              {String(ritual.entry_type || '').toLowerCase() === 'invite_only' && <View style={styles.tag}><Text style={styles.tagText}>{PULSE_SOCIAL_TAGS.INVITE_ONLY}</Text></View>}
              {(ritual.is_free_entry || String(ritual.entry_type || '').toLowerCase() === 'open') && <View style={styles.tag}><Text style={styles.tagText}>{PULSE_SOCIAL_TAGS.FREE_ENTRY}</Text></View>}
            </View>
          )}
          <TouchableOpacity style={styles.cardBtn} onPress={() => navToRitual(ritual.id)}><Text style={styles.cardBtnText}>{isLive ? 'Katıl' : 'Yer Ayırt'}</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSpecialCard = () => {
    if (!specialRitual) return null;
    const imgUri = specialRitual.image_url || specialRitual.venue_image_url || DEFAULT_IMG;
    const distanceStr = getDistanceBadge(specialRitual) || '1.8km uzaklıkta · 24 dk yürüyüş';

    return (
      <TouchableOpacity style={styles.specialEvent} onPress={() => navToRitual(specialRitual.id)} activeOpacity={0.95}>
        <Image source={{ uri: imgUri }} style={styles.specialImg} resizeMode="cover" />
        <View style={styles.specialContent}>
          <View style={styles.specialBadges}>
            <View style={styles.badgeNearby}><Text style={styles.badgeNearbyText}>{PULSE_SOCIAL_TAGS.NEARBY}</Text></View>
            <View style={styles.badgeSpecial}><Text style={styles.badgeSpecialText}>{PULSE_SOCIAL_TAGS.SPECIAL_EVENT}</Text></View>
            <Text style={styles.distanceText}>{distanceStr}</Text>
          </View>
          <Text style={styles.specialTime}>{formatTimeLabel(specialRitual.start_time)}</Text>
          <Text style={styles.specialTitle} numberOfLines={1}>{specialRitual.title}</Text>
          <Text style={styles.specialLocation} numberOfLines={1}>📍 {specialRitual.venue_name || city}</Text>
          <View style={styles.specialTags}>
            <View style={styles.tagWhite}><Text style={styles.tagWhiteText}>Müzik</Text></View>
            <View style={styles.tagWhite}><Text style={styles.tagWhiteText}>Sosyal</Text></View>
          </View>
          <View style={styles.specialBottom}>
            <View style={styles.specialFriends}>
              <View style={styles.avatars}><View style={[styles.avatar, styles.avatarFirst]} /><View style={styles.avatar} /><View style={styles.avatar} /></View>
              <Text style={styles.friendsText}>{(specialRitual.friends_interested || specialRitual.friends_here) || 12} arkadaş ilgileniyor</Text>
            </View>
            <TouchableOpacity style={styles.btnWhite} onPress={() => navToRitual(specialRitual.id)}><Text style={styles.btnWhiteText}>Yer Kap</Text></TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.scrollView, isDark && styles.scrollViewDark]}
      contentContainerStyle={styles.feedContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.locationBar}>
        <View style={styles.locationText}>
          <Text style={styles.locationEmoji}>📍</Text>
          <Text style={styles.locationLabel}>{radiusKm}km içindeki Rituals gösteriliyor</Text>
        </View>
        <TouchableOpacity style={styles.mapBtn} onPress={onMapPress} activeOpacity={0.8}>
          <Text style={styles.mapBtnText}>Harita Görünümü</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.feed}>
        {renderHero()}
        {gridRituals.length > 0 && (
          <View style={styles.grid}>
            {gridRituals.map((r, i) => renderSmallCard(r, i))}
          </View>
        )}
        {renderSpecialCard()}
        {restRituals.length > 0 && (
          <View style={styles.grid}>
            {restRituals.map((r, i) => renderSmallCard(r, 20 + i))}
          </View>
        )}
        {rituals.length > 0 && (
          <Text style={styles.footerText}>
            ℹ️ {radiusKm}km içinde {rituals.length} Ritual gösteriliyor · Yarıçapı değiştir
          </Text>
        )}
        {empty && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Yakında Ritual yok</Text>
            <Text style={styles.emptySub}>Konumunuza yakın Ritual bulunamadı. Konum iznini açın veya daha sonra tekrar deneyin.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onRefresh}>
              <Text style={styles.emptyBtnText}>Yenile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: PULSE.screenLight },
  scrollViewDark: { backgroundColor: PULSE.screenDark },
  feedContainer: { paddingHorizontal: PAD, paddingBottom: 120 },
  locationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f8f8', borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 16, padding: 12, marginBottom: 12 },
  locationText: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationEmoji: { fontSize: 15 },
  locationLabel: { fontSize: 15, fontWeight: '500', color: '#000000' },
  mapBtn: { backgroundColor: '#e8e8e8', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14 },
  mapBtnText: { fontSize: 13, fontWeight: '600', color: '#000000' },
  feed: { gap: GAP },
  hero: { height: HERO_HEIGHT, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  heroBg: { ...StyleSheet.absoluteFillObject },
  heroBgImg: { resizeMode: 'cover', opacity: 0.6 },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { flex: 1, padding: 14, justifyContent: 'flex-end' },
  heroBadges: { flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' },
  badgeNearby: { backgroundColor: BADGE_NEARBY, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeNearbyText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  distanceBadge: { marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  distanceBadgeText: { fontSize: 11, fontWeight: '500', color: '#ffffff' },
  heroTime: { fontSize: 15, color: '#ffffff', marginBottom: 4 },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  heroLocation: { fontSize: 13, color: '#ffffff', marginBottom: 4 },
  heroSeats: { fontSize: 13, color: '#ffffff', marginBottom: 8 },
  heroTags: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tagWhite: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  tagWhiteText: { fontSize: 11, fontWeight: '500', color: '#ffffff' },
  btnWhite: { backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 18, alignSelf: 'flex-end' },
  btnWhiteText: { fontSize: 14, fontWeight: '700', color: '#000000' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { flexDirection: 'row', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 16, padding: 10, gap: 8 },
  cardImg: { width: CARD_IMG, height: CARD_IMG, borderRadius: 10 },
  cardContent: { flex: 1, minWidth: 0 },
  cardBadges: { flexDirection: 'row', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  liveIndicator: { fontSize: 11, fontWeight: '700', color: '#ff0000' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#000000', marginBottom: 2 },
  cardLocation: { fontSize: 11, color: BADGE_NEARBY, marginBottom: 2 },
  cardInfo: { fontSize: 11, color: '#666666', marginBottom: 2 },
  cardTags: { flexDirection: 'row', gap: 4, marginTop: 3, marginBottom: 6 },
  tag: { backgroundColor: '#f0f0f0', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  tagText: { fontSize: 10, fontWeight: '500', color: '#666666' },
  cardFriends: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#666666', borderWidth: 2, borderColor: '#ffffff', marginLeft: -6 },
  avatarFirst: { marginLeft: 0 },
  friendsText: { fontSize: 11, color: '#666666' },
  cardBtn: { backgroundColor: '#000000', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, alignSelf: 'flex-start', marginTop: 6 },
  cardBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  specialEvent: { flexDirection: 'row', backgroundColor: '#000000', borderRadius: 16, padding: 14, gap: 12 },
  specialImg: { width: SPECIAL_IMG, height: SPECIAL_IMG, borderRadius: 12 },
  specialContent: { flex: 1 },
  specialBadges: { flexDirection: 'row', gap: 6, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' },
  badgeSpecial: { backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  badgeSpecialText: { fontSize: 10, fontWeight: '700', color: '#666666' },
  distanceText: { fontSize: 11, marginLeft: 'auto', color: '#ffffff' },
  specialTime: { fontSize: 12, color: '#ffffff', marginBottom: 4 },
  specialTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  specialLocation: { fontSize: 12, color: '#ffffff', marginBottom: 6 },
  specialTags: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  specialBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  specialFriends: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { textAlign: 'center', fontSize: 13, color: '#666666', marginTop: 12, paddingVertical: 12 },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#000000', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#000000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16 },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
});
