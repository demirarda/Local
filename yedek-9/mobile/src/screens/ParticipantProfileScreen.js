import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchParticipantProfile, fetchUserMemoryGrid, sendFriendRequest, followUser, unfollowUser, checkFollowStatus, setUserFollowBell, reportUser, blockUser, removeFriend, muteObject } from '../services/api';
import ReportModal from '../components/ReportModal';
import AddFriendModal from '../components/AddFriendModal';
import FollowBellControls from '../components/FollowBellControls';
import useAuthStore from '../store/authStore';
import { requireVerifiedUser } from '../utils/verificationGuard';

export default function ParticipantProfileScreen({ route, navigation }) {
  const { userId, ritualId, viewerId } = route.params || {};
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [bell, setBell] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followRequested, setFollowRequested] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [muting, setMuting] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendRequestSent, setShowFriendRequestSent] = useState(false);
  const [memoryGrid, setMemoryGrid] = useState(null);
  const { user } = useAuthStore();

  useEffect(() => {
    loadProfile();
  }, [userId, ritualId, viewerId]);

  const loadProfile = async () => {
    if (!userId || !ritualId || !viewerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchParticipantProfile(userId, ritualId, viewerId);
      setProfile(data);
      const gridData = await fetchUserMemoryGrid(userId, viewerId, 12);
      setMemoryGrid(gridData);
      
      // Check follow status
      const followStatus = await checkFollowStatus(viewerId, userId);
      setIsFollowing(Boolean(followStatus?.is_following ?? followStatus));
      setBell(Boolean(followStatus?.bell));
    } catch (error) {
      console.error('Error loading participant profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAddFriend = async () => {
    if (!requireVerifiedUser(user, 'Arkadas eklemek icin universite e-postani dogrula.')) return;
    try {
      setSendingRequest(true);
      await sendFriendRequest(viewerId, userId);
      // Reload profile to update friendship status
      await loadProfile();
      setShowFriendRequestSent(true);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Hata', 'Arkadaslik istegi gonderilemedi');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!requireVerifiedUser(user, 'Arkadaslik istegi islemleri icin universite e-postani dogrula.')) return;
    if (!profile?.pendingFriendshipId) {
      Alert.alert('Arkadaslik Istegi', 'Iptal edilecek bekleyen istek yok.');
      return;
    }
    try {
      setSendingRequest(true);
      await removeFriend(profile.pendingFriendshipId, viewerId);
      await loadProfile();
      setShowFriendRequestSent(false);
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      Alert.alert('Hata', 'Arkadaslik istegi iptal edilemedi');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleFollow = async () => {
    if (!requireVerifiedUser(user, 'Takip etmek icin universite e-postani dogrula.')) return;
    try {
      setFollowing(true);
      const result = await followUser(viewerId, userId, false);
      if (result?.mode === 'request') {
        setFollowRequested(true);
        setIsFollowing(false);
        Alert.alert('Istek gonderildi', result.message || 'Kapali profil — takip istegi onay bekliyor.');
      } else {
        setIsFollowing(true);
        setFollowRequested(false);
        setBell(false);
        Alert.alert('Basarili', 'Takip edilmeye baslandi');
      }
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Hata', error?.message || 'Kullanici takip edilemedi');
    } finally {
      setFollowing(false);
    }
  };

  const handleUnfollow = async () => {
    if (!requireVerifiedUser(user, 'Takipten cikmak icin universite e-postani dogrula.')) return;
    try {
      setFollowing(true);
      await unfollowUser(viewerId, userId);
      setIsFollowing(false);
      setFollowRequested(false);
      setBell(false);
      Alert.alert('Basarili', 'Takipten cikildi');
    } catch (error) {
      console.error('Error unfollowing user:', error);
      Alert.alert('Hata', 'Takipten cikilamadi');
    } finally {
      setFollowing(false);
    }
  };

  const handleToggleBell = async () => {
    if (!isFollowing || bellLoading) return;
    setBellLoading(true);
    try {
      await setUserFollowBell(userId, !bell);
      setBell(!bell);
    } catch (error) {
      Alert.alert('Hata', error?.message || 'Zil guncellenemedi');
    } finally {
      setBellLoading(false);
    }
  };

  const handleReport = async (reportData) => {
    if (!requireVerifiedUser(user, 'Rapor gondermek icin universite e-postani dogrula.')) return;
    try {
      await reportUser(viewerId, userId, reportData.reason, reportData.description);
      Alert.alert('Basarili', 'Rapor basariyla gonderildi');
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert('Hata', 'Rapor gonderilemedi');
    }
  };

  const handleBlock = async () => {
    if (!requireVerifiedUser(user, 'Engellemek icin universite e-postani dogrula.')) return;
    Alert.alert(
      'Kullaniciyi Engelle',
      'Bu kullaniciyi engellemek istedigine emin misin? Ritualsini ve mesajlarini gormeyeceksin.',
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            try {
              setBlocking(true);
              await blockUser(viewerId, userId);
              Alert.alert('Basarili', 'Kullanici engellendi', [
                { text: 'Tamam', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Hata', 'Kullanici engellenemedi');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  const handleMute = async () => {
    if (!requireVerifiedUser(user, 'Sessize almak icin universite e-postani dogrula.')) return;
    Alert.alert(
      'Sessize al',
      'Bu kullaniciyi sessize almak istiyor musun? Block kadar sert degil; feed/Pulse gurultusu azalir.',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Sessize al',
          onPress: async () => {
            try {
              setMuting(true);
              await muteObject({ objectType: 'user', objectId: userId });
              Alert.alert('Tamam', 'Kullanici sessize alindi');
            } catch (error) {
              Alert.alert('Hata', error?.message || 'Sessize alinamadi');
            } finally {
              setMuting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Katilimci Profili</Text>
        <Text style={styles.errorText}>Profil bulunamadi</Text>
      </View>
    );
  }

  if (profile.closed_profile || profile.minimal_card) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color="#4b2600" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kapali Profil</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 }}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 88, height: 88, borderRadius: 44, marginBottom: 16 }} />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#e5e5e5', marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32, fontWeight: '700' }}>{(profile.name || '?')[0]}</Text>
            </View>
          )}
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#111' }}>{profile.name || 'Kullanici'}</Text>
          {profile.username ? (
            <Text style={{ fontSize: 15, color: '#666', marginTop: 4 }}>@{profile.username}</Text>
          ) : null}
          <Text style={{ fontSize: 14, color: '#999', marginTop: 12, textAlign: 'center' }}>
            Bu hesap kapali profil. Detaylar yalniz onayli takipcilere acik.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 24,
              backgroundColor: followRequested ? '#e5e5e5' : '#111',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
              opacity: following ? 0.6 : 1,
            }}
            disabled={following || followRequested}
            onPress={handleFollow}
          >
            {following ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: followRequested ? '#666' : '#fff', fontWeight: '700' }}>
                {followRequested ? 'Istek gonderildi' : 'Takip istegi gonder'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={handleMute} disabled={muting}>
            <Text style={{ color: '#666', fontWeight: '600' }}>{muting ? '…' : 'Sessize al'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={handleBlock} disabled={blocking}>
            <Text style={{ color: '#991b1b', fontWeight: '600' }}>{blocking ? '…' : 'Engelle'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentRitual = profile.currentRitual;
  const connectionLevel = profile.connectionLevel || 'stranger';
  const sharedCount = Array.isArray(profile.pastRitualsTogether) ? profile.pastRitualsTogether.length : 0;
  const flBadgeMap = {
    stranger_same_ritual: { text: 'Yabanci', tone: styles.flBadgeStranger },
    stranger: { text: 'Yabanci', tone: styles.flBadgeStranger },
    l1: { text: `L1 Tanisik — ${sharedCount} ortak Ritual`, tone: styles.flBadgeL1 },
    l2: { text: `L2 Arkadas — ${sharedCount} ortak Ritual`, tone: styles.flBadgeL2 },
    l3: { text: `L3 Yakin — ${sharedCount} ortak Ritual`, tone: styles.flBadgeL3 },
    core: { text: `Cekirdek Daire — ${sharedCount} ortak Ritual`, tone: styles.flBadgeCore },
  };
  const flBadge = flBadgeMap[connectionLevel] || flBadgeMap.l1;

  if (showFriendRequestSent && profile.hasPendingRequest) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.friendSentContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={22} color="#4b2600" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Katilimci Profili</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Success icon */}
        <View style={styles.friendSentIconWrapper}>
          <View style={styles.friendSentIconOuter}>
            <View style={styles.friendSentIconInner}>
              <MaterialIcons name="check" size={40} color="#16a34a" />
            </View>
          </View>
        </View>

        <Text style={styles.friendSentTitle}>Arkadaslik Istegi Gonderildi!</Text>
        <Text style={styles.friendSentSubtitle}>
          Kabul ettiginde bildirim alacaksin.
        </Text>

        {/* Avatar + RS */}
        <View style={styles.friendSentAvatarRow}>
          <View style={styles.friendSentAvatar}>
            <Text style={styles.friendSentAvatarText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.friendSentRsBadge}>
            <Text style={styles.friendSentRsText}>
              {profile.rsExactVisible ? Math.round(profile.rsScore || 5.0) : (profile.rsRounded10 ?? 5)}
            </Text>
          </View>
        </View>

        {currentRitual && (
          <View style={styles.friendSentRitualCard}>
            <Text style={styles.friendSentRitualLabel}>Bu Ritualde:</Text>
            <Text style={styles.friendSentRitualTitle}>{currentRitual.title}</Text>
            <Text style={styles.friendSentRitualMeta}>
              {currentRitual.venue_name} • {currentRitual.time_range}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.friendSentActions}>
          <TouchableOpacity
            style={[styles.friendSentButton, styles.friendSentCancelButton]}
            onPress={handleCancelFriendRequest}
            disabled={sendingRequest}
          >
            {sendingRequest ? (
              <ActivityIndicator color="#4b5563" />
            ) : (
              <Text style={styles.friendSentCancelText}>Istegi Iptal Et</Text>
            )}
          </TouchableOpacity>
          {ritualId ? (
            <TouchableOpacity
              style={[styles.friendSentButton, styles.friendSentPrimaryButton]}
              onPress={() => {
                if (!requireVerifiedUser(user, 'Share-2-Person icin universite e-postani dogrula.')) return;
                navigation.navigate('Conversation', {
                  userId,
                  userName: profile?.name || 'Arkadas',
                });
              }}
            >
              <Text style={styles.friendSentPrimaryText}>Mesaj Gonder</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.ppScrollContent}>
        <View style={styles.ppStatusBar}>
          <Text style={styles.ppStatusTime}>{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={styles.ppStatusIcons}>▲▲▲</Text>
        </View>

        <View style={styles.ppTopBar}>
          <TouchableOpacity style={styles.ppBack} onPress={() => navigation.goBack()}><Text style={styles.ppBackText}>← Ritual Detay</Text></TouchableOpacity>
          <View style={styles.ppTopRight}>
            <TouchableOpacity style={styles.ppIconBtn} onPress={() => setShowReportModal(true)}><Text>⚑</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ppIconBtn}><Text>···</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.ppHero} />
        <View style={styles.ppAvatarArea}>
          <View style={styles.ppAvatarRing}><Text style={styles.ppAvatarInitial}>{(profile.name || '?').charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.ppName}>{profile.name}</Text>
          {profile.show_uni_label && profile.university ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('UniversityProfile', { name: profile.university })}
              activeOpacity={0.85}
            >
              <Text style={styles.ppUni}>🎓 {profile.university}{profile.city ? ` · ${profile.city}` : ''}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.ppUni}>{profile.city || ''}</Text>
          )}
          <View style={[styles.ppFlBadge, flBadge.tone]}><Text style={styles.ppFlBadgeText}>{flBadge.text}</Text></View>
          {currentRitual ? <Text style={styles.ppSharedPill}>🔗 {currentRitual.title}'ta tanistiniz</Text> : null}
        </View>

        <View style={styles.ppActionRow}>
          {!profile.isFriend && !profile.hasPendingRequest ? (
            <TouchableOpacity style={[styles.ppActBtn, styles.ppActNavy]} onPress={() => setShowAddFriendModal(true)}>
              <Text style={styles.ppActTextLight}>Arkadas Ekle</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.ppActBtn, styles.ppActOutline]}><Text style={styles.ppActTextDark}>{profile.hasPendingRequest ? 'Istek Bekliyor' : 'Arkadas'}</Text></View>
          )}
          {profile.isFriend ? (
            <TouchableOpacity
              style={[styles.ppActBtn, styles.ppActNavy]}
              onPress={() => navigation.navigate('Conversation', { userId, userName: profile.name })}
            >
              <Text style={styles.ppActTextLight}>Share-2-Person</Text>
            </TouchableOpacity>
          ) : ritualId ? (
            <TouchableOpacity style={[styles.ppActBtn, styles.ppActOutline]} onPress={() => navigation.navigate('RitualDetail', { ritualId })}>
              <Text style={styles.ppActTextDark}>Rituale Davet</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {(connectionLevel === 'stranger' || connectionLevel === 'stranger_same_ritual' || connectionLevel === 'l1') ? (
          <View style={styles.privacyNotice}>
            <Text style={styles.privacyIcon}>{connectionLevel === 'l1' ? '🔒' : '🚫'}</Text>
            <Text style={styles.privacyText}>
              {connectionLevel === 'l1'
                ? 'L1 gorunumu: RS detaylari ve tum anilar L2 baglantida acilir.'
                : 'Yabanci gorunumu: profil bilgileri kisitlidir.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.ppRsSection}>
          <Text style={styles.ppSectionTitle}>Guvenilirlik Skoru</Text>
          <View style={styles.ppRsHero}>
            <Text style={styles.ppRsNum}>{profile.rsExactVisible ? Number(profile.rsScore || 0).toFixed(1) : (profile.rsRounded10 ?? '•')}</Text>
            <View style={styles.ppRsInfo}>
              <Text style={styles.ppRsLabel}>Guvenilirlik Skoru</Text>
              <Text style={styles.ppRsStatus}>{profile.rsStatus?.label || 'Gorunur'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.ppStatsBar}>
          <View style={styles.ppStatCell}><Text style={styles.ppStatNum}>{profile.ritualsAttended ?? 0}</Text><Text style={styles.ppStatLabel}>Ritual</Text></View>
          <View style={styles.ppStatCell}><Text style={styles.ppStatNum}>{profile.friendsCount != null ? profile.friendsCount : '🔒'}</Text><Text style={styles.ppStatLabel}>Baglanti</Text></View>
          <View style={styles.ppStatCell}><Text style={styles.ppStatNum}>{profile.ritualsHosted ?? 0}</Text><Text style={styles.ppStatLabel}>Host</Text></View>
          <View style={styles.ppStatCell}><Text style={styles.ppStatNum}>{sharedCount}</Text><Text style={styles.ppStatLabel}>Ortak</Text></View>
        </View>

        {!profile.closed_profile && !profile.minimal_card ? (
          <View style={styles.followLinkBlock}>
            <TouchableOpacity
              style={styles.followLinkRow}
              onPress={() => navigation.navigate('FollowingList', { userId, initialType: 'followers' })}
            >
              <Text style={styles.followLinkLabel}>Takipçiler</Text>
              <Text style={styles.followLinkChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.followLinkRow}
              onPress={() => navigation.navigate('FollowingList', { userId, initialType: 'following' })}
            >
              <Text style={styles.followLinkLabel}>Takip</Text>
              <Text style={styles.followLinkChevron}>›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {profile.sharedInterests?.length ? (
          <View style={styles.ppMoodRow}>{profile.sharedInterests.map((i, idx) => <Text key={`${i}-${idx}`} style={styles.ppMoodTag}>{i}</Text>)}</View>
        ) : null}

        {profile.pastRitualsTogether?.length ? (
          <>
            <View style={styles.ppSectionHeader}><Text style={styles.ppSectionTitle}>Birlikte Katildiginiz</Text></View>
            {profile.pastRitualsTogether.slice(0, 4).map((ritual) => (
              <TouchableOpacity key={ritual.id} style={styles.ppSharedRow} onPress={() => navigation.navigate('RitualDetail', { ritualId: ritual.id })}>
                <View style={styles.ppThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ppSharedName} numberOfLines={1}>{ritual.title}</Text>
                  <Text style={styles.ppSharedMeta} numberOfLines={1}>{ritual.venue_name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {memoryGrid ? (
          <>
            <View style={styles.ppSectionHeader}><Text style={styles.ppSectionTitle}>Anilar</Text></View>
            <View style={styles.ppMemGrid}>
              {(memoryGrid.memories || []).slice(0, 6).map((m, idx) => {
                const memImg =
                  m.image_url ||
                  m.photo_url ||
                  m.content_url ||
                  m.ritual_image_url ||
                  m.ritual_photo_url ||
                  (m.ritual_id ? `https://picsum.photos/seed/ritual-${m.ritual_id}/320/320` : null) ||
                  (m.id ? `https://picsum.photos/seed/memory-${m.id}/320/320` : `https://picsum.photos/seed/memory-fallback-${idx}/320/320`);
                return (
                  <View key={m.id || `m-${idx}`} style={styles.ppMemItem}>
                    <Image source={{ uri: memImg }} style={styles.ppMemImage} />
                  </View>
                );
              })}
              {Array.from({ length: Math.min(memoryGrid.locked_placeholder_count || 0, 3) }).map((_, idx) => (
                <View key={`lk-${idx}`} style={[styles.ppMemItem, styles.ppMemLocked]}><Text style={styles.ppMemLock}>🔒</Text></View>
              ))}
            </View>
          </>
        ) : null}

        {profile.friendshipBadgesVisible ? (
          <>
            <View style={styles.ppSectionHeader}><Text style={styles.ppSectionTitle}>Rozetler</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScrollHtml}>
              {(profile.friendshipBadges || []).map((badge) => (
                <View key={badge.key} style={[styles.badgeChipHtml, !badge.earned && styles.badgeChipHtmlLocked]}>
                  <Text style={styles.badgeChipIcon}>{badge.icon || '🏷'}</Text>
                  <View>
                    <Text style={styles.badgeChipName}>{badge.label}</Text>
                    <Text style={styles.badgeChipSub}>{badge.earned ? 'Acik' : 'L2de acilir'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {(connectionLevel === 'l2' || connectionLevel === 'l3' || connectionLevel === 'core') ? (
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>"Muzik konusmadan baglanti kurmanin en kisa yolu."</Text>
            <Text style={styles.quoteFrom}>{profile.name} anilarindan</Text>
          </View>
        ) : null}

        {profile.pastRitualsTogether?.length ? (
          <>
            <View style={styles.ppSectionHeader}><Text style={styles.ppSectionTitle}>Arkadaslik Gecmisi</Text></View>
            <View style={styles.flTimeline}>
              {profile.pastRitualsTogether.slice(0, 3).map((ritual, idx) => (
                <View key={`timeline-${ritual.id || idx}`} style={styles.flEvent}>
                  <View style={[styles.flDot, idx === 0 && styles.flDotGreen, idx === 2 && styles.flDotGold]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flEventLabel}>{ritual.title}</Text>
                    <Text style={styles.flEventSub}>{ritual.venue_name || 'Ritual'}</Text>
                  </View>
                  <Text style={styles.flEventDate}>
                    {ritual.start_time
                      ? new Date(ritual.start_time).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
                      : 'Bugun'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.ppCtaBar}>
        <FollowBellControls
          following={isFollowing}
          bell={bell}
          followLoading={following || followRequested}
          bellLoading={bellLoading}
          onToggleBell={handleToggleBell}
          onToggleFollow={() => {
            if (isFollowing) return handleUnfollow();
            if (followRequested) return;
            return handleFollow();
          }}
          followLabel={followRequested ? 'Istek gonderildi' : 'Takip Et'}
          followingLabel="Takipten Cik"
        />
        <View style={styles.ppCtaRow}>
          <TouchableOpacity style={styles.ppCtaIconBtn} onPress={() => setShowReportModal(true)}><Text>⚑</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ppCtaIconBtn} onPress={handleMute} disabled={muting}><Text>🔕</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ppCtaIconBtn} onPress={handleBlock} disabled={blocking}><Text>🚫</Text></TouchableOpacity>
        </View>
        <Text style={styles.ppCtaHint}>Baglanti duzeyi: {connectionLevel}</Text>
      </View>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReport}
        reportType="user"
        reportedId={userId}
      />

      {/* Add Friend Modal */}
      <AddFriendModal
        visible={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onConfirm={async () => {
          await handleConfirmAddFriend();
          setShowAddFriendModal(false);
        }}
        participantName={profile.name}
        rsScore={profile.rsScore}
        fromRitualTitle={profile.ritualTitle || profile.ritual_title}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  ppScrollContent: { paddingBottom: 120, paddingTop: 48 },
  ppStatusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, height: 44 },
  ppStatusTime: { fontSize: 15, fontWeight: '600', color: '#000' },
  ppStatusIcons: { fontSize: 12, color: '#000' },
  ppTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  ppBack: { paddingVertical: 6, paddingHorizontal: 4 },
  ppBackText: { fontSize: 12, color: '#737373' },
  ppTopRight: { flexDirection: 'row', gap: 8 },
  ppIconBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  ppHero: { width: '100%', height: 100, backgroundColor: '#1B2E4A' },
  ppAvatarArea: { alignItems: 'center', marginTop: -40, paddingBottom: 10 },
  ppAvatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff', backgroundColor: '#8B6345', alignItems: 'center', justifyContent: 'center' },
  ppAvatarInitial: { fontSize: 28, color: '#fff', fontFamily: 'serif' },
  ppName: { fontSize: 20, marginTop: 8, color: '#000', fontFamily: 'serif' },
  ppUni: { fontSize: 11, color: '#a3a3a3', marginBottom: 8 },
  ppFlBadge: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, marginBottom: 10 },
  ppFlBadgeText: { fontSize: 11, fontWeight: '700' },
  flBadgeStranger: { backgroundColor: '#F5F5F5' },
  flBadgeL1: { backgroundColor: '#EAF3DE' },
  flBadgeL2: { backgroundColor: '#FEF3C7' },
  flBadgeL3: { backgroundColor: '#E8EDF4' },
  flBadgeCore: { backgroundColor: '#1B2E4A' },
  ppSharedPill: { backgroundColor: '#F5F5F5', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, fontSize: 10, color: '#525252' },
  ppActionRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 18, paddingBottom: 14 },
  ppActBtn: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  ppActNavy: { backgroundColor: '#1B2E4A' },
  ppActOutline: { borderWidth: 1.5, borderColor: '#e5e5e5', backgroundColor: '#fff' },
  ppActTextLight: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ppActTextDark: { color: '#000', fontSize: 11, fontWeight: '700' },
  privacyNotice: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyIcon: { fontSize: 16 },
  privacyText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
  ppRsSection: { marginHorizontal: 18, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 14, overflow: 'hidden' },
  ppSectionTitle: { fontFamily: 'serif', fontSize: 16, color: '#000', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  ppRsHero: { backgroundColor: '#1B2E4A', flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  ppRsNum: { fontSize: 38, color: '#fff', fontFamily: 'serif', marginRight: 12 },
  ppRsInfo: { flex: 1 },
  ppRsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' },
  ppRsStatus: { fontSize: 12, color: '#fff', fontWeight: '600' },
  ppStatsBar: { flexDirection: 'row', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 14, marginHorizontal: 18, marginBottom: 12, overflow: 'hidden' },
  followLinkBlock: {
    marginHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  followLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  followLinkLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  followLinkChevron: { fontSize: 20, color: '#9ca3af', fontWeight: '600' },
  ppStatCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  ppStatNum: { fontSize: 18, color: '#000', fontFamily: 'serif' },
  ppStatLabel: { fontSize: 8, color: '#a3a3a3', marginTop: 2, textTransform: 'uppercase' },
  ppMoodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18, paddingBottom: 12 },
  ppMoodTag: { fontSize: 10, color: '#525252', borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 },
  ppSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ppSharedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 8 },
  ppThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#1A1A2E' },
  ppSharedName: { fontSize: 13, color: '#000', fontFamily: 'serif' },
  ppSharedMeta: { fontSize: 9, color: '#a3a3a3' },
  ppMemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 18, paddingBottom: 14 },
  ppMemItem: { width: 114, height: 114, borderRadius: 8, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  ppMemImage: { width: '100%', height: '100%', borderRadius: 8 },
  ppMemLabel: { fontSize: 9, color: '#fff', fontWeight: '700' },
  ppMemLocked: { backgroundColor: '#525252' },
  ppMemLock: { fontSize: 16, color: '#fff' },
  badgesScrollHtml: { paddingHorizontal: 18, paddingBottom: 14, gap: 8 },
  badgeChipHtml: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  badgeChipHtmlLocked: { opacity: 0.45 },
  badgeChipIcon: { fontSize: 16 },
  badgeChipName: { fontSize: 10, color: '#000', fontWeight: '600' },
  badgeChipSub: { fontSize: 8, color: '#a3a3a3' },
  quoteBlock: {
    marginHorizontal: 18,
    marginBottom: 12,
    backgroundColor: '#F2F5F9',
    borderWidth: 1,
    borderColor: '#E8EDF4',
    borderLeftWidth: 3,
    borderLeftColor: '#1B2E4A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quoteText: { fontSize: 14, color: '#1B2E4A', lineHeight: 21, fontStyle: 'italic', fontFamily: 'serif', marginBottom: 4 },
  quoteFrom: { fontSize: 10, color: '#2A4470' },
  flTimeline: { paddingHorizontal: 18, paddingBottom: 14 },
  flEvent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  flDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1B2E4A', marginTop: 3 },
  flDotGreen: { backgroundColor: '#16A34A' },
  flDotGold: { backgroundColor: '#C8A96A' },
  flEventLabel: { fontSize: 12, color: '#000', fontWeight: '500' },
  flEventSub: { fontSize: 10, color: '#A3A3A3', marginTop: 1 },
  flEventDate: { fontSize: 10, color: '#D4D4D4' },
  ppCtaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  ppCtaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ppCtaIconBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  ppCtaMainBtn: { flex: 1, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  ppCtaHint: { textAlign: 'center', marginTop: 5, fontSize: 10, color: '#a3a3a3' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  profileSection: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileUniversity: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  profileCity: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  hostBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  hostBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'center',
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  rsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  rsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rsScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: 12,
  },
  rsScore: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  rsMax: {
    fontSize: 20,
    color: '#666',
    marginLeft: 4,
  },
  rsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  rsBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rsNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  statsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  currentRitualSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  currentRitualCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  currentRitualLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  currentRitualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 2,
  },
  currentRitualMeta: {
    fontSize: 12,
    color: '#d1d5db',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  memberSince: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  pastTogetherSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pastRitualRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  pastRitualTime: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  pastRitualTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  pastRitualVenue: {
    fontSize: 12,
    color: '#666',
  },
  actionsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  badgesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePill: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  badgePillLocked: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  badgePillTextLocked: {
    color: '#6b7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonHalf: {
    flex: 1,
  },
  followButton: {
    backgroundColor: '#4CAF50',
  },
  unfollowButton: {
    backgroundColor: '#999',
  },
  sendMessageButton: {
    backgroundColor: '#2196F3',
    marginTop: 12,
    width: '100%',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  pendingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  friendBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  friendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  interestsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memoriesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memoriesHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  memoryTileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memoryTile: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  memoryTileLocked: {
    backgroundColor: '#f3f4f6',
    borderStyle: 'dashed',
  },
  memoryTileLabel: {
    fontSize: 10,
    color: '#111827',
    fontWeight: '700',
  },
  memoryTileLock: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '700',
  },
  memoriesMeta: {
    marginTop: 10,
    fontSize: 11,
    color: '#6b7280',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  interestChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestChipText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  noteSection: {
    padding: 16,
  },
  noteText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  upLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  upLink: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  upLinkText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#999',
    padding: 16,
    textAlign: 'center',
  },
  safetyActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  safetyButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportButton: {
    backgroundColor: '#FF9800',
  },
  blockButton: {
    backgroundColor: '#F44336',
  },
  safetyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Friend request sent screen styles
  friendSentContent: {
    paddingBottom: 40,
  },
  friendSentIconWrapper: {
    marginTop: 40,
    alignItems: 'center',
  },
  friendSentIconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#facc15',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 6,
  },
  friendSentIconInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendSentTitle: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#3f2a13',
  },
  friendSentSubtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: 'center',
    color: '#7c6a55',
    paddingHorizontal: 32,
  },
  friendSentAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 12,
  },
  friendSentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f3e1c8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendSentAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3f2a13',
  },
  friendSentRsBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  friendSentRsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  friendSentRitualCard: {
    marginTop: 28,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fff7ec',
    borderWidth: 1,
    borderColor: '#f0e0cc',
  },
  friendSentRitualLabel: {
    fontSize: 12,
    color: '#7c6a55',
    marginBottom: 4,
  },
  friendSentRitualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3f2a13',
    marginBottom: 2,
  },
  friendSentRitualMeta: {
    fontSize: 13,
    color: '#7c6a55',
  },
  friendSentActions: {
    marginTop: 32,
    paddingHorizontal: 24,
    gap: 12,
  },
  friendSentButton: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendSentCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  friendSentCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#4b5563',
  },
  friendSentPrimaryButton: {
    backgroundColor: '#d4af37',
  },
  friendSentPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
});
