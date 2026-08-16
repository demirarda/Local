import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { browseRituals } from '../services/api';
import useAuthStore from '../store/authStore';
import CityRhythmHtmlContent from '../components/CityRhythmHtmlContent';
import { pulseGridCardImage } from '../constants/pulseExampleImages';
import { requireVerifiedUser } from '../utils/verificationGuard';

const BACKGROUND = '#ffffff';
const PAD = 18;
const FONT_SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const CITY_COORDS = {
  milano: { latitude: 45.4642, longitude: 9.19 },
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  ankara: { latitude: 39.9334, longitude: 32.8597 },
  izmir: { latitude: 38.4237, longitude: 27.1428 },
};

export default function CityRhythmScreen({ route }) {
  const navigation = useNavigation();
  const isDark = !!route?.params?.forceDark;
  const { user } = useAuthStore();
  const [rituals, setRituals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('time_asc');
  const [viewMode, setViewMode] = useState('list');
  const [selectedMapIndex, setSelectedMapIndex] = useState(0);
  const mapRef = useRef(null);
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.08, longitudeDelta: 0.08 });
  const city = user?.city || 'Milano';
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasMore: false,
  });

  useEffect(() => {
    loadRituals(true);
  }, [city]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRituals(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedType, timeFilter, sortOrder]);

  const sortRituals = (ritualsList, order) => {
    const sorted = [...ritualsList];
    sorted.sort((a, b) => {
      const timeA = new Date(a.start_time).getTime();
      const timeB = new Date(b.start_time).getTime();
      return order === 'time_asc' ? timeA - timeB : timeB - timeA;
    });
    return sorted;
  };

  const isRitualLiveNow = (ritual) => {
    const now = new Date();
    const start = ritual?.start_time ? new Date(ritual.start_time) : null;
    if (!start || Number.isNaN(start.getTime())) return false;
    const durationMins = Math.max(30, Number(ritual?.duration || 90));
    const end = new Date(start.getTime() + durationMins * 60000);
    const status = String(ritual?.status || '').toLowerCase();
    return status === 'live' || (start <= now && now <= end);
  };

  const loadRituals = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPagination((prev) => ({ ...prev, page: 1 }));
      }

      const page = reset ? 1 : pagination.page;
      const params = { page, limit: 40, city };
      if (user?.id) params.viewer_id = user.id;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedType) params.type = selectedType;

      const requestSet = [];
      if (timeFilter === 'live_now') {
        requestSet.push(browseRituals({ ...params, status: 'live', page: 1, limit: 40 }));
      } else if (timeFilter === 'special_events') {
        requestSet.push(browseRituals({ ...params, type: 'Special Event', page: 1, limit: 30 }));
      } else if (timeFilter === 'open_entry') {
        requestSet.push(browseRituals({ ...params, entry_type: 'open', page: 1, limit: 40 }));
      } else {
        requestSet.push(browseRituals(params));
      }

      const responses = await Promise.all(requestSet);
      const baseResponse = responses[0] || { data: [], pagination: { page: 1, totalPages: 1 } };
      const combined = [
        ...(responses[0]?.data || []),
        ...(responses[1]?.data || []),
        ...(responses[2]?.data || []),
      ];
      const dedup = [];
      const seen = new Set();
      combined.forEach((ritual) => {
        const key = ritual?.id
          ? `id:${ritual.id}`
          : `k:${String(ritual?.title || '').toLowerCase()}|${String(ritual?.venue_name || '').toLowerCase()}|${String(ritual?.start_time || '')}`;
        if (seen.has(key)) return;
        seen.add(key);
        dedup.push(ritual);
      });
      let newRituals = dedup;
      const now = new Date();

      if (timeFilter === 'tonight') {
        newRituals = newRituals.filter((r) => {
          const d = new Date(r.start_time);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });
      } else if (timeFilter === 'live_now') {
        newRituals = newRituals.filter((r) => isRitualLiveNow(r));
      } else if (timeFilter === 'starting_soon') {
        newRituals = newRituals.filter((r) => {
          const d = new Date(r.start_time);
          const diffMins = Math.floor((d.getTime() - now.getTime()) / 60000);
          return diffMins >= 0 && diffMins <= 90;
        });
      } else if (timeFilter === 'this_week') {
        const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        newRituals = newRituals.filter((r) => {
          const d = new Date(r.start_time);
          return d >= now && d <= weekAhead;
        });
      } else if (timeFilter === 'seats_available') {
        newRituals = newRituals.filter(
          (r) => Number(r?.capacity || 0) - Number(r?.current_attendees || 0) > 0
        );
      } else if (timeFilter === 'special_events') {
        newRituals = newRituals.filter((r) => r.type === 'Special Event' || r.is_special_event);
      } else if (timeFilter === 'open_entry') {
        newRituals = newRituals.filter((r) => String(r.entry_type || '').toLowerCase() === 'open');
      }

      const sortedNew = sortRituals(newRituals, sortOrder);
      if (reset) {
        setRituals(sortedNew);
      } else {
        const combinedRituals = [...rituals, ...sortedNew];
        setRituals(sortRituals(combinedRituals, sortOrder));
      }

      const pagination = baseResponse?.pagination || { page: 1, totalPages: 1 };
      setPagination({
        page: pagination.page,
        totalPages: pagination.totalPages,
        hasMore: pagination.page < pagination.totalPages,
      });
    } catch (error) {
      if (__DEV__) console.log('Error loading rituals (non-fatal):', error?.message || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRituals(true);
  };

  const handleLoadMore = () => {
    if (!loading && pagination.hasMore) {
      setPagination({ ...pagination, page: pagination.page + 1 });
      loadRituals();
    }
  };

  const handleRitualPress = (ritual) => {
    if (!ritual?.id || String(ritual.id).startsWith('demo-')) return;
    navigation.navigate('RitualDetail', { ritualId: ritual.id });
  };

  /** son-part.md §8.4 — primary city search surface is Local World */
  const openLocalWorldSearch = () => {
    const q = searchQuery.trim();
    navigation.navigate('Local', q ? { searchQuery: q } : undefined);
  };

  const formatTime = (startTime, ritual) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (ritual.duration || 90) * 60000);
    const fmt = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const timeStr = `${fmt(start)} - ${fmt(end)}`;
    const now = new Date();
    const isLive = ritual.status === 'live' || (start <= now && now <= end);
    return { timeStr, isLive };
  };

  const getEntryTypeText = (entryType, ritual) => {
    if (entryType === 'open') return 'Herkese acik';
    if (entryType === 'request_seat') return 'RSVP gerekli';
    if (entryType === 'invite_only') return 'Yalnizca davetliler';
    return 'Herkese acik';
  };

  const getVerificationBadge = (ritual) => {
    if (ritual.is_host_verified) return 'Dogrulanmis Host';
    if (ritual.is_venue_verified) return 'Dogrulanmis Mekan';
    return null;
  };

  const getRitualTags = (ritual) => {
    const tags = [];
    if (ritual.type) tags.push(ritual.type);
    if (!tags.includes('Ritual')) tags.push('Ritual');
    return tags.slice(0, 3);
  };

  const handleSort = () => {
    setSortOrder(sortOrder === 'time_asc' ? 'time_desc' : 'time_asc');
  };

  const geolocatedRituals = useMemo(
    () =>
      (rituals || [])
        .filter((r) => {
          const lat = Number(r?.location_lat ?? r?.lat);
          const lng = Number(r?.location_lng ?? r?.lng);
          return Number.isFinite(lat) && Number.isFinite(lng);
        })
        .slice(0, 24),
    [rituals]
  );
  const mapRituals = geolocatedRituals;
  const selectedMapRitual = mapRituals[selectedMapIndex] || null;

  useEffect(() => {
    if (selectedMapIndex >= mapRituals.length) setSelectedMapIndex(0);
  }, [mapRituals.length, selectedMapIndex]);

  const mapChips = [
    { key: 'all', label: 'Tumu', selected: timeFilter === 'all' },
    { key: 'live_now', label: 'Simdi Canli', selected: timeFilter === 'live_now', tone: 'live' },
    { key: 'starting_soon', label: 'Baslamak Uzere', selected: timeFilter === 'starting_soon' },
    { key: 'tonight', label: 'Bu Gece', selected: timeFilter === 'tonight' },
    { key: 'seats_available', label: 'Yer Var', selected: timeFilter === 'seats_available' },
    { key: 'special_events', label: '★ Super Event', selected: timeFilter === 'special_events', tone: 'special' },
    { key: 'open_entry', label: 'Ucretsiz Giris', selected: timeFilter === 'open_entry' },
    { key: 'this_week', label: 'Bu Hafta', selected: timeFilter === 'this_week' },
  ];

  const getPinTone = (ritual) => {
    if (isRitualLiveNow(ritual)) return 'live';
    if (ritual?.is_special_event) return 'special';
    if (ritual?.entry_type === 'request_seat') return 'navy';
    if (ritual?.entry_type === 'invite_only') return 'venue';
    return 'default';
  };

  const baseCoords = CITY_COORDS[String(city || '').toLowerCase()] || CITY_COORDS.milano;
  const mapRegion = useMemo(() => ({
    latitude: baseCoords.latitude,
    longitude: baseCoords.longitude,
    latitudeDelta: mapDelta.latitudeDelta,
    longitudeDelta: mapDelta.longitudeDelta,
  }), [baseCoords.latitude, baseCoords.longitude, mapDelta.latitudeDelta, mapDelta.longitudeDelta]);

  const zoomMap = (factor) => {
    const next = {
      latitudeDelta: Math.min(0.25, Math.max(0.006, mapDelta.latitudeDelta * factor)),
      longitudeDelta: Math.min(0.25, Math.max(0.006, mapDelta.longitudeDelta * factor)),
    };
    setMapDelta(next);
    mapRef.current?.animateToRegion({ ...mapRegion, ...next }, 220);
  };

  const recenterMap = () => {
    mapRef.current?.animateToRegion(mapRegion, 260);
  };

  const mapMarkers = useMemo(
    () =>
      mapRituals.map((ritual) => ({
        ...ritual,
        latitude: Number(ritual.location_lat ?? ritual.lat),
        longitude: Number(ritual.location_lng ?? ritual.lng),
      })),
    [mapRituals]
  );

  const renderMapView = () => (
    <View style={[styles.mapScreen, isDark && styles.mapScreenDark]}>
      <MapView
        ref={mapRef}
        style={styles.realMap}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled={false}
      >
        {mapMarkers.map((ritual, idx) => {
          const tone = getPinTone(ritual);
          const selected = idx === selectedMapIndex;
          const t = formatTime(ritual.start_time, ritual);
          const pinText = tone === 'live' ? `● ${t.timeStr.split(' - ')[0]} CANLI` : t.timeStr.split(' - ')[0];
          return (
            <Marker
              key={ritual.id || `pin-${idx}`}
              coordinate={{ latitude: ritual.latitude, longitude: ritual.longitude }}
              onPress={() => setSelectedMapIndex(idx)}
            >
              <View style={[styles.pinBody, tone === 'live' && styles.pinLive, tone === 'special' && styles.pinGold, tone === 'navy' && styles.pinNavy, tone === 'venue' && styles.pinVenue, tone === 'default' && styles.pinBlack, selected && styles.pinBodySelected]}>
                <Text style={[styles.pinText, (tone === 'venue' || tone === 'special') && styles.pinTextDark]}>{pinText}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.mapTopControls}>
        <View style={styles.mapTopRow}>
          <Text style={[styles.mapTitle, isDark && styles.mapTitleDark]}>City Rhythm</Text>
          <View style={[styles.viewModeGroup, isDark && styles.viewModeGroupDark]}>
            <TouchableOpacity style={styles.viewModeBtn} onPress={() => setViewMode('list')} activeOpacity={0.85}>
              <Text style={styles.viewModeText}>☰ Liste</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewModeBtn, styles.viewModeBtnActive]} activeOpacity={1}>
              <Text style={styles.viewModeTextActive}>🗺 Harita</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.mapSearch, isDark && styles.mapSearchDark]}>
          <MaterialIcons name="search" size={15} color={isDark ? '#94a3b8' : '#a3a3a3'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Haritada ara..."
            placeholderTextColor={isDark ? '#94a3b8' : '#a3a3a3'}
            style={[styles.mapSearchInput, isDark && styles.mapSearchInputDark]}
            returnKeyType="search"
            onSubmitEditing={openLocalWorldSearch}
          />
          <TouchableOpacity style={styles.mapFilterBtn} onPress={openLocalWorldSearch} activeOpacity={0.85}>
            <Text style={styles.mapFilterText}>Local World</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {mapChips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={[styles.mapChip, chip.tone === 'live' && !chip.selected && styles.mapChipLive, chip.tone === 'special' && !chip.selected && styles.mapChipSpecial, chip.selected && styles.mapChipOn, isDark && !chip.selected && styles.mapChipDark]}
              onPress={() => setTimeFilter(chip.key)}
              activeOpacity={0.9}
            >
              <Text style={[styles.mapChipText, chip.selected && styles.mapChipTextOn]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sideControls}>
        <TouchableOpacity style={[styles.sideBtn, styles.sideBtnActive]} activeOpacity={0.9} onPress={recenterMap}><Text style={styles.sideBtnActiveText}>📍</Text></TouchableOpacity>
        <View style={styles.sideGroup}>
          <TouchableOpacity style={styles.sideBtn} activeOpacity={0.9} onPress={() => zoomMap(0.72)}><Text style={styles.sideBtnText}>+</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.sideBtn, styles.sideBtnDivider]} activeOpacity={0.9} onPress={() => zoomMap(1.35)}><Text style={styles.sideBtnText}>−</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.sideBtn} activeOpacity={0.9}><Text style={styles.sideBtnText}>🗂</Text></TouchableOpacity>
      </View>

      <View style={[styles.sheet, isDark && styles.sheetDark]}>
        <View style={styles.sheetHandle} />
        {!loading && mapRituals.length === 0 ? (
          <View style={styles.mapEmptyWrap}>
            <Text style={[styles.mapEmptyTitle, isDark && styles.mapTitleDark]}>Haritada Ritual yok</Text>
            <Text style={styles.mapEmptySub}>
              Konum bilgisi olan acik Ritual bulunamadi. Liste gorunumune gec veya Local World haritasina bak.
            </Text>
            <TouchableOpacity style={styles.sheetListBtn} onPress={() => setViewMode('list')} activeOpacity={0.9}>
              <Text style={styles.sheetListBtnText}>☰ Listeye Don</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        <View style={styles.sheetHead}>
          <View>
            <Text style={[styles.sheetCount, isDark && styles.sheetCountDark]}>
              {selectedMapRitual ? selectedMapRitual.title || 'Ritual' : `${mapRituals.length} Ritual bu bolgede`}
            </Text>
            <Text style={styles.sheetSub}>{mapRituals.filter((r) => r.status === 'live').length} canli · {mapRituals.length} Ritual</Text>
          </View>
          <TouchableOpacity style={styles.sheetListBtn} onPress={() => setViewMode('list')} activeOpacity={0.9}>
            <Text style={styles.sheetListBtnText}>☰ Listeye Don</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
          {mapRituals.map((ritual, idx) => {
            const selected = idx === selectedMapIndex;
            const image = pulseGridCardImage(ritual, idx);
            const t = formatTime(ritual.start_time, ritual);
            return (
              <TouchableOpacity
                key={ritual.id || `card-${idx}`}
                style={[styles.miniCard, selected && styles.miniCardSelected, isDark && styles.miniCardDark]}
                onPress={() => {
                  setSelectedMapIndex(idx);
                  handleRitualPress(ritual);
                }}
                activeOpacity={0.9}
              >
                <View style={styles.miniImgWrap}>
                  <Image source={{ uri: image }} style={styles.miniImg} />
                  <View style={styles.miniOverlay} />
                  {ritual.status === 'live' ? <Text style={styles.liveBadge}>● CANLI</Text> : null}
                  <Text style={styles.miniTitle} numberOfLines={1}>{String(ritual.title || 'Ritual').replace(/^\[[^\]]+\]\s*/g, '').trim() || 'Ritual'}</Text>
                </View>
                <View style={styles.miniBody}>
                  <Text style={styles.miniMeta} numberOfLines={1}>📍 {ritual.venue_name || city} · {t.timeStr.split(' - ')[0]}</Text>
                  <View style={styles.miniFooter}>
                    <Text style={styles.miniTag}>{ritual.type || 'Social'}</Text>
                    <View style={styles.miniBtn}><Text style={styles.miniBtnText}>Gor</Text></View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <SafeAreaView style={[styles.safeArea, isDark && styles.containerDark]} edges={['top']}>
        <View style={[styles.wrapper, isDark && styles.containerDark]}>
          <View style={[styles.header, isDark && styles.headerDark]}>
            <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>City Rhythm</Text>
            <View style={styles.headerRight}>
              <View style={[styles.viewModeGroup, isDark && styles.viewModeGroupDark]}>
                <TouchableOpacity style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]} onPress={() => setViewMode('list')} activeOpacity={0.85}>
                  <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>☰ Liste</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.viewModeBtn, viewMode === 'map' && styles.viewModeBtnActive]} onPress={() => setViewMode('map')} activeOpacity={0.85}>
                  <Text style={[styles.viewModeText, viewMode === 'map' && styles.viewModeTextActive]}>🗺 Harita</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.filterButton, isDark && styles.filterButtonDark]}
                activeOpacity={0.85}
                onPress={() => {
                  if (!requireVerifiedUser(user, 'Ritual olusturmadan once universite e-postani dogrulamalisin.')) return;
                  navigation.navigate('Main', { screen: 'CreateRitual' });
                }}
              >
                <MaterialIcons name="tune" size={16} color={isDark ? '#d4d4d8' : '#737373'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.content, isDark && styles.containerDark]}>
            {viewMode === 'map' ? (
              renderMapView()
            ) : (
              <CityRhythmHtmlContent
                rituals={rituals}
                loading={loading}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                onLoadMore={handleLoadMore}
                hasMore={pagination.hasMore}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={openLocalWorldSearch}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                timeFilter={timeFilter}
                onTimeFilterChange={setTimeFilter}
                sortOrder={sortOrder}
                onSort={handleSort}
                onRitualPress={handleRitualPress}
                getRitualTags={getRitualTags}
                getEntryTypeText={(ritual) => getEntryTypeText(ritual.entry_type, ritual)}
                getVerificationBadge={getVerificationBadge}
                isDark={isDark}
              />
            )}
          </View>

          <View style={[styles.bottomNav, isDark && styles.bottomNavDark]}>
            <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Pulse')} activeOpacity={0.7}>
              <MaterialIcons name="timeline" size={20} color="#9CA3AF" />
              <Text style={styles.bottomNavLabel}>Pulse</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('Local')} activeOpacity={0.7}>
              <MaterialIcons name="public" size={20} color="#9CA3AF" />
              <Text style={styles.bottomNavLabel}>Local</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavButtonActive} onPress={() => {}} activeOpacity={0.7}>
              <View style={styles.bottomNavActiveCircle}>
                <MaterialIcons name="calendar-month" size={16} color="#ffffff" />
              </View>
              <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>City Rhythm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomNavButton} onPress={() => navigation.navigate('SocialPassport')} activeOpacity={0.7}>
              <MaterialIcons name="account-circle" size={20} color="#9CA3AF" />
              <Text style={styles.bottomNavLabel}>Passport</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  containerDark: { backgroundColor: '#020617' },
  safeArea: { flex: 1, backgroundColor: BACKGROUND },
  wrapper: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: BACKGROUND },
  header: { paddingHorizontal: PAD, paddingTop: 6, paddingBottom: 10, backgroundColor: BACKGROUND, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerDark: { backgroundColor: '#020617' },
  headerTitle: { fontSize: 24, color: '#000', fontFamily: FONT_SERIF, letterSpacing: -0.3 },
  headerTitleDark: { color: '#f8fafc' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewModeGroup: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 999, overflow: 'hidden', backgroundColor: '#fff' },
  viewModeGroupDark: { borderColor: '#334155', backgroundColor: '#0f172a' },
  viewModeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  viewModeBtnActive: { backgroundColor: '#000' },
  viewModeText: { fontSize: 11, color: '#737373', fontWeight: '500' },
  viewModeTextActive: { color: '#fff' },
  filterButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  filterButtonDark: { borderColor: '#334155', backgroundColor: '#0f172a' },
  content: { flex: 1, paddingHorizontal: PAD, backgroundColor: BACKGROUND },
  mapScreen: { flex: 1, marginHorizontal: -PAD, backgroundColor: '#E8E0D5' },
  mapScreenDark: { backgroundColor: '#0f172a' },
  realMap: { ...StyleSheet.absoluteFillObject },
  mapTopControls: { position: 'absolute', top: 10, left: 12, right: 12, gap: 8 },
  mapTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapTitle: { fontSize: 22, color: '#000', fontFamily: FONT_SERIF, letterSpacing: -0.3, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  mapTitleDark: { color: '#f8fafc', backgroundColor: 'rgba(2,6,23,0.92)', borderColor: '#334155' },
  mapSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  mapSearchDark: { backgroundColor: 'rgba(2,6,23,0.94)', borderColor: '#334155' },
  mapSearchInput: { flex: 1, fontSize: 13, color: '#525252', paddingVertical: 0 },
  mapSearchInputDark: { color: '#cbd5e1' },
  mapFilterBtn: { backgroundColor: '#1B2E4A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  mapFilterText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chipsRow: { gap: 6, paddingBottom: 2 },
  mapChip: { paddingHorizontal: 13, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.95)' },
  mapChipDark: { backgroundColor: '#0f172a' },
  mapChipOn: { backgroundColor: '#000' },
  mapChipLive: { backgroundColor: '#dc2626' },
  mapChipSpecial: { backgroundColor: '#1B2E4A' },
  mapChipText: { fontSize: 10, fontWeight: '500', color: '#525252' },
  mapChipTextOn: { color: '#fff' },
  pinBody: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pinBodySelected: { transform: [{ scale: 1.08 }] },
  pinLive: { backgroundColor: '#DC2626' },
  pinGold: { backgroundColor: '#C8A96A' },
  pinNavy: { backgroundColor: '#1B2E4A' },
  pinVenue: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e5e5' },
  pinBlack: { backgroundColor: '#000' },
  pinText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  pinTextDark: { color: '#111827' },
  sideControls: { position: 'absolute', right: 14, bottom: 240, gap: 8 },
  sideBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  sideBtnActive: { backgroundColor: '#1B2E4A', borderColor: '#1B2E4A' },
  sideBtnText: { fontSize: 18, color: '#000' },
  sideBtnActiveText: { fontSize: 16, color: '#fff' },
  sideGroup: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  sideBtnDivider: { borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.98)', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 10, paddingHorizontal: 16, paddingBottom: 16 },
  sheetDark: { backgroundColor: 'rgba(2,6,23,0.97)', borderTopColor: '#334155' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d4d4d4', alignSelf: 'center', marginBottom: 10 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetCount: { fontSize: 13, fontWeight: '600', color: '#000' },
  sheetCountDark: { color: '#f8fafc' },
  sheetSub: { fontSize: 11, color: '#a3a3a3' },
  sheetListBtn: { backgroundColor: '#E8EDF4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sheetListBtnText: { fontSize: 10, color: '#1B2E4A', fontWeight: '700' },
  cardsRow: { gap: 10, paddingBottom: 4 },
  miniCard: { width: 200, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e5e5', overflow: 'hidden', backgroundColor: '#fff' },
  miniCardDark: { backgroundColor: '#111827', borderColor: '#334155' },
  miniCardSelected: { borderColor: '#1B2E4A', borderWidth: 2 },
  miniImgWrap: { width: '100%', height: 80 },
  miniImg: { width: '100%', height: '100%' },
  miniOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  liveBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#dc2626', color: '#fff', fontSize: 7, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  miniTitle: { position: 'absolute', bottom: 6, left: 7, right: 7, color: '#fff', fontSize: 12, fontFamily: FONT_SERIF },
  miniBody: { paddingHorizontal: 9, paddingVertical: 8 },
  miniMeta: { fontSize: 9, color: '#a3a3a3', marginBottom: 6 },
  miniFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniTag: { fontSize: 8, fontWeight: '700', color: '#1B2E4A', backgroundColor: '#E8EDF4', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  miniBtn: { backgroundColor: '#000', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  miniBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  mapEmptyWrap: { paddingVertical: 20, paddingHorizontal: 8, alignItems: 'center' },
  mapEmptyTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  mapEmptySub: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 10, paddingBottom: 18, borderTopWidth: 1.5, borderTopColor: '#e5e5e5', backgroundColor: '#fff' },
  bottomNavDark: { borderTopColor: '#334155', backgroundColor: '#020617' },
  bottomNavButton: { flex: 1, alignItems: 'center', gap: 3 },
  bottomNavButtonActive: { flex: 1, alignItems: 'center', gap: 3 },
  bottomNavActiveCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  bottomNavLabel: { fontSize: 8, color: '#a3a3a3', fontWeight: '500' },
  bottomNavLabelActive: { color: '#000', fontWeight: '700' },
});
