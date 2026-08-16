import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { navigateToLiveRitual } from '../utils/liveRitualNav';
import { liveWindowHoursOf } from '../constants/localConfig';

const ACTIVE_RITUAL_KEY = '@local_active_ritual';
const ACTIVE_RITUAL_UNREAD_KEY = '@local_active_ritual_unread';

function getBubbleState(ritual) {
  if (!ritual?.start_time) return null;
  const now = Date.now();
  const start = new Date(ritual.start_time).getTime();
  const durationMin = Number(ritual.duration || 90);
  const end = start + durationMin * 60000;
  const liveWindowHours = liveWindowHoursOf(ritual);
  const archiveEnd = end + liveWindowHours * 3600000;

  if (now >= start && now <= end) return 'active';
  if (now > end && now <= archiveEnd) return 'near';
  // Show upcoming only when it is reasonably close.
  if (now < start && start - now <= 2 * 3600000 && ritual?.status === 'approved') return 'upcoming';
  return 'ended';
}

export async function saveActiveRitualSnapshot(ritual) {
  if (!ritual?.id) return;
  const snapshot = {
    id: ritual.id,
    title: ritual.title || 'Ritual',
    start_time: ritual.start_time,
    duration: ritual.duration || 90,
    live_window_hours: liveWindowHoursOf(ritual),
    status: ritual.status || 'approved',
  };
  await AsyncStorage.setItem(ACTIVE_RITUAL_KEY, JSON.stringify(snapshot));
}

export async function incrementActiveRitualUnread(ritualId) {
  if (!ritualId) return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_RITUAL_UNREAD_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const key = String(ritualId);
    map[key] = Number(map[key] || 0) + 1;
    await AsyncStorage.setItem(ACTIVE_RITUAL_UNREAD_KEY, JSON.stringify(map));
  } catch (_) {}
}

export async function clearActiveRitualUnread(ritualId) {
  if (!ritualId) return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_RITUAL_UNREAD_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(ritualId)] = 0;
    await AsyncStorage.setItem(ACTIVE_RITUAL_UNREAD_KEY, JSON.stringify(map));
  } catch (_) {}
}

export default function ActiveRitualBubble({ navigation }) {
  const nav = navigation || useNavigation();
  const [ritual, setRitual] = useState(null);
  const [unread, setUnread] = useState(0);
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer = null;
    let mounted = true;

    const tick = async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_RITUAL_KEY);
        const unreadRaw = await AsyncStorage.getItem(ACTIVE_RITUAL_UNREAD_KEY);
        const unreadMap = unreadRaw ? JSON.parse(unreadRaw) : {};
        if (!mounted) return;
        const parsed = raw ? JSON.parse(raw) : null;
        setRitual(parsed);
        setUnread(parsed?.id ? Number(unreadMap[String(parsed.id)] || 0) : 0);
      } catch (_) {
        if (mounted) {
          setRitual(null);
          setUnread(0);
        }
      }
    };

    tick();
    timer = setInterval(tick, 15000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const bubbleState = useMemo(() => getBubbleState(ritual), [ritual]);

  const getRouteName = () => {
    const getLeaf = (state) => {
      if (!state || typeof state.index !== 'number' || !Array.isArray(state.routes)) return null;
      const r = state.routes[state.index];
      if (!r) return null;
      if (r.state) return getLeaf(r.state);
      return r.name || null;
    };
    try {
      return getLeaf(nav?.getState?.());
    } catch (_) {
      return null;
    }
  };

  useEffect(() => {
    setCurrentRouteName(getRouteName());
    const unsub = nav?.addListener?.('state', () => {
      setCurrentRouteName(getRouteName());
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [nav]);

  useEffect(() => {
    if (bubbleState !== 'active') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bubbleState, pulse]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  if (!ritual || !bubbleState) return null;
  if (currentRouteName === 'LiveRitual' || currentRouteName === 'LiveRitualDark') return null;

  const stateMap = {
    active: { label: 'AKTIF', color: '#1B2E4A', border: '#1B2E4A', hint: 'Ritual devam ediyor' },
    near: { label: 'YAKIN', color: '#1f2937', border: '#f59e0b', hint: 'Window hala acik' },
    upcoming: { label: 'YAKLASAN', color: '#111827', border: '#9ca3af', hint: 'Ritual yakinda basliyor' },
    ended: { label: 'SONA ERDI', color: '#6b7280', border: '#d1d5db', hint: 'Arsivi ac' },
  };

  const s = stateMap[bubbleState];

  return (
    <Animated.View style={bubbleState === 'active' ? { transform: [{ scale: glowScale }] } : null}>
    <TouchableOpacity
      style={[
        styles.wrap,
        { backgroundColor: s.color, borderColor: s.border },
        bubbleState === 'upcoming' && styles.wrapDashed,
        bubbleState === 'ended' && styles.wrapEnded,
      ]}
      activeOpacity={0.9}
      onPress={() => {
        if (!nav) return;
        clearActiveRitualUnread(ritual.id);
        setUnread(0);
        if (bubbleState === 'ended') {
          nav.navigate('RitualDetail', { ritualId: ritual.id });
          return;
        }
        navigateToLiveRitual(nav, { ritualId: ritual.id });
      }}
    >
      <View style={styles.dot} />
      <View style={styles.texts}>
        <Text style={styles.label}>{s.label}</Text>
        <Text style={styles.hint} numberOfLines={1}>{s.hint}</Text>
      </View>
      {unread > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 14,
    bottom: 92,
    zIndex: 60,
    minWidth: 108,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wrapDashed: {
    borderStyle: 'dashed',
  },
  wrapEnded: {
    opacity: 0.42,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f8fafc',
  },
  texts: {
    flex: 1,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  hint: {
    color: '#e5e7eb',
    fontSize: 10,
    marginTop: 1,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});
