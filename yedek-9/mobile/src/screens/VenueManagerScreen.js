import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import {
  getVenue,
  fetchVenueRituals,
  revealVenueRitualKeyword,
  fetchVenueRegulars,
  fetchVenueNightReport,
  fetchVenueMonthlyPulse,
  fetchVenueMarketShare,
  fetchVenueBadges,
  createVenueBadge,
  fetchVenueVenEventQuota,
  venueNoCapacityCancel,
  fetchClaimableRituals,
  claimVenueRitual,
  fetchVenueSuggestionInbox,
  requestVenueTotem,
} from '../services/api';
import VenueBusinessScreen from './VenueBusinessScreen';
import VenueSlotsScreen from './VenueSlotsScreen';

const TABS = [
  { id: 'today', label: 'Bugun' },
  { id: 'gece', label: 'GECE' },
  { id: 'slots', label: 'Slot & Takvim' },
  { id: 'regulars', label: 'Regular' },
  { id: 'reputation', label: 'Itibar' },
  { id: 'profile', label: 'Profil' },
  { id: 'business', label: 'Isletme' },
];

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';
const VENUE_BADGE_CONDITIONS = [
  { id: 'visit', label: 'Gelis' },
  { id: 'category', label: 'Kategori' },
  { id: 'slot', label: 'Slot' },
  { id: 'event', label: 'Etkinlik' },
];

