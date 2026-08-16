import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import {
  fetchVenueFloorPlan,
  updateVenueFloorPlan,
  verifyVenueGps,
  patchVenue,
} from '../services/api';

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';

export default function VenueFloorPlanScreen({ route }) {
  const { venueId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [zones, setZones] = useState([]);
  const [tables, setTables] = useState([]);
  const [showTables, setShowTables] = useState(false);
  const [notes, setNotes] = useState('');
  const [gpsVerifiedAt, setGpsVerifiedAt] = useState(null);
  const [denseCanyon, setDenseCanyon] = useState(false);
  const [gpsRadiusM, setGpsRadiusM] = useState('');

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const data = await fetchVenueFloorPlan(venueId);
      setCanManage(!!data.can_manage);
      const plan = data.floor_plan || {};
      const loadedZones = Array.isArray(plan.zones) && plan.zones.length
        ? plan.zones
        : [{ id: 'zone-1', name: 'Ana alan', capacity: 20 }];
      setZones(loadedZones);
      setTables(Array.isArray(plan.tables) ? plan.tables : []);
      setShowTables(Boolean(plan.tables?.length));
      setNotes(plan.notes || '');
      setGpsVerifiedAt(data.gps_verified_at || null);
      setDenseCanyon(Boolean(data.dense_canyon));
      setGpsRadiusM(data.gps_radius_m != null ? String(data.gps_radius_m) : '');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kat plani yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const addZone = () => {
    const n = zones.length + 1;
    setZones([...zones, { id: `zone-${n}`, name: `Zon ${n}`, capacity: 10 }]);
  };

  const updateZone = (idx, field, value) => {
    const next = [...zones];
    next[idx] = { ...next[idx], [field]: value };
    setZones(next);
  };

  const addTable = () => {
    const n = tables.length + 1;
    setTables([...tables, { id: `table-${n}`, label: `Masa ${n}`, seats: 4 }]);
  };

  const updateTable = (idx, field, value) => {
    const next = [...tables];
    next[idx] = { ...next[idx], [field]: value };
    setTables(next);
  };

  const savePlan = async () => {
    if (!zones.length || zones.some((z) => !String(z.name || '').trim())) {
      Alert.alert('Eksik', 'En az bir zon adi gerekli');
      return;
    }
    setSaving(true);
    try {
      await updateVenueFloorPlan(venueId, {
        floor_plan: {
          zones: zones.map((z) => ({
            ...z,
            name: String(z.name || '').trim(),
            capacity: Number(z.capacity) || 0,
          })),
          tables: tables.map((t) => ({
            ...t,
            seats: Number(t.seats) || 4,
          })),
          notes,
        },
      });
      Alert.alert('Tamam', 'Kat plani kaydedildi');
      load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kayit basarisiz');
    } finally {
      setSaving(false);
    }
  };

  const verifyGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum', 'GPS dogrulamasi icin konum izni gerekli');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const result = await verifyVenueGps(venueId, {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      setGpsVerifiedAt(result.gps_verified_at);
      Alert.alert('Tamam', `GPS dogrulandi (${result.distance_m}m)`);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'GPS dogrulama basarisiz');
    } finally {
      setGpsLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={styles.title}>Kat Plani & GPS</Text>
      <Text style={styles.muted}>
        Zorunlu: zon adi + kapasite. Masa grid opsiyonel.
      </Text>
      <Text style={styles.muted}>
        GPS: {gpsVerifiedAt ? `Dogrulandi (${new Date(gpsVerifiedAt).toLocaleDateString('tr-TR')})` : 'Bekliyor'}
      </Text>

      <Text style={styles.sectionTitle}>Zonlar</Text>
      {zones.map((z, idx) => (
        <View key={z.id || idx} style={styles.tableRow}>
          <TextInput
            style={styles.input}
            value={z.name}
            editable={canManage}
            onChangeText={(v) => updateZone(idx, 'name', v)}
            placeholder="Zon adi"
          />
          <TextInput
            style={[styles.input, styles.seatsInput]}
            value={String(z.capacity ?? '')}
            editable={canManage}
            keyboardType="number-pad"
            onChangeText={(v) => updateZone(idx, 'capacity', v)}
            placeholder="Kapasite"
          />
        </View>
      ))}

      {canManage ? (
        <TouchableOpacity style={styles.secondaryBtn} onPress={addZone}>
          <Text style={styles.secondaryBtnText}>+ Zon ekle</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.collapseBtn} onPress={() => setShowTables((v) => !v)}>
        <Text style={styles.collapseBtnText}>
          {showTables ? '▾ Masa grid (opsiyonel)' : '▸ Masa grid (opsiyonel)'}
        </Text>
      </TouchableOpacity>

      {showTables ? (
        <>
          {tables.map((t, idx) => (
            <View key={t.id || idx} style={styles.tableRow}>
              <TextInput
                style={styles.input}
                value={t.label}
                editable={canManage}
                onChangeText={(v) => updateTable(idx, 'label', v)}
                placeholder="Masa adi"
              />
              <TextInput
                style={[styles.input, styles.seatsInput]}
                value={String(t.seats)}
                editable={canManage}
                keyboardType="number-pad"
                onChangeText={(v) => updateTable(idx, 'seats', v)}
                placeholder="Koltuk"
              />
            </View>
          ))}
          {canManage ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={addTable}>
              <Text style={styles.secondaryBtnText}>+ Masa ekle</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {canManage && (
        <>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notlar (opsiyonel)"
            multiline
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={savePlan} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Kat planini kaydet</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.gpsBtn} onPress={verifyGps} disabled={gpsLoading}>
            {gpsLoading ? (
              <ActivityIndicator color={PRIMARY} />
            ) : (
              <Text style={styles.gpsBtnText}>GPS ile dogrula (kapı önü pin)</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={async () => {
              try {
                const next = !denseCanyon;
                await patchVenue(venueId, { dense_canyon: next });
                setDenseCanyon(next);
                Alert.alert(
                  'Beton kanyon',
                  next
                    ? 'Yoğun-mekan yarıçapı açıldı (venue_dense yıldızı).'
                    : 'Yoğun-mekan yarıçapı kapatıldı.'
                );
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Kayıt başarısız');
              }
            }}
          >
            <Text style={styles.gpsBtnText}>
              {denseCanyon ? 'Beton kanyon AÇIK (75m yıldız)' : 'Beton kanyon kapalı — aç'}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={gpsRadiusM}
            onChangeText={setGpsRadiusM}
            placeholder="GPS yarıçap override (m) — boş = varsayılan"
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => {
              try {
                const n = gpsRadiusM.trim() === '' ? null : Number(gpsRadiusM);
                await patchVenue(venueId, { gps_radius_m: n });
                Alert.alert('Tamam', n == null ? 'Override silindi' : `Yarıçap ${n}m`);
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Yarıçap kaydedilemedi');
              }
            }}
          >
            <Text style={styles.secondaryBtnText}>Yarıçap yıldızını kaydet</Text>
          </TouchableOpacity>
        </>
      )}

      {!canManage && zones.length === 0 && (
        <Text style={styles.muted}>Kat plani henuz tanimlanmamis.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafaf8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  muted: { color: MUTED, marginBottom: 12 },
  tableRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  seatsInput: { flex: 0.35 },
  notes: { minHeight: 72, marginTop: 8, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: PRIMARY,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryBtnText: { color: '#333', fontWeight: '500' },
  collapseBtn: { marginVertical: 8, paddingVertical: 8 },
  collapseBtnText: { color: MUTED, fontWeight: '600', fontSize: 14 },
  gpsBtn: {
    borderWidth: 1,
    borderColor: PRIMARY,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  gpsBtnText: { color: PRIMARY, fontWeight: '600' },
});
