import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getVenue, getVenueFollowStatus, followVenue, unfollowVenue, setVenueFollowBell, createModReport } from '../services/api';
import ReportModal from '../components/ReportModal';
import VenueCharacterCard from '../components/VenueCharacterCard';
import FollowBellControls from '../components/FollowBellControls';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import { getHighlightVenueMax } from '../constants/localConfig';

const CARD_BG = '#ffffff';
const BORDER = '#e5e5e0';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';
const PRIMARY = '#f9a13d';

export default function VenueDetailScreen({ route, navigation }) {
  const { venueId, presenceMode = false, presenceExpiresAt = null } = route.params || {};
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bell, setBell] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState('venue');

  const { user } = useAuthStore();
  const currentUserId = user?.id;
  const highlightVenueMax = getHighlightVenueMax(useConfigStore((s) => s.config));

  const load = async () => {
    if (!venueId) return;
    try {
      const data = await getVenue(venueId);
      setVenue(data);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Mekan yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [venueId]);

  useEffect(() => {
    if (!venueId || !currentUserId) return;
    getVenueFollowStatus(venueId)
      .then((st) => {
        setFollowing(Boolean(st?.is_following));
        setBell(Boolean(st?.bell));
      })
      .catch(() => {
        setFollowing(false);
        setBell(false);
      });
  }, [venueId, currentUserId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggleFollow = async () => {
    if (!venueId || followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowVenue(venueId);
        setFollowing(false);
        setBell(false);
      } else {
        await followVenue(venueId, false);
        setFollowing(true);
        setBell(false);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Takip durumu guncellenemedi');
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleBell = async () => {
    if (!venueId || !following || bellLoading) return;
    setBellLoading(true);
    try {
      await setVenueFollowBell(venueId, !bell);
      setBell(!bell);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Zil guncellenemedi');
    } finally {
      setBellLoading(false);
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !venue) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Mekan bulunamadi</Text>
      </View>
    );
  }

  const rituals = venue.upcoming_rituals || [];
  const vitrine = venue.vitrine || venue.profile?.vitrine;
  const lockedSections = venue.locked_sections || venue.profile?.locked_sections || [];
  const canManage = Boolean(venue.can_manage || venue.profile?.can_manage);
  const archiveCount = Number(venue.archive_public_count ?? venue.profile?.archive_public_count ?? 0);
  const archivePreview = venue.archive_preview || venue.profile?.archive_preview || [];
  const trustDisplay = venue.trust_display || venue.profile?.trust_display;
  const auraDisplay = venue.aura_display || venue.profile?.aura_display;
  const seatingLabel = venue.seating_label || venue.profile?.seating_label;
  const venueRS = Number(venue.venue_rs ?? 0);
  const rsCount = Number(venue.venue_rs_rating_count ?? 0);
  const rsBadge = venue.venue_rs_badge || 'Rozet yok (izleme altında)';
  const rsFillPct = Math.max(0, Math.min(100, (venueRS / 10) * 100));
  const subscriptionTier = venue.subscription_tier || 'free';
  const proEnabled = Boolean(venue.pro_enabled);
  const cityPartnerEnabled = Boolean(venue.city_partner_enabled);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} />
      }
    >
      {presenceMode ? (
        <View style={styles.presenceBanner}>
          <Text style={styles.presenceTitle}>Buradasın · {venue.name}</Text>
          <Text style={styles.presenceBody}>
            Totemi okuttun. Bu mod yalnızca yüzeydir — her aksiyon canlı GPS ister.
            {presenceExpiresAt
              ? ` Bilet ${new Date(presenceExpiresAt).toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}'e kadar açık.`
              : ''}
          </Text>
        </View>
      ) : null}
      <View style={styles.header}>
        <View style={styles.heroPhoto}>
          <Text style={styles.heroPhotoText}>
            {vitrine?.headline || vitrine?.cover_url ? 'Vitrin' : 'Mekan Gorseli'}
          </Text>
        </View>
        <Text style={styles.name}>{vitrine?.headline || venue.name}</Text>
        {vitrine?.tagline ? <Text style={styles.tagline}>{vitrine.tagline}</Text> : null}
        {venue.city ? <Text style={styles.city}>{venue.city}</Text> : null}
        {(venue.profile?.highlighted_badges || venue.highlighted_badges || []).length > 0 ? (
          <View style={styles.venueBadgeRow}>
            {(venue.profile?.highlighted_badges || venue.highlighted_badges || []).slice(0, highlightVenueMax).map((b) => (
              <View key={b.slug} style={styles.venueBadgeChip}>
                <Text style={styles.venueBadgeText}>{b.icon_emoji || '🏅'} {b.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {(() => {
          const chips = venue.profile?.chip_breakdown || venue.chip_breakdown;
          if (!chips) return null;
          if (chips.hidden) {
            return chips.teaser ? (
              <Text style={[styles.city, { marginTop: 8 }]}>{chips.teaser}</Text>
            ) : null;
          }
          const rows = (chips.breakdown || []).slice(0, 5);
          if (!rows.length) return null;
          return (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#111', marginBottom: 4 }}>
                Chip kirilimi (n≥{chips.public_min_n || 10})
              </Text>
              {rows.map((c) => (
                <Text key={c.chip_id} style={{ fontSize: 12, color: MUTED }}>
                  {c.chip_id}: {c.total} (🟢{c.green} 🟡{c.yellow} 🔴{c.red})
                </Text>
              ))}
            </View>
          );
        })()}
        {venue.is_verified ? (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ Dogrulanmis Mekan</Text>
          </View>
        ) : null}
        {venue.takeover_until && new Date(venue.takeover_until).getTime() > Date.now() ? (
          <View style={[styles.verifiedBadge, { backgroundColor: '#ccfbf1' }]}>
            <Text style={[styles.verifiedText, { color: '#0f766e' }]}>LOCAL TAKEOVER aktif</Text>
          </View>
        ) : null}
        {venue.featured_event_card?.title ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400e' }}>
              ★ {venue.featured_event_card.title}
            </Text>
            {venue.featured_event_card.subtitle ? (
              <Text style={{ fontSize: 12, color: MUTED }}>{venue.featured_event_card.subtitle}</Text>
            ) : null}
          </View>
        ) : null}
        {currentUserId && venue?.regular_progress ? (
          <View style={styles.regularProgressBox}>
            <Text style={styles.regularProgressLabel}>
              {venue.regular_progress.is_regular
                ? 'Regular'
                : `Regular ilerleme · ${venue.regular_progress.counter || `${venue.regular_progress.count}/${venue.regular_progress.threshold || 3}`}`}
            </Text>
            <Text style={styles.regularProgressHint}>
              {venue.regular_progress.is_regular
                ? 'Bu mekanda Regular’sın (yalnız sen görürsün)'
                : `Son ${venue.regular_progress.window_d || 45} günde ${venue.regular_progress.needed} check-in daha · yalnız sana görünür`}
            </Text>
          </View>
        ) : null}
        {currentUserId && (
          <FollowBellControls
            following={following}
            bell={bell}
            followLoading={followLoading}
            bellLoading={bellLoading}
            onToggleBell={toggleBell}
            onToggleFollow={toggleFollow}
            followLabel="Mekani Takip Et"
            followingLabel="Takiptesin"
          />
        )}
        {currentUserId ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[styles.followBtn, { marginTop: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b45309' }]}
              onPress={() => {
                setReportType('venue');
                setShowReport(true);
              }}
            >
              <Text style={[styles.followBtnText, { color: '#b45309' }]}>Mekanı bildir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followBtn, { marginTop: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#b45309' }]}
              onPress={() => {
                setReportType('venue_badge');
                setShowReport(true);
              }}
            >
              <Text style={[styles.followBtnText, { color: '#b45309' }]}>Rozet/etkinlik bildir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.followBtn, { marginTop: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#64748b' }]}
              onPress={() => {
                if (venue?.zone_id) {
                  navigation.navigate('ZoneDetail', { zoneId: venue.zone_id });
                  return;
                }
                setReportType('zone');
                setShowReport(true);
              }}
            >
              <Text style={[styles.followBtnText, { color: '#64748b' }]}>Zone bildir</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {canManage ? (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('VenueVitrineEdit', { venueId })}
          >
            <Text style={styles.manageBtnText}>Vitrini Duzenle</Text>
          </TouchableOpacity>
        ) : null}
        {canManage ? (
          <TouchableOpacity
            style={[styles.manageBtn, styles.manageBtnDark]}
            onPress={() => navigation.navigate('VenueManager', { venueId })}
          >
            <Text style={styles.manageBtnText}>Yonetici Paneli</Text>
          </TouchableOpacity>
        ) : null}
        {canManage ? (
          <TouchableOpacity
            style={styles.manageBtnSecondary}
            onPress={() => navigation.navigate('VenueSlots', { venueId })}
          >
            <Text style={styles.manageBtnSecondaryText}>Slot & Oneri Kutusu</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.manageBtnSecondary}
            onPress={() => navigation.navigate('VenueSlots', { venueId })}
          >
            <Text style={styles.manageBtnSecondaryText}>Acik Slotlar</Text>
          </TouchableOpacity>
        )}
        {!venue.vitrine_published && !canManage ? (
          <Text style={styles.draftHint}>Vitrin henuz yayinlanmadi</Text>
        ) : null}
        <View style={styles.rsBarWrap}>
          <Text style={styles.rsLabel}>{`Mekan RS ${venueRS.toFixed(2)} · ${rsCount} degerlendirme`}</Text>
          <View style={styles.rsTrack}>
            <View style={[styles.rsFill, { width: `${rsFillPct}%` }]} />
          </View>
          <Text style={styles.tierText}>{rsBadge}</Text>
        </View>
        <View style={styles.subscriptionCard}>
          <Text style={styles.subscriptionTitle}>7.2 Abonelik Kademeleri</Text>
          <Text style={styles.subscriptionRow}>Temel (ucretsiz): Mekani listele, Ritual olustur, temel katilimci sayisini gor</Text>
          <Text style={styles.subscriptionRowMuted}>OPERATÖR - ₺7.900/ay: 3 eszamanli slot</Text>
          <Text style={styles.subscriptionRowMuted}>HAKİM - ₺19.900/ay: 5 eszamanli slot</Text>
          <Text style={styles.subscriptionCurrent}>{`Aktif kademe: ${subscriptionTier === 'free' ? 'Temel (ucretsiz)' : subscriptionTier}`}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Itibar (Trust & Aura)</Text>
        <Text style={styles.mutedSmall}>Display-only · RS motoruna girmez (VEN-6)</Text>
        <VenueCharacterCard
          card={
            venue.character_card ||
            venue.profile?.character_card ||
            (trustDisplay || auraDisplay
              ? {
                  trust: {
                    score: trustDisplay?.score,
                    label: seatingLabel || venue.profile?.seating_label,
                  },
                  aura: {
                    score: auraDisplay?.score,
                    label: seatingLabel || venue.profile?.seating_label,
                  },
                  chips_under_scores: [],
                  distribution_slices: (auraDisplay?.distribution?.categories || [])
                    .slice(0, 3)
                    .map((c) => ({
                      category: c.category,
                      avg_score: c.avg_score,
                      status: c.status,
                    })),
                  distribution_other:
                    (auraDisplay?.distribution?.categories || []).length > 3
                      ? {
                          label: '+diğer',
                          count_categories:
                            (auraDisplay?.distribution?.categories || []).length - 3,
                        }
                      : null,
                  chain_id: venue.chain_id || venue.profile?.chain_id,
                  brand_id: venue.brand_id || venue.profile?.brand_id,
                }
              : null)
          }
          volume={venue.character_volume || venue.profile?.character_volume}
          showVolume
          onChainPress={(id) => navigation.navigate('ChainProfile', { chainId: id })}
          onBrandPress={(id) => navigation.navigate('BrandProfile', { brandId: id })}
        />
      </View>

      {vitrine?.hours ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saatler</Text>
          <Text style={styles.body}>{vitrine.hours}</Text>
        </View>
      ) : null}

      {vitrine?.amenities?.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Olanaklar</Text>
          <Text style={styles.body}>{vitrine.amenities.join(' · ')}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kilitli / Yonetici Alanlari</Text>
        <Text style={styles.mutedSmall}>
          {archiveCount > 0
            ? `${archiveCount} PUBLIC memory arsivde (tam liste yoneticiye acik)`
            : 'Arsiv henuz bos'}
        </Text>
        {lockedSections.map((sec) => (
          <TouchableOpacity
            key={sec.id}
            style={[styles.lockedRow, sec.locked && styles.lockedRowLocked]}
            disabled={sec.locked || !['slots', 'archive_full', 'business_tab'].includes(sec.id)}
            onPress={() => {
              if (!sec.locked && sec.id === 'slots') {
                navigation.navigate('VenueSlots', { venueId });
              }
              if (!sec.locked && sec.id === 'archive_full') {
                navigation.navigate('VenueArchive', { venueId });
              }
              if (!sec.locked && sec.id === 'business_tab') {
                navigation.navigate('VenueManager', { venueId, initialTab: 'business' });
              }
            }}
            activeOpacity={sec.locked ? 1 : 0.7}
          >
            <MaterialIcons
              name={sec.locked ? 'lock' : 'lock-open'}
              size={18}
              color={sec.locked ? MUTED : PRIMARY}
            />
            <View style={styles.lockedBody}>
              <Text style={styles.lockedLabel}>{sec.label}</Text>
              {sec.locked ? (
                <Text style={styles.lockedReason}>{sec.reason || 'Kilitli'}</Text>
              ) : (
                <Text style={styles.lockedReason}>Yonetici erisimi</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {archivePreview.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arsiv Onizleme</Text>
          {archivePreview.map((m) => (
            <View key={m.id} style={styles.previewRow}>
              <Text style={styles.previewText} numberOfLines={2}>
                {m.caption || m.ritual_title || 'Memory'}
              </Text>
              {m.is_featured ? <Text style={styles.previewFeatured}>One cikan</Text> : null}
            </View>
          ))}
          <TouchableOpacity onPress={() => navigation.navigate('VenueArchive', { venueId })}>
            <Text style={styles.archiveLink}>
              {canManage ? 'Tam arsivi yonet' : 'Arsivi gor'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {venue.address ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adres</Text>
          <Text style={styles.body}>{venue.address}</Text>
        </View>
      ) : null}

      {venue.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hakkinda</Text>
          <Text style={styles.body}>{venue.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gunun Ritualsi</Text>
        <TouchableOpacity
          style={[styles.proButton, !proEnabled && styles.disabledBtn]}
          onPress={() => {
            if (!proEnabled) {
              Alert.alert('Bilgi', 'Bu panel OPERATÖR seviye metriklerinin gorunumudur.');
              return;
            }
            navigation.navigate('DSVenueProDashboard', {
              venueName: venue.name,
              venueId,
              venue,
              rituals: rituals,
            });
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.proButtonText}>OPERATÖR Gosterge Paneli</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.proButtonSecondary, !cityPartnerEnabled && styles.disabledBtnSecondary]}
          onPress={() => {
            if (!cityPartnerEnabled) {
              Alert.alert('Bilgi', 'Bu panel HAKİM seviye analizlerin gorunumudur.');
              return;
            }
            navigation.navigate('VenueCityPartner', { venueName: venue.name, venueId });
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.proButtonSecondaryText}>HAKİM Analiz Ekrani</Text>
        </TouchableOpacity>
        {rituals.length === 0 ? (
          <Text style={styles.muted}>Bu mekanda yaklasan Ritual yok.</Text>
        ) : (
          rituals.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.ritualRow}
              onPress={() => navigation.navigate('RitualDetail', { ritualId: r.id })}
              activeOpacity={0.8}
            >
              <View style={styles.ritualInfo}>
                <Text style={styles.ritualTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={styles.ritualMeta}>
                  {r.type || 'Ritual'} · {formatTime(r.start_time)} · {r.current_attendees || 0}/{r.capacity} koltuk
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={MUTED} />
            </TouchableOpacity>
          ))
        )}
      </View>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        reportType={reportType}
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: reportType,
              targetId: venueId,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
              queueLane: reportType === 'zone' ? 'ops' : null,
            });
            Alert.alert('Rapor', 'Kuyruğa alındı');
            setShowReport(false);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf9f6' },
  header: { marginBottom: 20 },
  presenceBanner: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  presenceTitle: { color: PRIMARY, fontSize: 15, fontWeight: '700' },
  presenceBody: {
    color: 'rgba(255,255,255,.7)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  heroPhoto: {
    height: 120,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroPhotoText: { color: '#6b7280', fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', color: TEXT },
  tagline: { fontSize: 15, color: MUTED, marginTop: 6, lineHeight: 20 },
  venueBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  venueBadgeChip: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#C8A96A',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  venueBadgeText: { fontSize: 12, color: '#111', fontWeight: '600' },
  city: { fontSize: 16, color: MUTED, marginTop: 4 },
  verifiedBadge: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#e8f5e9', borderRadius: 8 },
  verifiedText: { fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  regularProgressBox: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  regularProgressLabel: { fontSize: 14, fontWeight: '700', color: '#9a3412' },
  regularProgressHint: { fontSize: 12, color: '#78716c', marginTop: 2 },
  followBtn: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#f0f0ed', borderRadius: 10 },
  followBtnActive: { backgroundColor: PRIMARY },
  followBtnText: { fontSize: 15, fontWeight: '600', color: TEXT },
  followBtnTextActive: { color: '#fff' },
  manageBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#111',
    borderRadius: 10,
  },
  manageBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  manageBtnDark: { backgroundColor: PRIMARY },
  manageBtnSecondary: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  manageBtnSecondaryText: { color: TEXT, fontWeight: '600', fontSize: 14 },
  draftHint: { marginTop: 8, fontSize: 12, color: MUTED, fontStyle: 'italic' },
  mutedSmall: { fontSize: 12, color: MUTED, marginBottom: 10 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  lockedRowLocked: { opacity: 0.85, backgroundColor: '#f9f9f7' },
  lockedBody: { flex: 1 },
  lockedLabel: { fontSize: 14, fontWeight: '600', color: TEXT },
  lockedReason: { fontSize: 12, color: MUTED, marginTop: 2 },
  scoreRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  scoreCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scoreLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  scoreValue: { fontSize: 24, fontWeight: '700', color: TEXT, marginTop: 4 },
  scoreMeta: { fontSize: 11, color: MUTED, marginTop: 4 },
  seatingLabel: { marginTop: 10, fontSize: 13, fontWeight: '600', color: TEXT },
  distWrap: { marginTop: 8 },
  distRow: { fontSize: 12, color: MUTED, marginTop: 2 },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  previewText: { flex: 1, fontSize: 14, color: TEXT },
  previewFeatured: { fontSize: 11, color: PRIMARY, fontWeight: '700' },
  archiveLink: { marginTop: 10, fontSize: 14, fontWeight: '600', color: PRIMARY },
  rsBarWrap: { marginTop: 10 },
  rsLabel: { fontSize: 12, color: '#374151', fontWeight: '700', marginBottom: 6 },
  rsTrack: { height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  rsFill: { height: '100%', borderRadius: 4, backgroundColor: '#f59e0b' },
  tierText: { marginTop: 6, fontSize: 12, color: '#6b7280' },
  subscriptionCard: { marginTop: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  subscriptionTitle: { fontSize: 12, fontWeight: '800', color: '#111827', marginBottom: 6 },
  subscriptionRow: { fontSize: 12, color: '#111827', marginBottom: 4 },
  subscriptionRowMuted: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  subscriptionCurrent: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#374151' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: TEXT, marginBottom: 8 },
  proButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  proButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledBtn: { opacity: 0.6 },
  proButtonSecondary: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  proButtonSecondaryText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledBtnSecondary: { opacity: 0.6 },
  body: { fontSize: 15, color: MUTED, lineHeight: 22 },
  muted: { fontSize: 14, color: MUTED },
  ritualRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  ritualInfo: { flex: 1 },
  ritualTitle: { fontSize: 16, fontWeight: '600', color: TEXT },
  ritualMeta: { fontSize: 13, color: MUTED, marginTop: 2 },
});
