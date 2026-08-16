import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  ImageBackground,
  Dimensions,
  Share,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchRitualDetail, fetchPublicRitualDetail, joinRitual, createRitualInvite, getVenueFollows, followVenue, unfollowVenue, cancelAttendance, claimReplacementSlot, sendShareObject, publishRitual, fetchRitualMemories, createModReport, followRitualSeries, unfollowRitualSeries, cancelRitualSeries, fetchEventGroupUmbrella, cancelRitualAsHost, saveObject, unsaveObject, updateRitualFindNote, fetchRitualWindow, touchRitualWindowPresence, recordCheckinFunnelClient } from '../services/api';
import {
  joinRitualWaitlist,
  leaveRitualWaitlist,
  fetchRitualWaitlistStatus,
} from '../services/api';
import ReportModal from '../components/ReportModal';
import websocketService from '../services/websocket';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import { log } from '../utils/logger';
import { saveActiveRitualSnapshot } from '../components/ActiveRitualBubble';
import RitualLiveActivityBar from '../components/RitualLiveActivityBar';
import { requireVerifiedUser } from '../utils/verificationGuard';
import { navigateToLiveRitual } from '../utils/liveRitualNav';
import {
  getGraceCountdown,
  getGraceEndsAt,
  getLocationTypeLabel,
  getMaskedLocationHint,
  getOuterLocationSummary,
  isExactDetailsUnlocked,
  isPrelobbyPhase,
} from '../utils/ritualLifecycle';
import { formatSecondsCountdown, getViewerCheckedIn, getCheckinWindowInfo } from '../utils/checkinWindow';
import { formatRsLabel } from '../utils/rsVisibility';
import RepostedBadge from '../components/RepostedBadge';
import PulseRing from '../components/PulseRing';
import {
  getApiErrorMessage,
  getPenaltyBannerText,
  isWithinJoinGrace,
  JOIN_GRACE_MINUTES,
} from '../utils/penaltyHelpers';

const { width } = Dimensions.get('window');

