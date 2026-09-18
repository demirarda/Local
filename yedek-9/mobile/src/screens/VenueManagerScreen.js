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
  fetchVenueCrowdMix,
  fetchVenueBadges,
  createVenueBadge,
  fetchVenueVenEventQuota,
  venueNoCapacityCancel,
  fetchClaimableRituals,
  claimVenueRitual,
  fetchVenueSuggestionInbox,
  requestVenueTotem,
  fetchVenueRotatingTotemCode,
  fetchVenueManagers,
  addVenueManager,
  removeVenueManager,
  patchVenue,
  postVenueAnnouncement,
} from '../services/api';
import VenueBusinessScreen from './VenueBusinessScreen';
import VenueSlotsScreen from './VenueSlotsScreen';
import { DsBinsChart } from '../components/DsCompassCard';

const TABS = [
  { id: 'today', label: 'Bugun' },
  { id: 'gece', label: 'GECE' },
  { id: 'slots', label: 'Raf & Takvim' },
  { id: 'regulars', label: 'Regular' },
  { id: 'reputation', label: 'Itibar' },
  { id: 'profile', label: 'Profil' },
  { id: 'business', label: 'Isletme' },
];

const PRIMARY = '#f9a13d';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';
const VENUE_BADGE_CONDITIONS = [
  { id: 'identity', label: 'Kimlik (TÜR-A)' },
  { id: 'visit', label: 'Gelis' },
  { id: 'category', label: 'Kategori' },
  { id: 'slot', label: 'Raf' },
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
  const [crowdMix, setCrowdMix] = useState(null);
  const [crowdLoading, setCrowdLoading] = useState(false);
  const [monthlyPulse, setMonthlyPulse] = useState(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [venueBadges, setVenueBadges] = useState([]);
  const [venueBadgeMax, setVenueBadgeMax] = useState(5);
  const [badgeName, setBadgeName] = useState('');
  const [badgeNameEn, setBadgeNameEn] = useState('');
  const [badgeNameTr, setBadgeNameTr] = useState('');
  const [badgeKind, setBadgeKind] = useState('A');
  const [badgeLogo, setBadgeLogo] = useState('');
  const [badgeCondition, setBadgeCondition] = useState('identity');
  const [badgeThreshold, setBadgeThreshold] = useState('1');
  const [badgeRequirement, setBadgeRequirement] = useState('');
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [announceBody, setAnnounceBody] = useState('');
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [rotatingTotem, setRotatingTotem] = useState(null);
  const [venEventQuota, setVenEventQuota] = useState(null);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [weekdayClose, setWeekdayClose] = useState('23:00');
  const [weekendClose, setWeekendClose] = useState('00:00');
  const [staffList, setStaffList] = useState([]);
  const [staffSeats, setStaffSeats] = useState(null);

  const load = useCallback(async () => {
    if (!venueId) return;
    try {
      const data = await getVenue(venueId);
      setVenue(data);
      const hours = data?.weekly_hours || {};
      if (hours.mon?.close) setWeekdayClose(hours.mon.close);
      if (hours.sat?.close) setWeekendClose(hours.sat.close);
      try {
        const people = await fetchVenueManagers(venueId);
        setStaffList(Array.isArray(people) ? people : []);
        setStaffSeats(people?.seats || null);
      } catch (_e) {
        setStaffList([]);
      }
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
        if (data?.permissions?.regulars) {
          const regs = await fetchVenueRegulars(venueId);
          setRegulars(Array.isArray(regs) ? regs : []);
        } else {
          setRegulars([]);
        }
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
    if (!badgeNameEn.trim() || !badgeNameTr.trim() || !badgeLogo.trim() || !badgeRequirement.trim()) {
      Alert.alert('Eksik', 'Çift-dil (EN/TR), logo ve kazanım şartı zorunlu (şartı mekan yazar)');
      return;
    }
    setBadgeSaving(true);
    try {
      await createVenueBadge(venueId, {
        name: badgeName.trim() || badgeNameTr.trim(),
        name_en: badgeNameEn.trim(),
        name_tr: badgeNameTr.trim(),
        kind: badgeKind,
        logo_url: badgeLogo.trim(),
        condition_type: badgeKind === 'A' ? 'identity' : badgeCondition,
        threshold: Number(badgeThreshold) || 1,
        requirement_text: badgeRequirement.trim(),
      });
      setBadgeName('');
      setBadgeNameEn('');
      setBadgeNameTr('');
      setBadgeLogo('');
      setBadgeThreshold('1');
      setBadgeRequirement('');
      Alert.alert('Gonderildi', 'Badge Studio · admin onayina dustu · şartı sen yazdın');
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
      const data = await fetchVenueNightReport(venueId, {
        mini: !venue?.permissions?.night_archive,
      });
      setNightReport(data);
    } catch (e) {
      setNightReport(null);
      Alert.alert('Gece Raporu', e?.message || 'Yuklenemedi');
    } finally {
      setNightLoading(false);
    }
  }, [venueId, venue?.permissions?.night_archive]);

  const loadMarketShare = useCallback(async () => {
    if (!venueId) return;
    setMarketLoading(true);
    setCrowdLoading(true);
    try {
      const data = await fetchVenueMarketShare(venueId);
      setMarketShare(data);
    } catch (e) {
      setMarketShare({ locked: true, error: e?.message || 'Pazar payi yuklenemedi' });
    } finally {
      setMarketLoading(false);
    }
    try {
      const mix = await fetchVenueCrowdMix(venueId);
      setCrowdMix(mix);
    } catch (e) {
      setCrowdMix({ locked: true, error: e?.message || 'Kitle karisimi yuklenemedi' });
    } finally {
      setCrowdLoading(false);
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
    const p = venue?.permissions;
    if (!p) return;
    const blocked =
      (tab === 'business' && !p.business) ||
      (tab === 'slots' && !p.slots) ||
      (tab === 'regulars' && !p.regulars) ||
      (tab === 'reputation' && !p.reputation);
    if (blocked) setTab('today');
  }, [venue, tab]);

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
      const perms = venue?.permissions || {};
      const tier = String(venue?.subscription_tier || venue?.package || venue?.tier || '').toLowerCase();
      const badgeStudioOk =
        ['operator', 'hakim', 'landmark'].includes(tier) || venue?.pro_enabled === true;
      return (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Vitrin & Profil</Text>
          <Text style={styles.mutedSmall}>Rol: {venue?.my_role || '—'}</Text>
          {perms.profile ? (
            <>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueVitrineEdit', { venueId })}>
            <Text style={styles.linkBtnText}>Vitrini duzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueArchive', { venueId })}>
            <Text style={styles.linkBtnText}>Memory arsivi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueFloorPlan', { venueId })}>
            <Text style={styles.linkBtnText}>Kat plani & GPS</Text>
          </TouchableOpacity>
          <Text style={styles.mutedSmall}>Hafta ici kapanis</Text>
          <TextInput style={styles.badgeInput} value={weekdayClose} onChangeText={setWeekdayClose} placeholder="23:00" />
          <Text style={styles.mutedSmall}>Hafta sonu kapanis</Text>
          <TextInput style={styles.badgeInput} value={weekendClose} onChangeText={setWeekendClose} placeholder="00:00" />
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                await patchVenue(venueId, {
                  weekly_hours: {
                    mon: { open: '09:00', close: weekdayClose, closed: false },
                    tue: { open: '09:00', close: weekdayClose, closed: false },
                    wed: { open: '09:00', close: weekdayClose, closed: false },
                    thu: { open: '09:00', close: weekdayClose, closed: false },
                    fri: { open: '09:00', close: weekendClose, closed: false },
                    sat: { open: '10:00', close: weekendClose, closed: false },
                    sun: { open: '10:00', close: weekdayClose, closed: false },
                  },
                });
                Alert.alert('Saatler', 'Kapanis kaydedildi — Gece Raporu bu saate bagli.');
              } catch (e) {
                Alert.alert('Saatler', e?.message || 'Kaydedilemedi');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Calisma saatlerini kaydet</Text>
          </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenueFloorPlan', { venueId })}>
              <Text style={styles.linkBtnText}>GPS muhuru (iceride)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('VenuePortals', { venueId })}>
            <Text style={styles.linkBtnText}>Totem seti (QR/NFC)</Text>
          </TouchableOpacity>
          <Text style={styles.mutedSmall}>Min 1 totem zorunlu (kasa/giriş) · hepsi buradasın-modunu açar</Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                await requestVenueTotem(venueId, 'Özel totem siparişi', { kind: 'custom_figur' });
                Alert.alert('Özel Totem', 'Sipariş alındı — tasarım kuyruğunda (ayrı satış). LANDMARK’ta figür pakete dahildir.');
              } catch (e) {
                Alert.alert('Totem', e?.message || 'Sipariş gönderilemedi');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Özel Totem Sipariş Et</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                await requestVenueTotem(venueId, 'Panel totem talebi', { kind: 'replacement' });
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
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={async () => {
              try {
                const data = await fetchVenueRotatingTotemCode(venueId);
                setRotatingTotem(data);
              } catch (e) {
                Alert.alert('Dönen kod', e?.message || 'Alınamadı');
              }
            }}
          >
            <Text style={styles.linkBtnText}>Dönen totem kodu göster</Text>
          </TouchableOpacity>
          {rotatingTotem?.code ? (
            <Text style={styles.scoreMeta}>
              Kod {rotatingTotem.code} · {rotatingTotem.ttl_s || 30}sn · statik QR kapı değil
            </Text>
          ) : null}
          <Text style={styles.mutedSmall}>Yol-C: staff-cihaz → tap-noktası → figür</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {['STAFF_DEVICE', 'TAP_POINT', 'FIGUR'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.linkBtn,
                  String(venue?.totem_path || 'STAFF_DEVICE').toUpperCase() === p && { borderColor: PRIMARY },
                ]}
                onPress={async () => {
                  try {
                    const next = await patchVenue(venueId, { totem_path: p });
                    setVenue((prev) => ({ ...(prev || {}), ...(next || {}), totem_path: p }));
                  } catch (e) {
                    Alert.alert('Yol-C', e?.message || 'Kaydedilemedi');
                  }
                }}
              >
                <Text style={styles.linkBtnText}>
                  {p === 'STAFF_DEVICE' ? 'Staff cihaz' : p === 'TAP_POINT' ? 'Tap-noktası' : 'Figür'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {perms.badges ? (
          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>Badge Studio</Text>
            <Text style={styles.mutedSmall}>
              TÜR-A kimlik · TÜR-B verilen · çift-dil zorunlu · max {venueBadgeMax} · OPEN=0 · şartı mekan yazar
            </Text>
            {venueBadges.length === 0 ? (
              <Text style={styles.muted}>Henuz rozet yok</Text>
            ) : (
              venueBadges.map((b) => (
                <Text key={b.id} style={styles.scoreMeta}>
                  {b.kind ? `TÜR-${b.kind} · ` : ''}{b.name_tr || b.name} / {b.name_en || '—'} · {b.status}
                </Text>
              ))
            )}
            {venueBadges.filter((b) => b.status !== 'rejected').length < venueBadgeMax ? (
              !badgeStudioOk ? (
                <Text style={styles.mutedSmall}>FREE’de badge üretimi yok — OPERATOR+ gerekli</Text>
              ) : (
              <View style={{ marginTop: 10, gap: 8 }}>
                <View style={styles.condRow}>
                  {['A', ...( ['hakim', 'landmark'].includes(tier) || venue?.city_partner_enabled ? ['B'] : [])].map((k) => (
                    <TouchableOpacity
                      key={k}
                      style={[styles.condChip, badgeKind === k && styles.condChipOn]}
                      onPress={() => {
                        setBadgeKind(k);
                        if (k === 'A') setBadgeCondition('identity');
                      }}
                    >
                      <Text style={[styles.condChipText, badgeKind === k && styles.condChipTextOn]}>
                        TÜR-{k}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Name EN"
                  value={badgeNameEn}
                  onChangeText={setBadgeNameEn}
                />
                <TextInput
                  style={styles.badgeInput}
                  placeholder="İsim TR"
                  value={badgeNameTr}
                  onChangeText={setBadgeNameTr}
                />
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Kisa etiket (opsiyonel)"
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
                {badgeKind === 'B' ? (
                <View style={styles.condRow}>
                  {VENUE_BADGE_CONDITIONS.filter((c) => c.id !== 'identity').map((c) => (
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
                ) : (
                  <Text style={styles.mutedSmall}>TÜR-A: mekan kimliği — şartı sen yazarsın</Text>
                )}
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Kazanım şartı (mekan yazar)"
                  value={badgeRequirement}
                  onChangeText={setBadgeRequirement}
                />
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
              )
            ) : (
              <Text style={styles.mutedSmall}>Mekan basina limit doldu ({venueBadgeMax})</Text>
            )}
          </View>
          ) : null}
          {perms.invite_staff ? (
            <View style={styles.subPanel}>
              <Text style={styles.subPanelTitle}>Personel · yetki koltukları</Text>
              <Text style={styles.mutedSmall}>
                Bağ sınırsız · koltuk kıt
                {staffSeats
                  ? ` · manager ${staffSeats.manager === Number.POSITIVE_INFINITY || staffSeats.manager == null ? '∞' : staffSeats.manager} · staff-door ${staffSeats.staff_door}`
                  : ' · OPEN 1M+2D · OPERATOR 3M+5D · LANDMARK ∞M+12D'}
              </Text>
              {staffList.map((p) => (
                <View key={p.user_id} style={styles.condRow}>
                  <Text style={[styles.scoreMeta, { flex: 1 }]}>
                    {p.name || p.email} · {p.role}
                  </Text>
                  {perms.invite_manager && p.role !== 'owner' ? (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await removeVenueManager(venueId, p.user_id);
                          const people = await fetchVenueManagers(venueId);
                          setStaffList(Array.isArray(people) ? people : []);
                          setStaffSeats(people?.seats || null);
                        } catch (e) {
                          Alert.alert('Personel', e?.message || 'Kaldırılamadı');
                        }
                      }}
                    >
                      <Text style={styles.linkBtnText}>Kaldır</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <TextInput
                style={styles.badgeInput}
                placeholder="LOCAL e-posta"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.condRow}>
                <TouchableOpacity
                  style={[styles.condChip, inviteRole === 'staff' && styles.condChipOn]}
                  onPress={() => setInviteRole('staff')}
                >
                  <Text style={[styles.condChipText, inviteRole === 'staff' && styles.condChipTextOn]}>Staff</Text>
                </TouchableOpacity>
                {perms.invite_manager ? (
                  <TouchableOpacity
                    style={[styles.condChip, inviteRole === 'manager' && styles.condChipOn]}
                    onPress={() => setInviteRole('manager')}
                  >
                    <Text style={[styles.condChipText, inviteRole === 'manager' && styles.condChipTextOn]}>Manager</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={async () => {
                  try {
                    await addVenueManager(venueId, { email: inviteEmail.trim(), role: inviteRole });
                    setInviteEmail('');
                    const people = await fetchVenueManagers(venueId);
                    setStaffList(Array.isArray(people) ? people : []);
                    setStaffSeats(people?.seats || null);
                    Alert.alert('Personel', 'Davet edildi.');
                  } catch (e) {
                    Alert.alert('Personel', e?.message || 'Eklenemedi');
                  }
                }}
              >
                <Text style={styles.linkBtnText}>Davet et</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>Takipçi duyurusu</Text>
            {badgeStudioOk ? (
              <>
                <Text style={styles.mutedSmall}>OPERATOR 4/ay · LANDMARK 12/ay · OPEN’da duyuru-push yok</Text>
                <TextInput
                  style={styles.badgeInput}
                  placeholder="Duyuru metni"
                  value={announceBody}
                  onChangeText={setAnnounceBody}
                />
                <TouchableOpacity
                  style={styles.linkBtn}
                  disabled={announceSaving || !announceBody.trim()}
                  onPress={async () => {
                    setAnnounceSaving(true);
                    try {
                      await postVenueAnnouncement(venueId, announceBody.trim());
                      setAnnounceBody('');
                      Alert.alert('Duyuru', 'Takipçilere düştü.');
                    } catch (e) {
                      Alert.alert('Duyuru', e?.message || 'Gönderilemedi');
                    } finally {
                      setAnnounceSaving(false);
                    }
                  }}
                >
                  <Text style={styles.linkBtnText}>{announceSaving ? 'Gönderiliyor…' : 'Duyuru gönder'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.mutedSmall}>OPEN takipçi-zili var; duyuru-push yok — OPERATOR+ gerekir</Text>
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
            {nightReport?.mode === 'summary_3'
              ? 'OPEN özet · 3 satır: masa · mühür · top-chip'
              : 'Gün-sonu digest · kapanış + 30dk · OPERATOR+ tam rapor'}
            {nightReport?.date ? ` · ${nightReport.date}` : ''}
          </Text>
          {nightLoading && !nightReport ? (
            <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
          ) : nightReport?.mode === 'summary_3' ? (
            <>
              {(nightReport.lines || []).map((line) => (
                <Text key={line} style={styles.scoreMeta}>{line}</Text>
              ))}
              {nightReport?.teaser ? <Text style={styles.mutedSmall}>{nightReport.teaser}</Text> : null}
            </>
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
          {venue?.permissions?.night_archive ? renderMonthlyPulseBlock() : (
            <Text style={styles.mutedSmall}>Staff: push özeti · arşiv ve nabız web/manager</Text>
          )}
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

          <View style={styles.subPanel}>
            <Text style={styles.subPanelTitle}>Kitle karışımı</Text>
            {crowdLoading && !crowdMix ? (
              <ActivityIndicator color={PRIMARY} />
            ) : crowdMix?.locked || crowdMix?.teaser ? (
              <>
                <Text style={styles.blurCopy}>{crowdMix.blur_copy || 'Kitle karışımı ···'}</Text>
                <Text style={styles.mutedSmall}>{crowdMix.upgrade_hint || crowdMix.error || 'HAKİM ile açılır'}</Text>
              </>
            ) : crowdMix?.hidden ? (
              <Text style={styles.mutedSmall}>MIN-N altında — anonim karışım henüz yok</Text>
            ) : Array.isArray(crowdMix?.bins) && crowdMix.bins.length > 0 ? (
              <>
                <DsBinsChart bins={crowdMix.bins} />
                <Text style={styles.scoreMeta}>
                  ortalama {crowdMix.mean ?? '—'} · n={crowdMix.n} · yargı yok · kişisel DS yok
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Kitle karışımı bu pakette yok</Text>
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
          {unansweredCount > 0 && venue?.permissions?.slots ? (
            <View style={styles.venEventBox}>
              <Text style={styles.venEventTitle}>Cevapsız istek: {unansweredCount}</Text>
              <Text style={styles.mutedSmall}>Slot öneri kuyruğu · kabul / alternatif / red</Text>
            </View>
          ) : null}
        {venue?.permissions?.events ? (
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
        ) : null}
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
        {claimable.length > 0 && venue?.permissions?.events ? (
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
        <Text style={styles.sub}>
          {venue?.my_role || 'yonetici'} · {venue?.permissions?.business ? 'isletme' : venue?.permissions?.slots ? 'mudur' : 'vardiya'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.filter((t) => {
          const p = venue?.permissions;
          if (!p) return true;
          if (t.id === 'business') return p.business;
          if (t.id === 'slots') return p.slots;
          if (t.id === 'regulars') return p.regulars;
          if (t.id === 'reputation') return p.reputation;
          return true;
        }).map((t) => (
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
