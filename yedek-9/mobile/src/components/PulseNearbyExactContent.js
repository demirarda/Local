import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  Linking,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { PULSE } from '../constants/pulseTheme';

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const toStart = (r) => new Date(r?.start_time || Date.now());
const minsToStart = (r) => Math.max(0, Math.floor((toStart(r).getTime() - Date.now()) / 60000));
const fmtCountdown = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}s ${mins % 60}dk` : `${mins} dk`);
const distanceKm = (r) => {
  if (r?.distance_km != null) return Number(r.distance_km);
  if (r?.distance_meters != null) return Number(r.distance_meters) / 1000;
  return null;
};
const isFiniteCoord = (lat, lng) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
const markerTone = (r) => {
  const status = String(r?.status || '').toLowerCase();
  const d = distanceKm(r);
  const mins = minsToStart(r);
  if (status === 'live' || r?.time_state === 'live_now') return 'live';
  if (mins <= 60) return 'soon';
  if (d != null && d > 2) return 'green';
  return 'navy';
};

export default function PulseNearbyExactContent({
  rituals = [],
  city,
  radiusKm = 3,
  location,
  navigation,
  refreshing = false,
  onRefresh,
  onMapPress,
  isDark = false,
}) {
  const [radius, setRadius] = useState(Math.max(0.5, Number(radiusKm) || 3));
  const [deviceLocation, setDeviceLocation] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown');

  const requestLocationPermission = async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let status = current?.status;
      if (status !== 'granted') {
        const asked = await Location.requestForegroundPermissionsAsync();
        status = asked?.status;
      }
      setPermissionStatus(status || 'denied');
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (isFiniteCoord(pos?.coords?.latitude, pos?.coords?.longitude)) {
        setDeviceLocation({
          latitude: Number(pos.coords.latitude),
          longitude: Number(pos.coords.longitude),
        });
      }
    } catch (_) {
      setPermissionStatus('denied');
    }
  };

  useEffect(() => {
    requestLocationPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearby = useMemo(
    () =>
      rituals
        .filter((r) => {
          const d = distanceKm(r);
          return d == null || d <= radius;
        })
        .sort((a, b) => {
          const da = distanceKm(a) ?? 999;
          const db = distanceKm(b) ?? 999;
          if (da !== db) return da - db;
          return minsToStart(a) - minsToStart(b);
        }),
    [rituals, radius]
  );
  const mapCenter = useMemo(() => {
    if (isFiniteCoord(deviceLocation?.latitude, deviceLocation?.longitude)) {
      return { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude };
    }
    if (isFiniteCoord(location?.latitude, location?.longitude)) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    const firstWithCoords = rituals.find((r) =>
      isFiniteCoord(r.location_lat ?? r.lat, r.location_lng ?? r.lng)
    );
    if (firstWithCoords) {
      return {
        latitude: Number(firstWithCoords.location_lat ?? firstWithCoords.lat),
        longitude: Number(firstWithCoords.location_lng ?? firstWithCoords.lng),
      };
    }
    return city?.toLowerCase().includes('istanbul')
      ? { latitude: 41.0082, longitude: 28.9784 }
      : { latitude: 45.4642, longitude: 9.19 };
  }, [deviceLocation, location, rituals, city]);

  const mapMarkers = useMemo(() => {
    return nearby.slice(0, 24).map((r, i) => {
      const lat = Number(r.location_lat ?? r.lat);
      const lng = Number(r.location_lng ?? r.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { ...r, latitude: lat, longitude: lng };
      }
      // fallback: tiny ring around center for records without coords
      const angle = (i / Math.max(nearby.length, 1)) * Math.PI * 2;
      return {
        ...r,
        latitude: mapCenter.latitude + Math.sin(angle) * 0.004,
        longitude: mapCenter.longitude + Math.cos(angle) * 0.004,
      };
    });
  }, [nearby, mapCenter.latitude, mapCenter.longitude]);

  const walk = nearby.filter((r) => (distanceKm(r) ?? 9) < 1);
  const bike = nearby.filter((r) => {
    const d = distanceKm(r) ?? 9;
    return d >= 1 && d < 2;
  });
  const metro = nearby.filter((r) => {
    const d = distanceKm(r) ?? 9;
    return d >= 2;
  });

  const openRitual = (r) => r?.id && navigation.navigate('RitualDetail', { ritualId: r.id });
  const distanceLabel = (r) => {
    const d = distanceKm(r);
    if (d == null) return 'yakında';
    return `${d.toFixed(1)} km`;
  };
  const etaLabel = (r) => {
    const d = distanceKm(r);
    if (d == null) return 'yakın';
    if (d < 1) return `🚶 ${Math.max(3, Math.round(d * 12))} dk`;
    if (d < 2) return `🚲 ${Math.max(5, Math.round(d * 6))} dk`;
    return `🚇 ${Math.max(7, Math.round(d * 4))} dk`;
  };

  const renderCard = (r, idx, hero = false) => (
    <TouchableOpacity
      key={r.id || `near-${idx}`}
      style={[styles.card, hero && styles.cardHero, isDark && styles.cardDark]}
      onPress={() => openRitual(r)}
      activeOpacity={0.93}
    >
      {hero ? (
        <ImageBackground
          source={{ uri: r.image_url || r.cover_image_url || r.venue_image_url || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80' }}
          style={styles.hero}
          imageStyle={styles.heroImg}
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroTop}>
            <Text style={[styles.badge, String(r.status).toLowerCase() === 'live' ? styles.badgeLive : styles.badgeSoon]}>
              {String(r.status).toLowerCase() === 'live' ? '● CANLI' : fmtCountdown(minsToStart(r))}
            </Text>
            <Text style={styles.distChip}>{`${etaLabel(r)} · ${distanceLabel(r)}`}</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle} numberOfLines={1}>{r.title || 'Ritual'}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>{`📍 ${r.venue_name || city}`}</Text>
          </View>
        </ImageBackground>
      ) : null}
      <View style={styles.body}>
        {!hero ? (
          <View style={styles.headRow}>
            <Text style={styles.distInline}>{`${etaLabel(r)} · ${distanceLabel(r)}`}</Text>
            <Text style={styles.minsInline}>{fmtCountdown(minsToStart(r))}</Text>
          </View>
        ) : null}
        {!hero ? <Text style={[styles.title, isDark && styles.titleDark]} numberOfLines={1}>{r.title || 'Ritual'}</Text> : null}
        <Text style={styles.venue} numberOfLines={1}>{`📍 ${r.venue_name || city}`}</Text>
        <View style={styles.tags}>
          <Text style={styles.tag}>📍 Yakınımda</Text>
          {r.is_special_event ? <Text style={styles.tag}>★ Super Event</Text> : null}
          {r.friends_here > 0 ? <Text style={styles.tag}>{`👥 ${r.friends_here} arkadaş`}</Text> : null}
        </View>
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.avatars}>
              <View style={[styles.avatar, styles.avatarA]} />
              <View style={[styles.avatar, styles.avatarB]} />
            </View>
            <Text style={styles.footerText}>{String(r.status).toLowerCase() === 'live' ? 'Şu an devam ediyor' : 'Yakında başlıyor'}</Text>
          </View>
          <View style={styles.footerRight}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => {}}>
              <Text style={styles.saveText}>🔖</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.joinBtn} onPress={() => openRitual(r)}>
              <Text style={styles.joinBtnText}>Katıl</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMiniCard = (r, idx) => (
    <TouchableOpacity key={r.id || `mini-${idx}`} style={[styles.miniCard, isDark && styles.cardDark]} onPress={() => openRitual(r)} activeOpacity={0.93}>
      <ImageBackground
        source={{ uri: r.image_url || r.cover_image_url || r.venue_image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80' }}
        style={styles.miniHero}
        imageStyle={styles.miniHeroImg}
      >
        <View style={styles.heroOverlay} />
        <View style={styles.miniTop}><Text style={styles.miniDist}>{etaLabel(r)}</Text></View>
        <View style={styles.miniBottom}>
          <Text style={styles.miniTitle} numberOfLines={1}>{r.title || 'Ritual'}</Text>
          <Text style={styles.miniVenue} numberOfLines={1}>{`📍 ${r.venue_name || city}`}</Text>
        </View>
      </ImageBackground>
      <View style={styles.miniBody}>
        <Text style={styles.miniInfo}>{distanceLabel(r)}</Text>
        <TouchableOpacity style={styles.miniBtn} onPress={() => openRitual(r)}>
          <Text style={styles.miniBtnText}>Katıl</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const section = (title, rows, heroFirst = false) => (
    rows.length ? (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.line} />
          <Text style={styles.count}>{rows.length}</Text>
        </View>
        {heroFirst ? renderCard(rows[0], 0, true) : null}
        {(heroFirst ? rows.slice(1, 3) : rows.slice(0, 2)).map((r, i) => renderCard(r, i + 1, false))}
        {rows.length > 3 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {rows.slice(3, 10).map((r, i) => renderMiniCard(r, i))}
          </ScrollView>
        ) : null}
      </View>
    ) : null
  );

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.mapStrip, isDark && styles.cardDark]}>
        <MapView
          style={styles.mapBg}
          initialRegion={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: 0.035,
            longitudeDelta: 0.035,
          }}
          region={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: Math.max(0.01, radius * 0.018),
            longitudeDelta: Math.max(0.01, radius * 0.018),
          }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          <Circle
            center={mapCenter}
            radius={radius * 1000}
            strokeColor="rgba(27,46,74,0.45)"
            fillColor="rgba(27,46,74,0.08)"
          />
          {mapMarkers.map((r, idx) => (
            <Marker
              key={r.id || `m-${idx}`}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              onPress={() => openRitual(r)}
            >
              <View
                style={[
                  styles.markerPill,
                  markerTone(r) === 'live' && styles.markerLive,
                  markerTone(r) === 'soon' && styles.markerSoon,
                  markerTone(r) === 'navy' && styles.markerNavy,
                  markerTone(r) === 'green' && styles.markerGreen,
                ]}
              >
                <Text style={styles.markerText}>
                  {markerTone(r) === 'live' ? `● ${distanceLabel(r)}` : markerTone(r) === 'soon' ? `⏱ ${distanceLabel(r)}` : distanceLabel(r)}
                </Text>
              </View>
            </Marker>
          ))}
        </MapView>
        <Text style={styles.mapRadius}>{`📡 ${radius.toFixed(1)} km`}</Text>
        <TouchableOpacity onPress={onMapPress} style={styles.mapExpand}>
          <Text style={styles.mapExpandText}>🗺 Genişlet →</Text>
        </TouchableOpacity>
      </View>

      {permissionStatus !== 'granted' ? (
        <View style={[styles.permissionCard, isDark && styles.cardDark]}>
          <Text style={[styles.permissionTitle, isDark && styles.titleDark]}>Konum izni gerekli</Text>
          <Text style={styles.permissionSub}>
            Yakınımdaki Ritualsi doğru göstermek için konum iznini aç.
          </Text>
          <View style={styles.permissionActions}>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestLocationPermission}>
              <Text style={styles.permissionBtnText}>İzin Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.permissionBtnGhost} onPress={() => Linking.openSettings()}>
              <Text style={styles.permissionBtnGhostText}>Ayarlar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>Mesafe:</Text>
        <View style={styles.radiusTrack}>
          {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map((v) => (
            <TouchableOpacity key={`r-${v}`} style={[styles.radiusDot, radius >= v && styles.radiusDotOn]} onPress={() => setRadius(v)} />
          ))}
        </View>
        <Text style={styles.radiusVal}>{`${radius.toFixed(1)} km`}</Text>
      </View>

      <View style={[styles.context, isDark && styles.contextDark]}>
        <Text style={styles.contextTitle}>{`${city} çevresinde`}</Text>
        <Text style={styles.contextSub}>{`${radius.toFixed(1)} km yarıçapında · ${walk.length} yürüme mesafesi`}</Text>
        <View style={styles.contextStats}>
          <Text style={styles.contextStat}>🟢 {nearby.filter((r) => markerTone(r) === 'green').length} rahat</Text>
          <Text style={styles.contextStat}>⏱ {nearby.filter((r) => markerTone(r) === 'soon').length} yakında</Text>
          <Text style={styles.contextStat}>● {nearby.filter((r) => markerTone(r) === 'live').length} canlı</Text>
        </View>
        <Text style={styles.contextNum}>{nearby.length}</Text>
      </View>

      {section('🚶 Yürüme mesafesinde · <1 km', walk, true)}
      {section('🚲 1–2 km · Bisiklet', bike)}
      {section('🚇 2–3 km · Metro / araç', metro)}

      {nearby.length === 0 ? (
        <View style={[styles.empty, isDark && styles.cardDark]}>
          <Text style={[styles.title, isDark && styles.titleDark]}>Yakınımda Ritual yok</Text>
          <Text style={styles.venue}>Yarıçapı artır veya konumu güncelle.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  mapStrip: { height: 140, marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 10 },
  mapBg: { ...StyleSheet.absoluteFillObject },
  mapRadius: { position: 'absolute', top: 10, left: 10, color: '#fff', backgroundColor: 'rgba(27,46,74,0.85)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '700' },
  mapExpand: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 5 },
  mapExpandText: { color: '#1B2E4A', fontSize: 10, fontWeight: '700' },
  markerPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  markerLive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  markerSoon: { backgroundColor: '#d97706', borderColor: '#d97706' },
  markerNavy: { backgroundColor: '#1B2E4A', borderColor: '#1B2E4A' },
  markerGreen: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  markerText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  radiusRow: { marginHorizontal: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  radiusLabel: { fontSize: 10, color: '#737373' },
  radiusTrack: { flex: 1, height: 3, backgroundColor: '#e5e7eb', borderRadius: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  radiusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  radiusDotOn: { backgroundColor: '#1B2E4A' },
  radiusVal: { fontSize: 11, color: '#1B2E4A', fontWeight: '700', minWidth: 40, textAlign: 'right' },
  context: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, backgroundColor: '#1B2E4A', padding: 13 },
  contextDark: { backgroundColor: '#0f172a' },
  contextTitle: { color: '#fff', fontSize: 17 },
  contextSub: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  contextNum: { position: 'absolute', right: 14, top: 10, color: '#fff', fontSize: 30 },
  contextStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  contextStat: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontWeight: '700',
  },
  section: { marginBottom: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 6, gap: 8 },
  sectionTitle: { fontSize: 9, color: '#6b7280', fontWeight: '700' },
  line: { flex: 1, height: 1, backgroundColor: '#f1f5f9' },
  count: { fontSize: 9, color: '#9ca3af', backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  card: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  cardHero: { borderColor: 'rgba(220,38,38,0.2)' },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  hero: { height: 150, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroTop: { paddingHorizontal: 10, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  badge: { color: '#fff', fontSize: 8, fontWeight: '700', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeLive: { backgroundColor: '#dc2626' },
  badgeSoon: { backgroundColor: '#d97706' },
  distChip: { color: '#fff', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 2 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  body: { padding: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  distInline: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
  minsInline: { fontSize: 10, color: '#9ca3af' },
  title: { fontSize: 15, color: '#111827', fontWeight: '600', marginBottom: 2 },
  titleDark: { color: '#f9fafb' },
  venue: { fontSize: 10, color: '#9ca3af', marginBottom: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tag: { fontSize: 8, color: '#525252', backgroundColor: '#f3f4f6', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  footer: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  avatarA: { backgroundColor: '#4a3728' },
  avatarB: { backgroundColor: '#2d6a2d', marginLeft: -6 },
  footerText: { fontSize: 10, color: '#6b7280', flex: 1 },
  saveBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 12 },
  joinBtn: { backgroundColor: '#1B2E4A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  hScroll: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  miniCard: { width: 160, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  miniHero: { height: 85, justifyContent: 'space-between' },
  miniHeroImg: { resizeMode: 'cover' },
  miniTop: { paddingHorizontal: 7, paddingTop: 6 },
  miniDist: { fontSize: 8, color: '#fff', fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3 },
  miniBottom: { paddingHorizontal: 7, paddingBottom: 6 },
  miniTitle: { fontSize: 12, color: '#fff', fontWeight: '600' },
  miniVenue: { fontSize: 8, color: 'rgba(255,255,255,0.65)' },
  miniBody: { paddingHorizontal: 9, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniInfo: { fontSize: 9, color: '#6b7280' },
  miniBtn: { backgroundColor: '#1B2E4A', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  miniBtnText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  empty: { marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fafafa', paddingVertical: 22, paddingHorizontal: 14, alignItems: 'center' },
  permissionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
  },
  permissionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  permissionSub: { fontSize: 11, color: '#6b7280', marginBottom: 10 },
  permissionActions: { flexDirection: 'row', gap: 8 },
  permissionBtn: {
    backgroundColor: '#1B2E4A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  permissionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  permissionBtnGhost: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  permissionBtnGhostText: { color: '#374151', fontSize: 11, fontWeight: '700' },
});

