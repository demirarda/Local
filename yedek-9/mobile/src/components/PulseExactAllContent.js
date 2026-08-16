/**
 * All tab content that matches pulse-screen-exact.html layout and styling.
 * Data is passed from PulseScreen (filteredRituals, pulseMemories, venueActivities).
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ImageBackground,
  Image,
  ActivityIndicator,
} from 'react-native';
import { pulseGridCardImage, pulseHeroImage, pulseMemoryImage } from '../constants/pulseExampleImages';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LiveNowCard from './LiveNowCard';
import VenueActivityCard from './VenueActivityCard';
import FriendActivityCard from './FriendActivityCard';
import { FriSpotifyCard, FriVoiceMemoCard } from './FriendsFeedCards';
import VenuePlaylistShareCard from './VenuePlaylistShareCard';
import ForumRepostCard from './ForumRepostCard';
import MemoryActionRow from './MemoryActionRow';
import { PULSE_SOCIAL_TAGS } from '../constants/pulseSocialTags';
import { PULSE, FONT_SERIF } from '../constants/pulseTheme';
import { t } from '../i18n/stringTable';

const { width } = Dimensions.get('window');
const PAD = 16;
const GAP = 10;
const FEED_VERTICAL_GAP = 14;
/** Mockup: belirgin full-bleed hero */
const HERO_HEIGHT = 320;
/** Special event hero — daha alçak şerit */
const HERO_HEIGHT_SPECIAL = 252;
const HERO_RADIUS = 18;
const CARD_RADIUS = 18;
/** Alt “post” memory kartı — sol kare foto */
const MEMORY_IMG = 88;
/** All sekmesinde hero + grid’de gösterilecek maksimum Ritual kartı (2 sütun, kaydırılabilir) */
const MAX_GRID_ITEMS = 6;
const FEED_ROW_COUNT = 14;

