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
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import OptimizedImage from '../components/OptimizedImage';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import { t } from '../i18n/stringTable';
import { getHighlightUserMax } from '../constants/localConfig';
import { warn } from '../utils/logger';
import {
  fetchUserProfile,
  fetchFriends,
  fetchUserRecentRituals,
  removeFriend,
  fetchUserVibes,
  addVibe,
  removeVibe,
  getVibeOptions,
  getFollows,
  fetchMemories,
  fetchUserMemoryGrid,
  fetchUserInterests,
  addUserInterest,
  removeUserInterest,
  fetchPassportEntries,
  reportUser,
  fetchRuloMemories,
  publishMemory,
  fetchMyModSanctions,
  createModAppeal,
  fetchMyRegularStatus,
} from '../services/api';
import { SkeletonCard, SkeletonBox, SkeletonList } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { MOOD_TAGS_40 } from '../constants/moodTags';
import { pulseGridCardImage, pulseMemoryImage } from '../constants/pulseExampleImages';
import ReportModal from '../components/ReportModal';
import { requireVerifiedUser } from '../utils/verificationGuard';

// Social Passport — mockup (light shell, white cards, green RS accent)
const SCREEN_BG = '#F9F9F9';
const GREEN_RS = '#22c55e';
// social-passport-gray-theme.html design tokens (legacy StyleSheet refs)
const GRAY_BG = '#e0e0e0';
const GRAY_CONTENT_BG = SCREEN_BG;
const GRAY_CARD = '#ffffff';
const GRAY_TEXT = '#000000';
const GRAY_TEXT_SEC = '#666666';
const GRAY_TEXT_TERT = '#999999';
const GRAY_PILL_BG = '#e8e8e8';
const GRAY_BORDER = '#e8e8e8';
const GRAY_BTN_PRIMARY = '#000000';
const GRAY_SHADOW = { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 };
// Legacy aliases (still referenced in StyleSheet)
const LIGHT_BLUE = '#e8e8e8';
const BLUE_ACCENT = GRAY_TEXT_SEC;
const PRIMARY_COLOR = '#666';
const ACCENT_AMBER = '#666';
const LIGHT_BACKGROUND = GRAY_CONTENT_BG;
const LIGHT_CARD = GRAY_CARD;
const LIGHT_TEXT_PRIMARY = GRAY_TEXT;
const LIGHT_TEXT_SECONDARY = GRAY_TEXT_SEC;
const LIGHT_TEXT_TERTIARY = GRAY_TEXT_TERT;
const BEIGE_BACKGROUND = GRAY_CONTENT_BG;
const TAG_CURIOUS = GRAY_PILL_BG;
const TAG_CALM = GRAY_PILL_BG;
const TAG_SOCIAL = GRAY_PILL_BG;
const BADGE_TOP_BG = GRAY_PILL_BG;
const BADGE_TOP_TEXT = GRAY_TEXT_SEC;
const BADGE_VERIFIED_BG = GRAY_PILL_BG;
const BADGE_VERIFIED_TEXT = GRAY_TEXT_SEC;
const BADGE_GREY_BG = GRAY_PILL_BG;
const BADGE_GREY_TEXT = GRAY_TEXT_SEC;
const HOSTS_GRADIENT_COLORS = [GRAY_PILL_BG, GRAY_PILL_BG];

