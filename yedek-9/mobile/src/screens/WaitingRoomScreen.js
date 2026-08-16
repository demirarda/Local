import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Alert, Image } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import { fetchChatMessages, sendChatMessage, sendChatRichMessage, sendChatMediaMessage, fetchRitualDetail, createModReport } from '../services/api';
import ReportModal from '../components/ReportModal';
import {
  getGraceCountdown,
  getGraceEndsAt,
  getLocationTypeLabel,
  getOuterLocationSummary,
  isExactDetailsUnlocked,
  isPrelobbyPhase,
} from '../utils/ritualLifecycle';
import { formatCheckinStatusLabel, formatSecondsCountdown, getCheckinWindowInfo } from '../utils/checkinWindow';
import { formatRsLabel } from '../utils/rsVisibility';
import PulseRing from '../components/PulseRing';
import { t } from '../i18n/stringTable';
import { captureInAppMedia } from '../utils/inAppCamera';

export default function WaitingRoomScreen({ route, navigation }) {
  const initialRitual = route.params?.ritual || null;
  const ritualId = route.params?.ritualId || initialRitual?.id;
  const { user } = useAuthStore();
  const themeMode = useThemeStore((s) => s.mode);
  const [ritual, setRitual] = useState(initialRitual);
  const [nowMs, setNowMs] = useState(Date.now());
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [reportMsg, setReportMsg] = useState(null);
  const chatCacheKey = ritual?.id ? `@waiting_room_chat_${ritual.id}` : null;

  const persistChatCache = async (list) => {
    if (!chatCacheKey) return;
    try {
      await AsyncStorage.setItem(chatCacheKey, JSON.stringify((list || []).slice(-30)));
    } catch (_e) {
      // non-fatal
    }
  };
  const appendChatMessage = (msg) => {
    setChatMessages((prev) => {
      const next = [...prev.slice(-29), msg];
      persistChatCache(next);
      return next;
    });
  };

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRitual = async () => {
      if (!ritualId || !user?.id) return;
      try {
        const fresh = await fetchRitualDetail(ritualId, user.id);
        if (!cancelled && fresh) setRitual(fresh);
      } catch (_e) {
        // keep cached ritual
      }
    };
    loadRitual();
    return () => {
      cancelled = true;
    };
  }, [ritualId, user?.id]);

  const exactUnlocked = isExactDetailsUnlocked(ritual);
  const graceEndsAt = getGraceEndsAt(ritual);
  const graceCountdown = getGraceCountdown(graceEndsAt, nowMs);

  useEffect(() => {
    if (!ritualId || !user?.id || exactUnlocked) return;
    if (!graceCountdown.unlocked) return;
    let cancelled = false;
    fetchRitualDetail(ritualId, user.id)
      .then((fresh) => {
        if (!cancelled && fresh) setRitual(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [graceCountdown.unlocked, ritualId, user?.id, exactUnlocked]);

  const startMs = ritual?.start_time ? new Date(ritual.start_time).getTime() : null;

  const countdown = useMemo(() => {
    if (!startMs) return { h: '00', m: '00', s: '00', label: 'Yakinda basliyor' };
    const diffSec = Math.max(0, Math.floor((startMs - nowMs) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return {
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
      s: String(s).padStart(2, '0'),
      label: diffSec <= 0 ? 'Simdi basliyor' : `${h > 0 ? `${h} sa ` : ''}${m} dk kaldi`,
    };
  }, [startMs, nowMs]);

  const checkinCountdown = useMemo(() => {
    const window = getCheckinWindowInfo(ritual, nowMs);
    if (window.early_window && !window.ritual_started) {
      return {
        open: true,
        label: `Erken check-in · start'a ${formatSecondsCountdown(window.seconds_until_start)} (kod pasif)`,
      };
    }
    if (!window.ritual_started) {
      if (!startMs) return { open: false, label: 'Check-in Ritual baslayinca acilir' };
      const earlyOpenMs = startMs - 15 * 60000;
      if (nowMs < earlyOpenMs) {
        const diffSec = Math.max(0, Math.ceil((earlyOpenMs - nowMs) / 1000));
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        return {
          open: false,
          label: m > 0 ? `${m} dk ${String(s).padStart(2, '0')} sn sonra erken check-in` : `${s} sn sonra erken check-in`,
        };
      }
      return {
        open: true,
        label: formatCheckinStatusLabel(ritual, nowMs),
      };
    }
    if (window.door_open) {
      return {
        open: true,
        label: formatCheckinStatusLabel(ritual, nowMs),
      };
    }
    return { open: false, label: 'Check-in kapisi kapandi' };
  }, [ritual, startMs, nowMs]);

  const attendees = Array.isArray(ritual?.participants) ? ritual.participants : [];
  const viewerJoined = ritual?.viewer_joined === true ||
    ritual?.viewer_membership?.joined === true ||
    attendees.some((p) => String(p?.id || p?.user_id) === String(user?.id));

  // Instant: prelobby + kapı tek birleşik yüzey → CheckIn
  useEffect(() => {
    if (!ritual?.id || !viewerJoined) return;
    const isInstant = String(ritual?.time_type || '').toLowerCase() === 'instant';
    if (!isInstant) return;
    const window = getCheckinWindowInfo(ritual, nowMs);
    if (window.door_open) {
      navigation.replace('RitualCheckIn', {
        ritualId: ritual.id,
        ritual,
        instantUnified: true,
      });
    }
  }, [ritual?.id, ritual?.time_type, ritual?.first_sealed_at, viewerJoined, nowMs, navigation]);

  const friendJoining = ritual?.friend_joining || ritual?.friend_joining_signal || ritual?.social_signals?.friend_joining;
  const friendJoiningCount =
    Number(ritual?.friend_joining_count ?? ritual?.social_signals?.friends_interested ?? 0) || 0;
  const venueName = ritual?.venue_name || ritual?.location_name || 'Ritual Mekani';
  const outerLocationSummary = getOuterLocationSummary(ritual);
  const attendeeCountLabel = `${Number(ritual?.current_attendees ?? attendees.length ?? 0)} / ${Number(ritual?.capacity || 0)} doluluk`;

  const lockMoment = useMemo(() => {
    const lockAt = ritual?.lock_moment_at ? new Date(ritual.lock_moment_at).getTime() : null;
    if (!lockAt && startMs) {
      // fallback: 25% of time from created_at→start or now→start
      const createdMs = ritual?.created_at ? new Date(ritual.created_at).getTime() : nowMs;
      const span = Math.max(0, startMs - createdMs);
      const estimated = createdMs + span * 0.25;
      const rem = Math.max(0, Math.ceil((estimated - nowMs) / 1000));
      return {
        passed: rem <= 0,
        label: rem <= 0 ? 'Kilit geçti' : formatSecondsCountdown(rem),
      };
    }
    if (!lockAt) return { passed: false, label: '—' };
    const rem = Math.max(0, Math.ceil((lockAt - nowMs) / 1000));
    return { passed: rem <= 0, label: formatSecondsCountdown(rem) };
  }, [ritual?.lock_moment_at, ritual?.created_at, startMs, nowMs]);
  const prelobbyChatOpen = lockMoment.passed;
  const venueAddress = exactUnlocked
    ? (ritual?.location_address || ritual?.venue_address || ritual?.address || outerLocationSummary)
    : `${getLocationTypeLabel(ritual?.location_type)} · Grace sonrasi tam pin acilir`;
  const ritualType = ritual?.type || 'Ritual';
  const startTimeText = ritual?.start_time
    ? new Date(ritual.start_time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const tableOpened = Boolean(ritual?.checkin_keyword) || Boolean(ritual?.first_sealed_at);

  const getInitial = (p) => String(p?.name || p?.user_name || '?').trim().charAt(0).toUpperCase();
  const getFl = (p) => String(p?.friend_level || 'FL0');
  const getStatusTone = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('host')) return styles.attStatusHost;
    if (s.includes('pending') || s.includes('wait')) return styles.attStatusPending;
    return styles.attStatusConfirmed;
  };

  const handleOpenVenueMap = () => {
    if (!exactUnlocked) {
      Alert.alert(
        'Konum kilitli',
        `Tam pin ${graceCountdown.unlocked ? 'hazirlaniyor' : graceCountdown.label} sonra acilacak.`
      );
      return;
    }
    const mapRoute = themeMode === 'dark' ? 'VenueMapDark' : 'VenueMap';
    navigation.navigate(mapRoute, {
      venueName,
      venueAddress,
      latitude: ritual?.location_lat ?? ritual?.latitude ?? null,
      longitude: ritual?.location_lng ?? ritual?.longitude ?? null,
      rituals: ritual ? [ritual] : [],
    });
  };
  useEffect(() => {
    let cancelled = false;
    const loadChat = async () => {
      if (!ritual?.id) return;
      let cached = [];
      if (chatCacheKey) {
        try {
          const raw = await AsyncStorage.getItem(chatCacheKey);
          cached = raw ? JSON.parse(raw) : [];
        } catch (_e) {
          cached = [];
        }
      }
      try {
        const rows = await fetchChatMessages(ritual.id, 20);
        if (cancelled || !Array.isArray(rows)) return;
        const normalized = rows.slice(-20).map((m, idx) => ({
          id: m.id || `chat-${idx}`,
          author_name: m.user_name || m.name || 'Katilimci',
          role: m.message_type === 'host_announcement' ? 'host' : 'guest',
          text: m.message || '',
          type: m.type || 'text',
          media_url: m.media_url || null,
          external_url: m.external_url || null,
          time: m.created_at
            ? new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
            : 'Simdi',
        }));
        const mergedById = new Map();
        [...cached, ...normalized].forEach((m) => mergedById.set(String(m.id), m));
        const merged = Array.from(mergedById.values()).slice(-30);
        setChatMessages(merged);
        await persistChatCache(merged);
      } catch (_e) {
        if (cached.length > 0) {
          setChatMessages(cached.slice(-30));
        }
      }
    };
    loadChat();
    return () => {
      cancelled = true;
    };
  }, [ritual?.id, chatCacheKey]);

  const handleSendChatMessage = async () => {
    if (!prelobbyChatOpen) {
      Alert.alert('Sohbet kilitli', 'Prelobby sohbeti kilit aninda acilir.');
      return;
    }
    const text = String(chatInput || '').trim();
    if (!text) return;
    if (!ritual?.id || !user?.id) {
      Alert.alert('Mesaj gonderilemedi', 'Ritual veya kullanici bilgisi eksik.');
      return;
    }

    const optimistic = {
      id: `local-${Date.now()}`,
      author_name: user?.name || 'Sen',
      role: 'guest',
      text,
      type: 'text',
      media_url: null,
      external_url: null,
      time: 'Simdi',
    };

    appendChatMessage(optimistic);
    setChatInput('');
    setSendingMessage(true);
    try {
      await sendChatMessage(ritual.id, user.id, text, 'user');
    } catch (e) {
      Alert.alert('Mesaj gonderilemedi', e?.message || 'Tekrar dene');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendPhoto = async () => {
    try {
      const captured = await captureInAppMedia('photo');
      if (!captured?.uri) return;
      const uri = captured.uri;
      const sent = await sendChatMediaMessage(ritual.id, user.id, {
        uri,
        upload_type: 'photo',
        content_type: captured.mimeType || 'image/jpeg',
        file_size_bytes: captured.fileSize || 0,
        capture_source: 'camera',
        caption: '📷 Fotograf paylasti',
        type: 'photo',
      });
      appendChatMessage({
        id: sent?.id || `local-photo-${Date.now()}`,
        author_name: user?.name || 'Sen',
        role: 'guest',
        text: sent?.message || '📷 Fotograf paylasti',
        type: 'photo',
        media_url: sent?.media_url || sent?.content_url || uri,
        external_url: null,
        time: 'Simdi',
      });
    } catch (e) {
      Alert.alert('Gonderim hatasi', e?.message || 'Fotograf gonderilemedi');
    }
  };

  const handleSendSong = async () => {
    if (!ritual?.id || !user?.id) return;
    const spotifyUrl = ritual?.spotify_playlist_url || ritual?.external_url || 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const message = '🎵 Sarki paylasti';
    try {
      const sent = await sendChatRichMessage(ritual.id, user.id, message, {
        type: 'playlist',
        external_url: spotifyUrl,
      });
      appendChatMessage({
        id: sent?.id || `local-song-${Date.now()}`,
        author_name: user?.name || 'Sen',
        role: 'guest',
        text: sent?.message || message,
        type: 'playlist',
        media_url: null,
        external_url: spotifyUrl,
        time: 'Simdi',
      });
    } catch (e) {
      Alert.alert('Gonderim hatasi', e?.message || 'Sarki paylasilamadi');
    }
  };

  const handleSendVoiceNote = async () => {
    if (!ritual?.id || !user?.id) return;
    try {
      if (!isRecordingVoice) {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Izin gerekli', 'Sesli not kaydi icin mikrofon izni gerekli.');
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        // Ensure previous recorder is fully released before starting a new one.
        if (voiceRecording) {
          try {
            await voiceRecording.stopAndUnloadAsync();
          } catch (_e) {
            // ignore cleanup error
          }
          setVoiceRecording(null);
        }

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        setVoiceRecording(recording);
        setIsRecordingVoice(true);
        return;
      }

      // Stop and upload recording
      if (!voiceRecording) return;
      setSendingMessage(true);
      await voiceRecording.stopAndUnloadAsync();
      const uri = voiceRecording.getURI();
      setVoiceRecording(null);
      setIsRecordingVoice(false);
      if (!uri) {
        Alert.alert('Kayit hatasi', 'Ses dosyasi olusturulamadi.');
        return;
      }

      const sent = await sendChatMediaMessage(ritual.id, user.id, {
        uri,
        upload_type: 'voice',
        content_type: 'audio/m4a',
        caption: '🎙 Sesli not paylasti',
        type: 'voice',
      });
      appendChatMessage({
        id: sent?.id || `local-voice-${Date.now()}`,
        author_name: user?.name || 'Sen',
        role: 'guest',
        text: sent?.message || '🎙 Sesli not paylasti',
        type: 'voice',
        media_url: sent?.media_url || uri,
        external_url: null,
        time: 'Simdi',
      });
    } catch (e) {
      setIsRecordingVoice(false);
      if (voiceRecording) {
        try {
          await voiceRecording.stopAndUnloadAsync();
        } catch (_e) {
          // ignore cleanup error
        }
      }
      setVoiceRecording(null);
      Alert.alert('Gonderim hatasi', e?.message || 'Sesli not gonderilemedi');
    } finally {
      setSendingMessage(false);
    }
  };

  const playVoiceNote = async (voiceId, uri) => {
    if (!uri) return;
    try {
      setPlayingVoiceId(voiceId);
      const { sound } = await Audio.Sound.createAsync({ uri });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
          setPlayingVoiceId(null);
        }
      });
      await sound.playAsync();
    } catch (_e) {
      setPlayingVoiceId(null);
      Alert.alert('Calma hatasi', 'Sesli not oynatilamadi.');
    }
  };

  useEffect(() => {
    return () => {
      if (voiceRecording) {
        voiceRecording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [voiceRecording]);
  const prechatMessages = useMemo(() => {
    if (chatMessages.length > 0) {
      return chatMessages;
    }
    if (Array.isArray(ritual?.prechat_messages) && ritual.prechat_messages.length > 0) {
      return ritual.prechat_messages.slice(0, 5);
    }
    const hostName = ritual?.host_name || ritual?.host_user_name || 'Host';
    const firstGuest = attendees.find((a) => (a?.name || a?.user_name) && String(a?.name || a?.user_name) !== String(hostName));
    return [
      {
        id: 'host-1',
        author_name: hostName,
        role: 'host',
        text: 'Herkese merhaba. Check-in Window acilinca GPS ve keyword ile giris yapabilirsiniz.',
        time: 'Az once',
      },
      firstGuest
        ? {
            id: 'guest-1',
            author_name: firstGuest?.name || firstGuest?.user_name,
            role: 'guest',
            text: 'Suresi yaklasik kac saat olur?',
            time: 'Az once',
          }
        : null,
    ].filter(Boolean);
  }, [chatMessages, ritual?.prechat_messages, ritual?.host_name, ritual?.host_user_name, attendees]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Bekleme Odasi</Text>
        <TouchableOpacity style={styles.moreCircle}><Text style={styles.moreText}>···</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Text style={styles.identityType}>{ritualType}</Text>
          <Text style={styles.ritualTitle}>{ritual?.title || 'Ritual'}</Text>
          <Text style={styles.venue}>📍 {venueName} · Baslangic {startTimeText}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeGold}>Pivot Host</Text>
            <Text style={styles.badgeGreen}>Verified</Text>
            <Text style={styles.badgeNavy}>Acik Giris</Text>
          </View>
          <View style={styles.pulseLockRow}>
            <PulseRing
              mode={ritual?.pulse?.mode || 'PRELOBBY'}
              ratio={
                ritual?.pulse?.value ??
                ritual?.pulse?.rq_average ??
                ritual?.pulse?.occupancy_ratio ??
                (Number(ritual?.capacity) > 0
                  ? Number(ritual?.current_attendees || attendees.length || 0) / Number(ritual.capacity)
                  : 0)
              }
              count={Number(ritual?.pulse?.count ?? ritual?.current_attendees ?? attendees.length ?? 0)}
              checkinRatio={ritual?.pulse?.checkin_ratio}
              memoryTempo={ritual?.pulse?.memory_tempo}
              rqAverage={ritual?.pulse?.rq_average}
              liveMix={ritual?.pulse?.live_mix}
              lowThreshold={ritual?.pulse?.bands?.low ?? 0.4}
              midThreshold={ritual?.pulse?.bands?.mid ?? 0.7}
            />
            <View style={styles.lockMomentBox}>
              <Text style={styles.lockMomentLabel}>KİLİT-ANI</Text>
              <Text style={styles.lockMomentValue}>
                {lockMoment.passed ? 'Kilit geçti' : lockMoment.label}
              </Text>
              <Text style={styles.lockMomentHint}>
                {attendeeCountLabel}
              </Text>
            </View>
          </View>
        </View>
        {tableOpened ? (
          <View style={styles.openedCard}>
            <Text style={styles.openedTitle}>{t('first_seal_opened')}</Text>
            <Text style={styles.openedBody}>
              {ritual?.open_note
                ? `Host notu: ${String(ritual.open_note).slice(0, 120)}`
                : 'Check-in kapısı aktif — masada kodu sor, ekranı göster veya LOCAL-TAG.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.countdownCard}>
          <Text style={styles.countTop}>
            {isPrelobbyPhase(ritual) ? 'Rituale Baslamasina' : 'Ritual Yaklasiyor'}
          </Text>
          <View style={styles.timerRow}>
            <View style={styles.timerUnit}><Text style={styles.timerNum}>{countdown.h}</Text><Text style={styles.timerLbl}>Saat</Text></View>
            <Text style={styles.timerSep}>:</Text>
            <View style={styles.timerUnit}><Text style={styles.timerNum}>{countdown.m}</Text><Text style={styles.timerLbl}>Dakika</Text></View>
            <Text style={styles.timerSep}>:</Text>
            <View style={styles.timerUnit}><Text style={styles.timerNum}>{countdown.s}</Text><Text style={styles.timerLbl}>Saniye</Text></View>
          </View>
          <Text style={styles.countHint}>{countdown.label}</Text>
        </View>

        {!exactUnlocked ? (
          <View style={styles.graceLockBanner}>
            <Text style={styles.graceLockBannerTitle}>Exact detaylar kilitli</Text>
            <Text style={styles.graceLockBannerText}>
              Prelobby sohbeti acik. Tam pin ve host notlari {graceCountdown.label} sonra acilacak.
            </Text>
          </View>
        ) : (
          <View style={[styles.graceLockBanner, styles.graceUnlockBanner]}>
            <Text style={styles.graceLockBannerTitle}>Exact detaylar acildi</Text>
            <Text style={styles.graceLockBannerText}>{venueAddress}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.locationCard, !exactUnlocked && styles.locationCardLocked]}
          activeOpacity={exactUnlocked ? 0.85 : 1}
          onPress={handleOpenVenueMap}
        >
          <View style={styles.locationMap}>
            {exactUnlocked ? (
              <View style={styles.mapPin}><Text style={styles.mapPinText}>📍</Text></View>
            ) : (
              <Text style={styles.mapLockText}>🔒 Grace: {graceCountdown.label}</Text>
            )}
          </View>
          <View style={styles.locationBody}>
            <View style={styles.locationIcon}><Text>🏛</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.locationName}>{venueName}</Text>
              <Text style={styles.locationAddr}>{venueAddress}</Text>
              {!exactUnlocked ? (
                <Text style={styles.locationTypeHint}>{outerLocationSummary}</Text>
              ) : null}
            </View>
            <Text style={styles.locationArrow}>{exactUnlocked ? '›' : '🔒'}</Text>
          </View>
        </TouchableOpacity>

        {exactUnlocked && ritual?.description ? (
          <View style={styles.hostNotesCard}>
            <Text style={styles.hostNotesTitle}>Host notlari</Text>
            <Text style={styles.hostNotesBody}>{ritual.description}</Text>
          </View>
        ) : null}

        {checkinCountdown.open ? (
          <TouchableOpacity
            style={styles.checkInBtn}
            onPress={() => navigation.navigate('RitualCheckIn', { ritualId: ritual?.id, ritual })}
          >
            <Text style={styles.checkInText}>Check-in Yap →</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Kimler Geliyor</Text>
          <Text style={styles.countPill}>{attendees.length} katilimci</Text>
        </View>
        {!viewerJoined ? (
          <View style={styles.participantPrivacyCard}>
            <Text style={styles.participantPrivacyText}>Katılımcı listesi katıldıktan sonra görünür.</Text>
            {friendJoining || friendJoiningCount > 0 ? (
              <Text style={styles.friendJoiningText}>
                {friendJoiningCount > 1
                  ? `${friendJoiningCount} arkadaşın katılıyor`
                  : '1 arkadaşın katılıyor'}
              </Text>
            ) : null}
          </View>
        ) : attendees.length === 0 ? (
          <Text style={styles.empty}>Henuz gorunen katilimci yok.</Text>
        ) : (
          <View style={styles.attGrid}>
            {attendees.map((p, idx) => (
              <View key={String(p?.id || p?.user_id || idx)} style={styles.attItem}>
                <View style={styles.attAvatar}>
                  <Text style={styles.attInitial}>{getInitial(p)}</Text>
                  <View style={[styles.attStatus, getStatusTone(p?.status)]} />
                </View>
                <Text numberOfLines={1} style={styles.attName}>{p?.name || p?.user_name || 'Katilimci'}</Text>
                <Text style={styles.attFl}>{getFl(p)}</Text>
                {formatRsLabel(p?.rs_score) ? (
                  <Text style={styles.attRs}>{formatRsLabel(p?.rs_score)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.chatSection}>
          <View style={styles.chatHeaderRow}>
            <View style={styles.chatHeaderLine} />
            <Text style={styles.chatHeader}>Prelobby Sohbeti</Text>
            <View style={styles.chatHeaderLine} />
          </View>
          {prechatMessages.map((msg, idx) => {
            const isHost = String(msg?.role || '').toLowerCase().includes('host');
            const author = msg?.author_name || 'Katilimci';
            const isOwn =
              String(msg?.user_id || msg?.author_id || '') === String(user?.id || '') ||
              String(author).toLowerCase() === String(user?.name || '').toLowerCase();
            return (
              <View key={msg?.id || `msg-${idx}`} style={styles.msgRow}>
                <View style={[styles.msgAvatar, isHost && styles.msgAvatarHost]}>
                  <Text style={styles.msgAvatarText}>{String(author).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.msgName}>
                    {author}
                    {isHost ? <Text style={styles.msgHostTag}>  HOST</Text> : null}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={isOwn}
                    onLongPress={() => {
                      if (isOwn) return;
                      setReportMsg(msg);
                    }}
                    delayLongPress={350}
                  >
                    <View style={[styles.msgBubble, isHost && styles.msgBubbleHost]}>
                      <Text style={styles.msgText}>{msg?.text || ''}</Text>
                      {msg?.type === 'photo' && msg?.media_url ? (
                        <Image source={{ uri: msg.media_url }} style={styles.msgPhoto} resizeMode="cover" />
                      ) : null}
                      {msg?.type === 'playlist' && msg?.external_url ? <Text style={styles.msgMediaHint}>🎵 Playlist paylasildi</Text> : null}
                      {msg?.type === 'voice' ? (
                        <TouchableOpacity
                          onPress={() => playVoiceNote(msg?.id, msg?.media_url)}
                          activeOpacity={0.85}
                          style={styles.voicePlayBtn}
                        >
                          <Text style={styles.voicePlayBtnText}>
                            {playingVoiceId === msg?.id ? '⏸ Oynatiliyor...' : '▶ Sesli notu oynat'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <Text style={styles.msgTime}>{msg?.time || 'Simdi'}</Text>
                    {!isOwn ? (
                      <TouchableOpacity onPress={() => setReportMsg(msg)}>
                        <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '700' }}>Bildir</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
          <View style={styles.chatInput}>
            <TextInput
              style={styles.chatInputField}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Bir sey soyle..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              returnKeyType="send"
              onSubmitEditing={handleSendChatMessage}
            />
            <View style={styles.chatInputButtons}>
              <TouchableOpacity onPress={handleSendSong} activeOpacity={0.8}>
                <Text style={styles.chatBtn}>🎵</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSendChatMessage} disabled={sendingMessage} activeOpacity={0.8}>
                <Text style={[styles.chatBtn, styles.chatBtnSend, sendingMessage && styles.chatBtnDisabled]}>▶</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>⚑ Ritual Kurallari</Text>
          <Text style={styles.ruleItem}>• Check-in zorunlu: canlı GPS + masa kodu (söyle / göster / LOCAL-TAG).</Text>
          <Text style={styles.ruleItem}>• Ritual sonrasi geri bildirim Windowni kacirma.</Text>
          <Text style={styles.ruleItem}>• Baslamadan once iptal edersen ceza uygulanmaz.</Text>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Text style={styles.ctaHint}>{checkinCountdown.label}</Text>
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaMain, !checkinCountdown.open && styles.ctaMainDisabled]}
            onPress={() => {
              if (!checkinCountdown.open) return;
              navigation.navigate('RitualCheckIn', { ritualId: ritual?.id, ritual });
            }}
            disabled={!checkinCountdown.open}
          >
            <Text style={[styles.ctaMainText, !checkinCountdown.open && styles.ctaMainTextDisabled]}>{checkinCountdown.open ? 'Check-in Yap →' : 'Check-in Baslamadi'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSide}><Text style={styles.ctaSideText}>👥</Text></TouchableOpacity>
        </View>
      </View>
      <ReportModal
        visible={Boolean(reportMsg)}
        onClose={() => setReportMsg(null)}
        reportType="prelobby_message"
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: 'prelobby_message',
              targetId: reportMsg?.id,
              ritualId: ritual?.id || ritualId,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', 'Prelobby mesajı kuyruğa alındı');
            setReportMsg(null);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B2E4A' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },
  moreText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  title: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  content: { paddingBottom: 130 },
  identity: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 16 },
  pulseLockRow: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  lockMomentBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,169,106,0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  lockMomentLabel: { color: '#C8A96A', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  lockMomentValue: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 },
  lockMomentHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 4 },
  openedCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fffaf0',
    padding: 12,
  },
  openedTitle: { color: '#92400e', fontSize: 13, fontWeight: '800' },
  openedBody: { color: '#78350f', fontSize: 12, marginTop: 4, lineHeight: 18 },
  identityType: { color: 'rgba(255,255,255,0.42)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: '700' },
  ritualTitle: {
    marginTop: 6,
    color: '#fff',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  venue: { marginTop: 5, color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center' },
  badgeRow: { marginTop: 10, flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  badgeGold: { backgroundColor: 'rgba(200,169,106,0.2)', borderWidth: 1, borderColor: 'rgba(200,169,106,0.35)', color: '#C8A96A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 9, fontWeight: '700' },
  badgeGreen: { backgroundColor: 'rgba(22,163,74,0.15)', borderWidth: 1, borderColor: 'rgba(22,163,74,0.3)', color: '#4ade80', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 9, fontWeight: '700' },
  badgeNavy: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, fontSize: 9, fontWeight: '700' },

  countdownCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  countTop: { color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700' },
  timerRow: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  timerUnit: { alignItems: 'center' },
  timerNum: { minWidth: 62, textAlign: 'center', color: '#fff', fontSize: 52, lineHeight: 54, letterSpacing: -2, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  timerLbl: { marginTop: 2, color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  timerSep: { color: 'rgba(255,255,255,0.2)', fontSize: 40, lineHeight: 42, paddingTop: 6, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  countHint: { marginTop: 10, color: 'rgba(255,255,255,0.45)', fontSize: 11 },
  graceLockBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(200,169,106,0.35)',
    backgroundColor: 'rgba(200,169,106,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  graceUnlockBanner: {
    borderColor: 'rgba(22,163,74,0.35)',
    backgroundColor: 'rgba(22,163,74,0.12)',
  },
  graceLockBannerTitle: { color: '#C8A96A', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  graceLockBannerText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18 },
  locationCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  locationCardLocked: { opacity: 0.92 },
  locationMap: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#233d60',
  },
  mapPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C8A96A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinText: { fontSize: 16 },
  mapLockText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  locationBody: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  locationIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  locationName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  locationAddr: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 2 },
  locationTypeHint: { color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 4 },
  locationArrow: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  hostNotesCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  hostNotesTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  hostNotesBody: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 18 },

  checkInBtn: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(200,169,106,0.95)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkInText: { color: '#000', fontSize: 14, fontWeight: '700' },

  sectionHeader: { marginTop: 2, marginBottom: 10, marginHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '600' },
  countPill: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  empty: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginHorizontal: 16, marginBottom: 10 },
  participantPrivacyCard: { marginHorizontal: 16, marginBottom: 14, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  participantPrivacyText: { color: 'rgba(255,255,255,0.62)', fontSize: 12 },
  friendJoiningText: { marginTop: 7, color: '#c8a96a', fontSize: 12, fontWeight: '700' },

  attGrid: { marginHorizontal: 16, marginBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  attItem: { width: '22%', alignItems: 'center' },
  attAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  attInitial: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  attStatus: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    right: 1,
    bottom: 1,
    borderWidth: 2,
    borderColor: '#1B2E4A',
  },
  attStatusConfirmed: { backgroundColor: '#16A34A' },
  attStatusPending: { backgroundColor: '#D97706' },
  attStatusHost: { backgroundColor: '#C8A96A' },
  attName: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 9, fontWeight: '500', maxWidth: 56 },
  attFl: { marginTop: 2, color: '#4ade80', fontSize: 8, fontWeight: '700' },
  attRs: { marginTop: 1, color: 'rgba(255,255,255,0.34)', fontSize: 8 },
  chatSection: { marginHorizontal: 16, marginBottom: 14 },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  chatHeaderLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  chatHeader: { color: 'rgba(255,255,255,0.32)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  msgRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  msgAvatarHost: { borderColor: 'rgba(200,169,106,0.4)' },
  msgAvatarText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  msgName: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 3 },
  msgHostTag: { color: '#C8A96A', fontSize: 8, fontWeight: '700' },
  msgBubble: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderTopLeftRadius: 0, paddingHorizontal: 10, paddingVertical: 8 },
  msgBubbleHost: { backgroundColor: 'rgba(200,169,106,0.1)', borderColor: 'rgba(200,169,106,0.2)' },
  msgText: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 18 },
  msgPhoto: { marginTop: 8, width: 170, height: 130, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  msgMediaHint: { marginTop: 5, color: 'rgba(200,169,106,0.95)', fontSize: 10, lineHeight: 14 },
  voicePlayBtn: {
    marginTop: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  voicePlayBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
  msgTime: { color: 'rgba(255,255,255,0.25)', fontSize: 9, marginTop: 4 },
  chatInput: {
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 7,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInputField: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, paddingVertical: 0 },
  chatInputButtons: { flexDirection: 'row', gap: 4 },
  chatBtn: { width: 30, height: 30, textAlign: 'center', textAlignVertical: 'center', lineHeight: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', color: 'rgba(255,255,255,0.8)' },
  chatBtnSend: { backgroundColor: '#2A4470' },
  chatBtnRecording: { backgroundColor: '#DC2626', color: '#fff' },
  chatBtnDisabled: { opacity: 0.5 },

  rulesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rulesTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  ruleItem: { color: 'rgba(255,255,255,0.5)', fontSize: 11, lineHeight: 17, marginBottom: 4 },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,16,28,0.97)',
  },
  ctaHint: { textAlign: 'center', color: 'rgba(255,255,255,0.42)', fontSize: 11, marginBottom: 8 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  ctaMain: { flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: '#C8A96A' },
  ctaMainDisabled: { backgroundColor: 'rgba(200,169,106,0.45)' },
  ctaMainText: { color: '#000', fontSize: 14, fontWeight: '700' },
  ctaMainTextDisabled: { color: 'rgba(0,0,0,0.55)' },
  ctaSide: { width: 52, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  ctaSideText: { color: 'rgba(255,255,255,0.75)', fontSize: 18 },
});
