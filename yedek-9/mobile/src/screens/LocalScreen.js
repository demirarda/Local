import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Circle, Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { browseRituals, fetchPulseMemories, fetchPulseRituals, fetchVenueActivity } from '../services/api';
import useAuthStore from '../store/authStore';
import MainBottomNav from '../components/MainBottomNav';

const START_REGION = {
  latitude: 41.015137,
  longitude: 28.97953,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

const FALLBACK_NODES = [];
const MILANO_SHOWCASE_NODES = [
  {
    id: 'mx-r-1',
    title: 'Navigli Gece Rituali',
    type: 'ritual',
    latitude: 45.4518,
    longitude: 9.1735,
    radius: 280,
    xp: 24,
    flavor: 'Canli muzik ve sohbet ile acik Ritual.',
  },
  {
    id: 'mx-m-1',
    title: 'Duomo Meydan Anisi',
    type: 'memory',
    latitude: 45.4642,
    longitude: 9.1916,
    radius: 240,
    xp: 18,
    flavor: 'Gunes batiminda birakilan topluluk anisi.',
  },
  {
    id: 'mx-q-1',
    title: 'Brera Alintisi',
    type: 'quote',
    latitude: 45.4719,
    longitude: 9.1881,
    radius: 220,
    xp: 14,
    flavor: '"Bu mahallede zaman yavasliyor."',
  },
  {
    id: 'mx-t-1',
    title: 'Porta Ticinese Iz',
    type: 'trace',
    latitude: 45.4513,
    longitude: 9.1809,
    radius: 250,
    xp: 16,
    flavor: 'Toplulugun biraktigi gece hareket izi.',
  },
];

const TYPE_META = {
  ritual: { color: '#D4AF37' },
  memory: { color: '#E8D5A0' },
  trace: { color: '#ef4444' },
  quote: { color: '#C9A961' },
  quest: { color: '#A855F7' },
  legend: { color: '#DC2626' },
};
const TYPE_LABEL = {
  memory: 'Ani',
  ritual: 'Ritual',
  trace: 'Topluluk',
  quote: 'Alinti',
  quest: 'Gorev',
  legend: 'Efsane',
};

const DWELL_UNLOCK_MS = 90 * 1000;
const progressLabel = (value) => `${Math.min(100, Math.round(value))}%`;
const BASE_ZOOM = 15.2;
const BASE_ALTITUDE = 1200;
const DWELL_STORE_KEY = '@local_dwell_progress_v1';
const DWELL_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;
const FILTERS = ['live', 'soon', 'memory', 'legend'];
const CIRC = 2 * Math.PI * 64;

const altitudeForZoom = (zoom) => {
  const factor = Math.pow(2, BASE_ZOOM - zoom);
  return Math.max(120, Math.min(12000, BASE_ALTITUDE * factor));
};

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeRitualNode = (ritual, idx) => {
  const lat = toNumber(ritual?.venue_latitude ?? ritual?.latitude, null);
  const lng = toNumber(ritual?.venue_longitude ?? ritual?.longitude, null);
  if (lat === null || lng === null) return null;

  const capacity = Math.max(2, toNumber(ritual?.capacity, 8));
  return {
    id: `r-${ritual.id || idx}`,
    ritualId: ritual.id,
    title: ritual?.title || 'Yeni Ritual',
    type: 'ritual',
    latitude: lat,
    longitude: lng,
    radius: capacity >= 8 ? 340 : 280,
    xp: capacity >= 8 ? 30 : 22,
    flavor: `${ritual?.venue_name || 'Yakin Mekan'} · ${capacity} kisi kapasite`,
    liveCount: toNumber(ritual?.current_attendees ?? ritual?.joined_count, 0),
    lastUnlockedAgo: toNumber(ritual?.last_unlocked_ago_min ?? ritual?.last_unlock_minutes_ago, undefined),
    weeklyUnlocks: toNumber(ritual?.weekly_unlocks ?? ritual?.unlocks_this_week, undefined),
    eventStartTime: ritual?.start_time,
    eventState:
      ritual?.is_live === true ||
      ritual?.live_now === true ||
      String(ritual?.time_state || '').toLowerCase() === 'live_now'
        ? 'live'
        : 'upcoming',
    mediaType: 'event',
  };
};

const normalizeMemoryNode = (memory, idx) => {
  const lat = toNumber(memory?.venue_latitude ?? memory?.latitude, null);
  const lng = toNumber(memory?.venue_longitude ?? memory?.longitude, null);
  if (lat === null || lng === null) return null;

  const rawContent = String(memory?.content || memory?.text || '').trim();
  const isQuote = rawContent.length >= 24;
  const mediaUrl = memory?.image_url || memory?.photo_url || memory?.media_url || memory?.thumbnail_url;
  const songTitle = memory?.song_title || memory?.track_name || memory?.audio_title;
  const mediaType = mediaUrl ? 'photo' : songTitle ? 'song' : isQuote ? 'quote' : 'text';
  return {
    id: `m-${memory.id || idx}`,
    memoryId: memory.id,
    title: memory?.title || (isQuote ? 'Topluluk Alintisi' : 'Topluluk Anisi'),
    type: isQuote ? 'quote' : 'memory',
    latitude: lat,
    longitude: lng,
    radius: isQuote ? 220 : 260,
    xp: isQuote ? 14 : 18,
    flavor: rawContent ? rawContent.slice(0, 68) : 'Topluluktan yeni bir ani birakildi.',
    liveCount: toNumber(memory?.live_count, undefined),
    lastUnlockedAgo: toNumber(memory?.last_unlocked_ago_min, undefined),
    weeklyUnlocks: toNumber(memory?.weekly_unlocks, undefined),
    mediaType,
    mediaUrl,
    songTitle: songTitle || undefined,
    quoteText: isQuote ? rawContent : undefined,
  };
};

const normalizeVenueActivityNode = (activity, idx) => {
  const lat = toNumber(activity?.venue_latitude ?? activity?.latitude, null);
  const lng = toNumber(activity?.venue_longitude ?? activity?.longitude, null);
  if (lat === null || lng === null) return null;

  return {
    id: `v-${activity?.venue_id || activity?.id || idx}`,
    title: activity?.venue_name || activity?.title || 'Canli Topluluk Alani',
    type: 'trace',
    latitude: lat,
    longitude: lng,
    radius: 260,
    xp: 16,
    flavor: activity?.city ? `${activity.city} · Topluluk hareketi` : 'Topluluk hareketi',
    liveCount: toNumber(activity?.active_count ?? activity?.attendee_count ?? activity?.current_attendees, 0),
    lastUnlockedAgo: toNumber(activity?.last_unlocked_ago_min, undefined),
    weeklyUnlocks: toNumber(activity?.weekly_unlocks, undefined),
    eventState: 'live',
    eventStartTime: activity?.start_time || activity?.starts_at,
    mediaType: 'event',
  };
};

const haversineMeters = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
};
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