export default function SocialPassportScreen({ route }) {
  const isDark = !!route?.params?.forceDark;
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;
  const viewedUserId = route?.params?.userId || currentUserId;
  const isOwnPassport = String(viewedUserId) === String(currentUserId);
  const highlightUserMax = getHighlightUserMax(useConfigStore((s) => s.config));
  
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [recentRituals, setRecentRituals] = useState([]);
  const [vibes, setVibes] = useState([]);
  const [memories, setMemories] = useState([]);
  const [passportEntries, setPassportEntries] = useState([]);
  const [memoryGrid, setMemoryGrid] = useState(null);
  const [interests, setInterests] = useState([]);
  const [editingInterests, setEditingInterests] = useState(false);
  const [newInterest, setNewInterest] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Added error state
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [followsLoading, setFollowsLoading] = useState(false);
  const [ritualsLoading, setRitualsLoading] = useState(false);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [passportLoading, setPassportLoading] = useState(false);
  const [interestsLoading, setInterestsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('quote'); // quote | badge | memories | rulo
  const [ruloItems, setRuloItems] = useState([]);
  const [ruloLoading, setRuloLoading] = useState(false);
  const [followingTab, setFollowingTab] = useState('hosts'); // 'hosts' or 'venues'
  const [vibeOptions, setVibeOptions] = useState([]);
  const [vibeModalVisible, setVibeModalVisible] = useState(false);
  const [vibeLoading, setVibeLoading] = useState(false);
  const [accessLevel, setAccessLevel] = useState('self'); // self | l1 | l2 | stranger
  const [sharedRitualCount, setSharedRitualCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [mySanctions, setMySanctions] = useState([]);
  const [myRegularStatus, setMyRegularStatus] = useState(null);
  const mainScrollRef = useRef(null);
  const [tabsOffsetY, setTabsOffsetY] = useState(0);
  const loadInProgressRef = useRef(false);
  const lastLoadUserIdRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || !viewedUserId) {
      navigation.replace('Login');
      return;
    }
    loadAll();
  }, [currentUserId, viewedUserId]);

  useEffect(() => {
    if (!isOwnPassport || !currentUserId) {
      setMySanctions([]);
      setMyRegularStatus(null);
      return;
    }
    fetchMyModSanctions()
      .then((rows) => setMySanctions(Array.isArray(rows) ? rows : []))
      .catch(() => setMySanctions([]));
    fetchMyRegularStatus()
      .then((data) => setMyRegularStatus(data || null))
      .catch(() => setMyRegularStatus(null));
  }, [isOwnPassport, currentUserId]);

  const handleAppeal = (sanction) => {
    const actionId = sanction?.action_id;
    if (!actionId) {
      Alert.alert('Itiraz', 'Bu yaptırıma bağlı aksiyon bulunamadı');
      return;
    }
    Alert.prompt
      ? Alert.prompt(
          'Itiraz',
          'Kısa gerekçe yaz',
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Gönder',
              onPress: async (reason) => {
                try {
                  await createModAppeal({ actionId, reason: reason || 'Itiraz' });
                  Alert.alert('Gönderildi', 'Itirazın inceleme kuyruğuna alındı');
                } catch (e) {
                  Alert.alert('Hata', e?.message || 'Itiraz gönderilemedi');
                }
              },
            },
          ],
          'plain-text'
        )
      : Alert.alert('Itiraz', 'Gerekçeyi onayla ve gönder', [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Gönder',
            onPress: async () => {
              try {
                await createModAppeal({ actionId, reason: 'Kullanıcı itirazı' });
                Alert.alert('Gönderildi', 'Itirazın inceleme kuyruğuna alındı');
              } catch (e) {
                Alert.alert('Hata', e?.message || 'Itiraz gönderilemedi');
              }
            },
          },
        ]);
  };

  const loadRulo = async () => {
    try {
      setRuloLoading(true);
      const rows = await fetchRuloMemories();
      setRuloItems(Array.isArray(rows) ? rows : []);
    } catch (_) {
      setRuloItems([]);
    } finally {
      setRuloLoading(false);
    }
  };

  const publishRuloItem = async (memoryId, audienceOrScope = 'WINDOW') => {
    try {
      const raw = String(audienceOrScope || 'WINDOW');
      const audience =
        raw === 'CITY' || raw === 'all'
          ? 'CITY'
          : raw === 'CIRCLE' || raw === 'pulse'
            ? 'CIRCLE'
            : 'WINDOW';
      const memoryScope =
        audience === 'CITY' ? 'all' : audience === 'CIRCLE' ? 'pulse' : 'solo';
      const result = await publishMemory(memoryId, { memoryScope, audience });
      Alert.alert(
        result?.retro ? 'Retro yayınlandı' : 'Yayınlandı',
        result?.retro
          ? 'Orijinal damga korundu. Your Pulse\'a düşmez; arşiv / passport / Ritual formuna eklendi.'
          : `Ani ${audience === 'CITY' ? 'SEHIR' : audience === 'CIRCLE' ? 'CEVRE' : 'MASA'} kapsaminda yayinlandi.`
      );
      await loadRulo();
    } catch (error) {
      Alert.alert('Yayınlanamadı', error?.message || 'Tekrar dene.');
    }
  };

  const loadAll = async (force = false) => {
    if (!currentUserId || !viewedUserId) return;
    // Prevent duplicate concurrent loads (e.g. Strict Mode or tab re-mounts)
    if (!force && loadInProgressRef.current) return;
    loadInProgressRef.current = true;
    lastLoadUserIdRef.current = viewedUserId;

    try {
      setError(null); // Clear previous errors
      await resolveAccessLevel();
      await loadProfile();
      // Load in batches to avoid overwhelming the server
      await Promise.all([loadFriends(), loadFollows()]);
      // Load rituals first; pass result to loadMemories to avoid duplicate fetchUserRecentRituals
      const ritualsData = await loadRecentRituals();
      // Then vibes, interests in parallel
      await Promise.all([
        loadVibes().catch(err => warn('Error loading vibes (non-fatal):', err.message || err)),
        loadInterests().catch(err => warn('Error loading interests (non-fatal):', err.message || err))
      ]);
      await loadMemories(ritualsData);
      if (isOwnPassport) {
        await loadPassportEntries();
      } else {
        setPassportEntries([]);
      }
      await loadMemoryGrid();
    } catch (error) {
      warn('Error loading data (non-fatal):', error.message || error);
      setError(error); // Set error state
    } finally {
      loadInProgressRef.current = false;
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    loadAll(true);
  };

  const handleSharePassport = () => {
    if (!requireVerifiedUser(user, 'Share-2-Person icin universite e-postani dogrula.')) return;
    navigation.navigate('FriendsList', {
      userId: currentUserId,
      sharePassportUserId: viewedUserId,
      sharePassportLabel: profile?.name || 'Passport',
    });
  };

  const handleMessage = async () => {
    if (isOwnPassport) return;
    if (!requireVerifiedUser(user, 'Share-2-Person icin universite e-postani dogrula.')) return;
    try {
      const myFriends = await fetchFriends(currentUserId);
      const isFriend = (myFriends || []).some((item) => {
        const friend = item.friend || item.user || {};
        const fid = friend.id || item.friend_id || item.user_id;
        return String(fid) === String(viewedUserId);
      });
      if (!isFriend) {
        Alert.alert('Arkadaslik gerekli', 'Mesaj gondermek icin once bu kisiyle baglanti kurmalisin.');
        return;
      }
      navigation.navigate('Conversation', {
        userId: viewedUserId,
        userName: profile?.name || 'Arkadas',
      });
    } catch (error) {
      Alert.alert('Hata', error.message || 'Mesaj acilamadi');
    }
  };

  const handleReport = async (reportData) => {
    if (!requireVerifiedUser(user, 'Rapor gondermek icin universite e-postani dogrula.')) return;
    try {
      await reportUser(currentUserId, viewedUserId, reportData.category_key || reportData.reason, reportData.description, {
        targetType: 'user',
      });
      Alert.alert('Basarili', 'Rapor basariyla gonderildi');
      setShowReportModal(false);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Rapor gonderilemedi');
    }
  };

  const loadProfile = async () => {
    if (!viewedUserId) return;
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      const data = await fetchUserProfile(viewedUserId);
      setProfile(data);
    } catch (error) {
      warn('Error loading profile (non-fatal):', error.message || error);
      setError(error); // Set error state
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!viewedUserId) return;
    try {
      setFriendsLoading(true);
      const data = await fetchFriends(viewedUserId);
      setFriends(data || []);
    } catch (error) {
      if (error?.code === 'FRIENDS_LIST_PRIVATE' || error?.status === 403) {
        setFriends([]);
      } else {
        warn('Error loading friends (non-fatal):', error.message || error);
      }
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadRecentRituals = async () => {
    if (!viewedUserId) return [];
    try {
      setRitualsLoading(true);
      const data = await fetchUserRecentRituals(viewedUserId, 10);
      const list = data || [];
      setRecentRituals(list);
      return list;
    } catch (error) {
      warn('Error loading recent rituals (non-fatal):', error.message || error);
      setRecentRituals([]);
      return [];
    } finally {
      setRitualsLoading(false);
    }
  };

  const loadVibes = async () => {
    if (!viewedUserId) return;
    try {
      const data = await fetchUserVibes(viewedUserId);
      setVibes(data || []);
    } catch (error) {
      warn('Error loading vibes (non-fatal):', error.message || error);
    }
  };

  const openVibeModal = async () => {
    setVibeModalVisible(true);
    if (vibeOptions.length === 0) {
      try {
        const options = await getVibeOptions();
        setVibeOptions(options || []);
      } catch (e) {
        warn('Error loading vibe options:', e);
      }
    }
  };

  const handleAddVibe = async (vibe) => {
    if (!isOwnPassport || !currentUserId || vibeLoading) return;
    try {
      setVibeLoading(true);
      await addVibe(currentUserId, vibe);
      setVibes(prev => [...prev, vibe].sort());
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add vibe');
    } finally {
      setVibeLoading(false);
    }
  };

  const handleRemoveVibe = async (vibe) => {
    if (!isOwnPassport || !currentUserId || vibeLoading) return;
    try {
      setVibeLoading(true);
      await removeVibe(currentUserId, vibe);
      setVibes(prev => prev.filter(v => v !== vibe));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to remove vibe');
    } finally {
      setVibeLoading(false);
    }
  };

  const loadMemories = async (recentRitualsData = null) => {
    if (!viewedUserId) return;
    try {
      setMemoriesLoading(true);
      // Use passed-in data from loadRecentRituals to avoid duplicate fetchUserRecentRituals
      const list = recentRitualsData != null && recentRitualsData.length > 0
        ? recentRitualsData
        : (recentRituals.length > 0 ? recentRituals : await fetchUserRecentRituals(viewedUserId, 10));
      const memoryPromises = list.map(ritual =>
        fetchMemories(ritual.id).catch(() => [])
      );
      const allMemories = await Promise.all(memoryPromises);
      const flattened = allMemories.flat().filter(m => m.user_id === viewedUserId);
      flattened.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setMemories(flattened.slice(0, 10));
      if (recentRituals.length === 0 && list.length > 0) {
        setRecentRituals(list);
      }
    } catch (error) {
      warn('Error loading memories (non-fatal):', error.message || error);
    } finally {
      setMemoriesLoading(false);
    }
  };

  const loadPassportEntries = async () => {
    if (!isOwnPassport) return;
    try {
      setPassportLoading(true);
      const data = await fetchPassportEntries({ limit: 30 });
      setPassportEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (error) {
      warn('Error loading passport entries (non-fatal):', error?.message || error);
      setPassportEntries([]);
    } finally {
      setPassportLoading(false);
    }
  };

  const loadMemoryGrid = async () => {
    if (!viewedUserId || !currentUserId) return;
    try {
      const grid = await fetchUserMemoryGrid(viewedUserId, currentUserId, 9);
      setMemoryGrid(grid);
    } catch (error) {
      warn('Error loading memory grid (non-fatal):', error?.message || error);
      setMemoryGrid(null);
    }
  };

  const loadFollows = async () => {
    if (!viewedUserId) return;
    try {
      setFollowsLoading(true);
      const [followingData, followersData] = await Promise.all([
        getFollows(viewedUserId, 'following'),
        getFollows(viewedUserId, 'followers'),
      ]);
      // Backend returns { id, user: { id, name, city, university }, role } — flatten for UI
      const normalize = (list) => (list || []).map((item) => {
        const u = item.user || item;
        return {
          id: item.id || u.id,
          name: u.name || item.name,
          username: u.username || item.username,
          city: u.city || item.city,
          university: u.university || item.university,
          venue_name: item.venue_name || u.venue_name,
          avatar_url: u.avatar_url || item.avatar_url || u.image_url || item.image_url,
          image_url: u.image_url || item.image_url,
          role: item.role || u.role,
          is_top_host: item.is_top_host ?? u.is_top_host,
          is_host_verified: item.is_host_verified ?? u.is_host_verified,
          is_verified: item.is_verified ?? u.is_verified,
        };
      });
      setFollowing(normalize(followingData));
      setFollowers(normalize(followersData));
    } catch (error) {
      warn('Error loading follows (non-fatal):', error?.message || error);
      setFollowing([]);
      setFollowers([]);
    } finally {
      setFollowsLoading(false);
    }
  };

  const loadInterests = async () => {
    if (!viewedUserId) return;
    try {
      setInterestsLoading(true);
      const data = await fetchUserInterests(viewedUserId);
      setInterests(data || []);
    } catch (error) {
      warn('Error loading interests (non-fatal):', error.message || error);
    } finally {
      setInterestsLoading(false);
    }
  };

  const handleAddInterest = async () => {
    if (!isOwnPassport || !newInterest.trim() || !currentUserId) return;
    
    const category = newInterest.trim().toLowerCase();
    
    // Check if already exists
    if (interests.includes(category)) {
      Alert.alert('Already Added', 'This interest is already in your list.');
      setNewInterest('');
      return;
    }

    try {
      await addUserInterest(currentUserId, category);
      setInterests([...interests, category]);
      setNewInterest('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add interest');
    }
  };

  const handleRemoveInterest = async (category) => {
    if (!isOwnPassport || !currentUserId) return;
    
    try {
      await removeUserInterest(currentUserId, category);
      setInterests(interests.filter(i => i !== category));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to remove interest');
    }
  };

  const resolveAccessLevel = async () => {
    if (!currentUserId || !viewedUserId) return;
    if (String(currentUserId) === String(viewedUserId)) {
      setAccessLevel('self');
      setSharedRitualCount(0);
      return;
    }
    try {
      const [myRituals, targetRituals] = await Promise.all([
        fetchUserRecentRituals(currentUserId, 50),
        fetchUserRecentRituals(viewedUserId, 50),
      ]);
      const mySet = new Set((myRituals || []).map((r) => r.id));
      const shared = (targetRituals || []).filter((r) => mySet.has(r.id)).length;
      setSharedRitualCount(shared);
      if (shared === 0) setAccessLevel('stranger');
      else if (shared <= 3) setAccessLevel('l1');
      else setAccessLevel('l2');
    } catch (_e) {
      setSharedRitualCount(0);
      setAccessLevel('stranger');
    }
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  /** Rituals list row: "Yesterday · 10:00" */
  const formatListTimestamp = (startTime) => {
    if (!startTime) return '';
    const d = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    let dayPart = '';
    if (diffDays <= 0) dayPart = 'Today';
    else if (diffDays === 1) dayPart = 'Yesterday';
    else if (diffDays < 7) dayPart = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    else dayPart = formatDate(startTime);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${dayPart} · ${h}:${m}`;
  };

  const formatTime = (startTime, duration) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    const startHours = start.getHours().toString().padStart(2, '0');
    const startMins = start.getMinutes().toString().padStart(2, '0');
    const endHours = end.getHours().toString().padStart(2, '0');
    const endMins = end.getMinutes().toString().padStart(2, '0');
    return `${startHours}:${startMins} - ${endHours}:${endMins}`;
  };

  const getRSPercent = (rs) => {
    return Math.round((rs / 10) * 100);
  };

  const getRSStatus = (rs) => {
    // LTE-3 §11 RS levels
    if (rs >= 9.0) return { label: 'Exceptional', color: '#2E7D32', guidance: null };
    if (rs >= 7.5) return { label: 'Reliable', color: '#4CAF50', guidance: null };
    if (rs >= 6.0) return { label: 'Established', color: '#2196F3', guidance: null };
    if (rs >= 4.5) return { label: 'Developing', color: '#FF9800', guidance: 'Keep showing up consistently to build your reliability.' };
    if (rs >= 3.0) {
      return {
        label: 'Needs Care',
        color: '#F44336',
        guidance: 'Your reliability score is lower than ideal. Focus on showing up on time, staying for the full ritual, and giving thoughtful feedback.',
      };
    }
    return {
      label: 'Critical',
      color: '#b71c1c',
      guidance: 'Your reliability score needs attention. Focus on showing up, completing rituals, and feedback.',
    };
  };

  const resolveFriendLevel = (friend) => {
    const fl = String(friend?.friend_level || '').toUpperCase();
    if (fl === 'L1' || fl === 'L2' || fl === 'L3' || fl === 'CORE') return fl;
    const rs = Number(friend?.rs_score || 0);
    if (rs >= 9.0) return 'CORE';
    if (rs >= 7.5) return 'L3';
    if (rs >= 6.0) return 'L2';
    return 'L1';
  };
  const connectionCounts = (friends || []).reduce(
    (acc, f) => {
      const lvl = resolveFriendLevel(f);
      acc[lvl] = (acc[lvl] || 0) + 1;
      return acc;
    },
    { L1: 0, L2: 0, L3: 0, CORE: 0 }
  );

  // Circular Progress Bar Component (using View-based approach)
  const CircularProgress = ({ progress, size = 100, strokeWidth = 8, color = '#3b82f6', rsScore = 5.0, showPercent = false }) => {
    const radius = size / 2 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const progressAngle = (progress / 100) * 360;
    
    // Calculate which borders to show based on progress
    const showTop = progress > 0;
    const showRight = progress > 25;
    const showBottom = progress > 50;
    const showLeft = progress > 75;
    
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        {/* Background circle */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color + '30',
          }}
        />
        {/* Progress arc - simplified approach */}
        {progress > 0 && (
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'transparent',
              borderTopColor: showTop ? color : 'transparent',
              borderRightColor: showRight ? color : 'transparent',
              borderBottomColor: showBottom ? color : 'transparent',
              borderLeftColor: showLeft ? color : 'transparent',
              transform: [{ rotate: '-90deg' }],
            }}
          />
        )}
        {/* Center text */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: showPercent ? 12 : 18, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY }}>
            {showPercent ? `${progress}%` : `${rsScore.toFixed(1)}/10`}
          </Text>
        </View>
      </View>
    );
  };

  // pas.html: Curious #D9A05B, Calm #8EB883, Social #EF8E5E — white text
  const getVibePillStyle = (vibe) => {
    const vibeLower = vibe.toLowerCase();
    if (vibeLower.includes('curious') || vibeLower.includes('deep')) {
      return { backgroundColor: TAG_CURIOUS };
    } else if (vibeLower.includes('calm')) {
      return { backgroundColor: TAG_CALM };
    } else if (vibeLower.includes('social')) {
      return { backgroundColor: TAG_SOCIAL };
    }
    return { backgroundColor: PRIMARY_COLOR };
  };

  const getVibePillTextStyle = () => ({ color: GRAY_TEXT_SEC });

  const formatPassportDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderPassportEntry = (entry, index) => {
    const entryType = entry.entry_type || 'memory';
    const iconName =
      entryType === 'badge' ? 'military-tech' : entryType === 'quote' ? 'format-quote' : 'photo-library';
    const title =
      entryType === 'badge'
        ? entry.badge_label || entry.badge_key || 'Rozet'
        : entry.ritual_title || entry.venue_name || 'Ritual izi';
    const body =
      entryType === 'badge'
        ? 'Yasanmis Ritualden kazanilan rozet'
        : String(entry.content || '').trim();

    return (
      <TouchableOpacity
        key={entry.id || `passport-${index}`}
        style={[styles.passportEntryRow, isDark && { backgroundColor: '#111827', borderColor: '#1f2937' }]}
        onPress={() => {
          if (entryType !== 'badge' && entry.id) {
            navigation.navigate('MemoryDetail', { memory: entry });
          }
        }}
        activeOpacity={entryType === 'badge' ? 1 : 0.85}
      >
        <View style={[styles.passportEntryIcon, isDark && { backgroundColor: '#1f2937' }]}>
          <MaterialIcons name={iconName} size={18} color={isDark ? '#e5e7eb' : GRAY_TEXT_SEC} />
        </View>
        <View style={styles.passportEntryBody}>
          <View style={styles.passportEntryHeader}>
            <Text style={[styles.passportEntryType, isDark && { color: '#94a3b8' }]}>
              {entryType === 'badge' ? 'ROZET' : entryType === 'quote' ? 'ALINTI' : 'ANI'}
            </Text>
            <Text style={[styles.passportEntryDate, isDark && { color: '#64748b' }]}>
              {formatPassportDate(entry.created_at)}
            </Text>
          </View>
          <Text style={[styles.passportEntryTitle, isDark && { color: '#f8fafc' }]} numberOfLines={1}>
            {title}
          </Text>
          {body ? (
            <Text style={[styles.passportEntryText, isDark && { color: '#cbd5e1' }]} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMemoryCard = (memory, ritual, index) => {
    if (!ritual) {
      // Fallback if ritual not found - try to get from recentRituals
      const foundRitual = recentRituals.find(r => r.id === memory.ritual_id);
      if (!foundRitual) {
        return (
          <View key={memory.id || index} style={styles.memoryCard}>
            <Text style={styles.memoryDate}>{formatDate(memory.created_at)}</Text>
            <Text style={styles.memoryText}>{memory.content}</Text>
          </View>
        );
      }
      ritual = foundRitual;
    }

    const dateStr = formatDate(ritual.start_time);
    const vibeTags = ritual.tags ? ritual.tags.split(',').map(t => t.trim()) : 
                     (ritual.type ? [ritual.type] : []);
    
    const memoryImages = [
      memory?.image_url || memory?.photo_url || memory?.content_url || null,
      memory?.ritual_image_url || ritual?.image_url || ritual?.venue_image_url || null,
      ritual?.cover_image_url || null,
    ];
    
    return (
      <TouchableOpacity
        key={memory.id || index}
        style={styles.memoryCard}
        onPress={() => navigation.navigate('MemoryDetail', { memory })}
        activeOpacity={0.8}
      >
        <Text style={styles.memoryDate}>{dateStr}</Text>
        <Text style={styles.memoryTitle}>{ritual.title || 'Ritual'}</Text>
        <Text style={styles.memoryLocation}>{ritual.venue_name || ''}</Text>
        
        {/* Tags */}
        {vibeTags.length > 0 && (
          <View style={styles.memoryTags}>
            {vibeTags.slice(0, 3).map((tag, idx) => (
              <View key={idx} style={[styles.memoryTag, getVibePillStyle(tag)]}>
                <Text style={[styles.memoryTagText, getVibePillTextStyle(tag)]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Images Row */}
        <View style={styles.memoryImagesRow}>
          {[0, 1, 2].map((idx) => {
            const img = memoryImages[idx] || null;
            return (
              <View key={idx} style={styles.memoryImageSquare}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.memoryImage} resizeMode="cover" />
                ) : (
                  <View style={styles.memoryImagePlaceholder}>
                    <MaterialIcons name="image" size={16} color={LIGHT_TEXT_TERTIARY} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Spotify Playlist Card (Spec 5.X.4, 5.X.6) */}
        {memory.spotify_playlist_url && (
          <TouchableOpacity
            style={styles.memorySpotifyCard}
            onPress={() => {
              try {
                Linking.openURL(memory.spotify_playlist_url).catch(() => {});
              } catch (_) {}
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.memorySpotifyEmoji}>🎵</Text>
            <View style={styles.memorySpotifyCardContent}>
              <Text style={styles.memorySpotifyCardTitle}>Spotify Playlist</Text>
              <Text style={styles.memorySpotifyCardSubtitle}>Tap to open in Spotify</Text>
            </View>
            <MaterialIcons name="open-in-new" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Quote Icons */}
        <View style={styles.memoryIconsRow}>
          {memory.content && (
            <View style={styles.memoryIconItem}>
              <MaterialIcons name="format-quote" size={16} color={LIGHT_TEXT_SECONDARY} />
              <Text style={styles.memoryIconText} numberOfLines={2}>
                {memory.content}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRitualCard = (ritual, index) => {
    const timeRange = formatTime(ritual.start_time, ritual.duration);
    const dateStr = formatDate(ritual.start_time);
    
    // Parse vibe tags from ritual type or tags field
    const vibeTags = ritual.tags ? ritual.tags.split(',').map(t => t.trim()) : 
                     (ritual.type ? [ritual.type] : []);
    
    return (
      <TouchableOpacity
        key={ritual.id || `ritual-${index}`}
        style={styles.ritualCard}
        onPress={() => navigation.navigate('RitualDetail', { ritualId: ritual.id })}
        activeOpacity={0.8}
      >
        <View style={styles.ritualCardContent}>
          <View style={styles.ritualImageContainer}>
            {ritualVisualUri(ritual) ? (
              <Image
                source={{ uri: ritualVisualUri(ritual) }}
                style={styles.ritualImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.ritualImagePlaceholder}>
                <MaterialIcons name="image" size={24} color={LIGHT_TEXT_TERTIARY} />
              </View>
            )}
          </View>

          <View style={styles.ritualCardRight}>
            <View style={styles.ritualCardTop}>
              <Text style={styles.ritualDate}>{dateStr}</Text>
              <Text style={styles.ritualTitle} numberOfLines={1}>
                {ritual.title}
              </Text>
              <View style={styles.ritualLocationRow}>
                <Text style={styles.ritualLocation}>
                  {ritual.venue_name}{timeRange ? ` ${timeRange}` : ''}
                </Text>
                {ritual.is_venue_verified && (
                  <>
                    <MaterialIcons name="verified" size={12} color={ACCENT_AMBER} style={styles.verifiedIcon} />
                    <Text style={styles.verifiedText}>Dogrulanmis Mekan</Text>
                  </>
                )}
              </View>
              {ritual.is_host_verified && (
                <View style={styles.verifiedBadgeRow}>
                  <MaterialIcons name="verified-user" size={12} color={ACCENT_AMBER} />
                  <Text style={styles.verifiedBadgeText}>Dogrulanmis Host</Text>
                </View>
              )}
            </View>

            <View style={styles.ritualCardBottom}>
              <View style={styles.ritualVibes}>
                {vibeTags.slice(0, 3).map((vibe, idx) => (
                  <View key={idx} style={styles.vibePill}>
                    <Text style={styles.vibePillText}>{vibe}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.ritualStats}>
                <Text style={styles.attendanceText}>
                  {ritual.current_attendees || 0} people attended
                </Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Completed</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /** Mockup-style list row: thumb left, title + time + venue + pills */
  const renderPassportRitualRow = (ritual, index) => {
    const vibeTags = ritual.tags
      ? ritual.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : ritual.type
        ? [ritual.type]
        : [];
    return (
      <TouchableOpacity
        key={ritual.id || `pr-${index}`}
        style={[styles.passportRitualRow, isDark && { backgroundColor: '#111827' }]}
        onPress={() => navigation.navigate('RitualDetail', { ritualId: ritual.id })}
        activeOpacity={0.85}
      >
        <View style={styles.passportRitualThumb}>
          {ritualVisualUri(ritual) ? (
            <Image source={{ uri: ritualVisualUri(ritual) }} style={styles.passportRitualThumbImg} resizeMode="cover" />
          ) : (
            <View style={styles.passportRitualThumbPh}>
              <MaterialIcons name="image" size={22} color={GRAY_TEXT_TERT} />
            </View>
          )}
        </View>
        <View style={styles.passportRitualBody}>
          <Text style={[styles.passportRitualTitle, isDark && { color: '#f8fafc' }]} numberOfLines={2}>
            {ritual.title}
          </Text>
          <Text style={[styles.passportRitualMeta, isDark && { color: '#94a3b8' }]}>{formatListTimestamp(ritual.start_time)}</Text>
          <Text style={[styles.passportRitualVenue, isDark && { color: '#cbd5e1' }]} numberOfLines={1}>
            {ritual.venue_name || '—'}
            {ritual.city ? ` · ${ritual.city}` : ''}
          </Text>
          {vibeTags.length > 0 ? (
            <View style={styles.passportRitualTags}>
              {vibeTags.slice(0, 3).map((tag, i) => (
                <View key={i} style={[styles.passportRitualTag, isDark && { backgroundColor: '#1f2937' }]}>
                  <Text style={[styles.passportRitualTagText, isDark && { color: '#e5e7eb' }]}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Show error state if there's an error and no profile
  if (error && !profile && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerGray}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerLogoBox}>
            <Text style={styles.headerLogoL}>L.</Text>
            <Text style={styles.headerLogoLocal}>LOCAL</Text>
          </View>
          <View style={styles.headerMenuBtn} />
        </View>
        <ErrorState
          title="Failed to load profile"
          message="We couldn't load your profile. Please check your connection and try again."
          onRetry={handleRetry}
        />
      </View>
    );
  }

  // Show skeleton loader on initial load
  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerGray}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerLogoBox}>
            <Text style={styles.headerLogoL}>L.</Text>
            <Text style={styles.headerLogoLocal}>LOCAL</Text>
          </View>
          <TouchableOpacity style={styles.headerMenuBtn}>
            <Text style={styles.headerMenuText}>⋯</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Profile skeleton */}
          <View style={styles.profileSection}>
            <View style={styles.profileContent}>
              <SkeletonBox width={80} height={80} borderRadius={40} />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <SkeletonBox width="60%" height={20} borderRadius={4} style={{ marginBottom: 8 }} />
                <SkeletonBox width="40%" height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                <SkeletonBox width="50%" height={16} borderRadius={4} />
              </View>
            </View>
          </View>
          {/* Interests skeleton */}
          <View style={styles.interestsSection}>
            <SkeletonBox width="30%" height={18} borderRadius={4} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SkeletonBox width={60} height={24} borderRadius={12} />
              <SkeletonBox width={60} height={24} borderRadius={12} />
              <SkeletonBox width={60} height={24} borderRadius={12} />
            </View>
          </View>
          {/* Tabs skeleton */}
          <View style={styles.tabsContainer}>
            <SkeletonBox width="45%" height={40} borderRadius={8} />
            <SkeletonBox width="45%" height={40} borderRadius={8} />
          </View>
          {/* Content skeleton */}
          <SkeletonList
            count={3}
            renderItem={() => <SkeletonCard style={{ marginBottom: 16 }} />}
          />
        </ScrollView>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerGray}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerLogoBox}>
            <Text style={styles.headerLogoL}>L.</Text>
            <Text style={styles.headerLogoLocal}>LOCAL</Text>
          </View>
          <View style={styles.headerMenuBtn} />
        </View>
        <EmptyState
          icon="person-off"
          title="Profil bulunamadi"
          message="Profilin bulunamadi. Lutfen tekrar dene."
          actionLabel="Tekrar Dene"
          onAction={handleRetry}
        />
      </View>
    );
  }

  // §14 — RS default private; yalnız sahip veya show_rs_score_publicly açıkken
  const canSeeExactRS =
    isOwnPassport ||
    profile.rs_visible === true ||
    profile.rs_exact_visible === true;
  const rsScore =
    canSeeExactRS && profile.rs_score != null ? Number(profile.rs_score) : null;
  /** Mockup-style 3-digit score (0–10 scale → 0–1000) */
  const rsDisplay =
    rsScore != null ? Math.round(Math.min(10, Math.max(0, rsScore)) * 100) : null;
  const hostsFollowing = (following || []).filter(f => f.role !== 'venue');
  const venuesFollowing = (following || []).filter(f => f.role === 'venue');
  const followingList = followingTab === 'hosts' ? hostsFollowing : venuesFollowing;
  const coverUri =
    profile?.cover_url ||
    profile?.banner_url ||
    recentRituals?.[0]?.image_url ||
    recentRituals?.[0]?.venue_image_url ||
    null;
  const ritualVisualUri = (ritual, index = 0) => pulseGridCardImage(ritual, index);
  const isPivotHost = (profile.highlighted_badges || []).some(
    (b) => b.slug === 'manual_pivot_host' || String(b.slug || '').includes('pivot')
  );
  const ritualsForAccess = isOwnPassport
    ? recentRituals
    : (accessLevel === 'l2' ? recentRituals : (accessLevel === 'l1' ? recentRituals.slice(0, 3) : []));

  const renderPastMemoryCard = (ritual, index) => {
    const dateStr = ritual.start_time ? formatDate(ritual.start_time) : '';
    const hostAvatar = ritual.host_avatar_url || ritual.host_image_url;
    return (
      <TouchableOpacity
        key={ritual.id || index}
        style={styles.pastMemoryCard}
        onPress={() => navigation.navigate('RitualDetail', { ritualId: ritual.id })}
        activeOpacity={0.8}
      >
        <View style={styles.pastMemoryTop}>
          <Text style={styles.pastMemoryDate}>{dateStr}</Text>
          {hostAvatar ? (
            <OptimizedImage source={{ uri: hostAvatar }} style={styles.pastMemoryHostAvatar} />
          ) : (
            <View style={[styles.pastMemoryHostAvatar, styles.pastMemoryHostAvatarPlaceholder]}>
              <Text style={styles.pastMemoryHostInitial}>{(ritual.host_name || '?').charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.pastMemoryBody}>
          <Text style={styles.pastMemoryTitle} numberOfLines={1}>{ritual.title || 'Ritual'}</Text>
          <View style={styles.pastMemoryLocationRow}>
            <MaterialIcons name="location-on" size={10} color={LIGHT_TEXT_SECONDARY} />
            <Text style={styles.pastMemoryLocation} numberOfLines={1}>{ritual.venue_name || ''}</Text>
          </View>
        </View>
        <View style={styles.pastMemoryIcons}>
          <View style={styles.pastMemoryIconBox}>
            <MaterialIcons name="event" size={14} color="#fff" />
          </View>
          <View style={styles.pastMemoryIconBoxGray}>
            <MaterialIcons name="mic" size={14} color={LIGHT_TEXT_SECONDARY} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#030712' }]}>
      <ScrollView
        ref={mainScrollRef}
        style={[styles.scrollView, isDark && { backgroundColor: '#030712' }]}
        contentContainerStyle={styles.scrollContentMock}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusBarSpacer} />

        <View style={[styles.profileShellCard, isDark && { backgroundColor: '#111827' }]}>
          <View style={[styles.passportTopBar, isDark && styles.passportTopBarDark]}>
            <View style={styles.tbLogoWrap}>
              <Text style={[styles.tbLogo, isDark && { color: '#f8fafc' }]}>L</Text>
              <View style={[styles.tbLogoDot, isDark && { backgroundColor: '#f8fafc' }]} />
            </View>
            <View style={styles.tbRight}>
              <TouchableOpacity style={[styles.iconBtn, isDark && styles.iconBtnDark]} onPress={handleSharePassport}>
                <MaterialIcons name="north-east" size={16} color={isDark ? '#cbd5e1' : '#525252'} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, isDark && styles.iconBtnDark]} onPress={() => navigation.navigate('Settings')}>
                <MaterialIcons name="settings" size={16} color={isDark ? '#cbd5e1' : '#525252'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.coverPhoto, isDark && styles.coverPhotoDark]}>
            {coverUri ? (
              <OptimizedImage source={{ uri: coverUri }} style={styles.coverPhotoImage} />
            ) : null}
            <View style={styles.coverPattern} />
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatarRing}>
              {profile.avatar_url || profile.image_url ? (
                <OptimizedImage source={{ uri: profile.avatar_url || profile.image_url }} style={styles.profileAvatarImgGray} />
              ) : (
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarInitial}>{(profile?.name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {isPivotHost ? (
                <View style={styles.avatarPivotBadge}>
                  <Text style={styles.avatarPivotBadgeText}>★</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.profileNameGray, isDark && { color: '#f8fafc' }]}>{profile.name}</Text>
            {profile.show_uni_label && profile.university ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('UniversityProfile', { name: profile.university })}
                activeOpacity={0.85}
              >
                <Text style={[styles.profileLocationGray, isDark && { color: '#cbd5e1' }]}>
                  🎓 {profile.university}{profile.city ? ` · ${profile.city}` : ''}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.profileLocationGray, isDark && { color: '#cbd5e1' }]}>
                {profile.city || '—'}
              </Text>
            )}
            {profile.bio_quote?.text ? (
              <Text style={[styles.bioQuote, isDark && { color: '#cbd5e1' }]}>
                “{profile.bio_quote.text}”
              </Text>
            ) : null}
            <View style={styles.moodTags}>
              {(vibes.length ? vibes : interests).slice(0, 4).map((tag, idx) => (
                <View key={`${tag}-${idx}`} style={[styles.moodTag, isDark && styles.moodTagDark]}>
                  <Text style={[styles.moodTagText, isDark && styles.moodTagTextDark]}>{tag}</Text>
                </View>
              ))}
            </View>
            {(profile.highlighted_badges || []).length > 0 ? (
              <View style={styles.profileBadgesGray}>
                {profile.highlighted_badges.slice(0, highlightUserMax).map((b) => (
                  <View key={b.slug} style={[styles.badgeGray, isDark && { backgroundColor: '#1f2937', borderColor: '#334155' }]}>
                    <Text style={styles.badgeIconGray}>{b.icon_emoji || '🏅'}</Text>
                    <Text style={[styles.badgeTextGray, isDark && { color: '#e5e7eb' }]}>
                      {b.name}{b.badge_level ? ` · ${String(b.badge_level).charAt(0).toUpperCase()}${String(b.badge_level).slice(1)}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {!isOwnPassport && (
              <Text style={[styles.profileAccessHint, isDark && { color: '#94a3b8' }]}>
                {(accessLevel === 'l1' || accessLevel === 'l2')
                  ? `Baglanti duzeyi: ${accessLevel.toUpperCase()} (${sharedRitualCount} ortak Ritual)`
                  : 'Baglanti duzeyi: Yabanci (sinirli gorunum)'}
              </Text>
            )}
            <Text style={[styles.rsScoreLine, isDark && { color: '#fbbf24' }]}>
              RS Score {canSeeExactRS && rsDisplay != null ? rsDisplay : '•••'}
            </Text>
            {isOwnPassport && profile?.regular_vitrine_visible && myRegularStatus?.is_regular ? (
              <TouchableOpacity onPress={() => navigation.navigate('MyRegulars')} activeOpacity={0.85}>
                <Text style={{ marginTop: 6, fontSize: 13, fontWeight: '700', color: isDark ? '#fbbf24' : '#b45309' }}>
                  Regular · {myRegularStatus.pair_count || myRegularStatus.count || 0} mekân (vitrin)
                </Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.actionRow}>
              {!isOwnPassport ? (
                <TouchableOpacity style={styles.actBtnPrimary} onPress={handleMessage}>
                  <Text style={styles.actBtnPrimaryText}>Mesaj</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.actBtnNavy} onPress={() => navigation.navigate('CreateRitual')}>
                <Text style={styles.actBtnNavyText}>{isOwnPassport ? t('create_ritual') : 'Rituale Davet Et'}</Text>
              </TouchableOpacity>
              {!isOwnPassport ? (
                <TouchableOpacity
                  style={[styles.actBtnOutline, isDark && styles.actBtnOutlineDark]}
                  onPress={() => setShowReportModal(true)}
                >
                  <Text style={[styles.actBtnOutlineText, isDark && styles.actBtnOutlineTextDark]}>Sikayet</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isOwnPassport && mySanctions.length > 0 ? (
              <View style={{ marginTop: 14, width: '100%', paddingHorizontal: 8 }}>
                <Text style={[styles.profileAccessHint, isDark && { color: '#94a3b8' }]}>
                  Aktif yaptırımlar
                </Text>
                {mySanctions.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      marginTop: 8,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: isDark ? '#1f2937' : '#fff7ed',
                      borderWidth: 1,
                      borderColor: isDark ? '#334155' : '#fed7aa',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: isDark ? '#f8fafc' : '#9a3412' }}>
                      {s.kind || s.action_level || 'Yaptırım'}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: isDark ? '#cbd5e1' : '#78716c' }}>
                      {s.ends_at ? `Bitiş: ${new Date(s.ends_at).toLocaleString('tr-TR')}` : 'Süresiz / aktif'}
                    </Text>
                    {s.action_id ? (
                      <TouchableOpacity style={{ marginTop: 8 }} onPress={() => handleAppeal(s)}>
                        <Text style={{ color: '#b45309', fontWeight: '700' }}>Itiraz et</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[styles.statsBar, isDark && styles.statsBarDark]}>
              <View style={styles.statCell}><Text style={[styles.statNum, isDark && styles.statNumDark]}>{friends.length}</Text><Text style={styles.statLabel}>Baglanti</Text></View>
              <View style={styles.statCell}><Text style={[styles.statNum, isDark && styles.statNumDark]}>{Number(profile?.rituals_attended || profile?.ritualsAttended || 0)}</Text><Text style={styles.statLabel}>Ritual</Text></View>
              {(isOwnPassport
                ? profile?.hosted_count_visible
                : profile?.rituals_hosted != null) ? (
                <TouchableOpacity
                  style={styles.statCell}
                  onPress={() => navigation.navigate('HostHistory', { userId: viewedUserId })}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.statNum, isDark && styles.statNumDark]}>
                    {Number(profile?.rituals_hosted || profile?.ritualsHosted || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Hosted</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.statCell}>
                  <Text style={[styles.statNum, isDark && styles.statNumDark]}>—</Text>
                  <Text style={styles.statLabel}>Hosted</Text>
                </View>
              )}
              <TouchableOpacity style={styles.statCell} onPress={() => navigation.navigate('RSTransparency')} activeOpacity={0.85}>
                <Text style={[styles.statNum, styles.statNumNavy]}>{canSeeExactRS && rsDisplay != null ? rsDisplay : '•'}</Text>
                <Text style={styles.statLabel}>RS Skoru</Text>
              </TouchableOpacity>
            </View>
            {/* §14 Social bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutBar}>
              {(isOwnPassport || profile?.friends_list_public) ? (
                <>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'l1' })}
              >
                <Text style={styles.shortcutChipText}>FL1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'l2' })}
              >
                <Text style={styles.shortcutChipText}>FL2</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'l3' })}
              >
                <Text style={styles.shortcutChipText}>FL3</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'non-fl' })}
              >
                <Text style={styles.shortcutChipText}>non-FL</Text>
              </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'venue' })}
              >
                <Text style={styles.shortcutChipText}>Venue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shortcutChip}
                onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'brand' })}
              >
                <Text style={styles.shortcutChipText}>Brand</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.followRow}
                onPress={() => navigation.navigate('FollowingList', { userId: viewedUserId, initialType: 'followers' })}
                activeOpacity={0.85}
              >
                <Text style={[styles.followRowLabel, isDark && { color: '#f8fafc' }]}>Takipçiler</Text>
                <Text style={styles.followRowChevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.followRow}
                onPress={() => navigation.navigate('FollowingList', { userId: viewedUserId, initialType: 'following' })}
                activeOpacity={0.85}
              >
                <Text style={[styles.followRowLabel, isDark && { color: '#f8fafc' }]}>Takip</Text>
                <Text style={styles.followRowChevron}>›</Text>
              </TouchableOpacity>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutBar}>
              {isOwnPassport ? (
              <TouchableOpacity style={styles.shortcutActive} onPress={() => navigation.navigate('DSUserDashboard')}>
                <View style={[styles.shortcutDot, { backgroundColor: '#1B2E4A' }]} />
                <Text style={styles.shortcutActiveText}>DS Paneli →</Text>
              </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.shortcutChip} onPress={() => navigation.navigate('BadgeGallery', { initialTab: 'earned' })}>
                <View style={[styles.shortcutDot, { backgroundColor: '#C8A96A' }]} />
                <Text style={styles.shortcutChipText}>Rozetler</Text>
              </TouchableOpacity>
              {(isOwnPassport || profile?.friends_list_public) ? (
              <TouchableOpacity style={styles.shortcutChip} onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends' })}>
                <View style={[styles.shortcutDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.shortcutChipText}>Baglantilar</Text>
              </TouchableOpacity>
              ) : null}
              {isOwnPassport ? (
                <>
                  <TouchableOpacity style={styles.shortcutChip} onPress={() => navigation.navigate('YourMemories')}>
                    <View style={[styles.shortcutDot, { backgroundColor: '#7C3AED' }]} />
                    <Text style={styles.shortcutChipText}>Anilarim</Text>
                  </TouchableOpacity>
                  {profile?.hosted_count_visible ? (
                    <TouchableOpacity style={styles.shortcutChip} onPress={() => navigation.navigate('HostHistory', { userId: viewedUserId })}>
                      <View style={[styles.shortcutDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.shortcutChipText}>Host Gecmisi</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            {(isOwnPassport || profile?.friends_list_public) ? (
            <View style={[styles.connectionsPanel, isDark && { backgroundColor: '#0b1220', borderColor: '#1f2937' }]}>
              <View style={styles.connectionsHead}>
                <Text style={[styles.connectionsTitle, isDark && { color: '#f8fafc' }]}>Baglantilar</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: 'all' })}
                >
                  <Text style={[styles.connectionsSeeAll, isDark && { color: '#cbd5e1' }]}>Ac</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.connectionsChips}>
                {[
                  { id: 'l1', label: 'L1', key: 'L1' },
                  { id: 'l2', label: 'L2', key: 'L2' },
                  { id: 'l3', label: 'L3', key: 'L3' },
                  { id: 'core', label: 'Core', key: 'CORE' },
                ].map((x) => (
                  <TouchableOpacity
                    key={x.id}
                    style={[styles.connectionChip, isDark && { backgroundColor: '#1f2937', borderColor: '#334155' }]}
                    onPress={() => navigation.navigate('FriendsList', { userId: viewedUserId, initialTab: 'friends', initialLevelTab: x.id })}
                  >
                    <Text style={[styles.connectionChipLabel, isDark && { color: '#e5e7eb' }]}>{x.label}</Text>
                    <Text style={[styles.connectionChipValue, isDark && { color: '#f8fafc' }]}>{connectionCounts[x.key] || 0}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            ) : (
              <View style={[styles.connectionsPanel, isDark && { backgroundColor: '#0b1220', borderColor: '#1f2937' }]}>
                <Text style={[styles.connectionsTitle, isDark && { color: '#f8fafc' }]}>Baglantılar gizli</Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: isDark ? '#94a3b8' : '#64748b' }}>
                  Bu kişinin arkadaş listesi kapalı.
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitleMock, isDark && { color: '#f8fafc' }]}>Vibes</Text>
        <View style={styles.shellPadH}>
          <View style={styles.vibesRowMock}>
            {vibes.map((vibe, index) => (
              <View key={index} style={[styles.vibePillMock, isDark && { backgroundColor: '#1f2937' }]}>
                <Text style={[styles.vibePillMockText, isDark && { color: '#e5e7eb' }]}>{vibe}</Text>
              </View>
            ))}
            {isOwnPassport && (
              <TouchableOpacity style={[styles.addVibePill, isDark && { borderColor: '#374151' }]} onPress={openVibeModal} activeOpacity={0.85}>
                <Text style={[styles.addVibePillText, isDark && { color: '#e5e7eb' }]}>+ Add Vibe</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={[styles.kickerLabel, isDark && { color: '#94a3b8' }]}>TABS</Text>
        <View style={styles.shellPadH}>
          <View style={[styles.segmentTrack, isDark && { backgroundColor: '#1f2937' }]}>
            <TouchableOpacity
              style={[styles.segmentSlot, activeTab === 'quote' && styles.segmentSlotOn]}
              onPress={() => setActiveTab('quote')}
              activeOpacity={0.9}
            >
              <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, activeTab === 'quote' && styles.segmentSlotTextOn]}>Quote</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentSlot, activeTab === 'badge' && styles.segmentSlotOn]}
              onPress={() => setActiveTab('badge')}
              activeOpacity={0.9}
            >
              <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, activeTab === 'badge' && styles.segmentSlotTextOn]}>Badge</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentSlot, activeTab === 'memories' && styles.segmentSlotOn]}
              onPress={() => setActiveTab('memories')}
              activeOpacity={0.9}
            >
              <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, activeTab === 'memories' && styles.segmentSlotTextOn]}>Memories</Text>
            </TouchableOpacity>
            {isOwnPassport ? (
              <TouchableOpacity
                style={[styles.segmentSlot, activeTab === 'rulo' && styles.segmentSlotOn]}
                onPress={async () => {
                  setActiveTab('rulo');
                  await loadRulo();
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, activeTab === 'rulo' && styles.segmentSlotTextOn]}>Rulo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <Text style={[styles.kickerLabel, isDark && { color: '#94a3b8' }]}>
          {activeTab === 'quote'
            ? 'QUOTE'
            : activeTab === 'badge'
              ? 'BADGE'
              : activeTab === 'rulo'
                ? 'RULO'
                : 'MEMORIES'}
        </Text>
        <View style={styles.shellPadH}>
          {activeTab === 'quote' ? (
            <View style={styles.passportListBlock}>
              {(() => {
                const quoteEntries = (isOwnPassport ? passportEntries : []).filter(
                  (e) => (e.entry_type || '') === 'quote' || e.memory_type === 'quote' || e.type === 'quote'
                );
                const quoteMemories = (memories || []).filter(
                  (m) =>
                    m.memory_type === 'quote' ||
                    m.type === 'quote' ||
                    (typeof m.content === 'string' && m.content.startsWith('"') && m.content.endsWith('"'))
                );
                const list = quoteEntries.length > 0 ? quoteEntries : quoteMemories;
                if (passportLoading || memoriesLoading) {
                  return <ActivityIndicator size="small" color={GRAY_TEXT_SEC} style={styles.blockLoader} />;
                }
                if (list.length === 0) {
                  return (
                    <EmptyState
                      icon="format-quote"
                      title="Alıntı yok"
                      message="Window içinde paylaştığın alıntılar burada toplanır."
                      style={styles.listEmptyMock}
                    />
                  );
                }
                return list.map((entry, i) =>
                  entry.entry_type
                    ? renderPassportEntry({ ...entry, entry_type: 'quote' }, i)
                    : renderMemoryCard(entry, recentRituals.find((rr) => rr.id === entry.ritual_id), i)
                );
              })()}
            </View>
          ) : activeTab === 'badge' ? (
            <View style={styles.passportListBlock}>
              {(profile.highlighted_badges || []).length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {profile.highlighted_badges.map((b) => (
                    <View
                      key={b.slug || b.id || b.name}
                      style={[styles.badgeGray, isDark && { backgroundColor: '#1f2937', borderColor: '#334155' }]}
                    >
                      <Text style={styles.badgeIconGray}>{b.icon_emoji || '🏅'}</Text>
                      <Text style={[styles.badgeTextGray, isDark && { color: '#e5e7eb' }]}>
                        {b.name}
                        {b.badge_level
                          ? ` · ${String(b.badge_level).charAt(0).toUpperCase()}${String(b.badge_level).slice(1)}`
                          : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {(() => {
                const badgeEntries = (passportEntries || []).filter((e) => (e.entry_type || '') === 'badge');
                if (passportLoading && isOwnPassport) {
                  return <ActivityIndicator size="small" color={GRAY_TEXT_SEC} style={styles.blockLoader} />;
                }
                if (badgeEntries.length === 0 && !(profile.highlighted_badges || []).length) {
                  return (
                    <EmptyState
                      icon="military-tech"
                      title="Rozet yok"
                      message="Ritualsden kazandığın rozetler burada görünür."
                      style={styles.listEmptyMock}
                    />
                  );
                }
                return (
                  <>
                    {badgeEntries.map((entry, i) => renderPassportEntry(entry, i))}
                    <TouchableOpacity
                      style={{ marginTop: 12, alignSelf: 'flex-start' }}
                      onPress={() => navigation.navigate('BadgeGallery', { initialTab: 'earned' })}
                    >
                      <Text style={{ color: isDark ? '#93c5fd' : '#2563eb', fontWeight: '600', fontSize: 13 }}>
                        Tüm rozetler →
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          ) : activeTab === 'rulo' ? (
            <View style={styles.passportListBlock}>
              {ruloLoading ? (
                <ActivityIndicator size="small" color={GRAY_TEXT_SEC} style={styles.blockLoader} />
              ) : ruloItems.length === 0 ? (
                <EmptyState
                  icon="inventory-2"
                  title="Rulo boş"
                  message="Window içinde çekip Rulo'ya kaydettiğin taslaklar burada."
                  style={styles.listEmptyMock}
                />
              ) : (
                ruloItems.map((item) => (
                  <View key={item.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    <Text style={{ fontWeight: '700', color: isDark ? '#e5e7eb' : '#111', fontSize: 13 }} numberOfLines={1}>
                      {item.stamp_label || 'Damga'}
                    </Text>
                    <Text style={{ fontWeight: '500', color: isDark ? '#cbd5e1' : '#374151', marginTop: 4 }} numberOfLines={2}>
                      {item.content || 'Taslak'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#9a8b78', marginTop: 4 }}>
                      Çekim{' '}
                      {item.captured_at
                        ? new Date(item.captured_at).toLocaleString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </Text>
                    <TouchableOpacity
                      style={{
                        marginTop: 8,
                        alignSelf: 'flex-start',
                        backgroundColor: '#162331',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                      onPress={() => {
                        Alert.alert(
                          'Retro yayın',
                          'Orijinal damga korunur. 24s sonra Pulse\'a düşmez; arşiv + passport + Ritual formuna eklenir.',
                          [
                            { text: 'MASA', onPress: () => publishRuloItem(item.id, 'WINDOW') },
                            { text: 'CEVRE', onPress: () => publishRuloItem(item.id, 'CIRCLE') },
                            { text: 'SEHIR', onPress: () => publishRuloItem(item.id, 'CITY') },
                            { text: 'Vazgeç', style: 'cancel' },
                          ]
                        );
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Yayınla</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.passportListBlock}>
              {(passportLoading && isOwnPassport) || (memoriesLoading && !memoryGrid && !(isOwnPassport && passportEntries.length > 0)) ? (
                <ActivityIndicator size="small" color={GRAY_TEXT_SEC} style={styles.blockLoader} />
              ) : null}
              {isOwnPassport && passportEntries.filter((e) => (e.entry_type || 'memory') === 'memory').length > 0 ? (
                <View style={styles.passportTimelineBlock}>
                  <Text style={[styles.passportTimelineLabel, isDark && { color: '#94a3b8' }]}>
                    Yayınlanan anılar · otomatik duvar
                  </Text>
                  {passportEntries
                    .filter((e) => (e.entry_type || 'memory') === 'memory')
                    .map((entry, i) => renderPassportEntry(entry, i))}
                </View>
              ) : null}
              {memoryGrid ? (
                <View>
                  <View style={styles.memoryGrid3x3}>
                    {(memoryGrid.memories || [])
                      .filter((mem) => mem.memory_type !== 'quote' && mem.type !== 'quote')
                      .slice(0, 9)
                      .map((mem, i) => {
                      const ritualForMem = recentRituals.find((rr) => rr.id === mem.ritual_id);
                      const tileImg =
                        mem?.image_url ||
                        mem?.photo_url ||
                        mem?.content_url ||
                        ritualForMem?.image_url ||
                        ritualForMem?.venue_image_url ||
                        null;
                      const displayUri = tileImg || (ritualForMem ? pulseGridCardImage(ritualForMem, i) : pulseMemoryImage(mem));
                      return (
                        <TouchableOpacity
                          key={mem.id || `mem-${i}`}
                          style={[styles.memoryGridTile, isDark && { backgroundColor: '#1f2937', borderColor: '#374151' }]}
                          onPress={() => navigation.navigate('MemoryDetail', { memory: mem })}
                          activeOpacity={0.85}
                        >
                          <OptimizedImage source={{ uri: displayUri }} style={styles.memoryGridTileImage} />
                          <View style={styles.memoryGridTileOverlay}>
                            <Text style={[styles.memoryGridTileText, isDark && { color: '#e5e7eb' }]}>
                              {mem.stamp_label
                                ? mem.stamp_label
                                : mem.memory_type === 'pulse'
                                  ? 'PULSE'
                                  : 'ANI'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {Array.from({ length: Math.min(memoryGrid.locked_placeholder_count || 0, 9) }).map((_, idx) => (
                      <View
                        key={`locked-${idx}`}
                        style={[
                          styles.memoryGridTile,
                          styles.memoryGridLockedTile,
                          isDark && { backgroundColor: '#111827', borderColor: '#334155' },
                        ]}
                      >
                        <Text style={styles.memoryGridLockedText}>KILITLI</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.memoryGridMeta, isDark && { color: '#94a3b8' }]}>
                    3x3 Anı Izgarası · yükleme yok · otomatik toplam
                  </Text>
                </View>
              ) : memories.filter((m) => m.memory_type !== 'quote' && m.type !== 'quote').length > 0 ? (
                memories
                  .filter((m) => m.memory_type !== 'quote' && m.type !== 'quote')
                  .slice(0, 9)
                  .map((mem, i) =>
                    renderMemoryCard(mem, recentRituals.find((rr) => rr.id === mem.ritual_id), i)
                  )
              ) : isOwnPassport &&
                passportEntries.filter((e) => (e.entry_type || 'memory') === 'memory').length === 0 &&
                !passportLoading ? (
                <EmptyState
                  icon="photo-library"
                  title="Anı yok"
                  message="Yayınlanan foto/video anıları burada otomatik toplanır. Duvara yükleme yok."
                  style={styles.listEmptyMock}
                />
              ) : recentRituals.length === 0 ? (
                <EmptyState
                  icon="photo-library"
                  title="No memories"
                  message="Memories from your rituals appear here."
                  style={styles.listEmptyMock}
                />
              ) : (
                recentRituals.map((r, i) => renderPastMemoryCard(r, i))
              )}
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitleMock, isDark && { color: '#f8fafc' }]}>Takip Edilenler</Text>
        <View style={styles.shellPadH}>
          <View style={[styles.segmentTrack, isDark && { backgroundColor: '#1f2937' }]}>
            <TouchableOpacity
              style={[styles.segmentSlot, followingTab === 'hosts' && styles.segmentSlotOn]}
              onPress={() => setFollowingTab('hosts')}
              activeOpacity={0.9}
            >
              <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, followingTab === 'hosts' && styles.segmentSlotTextOn]}>Hostlar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentSlot, followingTab === 'venues' && styles.segmentSlotOn]}
              onPress={() => setFollowingTab('venues')}
              activeOpacity={0.9}
            >
              <Text style={[styles.segmentSlotText, isDark && { color: '#cbd5e1' }, followingTab === 'venues' && styles.segmentSlotTextOn]}>Mekanlar</Text>
            </TouchableOpacity>
          </View>
        </View>
        {followsLoading ? (
          <ActivityIndicator size="small" color={GRAY_TEXT_SEC} style={styles.blockLoader} />
        ) : followingList.length === 0 ? (
          <Text style={[styles.followingEmptyInline, isDark && { color: '#9ca3af' }]}>
            {followingTab === 'hosts' ? 'Takip edilen host yok' : 'Takip edilen mekan yok'}
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hostsScrollContent}>
            {followingList.map((item, index) => {
              const name = item.name || item.username || 'Unknown';
              const rawRs = item.rs_score != null ? Number(item.rs_score) : null;
              const hostRsDisplay =
                rawRs != null && !Number.isNaN(rawRs)
                  ? rawRs > 20
                    ? Math.round(rawRs)
                    : Math.round(Math.min(10, Math.max(0, rawRs)) * 100)
                  : null;
              const showVerified = followingTab === 'hosts' && (item.is_host_verified || item.is_verified);
              return (
                <View key={item.id || index} style={[styles.hostHorizCard, isDark && { backgroundColor: '#111827' }]}>
                  <View style={styles.hostHorizAvatar}>
                    {item.avatar_url || item.image_url ? (
                      <OptimizedImage
                        source={{ uri: item.avatar_url || item.image_url }}
                        style={styles.hostHorizAvatarImg}
                      />
                    ) : (
                      <View style={styles.hostHorizAvatarPh} />
                    )}
                  </View>
                  <Text style={styles.hostHorizName} numberOfLines={1}>
                    {name}
                  </Text>
                  {followingTab === 'hosts' ? (
                    <View style={styles.hostVerifiedRow}>
                      <MaterialIcons name="verified" size={14} color={GREEN_RS} />
                      <Text style={styles.hostVerifiedText}>
                        {showVerified ? 'Dogrulanmis Host' : 'Host'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.hostVenueHint}>Mekan</Text>
                  )}
                  {hostRsDisplay != null ? (
                    <Text style={styles.hostRsText}>RS: {hostRsDisplay}</Text>
                  ) : (
                    <Text style={styles.hostRsTextMuted}>RS: —</Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
        <TouchableOpacity
          style={styles.textLinkMockWrap}
          onPress={() => navigation.navigate('FollowingList', { userId: viewedUserId })}
        >
          <Text style={[styles.textLinkMockText, isDark && { color: '#cbd5e1' }]}>Tumunu gor</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitleMock, isDark && { color: '#f8fafc' }]}>Interests</Text>
        <View style={styles.shellPadH}>
          {isOwnPassport || accessLevel === 'l1' || accessLevel === 'l2' ? (
            <View style={styles.vibesRowMock}>
              {interests.map((it, i) => (
                <View key={`${it}-${i}`} style={[styles.vibePillMock, isDark && { backgroundColor: '#1f2937' }]}>
                  <Text style={[styles.vibePillMockText, isDark && { color: '#e5e7eb' }]}>{it}</Text>
                </View>
              ))}
              {isOwnPassport && (
                <TouchableOpacity
                  style={[styles.addVibePill, isDark && { borderColor: '#374151', backgroundColor: '#111827' }]}
                  onPress={() => setEditingInterests((e) => !e)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.addVibePillText, isDark && { color: '#e5e7eb' }]}>+ Add Interest</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={[styles.lockedSectionText, isDark && { color: '#94a3b8' }]}>
              Bu alan baglanti duzeyine gore sinirli.
            </Text>
          )}
        </View>
        {editingInterests && isOwnPassport ? (
          <View style={[styles.interestInputRow, styles.shellPadH]}>
            <TextInput
              style={[styles.interestInput, isDark && { backgroundColor: '#111827', borderColor: '#374151', color: '#f8fafc' }]}
              placeholder="New interest"
              placeholderTextColor={GRAY_TEXT_TERT}
              value={newInterest}
              onChangeText={setNewInterest}
              onSubmitEditing={handleAddInterest}
            />
            <TouchableOpacity style={[styles.interestAddBtn, isDark && { backgroundColor: '#374151' }]} onPress={handleAddInterest}>
              <Text style={styles.interestAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal
          visible={vibeModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setVibeModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.vibeModalOverlay}
            activeOpacity={1}
            onPress={() => setVibeModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.vibeModalContent}
              activeOpacity={1}
              onPress={() => {}}
            >
              <View style={styles.vibeModalHeader}>
                <Text style={styles.vibeModalTitle}>Vibe Pills</Text>
                <TouchableOpacity onPress={() => setVibeModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <MaterialIcons name="close" size={24} color={LIGHT_TEXT_PRIMARY} />
                </TouchableOpacity>
              </View>
              <Text style={styles.vibeModalSubtitle}>Your vibes (tap to remove)</Text>
              <View style={styles.vibeModalCurrent}>
                {vibes.map((vibe, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.vibePillChip, getVibePillStyle(vibe)]}
                    onPress={() => handleRemoveVibe(vibe)}
                    disabled={vibeLoading}
                  >
                    <Text style={[styles.vibePillChipText, getVibePillTextStyle(vibe)]}>{vibe}</Text>
                    <MaterialIcons name="close" size={14} color={GRAY_TEXT_SEC} />
                  </TouchableOpacity>
                ))}
                {vibes.length === 0 && (
                  <Text style={styles.vibeModalEmpty}>No vibes yet. Add some below.</Text>
                )}
              </View>
              <Text style={styles.vibeModalSubtitle}>Add a vibe</Text>
              <ScrollView style={styles.vibeModalOptions} nestedScrollEnabled>
                <View style={styles.vibeModalOptionsWrap}>
                  {(vibeOptions.length ? vibeOptions : MOOD_TAGS_40).filter(v => !vibes.includes(v)).map((vibe, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.vibePillOption}
                      onPress={() => handleAddVibe(vibe)}
                      disabled={vibeLoading}
                    >
                      <Text style={styles.vibePillOptionText}>{vibe}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      <View style={[styles.navGray, isDark && { backgroundColor: '#0b1220', borderTopColor: '#1f2937' }]}>
        <TouchableOpacity style={styles.navItemGray} onPress={() => navigation.navigate('Pulse')}>
          <MaterialIcons name="insights" size={24} color={isDark ? '#9ca3af' : GRAY_TEXT_TERT} />
          <Text style={[styles.navLabelGray, isDark && { color: '#9ca3af' }]}>Pulse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemGray} onPress={() => navigation.navigate('Local')}>
          <MaterialIcons name="public" size={24} color={isDark ? '#9ca3af' : GRAY_TEXT_TERT} />
          <Text style={[styles.navLabelGray, isDark && { color: '#9ca3af' }]}>Local</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemGray} onPress={() => navigation.navigate('CityRhythm')}>
          <MaterialIcons name="bar-chart" size={24} color={isDark ? '#9ca3af' : GRAY_TEXT_TERT} />
          <Text style={[styles.navLabelGray, isDark && { color: '#9ca3af' }]}>City Rhythm</Text>
        </TouchableOpacity>
        <View style={[styles.navItemGray, styles.navItemGrayActive]}>
          <MaterialIcons name="badge" size={24} color={isDark ? '#f8fafc' : GRAY_TEXT} />
          <Text style={[styles.navLabelGrayActive, isDark && { color: '#f8fafc' }]}>Social Passport</Text>
        </View>
      </View>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReport}
        reportType="user"
        reportedId={viewedUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAY_CONTENT_BG,
  },
  passportTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  passportTopBarDark: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tbLogoWrap: { flexDirection: 'row', alignItems: 'flex-end' },
  tbLogo: { fontSize: 24, fontFamily: 'Georgia', color: '#000' },
  tbLogoDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#000', marginLeft: 2, marginBottom: 5 },
  tbRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  iconBtnDark: { backgroundColor: '#111827', borderColor: '#334155' },
  coverPhoto: { height: 110, backgroundColor: '#1B2E4A', overflow: 'hidden' },
  coverPhotoImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  coverPhotoDark: { backgroundColor: '#0f172a' },
  coverPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.15, backgroundColor: 'rgba(0,0,0,0.18)' },
  avatarSection: { alignItems: 'center', marginTop: -44, paddingBottom: 12 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3.5,
    borderColor: '#fff',
    overflow: 'hidden',
    backgroundColor: '#8B6B4A',
  },
  avatarInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, color: 'rgba(255,255,255,0.9)', fontFamily: 'Georgia' },
  avatarPivotBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C8A96A',
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPivotBadgeText: { fontSize: 11, color: '#000' },
  moodTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 12 },
  moodTag: { borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#fff' },
  moodTagDark: { borderColor: '#334155', backgroundColor: '#111827' },
  moodTagText: { fontSize: 10, color: '#525252' },
  moodTagTextDark: { color: '#cbd5e1' },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 12 },
  actBtnPrimary: { flex: 1, backgroundColor: '#000', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  actBtnPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actBtnNavy: { flex: 1, backgroundColor: '#1B2E4A', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  actBtnNavyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  actBtnOutline: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  actBtnOutlineDark: { backgroundColor: '#111827', borderColor: '#334155' },
  actBtnOutlineText: { color: '#000', fontSize: 11, fontWeight: '700' },
  actBtnOutlineTextDark: { color: '#e5e7eb' },
  statsBar: { flexDirection: 'row', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 14, marginHorizontal: 18, marginBottom: 12, overflow: 'hidden' },
  statsBarDark: { borderColor: '#334155' },
  statCell: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 20, color: '#000', fontFamily: 'Georgia' },
  statNumDark: { color: '#f8fafc' },
  statNumNavy: { color: '#1B2E4A' },
  statLabel: { fontSize: 8, color: '#a3a3a3', marginTop: 2, textTransform: 'uppercase' },
  shortcutBar: { paddingHorizontal: 18, gap: 8, paddingBottom: 12 },
  shortcutActive: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#1B2E4A', borderRadius: 999, backgroundColor: '#E8EDF4', paddingHorizontal: 12, paddingVertical: 6 },
  shortcutActiveText: { fontSize: 10, color: '#1B2E4A', fontWeight: '600' },
  shortcutChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 120,
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  followRowLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  followRowChevron: { fontSize: 18, color: '#9ca3af', fontWeight: '600', marginLeft: 8 },
  shortcutChipText: { fontSize: 10, color: '#525252', fontWeight: '600' },
  shortcutDot: { width: 6, height: 6, borderRadius: 3 },
  statusBarSpacer: {
    height: 44,
  },
  headerGray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingTop: 4,
    position: 'relative',
  },
  headerBackBtn: {
    position: 'absolute',
    left: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBackText: { fontSize: 24, color: GRAY_TEXT_SEC },
  headerLogoBox: { alignItems: 'center' },
  headerLogoL: { fontSize: 32, fontWeight: '700', lineHeight: 32, color: GRAY_TEXT },
  headerLogoLocal: { fontSize: 11, fontWeight: '500', color: GRAY_TEXT_SEC, letterSpacing: 1.5 },
  headerMenuBtn: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GRAY_PILL_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMenuText: { fontSize: 20, color: GRAY_TEXT_SEC },
  profileHeaderGray: { alignItems: 'center', marginBottom: 20 },
  profileAvatarGray: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d4d4d4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileAvatarImgGray: { width: '100%', height: '100%' },
  profileAvatarEmoji: { fontSize: 48 },
  profileNameGray: { fontSize: 28, fontWeight: '700', marginBottom: 4, color: GRAY_TEXT },
  profileLocationGray: { fontSize: 15, color: GRAY_TEXT_SEC, marginBottom: 12 },
  bioQuote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: GRAY_TEXT_SEC,
    marginBottom: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  profileAccessHint: { fontSize: 12, color: GRAY_TEXT_TERT, marginBottom: 8 },
  profileBadgesGray: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  badgeGray: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_PILL_BG,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 4,
  },
  badgeIconGray: { fontSize: 14 },
  badgeTextGray: { fontSize: 13, fontWeight: '600', color: GRAY_TEXT_SEC },
  profileTagsWrapGray: { marginBottom: 16 },
  profileTagsGray: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  tagGray: { backgroundColor: GRAY_PILL_BG, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 18 },
  tagTextGray: { fontSize: 14, fontWeight: '500', color: GRAY_TEXT_SEC },
  statsBarGray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    ...GRAY_SHADOW,
  },
  statItemGray: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIconGray: { fontSize: 16 },
  statTextGray: { fontSize: 14, color: GRAY_TEXT_SEC },
  statNumberGray: { fontWeight: '700', color: GRAY_TEXT },
  sectionHeaderGray: {
    fontSize: 16,
    fontWeight: '700',
    color: GRAY_TEXT_SEC,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  socialGridGray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  socialCardGray: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 16,
    ...GRAY_SHADOW,
  },
  socialCardTitleGray: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: GRAY_TEXT },
  avatarsRowGray: { flexDirection: 'row', marginBottom: 12, flexWrap: 'wrap' },
  avatarGray: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d4d4d4',
    borderWidth: 2,
    borderColor: GRAY_CARD,
    marginLeft: -8,
    overflow: 'hidden',
  },
  avatarGrayFirst: { marginLeft: 0 },
  avatarImgGray: { width: '100%', height: '100%' },
  avatarPlaceholderGray: { width: '100%', height: '100%', backgroundColor: '#d4d4d4' },
  memoriesGridGray: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  memoryImgGray: { flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: '#d4d4d4', overflow: 'hidden', justifyContent: 'center', padding: 6 },
  memoryImgInnerGray: { width: '100%', height: '100%' },
  memoryPreviewTextGray: { fontSize: 10, color: GRAY_TEXT_SEC, lineHeight: 12 },
  viewAllBtnGray: {
    backgroundColor: GRAY_BTN_PRIMARY,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  viewAllBtnTextGray: { fontSize: 12, fontWeight: '700', color: '#fff' },
  followingCardGray: {
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...GRAY_SHADOW,
  },
  followingTitleGray: { fontSize: 16, fontWeight: '700', color: GRAY_TEXT, marginBottom: 12 },
  followingTabsGray: { flexDirection: 'row', gap: 16, borderBottomWidth: 1, borderBottomColor: GRAY_BORDER, marginBottom: 12 },
  tabGray: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabGrayActive: { borderBottomColor: GRAY_TEXT, fontWeight: '600' },
  tabTextGray: { fontSize: 13, color: GRAY_TEXT_TERT },
  tabTextGrayActive: { color: GRAY_TEXT, fontWeight: '600' },
  followingLoaderGray: { padding: 20 },
  followingEmptyGray: { fontSize: 13, color: GRAY_TEXT_SEC, textAlign: 'center', paddingVertical: 16 },
  followingListGray: { gap: 12 },
  followingItemGray: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  followingAvatarGray: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#d4d4d4', overflow: 'hidden' },
  followingAvatarImgGray: { width: '100%', height: '100%' },
  followingAvatarPlaceholderGray: { width: '100%', height: '100%', backgroundColor: '#d4d4d4' },
  followingInfoGray: { flex: 1 },
  followingNameGray: { fontSize: 14, fontWeight: '600', marginBottom: 2, color: GRAY_TEXT },
  followingBadgeGray: { fontSize: 11, color: GRAY_TEXT_SEC },
  seeAllBtnGray: {
    backgroundColor: GRAY_BTN_PRIMARY,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  seeAllBtnTextGray: { fontSize: 13, fontWeight: '700', color: '#fff' },
  reliabilityGridGray: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  reliabilityCardGray: {
    flex: 1,
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    ...GRAY_SHADOW,
  },
  reliabilityCircleGray: { marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  reliabilityScoreGray: { fontSize: 36, fontWeight: '700', color: GRAY_TEXT },
  reliabilityTitleGray: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: GRAY_TEXT },
  reliabilitySubtitleGray: { fontSize: 11, color: GRAY_TEXT_TERT },
  recentRitualsGray: { marginBottom: 20 },
  ritualItemGray: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...GRAY_SHADOW,
  },
  ritualImgGray: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#d4d4d4', overflow: 'hidden' },
  ritualImgInnerGray: { width: '100%', height: '100%' },
  ritualInfoGray: { flex: 1 },
  ritualNameGray: { fontSize: 14, fontWeight: '700', marginBottom: 2, color: GRAY_TEXT },
  ritualDateGray: { fontSize: 12, color: GRAY_TEXT_TERT },
  ritualIconGray: { fontSize: 18 },
  ritualsLoaderGray: { padding: 24 },
  ritualsEmptyGray: { padding: 16, minHeight: 120 },
  actionButtonsGray: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtnGray: {
    flex: 1,
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...GRAY_SHADOW,
  },
  actionBtnTextGray: { fontSize: 15, fontWeight: '600', color: GRAY_TEXT },
  navGray: {
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
    borderTopColor: GRAY_BORDER,
    backgroundColor: GRAY_CARD,
  },
  navItemGray: { alignItems: 'center', gap: 4 },
  navItemGrayActive: {},
  navIconGray: { fontSize: 24 },
  navLabelGray: { fontSize: 10, fontWeight: '500', color: GRAY_TEXT_TERT },
  navLabelGrayActive: { fontSize: 10, fontWeight: '600', color: GRAY_TEXT },
  scrollContentMock: {
    paddingBottom: 112,
  },
  profileShellCard: {
    marginHorizontal: 16,
    backgroundColor: GRAY_CARD,
    borderRadius: 20,
    paddingBottom: 4,
    marginBottom: 8,
    ...GRAY_SHADOW,
  },
  headerBackIconIos: { marginLeft: 6 },
  headerGearBtn: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBlockMock: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 0 },
  rsScoreLine: {
    fontSize: 17,
    fontWeight: '700',
    color: GREEN_RS,
    marginTop: 6,
    marginBottom: 18,
  },
  rsScoreArrow: { color: GREEN_RS },
  dsButton: {
    marginTop: -6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  dsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickActionPill: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  quickActionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  statsThreeCol: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  connectionsPanel: {
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  connectionsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  connectionsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  connectionsSeeAll: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '700',
  },
  connectionsChips: {
    flexDirection: 'row',
    gap: 6,
  },
  connectionChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    alignItems: 'center',
  },
  connectionChipLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '700',
  },
  connectionChipValue: {
    marginTop: 2,
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
  },
  statCol: { flex: 1, alignItems: 'center' },
  statColNum: { fontSize: 18, fontWeight: '700', color: GRAY_TEXT },
  statColLbl: { fontSize: 12, color: GRAY_TEXT_SEC, marginTop: 2, fontWeight: '500' },
  sectionTitleMock: {
    fontSize: 17,
    fontWeight: '700',
    color: GRAY_TEXT,
    marginBottom: 10,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  lockedSectionText: { fontSize: 13, color: GRAY_TEXT_SEC },
  shellPadH: { paddingHorizontal: 20 },
  kickerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: GRAY_TEXT_TERT,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  vibesRowMock: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  vibePillMock: {
    backgroundColor: GRAY_PILL_BG,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  vibePillMockText: { fontSize: 14, fontWeight: '600', color: GRAY_TEXT },
  addVibePill: {
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  addVibePillText: { fontSize: 14, fontWeight: '600', color: GRAY_TEXT },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: GRAY_PILL_BG,
    borderRadius: 999,
    padding: 4,
  },
  segmentSlot: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  segmentSlotOn: { backgroundColor: GRAY_BTN_PRIMARY },
  segmentSlotText: { fontSize: 14, fontWeight: '600', color: GRAY_TEXT_SEC },
  segmentSlotTextOn: { color: '#fff' },
  passportListBlock: { width: '100%' },
  passportTimelineBlock: {
    marginBottom: 16,
  },
  passportTimelineLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: GRAY_TEXT_TERT,
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  passportEntryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: GRAY_CARD,
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    ...GRAY_SHADOW,
  },
  passportEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: GRAY_PILL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportEntryBody: {
    flex: 1,
    minWidth: 0,
  },
  passportEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  passportEntryType: {
    fontSize: 10,
    fontWeight: '700',
    color: GRAY_TEXT_TERT,
    letterSpacing: 0.5,
  },
  passportEntryDate: {
    fontSize: 11,
    color: GRAY_TEXT_TERT,
  },
  passportEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: GRAY_TEXT,
    marginBottom: 2,
  },
  passportEntryText: {
    fontSize: 13,
    lineHeight: 18,
    color: GRAY_TEXT_SEC,
  },
  passportRitualRow: {
    flexDirection: 'row',
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    ...GRAY_SHADOW,
  },
  passportRitualThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
  },
  passportRitualThumbImg: { width: '100%', height: '100%' },
  passportRitualThumbPh: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  passportRitualBody: { flex: 1, minWidth: 0 },
  passportRitualTitle: { fontSize: 15, fontWeight: '700', color: GRAY_TEXT, marginBottom: 4 },
  passportRitualMeta: { fontSize: 12, color: GRAY_TEXT_TERT, marginBottom: 2 },
  passportRitualVenue: { fontSize: 12, color: GRAY_TEXT_SEC, marginBottom: 6 },
  passportRitualTags: { flexDirection: 'row', flexWrap: 'wrap' },
  passportRitualTag: {
    backgroundColor: GRAY_PILL_BG,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  passportRitualTagText: { fontSize: 11, fontWeight: '600', color: GRAY_TEXT },
  blockLoader: { padding: 24 },
  listEmptyMock: { paddingVertical: 8, minHeight: 100 },
  hostsScrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  hostHorizCard: {
    width: 148,
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    ...GRAY_SHADOW,
    alignItems: 'center',
  },
  hostHorizAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#e5e5e5',
    marginBottom: 8,
  },
  hostHorizAvatarImg: { width: '100%', height: '100%' },
  hostHorizAvatarPh: { flex: 1, backgroundColor: '#ddd' },
  hostHorizName: {
    fontSize: 14,
    fontWeight: '700',
    color: GRAY_TEXT,
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  hostVerifiedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  hostVerifiedText: { fontSize: 11, color: GRAY_TEXT_SEC, fontWeight: '500', marginLeft: 4 },
  hostVenueHint: { fontSize: 11, color: GRAY_TEXT_TERT, marginBottom: 4 },
  hostRsText: { fontSize: 13, fontWeight: '700', color: GREEN_RS },
  hostRsTextMuted: { fontSize: 13, color: GRAY_TEXT_TERT },
  memoryGrid3x3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memoryGridTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memoryGridTileImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },
  memoryGridTileOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  memoryGridTileText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  memoryGridLockedTile: {
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
  },
  memoryGridLockedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
  },
  memoryGridMeta: {
    marginTop: 10,
    fontSize: 12,
    color: '#6b7280',
  },
  followingEmptyInline: {
    fontSize: 13,
    color: GRAY_TEXT_SEC,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  textLinkMockWrap: { paddingHorizontal: 20, paddingVertical: 8, marginBottom: 8 },
  textLinkMockText: { fontSize: 14, fontWeight: '600', color: GRAY_TEXT_SEC },
  interestInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, marginTop: 8 },
  interestInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: GRAY_BORDER,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: GRAY_TEXT,
    backgroundColor: GRAY_CARD,
  },
  interestAddBtn: {
    backgroundColor: GRAY_BTN_PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  interestAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerPas: {
    paddingHorizontal: 24,
  },
  headerRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTime: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    width: 48,
    textAlign: 'center',
  },
  headerSpacer: { flex: 1 },
  headerStatusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 64,
    justifyContent: 'flex-end',
  },
  headerRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIconBtn: { padding: 4 },
  profileSectionCenter: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  avatarRingWrap: {
    padding: 4,
    borderRadius: 9999,
  },
  avatarGradientRing: {
    padding: 4,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  avatarRingInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: LIGHT_BACKGROUND,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: LIGHT_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 36, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  profileNameCenter: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  profileSubtitleCenter: {
    fontSize: 14,
    fontWeight: '500',
    color: LIGHT_TEXT_SECONDARY,
    marginTop: 2,
    textAlign: 'center',
  },
  vibePillsCenter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  vibePillCenter: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vibePillTextCenter: { fontSize: 12, fontWeight: '600' },
  vibePillsTouchable: { marginTop: 8 },
  vibePillsPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderStyle: 'dashed',
  },
  vibePillsPlaceholderText: { fontSize: 13, color: PRIMARY_COLOR, fontWeight: '600' },
  vibeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  vibeModalContent: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  vibeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vibeModalTitle: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  vibeModalSubtitle: { fontSize: 12, color: LIGHT_TEXT_SECONDARY, marginTop: 12, marginBottom: 8 },
  vibeModalCurrent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibePillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  vibePillChipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  vibeModalEmpty: { fontSize: 13, color: LIGHT_TEXT_TERTIARY, fontStyle: 'italic' },
  vibeModalOptions: { maxHeight: 200 },
  vibeModalOptionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  vibePillOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  vibePillOptionText: { fontSize: 13, fontWeight: '500', color: LIGHT_TEXT_PRIMARY },
  statsRowPas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    marginTop: 24,
    marginBottom: 24,
  },
  statsCol: { flex: 1, alignItems: 'center' },
  statsColBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E5E7EB' },
  statsValue: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  statsLabel: { fontSize: 12, color: LIGHT_TEXT_SECONDARY, marginTop: 2, fontWeight: '500' },
  statsViewAllHint: { fontSize: 10, color: PRIMARY_COLOR, marginTop: 2, fontWeight: '600' },
  followingCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 24,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  followingCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  followingCardTitle: { fontSize: 18, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  followingViewAll: { fontSize: 14, fontWeight: '600', color: PRIMARY_COLOR },
  followingTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
  },
  followingTab: { flex: 1, overflow: 'hidden', borderRadius: 999 },
  followingTabActive: {},
  followingTabGradient: {
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  followingTabText: { fontSize: 14, fontWeight: '500', color: '#6B7280', textAlign: 'center', paddingVertical: 6 },
  followingTabTextActive: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  followingLoader: { padding: 20 },
  followingEmpty: { fontSize: 13, color: LIGHT_TEXT_SECONDARY, textAlign: 'center', paddingVertical: 16 },
  followingList: { gap: 20 },
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followingItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  followingAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E5E7EB' },
  followingAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  followingAvatarText: { fontSize: 16, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  followingItemInfo: { flex: 1 },
  followingItemName: { fontSize: 14, fontWeight: '600', color: LIGHT_TEXT_PRIMARY },
  followingItemSubtitle: { fontSize: 10, color: LIGHT_TEXT_SECONDARY, marginTop: 2 },
  followingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  followingBadgeText: { fontSize: 10, fontWeight: 'bold' },
  pastMemoriesSection: { paddingHorizontal: 16, marginBottom: 32 },
  pastMemoriesSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: LIGHT_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  pastMemoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pastMemoryCard: {
    width: '47%',
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 12,
    height: 160,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pastMemoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pastMemoryDate: { fontSize: 10, color: LIGHT_TEXT_SECONDARY, fontWeight: '500' },
  pastMemoryHostAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: LIGHT_CARD },
  pastMemoryHostAvatarPlaceholder: { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  pastMemoryHostInitial: { fontSize: 12, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY },
  pastMemoryBody: { marginTop: 4, marginBottom: 8 },
  pastMemoryTitle: { fontSize: 14, fontWeight: 'bold', color: LIGHT_TEXT_PRIMARY, marginBottom: 2 },
  pastMemoryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pastMemoryLocation: { fontSize: 10, color: LIGHT_TEXT_SECONDARY, flex: 1 },
  pastMemoryIcons: { flexDirection: 'row', gap: 8 },
  pastMemoryIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E08D5B', justifyContent: 'center', alignItems: 'center' },
  pastMemoryIconBoxGray: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  pastMemoriesLoader: { padding: 24 },
  pastMemoriesEmpty: { padding: 16, minHeight: 120 },
  bottomNavPas: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: LIGHT_CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 8,
  },
  bottomNavPasButton: { alignItems: 'center', width: 80 },
  bottomNavPasButtonActive: { alignItems: 'center', width: 96 },
  bottomNavPasLabel: { fontSize: 10, fontWeight: '500', color: LIGHT_TEXT_SECONDARY, marginTop: 4 },
  bottomNavPasLabelActive: { fontSize: 10, fontWeight: 'bold', color: PRIMARY_COLOR, marginTop: 4 },
  bottomNavPasPill: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -64,
    width: 128,
    height: 4,
    borderRadius: 2,
    backgroundColor: LIGHT_TEXT_PRIMARY,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BEIGE_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  backButton: {
    padding: 8,
  },
  moreButton: {
    padding: 8,
  },
  profileSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: LIGHT_BACKGROUND,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    flexShrink: 0,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 8,
  },
  experiencedHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  experiencedHostBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  vibesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statsText: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
    flex: 1,
  },
  statsNumber: {
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
  },
  reliabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reliabilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
  },
  rsGuidanceContainer: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  rsGuidanceText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#E65100',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  avatarContainer: {
    width: 112,
    height: 112,
  },
  braidedBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    padding: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: LIGHT_CARD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  verifiedHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}80`,
    backgroundColor: `${PRIMARY_COLOR}1A`,
  },
  verifiedHostBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reliableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4CAF5080',
    backgroundColor: '#4CAF501A',
  },
  reliableBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vibesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  vibePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: LIGHT_CARD,
  },
  vibePillText: {
    fontSize: 10,
    color: LIGHT_TEXT_PRIMARY,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsText: {
    fontSize: 11,
    color: LIGHT_TEXT_SECONDARY,
  },
  statsNumber: {
    color: LIGHT_TEXT_PRIMARY,
    fontWeight: '600',
  },
  socialSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  socialSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LIGHT_TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  socialCardsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  socialCardLarge: {
    flex: 1,
    backgroundColor: LIGHT_CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 280,
  },
  socialCardTitleLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 6,
  },
  socialCardSubtitleLarge: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 16,
  },
  friendsGridLarge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  friendAvatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: BEIGE_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + '40',
  },
  friendAvatarTextLarge: {
    fontSize: 18,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  socialCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: LIGHT_TEXT_PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  socialCardSubtitle: {
    fontSize: 10,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 12,
  },
  friendsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  friendAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  viewAllButton: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: LIGHT_BLUE,
    borderWidth: 1,
    borderColor: BLUE_ACCENT + '40',
    alignItems: 'center',
  },
  viewAllButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: BLUE_ACCENT,
  },
  viewAllButtonGold: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR + '15',
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
    marginTop: 'auto',
  },
  viewAllButtonTextGold: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  seeAllButtonGold: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR + '15',
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
    marginTop: 'auto',
  },
  seeAllButtonTextGold: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  followingTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  followingTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  followingTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  followingTabText: {
    fontSize: 10,
    color: LIGHT_TEXT_TERTIARY,
  },
  followingTabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  followingList: {
    maxHeight: 120,
    marginBottom: 12,
  },
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  followingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  followingAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  followingInfo: {
    flex: 1,
  },
  followingName: {
    fontSize: 11,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 2,
  },
  followingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  followingBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  followingBadgeIcon: {
    fontSize: 10,
    color: PRIMARY_COLOR,
  },
  memoriesSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  memoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memoriesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LIGHT_TEXT_PRIMARY,
  },
  memoriesViewAll: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  memoriesHorizontal: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  memoryThumbnail: {
    width: 100,
    height: 100,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  memoryThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: BEIGE_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  seeAllButton: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: `${PRIMARY_COLOR}1A`,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}4D`,
    alignItems: 'center',
  },
  seeAllButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  memoriesPreview: {
    marginBottom: 12,
  },
  memoryPreviewItem: {
    width: '100%',
    height: 40,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  memoryPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: LIGHT_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rsSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  rsCardsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  rsCardLarge: {
    flex: 1,
    backgroundColor: LIGHT_CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    minHeight: 200,
  },
  rsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginTop: 12,
    textAlign: 'center',
  },
  rsCardSubtitle: {
    fontSize: 11,
    color: LIGHT_TEXT_SECONDARY,
    marginTop: 4,
    textAlign: 'center',
  },
  rsContent: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
  },
  rsProgressContainer: {
    alignItems: 'center',
    gap: 8,
  },
  rsPercentText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
  },
  rsDescription: {
    flex: 1,
    gap: 4,
  },
  rsDescriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
  },
  rsDescriptionText: {
    fontSize: 11,
    color: LIGHT_TEXT_SECONDARY,
  },
  rsTransparencyButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  rsTransparencyButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3b82f6',
  },
  recentRitualsSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: BEIGE_BACKGROUND,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
  },
  recentRitualsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 12,
  },
  ritualsCardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  ritualCardSmall: {
    width: 140,
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ritualCardSmallImage: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: BEIGE_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ritualCardSmallTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 4,
  },
  ritualCardSmallDate: {
    fontSize: 10,
    color: LIGHT_TEXT_SECONDARY,
  },
  accountManagement: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  accountButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: LIGHT_CARD,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  accountButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
  },
  accountButtonGold: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: LIGHT_CARD,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  accountButtonTextGold: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: LIGHT_TEXT_TERTIARY,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  contentWrapper: {
    paddingHorizontal: 16,
    gap: 16,
  },
  ritualCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ritualCardContent: {
    flexDirection: 'row',
    gap: 16,
  },
  ritualImageContainer: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  ritualImage: {
    width: '100%',
    height: '100%',
  },
  ritualImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ritualCardRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  ritualCardTop: {
    gap: 4,
  },
  ritualDate: {
    fontSize: 10,
    color: LIGHT_TEXT_TERTIARY,
  },
  ritualTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  ritualLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ritualLocation: {
    fontSize: 10,
    color: LIGHT_TEXT_SECONDARY,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  verifiedText: {
    fontSize: 10,
    color: ACCENT_AMBER,
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: ACCENT_AMBER,
  },
  ritualCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  ritualVibes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  ritualStats: {
    alignItems: 'flex-end',
  },
  attendanceText: {
    fontSize: 9,
    color: LIGHT_TEXT_TERTIARY,
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#10b981',
  },
  showAllButton: {
    width: '100%',
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${PRIMARY_COLOR}66`,
    backgroundColor: `${PRIMARY_COLOR}0D`,
    alignItems: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 4,
  },
  showAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  memoryCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  memoryDate: {
    fontSize: 11,
    color: LIGHT_TEXT_TERTIARY,
    marginBottom: 4,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 4,
  },
  memoryLocation: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 8,
  },
  memoryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  memoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  memoryTagText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memoryImagesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  memoryImageSquare: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: BEIGE_BACKGROUND,
  },
  memoryImage: {
    width: '100%',
    height: '100%',
  },
  memoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memorySpotifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  memorySpotifyEmoji: { fontSize: 22, marginRight: 10 },
  memorySpotifyCardContent: { flex: 1 },
  memorySpotifyCardTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  memorySpotifyCardSubtitle: { fontSize: 12, color: '#fff', opacity: 0.9 },
  memoryIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memoryIconItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memoryIconText: {
    fontSize: 11,
    color: LIGHT_TEXT_SECONDARY,
    flex: 1,
  },
  memoryText: {
    fontSize: 14,
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 8,
  },
  memoryLink: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  interestsSection: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  interestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  interestsEditBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  interestPillWrap: {
    marginBottom: 0,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  interestPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  interestRemoveBtn: {
    padding: 2,
  },
  interestAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  interestInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: BEIGE_BACKGROUND,
    fontSize: 14,
    color: LIGHT_TEXT_PRIMARY,
  },
  interestAddBtn: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestAddBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  interestAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  interestAddBtnTextDisabled: {
    color: LIGHT_TEXT_TERTIARY,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: LIGHT_BLUE,
    borderWidth: 1,
    borderColor: BLUE_ACCENT + '40',
  },
  interestChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: BLUE_ACCENT,
  },
  removeInterestButton: {
    marginLeft: 6,
    padding: 2,
  },
  addInterestContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addInterestInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: BEIGE_BACKGROUND,
    fontSize: 14,
    color: LIGHT_TEXT_PRIMARY,
  },
  addInterestButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addInterestButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  interestsLoader: {
    padding: 20,
  },
  yourMemoriesPreviewSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  yourMemoriesPreviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 12,
  },
  yourMemoriesPreviewCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  yourMemoriesPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  yourMemoriesPreviewItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  yourMemoriesPreviewContent: {
    flex: 1,
  },
  yourMemoriesPreviewText: {
    fontSize: 14,
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 4,
  },
  yourMemoriesPreviewMeta: {
    fontSize: 12,
    color: LIGHT_TEXT_TERTIARY,
  },
  emptyInterestsText: {
    fontSize: 14,
    color: LIGHT_TEXT_TERTIARY,
    textAlign: 'center',
    paddingVertical: 12,
  },
  bottomNavigation: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  bottomNavButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: LIGHT_CARD,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
  },
  bottomNavButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  loader: {
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    textAlign: 'center',
    padding: 32,
    fontStyle: 'italic',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    padding: 16,
  },
});
