import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRitualDetail, fetchRitualMemories, createMemory, createMemoryMedia, deleteMemory, emergencyExit, checkMemoryEligibility, reportUser, reportMessage, createModReport, fetchChatMessages, sendChatMessage, editChatMessage, deleteChatMessage, reactToChatMessage, revealRitualKeyword, endRitualLiveActivity, voteMemory, echoMemory, sozMemory, fetchRitualWindow, touchRitualWindowPresence, witnessPendingCheckin } from '../services/api';
import websocketService from '../services/websocket';
import MemoryActionRow from '../components/MemoryActionRow';
import ShareToPulseModal from '../components/ShareToPulseModal';
import ReportModal from '../components/ReportModal';
import LiveRitualParticipants from '../components/LiveRitualParticipants';
import PendingWitnessCard from '../components/PendingWitnessCard';
import { captureInAppMedia, VIDEO_MAX_S_DEFAULT } from '../utils/inAppCamera';
import LiveRitualHostAnnouncements from '../components/LiveRitualHostAnnouncements';
import useAuthStore from '../store/authStore';
import { log, warn } from '../utils/logger';
import { saveActiveRitualSnapshot } from '../components/ActiveRitualBubble';
import { requireVerifiedUser } from '../utils/verificationGuard';
import { isWindowPhase, isLivePhase } from '../utils/ritualLifecycle';
import { getViewerCheckedIn } from '../utils/checkinWindow';
import { formatRsLabel } from '../utils/rsVisibility';
import { liveWindowHoursOf } from '../constants/localConfig';

