import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { fetchUserSettings, updateUserSettings, exportUserData, deleteOwnAccount } from '../services/api';
import { PROFILE_PREVIEW_LINKS } from '../constants/profilePreviewRoutes';

// Pulse-style colors
const PULSE_BG = '#e0e0e0';
const PULSE_SCREEN_BG = '#f5f5f5';
const PULSE_CARD_BG = '#fff';
const PULSE_HEADER_BG = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_BORDER_LIGHT = '#f0f0f0';
const PULSE_BORDER_SUBTLE = '#f8f8f8';
const PULSE_TEXT = '#000';
const PULSE_TEXT_SUBTLE = '#999';
const PULSE_ICON_BG = '#f0f0f0';
const PULSE_TOGGLE_OFF = '#e8e8e8';
const PULSE_TOGGLE_ON = '#000';
const MEMORY_PRIVACY_OPTIONS = [
  {
    key: 'public',
    title: '🌐 Herkese Acik',
    subtitle: "LOCAL'daki herkes, yabancilar dahil, tam ani izgarasini gorebilir",
  },
  {
    key: 'friends_only',
    title: '👥 Yalnizca Arkadaslar',
    subtitle: 'Yalnizca L1+ baglantilar tam izgarayi gorebilir; yabancilar sinirli secim ve kilitli yer tutucular gorur',
  },
  {
    key: 'private',
    title: '🔒 Gizli',
    subtitle: 'Sadece sen gorebilirsin; L2 arkadaslar bile erisemez',
  },
];