const formatTime = (dateString) => {
  const d = new Date(dateString);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const getTimeLabel = (ritual) => {
  if (ritual.time_state === 'live_now') return 'CANLI';
  if (ritual.time_state === 'starting_soon') {
    const start = new Date(ritual.start_time);
    const mins = Math.max(0, Math.floor((start - Date.now()) / 60000));
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}sa ${mins % 60}dk sonra`;
    return `${mins}dk sonra`;
  }
  if (ritual.time_state === 'almost_full') {
    const left = (ritual.capacity || 0) - (ritual.current_attendees || 0);
    return `${left} koltuk kaldı`;
  }
  return '';
};

const timeAgo = (dateString) => {
  const d = new Date(dateString);
  const mins = Math.floor((Date.now() - d) / 60000);
  const hrs = Math.floor(mins / 60);
  if (mins < 1) return 'Simdi';
  if (mins < 60) return `${mins} dk once`;
  return `${hrs} sa once`;
};

const stripPrefix = (value = '', prefix = '') => {
  if (!value) return '';
  if (!prefix) return String(value).trim();
  const text = String(value).trim();
  return text.toUpperCase().startsWith(prefix.toUpperCase()) ? text.slice(prefix.length).trim() : text;
};

const parsePipePayload = (value = '', prefix = '') => {
  const text = stripPrefix(value, prefix);
  if (!text) return [];
  return text.split('|').map((x) => x.trim()).filter(Boolean);
};

const cleanFeedText = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/\[Pulse Showcase\]\s*/gi, '')
    .replace(/\[Followed\]\s*/gi, '')
    .replace(/\[(PHOTO|QUOTE|VOICE|RESHARE|TAGGED)\]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.replace(/^(?:\[[^\]]+\]\s*)+/g, '').trim();
};

const cleanRitualTitle = (value = '') => {
  const raw = cleanFeedText(value);
  return raw.replace(/^\[[^\]]+\]\s*/g, '').trim();
};

const clampText = (value = '', max = 80) => {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

const deriveSocialTags = (ritual) => {
  const tags = [];
  const now = Date.now();
  const startMs = ritual?.start_time ? new Date(ritual.start_time).getTime() : null;
  const minutesToStart = startMs ? Math.floor((startMs - now) / 60000) : null;
  const seatsLeft = Math.max(0, Number(ritual?.capacity || 0) - Number(ritual?.current_attendees || 0));
  const entryType = String(ritual?.entry_type || '').toLowerCase();

  if (ritual?.time_state === 'live_now') tags.push(PULSE_SOCIAL_TAGS.LIVE);
  if (Number(ritual?.host_late_cancel_count || 0) > 0) tags.push(PULSE_SOCIAL_TAGS.LATE_CANCEL);
  if ((ritual?.friends_here || 0) > 0 || (ritual?.friends_interested || 0) > 0) tags.push(PULSE_SOCIAL_TAGS.FRIENDS_JOINING);
  if (ritual?.is_special_event || ritual?.type === 'Special Event') tags.push(PULSE_SOCIAL_TAGS.SPECIAL_EVENT);
  if (ritual?.time_state === 'starting_soon' || (minutesToStart != null && minutesToStart >= 0 && minutesToStart <= 30)) tags.push(PULSE_SOCIAL_TAGS.STARTING_SOON);
  if (seatsLeft === 1) tags.push(PULSE_SOCIAL_TAGS.ONE_SEAT_LEFT);
  if (ritual?.is_followed_host_hosting || ritual?.is_friend_hosting) tags.push(PULSE_SOCIAL_TAGS.HOST);
  if (ritual?.is_followed_venue_active || ritual?.venue_name) tags.push(PULSE_SOCIAL_TAGS.VENUE);
  if (minutesToStart != null && minutesToStart >= 0 && minutesToStart <= 30) tags.push(PULSE_SOCIAL_TAGS.LAST_30_MIN);
  if (ritual?.is_pivot_host) tags.push(PULSE_SOCIAL_TAGS.PIVOT_HOST);
  if (ritual?.is_recurring) tags.push(PULSE_SOCIAL_TAGS.RECURRING);
  if (ritual?.created_at && (now - new Date(ritual.created_at).getTime()) / 86400000 <= 7) tags.push(PULSE_SOCIAL_TAGS.NEW_RITUAL);
  if (ritual?.same_university) tags.push(PULSE_SOCIAL_TAGS.SAME_UNIVERSITY);
  if ((ritual?.mutual_friends_count || 0) > 0) tags.push(PULSE_SOCIAL_TAGS.MUTUAL_FRIENDS);
  if (ritual?.is_free_entry || entryType === 'open') tags.push(PULSE_SOCIAL_TAGS.FREE_ENTRY);
  if (ritual?.distance_meters != null || ritual?.distance_km != null) tags.push(PULSE_SOCIAL_TAGS.NEARBY);
  if (entryType === 'invite_only' || entryType === 'private') tags.push(PULSE_SOCIAL_TAGS.INVITE_ONLY);
  if (ritual?.time_state === 'almost_full' || seatsLeft <= 3) tags.push(PULSE_SOCIAL_TAGS.ALMOST_FULL);
  if (ritual?.viewer_is_attending) tags.push(PULSE_SOCIAL_TAGS.GOING);
  if (ritual?.same_neighborhood) tags.push(PULSE_SOCIAL_TAGS.NEIGHBORHOOD);
  if (ritual?.special_occasion) tags.push(PULSE_SOCIAL_TAGS.SPECIAL_OCCASION);
  if (seatsLeft > 0 && seatsLeft <= 2) tags.push(PULSE_SOCIAL_TAGS.URGENT_SEAT);

  return Array.from(new Set(tags));
};

/** 2 sütun grid — mockup’taki gibi kısa/uzun ritim */
function gridLayoutForCardType(type) {
  switch (type) {
    case 'special_event':
      return { thumbH: 52, minH: 198 };
    case 'live_now':
      return { thumbH: 66, minH: 232 };
    case 'almost_full':
      return { thumbH: 100, minH: 300 };
    case 'friend_activity':
    case 'friend_joined_live':
    case 'friend_interested_event':
      return { thumbH: 74, minH: 256 };
    case 'starting_soon':
      return { thumbH: 70, minH: 242 };
    default:
      return { thumbH: 76, minH: 252 };
  }
}

export default function PulseExactAllContent({
  filteredRituals = [],
  pulseMemories = [],
  pulseReposts = [],
  venueActivities = [],
  viewer = null,
  city,
  navigation,
  getCardType,
  loading,
  refreshing,
  onRefresh,
  contentMode = 'all',
  isDark = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  emptyActionRoute,
}) {
  const shuffle = (arr) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const pickOne = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

  const weightedPick = (weights, excluded = null) => {
    const keys = Object.keys(weights).filter((k) => k !== excluded && weights[k] > 0);
    const weighted = [];
    keys.forEach((k) => {
      const w = Math.max(1, Number(weights[k] || 1));
      for (let i = 0; i < w; i += 1) weighted.push(k);
    });
    return pickOne(weighted);
  };
  const normalizeLevel = (v) => String(v || '').toUpperCase().replace(/\s+/g, '');
  const toFlLevel = (memory) => {
    const raw =
      memory?.viewer_friend_level ??
      memory?.actor_friend_level ??
      memory?.friend_level ??
      memory?.viewer_fl ??
      memory?.fl;
    const n = normalizeLevel(raw);
    if (n === 'CORE') return 3;
    const m = n.match(/FL(\d+)/);
    if (m) return Number(m[1] || 0);
    if (typeof raw === 'number') return raw;
    return 0;
  };
  const hasFl1Permission = (memory, explicitFlag) => {
    if (explicitFlag === true) return true;
    if (explicitFlag === false) return false;
    const levels = Array.isArray(memory?.visible_to_levels) ? memory.visible_to_levels.map(normalizeLevel) : [];
    if (levels.includes('FL1') || levels.includes('FL2') || levels.includes('FL3') || levels.includes('CORE')) return true;
    return toFlLevel(memory) >= 1;
  };

  const classifyMemory = (memory) => {
    const content = String(memory?.content || '').trim();
    const lower = content.toLowerCase();
    if (memory?.spotify_playlist_url) return 'playlist';
    if (
      memory?.voice_note_url ||
      memory?.audio_url ||
      memory?.audio_uri ||
      lower.startsWith('[voice]') ||
      lower.startsWith('voice:')
    ) {
      return 'voice';
    }
    if (lower.startsWith('[reshare]') || lower.startsWith('reshare:')) return 'reshare';
    if (lower.startsWith('[tagged]') || lower.startsWith('tagged:')) return 'tagged';
    if (lower.startsWith('[quote]') || lower.startsWith('quote:')) return 'quote';
    return 'text';
  };


  const heroRitual = filteredRituals.find((r) => getCardType(r) === 'special_event') || filteredRituals[0];
  const specials = filteredRituals.filter((r) => getCardType(r) === 'special_event');
  const liveList = filteredRituals.filter((r) => getCardType(r) === 'live_now');
  const friendList = filteredRituals.filter((r) => getCardType(r) === 'friend_activity' || getCardType(r) === 'friend_joined_live' || getCardType(r) === 'friend_interested_event');
  const startingList = filteredRituals.filter((r) => getCardType(r) === 'starting_soon');
  const almostFullList = filteredRituals.filter((r) => getCardType(r) === 'almost_full');

  const seen = new Set();
  const heroId = heroRitual?.id || heroRitual?.ritual_id;
  if (heroId) seen.add(heroId);
  const pick = (list, n = 1) => {
    const out = [];
    for (const r of list || []) {
      const id = r.id || r.ritual_id;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      out.push(r);
      if (out.length >= n) break;
    }
    return out;
  };

  const gridItems = [
    ...pick(specials.filter((r) => r !== heroRitual), 4),
    ...pick(liveList, 10),
    ...pick(friendList, 4),
    ...pick(startingList, 14),
    ...pick(almostFullList, 8),
    ...pick(specials, 3),
    ...pick(liveList, 10),
    ...pick(startingList, 10),
    ...pick(friendList, 3),
    ...pick(almostFullList, 6),
  ].filter(Boolean).slice(0, MAX_GRID_ITEMS);

  const venue = venueActivities[0];
  const memoriesByMode = (() => {
    if (contentMode === 'memories') return pulseMemories;
    if (contentMode === 'playlist') return pulseMemories.filter((m) => classifyMemory(m) === 'playlist');
    if (contentMode === 'quotes') {
      return pulseMemories.filter((m) => {
        const kind = classifyMemory(m);
        return kind === 'quote' || kind === 'text';
      });
    }
    return pulseMemories;
  })();
  const memoryList = memoriesByMode.slice(0, 12);
  const nonPlaylistMemories = memoryList.filter((m) => !m.spotify_playlist_url);
  const playlistMemory = memoryList.find((m) => !!m.spotify_playlist_url) || null;
  const playlistMemories = memoryList.filter((m) => !!m.spotify_playlist_url);
  const quoteMemory = nonPlaylistMemories.find((m) => classifyMemory(m) === 'quote') || nonPlaylistMemories.find((m) => classifyMemory(m) === 'text') || null;
  const voiceMemory = nonPlaylistMemories.find((m) => classifyMemory(m) === 'voice') || null;
  const voiceMemories = nonPlaylistMemories.filter((m) => classifyMemory(m) === 'voice');
  const resharedMemory = nonPlaylistMemories.find((m) => classifyMemory(m) === 'reshare') || null;
  const taggedMemory = nonPlaylistMemories.find((m) => classifyMemory(m) === 'tagged') || null;
  const resharedCandidate = resharedMemory || nonPlaylistMemories[0] || null;
  const taggedCandidate = taggedMemory || nonPlaylistMemories[0] || null;
  const liveCount = filteredRituals.filter((r) => getCardType(r) === 'live_now').length;

  const excludedIds = new Set();
  if (heroId) excludedIds.add(heroId);
  const firstMemory = nonPlaylistMemories[0] || null;
  const secondMemory = nonPlaylistMemories[1] || null;
  const thirdMemory = nonPlaylistMemories[2] || null;
  const fourthMemory = nonPlaylistMemories[3] || null;
  if (firstMemory?.ritual_id) excludedIds.add(firstMemory.ritual_id);

  const liveForFeatured = liveList.find((r) => r.id && !excludedIds.has(r.id)) || null;
  if (liveForFeatured?.id) excludedIds.add(liveForFeatured.id);

  const friendForWide = friendList.find((r) => r.id && !excludedIds.has(r.id)) || null;
  if (friendForWide?.id) excludedIds.add(friendForWide.id);

  const gridItemsFiltered = gridItems.filter((item) => {
    const id = item.id || item.ritual_id;
    return !id || !excludedIds.has(id);
  });

  /** Hero + featured satırında kullanılanlar grid’den çıkarıldığında bazen grid boş kalır; kalan Ritualsi göster */
  const displayGridItems =
    gridItemsFiltered.length > 0
      ? gridItemsFiltered
      : filteredRituals
          .filter((r) => {
            const id = r.id || r.ritual_id;
            return id && !excludedIds.has(id);
          })
          .slice(0, MAX_GRID_ITEMS);

  const navToRitual = (id) => id && navigation.navigate('RitualDetail', { ritualId: id });
  const navToMemory = (memory) => {
    if (!memory?.id || String(memory.id).startsWith('synthetic-')) {
      if (memory?.ritual_id) navToRitual(memory.ritual_id);
      return;
    }
    navigation.navigate('MemoryDetail', { memory, memoryId: memory.id });
  };
  const firstRitual = filteredRituals[0] || null;
  const secondRitual = filteredRituals[1] || firstRitual;
  const fallbackVenue = venueActivities[0] || (firstRitual ? { name: firstRitual.venue_name || firstRitual.location_name, city } : null);
  const navToVenue = () => {
    const targetVenue = venue || fallbackVenue;
    if (targetVenue?.name || targetVenue?.venue_name) {
      navigation.navigate('FullRitualsList', {
        venueName: targetVenue.name || targetVenue.venue_name,
        venueCity: targetVenue.city || city,
        title: `${targetVenue.name || targetVenue.venue_name} Ritualsi`,
      });
    }
  };

  const syntheticMemoryFromRitual = (ritual, kind = 'text', index = 0) => {
    if (!ritual) return null;
    return {
      id: `synthetic-${kind}-${ritual.id || ritual.ritual_id || index}`,
      ritual_id: ritual.id || ritual.ritual_id,
      ritual_title: ritual.title,
      user_name: ritual.host?.name || ritual.host_name || 'Host',
      created_at: ritual.start_time || new Date().toISOString(),
      content:
        kind === 'quote'
          ? `${ritual.title} icin topluluk notu`
          : kind === 'voice'
            ? `${ritual.title} sonrasi kisa sesli not`
            : kind === 'photo'
              ? `${ritual.title} anisi`
              : `${ritual.title} paylasimi`,
      content_url: pulseGridCardImage(ritual, index),
      spotify_playlist_url:
        kind === 'playlist' ? 'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n' : null,
      transcript_summary: kind === 'voice' ? `${ritual.title} enerjisi cok yuksekti.` : null,
    };
  };

  const heroMemory = firstMemory || syntheticMemoryFromRitual(firstRitual, 'photo', 0);
  const quoteMemorySafe = quoteMemory || syntheticMemoryFromRitual(secondRitual, 'quote', 1);
  const voiceMemorySafe = voiceMemory || syntheticMemoryFromRitual(firstRitual, 'voice', 2);
  const playlistMemorySafe = playlistMemory || syntheticMemoryFromRitual(secondRitual, 'playlist', 3);
  const secondMemorySafe = secondMemory || syntheticMemoryFromRitual(firstRitual, 'photo', 4);
  const thirdMemorySafe = thirdMemory || syntheticMemoryFromRitual(secondRitual, 'quote', 5);
  const voiceMemoryCards = (voiceMemories.length > 0 ? voiceMemories : [voiceMemorySafe]).slice(0, 3);
  const playlistCards = (playlistMemories.length > 0 ? playlistMemories : [playlistMemorySafe]).slice(0, 3);
  const liveCards = (liveList.length > 0 ? liveList : startingList.length > 0 ? startingList : firstRitual ? [firstRitual] : []).slice(0, 3);

  const renderSectionLabel = (label) => (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>{label}</Text>
    </View>
  );

  const renderFeedDivider = (text) => (
    <View style={styles.feedDivider}>
      <View style={[styles.feedDividerLine, isDark && styles.feedDividerLineDark]} />
      <Text style={[styles.feedDividerText, isDark && styles.feedDividerTextDark]}>{text}</Text>
      <View style={[styles.feedDividerLine, isDark && styles.feedDividerLineDark]} />
    </View>
  );

  const renderHero = () => {
    if (!heroRitual) return null;
    const type = getCardType(heroRitual);
    const isSpecial = type === 'special_event';
    const friendsHere = heroRitual.friends_here || heroRitual.friends_interested || 0;
    const tags = deriveSocialTags(heroRitual);
    const interested = heroRitual.current_attendees || heroRitual.interested_count || 0;

    const heroInner = (
      <>
        <LinearGradient
          colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.62)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroInner}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {isSpecial
                ? PULSE_SOCIAL_TAGS.SPECIAL_EVENT
                : type === 'live_now'
                  ? PULSE_SOCIAL_TAGS.LIVE
                  : type === 'almost_full'
                    ? PULSE_SOCIAL_TAGS.ALMOST_FULL
                    : type === 'reopened'
                      ? PULSE_SOCIAL_TAGS.PIVOT_HOST
                      : heroRitual.start_time
                        ? PULSE_SOCIAL_TAGS.STARTING_SOON
                        : 'Bu Gece'}
            </Text>
          </View>
          <Text style={styles.heroTime}>
            {type === 'live_now'
              ? 'CANLI simdi'
              : type === 'almost_full'
                ? getTimeLabel(heroRitual)
                : heroRitual.start_time
                  ? `${formatTime(heroRitual.start_time)} Bu Gece`
                  : 'Bu Gece'}
          </Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{heroRitual.title}</Text>
          <Text style={styles.heroLoc}>
            📍 {heroRitual.venue_name || ''} · {city}
          </Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaTop}>
              {heroRitual.is_venue_verified ? (
                <View style={styles.heroVerified}>
                  <MaterialIcons name="verified" size={14} color="#e5e5e5" />
                  <Text style={styles.heroMetaText}>Dogrulanmis mekan</Text>
                </View>
              ) : null}
              {interested > 0 ? <Text style={styles.heroMetaText}>{interested} kisi ilgili</Text> : null}
            </View>
            {tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.map((t, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.heroBottom}>
            <View style={styles.friendsRow}>
              {friendsHere > 0 ? (
                <>
                  <View style={styles.avatars}>
                    <View style={styles.avatar} />
                    <View style={[styles.avatar, styles.avatar2]} />
                    <View style={[styles.avatar, styles.avatar3]} />
                  </View>
                  <Text style={styles.friendsText}>{friendsHere} arkadas ilgili</Text>
                </>
              ) : null}
            </View>
            <TouchableOpacity style={styles.btnHeroCta} onPress={() => navToRitual(heroRitual.id)} activeOpacity={0.88}>
              <Text style={styles.btnHeroCtaText}>Yer Kap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );

    const heroUri = pulseHeroImage(heroRitual);
    return (
      <TouchableOpacity
        onPress={() => navToRitual(heroRitual.id)}
        activeOpacity={0.95}
        style={styles.heroTouch}
      >
        <ImageBackground
          source={{ uri: heroUri }}
          resizeMode="cover"
          style={[styles.hero, isSpecial && styles.heroSpecialShort]}
          imageStyle={{ borderRadius: HERO_RADIUS }}
        >
          {heroInner}
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const renderGridCard = (item, index, options = {}) => {
    const { compact = false } = options;
    const type = getCardType(item);
    const thumbUri = pulseGridCardImage(item, index);
    const badgeLabel =
      type === 'special_event'
        ? 'OZEL ETKINLIK'
        : type === 'live_now'
          ? 'CANLI'
          : type === 'friend_activity' || type === 'friend_joined_live' || type === 'friend_interested_event'
            ? 'ARKADAS'
            : 'ONE CIKAN';

    const footerMeta = `${item.venue_name || city} · ${type === 'live_now' ? 'simdi' : getTimeLabel(item) || 'bugun'}`;
    const friendsHere = Number(item.friends_here || item.friends_interested || 0);

    return (
      <TouchableOpacity
        key={item.id || item.ritual_id || index}
        style={[styles.cardSquare, compact && styles.cardSquareTriple, isDark && styles.cardDark]}
        onPress={() => navToRitual(item.id)}
        activeOpacity={0.9}
      >
        <View style={styles.cardSquareCover}>
          <Image source={{ uri: thumbUri }} style={styles.cardSquareImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topBadge}>
            <View style={styles.cardBadgeSoon}>
              <Text style={styles.cardBadgeText}>{badgeLabel}</Text>
            </View>
          </View>
          <View style={styles.captionOverlay}>
            <Text style={[styles.captionTitle, compact && styles.captionTitleTriple]} numberOfLines={2}>
              {clampText(cleanRitualTitle(item.title), compact ? 42 : 56)}
            </Text>
            <Text style={styles.captionMeta} numberOfLines={1}>
              {footerMeta}
            </Text>
          </View>
        </View>
        {!compact ? (
          <View style={styles.squareFooter}>
            <View style={styles.squareFooterAvatar} />
            <Text style={styles.squareFooterName} numberOfLines={1}>
              {cleanFeedText(item.host_name || 'Host')}
            </Text>
            {friendsHere > 0 ? (
              <Text style={styles.squareFooterReactionText}>{friendsHere} arkadas</Text>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderEventCompactCard = (event, key) => {
    if (!event) return null;
    const social = `${event.friends_here || event.friends_interested || 0} arkadas`;
    const meta = `${event.start_time ? formatTime(event.start_time) : 'Bu Gece'} · ${event.venue_name || city}`;
    return (
      <TouchableOpacity
        key={key}
        style={styles.eventCompact}
        activeOpacity={0.9}
        onPress={() => navToRitual(event.id)}
      >
        <ImageBackground source={{ uri: pulseHeroImage(event) }} style={StyleSheet.absoluteFill} resizeMode="cover">
          <LinearGradient
            colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.7)', 'rgba(10,10,10,0.95)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
        <View style={styles.eventCompactTop}>
          <View style={styles.starPill}>
            <Text style={styles.starPillText}>OZEL</Text>
          </View>
        </View>
        <View style={styles.eventCompactBody}>
        <Text style={styles.eventCompactTitle} numberOfLines={2}>
            {clampText(cleanRitualTitle(event.title), 52)}
          </Text>
          <Text style={styles.eventCompactMeta} numberOfLines={1}>
            {meta}
          </Text>
          <View style={styles.eventCompactFooter}>
            <Text style={styles.eventCompactSocial} numberOfLines={1}>{social}</Text>
            <View style={styles.eventCompactCta}>
              <Text style={styles.eventCompactCtaText}>Koltuk Al</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemoryCard = (memory, memIndex) => {
    if (!memory) return null;
    const title = cleanRitualTitle(memory.ritual_title || memory.content || '') || 'Ritual';
    const meta = `${city} · ${memory.content ? 'Ani' : 'Sosyal'}`;
    const quote = cleanFeedText(stripPrefix(stripPrefix(stripPrefix(memory.content || '', '[PHOTO]'), '[QUOTE]'), 'quote:')) || 'Paylasim';
    const isHeroMemory = memIndex === 0;

    if (isHeroMemory) {
      return (
        <TouchableOpacity
          key={memory.id || 'hero-memory'}
          style={[styles.memoryHeroCard, isDark && styles.memoryHeroCardDark]}
          activeOpacity={0.9}
          onPress={() => navToMemory(memory)}
        >
          <View style={styles.memoryHeroCover}>
            <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.memoryHeroImg} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.memoryHeroStamp}>{timeAgo(memory.created_at)} · Ritual anisi</Text>
            <Text style={styles.memoryHeroCaption} numberOfLines={2}>
              {stripPrefix(title, '[Followed]')}
            </Text>
          </View>
          <View style={styles.memoryHeroBody}>
            <Text style={[styles.memoryHeroNote, isDark && styles.memoryHeroNoteDark]} numberOfLines={3}>
              "{quote}"
            </Text>
            <View style={styles.memoryHeroFooter}>
              <MemoryActionRow
                upvotes={Number(memory.upvotes || memory.upvote_count || 0)}
                downvotes={Number(memory.downvotes || memory.downvote_count || 0)}
                quotes={Number(memory.quotes || memory.comment_count || 0)}
                echoes={Number(memory.echoes || memory.echo_count || 0)}
                onSoz={() => navToMemory(memory)}
              />
              <View style={[styles.memoryBtn, isDark && styles.memoryBtnDark]}>
                <Text style={[styles.btnBlackText, isDark && styles.btnBlackTextDark]}>Oku</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View key={memory.id || `mem-${memIndex}`} style={[styles.memory, isDark && styles.memoryDark]}>
        <View style={styles.memoryHeader}>
          <View style={styles.cardBadgeFriend}><Text style={styles.cardBadgeTextWhite}>ARKADAS</Text></View>
          <Text style={[styles.memoryText, isDark && styles.memoryTextDark]}>bir ani paylasti · {timeAgo(memory.created_at)}</Text>
        </View>
        <View style={styles.memoryContent}>
          <Image
            source={{ uri: pulseMemoryImage(memory) }}
            style={styles.memoryImg}
            resizeMode="cover"
          />
          <View style={styles.memoryInfo}>
            <Text style={[styles.memoryTitle, isDark && styles.memoryTitleDark]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.memoryMeta, isDark && styles.memoryMetaDark]}>📍 {meta}</Text>
            <Text style={[styles.memoryQuote, isDark && styles.memoryQuoteDark]} numberOfLines={2}>{quote}</Text>
          </View>
        </View>
        <View style={styles.memoryFooter}>
          <MemoryActionRow
            upvotes={Number(memory.upvotes || memory.upvote_count || 0)}
            downvotes={Number(memory.downvotes || memory.downvote_count || 0)}
            quotes={Number(memory.quotes || memory.comment_count || 0)}
            echoes={Number(memory.echoes || memory.echo_count || 0)}
            onSoz={() => navToMemory(memory)}
          />
          <TouchableOpacity
            style={[styles.memoryBtn, isDark && styles.memoryBtnDark]}
            onPress={() => navToMemory(memory)}
          >
              <Text style={[styles.btnBlackText, isDark && styles.btnBlackTextDark]}>Aniyi Gor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderQuoteMemoryCard = () => {
    if (!quoteMemorySafe || quoteMemorySafe.id === heroMemory?.id) return null;
    const text =
      cleanFeedText(stripPrefix(stripPrefix(quoteMemorySafe.content, '[QUOTE]'), 'quote:')) ||
      cleanFeedText(quoteMemorySafe.content || '');
    return (
      <TouchableOpacity
        style={[styles.quoteMemoryCard, isDark && styles.quoteMemoryCardDark]}
        activeOpacity={0.92}
        onPress={() => quoteMemorySafe.ritual_id && navToRitual(quoteMemorySafe.ritual_id)}
      >
        <Text style={[styles.quoteMemoryText, isDark && styles.quoteMemoryTextDark]} numberOfLines={4}>
          {clampText(text, 160)}
        </Text>
        <View style={[styles.quoteMemoryFooter, isDark && styles.quoteMemoryFooterDark]}>
          <Text style={[styles.quoteMemoryMeta, isDark && styles.quoteMemoryMetaDark]}>
            {quoteMemorySafe.user_name || 'Host'} · {timeAgo(quoteMemorySafe.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEventMiniCard = () => {
    const event = liveForFeatured || heroRitual || null;
    if (!event) return null;
    const isSpecial = event?.is_special_event || event?.type === 'Special Event';
    return (
      <TouchableOpacity
        style={styles.eventMini}
        activeOpacity={0.9}
        onPress={() => navToRitual(event.id)}
      >
        <ImageBackground source={{ uri: pulseHeroImage(event) }} style={styles.eventMiniBg} resizeMode="cover">
          <LinearGradient colors={['rgba(10,10,10,0.85)', 'rgba(10,10,10,0.35)']} style={StyleSheet.absoluteFill} />
          <View style={styles.eventMiniContent}>
            <View style={styles.eventMiniLeft}>
              <Text style={styles.eventMiniBadge}>{isSpecial ? 'OZEL ETKINLIK' : 'BU GECE SEHIRDE'}</Text>
              <Text style={styles.eventMiniTitle} numberOfLines={1}>{cleanRitualTitle(event.title)}</Text>
              <Text style={styles.eventMiniMeta} numberOfLines={1}>
                {event.start_time ? formatTime(event.start_time) : 'Bu Gece'} · {event.venue_name || city}
              </Text>
            </View>
            <View style={styles.eventMiniCta}>
              <Text style={styles.eventMiniCtaText}>Koltuk Al</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const renderDualMemoryGrid = () => {
    const effectiveSecond = secondMemorySafe;
    const bookMemoryData = thirdMemorySafe || fourthMemory || syntheticMemoryFromRitual(firstRitual, 'quote', 6);
    if (!effectiveSecond && !bookMemoryData) return null;
    const bookTitleText =
      cleanFeedText(stripPrefix(stripPrefix(bookMemoryData?.content || '', '[QUOTE]'), 'quote:')) ||
      cleanRitualTitle(bookMemoryData?.ritual_title || '') ||
      'Ritual onerisi';
    return (
      <View style={styles.memoryGrid2}>
        <View style={styles.memoryCol}>
          {renderSectionLabel('FOTO ANI · ARKADAS')}
          {effectiveSecond ? (
            <TouchableOpacity style={[styles.polaroidMemory, isDark && styles.polaroidMemoryDark]} activeOpacity={0.9} onPress={() => effectiveSecond.ritual_id && navToRitual(effectiveSecond.ritual_id)}>
              <Image source={{ uri: pulseMemoryImage(effectiveSecond) }} style={styles.polaroidPhoto} resizeMode="cover" />
              <Text style={[styles.polaroidCaption, isDark && styles.polaroidCaptionDark]} numberOfLines={2}>
                {cleanFeedText(stripPrefix(effectiveSecond.content || 'unutulmaz bir aksam', '[PHOTO]'))}
              </Text>
              <Text style={[styles.polaroidMeta, isDark && styles.polaroidMetaDark]} numberOfLines={1}>
                {effectiveSecond.ritual_title || 'Ritual'} · {timeAgo(effectiveSecond.created_at)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.memoryCol}>
          {renderSectionLabel('KITAP ONERISI')}
          {bookMemoryData ? (
            <TouchableOpacity style={[styles.bookMemory, isDark && styles.bookMemoryDark]} activeOpacity={0.9} onPress={() => navToRitual(bookMemoryData?.ritual_id)}>
              <Text style={[styles.bookLabel, isDark && styles.bookLabelDark]}>KITAP · ONERI</Text>
              <Image source={{ uri: pulseMemoryImage(bookMemoryData) }} style={styles.bookCover} resizeMode="cover" />
              <Text style={[styles.bookTitle, isDark && styles.bookTitleDark]} numberOfLines={2}>
                {bookTitleText}
              </Text>
              <Text style={[styles.bookAuthor, isDark && styles.bookAuthorDark]} numberOfLines={2}>
                {bookMemoryData?.user_name || 'LOCAL Host'} onerdi
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderLiveChipCard = (live) => {
    if (!live) return null;
    return (
      <TouchableOpacity style={[styles.liveChipCard, isDark && styles.liveChipCardDark]} activeOpacity={0.9} onPress={() => navToRitual(live.id)}>
        <Image source={{ uri: pulseGridCardImage(live, 0) }} style={styles.liveChipThumb} resizeMode="cover" />
        <View style={styles.liveChipInfo}>
          <View style={styles.liveChipBadges}>
            <Text style={styles.livePulseBadge}>CANLI</Text>
          </View>
          <Text style={[styles.liveChipTitle, isDark && styles.liveChipTitleDark]} numberOfLines={1}>
            {cleanRitualTitle(live.title)}
          </Text>
          <Text style={[styles.liveChipMeta, isDark && styles.liveChipMetaDark]} numberOfLines={1}>
            {live.venue_name || city} · {(live.capacity || 0) - (live.current_attendees || 0)} yer kaldi
          </Text>
        </View>
        <View style={styles.liveChipCta}>
          <Text style={styles.liveChipCtaText}>Katil</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVenueMemoryCard = () => {
    const venueData = venue || fallbackVenue;
    if (!venueData) return null;
    const venueName = venueData.name || venueData.venue_name || 'Mekan';
    const venueCaptionBase = venueData?.upcoming_rituals?.[0]?.title || heroMemory?.ritual_title || firstRitual?.title || 'Ritual';
    const venueLogoUri = pulseMemoryImage(firstMemory || secondMemory || {});
    return (
      <TouchableOpacity style={[styles.venueMemory, isDark && styles.venueMemoryDark]} activeOpacity={0.92} onPress={navToVenue}>
        <View style={[styles.venueMemoryHeader, isDark && styles.venueMemoryHeaderDark]}>
          <Image source={{ uri: venueLogoUri }} style={styles.venueLogo} resizeMode="cover" />
          <View style={styles.venueLogoInfo}>
            <Text style={[styles.venueLogoName, isDark && styles.venueLogoNameDark]} numberOfLines={1}>{venueName}</Text>
            <Text style={[styles.venueLogoMeta, isDark && styles.venueLogoMetaDark]} numberOfLines={1}>{venueData.city || city} · bu hafta aktif</Text>
          </View>
          <Text style={[styles.venueFollowBtn, isDark && styles.venueFollowBtnDark]}>+ Takip</Text>
        </View>
        <View style={styles.venueMemoryBody}>
          <Text style={[styles.venueMemoryCaption, isDark && styles.venueMemoryCaptionDark]} numberOfLines={2}>
            "{venueCaptionBase} Ritualinden kareler"
          </Text>
          <View style={styles.venuePhotoStrip}>
            <Image source={{ uri: pulseMemoryImage(firstMemory || secondMemory || {}) }} style={styles.venueStripMain} resizeMode="cover" />
            <Image source={{ uri: pulseMemoryImage(secondMemory || thirdMemory || {}) }} style={styles.venueStripSide} resizeMode="cover" />
            <Image source={{ uri: pulseMemoryImage(thirdMemory || fourthMemory || {}) }} style={styles.venueStripSide} resizeMode="cover" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMutualMemoryCard = () => {
    const friendLike = friendForWide || firstRitual;
    if (!friendLike) return null;
    const left = heroMemory?.user_name || 'Birisi';
    const right = secondMemorySafe?.user_name || 'Arkadasi';
    return (
      <TouchableOpacity style={[styles.mutualMemory, isDark && styles.mutualMemoryDark]} activeOpacity={0.92} onPress={() => navToRitual(friendLike.id || friendLike.ritual_id)}>
        <Text style={[styles.mutualTitle, isDark && styles.mutualTitleDark]}>
          <Text style={styles.mutualStrong}>{left}</Text> ve <Text style={styles.mutualStrong}>{right}</Text> {cleanRitualTitle(friendLike.title || 'Ritualde')} bir araya geldi
        </Text>
        <View style={[styles.mutualFooter, isDark && styles.mutualFooterDark]}>
          <Text style={[styles.mutualContext, isDark && styles.mutualContextDark]}>{friendLike.venue_name || friendLike.location_name || city}</Text>
          <Text style={[styles.mutualCta, isDark && styles.mutualCtaDark]}>Rituale bak</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const memoryPool = [heroMemory, secondMemorySafe, thirdMemorySafe, fourthMemory, quoteMemorySafe, ...nonPlaylistMemories]
    .filter(Boolean);
  const showEventHero = contentMode === 'all' && Boolean(heroRitual);
  const heroRitualId = heroRitual?.id || heroRitual?.ritual_id;
  const ritualPoolBase = [heroRitual, liveForFeatured, friendForWide, ...displayGridItems, ...filteredRituals].filter(Boolean);
  const ritualPool = showEventHero
    ? ritualPoolBase.filter((r) => (r.id || r.ritual_id) !== heroRitualId)
    : ritualPoolBase;
  const showReposts = (contentMode === 'all' || contentMode === 'local_world') && pulseReposts.length > 0;
  const voicePool = [...voiceMemoryCards, voiceMemorySafe].filter(Boolean);
  const playlistPool = [...playlistCards, playlistMemorySafe].filter(Boolean);
  const venueCardAvailable = !!renderVenueMemoryCard();
  const mutualCardAvailable = !!renderMutualMemoryCard();

  const takeFromPool = (pool, key) => {
    const idx = takeFromPool._idx[key] || 0;
    const item = pool[idx % Math.max(pool.length, 1)] || null;
    takeFromPool._idx[key] = idx + 1;
    return item;
  };
  takeFromPool._idx = {};

  const renderMiniQuoteCard = (memory, key) => {
    if (!memory) return null;
    const text = cleanFeedText(stripPrefix(stripPrefix(memory.content || '', '[QUOTE]'), 'quote:')) || 'Geceden kalan bir satir';
    const author = cleanFeedText(memory.user_name || 'Host');
    return (
      <TouchableOpacity key={key} style={[styles.miniQuoteCard, isDark && styles.miniQuoteCardDark]} activeOpacity={0.9}>
        <View style={styles.miniBadge}>
          <View style={styles.cardBadgeSoon}>
            <Text style={styles.cardBadgeText}>ALINTI</Text>
          </View>
        </View>
        <Text style={[styles.miniQuoteText, isDark && styles.miniQuoteTextDark]} numberOfLines={4}>
          "{clampText(text, 90)}"
        </Text>
        <View style={[styles.miniQuoteFooter, isDark && styles.miniQuoteFooterDark]}>
          <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.miniQuoteAvatar} resizeMode="cover" />
          <Text style={[styles.miniQuoteMeta, isDark && styles.miniQuoteMetaDark]} numberOfLines={1}>
            {author}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPolaroidCard = (memory, key) => {
    if (!memory) return null;
    const author = cleanFeedText(memory.user_name || 'Arkadas');
    const caption = cleanFeedText(memory.content || memory.ritual_title || 'Ritual anisi');
    return (
      <TouchableOpacity key={key} style={[styles.polaroidCard, isDark && styles.polaroidCardDark]} activeOpacity={0.92}>
        <View style={styles.polaroidTop}>
          <View style={styles.cardBadgeSoon}><Text style={styles.cardBadgeText}>ARKADAS</Text></View>
        </View>
        <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.polaroidPhoto} resizeMode="cover" />
        <Text style={[styles.polaroidCaption, isDark && styles.polaroidCaptionDark]} numberOfLines={2}>{caption}</Text>
        <View style={[styles.polaroidBottom, isDark && styles.polaroidBottomDark]}>
          <View style={styles.polaroidAuthor}>
            <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.polaroidAvatar} resizeMode="cover" />
            <Text style={[styles.polaroidAuthorName, isDark && styles.polaroidAuthorNameDark]} numberOfLines={1}>{author}</Text>
          </View>
          <Text style={[styles.polaroidMeta, isDark && styles.polaroidMetaDark]}>{timeAgo(memory.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSpotifyTrackCard = (memory, key) => (
    <TouchableOpacity key={key} style={styles.spotifyTrackCard} activeOpacity={0.95}>
      <LinearGradient colors={['rgba(29,185,84,0.18)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.7 }} style={StyleSheet.absoluteFill} />
      <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.spotifyTrackCover} resizeMode="cover" />
      <View style={styles.spotifyTrackInfo}>
        <Text style={styles.spotifyTrackBrand}>SPOTIFY</Text>
        <Text style={styles.spotifyTrackTitle} numberOfLines={1}>{clampText(cleanRitualTitle(memory?.ritual_title || 'Late Night Jazz'), 34)}</Text>
        <Text style={styles.spotifyTrackArtist} numberOfLines={1}>{cleanFeedText(memory?.user_name || 'Arkadas')} paylasti</Text>
        <Text style={styles.spotifyTrackAttr} numberOfLines={2}>
          {t('music_attr_spotify', 'tr')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderNowPlayingCard = (memory, key) => (
    <TouchableOpacity key={key} style={styles.nowPlayingCard} activeOpacity={0.95}>
      <Text style={styles.nowPlayingLabel}>SIMDI CALIYOR</Text>
      <View style={styles.nowPlayingBody}>
        <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.nowPlayingCover} resizeMode="cover" />
        <View style={styles.nowPlayingInfo}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>{clampText(cleanRitualTitle(memory?.ritual_title || 'So What'), 28)}</Text>
          <Text style={styles.nowPlayingArtist} numberOfLines={1}>{cleanFeedText(memory?.user_name || 'Caffe Letterario')}</Text>
        </View>
        <View style={styles.nowPlayingBtn}><Text style={styles.nowPlayingBtnText}>Dinle</Text></View>
      </View>
    </TouchableOpacity>
  );

  const renderAudioStoryCard = (memory, key) => (
    <TouchableOpacity key={key} style={styles.audioStoryCard} activeOpacity={0.95}>
      <Text style={styles.audioStoryBrand}>SESLI HIKAYE</Text>
      <View style={styles.audioStoryBody}>
        <Image source={{ uri: pulseMemoryImage(memory) }} style={styles.audioStoryCover} resizeMode="cover" />
        <View style={styles.audioStoryInfo}>
          <Text style={styles.audioStoryTitle} numberOfLines={2}>{clampText(cleanRitualTitle(memory?.ritual_title || 'Navigli de bir aksam'), 56)}</Text>
          <Text style={styles.audioStoryAuthor} numberOfLines={1}>{cleanFeedText(memory?.user_name || 'Host')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderVenueAmbianceCard = (key) => {
    const venueData = venue || fallbackVenue;
    if (!venueData) return null;
    return (
      <TouchableOpacity key={key} style={styles.venueAmbianceCard} activeOpacity={0.95} onPress={navToVenue}>
        <Text style={styles.venueAmbianceLabel}>CANLI ORTAM SESI</Text>
        <View style={styles.venueAmbianceBody}>
          <Image source={{ uri: pulseMemoryImage(firstMemory || secondMemory || {}) }} style={styles.venueAmbianceThumb} resizeMode="cover" />
          <View style={styles.venueAmbianceInfo}>
            <Text style={styles.venueAmbianceTitle} numberOfLines={1}>{venueData.name || venueData.venue_name || 'Mekan'}</Text>
            <Text style={styles.venueAmbianceMeta} numberOfLines={1}>Vinil, sohbet, kahve sesleri</Text>
          </View>
          <View style={styles.venueAmbianceBtn}><Text style={styles.venueAmbianceBtnText}>Dinle</Text></View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupVoiceCard = (key) => {
    const friendLike = friendForWide || firstRitual;
    if (!friendLike) return null;
    return (
      <TouchableOpacity key={key} style={[styles.groupVoiceCard, isDark && styles.groupVoiceCardDark]} activeOpacity={0.95} onPress={() => navToRitual(friendLike.id || friendLike.ritual_id)}>
        <Text style={styles.groupVoiceLabel}>GRUP SESI</Text>
        <Text style={[styles.groupVoiceTitle, isDark && styles.groupVoiceTitleDark]} numberOfLines={1}>{clampText(cleanRitualTitle(friendLike.title || 'Birlikte soyledik'), 30)}</Text>
        <Text style={[styles.groupVoiceMeta, isDark && styles.groupVoiceMetaDark]} numberOfLines={1}>{friendLike.venue_name || city}</Text>
      </TouchableOpacity>
    );
  };

  const renderDualRow = (
    left,
    right,
    key,
    rowStyle = styles.rowDual,
    leftFlex = 1,
    rightFlex = 1
  ) => (
    <View key={key} style={rowStyle}>
      <View style={[styles.rowCol, { flex: leftFlex }]}>{left}</View>
      <View style={[styles.rowCol, { flex: rightFlex }]}>{right}</View>
    </View>
  );

  const baseLayoutWeights = {
    'full-hero': 3,
    'full-quote': 2,
    'full-live': 1,
    'full-spotify-track': 2,
    'full-now-playing': 1,
    'full-audio-story': 2,
    'full-venue-ambiance': 1,
    'full-group-voice': 2,
    'dual-square': 3,
    'dual-mini-quote': 2,
    'dual-mixed': 3,
    'dual-spotify-mix': 2,
    'dual-audio-mix': 2,
    'asym-left-mix': 2,
    'asym-right-mix': 2,
    'asym-spotify-playlist': 2,
    'asym-audio-mix': 2,
    'triple-square': 1,
  };

  const hasQuoteCard = !!quoteMemorySafe && quoteMemorySafe.id !== heroMemory?.id;
  const dynamicWeights = {
    ...baseLayoutWeights,
    'full-quote': hasQuoteCard ? baseLayoutWeights['full-quote'] : 0,
    'full-live': ritualPool.length > 0 ? baseLayoutWeights['full-live'] : 0,
    'full-spotify-track': playlistPool.length > 0 ? baseLayoutWeights['full-spotify-track'] : 0,
    'full-now-playing': playlistPool.length > 0 ? baseLayoutWeights['full-now-playing'] : 0,
    'full-audio-story': voicePool.length > 0 ? baseLayoutWeights['full-audio-story'] : 0,
    'full-venue-ambiance': venueCardAvailable ? baseLayoutWeights['full-venue-ambiance'] : 0,
    'full-group-voice': mutualCardAvailable ? baseLayoutWeights['full-group-voice'] : 0,
    'dual-square': ritualPool.length > 1 ? baseLayoutWeights['dual-square'] : 0,
    'dual-mini-quote': memoryPool.length > 1 ? baseLayoutWeights['dual-mini-quote'] : 0,
    'triple-square': ritualPool.length > 2 ? baseLayoutWeights['triple-square'] : 0,
    'dual-mixed': ritualPool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['dual-mixed'] : 0,
    'dual-spotify-mix': playlistPool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['dual-spotify-mix'] : 0,
    'dual-audio-mix': voicePool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['dual-audio-mix'] : 0,
    'asym-left-mix': ritualPool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['asym-left-mix'] : 0,
    'asym-right-mix': ritualPool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['asym-right-mix'] : 0,
    'asym-spotify-playlist': playlistPool.length > 0 && memoryPool.length > 0 ? baseLayoutWeights['asym-spotify-playlist'] : 0,
    'asym-audio-mix': voicePool.length > 0 && ritualPool.length > 0 ? baseLayoutWeights['asym-audio-mix'] : 0,
  };

  const feedLayouts = React.useMemo(() => {
    const generatedLayouts = ['full-hero'];
    let lastLayout = 'full-hero';
    while (generatedLayouts.length < FEED_ROW_COUNT) {
      const nextLayout = weightedPick(dynamicWeights, lastLayout);
      if (!nextLayout) break;
      generatedLayouts.push(nextLayout);
      lastLayout = nextLayout;
    }
    return generatedLayouts;
  }, [
    hasQuoteCard,
    ritualPool.length,
    voicePool.length,
    playlistPool.length,
    venueCardAvailable,
    mutualCardAvailable,
    memoryPool.length,
  ]);

  const feedRows = feedLayouts.map((layout, idx) => {
    if (layout === 'full-hero') {
      const mem = takeFromPool(memoryPool, 'memory');
      return mem ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderMemoryCard(mem, 0)}</View> : null;
    }
    if (layout === 'full-quote') {
      return <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderQuoteMemoryCard()}</View>;
    }
    if (layout === 'full-live') {
      const ritual = takeFromPool(ritualPool, 'ritual');
      return ritual ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderLiveChipCard(ritual)}</View> : null;
    }
    if (layout === 'full-audio-story') {
      const voice = takeFromPool(voicePool, 'voice');
      return voice ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderAudioStoryCard(voice, `audio-story-${idx}`)}</View> : null;
    }
    if (layout === 'full-spotify-track') {
      const playlist = takeFromPool(playlistPool, 'playlist');
      return playlist ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderSpotifyTrackCard(playlist, `spotify-track-${idx}`)}</View> : null;
    }
    if (layout === 'full-now-playing') {
      const playlist = takeFromPool(playlistPool, 'playlist');
      return playlist ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderNowPlayingCard(playlist, `now-playing-${idx}`)}</View> : null;
    }
    if (layout === 'full-venue-ambiance') {
      return venueCardAvailable ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderVenueAmbianceCard(`venue-amb-${idx}`)}</View> : null;
    }
    if (layout === 'full-group-voice') {
      return mutualCardAvailable ? <View key={`row-${idx}`} style={styles.wideCardWrap}>{renderGroupVoiceCard(`group-voice-${idx}`)}</View> : null;
    }
    if (layout === 'dual-mini-quote') {
      const m1 = takeFromPool(memoryPool, 'memory');
      const m2 = takeFromPool(memoryPool, 'memory');
      if (!m1 || !m2) return null;
      return renderDualRow(renderMiniQuoteCard(m1, `dual-mini-${idx}-1`), renderMiniQuoteCard(m2, `dual-mini-${idx}-2`), `row-${idx}`);
    }
    if (layout === 'dual-square') {
      const a = takeFromPool(ritualPool, 'ritual');
      const b = takeFromPool(ritualPool, 'ritual');
      if (!a || !b) return null;
      return renderDualRow(
        renderGridCard(a, idx * 2, { minHeightOverride: 312, thumbHeightOverride: 108 }),
        renderGridCard(b, idx * 2 + 1, { minHeightOverride: 312, thumbHeightOverride: 108 }),
        `row-${idx}`
      );
    }
    if (layout === 'triple-square') {
      const a = takeFromPool(ritualPool, 'ritual');
      const b = takeFromPool(ritualPool, 'ritual');
      const c = takeFromPool(ritualPool, 'ritual');
      if (!a || !b || !c) return null;
      return (
        <View key={`row-${idx}`} style={styles.rowTriple}>
          <View style={styles.rowCol}>{renderGridCard(a, idx * 3, { minHeightOverride: 286, thumbHeightOverride: 96, compact: true })}</View>
          <View style={styles.rowCol}>{renderGridCard(b, idx * 3 + 1, { minHeightOverride: 286, thumbHeightOverride: 96, compact: true })}</View>
          <View style={styles.rowCol}>{renderGridCard(c, idx * 3 + 2, { minHeightOverride: 286, thumbHeightOverride: 96, compact: true })}</View>
        </View>
      );
    }
    if (layout === 'dual-mixed') {
      const mem = takeFromPool(memoryPool, 'memory');
      const ritual = takeFromPool(ritualPool, 'ritual');
      if (!mem || !ritual) return null;
      return renderDualRow(
        renderPolaroidCard(mem, `mixed-polaroid-${idx}`),
        renderMiniQuoteCard(mem, `mixed-mini-${idx}`),
        `row-${idx}`
      );
    }
    if (layout === 'dual-spotify-mix') {
      const pl = takeFromPool(playlistPool, 'playlist');
      const quoteMem = takeFromPool(memoryPool, 'memory');
      if (!pl || !quoteMem) return null;
      return renderDualRow(
        <FriSpotifyCard fullWidth memory={pl} onPress={() => pl?.ritual_id && navToRitual(pl.ritual_id)} />,
        renderMiniQuoteCard(quoteMem, `mini-${idx}`),
        `row-${idx}`
      );
    }
    if (layout === 'dual-audio-mix') {
      const voice = takeFromPool(voicePool, 'voice');
      const quoteMem = takeFromPool(memoryPool, 'memory');
      if (!voice || !quoteMem) return null;
      return renderDualRow(
        <FriVoiceMemoCard
          fullWidth
          memory={{
            ...voice,
            user_name: voice?.user_name || 'Arkadas',
            created_at: voice?.created_at || new Date().toISOString(),
            content: cleanFeedText(stripPrefix(stripPrefix(voice?.content || '', '[VOICE]'), 'voice:')) || 'Sesli not',
          }}
          onPress={() => voice?.ritual_id && navToRitual(voice.ritual_id)}
        />,
        renderMiniQuoteCard(quoteMem, `dual-audio-mini-${idx}`),
        `row-${idx}`
      );
    }
    if (layout === 'asym-left-mix') {
      const quoteMem = takeFromPool(memoryPool, 'memory');
      const ritual = takeFromPool(ritualPool, 'ritual');
      if (!quoteMem || !ritual) return null;
      return renderDualRow(
        renderMiniQuoteCard(quoteMem, `asyml-${idx}`),
        renderEventCompactCard(ritual, `asym-event-left-${idx}`),
        `row-${idx}`,
        styles.rowAsymLeft,
        1,
        1.6
      );
    }
    if (layout === 'asym-right-mix') {
      const ritual = takeFromPool(ritualPool, 'ritual');
      const quoteMem = takeFromPool(memoryPool, 'memory');
      if (!quoteMem || !ritual) return null;
      return renderDualRow(
        renderEventCompactCard(ritual, `asym-event-right-${idx}`),
        renderMiniQuoteCard(quoteMem, `asymr-${idx}`),
        `row-${idx}`,
        styles.rowAsymRight,
        1.6,
        1
      );
    }
    if (layout === 'asym-spotify-playlist') {
      const quoteMem = takeFromPool(memoryPool, 'memory');
      const pl = takeFromPool(playlistPool, 'playlist');
      if (!quoteMem || !pl) return null;
      return renderDualRow(
        renderMiniQuoteCard(quoteMem, `asymsp-${idx}`),
        <FriSpotifyCard fullWidth memory={pl} onPress={() => pl?.ritual_id && navToRitual(pl.ritual_id)} />,
        `row-${idx}`,
        styles.rowAsymLeft,
        1,
        1.6
      );
    }
    if (layout === 'asym-audio-mix') {
      const voice = takeFromPool(voicePool, 'voice');
      const ritual = takeFromPool(ritualPool, 'ritual');
      if (!voice || !ritual) return null;
      return renderDualRow(
        <FriVoiceMemoCard
          fullWidth
          memory={{
            ...voice,
            user_name: voice?.user_name || 'Arkadas',
            created_at: voice?.created_at || new Date().toISOString(),
            content: cleanFeedText(stripPrefix(stripPrefix(voice?.content || '', '[VOICE]'), 'voice:')) || 'Sesli not',
          }}
          onPress={() => voice?.ritual_id && navToRitual(voice.ritual_id)}
        />,
        renderGridCard(ritual, idx, { minHeightOverride: 312, thumbHeightOverride: 108 }),
        `row-${idx}`,
        styles.rowAsymLeft,
        1,
        1.6
      );
    }
    return null;
  }).filter(Boolean);

  const renderFeaturedPair = () => {
    if (contentMode === 'memories' || contentMode === 'playlist' || contentMode === 'quotes') return null;
    const featuredMemory = secondMemory;
    if (!featuredMemory && !liveForFeatured) return null;

    // Prefer social-first: if we have two memories, show memory + memory instead of memory + live event.
    if (featuredMemory && nonPlaylistMemories[2]) {
      const thirdMemory = nonPlaylistMemories[2];
      return (
        <View style={styles.featureRow}>
          <View style={styles.featureCol}>
            <HostMemoryShareCard
              memory={featuredMemory}
              onPress={() => featuredMemory.ritual_id && navToRitual(featuredMemory.ritual_id)}
              city={city}
              fullWidth={false}
              gridHalf
            />
          </View>
          <View style={styles.featureCol}>
            <HostMemoryShareCard
              memory={thirdMemory}
              onPress={() => thirdMemory.ritual_id && navToRitual(thirdMemory.ritual_id)}
              city={city}
              fullWidth={false}
              gridHalf
            />
          </View>
        </View>
      );
    }

    if (featuredMemory && liveForFeatured) {
      return (
        <View style={styles.featureRow}>
          <View style={styles.featureCol}>
            <HostMemoryShareCard
              memory={featuredMemory}
              onPress={() => featuredMemory.ritual_id && navToRitual(featuredMemory.ritual_id)}
              city={city}
              fullWidth={false}
              gridHalf
            />
          </View>
          <View style={styles.featureCol}>
            <LiveNowCard
              ritual={liveForFeatured}
              onPress={() => navToRitual(liveForFeatured.id)}
              city={city}
              fullWidth={false}
              livenowPage
              pairGrid
            />
          </View>
        </View>
      );
    }

    if (featuredMemory) {
      return (
        <View style={styles.wideCardWrap}>
          <HostMemoryShareCard
            memory={featuredMemory}
            onPress={() => featuredMemory.ritual_id && navToRitual(featuredMemory.ritual_id)}
            city={city}
            fullWidth
            gridHalf={false}
          />
        </View>
      );
    }

    return (
      <View style={styles.wideCardWrap}>
        <LiveNowCard
          ritual={liveForFeatured}
          onPress={() => navToRitual(liveForFeatured.id)}
          city={city}
          fullWidth
          livenowPage
          pairGrid
        />
      </View>
    );
  };

  const hasContentByMode =
    contentMode === 'memories'
      ? memoryList.length > 0 ||
        !!firstMemory ||
        !!quoteMemory ||
        !!voiceMemory ||
        !!resharedCandidate ||
        !!taggedCandidate
      : contentMode === 'playlist'
        ? memoryList.length > 0 || !!playlistMemory
        : contentMode === 'quotes'
          ? memoryList.length > 0 || !!quoteMemory
          : Boolean(
              heroRitual ||
                displayGridItems.length > 0 ||
                venue ||
                memoryList.length > 0 ||
                !!liveForFeatured ||
                !!friendForWide ||
                pulseReposts.length > 0
            );
  const empty = !loading && !hasContentByMode;

  const renderReposts = () => {
    if (!showReposts) return null;
    return (
      <View style={styles.repostSection}>
        {renderSectionLabel('FORUM REPOST')}
        {pulseReposts.slice(0, 3).map((repost, index) => (
          <View key={repost.id || `repost-${index}`} style={index > 0 ? styles.repostCardGap : null}>
            <ForumRepostCard
              repost={repost}
              fullWidth
              onPress={() => {
                if (repost.source_ritual_id) {
                  navigation.navigate('RitualForum', { ritualId: repost.source_ritual_id });
                }
              }}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.scrollView, isDark && styles.scrollViewDark]}
      contentContainerStyle={[styles.scrollContent, isDark && styles.scrollContentDark]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onScroll={(e) => {
        if (!hasMore || loadingMore || typeof onLoadMore !== 'function') return;
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
        const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        if (remaining < 320) {
          onLoadMore();
        }
      }}
      scrollEventThrottle={160}
    >
      {showEventHero ? <View style={styles.heroWrap}>{renderHero()}</View> : null}
      {renderReposts()}
      {feedRows}

      {empty && (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
              {emptyTitle || 'Pulse bos'}
            </Text>
            <Text style={[styles.emptySub, isDark && styles.emptySubDark]}>
              {emptyMessage ||
                'Son 24 saatte bu kapsamda memory veya Ritual gorunmuyor.'}
            </Text>
            {emptyActionLabel && emptyActionRoute ? (
              <TouchableOpacity
                style={[styles.btnBlack, isDark && styles.btnGrayDark]}
                onPress={() => navigation.navigate(emptyActionRoute)}
              >
                <Text style={[styles.btnBlackText, isDark && styles.btnBlackTextDark]}>
                  {emptyActionLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
        </View>
      )}
      {loadingMore ? (
        <View style={styles.loadMoreWrap}>
          <ActivityIndicator size="small" color={isDark ? '#e5e7eb' : '#111827'} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: PULSE.screenLight },
  scrollViewDark: { backgroundColor: PULSE.screenDark },
  scrollContent: { paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 120 },
  scrollContentDark: { backgroundColor: PULSE.screenDark },
  sectionBlock: {
    marginBottom: 6,
    marginTop: 2,
  },
  heroWrap: { marginBottom: FEED_VERTICAL_GAP },
  repostSection: { marginBottom: FEED_VERTICAL_GAP },
  repostCardGap: { marginTop: 10 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9a9a9e',
    letterSpacing: 1.8,
    marginLeft: 4,
  },
  sectionLabelDark: {
    color: '#9ca3af',
  },
  feedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  feedDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f0f0f2',
  },
  feedDividerLineDark: {
    backgroundColor: '#273142',
  },
  feedDividerText: {
    fontFamily: FONT_SERIF,
    fontSize: 13,
    color: '#9a9a9e',
    fontStyle: 'italic',
  },
  feedDividerTextDark: {
    color: '#9ca3af',
  },
  heroTouch: {
    borderRadius: HERO_RADIUS,
    overflow: 'hidden',
    marginBottom: GAP,
  },
  hero: {
    height: HERO_HEIGHT,
    borderRadius: HERO_RADIUS,
    overflow: 'hidden',
  },
  heroSpecialShort: {
    height: HERO_HEIGHT_SPECIAL,
  },
  heroNoImage: {
    backgroundColor: '#1c1c1e',
  },
  heroInner: {
    flex: 1,
    padding: 18,
    justifyContent: 'flex-end',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#000000' },
  heroTime: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 4, letterSpacing: -0.3 },
  heroTitle: { fontSize: 20, fontFamily: FONT_SERIF, fontWeight: '400', color: '#ffffff', marginBottom: 6, lineHeight: 25 },
  heroLoc: { fontSize: 13, color: '#ffffff', marginBottom: 8 },
  heroMeta: { marginBottom: 4 },
  heroMetaTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  heroVerified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: 12, color: '#ffffff' },
  tags: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10 },
  tagText: { fontSize: 11, color: '#ffffff' },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  friendsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatars: { flexDirection: 'row' },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#cccccc', borderWidth: 2, borderColor: '#ffffff' },
  avatar2: { marginLeft: -8 },
  avatar3: { marginLeft: -8 },
  friendsText: { fontSize: 12, color: '#ffffff' },
  btnHeroCta: {
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  btnHeroCtaText: { fontSize: 14, fontWeight: '700', color: '#000000' },

  featureRow: { flexDirection: 'row', gap: GAP, marginBottom: GAP, alignItems: 'flex-start' },
  featureCol: { flex: 1, minWidth: 0 },
  featurePlaceholder: {
    flex: 1,
    minHeight: 302,
    height: 302,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  featurePlaceholderShort: {
    minHeight: 270,
    height: 270,
  },
  wideCardWrap: { marginBottom: FEED_VERTICAL_GAP, width: '100%', alignSelf: 'stretch' },
  rowDual: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
    marginBottom: FEED_VERTICAL_GAP,
  },
  rowAsymLeft: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
    marginBottom: FEED_VERTICAL_GAP,
  },
  rowAsymRight: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: GAP,
    marginBottom: FEED_VERTICAL_GAP,
  },
  rowTriple: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginBottom: FEED_VERTICAL_GAP,
  },
  rowCol: {
    flex: 1,
    minWidth: 0,
  },
  miniQuoteCard: {
    backgroundColor: '#fdfbf5',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  miniBadge: {
    marginBottom: 8,
  },
  miniQuoteCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  miniQuoteText: {
    fontFamily: FONT_SERIF,
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
  },
  miniQuoteTextDark: {
    color: '#f8fafc',
  },
  miniQuoteMeta: {
    fontSize: 10,
    color: '#6b7280',
    flex: 1,
  },
  miniQuoteMetaDark: {
    color: '#94a3b8',
  },
  miniQuoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e8e0cf',
    borderStyle: 'dashed',
  },
  miniQuoteFooterDark: {
    borderTopColor: '#374151',
  },
  miniQuoteAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e5e7eb',
  },
  polaroidCard: {
    flex: 1,
    backgroundColor: '#fdfbf5',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: 220,
  },
  polaroidCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  polaroidTop: { marginBottom: 8 },
  polaroidPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    marginBottom: 8,
  },
  polaroidCaption: {
    fontSize: 17,
    lineHeight: 19,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  polaroidCaptionDark: { color: '#f3f4f6' },
  polaroidBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e8e0cf',
    borderStyle: 'dashed',
  },
  polaroidBottomDark: { borderTopColor: '#374151' },
  polaroidAuthor: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  polaroidAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#d1d5db' },
  polaroidAuthorName: { fontSize: 10, fontWeight: '600', color: '#374151', flex: 1 },
  polaroidAuthorNameDark: { color: '#e5e7eb' },
  polaroidMeta: { fontSize: 9.5, color: '#9a9a9e' },
  polaroidMetaDark: { color: '#94a3b8' },
  spotifyTrackCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 14,
    minHeight: 118,
  },
  spotifyTrackCover: { width: 76, height: 76, borderRadius: 8 },
  spotifyTrackInfo: { flex: 1, justifyContent: 'center' },
  spotifyTrackBrand: { fontSize: 9.5, fontWeight: '700', color: '#1db954', marginBottom: 4 },
  spotifyTrackTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  spotifyTrackArtist: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8 },
  spotifyTrackAttr: { fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 14 },
  nowPlayingCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#0f1d44',
    minHeight: 110,
  },
  nowPlayingLabel: { fontSize: 9.5, fontWeight: '700', color: '#1db954', marginBottom: 12, letterSpacing: 1 },
  nowPlayingBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowPlayingCover: { width: 54, height: 54, borderRadius: 6 },
  nowPlayingInfo: { flex: 1 },
  nowPlayingTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  nowPlayingArtist: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  nowPlayingBtn: { backgroundColor: '#1db954', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  nowPlayingBtnText: { color: '#000', fontSize: 10.5, fontWeight: '700' },
  audioStoryCard: {
    borderRadius: 18,
    padding: 16,
    minHeight: 180,
    backgroundColor: '#0f1d44',
  },
  audioStoryBrand: { fontSize: 9.5, fontWeight: '700', color: '#c4b5fd', letterSpacing: 1, marginBottom: 12 },
  audioStoryBody: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  audioStoryCover: { width: 56, height: 56, borderRadius: 8 },
  audioStoryInfo: { flex: 1 },
  audioStoryTitle: { fontFamily: FONT_SERIF, fontSize: 18, lineHeight: 21, color: '#fff', marginBottom: 4 },
  audioStoryAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  venueAmbianceCard: {
    borderRadius: 18,
    padding: 14,
    minHeight: 110,
    backgroundColor: '#2d1b4e',
  },
  venueAmbianceLabel: { fontSize: 9.5, fontWeight: '700', color: '#c4b5fd', letterSpacing: 1, marginBottom: 14 },
  venueAmbianceBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  venueAmbianceThumb: { width: 48, height: 48, borderRadius: 8 },
  venueAmbianceInfo: { flex: 1 },
  venueAmbianceTitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 2 },
  venueAmbianceMeta: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  venueAmbianceBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, backgroundColor: '#fff' },
  venueAmbianceBtnText: { fontSize: 10.5, fontWeight: '700', color: '#4c1d95' },
  groupVoiceCard: {
    backgroundColor: '#faf7f0',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
  },
  groupVoiceCardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  groupVoiceLabel: { fontSize: 9.5, fontWeight: '700', color: '#8b5cf6', letterSpacing: 0.8, marginBottom: 10 },
  groupVoiceTitle: { fontSize: 13, fontWeight: '700', color: '#0a0a0a', marginBottom: 2 },
  groupVoiceTitleDark: { color: '#f8fafc' },
  groupVoiceMeta: { fontSize: 11, color: '#6b7280' },
  groupVoiceMetaDark: { color: '#94a3b8' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: GAP },
  cardSquare: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PULSE.borderLight,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    aspectRatio: 1 / 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSquareTriple: {
    aspectRatio: 1 / 1.3,
  },
  cardSquareCover: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f7f5f0',
  },
  cardSquareImage: {
    width: '100%',
    height: '100%',
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    zIndex: 2,
  },
  captionTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    fontWeight: '500',
    color: '#ffffff',
    lineHeight: 19,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  captionTitleTriple: {
    fontSize: 13,
    lineHeight: 15,
  },
  captionMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  squareFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f3f3',
  },
  squareFooterAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  squareFooterName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#2a2a2a',
  },
  squareFooterReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  squareFooterReactionText: {
    fontSize: 10,
    color: '#6b6b6f',
  },
  cardDark: { backgroundColor: PULSE.cardBodyDark, borderColor: PULSE.borderDark },
  cardBadgeSpecial: { backgroundColor: '#f5f5f5', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  cardBadgeLive: { backgroundColor: '#ff0000', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  cardBadgeFriend: { backgroundColor: '#1a1a1a', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  cardBadgeFull: { backgroundColor: '#1a1a1a', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  cardBadgeSoon: { backgroundColor: '#f0f0f0', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, alignSelf: 'flex-start' },
  cardBadgeText: { fontSize: 10, fontWeight: '600', color: '#000000' },
  cardBadgeTextWhite: { color: '#ffffff' },
  cardSubLive: { fontSize: 11, color: PULSE.red, fontWeight: '600', marginBottom: 3 },
  cardSubLiveDark: { color: '#f87171' },
  cardTitle: { fontSize: 15, fontFamily: FONT_SERIF, fontWeight: '400', marginBottom: 4, lineHeight: 19 },
  cardTitleDark: { color: PULSE.textDarkPrimary },
  cardSub: { fontSize: 11, color: '#666666', marginBottom: 2 },
  cardSubDark: { color: '#cccccc' },
  cardLoc: { fontSize: 11, color: '#666666', marginBottom: 6 },
  cardLocDark: { color: '#cccccc' },
  cardTags: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 8 },
  cardTag: { backgroundColor: '#f5f5f5', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  cardTagDark: { backgroundColor: '#111827' },
  cardTagText: { fontSize: 10, color: '#000000' },
  cardTagTextDark: { color: '#e5e7eb' },
  progress: { marginVertical: 6 },
  progressBar: { height: 6, backgroundColor: '#e8e8e8', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', backgroundColor: '#0a0a0a' },
  progressText: { fontSize: 11, fontWeight: '600', color: '#666666' },
  progressTextDark: { color: '#9ca3af' },
  btnBlack: { backgroundColor: '#000000', paddingVertical: 10, borderRadius: 999, alignItems: 'center', marginTop: 'auto' },
  btnGrayDark: { backgroundColor: '#f3f4f6' },
  btnBlackText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  btnBlackTextDark: { color: '#000000' },

  memory: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginBottom: FEED_VERTICAL_GAP,
    minHeight: 132,
  },
  memoryDark: {
    backgroundColor: PULSE.cardBodyDark,
    borderColor: PULSE.borderDark,
  },
  memoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  memoryText: { fontSize: 11, color: '#666666' },
  memoryTextDark: { color: '#9ca3af' },
  memoryContent: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  memoryImg: {
    width: MEMORY_IMG,
    height: MEMORY_IMG,
    borderRadius: 14,
    backgroundColor: '#e8e8e8',
  },
  memoryInfo: { flex: 1 },
  memoryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  memoryTitleDark: { color: '#f9fafb' },
  memoryMeta: { fontSize: 11, color: '#666666', marginBottom: 4 },
  memoryMetaDark: { color: '#9ca3af' },
  memoryQuote: { fontSize: 12, color: '#000000' },
  memoryQuoteDark: { color: '#e5e7eb' },
  memoryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memoryBtn: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#000000', borderRadius: 999 },
  memoryBtnDark: { backgroundColor: '#f3f4f6' },
  reactions: { flexDirection: 'row', gap: 6 },
  reactionIcon: { fontSize: 16 },
  memoryHeroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ededed',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: FEED_VERTICAL_GAP,
  },
  memoryHeroCardDark: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  memoryHeroCover: {
    height: 210,
    position: 'relative',
  },
  memoryHeroImg: {
    width: '100%',
    height: '100%',
  },
  memoryHeroStamp: {
    position: 'absolute',
    top: 12,
    left: 12,
    color: '#ffffff',
    fontSize: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    overflow: 'hidden',
  },
  memoryHeroCaption: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    color: '#ffffff',
    fontFamily: FONT_SERIF,
    fontSize: 27,
    lineHeight: 28,
  },
  memoryHeroBody: {
    padding: 14,
  },
  memoryHeroNote: {
    fontSize: 13,
    lineHeight: 20,
    color: '#2a2a2a',
    backgroundColor: '#faf7f0',
    borderLeftWidth: 3,
    borderLeftColor: '#b8891f',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  memoryHeroNoteDark: {
    color: '#e5e7eb',
    backgroundColor: '#1f2937',
    borderLeftColor: '#d4af37',
  },
  memoryHeroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteMemoryCard: {
    backgroundColor: '#fdfbf5',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: FEED_VERTICAL_GAP,
  },
  quoteMemoryCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  quoteMemoryText: {
    fontFamily: FONT_SERIF,
    fontSize: 24,
    lineHeight: 30,
    color: '#0a0a0a',
    marginBottom: 14,
  },
  quoteMemoryTextDark: {
    color: '#f8fafc',
  },
  quoteMemoryFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e8e0cf',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteMemoryFooterDark: {
    borderTopColor: '#374151',
  },
  quoteMemoryMeta: {
    fontSize: 11,
    color: '#6b6b6f',
  },
  quoteMemoryMetaDark: {
    color: '#94a3b8',
  },
  quoteMemoryLike: {
    fontSize: 16,
  },
  quoteMemoryLikeDark: {
    opacity: 0.9,
  },
  eventMini: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: FEED_VERTICAL_GAP,
    backgroundColor: '#0a0a0a',
  },
  eventMiniBg: {
    minHeight: 140,
    justifyContent: 'center',
  },
  eventMiniContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eventMiniLeft: {
    flex: 1,
    minWidth: 0,
  },
  eventMiniBadge: {
    alignSelf: 'flex-start',
    color: '#ffffff',
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  eventMiniTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 23,
    color: '#ffffff',
    marginBottom: 4,
  },
  eventMiniMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  eventMiniCta: {
    backgroundColor: '#ffffff',
    borderRadius: 99,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  eventMiniCtaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  eventCompact: {
    flex: 1,
    minHeight: 160,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    justifyContent: 'flex-end',
    padding: 14,
  },
  eventCompactTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  starPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  eventCompactBody: {
    zIndex: 2,
  },
  eventCompactTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    lineHeight: 19,
    color: '#ffffff',
    marginBottom: 5,
  },
  eventCompactMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 12,
  },
  eventCompactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventCompactSocial: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  eventCompactCta: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: '#ffffff',
  },
  eventCompactCtaText: {
    color: '#0a0a0a',
    fontSize: 11,
    fontWeight: '700',
  },
  memoryGrid2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: FEED_VERTICAL_GAP,
  },
  memoryCol: {
    flex: 1,
    minWidth: 0,
  },
  polaroidMemory: {
    backgroundColor: '#fdfbf5',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 14,
    padding: 10,
    minHeight: 228,
  },
  polaroidMemoryDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  polaroidPhoto: {
    width: '100%',
    height: 130,
    borderRadius: 6,
    marginBottom: 10,
  },
  polaroidCaption: {
    fontSize: 18,
    lineHeight: 20,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  polaroidCaptionDark: {
    color: '#f3f4f6',
  },
  polaroidMeta: {
    fontSize: 10.5,
    color: '#9a9a9e',
    textAlign: 'center',
    marginTop: 'auto',
  },
  polaroidMetaDark: {
    color: '#9ca3af',
  },
  bookMemory: {
    backgroundColor: '#faf7f0',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 14,
    padding: 12,
    minHeight: 228,
  },
  bookMemoryDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  bookLabel: {
    fontSize: 9,
    color: '#b8891f',
    letterSpacing: 1.4,
    fontWeight: '700',
    marginBottom: 8,
  },
  bookLabelDark: {
    color: '#eab308',
  },
  bookCover: {
    width: 74,
    height: 108,
    borderRadius: 5,
    marginBottom: 10,
  },
  bookTitle: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
    fontFamily: FONT_SERIF,
  },
  bookTitleDark: {
    color: '#f8fafc',
  },
  bookAuthor: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
  bookAuthorDark: {
    color: '#94a3b8',
  },
  liveChipCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ededed',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: FEED_VERTICAL_GAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveChipCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  liveChipThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  liveChipInfo: {
    flex: 1,
    minWidth: 0,
  },
  liveChipBadges: {
    marginBottom: 2,
  },
  livePulseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    backgroundColor: '#fde4e6',
    color: '#b91b28',
    fontSize: 9,
    fontWeight: '700',
  },
  liveChipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
    marginBottom: 1,
  },
  liveChipTitleDark: {
    color: '#f8fafc',
  },
  liveChipMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  liveChipMetaDark: {
    color: '#94a3b8',
  },
  liveChipCta: {
    backgroundColor: '#000000',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  liveChipCtaText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  venueMemory: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ededed',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: GAP,
  },
  venueMemoryDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  venueMemoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  venueMemoryHeaderDark: {
    borderBottomColor: '#374151',
  },
  venueLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#d1d5db',
  },
  venueLogoInfo: {
    flex: 1,
    minWidth: 0,
  },
  venueLogoName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  venueLogoNameDark: {
    color: '#f8fafc',
  },
  venueLogoMeta: {
    fontSize: 11,
    color: '#9a9a9e',
  },
  venueLogoMetaDark: {
    color: '#94a3b8',
  },
  venueFollowBtn: {
    fontSize: 11,
    color: '#374151',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  venueFollowBtnDark: {
    color: '#e2e8f0',
    borderColor: '#475569',
  },
  venueMemoryBody: {
    padding: 12,
  },
  venueMemoryCaption: {
    fontFamily: FONT_SERIF,
    fontSize: 17,
    color: '#374151',
    marginBottom: 10,
  },
  venueMemoryCaptionDark: {
    color: '#e5e7eb',
  },
  venuePhotoStrip: {
    flexDirection: 'row',
    gap: 4,
    height: 110,
  },
  venueStripMain: {
    flex: 2,
    borderRadius: 8,
  },
  venueStripSide: {
    flex: 1,
    borderRadius: 8,
  },
  mutualMemory: {
    backgroundColor: '#faf7f0',
    borderWidth: 1,
    borderColor: '#e8e0cf',
    borderRadius: 18,
    padding: 14,
    marginBottom: GAP,
  },
  mutualMemoryDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  mutualTitle: {
    fontFamily: FONT_SERIF,
    fontSize: 16,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 10,
  },
  mutualTitleDark: {
    color: '#e5e7eb',
  },
  mutualStrong: {
    fontWeight: '700',
    color: '#0a0a0a',
  },
  mutualFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e8e0cf',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutualFooterDark: {
    borderTopColor: '#374151',
  },
  mutualContext: {
    fontSize: 11,
    color: '#6b7280',
  },
  mutualContextDark: {
    color: '#94a3b8',
  },
  mutualCta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  mutualCtaDark: {
    color: '#f8fafc',
  },

  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#000000', marginBottom: 8 },
  emptyTitleDark: { color: '#f9fafb' },
  emptySub: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 16 },
  emptySubDark: { color: '#9ca3af' },
  loadMoreWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
