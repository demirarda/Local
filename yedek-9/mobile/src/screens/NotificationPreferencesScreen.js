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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { fetchUserSettings, updateUserSettings } from '../services/api';

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

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Backend-backed (user_settings)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [ritualInvitations, setRitualInvitations] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [ritualReminders, setRitualReminders] = useState(true);
  const [messages, setMessages] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [ritualUpdates, setRitualUpdates] = useState(true);
  const [friendActivity, setFriendActivity] = useState(true);
  const [shareObject, setShareObject] = useState(true);
  const [forumComment, setForumComment] = useState(true);
  const [forumRepost, setForumRepost] = useState(true);
  const [forumUpvote, setForumUpvote] = useState(false);
  const [penaltyNotif, setPenaltyNotif] = useState(true);
  const [ritualStartingSoon, setRitualStartingSoon] = useState(true);
  const [newMemories, setNewMemories] = useState(true);
  const [rsScoreChanges, setRsScoreChanges] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [quietStartTime, setQuietStartTime] = useState('01:00');
  const [quietEndTime, setQuietEndTime] = useState('09:00');
  const [silentFl, setSilentFl] = useState(false);
  const [silentDs, setSilentDs] = useState(false);
  const [silentMemory, setSilentMemory] = useState(false);
  const [silentBadgeApproach, setSilentBadgeApproach] = useState(false);
  const [catRitualDoor, setCatRitualDoor] = useState(true);
  const [catMentionSoz, setCatMentionSoz] = useState(true);
  const [catFriendship, setCatFriendship] = useState(true);
  const [catSeriesVenue, setCatSeriesVenue] = useState(true);
  const [catConsentSafety, setCatConsentSafety] = useState(true);
  const [catProductDigest, setCatProductDigest] = useState(true);

  useEffect(() => {
    if (!currentUserId) return;
    loadSettings();
  }, [currentUserId]);

  const loadSettings = async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const data = await fetchUserSettings(currentUserId);
      if (data?.notifications) {
        const n = data.notifications;
        setPushEnabled(n.ritual_live !== false);
        setRitualInvitations(n.ritual_starting_soon !== false);
        setFriendRequests(n.friend_request_accepted !== false);
        setRitualReminders(n.ritual_starting_soon !== false);
        setEmailEnabled(true);
        setWeeklyDigest(true);
        setRitualUpdates(n.ritual_almost_full !== false);
        setFriendActivity(n.friend_joined_ritual !== false);
        setShareObject(n.share_object !== false);
        setForumComment(n.forum_comment !== false);
        setForumRepost(n.forum_repost !== false);
        setForumUpvote(n.forum_upvote === true);
        setPenaltyNotif(n.penalty !== false);
        setMessages(n.share_object !== false);
        setRitualStartingSoon(n.ritual_starting_soon !== false);
        setNewMemories(true);
        setRsScoreChanges(n.feedback_available !== false);
        setQuietHours(n.quiet_hours_enabled !== false);
        setQuietStartTime(n.quiet_start || '01:00');
        setQuietEndTime(n.quiet_end || '09:00');
        setWeeklyDigest(n.weekly_digest !== false);
        setSilentFl(n.fl_change === true);
        setSilentDs(n.ds_tier === true);
        setSilentMemory(n.public_memory_follow === true);
        setSilentBadgeApproach(n.badge_approaching === true);
        setCatRitualDoor(n.cat_ritual_door !== false);
        setCatMentionSoz(n.cat_mention_soz !== false);
        setCatFriendship(n.cat_friendship !== false);
        setCatSeriesVenue(n.cat_series_venue !== false);
        setCatConsentSafety(n.cat_consent_safety !== false);
        setCatProductDigest(n.cat_product_digest !== false);
      }
    } catch (e) {
      console.error('Bildirim ayarlari yukleme hatasi:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async (updates) => {
    if (!currentUserId) return;
    try {
      setSaving(true);
      await updateUserSettings(currentUserId, { notifications: updates });
    } catch (e) {
      console.error('Bildirim ayarlari kaydetme hatasi:', e);
      Alert.alert('Hata', 'Kaydedilemedi. Tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  const handlePushEnabled = (v) => {
    setPushEnabled(v);
    saveNotifications({ ritual_live: v });
  };
  const handleRitualInvitations = (v) => {
    setRitualInvitations(v);
    setRitualReminders(v);
    saveNotifications({ ritual_starting_soon: v });
  };
  const handleFriendRequests = (v) => {
    setFriendRequests(v);
    saveNotifications({ friend_request_accepted: v });
  };
  const handleRitualReminders = (v) => {
    setRitualReminders(v);
    setRitualInvitations(v);
    saveNotifications({ ritual_starting_soon: v });
  };
  const handleRitualUpdates = (v) => {
    setRitualUpdates(v);
    saveNotifications({ ritual_almost_full: v });
  };
  const handleFriendActivity = (v) => {
    setFriendActivity(v);
    saveNotifications({ friend_joined_ritual: v });
  };
  const handleRitualStartingSoon = (v) => {
    setRitualStartingSoon(v);
    setRitualInvitations(v);
    setRitualReminders(v);
    saveNotifications({ ritual_starting_soon: v });
  };
  const handleRsScoreChanges = (v) => {
    setRsScoreChanges(v);
    saveNotifications({ feedback_available: v });
  };
  const handleShareObject = (v) => {
    setShareObject(v);
    setMessages(v);
    saveNotifications({ share_object: v });
  };
  const handleForumComment = (v) => {
    setForumComment(v);
    saveNotifications({ forum_comment: v });
  };
  const handleForumRepost = (v) => {
    setForumRepost(v);
    saveNotifications({ forum_repost: v });
  };
  const handleForumUpvote = (v) => {
    setForumUpvote(v);
    saveNotifications({ forum_upvote: v });
  };
  const handlePenaltyNotif = (v) => {
    setPenaltyNotif(v);
    saveNotifications({ penalty: v });
  };
  const handleQuietHours = (v) => {
    setQuietHours(v);
    saveNotifications({ quiet_hours_enabled: v, quiet_start: quietStartTime, quiet_end: quietEndTime });
  };
  const persistQuietTimes = (start, end) => {
    saveNotifications({ quiet_hours_enabled: quietHours, quiet_start: start, quiet_end: end });
  };
  const handleSilentFl = (v) => { setSilentFl(v); saveNotifications({ fl_change: v }); };
  const handleSilentDs = (v) => { setSilentDs(v); saveNotifications({ ds_tier: v }); };
  const handleSilentMemory = (v) => { setSilentMemory(v); saveNotifications({ public_memory_follow: v }); };
  const handleSilentBadgeApproach = (v) => { setSilentBadgeApproach(v); saveNotifications({ badge_approaching: v }); };

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
        <Text style={styles.headerTitle}>Bildirim Tercihleri</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          {/* Push Notifications Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Anlik Bildirimler</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>🔔</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Anlik Bildirimleri Ac</Text>
                <Text style={styles.settingSubtitle}>Cihazinda bildirim al</Text>
              </View>
              <Switch value={pushEnabled} onValueChange={handlePushEnabled} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>✉️</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritual Davetleri</Text>
                <Text style={styles.settingSubtitle}>Biri seni bir Ritualle davet ettiginde</Text>
              </View>
              <Switch value={ritualInvitations} onValueChange={handleRitualInvitations} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>👥</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Arkadaslik Istekleri</Text>
                <Text style={styles.settingSubtitle}>Biri baglanti kurmak istediginde</Text>
              </View>
              <Switch value={friendRequests} onValueChange={handleFriendRequests} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>⏰</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritual Hatirlatmalari</Text>
                <Text style={styles.settingSubtitle}>Ritualsin baslamadan once</Text>
              </View>
              <Switch value={ritualReminders} onValueChange={handleRitualReminders} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>💬</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Share-2-Person</Text>
                <Text style={styles.settingSubtitle}>Arkadaslarindan nesne paylasimi</Text>
              </View>
              <Switch value={shareObject} onValueChange={handleShareObject} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>⚖️</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Katilim Kayitlari</Text>
                <Text style={styles.settingSubtitle}>Cezalar ve replacement (notr ton)</Text>
              </View>
              <Switch value={penaltyNotif} onValueChange={handlePenaltyNotif} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Rozete Yaklastin</Text>
                <Text style={styles.settingSubtitle}>2 ritüel kaldı — yalnız sahibine</Text>
              </View>
              <Switch value={silentBadgeApproach} onValueChange={handleSilentBadgeApproach} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Kategoriler (Sosyal CORE)</Text>
            <Text style={styles.cardHint}>
              Quiet hours default 01.00–09.00; söz verdiğin masa bu sessizliği deler. ▼ için push asla yoktur.
            </Text>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritüel / kapı</Text>
                <Text style={styles.settingSubtitle}>Açılış, mühür, kapı, kilit sinyalleri</Text>
              </View>
              <Switch
                value={catRitualDoor}
                onValueChange={(v) => {
                  setCatRitualDoor(v);
                  saveNotifications({ cat_ritual_door: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Mention ve Söz</Text>
                <Text style={styles.settingSubtitle}>Etiket, forum yorumu, Söz</Text>
              </View>
              <Switch
                value={catMentionSoz}
                onValueChange={(v) => {
                  setCatMentionSoz(v);
                  saveNotifications({ cat_mention_soz: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Arkadaşlık</Text>
                <Text style={styles.settingSubtitle}>İstek, kabul, arkadaş masası</Text>
              </View>
              <Switch
                value={catFriendship}
                onValueChange={(v) => {
                  setCatFriendship(v);
                  saveNotifications({ cat_friendship: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Series / venue</Text>
                <Text style={styles.settingSubtitle}>Mekan, Series, slot güncellemeleri</Text>
              </View>
              <Switch
                value={catSeriesVenue}
                onValueChange={(v) => {
                  setCatSeriesVenue(v);
                  saveNotifications({ cat_series_venue: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Rıza / güvenlik</Text>
                <Text style={styles.settingSubtitle}>Ceza, feedback, güvenlik uyarıları</Text>
              </View>
              <Switch
                value={catConsentSafety}
                onValueChange={(v) => {
                  setCatConsentSafety(v);
                  saveNotifications({ cat_consent_safety: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ürün özeti</Text>
                <Text style={styles.settingSubtitle}>Haftalık digest ve ürün sinyalleri (FOMO yok)</Text>
              </View>
              <Switch
                value={catProductDigest}
                onValueChange={(v) => {
                  setCatProductDigest(v);
                  saveNotifications({ cat_product_digest: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Local World / Forum</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>💭</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Forum Yorumlari</Text>
                <Text style={styles.settingSubtitle}>Icerigine yorum veya yanit</Text>
              </View>
              <Switch value={forumComment} onValueChange={handleForumComment} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>🔁</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Forum Repost</Text>
                <Text style={styles.settingSubtitle}>Icerik Pulse'a tasindiginda</Text>
              </View>
              <Switch value={forumRepost} onValueChange={handleForumRepost} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>👍</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Forum Begeni (esikli)</Text>
                <Text style={styles.settingSubtitle}>Varsayilan kapali · 5+ begeni</Text>
              </View>
              <Switch value={forumUpvote} onValueChange={handleForumUpvote} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
          </View>

          {/* Email Notifications Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Sessiz / In-App (§11)</Text>
            <Text style={styles.cardHint}>Push gonderilmez; bildirim merkezinde gorunur</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>FL Degisimi</Text>
                <Text style={styles.settingSubtitle}>Baglanti seviyesi guncellendi</Text>
              </View>
              <Switch value={silentFl} onValueChange={handleSilentFl} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>DS Tier (private)</Text>
                <Text style={styles.settingSubtitle}>Diversity tier degisimi</Text>
              </View>
              <Switch value={silentDs} onValueChange={handleSilentDs} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Takip Public Ani</Text>
                <Text style={styles.settingSubtitle}>Takip ettigin biri ani paylasti</Text>
              </View>
              <Switch value={silentMemory} onValueChange={handleSilentMemory} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>E-posta Bildirimleri</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>📧</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>E-posta Bildirimlerini Ac</Text>
                <Text style={styles.settingSubtitle}>Guncellemeleri e-posta ile al</Text>
              </View>
              <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>📅</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Haftalik Ozet</Text>
                <Text style={styles.settingSubtitle}>LOCAL'deki haftanin ozeti</Text>
              </View>
              <Switch
                value={weeklyDigest}
                onValueChange={(v) => {
                  setWeeklyDigest(v);
                  saveNotifications({ weekly_digest: v });
                }}
                trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>🎉</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritual Guncellemeleri</Text>
                <Text style={styles.settingSubtitle}>Katildigin Ritualsdeki degisiklikler</Text>
              </View>
              <Switch value={ritualUpdates} onValueChange={handleRitualUpdates} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>👋</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Arkadas Etkinligi</Text>
                <Text style={styles.settingSubtitle}>Arkadaslar Ritualse katildiginda</Text>
              </View>
              <Switch value={friendActivity} onValueChange={handleFriendActivity} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
          </View>

          {/* In-App Notifications Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Uygulama Ici Bildirimler</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>🚀</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Ritual Yakinda Basliyor</Text>
                <Text style={styles.settingSubtitle}>Ritual baslamadan 15 dakika once</Text>
              </View>
              <Switch value={ritualStartingSoon} onValueChange={handleRitualStartingSoon} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>📸</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Yeni Anilar</Text>
                <Text style={styles.settingSubtitle}>Arkadaslar ani paylastiginda</Text>
              </View>
              <Switch value={newMemories} onValueChange={setNewMemories} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.settingItemLast}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>📊</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>RS Skor Degisiklikleri</Text>
                <Text style={styles.settingSubtitle}>Skorun guncellendiginde</Text>
              </View>
              <Switch value={rsScoreChanges} onValueChange={handleRsScoreChanges} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
          </View>

          {/* Notification Schedule Card */}
          <View style={styles.settingsCard}>
            <Text style={styles.cardTitle}>Bildirim Takvimi</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Text style={styles.settingIconEmoji}>🌙</Text></View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Sessiz Saatler</Text>
                <Text style={styles.settingSubtitle}>Bu saatlerde bildirimleri duraklat</Text>
              </View>
              <Switch value={quietHours} onValueChange={handleQuietHours} trackColor={{ false: PULSE_TOGGLE_OFF, true: PULSE_TOGGLE_ON }} thumbColor="#fff" />
            </View>
            <View style={styles.timePickerRow}>
              <View style={styles.timePicker}>
                <Text style={styles.timeLabel}>Baslangic Saati</Text>
                <TextInput
                  style={styles.timeInput}
                  value={quietStartTime}
                  onChangeText={(v) => { setQuietStartTime(v); persistQuietTimes(v, quietEndTime); }}
                  placeholder="01:00"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                />
              </View>
              <View style={styles.timePicker}>
                <Text style={styles.timeLabel}>Bitis Saati</Text>
                <TextInput
                  style={styles.timeInput}
                  value={quietEndTime}
                  onChangeText={(v) => { setQuietEndTime(v); persistQuietTimes(quietStartTime, v); }}
                  placeholder="09:00"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                />
              </View>
            </View>
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
  cardHint: { fontSize: 11, color: PULSE_TEXT_SUBTLE, marginBottom: 10, marginTop: -6 },
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
  timePickerRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  timePicker: { flex: 1 },
  timeLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  timeInput: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: '600',
    color: PULSE_TEXT,
    backgroundColor: '#f8f8f8',
    textAlign: 'center',
  },
});
