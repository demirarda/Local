import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ActivityIndicator, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Mapbox from '@rnmapbox/maps';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import useAuthStore from '../store/authStore';
import { browseRituals, fetchPulseMemories, fetchPulseRituals, fetchVenueActivity } from '../services/api';
import MainBottomNav from '../components/MainBottomNav';

const DEFAULT_CENTER = {
  latitude: 45.4642,
  longitude: 9.19,
};

const FALLBACK_NODES = [
  {
    id: 'fb-live-1',
    type: 'live',
    title: 'Canli Ritual (Demo)',
    latitude: 45.4639,
    longitude: 9.1884,
    radius: 250,
    xp: 26,
    popularity: 3,
    density: 3,
    color: '#fb7185',
    icon: 'local-fire-department',
    flavor: 'Su an canli: topluluk anlik etkileşimde.',
  },
  {
    id: 'fb-r-1',
    type: 'ritual',
    title: 'Ritual (Demo)',
    latitude: 45.4648,
    longitude: 9.187,
    radius: 240,
    xp: 18,
    color: '#06b6d4',
    icon: 'self-improvement',
    flavor: 'Demo Ritual noktasi (API bossa gosterilir).',
  },
  {
    id: 'fb-m-1',
    type: 'memory',
    title: 'Ani (Demo)',
    latitude: 45.465,
    longitude: 9.193,
    radius: 230,
    xp: 18,
    color: '#22c55e',
    icon: 'auto-awesome',
    flavor: 'Demo ani noktasi (API bossa gosterilir).',
  },
  {
    id: 'fb-q-1',
    type: 'quote',
    title: 'Alinti (Demo)',
    latitude: 45.4628,
    longitude: 9.191,
    radius: 210,
    xp: 14,
    color: '#14b8a6',
    icon: 'format-quote',
    flavor: '"Demo alinti" (API bossa gosterilir).',
  },
  {
    id: 'fb-t-1',
    type: 'trace',
    title: 'Topluluk Izi (Demo)',
    latitude: 45.4661,
    longitude: 9.1942,
    radius: 220,
    xp: 16,
    popularity: 2,
    density: 2,
    color: '#f97316',
    icon: 'place',
    flavor: 'Bolge yogunlugu yuksek, canli akış var.',
  },
];

// Guaranteed showcase nodes for all product scenarios (photo/song/quote/live/upcoming/venue-event).
const SCENARIO_DEMO_NODES = [
  {
    id: 'sc-photo-memory-1',
    type: 'memory',
    title: 'Duomo Gundogumu Fotografi',
    latitude: 45.4643,
    longitude: 9.1916,
    radius: 220,
    xp: 20,
    popularity: 2,
    density: 2,
    color: '#22c55e',
    icon: 'photo-camera',
    flavor: 'Bir kullanici bu sabah Duomo manzarasi paylasti.',
    sourceKind: 'memory',
    contentKind: 'photo',
    mediaUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=70',
  },
  {
    id: 'sc-song-memory-1',
    type: 'memory',
    title: 'Sehirde Calan Sarki',
    latitude: 45.4632,
    longitude: 9.1888,
    radius: 210,
    xp: 17,
    popularity: 2,
    density: 2,
    color: '#22c55e',
    icon: 'music-note',
    flavor: 'Topluluk su an bu parcayi dinliyor.',
    sourceKind: 'memory',
    contentKind: 'song',
    songTitle: 'Midnight City',
    songArtist: 'M83',
  },
  {
    id: 'sc-quote-memory-1',
    type: 'quote',
    title: 'Gunun Alintisi',
    latitude: 45.4654,
    longitude: 9.1896,
    radius: 210,
    xp: 14,
    popularity: 1,
    density: 1,
    color: '#facc15',
    icon: 'format-quote',
    flavor: 'Sehir, hikayesiyle gezenleri degistirir.',
    sourceKind: 'memory',
    contentKind: 'quote',
    quoteText: 'Sehir, hikayesiyle gezenleri degistirir.',
  },
  {
    id: 'sc-live-event-1',
    type: 'live',
    title: 'Canli Acik Hava Yoga',
    latitude: 45.466,
    longitude: 9.1909,
    radius: 260,
    xp: 26,
    popularity: 3,
    density: 3,
    color: '#fb7185',
    icon: 'local-fire-department',
    flavor: 'Etkinlik su an devam ediyor.',
    sourceKind: 'event',
    eventState: 'live',
    startLabel: 'Canli',
    venueName: 'Giardini Pubblici',
    organizerName: 'Milano Wellness Club',
  },
  {
    id: 'sc-upcoming-event-1',
    type: 'ritual',
    title: 'Sunset Rooftop Meetup',
    latitude: 45.4671,
    longitude: 9.1933,
    radius: 250,
    xp: 21,
    popularity: 2,
    density: 2,
    color: '#22d3ee',
    icon: 'event',
    flavor: 'Rooftop bulusmasi yaklasiyor.',
    sourceKind: 'event',
    eventState: 'upcoming',
    startLabel: '45 dk sonra',
    venueName: 'Porta Nuova Terrace',
    organizerName: 'Urban Social Lab',
  },
  {
    id: 'sc-venue-event-1',
    type: 'trace',
    title: 'Mekanda Canli DJ Set',
    latitude: 45.4621,
    longitude: 9.1926,
    radius: 235,
    xp: 18,
    popularity: 2,
    density: 2,
    color: '#f97316',
    icon: 'storefront',
    flavor: 'Mekan bu gece ozel DJ etkinligi duzenliyor.',
    sourceKind: 'venue',
    eventState: 'live',
    startLabel: 'Canli',
    venueName: 'Navigli Loft',
    organizerName: 'Loft Collective',
  },
];

const REQUIRED_NODE_TYPES = ['live', 'ritual', 'memory', 'quote', 'trace'];
const DWELL_UNLOCK_MS = 90 * 1000;
const DWELL_STORE_KEY = '@mapbox_local_dwell_progress_v1';
const DWELL_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;
const DWELL_RING_CIRC = 2 * Math.PI * 64;
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

const MAPBOX_PUBLIC_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN || '';
const MAPBOX_STYLE_URL = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL || Mapbox.StyleURL.Street;
// User request: make the base map look like real world (open/bright, mostly white).
const FORCE_MAPBOX_LIGHT_STYLE = false;
const REAL_WORLD_STYLE_URL = Mapbox.StyleURL.Street;
const SHOW_DEBUG_PILL = false;
if (MAPBOX_PUBLIC_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);
}

const HIGH_CONTRAST_COLORS = {
  live: '#fb7185',
  ritual: '#22d3ee',
  memory: '#22c55e',
  quote: '#facc15',
  trace: '#f97316',
  quest: '#a78bfa',
  legend: '#ef4444',
};

// rnmapbox/maps bazı atmosfer/ışık renk alanlarında RN'nin processColor dönüşümüne
// takılıp "Unexpected value for color" logları üretebiliyor.
// Gerçekçilik hissini overlay + extrusion tonlama ile verdiğimiz için şimdilik kapalı tutuyoruz.
const ENABLE_ATMOSPHERE_LIGHT = false;
// User wants the map itself to feel "real world" (less neon tint).
// We keep futuristic neon for nodes/UI, but tone down the global overlays.
const ENABLE_NEON_MAP_TINT = false;

const FUTURE_NEON = {
  cyan: '#22d3ee',
  magenta: '#f472b6',
  lime: '#a3e635',
  amber: '#fbbf24',
  violet: '#a78bfa',
};

const SCENARIO_META = {
  photo_memory: { label: 'FOTO ANI', emoji: '📷', accent: '#60a5fa', pinScale: 1.18 },
  song_memory: { label: 'SARKI ANI', emoji: '🎵', accent: '#a78bfa', pinScale: 1.12 },
  quote_memory: { label: 'ALINTI', emoji: '❝', accent: '#fbbf24', pinScale: 1.08 },
  text_memory: { label: 'ANI', emoji: '✦', accent: '#22c55e', pinScale: 1.04 },
  live_event: { label: 'CANLI ETKINLIK', emoji: '●', accent: '#fb7185', pinScale: 1.22 },
  upcoming_event: { label: 'YAKLASAN ETKINLIK', emoji: '⏳', accent: '#f59e0b', pinScale: 1.12 },
  venue_event: { label: 'MEKAN ETKINLIGI', emoji: '⌂', accent: '#f97316', pinScale: 1.12 },
  trace: { label: 'IZ', emoji: '◎', accent: '#14b8a6', pinScale: 1.02 },
  default: { label: 'NODE', emoji: '•', accent: '#38bdf8', pinScale: 1 },
};
const FOG_WORLD_RING = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

const buildCircleRing = (longitude, latitude, radiusMeters = 300, steps = 48) => {
  const ring = [];
  const latRad = (latitude * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = Math.max(1, 111320 * Math.cos(latRad));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const dx = Math.cos(angle) * radiusMeters;
    const dy = Math.sin(angle) * radiusMeters;
    ring.push([longitude + dx / metersPerDegLng, latitude + dy / metersPerDegLat]);
  }
  return ring;
};

