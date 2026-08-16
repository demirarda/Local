/**
 * TOTEM YÖNETİCİSİ — sonMD portal seti (§2Ağu-2)
 * Launch kuralı 🔒: mekan başına min 1 totem (kasa/giriş).
 * Hepsi aynı buradasın-modunu açar; köşe-adlandırma yalnız odalı mekanda (multi_room_flag).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createVenuePortal,
  deleteVenuePortal,
  fetchVenuePortals,
  getVenue,
} from '../services/api';
import { buildPortalDeepLink, buildPortalWebLink } from '../utils/portalDeepLink';

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';

/** Launch seti — ilk totem her zaman kasa/giriş olur */
const PRESETS = [
  { id: 'kasa', label: 'Kasa' },
  { id: 'giris', label: 'Giriş' },
  { id: 'bar', label: 'Bar' },
  { id: 'teras', label: 'Teras' },
  { id: 'dj-onu', label: 'DJ önü' },
];

function slugifyPortalId(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function VenuePortalsScreen({ route, navigation }) {
  const { venueId } = route.params || {};
  const [venue, setVenue] = useState(null);
  const [portals, setPortals] = useState([]);
  const [multiRoom, setMultiRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portalIdInput, setPortalIdInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [canAddTableTotem, setCanAddTableTotem] = useState(true);

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const [venueData, portalData] = await Promise.all([
        getVenue(venueId).catch(() => null),
        fetchVenuePortals(venueId),
      ]);
      setVenue(venueData);
      setPortals(portalData.portals || []);
      setMultiRoom(Boolean(portalData.multi_room_flag));
      setCanAddTableTotem(portalData.can_add_table_totem !== false);
    } catch (e) {
      Alert.alert('Totemler', e?.message || 'Totem seti yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const usedIds = useMemo(
    () => new Set(portals.map((p) => String(p.portal_id))),
    [portals]
  );
  const hasMandatoryTotem = portals.length > 0;

  const submitPortal = async (rawId, rawLabel) => {
    const portalId = slugifyPortalId(rawId);
    if (!portalId) {
      Alert.alert('Totem', 'Totem kimliği gerekli (örn: kasa).');
      return;
    }
    if (portals.length >= 1 && !canAddTableTotem) {
      Alert.alert('Masa totemi', 'Masa totemleri Operatör+ veya event-set gerektirir.');
      return;
    }
    setSaving(true);
    try {
      await createVenuePortal(venueId, {
        portalId,
        label: multiRoom && rawLabel ? String(rawLabel).trim().slice(0, 80) : null,
      });
      setPortalIdInput('');
      setLabelInput('');
      await load();
    } catch (e) {
      Alert.alert('Totem', e?.message || 'Totem oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const removePortal = (portal) => {
    if (portals.length <= 1) {
      Alert.alert('Silinemez', 'Mekan başına en az 1 totem zorunlu (kasa/giriş).');
      return;
    }
    Alert.alert('Totemi sil', `${portal.portal_id} silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVenuePortal(venueId, portal.portal_id);
            await load();
          } catch (e) {
            Alert.alert('Totem', e?.message || 'Totem silinemedi');
          }
        },
      },
    ]);
  };

  const sharePortal = async (portal) => {
    const web = buildPortalWebLink(venueId, portal.portal_id);
    const app = buildPortalDeepLink(venueId, portal.portal_id);
    try {
      await Share.share({
        message: `${venue?.name || 'Mekan'} · ${portal.label || portal.portal_id}\nQR: ${web}\nNFC: ${app}`,
      });
    } catch (_e) {
      // paylaşım iptali sessiz
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
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          colors={[PRIMARY]}
        />
      }
    >
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Mekan yönetimi</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{venue?.name || 'Mekan'} · Totem seti</Text>
      <Text style={styles.subtitle}>
        Hepsi aynı buradasın-modunu açar (kuyruk-önleme). Sözü olan kapı ekranına düşer,
        app'siz okuyan web-vitrine.
      </Text>

      {!hasMandatoryTotem ? (
        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>Zorunlu totem eksik</Text>
          <Text style={styles.warnBody}>
            Launch kuralı: mekan başına en az 1 totem (kasa/giriş). Tek dokunuşla kur.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => submitPortal('kasa', 'Kasa')}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Kuruluyor…' : 'Kasa totemini kur'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Kurulu totemler ({portals.length})</Text>
      {portals.map((portal) => (
        <View key={portal.id || portal.portal_id} style={styles.portalCard}>
          <View style={styles.portalHead}>
            <Text style={styles.portalId}>{portal.portal_id}</Text>
            {portal.label ? <Text style={styles.portalLabel}>{portal.label}</Text> : null}
          </View>
          <Text style={styles.linkLabel}>QR içeriği</Text>
          <Text style={styles.linkValue} selectable>
            {buildPortalWebLink(venueId, portal.portal_id)}
          </Text>
          <Text style={styles.linkLabel}>NFC / derin-link</Text>
          <Text style={styles.linkValue} selectable>
            {buildPortalDeepLink(venueId, portal.portal_id)}
          </Text>
          <View style={styles.portalActions}>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => sharePortal(portal)}>
              <Text style={styles.ghostBtnText}>Baskıya gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, portals.length <= 1 && styles.ghostBtnDisabled]}
              onPress={() => removePortal(portal)}
              disabled={portals.length <= 1}
            >
              <Text style={styles.ghostBtnDanger}>Sil</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Yeni totem</Text>
      {portals.length >= 1 && !canAddTableTotem ? (
        <Text style={styles.hint}>
          Masa totemleri Operatör+ veya event-set ile açılır. İlk kasa/giriş zaten var.
        </Text>
      ) : null}
      <View style={styles.presetRow}>
        {PRESETS.filter((p) => !usedIds.has(p.id)).map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.presetChip,
              portals.length >= 1 && !canAddTableTotem && styles.ghostBtnDisabled,
            ]}
            onPress={() => submitPortal(preset.id, preset.label)}
            disabled={saving || (portals.length >= 1 && !canAddTableTotem)}
          >
            <Text style={styles.presetChipText}>+ {preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Totem kimliği (örn: kasa-2)"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        value={portalIdInput}
        onChangeText={setPortalIdInput}
      />
      {multiRoom ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Köşe adı (örn: DJ önü)"
            placeholderTextColor="#9ca3af"
            value={labelInput}
            onChangeText={setLabelInput}
          />
          <Text style={styles.hint}>
            Köşe adı ritüel kartına yumuşak konum yazar (odalı mekan aracı).
          </Text>
        </>
      ) : (
        <Text style={styles.hint}>
          Köşe adlandırma kapalı — yalnız odalı mekan/kulüp tipinde panelden açılır.
        </Text>
      )}
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (saving || (portals.length >= 1 && !canAddTableTotem)) && styles.primaryBtnDisabled,
        ]}
        onPress={() => submitPortal(portalIdInput, labelInput)}
        disabled={saving || (portals.length >= 1 && !canAddTableTotem)}
      >
        <Text style={styles.primaryBtnText}>{saving ? 'Kaydediliyor…' : 'Totem ekle'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkBack}
        onPress={() => navigation.navigate('VenueFloorPlan', { venueId })}
      >
        <Text style={styles.linkBackText}>Kat planı & GPS →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 48 },
  back: { marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: '600', color: MUTED },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 18 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 10,
  },
  warnCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  warnTitle: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  warnBody: { fontSize: 12, color: '#9a3412', marginTop: 4, lineHeight: 18 },
  portalCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  portalHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  portalId: { fontSize: 15, fontWeight: '700', color: '#111' },
  portalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f766e',
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  linkLabel: { fontSize: 11, fontWeight: '700', color: MUTED, marginTop: 6 },
  linkValue: { fontSize: 12, color: '#111', marginTop: 2 },
  portalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ghostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  ghostBtnDisabled: { opacity: 0.4 },
  ghostBtnText: { fontSize: 12, fontWeight: '700', color: '#111' },
  ghostBtnDanger: { fontSize: 12, fontWeight: '700', color: '#b91c1c' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  presetChipText: { fontSize: 12, fontWeight: '600', color: MUTED },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    marginBottom: 8,
  },
  hint: { fontSize: 11, color: MUTED, marginBottom: 10, lineHeight: 16 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  linkBack: { marginTop: 20, alignSelf: 'flex-start' },
  linkBackText: { color: PRIMARY, fontWeight: '700' },
});
