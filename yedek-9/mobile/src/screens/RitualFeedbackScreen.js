import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import ReportModal from '../components/ReportModal';
import { submitBatchFeedback, fetchRitualDetail, fetchFeedbackWindow, createModReport } from '../services/api';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import QRBumpSheet from '../components/QRBumpSheet';
import { t } from '../i18n/stringTable';
import useLanguageStore from '../store/languageStore';

const FL_LABELS = {
  l1: 'FL1',
  l2: 'FL2',
  l3: 'FL3',
  stranger: 'FL0',
};

const FEEDBACK_OPTIONS = {
  green: { label: 'Pozitif', symbol: '○' },
  yellow: { label: 'Gözlem', symbol: '·' },
  red: { label: 'Negatif', symbol: '□' },
};

const DEFAULT_SETS = {
  RQ_GREEN: ['rq_g_1', 'rq_g_2', 'rq_g_3', 'rq_g_4', 'rq_g_5'],
  RQ_YELLOW: ['rq_y_1', 'rq_y_2', 'rq_y_3', 'rq_y_4', 'rq_y_5'],
  RQ_RED: ['rq_r_1', 'rq_r_2', 'rq_r_3', 'rq_r_4', 'rq_r_5'],
  P2V_GREEN: ['p2v_g_1', 'p2v_g_2', 'p2v_g_3', 'p2v_g_4', 'p2v_g_5'],
  P2V_YELLOW: ['p2v_y_1', 'p2v_y_2', 'p2v_y_3', 'p2v_y_4', 'p2v_y_5'],
  P2V_RED: ['p2v_r_servis', 'p2v_r_gurultu', 'p2v_r_temizlik', 'p2v_r_ucret', 'p2v_r_masa'],
  P2Z_GREEN: ['p2z_g_1', 'p2z_g_2', 'p2z_g_3', 'p2z_g_4', 'p2z_g_5'],
  P2Z_YELLOW: ['p2z_y_1', 'p2z_y_2', 'p2z_y_3', 'p2z_y_4', 'p2z_y_5'],
  P2Z_RED: ['p2z_r_totem', 'p2z_r_1', 'p2z_r_guvenlik', 'p2z_r_temizlik', 'p2z_r_erisim'],
  P2C_GREEN: ['p2c_g_1', 'p2c_g_2', 'p2c_g_3', 'p2c_g_4', 'p2c_g_5'],
  P2C_YELLOW: ['p2c_y_1', 'p2c_y_2', 'p2c_y_3', 'p2c_y_4', 'p2c_y_5'],
  P2C_RED: ['p2c_r_1', 'p2c_r_2', 'p2c_r_3', 'p2c_r_4', 'p2c_r_5'],
  P2P_GREEN: ['p2p_g_1', 'p2p_g_2', 'p2p_g_3', 'p2p_g_4', 'p2p_g_5'],
  P2P_YELLOW: ['p2p_y_1', 'p2p_y_2', 'p2p_y_3', 'p2p_y_4', 'p2p_y_5'],
  P2P_RED: ['p2p_r_1', 'p2p_r_2', 'p2p_r_3', 'p2p_r_4', 'p2p_r_5'],
  K2_GREEN: ['k2_g_1', 'k2_g_2', 'k2_g_3', 'k2_g_4', 'k2_g_5'],
  K2_YELLOW: ['k2_y_1', 'k2_y_2', 'k2_y_3', 'k2_y_4', 'k2_y_5'],
  K2_RED: ['k2_r_1', 'k2_r_2', 'k2_r_3', 'k2_r_4', 'k2_r_5'],
  E_GREEN: ['e_g_1', 'e_g_2', 'e_g_3', 'e_g_4', 'e_g_5'],
  E_YELLOW: ['e_y_1', 'e_y_2', 'e_y_3', 'e_y_4'],
  E_RED: ['e_r_1', 'e_r_2', 'e_r_3', 'e_r_4', 'e_r_5'],
};

function chipColor(id) {
  const s = String(id || '');
  if (s.includes('_g_')) return 'green';
  if (s.includes('_y_')) return 'yellow';
  if (/(^|_)r_/.test(s) || s.includes('_r')) return 'red';
  return null;
}

