import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { submitBatchFeedback, fetchRitualDetail, fetchFeedbackWindow } from '../services/api';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import QRBumpSheet from '../components/QRBumpSheet';
import { t } from '../i18n/stringTable';

const FL_LABELS = {
  l1: 'FL1',
  l2: 'FL2',
  l3: 'FL3',
  stranger: 'FL0',
};

const FEEDBACK_OPTIONS = {
  green: { label: 'Rahat/Olumlu', color: '#1DB954' },
  yellow: { label: 'Notr', color: '#FFB300' },
  red: { label: 'Rahatsiz', color: '#E53935' },
};

const DEFAULT_SETS = {
  RQ_GREEN: ['rq_g_1', 'rq_g_2', 'rq_g_3'],
  RQ_YELLOW: ['rq_y_1', 'rq_y_2', 'rq_y_3'],
  RQ_RED: ['rq_r_1', 'rq_r_2', 'rq_r_3'],
  P2V_GREEN: ['p2v_g_1', 'p2v_g_2', 'p2v_g_3', 'p2v_g_4', 'p2v_g_5'],
  P2V_YELLOW: ['p2v_y_1', 'p2v_y_2', 'p2v_y_3', 'p2v_y_4', 'p2v_y_5'],
  P2V_RED: ['p2v_r_servis', 'p2v_r_gurultu', 'p2v_r_temizlik', 'p2v_r_ucret', 'p2v_r_masa'],
  P2Z_GREEN: ['p2z_g_1', 'p2z_g_2'],
  P2Z_YELLOW: ['p2z_y_1', 'p2z_y_2'],
  P2Z_RED: ['p2z_r_1', 'p2z_r_marker'],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededShuffle(arr, seedText) {
  const a = [...arr];
  let seed = 0;
  const t = String(seedText || 'seed');
  for (let i = 0; i < t.length; i++) {
    seed = (seed * 31 + t.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chipIdsFor(kind, feeling, sets, rotate, userSeed) {
  if (!feeling) return [];
  let key = null;
  if (kind === 'P2V') {
    key = feeling === 'red' ? 'P2V_RED' : feeling === 'yellow' ? 'P2V_YELLOW' : 'P2V_GREEN';
  } else if (kind === 'P2Z') {
    key = feeling === 'red' ? 'P2Z_RED' : feeling === 'yellow' ? 'P2Z_YELLOW' : 'P2Z_GREEN';
  } else {
    key = feeling === 'red' ? 'RQ_RED' : feeling === 'yellow' ? 'RQ_YELLOW' : 'RQ_GREEN';
  }
  const list = [...(sets?.[key] || DEFAULT_SETS[key] || [])];
  if (rotate === false) return list;
  if (!userSeed) return shuffle(list);
  return seededShuffle(list, `${userSeed}:${key}`);
}

export default function RitualFeedbackScreen({ route, navigation }) {
  const { ritual, venue, ritualId } = route.params || {};
  const { user } = useAuthStore();
  const currentUserId = user?.id;
  const chipCfg = useConfigStore((s) => s.config?.chip) || {};
  const sets = chipCfg.sets || DEFAULT_SETS;
  const rotate = chipCfg.rotate !== false;
  const [ritualData, setRitualData] = useState(ritual || null);

  const [p2rRitualFeeling, setP2rRitualFeeling] = useState(null);
  const [p2rChip, setP2rChip] = useState(null);
  const [eventGeneralFeeling, setEventGeneralFeeling] = useState(null);
  const [r1SelfFeeling, setR1SelfFeeling] = useState(null);
  const [venueFeeling, setVenueFeeling] = useState(null);
  const [venueChip, setVenueChip] = useState(null);
  const [zoneFeeling, setZoneFeeling] = useState(null);
  const [zoneChip, setZoneChip] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [participantRatings, setParticipantRatings] = useState({});
  const [feedbackWindow, setFeedbackWindow] = useState(null);
  const [windowError, setWindowError] = useState(null);
  const [showQrBump, setShowQrBump] = useState(false);

  const p2rChipOptions = useMemo(
    () => chipIdsFor('RQ', p2rRitualFeeling, sets, rotate, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p2rRitualFeeling, currentUserId]
  );
  const p2vChipOptions = useMemo(
    () => chipIdsFor('P2V', venueFeeling, sets, rotate, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venueFeeling, currentUserId]
  );
  const p2zChipOptions = useMemo(
    () => chipIdsFor('P2Z', zoneFeeling, sets, rotate, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoneFeeling, currentUserId]
  );

  React.useEffect(() => {
    setP2rChip(null);
  }, [p2rRitualFeeling]);
  React.useEffect(() => {
    setVenueChip(null);
  }, [venueFeeling]);
  React.useEffect(() => {
    setZoneChip(null);
  }, [zoneFeeling]);

  React.useEffect(() => {
    if (ritualData || !ritualId || !currentUserId) return;
    let cancelled = false;
    fetchRitualDetail(ritualId, currentUserId)
      .then((data) => {
        if (!cancelled && data?.id) setRitualData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ritualId, ritualData, currentUserId]);

  React.useEffect(() => {
    if (!ritualData?.id) return;
    let cancelled = false;
    fetchFeedbackWindow(ritualData.id)
      .then((win) => {
        if (!cancelled) {
          setFeedbackWindow(win);
          if (!win?.open) setWindowError('Geri bildirim Window kapandi.');
        }
      })
      .catch((e) => {
        if (!cancelled) setWindowError(e?.message || 'Geri bildirim Window kullanilamiyor.');
      });
    return () => {
      cancelled = true;
    };
  }, [ritualData?.id]);

  if (!ritualData || !currentUserId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerText}>Geri bildirim su an kullanilamiyor.</Text>
      </View>
    );
  }

  const hostId = ritualData.host?.id || ritualData.host_id;
  const friendParticipants = (ritualData.participants || []).filter((p) => {
    const uid = p?.id || p?.user_id;
    if (!uid || uid === currentUserId) return false;
    if (uid === hostId) return false;
    return p?.is_friend === true;
  });

  const setParticipantQ = (uid, field, value) => {
    const key = String(uid);
    setParticipantRatings((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  };

  const buildFeedbackPayload = () => {
    const feedbacks = [];

    if (p2rRitualFeeling) {
      feedbacks.push({
        feedback_type: 'p2r',
        p2r_feeling: p2rRitualFeeling,
        chip_id: p2rChip || undefined,
      });
    }

    if (eventGeneralFeeling && feedbackWindow?.event_general_rq) {
      feedbacks.push({
        feedback_type: 'rq_event',
        p2r_feeling: eventGeneralFeeling,
      });
    }

    if (r1SelfFeeling) {
      feedbacks.push({
        feedback_type: 'r1_self',
        r1_self: r1SelfFeeling,
      });
    }

    friendParticipants.forEach((p) => {
      const uid = p.id || p.user_id;
      const ratings = participantRatings[String(uid)] || {};
      if (!ratings.q1 && !ratings.q2) return;
      feedbacks.push({
        feedback_type: 'p2p',
        to_user_id: uid,
        q1_comfort: ratings.q1,
        q2_energy: ratings.q2,
      });
    });

    const venueEntity = venue || (ritualData.venue_id || ritualData.venue_name
      ? { id: ritualData.venue_id, name: ritualData.venue_name || ritualData.location_name }
      : null);

    if (venueEntity && venueFeeling) {
      feedbacks.push({
        feedback_type: 'p2v',
        p2v_feeling: venueFeeling,
        chip_id: venueChip || undefined,
      });
    }

    const isZoneRitual = Boolean(
      ritualData.zone_id ||
        ritualData.spark_born ||
        String(ritualData.location_type || '').toLowerCase() === 'zone'
    );
    if (isZoneRitual && zoneFeeling) {
      feedbacks.push({
        feedback_type: 'p2z',
        p2r_feeling: zoneFeeling,
        chip_id: zoneChip || undefined,
      });
    }

    return feedbacks;
  };

  const handleSubmit = async () => {
    if (windowError || (feedbackWindow && !feedbackWindow.open)) {
      Alert.alert('Window kapali', windowError || 'Geri bildirim Window kapandi.');
      return;
    }

    const feedbacks = buildFeedbackPayload();

    if (feedbacks.length === 0) {
      Alert.alert('Feedback', 'En az bir soruyu yanitlaman gerekiyor.');
      return;
    }

    try {
      setSubmitting(true);
      await submitBatchFeedback(ritualData.id, currentUserId, feedbacks);
      Alert.alert('Tesekkurler', 'Geri bildirimin kaydedildi.', [
        {
          text: 'Tamam',
          onPress: () =>
            navigation.replace('RitualComplete', {
              ritualId: ritualData.id,
              ritual: ritualData,
            }),
        },
      ]);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Geri bildirim gonderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderOptionRow = (selectedValue, onSelect) => (
    <View style={styles.optionRow}>
      {['green', 'yellow', 'red'].map((value) => {
        const option = FEEDBACK_OPTIONS[value];
        const selected = selectedValue === value;
        return (
          <TouchableOpacity
            key={value}
            style={[
              styles.optionButton,
              { borderColor: option.color },
              selected && { backgroundColor: option.color + '33' },
            ]}
            onPress={() => onSelect(value)}
          >
            <View
              style={[
                styles.optionDot,
                { borderColor: option.color },
                selected && { backgroundColor: option.color },
              ]}
            />
            <Text style={styles.optionLabel}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /** §10 — opsiyonel tek seçim chip satırı; atlamak serbest */
  const renderChipRow = (options, selected, onSelect) => {
    if (!options?.length) return null;
    return (
      <View style={styles.chipBlock}>
        <Text style={styles.chipHint}>Neden? (opsiyonel · tek secim)</Text>
        <View style={styles.chipRow}>
          {options.map((id) => {
            const on = selected === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => onSelect(on ? null : id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(id)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => onSelect(null)}>
          <Text style={styles.chipSkip}>Atla</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Deneyimini Paylas</Text>
        <Text style={styles.subtitle}>
          P2P yalnizca arkadaslar icin. Window {feedbackWindow?.open ? 'acik' : 'kapali'}.
        </Text>

        {feedbackWindow?.open ? (
          <Text style={styles.windowHint}>
            Kalan sure: ~{feedbackWindow.minutes_remaining || 0} dk
          </Text>
        ) : null}
        {windowError ? <Text style={styles.windowError}>{windowError}</Text> : null}

        <View style={styles.ritualCard}>
          <Text style={styles.ritualTitle}>{ritualData.title}</Text>
          {!!ritualData.venue_name && (
            <Text style={styles.ritualMeta}>{ritualData.venue_name}</Text>
          )}
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {feedbackWindow?.event_general_rq ? t('fb_rq_table_q') : t('fb_rq_ritual_q')}
            </Text>
          <Text style={styles.sectionCaption}>
            {feedbackWindow?.event_general_rq
              ? 'Son-sub masa RQ · Aura aggregate'
              : 'RS (CF/IQ) + venue AURA aggregate'}
          </Text>
          {renderOptionRow(p2rRitualFeeling, setP2rRitualFeeling)}
          {renderChipRow(p2rChipOptions, p2rChip, setP2rChip)}
        </View>

        {feedbackWindow?.event_general_rq ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('fb_event_general_q')}</Text>
            <Text style={styles.sectionCaption}>
              EVENT ek soru · geceyi ölçer · chip yok · RS’e girmez
            </Text>
            {renderOptionRow(eventGeneralFeeling, setEventGeneralFeeling)}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>R1 — Kendine nasil hissettin?</Text>
          <Text style={styles.sectionCaption}>CF_self (RS)</Text>
          {renderOptionRow(r1SelfFeeling, setR1SelfFeeling)}
        </View>

        {friendParticipants.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2P — Arkadaslarinla uyum</Text>
            <Text style={styles.sectionCaption}>Q1 ve Q2 ayri puanlanir.</Text>
            {friendParticipants.slice(0, 6).map((p) => {
              const uid = p.id || p.user_id;
              const key = String(uid);
              const fl = FL_LABELS[p.friend_level] || 'FL1';
              const ratings = participantRatings[key] || {};
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <View style={styles.p2pHead}>
                    <Text style={styles.sectionCaption}>
                      {p?.name || p?.user_name || 'Katilimci'} · {fl}
                      {p.fb_count ? ` (${p.fb_count} fb)` : ''}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('ParticipantFeedback', {
                          ritualId: ritualData.id,
                          participant: p,
                        })
                      }
                    >
                      <Text style={styles.p2pDetailLink}>Detayli P2P →</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.sectionCaption}>Q1: Bu kisiyle etkilesim</Text>
                  {renderOptionRow(ratings.q1 || null, (v) => setParticipantQ(uid, 'q1', v))}
                  <Text style={[styles.sectionCaption, { marginTop: 8 }]}>Q2: Grup enerjisine uyum</Text>
                  {renderOptionRow(ratings.q2 || null, (v) => setParticipantQ(uid, 'q2', v))}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionCaption}>
              Bu Ritualde P2P icin uygun arkadas katilimci yok.
            </Text>
            <TouchableOpacity style={styles.qrLinkBtn} onPress={() => setShowQrBump(true)}>
              <Text style={styles.qrLinkText}>QR-Bump ile arkadas ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.qrLinkBtnSecondary}
              onPress={() =>
                navigation.navigate('RitualAttendees', {
                  ritualId: ritualData.id,
                  participants: ritualData.participants || [],
                  viewerId: currentUserId,
                  isHost: ritualData.host_id === currentUserId,
                })
              }
            >
              <Text style={styles.qrLinkTextSecondary}>Check-in listesinden ekle →</Text>
            </TouchableOpacity>
          </View>
        )}

        {((venue || ritualData.venue_id || ritualData.venue_name) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2V — Mekan nasildi?</Text>
            <Text style={styles.sectionCaption}>Venue TRUST (RS&apos;e girmez)</Text>
            {!!(venue?.name || ritualData.venue_name || ritualData.location_name) && (
              <Text style={styles.venueName}>
                {venue?.name || ritualData.venue_name || ritualData.location_name}
              </Text>
            )}
            {renderOptionRow(venueFeeling, setVenueFeeling)}
            {renderChipRow(p2vChipOptions, venueChip, setVenueChip)}
          </View>
        ))}

        {(ritualData.zone_id ||
          ritualData.spark_born ||
          String(ritualData.location_type || '').toLowerCase() === 'zone') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2Z — Zone nasildi?</Text>
            <Text style={styles.sectionCaption}>Zone Aura · kisa set · marker ops</Text>
            {renderOptionRow(zoneFeeling, setZoneFeeling)}
            {renderChipRow(p2zChipOptions, zoneChip, setZoneChip)}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.submitButton, (submitting || windowError) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !!windowError}
      >
        <Text style={styles.submitLabel}>
          {submitting ? 'Gonderiliyor…' : 'Geri Bildirimi Gonder'}
        </Text>
      </TouchableOpacity>

      <QRBumpSheet visible={showQrBump} onClose={() => setShowQrBump(false)} />
    </View>
  );
}

const COLORS = {
  background: '#050608',
  card: '#15151A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  accent: '#F4B000',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  centerText: {
    color: COLORS.textSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  windowHint: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.accent,
  },
  windowError: {
    marginTop: 6,
    fontSize: 12,
    color: '#E53935',
  },
  ritualCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
  },
  ritualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  ritualMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  sectionCaption: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  p2pHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  p2pDetailLink: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  qrLinkBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  qrLinkText: { fontWeight: '700', color: '#111', fontSize: 13 },
  qrLinkBtnSecondary: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  qrLinkTextSecondary: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  venueName: {
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  chipBlock: { marginTop: 12 },
  chipHint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a30',
    backgroundColor: '#111111',
  },
  chipOn: { borderColor: COLORS.accent, backgroundColor: '#2a2208' },
  chipText: { fontSize: 11, color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.accent, fontWeight: '700' },
  chipSkip: { marginTop: 8, fontSize: 12, color: COLORS.textSecondary, textDecorationLine: 'underline' },
  submitButton: {
    margin: 16,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
});
