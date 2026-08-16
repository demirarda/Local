import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Animated, Easing } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Defs, LinearGradient as SvgLinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { PULSE, FONT_SERIF } from '../constants/pulseTheme';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RADIUS_OPTIONS = [
  { value: 250, label: '250m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const bearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return 'yakin';
  if (meters < 1000) return `${Math.round(meters)}m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters / 1000)}km`;
};

const formatWalkTime = (meters) => {
  if (!Number.isFinite(meters)) return 'yakin';
  const mins = meters / (5000 / 60);
  if (mins < 1) return '1 dk';
  if (mins < 60) return `${Math.round(mins)} dk`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h} sa ${m} dk` : `${h} sa`;
};

const formatRingLabel = (meters) => {
  if (!Number.isFinite(meters)) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
};

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function PulseNearbyYakinContent({
  rituals = [],
  pulseMemories = [],
  city = 'Milano',
  location,
  refreshing = false,
  onRefresh,
  navigation,
}) {
  const [radius, setRadius] = useState(1000);
  const [activeDotId, setActiveDotId] = useState(null);
  const [liveClock, setLiveClock] = useState('00:00:00');
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const userPulse1 = useRef(new Animated.Value(0)).current;
  const userPulse2 = useRef(new Animated.Value(0)).current;
  const center = {
    lat: Number(location?.latitude) || 45.4719,
    lng: Number(location?.longitude) || 9.1882,
  };

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setLiveClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAnim]);

  useEffect(() => {
    const mk = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      );
    const l1 = mk(userPulse1, 0);
    const l2 = mk(userPulse2, 1250);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [userPulse1, userPulse2]);

  const nearby = useMemo(() => {
    const ritualById = new Map(rituals.map((r) => [String(r.id ?? r.ritual_id ?? ''), r]));
    const fallbackCoordByIndex = (i) => {
      const angle = (i % 24) * ((Math.PI * 2) / 24);
      const ring = 0.0022 + (i % 5) * 0.00065;
      return { lat: center.lat + Math.sin(angle) * ring, lng: center.lng + Math.cos(angle) * ring };
    };
    const ritualItems = rituals.map((r, i) => {
      const lat = Number(r.location_lat ?? r.lat);
      const lng = Number(r.location_lng ?? r.lng);
      const fb = fallbackCoordByIndex(i);
      const finalLat = Number.isFinite(lat) ? lat : fb.lat;
      const finalLng = Number.isFinite(lng) ? lng : fb.lng;
      const isLive = String(r.time_state || r.status || '').toLowerCase() === 'live_now';
      return {
        ...r,
        _sourceType: 'ritual',
        _dotType: isLive ? 'live' : 'venue',
        distance: haversineDistance(center.lat, center.lng, finalLat, finalLng),
        bearing: bearing(center.lat, center.lng, finalLat, finalLng),
      };
    });
    const memoryItems = pulseMemories.slice(0, 20).map((m, i) => {
      const linked = ritualById.get(String(m.ritual_id ?? ''));
      const lat = Number(linked?.location_lat ?? linked?.lat);
      const lng = Number(linked?.location_lng ?? linked?.lng);
      const fb = fallbackCoordByIndex(i + ritualItems.length);
      const finalLat = Number.isFinite(lat) ? lat : fb.lat;
      const finalLng = Number.isFinite(lng) ? lng : fb.lng;
      return {
        id: `memory-${m.id || i}`,
        ritual_id: m.ritual_id,
        title: cleanText(m.ritual_title || m.content || linked?.title || 'Yakinindaki ani'),
        content: m.content,
        venue_name: linked?.venue_name || linked?.location_name || city,
        _sourceType: 'memory',
        _dotType: 'memory',
        distance: haversineDistance(center.lat, center.lng, finalLat, finalLng),
        bearing: bearing(center.lat, center.lng, finalLat, finalLng),
      };
    });
    const all = [...ritualItems, ...memoryItems].sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
    const filtered = all.filter((r) => r.distance == null || r.distance <= radius);
    return (filtered.length > 0 ? filtered : all).slice(0, 40);
  }, [rituals, pulseMemories, center.lat, center.lng, radius, city]);

  const sections = useMemo(() => {
    const live = nearby.filter((r) => r._dotType === 'live');
    const venues = nearby.filter((r) => r._sourceType === 'ritual' && !!(r.venue_name || r.location_name));
    const memories = nearby.filter((r) => r._sourceType === 'memory').slice(0, 8);
    return { live, venues, memories };
  }, [nearby]);

  const radarDots = useMemo(
    () =>
      nearby.slice(0, 24).map((r, i) => {
        const dist = Number(r.distance);
        const b = Number(r.bearing);
        if (Number.isFinite(dist) && Number.isFinite(b)) {
          const angle = ((b - 90) * Math.PI) / 180;
          const px = Math.min(125, (dist / radius) * 125);
          return { id: r.id || `d-${i}`, x: 200 + px * Math.cos(angle), y: 140 + px * Math.sin(angle), type: r._dotType || 'memory', ritual: r };
        }
        return { id: r.id || `d-${i}`, x: 200, y: 140, type: r._dotType || 'memory', ritual: r };
      }),
    [nearby, radius]
  );

  const sweepTransform = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['rotate(0 200 140)', 'rotate(360 200 140)'] });
  const pulse1R = userPulse1.interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
  const pulse1Opacity = userPulse1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const pulse2R = userPulse2.interpolate({ inputRange: [0, 1], outputRange: [6, 18] });
  const pulse2Opacity = userPulse2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  const openRitual = (r) => {
    const ritualId = r?.ritual_id || r?.id;
    if (ritualId) navigation?.navigate('RitualDetail', { ritualId });
  };

  const renderLiveCard = (r, i) => (
    <TouchableOpacity key={r.id || `live-${i}`} style={styles.card} onPress={() => openRitual(r)} activeOpacity={0.92}>
      <View style={styles.cardTop}>
        <Text style={styles.liveBadge}>CANLI</Text>
        <View style={styles.distanceBadge}>
          <Feather name="map-pin" size={9} color="#0f1d44" />
          <Text style={styles.distanceText}>{formatDistance(r.distance)}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.walkText}>{formatWalkTime(r.distance)}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{cleanText(r.title || 'Ritual')}</Text>
      <Text style={styles.cardMeta} numberOfLines={1}>📍 {r.venue_name || r.location_name || city}</Text>
      <TouchableOpacity style={styles.cta} onPress={() => openRitual(r)}><Text style={styles.ctaText}>Simdi Katil</Text></TouchableOpacity>
    </TouchableOpacity>
  );

  const renderVenueCard = (r, i) => (
    <TouchableOpacity key={r.id || `venue-${i}`} style={styles.venueCard} onPress={() => openRitual(r)} activeOpacity={0.92}>
      <View style={styles.thumb}><View style={styles.thumbPin}><Text style={styles.thumbPinText}>{formatDistance(r.distance)}</Text></View></View>
      <View style={styles.venueInfo}>
        <Text style={styles.venueName} numberOfLines={1}>{r.venue_name || r.location_name || city} ✓</Text>
        <Text style={styles.venueMeta}>● Acik · {r.current_attendees || 0} kisi iceride</Text>
        <Text style={styles.venueAct} numberOfLines={1}>◦ {cleanText(r.title || 'Ritual akisinda')}</Text>
      </View>
      <View style={styles.arrow}><Feather name="arrow-right" size={14} color="#fff" /></View>
    </TouchableOpacity>
  );

  const renderMemoryCard = (r, i) => (
    <TouchableOpacity key={r.id || `m-${i}`} style={styles.memoryCard} onPress={() => openRitual(r)} activeOpacity={0.92}>
      <View style={styles.memoryTop}>
        <Text style={styles.memoryBadge}>ANI</Text>
        <Text style={styles.memoryDist}>{formatDistance(r.distance)}</Text>
      </View>
      <Text style={styles.memoryTitle} numberOfLines={3}>{cleanText(r.title || 'Yakinindaki ani')}</Text>
      <Text style={styles.memoryMeta} numberOfLines={1}>{formatWalkTime(r.distance)} · {r.venue_name || city}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.contextStrip}>
        <View style={styles.contextLeft}>
          <View style={styles.contextIcon}><Feather name="map-pin" size={13} color="#fff" /></View>
          <View><Text style={styles.contextLabel}>Etrafinda</Text><Text style={styles.contextName}>{city} · Yakinimda</Text></View>
        </View>
        <View style={styles.accuracy}><View style={styles.accuracyDot} /><Text style={styles.accuracyText}>GPS · 8m</Text></View>
      </View>

      <View style={styles.radarPanel}>
        <View style={styles.radarTop}>
          <View style={styles.radarTopLeft}><View style={styles.radarTopDot} /><Text style={styles.radarTopLabel}>CANLI TARAMA</Text></View>
          <Text style={styles.radarTopTime}>{liveClock}</Text>
        </View>
        <View style={styles.radarBody}>
          <Svg width="100%" height="100%" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet">
            <Defs><SvgLinearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0"><Stop offset="0%" stopColor="rgba(184,137,31,0)" /><Stop offset="100%" stopColor="rgba(184,137,31,0.3)" /></SvgLinearGradient></Defs>
            <Line x1="60" y1="140" x2="340" y2="140" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <Line x1="200" y1="15" x2="200" y2="265" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <Circle cx="200" cy="140" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <Circle cx="200" cy="140" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <Circle cx="200" cy="140" r="125" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="2 3" />
            <SvgText x="200" y="99" fill="rgba(255,255,255,0.35)" fontSize="8.5" textAnchor="middle">{formatRingLabel(radius * (45 / 125))}</SvgText>
            <SvgText x="200" y="59" fill="rgba(255,255,255,0.35)" fontSize="8.5" textAnchor="middle">{formatRingLabel(radius * (85 / 125))}</SvgText>
            <SvgText x="200" y="19" fill="rgba(255,255,255,0.35)" fontSize="8.5" textAnchor="middle">{formatRingLabel(radius)}</SvgText>
            <SvgText x="200" y="10" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="700" textAnchor="middle">K</SvgText>
            <SvgText x="200" y="278" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="700" textAnchor="middle">G</SvgText>
            <SvgText x="20" y="144" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="700" textAnchor="middle">B</SvgText>
            <SvgText x="380" y="144" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="700" textAnchor="middle">D</SvgText>
            <AnimatedG transform={sweepTransform}><Path d="M 200 140 L 340 140 A 140 140 0 0 0 315 60 Z" fill="url(#sweepGrad)" opacity="0.65" /></AnimatedG>
            {radarDots.map((dot) => (
              <G key={dot.id} onPress={() => { setActiveDotId(dot.id); openRitual(dot.ritual); }}>
                <Circle cx={dot.x} cy={dot.y} r={dot.type === 'live' ? 12 : dot.type === 'venue' ? 11 : 10} fill={dot.type === 'live' ? '#E0303D' : dot.type === 'venue' ? '#2f7a47' : '#B8891F'} opacity="0.2" />
                <Circle cx={dot.x} cy={dot.y} r={dot.type === 'live' ? 5 : dot.type === 'venue' ? 4.5 : 4} fill={dot.type === 'live' ? '#E0303D' : dot.type === 'venue' ? '#2f7a47' : '#B8891F'} stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
                {activeDotId === dot.id ? <Circle cx={dot.x} cy={dot.y} r="16" fill={dot.type === 'live' ? '#E0303D' : '#B8891F'} opacity="0.15" /> : null}
              </G>
            ))}
            <AnimatedCircle cx="200" cy="140" r={pulse1R} fill="#B8891F" opacity={pulse1Opacity} />
            <AnimatedCircle cx="200" cy="140" r={pulse2R} fill="#B8891F" opacity={pulse2Opacity} />
            <Circle cx="200" cy="140" r="5" fill="#B8891F" stroke="#fff" strokeWidth="1.5" />
            <SvgText x="200" y="162" fill="rgba(184,137,31,0.9)" fontSize="8.5" fontWeight="700" textAnchor="middle">SEN</SvgText>
          </Svg>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#E0303D' }]} /><Text style={styles.legendText}>{sections.live.length} canlı</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#B8891F' }]} /><Text style={styles.legendText}>{sections.memories.length} anı</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#2f7a47' }]} /><Text style={styles.legendText}>{sections.venues.length} mekan</Text></View>
        </View>
      </View>

      <View style={styles.proximity}><View><Text style={styles.proxLabel}>YARIÇAP</Text><Text style={styles.proxValue}>{RADIUS_OPTIONS.find((o) => o.value === radius)?.label || '1km'} <Text style={styles.proxWalk}>~{formatWalkTime(radius)} yürü</Text></Text></View><View style={styles.pills}>{RADIUS_OPTIONS.map((opt) => <TouchableOpacity key={opt.value} style={[styles.pill, radius === opt.value && styles.pillActive]} onPress={() => setRadius(opt.value)}><Text style={[styles.pillText, radius === opt.value && styles.pillTextActive]}>{opt.label}</Text></TouchableOpacity>)}</View></View>

      <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>şu an burada</Text><Text style={styles.sectionCount}>{sections.live.length} CANLI</Text></View>{sections.live.slice(0, 4).map(renderLiveCard)}</View>
      <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>mekanlar</Text><Text style={styles.sectionCount}>{sections.venues.length} MEKAN</Text></View>{sections.venues.slice(0, 6).map(renderVenueCard)}</View>
      <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>yakınındaki anılar</Text><Text style={styles.sectionCount}>{sections.memories.length} ANI · SON 24SA</Text></View><View style={styles.memGrid}>{sections.memories.map(renderMemoryCard)}</View></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: PULSE.screenLight },
  content: { paddingBottom: 120 },
  contextStrip: { marginTop: 8, marginHorizontal: 16, backgroundColor: '#faf7f0', borderWidth: 1, borderColor: '#e8e0cf', borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0f1d44', alignItems: 'center', justifyContent: 'center' },
  contextLabel: { fontSize: 9, color: '#9a9a9e', letterSpacing: 1.2, fontWeight: '700' },
  contextName: { fontFamily: FONT_SERIF, fontSize: 18, color: '#0a0a0a' },
  accuracy: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#E7F6EC', borderRadius: 999 },
  accuracyDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#2f7a47' },
  accuracyText: { fontSize: 9.5, fontWeight: '600', color: '#2f7a47' },
  radarPanel: { marginTop: 12, marginHorizontal: 16, borderRadius: 22, backgroundColor: '#0f1d44', paddingTop: 10, paddingHorizontal: 14, paddingBottom: 12 },
  radarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  radarTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  radarTopDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B8891F' },
  radarTopLabel: { fontSize: 9.5, color: '#b8891f', letterSpacing: 1.2, fontWeight: '700' },
  radarTopTime: { fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  radarBody: { height: 280 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  proximity: { marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  proxLabel: { fontSize: 9.5, fontWeight: '700', color: '#9a9a9e', letterSpacing: 1 },
  proxValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  proxWalk: { fontSize: 16, color: '#6b7280', fontWeight: '500' },
  pills: { flexDirection: 'row', gap: 4, padding: 3, backgroundColor: '#f3f4f6', borderRadius: 999 },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  pillActive: { backgroundColor: '#000' },
  pillText: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: 14, color: '#6b6b6f' },
  sectionCount: { fontSize: 10.5, color: '#9a9a9e', letterSpacing: 0.5 },
  card: { marginBottom: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ededed', borderRadius: 18, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  liveBadge: { fontSize: 9.5, fontWeight: '700', color: '#b91b28', backgroundColor: '#FDECEF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', gap: 4 },
  distanceText: { fontSize: 10, color: '#0f1d44', fontWeight: '700' },
  dot: { fontSize: 10, color: '#6b7280' },
  walkText: { fontSize: 10, color: '#6b7280' },
  cardTitle: { fontFamily: FONT_SERIF, fontSize: 20, lineHeight: 23, color: '#0a0a0a', marginBottom: 5 },
  cardMeta: { fontSize: 11, color: '#6b7280', marginBottom: 10, fontStyle: 'italic' },
  cta: { alignSelf: 'flex-end', backgroundColor: '#000', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7 },
  ctaText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  venueCard: { marginBottom: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ededed', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#d1d5db', overflow: 'hidden', justifyContent: 'flex-end', padding: 4 },
  thumbPin: { alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(15,29,68,0.9)' },
  thumbPinText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  venueInfo: { flex: 1, minWidth: 0 },
  venueName: { fontSize: 14, fontWeight: '700', color: '#0a0a0a', marginBottom: 3 },
  venueMeta: { fontSize: 11, color: '#2f7a47', marginBottom: 5 },
  venueAct: { fontSize: 11, color: '#374151', fontStyle: 'italic' },
  arrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0f1d44', alignItems: 'center', justifyContent: 'center' },
  memGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  memoryCard: { width: '48.5%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ededed', borderRadius: 16, padding: 12, minHeight: 132 },
  memoryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  memoryBadge: { fontSize: 9.5, fontWeight: '700', color: '#b8891f', backgroundColor: '#f5ecd4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  memoryDist: { fontSize: 10, color: '#6b7280' },
  memoryTitle: { fontFamily: FONT_SERIF, fontSize: 20, lineHeight: 23, color: '#111827', marginBottom: 6 },
  memoryMeta: { fontSize: 11, color: '#6b7280' },
});
