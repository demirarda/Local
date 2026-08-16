import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import {
  fetchVenueSlots,
  fetchVenueSlotConfig,
  createVenueSlot,
  claimVenueSlot,
  fetchVenueSuggestionInbox,
  fetchVenueSuggestionHistory,
  submitVenueSlotSuggestion,
  approveVenueSlotSuggestion,
  rejectVenueSlotSuggestion,
  getVenue,
  setVenueSlotBrandPriority,
} from '../services/api';

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';
const GREEN = '#2d8a4e';
const RED = '#c44';

const TIME_MODE_LABELS = {
  fixed: 'Sabit',
  loose: 'Esnek',
  recurring: 'Seri',
  instant: 'Anlik',
};

const STATUS_LABELS = {
  pending: 'Bekliyor',
  approved: 'Onaylandi',
  rejected: 'Reddedildi',
};

function FlowBanner() {
  return (
    <View style={styles.flowBanner}>
      <Text style={styles.flowTitle}>Bilateral slot akisi</Text>
      <Text style={styles.flowLine}>Yon A: Mekan slot acar → kullanici kapar</Text>
      <Text style={styles.flowLine}>Yon B: Kullanici oneri gonderir → oneri kutusu → onay/red → slot dogar</Text>
    </View>
  );
}

const VISIBILITY_LABELS = {
  public: 'Public',
  venue_only: 'Venue Only',
  regular_only: 'Regular Only',
  hidden: 'Hidden',
};

const LEVEL_LABELS = { novice: 'Novice', regular: 'Regular', master: 'Master' };

