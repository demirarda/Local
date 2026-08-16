import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import SpecialEventCard from '../components/SpecialEventCard';
import EventGroupUmbrellaCard from '../components/EventGroupUmbrellaCard';
import LiveNowCard from '../components/LiveNowCard';
import LiveNowHeroCard from '../components/LiveNowHeroCard';
import StartingSoonCard from '../components/StartingSoonCard';
import AlmostFullCard from '../components/AlmostFullCard';
import ReopenedCard from '../components/ReopenedCard';
import VenueActivityCard from '../components/VenueActivityCard';
import FriendActivityCard from '../components/FriendActivityCard';
import FriendJoinedLiveRitualCard from '../components/FriendJoinedLiveRitualCard';
import FriendInterestedEventCard from '../components/FriendInterestedEventCard';
import FriendBecameFriendsCard from '../components/FriendBecameFriendsCard';
import HostMemoryShareCard from '../components/HostMemoryShareCard';
import HostTextPostCard from '../components/HostTextPostCard';
import VenuePlaylistShareCard from '../components/VenuePlaylistShareCard';
import HostHostingNewRitualCard from '../components/HostHostingNewRitualCard';
import VenueUpdateCard from '../components/VenueUpdateCard';
import {
  FriFriendMemoryCard,
  FriQuoteCard,
  FriSpotifyCard,
  FriEventCard,
  FriMutualFriendsCard,
  FriBookRecCard,
  FriHostingCard,
  FriVoiceMemoCard,
  FriJazzActivityCard,
} from '../components/FriendsFeedCards';
import { SkeletonRitualCard, SkeletonList } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import PulseExactAllContent from '../components/PulseExactAllContent';
import PulseLiveNowPerfectContent from '../components/PulseLiveNowPerfectContent';
import FollowingView from '../../takip/FollowingView';
import SpecialEventsView from '../../ozel/SpecialEventsView';
import PulseNearbyPerfectContent from '../components/PulseNearbyPerfectContent';
import PulseStartingSoonExactContent from '../components/PulseStartingSoonExactContent';
import PulseSeatsAvailableExactContent from '../components/PulseSeatsAvailableExactContent';
import PulseNearbyYakinContent from '../components/PulseNearbyYakinContent';
import FriendsView from '../../friens/FriendsView';
import PulseTonightExactContent from '../components/PulseTonightExactContent';
import PulseThisWeekExactContent from '../components/PulseThisWeekExactContent';
import PulseWeekendExactContent from '../components/PulseWeekendExactContent';
import PulseVerifiedExactContent from '../components/PulseVerifiedExactContent';
import PulseFreeEntryExactContent from '../components/PulseFreeEntryExactContent';
import PulsePivotHostsExactContent from '../components/PulsePivotHostsExactContent';
import PulseRecurringExactContent from '../components/PulseRecurringExactContent';
import PulseLocalNewExactContent from '../components/PulseLocalNewExactContent';
import PulseMorningExactContent from '../components/PulseMorningExactContent';
import {
  fetchPulseRituals,
  fetchPulseFeed,
  fetchPulseMemories,
  fetchPulseReposts,
  fetchVenueActivity,
  fetchFriendPulseEvents,
  fetchFriends,
  browseRituals,
} from '../services/api';
import websocketService from '../services/websocket';
import useAuthStore from '../store/authStore';
import { log, warn } from '../utils/logger';
import { requireVerifiedUser } from '../utils/verificationGuard';
import { PULSE, FONT_SERIF } from '../constants/pulseTheme';
import { getPulseEmptyCopy } from '../utils/pulseEmptyCopy';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2; // 2 columns with padding and gap

// pulse.html tokens (+ legacy aliases for StyleSheet)
const PRIMARY_COLOR = '#000000';
const BACKGROUND = PULSE.bodyGray;
const CARD_LIGHT = PULSE.screenLight;
const CARD_BORDER = PULSE.borderLight;
const GRAY_100 = PULSE.g200;
const TEXT_PRIMARY = '#000000';
const TEXT_SECONDARY = '#666666';
const TEXT_TERTIARY = PULSE.g400;
const MORE_BUTTON_BG = PULSE.g200;
const CARD_RADIUS = 16;
const TAB_RADIUS = 999;
const NOTIFICATION_UNREAD_KEY = '@local_notification_unread_count';
const CORE_FILTERS = ['Tümü', 'Local World', 'Arkadaşlar', 'FL', 'Uni', 'Gizli'];
const DISCOVERY_FILTERS = [
  'Şimdi Canlı',
  'Yer Var',
  'Başlamak Üzere',
  'Yakınımda',
  'Takip Edilenler',
  'Özel Etkinlikler',
  'Doğrulanmışlar',
  'Seri',
  "LOCAL'de Yeni",
];
const FILTER_OPTIONS = [...CORE_FILTERS, ...DISCOVERY_FILTERS];
const MORE_FILTER_CHIP = 'Daha fazla';

const cleanFriendsText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const buildPulseBrowseQueriesForFilter = (filter, { city, viewerId }) => {
  const base = { city, viewer_id: viewerId, limit: 80 };
  const focused = [];

  switch (filter) {
    case 'Local World':
      focused.push({ ...base, feed_scope: 'local_world', limit: 60 });
      break;
    case 'FL':
      focused.push({ ...base, feed_scope: 'fl', limit: 80 });
      break;
    case 'Şimdi Canlı':
      focused.push({ ...base, status: 'live', limit: 40 });
      break;
    case 'Özel Etkinlikler':
      focused.push({ ...base, type: 'Special Event', limit: 30 });
      break;
    case 'Ücretsiz Giriş':
    case 'Herkese Açık':
      focused.push({ ...base, entry_type: 'open', limit: 40 });
      break;
    case 'Arkadaşlar':
      focused.push({ ...base, feed_scope: 'friends', limit: 100 });
      break;
    case 'Takip Edilenler':
      focused.push({ ...base, limit: 100 });
      break;
    case 'Uni':
      focused.push({ ...base, feed_scope: 'uni', limit: 80 });
      break;
    case 'Gizli':
      focused.push({ ...base, feed_scope: 'hidden', limit: 80 });
      break;
    case 'Başlamak Üzere':
      focused.push({ ...base, limit: 60 });
      break;
    default:
      focused.push(base);
      break;
  }

  return focused;
};

const withTimeout = (promise, timeoutMs = 12000, fallbackValue = null) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isRitualLiveNow = (ritual) => {
  const status = String(ritual?.status || '').toLowerCase();
  const timeState = String(ritual?.time_state || '').toLowerCase();
  const liveFlag =
    ritual?.is_live === true ||
    ritual?.live_now === true ||
    ritual?.currently_live === true ||
    ritual?.is_currently_live === true;
  if (
    liveFlag ||
    status === 'live' ||
    status === 'live_now' ||
    timeState === 'live' ||
    timeState === 'live_now'
  ) {
    return true;
  }

  const start = ritual?.start_time ? new Date(ritual.start_time) : null;
  if (!start || Number.isNaN(start.getTime())) return false;

  const durationMins = Math.max(30, toNum(ritual?.duration, 90));
  const now = new Date();
  const end = new Date(start.getTime() + durationMins * 60000);
  const diffMins = Math.floor((now.getTime() - start.getTime()) / 60000);

  // Keep live window slightly tolerant for backend clock drift.
  return (start <= now && now <= end) || (diffMins >= -10 && diffMins <= durationMins + 15);
};

const isStartingVerySoon = (ritual, withinMinutes = 45) => {
  const start = ritual?.start_time ? new Date(ritual.start_time) : null;
  if (!start || Number.isNaN(start.getTime())) return false;
  const now = new Date();
  const diffMins = Math.floor((start.getTime() - now.getTime()) / 60000);
  return diffMins >= 0 && diffMins <= withinMinutes;
};

const derivePulseTimeState = (ritual) => {
  const now = new Date();
  const start = ritual?.start_time ? new Date(ritual.start_time) : null;
  if (isRitualLiveNow(ritual)) return 'live_now';
  if (!start || Number.isNaN(start.getTime())) return 'starting_soon';

  const minsToStart = Math.floor((start - now) / 60000);
  if (minsToStart >= 0 && minsToStart <= 90) return 'starting_soon';

  const capacity = toNum(ritual?.capacity, 0);
  const attendees = toNum(ritual?.current_attendees, 0);
  if (capacity > 0 && attendees < capacity && capacity - attendees <= 2) return 'almost_full';

  return 'starting_soon';
};

const normalizePulseRitual = (ritual) => {
  // ZONE-EVENT umbrella cards — keep payload intact for EventGroupUmbrellaCard
  if (ritual?.card_type === 'event_group' || (ritual?.tables && ritual?.label && !ritual?.host_id)) {
    return {
      ...ritual,
      card_type: 'event_group',
      time_state: ritual.time_state || 'live_now',
      joined: toNum(ritual?.joined ?? ritual?.current_attendees, 0),
      capacity: toNum(ritual?.capacity, 0),
      seats_left:
        ritual?.seats_left != null
          ? toNum(ritual.seats_left, 0)
          : Math.max(0, toNum(ritual?.capacity, 0) - toNum(ritual?.joined, 0)),
      tables: Array.isArray(ritual.tables) ? ritual.tables : [],
    };
  }
  const capacity = toNum(ritual?.capacity, 0);
  const attendees = toNum(
    ritual?.current_attendees ??
      ritual?.joined_count ??
      ritual?.attendee_count,
    0
  );
  const friendsHere = toNum(
    ritual?.friends_here ??
      ritual?.friends_count ??
      ritual?.mutual_friends_count,
    0
  );
  const entryTypeRaw = String(ritual?.entry_type || '').toLowerCase();
  const entry_type =
    entryTypeRaw === 'open' || entryTypeRaw === 'invite_only' || entryTypeRaw === 'request_seat'
      ? entryTypeRaw
      : 'request_seat';
  const typeText = String(ritual?.type || '').toLowerCase();
  const isSpecial =
    Boolean(ritual?.is_special_event) ||
    typeText.includes('special') ||
    typeText.includes('showcase');
  const time_state = ritual?.time_state || derivePulseTimeState(ritual);

  return {
    ...ritual,
    capacity,
    current_attendees: attendees,
    friends_here: friendsHere,
    is_friend_hosting: Boolean(ritual?.is_friend_hosting) || friendsHere > 0,
    is_followed_host_hosting: Boolean(ritual?.is_followed_host_hosting ?? ritual?.is_host_followed),
    is_followed_venue_active: Boolean(ritual?.is_followed_venue_active ?? ritual?.is_venue_followed),
    is_pivot_host: Boolean(ritual?.is_pivot_host),
    is_recurring: Boolean(ritual?.is_recurring ?? ritual?.recurrence_rule ?? ritual?.repeat_days?.length),
    is_special_event: isSpecial,
    is_free_entry: Boolean(ritual?.is_free_entry) || entry_type === 'open',
    entry_type,
    is_host_verified: Boolean(ritual?.is_host_verified),
    is_venue_verified: Boolean(ritual?.is_venue_verified),
    created_at: ritual?.created_at || ritual?.start_time,
    time_state,
  };
};