export default function VenueManagerScreen({ route, navigation }) {
  const { venueId, initialTab = 'today' } = route.params || {};
  const [tab, setTab] = useState(initialTab);
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveRituals, setLiveRituals] = useState([]);
  const [claimable, setClaimable] = useState([]);
  const [actionRitualId, setActionRitualId] = useState(null);
  const [revealingId, setRevealingId] = useState(null);
  const [regulars, setRegulars] = useState([]);
  const [nightReport, setNightReport] = useState(null);
  const [nightLoading, setNightLoading] = useState(false);
  const [marketShare, setMarketShare] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [monthlyPulse, setMonthlyPulse] = useState(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [venueBadges, setVenueBadges] = useState([]);
  const [venueBadgeMax, setVenueBadgeMax] = useState(5);
  const [badgeName, setBadgeName] = useState('');
  const [badgeLogo, setBadgeLogo] = useState('');
  const [badgeCondition, setBadgeCondition] = useState('visit');
  const [badgeThreshold, setBadgeThreshold] = useState('1');
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [venEventQuota, setVenEventQuota] = useState(null);
  const [unansweredCount, setUnansweredCount] = useState(0);

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const data = await getVenue(venueId);
      setVenue(data);
      try {
        const list = await fetchVenueRituals(venueId, { limit: 40 });
        const now = Date.now();
        const actionable = (Array.isArray(list) ? list : []).filter((r) => {
          const st = String(r.status || '').toLowerCase();
          const start = r.start_time ? new Date(r.start_time).getTime() : 0;
          return (
            ['live', 'prelobby', 'active', 'window'].includes(st) ||
            (start && start <= now + 60 * 60000 && start >= now - 3 * 60 * 60000)
          );
        });
        setLiveRituals(actionable);
        try {
          const near = await fetchClaimableRituals(venueId, { limit: 12 });
          setClaimable(Array.isArray(near) ? near : []);
        } catch (_e) {
          setClaimable([]);
        }
      } catch (_e) {
        setLiveRituals([]);
        setClaimable([]);
      }
      try {
        const regs = await fetchVenueRegulars(venueId);
        setRegulars(Array.isArray(regs) ? regs : []);
      } catch (_e) {
        setRegulars([]);
      }
      try {
        const q = await fetchVenueVenEventQuota(venueId);
        setVenEventQuota(q || null);
      } catch (_e) {
        setVenEventQuota(null);
      }
      try {
        const inbox = await fetchVenueSuggestionInbox(venueId);
        setUnansweredCount(Number(inbox?.unanswered_count ?? 0));
      } catch (_e) {
        setUnansweredCount(0);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Mekan yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId]);

  const loadVenueBadges = useCallback(async () => {
    if (!venueId) return;
    try {
      const data = await fetchVenueBadges(venueId);
      setVenueBadges(Array.isArray(data?.badges) ? data.badges : []);
      setVenueBadgeMax(data?.max || 5);
    } catch (_e) {
      setVenueBadges([]);
    }
  }, [venueId]);

  const submitVenueBadge = async () => {
    if (!badgeName.trim() || !badgeLogo.trim()) {
      Alert.alert('Eksik', 'Etiket ve logo URL zorunlu (metin serbest yazılamaz)');
      return;
    }
    setBadgeSaving(true);
    try {
      await createVenueBadge(venueId, {
        name: badgeName.trim(),
        logo_url: badgeLogo.trim(),
        condition_type: badgeCondition,
        threshold: Number(badgeThreshold) || 1,
      });
      setBadgeName('');
      setBadgeLogo('');
      setBadgeThreshold('1');
      Alert.alert('Gonderildi', 'Admin onayina dustu · kalkan sablonu sabit');
      await loadVenueBadges();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Rozet olusturulamadi');
    } finally {
      setBadgeSaving(false);
    }
  };

  const loadNightReport = useCallback(async () => {
    if (!venueId) return;
    setNightLoading(true);
    try {
      const data = await fetchVenueNightReport(venueId);
      setNightReport(data);
    } catch (e) {
      setNightReport(null);
      Alert.alert('Gece Raporu', e?.message || 'Yuklenemedi');
    } finally {
      setNightLoading(false);
    }
  }, [venueId]);

  const loadMarketShare = useCallback(async () => {
    if (!venueId) return;
    setMarketLoading(true);
    try {
      const data = await fetchVenueMarketShare(venueId);
      setMarketShare(data);
    } catch (e) {
      setMarketShare({ locked: true, error: e?.message || 'Pazar payi yuklenemedi' });
    } finally {
      setMarketLoading(false);
    }
  }, [venueId]);

  const loadMonthlyPulse = useCallback(async () => {
    if (!venueId) return;
    setPulseLoading(true);
    try {
      const data = await fetchVenueMonthlyPulse(venueId);
      setMonthlyPulse(data);
    } catch (e) {
      Alert.alert('Aylik Nabiz', e?.message || 'Yuklenemedi');
    } finally {
      setPulseLoading(false);
    }
  }, [venueId]);

  const handleRevealCode = async (ritualId) => {
    try {
      setRevealingId(ritualId);
      const result = await revealVenueRitualKeyword(venueId, ritualId);
      const payload = result?.data || result;
      Alert.alert(
        'Kod açıldı',
        payload?.code_display || payload?.code
          ? String(payload.code_display || payload.code)
          : 'Check-in kodu açıldı'
      );
      load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kod açılamadı');
    } finally {
      setRevealingId(null);
    }
  };

  const handleNoCapacity = (ritualId) => {
    Alert.alert(
      'Yer veremedik',
      'Walk-in masa sessizce kapanır; kurana nötr bildirim gider.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionRitualId(ritualId);
              await venueNoCapacityCancel(venueId, ritualId);
              Alert.alert('Tamam', 'Masa kapatıldı');
              load();
            } catch (e) {
              Alert.alert('Hata', e?.message || 'İşlem başarısız');
            } finally {
              setActionRitualId(null);
            }
          },
        },
      ]
    );
  };

  const handleClaimRitual = async (ritualId) => {
    try {
      setActionRitualId(ritualId);
      await claimVenueRitual(venueId, ritualId);
      Alert.alert('Sahiplenildi', 'Custom ritual artık mekan kanalında');
      load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Sahiplenilemedi');
    } finally {
      setActionRitualId(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'gece') loadNightReport();
    if (tab === 'reputation') loadMarketShare();
    if (tab === 'profile') loadVenueBadges();
  }, [tab, loadNightReport, loadMarketShare, loadVenueBadges]);

  if (loading && !venue) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const profile = venue?.profile || venue;
  const rituals = venue?.upcoming_rituals || [];
  const trust = profile?.trust_display || venue?.trust_display;
  const aura = profile?.aura_display || venue?.aura_display;

  const renderMonthlyPulseBlock = () => {
    const heat = Array.isArray(monthlyPulse?.heatmap) ? monthlyPulse.heatmap : [];
    const maxN = heat.reduce((m, h) => Math.max(m, Number(h.n) || 0), 0) || 1;
    const dayLabels = ['Pz', 'Pt', 'Sa', 'Ca', 'Pe', 'Cu', 'Ct'];
    return (
      <View style={styles.subPanel}>
        <Text style={styles.subPanelTitle}>Aylık Nabız</Text>
        <TouchableOpacity style={styles.linkBtn} onPress={loadMonthlyPulse} disabled={pulseLoading}>
          <Text style={styles.linkBtnText}>{pulseLoading ? 'Yukleniyor…' : monthlyPulse ? 'Nabzi yenile' : 'Aylik nabzi yukle'}</Text>
        </TouchableOpacity>
        {monthlyPulse ? (
          <>
            <Text style={styles.scoreMeta}>
              Olu gun deltasi: {monthlyPulse.dead_day_delta_pct != null ? `%${monthlyPulse.dead_day_delta_pct}` : '—'}
            </Text>
            <Text style={styles.scoreMeta}>
              Regular buyume:{' '}
              {monthlyPulse.regular_growth
                ? `+${monthlyPulse.regular_growth.new_regulars ?? 0} yeni · ${monthlyPulse.regular_growth.total_regulars ?? 0} toplam`
                : '—'}
            </Text>
            {monthlyPulse.audience_aggregate ? (
              <Text style={styles.scoreMeta}>
                Kitle: %{monthlyPulse.audience_aggregate.uni_pct || 0} uni · %{monthlyPulse.audience_aggregate.intl_pct || 0} intl
              </Text>
            ) : null}
            {heat.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.subPanelTitle}>Gun × saat isi</Text>
                {heat.slice(0, 24).map((h, idx) => {
                  const w = Math.max(8, Math.round(((Number(h.n) || 0) / maxN) * 100));
                  return (
                    <View key={`${h.dow}-${h.hour}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={[styles.scoreMeta, { width: 72 }]}>
                        {dayLabels[Number(h.dow)] || h.dow} {String(h.hour).padStart(2, '0')}:00
                      </Text>
                      <View style={{ flex: 1, height: 8, backgroundColor: BORDER, borderRadius: 4 }}>
                        <View style={{ width: `${w}%`, height: 8, backgroundColor: PRIMARY, borderRadius: 4 }} />
                      </View>
                      <Text style={[styles.scoreMeta, { marginLeft: 6 }]}>{h.n}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };

  const renderTabBody = () => {
    if (tab === 'business') {
      return <VenueBusinessScreen route={{ params: { venueId } }} />;
    }
    if (tab === 'slots') {
      return (
        <View style={{ flex: 1, minHeight: 420 }}>
          <VenueSlotsScreen route={{ params: { venueId, embedded: true } }} navigation={navigation} />
        </View>
      );
    }
    if (tab === 'profile') {
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Vitrin & Profil</Text>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueVitrineEdit', { venueId })}>
            <Text style={styles.linkBtnText}>Vitrini duzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueArchive', { venueId })}>
            <Text style={styles.linkBtnText}>Memory arsivi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueFloorPlan', { venueId })}>
            <Text style={styles.linkBtnText}>Kat plani & GPS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenuePortals', { venueId })}>
            <Text style={styles.linkBtnText}>Totem seti (QR/NFC)</Text>
          </TouchableOpacity>
          <Text style={styles.mutedSmall}>Min 1 totem zorunlu (kasa/giriş) · hepsi buradasın-modunu açar</Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                await requestVenueTotem(venueId, 'Panel totem talebi');
                Alert.alert('Totem talebi', 'Talebiniz alındı — white-glove / yedek set kuyruğunda (C5).');
              } catch (e) {
                Alert.alert('Totem', e?.message || 'Talep gönderilemedi');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Totem talebi (kayıp/yedek)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                const { updateVenueTotemStatus } = await import('../services/api');
                await updateVenueTotemStatus(venueId, 'broken');
                Alert.alert('Totem', 'Totem arızalı işaretlendi — kod yolu fallback açıldı (C5).');
              } catch (e) {
                Alert.alert('Totem', e?.message || 'Durum güncellenemedi');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Totem arızalı bildir (kod fallback)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                const { updateVenueTotemStatus } = await import('../services/api');
                await updateVenueTotemStatus(venueId, 'ok');
                Alert.alert('Totem', 'Totem durumu OK.');
              } catch (e) {
                Alert.alert('Totem', e?.message || 'Durum güncellenemedi');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Totem OK işaretle</Text>
          </TouchableOpacity>

          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>🛡 Venue Rozetleri</Text>
            <Text style={styles.mutedSmall}>
              Kalkan sabit · sadece logo · max {venueBadgeMax} · admin onay · sistem verir
            </Text>
            {venueBadges.length === 0 ? (
              <Text style={styles.muted}>Henuz rozet yok</Text>
            ) : (
              venueBadges.map((b) => (
                <Text key={b.id} style={styles.scoreMeta}>
                  {b.name} · {b.condition_type} · {b.status}
                </Text>
              ))
            )}
            {venueBadges.filter((b) => b.status !== 'rejected').length < venueBadgeMax ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Kisa etiket (metin serbest yazı değil)"
                  value={badgeName}
                  onChangeText={setBadgeName}
                />
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Logo URL"
                  value={badgeLogo}
                  onChangeText={setBadgeLogo}
                  autoCapitalize="none"
                />
                <View style={styles.condRow}>
                  {VENUE_BADGE_CONDITIONS.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.condChip, badgeCondition === c.id && styles.condChipOn]}
                      onPress={() => setBadgeCondition(c.id)}
                    >
                      <Text style={[styles.condChipText, badgeCondition === c.id && styles.condChipTextOn]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Esik (ornek: 3 gelis)"
                  value={badgeThreshold}
                  onChangeText={setBadgeThreshold}
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={styles.linkBtn} onPress={submitVenueBadge} disabled={badgeSaving}>
                  <Text style={styles.linkBtnText}>
                    {badgeSaving ? 'Gonderiliyor…' : 'Onaya gonder'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.mutedSmall}>Mekan basina limit doldu ({venueBadgeMax})</Text>
            )}
          </View>
        </View>
      );
    }
    if (tab === 'gece') {
      const metrics = nightReport?.metrics || {};
      const feelings = metrics.feeling_totals || {};
      const audience = metrics.audience_aggregate || {};
      const auraDay = nightReport?.gunun_aurasi;
      const ritualRows = nightReport?.rituals || [];
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Gece Raporu</Text>
          <Text style={styles.mutedSmall}>
            Gün-sonu digest · kapanış + 30dk · OPERATÖR+ paket
            {nightReport?.date ? ` · ${nightReport.date}` : ''}
          </Text>
          {nightLoading && !nightReport ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
          ) : (
            <>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Günün Aurasi</Text>
                <Text style={styles.scoreValue}>
                  {auraDay?.avg_rq != null ? Number(auraDay.avg_rq).toFixed(2) : '—'}
                </Text>
                <Text style={styles.scoreMeta}>
                  {metrics.ritual_count != null ? `${metrics.ritual_count} Ritual` : '—'}
                  {metrics.checked_in != null ? ` · ${metrics.checked_in} check-in` : ''}
                  {nightReport?.mode === 'mini' ? ' · mini' : ''}
                </Text>
              </View>
              <View style={styles.feelingRow}>
                <Text style={styles.feelingChip}>🟢 {feelings.green || 0}</Text>
                <Text style={styles.feelingChip}>🟡 {feelings.yellow || 0}</Text>
                <Text style={styles.feelingChip}>🔴 {feelings.red || 0}</Text>
              </View>
              {ritualRows.map((r) => (
                <View key={r.id} style={styles.ritualRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ritualTitle}>{r.title}</Text>
                    <Text style={styles.muted}>
                      Nabız {r.nabiz ?? '—'} · doluluk {r.doluluk != null ? `%${r.doluluk}` : '—'} · memory {r.memory_count ?? 0}
                    </Text>
                  </View>
                </View>
              ))}
              {ritualRows.length === 0 ? (
                <Text style={styles.muted}>Bugün Ritual yok — gece raporu boş</Text>
              ) : null}
              {audience.sample != null || audience.uni_pct != null ? (
                <Text style={styles.scoreMeta}>
                  Kitle: %{audience.uni_pct || 0} uni · %{audience.intl_pct || 0} intl
                  {audience.sample != null ? ` (n=${audience.sample})` : ''}
                </Text>
              ) : null}
              {metrics.top_chip ? (
                <Text style={styles.scoreMeta}>
                  Top chip: {metrics.top_chip.chip_id} ({metrics.top_chip.count})
                </Text>
              ) : null}
              {nightReport?.teaser ? <Text style={styles.mutedSmall}>{nightReport.teaser}</Text> : null}
            </>
          )}
          <TouchableOpacity style={styles.linkBtn} onPress={loadNightReport} disabled={nightLoading}>
            <Text style={styles.linkBtnText}>{nightLoading ? 'Yukleniyor…' : 'Digest yükle'}</Text>
          </TouchableOpacity>
          {renderMonthlyPulseBlock()}
        </View>
      );
    }
    if (tab === 'regulars') {
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Regular listesi</Text>
          <Text style={styles.mutedSmall}>
            İç-halka · {regulars.length} üye · “X regular oldu” bildirimi otomatik
          </Text>
          {regulars.length === 0 ? (
            <Text style={styles.muted}>Henüz Regular yok</Text>
          ) : (
            regulars.map((r) => (
              <View key={r.user_id} style={styles.ritualRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ritualTitle}>{r.user_name || 'Kullanıcı'}</Text>
                  <Text style={styles.muted}>
                    {r.checkin_count || 0} check-in
                    {r.regular_since
                      ? ` · ${new Date(r.regular_since).toLocaleDateString('tr-TR')}`
                      : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      );
    }
    if (tab === 'reputation') {
      const trustDisplay = trust;
      const auraDisplay = aura;
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Itibar (Trust & Aura)</Text>
          <Text style={styles.mutedSmall}>Display-only · RS motoruna girmez (VEN-6)</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Trust</Text>
              <Text style={styles.scoreValue}>
                {trustDisplay?.score != null ? trustDisplay.score.toFixed(2) : '—'}
              </Text>
              <Text style={styles.scoreMeta}>
                {trustDisplay?.is_prior_fallback
                  ? `Prior (${trustDisplay?.prior?.toFixed?.(1) ?? '5.0'}) · ${trustDisplay?.n_eff || 0} Ritual`
                  : `${trustDisplay?.n_eff || 0} Ritual · ${trustDisplay?.window_days || 90}g`}
              </Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Aura</Text>
              <Text style={styles.scoreValue}>
                {auraDisplay?.score != null ? auraDisplay.score.toFixed(2) : '—'}
              </Text>
              <Text style={styles.scoreMeta}>
                {auraDisplay?.distribution_hidden
                  ? 'Dagilim gizli (<5 Ritual)'
                  : `${auraDisplay?.n_eff || 0} Ritual`}
              </Text>
            </View>
          </View>
          {profile?.seating_label || venue?.seating_label ? (
            <Text style={styles.seatingLabel}>{`Oturma: ${profile?.seating_label || venue?.seating_label}`}</Text>
          ) : null}
          {auraDisplay?.distribution?.categories?.length > 0 ? (
            <View style={styles.distWrap}>
              {auraDisplay.distribution.categories.slice(0, 6).map((cat) => (
                <Text key={cat.category} style={styles.distRow}>
                  {`${cat.category}: ${cat.avg_score?.toFixed(1) || '—'} (${cat.count})`}
                  {cat.status === 'tentative' ? ' · tentative' : ''}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>Pazar Payı</Text>
            {marketLoading && !marketShare ? (
              <ActivityIndicator color={PRIMARY} />
            ) : marketShare?.locked || marketShare?.teaser ? (
              <>
                <Text style={styles.blurCopy}>{marketShare.blur_copy || 'Bölgede bu ay ··· Ritual — ···\'i sende (%··)'}</Text>
                <Text style={styles.mutedSmall}>{marketShare.upgrade_hint || marketShare.error || 'HAKİM ile açılır'}</Text>
              </>
            ) : marketShare?.copy ? (
              <>
                <Text style={styles.scoreLine}>{marketShare.copy}</Text>
                <Text style={styles.scoreMeta}>Pay: %{marketShare.share_pct ?? '—'}</Text>
                {marketShare.anonim_benchmark ? (
                  <Text style={styles.scoreMeta}>
                    Anonim benchmark: bölge ort. / mekan ≈{' '}
                    {marketShare.anonim_benchmark.region_avg_per_venue ?? '—'}
                    {marketShare.anonim_benchmark.note ? ` · ${marketShare.anonim_benchmark.note}` : ''}
                  </Text>
                ) : null}
                {Array.isArray(marketShare.bolge_radari) && marketShare.bolge_radari.length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.subPanelTitle}>Bölge radarı (haftalık)</Text>
                    {marketShare.bolge_radari.slice(-8).map((row, idx) => (
                      <Text key={`${row.week}-${idx}`} style={styles.scoreMeta}>
                        {row.week
                          ? new Date(row.week).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : '—'}
                        {': '}
                        {row.n ?? 0} Ritual
                      </Text>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>Pazar payi bu pakette yok</Text>
            )}
          </View>

          {renderMonthlyPulseBlock()}

          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueDetail', { venueId })}>
            <Text style={styles.linkBtnText}>Public profilde gor</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Bugünün Ritualı</Text>
          <Text style={styles.mutedSmall}>Canlı sinyal · open_note · totem/personel açılışı</Text>
          {unansweredCount > 0 ? (
            <View style={styles.venEventBox}>
              <Text style={styles.venEventTitle}>Cevapsız istek: {unansweredCount}</Text>
              <Text style={styles.mutedSmall}>Slot öneri kuyruğu · kabul / alternatif / red</Text>
            </View>
          ) : null}
        <View style={styles.venEventBox}>
          <Text style={styles.venEventTitle}>VEN-EVENT · Etkinlik kur</Text>
          <Text style={styles.mutedSmall}>
            {venEventQuota?.unlimited
              ? `Aylık tavan pivot sonrası (şimdi sınırsız)${
                  venEventQuota.used != null ? ` · bu ay ${venEventQuota.used} etkinlik` : ''
                }`
              : venEventQuota
                ? `Bu ay ${venEventQuota.used}/${venEventQuota.cap} · kalan ${venEventQuota.remaining}`
                : 'Aylık tavan config açık · değer boş'}
          </Text>
        </View>
        {liveRituals.length > 0 ? (
          liveRituals.map((r) => (
            <View key={`live-${r.id}`} style={styles.ritualRow}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('RitualDetail', { ritualId: r.id })}
              >
                <Text style={styles.ritualTitle}>{r.title}</Text>
                <Text style={styles.muted}>
                  {r.table_open || r.first_sealed_at ? 'Masa açık' : r.status || 'live'}
                  {r.anon_sealed_count != null || r.sealed_count != null
                    ? ` · ${r.anon_sealed_count ?? r.sealed_count} isimsiz mühür`
                    : ''}
                  {` · ${r.current_attendees || 0}/${r.capacity || '—'}`}
                </Text>
                {r.open_note ? (
                  <Text style={styles.openNote}>Host notu: {String(r.open_note).slice(0, 120)}</Text>
                ) : null}
                {r.first_sealed_at ? (
                  <Text style={styles.mutedSmall}>
                    Açıldı{' '}
                    {new Date(r.first_sealed_at).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.revealBtn}
                onPress={() => handleRevealCode(r.id)}
                disabled={revealingId === r.id}
              >
                {revealingId === r.id ? (
                  <ActivityIndicator color="#111" size="small" />
                ) : (
                  <Text style={styles.revealBtnText}>Kodu Aç</Text>
                )}
              </TouchableOpacity>
              {String(r.origin || '').toUpperCase() === 'WALK_IN' ? (
                <TouchableOpacity
                  style={[styles.revealBtn, { marginTop: 6, backgroundColor: '#fef2f2' }]}
                  onPress={() => handleNoCapacity(r.id)}
                  disabled={actionRitualId === r.id}
                >
                  <Text style={[styles.revealBtnText, { color: '#991b1b' }]}>Yer veremedik</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        ) : null}
        {claimable.length > 0 ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.panelTitle}>Civardaki custom · Sahiplen</Text>
            {claimable.map((c) => (
              <View key={`claim-${c.id}`} style={styles.ritualRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => navigation.navigate('RitualDetail', { ritualId: c.id })}
                >
                  <Text style={styles.ritualTitle}>{c.title}</Text>
                  <Text style={styles.muted}>{c.distance_m != null ? `${c.distance_m}m` : 'yakın'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.revealBtn}
                  onPress={() => handleClaimRitual(c.id)}
                  disabled={actionRitualId === c.id}
                >
                  <Text style={styles.revealBtnText}>Sahiplen</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
        {rituals.length === 0 && liveRituals.length === 0 ? (
          <Text style={styles.muted}>Bugün için Ritual yok</Text>
        ) : (
          rituals
            .filter((r) => !liveRituals.some((l) => String(l.id) === String(r.id)))
            .map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.ritualRow}
                onPress={() => navigation.navigate('RitualDetail', { ritualId: r.id })}
              >
                <Text style={styles.ritualTitle}>{r.title}</Text>
                <Text style={styles.muted}>{r.type || 'Ritual'}</Text>
                {r.open_note ? (
                  <Text style={styles.openNote}>{String(r.open_note).slice(0, 80)}</Text>
                ) : null}
              </TouchableOpacity>
            ))
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{venue?.name || 'Mekan Yonetimi'}</Text>
        <Text style={styles.sub}>6 sekme · VAPP-UNIFIED · GECE digest</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabOn]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView
        style={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              if (tab === 'gece') loadNightReport();
              if (tab === 'reputation') loadMarketShare();
              if (tab === 'profile') loadVenueBadges();
            }}
            colors={[PRIMARY]}
          />
        }
      >
        {renderTabBody()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 12, color: MUTED, marginTop: 2 },
  tabBar: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabBarContent: { paddingHorizontal: 12, gap: 8, alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  tabOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabText: { fontSize: 12, fontWeight: '600', color: MUTED },
  tabTextOn: { color: '#fff' },
  body: { flex: 1 },
  panel: { padding: 16 },
  panelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  scoreLine: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  mutedSmall: { fontSize: 12, color: MUTED, marginBottom: 10 },
  scoreRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  scoreCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  scoreLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  scoreValue: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 4 },
  scoreMeta: { fontSize: 11, color: MUTED, marginTop: 4 },
  seatingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  distWrap: { marginTop: 4, marginBottom: 8 },
  distRow: { fontSize: 12, color: '#333', marginBottom: 4 },
  muted: { fontSize: 13, color: MUTED },
  openNote: { fontSize: 12, color: '#374151', marginTop: 4, fontStyle: 'italic' },
  venEventBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  venEventTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  feelingRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  feelingChip: { fontSize: 14, fontWeight: '700', color: '#333' },
  blurCopy: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 6,
    opacity: 0.55,
  },
  subPanel: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  subPanelTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#1a1a1a' },
  ritualRow: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ritualTitle: { fontSize: 15, fontWeight: '600' },
  revealBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: 'center',
  },
  revealBtnText: { color: '#111', fontWeight: '800', fontSize: 12 },
  linkBtn: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#111',
    borderRadius: 10,
  },
  linkBtnText: { color: '#fff', fontWeight: '600' },
  badgeInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#111',
  },
  condRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  condChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fff',
  },
  condChipOn: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  condChipText: { fontSize: 12, fontWeight: '600', color: MUTED },
  condChipTextOn: { color: '#fff' },
});