export default function VenueSlotsScreen({ route }) {
  const { venueId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [slots, setSlots] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('slots');
  const [slotConfig, setSlotConfig] = useState(null);

  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [locationLabel, setLocationLabel] = useState('');
  const [timeMode, setTimeMode] = useState('fixed');
  const [visibility, setVisibility] = useState('public');
  const [claimFee, setClaimFee] = useState('0');
  const [requiredBadgeSlug, setRequiredBadgeSlug] = useState('');
  const [minBadgeLevel, setMinBadgeLevel] = useState('novice');
  const [audienceTag, setAudienceTag] = useState('');
  const [brandPriority, setBrandPriority] = useState(false);
  const [isHakim, setIsHakim] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestNote, setSuggestNote] = useState('');
  const [suggestLocation, setSuggestLocation] = useState('');
  const [suggestCapacity, setSuggestCapacity] = useState('10');
  const [suggestTimeMode, setSuggestTimeMode] = useState('loose');

  const [rejectModal, setRejectModal] = useState({ visible: false, id: null, note: '' });
  const [approveModal, setApproveModal] = useState({ visible: false, id: null, note: '' });

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const [venue, slotList, config] = await Promise.all([
        getVenue(venueId),
        fetchVenueSlots(venueId, { status: 'open' }),
        fetchVenueSlotConfig(venueId).catch(() => null),
      ]);
      const manage = Boolean(venue?.can_manage || venue?.profile?.can_manage);
      setCanManage(manage);
      const tier = String(venue?.subscription_tier || '').toLowerCase();
      setIsHakim(tier === 'hakim' || Boolean(venue?.city_partner_enabled));
      setSlots(slotList || []);
      setSlotConfig(config);
      if (config?.max_table_seats) {
        setCapacity(String(Math.min(Number(capacity) || 10, config.max_table_seats)));
      }
      if (manage) {
        const [pending, hist] = await Promise.all([
          fetchVenueSuggestionInbox(venueId),
          fetchVenueSuggestionHistory(venueId),
        ]);
        setInbox(pending?.suggestions || (Array.isArray(pending) ? pending : []) || []);
        setHistory(hist || []);
      } else {
        setInbox([]);
        setHistory([]);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Slotlar yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCreateSlot = async () => {
    if (!title.trim()) {
      Alert.alert('Eksik', 'Slot basligi gerekli');
      return;
    }
    setSaving(true);
    try {
      await createVenueSlot(venueId, {
        title: title.trim(),
        capacity: Number(capacity) || 10,
        location_label: locationLabel.trim() || undefined,
        time_mode: timeMode,
        visibility,
        required_badge_slug: requiredBadgeSlug || undefined,
        min_badge_level: requiredBadgeSlug ? minBadgeLevel : undefined,
        audience_tag: audienceTag || undefined,
        brand_priority: isHakim ? brandPriority : undefined,
        economy_stub: slotConfig?.economy_enabled
          ? { claim_fee_cents: Math.round(Number(claimFee || 0) * 100) }
          : undefined,
      });
      setTitle('');
      setLocationLabel('');
      setRequiredBadgeSlug('');
      setMinBadgeLevel('novice');
      setAudienceTag('');
      setBrandPriority(false);
      Alert.alert('Tamam', 'Slot acildi');
      await load();
      setTab('slots');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Slot olusturulamadi');
    } finally {
      setSaving(false);
    }
  };

  const handleClaim = async (slotId) => {
    try {
      await claimVenueSlot(venueId, slotId);
      Alert.alert('Tamam', 'Slotu kapattin — Ritual olusturma adimina gec');
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Slot kapatilamadi');
    }
  };

  const handleSuggest = async () => {
    if (!suggestTitle.trim()) {
      Alert.alert('Eksik', 'Oneri basligi gerekli');
      return;
    }
    setSaving(true);
    try {
      await submitVenueSlotSuggestion(venueId, {
        title: suggestTitle.trim(),
        description: suggestNote.trim() || undefined,
        location_label: suggestLocation.trim() || undefined,
        proposed_capacity: Number(suggestCapacity) || undefined,
        time_mode: suggestTimeMode,
      });
      setSuggestTitle('');
      setSuggestNote('');
      setSuggestLocation('');
      Alert.alert('Tamam', 'Onerin mekanin oneri kutusuna dusdu');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Oneri gonderilemedi');
    } finally {
      setSaving(false);
    }
  };

  const confirmApprove = async () => {
    const { id, note } = approveModal;
    setApproveModal({ visible: false, id: null, note: '' });
    try {
      await approveVenueSlotSuggestion(venueId, id, note.trim());
      Alert.alert('Tamam', 'Oneri onaylandi, slot olusturuldu');
      await load();
      setTab('slots');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Onay basarisiz');
    }
  };

  const confirmReject = async () => {
    const { id, note } = rejectModal;
    setRejectModal({ visible: false, id: null, note: '' });
    try {
      await rejectVenueSlotSuggestion(venueId, id, note.trim());
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Red basarisiz');
    }
  };

  const renderSuggestionCard = (sug, { showActions = false } = {}) => (
    <View key={sug.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{sug.title}</Text>
        {sug.status ? (
          <Text style={[styles.statusPill, sug.status === 'approved' && styles.statusOk, sug.status === 'rejected' && styles.statusBad]}>
            {STATUS_LABELS[sug.status] || sug.status}
          </Text>
        ) : (
          <Text style={styles.statusPill}>Yeni</Text>
        )}
      </View>
      <Text style={styles.cardMeta}>{sug.user_name || 'Kullanici'}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.chipSmall}>{TIME_MODE_LABELS[sug.time_mode] || sug.time_mode || '—'}</Text>
        {sug.location_label ? <Text style={styles.chipSmall}>{sug.location_label}</Text> : null}
        {sug.proposed_capacity ? <Text style={styles.chipSmall}>Kapasite {sug.proposed_capacity}</Text> : null}
      </View>
      {sug.proposed_starts_at ? (
        <Text style={styles.cardMeta}>Onerilen zaman: {new Date(sug.proposed_starts_at).toLocaleString('tr-TR')}</Text>
      ) : null}
      {sug.description ? <Text style={styles.body}>{sug.description}</Text> : null}
      {sug.reviewer_note ? (
        <Text style={styles.reviewerNote}>Mekan notu: {sug.reviewer_note}</Text>
      ) : null}
      {showActions ? (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setApproveModal({ visible: true, id: sug.id, note: '' })}
          >
            <Text style={styles.primaryBtnText}>Onayla → Slot</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setRejectModal({ visible: true, id: sug.id, note: '' })}
          >
            <Text style={styles.secondaryBtnText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const managerTabs = ['slots', 'inbox', 'history', 'create'];

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />}
      >
        <Text style={styles.heading}>Slot & Oneri Kutusu</Text>
        <FlowBanner />

        {canManage ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            <View style={styles.tabs}>
              {managerTabs.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.tab, tab === key && styles.tabOn]}
                  onPress={() => setTab(key)}
                >
                  <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>
                    {key === 'slots' && 'Acik Slotlar'}
                    {key === 'inbox' && `Oneri (${inbox.length})`}
                    {key === 'history' && 'Gecmis'}
                    {key === 'create' && 'Yeni Slot'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {(tab === 'slots' || !canManage) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Acik Slotlar (Yon A)</Text>
            {slots.length === 0 ? (
              <Text style={styles.muted}>Henuz acik slot yok</Text>
            ) : (
              slots.map((slot) => (
                <View key={slot.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{slot.title}</Text>
                  <Text style={styles.cardMeta}>
                    {TIME_MODE_LABELS[slot.time_mode] || slot.time_mode}
                    {slot.location_label ? ` · ${slot.location_label}` : ''}
                    {` · kapasite ${slot.capacity}`}
                    {slot.audience_tag === 'UNI_FRIENDLY' ? ' · 🎓' : ''}
                    {slot.audience_tag === 'INTERNATIONAL' ? ' · 🌍' : ''}
                    {slot.brand_priority ? ' · brand' : ''}
                  </Text>
                  {slot.required_badge_slug ? (
                    <Text style={styles.badgeReq}>
                      Rozet: {slot.required_badge_slug} ({LEVEL_LABELS[slot.min_badge_level] || slot.min_badge_level || 'Novice'}+)
                    </Text>
                  ) : null}
                  {canManage && isHakim ? (
                    <TouchableOpacity
                      style={[styles.secondaryBtn, slot.brand_priority && styles.secondaryBtnOn]}
                      onPress={async () => {
                        try {
                          await setVenueSlotBrandPriority(venueId, slot.id, !slot.brand_priority);
                          await load();
                        } catch (e) {
                          Alert.alert('Hata', e?.message || 'Brand öncelik güncellenemedi');
                        }
                      }}
                    >
                      <Text style={styles.secondaryBtnText}>
                        {slot.brand_priority ? 'Brand-slot açık' : 'Brand-slot önceliği'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {!canManage && slot.status === 'open' ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => handleClaim(slot.id)}>
                      <Text style={styles.primaryBtnText}>Slotu Kap → Ritual Olustur</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {canManage && tab === 'inbox' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Oneri Kutusu (Yon B)</Text>
            <Text style={styles.muted}>Kullanici onerilerini incele; onay = slot dogar, red = kullaniciya bildirim</Text>
            {inbox.length === 0 ? (
              <Text style={styles.muted}>Bekleyen oneri yok</Text>
            ) : (
              inbox.map((sug) => renderSuggestionCard(sug, { showActions: true }))
            )}
          </View>
        )}

        {canManage && tab === 'history' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Islem Gecmisi</Text>
            {history.length === 0 ? (
              <Text style={styles.muted}>Henuz islem yok</Text>
            ) : (
              history.map((sug) => renderSuggestionCard(sug))
            )}
          </View>
        )}

        {canManage && tab === 'create' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Yeni Slot Ac (Yon A)</Text>
            <TextInput style={styles.input} placeholder="Baslik" value={title} onChangeText={setTitle} />
            <TextInput
              style={styles.input}
              placeholder="Konum / zon etiketi"
              value={locationLabel}
              onChangeText={setLocationLabel}
            />
            <TextInput
              style={styles.input}
              placeholder="Kapasite"
              keyboardType="number-pad"
              value={capacity}
              onChangeText={setCapacity}
            />
            {slotConfig?.max_table_seats ? (
              <Text style={styles.muted}>
                {`Masa tavanı: ${slotConfig.max_table_seats} koltuk (floor plan)`}
              </Text>
            ) : null}
            <Text style={styles.fieldLabel}>Gorunurluk</Text>
            <View style={styles.chips}>
              {(slotConfig?.visibility_options || ['public', 'venue_only', 'regular_only', 'hidden']).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, visibility === key && styles.chipOn]}
                  onPress={() => setVisibility(key)}
                >
                  <Text style={[styles.chipText, visibility === key && styles.chipTextOn]}>
                    {VISIBILITY_LABELS[key] || key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {slotConfig?.economy_enabled ? (
              <TextInput
                style={styles.input}
                placeholder="Claim ucreti (EUR)"
                keyboardType="decimal-pad"
                value={claimFee}
                onChangeText={setClaimFee}
              />
            ) : null}
            <Text style={styles.fieldLabel}>Host rozet kosulu (opsiyonel)</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !requiredBadgeSlug && styles.chipOn]}
                onPress={() => setRequiredBadgeSlug('')}
              >
                <Text style={[styles.chipText, !requiredBadgeSlug && styles.chipTextOn]}>Yok</Text>
              </TouchableOpacity>
              {(slotConfig?.badge_catalog || []).slice(0, 12).map((b) => (
                <TouchableOpacity
                  key={b.slug}
                  style={[styles.chip, requiredBadgeSlug === b.slug && styles.chipOn]}
                  onPress={() => setRequiredBadgeSlug(b.slug)}
                >
                  <Text style={[styles.chipText, requiredBadgeSlug === b.slug && styles.chipTextOn]}>
                    {b.icon_emoji || '🏅'} {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {requiredBadgeSlug ? (
              <View style={styles.chips}>
                {(slotConfig?.badge_levels || ['novice', 'regular', 'master']).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.chip, minBadgeLevel === lvl && styles.chipOn]}
                    onPress={() => setMinBadgeLevel(lvl)}
                  >
                    <Text style={[styles.chipText, minBadgeLevel === lvl && styles.chipTextOn]}>
                      {LEVEL_LABELS[lvl] || lvl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Kitle etiketi (opsiyonel)</Text>
            <View style={styles.chips}>
              {[
                { key: '', label: 'Yok' },
                { key: 'UNI_FRIENDLY', label: '🎓 Uni-friendly' },
                { key: 'INTERNATIONAL', label: '🌍 International' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key || 'none'}
                  style={[styles.chip, audienceTag === opt.key && styles.chipOn]}
                  onPress={() => setAudienceTag(opt.key)}
                >
                  <Text style={[styles.chipText, audienceTag === opt.key && styles.chipTextOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {isHakim ? (
              <>
                <Text style={styles.fieldLabel}>Brand-slot önceliği (ticari kanal)</Text>
                <Text style={styles.muted}>Kullanıcı sıralamasına girmez · HAKİM</Text>
                <View style={styles.chips}>
                  <TouchableOpacity
                    style={[styles.chip, !brandPriority && styles.chipOn]}
                    onPress={() => setBrandPriority(false)}
                  >
                    <Text style={[styles.chipText, !brandPriority && styles.chipTextOn]}>Kapalı</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, brandPriority && styles.chipOn]}
                    onPress={() => setBrandPriority(true)}
                  >
                    <Text style={[styles.chipText, brandPriority && styles.chipTextOn]}>Açık</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
            <View style={styles.chips}>
              {Object.entries(TIME_MODE_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, timeMode === key && styles.chipOn]}
                  onPress={() => setTimeMode(key)}
                >
                  <Text style={[styles.chipText, timeMode === key && styles.chipTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateSlot} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Kaydediliyor…' : 'Slot Ac'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!canManage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Oneri Gonder (Yon B)</Text>
            <TextInput
              style={styles.input}
              placeholder="Oneri basligi (or. Cuma aksam jazz)"
              value={suggestTitle}
              onChangeText={setSuggestTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Masa / bolge etiketi"
              value={suggestLocation}
              onChangeText={setSuggestLocation}
            />
            <TextInput
              style={styles.input}
              placeholder="Onerilen kapasite"
              keyboardType="number-pad"
              value={suggestCapacity}
              onChangeText={setSuggestCapacity}
            />
            <View style={styles.chips}>
              {['loose', 'fixed', 'recurring'].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, suggestTimeMode === key && styles.chipOn]}
                  onPress={() => setSuggestTimeMode(key)}
                >
                  <Text style={[styles.chipText, suggestTimeMode === key && styles.chipTextOn]}>
                    {TIME_MODE_LABELS[key]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Not: ne tur bir Ritual dusunuyorsun?"
              multiline
              value={suggestNote}
              onChangeText={setSuggestNote}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSuggest} disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Gonderiliyor…' : 'Oneri Gonder'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={rejectModal.visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Oneriyi Reddet</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Kisa not (kullaniciya gider)"
              multiline
              value={rejectModal.note}
              onChangeText={(v) => setRejectModal((m) => ({ ...m, note: v }))}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setRejectModal({ visible: false, id: null, note: '' })}>
                <Text style={styles.secondaryBtnText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, styles.dangerBtn]} onPress={confirmReject}>
                <Text style={styles.primaryBtnText}>Reddet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={approveModal.visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Oneriyi Onayla</Text>
            <Text style={styles.muted}>Onay sonrasi otomatik acik slot olusur.</Text>
            <TextInput
              style={styles.input}
              placeholder="Opsiyonel not"
              value={approveModal.note}
              onChangeText={(v) => setApproveModal((m) => ({ ...m, note: v }))}
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setApproveModal({ visible: false, id: null, note: '' })}>
                <Text style={styles.secondaryBtnText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={confirmApprove}>
                <Text style={styles.primaryBtnText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  flowBanner: {
    backgroundColor: '#fff8ef',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0dfc8',
  },
  flowTitle: { fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  flowLine: { fontSize: 13, color: MUTED, marginBottom: 2 },
  tabsScroll: { marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabText: { fontSize: 12, fontWeight: '600', color: MUTED },
  tabTextOn: { color: '#fff' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, color: '#1a1a1a' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 4 },
  muted: { color: MUTED, fontSize: 14, marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  cardMeta: { fontSize: 13, color: MUTED, marginTop: 4 },
  badgeReq: { fontSize: 12, color: '#92400E', marginTop: 6, fontWeight: '600' },
  body: { fontSize: 14, color: '#333', marginTop: 8 },
  reviewerNote: { fontSize: 13, color: '#555', marginTop: 8, fontStyle: 'italic' },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY,
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusOk: { color: GREEN, backgroundColor: '#e8f5ec' },
  statusBad: { color: RED, backgroundColor: '#fdecea' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chipSmall: {
    fontSize: 11,
    color: MUTED,
    backgroundColor: '#f4f4f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 12, color: MUTED, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  dangerBtn: { backgroundColor: RED },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  secondaryBtnOn: {
    borderColor: PRIMARY,
    backgroundColor: '#fff7ed',
  },
  secondaryBtnText: { color: MUTED, fontWeight: '600', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
});