export default function MapboxLocalScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const isDebug = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
  const screenH = Dimensions.get('window').height;
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [zoomLevel, setZoomLevel] = useState(15.5);
  const [loadingWorld, setLoadingWorld] = useState(true);
  const [nodes, setNodes] = useState([]);
  const [nodesVersion, setNodesVersion] = useState(0);
  const [enteringNode, setEnteringNode] = useState(null);
  const [detailNode, setDetailNode] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [focusNodeId, setFocusNodeId] = useState(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [pulseFlip, setPulseFlip] = useState(false);
  const [focusPulsePhase, setFocusPulsePhase] = useState(0);
  const [playerPulsePhase, setPlayerPulsePhase] = useState(0);
  const [activeDwellNodeId, setActiveDwellNodeId] = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [dwellLabel, setDwellLabel] = useState('00:00 / 01:30');
  const [resumableMap, setResumableMap] = useState({});
  const [userGpsLocation, setUserGpsLocation] = useState(null);
  const [totalXp, setTotalXp] = useState(0);
  const [capturedNodeCount, setCapturedNodeCount] = useState(0);
  const [travelCoords, setTravelCoords] = useState([]);
  const [travelProgress, setTravelProgress] = useState(0);
  const [isTravelling, setIsTravelling] = useState(false);
  const holoSweep = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(new Animated.Value(0.96)).current;
  const cinematicFade = useRef(new Animated.Value(0)).current;
  const [cameraCenterCoord, setCameraCenterCoord] = useState([DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude]);
  const [cameraCenterLiveCoord, setCameraCenterLiveCoord] = useState([DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude]);
  const [cameraPitch, setCameraPitch] = useState(66);
  const [cameraHeading, setCameraHeading] = useState(14);
  const [debugLastLoadedCount, setDebugLastLoadedCount] = useState(0);
  const pulseTimerRef = useRef(null);
  const travelTimerRef = useRef(null);
  const focusPulseTimerRef = useRef(null);
  const playerPulseTimerRef = useRef(null);
  const capturedIdsRef = useRef(new Set());
  const autoEnterRef = useRef({ id: null, at: 0 });
  const phaseTwoTimeoutRef = useRef(null);
  const phaseThreeTimeoutRef = useRef(null);
  const closeOverlayTimeoutRef = useRef(null);
  const dwellStartedAtRef = useRef({});
  const dwellPersistRef = useRef({});
  const dwellMilestoneRef = useRef({});
  const lastPersistedProgressRef = useRef({});
  const locationSubRef = useRef(null);
  const dwellProgressAnim = useRef(new Animated.Value(0)).current;
  const ceremonyActive = Boolean(activeDwellNodeId);
  const getResumableProgress = useCallback((nodeId) => {
    const row = dwellPersistRef.current[nodeId];
    if (!row || row.expiresAt < Date.now()) return null;
    if (row.lastProgress < 5 || row.lastProgress >= 100) return null;
    return Math.round(row.lastProgress);
  }, []);

  useEffect(() => {
    let active = true;
    const city = user?.city;
    if (!city) return undefined;

    const resolveCity = async () => {
      try {
        const geocoded = await Location.geocodeAsync(city);
        const first = geocoded?.[0];
        if (!first || !active) return;
        setCenter({
          latitude: first.latitude,
          longitude: first.longitude,
        });
      } catch (_e) {
        // keep default center silently
      }
    };
    resolveCity();
    return () => {
      active = false;
    };
  }, [user?.city]);

  useEffect(() => {
    setCameraCenterCoord([center.longitude, center.latitude]);
  }, [center.longitude, center.latitude]);

  const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const safeMapboxColor = (value, fallback = '#38bdf8') => {
    if (typeof value !== 'string') return fallback;
    const v = value.trim();
    // Accept common Mapbox/RN color syntaxes.
    if (
      v.startsWith('#') ||
      v.startsWith('rgba(') ||
      v.startsWith('rgb(') ||
      v.startsWith('hsl(') ||
      v.startsWith('hsla(') ||
      v === 'transparent' ||
      v === 'white' ||
      v === 'black'
    ) {
      return v;
    }
    return fallback;
  };

  const getLat = (row) =>
    toNumber(
      row?.venue_latitude ??
        row?.location_lat ??
        row?.location_latitude ??
        row?.lat ??
        row?.latitude,
      null
    );

  const getLng = (row) =>
    toNumber(
      row?.venue_longitude ??
        row?.location_lng ??
        row?.location_longitude ??
        row?.lng ??
        row?.longitude,
      null
    );

  const haversineMeters = (aLonLat, bLonLat) => {
    const [lon1, lat1] = aLonLat;
    const [lon2, lat2] = bLonLat;
    const R = 6371000;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lon2 - lon1);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };

  const asText = (v) => (v === null || v === undefined ? '' : String(v).trim());

  const firstNonEmpty = (...values) => {
    for (const v of values) {
      const s = asText(v);
      if (s) return s;
    }
    return '';
  };

  const inferMemoryContentKind = (memory, content) => {
    const explicit = asText(memory?.content_type || memory?.type || memory?.media_type).toLowerCase();
    if (explicit.includes('photo') || explicit.includes('image') || explicit.includes('pic')) return 'photo';
    if (explicit.includes('song') || explicit.includes('music') || explicit.includes('audio')) return 'song';
    if (explicit.includes('quote')) return 'quote';

    const mediaUrl = firstNonEmpty(memory?.image_url, memory?.photo_url, memory?.media_url, memory?.thumbnail_url);
    if (mediaUrl) return 'photo';
    const songHint = firstNonEmpty(memory?.song_title, memory?.track_name, memory?.spotify_url, memory?.apple_music_url);
    if (songHint) return 'song';
    if (content.startsWith('"') || content.length >= 80) return 'quote';
    return 'text';
  };

  const buildEventTiming = (row) => {
    const raw = firstNonEmpty(row?.start_at, row?.starts_at, row?.scheduled_for, row?.event_start_at);
    if (!raw) return { eventState: 'unknown', startLabel: '' };
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return { eventState: 'unknown', startLabel: '' };
    const now = Date.now();
    const delta = dt.getTime() - now;
    const mins = Math.round(delta / 60000);
    if (mins <= 0) return { eventState: 'live', startLabel: 'Simdi' };
    if (mins < 60) return { eventState: 'upcoming', startLabel: `${mins} dk sonra` };
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return { eventState: 'upcoming', startLabel: `${hrs} sa sonra` };
    return { eventState: 'scheduled', startLabel: dt.toLocaleDateString('tr-TR') };
  };

  const resolveScenarioKey = (node) => {
    if (!node) return 'default';
    if (node.sourceKind === 'memory') {
      if (node.contentKind === 'photo') return 'photo_memory';
      if (node.contentKind === 'song') return 'song_memory';
      if (node.contentKind === 'quote') return 'quote_memory';
      return 'text_memory';
    }
    if (node.eventState === 'live') return 'live_event';
    if (node.eventState === 'upcoming') return 'upcoming_event';
    if (node.sourceKind === 'venue') return 'venue_event';
    if (node.type === 'trace') return 'trace';
    return 'default';
  };

  const resolveScenarioMeta = (node) => {
    const key = resolveScenarioKey(node);
    return {
      key,
      ...(SCENARIO_META[key] || SCENARIO_META.default),
    };
  };

  const TYPE_META = {
    live: { color: HIGH_CONTRAST_COLORS.live, icon: 'local-fire-department' },
    memory: { color: HIGH_CONTRAST_COLORS.memory, icon: 'auto-awesome' },
    ritual: { color: HIGH_CONTRAST_COLORS.ritual, icon: 'self-improvement' },
    quote: { color: HIGH_CONTRAST_COLORS.quote, icon: 'format-quote' },
    trace: { color: HIGH_CONTRAST_COLORS.trace, icon: 'place' },
    quest: { color: HIGH_CONTRAST_COLORS.quest, icon: 'flag' },
    legend: { color: '#ef4444', icon: 'workspace-premium' },
  };

  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 6;
  const isTwilight = !isNight && (hour < 8 || hour >= 18);
  const pitchFactorForLighting = Math.max(0, Math.min(1, (cameraPitch - 50) / 30));
  const daylightBoostOpacity = FORCE_MAPBOX_LIGHT_STYLE ? 0.03 : isNight ? 0.12 : isTwilight ? 0.16 : 0.2;
  const cinematicMaxOpacity = isNight ? 0.42 : isTwilight ? 0.3 : 0.2;
  const extrusionOpacity = FORCE_MAPBOX_LIGHT_STYLE
    ? isNight
      ? 0.56 + pitchFactorForLighting * 0.08
      : 0.62 + pitchFactorForLighting * 0.05
    : isNight
      ? 0.84 + pitchFactorForLighting * 0.06
      : 0.72 + pitchFactorForLighting * 0.10;
  const ambientOcclusionIntensity = FORCE_MAPBOX_LIGHT_STYLE
    ? isNight
      ? 0.24 + pitchFactorForLighting * 0.18
      : 0.16 + pitchFactorForLighting * 0.12
    : isNight
      ? 0.54 + pitchFactorForLighting * 0.09
      : 0.26 + pitchFactorForLighting * 0.12;

  // Keep the base style "real-world" (blue water / brown land) by removing most overlays.
  const environmentHazeOpacity = FORCE_MAPBOX_LIGHT_STYLE ? 0.01 : isNight ? 0.09 : isTwilight ? 0.085 : 0.08;
  const environmentVignetteOpacity = FORCE_MAPBOX_LIGHT_STYLE ? 0.02 : (isNight ? 0.06 : isTwilight ? 0.055 : 0.05) + pitchFactorForLighting * 0.02;

  const normalizeRitualNode = (ritual, idx, sourceTag = 'ritual') => {
    const lat = getLat(ritual);
    const lng = getLng(ritual);
    if (lat === null || lng === null) return null;

    const liveFlag =
      sourceTag === 'live' ||
      ritual?.is_live === true ||
      ritual?.live_now === true ||
      String(ritual?.time_state || '').toLowerCase() === 'live_now';
    const kind = liveFlag ? 'live' : 'ritual';
    const meta = TYPE_META[kind];

    const capacity = Math.max(2, toNumber(ritual?.capacity, 8));
    const attendees = Math.max(0, toNumber(ritual?.current_attendees ?? ritual?.joined_count, 0));
    const occupancy = capacity > 0 ? attendees / capacity : 0;
    const popularity = occupancy > 0.8 ? 3 : occupancy > 0.45 ? 2 : 1;
    const { eventState, startLabel } = liveFlag
      ? { eventState: 'live', startLabel: 'Canli' }
      : buildEventTiming(ritual);
    const scenario = resolveScenarioMeta({ sourceKind: 'event', eventState, type: kind });
    return {
      id: `r-${ritual.id || idx}`,
      type: kind,
      title: ritual?.title || 'Yeni Ritual',
      latitude: lat,
      longitude: lng,
      radius: capacity >= 8 ? 280 : 240,
      xp: capacity >= 8 ? 24 : 18,
      popularity,
      density: Math.min(3, Math.max(1, Math.round((capacity + attendees) / 8))),
      color: meta.color,
      icon: meta.icon,
      flavor: `${ritual?.venue_name || 'Yakin Mekan'} · ${capacity} kisi kapasite`,
      eventState,
      startLabel,
      venueName: firstNonEmpty(ritual?.venue_name, ritual?.location_name),
      sourceKind: 'event',
      organizerName: firstNonEmpty(ritual?.host_name, ritual?.organizer_name),
      scenarioKey: scenario.key,
      scenarioLabel: scenario.label,
      pinEmoji: scenario.emoji,
      pinAccent: scenario.accent,
      pinScale: scenario.pinScale,
    };
  };

  const normalizeMemoryNode = (memory, idx) => {
    const lat = getLat(memory);
    const lng = getLng(memory);
    if (lat === null || lng === null) return null;

    const rawContent = String(memory?.content || memory?.text || '').trim();
    const contentKind = inferMemoryContentKind(memory, rawContent);
    const type = contentKind === 'quote' ? 'quote' : 'memory';
    const meta = TYPE_META[type];
    const isQuote = contentKind === 'quote';
    const popularity = rawContent.length > 84 ? 3 : rawContent.length > 40 ? 2 : 1;
    const mediaUrl = firstNonEmpty(memory?.image_url, memory?.photo_url, memory?.media_url, memory?.thumbnail_url);
    const songTitle = firstNonEmpty(memory?.song_title, memory?.track_name, memory?.audio_title);
    const songArtist = firstNonEmpty(memory?.song_artist, memory?.artist_name);
    const scenario = resolveScenarioMeta({ sourceKind: 'memory', contentKind, type });
    return {
      id: `m-${memory.id || idx}`,
      type,
      title: memory?.title || (isQuote ? 'Topluluk Alintisi' : 'Topluluk Anisi'),
      latitude: lat,
      longitude: lng,
      radius: isQuote ? 210 : 230,
      xp: isQuote ? 14 : 18,
      popularity,
      density: popularity,
      color: meta.color,
      icon: meta.icon,
      flavor: rawContent ? rawContent.slice(0, 80) : 'Topluluktan yeni bir ani birakildi.',
      contentKind,
      mediaUrl,
      quoteText: rawContent,
      songTitle,
      songArtist,
      sourceKind: 'memory',
      scenarioKey: scenario.key,
      scenarioLabel: scenario.label,
      pinEmoji: scenario.emoji,
      pinAccent: scenario.accent,
      pinScale: scenario.pinScale,
    };
  };

  const normalizeVenueActivityNode = (activity, idx) => {
    const lat = getLat(activity);
    const lng = getLng(activity);
    if (lat === null || lng === null) return null;

    const meta = TYPE_META.trace;
    const crowd = Math.max(
      0,
      toNumber(activity?.active_count ?? activity?.attendee_count ?? activity?.current_attendees, 0)
    );
    const popularity = crowd >= 20 ? 3 : crowd >= 8 ? 2 : 1;
    const { eventState, startLabel } = buildEventTiming(activity);
    const resolvedEventState = eventState === 'unknown' ? 'live' : eventState;
    const scenario = resolveScenarioMeta({ sourceKind: 'venue', eventState: resolvedEventState, type: 'trace' });
    return {
      id: `v-${activity?.venue_id || activity?.id || idx}`,
      type: 'trace',
      title: activity?.venue_name || activity?.title || 'Canli Topluluk Alani',
      latitude: lat,
      longitude: lng,
      radius: 240,
      xp: 16,
      popularity,
      density: popularity,
      color: meta.color,
      icon: meta.icon,
      flavor: activity?.city ? `${activity.city} · Topluluk hareketi` : 'Topluluk hareketi',
      eventState: resolvedEventState,
      startLabel,
      venueName: firstNonEmpty(activity?.venue_name, activity?.title),
      sourceKind: 'venue',
      organizerName: firstNonEmpty(activity?.organizer_name),
      scenarioKey: scenario.key,
      scenarioLabel: scenario.label,
      pinEmoji: scenario.emoji,
      pinAccent: scenario.accent,
      pinScale: scenario.pinScale,
    };
  };

  const enterNodeExperience = useCallback(
    (node) => {
      if (!node) return;
      setSelectedNodeId(node.id);
      setFocusNodeId(null);
      setDetailNode(null);
      setEnteringNode(node);

      if (!capturedIdsRef.current.has(node.id)) {
        capturedIdsRef.current.add(node.id);
        setTotalXp((prev) => prev + Math.max(6, Number(node?.xp) || 12));
        setCapturedNodeCount(capturedIdsRef.current.size);
      }

      if (focusPulseTimerRef.current) {
        clearInterval(focusPulseTimerRef.current);
        focusPulseTimerRef.current = null;
      }
      setFocusPulsePhase(0);

      const fromCoord = detailNode ? [detailNode.longitude, detailNode.latitude] : cameraCenterCoord;
      const toCoord = [node.longitude, node.latitude];
      const travelSteps = 28;
      const dLon = toCoord[0] - fromCoord[0];
      const dLat = toCoord[1] - fromCoord[1];
      const curveMag = Math.min(0.012, Math.hypot(dLon, dLat) * 0.35);
      const curveSign = Math.sign(dLat || 1);
      const travelPath = Array.from({ length: travelSteps }, (_, i) => {
        const t = travelSteps === 1 ? 1 : i / (travelSteps - 1);
        const lon = fromCoord[0] + dLon * t;
        const lat = fromCoord[1] + dLat * t + curveMag * Math.sin(Math.PI * t) * curveSign;
        return [lon, lat];
      });

      if (travelTimerRef.current) {
        clearInterval(travelTimerRef.current);
        travelTimerRef.current = null;
      }
      setIsTravelling(true);
      setTravelCoords(travelPath);
      setTravelProgress(0);

      // Phase 1: fast approach
      setCameraCenterCoord(fromCoord);
      setCameraPitch(68);
      setCameraHeading(20);
      setZoomLevel((z) => Math.max(z, 17.1));

      // "Travel" along the path for a more immersive node-to-node transition.
      const travelTotalMs = 860;
      const tickMs = 30;
      const ticks = Math.max(1, Math.floor(travelTotalMs / tickMs));
      let travelTick = 0;
      travelTimerRef.current = setInterval(() => {
        travelTick += 1;
        const idx = Math.min(
          travelPath.length - 1,
          Math.floor((travelTick / ticks) * (travelPath.length - 1))
        );
        setTravelProgress(idx / Math.max(1, travelPath.length - 1));
        setCameraCenterCoord(travelPath[idx]);
        if (idx >= travelPath.length - 1) {
          if (travelTimerRef.current) clearInterval(travelTimerRef.current);
          travelTimerRef.current = null;
          setTravelProgress(1);
          setCameraCenterCoord(toCoord);
        }
      }, tickMs);

      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
      }
      let tick = 0;
      pulseTimerRef.current = setInterval(() => {
        tick += 1;
        // 0..1..0 wave for layer-based pulse radius.
        const wave = (Math.sin(tick * 0.42) + 1) / 2;
        setPulsePhase(wave);
      }, 80);

      cinematicFade.setValue(0);
      enterOpacity.setValue(0);
      enterScale.setValue(0.96);
      Animated.parallel([
        Animated.timing(cinematicFade, {
          toValue: cinematicMaxOpacity,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(enterOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(enterScale, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start(() => {});

      // Phase 2: deeper tilt for "entering" feel
      if (phaseTwoTimeoutRef.current) clearTimeout(phaseTwoTimeoutRef.current);
      phaseTwoTimeoutRef.current = setTimeout(() => {
        setCameraPitch(75);
        setCameraHeading(10);
        setZoomLevel((z) => Math.max(z, 18.2));
      }, 320);

      // Phase 3: slight orbit settle
      if (phaseThreeTimeoutRef.current) clearTimeout(phaseThreeTimeoutRef.current);
      phaseThreeTimeoutRef.current = setTimeout(() => {
        setCameraPitch(73);
        setCameraHeading(24);
      }, 680);

      // Close overlay
      if (closeOverlayTimeoutRef.current) clearTimeout(closeOverlayTimeoutRef.current);
      closeOverlayTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(enterOpacity, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(cinematicFade, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setEnteringNode(null);
          setDetailNode(node);
        });

        if (pulseTimerRef.current) {
          clearInterval(pulseTimerRef.current);
          pulseTimerRef.current = null;
        }
        setTimeout(() => setPulsePhase(0), 120);

        if (travelTimerRef.current) {
          clearInterval(travelTimerRef.current);
          travelTimerRef.current = null;
        }
        setIsTravelling(false);
        setTravelCoords([]);
        setTravelProgress(0);
      }, 920);
    },
    [cameraCenterCoord, cinematicFade, cinematicMaxOpacity, detailNode, enterOpacity, enterScale]
  );

  const nodeCollection = {
    type: 'FeatureCollection',
    features: nodes.map((node) => ({
      type: 'Feature',
      id: node.id,
      geometry: {
        type: 'Point',
        coordinates: [node.longitude, node.latitude],
      },
      properties: {
        nodeId: node.id,
        title: node.title,
        color: safeMapboxColor(node.color, '#38bdf8'),
        nodeType: node.type,
        eventState: node.eventState || 'none',
        scenarioKey: node.scenarioKey || resolveScenarioKey(node),
        scenarioLabel: node.scenarioLabel || resolveScenarioMeta(node).label,
        pinEmoji: node.pinEmoji || resolveScenarioMeta(node).emoji,
        pinAccent: safeMapboxColor(node.pinAccent, '#38bdf8'),
        pinScale: toNumber(node.pinScale, 1),
        selected: selectedNodeId === node.id ? 1 : 0,
        focus: focusNodeId === node.id ? 1 : 0,
        beam: enteringNode?.id === node.id ? 1 : 0,
        popularity: node.popularity || 1,
        density: node.density || 1,
      },
    })),
  };

  const onNodesPress = useCallback(
    (event) => {
      const pressed = event?.features?.[0];
      const nodeId = pressed?.properties?.nodeId || pressed?.id;
      if (!nodeId) return;
      const node = nodes.find((n) => String(n.id) === String(nodeId));
      if (node) enterNodeExperience(node);
    },
    [enterNodeExperience, nodes]
  );

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearInterval(pulseTimerRef.current);
      if (travelTimerRef.current) clearInterval(travelTimerRef.current);
      if (focusPulseTimerRef.current) clearInterval(focusPulseTimerRef.current);
      if (playerPulseTimerRef.current) clearInterval(playerPulseTimerRef.current);
      if (phaseTwoTimeoutRef.current) clearTimeout(phaseTwoTimeoutRef.current);
      if (phaseThreeTimeoutRef.current) clearTimeout(phaseThreeTimeoutRef.current);
      if (closeOverlayTimeoutRef.current) clearTimeout(closeOverlayTimeoutRef.current);
    },
    []
  );

  useEffect(() => {
    let tick = 0;
    if (playerPulseTimerRef.current) clearInterval(playerPulseTimerRef.current);
    playerPulseTimerRef.current = setInterval(() => {
      tick += 1;
      const wave = (Math.sin(tick * 0.28) + 1) / 2;
      setPlayerPulsePhase(wave);
    }, 90);

    return () => {
      if (playerPulseTimerRef.current) clearInterval(playerPulseTimerRef.current);
      playerPulseTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pulseToggle = setInterval(() => setPulseFlip((p) => !p), 1100);
    return () => clearInterval(pulseToggle);
  }, []);

  useEffect(() => {
    Animated.timing(dwellProgressAnim, {
      toValue: dwellProgress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dwellProgress, dwellProgressAnim]);

  useEffect(() => {
    let active = true;
    const loadPersistedDwell = async () => {
      const raw = await AsyncStorage.getItem(DWELL_STORE_KEY);
      if (!active || !raw) return;
      const parsed = JSON.parse(raw);
      const now = Date.now();
      const next = {};
      Object.keys(parsed || {}).forEach((key) => {
        const row = parsed[key];
        if (!row || row.expiresAt < now) return;
        next[key] = row;
      });
      dwellPersistRef.current = next;
      setResumableMap({ ...next });
      await AsyncStorage.setItem(DWELL_STORE_KEY, JSON.stringify(next));
    };
    loadPersistedDwell();
    return () => {
      active = false;
      AsyncStorage.setItem(DWELL_STORE_KEY, JSON.stringify(dwellPersistRef.current)).catch(() => {});
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const startLocationWatch = async () => {
      const status = await Location.requestForegroundPermissionsAsync();
      if (!mounted || status.status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (mounted) {
        setUserGpsLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      }
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 8000 },
        (location) => {
          setUserGpsLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );
    };
    startLocationWatch();
    return () => {
      mounted = false;
      if (locationSubRef.current) locationSubRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (!userGpsLocation) return undefined;
    const runDwellTick = async () => {
      const now = Date.now();
      const lockedNodes = nodes.filter((n) => !capturedIdsRef.current.has(n.id));
      const insideNode = lockedNodes.find((node) => {
        const distance = haversineMeters(
          [Number(userGpsLocation.longitude), Number(userGpsLocation.latitude)],
          [Number(node.longitude), Number(node.latitude)]
        );
        return distance <= (node.radius || 200) * 0.6;
      });
      if (!insideNode) {
        setActiveDwellNodeId(null);
        setDwellProgress(0);
        setDwellLabel('00:00 / 01:30');
        return;
      }
      const resumeRow = dwellPersistRef.current[insideNode.id];
      const resumedMs =
        resumeRow && resumeRow.expiresAt > now
          ? Math.max(0, Math.min(DWELL_UNLOCK_MS, (resumeRow.lastProgress / 100) * DWELL_UNLOCK_MS))
          : 0;
      const startedAt = dwellStartedAtRef.current[insideNode.id] || now - resumedMs;
      dwellStartedAtRef.current[insideNode.id] = startedAt;
      const spent = Math.max(0, now - startedAt);
      const progress = Math.min(100, (spent / DWELL_UNLOCK_MS) * 100);
      setActiveDwellNodeId(insideNode.id);
      setDwellProgress(progress);
      const sec = Math.max(0, Math.floor(spent / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      setDwellLabel(`${mm}:${ss} / 01:30`);
      if (spent >= 30000 && !dwellMilestoneRef.current[`${insideNode.id}-30`]) {
        dwellMilestoneRef.current[`${insideNode.id}-30`] = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (spent >= 60000 && !dwellMilestoneRef.current[`${insideNode.id}-60`]) {
        dwellMilestoneRef.current[`${insideNode.id}-60`] = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (spent >= DWELL_UNLOCK_MS) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        delete dwellStartedAtRef.current[insideNode.id];
        delete dwellPersistRef.current[insideNode.id];
        delete lastPersistedProgressRef.current[insideNode.id];
        setResumableMap({ ...dwellPersistRef.current });
        await AsyncStorage.setItem(DWELL_STORE_KEY, JSON.stringify(dwellPersistRef.current));
        setActiveDwellNodeId(null);
        setDwellProgress(0);
        enterNodeExperience(insideNode);
        return;
      }
      dwellPersistRef.current[insideNode.id] = {
        nodeId: insideNode.id,
        lastProgress: progress,
        lastDwellAt: now,
        expiresAt: now + DWELL_RESUME_WINDOW_MS,
      };
      const lastPersisted = lastPersistedProgressRef.current[insideNode.id] || 0;
      if (Math.floor(progress / 10) > Math.floor(lastPersisted / 10)) {
        await AsyncStorage.setItem(DWELL_STORE_KEY, JSON.stringify(dwellPersistRef.current));
        lastPersistedProgressRef.current[insideNode.id] = progress;
        setResumableMap({ ...dwellPersistRef.current });
      }
    };
    runDwellTick();
    const timer = setInterval(runDwellTick, 1000);
    return () => clearInterval(timer);
  }, [nodes, userGpsLocation, enterNodeExperience]);

  useEffect(() => {
    const shouldPulse = !!focusNodeId && !enteringNode && !detailNode;
    if (!shouldPulse) {
      if (focusPulseTimerRef.current) clearInterval(focusPulseTimerRef.current);
      focusPulseTimerRef.current = null;
      setFocusPulsePhase(0);
      return;
    }
    let tick = 0;
    if (focusPulseTimerRef.current) clearInterval(focusPulseTimerRef.current);
    focusPulseTimerRef.current = setInterval(() => {
      tick += 1;
      const wave = (Math.sin(tick * 0.45) + 1) / 2;
      setFocusPulsePhase(wave);
    }, 75);

    return () => {
      if (focusPulseTimerRef.current) clearInterval(focusPulseTimerRef.current);
      focusPulseTimerRef.current = null;
    };
  }, [focusNodeId, enteringNode, detailNode]);

  useEffect(() => {
    if (!ENABLE_NEON_MAP_TINT) return undefined;
    // Subtle hologram sweep for a futuristic "UI energy" feel.
    holoSweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(holoSweep, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [holoSweep]);

  useEffect(() => {
    let mounted = true;
    const loadNodes = async () => {
      const city = user?.city || 'Milano';
      const viewerId = user?.id;
      setLoadingWorld(true);
      try {
        const [ritualBuckets, memories, venueActivities, browseResult] = await Promise.all([
          fetchPulseRituals({ city, viewerId }),
          fetchPulseMemories(city, 14, viewerId),
          fetchVenueActivity({ city, viewerId, limit: 12 }),
          browseRituals({ city, viewer_id: viewerId, limit: 18 }),
        ]);

        const liveNodes = (ritualBuckets?.live_now || [])
          .slice(0, 10)
          .map((item, idx) => normalizeRitualNode(item, idx, 'live'))
          .filter(Boolean);

        const ritualNodes = [...(ritualBuckets?.starting_soon || []), ...(ritualBuckets?.almost_full || [])]
          .slice(0, 10)
          .map((item, idx) => normalizeRitualNode(item, idx, 'ritual'))
          .filter(Boolean);

        const memoryNodes = (memories || [])
          .slice(0, 10)
          .map((item, idx) => normalizeMemoryNode(item, idx))
          .filter(Boolean);

        const venueNodes = (venueActivities || [])
          .slice(0, 10)
          .map((item, idx) => normalizeVenueActivityNode(item, idx))
          .filter(Boolean);

        const browseNodes = (browseResult?.data || [])
          .slice(0, 10)
          .map((item, idx) => normalizeRitualNode(item, idx + 50))
          .filter(Boolean);

        const merged = [...liveNodes, ...ritualNodes, ...memoryNodes, ...venueNodes, ...browseNodes];
        const deduped = [];
        const seen = new Set();
        for (const n of merged) {
          if (!n?.id || seen.has(n.id)) continue;
          seen.add(n.id);
          deduped.push(n);
          if (deduped.length >= 28) break;
        }

        const presentTypes = new Set(deduped.map((n) => n.type));
        const missingTypes = REQUIRED_NODE_TYPES.filter((t) => !presentTypes.has(t));
        if (missingTypes.length > 0) {
          const addByType = FALLBACK_NODES.filter((n) => missingTypes.includes(n.type));
          for (const f of addByType) {
            if (seen.has(f.id)) continue;
            deduped.push(f);
            seen.add(f.id);
          }
        }

        // Guarantee all key product scenarios appear even if backend returns sparse data.
        const scenarioChecks = [
          {
            key: 'photo',
            has: deduped.some((n) => n?.sourceKind === 'memory' && n?.contentKind === 'photo'),
            fallbackId: 'sc-photo-memory-1',
          },
          {
            key: 'song',
            has: deduped.some((n) => n?.sourceKind === 'memory' && n?.contentKind === 'song'),
            fallbackId: 'sc-song-memory-1',
          },
          {
            key: 'quote',
            has: deduped.some((n) => n?.sourceKind === 'memory' && n?.contentKind === 'quote'),
            fallbackId: 'sc-quote-memory-1',
          },
          {
            key: 'liveEvent',
            has: deduped.some((n) => n?.eventState === 'live' && (n?.sourceKind === 'event' || n?.type === 'live')),
            fallbackId: 'sc-live-event-1',
          },
          {
            key: 'upcomingEvent',
            has: deduped.some((n) => n?.eventState === 'upcoming'),
            fallbackId: 'sc-upcoming-event-1',
          },
          {
            key: 'venueEvent',
            has: deduped.some((n) => n?.sourceKind === 'venue'),
            fallbackId: 'sc-venue-event-1',
          },
        ];

        for (const check of scenarioChecks) {
          if (check.has) continue;
          const filler = SCENARIO_DEMO_NODES.find((n) => n.id === check.fallbackId);
          if (!filler || seen.has(filler.id)) continue;
          deduped.push(filler);
          seen.add(filler.id);
        }

        if (!mounted) return;
        if (deduped.length === 0) {
          const fallbackBundle = [...FALLBACK_NODES, ...SCENARIO_DEMO_NODES];
          setNodes(fallbackBundle);
          setDebugLastLoadedCount(fallbackBundle.length);
          setNodesVersion((v) => v + 1);
        } else {
          setNodes(deduped);
          setDebugLastLoadedCount(deduped.length);
          setNodesVersion((v) => v + 1);
        }
      } catch (_e) {
        // If anything fails, keep whatever is already on screen.
      } finally {
        if (mounted) setLoadingWorld(false);
      }
    };
    loadNodes();
    return () => {
      mounted = false;
    };
  }, [user?.city, user?.id]);

  const onCameraChanged = useCallback(
    (state) => {
      const centerPos = state?.properties?.center;
      if (!Array.isArray(centerPos) || centerPos.length < 2) return;
      const nextCoord = [centerPos[0], centerPos[1]];
      // "Live" camera center is only used for proximity calculations/UX hints.
      // We do NOT drive Mapbox's Camera from it to avoid feedback loops / coordinate order issues.
      setCameraCenterLiveCoord(nextCoord);

      if (enteringNode || detailNode) {
        setFocusNodeId(null);
        return;
      }

      let best = null;
      let bestDist = Infinity;
      for (const node of nodes) {
        const d = haversineMeters(nextCoord, [node.longitude, node.latitude]);
        if (d < bestDist) {
          bestDist = d;
          best = node;
        }
      }

      if (!best) {
        setFocusNodeId(null);
        return;
      }

      const threshold = (best.radius || 200) * 0.8;
      setFocusNodeId(bestDist <= threshold ? best.id : null);

      // Pokemon-Go-like "encounter zone": auto-enter when very close.
      const autoThreshold = Math.min(95, (best.radius || 200) * 0.36);
      if (bestDist <= autoThreshold) {
        const now = Date.now();
        const last = autoEnterRef.current;
        const cooldownMs = 4200;
        if (last.id !== best.id || now - last.at > cooldownMs) {
          autoEnterRef.current = { id: best.id, at: now };
          enterNodeExperience(best);
        }
      }
    },
    [detailNode, enteringNode, nodes, enterNodeExperience]
  );

  const travelVisibleIndex =
    travelCoords.length > 1 ? Math.floor(travelProgress * (travelCoords.length - 1)) : -1;
  const playerLevel = Math.max(1, Math.floor(totalXp / 120) + 1);
  const levelBaseXp = (playerLevel - 1) * 120;
  const levelProgress = Math.min(1, Math.max(0, (totalXp - levelBaseXp) / 120));
  const nearNode = nodes.find((n) => String(n.id) === String(focusNodeId || selectedNodeId));
  const detailScenario = resolveScenarioMeta(detailNode);
  const fogOfWarShape = useMemo(() => {
    const unlockedNodes = nodes.filter((n) => capturedIdsRef.current.has(n.id));
    const holeRings = unlockedNodes
      .map((node) => {
        const lon = Number(node?.longitude);
        const lat = Number(node?.latitude);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
        return buildCircleRing(lon, lat, 300, 48);
      })
      .filter(Boolean);
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [FOG_WORLD_RING, ...holeRings],
          },
        },
      ],
    };
  }, [nodes, capturedNodeCount]);

  if (!MAPBOX_PUBLIC_TOKEN) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>Mapbox icin token gerekli</Text>
          <Text style={styles.fallbackBody}>
            `.env` dosyana `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` ekleyince bu ekran aktif calisacak.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={FORCE_MAPBOX_LIGHT_STYLE ? REAL_WORLD_STYLE_URL : MAPBOX_STYLE_URL}
        onCameraChanged={onCameraChanged}
        scrollEnabled={!ceremonyActive}
        zoomEnabled={!ceremonyActive}
        pitchEnabled={!ceremonyActive}
        rotateEnabled={!ceremonyActive}
      >
        <Mapbox.Camera
          zoomLevel={zoomLevel}
          centerCoordinate={cameraCenterCoord}
          animationMode={isTravelling ? 'none' : 'flyTo'}
          animationDuration={350}
          pitch={cameraPitch}
          heading={cameraHeading}
        />

        {ENABLE_ATMOSPHERE_LIGHT ? (
          <>
            <Mapbox.Atmosphere
              style={{
                color: 'rgb(8, 14, 30)',
                highColor: 'rgb(18, 32, 68)',
                horizonBlend: 0.28,
                spaceColor: 'rgb(3, 6, 14)',
                starIntensity: 0.55,
              }}
            />
            <Mapbox.Light
              style={{
                anchor: 'viewport',
                color: '#D4AF37',
                intensity: 0.38,
                position: [1.4, 210, 30],
              }}
            />
          </>
        ) : null}
        <Mapbox.RasterDemSource
          id="mapbox-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxZoomLevel={14}
        />
        <Mapbox.Terrain sourceID="mapbox-dem" style={{ exaggeration: 1.2 }} />
        {['poi-label', 'transit-label', 'airport-label', 'place-label-minor'].map((layerId) => (
          <Mapbox.SymbolLayer
            key={`suppress-${layerId}`}
            id={layerId}
            existing={true}
            style={{ textOpacity: 0, iconOpacity: 0 }}
          />
        ))}
        {['place-neighbourhood', 'place-suburb'].map((layerId) => (
          <Mapbox.SymbolLayer
            key={`keep-${layerId}`}
            id={layerId}
            existing={true}
            style={{ textOpacity: 0.66, iconOpacity: 0 }}
          />
        ))}

        {/* Building realism layer: pushes 3D depth and contrast */}
        <Mapbox.VectorSource id="local-buildings-source" url="mapbox://mapbox.mapbox-streets-v8">
          <Mapbox.FillExtrusionLayer
            id="local-buildings-extrusion"
            sourceLayerID="building"
            filter={['==', ['get', 'extrude'], 'true']}
            minZoomLevel={14}
            style={{
              // When forcing a real-world light map style, use lighter building tones.
              fillExtrusionColor: FORCE_MAPBOX_LIGHT_STYLE
                ? isNight
                  ? '#6f6250'
                  : '#cbb89a'
                : isNight
                  ? '#1e293b'
                  : '#475569',
              fillExtrusionHeight: ['coalesce', ['get', 'height'], 20],
              fillExtrusionBase: ['coalesce', ['get', 'min_height'], 0],
              fillExtrusionOpacity: extrusionOpacity,
              fillExtrusionAmbientOcclusionIntensity: ambientOcclusionIntensity,
              fillExtrusionAmbientOcclusionRadius: 2.8,
              fillExtrusionVerticalGradient: true,
            }}
          />
        </Mapbox.VectorSource>
        <Mapbox.ShapeSource id="fog-of-war-source" shape={fogOfWarShape}>
          <Mapbox.FillLayer
            id="fog-of-war-fill"
            style={{
              fillColor: '#040a18',
              fillOpacity: 0.58,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          key="local-user-source"
          id="local-user-source"
          shape={{
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                id: 'user-center',
                geometry: { type: 'Point', coordinates: cameraCenterLiveCoord },
                properties: {},
              },
            ],
          }}
        >
          <Mapbox.CircleLayer
            id="local-user-radar"
            style={{
              circleRadius: 46 + playerPulsePhase * 4,
              circleColor: '#D4AF37',
              circleOpacity: 0.07 + playerPulsePhase * 0.02,
              circleBlur: 1.2,
            }}
          />
          <Mapbox.CircleLayer
            id="local-user-ring"
            style={{
              circleRadius: 14,
              circleColor: 'transparent',
              circleStrokeColor: '#D4AF37',
              circleStrokeWidth: 2,
              circleStrokeOpacity: 0.8,
            }}
          />
          <Mapbox.CircleLayer
            id="local-user-core"
            style={{
              circleRadius: 5,
              circleColor: '#E8D5A0',
              circleStrokeColor: '#0B1628',
              circleStrokeWidth: 2,
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          key="local-travel-source"
          id="local-travel-source"
          shape={{
            type: 'FeatureCollection',
            features: travelCoords.map((coord, idx) => ({
              type: 'Feature',
              id: `travel-${idx}`,
              geometry: { type: 'Point', coordinates: coord },
              properties: { idx },
            })),
          }}
        >
          <Mapbox.CircleLayer
            id="local-travel-breadcrumbs"
            style={{
              circleColor: FUTURE_NEON.cyan,
              circleOpacity: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                0.7,
                ['<=', ['get', 'idx'], travelVisibleIndex],
                0.22,
                0,
              ],
              circleRadius: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                3.6,
                ['<=', ['get', 'idx'], travelVisibleIndex],
                1.8,
                0,
              ],
              circleStrokeColor: FUTURE_NEON.violet,
              circleStrokeOpacity: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                0.95,
                0,
              ],
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                1.35,
                0,
              ],
            }}
          />
          <Mapbox.CircleLayer
            id="local-travel-glow"
            style={{
              circleColor: FUTURE_NEON.cyan,
              circleOpacity: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                0.11,
                ['<=', ['get', 'idx'], travelVisibleIndex],
                0.05,
                0,
              ],
              circleRadius: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                8.2,
                ['<=', ['get', 'idx'], travelVisibleIndex],
                5.2,
                0,
              ],
              circleStrokeColor: FUTURE_NEON.magenta,
              circleStrokeOpacity: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                0.25,
                0,
              ],
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'idx'], travelVisibleIndex],
                0.9,
                0,
              ],
            }}
          />
        </Mapbox.ShapeSource>

        <Mapbox.ShapeSource
          key={`local-nodes-source-${nodesVersion}`}
          id="local-nodes-source"
          shape={nodeCollection}
          onPress={onNodesPress}
        >
          <Mapbox.CircleLayer
            id="local-nodes-beacon"
            style={{
              circleColor: '#ffffff',
              circleRadius: [
                '*',
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'popularity'],
                  1,
                  11,
                  2,
                  14,
                  3,
                  18,
                ],
                ['coalesce', ['get', 'pinScale'], 1],
              ],
              circleOpacity: [
                'interpolate',
                ['linear'],
                ['get', 'popularity'],
                1,
                0.015,
                2,
                0.025,
                3,
                0.04,
              ],
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 0.8,
              circleStrokeOpacity: 0.12,
            }}
          />
          <Mapbox.CircleLayer
            id="local-live-events-ring"
            filter={['==', ['get', 'eventState'], 'live']}
            style={{
              circleColor: '#fb7185',
              circleOpacity: 0.12 + pulsePhase * 0.06,
              circleRadius: 28 + pulsePhase * 24,
              circleStrokeColor: '#fb7185',
              circleStrokeOpacity: 0.52,
              circleStrokeWidth: 1.8,
            }}
          />
          <Mapbox.CircleLayer
            id="local-upcoming-events-ring"
            filter={['==', ['get', 'eventState'], 'upcoming']}
            style={{
              circleColor: '#fbbf24',
              circleOpacity: 0.08 + focusPulsePhase * 0.05,
              circleRadius: 22 + focusPulsePhase * 12,
              circleStrokeColor: '#f59e0b',
              circleStrokeOpacity: 0.5,
              circleStrokeWidth: 1.2,
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-aura"
            style={{
              circleColor: '#cbd5e1',
              circleRadius: [
                '*',
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'popularity'],
                  1,
                  7.5,
                  2,
                  9,
                  3,
                  10.5,
                ],
                ['coalesce', ['get', 'pinScale'], 1],
              ],
              circleOpacity: [
                'interpolate',
                ['linear'],
                ['get', 'density'],
                1,
                0.045,
                2,
                0.06,
                3,
                0.08,
              ],
              circleStrokeColor: '#94a3b8',
              circleStrokeWidth: 0.6,
              circleStrokeOpacity: 0.24,
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core"
            style={{
              circleColor: ['coalesce', ['get', 'color'], '#D4AF37'],
              circleRadius: [
                '*',
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'popularity'],
                  1,
                  pulseFlip ? 2.4 : 2.0,
                  2,
                  pulseFlip ? 3.0 : 2.5,
                  3,
                  pulseFlip ? 3.8 : 3.2,
                ],
                ['coalesce', ['get', 'pinScale'], 1],
              ],
              circleStrokeColor: '#D4AF37',
              circleStrokeWidth: 2,
              circleStrokeOpacity: pulseFlip ? 0.85 : 0.35,
              circleBlur: 0.4,
              circleOpacity: pulseFlip ? 0.95 : 0.7,
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-live"
            filter={['==', ['get', 'scenarioKey'], 'live_event']}
            style={{ circleColor: '#fb7185', circleRadius: 4.2, circleOpacity: 1 }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-upcoming"
            filter={['==', ['get', 'scenarioKey'], 'upcoming_event']}
            style={{ circleColor: '#f59e0b', circleRadius: 4.2, circleOpacity: 1 }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-photo"
            filter={['==', ['get', 'scenarioKey'], 'photo_memory']}
            style={{ circleColor: '#60a5fa', circleRadius: 4, circleOpacity: 1 }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-song"
            filter={['==', ['get', 'scenarioKey'], 'song_memory']}
            style={{ circleColor: '#a78bfa', circleRadius: 4, circleOpacity: 1 }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-quote"
            filter={['==', ['get', 'scenarioKey'], 'quote_memory']}
            style={{ circleColor: '#fbbf24', circleRadius: 4, circleOpacity: 1 }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-venue"
            filter={['==', ['get', 'scenarioKey'], 'venue_event']}
            style={{ circleColor: '#f97316', circleRadius: 4, circleOpacity: 1 }}
          />
          <Mapbox.SymbolLayer
            id="local-nodes-scenario-icon"
            style={{
              textField: '📌',
              textSize: 20,
              textOffset: [0, -0.34],
              textColor: [
                'case',
                ['==', ['get', 'scenarioKey'], 'live_event'],
                '#fb7185',
                ['==', ['get', 'scenarioKey'], 'upcoming_event'],
                '#f59e0b',
                ['==', ['get', 'scenarioKey'], 'photo_memory'],
                '#60a5fa',
                ['==', ['get', 'scenarioKey'], 'song_memory'],
                '#a78bfa',
                ['==', ['get', 'scenarioKey'], 'quote_memory'],
                '#fbbf24',
                ['==', ['get', 'scenarioKey'], 'venue_event'],
                '#f97316',
                '#334155',
              ],
              textHaloColor: '#ffffff',
              textHaloWidth: 1.2,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-core-highlight"
            style={{
              circleColor: '#ffffff',
              circleRadius: 2.2,
              circleOpacity: 0.95,
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-beam"
            style={{
              circleColor: '#ffffff',
              circleOpacity: [
                'case',
                ['==', ['get', 'beam'], 1],
                0.06 + pulsePhase * 0.11,
                0,
              ],
              circleRadius: [
                'case',
                ['==', ['get', 'beam'], 1],
                26 + pulsePhase * 62,
                0,
              ],
              circleStrokeColor: '#ffffff',
              circleStrokeOpacity: [
                'case',
                ['==', ['get', 'beam'], 1],
                0.55,
                0,
              ],
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'beam'], 1],
                2,
                0,
              ],
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-selected-pulse"
            style={{
              circleColor: '#ffffff',
              circleOpacity: 0.32,
              circleRadius: [
                'case',
                ['==', ['get', 'selected'], 1],
                [
                  '+',
                  12 + pulsePhase * 16,
                  ['*', ['coalesce', ['get', 'popularity'], 1], 1.8],
                ],
                0,
              ],
              circleStrokeColor: FUTURE_NEON.cyan,
              circleStrokeOpacity: 1,
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'selected'], 1],
                3.2,
                0,
              ],
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-selected-glow"
            style={{
              circleColor: FUTURE_NEON.cyan,
              circleOpacity: [
                'case',
                ['==', ['get', 'selected'], 1],
                0.08 + pulsePhase * 0.06,
                0,
              ],
              circleRadius: [
                'case',
                ['==', ['get', 'selected'], 1],
                46 + pulsePhase * 62,
                0,
              ],
              circleStrokeColor: FUTURE_NEON.magenta,
              circleStrokeOpacity: [
                'case',
                ['==', ['get', 'selected'], 1],
                0.06,
                0,
              ],
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'selected'], 1],
                1.2,
                0,
              ],
            }}
          />
          <Mapbox.CircleLayer
            id="local-nodes-focus-pulse"
            style={{
              circleColor: '#ffffff',
              circleOpacity: 0.16,
              circleRadius: [
                'case',
                ['==', ['get', 'focus'], 1],
                10 + focusPulsePhase * 10,
                0,
              ],
              circleStrokeColor: FUTURE_NEON.violet,
              circleStrokeOpacity: 0.7,
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'focus'], 1],
                2.0 + focusPulsePhase * 1.3,
                0,
              ],
            }}
          />
          <Mapbox.SymbolLayer
            id="local-nodes-label"
            style={{
              textField: ['coalesce', ['get', 'title'], ''],
              textSize: 12,
              textOffset: [0, 1.35],
              textColor: '#0f172a',
              textHaloColor: 'rgba(255,255,255,0.96)',
              textHaloWidth: 2.1,
              textOpacity: [
                'case',
                ['==', ['get', 'selected'], 1],
                1,
                ['==', ['get', 'focus'], 1],
                0.85,
                0.08,
              ],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </Mapbox.ShapeSource>
        {Object.keys(resumableMap)
          .map((nodeId) => nodes.find((n) => String(n.id) === String(nodeId)))
          .filter(Boolean)
          .map((node) => {
            const progress = getResumableProgress(node.id);
            if (!progress) return null;
            return (
              <Mapbox.MarkerView
                key={`resumable-${node.id}`}
                id={`resumable-${node.id}`}
                coordinate={[Number(node.longitude), Number(node.latitude)]}
                anchor={{ x: 0.5, y: 1.1 }}
              >
                <View style={styles.resumeBadge}>
                  <Text style={styles.resumeBadgeText}>⟳ %{progress}</Text>
                </View>
              </Mapbox.MarkerView>
            );
          })}

        {detailNode ? (
          <Mapbox.MarkerView
            id={`detail-${detailNode.id}`}
            coordinate={[detailNode.longitude, detailNode.latitude]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.detailMarkerWrap}>
              <View style={styles.detailMarkerStem} />
              <View style={[styles.detailCard, { borderColor: `${detailScenario.accent}88` }]}>
                <View style={[styles.detailScenarioAccent, { backgroundColor: detailScenario.accent }]} />
                <View style={styles.detailHeaderRow}>
                  <View
                    style={[
                      styles.detailDot,
                      {
                        backgroundColor: detailScenario.accent,
                      },
                    ]}
                  />
                  <Text style={styles.detailType}>{detailScenario.label}</Text>
                  <TouchableOpacity
                    style={styles.detailClose}
                    onPress={() => {
                      setDetailNode(null);
                      setSelectedNodeId(null);
                    }}
                    activeOpacity={0.9}
                  >
                    <MaterialIcons name="close" size={15} color="#e2e8f0" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.detailTitle} numberOfLines={1}>
                  {detailNode.title}
                </Text>
                <View style={styles.detailInlineRow}>
                  <Text style={styles.detailScenarioEmoji}>{detailScenario.emoji}</Text>
                  <Text style={styles.detailInlineText} numberOfLines={1}>
                    {detailNode?.sourceKind === 'memory'
                      ? 'Kullanici paylasimi'
                      : detailNode?.sourceKind === 'venue'
                        ? 'Mekan etkinligi'
                        : 'Sehir etkinligi'}
                  </Text>
                </View>
                <Text style={styles.detailBody} numberOfLines={2}>
                  {detailNode.flavor}
                </Text>
                {detailNode?.sourceKind === 'memory' && detailNode?.contentKind === 'photo' && detailNode?.mediaUrl ? (
                  <Image
                    source={{ uri: detailNode.mediaUrl }}
                    style={styles.detailMediaPreview}
                    resizeMode="cover"
                  />
                ) : null}
                {detailNode?.sourceKind === 'memory' && detailNode?.contentKind === 'song' ? (
                  <View style={styles.detailInlineRow}>
                    <MaterialIcons name="music-note" size={14} color="#93c5fd" />
                    <Text style={styles.detailInlineText} numberOfLines={1}>
                      {firstNonEmpty(detailNode.songTitle, 'Toplulugun dinledigi sarki')}
                    </Text>
                    {detailNode?.songArtist ? (
                      <Text style={styles.detailInlineSubText} numberOfLines={1}>
                        {detailNode.songArtist}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {detailNode?.sourceKind === 'memory' && detailNode?.contentKind === 'quote' ? (
                  <Text style={styles.detailQuote} numberOfLines={3}>
                    {`"${firstNonEmpty(detailNode.quoteText, detailNode.flavor)}"`}
                  </Text>
                ) : null}
                {detailNode?.sourceKind !== 'memory' ? (
                  <View style={styles.detailEventMetaWrap}>
                    {detailNode?.eventState === 'live' ? (
                      <View style={[styles.detailBadge, styles.detailBadgeLive]}>
                        <Text style={styles.detailBadgeText}>CANLI</Text>
                      </View>
                    ) : null}
                    {detailNode?.eventState === 'upcoming' ? (
                      <View style={[styles.detailBadge, styles.detailBadgeUpcoming]}>
                        <Text style={styles.detailBadgeText}>
                          {`Yaklasiyor${detailNode?.startLabel ? ` · ${detailNode.startLabel}` : ''}`}
                        </Text>
                      </View>
                    ) : null}
                    {detailNode?.venueName ? (
                      <Text style={styles.detailEventMetaText} numberOfLines={1}>
                        {detailNode.venueName}
                      </Text>
                    ) : null}
                    {detailNode?.organizerName ? (
                      <Text style={styles.detailEventMetaText} numberOfLines={1}>
                        {`Duzenleyen: ${detailNode.organizerName}`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.detailDivider} />
                <View style={styles.detailStatsRow}>
                  <View style={styles.detailStatChip}>
                    <Text style={styles.detailStat}>{`Populerlik ${detailNode.popularity || 1}/3`}</Text>
                  </View>
                  <View style={styles.detailStatChip}>
                    <Text style={styles.detailStat}>{`Yogunluk ${detailNode.density || 1}/3`}</Text>
                  </View>
                  <View style={styles.detailStatChip}>
                    <Text style={styles.detailStat}>{`+${detailNode.xp || 0} XP`}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Mapbox.MarkerView>
        ) : null}
      </Mapbox.MapView>

      {ENABLE_NEON_MAP_TINT ? (
        // Futuristic map tint: neon gradient overlay (RN-side)
        <LinearGradient
          pointerEvents="none"
          colors={
            isNight
              ? ['rgba(244,114,182,0.22)', 'rgba(34,211,238,0.14)', 'rgba(167,139,250,0.10)']
              : ['rgba(34,211,238,0.10)', 'rgba(148,163,184,0.06)']
          }
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}

      {/* Subtle depth gradients: helps "inside the world" feeling without darkening map too much */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(15,23,42,0.16)', 'rgba(15,23,42,0.04)', 'rgba(15,23,42,0)']}
        locations={[0, 0.35, 1]}
        style={styles.worldDepthTopGradient}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.06)', 'rgba(2,6,23,0.16)']}
        locations={[0, 0.55, 1]}
        style={styles.worldDepthBottomGradient}
      />

      <View
        pointerEvents="none"
        style={[
          styles.daylightBoostOverlay,
          { opacity: daylightBoostOpacity },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.environmentHazeOverlay,
          {
            opacity: environmentHazeOpacity,
            backgroundColor: FORCE_MAPBOX_LIGHT_STYLE ? 'transparent' : '#f8fafc',
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.environmentVignetteOverlay,
          { opacity: environmentVignetteOpacity },
        ]}
      />

      {ENABLE_NEON_MAP_TINT ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.holoSweepOverlay,
            {
              opacity: 0.08 + environmentHazeOpacity * 0.18,
              transform: [
                {
                  translateY: holoSweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-140, screenH + 140],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.holoSweepLine} />
          <View style={styles.holoSweepLineMagenta} />
        </Animated.View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.cinematicFadeOverlay,
          {
            opacity: cinematicFade,
          },
        ]}
      />

      <View style={styles.zoomWrap}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel((z) => Math.min(20, z + 0.8))}>
          <MaterialIcons name="add" size={18} color="#111827" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel((z) => Math.max(11, z - 0.8))}>
          <MaterialIcons name="remove" size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.profilePill}>
        <Text style={styles.profileText}>
          {isNight ? 'Gece Profili' : isTwilight ? 'Aksam Profili' : 'Gunduz Profili'}
        </Text>
      </View>

      <View style={styles.playerHud}>
        <View style={styles.playerHudTop}>
          <Text style={styles.playerHudTitle}>{`Lvl ${playerLevel}`}</Text>
          <Text style={styles.playerHudMeta}>{`${totalXp} XP`}</Text>
          <Text style={styles.playerHudMeta}>{`${capturedNodeCount} kesif`}</Text>
        </View>
        <View style={styles.playerHudProgressTrack}>
          <View style={[styles.playerHudProgressFill, { width: `${Math.round(levelProgress * 100)}%` }]} />
        </View>
        <Text style={styles.playerHudNear} numberOfLines={1}>
          {nearNode
            ? `Yakinda: ${nearNode.title}${nearNode?.eventState === 'live' ? ' · CANLI' : nearNode?.eventState === 'upcoming' ? ' · Yaklasiyor' : ''}`
            : 'Yakinda etkin node yok'}
        </Text>
      </View>

      {SHOW_DEBUG_PILL && isDebug ? (
        <View style={[styles.debugPill, isDebug ? styles.debugPillDebug : null]}>
          <Text style={styles.debugText}>
            {`city: ${user?.city || 'n/a'}\ncenter: ${cameraCenterCoord[1].toFixed(4)}, ${cameraCenterCoord[0].toFixed(4)}\nnodes: ${debugLastLoadedCount}`}
          </Text>
        </View>
      ) : null}

      {enteringNode ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.enterOverlay,
            {
              opacity: enterOpacity,
              transform: [{ scale: enterScale }],
            },
          ]}
        >
          <View style={styles.enterTunnel} />
          <Text style={styles.enterTitle}>Ortam icine giriliyor</Text>
          <Text style={styles.enterSubtitle} numberOfLines={1}>
            {enteringNode.title}
          </Text>
          {loadingWorld ? (
            <View style={{ marginTop: 10 }}>
              <ActivityIndicator size="small" color="#e2e8f0" />
            </View>
          ) : null}
        </Animated.View>
      ) : null}
      {activeDwellNodeId ? (
        <View pointerEvents="none" style={styles.ceremonyDim} />
      ) : null}
      {activeDwellNodeId ? (
        <View style={styles.ceremonyWrap} pointerEvents="none">
          <View style={styles.ceremonyRing}>
            <Svg width={140} height={140} style={styles.ceremonySvg}>
              <SvgCircle cx={70} cy={70} r={64} stroke="rgba(212,175,55,0.22)" strokeWidth={4} fill="none" />
              <AnimatedSvgCircle
                cx={70}
                cy={70}
                r={64}
                stroke="#D4AF37"
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={DWELL_RING_CIRC}
                strokeDashoffset={Animated.subtract(
                  DWELL_RING_CIRC,
                  Animated.multiply(dwellProgressAnim, DWELL_RING_CIRC / 100)
                )}
                transform="rotate(-90 70 70)"
              />
            </Svg>
            <View style={styles.ceremonyInner}>
              <Text style={styles.ceremonyNodeTitle} numberOfLines={1}>
                {nodes.find((n) => String(n.id) === String(activeDwellNodeId))?.title || 'Kesif'}
              </Text>
              <Text style={styles.ceremonyCounter}>{dwellLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <MainBottomNav navigation={navigation} activeTab="Local" forceDark />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  map: {
    // Mapbox native tarafı bazı layout durumlarında flex boyutunu gecikebiliyor.
    // Kesin full-screen vermek için absolute fill tercih ediyoruz.
    ...StyleSheet.absoluteFillObject,
  },
  zoomWrap: {
    position: 'absolute',
    right: 14,
    top: 110,
    gap: 8,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackCard: {
    margin: 16,
    marginTop: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#243047',
    backgroundColor: '#101a2e',
    padding: 14,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  fallbackBody: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  enterOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: '34%',
    borderRadius: 18,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.45)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  ceremonyDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ceremonyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ceremonyRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,22,40,0.9)',
  },
  ceremonySvg: { position: 'absolute' },
  ceremonyInner: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  ceremonyNodeTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  ceremonyCounter: {
    marginTop: 4,
    color: '#E8D5A0',
    fontSize: 12,
    fontWeight: '700',
  },
  resumeBadge: {
    backgroundColor: 'rgba(245,158,11,0.92)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(11,22,40,0.9)',
  },
  resumeBadgeText: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '800',
  },
  cinematicFadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
  },
  daylightBoostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8fafc',
  },
  environmentHazeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#94a3b8',
  },
  environmentVignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  worldDepthTopGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 210,
  },
  worldDepthBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
  },
  holoSweepOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 220,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  holoSweepLine: {
    position: 'absolute',
    top: 0,
    left: -40,
    right: -40,
    height: 24,
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    transform: [{ skewY: '-8deg' }],
  },
  holoSweepLineMagenta: {
    position: 'absolute',
    top: 60,
    left: -40,
    right: -40,
    height: 20,
    backgroundColor: 'rgba(244,114,182,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.28)',
    transform: [{ skewY: '-8deg' }],
  },
  enterTunnel: {
    width: 70,
    height: 70,
    borderRadius: 42,
    backgroundColor: 'rgba(125,211,252,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(125,211,252,0.55)',
    marginBottom: 8,
  },
  enterTitle: {
    color: '#e0f2fe',
    fontSize: 15,
    fontWeight: '800',
  },
  enterSubtitle: {
    marginTop: 6,
    color: '#bae6fd',
    fontSize: 12,
    maxWidth: '90%',
  },
  debugPill: {
    position: 'absolute',
    left: 14,
    bottom: 28,
    backgroundColor: 'rgba(2,6,23,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  debugPillDebug: {
    backgroundColor: 'rgba(2,6,23,0.9)',
  },
  debugText: {
    color: '#e0f2fe',
    fontSize: 11,
    fontWeight: '800',
  },
  detailMarkerWrap: {
    alignItems: 'center',
    width: 270,
  },
  detailMarkerStem: {
    width: 2,
    height: 30,
    backgroundColor: 'rgba(125,211,252,0.65)',
    marginBottom: -6,
  },
  detailCard: {
    width: 270,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: 'rgba(2,6,23,0.76)',
    padding: 13,
    transform: [{ perspective: 900 }, { rotateX: '8deg' }],
    shadowColor: '#0f172a',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  detailScenarioAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    marginRight: 6,
  },
  detailType: {
    fontSize: 11,
    color: '#bae6fd',
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  detailClose: {
    marginLeft: 'auto',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.75)',
  },
  detailTitle: {
    marginTop: 5,
    fontSize: 17,
    color: '#f8fafc',
    fontWeight: '800',
  },
  detailBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 17,
  },
  detailMediaPreview: {
    marginTop: 8,
    width: '100%',
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(30,41,59,0.45)',
  },
  detailInlineRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailInlineText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  detailScenarioEmoji: {
    fontSize: 14,
    marginRight: 2,
  },
  detailInlineSubText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 2,
    flexShrink: 1,
  },
  detailQuote: {
    marginTop: 8,
    color: '#e2e8f0',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  detailEventMetaWrap: {
    marginTop: 8,
    gap: 4,
  },
  detailBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  detailBadgeLive: {
    backgroundColor: 'rgba(244,63,94,0.2)',
    borderColor: 'rgba(244,63,94,0.52)',
  },
  detailBadgeUpcoming: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  detailBadgeText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailEventMetaText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  detailDivider: {
    marginTop: 9,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.26)',
  },
  detailStatsRow: {
    marginTop: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  detailStatChip: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.32)',
    backgroundColor: 'rgba(15,23,42,0.52)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  detailStat: {
    fontSize: 11,
    color: '#bae6fd',
    fontWeight: '800',
  },
  profilePill: {
    position: 'absolute',
    top: 66,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  playerHud: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 54,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.45)',
  },
  playerHudTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerHudTitle: {
    color: '#e0f2fe',
    fontSize: 12,
    fontWeight: '800',
  },
  playerHudMeta: {
    color: '#bae6fd',
    fontSize: 11,
    fontWeight: '700',
  },
  playerHudProgressTrack: {
    marginTop: 8,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(148,163,184,0.35)',
    overflow: 'hidden',
  },
  playerHudProgressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: '#22d3ee',
  },
  playerHudNear: {
    marginTop: 7,
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
});