const bucketizePulseRituals = (ritualsList = []) => {
  const buckets = {
    live_now: [],
    starting_soon: [],
    almost_full: [],
    reopened: [],
  };

  ritualsList.forEach((row) => {
    const ritual = normalizePulseRitual(row);
    if (ritual.time_state === 'live_now') buckets.live_now.push(ritual);
    else if (ritual.time_state === 'almost_full') buckets.almost_full.push(ritual);
    else if (ritual.time_state === 'reopened') buckets.reopened.push(ritual);
    else buckets.starting_soon.push(ritual);
  });

  return buckets;
};

const mergePulseBucketsUnique = (primary, supplement) => {
  const keys = ['live_now', 'starting_soon', 'almost_full', 'reopened'];
  const out = {};
  keys.forEach((key) => {
    const seen = new Set();
    const rows = [];
    [...(primary?.[key] || []), ...(supplement?.[key] || [])].forEach((ritual) => {
      const uniqueKey = ritual?.id
        ? `id:${ritual.id}`
        : `k:${String(ritual?.title || '').toLowerCase()}|${String(ritual?.venue_name || '').toLowerCase()}|${String(ritual?.start_time || '')}`;
      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);
      rows.push(ritual);
    });
    out[key] = rows;
  });
  // Drop member rituals when an umbrella for that event_group is already present
  const umbrellaIds = new Set();
  keys.forEach((key) => {
    (out[key] || []).forEach((r) => {
      if (r?.card_type === 'event_group' && r.id) umbrellaIds.add(String(r.id));
    });
  });
  if (umbrellaIds.size > 0) {
    keys.forEach((key) => {
      out[key] = (out[key] || []).filter((r) => {
        if (r?.card_type === 'event_group') return true;
        const gid = r?.event_group_id != null ? String(r.event_group_id) : null;
        return !gid || !umbrellaIds.has(gid);
      });
    });
  }
  return out;
};

const mapSpecialItemsFromData = (ritualRows = [], memoryRows = [], city = 'Milano') => {
  const mappedFromRituals = (ritualRows || []).map((r, idx) => {
    const title = cleanFriendsText(r?.title || 'Özel Etkinlik');
    const startTime = r?.start_time ? new Date(r.start_time) : new Date();
    const seatTotal = Math.max(1, Number(r?.capacity || 20));
    const seatTaken = Math.max(0, Number(r?.current_attendees || 0));
    const remaining = Math.max(0, seatTotal - seatTaken);
    const isLimited = remaining > 0 && remaining <= 3;
    const isPartner = Boolean(r?.venue_name && idx % 7 === 0);
    const isSpecialGuest = Boolean(r?.host_avatar && idx % 5 === 0);
    const isSuper = idx === 0 || Boolean(r?.is_special_event);
    const curationSignals = [
      isSuper ? 'super-event' : null,
      isLimited ? 'limited' : null,
      isPartner ? 'partner' : null,
      isSpecialGuest ? 'special-guest' : null,
      'editors-pick',
    ].filter(Boolean);
    const priceValue = Number(r?.price || 0);
    const priceKind = r?.entry_type === 'open' ? 'free' : r?.entry_type === 'invite_only' ? 'invite-only' : 'paid';
    const viewerCount = Math.max(2, Number(r?.watching_count || r?.live_viewers || 0) || (idx % 8) + 2);
    const hasGuestSet = Boolean(r?.host_avatar || r?.venue_image_url);

    return {
      id: String(r?.id || `special-${idx}`),
      title,
      name: cleanFriendsText(r?.host_name || title),
      subtitle: cleanFriendsText(r?.description || `${city} için seçilmiş Ritual`),
      host: cleanFriendsText(r?.host_name || r?.venue_name || 'LOCAL Curated'),
      coverImage: r?.image_url || r?.venue_image_url || r?.host_avatar || undefined,
      avatar: r?.host_avatar || r?.venue_image_url || r?.image_url || undefined,
      date: `${String(startTime.getDate()).padStart(2, '0')} ${startTime
        .toLocaleString('tr-TR', { month: 'short' })
        .toUpperCase()} · ${String(startTime.getHours()).padStart(2, '0')}:${String(
        startTime.getMinutes()
      ).padStart(2, '0')}`,
      dateRange: `${String(startTime.getDate()).padStart(2, '0')} ${startTime
        .toLocaleString('tr-TR', { month: 'short' })
        .toUpperCase()} · ${city.toUpperCase()}`,
      curationSignals,
      hasFullContent: idx % 2 === 0,
      quickGlance: idx % 4 === 1,
      isPastMemory: false,
      collectionLink: { name: cleanFriendsText(r?.venue_name || city) },
      collectionStats: {
        ritualCount: Number(r?.series_count || (idx % 6) + 3),
        hostCount: Number(r?.collab_host_count || (idx % 3) + 1),
        totalSeats: seatTotal,
        takenSeats: seatTaken,
      },
      curatorNote: cleanFriendsText(r?.description || 'LOCAL ekibi tarafından öne çıkarıldı.'),
      meta: {
        date: new Date(r?.start_time || Date.now()).toLocaleDateString('tr-TR'),
        venue: cleanFriendsText(r?.venue_name || city),
        seats: `${seatTaken}/${seatTotal}`,
      },
      guests: hasGuestSet
        ? [
            { name: cleanFriendsText(r?.host_name || 'Özel Konuk'), avatar: r?.host_avatar || r?.venue_image_url || r?.image_url },
            { name: cleanFriendsText(r?.venue_name || city), avatar: r?.venue_image_url || r?.image_url || r?.host_avatar },
          ]
        : [],
      footerNote: cleanFriendsText(r?.ritual_type || 'Kürasyon seçimi'),
      seats: `${seatTaken}/${seatTotal}`,
      priceLabel: r?.entry_type === 'open' ? 'ÜCRETSİZ' : `${Number(r?.price || 0) || 0}₺`,
      price: {
        kind: priceKind,
        amount: priceKind === 'free' ? 'ÜCRETSİZ' : `${priceValue || 0}₺`,
      },
      ctaLabel: isLimited ? 'Hemen Al' : 'Katıl',
      ctaUrgent: isLimited,
      viewerCountInline: `${viewerCount} kişi bakıyor`,
      availability: { taken: seatTaken, total: seatTotal, waitlist: Number(r?.waitlist_count || 0) },
      liveStats: {
        currentViewers: viewerCount,
        viewsLastHour: Number(r?.views_last_hour || 20 + idx * 3),
        bookingsLastHour: Number(r?.bookings_last_hour || 2 + (idx % 5)),
      },
      registrationClosesAt: r?.start_time,
      guestPortrait: r?.host_avatar || r?.image_url,
      dateStrip: `${String(startTime.getDate()).padStart(2, '0')} ${startTime.toLocaleString('tr-TR', { month: 'short' }).toUpperCase()}`,
      subtitleShort: cleanFriendsText(r?.venue_name || city),
    };
  });

  const mappedFromMemories = (memoryRows || []).slice(0, 4).map((m, idx) => ({
    id: `memory-special-${m?.id || idx}`,
    title: cleanFriendsText(m?.ritual_title || m?.content || 'Özel anı'),
    subtitle: cleanFriendsText(m?.content || 'Geçmiş etkinlik notu'),
    coverImage: m?.photo_url || m?.image_url,
    curationSignals: ['editors-pick'],
    dateStrip: new Date(m?.created_at || Date.now()).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }).toUpperCase(),
    rating: 4.7 + (idx % 3) * 0.1,
    attendeeCount: Number(m?.participant_count || m?.attendee_count || 0),
    isPastMemory: true,
    availability: { taken: 1, total: 10, waitlist: 0 },
    liveStats: { currentViewers: 0, viewsLastHour: 0, bookingsLastHour: 0 },
  }));

  return [...mappedFromRituals, ...mappedFromMemories];
};