export default function LiveRitualScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { ritualId } = route.params;
  const isDark = !!route?.params?.forceDark;
  const [ritual, setRitual] = useState(null);
  const [messages, setMessages] = useState([]);
  const [announcements, setAnnouncements] = useState([]); // Separate from chat (Spec 5.X.5)
  const [memories, setMemories] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [witnessConfirmingId, setWitnessConfirmingId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [selectedMemoryType, setSelectedMemoryType] = useState(null); // 'photo', 'video', 'playlist', 'quote', null
  const [selectedImage, setSelectedImage] = useState(null); // Selected image/video URI
  const [selectedMediaMeta, setSelectedMediaMeta] = useState(null); // { upload_type, content_type, duration_seconds }
  const memoryImagesRef = useRef(new Map()); // Map of memoryId -> imageUri (using ref for immediate access)
  const [memoryImagesVersion, setMemoryImagesVersion] = useState(0); // Version counter to trigger re-render
  const [showShareModal, setShowShareModal] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [isEligibleForPulse, setIsEligibleForPulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [endHandled, setEndHandled] = useState(false);
  const [windowDurationHours, setWindowDurationHours] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState(null); // { type: 'user'|'message', id: string }
  const [readerCount, setReaderCount] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollViewRef = useRef(null);

  // Get user ID from auth store
  const { user } = useAuthStore();
  const currentUserId = user?.id;
  const isHost = ritual?.host_id === currentUserId;
  const sameUserId = (a, b) => String(a ?? '') === String(b ?? '');
  const canCreateMemory = isWindowPhase(ritual) || isLivePhase(ritual);
  const canDraftMemory =
    canCreateMemory ||
    // Isınma (erken mühür / prelobby live strip): yalnız RULO draft
    Boolean(ritual?.first_sealed_at || ritual?.checkin_keyword);
  const isLiveNow = isLivePhase(ritual);
  const isWarmupDraftOnly = !canCreateMemory && canDraftMemory;

  const normalizedParticipants = useMemo(() => {
    const list = Array.isArray(participants) ? [...participants] : [];
    const meIdx = list.findIndex((p) => sameUserId(p?.id || p?.user_id, currentUserId));

    if (meIdx >= 0) {
      list[meIdx] = {
        ...list[meIdx],
        id: list[meIdx].id || currentUserId,
        user_id: list[meIdx].user_id || currentUserId,
        name: user?.name || list[meIdx].name || list[meIdx].user_name || 'Sen',
        user_name: user?.name || list[meIdx].user_name || list[meIdx].name || 'Sen',
      };
    } else if (currentUserId) {
      list.unshift({
        id: currentUserId,
        user_id: currentUserId,
        name: user?.name || 'Sen',
        user_name: user?.name || 'Sen',
        friend_level: 'FL0',
        joined_at: new Date().toISOString(),
      });
    }

    return list;
  }, [participants, currentUserId, user?.name]);

  const pendingWitnessList = useMemo(
    () =>
      normalizedParticipants.filter(
        (p) =>
          (p?.pending_witness || p?.checkin_phase === 'pending_witness') &&
          !sameUserId(p?.id || p?.user_id, currentUserId)
      ),
    [normalizedParticipants, currentUserId]
  );

  const viewerSealed = useMemo(() => {
    const me = normalizedParticipants.find((p) => sameUserId(p?.id || p?.user_id, currentUserId));
    if (!me) return getViewerCheckedIn(ritual, currentUserId);
    return Boolean(me.checkin_at) && me.checkin_phase !== 'pending_witness';
  }, [normalizedParticipants, currentUserId, ritual]);

  useEffect(() => {
    if (!ritual) return;
    setWindowDurationHours(liveWindowHoursOf(ritual));
  }, [ritual?.id, ritual?.live_window_hours]);

  useEffect(() => {
    loadRitual();
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [ritualId]);

  // §2D — TRANSPARENT window: salt-okunur canlı okuma + reader_count
  useEffect(() => {
    const winVis = String(ritual?.window_visibility || 'CLOSED').toUpperCase();
    if (!ritualId || winVis !== 'TRANSPARENT') {
      setReaderCount(null);
      return undefined;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        await touchRitualWindowPresence(ritualId);
        const win = await fetchRitualWindow(ritualId);
        if (!cancelled && win?.reader_count != null) setReaderCount(Number(win.reader_count));
      } catch (_e) {
        /* presence optional for participants */
      }
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [ritualId, ritual?.window_visibility]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const handleLiveWindowEnd = () => {
    if (endHandled) return;
    setEndHandled(true);

    Alert.alert(
      'Canli Window sona erdi',
      'Hizli geri bildirim paylasmak ister misin?',
      [
        {
          text: 'Simdi degil',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
        {
          text: 'Geri bildirim ver',
          onPress: () => {
            navigation.replace('RitualFeedback', {
              ritual,
              host: participants.find(p => p.is_host) || null,
              venue: ritual?.venue_name ? { name: ritual.venue_name } : null,
            });
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!ritual?.start_time || !ritual?.duration || endHandled) return;

    const startTime = new Date(ritual.start_time);
    const ritualEndTime = new Date(startTime.getTime() + ritual.duration * 60000);
    const windowHours = Number(windowDurationHours || liveWindowHoursOf(ritual));
    const liveWindowEndTime = new Date(ritualEndTime.getTime() + windowHours * 60 * 60 * 1000);
    const msUntilWindowEnd = liveWindowEndTime.getTime() - Date.now();

    if (msUntilWindowEnd <= 0) {
      handleLiveWindowEnd();
      return;
    }

    const timeoutId = setTimeout(() => {
      handleLiveWindowEnd();
    }, msUntilWindowEnd);

    return () => clearTimeout(timeoutId);
  }, [ritual?.start_time, ritual?.duration, ritual?.live_window_hours, windowDurationHours, endHandled, participants, ritual, navigation]);

  useEffect(() => {
    if (!ritual || loading || !currentUserId) return;
    const checkedIn = getViewerCheckedIn(ritual, currentUserId);
    const needsGate =
      (isLivePhase(ritual) || isWindowPhase(ritual) || ritual.time_state === 'live_now') &&
      !checkedIn;

    if (needsGate) {
      navigation.replace('RitualCheckIn', { ritualId: ritual.id || ritualId, ritual });
    }
  }, [ritual, loading, currentUserId, navigation, ritualId]);

  useEffect(() => {
    if (!ritual?.id) return;
    saveActiveRitualSnapshot(ritual);
  }, [ritual?.id, ritual?.start_time, ritual?.duration]);

  useEffect(() => {
    const id = ritual?.id || ritualId;
    return () => {
      if (id) endRitualLiveActivity(id).catch(() => {});
    };
  }, [ritual?.id, ritualId]);

  const loadRitual = async () => {
    try {
      setLoading(true);
      const data = await fetchRitualDetail(ritualId);
      setRitual(data);
      if (data.participants) {
        setParticipants(data.participants);
      }
      loadMemories();
    } catch (error) {
      console.error('Error loading ritual:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMemories = async () => {
    try {
      const data = await fetchRitualMemories(ritualId, 20, currentUserId);
      setMemories((data || []).filter((memory) => memory?.status !== 'draft'));
    } catch (_) {
      setMemories([]);
    }
  };

  const connectWebSocket = () => {
    websocketService.connect();
    websocketService.subscribeToRitual(ritualId);

    // Listen for chat messages
    const handleChatMessage = (data) => {
      if (data.ritual_id === ritualId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    // Listen for host announcements (separate from chat)
    const handleAnnouncement = (data) => {
      if (data.ritual_id === ritualId) {
        setAnnouncements(prev => [...prev, data.announcement]);
      }
    };

    // Listen for memory updates (if backend emits them)
    const handleMemoryUpdate = (data) => {
      if (data.ritual_id === ritualId) {
        // Reload memories when a new one is created
        loadMemories();
      }
    };

    websocketService.on('chat:message', handleChatMessage);
    websocketService.on('chat:announcement', handleAnnouncement);
    websocketService.on('memory:created', handleMemoryUpdate);

    // Load initial messages
    loadMessages();
    loadMemories();
  };

  const disconnectWebSocket = () => {
    websocketService.unsubscribeFromRitual(ritualId);
  };

  const loadMessages = async () => {
    try {
      const allMessages = await fetchChatMessages(ritualId, 50);
      if (Array.isArray(allMessages)) {
        const regularMessages = allMessages.filter(msg => msg.message_type !== 'host_announcement');
        const hostAnnouncements = allMessages.filter(msg => msg.message_type === 'host_announcement');
        setMessages(regularMessages);
        setAnnouncements(hostAnnouncements);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    if (!requireVerifiedUser(user, 'Canli mesajlasma icin universite e-postani dogrulamalisin.')) return;

    try {
      setSending(true);
      const sent = await sendChatMessage(ritualId, currentUserId, inputText.trim(), 'user');
      // WebSocket can lag/fail in some sessions; ensure sender sees message immediately.
      if (sent?.id) {
        setMessages((prev) => (prev.some((m) => sameUserId(m.id, sent.id)) ? prev : [...prev, sent]));
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            ritual_id: ritualId,
            user_id: currentUserId,
            message: inputText.trim(),
            message_type: 'user',
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const sendAnnouncement = async () => {
    if (!inputText.trim() || sending || !isHost) return;
    if (!requireVerifiedUser(user, 'Host duyurusu icin universite e-postani dogrulamalisin.')) return;

    try {
      setSending(true);
      await sendChatMessage(ritualId, currentUserId, inputText.trim(), 'host_announcement');
      setInputText('');
      // Announcement will be added via WebSocket
    } catch (error) {
      console.error('Error sending announcement:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  };

  // Unified stream: Combine messages and memories chronologically (announcements excluded - shown separately)
  const getUnifiedStream = () => {
    const stream = [];
    
    // Add messages (excluding announcements - they're shown separately)
    messages.forEach(msg => {
      if (msg.message_type !== 'host_announcement') {
        stream.push({
          type: 'message',
          id: msg.id,
          data: msg,
          timestamp: new Date(msg.created_at).getTime(),
        });
      }
    });
    
    // Add memories
    memories.forEach(mem => {
      stream.push({
        type: 'memory',
        id: mem.id,
        data: mem,
        timestamp: new Date(mem.created_at).getTime(),
      });
    });
    
    // Sort by timestamp (oldest first)
    return stream.sort((a, b) => a.timestamp - b.timestamp);
  };

  // Calculate remaining live time
  const getRemainingLiveTime = () => {
    if (!ritual || !ritual.start_time || !ritual.duration) return null;
    const startTime = new Date(ritual.start_time);
    const ritualEndTime = new Date(startTime.getTime() + ritual.duration * 60000);
    const windowHours = Number(windowDurationHours || liveWindowHoursOf(ritual));
    const endTime = new Date(ritualEndTime.getTime() + windowHours * 60 * 60 * 1000);
    const now = new Date();
    const remaining = endTime - now;
    
    if (remaining <= 0) return null;
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}sa ${minutes}dk`;
    }
    return `${minutes}dk`;
  };

  // Memory photos/videos are captured live; gallery selection is intentionally unavailable.
  const VIDEO_MAX_S = VIDEO_MAX_S_DEFAULT;

  // Handle photo capture — in-app camera only, no filters/gallery
  const handlePhotoSelect = async () => {
    try {
      const captured = await captureInAppMedia('photo', { videoMaxS: VIDEO_MAX_S });
      if (!captured?.uri) return;
      setSelectedImage(captured.uri);
      setSelectedMemoryType('photo');
      setSelectedMediaMeta({
        upload_type: 'photo',
        content_type: captured.mimeType || 'image/jpeg',
        duration_seconds: 0,
        file_size_bytes: captured.fileSize || 0,
        capture_source: 'camera',
      });
      if (!inputText.trim()) setInputText('📸 ');
    } catch (error) {
      console.error('Error picking image from camera:', error);
      Alert.alert('Hata', 'Kamera acilamadi');
    }
  };

  const handleVideoSelect = async () => {
    try {
      const captured = await captureInAppMedia('video', { videoMaxS: VIDEO_MAX_S });
      if (!captured?.uri) return;
      setSelectedImage(captured.uri);
      setSelectedMemoryType('video');
      setSelectedMediaMeta({
        upload_type: 'video',
        content_type: captured.mimeType || 'video/mp4',
        duration_seconds: captured.durationSec || VIDEO_MAX_S,
        file_size_bytes: captured.fileSize || 0,
        capture_source: 'camera',
      });
      if (!inputText.trim()) setInputText('🎬 ');
    } catch (error) {
      console.error('Error capturing video:', error);
      Alert.alert('Hata', 'Video kamera acilamadi');
    }
  };

  // Helpers for memory content based on selected type
  // Platform order: Spotify → Apple Music → YouTube (3rd / fallback)
  const extractMusicUrl = (text) => {
    if (!text) return null;
    const spotify = text.match(
      /https?:\/\/(?:open\.)?spotify\.com\/[^\s]+|spotify:[a-zA-Z]+:[a-zA-Z0-9]+/
    );
    if (spotify) return { url: spotify[0], platform: 'spotify' };
    const apple = text.match(/https?:\/\/(?:music\.)?apple\.com\/[^\s]+/);
    if (apple) return { url: apple[0], platform: 'apple' };
    const youtube = text.match(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?[^\s]+|youtu\.be\/[^\s]+)/
    );
    if (youtube) return { url: youtube[0], platform: 'youtube' };
    return null;
  };

  const buildMemoryPayload = (rawText, memoryKind, imageUri = null) => {
    let content = rawText.trim();
    let spotifyUrl = null;

    if (memoryKind === 'playlist') {
      const music = extractMusicUrl(content);
      spotifyUrl = music?.url || null;
    }

    if (memoryKind === 'quote') {
      // Ensure content is wrapped in quotes so it renders as a quote bubble
      if (!(content.startsWith('"') && content.endsWith('"'))) {
        content = `"${content}"`;
      }
    }

    if (memoryKind === 'photo') {
      if (!content.startsWith('📸')) {
        content = `📸 ${content}`;
      }
    }
    if (memoryKind === 'video') {
      if (!content.startsWith('🎬')) {
        content = `🎬 ${content}`;
      }
    }
    if (memoryKind === 'voice') {
      if (!content.toLowerCase().startsWith('[voice]') && !content.toLowerCase().startsWith('voice:')) {
        content = `[VOICE] ${content}`;
      }
    }

    return { content, spotifyUrl, imageUri };
  };

  const buildMemoryCreateOpts = (memoryKind, shareType, content, spotifyUrl) => {
    const typeMap = {
      quote: 'quote',
      photo: 'photo',
      video: 'media',
      playlist: 'music',
      voice: 'media',
    };
    const audience =
      shareType === 'CITY' || shareType === 'all'
        ? 'CITY'
        : shareType === 'CIRCLE' || shareType === 'pulse'
          ? 'CIRCLE'
          : 'WINDOW';
    const memoryScope =
      audience === 'CITY' ? 'all' : audience === 'CIRCLE' ? 'pulse' : 'solo';
    return {
      memoryType: audience === 'CIRCLE' || audience === 'CITY' ? 'pulse' : 'ritual',
      spotifyUrl,
      memoryScope,
      audience,
      type: typeMap[memoryKind] || 'quote',
      status: 'published',
      destination: shareType === 'ritual' || shareType === 'draft' || audience === 'WINDOW' ? 'ritual_only' : 'ritual_and_pulse',
      shareType: audience === 'CITY' ? 'all' : audience === 'CIRCLE' ? 'pulse' : 'solo',
    };
  };

  const persistMemory = async (shareType) => {
    const { content, spotifyUrl, imageUri } = buildMemoryPayload(
      inputText,
      selectedMemoryType,
      selectedImage
    );
    const opts = {
      ...buildMemoryCreateOpts(selectedMemoryType, shareType, content, spotifyUrl),
      status: shareType === 'draft' ? 'draft' : 'published',
      caption: content,
    };

    if (selectedMemoryType === 'photo' || selectedMemoryType === 'video') {
      if (!imageUri || !selectedMediaMeta) {
        throw new Error('Kamera cekimi gerekli');
      }
      return createMemoryMedia(ritualId, currentUserId, {
        uri: imageUri,
        ...selectedMediaMeta,
        caption: content,
      }, opts);
    }

    if (shareType === 'draft') {
      throw new Error('Yalniz foto/video Rulo\'ya taslak kaydedilir');
    }

    return createMemory(ritualId, currentUserId, content, opts);
  };

  const handleSaveDraft = () => handleMemoryTypeSelect('draft');

  const handleSendMemory = async () => {
    if (!inputText.trim() || savingMemory) return;
    if (!requireVerifiedUser(user, 'Anilari paylasmak icin universite e-postani dogrulamalisin.')) return;

    // If memory type is selected, create memory
    if (selectedMemoryType) {
      if (!canCreateMemory && !(isWarmupDraftOnly && selectedMemoryType === 'draft')) {
        Alert.alert(
          isWarmupDraftOnly ? 'Isınma evresi' : 'Window bekleniyor',
          isWarmupDraftOnly
            ? 'Isınmada yalnız kamera taslagi (RULO) acik. Paylasim start sonrasi acilir.'
            : 'Anilar Ritual basladiktan sonra veya Windowde paylasilabilir.'
        );
        return;
      }
      try {
        setSavingMemory(true);
        
        // Check eligibility for Pulse (for possible Pulse share)
        const eligibility = await checkMemoryEligibility(ritualId, currentUserId);
        setIsEligibleForPulse(eligibility.eligible);
        
        if (eligibility.eligible) {
          setShowShareModal(true);
          return;
        }
        // If not eligible, save as ritual-only memory
        const newMemory = await persistMemory('ritual');
        
        // Store image URI locally for this memory BEFORE reloading
        if (selectedImage && newMemory?.id) {
          log('Storing image for memory:', { memoryId: newMemory.id, imageUri: selectedImage });
          memoryImagesRef.current.set(String(newMemory.id), selectedImage);
          setMemoryImagesVersion(prev => prev + 1); // Trigger re-render
        }
        if (newMemory?.id) {
          const optimisticMemory = selectedImage
            ? { ...newMemory, __local_image_uri: selectedImage }
            : newMemory;
          setMemories((prev) => (prev.some((m) => sameUserId(m.id, newMemory.id)) ? prev : [...prev, optimisticMemory]));
        }
        
        await loadMemories();
        setInputText('');
        setSelectedMemoryType(null);
        setSelectedImage(null);
        setSelectedMediaMeta(null);
        Alert.alert('Basarili', 'Ani Rituale kaydedildi!');
      } catch (error) {
        console.error('Error saving memory:', error);
        Alert.alert('Hata', error.message || 'Ani kaydedilemedi');
      } finally {
        setSavingMemory(false);
      }
    } else {
      // Regular message
      await sendMessage();
    }
  };

  const handleMemoryTypeSelect = async (shareType) => {
    // shareType: ritual | pulse | all | draft (ShareToPulseModal / Rulo)
    if (!inputText.trim() || savingMemory) return;
    if (!requireVerifiedUser(user, 'Anilari paylasmak icin universite e-postani dogrulamalisin.')) return;
    if (!canCreateMemory && !(isWarmupDraftOnly && shareType === 'draft')) {
      Alert.alert(
        isWarmupDraftOnly ? 'Isınma evresi' : 'Paylaşım kapalı',
        isWarmupDraftOnly
          ? 'Isınmada yalnız RULO taslagi. Quote/playlist/paylaşım start sonrası.'
          : 'Anilar Ritual basladiktan sonra veya Windowde paylasilabilir.'
      );
      return;
    }

    try {
      setSavingMemory(true);
      setShowShareModal(false);
      
      const newMemory = await persistMemory(shareType);
      
      if (selectedImage && newMemory?.id) {
        memoryImagesRef.current.set(String(newMemory.id), selectedImage);
        setMemoryImagesVersion(prev => prev + 1);
      }
      if (newMemory?.id && shareType !== 'draft') {
        const optimisticMemory = selectedImage
          ? { ...newMemory, __local_image_uri: selectedImage }
          : newMemory;
        setMemories((prev) => (prev.some((m) => sameUserId(m.id, newMemory.id)) ? prev : [...prev, optimisticMemory]));
      }
      
      await loadMemories();
      
      setInputText('');
      setSelectedMemoryType(null);
      setSelectedImage(null);
      setSelectedMediaMeta(null);
      
      Alert.alert('Basarili', shareType === 'draft'
        ? 'Ani Rulo\'ya taslak olarak kaydedildi.'
        : shareType === 'CITY' || shareType === 'all'
        ? 'Ani MASA + CEVRE + SEHIR kapsaminda paylasildi!'
        : shareType === 'CIRCLE' || shareType === 'pulse'
        ? 'Ani CEVRE (Your Pulse) ile paylasildi!'
        : 'Ani MASA (Window) kaydedildi!');
    } catch (error) {
      console.error('Error saving memory:', error);
      Alert.alert('Hata', error.message || 'Ani kaydedilemedi');
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    try {
      await deleteMemory(memoryId, currentUserId);
      setMemories(memories.filter(m => m.id !== memoryId));
    } catch (error) {
      console.error('Error deleting memory:', error);
    }
  };

  const handleReport = async (reportData) => {
    if (!requireVerifiedUser(user, 'Rapor gondermek icin universite e-postani dogrulamalisin.')) return;
    try {
      const leaveAfter = Boolean(reportTarget?.leaveAfter || reportData.leave_after);
      const categoryKey = reportData.category_key || reportData.reason;
      const targetType = reportTarget?.type || reportData.target_type || 'ritual';
      await createModReport({
        targetType:
          targetType === 'message'
            ? 'prelobby_message'
            : targetType === 'memory'
              ? 'memory'
              : targetType,
        targetId: reportTarget?.id || ritualId,
        ritualId,
        categoryKey,
        description: reportData.description,
        leaveAfter,
      });
      Alert.alert('Basarili', leaveAfter ? 'Rapor iletildi · cezasiz ayrildin' : 'Rapor basariyla gonderildi');
      setShowReportModal(false);
      setReportTarget(null);
      if (leaveAfter) {
        navigation.goBack();
        return;
      }
      navigation.navigate('ReportSubmitted');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Hata', error?.message || 'Rapor gonderilemedi');
    }
  };

  // Render unified stream item
  const renderStreamItem = ({ item }) => {
    if (item.type === 'message') {
      return renderMessageItem(item.data);
    } else if (item.type === 'memory') {
      return renderMemoryItem(item.data);
    }
    return null;
  };

  const renderMessageItem = (message) => {
    const isAnnouncement = message.message_type === 'host_announcement';
    const isSystem = message.message_type === 'system';
    const isOwnMessage = message.user_id === currentUserId;
    const user = normalizedParticipants.find(p => sameUserId(p.id || p.user_id, message.user_id)) || {};
    const userRS = isOwnMessage ? (useAuthStore.getState()?.user?.rs_score ?? null) : (user.rs_score ?? null);
    const rsBadgeLabel = formatRsLabel(userRS);

    const msgType = message.type || 'text';
    const photoUri =
      message.media_url ||
      (typeof message.message === 'string' && message.message.includes('/ImagePicker/')
        ? message.message.split(':').slice(1).join(':').trim()
        : null);
    const playlistUrl = message.external_url || (typeof message.message === 'string' && message.message.includes('open.spotify.com') ? message.message : null);
    const displayName = isOwnMessage ? 'Sen' : (user.name || message.user_name || 'Katilimci');
    const timeText = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const renderMessageBubble = () => {
      if (msgType === 'photo' && photoUri) {
        return (
          <View style={[styles.bubblePhoto, !isDark && styles.bubblePhotoLight]}>
            <Image source={{ uri: photoUri }} style={styles.bubblePhotoImage} />
            <Text style={[styles.bubblePhotoCaption, !isDark && styles.bubblePhotoCaptionLight]}>{message.message?.replace(photoUri, '').trim() || 'Fotograf'}</Text>
          </View>
        );
      }
      if (msgType === 'playlist') {
        return (
          <View style={[styles.bubblePlaylist, !isDark && styles.bubblePlaylistLight]}>
            <View style={styles.bubblePlaylistHeader}>
              <Text style={styles.bubblePlaylistIcon}>♫</Text>
              <Text style={styles.bubblePlaylistTitle}>Jazz Night Sesleri</Text>
            </View>
            <Text style={[styles.bubblePlaylistTrack, !isDark && styles.bubblePlaylistTrackLight]}>{playlistUrl || 'Spotify playlist paylasildi'}</Text>
          </View>
        );
      }
      if (msgType === 'voice') {
        return (
          <View style={[styles.bubbleVoice, !isDark && styles.bubbleVoiceLight]}>
            <View style={styles.voiceTop}>
              <Text style={[styles.voicePlay, !isDark && styles.voicePlayLight]}>▶</Text>
              <Text style={[styles.voiceLabel, !isDark && styles.voiceLabelLight]}>Sesli Not</Text>
            </View>
            <View style={styles.voiceWaveRow}>
              {Array.from({ length: 24 }).map((_, i) => (
                <View key={`wv-${message.id}-${i}`} style={[styles.voiceWave, !isDark && styles.voiceWaveLight, i < 7 && styles.voiceWavePlayed]} />
              ))}
            </View>
          </View>
        );
      }
      return (
        <View style={[styles.messageBubble, !isDark && styles.messageBubbleLight, isOwnMessage && styles.youBubble, isAnnouncement && styles.announcementBubble]}>
          <Text style={[styles.messageBubbleText, !isDark && styles.messageBubbleTextLight, isAnnouncement && styles.announcementBubbleText]}>
            {message.message}
          </Text>
          {message.edited_at ? (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>duzenlendi</Text>
          ) : null}
          {message.deleted_at || message.message === '[silindi]' ? (
            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>silindi</Text>
          ) : null}
        </View>
      );
    };

    return (
      <View style={[styles.streamItem, isOwnMessage && styles.streamItemYou]}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.streamAvatar}
          onPress={() => {
            if (!isOwnMessage && !isAnnouncement) {
              navigation.navigate('ParticipantProfile', {
                userId: message.user_id,
                ritualId: ritualId,
                viewerId: currentUserId,
              });
            }
          }}
        >
          <View style={[styles.avatarCircle, !isDark && styles.avatarCircleLight]}>
            <Text style={[styles.avatarText, !isDark && styles.avatarTextLight]}>
              {isAnnouncement ? 'H' : (user.name || message.user_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          {!isAnnouncement && rsBadgeLabel ? (
            <View style={styles.rsBadgeSmall}>
              <Text style={styles.rsBadgeText}>{rsBadgeLabel}</Text>
            </View>
          ) : null}
          {!isAnnouncement && user.friend_level ? (
            <Text style={[styles.flMini, !isDark && styles.flMiniLight]}>{user.friend_level}</Text>
          ) : null}
          {isAnnouncement && (
            <View style={styles.hostBadgeSmall}>
              <Text style={styles.hostBadgeText}>HOST</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Message Bubble */}
        <View style={[styles.messageBubbleContainer, isOwnMessage && styles.messageBubbleContainerYou]}>
          <View style={[styles.msgHeaderRow, isOwnMessage && styles.msgHeaderRowYou]}>
            <Text style={[styles.msgName, isOwnMessage && styles.msgNameYou, isAnnouncement && styles.msgNameHost]}>{displayName}</Text>
            {!isOwnMessage && !isAnnouncement && (
              <Text style={[styles.msgRoleBadge, styles.msgRoleDefault]}>{userFL}</Text>
            )}
            {isAnnouncement && (
              <Text style={[styles.msgRoleBadge, styles.msgRoleHost]}>★ HOST</Text>
            )}
            <Text style={styles.msgTime}>{timeText}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={isAnnouncement || isSystem}
            onLongPress={() => {
              if (isAnnouncement || isSystem) return;
              const CHAT_REACTIONS = ['🤝', '😂', '🙌', '👀', '💡', '❓'];
              const openReactPicker = () => {
                Alert.alert(
                  'Tepki',
                  'Bir emoji sec',
                  [
                    { text: 'Iptal', style: 'cancel' },
                    ...CHAT_REACTIONS.map((emoji) => ({
                      text: emoji,
                      onPress: async () => {
                        try {
                          await reactToChatMessage(message.id, emoji);
                          setMessages((prev) =>
                            prev.map((m) =>
                              String(m.id) === String(message.id)
                                ? {
                                    ...m,
                                    reactions: {
                                      ...(m.reactions || {}),
                                      [emoji]: (Number((m.reactions || {})[emoji]) || 0) + 1,
                                    },
                                  }
                                : m
                            )
                          );
                        } catch (e) {
                          Alert.alert('Hata', e?.message || 'Reaksiyon eklenemedi');
                        }
                      },
                    })),
                  ]
                );
              };

              if (isOwnMessage) {
                const createdAt = message.created_at ? new Date(message.created_at).getTime() : 0;
                const withinEdit = createdAt && Date.now() - createdAt <= 5 * 60 * 1000;
                const actions = [
                  { text: 'Vazgec', style: 'cancel' },
                  { text: 'Tepki', onPress: openReactPicker },
                ];
                if (withinEdit && !message.deleted_at && message.message !== '[silindi]') {
                  actions.push({
                    text: 'Duzenle',
                    onPress: () => {
                      const editFn = (nextText) => {
                        if (!nextText || !String(nextText).trim()) return;
                        editChatMessage(message.id, String(nextText).trim())
                          .then((updated) => {
                            setMessages((prev) =>
                              prev.map((m) =>
                                String(m.id) === String(message.id)
                                  ? {
                                      ...m,
                                      message: updated?.message || updated?.content || nextText,
                                      content: updated?.content || nextText,
                                      edited_at: updated?.edited_at || new Date().toISOString(),
                                    }
                                  : m
                              )
                            );
                          })
                          .catch((e) => Alert.alert('Hata', e?.message || 'Duzenlenemedi'));
                      };
                      if (Alert.prompt) {
                        Alert.prompt(
                          'Mesaji duzenle',
                          '',
                          [
                            { text: 'Iptal', style: 'cancel' },
                            { text: 'Kaydet', onPress: editFn },
                          ],
                          'plain-text',
                          message.message || message.content || ''
                        );
                      } else {
                        Alert.alert('Duzenle', 'Duzenleme su an yalniz iOS Prompt ile destekleniyor.');
                      }
                    },
                  });
                  actions.push({
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await deleteChatMessage(message.id);
                        setMessages((prev) =>
                          prev.map((m) =>
                            String(m.id) === String(message.id)
                              ? {
                                  ...m,
                                  message: '[silindi]',
                                  content: '[silindi]',
                                  deleted_at: new Date().toISOString(),
                                }
                              : m
                          )
                        );
                      } catch (e) {
                        Alert.alert('Hata', e?.message || 'Silinemedi');
                      }
                    },
                  });
                }
                Alert.alert('Mesaj', 'Ne yapmak istersin?', actions);
                return;
              }

              if (!requireVerifiedUser(user, 'Islem icin dogrulama gerekli.')) return;
              Alert.alert('Mesaj', 'Ne yapmak istersin?', [
                { text: 'Vazgec', style: 'cancel' },
                { text: 'Tepki', onPress: openReactPicker },
                {
                  text: 'Bildir',
                  style: 'destructive',
                  onPress: () => {
                    setReportTarget({
                      type: 'prelobby_message',
                      id: message.id,
                      leaveAfter: false,
                    });
                    setShowReportModal(true);
                  },
                },
              ]);
            }}
            delayLongPress={350}
          >
            {renderMessageBubble()}
          </TouchableOpacity>
          {message.reactions && typeof message.reactions === 'object' ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 4,
                marginTop: 4,
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
              }}
            >
              {Object.entries(message.reactions).map(([emoji, users]) => {
                const count = Array.isArray(users) ? users.length : Number(users) || 0;
                if (!count) return null;
                return (
                  <Text key={emoji} style={{ fontSize: 12, color: '#6b7280' }}>
                    {emoji} {count}
                  </Text>
                );
              })}
            </View>
          ) : null}
          {!isOwnMessage && !isAnnouncement && !isSystem ? (
            <TouchableOpacity
              style={{ marginTop: 4, alignSelf: isOwnMessage ? 'flex-end' : 'flex-start' }}
              onPress={() => {
                if (!requireVerifiedUser(user, 'Bildirmek icin dogrulama gerekli.')) return;
                setReportTarget({
                  type: 'prelobby_message',
                  id: message.id,
                  leaveAfter: false,
                });
                setShowReportModal(true);
              }}
            >
              <Text style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>Mesajı bildir</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const musicAttributionFor = (url = '') => {
    const u = String(url).toLowerCase();
    if (u.includes('apple.com') || u.includes('music.apple')) {
      return "Apple Music · link-out · ses LOCAL'den akmaz";
    }
    if (u.includes('youtube.com') || u.includes('youtu.be')) {
      return "YouTube · link-out (3. sıra) · ses LOCAL'den akmaz";
    }
    return "Spotify · link-out · ses LOCAL'den akmaz";
  };

  const renderMemoryItem = (memory) => {
    const user = normalizedParticipants.find(p => sameUserId(p.id || p.user_id, memory.user_id)) || {};
    const isOwn = memory.user_id === currentUserId;
    const userRS = isOwn ? (user?.rs_score ?? useAuthStore.getState()?.user?.rs_score ?? null) : (user.rs_score ?? null);
    const rsBadgeLabel = formatRsLabel(userRS);

    const musicUrl = memory.spotify_playlist_url || memory.external_url || memory.music_url;
    const coverUri = memory.music_cover_url || memory.cover_url || null;
    const isQuote =
      memory.type === 'quote' ||
      memory.memory_type === 'quote' ||
      (memory.content && memory.content.startsWith('"') && memory.content.endsWith('"'));
    const isPhoto =
      memory.type === 'photo' ||
      memory.memory_type === 'photo' ||
      (memory.content && memory.content.startsWith('📸'));
    const isVideo =
      memory.type === 'media' ||
      memory.type === 'video' ||
      (memory.content && memory.content.startsWith('🎬'));

    const memoryImageUri =
      memory.__local_image_uri ||
      memory.image_url ||
      memory.photo_url ||
      memory.content_url ||
      memory.media_url ||
      memoryImagesRef.current.get(String(memory.id)) ||
      null;

    const stampText =
      memory.stamp_label ||
      [
        memory.ritual_title,
        memory.venue_name || memory.ritual_venue,
        memory.captured_at
          ? new Date(memory.captured_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

    const displayName = isOwn ? 'Sen' : (user.name || memory.user_name || 'Katilimci');
    const timeText = new Date(memory.created_at || memory.captured_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.streamItem}>
        <TouchableOpacity
          style={styles.streamAvatar}
          onPress={() => {
            if (!isOwn) {
              navigation.navigate('ParticipantProfile', {
                userId: memory.user_id,
                ritualId: ritualId,
                viewerId: currentUserId,
              });
            }
          }}
        >
          <View style={[styles.avatarCircle, !isDark && styles.avatarCircleLight]}>
            <Text style={[styles.avatarText, !isDark && styles.avatarTextLight]}>
              {(user.name || memory.user_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          {rsBadgeLabel ? (
            <View style={styles.rsBadgeSmall}>
              <Text style={styles.rsBadgeText}>{rsBadgeLabel}</Text>
            </View>
          ) : null}
          {user.friend_level ? (
            <Text style={[styles.flMini, !isDark && styles.flMiniLight]}>{user.friend_level}</Text>
          ) : null}
        </TouchableOpacity>

        <View style={styles.memoryCardContainer}>
          <View style={styles.msgHeaderRow}>
            <Text style={[styles.msgName, isOwn && styles.msgNameYou]}>{displayName}</Text>
            <Text style={[styles.msgRoleBadge, styles.msgRoleDefault]}>{userFL}</Text>
            <Text style={styles.msgTime}>{timeText}</Text>
          </View>
          {musicUrl ? (
            <TouchableOpacity
              style={[styles.spotifyCard, !isDark && styles.spotifyCardLight]}
              activeOpacity={0.75}
              onPress={async () => {
                try {
                  const ok = await Linking.canOpenURL(musicUrl);
                  if (ok) await Linking.openURL(musicUrl);
                } catch (e) {
                  warn('music link-out failed', e?.message || e);
                }
              }}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.musicCoverThumb} />
              ) : (
                <Text style={styles.spotifyIcon}>♫</Text>
              )}
              <View style={styles.spotifyCardContent}>
                <Text style={[styles.spotifyCardTitle, !isDark && styles.spotifyCardTitleLight]}>
                  {memory.music_title || memory.track_name || 'Çalma listesi / parça'}
                </Text>
                <Text style={[styles.spotifyCardSubtitle, !isDark && styles.spotifyCardSubtitleLight]}>
                  {memory.music_attribution || musicAttributionFor(musicUrl)}
                </Text>
              </View>
              <MaterialIcons name="open-in-new" size={20} color={isDark ? '#fff' : '#111827'} />
            </TouchableOpacity>
          ) : null}
          {isQuote ? (
            <View style={[styles.quoteBubble, !isDark && styles.quoteBubbleLight]}>
              <Text style={[styles.quoteText, !isDark && styles.quoteTextLight]}>{memory.content}</Text>
            </View>
          ) : isPhoto || isVideo ? (
            <View style={[styles.photoMemoryCard, !isDark && styles.photoMemoryCardLight]}>
              {memoryImageUri ? (
                <>
                  <Image source={{ uri: memoryImageUri }} style={styles.memoryImage} />
                  {String(memory.content || '')
                    .replace(/^📸\s*/, '')
                    .replace(/^🎬\s*/, '')
                    .trim() ? (
                    <View style={styles.photoCaption}>
                      <Text style={styles.photoCaptionText}>
                        {String(memory.content || '')
                          .replace(/^📸\s*/, '')
                          .replace(/^🎬\s*/, '')}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <View style={[styles.photoPlaceholder, !isDark && styles.photoPlaceholderLight]}>
                    <MaterialIcons name={isVideo ? 'videocam' : 'photo'} size={48} color="#d4af37" />
                  </View>
                  {String(memory.content || '')
                    .replace(/^📸\s*/, '')
                    .replace(/^🎬\s*/, '')
                    .trim() ? (
                    <Text style={[styles.memoryText, !isDark && styles.memoryTextLight]}>
                      {String(memory.content || '')
                        .replace(/^📸\s*/, '')
                        .replace(/^🎬\s*/, '')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : !musicUrl ? (
            <Text style={[styles.memoryText, !isDark && styles.memoryTextLight]}>{memory.content}</Text>
          ) : null}
          {stampText ? (
            <View style={styles.stampRow}>
              <Text style={[styles.stampLabel, !isDark && styles.stampLabelLight]} numberOfLines={2}>
                {stampText}
              </Text>
              {memory.is_retro && memory.published_at ? (
                <Text style={[styles.stampPublish, !isDark && styles.stampPublishLight]}>
                  Yayın{' '}
                  {new Date(memory.published_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <MemoryActionRow
            style={{ marginTop: 10 }}
            upvotes={memory.upvote_count || memory.upvotes || 0}
            downvotes={memory.downvote_count || memory.downvotes || 0}
            quotes={memory.quote_count || memory.soz_count || memory.comment_count || 0}
            echoes={memory.echo_count || memory.yanki_count || 0}
            onUpvote={async () => {
              try {
                const data = await voteMemory(memory.id, 1);
                setMemories((prev) =>
                  prev.map((m) =>
                    m.id === memory.id
                      ? {
                          ...m,
                          upvote_count: data?.upvote_count ?? (m.upvote_count || 0) + 1,
                          downvote_count:
                            data?.downvote_count ?? m.downvote_count ?? m.downvotes ?? 0,
                        }
                      : m
                  )
                );
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Oy verilemedi');
              }
            }}
            onDownvote={async () => {
              try {
                const data = await voteMemory(memory.id, -1);
                setMemories((prev) =>
                  prev.map((m) =>
                    m.id === memory.id
                      ? {
                          ...m,
                          upvote_count: data?.upvote_count ?? m.upvote_count ?? m.upvotes ?? 0,
                          downvote_count:
                            data?.downvote_count ?? (m.downvote_count || m.downvotes || 0) + 1,
                        }
                      : m
                  )
                );
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Oy verilemedi');
              }
            }}
            onSoz={() => {
              Alert.prompt
                ? Alert.prompt('Söz', 'Kisa bir soz birak', async (text) => {
                    if (!String(text || '').trim()) return;
                    try {
                      await sozMemory(memory.id, text);
                      setMemories((prev) =>
                        prev.map((m) =>
                          m.id === memory.id
                            ? {
                                ...m,
                                comment_count: (m.comment_count || m.soz_count || 0) + 1,
                                soz_count: (m.soz_count || m.comment_count || 0) + 1,
                              }
                            : m
                        )
                      );
                    } catch (e) {
                      Alert.alert('Hata', e?.message || 'Soz eklenemedi');
                    }
                  })
                : Alert.alert('Söz', 'Soz yazmak icin klavye destekli cihaz gerekli.');
            }}
            onEcho={async () => {
              try {
                const data = await echoMemory(memory.id);
                setMemories((prev) =>
                  prev.map((m) =>
                    m.id === memory.id
                      ? { ...m, echo_count: data?.echo_count ?? (m.echo_count || 0) + 1 }
                      : m
                  )
                );
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Yanki yapilamadi');
              }
            }}
          />
          {!isOwn ? (
            <TouchableOpacity
              style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onPress={() => {
                if (!requireVerifiedUser(user, 'Bildirmek icin dogrulama gerekli.')) return;
                setReportTarget({
                  type: memory.type === 'quote' || memory.memory_type === 'quote' ? 'quote' : 'memory',
                  id: memory.id,
                  leaveAfter: false,
                });
                setShowReportModal(true);
              }}
            >
              <Text style={{ fontSize: 12, color: '#b45309', fontWeight: '600' }}>Bildir</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const handleWitnessConfirm = async (subjectUserId) => {
    if (!viewerSealed) {
      Alert.alert('Tanık', 'Yalnız mühürlü katılımcılar onaylayabilir.');
      return;
    }
    try {
      setWitnessConfirmingId(subjectUserId);
      const data = await witnessPendingCheckin(ritualId, subjectUserId);
      if (data?.sealed) {
        Alert.alert('Onaylandı', 'Mühür basıldı.');
      } else {
        Alert.alert(
          'Tanık kaydı',
          `Tanık ${data?.witness_count || 0}/${data?.witness_required || 1}`
        );
      }
      await loadRitual();
    } catch (e) {
      Alert.alert('Tanık', e?.message || 'Onay başarısız');
    } finally {
      setWitnessConfirmingId(null);
    }
  };

  const handleParticipantPress = (participant) => {
    const pid = participant.id || participant.user_id;
    // sonMD: host manuel mühür kaldırıldı — PENDING_WITNESS
    navigation.navigate('LiveStrangerProfile', {
      userId: pid,
      ritualId: ritualId,
      viewerId: currentUserId,
      name: participant.name || participant.user_name,
      rs_score: participant.rs_score,
      ritualTitle: ritual?.title,
    });
  };

  const handleSendAnnouncement = async (text) => {
    try {
      setSending(true);
      await sendChatMessage(ritualId, currentUserId, text, 'host_announcement');
    } catch (error) {
      Alert.alert('Hata', 'Duyuru gonderilemedi');
    } finally {
      setSending(false);
    }
  };

  const handleRevealHostKeyword = () => {
    const code = ritual?.code_display || ritual?.checkin_keyword || ritual?.checkin_code;
    if (code) {
      Alert.alert(
        'Masa kodu (yalnız fiziksel)',
        `${String(code)}\n\nDijital yollama yasak — söyle, ekranı göster veya LOCAL-TAG.`
      );
      return;
    }
    Alert.alert(
      'Kod henüz yok',
      'Kod firstSeal ile doğar — ilk temiz-GPS’li gelen masayı açar. Host özel kod üretemez.'
    );
  };

  const handleExtendWindow = () => {
    Alert.alert(
      'Window Uzat',
      'Canli Window suresine +3 saat eklensin mi?',
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Uzat',
          onPress: async () => {
            const next = Math.min(24, Number(windowDurationHours || 0) + 3);
            setWindowDurationHours(next);
            const msg = `Host canli Window ${next}s olacak sekilde uzatti.`;
            try {
              await sendChatMessage(ritualId, currentUserId, msg, 'host_announcement');
            } catch (_) {}
            Alert.alert('Window Uzatildi', `Yeni Window suresi: ${next} saat`);
          },
        },
      ]
    );
  };

  const handleEndRitualNow = () => {
    Alert.alert(
      'Rituali Bitir',
      'Rituali simdi bitirmek istedigine emin misin?',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Bitir',
          style: 'destructive',
          onPress: async () => {
            try {
              await sendChatMessage(ritualId, currentUserId, 'Host Rituali sonlandirdi.', 'host_announcement');
            } catch (_) {}
            navigation.navigate('RitualComplete', { ritualId });
          },
        },
      ]
    );
  };

  const handleOpenParticipants = () => {
    if (!participants || participants.length === 0) {
      Alert.alert('Katilimcilar', 'Henuz katilimci yok.');
      return;
    }
    navigation.navigate('RitualAttendees', {
      ritualId,
      participants,
      viewerId: currentUserId,
      isHost,
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!ritual) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ritual bulunamadi</Text>
      </View>
    );
  }

  const startTime = new Date(ritual.start_time);
  const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
  const timeRange = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const remainingTime = getRemainingLiveTime();
  const unifiedStream = getUnifiedStream();
  const ui = isDark
    ? {
        screen: '#080808',
        panel: '#0a0a0a',
        sectionBorder: '#111',
        inputBorder: '#141414',
        chipBg: 'rgba(255,255,255,.05)',
        chipBorder: 'rgba(255,255,255,.06)',
        chipText: 'rgba(255,255,255,.35)',
        inputBg: 'rgba(255,255,255,.06)',
        inputText: 'rgba(255,255,255,.7)',
        placeholder: 'rgba(255,255,255,.2)',
        icon: 'rgba(255,255,255,.45)',
      }
    : {
        screen: '#ffffff',
        stream: '#FAFAFA',
        panel: '#ffffff',
        sectionBorder: '#E5E5E5',
        inputBorder: '#E5E5E5',
        chipBg: '#F5F5F5',
        chipBorder: '#E5E5E5',
        chipText: '#737373',
        inputBg: '#F5F5F5',
        inputText: '#737373',
        placeholder: '#A3A3A3',
        icon: '#737373',
      };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: ui.screen }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header with Navigation */}
      <View style={[styles.topHeader, { backgroundColor: ui.screen, borderBottomColor: ui.sectionBorder, paddingTop: Math.max(insets.top, 10) }]}>
        <TouchableOpacity
          onPress={() => {
            // Soft prompt for feedback when leaving ritual
            Alert.alert(
              'Ritualden ayril?',
              'Ayrilmadan once hizli geri bildirim paylasmak ister misin?',
              [
                {
                  text: 'Simdi degil',
                  style: 'cancel',
                  onPress: () => navigation.goBack(),
                },
                {
                  text: 'Geri bildirim ver',
                  onPress: () => {
                    navigation.navigate('RitualFeedback', {
                      ritual,
                      host: participants.find(p => p.is_host) || null,
                      venue: ritual.venue_name ? { name: ritual.venue_name } : null,
                    });
                  },
                },
              ]
            );
          }}
          style={[styles.backButton, !isDark && styles.backButtonLight]}
        >
          <MaterialIcons name="arrow-back" size={16} color={isDark ? '#f9fafb' : '#1f2937'} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={[styles.topHeaderTitle, !isDark && styles.topHeaderTitleLight]}>{ritual.title}</Text>
        <TouchableOpacity
          style={[styles.moreButton, !isDark && styles.moreButtonLight]}
          onPress={() => {
            // Direct entry into feedback flow
            navigation.navigate('RitualFeedback', {
              ritual,
              host: participants.find(p => p.is_host) || null,
              venue: ritual.venue_name ? { name: ritual.venue_name } : null,
            });
          }}
        >
          <MaterialIcons name="more-horiz" size={18} color={isDark ? '#f9fafb' : '#1f2937'} />
        </TouchableOpacity>
      </View>

      {/* Event Details */}
      <View style={[styles.eventDetails, { backgroundColor: ui.screen }]}>
        <View style={styles.eventDetailRow}>
          <MaterialIcons name="access-time" size={16} color={isDark ? '#d1d5db' : '#666'} />
          <Text style={[styles.eventDetailText, !isDark && styles.eventDetailTextLight, isDark && { color: '#e5e7eb' }]}>{timeRange}</Text>
        </View>
        <View style={styles.eventDetailRow}>
          <MaterialIcons name="location-on" size={16} color={isDark ? '#d1d5db' : '#666'} />
          <Text style={[styles.eventDetailText, !isDark && styles.eventDetailTextLight, isDark && { color: '#e5e7eb' }]}>{ritual.venue_name}</Text>
        </View>
        {remainingTime && (
          <Text style={[styles.liveTimeText, !isDark && styles.liveTimeTextLight]}>Window kalan sure: {remainingTime}</Text>
        )}
        {readerCount != null ? (
          <Text style={[styles.liveTimeText, !isDark && styles.liveTimeTextLight]}>
            Şehir okuyor · {readerCount} (salt okunur · dışarıdan yazı yok)
          </Text>
        ) : null}
      </View>

      <LiveRitualParticipants
        participants={normalizedParticipants}
        onParticipantPress={handleParticipantPress}
        isDark={isDark}
      />

      {viewerSealed && pendingWitnessList.length > 0 ? (
        <PendingWitnessCard
          pending={pendingWitnessList}
          onConfirm={handleWitnessConfirm}
          confirmingId={witnessConfirmingId}
          isDark={isDark}
        />
      ) : null}

      <LiveRitualHostAnnouncements
        announcements={announcements}
        isHost={isHost}
        isDark={isDark}
        onSendAnnouncement={handleSendAnnouncement}
        hostKeyword={ritual?.code_display || ritual?.checkin_keyword || ''}
        participantCount={normalizedParticipants.length}
        windowDurationHours={windowDurationHours}
        onShowKeyword={handleRevealHostKeyword}
        onOpenParticipants={handleOpenParticipants}
        onExtendWindow={handleExtendWindow}
        onEndRitual={handleEndRitualNow}
        showSealedCode={Boolean(
          getViewerCheckedIn(ritual, currentUserId) &&
            (ritual?.code_display || ritual?.checkin_keyword)
        )}
      />

      {/* Unified Stream (Chat + Memories) */}
      <View style={[styles.streamSection, { backgroundColor: isDark ? ui.screen : ui.stream }]}>
        <FlatList
          ref={scrollViewRef}
          data={unifiedStream}
          renderItem={renderStreamItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.streamList}
          onContentSizeChange={scrollToBottom}
          ListHeaderComponent={
            <View style={styles.dateDivider}>
              <Text style={styles.dateDividerText}>Bugun · Ritual basladi</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyStream}>
              <Text style={[styles.emptyStreamText, !isDark && styles.emptyStreamTextLight]}>Henuz mesaj veya ani yok</Text>
              <Text style={[styles.emptyStreamSubtext, !isDark && styles.emptyStreamSubtextLight]}>Ilk paylasan sen ol!</Text>
            </View>
          }
        />
      </View>

      {/* Input Bar + Safety / Exit */}
      <View style={[styles.inputBar, { backgroundColor: ui.panel, borderTopColor: ui.inputBorder }]}>
        {/* Safety Row — v2 §5 window panel: 4 structural buttons */}
        <View style={styles.safetyRow}>
          <TouchableOpacity
            style={[styles.reportSafetyButton, !isDark && styles.reportSafetyButtonLight]}
            onPress={() => {
              if (!requireVerifiedUser(user, 'Bildirmek icin dogrulama gerekli.')) return;
              setReportTarget({ type: 'ritual', id: ritualId, leaveAfter: false });
              setShowReportModal(true);
            }}
          >
            <MaterialIcons name="flag" size={16} color={isDark ? 'rgba(255,255,255,.35)' : '#b45309'} />
            <Text style={[styles.reportSafetyText, !isDark && styles.reportSafetyTextLight]}>Bildir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={async () => {
              if (!requireVerifiedUser(user, 'Bildir ve ayrıl icin dogrulama gerekli.')) return;
              setReportTarget({ type: 'ritual', id: ritualId, leaveAfter: true });
              setShowReportModal(true);
            }}
          >
            <MaterialIcons name="report" size={16} color="#b91c1c" />
            <Text style={styles.leaveButtonText}>Bildir ve ayrıl</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportSafetyButton, !isDark && styles.reportSafetyButtonLight]}
            onPress={() => {
              Alert.alert(
                'Konum paylaş',
                'FL1–FL3 arkadaşınla 1 saat canlı konum paylaşımı (varsayılan).',
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Arkadaş seç',
                    onPress: () => navigation.navigate('FriendsList', { mode: 'share_location', ritualId }),
                  },
                ]
              );
            }}
          >
            <MaterialIcons name="my-location" size={16} color={isDark ? 'rgba(255,255,255,.35)' : '#b45309'} />
            <Text style={[styles.reportSafetyText, !isDark && styles.reportSafetyTextLight]}>Konum</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reportSafetyButton, !isDark && styles.reportSafetyButtonLight]}
            onPress={async () => {
              Alert.alert(
                'Yardım seçenekleri',
                'Acil durumda yerel yardım hatlarını ara. Bu kullanım otomatik cezasız çıkış işler.',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: '112 ara',
                    onPress: async () => {
                      try {
                        await Linking.openURL('tel:112');
                      } catch (e) {
                        warn('tel:112 failed', e?.message || e);
                      }
                      try {
                        await emergencyExit(ritualId, currentUserId);
                      } catch (e) {
                        warn('Help exit failed:', e?.message || e);
                      }
                      navigation.goBack();
                    },
                  },
                  {
                    text: 'Yardım ara / çık',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await Linking.openURL('tel:112');
                      } catch (_e) {
                        /* continue exit */
                      }
                      try {
                        await emergencyExit(ritualId, currentUserId);
                      } catch (e) {
                        warn('Help exit failed:', e?.message || e);
                      }
                      navigation.goBack();
                    },
                  },
                ]
              );
            }}
          >
            <MaterialIcons name="sos" size={16} color={isDark ? 'rgba(255,255,255,.35)' : '#b45309'} />
            <Text style={[styles.reportSafetyText, !isDark && styles.reportSafetyTextLight]}>Yardım</Text>
          </TouchableOpacity>
        </View>

        {/* Memory — live/window paylaşım; ısınmada RULO draft */}
        {!canCreateMemory && isLiveNow && (
          <View style={[styles.windowBanner, !isDark && styles.windowBannerLight]}>
            <MaterialIcons name="schedule" size={16} color={isDark ? '#f9a13d' : '#b45309'} />
            <Text style={[styles.windowBannerText, !isDark && styles.windowBannerTextLight]}>
              Isınma: kamera RULO taslagi acik · tam paylaşım start sonrası
            </Text>
          </View>
        )}

        {!selectedMemoryType && (canCreateMemory || canDraftMemory) && (
          <View style={styles.memoryTypeButtons}>
            <TouchableOpacity
              style={[styles.memoryTypeButton, { backgroundColor: ui.chipBg, borderColor: ui.chipBorder }]}
              onPress={handlePhotoSelect}
            >
              <MaterialIcons name="photo-camera" size={16} color={ui.icon} />
              <Text style={[styles.memoryTypeButtonText, { color: ui.chipText }]}>fotograf</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.memoryTypeButton, { backgroundColor: ui.chipBg, borderColor: ui.chipBorder }]}
              onPress={handleVideoSelect}
            >
              <MaterialIcons name="videocam" size={16} color={ui.icon} />
              <Text style={[styles.memoryTypeButtonText, { color: ui.chipText }]}>video</Text>
            </TouchableOpacity>
            {canCreateMemory ? (
              <>
                <TouchableOpacity
                  style={[styles.memoryTypeButton, { backgroundColor: ui.chipBg, borderColor: ui.chipBorder }]}
                  onPress={() => setSelectedMemoryType('playlist')}
                >
                  <MaterialIcons name="queue-music" size={16} color={ui.icon} />
                  <Text style={[styles.memoryTypeButtonText, { color: ui.chipText }]}>calma listesi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.memoryTypeButton, { backgroundColor: ui.chipBg, borderColor: ui.chipBorder }]}
                  onPress={() => setSelectedMemoryType('quote')}
                >
                  <MaterialIcons name="format-quote" size={16} color={ui.icon} />
                  <Text style={[styles.memoryTypeButtonText, { color: ui.chipText }]}>alinti</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.memoryTypeButton, { backgroundColor: ui.chipBg, borderColor: ui.chipBorder }]}
                onPress={handleSaveDraft}
              >
                <MaterialIcons name="drafts" size={16} color={ui.icon} />
                <Text style={[styles.memoryTypeButtonText, { color: ui.chipText }]}>RULO taslak</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Input Row */}
        {canCreateMemory || !selectedMemoryType ? (
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: ui.inputBg, borderColor: ui.chipBorder }]}
            onPress={() => {
              if (selectedMemoryType) {
                setSelectedMemoryType(null);
                setSelectedImage(null);
                setSelectedMediaMeta(null);
              }
            }}
          >
            <MaterialIcons name={selectedMemoryType ? "close" : "add"} size={24} color={ui.icon} />
          </TouchableOpacity>
          {selectedImage && (selectedMemoryType === 'photo' || selectedMemoryType === 'video') && (
            <View>
              <View style={styles.selectedImageContainer}>
                {selectedMemoryType === 'video' ? (
                  <View style={[styles.selectedImagePreview, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }]}>
                    <MaterialIcons name="videocam" size={28} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>
                      Video · max {VIDEO_MAX_S}sn
                    </Text>
                  </View>
                ) : (
                  <Image source={{ uri: selectedImage }} style={styles.selectedImagePreview} />
                )}
              </View>
              <View style={styles.memoryPreviewActions}>
                <TouchableOpacity onPress={handleSendMemory}><Text style={styles.memoryPreviewAction}>Paylaş</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveDraft}><Text style={styles.memoryPreviewAction}>Ruloya kaydet</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setSelectedImage(null); setSelectedMemoryType(null); setSelectedMediaMeta(null); }}><Text style={[styles.memoryPreviewAction, styles.memoryPreviewDelete]}>Sil</Text></TouchableOpacity>
              </View>
            </View>
          )}
          <TextInput
            style={[styles.inputField, { backgroundColor: ui.inputBg, borderColor: ui.chipBorder, color: ui.inputText }]}
            placeholder={
              selectedMemoryType === 'photo'
                ? 'Bir aciklama ekle...'
                : selectedMemoryType === 'video'
                  ? 'Video aciklamasi...'
                : selectedMemoryType === 'playlist'
                    ? 'Spotify / Apple / YouTube linki...'
                  : 'Bir dusunce paylas...'
            }
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            placeholderTextColor={ui.placeholder}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || (sending || savingMemory)) && styles.sendButtonDisabled]}
            onPress={handleSendMemory}
            disabled={!inputText.trim() || sending || savingMemory}
          >
            {sending || savingMemory ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        ) : null}
      </View>

      {/* Share to Pulse Modal */}
      <ShareToPulseModal
        visible={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setCheckingEligibility(false);
        }}
        onSelect={handleMemoryTypeSelect}
        checkingEligibility={checkingEligibility}
        isEligible={isEligibleForPulse}
        memoryContent={inputText}
      />

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportTarget(null);
          }}
          onReport={handleReport}
          reportType={reportTarget.type}
          reportedId={reportTarget.id}
          leaveAfter={Boolean(reportTarget.leaveAfter)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// Color Palette - Warm beige/cream
const COLORS = {
  // Dark ritual window with warm gold accents (matches Pulse / Social Passport theme)
  background: '#020617', // near-black
  card: '#111827', // dark slate for cards/bubbles
  textPrimary: '#f9fafb',
  textSecondary: '#e5e7eb',
  textTertiary: '#9ca3af',
  beige: '#111827',
  beigeDark: '#1f2937',
  primary: '#d4af37', // metallic gold
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#080808',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonLight: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  topHeaderTitle: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  topHeaderTitleLight: {
    color: '#000000',
  },
  moreButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonLight: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  eventDetails: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#080808',
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  eventDetailTextLight: {
    color: '#737373',
  },
  liveTimeText: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  liveTimeTextLight: {
    color: '#2A4470',
  },
  content: {
    flex: 1,
  },
  announcementsSection: {
    backgroundColor: '#0b1120',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFE0B2',
  },
  announcementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  announcementsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
  },
  announcementsScroll: {
    paddingHorizontal: 16,
  },
  announcementCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  announcementText: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 4,
  },
  announcementTime: {
    fontSize: 11,
    color: '#FF9800',
  },
  announcementInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF3E0',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
  },
  announcementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  announcementButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  participantsSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  participantsList: {
    paddingRight: 16,
  },
  peopleHereBox: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleHereAvatar: {
    width: 80,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  peopleHereText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  participantItem: {
    alignItems: 'center',
    marginRight: 12,
    minWidth: 60,
  },
  participantJoinedTime: {
    fontSize: 10,
    color: COLORS.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  participantAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  hostBadgeOnAvatar: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostBadgeOnAvatarText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#fff',
  },
  rsBadgeOnAvatar: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  rsBadgeOnAvatarText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  streamSection: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  streamList: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  dateDivider: {
    alignItems: 'center',
    marginBottom: 8,
  },
  dateDividerText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#A3A3A3',
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  streamItem: {
    flexDirection: 'row',
    marginBottom: 3,
    alignItems: 'flex-start',
  },
  streamItemYou: {
    flexDirection: 'row-reverse',
  },
  streamAvatar: {
    marginRight: 8,
    alignItems: 'center',
    marginTop: 2,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.08)',
  },
  avatarCircleLight: { backgroundColor: '#f3f4f6' },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,.65)',
  },
  avatarTextLight: { color: '#111827' },
  rsBadgeSmall: {
    marginTop: 3,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    minWidth: 18,
    alignItems: 'center',
  },
  rsBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  flMini: {
    marginTop: 3,
    fontSize: 7,
    color: '#111827',
    backgroundColor: '#fbbf24',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontWeight: '800',
  },
  flMiniLight: { color: '#111827', backgroundColor: '#f59e0b' },
  hostBadgeSmall: {
    marginTop: 3,
    backgroundColor: 'rgba(200,169,106,.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hostBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#C8A96A',
  },
  messageBubbleContainer: {
    flex: 1,
  },
  messageBubbleContainerYou: {
    alignItems: 'flex-end',
  },
  msgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 3,
  },
  msgHeaderRowYou: {
    flexDirection: 'row-reverse',
  },
  msgName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#737373',
  },
  msgNameHost: {
    color: '#1B2E4A',
  },
  msgNameYou: {
    color: '#2A4470',
  },
  msgRoleBadge: {
    fontSize: 7,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  msgRoleHost: {
    backgroundColor: '#1B2E4A',
    color: '#ffffff',
  },
  msgRoleDefault: {
    backgroundColor: '#F5F5F5',
    color: '#737373',
  },
  msgTime: {
    fontSize: 9,
    color: '#D4D4D4',
  },
  messageBubble: {
    backgroundColor: 'rgba(255,255,255,.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    marginBottom: 4,
    maxWidth: 280,
  },
  youBubble: {
    backgroundColor: 'rgba(27,46,74,.7)',
    borderColor: 'rgba(42,68,112,.8)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 0,
  },
  messageBubbleLight: { backgroundColor: '#ffffff', borderColor: '#e5e5e5' },
  messageBubbleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,.75)',
    lineHeight: 20,
  },
  messageBubbleTextLight: { color: '#111827' },
  announcementBubble: {
    backgroundColor: '#fff3cd',
  },
  announcementBubbleText: {
    fontWeight: '500',
  },
  memoryCardContainer: {
    flex: 1,
  },
  memoryImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoCaption: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  photoCaptionText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  memoryText: {
    fontSize: 13,
    color: 'rgba(255,255,255,.75)',
    lineHeight: 20,
    marginBottom: 4,
  },
  memoryTextLight: { color: '#111827' },
  quoteBubble: {
    backgroundColor: COLORS.beige,
    padding: 16,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  quoteBubbleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#E8EDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#1B2E4A',
  },
  quoteText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  quoteTextLight: { color: '#1B2E4A' },
  photoMemoryCard: {
    backgroundColor: COLORS.beige,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  photoMemoryCardLight: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e5e5' },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderLight: { backgroundColor: '#f3f4f6' },
  spotifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.06)',
    borderRadius: 12,
    borderTopLeftRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    gap: 8,
  },
  spotifyCardLight: { backgroundColor: '#ffffff', borderColor: '#e5e5e5' },
  spotifyIcon: {
    fontSize: 24,
  },
  spotifyCardContent: {
    flex: 1,
  },
  spotifyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  spotifyCardTitleLight: { color: '#111827' },
  spotifyCardSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  spotifyCardSubtitleLight: { color: '#737373' },
  musicCoverThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  stampRow: {
    marginTop: 8,
    gap: 2,
  },
  stampLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,.65)',
    letterSpacing: 0.2,
  },
  stampLabelLight: { color: '#6b7280' },
  stampPublish: {
    fontSize: 10,
    color: 'rgba(255,255,255,.45)',
  },
  stampPublishLight: { color: '#9ca3af' },
  messageTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,.18)',
    marginTop: 2,
  },
  bubblePhoto: {
    width: 240,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    backgroundColor: 'rgba(255,255,255,.04)',
  },
  bubblePhotoLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
  },
  bubblePhotoImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  bubblePhotoCaption: {
    fontSize: 11,
    color: 'rgba(255,255,255,.55)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.05)',
  },
  bubblePhotoCaptionLight: {
    color: '#737373',
    borderTopColor: '#f5f5f5',
  },
  bubblePlaylist: {
    width: 270,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    backgroundColor: 'rgba(255,255,255,.06)',
  },
  bubblePlaylistLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
  },
  bubblePlaylistHeader: {
    backgroundColor: '#1DB954',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubblePlaylistIcon: {
    fontSize: 16,
    color: '#000',
  },
  bubblePlaylistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  bubblePlaylistTrack: {
    fontSize: 11,
    color: 'rgba(255,255,255,.65)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubblePlaylistTrackLight: {
    color: '#525252',
  },
  bubbleVoice: {
    width: 260,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    backgroundColor: 'rgba(255,255,255,.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleVoiceLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5e5',
  },
  voiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  voicePlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 30,
    color: 'rgba(255,255,255,.7)',
    backgroundColor: 'rgba(255,255,255,.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.1)',
    overflow: 'hidden',
  },
  voicePlayLight: {
    color: '#1B2E4A',
    backgroundColor: '#E8EDF4',
    borderColor: '#E8EDF4',
  },
  voiceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,.55)',
  },
  voiceLabelLight: {
    color: '#1B2E4A',
  },
  voiceWaveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
  },
  voiceWave: {
    width: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,.15)',
    height: 10,
  },
  voiceWaveLight: {
    backgroundColor: '#E5E5E5',
  },
  voiceWavePlayed: {
    backgroundColor: 'rgba(42,68,112,.9)',
  },
  messageTimeLight: { color: '#a3a3a3' },
  emptyStream: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStreamText: {
    fontSize: 14,
    color: 'rgba(255,255,255,.45)',
    marginBottom: 8,
  },
  emptyStreamTextLight: {
    color: '#525252',
  },
  emptyStreamSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,.28)',
  },
  emptyStreamSubtextLight: {
    color: '#a3a3a3',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  announcementContainer: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#ffc107',
  },
  systemContainer: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196F3',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageHeaderTouchable: {
    flex: 1,
  },
  messageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  reportButton: {
    padding: 4,
  },
  reportButtonText: {
    fontSize: 14,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  announcementText: {
    fontWeight: '500',
  },
  systemText: {
    fontStyle: 'italic',
    color: '#666',
  },
  inputBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#141414',
  },
  safetyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(220,38,38,.10)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,.2)',
    gap: 4,
  },
  leaveButtonText: {
    fontSize: 11,
    color: 'rgba(220,38,38,.7)',
    fontWeight: '700',
  },
  reportSafetyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    gap: 4,
  },
  reportSafetyButtonLight: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  reportSafetyText: {
    fontSize: 11,
    color: 'rgba(255,255,255,.35)',
    fontWeight: '700',
  },
  reportSafetyTextLight: {
    color: '#b45309',
  },
  windowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(249,161,61,.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,161,61,.25)',
  },
  windowBannerLight: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  windowBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#f9a13d',
    fontWeight: '600',
  },
  windowBannerTextLight: {
    color: '#b45309',
  },
  memoryTypeButtons: {
    flexDirection: 'row',
    marginBottom: 7,
    gap: 4,
    justifyContent: 'space-between',
  },
  memoryTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    gap: 3,
    minWidth: 82,
  },
  memoryTypeButtonLight: { backgroundColor: '#f3f4f6' },
  memoryTypeButtonText: {
    fontSize: 10,
    color: 'rgba(255,255,255,.35)',
    fontWeight: '600',
  },
  memoryTypeButtonTextLight: { color: '#374151' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonLight: { backgroundColor: '#f3f4f6' },
  selectedImageContainer: {
    position: 'relative',
    marginRight: 8,
  },
  selectedImagePreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.beige,
  },
  memoryPreviewActions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  memoryPreviewAction: { color: '#8a6a22', fontSize: 12, fontWeight: '800' },
  memoryPreviewDelete: { color: '#b91c1c' },
  removeImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  inputField: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: 'rgba(255,255,255,.6)',
    maxHeight: 100,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2A4470',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    maxHeight: 100,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  announcementButton: {
    backgroundColor: '#ffc107',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  memoriesSection: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  addMemoryButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addMemoryButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  memoryInputContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  memoryInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  memoryButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  memoryCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  memoryCancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  memorySaveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#000',
    minWidth: 80,
    alignItems: 'center',
  },
  memorySaveButtonDisabled: {
    opacity: 0.5,
  },
  memorySaveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memoriesList: {
    padding: 16,
  },
  emptyMemories: {
    padding: 32,
    alignItems: 'center',
  },
  emptyMemoriesText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyMemoriesSubtext: {
    fontSize: 14,
    color: '#999',
  },
});