function neighborOk(feeling, nextId, picked) {
  const first = picked[0];
  const c0 = first ? chipColor(first) : feeling;
  const c1 = chipColor(nextId);
  if ((c0 === 'green' && c1 === 'red') || (c0 === 'red' && c1 === 'green')) return false;
  return true;
}

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
  } else if (kind === 'P2P' || kind === 'K1') {
    key = feeling === 'red' ? 'P2P_RED' : feeling === 'yellow' ? 'P2P_YELLOW' : 'P2P_GREEN';
  } else if (kind === 'K2') {
    key = feeling === 'red' ? 'K2_RED' : feeling === 'yellow' ? 'K2_YELLOW' : 'K2_GREEN';
  } else if (kind === 'P2C') {
    key = feeling === 'red' ? 'P2C_RED' : feeling === 'yellow' ? 'P2C_YELLOW' : 'P2C_GREEN';
  } else if (kind === 'E') {
    key = feeling === 'red' ? 'E_RED' : feeling === 'yellow' ? 'E_YELLOW' : 'E_GREEN';
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
  useLanguageStore((s) => s.lang);
  const currentUserId = user?.id;
  const chipCfg = useConfigStore((s) => s.config?.chip) || {};
  const sets = chipCfg.sets || DEFAULT_SETS;
  const rotate = chipCfg.rotate !== false;
  const [ritualData, setRitualData] = useState(ritual || null);

  const [p2rRitualFeeling, setP2rRitualFeeling] = useState(null);
  const [p2rChips, setP2rChips] = useState([]);
  const [eventGeneralFeeling, setEventGeneralFeeling] = useState(null);
  const [eventGeneralChips, setEventGeneralChips] = useState([]);
  const [r1SelfFeeling, setR1SelfFeeling] = useState(null);
  const [venueFeeling, setVenueFeeling] = useState(null);
  const [venueChips, setVenueChips] = useState([]);
  const [zoneFeeling, setZoneFeeling] = useState(null);
  const [zoneChips, setZoneChips] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [participantRatings, setParticipantRatings] = useState({});
  const [feedbackWindow, setFeedbackWindow] = useState(null);
  const [windowError, setWindowError] = useState(null);
  const [showQrBump, setShowQrBump] = useState(false);
  const [cardIdx, setCardIdx] = useState(0);
  const [p2cFeeling, setP2cFeeling] = useState(null);
  const [p2cChips, setP2cChips] = useState([]);
  const [showSafety, setShowSafety] = useState(false);

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
  const p2cChipOptions = useMemo(
    () => chipIdsFor('P2C', p2cFeeling, sets, rotate, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p2cFeeling, currentUserId]
  );
  const eventChipOptions = useMemo(
    () => chipIdsFor('E', eventGeneralFeeling, sets, rotate, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventGeneralFeeling, currentUserId]
  );

  React.useEffect(() => {
    setP2rChips([]);
  }, [p2rRitualFeeling]);
  React.useEffect(() => {
    setVenueChips([]);
  }, [venueFeeling]);
  React.useEffect(() => {
    setZoneChips([]);
  }, [zoneFeeling]);
  React.useEffect(() => {
    setP2cChips([]);
  }, [p2cFeeling]);
  React.useEffect(() => {
    setEventGeneralChips([]);
  }, [eventGeneralFeeling]);

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

  const friendParticipants = (ritualData.participants || [])
    .filter((p) => {
      const uid = p?.id || p?.user_id;
      if (!uid || uid === currentUserId) return false;
      return p?.is_friend === true;
    })
    .slice(0, Number(chipCfg.p2p_max_people ?? 2));
  const hasVenuePlace = Boolean(venue || ritualData.venue_id || ritualData.venue_name);
  const hasZonePlace = Boolean(
    ritualData.zone_id ||
      ritualData.spark_born ||
      String(ritualData.location_type || '').toLowerCase() === 'zone'
  );
  const personCards = friendParticipants.map((_, i) => `person:${i}`);
  const isHost =
    ritualData.host_id === currentUserId ||
    ritualData.creator_id === currentUserId ||
    ritualData.created_by === currentUserId;
  const fbCards = [
    ...(isHost ? [] : ['fold']),
    ...(personCards.length ? personCards : ['people']),
    hasVenuePlace ? 'p2v' : hasZonePlace ? 'p2z' : 'p2c',
  ];
  if (feedbackWindow?.event_general_rq) fbCards.push('event');
  const activeCard = fbCards[Math.min(cardIdx, fbCards.length - 1)];

  const setParticipantQ = (uid, field, value) => {
    const key = String(uid);
    setParticipantRatings((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
        ...(field === 'q1' ? { chips: [] } : {}),
        ...(field === 'q2' ? { chips2: [] } : {}),
      },
    }));
  };

  const buildFeedbackPayload = () => {
    const feedbacks = [];

    if (p2rRitualFeeling && !isHost) {
      feedbacks.push({
        feedback_type: 'p2r',
        p2r_feeling: p2rRitualFeeling,
        chip_id: p2rChips[0] || undefined,
        chip_id_2: p2rChips[1] || undefined,
      });
    }

    if (eventGeneralFeeling && feedbackWindow?.event_general_rq) {
      feedbacks.push({
        feedback_type: 'rq_event',
        p2r_feeling: eventGeneralFeeling,
        chip_id: eventGeneralChips[0] || undefined,
        chip_id_2: eventGeneralChips[1] || undefined,
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
        chip_id: (ratings.chips || [])[0] || undefined,
        chip_id_2: (ratings.chips || [])[1] || undefined,
      });
    });

    const venueEntity = venue || (ritualData.venue_id || ritualData.venue_name
      ? { id: ritualData.venue_id, name: ritualData.venue_name || ritualData.location_name }
      : null);

    if (venueEntity && venueFeeling) {
      feedbacks.push({
        feedback_type: 'p2v',
        p2v_feeling: venueFeeling,
        chip_id: venueChips[0] || undefined,
        chip_id_2: venueChips[1] || undefined,
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
        chip_id: zoneChips[0] || undefined,
        chip_id_2: zoneChips[1] || undefined,
      });
    }

    if (p2cFeeling && !venueEntity && !isZoneRitual) {
      feedbacks.push({
        feedback_type: 'p2c',
        p2r_feeling: p2cFeeling,
        chip_id: p2cChips[0] || undefined,
        chip_id_2: p2cChips[1] || undefined,
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

  const renderOptionRow = (selectedValue, onSelect, { personCard = false } = {}) => (
    <View style={styles.optionRow}>
      {['green', 'yellow', 'red'].map((value) => {
        const option = FEEDBACK_OPTIONS[value];
        const selected = selectedValue === value;
        return (
          <TouchableOpacity
            key={value}
            style={[
              styles.optionButton,
              selected && styles.optionButtonOn,
            ]}
            onPress={() => onSelect(value)}
          >
            {personCard ? (
              <Text style={[styles.optionSymbol, selected && styles.optionSymbolOn]}>
                {option.symbol}
              </Text>
            ) : null}
            <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /** max-2 chip · ilk kategoriden · ikinci aynı/komşu · yeşil+kırmızı yok */
  const renderChipRow = (options, selected, onSelect, feeling) => {
    if (!options?.length) return null;
    const picked = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const toggle = (id) => {
      if (picked.includes(id)) {
        onSelect(picked.filter((x) => x !== id));
        return;
      }
      if (!neighborOk(feeling, id, picked)) return;
      if (picked.length >= 2) onSelect([picked[0], id]);
      else onSelect([...picked, id]);
    };
    return (
      <View style={styles.chipBlock}>
        <Text style={styles.chipHint}>Neden? (opsiyonel · en fazla 2)</Text>
        <View style={styles.chipRow}>
          {options.map((id) => {
            const on = picked.includes(id);
            return (
              <TouchableOpacity
                key={id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(id)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t(id)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={() => onSelect([])}>
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
          Kart {cardIdx + 1}/{fbCards.length} · P2P yalnizca arkadaslar. Window{' '}
          {feedbackWindow?.open ? 'acik' : 'kapali'}.
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

        {activeCard === 'fold' ? (
        <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {feedbackWindow?.event_general_rq ? t('fb_rq_table_q') : t('fb_rq_ritual_q')}
          </Text>
          <Text style={styles.sectionCaption}>
            {feedbackWindow?.event_general_rq
              ? 'Son-sub masa RQ · Aura aggregate'
              : 'Gecenin fotografi (RQ) · Aura kelimesi, Trust sayisi degil'}
          </Text>
          {renderOptionRow(p2rRitualFeeling, setP2rRitualFeeling)}
          {renderChipRow(p2rChipOptions, p2rChips, setP2rChips, p2rRitualFeeling)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>R1 — Peki senin icin?</Text>
          <Text style={styles.sectionCaption}>Kisisel mercek · atlanabilir · RS formulu disi</Text>
          {renderOptionRow(r1SelfFeeling, setR1SelfFeeling)}
        </View>
        </>
        ) : null}

        {activeCard === 'event' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('fb_event_general_q')}</Text>
            <Text style={styles.sectionCaption}>
              EVENT ek soru · geceyi ölçer · renk→max-2 chip · RS’e girmez
            </Text>
            {renderOptionRow(eventGeneralFeeling, setEventGeneralFeeling)}
            {renderChipRow(eventChipOptions, eventGeneralChips, setEventGeneralChips, eventGeneralFeeling)}
          </View>
        ) : null}

        {typeof activeCard === 'string' && activeCard.startsWith('person:') ? (
          (() => {
            const idx = Number(activeCard.split(':')[1]);
            const p = friendParticipants[idx];
            if (!p) return null;
            const uid = p.id || p.user_id;
            const key = String(uid);
            const fl = FL_LABELS[p.friend_level] || 'FL1';
            const ratings = participantRatings[key] || {};
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {p?.name || p?.user_name || 'Katilimci'} · {fl}
                </Text>
                <Text style={styles.sectionCaption}>
                  Q1 comfort · Q2 vibe — kelime/sembol · anonim · +/- yok
                </Text>
                <Text style={styles.sectionCaption}>Q1: Bu kisiyle etkilesim</Text>
                {renderOptionRow(ratings.q1 || null, (v) => setParticipantQ(uid, 'q1', v), {
                  personCard: true,
                })}
                {renderChipRow(
                  chipIdsFor('P2P', ratings.q1, sets, rotate, `${currentUserId}:${uid}`),
                  ratings.chips || [],
                  (next) => setParticipantQ(uid, 'chips', next),
                  ratings.q1
                )}
                <Text style={[styles.sectionCaption, { marginTop: 8 }]}>
                  Q2: {t('fb_k2_q')}
                </Text>
                {renderOptionRow(ratings.q2 || null, (v) => setParticipantQ(uid, 'q2', v), {
                  personCard: true,
                })}
                {renderChipRow(
                  chipIdsFor('K2', ratings.q2, sets, rotate, `${currentUserId}:${uid}:k2`),
                  ratings.chips2 || [],
                  (next) => setParticipantQ(uid, 'chips2', next),
                  ratings.q2
                )}
              </View>
            );
          })()
        ) : null}

        {activeCard === 'people' ? (
        friendParticipants.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2P — Arkadaslarinla uyum</Text>
            <Text style={styles.sectionCaption}>Q1 ve Q2 ayri puanlanir · en fazla 2 kisi</Text>
            {friendParticipants.map((p) => {
              const uid = p.id || p.user_id;
              const key = String(uid);
              const fl = FL_LABELS[p.friend_level] || 'FL1';
              const ratings = participantRatings[key] || {};
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <View style={styles.p2pHead}>
                    <Text style={styles.sectionCaption}>
                      {p?.name || p?.user_name || 'Katilimci'} · {fl}
                    </Text>
                  </View>
                  <Text style={styles.sectionCaption}>Q1: Bu kisiyle etkilesim</Text>
                  {renderOptionRow(ratings.q1 || null, (v) => setParticipantQ(uid, 'q1', v), {
                    personCard: true,
                  })}
                  {renderChipRow(
                    chipIdsFor('P2P', ratings.q1, sets, rotate, `${currentUserId}:${uid}`),
                    ratings.chips || [],
                    (next) => setParticipantQ(uid, 'chips', next),
                    ratings.q1
                  )}
                  <Text style={[styles.sectionCaption, { marginTop: 8 }]}>Q2: {t('fb_k2_q')}</Text>
                  {renderOptionRow(ratings.q2 || null, (v) => setParticipantQ(uid, 'q2', v), {
                    personCard: true,
                  })}
                  {renderChipRow(
                    chipIdsFor('K2', ratings.q2, sets, rotate, `${currentUserId}:${uid}:k2`),
                    ratings.chips2 || [],
                    (next) => setParticipantQ(uid, 'chips2', next),
                    ratings.q2
                  )}
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
                  isHost,
                })
              }
            >
              <Text style={styles.qrLinkTextSecondary}>Check-in listesinden ekle →</Text>
            </TouchableOpacity>
          </View>
        )
        ) : null}

        {activeCard === 'p2v' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2V — Mekan nasildi?</Text>
            <Text style={styles.sectionCaption}>Venue TRUST (RS&apos;e girmez)</Text>
            {renderOptionRow(venueFeeling, setVenueFeeling)}
            {renderChipRow(p2vChipOptions, venueChips, setVenueChips, venueFeeling)}
          </View>
        ) : null}

        {activeCard === 'p2z' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2Z — Zone'umu geliştir</Text>
            <Text style={styles.sectionCaption}>Gözlemlenen eksik · Aura veya ZONE-OPS · Trust yok</Text>
            {renderOptionRow(zoneFeeling, setZoneFeeling)}
            {renderChipRow(p2zChipOptions, zoneChips, setZoneChips, zoneFeeling)}
          </View>
        ) : null}

        {activeCard === 'p2c' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>P2C — Zemin nasildi?</Text>
            <Text style={styles.sectionCaption}>Arsiv kunyesi · hicbir skora girmez</Text>
            {renderOptionRow(p2cFeeling, setP2cFeeling)}
            {renderChipRow(p2cChipOptions, p2cChips, setP2cChips, p2cFeeling)}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
        {cardIdx > 0 ? (
          <TouchableOpacity
            style={[styles.submitButton, { flex: 1, backgroundColor: '#e5e7eb' }]}
            onPress={() => setCardIdx((i) => Math.max(0, i - 1))}
          >
            <Text style={[styles.submitLabel, { color: '#111' }]}>Onceki kart</Text>
          </TouchableOpacity>
        ) : null}
        {cardIdx < fbCards.length - 1 ? (
          <TouchableOpacity
            style={[styles.submitButton, { flex: 1 }]}
            onPress={() => setCardIdx((i) => Math.min(fbCards.length - 1, i + 1))}
          >
            <Text style={styles.submitLabel}>Sonraki kart</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, { flex: 1 }, (submitting || windowError) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !!windowError}
          >
            <Text style={styles.submitLabel}>
              {submitting ? 'Gonderiliyor…' : 'Geri Bildirimi Gonder'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={() => setShowSafety(true)} style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Text style={{ color: '#F4B000', fontWeight: '700' }}>{t('fb_safety')}</Text>
        <Text style={{ color: '#A1A1AA', fontSize: 12 }}>Kırmızı kategori şikayet değildir</Text>
      </TouchableOpacity>

      <QRBumpSheet visible={showQrBump} onClose={() => setShowQrBump(false)} />
      <ReportModal
        visible={showSafety}
        onClose={() => setShowSafety(false)}
        reportType="ritual"
        onReport={async (payload) => {
          await createModReport({
            targetType: 'ritual',
            targetId: ritualData.id,
            categoryKey: payload.category_key || 'guvenlik_bildir',
            details: payload.details,
          });
        }}
      />
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
    borderColor: '#2a2a30',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  optionButtonOn: {
    borderColor: COLORS.accent,
    backgroundColor: '#2a2208',
  },
  optionSymbol: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  optionSymbolOn: {
    color: COLORS.accent,
  },
  optionLabel: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  optionLabelOn: {
    color: COLORS.accent,
    fontWeight: '700',
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