export default function PulseScreen({ navigation, route }) {
  const isDark = !!route?.params?.forceDark;
  const [rituals, setRituals] = useState({
    live_now: [],
    starting_soon: [],
    almost_full: [],
    reopened: [],
  });
  const [pulseMemories, setPulseMemories] = useState([]);
  const [pulseReposts, setPulseReposts] = useState([]);
  const [venueActivities, setVenueActivities] = useState([]);
  const [friendPulseEvents, setFriendPulseEvents] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();
  const viewerId = user?.id;
  const city = user?.city || 'Milano';
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [showDiscoveryFilters, setShowDiscoveryFilters] = useState(false);
  const [useNearby, setUseNearby] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);

  useEffect(() => {
    if (!useNearby) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocationError('Konum izni reddedildi');
          setUseNearby(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setLocation(pos.coords);
      } catch (e) {
        if (!cancelled) {
          setLocationError(e.message || 'Konum kullanilamiyor');
          setUseNearby(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [useNearby]);

  const loadRituals = async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setLoading(true);
      }
      const params = { city, viewerId };
      if (useNearby && location) {
        params.lat = location.latitude;
        params.lng = location.longitude;
        params.radius = 5000;
      }
      let data = await fetchPulseRituals(params);
      const nearbyEmpty =
        useNearby &&
        location &&
        ((data?.live_now?.length || 0) +
          (data?.starting_soon?.length || 0) +
          (data?.almost_full?.length || 0) +
          (data?.reopened?.length || 0) ===
          0);

      // Nearby endpoint boş dönerse şehir geneli feed'e geri düş.
      if (nearbyEmpty) {
        data = await fetchPulseRituals({ city, viewerId });
      }
      log('PulseScreen - Received data:', { liveNow: data?.live_now?.length, startingSoon: data?.starting_soon?.length });
      const safeData = {
        live_now: (data?.live_now ?? []).map(normalizePulseRitual),
        starting_soon: (data?.starting_soon ?? []).map(normalizePulseRitual),
        almost_full: (data?.almost_full ?? []).map(normalizePulseRitual),
        reopened: (data?.reopened ?? []).map(normalizePulseRitual),
      };
      const browseQueries = buildPulseBrowseQueriesForFilter(activeFilter, { city, viewerId });
      const browseCalls = await Promise.allSettled(
        browseQueries.map((query) => withTimeout(browseRituals(query), 9000, { data: [] }))
      );
      const browseRows = browseCalls.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        const rows = result.value?.data;
        return Array.isArray(rows) ? rows : [];
      });
      const mergedData = mergePulseBucketsUnique(safeData, bucketizePulseRituals(browseRows));
      const finalData = mergedData;
      const hasAnyFinalRitual =
        (finalData.live_now?.length || 0) +
          (finalData.starting_soon?.length || 0) +
          (finalData.almost_full?.length || 0) +
          (finalData.reopened?.length || 0) >
        0;

      // Nearby akışı boşsa unified feed'den gerçek ritual havuzunu çekip doldur.
      if (useNearby && !hasAnyFinalRitual) {
        try {
          const fallbackFeed = await fetchPulseFeed({
            city,
            viewerId,
            limit: 40,
            cursor: null,
          });
          const fallbackPool = fallbackFeed?.ritual_pool || fallbackFeed?.rituals || {};
          setRituals({
            live_now: (fallbackPool?.live_now || []).map(normalizePulseRitual),
            starting_soon: (fallbackPool?.starting_soon || []).map(normalizePulseRitual),
            almost_full: (fallbackPool?.almost_full || []).map(normalizePulseRitual),
            reopened: (fallbackPool?.reopened || []).map(normalizePulseRitual),
          });
          setError(null);
          return;
        } catch (fallbackErr) {
          warn('Nearby rituals fallback feed failed:', fallbackErr?.message || fallbackErr);
        }
      }

      log('PulseScreen - Setting rituals:', finalData.live_now.length, finalData.starting_soon.length);
      // Debug: Log special events
      const allRitualsDebug = [
        ...finalData.live_now,
        ...finalData.starting_soon,
        ...finalData.almost_full,
        ...finalData.reopened,
      ];
      const specialEvents = allRitualsDebug.filter(r => r.is_special_event || r.type === 'Special Event');
      log('PulseScreen - Special Events found:', specialEvents.length);
      setRituals(finalData);
      setError(null); // Clear error on success
    } catch (err) {
      warn('Error loading rituals (non-fatal):', err.message || err);
      setError(err);
      setRituals({
        live_now: [],
        starting_soon: [],
        almost_full: [],
        reopened: [],
      });
    } finally {
      if (!skipLoadingState) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const loadPulseMemories = async (scope) => {
    try {
      let data = await fetchPulseMemories(city, 40, viewerId, { scope });

      // Fallback: if city-scoped memories are empty, fetch without city scope.
      if (!Array.isArray(data) || data.length === 0) {
        data = await fetchPulseMemories(null, 40, viewerId, { scope });
      }

      // Nearby için son fallback: unified feed memories
      if (useNearby && (!Array.isArray(data) || data.length === 0)) {
        const feed = await fetchPulseFeed({
          city,
          viewerId,
          limit: 40,
          cursor: null,
        });
        data = Array.isArray(feed?.memories) ? feed.memories : [];
      }

      log('PulseScreen - Pulse memories received:', data?.length || 0);
      setPulseMemories(data || []);
    } catch (error) {
      // In development 429s are expected sometimes; avoid red error screen
      log('Error loading pulse memories (non-fatal):', error?.message || error);
      // Don't show error to user, just use empty data
      setPulseMemories([]);
    }
  };

  const loadPulseReposts = async () => {
    try {
      const data = await fetchPulseReposts({ limit: 12 });
      setPulseReposts(Array.isArray(data) ? data : []);
    } catch (error) {
      log('Error loading pulse reposts (non-fatal):', error?.message || error);
      setPulseReposts([]);
    }
  };

  const loadUnifiedPulseFeed = async (reset = true) => {
    const payload = await fetchPulseFeed({
      city,
      viewerId,
      limit: 40,
      cursor: reset ? null : feedCursor,
    });
    const sourceRituals = payload?.ritual_pool || payload?.rituals || {};
    const incomingBuckets = {
      live_now: (sourceRituals?.live_now || []).map(normalizePulseRitual),
      starting_soon: (sourceRituals?.starting_soon || []).map(normalizePulseRitual),
      almost_full: (sourceRituals?.almost_full || []).map(normalizePulseRitual),
      reopened: (sourceRituals?.reopened || []).map(normalizePulseRitual),
    };
    const incomingMemories = Array.isArray(payload?.memories) ? payload.memories : [];

    if (reset) {
      setRituals(incomingBuckets);
      setPulseMemories(incomingMemories);
    } else {
      setRituals((prev) => mergePulseBucketsUnique(prev, incomingBuckets));
      setPulseMemories((prev) => {
        const seen = new Set((prev || []).map((m) => String(m.id || `${m.user_id}-${m.created_at}`)));
        const next = [...(prev || [])];
        for (const row of incomingMemories) {
          const key = String(row.id || `${row.user_id}-${row.created_at}`);
          if (!seen.has(key)) {
            seen.add(key);
            next.push(row);
          }
        }
        return next;
      });
    }

    setFeedCursor(payload?.next_cursor || null);
    setFeedHasMore(Boolean(payload?.has_more));
  };

  const loadVenueActivities = async () => {
    try {
      const data = await fetchVenueActivity({ city, viewerId });
      log('PulseScreen - Venue activities received:', data?.length || 0);
      setVenueActivities(data || []);
    } catch (error) {
      log('Error loading venue activities (non-fatal):', error?.message || error);
      // Don't show error to user, just use empty data
      setVenueActivities([]);
    }
  };

  const loadFriendPulseEvents = async () => {
    if (!viewerId) {
      setFriendPulseEvents([]);
      setFriendsList([]);
      return;
    }
    try {
      const [eventsData, friendsData] = await Promise.all([
        fetchFriendPulseEvents(viewerId, 15),
        fetchFriends(viewerId, 'accepted').catch(() => []),
      ]);
      setFriendPulseEvents(eventsData || []);
      setFriendsList(Array.isArray(friendsData) ? friendsData : []);
    } catch (error) {
      log('Error loading friend pulse events (non-fatal):', error?.message || error);
      setFriendPulseEvents([]);
      setFriendsList([]);
    }
  };

  // Load all data sequentially with delays to avoid rate limiting
  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Tümü ve Yakınımda aynı veri kaynağından beslensin:
      // ayrım sadece görünüm/mesafe filtresi seviyesinde kalsın.
      const canUseUnifiedFeed = true;
      const ritualsPromise = Promise.race([
        canUseUnifiedFeed ? loadUnifiedPulseFeed(true) : loadRituals(true),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Rituals loading timeout')), 30000)
        )
      ]).catch(err => {
        warn('Rituals loading failed or timed out:', err.message);
        setRituals({
          live_now: [],
          starting_soon: [],
          almost_full: [],
          reopened: [],
        });
      });
      
      await ritualsPromise;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Unified feed dışında kaldığımız legacy akışlarda memory çağrısı yap.
      if (!canUseUnifiedFeed) {
        Promise.race([
          loadPulseMemories(activeFilter === 'FL' ? 'fl' : undefined),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Memories loading timeout')), 10000)
          )
        ]).catch(err => {
          warn('Memories loading failed or timed out:', err.message);
          setPulseMemories([]);
        });
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Load venue activities (non-blocking)
      Promise.race([
        loadVenueActivities(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Venue activities loading timeout')), 10000)
        )
      ]).catch(err => {
        warn('Venue activities loading failed or timed out:', err.message);
        setVenueActivities([]);
      });
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Load friend pulse events (non-blocking)
      Promise.race([
        loadFriendPulseEvents(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Friend pulse events loading timeout')), 8000)
        )
      ]).catch(err => {
        warn('Friend pulse events loading failed or timed out:', err.message);
        setFriendPulseEvents([]);
      });

      Promise.race([
        loadPulseReposts(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Pulse reposts loading timeout')), 8000)
        ),
      ]).catch((err) => {
        warn('Pulse reposts loading failed or timed out:', err.message);
        setPulseReposts([]);
      });
      
    } catch (error) {
      warn('Error loading all data:', error.message || error);
      setError(error);
      // Ensure we show empty state instead of infinite loading
      setRituals({
        live_now: [],
        starting_soon: [],
        almost_full: [],
        reopened: [],
      });
      setPulseMemories([]);
      setPulseReposts([]);
      setVenueActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setError(null);
    loadAllData();
  };

  const onLoadMoreAllFeed = async () => {
    if (useNearby || loadingMoreFeed || !feedHasMore) return;
    try {
      setLoadingMoreFeed(true);
      await loadUnifiedPulseFeed(false);
    } catch (error) {
      warn('Error loading more pulse feed:', error?.message || error);
    } finally {
      setLoadingMoreFeed(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    loadAllData();
  };

  useEffect(() => {
    // Connect WebSocket
    websocketService.connect();
    
    // Subscribe to pulse updates (will subscribe when connected)
    websocketService.subscribeToPulse(city);

    // Listen for pulse updates
    const handlePulseUpdate = (data) => {
      log('Pulse update received:', data);
      // Only refresh if update is for current city
      if (!data.city || data.city === city) {
        log('Refreshing pulse for city:', city);
        loadAllData();
      }
    };

    websocketService.on('pulse:update', handlePulseUpdate);

    // Initial load - sequential to avoid rate limiting
    loadAllData();

    // Cleanup
    return () => {
      websocketService.off('pulse:update', handlePulseUpdate);
      websocketService.unsubscribeFromPulse(city);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, useNearby, location]);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Refresh when screen comes into focus (e.g., returning from CreateRitual)
  useFocusEffect(
    React.useCallback(() => {
      log('PulseScreen focused, refreshing...');
      loadAllData();
      AsyncStorage.getItem(NOTIFICATION_UNREAD_KEY)
        .then((raw) => setNotificationUnread(Number(raw || '0')))
        .catch(() => setNotificationUnread(0));
    }, [])
  );

  const getTimeLabel = (ritual) => {
    if (ritual.time_state === 'live_now') {
      return '● CANLI';
    }
    if (ritual.time_state === 'starting_soon') {
      const startTime = new Date(ritual.start_time);
      const now = new Date();
      const minutes = Math.max(0, Math.floor((startTime - now) / 60000));
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        return `${hours}s ${minutes % 60}d sonra`;
      }
      return `${minutes} dk sonra`;
    }
    if (ritual.time_state === 'reopened') {
      return 'Yeniden Acildi';
    }
    if (ritual.time_state === 'almost_full') {
      const remaining = ritual.capacity - ritual.current_attendees;
      return `${remaining} koltuk kaldi`;
    }
    return '';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Determine card type for ritual (must be defined before use)
  const getCardType = (ritual) => {
    // Special Event her filtrede special_event olarak kalsın
    if (ritual.is_special_event || ritual.type === 'Special Event') {
      return 'special_event';
    }
    if (isRitualLiveNow(ritual)) {
      // If friends are here and user is in Friends tab, treat as "friend joined live"
      if (activeFilter === 'Arkadaşlar' && ritual.friends_here && ritual.friends_here > 0) {
        return 'friend_joined_live';
      }
      return 'live_now';
    }
    if (ritual.time_state === 'almost_full') {
      return 'almost_full';
    }
    if (ritual.time_state === 'reopened') {
      return 'reopened';
    }
    // Friend activity (arkadaşlar var ve live değil)
    if (ritual.friends_here && ritual.friends_here > 0 && ritual.time_state !== 'live_now') {
      return 'friend_activity';
    }

    // Friends interested in event (masked social signal)
    if (ritual.friends_interested && ritual.friends_interested > 0) {
      return 'friend_interested_event';
    }
    if (ritual.time_state === 'starting_soon') {
      return 'starting_soon';
    }
    return 'starting_soon'; // default
  };

  // Combine Pulse buckets: unique by id, then by title+venue (tekrarlayan seed satırları tek kart)
  const timeStateRank = (ts) =>
    ({ live_now: 0, starting_soon: 1, reopened: 2, almost_full: 3 }[ts] ?? 99);
  const feedKey = (r) =>
    `${String(r.title || '').trim().toLowerCase()}|${String(r.venue_name || '').trim().toLowerCase()}`;
  const merged = { byId: new Set(), rows: [] };
  const pushUniqueId = (list, section) => {
    for (const r of list) {
      if (!r.id || merged.byId.has(r.id)) continue;
      merged.byId.add(r.id);
      merged.rows.push({ ...r, section });
    }
  };
  pushUniqueId(rituals.live_now, 'live_now');
  pushUniqueId(rituals.starting_soon, 'starting_soon');
  pushUniqueId(rituals.almost_full, 'almost_full');
  pushUniqueId(rituals.reopened, 'reopened');

  const byFeedKey = new Map();
  for (const r of merged.rows) {
    const k = feedKey(r);
    const prev = byFeedKey.get(k);
    if (!prev || timeStateRank(r.time_state) < timeStateRank(prev.time_state)) {
      byFeedKey.set(k, r);
    }
  }
  const heroRank = (r) =>
    r.is_special_event || r.type === 'Special Event' ? -1 : timeStateRank(r.time_state);
  const allRituals = Array.from(byFeedKey.values()).sort((a, b) => {
    const hr = heroRank(a) - heroRank(b);
    if (hr !== 0) return hr;
    return new Date(a.start_time) - new Date(b.start_time);
  });

  // Debug: Log card types
  if (allRituals.length > 0) {
    const cardTypes = allRituals.map(r => ({ id: r.id, title: r.title, cardType: getCardType(r), friends_here: r.friends_here }));
    log('PulseScreen - Card types:', cardTypes);
  }

  // Filter rituals based on active filter
  const filteredRituals =
    (() => {
      const now = new Date();
      const day = now.getDay(); // 0 Sun ... 6 Sat
      const isWeekendNow = day === 0 || day === 6;
      const tonightStart = new Date(now);
      tonightStart.setHours(18, 0, 0, 0);
      const tonightEnd = new Date(now);
      tonightEnd.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);

      if (activeFilter === 'Tümü') return allRituals;
      if (activeFilter === 'Local World') {
        return allRituals.filter(
          (r) => r.forum_enabled || String(r.window_type || '') === 'open_forum'
        );
      }
      if (activeFilter === 'FL') {
        return allRituals.filter((r) => r.is_fl_friend_hosting || r.is_fl_friend_attending);
      }
      if (activeFilter === 'Şimdi Canlı') {
        const strictlyLive = allRituals.filter((r) => isRitualLiveNow(r));
        if (strictlyLive.length > 0) return strictlyLive;
        // Fallback: if no live ritual exists, show imminent real rituals instead of empty view.
        return allRituals.filter((r) => isStartingVerySoon(r, 60));
      }
      if (activeFilter === 'Yakınımda') return allRituals;
      if (activeFilter === 'Arkadaşlar') {
        return allRituals.filter((r) => (r.friends_here && r.friends_here > 0) || r.is_friend_hosting);
      }
      if (activeFilter === 'Takip Edilenler') {
        return allRituals.filter((r) => r.is_followed_host_hosting || r.is_followed_venue_active);
      }
      if (activeFilter === 'Uni') {
        return allRituals.filter((r) => !!r.same_university);
      }
      if (activeFilter === 'Gizli') {
        return allRituals.filter((r) => {
          const entry = String(r.entry_type || '').toLowerCase();
          const isNonPublic = entry && entry !== 'open';
          return isNonPublic && (!!r.viewer_is_attending || !!r.has_invite);
        });
      }
      if (activeFilter === 'Özel Etkinlikler') {
        return allRituals.filter((r) => r.is_special_event || r.type === 'Special Event');
      }
      if (activeFilter === 'Pivot Hostlar') {
        return allRituals.filter((r) => Boolean(r?.is_pivot_host));
      }
      if (activeFilter === 'Seri') {
        return allRituals.filter((r) => !!r.is_recurring);
      }
      if (activeFilter === "LOCAL'de Yeni") {
        return allRituals.filter((r) => {
          const createdAt = new Date(r.created_at || r.start_time || Date.now());
          const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);
          return ageDays <= 7;
        });
      }
      if (activeFilter === 'Başlamak Üzere') {
        return allRituals.filter((r) => r.time_state === 'starting_soon');
      }
      if (activeFilter === 'Yer Var') {
        return allRituals.filter((r) => Number(r.capacity || 0) - Number(r.current_attendees || 0) > 0);
      }
      if (activeFilter === 'Bu Gece') {
        return allRituals.filter((r) => {
          const t = new Date(r.start_time);
          return t >= tonightStart && t <= tonightEnd;
        });
      }
      if (activeFilter === 'Bu Hafta') {
        return allRituals.filter((r) => {
          const t = new Date(r.start_time);
          return t >= now && t <= weekEnd;
        });
      }
      if (activeFilter === 'Hafta Sonu') {
        return allRituals.filter((r) => {
          const d = new Date(r.start_time).getDay();
          return d === 0 || d === 6 || isWeekendNow;
        });
      }
      if (activeFilter === 'Doğrulanmışlar') {
        return allRituals.filter((r) => !!r.is_host_verified || !!r.is_venue_verified);
      }
      if (activeFilter === 'Ücretsiz Giriş') {
        return allRituals.filter(
          (r) => !!r.is_free_entry || String(r.entry_type || '').toLowerCase() === 'open'
        );
      }
      if (activeFilter === 'Sabah') {
        return allRituals.filter((r) => {
          const h = new Date(r.start_time).getHours();
          return h >= 6 && h < 12;
        });
      }
      if (activeFilter === 'Öğleden Sonra') {
        return allRituals.filter((r) => {
          const h = new Date(r.start_time).getHours();
          return h >= 12 && h < 18;
        });
      }
      if (activeFilter === 'Akşam') {
        return allRituals.filter((r) => {
          const h = new Date(r.start_time).getHours();
          return h >= 18 || h < 2;
        });
      }
      if (activeFilter === 'Birebir Ritual') {
        return allRituals.filter((r) => Number(r.capacity || 0) === 2);
      }
      if (activeFilter === 'Küçük Grup ≤4') {
        return allRituals.filter((r) => Number(r.capacity || 0) <= 4);
      }
      if (activeFilter === 'Büyük Grup 8+') {
        return allRituals.filter((r) => Number(r.capacity || 0) >= 8);
      }
      if (activeFilter === 'Herkese Açık') {
        return allRituals.filter((r) => String(r.entry_type || '').toLowerCase() === 'open');
      }
      return allRituals;
    })();

  const renderRitualCard = (ritual, index, heroFullWidth = false) => {
    if (ritual?.card_type === 'event_group' || (ritual?.tables && ritual?.label && !ritual?.host_id)) {
      return (
        <EventGroupUmbrellaCard
          key={`eg-${ritual.id || index}`}
          umbrella={ritual}
          onOpenTable={(ritualId) => navigation.navigate('RitualDetail', { ritualId })}
        />
      );
    }
    const cardType = getCardType(ritual);
    const handlePress = () => navigation.navigate('RitualDetail', { ritualId: ritual.id });
    // Ensure unique key
    const uniqueKey = ritual.id ? String(ritual.id) : `ritual-${index}-${cardType}`;

    switch (cardType) {
      case 'special_event':
        return (
          <SpecialEventCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
            fullWidth={heroFullWidth}
          />
        );
      case 'live_now':
        return (
          <LiveNowCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      case 'starting_soon':
        // fullWidth only when explicitly hero (e.g. single full-width row); in grid always compact so right card looks balanced
        return (
          <StartingSoonCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
            fullWidth={heroFullWidth}
          />
        );
      case 'almost_full':
        return (
          <AlmostFullCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      case 'reopened':
        return (
          <ReopenedCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      case 'friend_activity':
        return (
          <FriendActivityCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      case 'friend_joined_live':
        return (
          <FriendJoinedLiveRitualCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      case 'friend_interested_event':
        return (
          <FriendInterestedEventCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
      default:
        return (
          <StartingSoonCard
            key={uniqueKey}
            ritual={ritual}
            onPress={handlePress}
            city={city}
          />
        );
    }
  };

  const displayRituals = filteredRituals;

  const pulseEmptyCopy = getPulseEmptyCopy(useNearby ? 'Yakınımda' : activeFilter);
  const pulseEmptyProps = {
    emptyTitle: pulseEmptyCopy.title,
    emptyMessage: pulseEmptyCopy.message,
    emptyActionLabel: pulseEmptyCopy.action || undefined,
    emptyActionRoute: pulseEmptyCopy.route || undefined,
  };

  const eventByFriendId = new Map(
    (friendPulseEvents || []).map((e) => [String(e.friend_id || e.user_id || e.id || ''), e])
  );
  const friendsViewFriends = (friendsList || []).map((f, idx) => {
    const friendNode = f.friend || f.user || f;
    const fid = String(
      f.friend_id || f.following_id || f.user_id || friendNode?.id || `friend-${idx}`
    );
    const ev = eventByFriendId.get(fid);
    const rawShared =
      Number(
        ev?.shared_ritual_count ??
          f.shared_count ??
          f.shared_ritual_count ??
          friendNode?.shared_ritual_count ??
          0
      ) || 0;
    const normalizedFirstMetDate = f.created_at || ev?.created_at || null;
    const normalizedLastRitualDate =
      f.last_ritual_date ||
      f.lastRitualDate ||
      friendNode?.last_ritual_date ||
      friendNode?.lastRitualDate ||
      ev?.last_activity_at ||
      ev?.created_at ||
      null;

    return {
      id: fid,
      name: friendNode?.name || f.friend_name || 'Arkadaş',
      avatar: friendNode?.avatar_url || friendNode?.avatar || f.friend_avatar || null,
      lastRitualDate: normalizedLastRitualDate,
      sharedRitualCount: rawShared,
      firstMetDate: normalizedFirstMetDate,
      firstMetRitual: {
        name: cleanFriendsText(ev?.ritual_title || 'Ritualde'),
        date: ev?.created_at || normalizedFirstMetDate,
      },
      coverImage: ev?.cover_image || ev?.image_url || null,
      handwrittenQuote: ev?.quote || null,
      firstConversationNote: cleanFriendsText(ev?.quote || f.note || ''),
      isActive: Boolean(ev?.is_active || ev?.time_state === 'live_now'),
      activeRitual: { name: cleanFriendsText(ev?.ritual_title || 'Ritual'), venue: cleanFriendsText(ev?.venue_name || city) },
      ctaLabel: ev?.ritual_title ? `${cleanFriendsText(ev.ritual_title)}'a katıl` : undefined,
      stats: {
        sharedRituals: Number(ev?.shared_ritual_count || 1),
        lastMeetingDate: ev?.created_at || f.updated_at || new Date().toISOString(),
        sharedMemories: Number(ev?.shared_memory_count || 0),
      },
    };
  });
  const fallbackFriendsFromEvents =
    friendsViewFriends.length > 0
      ? []
      : (friendPulseEvents || []).map((f, idx) => {
          const rawShared = Number(f.shared_ritual_count || f.shared_count || 0) || 0;
          const normalizedFirstMetDate = f.first_met_date || f.created_at || null;
          const normalizedLastRitualDate =
            f.last_activity_at || f.last_ritual_date || f.lastRitualDate || null;
          return {
          id: String(f.friend_id || f.user_id || f.id || `friend-${idx}`),
          name: f.friend_name || f.name || 'Arkadaş',
          avatar: f.friend_avatar || f.avatar_url || f.avatar || null,
          lastRitualDate: normalizedLastRitualDate,
          sharedRitualCount: rawShared,
          firstMetDate: normalizedFirstMetDate,
          firstMetRitual: { name: cleanFriendsText(f.ritual_title || 'Ritualde'), date: f.created_at || normalizedFirstMetDate },
          coverImage: f.cover_image || f.image_url || null,
          handwrittenQuote: f.quote || null,
          firstConversationNote: cleanFriendsText(f.quote || f.note || ''),
          isActive: Boolean(f.is_active || f.time_state === 'live_now'),
          activeRitual: { name: cleanFriendsText(f.ritual_title || 'Ritual'), venue: cleanFriendsText(f.venue_name || city) },
          ctaLabel: f.ritual_title ? `${cleanFriendsText(f.ritual_title)}'a katıl` : undefined,
          stats: {
            sharedRituals: Number(f.shared_ritual_count || 1),
            lastMeetingDate: f.created_at || new Date().toISOString(),
            sharedMemories: Number(f.shared_memory_count || 0),
          },
        };
      });

  const friendsPool = friendsViewFriends.length > 0 ? friendsViewFriends : fallbackFriendsFromEvents;
  const sharedMemoryItems = (pulseMemories || []).slice(0, 4).map((m, idx) => ({
    id: `shared-${m.id || idx}`,
    type: 'shared-memory',
    image: m.photo_url || m.image_url || null,
    title: cleanFriendsText(m.ritual_title || m.content || 'Ortak anı'),
    venue: cleanFriendsText(m.venue_name || city),
    date: m.created_at || new Date().toISOString(),
    participants: (friendsPool || []).slice(0, 3).map((ff) => ({ name: ff.name, avatar: ff.avatar })),
  }));
  const friendQuoteItems = (friendPulseEvents || [])
    .filter((e) => cleanFriendsText(e.quote || '').length > 0)
    .slice(0, 2)
    .map((e, idx) => ({
    id: `quote-${e.id || idx}`,
    type: 'friend-quote',
    text: cleanFriendsText(e.quote),
    authorName: e.friend_name || 'Arkadaş',
    authorAvatar: e.friend_avatar || null,
    context: `${cleanFriendsText(e.ritual_title || 'PULSE')} · now`,
    heat: 'warm',
  }));
  const fallbackQuoteItems =
    friendQuoteItems.length > 0
      ? []
      : (pulseMemories || [])
          .filter((m) => cleanFriendsText(m.content || '').length >= 8)
          .slice(0, 2)
          .map((m, idx) => ({
            id: `quote-memory-${m.id || idx}`,
            type: 'friend-quote',
            text: cleanFriendsText(m.content || m.ritual_title),
            authorName: cleanFriendsText(m.user_name || m.host_name || friendsPool?.[idx]?.name || 'Arkadaş'),
            authorAvatar:
              m.user_avatar_url ||
              m.avatar_url ||
              friendsPool?.[idx]?.avatar ||
              null,
            context: `${cleanFriendsText(m.ritual_title || 'PULSE')} · memory`,
            heat: 'warm',
          }));
  const ritualsTogetherItems = (displayRituals || [])
    .filter((r) => Number(r.friends_here || 0) > 0)
    .slice(0, 2)
    .map((r, idx) => ({
      id: `rt-${r.id || idx}`,
      type: 'ritual-together',
      ritualName: cleanFriendsText(r.title || 'Ritual'),
      venue: cleanFriendsText(r.venue_name || r.location_name || city),
      bgImage: r.image_url || null,
      date: r.start_time || new Date().toISOString(),
      seatsLeft: Number(Math.max(0, (r.max_attendees || 10) - (r.current_attendees || 0))),
      friendsGoing: (friendsPool || []).slice(0, 3).map((ff) => ({ name: ff.name, avatar: ff.avatar })),
    }));
  const friendsViewMemories = [
    ...sharedMemoryItems,
    ...ritualsTogetherItems,
    ...friendQuoteItems,
    ...fallbackQuoteItems,
  ].slice(0, 10);

  const renderMemoryCard = (memory, index) => {
    const uniqueKey = memory.id ? String(memory.id) : `memory-${index}`;
    const hasPlaylist = !!memory.spotify_playlist_url;

    // Derive simple time-ago label for display
    const createdAt = new Date(memory.created_at);
    const now = new Date();
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    let timeAgo = 'Simdi';
    if (diffMins >= 1 && diffMins < 60) timeAgo = `${diffMins} dk once`;
    else if (diffHours < 24) timeAgo = `${diffHours} sa once`;
    else timeAgo = `${diffHours} sa once`;

    const memoryWithMeta = { ...memory, timeAgo };

    // Playlist share card
    if (hasPlaylist) {
      return (
        <VenuePlaylistShareCard
          key={uniqueKey}
          memory={memoryWithMeta}
          onPress={() => {
            if (memory.ritual_id) {
              navigation.navigate('RitualDetail', { ritualId: memory.ritual_id });
            }
          }}
        />
      );
    }

    // Host memory share card (photo/ritual memory)
    return (
      <HostMemoryShareCard
        key={uniqueKey}
        memory={memoryWithMeta}
        onPress={() => {
          if (memory.ritual_id) {
            navigation.navigate('RitualDetail', { ritualId: memory.ritual_id });
          }
        }}
        city={city}
        fullWidth={true}
      />
    );
  };

  const renderHostTextPostCard = () => {
    const textMemory = pulseMemories.find(
      (m) => !m.spotify_playlist_url && m.content && m.content.length <= 280
    );
    if (!textMemory) return null;

    const createdAt = new Date(textMemory.created_at);
    const now = new Date();
    const diffMs = now - createdAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    let timeAgo = 'Simdi';
    if (diffMins >= 1 && diffMins < 60) timeAgo = `${diffMins} dk once`;
    else if (diffHours < 24) timeAgo = `${diffHours} sa once`;
    else timeAgo = `${diffHours} sa once`;

    const memoryWithMeta = { ...textMemory, timeAgo };

    return (
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>HOST METIN PAYLASIMI</Text>
        <HostTextPostCard
          memory={memoryWithMeta}
          onPress={() => {
            // Navigate to participant profile from this memory's user
            if (textMemory.user_id && textMemory.ritual_id) {
              navigation.navigate('ParticipantProfile', {
                userId: textMemory.user_id,
                ritualId: textMemory.ritual_id,
                viewerId: viewerId,
              });
            }
          }}
        />
      </View>
    );
  };

  const renderVenueActivityCard = (venue, index) => {
    const uniqueKey = venue.id ? String(venue.id) : `venue-${index}`;
    const venueName = venue.name || venue.venue_name || '';
    return (
      <VenueActivityCard
        key={uniqueKey}
        venue={venue}
        onPress={() => {
          navigation.navigate('FullRitualsList', {
            venueName,
            venueCity: venue.city || city,
            title: `${venueName} Rituals`,
          });
        }}
        city={city}
      />
    );
  };
  // Show error state if there's an error and no data
  if (error && displayRituals.length === 0 && pulseMemories.length === 0 && !loading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.statusBarSpacer} />
        <View style={[styles.header, isDark && styles.headerDark]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerLogo, isDark && styles.headerLogoDark]}>L.</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate(isDark ? 'CreateRitualDark' : 'CreateRitual')}
                activeOpacity={0.9}
              >
                <MaterialIcons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Pulse</Text>
              <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>Sehrindeki Akis</Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <MaterialIcons name="more-horiz" size={20} color={isDark ? '#f9fafb' : '#000000'} />
            </TouchableOpacity>
          </View>
        </View>
        <ErrorState
          title="Pulse yuklenemedi"
          message="Rituals yuklenemedi. Baglantini kontrol edip tekrar dene."
          onRetry={handleRetry}
        />
      </View>
    );
  }

  // Show skeleton loader on initial load
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.statusBarSpacer} />
        <View style={[styles.header, isDark && styles.headerDark]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerLogo, isDark && styles.headerLogoDark]}>L.</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate(isDark ? 'CreateRitualDark' : 'CreateRitual')}
                activeOpacity={0.9}
              >
                <MaterialIcons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Pulse</Text>
              <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>Sehrindeki Akis</Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <MaterialIcons name="more-horiz" size={20} color={isDark ? '#f9fafb' : '#000000'} />
            </TouchableOpacity>
          </View>
          <View style={styles.filterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContent}
            >
              {(showDiscoveryFilters || DISCOVERY_FILTERS.includes(activeFilter)
                ? FILTER_OPTIONS
                : CORE_FILTERS
              ).map((filter) => (
                <View key={filter} style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{filter}</Text>
                </View>
              ))}
              {!showDiscoveryFilters && !DISCOVERY_FILTERS.includes(activeFilter) ? (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{MORE_FILTER_CHIP}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <SkeletonList
            count={4}
            renderItem={() => <SkeletonRitualCard style={{ marginBottom: 16 }} />}
          />
        </ScrollView>
      </View>
    );
  }

  const openPulseMoreMenu = () => {
    Alert.alert('Pulse', 'Hizli erisim', [
      { text: 'Ayarlar', onPress: () => navigation.navigate('Settings') },
      { text: 'Moderasyon', onPress: () => navigation.navigate('Moderation') },
      { text: 'City Rhythm', onPress: () => navigation.navigate(isDark ? 'CityRhythmDark' : 'CityRhythm') },
      { text: 'Iptal', style: 'cancel' },
    ]);
  };

  const openNotifications = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_UNREAD_KEY, '0');
      setNotificationUnread(0);
    } catch (_) {}
    navigation.navigate(isDark ? 'NotificationCenterDark' : 'NotificationCenter');
  };

  const openNearbyMap = () => {
    const routeName = isDark ? 'VenueMapDark' : 'VenueMap';
    navigation.navigate(routeName, {
      venueName: `${city} Nearby`,
      venueAddress: 'Yakınındaki Rituals',
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      rituals: allRituals,
    });
  };
  const openVerifiedVenuesMap = () => {
    const routeName = isDark ? 'VenueMapDark' : 'VenueMap';
    const first = filteredRituals?.[0] || {};
    navigation.navigate(routeName, {
      venueName: 'Doğrulanmış Mekanlar',
      venueAddress: `${city} · Onaylı buluşma noktaları`,
      latitude: first.location_lat ?? first.lat ?? null,
      longitude: first.location_lng ?? first.lng ?? null,
          rituals: displayRituals,
    });
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Status Bar Spacer */}
      <View style={styles.statusBarSpacer} />

      {/* Header — always pulsev1.html exact layout */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={[styles.headerTop, styles.headerTopExact]}>
          <View style={styles.headerTopSide}>
            <TouchableOpacity
              style={[styles.createPillor, isDark && styles.createPillorDark]}
              onPress={() => {
                if (!requireVerifiedUser(user, 'Ritual olusturmak icin universite e-postani dogrulamalisin.', navigation)) return;
                navigation.navigate(isDark ? 'CreateRitualDark' : 'CreateRitual');
              }}
              activeOpacity={0.88}
            >
              <Text style={[styles.createPillorText, isDark && styles.createPillorTextDark]}>+ Ritual Olustur</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerLogoCenter} pointerEvents="none">
            <View style={styles.tbCenterRow}>
              <Text style={[styles.tbCenterL, isDark && styles.tbCenterLDark]}>L</Text>
              <View style={[styles.tbDot, isDark && styles.tbDotLight]} />
            </View>
          </View>
          <View style={[styles.headerTopSide, styles.headerTopSideEnd, styles.headerTopRightRow]}>
            <TouchableOpacity
              style={[styles.bellCircle, isDark && styles.bellCircleDark]}
              activeOpacity={0.85}
              onPress={openNotifications}
            >
              <MaterialIcons name="notifications-none" size={18} color={isDark ? PULSE.g400 : PULSE.g500} />
              {notificationUnread > 0 && (
                <View style={[styles.bellBadge, isDark && styles.bellBadgeDark]}>
                  <Text style={styles.bellBadgeText}>{notificationUnread > 99 ? '99+' : notificationUnread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moreCircle, isDark && styles.moreCircleDark]}
              activeOpacity={0.85}
              onPress={openPulseMoreMenu}
            >
              <Text style={[styles.moreDots, isDark && styles.moreDotsDark]}>···</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.headerTitleBlock, styles.headerTitleBlockExact]}>
          <Text style={[styles.headerTitle, styles.headerTitleExact, styles.headerTitleSerif, isDark && styles.headerTitleDark]}>Pulse</Text>
          <Text style={[styles.headerSubtitle, styles.headerSubtitleExact, isDark && styles.headerSubtitleDark]}>Sehrindeki Akis</Text>
        </View>

        {/* Filter Tabs — §8.4 core: Local World / Friends / FL / Uni / Hidden; discovery in "Daha fazla" */}
        <View style={[styles.filterContainer, styles.filterContainerExact]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterContent, styles.filterContentExact]}
          >
            {(showDiscoveryFilters || DISCOVERY_FILTERS.includes(activeFilter)
              ? FILTER_OPTIONS
              : CORE_FILTERS
            ).map((filter) => {
              const isActive = activeFilter === filter;
              const inactiveStyle = styles.filterChipInactiveAll;
              const exactLayout = true;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    isDark && styles.filterChipDark,
                    exactLayout && styles.filterChipExact,
                    isActive && styles.filterChipActive,
                    isActive && isDark && styles.filterChipActiveDark,
                    !isActive && inactiveStyle,
                    !isActive && isDark && styles.filterChipInactiveAllDark,
                  ]}
                  onPress={() => {
                    setActiveFilter(filter);
                    setUseNearby(filter === 'Yakınımda');
                    if (filter === 'FL') {
                      loadPulseMemories('fl');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isDark && styles.filterChipTextDark,
                      isActive && styles.filterChipTextActive,
                      isActive && isDark && styles.filterChipTextActiveDark,
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {!showDiscoveryFilters && !DISCOVERY_FILTERS.includes(activeFilter) ? (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isDark && styles.filterChipDark,
                  styles.filterChipExact,
                  styles.filterChipInactiveAll,
                  isDark && styles.filterChipInactiveAllDark,
                ]}
                onPress={() => setShowDiscoveryFilters(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  {MORE_FILTER_CHIP}
                </Text>
              </TouchableOpacity>
            ) : showDiscoveryFilters ? (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  isDark && styles.filterChipDark,
                  styles.filterChipExact,
                  styles.filterChipInactiveAll,
                  isDark && styles.filterChipInactiveAllDark,
                ]}
                onPress={() => setShowDiscoveryFilters(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark]}>
                  Daha az
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>

      {/* Main Content — Nearby: pulse-nearby-perfect; else by activeFilter */}
      {useNearby ? (
        <PulseNearbyYakinContent
          rituals={
            allRituals.length > 0
              ? allRituals
              : [
                  ...(rituals.live_now || []),
                  ...(rituals.starting_soon || []),
                  ...(rituals.almost_full || []),
                  ...(rituals.reopened || []),
                ]
          }
          pulseMemories={pulseMemories}
          city={city}
          location={location}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onBackToAll={() => {
            setUseNearby(false);
            setActiveFilter('Tümü');
          }}
        />
      ) : activeFilter === 'Tümü' ? (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={pulseMemories}
          pulseReposts={pulseReposts}
          venueActivities={venueActivities}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="all"
          isDark={isDark}
          hasMore={feedHasMore}
          loadingMore={loadingMoreFeed}
          onLoadMore={onLoadMoreAllFeed}
          {...pulseEmptyProps}
        />
      ) : activeFilter === 'Şimdi Canlı' ? (
        <PulseLiveNowPerfectContent
          liveRituals={displayRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Arkadaşlar' ? (
        <FriendsView
          friends={friendsViewFriends.length > 0 ? friendsViewFriends : fallbackFriendsFromEvents}
          memories={friendsViewMemories}
          city={city}
          navigation={navigation}
          fetchFriends={async () => {
            if (!viewerId) return { friends: [], memories: [] };
            const [eventsData, friendsData] = await Promise.all([
              fetchFriendPulseEvents(viewerId, 20).catch(() => []),
              fetchFriends(viewerId, 'accepted').catch(() => []),
            ]);
            const eMap = new Map((eventsData || []).map((e) => [String(e.friend_id || e.user_id || e.id || ''), e]));
            const mappedFriends = (friendsData || []).map((f, idx) => {
              const friendNode = f.friend || f.user || f;
              const fid = String(f.friend_id || f.following_id || f.user_id || friendNode?.id || `friend-${idx}`);
              const ev = eMap.get(fid);
              return {
                id: fid,
                name: friendNode?.name || f.friend_name || 'Arkadaş',
                avatar: friendNode?.avatar_url || friendNode?.avatar || f.friend_avatar || null,
                lastRitualDate:
                  f.last_ritual_date ||
                  f.lastRitualDate ||
                  friendNode?.last_ritual_date ||
                  friendNode?.lastRitualDate ||
                  ev?.last_activity_at ||
                  ev?.created_at ||
                  null,
                sharedRitualCount: Number(ev?.shared_ritual_count || f.shared_count || 0),
                firstMetDate: f.created_at || ev?.created_at || null,
                firstMetRitual: { name: cleanFriendsText(ev?.ritual_title || 'Ritualde'), date: ev?.created_at || f.created_at || null },
                coverImage: ev?.cover_image || ev?.image_url || null,
                handwrittenQuote: ev?.quote || null,
                firstConversationNote: cleanFriendsText(ev?.quote || f.note || ''),
                isActive: Boolean(ev?.is_active || ev?.time_state === 'live_now'),
                activeRitual: { name: cleanFriendsText(ev?.ritual_title || 'Ritual'), venue: cleanFriendsText(ev?.venue_name || city) },
                ctaLabel: ev?.ritual_title ? `${cleanFriendsText(ev.ritual_title)}'a katıl` : undefined,
                stats: {
                  sharedRituals: Number(ev?.shared_ritual_count || 0),
                  lastMeetingDate: ev?.created_at || f.updated_at || null,
                  sharedMemories: Number(ev?.shared_memory_count || 0),
                },
              };
            });
            const mappedSharedMemories = (pulseMemories || []).slice(0, 4).map((m, idx) => ({
                id: `shared-${m.id || idx}`,
                type: 'shared-memory',
                image: m.photo_url || m.image_url || null,
                title: cleanFriendsText(m.ritual_title || m.content || 'Ortak anı'),
                venue: cleanFriendsText(m.venue_name || city),
                date: m.created_at || new Date().toISOString(),
                participants: (mappedFriends || []).slice(0, 3).map((ff) => ({ name: ff.name, avatar: ff.avatar })),
              }));
            const mappedRitualTogether = (displayRituals || [])
                .filter((r) => Number(r.friends_here || 0) > 0)
                .slice(0, 2)
                .map((r, idx) => ({
                  id: `rt-${r.id || idx}`,
                  type: 'ritual-together',
                  ritualName: cleanFriendsText(r.title || 'Ritual'),
                  venue: cleanFriendsText(r.venue_name || r.location_name || city),
                  bgImage: r.image_url || null,
                  date: r.start_time || new Date().toISOString(),
                  seatsLeft: Number(Math.max(0, (r.max_attendees || 10) - (r.current_attendees || 0))),
                  friendsGoing: (mappedFriends || []).slice(0, 3).map((ff) => ({ name: ff.name, avatar: ff.avatar })),
                }));
            const mappedQuotes = (eventsData || [])
                .filter((e) => cleanFriendsText(e.quote || '').length > 0)
                .slice(0, 2)
                .map((e, idx) => ({
                id: `quote-${e.id || idx}`,
                type: 'friend-quote',
                text: cleanFriendsText(e.quote),
                authorName: e.friend_name || 'Arkadaş',
                authorAvatar: e.friend_avatar || null,
                context: `${cleanFriendsText(e.ritual_title || 'PULSE')} · now`,
                heat: 'warm',
              }));
            const fallbackQuotes =
              mappedQuotes.length > 0
                ? []
                : (pulseMemories || [])
                    .filter((m) => cleanFriendsText(m.content || '').length >= 8)
                    .slice(0, 2)
                    .map((m, idx) => ({
                      id: `quote-memory-${m.id || idx}`,
                      type: 'friend-quote',
                      text: cleanFriendsText(m.content || m.ritual_title),
                      authorName: cleanFriendsText(m.user_name || m.host_name || mappedFriends?.[idx]?.name || 'Arkadaş'),
                      authorAvatar:
                        m.user_avatar_url ||
                        m.avatar_url ||
                        mappedFriends?.[idx]?.avatar ||
                        null,
                      context: `${cleanFriendsText(m.ritual_title || 'PULSE')} · memory`,
                      heat: 'warm',
                    }));
            const mappedMemories = [
              ...mappedSharedMemories,
              ...mappedRitualTogether,
              ...mappedQuotes,
              ...fallbackQuotes,
            ].slice(0, 10);
            return { friends: mappedFriends, memories: mappedMemories };
          }}
          onBack={() => setActiveFilter('Tümü')}
        />
      ) : activeFilter === 'Takip Edilenler' ? (
        <FollowingView
          initialItems={[
            ...(displayRituals || []).slice(0, 12).map((r, idx) => ({
              id: String(r.id || `ritual-${idx}`),
              type: r.is_followed_venue_active ? 'venue-live' : r.is_pivot_host ? 'creator-pulse' : 'host-ritual',
              postedAt: r.created_at || r.start_time || new Date().toISOString(),
              title: cleanFriendsText(r.title || 'Ritual'),
              text: cleanFriendsText(r.description || r.title || ''),
              coverImage: r.image_url || r.venue_image_url,
              image: r.image_url || r.venue_image_url,
              entity: {
                id: String(r.host_id || r.venue_id || `entity-${idx}`),
                kind: r.is_followed_venue_active ? 'venue' : r.is_pivot_host ? 'creator' : 'host',
                name: cleanFriendsText(r.host_name || r.venue_name || city),
                avatar: r.host_avatar || r.venue_image_url || r.image_url,
                verified: Boolean(r.is_host_verified || r.is_venue_verified),
                followedSince: r.created_at || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: Boolean(isRitualLiveNow(r)),
                avgPostsPerWeek: Number(r.is_pivot_host ? 3 : 1),
              },
            })),
            ...(pulseMemories || [])
              .filter((m, idx, arr) => {
                const sig = cleanFriendsText(m.content || m.playlist_name || m.ritual_title || '');
                return (
                  sig.length > 0 &&
                  arr.findIndex(
                    (x) =>
                      cleanFriendsText(
                        x.content || x.playlist_name || x.ritual_title || ''
                      ) === sig
                  ) === idx
                );
              })
              .slice(0, 3)
              .map((m, idx) => ({
              id: `mem-${m.id || idx}`,
              type: m.photo_url || m.image_url ? 'host-memory' : 'host-voice',
              postedAt: m.created_at || new Date().toISOString(),
              title: cleanFriendsText(m.ritual_title || 'Anı'),
              image: m.photo_url || m.image_url,
              text: cleanFriendsText(m.content || m.playlist_name || m.ritual_title || ''),
              entity: {
                id: String(m.user_id || `memory-entity-${idx}`),
                kind: 'host',
                name: cleanFriendsText(m.user_name || m.host_name || 'Host'),
                avatar: m.user_avatar_url || m.avatar_url,
                followedSince: m.created_at || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: false,
                avgPostsPerWeek: 2,
              },
            })),
            ...(venueActivities || []).slice(0, 2).map((v, idx) => ({
              id: `venue-${v.id || idx}`,
              type: 'venue-live',
              postedAt: v.updated_at || new Date().toISOString(),
              title: cleanFriendsText(v.name || v.venue_name || 'Mekan'),
              coverImage: v.image_url || v.photo_url,
              entity: {
                id: String(v.id || `venue-entity-${idx}`),
                kind: 'venue',
                name: cleanFriendsText(v.name || v.venue_name || city),
                avatar: v.image_url || v.photo_url,
                verified: true,
                followedSince:
                  v.created_at ||
                  new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: Boolean((v.upcoming_rituals || []).length),
                avgPostsPerWeek: 1,
              },
            })),
          ]}
          fetchFollowing={async ({ kind = 'all', offset = 0, limit = 20 } = {}) => {
            const ritualItems = (displayRituals || []).map((r, idx) => ({
              id: String(r.id || `ritual-${idx}`),
              type: r.is_followed_venue_active ? 'venue-live' : r.is_pivot_host ? 'creator-pulse' : 'host-ritual',
              postedAt: r.created_at || r.start_time || new Date().toISOString(),
              title: cleanFriendsText(r.title || 'Ritual'),
              text: cleanFriendsText(r.description || r.title || ''),
              coverImage: r.image_url || r.venue_image_url,
              image: r.image_url || r.venue_image_url,
              entity: {
                id: String(r.host_id || r.venue_id || `entity-${idx}`),
                kind: r.is_followed_venue_active ? 'venue' : r.is_pivot_host ? 'creator' : 'host',
                name: cleanFriendsText(r.host_name || r.venue_name || city),
                avatar: r.host_avatar || r.venue_image_url || r.image_url,
                verified: Boolean(r.is_host_verified || r.is_venue_verified),
                followedSince: r.created_at || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: Boolean(isRitualLiveNow(r)),
                avgPostsPerWeek: Number(r.is_pivot_host ? 3 : 1),
              },
            }));
            const memoryItems = (pulseMemories || [])
              .filter((m, idx, arr) => {
                const sig = cleanFriendsText(m.content || m.playlist_name || m.ritual_title || '');
                return (
                  sig.length > 0 &&
                  arr.findIndex(
                    (x) =>
                      cleanFriendsText(
                        x.content || x.playlist_name || x.ritual_title || ''
                      ) === sig
                  ) === idx
                );
              })
              .map((m, idx) => ({
              id: `mem-${m.id || idx}`,
              type: m.photo_url || m.image_url ? 'host-memory' : 'host-voice',
              postedAt: m.created_at || new Date().toISOString(),
              title: cleanFriendsText(m.ritual_title || 'Anı'),
              image: m.photo_url || m.image_url,
              text: cleanFriendsText(m.content || m.playlist_name || m.ritual_title || ''),
              entity: {
                id: String(m.user_id || `memory-entity-${idx}`),
                kind: 'host',
                name: cleanFriendsText(m.user_name || m.host_name || 'Host'),
                avatar: m.user_avatar_url || m.avatar_url,
                followedSince: m.created_at || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: false,
                avgPostsPerWeek: 2,
              },
            }));
            const venueItems = (venueActivities || []).map((v, idx) => ({
              id: `venue-${v.id || idx}`,
              type: 'venue-live',
              postedAt: v.updated_at || new Date().toISOString(),
              title: cleanFriendsText(v.name || v.venue_name || 'Mekan'),
              coverImage: v.image_url || v.photo_url,
              entity: {
                id: String(v.id || `venue-entity-${idx}`),
                kind: 'venue',
                name: cleanFriendsText(v.name || v.venue_name || city),
                avatar: v.image_url || v.photo_url,
                verified: true,
                followedSince: v.created_at || new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: Boolean((v.upcoming_rituals || []).length),
                avgPostsPerWeek: 1,
              },
            }));

            const deduped = [];
            const seen = new Set();
            for (const row of [...ritualItems, ...memoryItems, ...venueItems]) {
              const sig = `${row.type}|${String(row.id)}|${cleanFriendsText(
                row.title || row.text || row.entity?.name || ''
              )}`;
              if (seen.has(sig)) continue;
              seen.add(sig);
              deduped.push(row);
            }

            const all = deduped.sort(
              (a, b) => new Date(b.postedAt) - new Date(a.postedAt)
            );
            const filtered = kind === 'all' ? all : all.filter((item) => item.entity?.kind === kind);
            const page = filtered.slice(offset, offset + limit);
            return {
              items: page,
              hasMore: offset + limit < filtered.length,
            };
          }}
          navigation={navigation}
          onBack={() => setActiveFilter('Tümü')}
        />
      ) : activeFilter === 'Local World' ? (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={pulseMemories}
          pulseReposts={pulseReposts}
          venueActivities={venueActivities}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="local_world"
          isDark={isDark}
          hasMore={false}
          loadingMore={false}
          {...pulseEmptyProps}
        />
      ) : activeFilter === 'FL' ? (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={pulseMemories}
          pulseReposts={pulseReposts}
          venueActivities={venueActivities}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="fl"
          isDark={isDark}
          hasMore={false}
          loadingMore={false}
          {...pulseEmptyProps}
        />
      ) : activeFilter === 'Uni' ? (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={pulseMemories}
          pulseReposts={pulseReposts}
          venueActivities={venueActivities}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="uni"
          isDark={isDark}
          hasMore={false}
          loadingMore={false}
          {...pulseEmptyProps}
        />
      ) : activeFilter === 'Gizli' ? (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={[]}
          pulseReposts={[]}
          venueActivities={[]}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="hidden"
          isDark={isDark}
          hasMore={false}
          loadingMore={false}
          {...pulseEmptyProps}
        />
      ) : activeFilter === 'Özel Etkinlikler' ? (
        <SpecialEventsView
          initialItems={mapSpecialItemsFromData(displayRituals, pulseMemories, city)}
          fetchSpecialEvents={async ({ offset = 0, limit = 15 }) => {
            const allItems = mapSpecialItemsFromData(displayRituals, pulseMemories, city);
            const sorted = allItems.sort((a, b) => {
              const aT = new Date(a?.registrationClosesAt || Date.now()).getTime();
              const bT = new Date(b?.registrationClosesAt || Date.now()).getTime();
              return aT - bT;
            });
            return {
              items: sorted.slice(offset, offset + limit),
              hasMore: offset + limit < sorted.length,
            };
          }}
          navigation={navigation}
          onBack={() => setActiveFilter('Tümü')}
        />
      ) : activeFilter === 'Başlamak Üzere' ? (
        <PulseStartingSoonExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Yer Var' ? (
        <PulseSeatsAvailableExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Bu Gece' ? (
        <PulseTonightExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Bu Hafta' ? (
        <PulseThisWeekExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Hafta Sonu' ? (
        <PulseWeekendExactContent
          rituals={filteredRituals}
          city={city}
          navigation={navigation}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Doğrulanmışlar' ? (
        <PulseVerifiedExactContent
          filteredRituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Ücretsiz Giriş' ? (
        <PulseFreeEntryExactContent
          filteredRituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Pivot Hostlar' ? (
        <PulsePivotHostsExactContent
          filteredRituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Seri' ? (
        <PulseRecurringExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === "LOCAL'de Yeni" ? (
        <PulseLocalNewExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : activeFilter === 'Sabah' ? (
        <PulseMorningExactContent
          rituals={displayRituals}
          city={city}
          navigation={navigation}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isDark={isDark}
        />
      ) : (
        <PulseExactAllContent
          filteredRituals={displayRituals}
          pulseMemories={pulseMemories}
          pulseReposts={pulseReposts}
          venueActivities={venueActivities}
          viewer={user}
          city={city}
          navigation={navigation}
          getCardType={getCardType}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentMode="all"
          isDark={isDark}
          hasMore={false}
          loadingMore={false}
          {...pulseEmptyProps}
        />
      )}

      {/* Bottom nav — pul.html: fixed, white, rounded-t-[2rem], Pulse active with L. */}
      <View style={[styles.bottomNav, isDark && styles.bottomNavDark]}>
        <TouchableOpacity style={styles.bottomNavButtonActive} onPress={() => {}}>
          <View style={styles.bottomNavPulseCircle}>
            <Text style={styles.bottomNavPulseLogo}>L.</Text>
          </View>
          <Text style={[styles.bottomNavLabelActive, isDark && styles.bottomNavLabelActiveDark]}>Pulse</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomNavButton}
          onPress={() => navigation.navigate('Local')}
        >
          <MaterialIcons name="public" size={24} color={isDark ? '#9CA3AF' : TEXT_TERTIARY} />
          <Text style={[styles.bottomNavLabel, isDark && styles.bottomNavLabelDark]}>Local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomNavButton}
          onPress={() => navigation.navigate('CityRhythm')}
        >
          <MaterialIcons name="calendar-today" size={24} color={isDark ? '#9CA3AF' : TEXT_TERTIARY} />
          <Text style={[styles.bottomNavLabel, isDark && styles.bottomNavLabelDark]}>City Rhythm</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomNavButton}
          onPress={() => navigation.navigate('SocialPassport')}
        >
          <MaterialIcons name="account-circle" size={24} color={isDark ? '#9CA3AF' : TEXT_TERTIARY} />
          <Text style={[styles.bottomNavLabel, isDark && styles.bottomNavLabelDark]}>Social Passport</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomNavPill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_LIGHT,
  },
  containerDark: {
    backgroundColor: PULSE.screenDark,
  },
  statusBarSpacer: {
    height: 44,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: CARD_LIGHT,
  },
  headerDark: {
    backgroundColor: PULSE.screenDark,
  },
  verifyBanner: {
    alignSelf: 'stretch',
    backgroundColor: '#fde68a',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#7c2d12',
  },
  actionLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    backgroundColor: 'transparent',
    zIndex: 200,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  headerTopExact: {
    alignItems: 'center',
    marginBottom: 18,
  },
  headerTopSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerTopSideEnd: {
    justifyContent: 'flex-end',
  },
  createPillor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 5,
    paddingLeft: 7,
    paddingRight: 11,
    borderRadius: 100,
    flexShrink: 1,
    minWidth: 0,
  },
  createPillorDark: {
    backgroundColor: PULSE.createPillDarkBg,
    borderWidth: 1,
    borderColor: PULSE.createPillDarkBorder,
  },
  createPillorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  createPillorTextDark: {
    color: PULSE.createPillDarkText,
  },
  headerLogoCenter: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tbCenterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  tbCenterL: {
    fontFamily: FONT_SERIF,
    fontSize: 22,
    fontWeight: '400',
    color: '#000000',
    lineHeight: 24,
  },
  tbCenterLDark: {
    color: '#ffffff',
  },
  tbDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000000',
    marginBottom: 4,
  },
  tbDotLight: {
    backgroundColor: '#ffffff',
  },
  headerTopRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PULSE.bellBorderLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellCircleDark: {
    borderColor: PULSE.bellBorderDark,
    backgroundColor: PULSE.moreBgDark,
  },
  bellBadgeDark: {
    borderWidth: 2,
    borderColor: PULSE.screenDark,
  },
  moreCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PULSE.bellBorderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreCircleDark: {
    borderColor: PULSE.bellBorderDark,
    backgroundColor: PULSE.moreBgDark,
  },
  moreDots: {
    fontSize: 13,
    color: PULSE.g500,
    fontWeight: '700',
    marginTop: -4,
  },
  moreDotsDark: {
    color: PULSE.g400,
  },
  headerLogoL: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  headerLogoLocal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  moreButtonMuted: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  moreButtonMutedDark: {
    backgroundColor: '#111827',
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start', // pul.html: L. self-start
  },
  headerLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: PRIMARY_COLOR,
    letterSpacing: -0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  headerLogoDark: {
    color: '#f9fafb',
  },
  headerLogoExact: {
    marginBottom: 2,
    marginLeft: 0,
    fontWeight: '700',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MORE_BUTTON_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
    marginTop: 4,
  },
  createButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: TAB_RADIUS,
  },
  createButtonPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButtonPillTextExact: {
    fontSize: 15,
  },
  headerCenterLogo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLocalLabel: {
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 0,
    textTransform: 'uppercase',
  },
  headerLocalLabelExact: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#999999',
    marginTop: 2,
  },
  headerTitleBlock: {
    alignItems: 'center',
    paddingTop: 4,
    marginBottom: 0,
  },
  headerTitleBlockExact: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  headerTitleDark: {
    color: '#f9fafb',
  },
  headerTitleExact: {
    fontWeight: '500',
    lineHeight: 28,
    marginBottom: 0,
  },
  headerTitleSerif: {
    fontFamily: FONT_SERIF,
    fontWeight: '500',
    fontSize: 28,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
    marginTop: 2,
  },
  headerSubtitleDark: {
    color: '#9CA3AF',
  },
  headerSubtitleExact: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  filterContainer: {
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 18,
  },
  filterContainerExact: {
    marginBottom: 12,
  },
  filterContent: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 18,
  },
  filterContentExact: {
    gap: 6,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: TAB_RADIUS,
    backgroundColor: CARD_LIGHT,
    borderWidth: 1.5,
    borderColor: PULSE.borderLight,
  },
  filterChipDark: {
    backgroundColor: PULSE.cardSurfaceDark,
    borderColor: PULSE.borderDark,
  },
  filterChipExact: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 100,
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterChipActiveDark: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterChipInactiveAll: {
    backgroundColor: PULSE.nm,
    borderColor: PULSE.borderLight,
  },
  filterChipInactiveAllDark: {
    backgroundColor: PULSE.cardSurfaceDark,
    borderColor: PULSE.borderDark,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: PULSE.g600,
  },
  filterChipTextDark: {
    color: PULSE.g500,
  },
  filterChipTextActive: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterChipTextActiveDark: {
    color: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCol: {
    width: (width - 32 - 12) / 2,
  },
  fullWidthContainer: {
    width: '100%',
    marginBottom: 16,
  },
  specialEventContainer: {
    width: '100%',
    marginBottom: 16,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  repostCardGap: {
    marginTop: 10,
  },
  allHeroBlock: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 2,
    marginBottom: 4,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    width: '100%',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 18,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: CARD_LIGHT,
    borderTopWidth: 1,
    borderTopColor: GRAY_100,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 8,
  },
  bottomNavDark: {
    backgroundColor: PULSE.bottomNavDark,
    borderTopColor: PULSE.bottomNavBorderDark,
  },
  bottomNavButton: {
    alignItems: 'center',
    width: 80,
  },
  bottomNavButtonActive: {
    alignItems: 'center',
    width: 80,
  },
  bottomNavPulseCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavPulseLogo: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontWeight: '900',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bottomNavLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_TERTIARY,
    marginTop: 6,
  },
  bottomNavLabelDark: {
    color: '#9CA3AF',
  },
  bottomNavLabelActive: {
    fontSize: 8,
    fontWeight: '700',
    color: PULSE.navy,
    marginTop: 6,
  },
  bottomNavLabelActiveDark: {
    color: '#ffffff',
  },
  bottomNavPill: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -64,
    width: 128,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY_COLOR,
  },
});
