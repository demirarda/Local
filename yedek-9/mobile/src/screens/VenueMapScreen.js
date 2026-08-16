import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { nominateVenuePlace } from '../services/api';

const COLORS = {
  bg: '#f6f3ed',
  surface: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  primary: '#c59d5f',
  divider: '#f1f5f9',
};

function buildMapsUrl({ venueName, venueAddress, latitude, longitude }) {
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  if (hasCoords) {
    const q = encodeURIComponent(venueName || venueAddress || 'Mekan');
    if (Platform.OS === 'ios') {
      return `http://maps.apple.com/?ll=${latitude},${longitude}&q=${q}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  const query = encodeURIComponent([venueName, venueAddress].filter(Boolean).join(' ') || 'Mekan');
  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?q=${query}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export default function VenueMapScreen({ route, navigation }) {
  const { venueName, venueAddress, latitude, longitude, rituals } = route.params || {};
  const isDark = !!route?.params?.forceDark;
  const isVerifiedVenuesFlow = String(venueName || '').toLowerCase().includes('doğrulanmış mekanlar');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activePin, setActivePin] = useState(null);
  const [nominateOpen, setNominateOpen] = useState(false);
  const [nominateName, setNominateName] = useState('');
  const [nominating, setNominating] = useState(false);
  const dragStartY = useRef(0);

  const latNum = typeof latitude === 'string' ? Number(latitude) : latitude;
  const lngNum = typeof longitude === 'string' ? Number(longitude) : longitude;

  const submitNomination = async () => {
    const name = nominateName.trim() || venueName || 'Onerilen mekan';
    setNominating(true);
    try {
      await nominateVenuePlace({
        source: 'map_long_press',
        name,
        lat: Number.isFinite(latNum) ? latNum : undefined,
        lng: Number.isFinite(lngNum) ? lngNum : undefined,
      });
      setNominateOpen(false);
      setNominateName('');
      Alert.alert('Tesekkurler', 'Mekan onerin havuza dustu');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Oneri gonderilemedi');
    } finally {
      setNominating(false);
    }
  };

  const openNominate = () => {
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        'Mekan öner',
        'Mekan adini yaz',
        [
          { text: 'Iptal', style: 'cancel' },
          {
            text: 'Gonder',
            onPress: async (text) => {
              try {
                await nominateVenuePlace({
                  source: 'map_long_press',
                  name: (text || '').trim() || venueName || 'Onerilen mekan',
                  lat: Number.isFinite(latNum) ? latNum : undefined,
                  lng: Number.isFinite(lngNum) ? lngNum : undefined,
                });
                Alert.alert('Tesekkurler', 'Mekan onerin havuza dustu');
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Oneri gonderilemedi');
              }
            },
          },
        ],
        'plain-text',
        venueName || ''
      );
      return;
    }
    setNominateName(venueName || '');
    setNominateOpen(true);
  };

  const pinClusters = useMemo(() => {
    const src = Array.isArray(rituals) && rituals.length > 0
      ? rituals.slice(0, 9).map((r, idx) => ({
          id: String(r.id || `ritual-${idx}`),
          title: r.title || 'Ritual',
          time_label: r.time_label || r.time || 'Yakinda',
          status: r.status === 'live' ? 'live' : (idx % 3 === 0 ? 'live' : idx % 3 === 1 ? 'soon' : 'venue'),
          area: r.area || (idx % 3 === 0 ? 'Centro' : idx % 3 === 1 ? 'Brera' : 'Isola'),
        }))
      : [
          { id: 'demo-live-1', title: 'Sabah Kahve Cemberi', time_label: 'Canli simdi', status: 'live', area: 'Centro' },
          { id: 'demo-live-2', title: 'Acik Mikrofon Oglen', time_label: '20d sonra', status: 'soon', area: 'Centro' },
          { id: 'demo-live-3', title: 'Galeri Yuruyusu', time_label: 'Bu aksam 19:30', status: 'venue', area: 'Centro' },
          { id: 'demo-soon-1', title: 'Kampus Yuruyusu', time_label: '25d sonra', status: 'soon', area: 'Brera' },
          { id: 'demo-soon-2', title: 'Foto Avi', time_label: 'Bu aksam 18:00', status: 'venue', area: 'Brera' },
          { id: 'demo-soon-3', title: 'Munazara Cemberi', time_label: 'Yarin 10:00', status: 'live', area: 'Brera' },
          { id: 'demo-venue-1', title: 'Kitap Kulubu Saati', time_label: 'Bu aksam 19:00', status: 'venue', area: 'Isola' },
          { id: 'demo-venue-2', title: 'Kosu ve Sohbet', time_label: '35d sonra', status: 'soon', area: 'Isola' },
          { id: 'demo-venue-3', title: 'Gec Jazz', time_label: 'Canli simdi', status: 'live', area: 'Isola' },
        ];

    return {
      live: { label: 'Centro', rows: src.filter((x) => x.area === 'Centro').slice(0, 3) },
      soon: { label: 'Brera', rows: src.filter((x) => x.area === 'Brera').slice(0, 3) },
      venue: { label: 'Isola', rows: src.filter((x) => x.area === 'Isola').slice(0, 3) },
    };
  }, [rituals]);

  const ritualRows = activePin ? pinClusters?.[activePin]?.rows || [] : [];

  const mapsUrl = useMemo(
    () =>
      buildMapsUrl({
        venueName,
        venueAddress,
        latitude: typeof latitude === 'string' ? Number(latitude) : latitude,
        longitude: typeof longitude === 'string' ? Number(longitude) : longitude,
      }),
    [venueName, venueAddress, latitude, longitude]
  );

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#030712' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
          <MaterialIcons name="chevron-left" size={24} color={isDark ? '#f8fafc' : COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && { color: '#f8fafc' }]}>
          {isVerifiedVenuesFlow ? 'Doğrulanmış Mekanlar Haritası' : 'Harita'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, isDark && { backgroundColor: '#0f172a', borderColor: '#1e293b' }]}>
          <Text style={[styles.eyebrow, isDark && { color: '#94a3b8' }]}>MEKAN</Text>
          <Text style={[styles.title, isDark && { color: '#f8fafc' }]} numberOfLines={2}>
            {venueName || 'Mekan'}
          </Text>
          <Text style={[styles.address, isDark && { color: '#cbd5e1' }]}>{venueAddress || 'Adres bilgisi yok'}</Text>

          <TouchableOpacity
            style={[styles.mapPreview, isDark && { backgroundColor: '#111827', borderColor: '#1e293b' }]}
            activeOpacity={0.85}
            onPress={async () => {
              if (!mapsUrl) return;
              await Linking.openURL(mapsUrl);
            }}
          >
            <View style={styles.previewLeft}>
              <MaterialIcons name="map" size={20} color={COLORS.muted} />
              <Text style={[styles.previewText, isDark && { color: '#f8fafc' }]}>Haritada Ac</Text>
            </View>
            <View style={styles.pin}>
              <MaterialIcons name="place" size={16} color="#ef4444" />
            </View>
          </TouchableOpacity>

          {/* CR-03/CR-06 map grid + colored pins */}
          <Pressable
            style={[styles.fakeMap, isDark && { backgroundColor: '#0b1220', borderColor: '#1e293b' }]}
            onLongPress={openNominate}
          >
            <View style={[styles.streetLine, { top: 26 }]} />
            <View style={[styles.streetLine, { top: 62 }]} />
            <View style={[styles.streetLine, { top: 98 }]} />
            <View style={[styles.streetVertical, { left: 72 }]} />
            <View style={[styles.streetVertical, { left: 150 }]} />
            <TouchableOpacity
              style={[styles.pinMap, styles.pinLive]}
              onPress={() => {
                setActivePin('live');
                setSheetOpen(true);
              }}
            />
            <TouchableOpacity
              style={[styles.pinMap, styles.pinSoon]}
              onPress={() => {
                setActivePin('soon');
                setSheetOpen(true);
              }}
            />
            <TouchableOpacity
              style={[styles.pinMap, styles.pinVenue]}
              onPress={() => {
                setActivePin('venue');
                setSheetOpen(true);
              }}
            />
            <Text style={[styles.mapHint, isDark && { color: '#cbd5e1' }]}>Kirmizi: canli · Sari: baslamak uzere · Altin: mekan</Text>
          </Pressable>

          <TouchableOpacity
            style={[styles.nominateBtn, isDark && { backgroundColor: '#111827', borderColor: '#1e293b' }]}
            onPress={openNominate}
          >
            <Text style={[styles.nominateBtnText, isDark && { color: '#f8fafc' }]}>Mekan öner</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.sheetToggle, isDark && { backgroundColor: '#111827', borderColor: '#1e293b' }]} onPress={() => setSheetOpen((v) => !v)}>
            <Text style={[styles.sheetToggleText, isDark && { color: '#f8fafc' }]}>{sheetOpen ? 'Yakindaki Ritualsi gizle' : 'Yakindaki Ritualsi goster'}</Text>
            <MaterialIcons name={sheetOpen ? 'expand-more' : 'expand-less'} size={18} color={isDark ? '#f8fafc' : COLORS.text} />
          </TouchableOpacity>

          {sheetOpen && (
            <View
              style={[styles.bottomSheet, isDark && { backgroundColor: '#111827', borderColor: '#1e293b' }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                dragStartY.current = e.nativeEvent.pageY;
              }}
              onResponderRelease={(e) => {
                const delta = e.nativeEvent.pageY - dragStartY.current;
                if (delta > 40) setSheetOpen(false);
              }}
            >
              <View style={styles.dragHandle} />
              <Text style={[styles.sheetTitle, isDark && { color: '#cbd5e1' }]}>
                {activePin ? `${pinClusters?.[activePin]?.label || 'Bolge'} · Yakindaki Rituals` : 'Yakindaki Rituals'}
              </Text>
              <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled>
                {ritualRows.map((r) => (
                  <TouchableOpacity
                    key={String(r.id)}
                    style={[styles.sheetRow, isDark && { borderBottomColor: '#1f2937' }]}
                    onPress={() => {
                      if (String(r.id || '').startsWith('demo-')) {
                        navigation.navigate(isDark ? 'CityRhythmDark' : 'CityRhythm');
                        return;
                      }
                      navigation.navigate('RitualDetail', { ritualId: r.id });
                    }}
                  >
                    <View
                      style={[
                        styles.sheetStatusDot,
                        r.status === 'live' && styles.pinLive,
                        r.status === 'soon' && styles.pinSoon,
                        r.status === 'venue' && styles.pinVenue,
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetRowTitle, isDark && { color: '#f8fafc' }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={[styles.sheetRowMeta, isDark && { color: '#9ca3af' }]}>{r.time_label || 'Yakinda'} · {r.area || 'Bolge'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      <Modal visible={nominateOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mekan öner</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Mekan adi"
              value={nominateName}
              onChangeText={setNominateName}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalSecondary} onPress={() => setNominateOpen(false)}>
                <Text style={styles.modalSecondaryText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={submitNomination} disabled={nominating}>
                <Text style={styles.modalPrimaryText}>{nominating ? '…' : 'Gonder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fakeMap: {
    marginTop: 12,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: '#eef2f7',
    position: 'relative',
    overflow: 'hidden',
  },
  streetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#dbe3ec',
  },
  streetVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#dbe3ec',
  },
  pinMap: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinLive: { backgroundColor: '#ef4444', top: 30, left: 58 },
  pinSoon: { backgroundColor: '#f59e0b', top: 76, left: 132 },
  pinVenue: { backgroundColor: '#c59d5f', top: 54, left: 210 },
  mapHint: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
  },
  sheetToggle: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  sheetToggleText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  bottomSheet: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sheetRowTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sheetRowMeta: { marginTop: 2, fontSize: 11, color: '#6b7280' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  content: { padding: 16 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
  address: { fontSize: 13, fontWeight: '600', color: COLORS.muted, lineHeight: 18, marginBottom: 14 },
  mapPreview: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  previewLeft: { flexDirection: 'row', alignItems: 'center' },
  previewText: { marginLeft: 8, fontSize: 12, fontWeight: '900', color: COLORS.text },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  nominateBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  nominateBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalSecondary: { paddingVertical: 10, paddingHorizontal: 14 },
  modalSecondaryText: { color: COLORS.muted, fontWeight: '600' },
  modalPrimary: {
    backgroundColor: '#f9a13d',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalPrimaryText: { color: '#fff', fontWeight: '700' },
});