export default function PrivacySettingsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publicProfile, setPublicProfile] = useState(true);
  const [accountPrivacy, setAccountPrivacy] = useState('OPEN');
  const [showRSScore, setShowRSScore] = useState(false);
  const [showLocation, setShowLocation] = useState(true);
  const [showRitualHistory, setShowRitualHistory] = useState(true);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [p2pFriendsOnly, setP2pFriendsOnly] = useState(false);
  const [memoryPrivacyMode, setMemoryPrivacyMode] = useState('public');
  const [discoverableByUsername, setDiscoverableByUsername] = useState(true);
  const [discoverableByEmail, setDiscoverableByEmail] = useState(false);
  const [discoverableByPhone, setDiscoverableByPhone] = useState(false);
  const [dataPersonalization, setDataPersonalization] = useState(true);
  const [dataAnalytics, setDataAnalytics] = useState(true);
  const [dataMarketing, setDataMarketing] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;
    loadSettings();
  }, [currentUserId]);

  const loadSettings = async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const data = await fetchUserSettings(currentUserId);
      if (data?.privacy) {
        const p = data.privacy;
        setShowRSScore(p.show_rs_score_publicly === true);
        setP2pFriendsOnly(!!p.allow_p2p_feedback_from_friends_only);
        const ap = String(p.account_privacy || (p.public_profile === false ? 'CLOSED' : 'OPEN')).toUpperCase();
        setAccountPrivacy(ap === 'CLOSED' ? 'CLOSED' : 'OPEN');
        setPublicProfile(ap !== 'CLOSED' && p.public_profile !== false);
        setShowLocation(p.show_location !== false);
        setShowRitualHistory(p.show_ritual_history !== false);
        setShowFriendsList(!!p.show_friends_list);
        setMemoryPrivacyMode(p.memory_privacy_mode || 'public');
        setDiscoverableByUsername(p.discoverable_by_username !== false);
        setDiscoverableByEmail(!!p.discoverable_by_email);
        setDiscoverableByPhone(!!p.discoverable_by_phone);
        setDataPersonalization(p.data_personalization !== false);
        setDataAnalytics(p.data_analytics_opt_in !== false);
        setDataMarketing(!!p.data_marketing_opt_in);
      }
    } catch (e) {
      console.error('Gizlilik ayarlari yukleme hatasi:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePrivacy = async (updates) => {
    if (!currentUserId) return;
    try {
      setSaving(true);
      await updateUserSettings(currentUserId, { privacy: updates });
    } catch (e) {
      console.error('Gizlilik kaydetme hatasi:', e);
      Alert.alert('Hata', 'Kaydedilemedi. Tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  const handleShowRSScoreChange = (value) => {
    setShowRSScore(value);
    savePrivacy({ show_rs_score_publicly: value });
  };

  const handleP2pFriendsOnlyChange = (value) => {
    setP2pFriendsOnly(value);
    savePrivacy({ allow_p2p_feedback_from_friends_only: value });
  };

  const handlePublicProfileChange = (value) => {
    setPublicProfile(value);
    const ap = value ? 'OPEN' : 'CLOSED';
    setAccountPrivacy(ap);
    savePrivacy({ account_privacy: ap, public_profile: value });
  };

  const handleAccountPrivacyChange = (closed) => {
    const ap = closed ? 'CLOSED' : 'OPEN';
    setAccountPrivacy(ap);
    setPublicProfile(!closed);
    savePrivacy({ account_privacy: ap, public_profile: !closed });
  };

  const handleShowLocationChange = (value) => {
    setShowLocation(value);
    savePrivacy({ show_location: value });
  };

  const handleShowRitualHistoryChange = (value) => {
    setShowRitualHistory(value);
    savePrivacy({ show_ritual_history: value });
  };

  const handleShowFriendsListChange = (value) => {
    setShowFriendsList(value);
    savePrivacy({ show_friends_list: value });
  };

  const handleMemoryPrivacyModeChange = (mode) => {
    setMemoryPrivacyMode(mode);
    savePrivacy({
      memory_privacy_mode: mode,
      // Keep legacy flag in sync so old screens stay coherent.
      show_memories: mode !== 'private',
    });
  };

  const handleDiscoverableByUsernameChange = (value) => {
    setDiscoverableByUsername(value);
    savePrivacy({ discoverable_by_username: value });
  };

  const handleDiscoverableByEmailChange = (value) => {
    setDiscoverableByEmail(value);
    savePrivacy({ discoverable_by_email: value });
  };

  const handleDiscoverableByPhoneChange = (value) => {
    setDiscoverableByPhone(value);
    savePrivacy({ discoverable_by_phone: value });
  };

  const handleDownloadData = async () => {
    if (!currentUserId) return;
    try {
      setSaving(true);
      const data = await exportUserData(currentUserId);
      const json = JSON.stringify(data, null, 2);
      await Share.share({
        message: json,
        title: 'Veri Disa Aktarimi',
      });
    } catch (e) {
      console.error('Disa aktarma hatasi:', e);
      Alert.alert('Hata', e?.message || 'Veriler disa aktarilamadi. Tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  const runAccountDeletion = async (confirmPhrase) => {
    if (!currentUserId) return;
    try {
      setSaving(true);
      const data = await deleteOwnAccount(currentUserId, confirmPhrase || 'SIL');
      Alert.alert(
        'Hesap silindi',
        data?.note ||
          'Profilin "Eski üye" oldu. Ortak masa anıları window arşivinde kalabilir.',
        [
          {
            text: 'Tamam',
            onPress: async () => {
              try {
                await useAuthStore.getState().logout?.();
              } catch (_e) {
                /* ignore */
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Hesap silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı sil',
      'Rıza uyarısı: Kendi memory\'lerin şehir vitrininden düşer. Ortak masa anıları window arşivinde "Eski üye" olarak kalabilir. Bu işlem geri alınamaz.\n\nOnaylamak için bir sonraki adımda SIL yaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam',
          style: 'destructive',
          onPress: () => {
            if (typeof Alert.prompt === 'function') {
              Alert.prompt(
                'Onay',
                'Hesabı silmek için SIL yaz',
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: (text) => runAccountDeletion(text),
                  },
                ],
                'plain-text'
              );
            } else {
              runAccountDeletion('SIL');
            }
          },
        },
      ]
    );
  };

  const handleDataPersonalizationChange = (value) => {
    setDataPersonalization(value);
    savePrivacy({ data_personalization: value });
  };

  const handleDataAnalyticsChange = (value) => {
    setDataAnalytics(value);
    savePrivacy({ data_analytics_opt_in: value });
  };

  const handleDataMarketingChange = (value) => {
    setDataMarketing(value);
    savePrivacy({ data_marketing_opt_in: value });
  };

  const handlePrivacyPolicy = () => {
    const url = 'https://local.app/privacy';
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        return Promise.reject(new Error('unsupported'));
      })
      .catch(() => navigation.navigate('PrivacyPolicy'));
  };

  const handleBlockedUsers = () => {
    navigation.navigate('BlockedUsers');
  };

  const handleBlockedKeywords = () => {
    navigation.navigate('BlockedKeywords');
  };

  const handleSavedItems = () => {
    navigation.navigate('SavedItems');
  };

  const handleMutedItems = () => {
    navigation.navigate('MutedItems');
  };

  const handleFollowRequests = () => {
    navigation.navigate('FollowRequests');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PULSE_TOGGLE_ON} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik Ayarlari</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          {/* Profile Visibility Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Profil Gorunurlugu</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🔒</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Kapali Profil</Text>
                <Text style={styles.settingSubtitle}>
                  {accountPrivacy === 'CLOSED'
                    ? 'Takip istekle gelir · yabanciya minimal kart · masa dunyasi muaf'
                    : 'Acik (OPEN): takip onaysiz, profil herkese gorunur'}
                </Text>
              </View>
              <Switch
                value={accountPrivacy === 'CLOSED'}
                onValueChange={handleAccountPrivacyChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={styles.settingItem} onPress={handleFollowRequests} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>✉️</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Takip Istekleri</Text>
                <Text style={styles.settingSubtitle}>Kapali profilde bekleyen istekler</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📊</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>RS Skorunu Goster</Text>
                <Text style={styles.settingSubtitle}>Guvenilirlik Skorunu profilde goster</Text>
              </View>
              <Switch
                value={showRSScore}
                onValueChange={handleShowRSScoreChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📍</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Konumu Goster</Text>
                <Text style={styles.settingSubtitle}>Sehrini profilde goster</Text>
              </View>
              <Switch
                value={showLocation}
                onValueChange={handleShowLocationChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Activity Privacy Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Etkinlik Gizliligi</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📅</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritual Gecmisini Goster</Text>
                <Text style={styles.settingSubtitle}>Digerleri katildigin Ritualsi gorebilir</Text>
              </View>
              <Switch
                value={showRitualHistory}
                onValueChange={handleShowRitualHistoryChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>👥</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Arkadas Listesini Goster</Text>
                <Text style={styles.settingSubtitle}>Digerleri arkadaslarini gorebilir</Text>
              </View>
              <Switch
                value={showFriendsList}
                onValueChange={handleShowFriendsListChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🔒</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>P2P geri bildirim sadece arkadaslardan</Text>
                <Text style={styles.settingSubtitle}>Sana sadece dogrudan arkadaslar P2P geri bildirim verebilir</Text>
              </View>
              <Switch
                value={p2pFriendsOnly}
                onValueChange={handleP2pFriendsOnlyChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📸</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ani Gizliligi</Text>
                <Text style={styles.settingSubtitle}>Anilarini kimin gorebilecegini sec</Text>
              </View>
            </View>
            <View style={styles.memoryModeList}>
              {MEMORY_PRIVACY_OPTIONS.map((option) => {
                const selected = memoryPrivacyMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.memoryModeItem, selected && styles.memoryModeItemSelected]}
                    onPress={() => handleMemoryPrivacyModeChange(option.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.memoryModeTitle, selected && styles.memoryModeTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text style={styles.memoryModeSubtitle}>{option.subtitle}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Discovery Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Kesfedilebilirlik</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🔍</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Kullanici Adiyla Bulunabilir</Text>
                <Text style={styles.settingSubtitle}>Digerleri seni kullanici adinla bulabilir</Text>
              </View>
              <Switch
                value={discoverableByUsername}
                onValueChange={handleDiscoverableByUsernameChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>✉️</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>E-postayla Bulunabilir</Text>
                <Text style={styles.settingSubtitle}>Arkadaslar seni e-posta ile bulabilir</Text>
              </View>
              <Switch
                value={discoverableByEmail}
                onValueChange={handleDiscoverableByEmailChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📱</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Telefonla Bulunabilir</Text>
                <Text style={styles.settingSubtitle}>Arkadaslar seni telefonla bulabilir</Text>
              </View>
              <Switch
                value={discoverableByPhone}
                onValueChange={handleDiscoverableByPhoneChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Data & Privacy Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Veri ve Gizlilik</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handleDownloadData} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📥</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Verilerimi Indir</Text>
                <Text style={styles.settingSubtitle}>KVKK/GDPR veri disa aktarma</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
              disabled={saving}
            >
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🗑️</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingTitle, { color: '#b91c1c' }]}>Hesabi Sil</Text>
                <Text style={styles.settingSubtitle}>
                  Riza uyarili · isim "Eski uye" · sehir vitrininden dus
                </Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🎯</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Kisisellestirme</Text>
                <Text style={styles.settingSubtitle}>
                  Kesif ve oneriler gecmis Ritual verine gore siralanir
                </Text>
              </View>
              <Switch
                value={dataPersonalization}
                onValueChange={handleDataPersonalizationChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📊</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Anonim Kullanim Istatistikleri</Text>
                <Text style={styles.settingSubtitle}>Urun gelistirme icin kimliksiz olcum</Text>
              </View>
              <Switch
                value={dataAnalytics}
                onValueChange={handleDataAnalyticsChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>✉️</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Urun Duyurulari</Text>
                <Text style={styles.settingSubtitle}>Yeni ozellik ve sehir duyurulari e-postasi</Text>
              </View>
              <Switch
                value={dataMarketing}
                onValueChange={handleDataMarketingChange}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={styles.settingItemLast} onPress={handlePrivacyPolicy} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>📄</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Gizlilik Politikasi</Text>
                <Text style={styles.settingSubtitle}>Gizlilik politikamizi oku</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Blocking Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Engellemeler & Kayitlar</Text>
            <TouchableOpacity style={styles.settingItem} onPress={handleSavedItems} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>☆</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Kaydedilenler</Text>
                <Text style={styles.settingSubtitle}>Ritual / mekan / zone / ani kayitlari</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleMutedItems} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🔕</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Sessize Alinanlar</Text>
                <Text style={styles.settingSubtitle}>Mute listesini yonet</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem} onPress={handleBlockedUsers} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🚫</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Engellenen Kullanicilar</Text>
                <Text style={styles.settingSubtitle}>Engellenen hesaplari yonet</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItemLast} onPress={handleBlockedKeywords} activeOpacity={0.7}>
              <View style={styles.settingIcon}>
                <Text style={styles.settingIconEmoji}>🔇</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Engellenen Anahtar Kelimeler</Text>
                <Text style={styles.settingSubtitle}>Belirli kelimeleri iceren icerikleri gizle</Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Profil Erisim Onizlemeleri (UP)</Text>
            <Text style={styles.previewHint}>Baglanti seviyesine gore profil ve anı gorunumlerini incele.</Text>
            {PROFILE_PREVIEW_LINKS.map((item, idx) => (
              <TouchableOpacity
                key={item.route}
                style={idx === PROFILE_PREVIEW_LINKS.length - 1 ? styles.settingItemLast : styles.settingItem}
                onPress={() => navigation.navigate(item.route, item.params)}
                activeOpacity={0.7}
              >
                <View style={styles.settingIcon}>
                  <Text style={styles.settingIconEmoji}>👤</Text>
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{item.label}</Text>
                </View>
                <Text style={styles.settingArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PULSE_SCREEN_BG },
  centered: { justifyContent: 'center', alignItems: 'center' },
  statusBarSpacer: { height: 44 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: PULSE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  backButton: { marginRight: 16, padding: 4 },
  backBtnText: { fontSize: 24, color: PULSE_TEXT },
  headerTitle: { fontSize: 20, fontWeight: '700', color: PULSE_TEXT },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  mainContent: { padding: 16 },
  settingsCard: {
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PULSE_TEXT,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER_LIGHT,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER_SUBTLE,
  },
  settingItemLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PULSE_ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconEmoji: { fontSize: 18 },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 16, fontWeight: '600', color: PULSE_TEXT, marginBottom: 2 },
  settingSubtitle: { fontSize: 13, color: PULSE_TEXT_SUBTLE },
  settingArrow: { fontSize: 18, color: '#ccc' },
  previewHint: { fontSize: 12, color: PULSE_TEXT_SUBTLE, paddingHorizontal: 16, paddingBottom: 8, lineHeight: 18 },
  memoryModeList: {
    marginTop: 6,
    gap: 8,
  },
  memoryModeItem: {
    borderWidth: 1,
    borderColor: PULSE_BORDER,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fafafa',
  },
  memoryModeItemSelected: {
    borderColor: '#111',
    backgroundColor: '#f0f0f0',
  },
  memoryModeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  memoryModeTitleSelected: {
    color: '#000',
  },
  memoryModeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#666',
  },
});