export default function LocalScreen({ navigation, route }) {
  const searchFromRoute = String(route?.params?.searchQuery || '').trim();
  const [mapSearchHint, setMapSearchHint] = useState(searchFromRoute);
  const user = useAuthStore((s) => s.user);
  const isDark = true;
  const insets = useSafeAreaInsets();

  const [nodes, setNodes] = useState(FALLBACK_NODES);
  const [unlockedIds, setUnlockedIds] = useState([]);
  const [unlockedThisWeek, setUnlockedThisWeek] = useState(0);
  const [loadingWorld, setLoadingWorld] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [userLocation, setUserLocation] = useState({
    latitude: START_REGION.latitude,
    longitude: START_REGION.longitude,
  });
  const [initialRegion, setInitialRegion] = useState(START_REGION);
  const [activeCity, setActiveCity] = useState(user?.city || 'Milano');
  const [forceCityLocation, setForceCityLocation] = useState(false);
  const [activeDwellNodeId, setActiveDwellNodeId] = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [dwellElapsedMs, setDwellElapsedMs] = useState(0);
  const [dwellLabel, setDwellLabel] = useState('00:00 / 01:30');
  const [zoomLevel, setZoomLevel] = useState(15.2);
  const [previewAll, setPreviewAll] = useState(false);
  const [enteringNode, setEnteringNode] = useState(null);
  const [unlockModalNode, setUnlockModalNode] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [nearbyTier, setNearbyTier] = useState('far');
  const [nearbyLockedCount, setNearbyLockedCount] = useState(0);
  const [nearestLockedNode, setNearestLockedNode] = useState(null);
  const [resumableMap, setResumableMap] = useState({});
  const dwellStartedAtRef = useRef({});
  const dwellPersistRef = useRef({});
  const dwellMilestoneRef = useRef({});
  const lastPersistedProgressRef = useRef({});
  const nearHapticRef = useRef({});
  const locationSubRef = useRef(null);
  const mapRef = useRef(null);
  const enterOverlayOpacity = useRef(new Animated.Value(0)).current;
  const enterOverlayScale = useRef(new Animated.Value(0.96)).current;
  const ritualPulse = useRef(new Animated.Value(0.6)).current;
  const memoryPulse = useRef(new Animated.Value(0.9)).current;
  const traceWave = useRef(new Animated.Value(0)).current;
  const legendGlow = useRef(new Animated.Value(0.2)).current;
  const dwellProgressAnim = useRef(new Animated.Value(0)).current;

  const unlockedNodes = useMemo(
    () => nodes.filter((node) => unlockedIds.includes(node.id)),
    [nodes, unlockedIds]
  );
  const lockedNodes = useMemo(
    () => nodes.filter((node) => !unlockedIds.includes(node.id)),
    [nodes, unlockedIds]
  );

  const worldProgress = (unlockedNodes.length / Math.max(1, nodes.length)) * 100;
  const city = activeCity || user?.city || 'Milano';
  const viewerId = user?.id;
  const ceremonyActive = Boolean(activeDwellNodeId);
  const getResumableProgress = useCallback((nodeId) => {
    const row = dwellPersistRef.current[nodeId];
    if (!row || row.expiresAt < Date.now()) return null;
    if (row.lastProgress < 5 || row.lastProgress >= 100) return null;
    return Math.round(row.lastProgress);
  }, []);

  useEffect(() => {
    const q = String(route?.params?.searchQuery || '').trim();
    if (q) setMapSearchHint(q);
  }, [route?.params?.searchQuery]);

  useEffect(() => {
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(ritualPulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ritualPulse, { toValue: 0.6, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(memoryPulse, { toValue: 1.1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(memoryPulse, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(traceWave, { toValue: 1, duration: 1700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(traceWave, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(legendGlow, { toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(legendGlow, { toValue: 0.2, duration: 3400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((it) => it.start());
    return () => loops.forEach((it) => it.stop());
  }, [legendGlow, memoryPulse, ritualPulse, traceWave]);

  useEffect(() => {
    Animated.timing(dwellProgressAnim, {
      toValue: dwellProgress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dwellProgress, dwellProgressAnim]);

  const unlockNode = useCallback((node) => {
    setUnlockedIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
    setUnlockedThisWeek((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const accountCity = user?.city;
    if (!accountCity) return undefined;

    setActiveCity(accountCity);
    setForceCityLocation(true);
    const centerByAccountCity = async () => {
      try {
        const geocoded = await Location.geocodeAsync(accountCity);
        const first = geocoded?.[0];
        if (!first || cancelled) return;
        setInitialRegion({
          latitude: first.latitude,
          longitude: first.longitude,
          latitudeDelta: START_REGION.latitudeDelta,
          longitudeDelta: START_REGION.longitudeDelta,
        });
        setUserLocation({
          latitude: first.latitude,
          longitude: first.longitude,
        });
      } catch (_e) {
        // Keep previous region if account city geocode fails.
      }
    };
    centerByAccountCity();
    return () => {
      cancelled = true;
    };
  }, [user?.city]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: {
          latitude: initialRegion.latitude,
          longitude: initialRegion.longitude,
        },
        pitch: 58,
        heading: 12,
        zoom: zoomLevel,
        altitude: altitudeForZoom(zoomLevel),
      },
      { duration: 300 }
    );
  }, [initialRegion.latitude, initialRegion.longitude, zoomLevel]);

  useEffect(() => {
    let mounted = true;
    const loadWorldNodes = async () => {
      setLoadingWorld(true);
      const [ritualBuckets, memories, venueActivities, browseResult] = await Promise.all([
        fetchPulseRituals({ city, viewerId }),
        fetchPulseMemories(city, 12, viewerId),
        fetchVenueActivity({ city, viewerId, limit: 14 }),
        browseRituals({ city, viewer_id: viewerId, limit: 20 }),
      ]);
      if (!mounted) return;

      const allRituals = [
        ...(ritualBuckets?.live_now || []),
        ...(ritualBuckets?.starting_soon || []),
        ...(ritualBuckets?.almost_full || []),
      ];
      const ritualNodes = allRituals
        .slice(0, 18)
        .map((item, idx) => normalizeRitualNode(item, idx))
        .filter(Boolean);
      const memoryNodes = (memories || [])
        .slice(0, 18)
        .map((item, idx) => normalizeMemoryNode(item, idx))
        .filter(Boolean);
      const venueNodes = (venueActivities || [])
        .slice(0, 14)
        .map((item, idx) => normalizeVenueActivityNode(item, idx))
        .filter(Boolean);
      const browseNodes = (browseResult?.data || [])
        .slice(0, 20)
        .map((item, idx) => normalizeRitualNode(item, idx + 80))
        .filter(Boolean);
      const merged = [...ritualNodes, ...memoryNodes, ...venueNodes, ...browseNodes];

      if (merged.length) {
        const deduped = [];
        const seen = new Set();
        for (const node of merged) {
          if (seen.has(node.id)) continue;
          seen.add(node.id);
          deduped.push(node);
          if (deduped.length >= 20) break;
        }
        setNodes(deduped);
        setUnlockedIds(deduped.slice(0, Math.min(3, deduped.length)).map((node) => node.id));
        setUnlockedThisWeek(Math.min(3, deduped.length));
      } else {
        const milanoMode = String(city || '').toLowerCase().includes('milano');
        const fallback = milanoMode ? MILANO_SHOWCASE_NODES : FALLBACK_NODES;
        setNodes(fallback);
        setUnlockedIds(fallback.slice(0, Math.min(3, fallback.length)).map((n) => n.id));
        setUnlockedThisWeek(Math.min(2, fallback.length));
      }
      setLoadingWorld(false);
    };

    loadWorldNodes();
    return () => {
      mounted = false;
    };
  }, [city, viewerId]);

  useEffect(() => {
    let mounted = true;
    const startLocationWatch = async () => {
      const status = await Location.requestForegroundPermissionsAsync();
      if (!mounted) return;
      if (status.status !== 'granted') {
        setPermissionStatus('denied');
        return;
      }
      setPermissionStatus('granted');

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (mounted) {
        const next = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        if (!forceCityLocation) {
          setUserLocation(next);
        }
        // Keep map start city anchored to account city.
        // Device location is used for "Sen" marker and proximity unlock only.
        if (!user?.city) {
          setInitialRegion({
            latitude: next.latitude,
            longitude: next.longitude,
            latitudeDelta: START_REGION.latitudeDelta,
            longitudeDelta: START_REGION.longitudeDelta,
          });
          const reverse = await Location.reverseGeocodeAsync(next);
          const place = reverse?.[0];
          const detectedCity =
            place?.city ||
            place?.subregion ||
            place?.district ||
            place?.region;
          if (detectedCity) setActiveCity(detectedCity);
        }
      }

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 10000,
        },
        (location) => {
          setUserLocation({
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
  }, [forceCityLocation, user?.city]);

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
    const runTick = async () => {
      const now = Date.now();
      let nearest = null;
      let nearestDistance = Infinity;
      let nearCount = 0;

      lockedNodes.forEach((node) => {
        const distance = haversineMeters(userLocation, {
          latitude: node.latitude,
          longitude: node.longitude,
        });
        if (distance < 500) nearCount += 1;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = node;
        }
      });

      setNearbyLockedCount(nearCount);
      setNearestLockedNode(nearest);
      if (nearestDistance < 80) setNearbyTier('close');
      else if (nearestDistance < 500) setNearbyTier('near');
      else setNearbyTier('far');

      if (nearest && nearestDistance < 200 && !nearHapticRef.current[nearest.id]) {
        nearHapticRef.current = { [nearest.id]: true };
        Haptics.selectionAsync();
      }

      const insideNode = lockedNodes.find((node) => {
        const distance = haversineMeters(userLocation, {
          latitude: node.latitude,
          longitude: node.longitude,
        });
        return distance <= node.radius * 0.6;
      });

      if (!insideNode) {
        setActiveDwellNodeId(null);
        setDwellProgress(0);
        setDwellElapsedMs(0);
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
      setDwellElapsedMs(spent);
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
        unlockNode(insideNode);
        delete dwellStartedAtRef.current[insideNode.id];
        delete dwellPersistRef.current[insideNode.id];
        delete lastPersistedProgressRef.current[insideNode.id];
        setResumableMap({ ...dwellPersistRef.current });
        await AsyncStorage.setItem(DWELL_STORE_KEY, JSON.stringify(dwellPersistRef.current));
        setActiveDwellNodeId(null);
        setDwellProgress(0);
        setDwellElapsedMs(0);
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

    runTick();
    const timer = setInterval(runTick, 1000);
    return () => clearInterval(timer);
  }, [lockedNodes, unlockNode, userLocation]);

  const applyZoom = useCallback(
    (nextZoom) => {
      const clamped = Math.max(12.5, Math.min(19.2, nextZoom));
      setZoomLevel(clamped);
      if (!mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          },
          pitch: 58,
          heading: 12,
          zoom: clamped,
          altitude: altitudeForZoom(clamped),
        },
        { duration: 280 }
      );
    },
    [userLocation.latitude, userLocation.longitude]
  );

  const handleUnlockCta = useCallback(() => {
    const node = unlockModalNode;
    if (!node) return;
    setUnlockModalNode(null);
    if (node.type === 'ritual' || node.type === 'trace') {
      const ritualId = node.ritualId || (String(node.id || '').startsWith('r-') ? String(node.id).slice(2) : null);
      if (ritualId) {
        navigation.navigate('RitualDetail', { ritualId });
        return;
      }
      navigation.navigate('CityRhythm');
      return;
    }
    if (node.type === 'memory' || node.type === 'quote') {
      const memoryId = node.memoryId || (String(node.id || '').startsWith('m-') ? String(node.id).slice(2) : null);
      if (memoryId) {
        navigation.navigate('MemoryDetail', { memoryId });
        return;
      }
    }
    navigation.navigate('CityRhythm');
  }, [navigation, unlockModalNode]);

  const baseNodes = previewAll ? nodes : unlockedNodes;
  const searchFilteredNodes = useMemo(() => {
    const q = mapSearchHint.trim().toLowerCase();
    if (!q) return baseNodes;
    return baseNodes.filter((node) => {
      const hay = `${node.title || ''} ${node.flavor || ''} ${node.type || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [baseNodes, mapSearchHint]);
  const displayedNodes = searchFilteredNodes.filter((node) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'live') return node.eventState === 'live' || node.type === 'trace';
    if (activeFilter === 'soon') {
      if (!node.eventStartTime) return false;
      const diffMin = Math.floor((new Date(node.eventStartTime).getTime() - Date.now()) / 60000);
      return diffMin >= 0 && diffMin <= 30;
    }
    if (activeFilter === 'memory') return node.type === 'memory' || node.type === 'quote';
    if (activeFilter === 'legend') return node.type === 'legend';
    return true;
  });
  const focusNode = useCallback(
    (node) => {
      if (!node || !mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: { latitude: node.latitude, longitude: node.longitude },
          pitch: 64,
          heading: 16,
          zoom: Math.max(zoomLevel, 17.8),
          altitude: altitudeForZoom(Math.max(zoomLevel, 17.8)),
        },
        { duration: 700 }
      );
    },
    [zoomLevel]
  );

  const enterNodeExperience = useCallback(
    (node) => {
      if (!node) return;
      setEnteringNode(node);
      focusNode(node);
      enterOverlayOpacity.setValue(0);
      enterOverlayScale.setValue(0.96);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(enterOverlayOpacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(enterOverlayScale, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(800),
        Animated.timing(enterOverlayOpacity, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setEnteringNode(null);
        setUnlockModalNode(node);
      });
    },
    [enterOverlayOpacity, enterOverlayScale, focusNode]
  );

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        initialCamera={{
          center: {
            latitude: initialRegion.latitude,
            longitude: initialRegion.longitude,
          },
          pitch: 58,
          heading: 12,
          altitude: altitudeForZoom(zoomLevel),
          zoom: zoomLevel,
        }}
        customMapStyle={DARK_MAP_STYLE}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        scrollEnabled={!ceremonyActive}
        zoomEnabled={!ceremonyActive}
        pitchEnabled={!ceremonyActive}
        rotateEnabled={!ceremonyActive}
        showsBuildings
        mapType="mutedStandard"
        onMapReady={() => {
          if (!mapRef.current) return;
          mapRef.current.animateCamera(
            {
              center: {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              },
              pitch: 58,
              heading: 12,
              zoom: zoomLevel,
              altitude: altitudeForZoom(zoomLevel),
            },
            { duration: 1 }
          );
        }}
      >
        <Marker coordinate={userLocation} title="Sen" pinColor="#D4AF37" opacity={activeDwellNodeId ? 0.3 : 1} />
        {lockedNodes.map((node) => (
          <Circle
            key={`locked-${node.id}`}
            center={{ latitude: node.latitude, longitude: node.longitude }}
            radius={node.radius}
            fillColor={`${(TYPE_META[node.type]?.color || '#D4AF37')}22`}
            strokeColor={`${(TYPE_META[node.type]?.color || '#D4AF37')}66`}
            strokeWidth={1.1}
          />
        ))}
        {displayedNodes.map((node) => (
          <Circle
            key={`unlocked-${node.id}`}
            center={{ latitude: node.latitude, longitude: node.longitude }}
            radius={node.radius}
            fillColor={`${(TYPE_META[node.type]?.color || '#D4AF37')}2a`}
            strokeColor={`${(TYPE_META[node.type]?.color || '#D4AF37')}cc`}
            strokeWidth={1.6}
          />
        ))}
        {displayedNodes.map((node) => (
          <Marker
            key={node.id}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            title={node.title}
            description={[
              node.flavor,
              node.liveCount > 0 ? `🔴 ${node.liveCount} kisi simdi burada` : null,
              node.lastUnlockedAgo ? `Son muhur: ${node.lastUnlockedAgo} dk once` : null,
              node.weeklyUnlocks ? `Bu hafta ${node.weeklyUnlocks} kesif` : null,
            ]
              .filter(Boolean)
              .join('\n')}
            onPress={() => enterNodeExperience(node)}
            opacity={activeDwellNodeId && activeDwellNodeId !== node.id ? 0.3 : 1}
          >
            <View style={styles.poiWrap}>
              {getResumableProgress(node.id) ? <View style={styles.poiResumeRing} /> : null}
              {node.type === 'trace' ? (
                <Animated.View
                  style={[
                    styles.poiWave,
                    {
                      borderColor: TYPE_META[node.type]?.color || '#ef4444',
                      opacity: traceWave.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                      transform: [{ scale: traceWave.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
                    },
                  ]}
                />
              ) : null}
              <Animated.View
                style={[
                  styles.poiAura,
                  {
                    borderColor:
                      node.eventState === 'live'
                        ? '#ef4444'
                        : (TYPE_META[node.type]?.color || '#D4AF37'),
                    opacity:
                      node.type === 'ritual'
                        ? ritualPulse
                        : node.type === 'legend'
                          ? legendGlow
                          : 0.75,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.poiCore,
                  {
                    backgroundColor:
                      node.eventState === 'live'
                        ? '#ef4444'
                        : (TYPE_META[node.type]?.color || '#D4AF37'),
                    transform: [{ scale: node.type === 'memory' ? memoryPulse : 1 }],
                  },
                ]}
              >
                <MaterialIcons name="auto-awesome" size={13} color="#fff" />
              </Animated.View>
              {getResumableProgress(node.id) ? (
                <View style={styles.resumeBadge}>
                  <Text style={styles.resumeBadgeText}>⟳ %{getResumableProgress(node.id)}</Text>
                </View>
              ) : null}
              {nearbyTier === 'close' && nearestLockedNode?.id === node.id ? (
                <View style={styles.floatingTag}>
                  <Text style={styles.floatingTitle} numberOfLines={1}>{node.title}</Text>
                  <Text style={styles.floatingType}>{TYPE_LABEL[node.type] || 'Node'}</Text>
                </View>
              ) : null}
            </View>
          </Marker>
        ))}
        {lockedNodes
          .filter(
            (node) =>
              getResumableProgress(node.id) &&
              !displayedNodes.some((d) => d.id === node.id)
          )
          .map((node) => (
            <Marker
              key={`resumable-${node.id}`}
              coordinate={{ latitude: node.latitude, longitude: node.longitude }}
              title={node.title}
              description={[
                node.flavor,
                node.liveCount > 0 ? `🔴 ${node.liveCount} kisi simdi burada` : null,
                node.lastUnlockedAgo ? `Son muhur: ${node.lastUnlockedAgo} dk once` : null,
                node.weeklyUnlocks ? `Bu hafta ${node.weeklyUnlocks} kesif` : null,
              ]
                .filter(Boolean)
                .join('\n')}
              onPress={() => enterNodeExperience(node)}
              opacity={activeDwellNodeId && activeDwellNodeId !== node.id ? 0.3 : 1}
            >
              <View style={styles.poiWrap}>
                <View style={styles.poiResumeRing} />
                <View style={[styles.poiAura, { borderColor: '#F59E0B', opacity: 0.85 }]} />
                <View style={[styles.poiCore, { backgroundColor: '#D4AF37' }]}>
                  <MaterialIcons name="history" size={12} color="#111827" />
                </View>
                <View style={styles.resumeBadge}>
                  <Text style={styles.resumeBadgeText}>⟳ %{getResumableProgress(node.id)}</Text>
                </View>
              </View>
            </Marker>
          ))}
      </MapView>
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(11,22,40,0.38)',
        }}
      />

      <View
        style={[styles.overlayTop, { top: insets.top + 8 }, ceremonyActive && styles.overlayLocked]}
        pointerEvents={ceremonyActive ? 'none' : 'auto'}
      >
        <View style={styles.metricRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricText}>🕯 Bu hafta {unlockedThisWeek} iz</Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricText}>⟁ Yakininda {nearbyLockedCount} muhur</Text>
          </View>
        </View>
        {nearbyTier !== 'far' ? (
          <View style={[styles.approachPill, nearbyTier === 'close' && styles.approachPillClose]}>
            <Text style={styles.approachText}>
              {nearbyTier === 'near' ? `🕯 Yakinda ${nearbyLockedCount} iz` : `🕯 ${nearestLockedNode?.title || 'Muhur'} cok yakinda`}
            </Text>
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setPreviewAll((prev) => !prev)}
            style={[styles.filterPill, previewAll && styles.filterPillActive]}
            activeOpacity={0.9}
          >
            <Text style={[styles.filterText, previewAll && styles.filterTextActive]}>
              {previewAll ? '👁 Kilitli Ac' : '👁 Kilitli Gizli'}
            </Text>
          </TouchableOpacity>
          {FILTERS.map((filterKey) => (
            <TouchableOpacity
              key={filterKey}
              onPress={() => setActiveFilter((prev) => (prev === filterKey ? 'all' : filterKey))}
              style={[styles.filterPill, activeFilter === filterKey && styles.filterPillActive]}
              activeOpacity={0.9}
            >
              <Text style={[styles.filterText, activeFilter === filterKey && styles.filterTextActive]}>
                {filterKey === 'live'
                  ? '🔴 Simdi Canli'
                  : filterKey === 'soon'
                    ? '⏱ 30dk Icinde'
                    : filterKey === 'memory'
                      ? '✦ Anilar'
                      : '⚑ Efsaneler'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View
        style={[styles.zoomWrap, { top: insets.top + 160 }, ceremonyActive && styles.overlayLocked]}
        pointerEvents={ceremonyActive ? 'none' : 'auto'}
      >
        <TouchableOpacity
          onPress={() => applyZoom(zoomLevel + 0.6)}
          style={[styles.zoomButton, isDark && styles.zoomButtonDark]}
          activeOpacity={0.9}
        >
          <MaterialIcons name="add" size={18} color={isDark ? '#e5e7eb' : '#111827'} />
        </TouchableOpacity>
        <View style={[styles.zoomTrack, isDark && styles.zoomTrackDark]}>
          <View
            style={[
              styles.zoomFill,
              { height: `${((zoomLevel - 12.5) / (19.2 - 12.5)) * 100}%` },
            ]}
          />
        </View>
        <TouchableOpacity
          onPress={() => applyZoom(zoomLevel - 0.6)}
          style={[styles.zoomButton, isDark && styles.zoomButtonDark]}
          activeOpacity={0.9}
        >
          <MaterialIcons name="remove" size={18} color={isDark ? '#e5e7eb' : '#111827'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.overlayBottom, { bottom: insets.bottom + 88 }]}>
        {ceremonyActive ? (
          <View style={styles.loadingPill}>
            <MaterialIcons name="timelapse" size={14} color="#D4AF37" />
            <Text style={[styles.loadingText, styles.loadingTextDark]}>{`Kesif ${progressLabel(dwellProgress)}`}</Text>
          </View>
        ) : loadingWorld ? (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={isDark ? '#e5e7eb' : '#111827'} />
            <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
              Harita dunyasi yukleniyor...
            </Text>
          </View>
        ) : (
          <View style={styles.loadingPill}>
            <MaterialIcons
              name={permissionStatus === 'granted' ? 'my-location' : 'location-disabled'}
              size={14}
              color={permissionStatus === 'granted' ? '#22c55e' : '#ef4444'}
            />
            <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
              {activeDwellNodeId ? `Kesif ${progressLabel(dwellProgress)}` : 'Muhur alanina girip ac'}
            </Text>
          </View>
        )}

        {!ceremonyActive ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('CityRhythm')}
            style={[styles.fab, isDark && styles.fabDark]}
            activeOpacity={0.9}
          >
            <MaterialIcons name="calendar-today" size={18} color={isDark ? '#e5e7eb' : '#111827'} />
          </TouchableOpacity>
        ) : null}
      </View>
      {activeDwellNodeId ? <View pointerEvents="none" style={styles.ceremonyDim} /> : null}
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
                strokeDasharray={CIRC}
                strokeDashoffset={Animated.subtract(CIRC, Animated.multiply(dwellProgressAnim, CIRC / 100))}
                transform="rotate(-90 70 70)"
              />
            </Svg>
            <View style={styles.ceremonyInner}>
              <Text style={styles.ceremonyNodeTitle} numberOfLines={1}>
                {lockedNodes.find((n) => n.id === activeDwellNodeId)?.title || 'Kesif'}
              </Text>
              <Text style={styles.ceremonyCounter}>{dwellLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}
      {enteringNode ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.enterOverlay,
            {
              opacity: enterOverlayOpacity,
              transform: [{ scale: enterOverlayScale }],
            },
          ]}
        >
          <View style={styles.enterTunnel} />
          <Text style={styles.enterTitle}>Ortam Aciliyor</Text>
          <Text style={styles.enterSubtitle} numberOfLines={1}>
            {enteringNode.title}
          </Text>
        </Animated.View>
      ) : null}
      <Modal visible={Boolean(unlockModalNode)} transparent animationType="slide" onRequestClose={() => setUnlockModalNode(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalDismissZone} activeOpacity={1} onPress={() => setUnlockModalNode(null)} />
          <View style={styles.unlockSheet}>
            <View style={styles.sheetGrabber} />
            <View style={styles.unlockHeader}>
              <Text style={styles.unlockTitle}>{unlockModalNode?.title}</Text>
              <TouchableOpacity onPress={() => setUnlockModalNode(null)} style={styles.sheetClose}>
                <MaterialIcons name="close" size={20} color="#f8fafc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.unlockType}>{TYPE_LABEL[unlockModalNode?.type] || 'Node'}</Text>
            <Text style={styles.unlockFlavor}>{unlockModalNode?.flavor}</Text>
            {unlockModalNode?.mediaUrl ? <Image source={{ uri: unlockModalNode.mediaUrl }} style={styles.unlockMedia} /> : null}
            {unlockModalNode?.quoteText ? <Text style={styles.unlockQuote}>"{unlockModalNode.quoteText}"</Text> : null}
            {unlockModalNode?.songTitle ? <Text style={styles.unlockSong}>♪ {unlockModalNode.songTitle}</Text> : null}
            <TouchableOpacity style={styles.unlockCta} activeOpacity={0.9} onPress={handleUnlockCta}>
              <Text style={styles.unlockCtaText}>
                {unlockModalNode?.type === 'ritual' || unlockModalNode?.type === 'trace'
                  ? 'Rituale Katil'
                  : unlockModalNode?.type === 'memory' || unlockModalNode?.type === 'quote'
                    ? 'Aniyi Gor'
                    : 'Rotayi Goster'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <MainBottomNav navigation={navigation} activeTab="Local" forceDark />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0B1628',
  },
  safeDark: {
    backgroundColor: '#0B1628',
  },
  map: {
    flex: 1,
  },
  overlayTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'flex-start',
    gap: 8,
  },
  metricRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    backgroundColor: 'rgba(11,22,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.42)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricText: {
    color: '#E8D5A0',
    fontSize: 12,
    fontWeight: '700',
  },
  approachPill: {
    backgroundColor: 'rgba(11,22,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.38)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  approachPillClose: {
    borderColor: 'rgba(239,68,68,0.7)',
  },
  approachText: {
    color: '#fef3c7',
    fontWeight: '700',
    fontSize: 12,
  },
  filterRow: {
    gap: 8,
    paddingRight: 12,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(11,22,40,0.62)',
  },
  filterPillActive: {
    backgroundColor: '#D4AF37',
  },
  filterText: {
    color: '#E8D5A0',
    fontWeight: '700',
    fontSize: 11,
  },
  filterTextActive: {
    color: '#111827',
  },
  overlayBottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoomWrap: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 8,
  },
  overlayLocked: {
    opacity: 0.35,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonDark: {
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderColor: '#27272a',
  },
  zoomTrack: {
    width: 8,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  zoomTrackDark: {
    backgroundColor: 'rgba(24,24,27,0.8)',
    borderColor: '#3f3f46',
  },
  zoomFill: {
    width: '100%',
    backgroundColor: '#D4AF37',
    borderRadius: 999,
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11,22,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  loadingText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  loadingTextDark: {
    color: '#e5e7eb',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabDark: {
    backgroundColor: 'rgba(24,24,27,0.92)',
    borderColor: '#27272a',
  },
  poiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  poiAura: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 16,
    borderWidth: 2,
    opacity: 0.62,
  },
  poiWave: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 20,
    borderWidth: 1.4,
  },
  poiCore: {
    width: 20,
    height: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  poiResumeRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  resumeBadge: {
    position: 'absolute',
    right: -18,
    top: -16,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resumeBadgeText: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '800',
  },
  floatingTag: {
    position: 'absolute',
    top: -36,
    minWidth: 118,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.64)',
    backgroundColor: 'rgba(11,22,40,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
  },
  floatingTitle: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
  },
  floatingType: {
    marginTop: 1,
    color: '#E8D5A0',
    fontSize: 9,
    fontWeight: '700',
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
  ceremonySvg: {
    position: 'absolute',
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    justifyContent: 'flex-end',
  },
  modalDismissZone: {
    flex: 1,
  },
  unlockSheet: {
    height: '75%',
    backgroundColor: '#0B1628',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.32)',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetGrabber: {
    width: 52,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: 'rgba(212,175,55,0.4)',
    marginBottom: 12,
  },
  unlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unlockTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  unlockType: {
    marginTop: 8,
    color: '#E8D5A0',
    fontSize: 13,
    fontWeight: '700',
  },
  unlockFlavor: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  unlockMedia: {
    marginTop: 14,
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  unlockQuote: {
    marginTop: 14,
    color: '#fef3c7',
    fontSize: 16,
    fontWeight: '700',
  },
  unlockSong: {
    marginTop: 12,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  unlockCta: {
    marginTop: 18,
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  unlockCtaText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  enterOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '34%',
    borderRadius: 18,
    backgroundColor: 'rgba(11,22,40,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.55)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  enterTunnel: {
    width: 62,
    height: 62,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginBottom: 8,
    backgroundColor: 'rgba(212,175,55,0.14)',
  },
  enterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E8D5A0',
  },
  enterSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#fef3c7',
  },
});

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0B1628' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b7c4d8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B1628' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1B2E4A' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#d4af37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#102844' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a2b45' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#12233c' }] },
];
