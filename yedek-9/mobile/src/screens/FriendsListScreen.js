import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchFriends, getFollows, fetchMyRegulars, removeFriend, fetchPendingRequests, acceptFriendRequest, declineFriendRequest, createLocationShare, createModReport } from '../services/api';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import QRBumpSheet from '../components/QRBumpSheet';
import ReportModal from '../components/ReportModal';
import { formatRsLabel } from '../utils/rsVisibility';

const PRIMARY_COLOR = '#D4AF37'; // Metallic Gold
const LIGHT_BACKGROUND = '#FFFFFF';
const LIGHT_CARD = '#F8F9FA';
const LIGHT_TEXT_PRIMARY = '#000000';
const LIGHT_TEXT_SECONDARY = '#6B7280'; // gray-500
const LIGHT_TEXT_TERTIARY = '#9CA3AF'; // gray-400
const BLUE_ACCENT = '#3B82F6'; // blue-500

export default function FriendsListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const friendsDmEnabled = useConfigStore(
    (s) => s.config?.stubs?.friends_dm?.enabled !== false
  );
  const userId = route.params?.userId || user?.id;
  const sharePassportUserId = route.params?.sharePassportUserId;
  const sharePassportLabel = route.params?.sharePassportLabel || 'Passport';
  const shareLocationMode = route.params?.mode === 'share_location';
  const shareLocationRitualId = route.params?.ritualId || null;
  
  const normalizeTab = (tab) => {
    const q = String(tab || '').toLowerCase();
    if (['all', 'l1', 'l2', 'l3', 'core', 'new', 'common', 'non-fl', 'non_fl', 'nonfl', 'venue', 'brand'].includes(q)) {
      if (q === 'non_fl' || q === 'nonfl') return 'non-fl';
      return q;
    }
    return 'all';
  };
  const initialLevelTab = normalizeTab(route.params?.initialLevelTab || 'all');
  const [activeTab] = useState('friends'); // SP-07 baglantilar sayfasi
  const [levelTab, setLevelTab] = useState(initialLevelTab); // all/l1/l2/l3/core
  const [friends, setFriends] = useState([]);
  const [regularVenues, setRegularVenues] = useState([]);
  const [brandConnections, setBrandConnections] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendsPrivate, setFriendsPrivate] = useState(false);
  const [query, setQuery] = useState('');
  const [showQrBump, setShowQrBump] = useState(false);
  const [reportFriend, setReportFriend] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setFriendsPrivate(false);
      let friendsData = [];
      try {
        friendsData = await fetchFriends(userId, 'accepted');
      } catch (fe) {
        if (fe?.code === 'FRIENDS_LIST_PRIVATE' || fe?.status === 403) {
          setFriendsPrivate(true);
          friendsData = [];
        } else {
          throw fe;
        }
      }
      const followersData = await getFollows(userId, 'followers');

      const transformedFriends = (friendsData || []).map((item) => {
        const friend = item.friend || item.user || {};
        return {
          id: friend.id || item.friend_id || item.user_id,
          friendship_id: item.id,
          name: friend.name || 'Unknown',
          city: friend.city,
          university: friend.university,
          rs_score: friend.rs_score ?? null,
          friend_level: item.friendship_level || item.friend_level || friend.friendship_level || friend.friend_level || null,
        };
      });
      setFriends(transformedFriends);

      try {
        const regs = await fetchMyRegulars();
        setRegularVenues(
          (regs || []).map((r) => ({
            id: r.venue_id || r.id,
            friendship_id: r.venue_id || r.id,
            name: r.venue_name || r.name || 'Mekan',
            city: r.city,
            university: null,
            rs_score: null,
            friend_level: null,
            connection_kind: 'venue',
            venue_id: r.venue_id || r.id,
          }))
        );
      } catch {
        setRegularVenues([]);
      }

      try {
        const followingData = await getFollows(userId, 'following');
        const brandsList = (followingData || [])
          .filter((item) => item.role === 'brand' || item.brand_id || item.user?.brand_id)
          .map((item) => {
            const u = item.user || {};
            const brandId = item.brand_id || u.brand_id;
            return {
              id: u.id || item.user_id || brandId,
              friendship_id: item.id,
              name: u.name || item.venue_name || 'Brand',
              city: u.city,
              university: null,
              rs_score: null,
              friend_level: null,
              connection_kind: 'brand',
              brand_id: brandId,
            };
          });
        setBrandConnections(brandsList);
        const followedVenues = (followingData || [])
          .filter((item) => item.role === 'venue')
          .map((item) => {
            const u = item.user || {};
            return {
              id: u.id || item.user_id || item.venue_id,
              friendship_id: item.id,
              name: u.name || item.venue_name || 'Mekan',
              city: u.city,
              university: null,
              rs_score: null,
              friend_level: null,
              connection_kind: 'venue',
              venue_id: item.venue_id || u.id,
            };
          });
        if (followedVenues.length) {
          setRegularVenues((prev) => {
            const seen = new Set(prev.map((v) => String(v.id)));
            return [...prev, ...followedVenues.filter((v) => !seen.has(String(v.id)))];
          });
        }
      } catch {
        setBrandConnections([]);
      }

      const transformedFollowers = (followersData || []).map((item) => {
        const followUser = item.user || item.follower || {};
        return {
          id: followUser.id || item.follower_id || item.user_id,
          name: followUser.name || 'Unknown',
          city: followUser.city,
          university: followUser.university,
          rs_score: followUser.rs_score || 5.0,
          friend_level: item.friend_level || followUser.friend_level || null,
        };
      });
      setFollowers(transformedFollowers);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRemoveFriend = async (friend) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use friendship_id for removal
              const friendshipId = friend.friendship_id || friend.id;
              await removeFriend(friendshipId, userId);
              // Reload data
              loadData();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend. Please try again.');
            }
          },
        },
      ]
    );
  };

  const openConversation = (friend) => {
    const friendUserId = friend?.id || friend?.friend?.id || friend?.friend_id;
    const userName = friend?.name || friend?.friend?.name || friend?.friend_name || 'Arkadas';
    if (!friendUserId) return;
    if (sharePassportUserId) {
      navigation.navigate('Conversation', {
        userId: friendUserId,
        userName,
        objectType: 'passport',
        objectId: sharePassportUserId,
        objectLabel: sharePassportLabel,
      });
      return;
    }
    // F1.5: karşılıklı arkadaşlarla düz metin DM açık; kapalıysa Share-2-Person'a düşer.
    if (friendsDmEnabled) {
      navigation.navigate('FriendsDm', { friendId: friendUserId, friendName: userName });
      return;
    }
    navigation.navigate('Conversation', { userId: friendUserId, userName });
  };

  const handleFriendPress = async (friend) => {
    if (shareLocationMode) {
      const fl = String(friend.friend_level || '').toLowerCase();
      if (!['l1', 'l2', 'l3'].includes(fl)) {
        Alert.alert('Konum paylaş', 'Yalnız FL1–FL3 arkadaşlarla paylaşabilirsin.');
        return;
      }
      try {
        await createLocationShare({ friendId: friend.id, ritualId: shareLocationRitualId });
        Alert.alert('Paylaşıldı', `${friend.name} ile ~1 saat canlı konum paylaşımı başladı.`);
        navigation.goBack();
      } catch (e) {
        Alert.alert('Hata', e?.message || 'Konum paylaşılamadı');
      }
      return;
    }
    if (sharePassportUserId) {
      openConversation(friend);
      return;
    }
    if (friend?.connection_kind === 'venue' || friend?.venue_id) {
      navigation.navigate('VenueDetail', { venueId: friend.venue_id || friend.id });
      return;
    }
    if (friend?.connection_kind === 'brand' || friend?.brand_id) {
      navigation.navigate('BrandProfile', { brandId: friend.brand_id || friend.id });
      return;
    }
    const friendUserId = friend?.id || friend?.friend?.id || friend?.friend_id;
    if (friendUserId) {
      navigation.navigate('ParticipantProfile', { userId: friendUserId });
    }
  };

  const handleAcceptPending = async (person) => {
    const friendshipId = person.friendship_id || person.id;
    if (!friendshipId) return;
    try {
      await acceptFriendRequest(friendshipId);
      Alert.alert('Kabul edildi', `${person.name} ile baglanti kuruldu.`);
      loadData();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Istek kabul edilemedi');
    }
  };

  const handleDeclinePending = async (person) => {
    const friendshipId = person.friendship_id || person.id;
    if (!friendshipId) return;
    try {
      await declineFriendRequest(friendshipId);
      Alert.alert('Reddedildi', `${person.name} istegi reddedildi.`);
      loadData();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Istek reddedilemedi');
    }
  };

  const baseData =
    levelTab === 'venue' ? regularVenues : levelTab === 'brand' ? brandConnections : friends;
  const sortedForNew = [...baseData].sort((a, b) => {
    const aNum = Number(a.friendship_id ?? a.id ?? 0);
    const bNum = Number(b.friendship_id ?? b.id ?? 0);
    return bNum - aNum;
  });
  const newIds = new Set(sortedForNew.slice(0, 6).map((x) => String(x.friendship_id ?? x.id)));

  const currentData = baseData.filter((x) => {
    const rs = Number(x.rs_score || 0);
    const fl = String(x.friend_level || '').toUpperCase();
    const q = query.trim().toLowerCase();
    const searchable = `${x.name || ''} ${x.city || ''} ${x.university || ''}`.toLowerCase();
    if (q && !searchable.includes(q)) return false;
    if (shareLocationMode) {
      return ['L1', 'L2', 'L3'].includes(fl);
    }
    if (levelTab === 'all') return true;
    if (levelTab === 'l1') return fl ? fl === 'L1' : rs >= 4.5 && rs < 6.0;
    if (levelTab === 'l2') return fl ? fl === 'L2' : rs >= 6.0 && rs < 7.5;
    if (levelTab === 'l3') return fl ? fl === 'L3' : rs >= 7.5 && rs < 9.0;
    if (levelTab === 'core') return fl ? fl === 'CORE' : rs >= 9.0;
    if (levelTab === 'non-fl') {
      // FL atanmamış / FL0 — Friends içindeki non-FL sekmesi
      return !['L1', 'L2', 'L3', 'CORE'].includes(fl);
    }
    if (levelTab === 'venue') return true;
    if (levelTab === 'brand') return Boolean(x.connection_kind === 'brand');
    if (levelTab === 'new') return newIds.has(String(x.friendship_id ?? x.id));
    if (levelTab === 'common') return Boolean(x.city || x.university);
    return true;
  });
  const count = currentData.length;
  const counts = {
    all: friends.length,
    l1: friends.filter((x) => (String(x.friend_level || '').toUpperCase() || null) === 'L1' || (!x.friend_level && Number(x.rs_score || 0) >= 4.5 && Number(x.rs_score || 0) < 6.0)).length,
    l2: friends.filter((x) => (String(x.friend_level || '').toUpperCase() || null) === 'L2' || (!x.friend_level && Number(x.rs_score || 0) >= 6.0 && Number(x.rs_score || 0) < 7.5)).length,
    l3: friends.filter((x) => (String(x.friend_level || '').toUpperCase() || null) === 'L3' || (!x.friend_level && Number(x.rs_score || 0) >= 7.5 && Number(x.rs_score || 0) < 9.0)).length,
    core: friends.filter((x) => (String(x.friend_level || '').toUpperCase() || null) === 'CORE' || (!x.friend_level && Number(x.rs_score || 0) >= 9.0)).length,
    'non-fl': friends.filter((x) => !['L1', 'L2', 'L3', 'CORE'].includes(String(x.friend_level || '').toUpperCase())).length,
    venue: regularVenues.length,
    brand: brandConnections.length,
  };

  const renderRow = (item, index, total) => {
    const fl = String(item.friend_level || '').toUpperCase();
    const rs = Number(item.rs_score || 0);
    const level = fl || (rs >= 9 ? 'CORE' : rs >= 7.5 ? 'L3' : rs >= 6 ? 'L2' : 'L1');
    const ringStyle = level === 'CORE' ? styles.ringCore : level === 'L3' ? styles.ringL3 : level === 'L2' ? styles.ringL2 : styles.ringL1;
    const levelBadge = level === 'CORE' ? styles.flCore : level === 'L3' ? styles.flL3 : level === 'L2' ? styles.flL2 : styles.flL1;
    const actionLabel = level === 'L3' || level === 'CORE' ? 'Mesaj' : 'Davet Et';
    const actionStyle = level === 'L3' || level === 'CORE' ? styles.actionMsg : styles.actionInvite;
    return (
      <TouchableOpacity
        key={`${item.id}-${item.friendship_id || index}`}
        style={[
          styles.friendCard,
          index === 0 && styles.friendCardFirst,
          index === total - 1 && styles.friendCardLast,
          total === 1 && styles.friendCardOnly,
        ]}
        onPress={() => handleFriendPress(item)}
      >
        <View style={styles.fcInner}>
          <View style={[styles.avatar, ringStyle]}>
            <Text style={styles.avatarText}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
            <View style={styles.statusDot} />
            <Text style={[styles.flBadge, levelBadge]}>{level}</Text>
          </View>
          <View style={styles.fcInfo}>
            <Text style={styles.fcName}>{item.name}</Text>
            <Text style={styles.fcUni}>{item.university || 'Universite bilgisi yok'}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tagRituals}>🔗 Ortak Ritual</Text>
              {item.city ? <Text style={styles.tagLast}>{item.city}</Text> : null}
            </View>
          </View>
          <View style={styles.fcRight}>
            {formatRsLabel(item.rs_score) ? (
              <Text style={styles.rsPill}>{formatRsLabel(item.rs_score)}</Text>
            ) : null}
            <TouchableOpacity style={[styles.actionBtn, actionStyle]} onPress={() => (actionLabel === 'Mesaj' ? openConversation(item) : null)}>
              <Text style={[styles.actionText, actionLabel === 'Mesaj' ? styles.actionTextMsg : styles.actionTextInvite]}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.removeRow}>
          <TouchableOpacity onPress={() => handleRemoveFriend(item)}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReportFriend(item)} style={{ marginLeft: 16 }}>
            <Text style={[styles.removeText, { color: '#b45309' }]}>Bildir</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const resolveLevel = (item) => {
    const fl = String(item.friend_level || '').toUpperCase();
    const rs = Number(item.rs_score || 0);
    return fl || (rs >= 9 ? 'CORE' : rs >= 7.5 ? 'L3' : rs >= 6 ? 'L2' : 'L1');
  };

  const sectionDefs = [
    { key: 'core', title: 'Cekirdek Daire', level: 'CORE', tone: 'core' },
    { key: 'l3', title: 'L3 Yakin Arkadas', level: 'L3', tone: 'l3' },
    { key: 'l2', title: 'L2 Arkadas', level: 'L2', tone: 'l2' },
    { key: 'l1', title: 'L1 Tanisik', level: 'L1', tone: 'l1' },
  ];

  const sections = levelTab === 'all'
    ? sectionDefs.map((s) => ({ ...s, items: currentData.filter((x) => resolveLevel(x) === s.level) })).filter((s) => s.items.length > 0)
    : [{
        key: levelTab,
        title: levelTab === 'core' ? 'Cekirdek Daire' : `${String(levelTab).toUpperCase()} Baglantilar`,
        tone: levelTab,
        items: currentData,
      }];

  const pendingRequests = followers.slice(0, 2);
  const suggestedConnections = followers
    .filter((x) => !friends.some((f) => String(f.id) === String(x.id)))
    .slice(0, 6);
  const ritualGroups = [
    {
      id: 'coffee',
      icon: '☕',
      name: 'Kahve Severler',
      meta: `${Math.max(3, Math.min(12, friends.length))} kisi · Her Sali 09:00 · Brera`,
      badge: 'Duzenli',
      badgeStyle: 'green',
      members: friends.slice(0, 4),
    },
    {
      id: 'jazz',
      icon: '🎵',
      name: 'Jazz & Muzik Grubu',
      meta: `${Math.max(3, Math.min(12, friends.length + 1))} kisi · Navigli · Aylik`,
      badge: 'Bu hafta',
      badgeStyle: 'amber',
      members: friends.slice(2, 6).length ? friends.slice(2, 6) : friends.slice(0, 4),
    },
    {
      id: 'chess',
      icon: '♟',
      name: 'Satranc & Strateji',
      meta: `${Math.max(3, Math.min(8, friends.length))} kisi · Isola · Cuma aksamlari`,
      badge: 'Duzenli',
      badgeStyle: 'green',
      members: friends.slice(1, 4).length ? friends.slice(1, 4) : friends.slice(0, 3),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 6 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="chevron-left" size={16} color="#1B2E4A" />
          <Text style={styles.backText}>Passport</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Baglantilar</Text>
        <View style={styles.headerActions}>
          {friendsDmEnabled ? (
            <TouchableOpacity style={styles.inviteBtn} onPress={() => navigation.navigate('FriendsDm')}>
              <Text style={styles.inviteBtnText}>Mesajlar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowQrBump(true)}>
            <Text style={styles.inviteBtnText}>QR-Bump</Text>
          </TouchableOpacity>
        </View>
      </View>

      {friendsPrivate ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc' }}>
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            Bu kişinin arkadaş listesi gizli. Takipçi listesi hâlâ görülebilir.
          </Text>
        </View>
      ) : null}

      <View style={styles.statsStrip}>
        {[
          { id: 'all', num: counts.all, label: 'Toplam' },
          { id: 'l1', num: counts.l1, label: 'L1 Tanisik' },
          { id: 'l2', num: counts.l2, label: 'L2 Arkadas' },
          { id: 'l3', num: counts.l3, label: 'L3 Yakin' },
          { id: 'core', num: counts.core, label: 'Cekirdek' },
          { id: 'non-fl', num: counts['non-fl'], label: 'non-FL' },
        ].map((x) => (
          <TouchableOpacity key={x.id} style={[styles.ssCell, levelTab === x.id && styles.ssCellActive]} onPress={() => setLevelTab(x.id)}>
            <Text style={[styles.ssNum, x.id === 'all' && styles.ssNumNavy]}>{x.num}</Text>
            <Text style={[styles.ssLabel, x.id === 'l1' ? styles.ssLabelL1 : x.id === 'l2' ? styles.ssLabelL2 : x.id === 'l3' ? styles.ssLabelL3 : x.id === 'core' ? styles.ssLabelCore : styles.ssLabelAll]}>
              {x.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Baglanti ara..." placeholderTextColor="#a3a3a3" style={styles.searchInput} />
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.levelTabsRow}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.levelTabs}
      >
        {[
          { id: 'all', label: 'Tum' },
          { id: 'l1', label: 'L1' },
          { id: 'l2', label: 'L2' },
          { id: 'l3', label: 'L3' },
          { id: 'core', label: 'Cekirdek' },
          { id: 'non-fl', label: 'non-FL' },
          { id: 'venue', label: 'Venue' },
          { id: 'brand', label: 'Brand' },
          { id: 'new', label: 'Yeni Eklenen' },
          { id: 'common', label: 'Ortak Ritual' },
        ].map((x) => (
          <TouchableOpacity
            key={x.id}
            style={[
              styles.levelTab,
              levelTab === x.id && (
                x.id === 'l1' ? styles.levelTabActiveL1
                : x.id === 'l2' ? styles.levelTabActiveL2
                : x.id === 'l3' ? styles.levelTabActiveL3
                : x.id === 'core' ? styles.levelTabActiveCore
                : styles.levelTabActive
              ),
            ]}
            onPress={() => setLevelTab(x.id)}
          >
            <Text
              style={[
                styles.levelTabText,
                levelTab === x.id && (
                  x.id === 'l1' ? styles.levelTabTextActiveL1
                  : x.id === 'l2' ? styles.levelTabTextActiveL2
                  : x.id === 'l3' ? styles.levelTabTextActiveL3
                  : x.id === 'core' ? styles.levelTabTextActiveCore
                  : styles.levelTabTextActive
                ),
              ]}
            >
              {x.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : count === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="people-outline" size={64} color={LIGHT_TEXT_TERTIARY} />
          <Text style={styles.emptyText}>
            Baglanti bulunamadi
          </Text>
          <Text style={styles.emptySubtext}>
            Ayni Ritualse katilarak yeni baglantilar olusturabilirsin.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          <View style={styles.pendingCard}>
            <View style={styles.pendingHeader}>
              <Text style={styles.phIcon}>⏳</Text>
              <Text style={styles.phLabel}>Bekleyen Istekler</Text>
              <Text style={styles.phCount}>{pendingRequests.length}</Text>
            </View>
            {(pendingRequests.length ? pendingRequests : [{ name: 'Yeni istek yok', university: 'Su anda bekleyen istek bulunmuyor', rs_score: 0, id: 'none' }]).map((person, idx) => (
              <View key={`${person.id ?? 'pending'}-${idx}`} style={[styles.pendingRow, idx === pendingRequests.length - 1 && pendingRequests.length > 0 ? styles.pendingRowLast : null]}>
                <View style={styles.prAvatar}>
                  <Text style={styles.prAvatarText}>{(person.name || '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.prInfo}>
                  <Text style={styles.prName}>{person.name}</Text>
                  <Text style={styles.prMeta}>
                    {person.university || person.city || 'Ritual baglantisi'}
                    {formatRsLabel(person.rs_score) ? ` · ${formatRsLabel(person.rs_score)}` : ''}
                  </Text>
                </View>
                {pendingRequests.length > 0 ? (
                  <View style={styles.prBtns}>
                    <TouchableOpacity style={styles.prAccept} onPress={() => handleAcceptPending(person)}>
                      <Text style={styles.prAcceptText}>Kabul</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.prDecline} onPress={() => handleDeclinePending(person)}>
                      <Text style={styles.prDeclineText}>Reddet</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.flExplain}>
            <Text style={styles.feTitle}>Arkadaslik Seviyeleri Nasil Calisir?</Text>
            <View style={styles.feRow}>
              <Text style={[styles.feBadge, styles.feBadgeL1]}>L1</Text>
              <Text style={styles.feText}>Birlikte 1-4 Ritual · Tanisiklik · RS'e yarim agirlik etkisi</Text>
            </View>
            <View style={styles.feRow}>
              <Text style={[styles.feBadge, styles.feBadgeL2]}>L2</Text>
              <Text style={styles.feText}>Birlikte 5-9 Ritual · Arkadaslik · RS'e tam agirlik · Anilari gorursun</Text>
            </View>
            <View style={styles.feRow}>
              <Text style={[styles.feBadge, styles.feBadgeL3]}>L3</Text>
              <Text style={styles.feText}>Birlikte 10+ Ritual · Yakin arkadaslik · Uygulama ici mesaj</Text>
            </View>
            <View style={styles.feRow}>
              <Text style={[styles.feBadge, styles.feBadgeCore]}>Cekirdek</Text>
              <Text style={styles.feText}>Birlikte 20+ Ritual · En guclu bag · Profilde Core Circle rozeti</Text>
            </View>
          </View>
          {sections.map((section) => (
            <View key={section.key} style={styles.sectionWrap}>
              <View style={styles.sectionLabel}>
                <View style={[styles.slDot, section.tone === 'core' ? styles.slCore : section.tone === 'l3' ? styles.slL3 : section.tone === 'l2' ? styles.slL2 : styles.slL1]} />
                <Text style={[styles.sectionTitle, section.tone === 'core' ? styles.sectionTitleCore : section.tone === 'l3' ? styles.sectionTitleL3 : section.tone === 'l2' ? styles.sectionTitleL2 : styles.sectionTitleL1]}>
                  {section.title}
                </Text>
                <View style={styles.slLine} />
                <Text style={styles.slCount}>{section.items.length}</Text>
              </View>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => renderRow(item, index, section.items.length))}
              </View>
            </View>
          ))}

          <View style={styles.suggestWrap}>
            <View style={styles.suggestHeader}>
              <Text style={styles.shTitle}>Ritual Gruplari</Text>
              <Text style={styles.shSee}>Tumu →</Text>
            </View>
            {ritualGroups.map((group) => (
              <TouchableOpacity key={group.id} style={styles.groupCard}>
                <View style={styles.gcInner}>
                  <View style={styles.gcAvs}>
                    {group.members.slice(0, 3).map((m, idx) => (
                      <View
                        key={`${group.id}-${m.id ?? m.friendship_id ?? m.name ?? 'member'}-${idx}`}
                        style={[styles.gcAv, { marginLeft: idx === 0 ? 0 : -8 }]}
                      >
                        <Text style={styles.gcAvText}>{(m.name || '?').slice(0, 1).toUpperCase()}</Text>
                      </View>
                    ))}
                    <View style={[styles.gcAv, styles.gcPlus, { marginLeft: -8 }]}>
                      <Text style={styles.gcPlusText}>+{Math.max(1, group.members.length)}</Text>
                    </View>
                  </View>
                  <View style={styles.gcInfo}>
                    <Text style={styles.gcName}>{group.icon} {group.name}</Text>
                    <Text style={styles.gcMeta}>{group.meta}</Text>
                  </View>
                  <View style={styles.gcRight}>
                    <Text style={[styles.gcBadge, group.badgeStyle === 'amber' ? styles.gcBadgeAmber : styles.gcBadgeGreen]}>
                      {group.badge}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.suggestWrap}>
            <View style={styles.suggestHeader}>
              <Text style={styles.shTitle}>Seni Taniyabilirler</Text>
              <Text style={styles.shSee}>Tumu →</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestScroll}>
              {suggestedConnections.map((person, idx) => (
                <TouchableOpacity key={`${person.id ?? 'suggest'}-${idx}`} style={styles.suggestCard} onPress={() => handleFriendPress(person)}>
                  <View style={styles.scAvatar}>
                    <Text style={styles.scAvatarText}>{(person.name || '?').slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.scName} numberOfLines={1}>{person.name}</Text>
                  <Text style={styles.scReason} numberOfLines={2}>
                    {person.university || person.city || 'Ortak Ritual baglantisi'}
                  </Text>
                  <TouchableOpacity style={styles.scBtn}>
                    <Text style={styles.scBtnText}>+ Baglan</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}
      <QRBumpSheet visible={showQrBump} onClose={() => setShowQrBump(false)} />
      <ReportModal
        visible={Boolean(reportFriend)}
        onClose={() => setReportFriend(null)}
        reportType="friend"
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: 'friend',
              targetId: reportFriend?.id,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', 'Arkadaş raporu kuyruğa alındı');
            setReportFriend(null);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backButton: { paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 13, color: '#1B2E4A', fontWeight: '600' },
  headerTitle: { fontSize: 18, color: '#000', fontFamily: 'serif' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inviteBtn: { backgroundColor: '#E8EDF4', borderWidth: 1, borderColor: '#E8EDF4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  inviteBtnText: { fontSize: 11, color: '#1B2E4A', fontWeight: '700' },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
    marginBottom: 14,
  },
  ssCell: { flex: 1, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRightWidth: 1, borderRightColor: '#e5e5e5' },
  ssCellActive: { backgroundColor: '#F2F5F9' },
  ssNum: { fontSize: 22, lineHeight: 22, color: '#000', fontFamily: 'serif', marginBottom: 3 },
  ssNumNavy: { color: '#1B2E4A' },
  ssLabel: { fontSize: 8, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  ssLabelAll: { color: '#737373', backgroundColor: '#F5F5F5' },
  ssLabelL1: { color: '#27500A', backgroundColor: '#EAF3DE' },
  ssLabelL2: { color: '#92400E', backgroundColor: '#FEF3C7' },
  ssLabelL3: { color: '#1B2E4A', backgroundColor: '#E8EDF4' },
  ssLabelCore: { color: '#fff', backgroundColor: '#1B2E4A' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  searchIcon: { marginRight: 8, color: '#a3a3a3', fontSize: 14 },
  searchInput: { flex: 1, fontSize: 13, color: '#525252', padding: 0 },
  levelTabsRow: { maxHeight: 38, flexGrow: 0 },
  levelTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    alignItems: 'center',
  },
  levelTab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    alignSelf: 'flex-start',
  },
  levelTabActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  levelTabActiveL1: { backgroundColor: '#EAF3DE', borderColor: 'rgba(22,163,74,.3)' },
  levelTabActiveL2: { backgroundColor: '#FEF3C7', borderColor: 'rgba(217,119,6,.3)' },
  levelTabActiveL3: { backgroundColor: '#E8EDF4', borderColor: 'rgba(27,46,74,.2)' },
  levelTabActiveCore: { backgroundColor: '#1B2E4A', borderColor: '#1B2E4A' },
  levelTabText: { color: '#737373', fontSize: 11, fontWeight: '600' },
  levelTabTextActive: { color: '#fff' },
  levelTabTextActiveL1: { color: '#27500A' },
  levelTabTextActiveL2: { color: '#92400E' },
  levelTabTextActiveL3: { color: '#1B2E4A' },
  levelTabTextActiveCore: { color: '#fff' },
  listContent: { paddingBottom: 20 },
  pendingCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#FEF3C7',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  pendingHeader: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  phIcon: { fontSize: 14 },
  phLabel: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  phCount: {
    marginLeft: 'auto',
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#D97706',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FEF3C7',
  },
  pendingRowLast: { borderBottomWidth: 0 },
  prAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  prInfo: { flex: 1, minWidth: 0 },
  prName: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 2 },
  prMeta: { fontSize: 10, color: '#737373' },
  prBtns: { flexDirection: 'row', gap: 5 },
  prAccept: { backgroundColor: '#16A34A', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9 },
  prDecline: { backgroundColor: '#F3F4F6', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  prAcceptText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  prDeclineText: { color: '#737373', fontSize: 11, fontWeight: '700' },
  flExplain: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: '#F2F5F9', borderWidth: 1, borderColor: '#E8EDF4', padding: 12 },
  feTitle: { fontSize: 10, fontWeight: '700', color: '#1B2E4A', marginBottom: 6 },
  feRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  feBadge: { fontSize: 8, fontWeight: '700', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  feBadgeL1: { backgroundColor: '#16A34A', color: '#fff' },
  feBadgeL2: { backgroundColor: '#D97706', color: '#fff' },
  feBadgeL3: { backgroundColor: '#1B2E4A', color: '#fff' },
  feBadgeCore: { backgroundColor: '#C8A96A', color: '#000' },
  feText: { fontSize: 10, color: '#2A4470', lineHeight: 14, flex: 1 },
  sectionWrap: { marginBottom: 6 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, gap: 8 },
  slDot: { width: 8, height: 8, borderRadius: 4 },
  slL1: { backgroundColor: '#16A34A' },
  slL2: { backgroundColor: '#D97706' },
  slL3: { backgroundColor: '#1B2E4A' },
  slCore: { backgroundColor: '#C8A96A' },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  sectionTitleL1: { color: '#16A34A' },
  sectionTitleL2: { color: '#D97706' },
  sectionTitleL3: { color: '#1B2E4A' },
  sectionTitleCore: { color: '#C8A96A' },
  slLine: { flex: 1, height: 1, backgroundColor: '#E5E5E5' },
  slCount: { fontSize: 10, color: '#d4d4d4', fontWeight: '600' },
  sectionCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#fff' },
  suggestWrap: { marginBottom: 10 },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  shTitle: { fontSize: 16, color: '#000', fontFamily: 'serif' },
  shSee: { fontSize: 10, color: '#1B2E4A', fontWeight: '600' },
  suggestScroll: { paddingHorizontal: 16, paddingBottom: 4, gap: 9 },
  suggestCard: {
    width: 130,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  scName: { fontSize: 12, fontWeight: '600', color: '#000', marginBottom: 2 },
  scReason: { fontSize: 9, color: '#737373', lineHeight: 12.5, textAlign: 'center', marginBottom: 8 },
  scBtn: { width: '100%', backgroundColor: '#000', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  scBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  gcInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  gcAvs: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  gcAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B2E4A',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcAvText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  gcPlus: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  gcPlusText: { color: '#737373', fontSize: 10, fontWeight: '700' },
  gcInfo: { flex: 1, minWidth: 0 },
  gcName: { fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 2 },
  gcMeta: { fontSize: 10, color: '#737373' },
  gcRight: { marginLeft: 8 },
  gcBadge: { fontSize: 9, fontWeight: '700', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  gcBadgeGreen: { backgroundColor: '#DCFCE7', color: '#15803D' },
  gcBadgeAmber: { backgroundColor: '#FEF3C7', color: '#92400E' },
  friendCard: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  friendCardFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  friendCardLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderBottomWidth: 0 },
  friendCardOnly: { borderRadius: 14, borderBottomWidth: 0 },
  fcInner: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', position: 'relative', borderWidth: 2 },
  ringL1: { borderColor: 'rgba(22,163,74,.3)' },
  ringL2: { borderColor: 'rgba(217,119,6,.35)' },
  ringL3: { borderColor: 'rgba(27,46,74,.4)' },
  ringCore: { borderColor: '#C8A96A' },
  avatarText: { fontSize: 18, color: '#525252' },
  statusDot: { position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', backgroundColor: '#16A34A' },
  flBadge: { position: 'absolute', left: '50%', transform: [{ translateX: -14 }], bottom: -4, fontSize: 7, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, borderWidth: 1.5, borderColor: '#fff' },
  flL1: { backgroundColor: '#16A34A', color: '#fff' },
  flL2: { backgroundColor: '#D97706', color: '#fff' },
  flL3: { backgroundColor: '#1B2E4A', color: '#fff' },
  flCore: { backgroundColor: '#C8A96A', color: '#000' },
  fcInfo: { flex: 1, minWidth: 0 },
  fcName: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 2 },
  fcUni: { fontSize: 10, color: '#a3a3a3', marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: 4 },
  tagRituals: { fontSize: 8, fontWeight: '600', backgroundColor: '#E8EDF4', color: '#1B2E4A', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  tagLast: { fontSize: 8, fontWeight: '600', backgroundColor: '#F5F5F5', color: '#737373', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  fcRight: { alignItems: 'flex-end', gap: 5 },
  rsPill: { fontSize: 10, fontWeight: '700', backgroundColor: '#E8EDF4', color: '#1B2E4A', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  actionMsg: { backgroundColor: '#1B2E4A' },
  actionInvite: { backgroundColor: '#E8EDF4' },
  actionText: { fontSize: 10, fontWeight: '700' },
  actionTextMsg: { color: '#fff' },
  actionTextInvite: { color: '#1B2E4A' },
  removeRow: { borderTopWidth: 1, borderTopColor: '#f5f5f5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
