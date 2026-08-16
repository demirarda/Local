import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import { checkIn, createLocalCheckinTag, fetchRitualDetail, redeemLocalCheckinTag, recordCheckinFunnelClient } from '../services/api';
import { replaceWithLiveRitual } from '../utils/liveRitualNav';
import { describeNfcFailure, isNfcModuleAvailable, readTotemTag } from '../utils/nfcTotem';
import {
  formatCheckinStatusLabel,
  formatSecondsCountdown,
  getCheckinWindowInfo,
  getViewerCheckedIn,
} from '../utils/checkinWindow';
import { buildCompassHint } from '../utils/geoCompass';
import NeutralNoShowCard from '../components/NeutralNoShowCard';
import LocalTagQr from '../components/LocalTagQr';
import { buildCheckinIntegrity } from '../utils/checkinIntegrity';
import { t } from '../i18n/stringTable';

export default function RitualCheckInScreen({ route, navigation }) {
  const { ritual: initialRitual, ritualId: paramRitualId, instantUnified } = route.params || {};
  const { user } = useAuthStore();
  const [ritual, setRitual] = useState(initialRitual || null);
  const ritualId = ritual?.id || paramRitualId;
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);
  const [coords, setCoords] = useState(null);
  const [locError, setLocError] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [precheck, setPrecheck] = useState(null);
  const [lockedUntilMs, setLockedUntilMs] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [localTagToken, setLocalTagToken] = useState('');
  const [issuedLocalTag, setIssuedLocalTag] = useState(null);
  const [localTagStatus, setLocalTagStatus] = useState(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [openNote, setOpenNote] = useState('');
  const [heading, setHeading] = useState(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [digitalPaste, setDigitalPaste] = useState(false);
  const [localTagRedeem, setLocalTagRedeem] = useState(false);
  const [culturePath, setCulturePath] = useState('say'); // say | show | local_tag
  const [codeStartedAt, setCodeStartedAt] = useState(null);
  const nfcAvailable = isNfcModuleAvailable();
  const isInstantUnified =
    Boolean(instantUnified) || String(ritual?.time_type || '').toLowerCase() === 'instant';
  const sealedRef = useRef(false);
  const androidGpsEduShown = useRef(false);
  const gateOpenedAtRef = useRef(Date.now());
  const androidLocationEducation =
    useConfigStore((s) => s.config?.checkin?.android_location_education) ||
    'Beton kanyonlarda GPS sapar. Hassas konum izni mühür için gerekli — yaklaşık konum yetmez. Kapı önünde durun.';

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ritualId || !user?.id) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const fresh = await fetchRitualDetail(ritualId, user.id);
        if (!cancelled && fresh) setRitual(fresh);
      } catch (_e) {
        // keep cached ritual
      }
    };
    refresh();
    const poll = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [ritualId, user?.id]);

  useEffect(() => {
    if (ritual && getViewerCheckedIn(ritual, user?.id)) {
      sealedRef.current = true;
      replaceWithLiveRitual(navigation, { ritualId: ritual.id || ritualId });
    }
  }, [ritual, user?.id, navigation, ritualId]);

  useEffect(() => {
    if (!ritualId) return undefined;
    gateOpenedAtRef.current = Date.now();
    void recordCheckinFunnelClient(ritualId, 'door_view', { surface: 'gate' });
    return () => {
      if (!sealedRef.current) {
        void recordCheckinFunnelClient(ritualId, 'door_abandon', { surface: 'gate' });
      }
    };
  }, [ritualId]);

  const refreshGps = async () => {
    try {
      setLocLoading(true);
      if (Platform.OS === 'android' && !androidGpsEduShown.current) {
        androidGpsEduShown.current = true;
        await new Promise((resolve) => {
          Alert.alert('Konum izni (Android)', androidLocationEducation, [
            { text: 'Devam', onPress: resolve },
          ]);
        });
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Konum izni gerekli — T1: kod yolu acik, muhur PENDING olur');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const mocked =
        pos?.mocked === true ||
        pos?.coords?.mocked === true ||
        // Expo: some platforms surface mock via accuracy flags
        Boolean(pos?.coords?.accuracy != null && pos.coords.accuracy < 0);
      const next = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        mock_location: mocked,
      };
      setCoords(next);
      setLocError(null);
      return next;
    } catch (e) {
      setLocError(e?.message || 'GPS alinamadi — T1: anahtar acik, muhur PENDING');
      return null;
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const next = await refreshGps();
      if (!mounted) return;
      void next;
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let subscription = null;
    let cancelled = false;
    (async () => {
      try {
        subscription = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const deg = h?.trueHeading >= 0 ? h.trueHeading : h?.magHeading;
          if (Number.isFinite(deg)) setHeading(deg);
        });
      } catch (_e) {
        // pusula yoksa yön ipucu mutlak (kuzey referansli) kalir
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  const doorInfo = useMemo(
    () => getCheckinWindowInfo(ritual, nowMs),
    [ritual, nowMs]
  );

  const statusBanner = useMemo(
    () => formatCheckinStatusLabel(ritual, nowMs),
    [ritual, nowMs]
  );

  const ritualStarted = doorInfo.ritual_started;
  const earlyWindow = doorInfo.early_window;
  const screenOpen = ritualStarted || earlyWindow;
  const tableOpen = Boolean(ritual?.checkin_keyword || ritual?.first_sealed_at || doorInfo.table_open);
  const codeBanned = Boolean(doorInfo.code_banned) || (Boolean(ritual?.first_sealed_at) && !ritual?.checkin_keyword);
  const canFirstSeal = Boolean(doorInfo.can_first_seal) || (doorInfo.door_open && !tableOpen);
  const codeActive = doorInfo.door_open && (tableOpen || canFirstSeal);
  const needsCode = tableOpen && !codeBanned;
  const tableLabel = ritual?.location_name || ritual?.venue_name || ritual?.zone_name || 'Masa';
  const hostLabel = ritual?.host_name || ritual?.host_user_name || 'Host';
  const tableCount =
    ritual?.current_attendees ??
    ritual?.attendance_count ??
    (Array.isArray(ritual?.participants) ? ritual.participants.length : null);
  const arrivals = useMemo(() => {
    const participants = Array.isArray(ritual?.participants) ? ritual.participants : [];
    const openerId = ritual?.first_sealed_by;
    return participants
      .filter((p) => p?.checkin_phase === 'sealed' || p?.checkin_at)
      .slice(-6)
      .map((p) => {
        const name = p?.name || p?.user_name || 'Katilimci';
        const isOpener =
          p?.is_opener ||
          (openerId && String(p?.id || p?.user_id) === String(openerId));
        return isOpener ? `${name} (masayi acti)` : name;
      });
  }, [ritual?.participants, ritual?.first_sealed_by]);

  const pendingArrivals = useMemo(() => {
    const participants = Array.isArray(ritual?.participants) ? ritual.participants : [];
    return participants
      .filter((p) => p?.checkin_phase === 'pending_witness' || p?.pending_witness)
      .map((p) => p?.name || p?.user_name || 'Katilimci');
  }, [ritual?.participants]);
  const lockRemainingSec =
    lockedUntilMs && lockedUntilMs > nowMs
      ? Math.ceil((lockedUntilMs - nowMs) / 1000)
      : 0;
  const isLocked = lockRemainingSec > 0;

  const findNote = ritual?.find_note || null;
  const tableOpenNote = ritual?.open_note || null;
  const checkinRadius = Number(ritual?.check_in_radius) || 75;
  const compass = useMemo(
    () =>
      buildCompassHint({
        from: coords,
        to:
          Number.isFinite(Number(ritual?.location_lat)) &&
          Number.isFinite(Number(ritual?.location_lng))
            ? {
                latitude: Number(ritual.location_lat),
                longitude: Number(ritual.location_lng),
              }
            : null,
        heading,
      }),
    [coords, ritual?.location_lat, ritual?.location_lng, heading]
  );
  /** 🔴 = precheck radius disi dedi ya da yerel mesafe yaricapi asiyor */
  const outsideRadius =
    precheck?.gps_ok === false ||
    (compass != null && compass.distance_m > checkinRadius);

  const localTagExpiresInSec =
    issuedLocalTag?.expires_at != null
      ? Math.max(0, Math.ceil((new Date(issuedLocalTag.expires_at).getTime() - nowMs) / 1000))
      : 0;
  const localTagExpired = Boolean(issuedLocalTag) && localTagExpiresInSec <= 0;

  const handleCheckIn = async () => {
    if (isLocked) {
      Alert.alert('Bekle', `${lockRemainingSec} sn sonra tekrar deneyebilirsin.`);
      return;
    }
    if (outsideRadius) {
      Alert.alert(
        'Kapı kapalı',
        `Yarıçap dışındasın${
          compass?.distance_label ? ` (${compass.distance_label})` : ''
        }. Masaya yaklaş — pusula yönü gösterir.`
      );
      return;
    }
    if (!doorInfo.door_open) {
      Alert.alert(
        earlyWindow || ritualStarted ? 'Kapi kapandi' : 'Henuz erken',
        earlyWindow || ritualStarted
          ? 'Gec check-in artik mumkun degil (no-show).'
          : `Check-in start−15'te acilir · ${formatSecondsCountdown(doorInfo.seconds_until_start)}`
      );
      return;
    }
    // T1: GPS yoksa da anahtar (kod / firstSeal) acik — muhur PENDING_WITNESS
    if (!coords && needsCode && !/^\d{3}$/.test(keyword)) {
      Alert.alert('GPS / Kod', 'Konum yok (T1). 3 haneli kodu gir — tanik onayi gerekir.');
      return;
    }
    if (needsCode && !/^\d{3}$/.test(keyword)) {
      Alert.alert('Kod gerekli', 'Masadaki 3 haneli kodu gir (veya LOCAL-TAG / NFC).');
      return;
    }
    try {
      setLoading(true);
      const entryMs =
        codeStartedAt != null ? Math.max(0, Date.now() - codeStartedAt) : null;
      const integrity = buildCheckinIntegrity({ mockLocation: Boolean(coords?.mock_location) });
      const result = await checkIn(ritualId, user?.id, {
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        checkin_code: keyword,
        open_note: canFirstSeal && openNote.trim() ? openNote.trim().slice(0, 120) : null,
        mock_location: integrity.mock_location,
        play_integrity: integrity.play_integrity,
        app_attest: integrity.app_attest,
        root: integrity.root,
        location_suspect: Boolean(integrity.mock_location) || !coords,
        digital_paste: digitalPaste && !localTagRedeem,
        local_tag_redeem: localTagRedeem,
        entry_ms: localTagRedeem || canFirstSeal ? null : entryMs,
        gate_ms: Math.max(0, Date.now() - gateOpenedAtRef.current),
        culture_path: culturePath,
      });
      if (result?.precheck_only || result?.data?.precheck_only) {
        setPrecheck(result?.data || result);
        return;
      }
      if (result?.pending_witness || result?.data?.pending_witness) {
        Alert.alert(
          'Tanık onayı',
          'GPS sinyali doğrulanıyor. Masadaki mühürlü bir katılımcı seni onaylayana kadar bekle.'
        );
        return;
      }
      const ais = result?.ais ?? result?.data?.ais_score;
      const openerId = ritual?.first_sealed_by || user?.id;
      const iOpened = canFirstSeal || String(openerId) === String(user?.id);
      if (iOpened) {
        Alert.alert(t('first_seal_opened'), 'Sen açtın · kod doğdu');
      }
      sealedRef.current = true;
      replaceWithLiveRitual(navigation, {
        ritualId,
        checkinAis: ais,
      });
    } catch (e) {
      const body = e?.body || {};
      if (body.door_closed_outside || body.code === 'OUTSIDE_RADIUS') {
        setPrecheck({
          gps_ok: false,
          distance_m: body.distance_meters,
          max_distance_m: body.max_distance_meters,
        });
        Alert.alert(
          'Kapı kapalı',
          `Yarıçap dışındasın (${body.distance_meters ?? '?'}m). ${
            body.sealed_at_table != null ? `${body.sealed_at_table} kişi.` : ''
          }`
        );
        return;
      }
      if (body.code === 'DIGITAL_RELAY_FORBIDDEN') {
        Alert.alert(
          'Dijital yollama yasak',
          'Kodu DM/mesaj ile alma. Masada sor, ekranı göster veya LOCAL-TAG / NFC kullan.'
        );
        setDigitalPaste(false);
        return;
      }
      if (body.door_closed || body.neutral_card) {
        Alert.alert('Katılamadın', 'Giriş kapısı kapandı. Bu nötr bir kayıttır.');
        return;
      }
      if (body.locked_until) {
        setLockedUntilMs(new Date(body.locked_until).getTime());
      }
      if (body.attempts_remaining != null) {
        setAttemptsLeft(body.attempts_remaining);
      }
      const msg =
        body.locked_until
          ? `3 yanlis deneme · ${body.retry_wait_s || 30} sn bekle`
          : e?.message || 'Check-in tamamlanamadi.';
      Alert.alert('Check-in basarisiz', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemLocalTag = async (overrideToken) => {
    if (!ritualId) return;
    const token = String(overrideToken || localTagToken || '').trim();
    if (!token) {
      setLocalTagStatus({ tone: 'bad', text: 'Token bos — masadakinin ekranindaki kodu gir.' });
      return;
    }
    try {
      let pos = coords;
      if (!pos) pos = await refreshGps();
      const data = await redeemLocalCheckinTag(ritualId, token, {
        latitude: pos?.latitude,
        longitude: pos?.longitude,
      });
      const code = String(data?.checkin_keyword || '').trim();
      if (code) {
        setKeyword(code);
        setDigitalPaste(false);
        setLocalTagRedeem(true);
        setLocalTagStatus({ tone: 'ok', text: 'Fiziksel LOCAL-TAG dogrulandi · kod yerlestirildi.' });
      } else {
        setLocalTagStatus({ tone: 'ok', text: 'Token dogrulandi.' });
      }
      setLocalTagToken('');
    } catch (e) {
      const code = e?.body?.code;
      if (code === 'DIGITAL_RELAY_FORBIDDEN') {
        setLocalTagStatus({
          tone: 'bad',
          text: 'Uzakta — dijital yollama yasak. Yanina yaklas.',
        });
      } else {
        setLocalTagStatus({ tone: 'bad', text: e?.message || 'Token gecersiz veya suresi doldu.' });
      }
    }
  };

  const handleCreateLocalTag = async () => {
    if (!ritualId) return;
    try {
      const data = await createLocalCheckinTag(ritualId);
      const token = String(data?.token || '').trim();
      if (!token) {
        setLocalTagStatus({ tone: 'bad', text: 'Token uretilemedi.' });
        return;
      }
      setIssuedLocalTag({
        token,
        expires_at: data?.expires_at || new Date(Date.now() + (data?.ttl_s || 30) * 1000).toISOString(),
      });
      setLocalTagStatus({ tone: 'ok', text: 'Tek kullanim token olusturuldu.' });
    } catch (e) {
      setLocalTagStatus({ tone: 'bad', text: e?.message || 'Token olusturulamadi' });
    }
  };

  const handleMarkerCheckIn = async () => {
    if (!doorInfo.door_open) return;
    // Kısayol yalnız gerçek etiket temasıyla açılır — okunamazsa ana kültür (kod) kalır
    setNfcScanning(true);
    let scan;
    try {
      scan = await readTotemTag();
    } finally {
      setNfcScanning(false);
    }
    if (!scan?.ok) {
      Alert.alert('NFC/Totem', describeNfcFailure(scan?.reason));
      return;
    }
    try {
      setLoading(true);
      const integrity = buildCheckinIntegrity({ mockLocation: Boolean(coords?.mock_location) });
      const result = await checkIn(ritualId, user?.id, {
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        nfc_marker: true,
        nfc_tag_id: scan.tagId,
        mock_location: integrity.mock_location,
        play_integrity: integrity.play_integrity,
        app_attest: integrity.app_attest,
        root: integrity.root,
        location_suspect: Boolean(integrity.mock_location) || !coords,
        gate_ms: Math.max(0, Date.now() - gateOpenedAtRef.current),
        culture_path: 'nfc',
      });
      if (result?.pending_witness || result?.data?.pending_witness) {
        Alert.alert('Tanık onayı', 'Marker denemesi alindi; tanik onayi bekleniyor.');
        return;
      }
      sealedRef.current = true;
      replaceWithLiveRitual(navigation, { ritualId });
    } catch (e) {
      Alert.alert('NFC/Marker', e?.message || 'Marker check-in basarisiz');
    } finally {
      setLoading(false);
    }
  };

  const appendDigit = (n) => {
    if (!codeActive || isLocked) return;
    setDigitalPaste(false);
    setLocalTagRedeem(false);
    setCodeStartedAt((prev) => prev ?? Date.now());
    setKeyword((prev) => (prev.length < 3 ? `${prev}${n}` : prev));
  };

  const onCodeTextChange = (text) => {
    const digits = String(text || '').replace(/\D/g, '').slice(0, 3);
    // Paste/autofill: birden fazla hane bir anda geldi
    if (digits.length - keyword.length > 1 || (keyword.length === 0 && digits.length === 3)) {
      setDigitalPaste(true);
    }
    if (!codeStartedAt) setCodeStartedAt(Date.now());
    setLocalTagRedeem(false);
    setKeyword(digits);
  };

  if (!ritual && !ritualId) {
    return (
      <View style={styles.center}>
        <Text style={styles.statusBad}>Ritual bulunamadi</Text>
      </View>
    );
  }

  if (!screenOpen) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Check-in</Text>
          <View style={{ width: 18 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.waitCard}>
            <Text style={styles.waitTitle}>Check-in henuz acilmadi</Text>
            <Text style={styles.waitBody}>
              Ekran start − 15 dk acilir. GPS on-dogrulama yapilir; kod alani start'a kadar pasif kalir.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check-in</Text>
        <View style={{ width: 18 }} />
      </View>
      <View style={styles.content}>
        <View style={styles.liveBanner}>
          <Text style={styles.liveBannerTitle}>{statusBanner}</Text>
          {isInstantUnified ? (
            <View style={styles.instantStrip}>
              <Text style={styles.waitBody}>Anlık masa · prelobby + kapı birleşik</Text>
              <Text style={styles.liveBannerSub}>
                Kadro {tableCount != null ? tableCount : '—'}
                {ritual?.lock_moment_at
                  ? ` · kilit ${new Date(ritual.lock_moment_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </Text>
              {Array.isArray(ritual?.host_announcements) && ritual.host_announcements[0] ? (
                <Text style={styles.liveBannerSub} numberOfLines={2}>
                  Host: {String(ritual.host_announcements[0].message || '').slice(0, 120)}
                </Text>
              ) : (
                <Text style={styles.liveBannerSub}>Host duyurusu · tek yönlü · konuşma kapalı</Text>
              )}
            </View>
          ) : null}
          {doorInfo.door_closes_at ? (
            <Text style={styles.liveBannerSub}>
              Kapı {new Date(doorInfo.door_closes_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              'te kapanır
              {doorInfo.minutes_until_door_close != null
                ? ` · ${doorInfo.minutes_until_door_close}dk`
                : ''}
            </Text>
          ) : doorInfo.kapi_minutes != null ? (
            <Text style={styles.liveBannerSub}>
              Giriş kapısı açık · geri sayım aktif
            </Text>
          ) : null}
          <Text style={styles.liveBannerSub}>
            {t('checkin_find_table', 'tr', {
              place: tableLabel,
              host: hostLabel,
              n: tableCount != null ? tableCount : '—',
            })}
          </Text>
        </View>
        {arrivals.length ? (
          <View style={styles.arrivalsCard}>
            <Text style={styles.arrivalsTitle}>Arrivals · Mühürlü</Text>
            <Text style={styles.arrivalsText}>{arrivals.join(' · ')}</Text>
            {pendingArrivals.length ? (
              <Text style={[styles.arrivalsText, { opacity: 0.45, marginTop: 4 }]}>
                Bekleyen: {pendingArrivals.join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.step}>1 · GPS</Text>
        <View style={styles.statusCard}>
          {locLoading ? (
            <ActivityIndicator color="#111" />
          ) : coords ? (
            <Text style={styles.statusOk}>
              {earlyWindow && !ritualStarted
                ? precheck?.gps_ok === false
                  ? `Konum alindi · radius disi (${precheck?.distance_m ?? '?'}m)`
                  : 'Konum dogrulandi · warm-up (firstSeal acik)'
                : 'Konum dogrulandi'}
            </Text>
          ) : (
            <Text style={styles.statusBad}>{locError || 'Konum alinamadi'}</Text>
          )}
          {Platform.OS === 'android' ? (
            <Text style={styles.androidEdu}>{androidLocationEducation}</Text>
          ) : null}
          {!locLoading && (
            <TouchableOpacity style={styles.retryBtn} onPress={refreshGps}>
              <Text style={styles.retryText}>Tekrar dene</Text>
            </TouchableOpacity>
          )}
        </View>

        {coords && outsideRadius ? (
          <View style={styles.offRadiusCard}>
            <Text style={styles.offRadiusTitle}>Kapı kapalı · yarıçap dışındasın</Text>
            {compass ? (
              <View style={styles.compassRow}>
                <Text style={styles.compassArrow}>{compass.arrow}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.compassDistance}>
                    {compass.distance_label} · {compass.cardinal} yonunde
                  </Text>
                  <Text style={styles.compassHint}>
                    {compass.heading_known
                      ? 'Telefonu duz tut · ok masayi gosterir'
                      : 'Pusula kapali · yon kuzeye gore'}
                    {` · check-in ${checkinRadius}m icinde`}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.compassHint}>
                Masa konumu alinamadi · {precheck?.distance_m ?? '?'}m uzaktasin
              </Text>
            )}
            {tableCount != null ? (
              <Text style={styles.offRadiusMeta}>{tableCount} kişi</Text>
            ) : null}
            {findNote ? <Text style={styles.offRadiusNote}>Bulma notu: {findNote}</Text> : null}
            {tableOpenNote ? (
              <Text style={styles.offRadiusNote}>Konum notu: {tableOpenNote}</Text>
            ) : null}
          </View>
        ) : null}

        {!doorInfo.door_open && (earlyWindow || ritualStarted) ? (
          <NeutralNoShowCard
            doorClosesAt={doorInfo.door_closes_at}
            tableLabel={tableLabel}
          />
        ) : null}

        <Text style={[styles.step, { marginTop: 20 }]}>2 · Kapı</Text>
        <View style={styles.statusCard}>
          {!doorInfo.door_open && !earlyWindow && !ritualStarted ? (
            <Text style={styles.statusOk}>
              Check-in start−15'te acilir · {formatSecondsCountdown(doorInfo.seconds_until_start)}
            </Text>
          ) : (
            <Text style={doorInfo.door_open ? styles.statusOk : styles.statusBad}>
              {doorInfo.door_open
                ? earlyWindow
                  ? `Warm-up kapi acik · start'a ${formatSecondsCountdown(doorInfo.seconds_until_start)}`
                  : doorInfo.door_closes_at
                    ? `Kapı açık · ${new Date(doorInfo.door_closes_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}'te kapanır · ${doorInfo.minutes_until_door_close}dk`
                    : `Kapı açık · ${doorInfo.minutes_until_door_close} dk kaldı`
                : 'Kapı kapandi (no-show)'}
            </Text>
          )}
        </View>

        <Text style={[styles.step, { marginTop: 20 }]}>3 · Ana kültür (eşit)</Text>
        <Text style={styles.cultureCopy}>Kodu sormak selam vermektir · dijital yollama yok</Text>
        <View style={styles.cultureRow}>
          {[
            { id: 'say', label: 'Söyle' },
            { id: 'show', label: 'Göster' },
            { id: 'local_tag', label: 'LOCAL-TAG' },
          ].map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.cultureChip, culturePath === p.id && styles.cultureChipOn]}
              onPress={() => {
                setCulturePath(p.id);
                void recordCheckinFunnelClient(ritualId, 'culture_path', { path: p.id });
                if (p.id === 'say') {
                  Alert.alert('Söyle', 'Masadakine “kod ne?” de — kodu sormak selam vermektir.');
                } else if (p.id === 'show') {
                  Alert.alert(
                    'Göster',
                    'Mühürlü ekrandaki kalıcı KOD: ··· görünür. Ekranı göster; DM/AirDrop yok.'
                  );
                } else {
                  setRedeemOpen(true);
                }
              }}
            >
              <Text style={[styles.cultureChipText, culturePath === p.id && styles.cultureChipTextOn]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!doorInfo.door_open ? (
          <View style={styles.waitCard}>
            <Text style={styles.waitTitle}>Kod alani pasif</Text>
            <Text style={styles.waitBody}>
              Check-in penceresi start−15'te acilir. Geri sayim: {formatSecondsCountdown(doorInfo.seconds_until_start)}
            </Text>
            <View style={[styles.codeSlots, { opacity: 0.35 }]}>
              {[0, 1, 2].map((index) => (
                <Text key={index} style={styles.codeSlot}>·</Text>
              ))}
            </View>
          </View>
        ) : canFirstSeal ? (
          <View style={styles.waitCard}>
            <Text style={styles.waitTitle}>MASAYI SEN AÇIYORSUN</Text>
            <Text style={styles.waitBody}>
              {earlyWindow ? 'Warm-up · ' : ''}GPS yeşilse mühür = kodun doğumu = window'un doğumu. Host yükü yok — ilk gelen açar.
            </Text>
          </View>
        ) : (
          <>
            {isLocked ? (
              <Text style={styles.lockText}>
                Brute-force freni · {formatSecondsCountdown(lockRemainingSec)} bekle
              </Text>
            ) : null}
            {attemptsLeft != null && !isLocked ? (
              <Text style={styles.hint}>Kalan deneme: {attemptsLeft}</Text>
            ) : null}
            <View style={[styles.codeSlots, isLocked && { opacity: 0.4 }]}>
              {[0, 1, 2].map((index) => (
                <Text key={index} style={styles.codeSlot}>{keyword[index] || '·'}</Text>
              ))}
            </View>
            <TextInput
              value={keyword}
              onChangeText={onCodeTextChange}
              keyboardType="number-pad"
              maxLength={3}
              editable={!isLocked && codeActive}
              placeholder="veya yapıştır (yasak — algılanır)"
              placeholderTextColor="#9ca3af"
              style={styles.codePasteInput}
              autoFocus={culturePath === 'say' || culturePath === 'show'}
            />
            <View style={[styles.numpad, isLocked && { opacity: 0.4 }]}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <TouchableOpacity key={n} style={styles.numKey} onPress={() => appendDigit(n)} disabled={isLocked}>
                  <Text style={styles.numKeyText}>{n}</Text>
                </TouchableOpacity>
              ))}
              <View style={styles.numKey} />
              <TouchableOpacity style={styles.numKey} onPress={() => appendDigit(0)} disabled={isLocked}>
                <Text style={styles.numKeyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.numKey}
                onPress={() => {
                  if (isLocked) return;
                  setKeyword((prev) => prev.slice(0, -1));
                  setDigitalPaste(false);
                }}
                disabled={isLocked}
              >
                <Text style={styles.numKeyText}>⌫</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={[styles.step, { marginTop: 16 }]}>LOCAL-TAG · QR-göster / yaklaştır</Text>
        <View style={styles.statusCard}>
          <Text style={styles.hint}>
            Muhurlu biri 30sn tek-kullanim QR uretir; yanindaki kisi okutarak koda ulasir.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleCreateLocalTag}>
            <Text style={styles.retryText}>QR uret (muhurleyen)</Text>
          </TouchableOpacity>

          <LocalTagQr
            token={issuedLocalTag?.token}
            expiresInSec={localTagExpiresInSec}
            expired={localTagExpired}
            onScannedToken={(scanned) => {
              setCulturePath('local_tag');
              setRedeemOpen(true);
              setDigitalPaste(false);
              void handleRedeemLocalTag(scanned);
            }}
          />

          {redeemOpen || culturePath === 'local_tag' ? (
            <View style={styles.redeemPanel}>
              <Text style={styles.redeemTitle}>Token gir</Text>
              <TextInput
                value={localTagToken}
                onChangeText={(v) => {
                  setLocalTagToken(v);
                  setLocalTagStatus(null);
                }}
                placeholder="Muhurleden tek-kullanim token"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.localTagInput}
              />
              <View style={styles.redeemActions}>
                <TouchableOpacity
                  style={styles.redeemCancel}
                  onPress={() => {
                    setRedeemOpen(false);
                    setCulturePath('say');
                    setLocalTagToken('');
                    setLocalTagStatus(null);
                  }}
                >
                  <Text style={styles.redeemCancelText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.redeemSubmit} onPress={handleRedeemLocalTag}>
                  <Text style={styles.redeemSubmitText}>Tokeni uygula</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setCulturePath('local_tag');
                setRedeemOpen(true);
              }}
            >
              <Text style={styles.retryText}>Token ile giris yap</Text>
            </TouchableOpacity>
          )}

          {localTagStatus ? (
            <Text style={localTagStatus.tone === 'ok' ? styles.statusOk : styles.statusBad}>
              {localTagStatus.text}
            </Text>
          ) : null}
        </View>

        <Text style={styles.info}>
          Canlı GPS + söyle / göster / LOCAL-TAG · kısayol NFC · PENDING_WITNESS
        </Text>

        {canFirstSeal ? (
          <View style={styles.openNoteBox}>
            <Text style={styles.openNoteLabel}>Konum notu (opsiyonel · masa açılınca push)</Text>
            <TextInput
              value={openNote}
              onChangeText={setOpenNote}
              placeholder="Örn: Bahçe girişi, mavi kapı"
              placeholderTextColor="#9ca3af"
              maxLength={120}
              style={styles.openNoteInput}
            />
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.button,
            (!coords ||
              !doorInfo.door_open ||
              loading ||
              !codeActive ||
              isLocked ||
              outsideRadius) &&
              styles.buttonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={
            loading ||
            !doorInfo.door_open ||
            !codeActive ||
            isLocked ||
            outsideRadius ||
            (needsCode && !/^\d{3}$/.test(keyword))
          }
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {outsideRadius
                ? 'Kapı kapalı · yaklaş'
                : !doorInfo.door_open
                ? 'Pencere kapali'
                : canFirstSeal
                  ? 'Masayi Ac (firstSeal)'
                  : codeBanned
                    ? 'Totem ile Check-in'
                    : 'Check-in Tamamla'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { marginTop: 10, backgroundColor: '#111827' },
            (!doorInfo.door_open || loading || nfcScanning || outsideRadius) &&
              styles.buttonDisabled,
          ]}
          onPress={handleMarkerCheckIn}
          disabled={loading || nfcScanning || !doorInfo.door_open || outsideRadius}
        >
          {nfcScanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>NFC/Totem ile Check-in</Text>
          )}
        </TouchableOpacity>
        {!nfcAvailable ? (
          <Text style={styles.info}>
            Totem okuma bu derlemede kapalı — ana kültür: kod söyle/göster · LOCAL-TAG
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  back: { fontSize: 22, color: '#111' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  content: { padding: 16 },
  liveBanner: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  liveBannerTitle: {
    color: '#f9a13d',
    fontSize: 15,
    fontWeight: '700',
  },
  liveBannerSub: {
    color: 'rgba(255,255,255,.65)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  arrivalsCard: {
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 10,
  },
  arrivalsTitle: { color: '#111', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  arrivalsText: { color: '#4b5563', fontSize: 12, lineHeight: 18 },
  waitCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 16,
  },
  waitTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 6 },
  waitBody: { fontSize: 13, color: '#666', lineHeight: 19 },
  step: {
    fontSize: 13,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cultureCopy: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 10,
    lineHeight: 18,
    fontWeight: '600',
  },
  cultureRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  cultureChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cultureChipOn: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  cultureChipText: { fontSize: 12, fontWeight: '700', color: '#111' },
  cultureChipTextOn: { color: '#fff' },
  codePasteInput: {
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    letterSpacing: 4,
    textAlign: 'center',
  },
  instantStrip: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#374151',
  },
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 12,
  },
  statusOk: { color: '#166534', fontWeight: '600' },
  statusBad: { color: '#b91c1c', fontWeight: '600' },
  androidEdu: { color: '#52525b', fontSize: 12, marginTop: 8, lineHeight: 16 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: '#111', fontWeight: '600', fontSize: 13 },
  localTagInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  offRadiusCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  offRadiusTitle: { color: '#b91c1c', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  compassRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compassArrow: { fontSize: 34, color: '#b91c1c', fontWeight: '700' },
  compassDistance: { fontSize: 15, fontWeight: '700', color: '#111' },
  compassHint: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 17 },
  offRadiusMeta: { fontSize: 13, fontWeight: '600', color: '#111', marginTop: 8 },
  offRadiusNote: { fontSize: 12, color: '#4b5563', marginTop: 4, lineHeight: 17 },
  tagCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    padding: 12,
    alignItems: 'center',
  },
  tagCardExpired: { opacity: 0.55 },
  tagLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  tagToken: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 6,
  },
  tagCountdown: { fontSize: 13, fontWeight: '700', color: '#166534', marginTop: 6 },
  tagExpired: { fontSize: 13, fontWeight: '700', color: '#b91c1c', marginTop: 6 },
  redeemPanel: { marginTop: 10, gap: 8 },
  redeemTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  redeemActions: { flexDirection: 'row', gap: 8 },
  redeemCancel: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  redeemCancelText: { color: '#6b7280', fontWeight: '600', fontSize: 13 },
  redeemSubmit: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#111',
    paddingVertical: 10,
    alignItems: 'center',
  },
  redeemSubmitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hint: { color: '#666', fontSize: 13, lineHeight: 18 },
  lockText: { color: '#b45309', fontWeight: '700', marginBottom: 8 },
  codeSlots: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 8 },
  codeSlot: { width: 48, height: 52, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 25, fontWeight: '700', color: '#111' },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 260, alignSelf: 'center' },
  numKey: { width: 76, height: 40, borderRadius: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  numKeyText: { color: '#111', fontSize: 18, fontWeight: '700' },
  info: { marginTop: 12, color: '#666', fontSize: 12 },
  openNoteBox: { marginTop: 12 },
  openNoteLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6 },
  openNoteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    color: '#111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