export default function RitualDetailScreen({ route, navigation }) {
  const params = route.params || {};
  const ritualId = params.ritualId ?? params.ritual_id;
  const camelInviteToken = params.inviteToken ?? null;
  const snakeInviteToken = params.invite_token ?? null;
  const [ritual, setRitual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [followingVenue, setFollowingVenue] = useState(false);
  const [venueFollowLoading, setVenueFollowLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [hostCancelling, setHostCancelling] = useState(false);
  const [ritualSaved, setRitualSaved] = useState(false);
  const [claimingSlot, setClaimingSlot] = useState(false);
  const [archiveMemories, setArchiveMemories] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [siblingTables, setSiblingTables] = useState([]);
  const [waitlist, setWaitlist] = useState(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [windowReaders, setWindowReaders] = useState(null);
  const [windowReadOnly, setWindowReadOnly] = useState(false);

  const loadRitualRef = useRef(null);
  const currentRitualIdRef = useRef(ritualId);

  const { user } = useAuthStore();
  const waitlistEnabled = useConfigStore((s) => s.config?.stubs?.waitlist?.enabled !== false);
  const currentUserId = user?.id;
  // Support both camelCase (internal navigation) and snake_case (deep link query) invite token
  const [inviteToken] = useState(camelInviteToken || snakeInviteToken || null);

  const isArchivePhaseForFetch =
    ritual &&
    (ritual.status === 'archived' ||
      ritual.status === 'ended' ||
      ritual.lifecycle_phase === 'window' ||
      ritual.lifecycle_phase === 'archived');

  useEffect(() => {
    if (!ritualId || !isArchivePhaseForFetch) {
      setArchiveMemories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setArchiveLoading(true);
        const list = await fetchRitualMemories(ritualId, 40, currentUserId, { archive: true });
        if (!cancelled) setArchiveMemories(Array.isArray(list) ? list : []);
      } catch (_e) {
        if (!cancelled) setArchiveMemories([]);
      } finally {
        if (!cancelled) setArchiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ritualId, isArchivePhaseForFetch, currentUserId]);

  useEffect(() => {
    currentRitualIdRef.current = ritualId;
    log('RitualDetailScreen useEffect triggered, ritualId:', ritualId);

    // Hemen önceki Ritual verisini temizle; yanlış etkinlik görünmesin
    setRitual(null);
    setLoading(true);
    setError(null);

    let isMounted = true;
    let timeoutId = null;

    const loadRitual = async () => {
      if (!ritualId) {
        setError('Ritual not found.');
        setLoading(false);
        return;
      }
      try {
        log('Fetching ritual from API...', ritualId);

        const fetchPromise = currentUserId
          ? fetchRitualDetail(ritualId, currentUserId)
          : fetchPublicRitualDetail(ritualId);
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Request timeout after 15 seconds'));
          }, 15000);
        });

        const data = await Promise.race([fetchPromise, timeoutPromise]);

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (!isMounted) return;

        if (!data) {
          setError('Ritual bulunamadi veya kaldirilmis olabilir.');
          setLoading(false);
          return;
        }

        // Sadece bu ritualId için gelen yanıtı kabul et (race condition önlemi)
        const requestedId = currentRitualIdRef.current;
        const match = requestedId != null && data?.id != null && (String(data.id) === String(requestedId) || data.id === requestedId);
        if (!match) {
          log('Ignoring stale response for ritual', data?.id, 'current:', requestedId);
          return;
        }

        log('API response received', data.title || data.id);

        if (data && data.id) {
          setRitual(data);
          void recordCheckinFunnelClient(data.id, 'door_view', { surface: 'detail' });
          const winVis = String(data.window_visibility || '').toUpperCase();
          if (winVis === 'TRANSPARENT') {
            fetchRitualWindow(data.id)
              .then((win) => {
                if (!isMounted) return;
                setWindowReaders(win?.reader_count ?? 0);
                setWindowReadOnly(!!win?.read_only);
              })
              .catch(() => {
                if (isMounted) setWindowReaders(null);
              });
          } else {
            setWindowReaders(null);
            setWindowReadOnly(false);
          }
        } else {
          throw new Error('Ritual data not found or invalid');
        }
      } catch (err) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (!isMounted) return;
        console.error('=== ERROR in loadRitual ===', err.message);
        setLoading(false);
        setError(err.message || 'Failed to load ritual details. Please check your connection and try again.');
        return;
      }
      setLoading(false);
    };

    loadRitualRef.current = loadRitual;
    loadRitual();

    if (ritualId) {
      websocketService.connect();
      websocketService.subscribeToRitual(ritualId);
    }

    // Listen for ritual updates
    const handleRitualUpdate = (data) => {
      if (data.ritualId === ritualId && isMounted) {
        if (data.updateType === 'attendance_update') {
          setRitual(prev => ({
            ...prev,
            current_attendees: data.data.current_attendees
          }));
        }
      }
    };

    const handleRitualState = (data) => {
      if (data.ritualId === ritualId) {
        // Update ritual state if needed
      }
    };

    websocketService.on('ritual:update', handleRitualUpdate);
    websocketService.on('ritual:state', handleRitualState);

    // Cleanup
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      websocketService.off('ritual:update', handleRitualUpdate);
      websocketService.off('ritual:state', handleRitualState);
      websocketService.unsubscribeFromRitual(ritualId);
    };
  }, [ritualId, currentUserId]);

  // Check if current user follows this venue (when ritual has venue_id)
  useEffect(() => {
    if (!ritual?.venue_id || !currentUserId) {
      setFollowingVenue(false);
      return;
    }
    let cancelled = false;
    getVenueFollows()
      .then((list) => {
        if (cancelled) return;
        const found = (list || []).some((f) => String(f.venue_id) === String(ritual.venue_id));
        setFollowingVenue(!!found);
      })
      .catch(() => {
        if (!cancelled) setFollowingVenue(false);
      });
    return () => { cancelled = true; };
  }, [ritual?.venue_id, currentUserId]);

  // ZONE-EVENT: dolu Ritual → diğer Ritual önerileri
  useEffect(() => {
    const gid = ritual?.event_group_id;
    if (!gid) {
      setSiblingTables([]);
      return;
    }
    let cancelled = false;
    fetchEventGroupUmbrella(gid)
      .then((umbrella) => {
        if (cancelled || !umbrella) return;
        const me = (umbrella.tables || []).find((t) => String(t.id) === String(ritualId));
        const seats =
          me?.seats_left != null
            ? Math.max(0, Number(me.seats_left) || 0)
            : (Number(me?.capacity) || Number(ritual?.capacity) || 0) -
              (Number(me?.joined) || Number(ritual?.current_attendees) || 0);
        if (seats > 0 && !me?.is_full) {
          setSiblingTables([]);
          return;
        }
        // Full table → sibling tables with seats_left (Emirgan drop-in)
        setSiblingTables(me?.suggest_other_tables || []);
      })
      .catch(() => {
        if (!cancelled) setSiblingTables([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ritual?.event_group_id, ritual?.capacity, ritual?.current_attendees, ritualId]);

  // F1.5 yıldız listesi — masa dolduğunda sıra durumunu çek
  useEffect(() => {
    if (!waitlistEnabled || !ritualId || !ritual) return undefined;
    const seats = (Number(ritual.capacity) || 0) - (Number(ritual.current_attendees) || 0);
    if (seats > 0) {
      setWaitlist(null);
      return undefined;
    }
    let cancelled = false;
    fetchRitualWaitlistStatus(ritualId)
      .then((status) => {
        if (!cancelled) setWaitlist(status);
      })
      .catch(() => {
        if (!cancelled) setWaitlist(null);
      });
    return () => {
      cancelled = true;
    };
  }, [waitlistEnabled, ritualId, ritual?.capacity, ritual?.current_attendees]);

  const handleVenueFollowToggle = async () => {
    if (!requireVerifiedUser(user, 'Bu aksiyon icin universite e-postani dogrulamalısin.')) {
      return;
    }
    if (!ritual?.venue_id || venueFollowLoading) return;
    setVenueFollowLoading(true);
    try {
      if (followingVenue) {
        await unfollowVenue(ritual.venue_id);
        setFollowingVenue(false);
      } else {
        await followVenue(ritual.venue_id);
        setFollowingVenue(true);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Takip durumu guncellenemedi');
    } finally {
      setVenueFollowLoading(false);
    }
  };

  // Timeout fallback - if loading takes too long, show error
  // Removed aggressive timeout - let the API call handle its own timeout
  // This prevents false error messages when the network is just slow

  // Check if user is already a participant
  const isParticipant = ritual?.participants?.some(
    p => (p.id === currentUserId || p.user_id === currentUserId) && 
         p.status !== 'no_show' && 
         p.status !== 'left_early'
  );

  useEffect(() => {
    if (!ritual || !isParticipant || isExactDetailsUnlocked(ritual)) return undefined;
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [ritual, isParticipant]);

  // Helper: human-readable entry type label
  const getEntryTypeLabel = () => {
    if (!ritual?.entry_type) return null;
    switch (ritual.entry_type) {
      case 'invite_only':
        return 'Yalnizca Davetliler · Sadece host veya icerideki katilimcilarin arkadaslari katilabilir';
      case 'request_seat':
        return 'Yer Iste · Host onayi ile katilinir';
      case 'open':
      default:
        return 'Acik · Herkes katilabilir';
    }
  };

  const canInviteFriends =
    ritual &&
    ritual.entry_type === 'invite_only' &&
    currentUserId &&
    (ritual.host_id === currentUserId || isParticipant);

  const handleInviteFriend = async () => {
    if (!requireVerifiedUser(user, 'Davet gondermek icin universite e-postani dogrulamalısin.')) {
      return;
    }
    if (!canInviteFriends) return;

    try {
      const invite = await createRitualInvite(ritualId, currentUserId);
      const deepLink = `local://ritual/${ritualId}?invite_token=${invite.token}`;
      const message = `LOCAL'da bir invite-only Rituale davet edildin: "${ritual.title}".\n\nUygulamada bu linkle aç: ${deepLink}`;

      await Share.share({
        message,
      });
    } catch (error) {
      Alert.alert(
        'Invite Error',
        error.message || 'Daveti oluştururken bir hata oluştu. Lütfen tekrar dene.'
      );
    }
  };

  const refreshWaitlist = async () => {
    if (!ritualId) return;
    try {
      setWaitlist(await fetchRitualWaitlistStatus(ritualId));
    } catch (_e) {
      setWaitlist(null);
    }
  };

  const handleToggleWaitlist = async () => {
    if (!requireVerifiedUser(user, 'Yildiz listesine girmek icin dogrulama gerekir.')) {
      return;
    }
    setWaitlistBusy(true);
    try {
      if (waitlist?.waiting) {
        await leaveRitualWaitlist(ritualId);
        Alert.alert('Yildiz Listesi', 'Siradan cikildi.');
      } else {
        const result = await joinRitualWaitlist(ritualId);
        Alert.alert('Yildiz Listesi', `Siradasin — ${result?.position ?? '?'}. sira. Koltuk acilirsa otomatik katilirsin.`);
      }
      await refreshWaitlist();
    } catch (e) {
      Alert.alert('Yildiz Listesi', e?.message || 'Islem tamamlanamadi');
    } finally {
      setWaitlistBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!requireVerifiedUser(user, 'Verify your university email to join rituals.')) {
      return;
    }

    try {
      setJoining(true);
      const joinResult = await joinRitual(ritualId, currentUserId, inviteToken);
      await saveActiveRitualSnapshot(ritual);
      if (joinResult?.blocked_peer_warning) {
        Alert.alert(
          'Basarili',
          'Rituale katildin.\n\nBu masada blokladigin biri var. Karsi tarafa sinyal gitmez; istersen ayrilabilirsin.'
        );
      } else {
        Alert.alert('Basarili', 'Rituale katildin!');
      }
      // WebSocket will automatically update the attendance count
      // But we refresh to get full updated state
      if (loadRitualRef.current) {
        loadRitualRef.current();
      }
    } catch (error) {
      // Handle "already joined" as a success case, not an error
      if (error.message && error.message.includes('Already joined')) {
        Alert.alert('Zaten Katildin', 'Bu Ritualde zaten katilimcisin.');
        // Refresh to get updated state
        if (loadRitualRef.current) {
          loadRitualRef.current();
        }
      } else if (error.requires_invite) {
        Alert.alert(
          'Yalnizca Davetliler Rituali',
          error.message ||
            'Bu Rituale sadece host veya içerideki katılımcıların arkadaşları katılabilir. Katılmak için bir arkadaşından davet iste.'
        );
      } else if (error.code === 'PENALTY_SUSPENDED') {
        Alert.alert('Katilim Askida', getApiErrorMessage(error, 'No-show askisi aktif.'));
      } else {
        Alert.alert('Hata', getApiErrorMessage(error, 'Rituale katilim basarisiz'));
      }
    } finally {
      setJoining(false);
    }
  };

  const OUTDOOR_CATEGORY_KEYS = ['yuruyus_kosu', 'piknik_acik_hava', 'gezi_kesif', 'takim_spor'];
  const looksWeatherEligible = (r) => {
    if (!r || r.status === 'cancelled') return false;
    const start = r.start_time ? new Date(r.start_time) : null;
    if (!start || Number.isNaN(start.getTime())) return false;
    const now = Date.now();
    if (now > start.getTime()) return false;
    if (now < start.getTime() - 3 * 3600000) return false;
    const loc = String(r.location_type || '').toLowerCase();
    if (loc === 'zone') return true;
    const cat = String(r.category_key || r.category_label || r.category || '').toLowerCase();
    return OUTDOOR_CATEGORY_KEYS.some((k) => cat.includes(k) || cat.includes(k.replace(/_/g, ' ')));
  };

  const handleHostCancelRitual = () => {
    if (!ritual || String(ritual.host_id) !== String(currentUserId)) return;
    const weatherOk = looksWeatherEligible(ritual);
    const created = ritual.created_at ? new Date(ritual.created_at).getTime() : 0;
    const ageMin = created ? (Date.now() - created) / 60000 : Infinity;
    const isInstant = String(ritual.time_type || '').toLowerCase() === 'instant';
    const birthOk = isInstant && ageMin <= 10 && Number(ritual.sealed_count ?? ritual.seal_count ?? 1) === 1;
    const buttons = [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: birthOk ? 'Vazgeç (sessiz sil)' : 'Iptal et',
        style: 'destructive',
        onPress: async () => {
          try {
            setHostCancelling(true);
            const result = await cancelRitualAsHost(ritualId, {
              reason: birthOk ? 'birth_cancel' : 'host_cancel',
              category: ritual.category_label || ritual.category || null,
            });
            Alert.alert(
              result?.mode === 'hard_deleted' || result?.cancel_reason === 'birth_cancel'
                ? 'Silindi'
                : 'Iptal edildi',
              result?.mode === 'hard_deleted' || result?.cancel_reason === 'birth_cancel'
                ? 'Ritual sessizce kaldırıldı (birth cancel).'
                : 'Ritual host tarafindan iptal edildi.'
            );
            if (result?.mode === 'hard_deleted') {
              navigation.goBack();
            } else {
              loadRitualRef.current?.();
            }
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Iptal basarisiz');
          } finally {
            setHostCancelling(false);
          }
        },
      },
    ];
    if (weatherOk) {
      buttons.splice(1, 0, {
        text: 'Hava nedeniyle (cezasiz)',
        onPress: async () => {
          try {
            setHostCancelling(true);
            await cancelRitualAsHost(ritualId, {
              reason: 'weather_cancel',
              category: ritual.category_label || ritual.category || null,
            });
            Alert.alert('Iptal edildi', 'Hava nedeniyle cezasiz iptal kaydedildi.');
            loadRitualRef.current?.();
          } catch (e) {
            Alert.alert('Hata', e?.detail?.reason ? `Uygun degil: ${e.detail.reason}` : (e?.message || 'Iptal basarisiz'));
          } finally {
            setHostCancelling(false);
          }
        },
      });
    }
    Alert.alert(
      birthOk ? 'Masadan vazgeç' : 'Rituali iptal et',
      birthOk
        ? 'Anlık masa · 10 dk içinde · tek mühür — sessiz hard-delete, ceza yok.'
        : weatherOk
          ? 'Acik hava / zone masasi — baslangica 3 saat kala hava iptali cezasiz.'
          : 'Bu Ritual iptal edilecek. Katilimcilar bilgilendirilir.',
      buttons
    );
  };

  const handleToggleSaveRitual = async () => {
    if (!ritual?.id) return;
    try {
      if (ritualSaved) {
        await unsaveObject('ritual', ritual.id);
        setRitualSaved(false);
        Alert.alert('Kayit', 'Ritual kayitlardan cikarildi');
      } else {
        await saveObject('ritual', ritual.id);
        setRitualSaved(true);
        Alert.alert('Kayit', 'Ritual kaydedildi');
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kayit islemi basarisiz');
    }
  };

  const handleCancelAttendance = () => {
    const inJoinGrace =
      ritual?.viewer_checkin?.in_join_grace ||
      isWithinJoinGrace(ritual?.viewer_checkin?.joined_at, Date.now());

    const lockAt = ritual?.lock_moment_at ? new Date(ritual.lock_moment_at) : null;
    const lockClock =
      lockAt && !Number.isNaN(lockAt.getTime())
        ? lockAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
    const message = inJoinGrace
      ? `Katildiktan sonra ilk ${JOIN_GRACE_MINUTES} dakika icinde cezasiz cikabilirsin. Devam?`
      : lockClock
        ? `Kilit anından (${lockClock}) sonra replacement gerekebilir. Devam?`
        : 'Kilit anından sonra replacement gerekebilir. Devam?';

    Alert.alert(inJoinGrace ? 'Cezasiz Cikis' : 'Katilimi Iptal Et', message, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: inJoinGrace ? 'Cezasiz Cik' : 'Iptal Et',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const result = await cancelAttendance(ritualId);
            if (result?.pending_replacement) {
              Alert.alert(
                'Replacement Bekleniyor',
                result.message || 'Yerine biri katilirsa cezasiz cikarsin.'
              );
            } else if (result?.cancel_reason === 'grace_exit') {
              Alert.alert('Cikis Tamam', 'Join grace suresi icinde cezasiz ciktin.');
            } else if (result?.cancel_reason === 'early_cancel') {
              Alert.alert('Iptal Edildi', 'Serbest iptal Windownde cezasiz ciktin.');
            } else {
              Alert.alert('Iptal Edildi', 'Katilimin iptal edildi.');
            }
            if (loadRitualRef.current) loadRitualRef.current();
          } catch (error) {
            if (error?.status === 409 && error?.body?.requires_replacement) {
              Alert.alert('Replacement Gerekli', 'Once yerine birini bul veya replacement slotunu bekle.');
            } else {
              Alert.alert('Hata', error.message || 'Iptal basarisiz');
            }
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleClaimReplacement = async (slotId) => {
    setClaimingSlot(true);
    try {
      await claimReplacementSlot(ritualId);
      Alert.alert('Basarili', 'Replacement slotuna katildin.');
      if (loadRitualRef.current) loadRitualRef.current();
    } catch (error) {
      Alert.alert('Hata', error.message || 'Slot alinamadi');
    } finally {
      setClaimingSlot(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!ritual?.id) return;
    setPublishing(true);
    try {
      const updated = await publishRitual(ritual.id);
      setRitual((prev) => ({ ...prev, ...updated, status: updated.status || 'prelobby' }));
      Alert.alert('Yayinlandi', 'Ritual artik kesifte gorunur (PRELOBBY).');
    } catch (error) {
      Alert.alert('Hata', getApiErrorMessage(error, 'Yayinlanamadi'));
    } finally {
      setPublishing(false);
    }
  };

  const handleShareReplacementSlot = async () => {
    try {
      const friends = ritual?.participants?.filter(
        (p) => String(p.id || p.user_id) !== String(currentUserId)
      );
      if (!friends?.length) {
        Alert.alert('Arkadas yok', 'Ritualde paylasim yapabilecegin baska katilimci yok.');
        return;
      }
      const target = friends[0];
      const targetId = target.id || target.user_id;
      await sendShareObject(targetId, {
        object_type: 'ritual_send',
        object_id: ritualId,
        note: 'Yer acildi — replacement slotu',
        payload: { ritual_title: ritual.title, ritual_id: ritualId },
      });
      Alert.alert('Paylasildi', 'Replacement daveti Share-2-Person ile gonderildi.');
    } catch (e) {
      Alert.alert('Hata', e.message || 'Paylasim basarisiz');
    }
  };

  const handleOpenLiveRitual = () => {
    if (!requireVerifiedUser(user, 'Canli gorunumu acmak icin universite e-postani dogrulamalısin.')) {
      return;
    }
    // Check if user is in participants list
    const isParticipant = ritual?.participants?.some(
      p => (p.id === currentUserId || p.user_id === currentUserId) && p.status !== 'no_show'
    );

    if (!isParticipant) {
      Alert.alert(
        'Katilim Gerekli',
        'Canli gorunume erismeden once bu Rituale katilmalisin.',
        [
          { text: 'Iptal', style: 'cancel' },
          { text: 'Simdi Katil', onPress: handleJoin },
        ]
      );
      return;
    }

    // Check if ritual is live or within grace period
    if (!ritual) {
      Alert.alert('Hata', 'Ritual bilgisi su an kullanilamiyor');
      return;
    }

    const startTime = new Date(ritual.start_time);
    const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
    const gracePeriodEnd = new Date(endTime.getTime() + 60 * 60000); // 60 min grace period
    const currentTime = new Date();

    // Allow access if ritual is live or within grace period
    if (ritual.status !== 'live' && ritual.time_state !== 'live_now' && ritual.lifecycle_phase !== 'live') {
      if (isPrelobbyPhase(ritual) || currentTime < startTime) {
        navigation.navigate('WaitingRoom', { ritualId: ritual.id, ritual });
        return;
      }
      if (currentTime > gracePeriodEnd) {
        Alert.alert(
          'Ritual Sona Erdi',
          'Bu Ritual sona erdi. Canli Window artik kullanilamiyor.',
          [{ text: 'Tamam' }]
        );
        return;
      }
    }

    saveActiveRitualSnapshot(ritual);

    const viewerCheckedIn = getViewerCheckedIn(ritual, currentUserId);
    const ritualIsLive =
      ritual.status === 'live' ||
      ritual.time_state === 'live_now' ||
      ritual.lifecycle_phase === 'live';

    if (ritualIsLive && !viewerCheckedIn) {
      navigation.navigate('RitualCheckIn', { ritualId: ritual.id, ritual });
      return;
    }

    navigateToLiveRitual(navigation, { ritualId: ritual.id });
  };

  const handleShareRitual = async () => {
    if (!requireVerifiedUser(user, 'Paylasim yapmak icin universite e-postani dogrulamalısin.')) {
      return;
    }
    try {
      // Prefer invite share when the ritual is invite-only and user can invite friends
      if (canInviteFriends) {
        await handleInviteFriend();
        return;
      }

      const deepLink = `local://ritual/${ritualId}`;
      const message = `LOCAL Ritual: "${ritual?.title || 'Ritual'}"\n\nOpen in app: ${deepLink}`;
      await Share.share({ message });
    } catch (e) {
      // Best-effort share; ignore if cancelled or fails
      log('Share failed:', e?.message);
    }
  };

  const handleOpenLastMemory = () => {
    const memory = ritual?.last_memory;
    if (!memory) {
      Alert.alert('Ani bulunamadi', 'Bu Ritual icin gosterilecek bir ani yok.');
      return;
    }
    navigation.navigate('MemoryDetail', {
      memory: {
        ...memory,
        ritual_title: ritual?.title || memory?.ritual_title || 'Ritual',
        is_pulse_shared: memory?.memory_type === 'pulse' || memory?.is_pulse_shared === true,
      },
    });
  };

  if (loading && !ritual && !error) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.text} />
        <Text style={styles.loadingText}>Loading ritual details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            log('Manual retry pressed');
            setError(null);
            setLoading(true);
            if (loadRitualRef.current) {
              loadRitualRef.current();
            }
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!ritual) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Ritual not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format time
  const startTime = new Date(ritual.start_time);
  const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
  const isToday = startTime.toDateString() === new Date().toDateString();
  const timeLabel = isToday ? 'Tonight' : startTime.toLocaleDateString('en-US', { weekday: 'long' });
  const timeRange = `${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const durationHours = Math.floor(ritual.duration / 60);
  const durationMinutes = ritual.duration % 60;
  const durationText = durationHours > 0 ? `${durationHours} hour${durationHours > 1 ? 's' : ''}${durationMinutes > 0 ? ` ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}` : ''}` : `${durationMinutes} minutes`;
  
  // Get tags from related_hobbies or type
  const tags = [];
  if (ritual.related_hobbies && ritual.related_hobbies.length > 0) {
    tags.push(...ritual.related_hobbies.slice(0, 3));
  } else if (ritual.type) {
    tags.push(ritual.type);
  }
  // Add default tags if needed
  if (tags.length === 0) {
    tags.push('Social', 'Vibrant');
  }
  
  // Calculate progress
  const progress = ritual.capacity > 0 ? (ritual.current_attendees / ritual.capacity) : 0;
  
  // Get host RS score from backend
  const hostRS = ritual.host?.rs_score ?? null;
  const hostRsLabel = formatRsLabel(hostRS);

  const heroImageUri =
    ritual.image_url ||
    ritual.image ||
    ritual.photo_url ||
    'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800';

  const hostName = ritual.host?.name || ritual.host_name || 'Host';
  const hostAvatarUri =
    ritual.host?.avatar_url ||
    ritual.host?.image_url ||
    ritual.host_avatar_url ||
    ritual.host_image_url ||
    null;

  const attendees = Array.isArray(ritual.participants)
    ? ritual.participants.filter(p => p?.status !== 'no_show' && p?.status !== 'left_early')
    : [];
  const attendeeCount =
    (typeof ritual.current_attendees === 'number' ? ritual.current_attendees : null) ??
    (attendees.length || 0);

  const startTimeHHMM = startTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const countdown = (() => {
    const now = new Date();
    const diffMs = startTime.getTime() - now.getTime();
    if (ritual.status === 'live' || ritual.time_state === 'live_now') return 'Happening now';
    if (diffMs <= 0) return 'Starting soon';
    const totalMinutes = Math.round(diffMs / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `Starting in ${m}m`;
    return `Starting in ${h}h ${m}m`;
  })();
  const liveWindowLabel = (() => {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const graceEndMs = endMs + 60 * 60000;
    const nowMs = Date.now();
    if (nowMs < endMs) {
      const mins = Math.max(0, Math.ceil((endMs - nowMs) / 60000));
      return `Canli Window: ${mins} dk`;
    }
    if (nowMs < graceEndMs) {
      const mins = Math.max(0, Math.ceil((graceEndMs - nowMs) / 60000));
      return `Grace Window: ${mins} dk`;
    }
    return 'Canli Window kapandi';
  })();

  const getTagChipStyle = (tag, index) => {
    const palette = ['#ff944d', '#ef4444', '#8b5cf6', '#22c55e', '#0ea5e9'];
    const bg = palette[index % palette.length];
    return { backgroundColor: bg };
  };

  const costText = (() => {
    const raw = ritual.cost_label ?? ritual.cost ?? ritual.price;
    if (raw === 0) return 'Free';
    if (raw === null || raw === undefined || raw === '') return ritual.is_free ? 'Free' : 'Free';
    if (ritual.is_free) return 'Free';
    return typeof raw === 'string' ? raw : `${raw}`;
  })();

  const isLive = ritual.status === 'live' || ritual.time_state === 'live_now' || ritual.lifecycle_phase === 'live';
  const canJoinInviteOnly = ritual.entry_type !== 'invite_only' || !!inviteToken;
  const isHost = ritual.host_id === currentUserId;
  const isDraftRitual = ritual.status === 'created' || ritual.status === 'draft';
  const showPublishCta = isHost && isDraftRitual;
  const penaltyBannerText = getPenaltyBannerText(user?.penalty);
  const isPenaltySuspended = !!user?.penalty?.is_penalty_suspended;
  const inJoinGrace =
    ritual?.viewer_checkin?.in_join_grace ||
    isWithinJoinGrace(ritual?.viewer_checkin?.joined_at, nowMs);
  const primaryDisabled =
    joining ||
    isParticipant ||
    !canJoinInviteOnly ||
    (isDraftRitual && !isHost) ||
    isPenaltySuspended;
  const primaryLabel = isPenaltySuspended
    ? 'Katilim Askida'
    : isParticipant
      ? 'Zaten Katildin'
      : ritual.entry_type === 'invite_only' && !inviteToken
        ? 'Yalnizca Davetliler'
        : 'Yer Al';

  const doorInfo = getCheckinWindowInfo(ritual, nowMs);
  const viewerCheckedIn = getViewerCheckedIn(ritual, currentUserId);
  const showLiveCta =
    isParticipant && (isLive || doorInfo.door_open) && viewerCheckedIn;
  // sonMD §1: [CHECK-IN] start−15 · host imtiyazı yok — host da mühürler
  const showCheckInCta =
    isParticipant && doorInfo.door_open && !viewerCheckedIn;
  const showWaitingCta = isParticipant && !doorInfo.door_open && !isLive;
  const lastMemoryImageUri =
    ritual?.last_memory?.image_url ||
    ritual?.last_memory?.photo_url ||
    ritual?.last_memory?.content_url ||
    ritual?.last_memory?.ritual_image_url ||
    ritual?.image_url ||
    ritual?.photo_url ||
    null;
  const seatsLeft = Math.max(0, (ritual.capacity || 0) - (attendeeCount || 0));
  
  // Format memory date
  const formatMemoryDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffWeeks > 0) {
      return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return 'Today';
    }
  };

  const venueAddress = ritual.venue_address || ritual.venue_location || ritual.host?.city || '';
  const exactUnlocked = isExactDetailsUnlocked(ritual);
  const graceEndsAt = getGraceEndsAt(ritual);
  const graceCountdown = getGraceCountdown(graceEndsAt, nowMs);
  const inPrelobby = isPrelobbyPhase(ritual);
  const outerLocationSummary = getOuterLocationSummary(ritual);
  const locationHint = getMaskedLocationHint(isParticipant);
  const displayAddress = exactUnlocked
    ? (ritual.location_address || venueAddress || outerLocationSummary)
    : outerLocationSummary;
  const friendsInterested = ritual.social_signals?.friends_interested ?? 0;
  const totalInterested = ritual.social_signals?.total_interested ?? attendeeCount ?? 0;
  const showForumCta =
    ritual.forum_enabled &&
    isParticipant &&
    (ritual.lifecycle_phase === 'window' || ritual.lifecycle_phase === 'archived');
  const isArchivePhase =
    ritual.status === 'archived' ||
    ritual.status === 'ended' ||
    ritual.lifecycle_phase === 'window' ||
    ritual.lifecycle_phase === 'archived';
  const visibilityLabel = {
    public: 'Public',
    venue_only: 'Venue Only',
    regular_only: 'Regular Only',
  }[ritual.visibility] || null;

  const wallMemories = archiveMemories.filter((m) => !m?.is_retro);
  const retroMemories = archiveMemories.filter((m) => !!m?.is_retro);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lightScrollContent}>
        {penaltyBannerText ? (
          <View style={styles.penaltyBanner}>
            <MaterialIcons name="info-outline" size={16} color="#92400e" />
            <Text style={styles.penaltyBannerText}>{penaltyBannerText}</Text>
          </View>
        ) : null}
        {/* Hero image */}
        <View style={styles.lightHeroWrap}>
          <ImageBackground
            source={heroImageUri ? { uri: heroImageUri } : null}
            style={styles.lightHeroImage}
            imageStyle={styles.lightHeroImageStyle}
          >
            <View style={styles.heroStatusBar}>
              <Text style={styles.heroStatusTime}>{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.heroStatusIcons}>▲▲▲</Text>
            </View>
            <View style={styles.heroTopControls}>
              <TouchableOpacity style={styles.heroCircleBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                <Text style={styles.heroCircleBtnIcon}>←</Text>
              </TouchableOpacity>
              <View style={styles.heroRightButtons}>
                <TouchableOpacity style={styles.heroCircleBtn} onPress={handleShareRitual} activeOpacity={0.85}>
                  <Text style={styles.heroCircleBtnIcon}>↗</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.heroCircleBtn}
                  onPress={() => setShowReportModal(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.heroCircleBtnIcon}>⚑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroCircleBtn} activeOpacity={0.85}>
                  <Text style={styles.heroCircleBtnIcon}>···</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.lightTimeBadge}>
              <Text style={styles.lightTimeBadgeTime}>{startTimeHHMM}</Text>
              <Text style={styles.lightTimeBadgeLabel}>{timeLabel}</Text>
            </View>
            {isLive && (
              <View style={styles.lightLiveBadge}>
                <View style={styles.lightLiveIcon} />
                <Text style={styles.lightLiveText}>LIVE</Text>
              </View>
            )}
            {isLive && (
              <View style={styles.liveWindowCounter}>
                <Text style={styles.liveWindowCounterText}>{liveWindowLabel}</Text>
              </View>
            )}
            <View style={styles.heroBottomOverlay}>
              <View style={styles.heroTagRow}>
                {isLive ? <Text style={[styles.heroTagPill, styles.heroTagLive]}>● CANLI</Text> : null}
                {(ritual.reposted_at || ritual.repost_count > 0) ? (
                  <View style={styles.heroRepostedWrap}>
                    <RepostedBadge repostCount={ritual.repost_count} repostedAt={ritual.reposted_at} compact />
                  </View>
                ) : null}
                {ritual.is_host_verified ? <Text style={[styles.heroTagPill, styles.heroTagSoft]}>✓ Dogrulanmis Host</Text> : null}
                {ritual.is_venue_verified ? <Text style={[styles.heroTagPill, styles.heroTagGold]}>★ LOCAL HQ</Text> : null}
                {ritual.type_badge ? (
                  <Text style={[styles.heroTagPill, styles.heroTagSoft]}>{ritual.type_badge}</Text>
                ) : null}
                {ritual.spark_born ? (
                  <Text style={[styles.heroTagPill, styles.heroTagGold]}>⚡ SPARK</Text>
                ) : null}
                {(ritual.has_fee || ritual.fee?.amount != null || ritual.fee_amount != null) ? (
                  <Text style={[styles.heroTagPill, styles.heroTagFee]}>
                    ₺{Number(ritual.fee?.amount ?? ritual.fee_amount).toFixed(
                      Number(ritual.fee?.amount ?? ritual.fee_amount) % 1 === 0 ? 0 : 2
                    )}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.heroMainTitle} numberOfLines={2}>{ritual.title}</Text>
              {windowReaders != null ? (
                <Text style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                  {windowReadOnly ? 'Salt okunur · ' : ''}
                  {windowReaders} okuyucu
                </Text>
              ) : null}
              <Text style={styles.heroMainMeta}>📍 {ritual.venue_name || 'Mekan'} · {timeLabel} {startTimeHHMM}</Text>
            </View>
          </ImageBackground>
        </View>

        {/* Main content */}
        <View style={styles.lightMainContent}>
          {isParticipant && (isLive || ritual.lifecycle_phase === 'window') ? (
            <RitualLiveActivityBar
              ritualId={ritualId}
              phase={ritual.lifecycle_phase || ritual.status}
              enabled
            />
          ) : null}
          {(() => {
            const chips = ritual.chip_breakdown;
            if (!chips) return null;
            if (chips.hidden) {
              return chips.teaser ? (
                <Text style={{ marginBottom: 10, color: '#64748b', fontSize: 12 }}>{chips.teaser}</Text>
              ) : null;
            }
            const rows = (chips.breakdown || []).slice(0, 5);
            if (!rows.length) return null;
            return (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.lightSectionTitle}>Chip ozeti</Text>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2, marginBottom: 6 }}>
                  Ritual kirilimi · kisi puani degil
                </Text>
                {rows.map((c) => (
                  <Text key={c.chip_id} style={{ color: '#334155', fontSize: 13, marginTop: 2 }}>
                    {c.chip_id}: {c.total}
                  </Text>
                ))}
              </View>
            );
          })()}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={styles.lightSectionTitle}>Nabız</Text>
            <PulseRing
              mode={
                ritual.pulse?.mode ||
                (isLive ? 'LIVE' : ritual.status === 'archived' || ritual.lifecycle_phase === 'window' ? 'ARCHIVE' : 'PRELOBBY')
              }
              ratio={
                ritual.pulse?.value ??
                ritual.pulse?.rq_average ??
                ritual.pulse?.occupancy_ratio ??
                progress
              }
              count={attendeeCount || 0}
              checkinRatio={ritual.pulse?.checkin_ratio ?? ritual.checkin_ratio}
              memoryTempo={ritual.pulse?.memory_tempo ?? ritual.memory_tempo}
              rqAverage={ritual.pulse?.rq_average ?? ritual.rq_average}
              liveMix={ritual.pulse?.live_mix}
              lowThreshold={ritual.pulse?.bands?.low ?? 0.4}
              midThreshold={ritual.pulse?.bands?.mid ?? 0.7}
            />
          </View>
          <View style={styles.lockMomentDetailCard}>
            <Text style={styles.lockMomentDetailLabel}>KİLİT-ANI</Text>
            <Text style={styles.lockMomentDetailValue}>
              {(() => {
                const lockAt = ritual.lock_moment_at
                  ? new Date(ritual.lock_moment_at).getTime()
                  : null;
                if (!lockAt) {
                  const createdMs = ritual.created_at ? new Date(ritual.created_at).getTime() : nowMs;
                  const startMs = startTime.getTime();
                  const estimated = createdMs + Math.max(0, startMs - createdMs) * 0.25;
                  const rem = Math.max(0, Math.ceil((estimated - nowMs) / 1000));
                  return rem <= 0 ? 'Kilit geçti' : formatSecondsCountdown(rem);
                }
                const rem = Math.max(0, Math.ceil((lockAt - nowMs) / 1000));
                return rem <= 0 ? 'Kilit geçti' : formatSecondsCountdown(rem);
              })()}
            </Text>
            <Text style={styles.lockMomentDetailHint}>
              {timeLabel} · {startTimeHHMM} · {attendeeCount || 0}/{ritual.capacity || 0}
            </Text>
          </View>
          {ritual.series?.series_id || ritual.series?.series_name ? (
            <View style={styles.lightSection}>
              <Text style={styles.lightSectionTitle}>Seri</Text>
              <Text style={styles.infoLabel}>
                {ritual.series.card_label ||
                  `${ritual.series.series_name || ritual.title}${
                    ritual.series.week != null ? ` · ${ritual.series.week}. hafta` : ''
                  }`}
              </Text>
              <Text style={styles.infoSub}>
                {ritual.series.cadence_label || 'Her hafta'} ·{' '}
                {ritual.series.open_ended === false && ritual.series.end_after_weeks
                  ? `${ritual.series.end_after_weeks} tekrar`
                  : 'açık uçlu'}{' '}
                · kayıt/kod/window/feedback bağımsız
              </Text>
              {ritual.series.series_id ? (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('SeriesDetail', { seriesId: ritual.series.series_id })
                  }
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={styles.infoSub}>Seri sayfası · hafta sayacı ve arşiv →</Text>
                </TouchableOpacity>
              ) : null}
              {(ritual.series.archive_links || []).slice(0, 4).map((link) => (
                <TouchableOpacity
                  key={link.id}
                  onPress={() => navigation.push('RitualDetail', { ritualId: link.id })}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={styles.infoSub}>
                    Arşiv · {link.title || `${link.series_week}. hafta`} →
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#f0f0ed',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                  }}
                  onPress={async () => {
                    try {
                      const following = ritual.series?.follow?.following;
                      if (following) {
                        await unfollowRitualSeries(ritual.series.series_id);
                        Alert.alert('Seri', 'Takip ve zil kapatıldı');
                      } else {
                        await followRitualSeries(ritual.series.series_id, true);
                        Alert.alert('Seri', 'Takip + zil açıldı');
                      }
                      loadRitualRef.current?.();
                    } catch (e) {
                      Alert.alert('Hata', e?.message || 'İşlem başarısız');
                    }
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>
                    {ritual.series?.follow?.following ? 'Zili kapat' : 'Seriyi takip et (zil)'}
                  </Text>
                </TouchableOpacity>
                {isHost ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#e0f2fe',
                      borderRadius: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                    onPress={() =>
                      navigation.navigate('Collaborators', {
                        scope: 'series',
                        scopeId: ritual.series.series_id,
                        canManage: true,
                      })
                    }
                  >
                    <Text style={{ fontWeight: '700', color: '#075985' }}>Collaborators</Text>
                  </TouchableOpacity>
                ) : null}
                {isHost ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#fee2e2',
                      borderRadius: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                    onPress={() => {
                      Alert.alert(
                        'Seriyi iptal et',
                        'Gelecek haftalar düşer; geçmiş arşiv kalır.',
                        [
                          { text: 'Vazgeç', style: 'cancel' },
                          {
                            text: 'İptal et',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const r = await cancelRitualSeries(ritual.series.series_id);
                                Alert.alert('Tamam', `${r?.cancelled || 0} gelecek instance iptal`);
                                loadRitualRef.current?.();
                              } catch (e) {
                                Alert.alert('Hata', e?.message || 'İptal başarısız');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: '#991b1b' }}>Seriyi iptal</Text>
                  </TouchableOpacity>
                ) : null}
                {isHost ? (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#f0f0ed',
                      borderRadius: 10,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                    }}
                    onPress={() =>
                      navigation.navigate('SeriesDetail', { seriesId: ritual.series.series_id })
                    }
                  >
                    <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>Host devret</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}><Text>📍</Text></View>
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>Masayi bul</Text>
              <Text style={styles.infoSub}>{ritual.find_note || 'Henuz not yok'}</Text>
              {(isHost || isParticipant) && ritual.status !== 'cancelled' ? (
                <TouchableOpacity
                  style={{ marginTop: 6 }}
                  onPress={() => {
                    const saveNote = async (text) => {
                      try {
                        await updateRitualFindNote(ritualId, text);
                        Alert.alert('Tamam', 'find_note guncellendi');
                        loadRitualRef.current?.();
                      } catch (e) {
                        Alert.alert('Hata', e?.message || 'Guncellenemedi');
                      }
                    };
                    if (Alert.prompt) {
                      Alert.prompt(
                        'Masayi bul notu',
                        'En fazla 60 karakter',
                        [
                          { text: 'Iptal', style: 'cancel' },
                          { text: 'Kaydet', onPress: saveNote },
                        ],
                        'plain-text',
                        ritual.find_note || ''
                      );
                    } else {
                      Alert.alert('find_note', 'Duzenleme iOS Prompt ile destekleniyor.');
                    }
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563eb' }}>Notu duzenle</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}><Text>📅</Text></View>
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>{timeLabel} · {timeRange}</Text>
              <Text style={styles.infoSub}>{durationText} · Live Window 12 saat acik kalir</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, styles.infoIconNavy]}><Text>📍</Text></View>
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>{displayAddress}</Text>
              <Text style={styles.infoSub}>
                {exactUnlocked
                  ? (ritual.location_type ? getLocationTypeLabel(ritual.location_type) : 'Tam konum acildi')
                  : locationHint}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}><Text>🎵</Text></View>
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>{tags.join(' · ')}</Text>
              <Text style={styles.infoSub}>Canli/sosyal deneyim</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, styles.infoIconGreen]}><Text>{ritual.entry_type === 'invite_only' ? '🔒' : '🔓'}</Text></View>
            <View style={styles.infoMain}>
              <Text style={styles.infoLabel}>{getEntryTypeLabel() || 'Acik Giris'} · {costText}</Text>
              <Text style={styles.infoSub}>{ritual.entry_type === 'invite_only' ? 'Davet ile katilim' : 'Herkes katilabilir'}</Text>
            </View>
          </View>

          <View style={styles.reqBlock}>
            <Text style={styles.reqTitle}>Ritual Gereksinimleri</Text>
            <View style={styles.reqRow}>
              <Text style={[styles.reqChip, styles.reqChipGray]}>{ritual.entry_type === 'invite_only' ? 'Yalnizca davetli' : 'Acik Giris'}</Text>
            </View>
          </View>

          {isParticipant && inPrelobby && !exactUnlocked ? (
            <View style={styles.graceLockCard}>
              <Text style={styles.graceLockTitle}>Grace kilidi aktif</Text>
              <Text style={styles.graceLockBody}>
                Prelobby sohbeti acik. Tam pin ve host notlari {graceCountdown.label} sonra acilacak.
              </Text>
              <TouchableOpacity
                style={styles.graceLockBtn}
                onPress={() => navigation.navigate('WaitingRoom', { ritualId: ritual.id, ritual })}
                activeOpacity={0.85}
              >
                <Text style={styles.graceLockBtnText}>Prelobby&apos;ye Git</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isParticipant && inPrelobby && exactUnlocked ? (
            <View style={[styles.graceLockCard, styles.graceUnlockCard]}>
              <Text style={styles.graceLockTitle}>Tam detaylar acildi</Text>
              <Text style={styles.graceLockBody}>
                {ritual.location_address || displayAddress}
              </Text>
            </View>
          ) : null}

          {/* Host & Venue */}
          <View style={styles.lightSection}>
            <Text style={styles.lightSectionTitle}>Host ve Mekan</Text>
            <View style={styles.lightHostVenueCard}>
              <TouchableOpacity
                style={styles.lightHostItem}
                onPress={() => {
                  const hostUserId = ritual.host?.id || ritual.host_id;
                  if (hostUserId && currentUserId && ritual?.id) {
                    navigation.navigate('ParticipantProfile', { userId: hostUserId, ritualId: ritual.id, viewerId: currentUserId });
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.lightHostAvatar}>
                  {hostAvatarUri ? (
                    <Image source={{ uri: hostAvatarUri }} style={styles.lightHostAvatarImg} />
                  ) : (
                    <View style={styles.lightHostAvatarPlaceholder} />
                  )}
                </View>
                <View style={styles.lightHostInfo}>
                  <Text style={styles.lightVenueName}>{hostName}</Text>
                  {ritual.host?.show_uni_label && ritual.host?.uni_label ? (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('UniversityProfile', {
                          name: ritual.host.uni_label,
                        })
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <Text style={[styles.lightHostRs, styles.lightVenueNameLink]}>
                        🎓 {ritual.host.uni_label}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {ritual.host?.hosted_count_visible && ritual.host?.hosted_count != null ? (
                    <Text style={styles.lightHostRs}>{ritual.host.hosted_count} hosting</Text>
                  ) : null}
                  {ritual.is_host_verified && (
                    <View style={styles.lightHostBadge}>
                      <Text>⭐</Text>
                      <Text style={styles.lightHostBadgeText}>Dogrulanmis Host</Text>
                    </View>
                  )}
                  {(ritual.host?.highlight_badges || []).slice(0, 3).map((b) => (
                    <Text key={b.key || b.id || b.label} style={styles.lightHostRs}>
                      {b.label || b.key || b}
                    </Text>
                  ))}
                </View>
              </TouchableOpacity>
              <View style={styles.lightVenueItem}>
                <Text style={styles.lightVenueIcon}>📍</Text>
                <View style={styles.lightVenueInfo}>
                  <View style={styles.lightVenueNameRow}>
                    {ritual.venue_id ? (
                      <TouchableOpacity onPress={() => navigation.navigate('VenueDetail', { venueId: ritual.venue_id })}>
                        <Text style={[styles.lightVenueName, styles.lightVenueNameLink]}>{ritual.venue_name || 'Mekan'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.lightVenueName}>{ritual.venue_name || 'Mekan'}</Text>
                    )}
                    {ritual.is_venue_verified && (
                      <View style={styles.lightVerifiedBadge}>
                        <Text style={styles.lightVerifiedBadgeText}>✓</Text>
                        <Text style={styles.lightVerifiedBadgeText}>Dogrulanmis Mekan</Text>
                      </View>
                    )}
                  </View>
                  {exactUnlocked && venueAddress ? <Text style={styles.lightVenueAddress}>{venueAddress}</Text> : null}
                  <Text style={styles.lightVenueNote}>{locationHint}</Text>
                  {ritual.venue_id && currentUserId ? (
                    <TouchableOpacity
                      style={styles.lightVenueFollowBtn}
                      onPress={handleVenueFollowToggle}
                      disabled={venueFollowLoading}
                    >
                      <Text style={styles.lightVenueFollowBtnText}>
                        {venueFollowLoading ? '…' : followingVenue ? '✓ Mekani takip ediyorsun' : 'Bu mekani takip et'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* About */}
          {ritual.description ? (
            <View style={styles.lightSection}>
              <Text style={styles.lightSectionTitle}>Bu Ritual Hakkinda</Text>
              <Text style={styles.lightAboutText}>
                {aboutExpanded ? ritual.description : truncateText(ritual.description, 300)}{' '}
                {ritual.description.length > 300 && (
                  <Text style={styles.lightInlineLink} onPress={() => setAboutExpanded(v => !v)}>
                    {aboutExpanded ? 'Daha az goster' : 'Daha fazla oku'}
                  </Text>
                )}
              </Text>
            </View>
          ) : null}

          {/* Memory from last time */}
          {ritual.last_memory ? (
            <View style={styles.lightSection}>
              <Text style={styles.lightSectionTitle}>Son Ritualden Ani</Text>
              <View style={styles.lightMemoryCard}>
                <View style={styles.lightMemoryImage}>
                  {lastMemoryImageUri ? (
                    <Image source={{ uri: lastMemoryImageUri }} style={styles.lightMemoryImageImg} />
                  ) : null}
                </View>
                <View style={styles.lightMemoryContent}>
                  <Text style={styles.lightMemoryHeader}>
                    {(ritual.last_memory.user_name === ritual.host?.name ? 'Host' : ritual.last_memory.user_name) || 'Biri'} paylasti · {formatMemoryDate(ritual.last_memory.created_at)}
                  </Text>
                  <Text style={styles.lightMemoryText} numberOfLines={3}>"{ritual.last_memory.content}"</Text>
                  <TouchableOpacity style={styles.lightMemoryBtn} onPress={handleOpenLastMemory}>
                    <Text style={styles.lightMemoryBtnText}>Gor</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {(ritual.replacement_slots || []).length > 0 ? (
            <View style={styles.replacementCard}>
              <Text style={styles.replacementTitle}>Yer Acildi</Text>
              <Text style={styles.replacementBody}>
                Bu Ritualde acik replacement slotu var. Tek tikla katilabilir veya arkadasina gonderebilirsin.
              </Text>
              <View style={styles.replacementActions}>
                <TouchableOpacity
                  style={styles.replacementBtn}
                  onPress={() => handleClaimReplacement()}
                  disabled={claimingSlot || isParticipant}
                >
                  {claimingSlot ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.replacementBtnText}>
                      {isParticipant ? 'Zaten katildin' : 'Slota Gir'}
                    </Text>
                  )}
                </TouchableOpacity>
                {isParticipant ? (
                  <TouchableOpacity style={styles.replacementShareBtn} onPress={handleShareReplacementSlot}>
                    <Text style={styles.replacementShareText}>Arkadasina Gonder</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Participation */}
          <View style={styles.lightSection}>
            <Text style={styles.lightSectionTitle}>Katilim</Text>
            <View style={styles.lightParticipationHeader}>
              <Text style={styles.lightSeatsCount}>{attendeeCount || 0} / {ritual.capacity || 0} koltuk</Text>
              <View style={styles.lightOpenBadge}>
                <Text style={styles.lightOpenBadgeText}>
                  {ritual.entry_type === 'open' ? 'Herkese acik' : ritual.entry_type === 'invite_only' ? 'Yalnizca davetliler' : 'Yer iste'}
                </Text>
              </View>
            </View>
            <View style={styles.lightProgressBar}>
              <View style={[styles.lightProgressFill, { width: `${Math.min(100, (progress || 0) * 100)}%` }]} />
            </View>
            <View style={styles.lightParticipationDetails}>
              <View style={styles.lightParticipationItem}>
                <Text style={styles.lightParticipationLabel}>Katilim bilgisi</Text>
                <Text style={styles.lightParticipationValue}>
                  {costText} · Icecekler dahil degil
                </Text>
              </View>
              <View style={[styles.lightParticipationItem, styles.lightParticipationItemRight]}>
                <Text style={styles.lightParticipationLabelGreen}>Acik katilim</Text>
              </View>
            </View>
          </View>

          {/* Social Signals — outer: FL only, no participant avatars */}
          {(friendsInterested > 0 || (!isParticipant && (totalInterested || attendeeCount || 0) > 0)) ? (
            <View style={styles.lightSection}>
              <Text style={styles.lightSectionTitle}>Social Signals</Text>
              <View style={styles.lightSocialContent}>
                {isParticipant ? (
                  <View style={styles.lightAvatarsRow}>
                    {attendees.slice(0, 3).map((p, i) => (
                      <View key={p?.id || i} style={[styles.lightAvatar, i === 0 && styles.lightAvatarFirst]}>
                        {p?.avatar_url || p?.image_url ? (
                          <Image source={{ uri: p.avatar_url || p.image_url }} style={styles.lightAvatarImg} />
                        ) : (
                          <Text style={styles.lightAvatarLetter}>{(p?.name || p?.user_name || '?').charAt(0)}</Text>
                        )}
                      </View>
                    ))}
                    {(attendeeCount || 0) > 3 && (
                      <View style={[styles.lightAvatar, styles.lightAvatarFirst]}>
                        <Text style={styles.lightAvatarPlus}>+{(attendeeCount || 0) - 3}</Text>
                      </View>
                    )}
                  </View>
                ) : null}
                <View style={styles.lightSocialText}>
                  {friendsInterested > 0 && (
                    <Text style={styles.lightSocialFriends}>
                      {friendsInterested > 1
                        ? `${friendsInterested} arkadaşın katılıyor`
                        : '1 arkadaşın katılıyor'}
                    </Text>
                  )}
                  {isParticipant ? (
                    <Text style={styles.lightSocialTotal}>{(totalInterested || attendeeCount || 0)} people interested</Text>
                  ) : (
                    <Text style={styles.lightSocialTotal}>{attendeeCount || 0} / {ritual.capacity || 0} doluluk</Text>
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {showForumCta ? (
            <TouchableOpacity
              style={styles.forumBanner}
              onPress={() =>
                navigation.navigate('RitualForum', {
                  ritualId: ritual.id,
                  ritualTitle: ritual.title,
                })
              }
              activeOpacity={0.9}
            >
              <Text style={styles.forumBannerTitle}>Local World Forum</Text>
              <Text style={styles.forumBannerSub}>
                Yorum · oy · repost {ritual.repost_count ? `· ${ritual.repost_count} repost` : ''}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isArchivePhase ? (
            <View style={styles.lightSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.lightSectionTitle}>Arşiv</Text>
                <PulseRing
                  mode="ARCHIVE"
                  ratio={
                    ritual.pulse?.value ??
                    ritual.pulse?.rq_average ??
                    ritual.pulse?.occupancy_ratio ??
                    progress
                  }
                  count={attendeeCount || 0}
                  rqAverage={ritual.pulse?.rq_average ?? ritual.rq_average}
                  lowThreshold={ritual.pulse?.bands?.low ?? 0.4}
                  midThreshold={ritual.pulse?.bands?.mid ?? 0.7}
                />
              </View>
              <Text style={styles.infoSub}>RQ-nabız · memories duvarı · retro</Text>
              {archiveLoading ? (
                <ActivityIndicator color="#111" style={{ marginTop: 12 }} />
              ) : (
                <>
                  <Text style={[styles.lightSectionTitle, { marginTop: 14, fontSize: 14 }]}>Memories duvarı</Text>
                  {wallMemories.length === 0 ? (
                    <Text style={styles.infoSub}>Henüz memory yok</Text>
                  ) : (
                    wallMemories.slice(0, 12).map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.archiveMemoryCard}
                        onPress={() => navigation.navigate('MemoryDetail', { memoryId: m.id })}
                      >
                        <Text style={styles.archiveMemoryText} numberOfLines={3}>
                          {m.content || m.text || 'Memory'}
                        </Text>
                        <Text style={styles.infoSub}>
                          {m.user_name || m.author_name || 'Katılımcı'}
                          {m.memory_scope ? ` · ${String(m.memory_scope).toUpperCase()}` : ''}
                          {m.created_at ? ` · ${new Date(m.created_at).toLocaleDateString('tr-TR')}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <Text style={[styles.lightSectionTitle, { marginTop: 14, fontSize: 14 }]}>Retro ek-memory</Text>
                  {retroMemories.length === 0 ? (
                    <Text style={styles.infoSub}>Retro memory yok</Text>
                  ) : (
                    retroMemories.slice(0, 8).map((m) => (
                      <TouchableOpacity
                        key={`retro-${m.id}`}
                        style={[styles.archiveMemoryCard, styles.archiveRetroCard]}
                        onPress={() => navigation.navigate('MemoryDetail', { memoryId: m.id })}
                      >
                        <Text style={styles.archiveMemoryText} numberOfLines={3}>
                          {m.content || m.text || 'Retro memory'}
                        </Text>
                        <Text style={[styles.infoSub, { marginTop: 6 }]}>
                          {(m.stamp_label || 'Damga') +
                            (m.captured_at
                              ? ` · ${new Date(m.captured_at).toLocaleDateString('tr-TR', {
                                  day: 'numeric',
                                  month: 'short',
                                })}`
                              : '')}
                        </Text>
                        {m.published_at ? (
                          <Text style={[styles.infoSub, { fontSize: 11 }]}>
                            Yayın{' '}
                            {new Date(m.published_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))
                  )}
                  {ritual.forum_enabled ? (
                    <TouchableOpacity
                      style={[styles.forumBanner, { marginTop: 14 }]}
                      onPress={() =>
                        navigation.navigate('RitualForum', {
                          ritualId: ritual.id,
                          ritualTitle: ritual.title,
                        })
                      }
                    >
                      <Text style={styles.forumBannerTitle}>Open Forum şeridi</Text>
                      <Text style={styles.forumBannerSub}>Arşiv tartışması · yorum / oy</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {showPublishCta ? (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerTitle}>Taslak Ritual</Text>
              <Text style={styles.draftBannerSub}>
                Yayinlanmadan kesifte gorunmez. Hazir olunca yayinla.
              </Text>
              <TouchableOpacity
                style={[styles.draftPublishBtn, publishing && styles.lightBtnDisabled]}
                onPress={handlePublishDraft}
                disabled={publishing}
              >
                {publishing ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.draftPublishBtnText}>Yayinla (Prelobby)</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {(visibilityLabel || ritual.definition_level) ? (
            <View style={styles.metaChipRow}>
              {visibilityLabel ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Gorunurluk: {visibilityLabel}</Text>
                </View>
              ) : null}
              {ritual.definition_level ? (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Tanim: {ritual.definition_level}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <View style={styles.ctaRow}>
          <TouchableOpacity style={[styles.ctaSaveBtn, saved && styles.ctaSaveBtnOn]} onPress={() => setSaved((v) => !v)} activeOpacity={0.85}>
            <Text style={styles.ctaSaveIcon}>{saved ? '❤️' : '🔖'}</Text>
          </TouchableOpacity>
          {showPublishCta ? (
            <TouchableOpacity
              style={[styles.ctaMainBtn, styles.ctaMainNavy, publishing && styles.lightBtnDisabled]}
              onPress={handlePublishDraft}
              disabled={publishing}
              activeOpacity={0.9}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaMainBtnText}>Taslagi Yayinla</Text>
              )}
            </TouchableOpacity>
          ) : showCheckInCta ? (
            <TouchableOpacity
              style={[styles.ctaMainBtn, styles.ctaMainNavy]}
              onPress={() => navigation.navigate('RitualCheckIn', { ritualId: ritual.id, ritual })}
              activeOpacity={0.9}
            >
              <Text style={styles.ctaMainBtnText}>Check-in Yap</Text>
            </TouchableOpacity>
          ) : showLiveCta ? (
            <TouchableOpacity style={[styles.ctaMainBtn, styles.ctaMainNavy]} onPress={handleOpenLiveRitual} activeOpacity={0.9}>
              <Text style={styles.ctaMainBtnText}>Canli Rituali Ac</Text>
            </TouchableOpacity>
          ) : showWaitingCta ? (
            <TouchableOpacity style={[styles.ctaMainBtn, styles.ctaMainNavy]} onPress={() => navigation.navigate('WaitingRoom', { ritualId: ritual.id, ritual })} activeOpacity={0.9}>
              <Text style={styles.ctaMainBtnText}>Prelobby&apos;yi Ac</Text>
            </TouchableOpacity>
          ) : (
            <>
            <TouchableOpacity style={[styles.ctaMainBtn, styles.ctaMainNavy, primaryDisabled && styles.lightBtnDisabled]} onPress={handleJoin} disabled={primaryDisabled} activeOpacity={0.9}>
              {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaMainBtnText}>{isParticipant ? '✓ Katildin' : `Rituale Katil — ${seatsLeft} yer kaldi`}</Text>}
            </TouchableOpacity>
            {seatsLeft <= 0 && waitlistEnabled && !isParticipant ? (
              <TouchableOpacity
                style={[styles.waitlistBtn, waitlistBusy && styles.lightBtnDisabled]}
                onPress={handleToggleWaitlist}
                disabled={waitlistBusy}
                activeOpacity={0.9}
              >
                {waitlistBusy ? (
                  <ActivityIndicator color="#111827" />
                ) : (
                  <Text style={styles.waitlistBtnText}>
                    {waitlist?.waiting
                      ? `Yildiz listesindesin — ${waitlist.position}. sira · Siradan cik`
                      : `Yildiz listesine gir${waitlist?.total_waiting ? ` (${waitlist.total_waiting} bekleyen)` : ''}`}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
            {seatsLeft <= 0 && siblingTables.length > 0 ? (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#111827', borderRadius: 12 }}>
                <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 12 }}>Bu Ritual dolu — diger Rituals</Text>
                {siblingTables.slice(0, 4).map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => navigation.replace('RitualDetail', { ritualId: t.id })}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: '#93c5fd', fontSize: 13 }}>
                      → {t.title} ({t.seats_left} yer)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            </>
          )}
        </View>
        {isParticipant && inPrelobby && ritual.status !== 'cancelled' ? (
          <>
            {inJoinGrace ? (
              <View style={styles.joinGraceBanner}>
                <Text style={styles.joinGraceTitle}>Join grace aktif</Text>
                <Text style={styles.joinGraceBody}>
                  Katildiktan sonra ilk {JOIN_GRACE_MINUTES} dakika icinde cezasiz cikabilirsin.
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
            style={[styles.ctaCancelBtn, cancelling && styles.lightBtnDisabled]}
            onPress={handleCancelAttendance}
            disabled={cancelling}
            activeOpacity={0.9}
          >
            {cancelling ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <Text style={styles.ctaCancelBtnText}>
                {inJoinGrace ? 'Cezasiz Cik (join grace)' : 'Katilimi Iptal Et (replacement)'}
              </Text>
            )}
          </TouchableOpacity>
          </>
        ) : null}
        {isHost && ritual.status !== 'cancelled' && !isLive ? (
          <TouchableOpacity
            style={[styles.ctaCancelBtn, hostCancelling && styles.lightBtnDisabled, { marginTop: 10 }]}
            onPress={handleHostCancelRitual}
            disabled={hostCancelling}
            activeOpacity={0.9}
          >
            {hostCancelling ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <Text style={styles.ctaCancelBtnText}>
                {looksWeatherEligible(ritual) ? 'Rituali iptal (hava secenegi)' : 'Rituali iptal et'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={{ marginTop: 12, alignSelf: 'center', paddingVertical: 8 }}
          onPress={handleToggleSaveRitual}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
            {ritualSaved ? '★ Kaydedildi' : '☆ Rituali kaydet'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>
          {showCheckInCta
            ? 'Canli Ritual basladi — check-in (GPS + keyword) ile devam et'
            : 'Ritual baslayinca check-in ekranindan giris yapilir'}
        </Text>
      </View>

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportType={ritual?.spark_born ? 'spark' : 'ritual'}
        onReport={async (payload) => {
          try {
            const targetType = ritual?.spark_born ? 'spark' : 'ritual';
            await createModReport({
              targetType,
              targetId: ritual?.id || ritualId,
              ritualId: ritual?.id || ritualId,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', ritual?.spark_born ? 'SPARK raporu kuyruğa alındı' : 'Ritual raporu kuyruğa alındı');
            setShowReportModal(false);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </View>
  );
}

// ritual-detail-light.html design tokens
const COLORS = {
  bg: '#e0e0e0',
  surface: '#ffffff',
  text: '#000000',
  muted: '#666666',
  iconMuted: '#666666',
  divider: '#e8e8e8',
  primary: '#000000',
  goldStart: '#d4af6d',
  goldEnd: '#b89252',
  verified: '#155724',
  verifiedVenue: '#155724',
  tagBg: '#e8e8e8',
  tagText: '#333333',
  cardBg: '#f8f8f8',
  hostBadgeBg: '#fff3cd',
  hostBadgeText: '#856404',
  openBadgeBg: '#d4edda',
  openBadgeText: '#155724',
  forumBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
  },
  forumBannerTitle: { color: '#f9fafb', fontSize: 16, fontWeight: '700' },
  forumBannerSub: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  archiveMemoryCard: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  archiveRetroCard: {
    borderColor: '#c8a96a',
    backgroundColor: '#fffbeb',
  },
  archiveMemoryText: { color: '#111', fontSize: 14, lineHeight: 20 },
  lockMomentDetailCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  lockMomentDetailLabel: { color: '#c8a96a', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  lockMomentDetailValue: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  lockMomentDetailHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  draftBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  draftBannerTitle: { fontSize: 16, fontWeight: '700', color: '#92400e' },
  draftBannerSub: { fontSize: 13, color: '#b45309', marginTop: 4, marginBottom: 12 },
  draftPublishBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f9a13d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  draftPublishBtnText: { fontWeight: '700', color: '#111' },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  metaChipText: { fontSize: 12, color: '#4b5563', fontWeight: '600' },
};

const HEADER_TOP = (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 22;

function truncateText(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}...`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    paddingTop: 110,
    paddingBottom: 32,
  },
  lightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 44) + 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  lightBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lightBackIcon: { fontSize: 24, color: COLORS.text },
  lightBackLabel: { fontSize: 17, fontWeight: '400', color: COLORS.text },
  lightShareBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  lightShareIcon: { fontSize: 20, color: COLORS.text },
  lightScrollContent: { paddingBottom: 90 },
  lightHeroWrap: { width: '100%', height: 240, backgroundColor: '#222' },
  lightHeroImage: { width: '100%', height: 240, backgroundColor: '#222', position: 'relative' },
  lightHeroImageStyle: { resizeMode: 'cover' },
  lightTimeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  lightTimeBadgeTime: { fontSize: 18, fontWeight: '700', color: COLORS.text, lineHeight: 20 },
  lightTimeBadgeLabel: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  lightLiveBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ff3b30',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  lightLiveIcon: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  lightLiveText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  liveWindowCounter: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(17,24,39,0.84)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveWindowCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  lightMainContent: { padding: 20 },
  lightRitualTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 8, lineHeight: 34 },
  lightRitualLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  lightLocationIcon: { fontSize: 16 },
  lightLocationText: { fontSize: 15, color: COLORS.muted },
  lightRitualTime: { fontSize: 15, color: COLORS.text, marginBottom: 12 },
  lightRitualTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  lightTag: { backgroundColor: COLORS.tagBg, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 18 },
  lightTagText: { fontSize: 14, fontWeight: '500', color: COLORS.tagText },
  lightSection: { marginBottom: 24 },
  lightSectionTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  lightHostVenueCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16 },
  lightHostItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  lightHostAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#d4d4d4', overflow: 'hidden' },
  lightHostAvatarImg: { width: '100%', height: '100%' },
  lightHostAvatarPlaceholder: { width: '100%', height: '100%', backgroundColor: '#d4d4d4' },
  lightHostInfo: { flex: 1 },
  lightHostBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.hostBadgeBg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 4 },
  lightHostBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.hostBadgeText },
  lightHostRs: { fontSize: 14, color: COLORS.muted },
  lightVenueItem: { flexDirection: 'row', gap: 12 },
  lightVenueIcon: { fontSize: 20, color: COLORS.muted, marginTop: 2 },
  lightVenueInfo: { flex: 1 },
  lightVenueNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  lightVenueName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  lightVenueNameLink: { color: '#f9a13d', textDecorationLine: 'underline' },
  lightVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.openBadgeBg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  lightVerifiedBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.verified },
  lightVenueAddress: { fontSize: 14, color: COLORS.muted, marginBottom: 4 },
  lightVenueNote: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  lightVenueFollowBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', backgroundColor: '#f0f0ed', borderRadius: 8 },
  lightVenueFollowBtnText: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  lightAboutText: { fontSize: 15, lineHeight: 22, color: '#333' },
  lightInlineLink: { color: COLORS.primary, fontWeight: '600' },
  lightMemoryCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12 },
  lightMemoryImage: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#d4d4d4', overflow: 'hidden' },
  lightMemoryImageImg: { width: '100%', height: '100%' },
  lightMemoryContent: { flex: 1 },
  lightMemoryHeader: { fontSize: 13, color: COLORS.muted, marginBottom: 4 },
  lightMemoryText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  lightMemoryBtn: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 20, alignSelf: 'flex-start', marginTop: 8 },
  lightMemoryBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lightParticipationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lightSeatsCount: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  lightOpenBadge: { backgroundColor: COLORS.openBadgeBg, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  lightOpenBadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.openBadgeText },
  lightProgressBar: { width: '100%', height: 8, backgroundColor: COLORS.tagBg, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  lightProgressFill: { height: '100%', backgroundColor: '#333', borderRadius: 4 },
  lightParticipationDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  lightParticipationItem: { flex: 1 },
  lightParticipationItemRight: { alignItems: 'flex-end' },
  lightParticipationLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  lightParticipationValue: { fontSize: 13, color: COLORS.muted },
  lightParticipationLabelGreen: { fontSize: 14, fontWeight: '600', color: '#28a745' },
  lightSocialContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lightAvatarsRow: { flexDirection: 'row' },
  lightAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d4d4d4', borderWidth: 2, borderColor: COLORS.surface, marginLeft: -8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  lightAvatarFirst: { marginLeft: 0 },
  lightAvatarImg: { width: '100%', height: '100%' },
  lightAvatarLetter: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  lightAvatarPlus: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  lightSocialText: { flex: 1 },
  lightSocialFriends: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  lightSocialTotal: { fontSize: 13, color: COLORS.muted },
  lightActionButtons: { marginTop: 24 },
  lightBtnPrimary: { backgroundColor: COLORS.primary, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  lightBtnPrimaryText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  lightBtnDisabled: { opacity: 0.6 },
  lightBtnSecondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center', marginTop: 12 },
  lightBtnSecondaryText: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  heroStatusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroStatusTime: { color: '#fff', fontSize: 15, fontWeight: '600' },
  heroStatusIcons: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  heroTopControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroRightButtons: { flexDirection: 'row', gap: 8 },
  heroCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCircleBtnIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  heroBottomOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
  },
  heroTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  heroRepostedWrap: { marginRight: 4 },
  heroTagPill: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 6, fontSize: 8, fontWeight: '700' },
  heroTagLive: { backgroundColor: '#DC2626', color: '#fff' },
  heroTagSoft: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', color: '#fff' },
  heroTagGold: { backgroundColor: 'rgba(200,169,106,0.90)', color: '#000' },
  heroTagFee: { backgroundColor: 'rgba(22,163,74,0.92)', color: '#fff' },
  heroMainTitle: { fontSize: 26, lineHeight: 31, color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 5 },
  heroMainMeta: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconNavy: { backgroundColor: '#E8EDF4' },
  infoIconGreen: { backgroundColor: '#EAF3DE' },
  infoMain: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 1 },
  infoSub: { fontSize: 10, color: '#A3A3A3' },
  reqBlock: {
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: '#F2F5F9',
    borderWidth: 1,
    borderColor: '#E8EDF4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  reqTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: '#2A4470', marginBottom: 8 },
  reqRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reqChip: { fontSize: 10, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 7 },
  reqChipGreen: { backgroundColor: '#EAF3DE', color: '#16A34A' },
  reqChipNavy: { backgroundColor: '#E8EDF4', color: '#1B2E4A' },
  reqChipGray: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5E5', color: '#525252' },
  graceLockCard: {
    marginBottom: 20,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F0D9A6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  graceUnlockCard: {
    backgroundColor: '#EAF3DE',
    borderColor: '#B7E4A5',
  },
  graceLockTitle: { fontSize: 13, fontWeight: '700', color: '#1B2E4A', marginBottom: 6 },
  graceLockBody: { fontSize: 12, lineHeight: 18, color: '#525252' },
  graceLockBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1B2E4A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  graceLockBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaSaveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  ctaSaveBtnOn: { backgroundColor: '#E8EDF4', borderColor: '#1B2E4A' },
  ctaSaveIcon: { fontSize: 18 },
  ctaMainBtn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaMainNavy: { backgroundColor: '#1B2E4A' },
  ctaMainBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  ctaCancelBtn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaCancelBtnText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  waitlistBtn: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  waitlistBtnText: { color: '#92400E', fontWeight: '700', fontSize: 13 },
  penaltyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  penaltyBannerText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#92400e', fontWeight: '600' },
  joinGraceBanner: {
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  joinGraceTitle: { fontSize: 12, fontWeight: '800', color: '#166534', marginBottom: 4 },
  joinGraceBody: { fontSize: 12, lineHeight: 18, color: '#15803d' },
  replacementCard: {
    marginBottom: 20,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#F0D9A6',
    borderRadius: 14,
    padding: 14,
  },
  replacementTitle: { fontSize: 14, fontWeight: '800', color: '#92400e', marginBottom: 6 },
  replacementBody: { fontSize: 12, lineHeight: 18, color: '#525252', marginBottom: 10 },
  replacementActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  replacementBtn: {
    backgroundColor: '#1B2E4A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  replacementBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  replacementShareBtn: {
    borderWidth: 1,
    borderColor: '#1B2E4A',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  replacementShareText: { color: '#1B2E4A', fontWeight: '700', fontSize: 12 },
  ctaHint: { marginTop: 6, textAlign: 'center', fontSize: 10, color: '#A3A3A3' },
  lightNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  lightNavItem: { alignItems: 'center', gap: 4 },
  lightNavItemActive: {},
  lightNavIcon: { fontSize: 24 },
  lightNavLabel: { fontSize: 10, fontWeight: '500', color: '#999' },
  lightNavLabelActive: { fontSize: 10, fontWeight: '500', color: COLORS.text },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingTop: HEADER_TOP,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  heroOuter: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  heroCard: {
    height: 250,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroImage: {
    borderRadius: 32,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBottom: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 10,
    lineHeight: 30,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: width * 0.45,
  },
  heroMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginLeft: 6,
  },

  countdownBar: {
    marginHorizontal: 16,
    borderRadius: 24,
    height: 82,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    marginBottom: 14,
  },
  countdownLeft: {
    flex: 1,
    paddingRight: 12,
  },
  countdownTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  countdownSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  countdownRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  ringSpinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    borderTopColor: '#fff',
  },

  gridRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardNoBottomPad: {
    paddingBottom: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 18,
  },
  inlineLink: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
  },
  hostAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 2,
    marginRight: 12,
  },
  hostAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  hostAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInfo: {
    flex: 1,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  verifiedHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  verifiedHostText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: COLORS.verified,
    lineHeight: 11,
    marginLeft: 6,
  },
  hostSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  hostRsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostRsText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  cardFooterButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cardFooterButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },

  attendeesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
  },
  attendeeCell: {
    width: '33.333%',
    alignItems: 'center',
  },
  attendeeAvatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 1.5,
    marginBottom: 6,
  },
  attendeeAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  attendeeAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeMore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f0ea',
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeMoreText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6b7280',
  },
  attendeeName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
    lineHeight: 18,
  },
  capacityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  capacityText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
  },
  capacityBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 99,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 99,
  },
  costRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  costValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
    marginTop: -2,
  },

  vibeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  vibeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  vibeChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },

  friendsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  friendsHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  friendsHeaderText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  friendsBody: {
    padding: 14,
    paddingTop: 12,
  },
  friendsBodyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
  },
  friendAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 2,
  },
  friendAvatarDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  inviteButton: {
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  inviteButtonOutline: {
    backgroundColor: 'transparent',
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  inviteButtonTextOutline: {
    color: COLORS.primary,
  },

  venueTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  verifiedVenuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedVenueText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: COLORS.verifiedVenue,
    marginLeft: 4,
  },
  venueInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  venueThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 2,
  },
  venueAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    lineHeight: 16,
  },
  mapPreview: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  mapPreviewText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.text,
  },
  mapPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  memoryCardOuter: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  memoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memoryThumb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memoryMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 6,
  },
  memoryQuote: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    paddingBottom: 18,
  },
  bottomBarInner: {
    paddingHorizontal: 16,
  },
  primaryCtaWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  primaryCta: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  primaryCtaText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.2,
  },
  bottomHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 10,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.muted,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: COLORS.muted,
    fontSize: 16,
  },
});
