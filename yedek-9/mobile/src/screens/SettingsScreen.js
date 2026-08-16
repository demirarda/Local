import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Image, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { fetchUserProfile, fetchUserSettings, updateUserSettings, fetchMyRegularStatus } from '../services/api';
import useThemeStore from '../store/themeStore';
import useConfigStore from '../store/configStore';
import QRBumpSheet from '../components/QRBumpSheet';

const NAVY = '#1B2E4A';
const NAVY_LIGHT = '#E8EDF4';
const GREEN = '#16A34A';
const GREEN_LIGHT = '#EAF3DE';
const AMBER = '#D97706';
const AMBER_LIGHT = '#FEF3C7';
const RED = '#DC2626';
const RED_LIGHT = '#FEE2E2';
const BG = '#F0F0F0';
const CARD = '#FFFFFF';
const TEXT = '#000000';
const TEXT_MID = '#737373';
const TEXT_SOFT = '#A3A3A3';
const BORDER = '#E5E5E5';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const logout = useAuthStore(state => state.logout);
  const { user } = useAuthStore();
  const [locationServices, setLocationServices] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [searchVisible, setSearchVisible] = useState(true);
  const [activeVisible, setActiveVisible] = useState(false);
  const [notifLive, setNotifLive] = useState(true);
  const [notifFriends, setNotifFriends] = useState(true);
  const [notifRs, setNotifRs] = useState(true);
  const [notifBadges, setNotifBadges] = useState(true);
  const [profile, setProfile] = useState(null);
  const [regularStatus, setRegularStatus] = useState(null);
  const [showQrBump, setShowQrBump] = useState(false);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  const featureStubs = useConfigStore((s) => s.config?.stubs || {});

  useEffect(() => {
    if (!user?.id) return;
    fetchUserProfile(user.id)
      .then(setProfile)
      .catch(() => {});
    fetchUserSettings(user.id)
      .then((data) => {
        const n = data?.notifications || {};
        setNotifLive(n.ritual_live !== false);
        setNotifFriends(n.friend_joined_ritual !== false);
        setNotifRs(n.feedback_available !== false);
        setNotifBadges(n.badge_earned !== false);
      })
      .catch(() => {});
    fetchMyRegularStatus()
      .then(setRegularStatus)
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    setDarkMode(themeMode === 'dark');
  }, [themeMode]);

  const handleLogOut = async () => {
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
  };

  const rsValue = Number(profile?.rs_score ?? 5.0);
  const rsDots = useMemo(() => {
    const val = Math.max(0, Math.min(10, rsValue));
    return Array.from({ length: 10 }).map((_, idx) => {
      const level = idx + 1;
      if (level <= Math.floor(val)) return 'full';
      if (level <= Math.ceil(val) && val % 1 > 0.3) return 'half';
      return 'empty';
    });
  }, [rsValue]);

  const initials = String(profile?.name || 'U').trim().charAt(0).toUpperCase();
  const isDark = darkMode;
  const palette = isDark
    ? {
        bg: '#080808',
        card: '#111111',
        text: '#F5F5F5',
        textSoft: '#9CA3AF',
        border: '#232323',
        mutedRow: '#181818',
        navBg: 'rgba(8,8,8,0.98)',
      }
    : {
        bg: BG,
        card: CARD,
        text: TEXT,
        textSoft: TEXT_SOFT,
        border: BORDER,
        mutedRow: '#F5F5F5',
        navBg: 'rgba(255,255,255,0.98)',
      };

  const persistNotification = async (patch) => {
    if (!user?.id) return;
    try {
      await updateUserSettings(user.id, { notifications: patch });
    } catch (_e) {}
  };

  const toggleDarkMode = async (value) => {
    setDarkMode(value);
    await setThemeMode(value ? 'dark' : 'light');
  };

  const renderSettingRow = ({ icon, iconStyle, label, sub, right, onPress, last = false }) => (
    <TouchableOpacity
      activeOpacity={onPress ? 0.75 : 1}
      onPress={onPress}
      style={[styles.settingRow, !last && styles.settingRowBorder, !last && { borderBottomColor: isDark ? '#202020' : '#F5F5F5' }]}
    >
      <View style={[styles.srIcon, iconStyle, isDark && { backgroundColor: '#1A1A1A' }]}><Text style={styles.srIconText}>{icon}</Text></View>
      <View style={styles.srBody}>
        <Text style={[styles.srLabel, { color: palette.text }]}>{label}</Text>
        {!!sub && <Text style={[styles.srSub, { color: palette.textSoft }]}>{sub}</Text>}
      </View>
      <View style={styles.srRight}>{right || <Text style={[styles.srArrow, { color: isDark ? '#3A3A3A' : '#D4D4D4' }]}>›</Text>}</View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Passport</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Ayarlar</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.scrollView, { backgroundColor: palette.bg }]}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: palette.card }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <View style={styles.pcCover}>
            <View style={styles.pcCoverPattern} />
          </View>
          <View style={styles.pcBody}>
            <View style={styles.pcAvWrap}>
              <View style={styles.pcAvatar}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.pcAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.pcAvatarFallback}>{initials}</Text>
                )}
              </View>
              <View style={styles.pcEditBtn}><Text style={styles.pcEditBtnText}>Profili Duzenle</Text></View>
            </View>
            <Text style={[styles.pcName, { color: palette.text }]}>{profile?.name || 'Kullanici'}</Text>
            <Text style={[styles.pcMeta, { color: palette.textSoft }]}>
              {[profile?.university, profile?.city].filter(Boolean).join(' · ') || 'Universite · Sehir'}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.badgeChip, styles.badgeGold]}>Pivot Host</Text>
              <Text style={[styles.badgeChip, styles.badgeNavy]}>Verified</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.hubCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <View style={styles.hubCardLeft}>
            <Text style={styles.hubLogo}>⚙</Text>
            <View>
              <Text style={[styles.hubTitle, { color: palette.text }]}>Profil ayarlari</Text>
              <Text style={[styles.hubSub, { color: palette.textSoft }]}>
                Uni-etiket · hosted sayı · gizlilik
              </Text>
            </View>
          </View>
          <Text style={styles.hubArrow}>›</Text>
        </TouchableOpacity>

        {/* PulseLayout / LocalHub tooling removed from product Settings (v2 §17) */}

        <TouchableOpacity style={styles.rsCard} activeOpacity={0.8} onPress={() => navigation.navigate('RSTransparency')}>
          <View>
            <View style={styles.rsDots}>
              {rsDots.map((k, idx) => <View key={`dot-${idx}`} style={[styles.rsDot, k === 'full' && styles.rsDotFull, k === 'half' && styles.rsDotHalf]} />)}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rsLabel}>Guvenilirlik</Text>
            <Text style={styles.rsStatus}>Monokrom bant · ham sayı gizli</Text>
            <Text style={styles.rsSub}>Detay için RS şeffaflık ekranı</Text>
          </View>
          <Text style={styles.rsArrow}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Hesap</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '👤',
            iconStyle: styles.sriNavy,
            label: 'Profil Bilgileri',
            sub: 'Ad, universite, biyografi',
            onPress: () => navigation.navigate('EditProfile'),
          })}
          {renderSettingRow({
            icon: '👁️',
            iconStyle: styles.sriNavy,
            label: 'RS Gorunurlugu',
            sub: 'Kim RS skorunu gorebilir?',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('PrivacySettings'),
          })}
          {renderSettingRow({
            icon: '🏙️',
            iconStyle: styles.sriNavy,
            label: 'Sehir',
            sub: profile?.city ? `${profile.city} aktif` : 'Sehir secimi',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('PrivacySettings'),
          })}
          {renderSettingRow({
            icon: '🏪',
            iconStyle: styles.sriNavy,
            label: 'LOCAL Venue Basvurusu',
            sub: 'Mekan olarak LOCAL\'e basvur',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('VenueApply'),
          })}
          {renderSettingRow({
            icon: '📘',
            iconStyle: styles.sriBlue,
            label: '10. Sozluk',
            sub: 'Sozluk ve terimler',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('Glossary'),
          })}
          {renderSettingRow({
            icon: '⚙️',
            iconStyle: styles.sriDark,
            label: 'LTE-3 Trust Engine',
            sub: 'RS motoru sabitleri ve boru hatti',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('LTE3Engine'),
          })}
          {renderSettingRow({
            icon: '🛡',
            iconStyle: styles.sriDark,
            label: 'Moderasyon Paneli',
            sub: 'Sikayet ve guvenlik islemleri',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('Moderation'),
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Gizlilik</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '🔍',
            iconStyle: styles.sriDark,
            label: 'Aramada Gorun',
            sub: 'Kullanicilar seni aramada gorebilir',
            right: (
              <Switch
                value={searchVisible}
                onValueChange={setSearchVisible}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
          })}
          {renderSettingRow({
            icon: '📍',
            iconStyle: styles.sriDark,
            label: 'Konum Paylasimi',
            sub: 'Sadece check-in sirasinda kullanilir',
            right: (
              <Switch
                value={locationServices}
                onValueChange={setLocationServices}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
          })}
          {renderSettingRow({
            icon: '👀',
            iconStyle: styles.sriDark,
            label: 'Aktif Durumu',
            sub: 'Baglantilarin cevrimici durumunu gorebilir',
            right: (
              <Switch
                value={activeVisible}
                onValueChange={setActiveVisible}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Bildirimler</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '⚙️',
            iconStyle: styles.sriAmber,
            label: 'Bildirim Tercihleri',
            sub: 'Kategori bazli kontrol (§11)',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('NotificationPreferences'),
          })}
          {renderSettingRow({
            icon: '🔔',
            iconStyle: styles.sriAmber,
            label: 'Canli Ritual basladi',
            right: (
              <Switch
                value={notifLive}
                onValueChange={(v) => {
                  setNotifLive(v);
                  persistNotification({ ritual_live: v });
                }}
                trackColor={{ false: BORDER, true: GREEN }}
                thumbColor="#fff"
              />
            ),
          })}
          {renderSettingRow({
            icon: '👥',
            iconStyle: styles.sriNavy,
            label: 'Rituale arkadasin katildi',
            right: (
              <Switch
                value={notifFriends}
                onValueChange={(v) => {
                  setNotifFriends(v);
                  persistNotification({ friend_joined_ritual: v });
                }}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
          })}
          {renderSettingRow({
            icon: '◈',
            iconStyle: styles.sriGold,
            label: 'RS skoru degisti',
            right: (
              <Switch
                value={notifRs}
                onValueChange={(v) => {
                  setNotifRs(v);
                  persistNotification({ feedback_available: v });
                }}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
          })}
          {renderSettingRow({
            icon: '🏅',
            iconStyle: styles.sriGreen,
            label: 'Yeni rozet kazanildi',
            right: (
              <Switch
                value={notifBadges}
                onValueChange={(v) => {
                  setNotifBadges(v);
                  persistNotification({ badge_earned: v });
                }}
                trackColor={{ false: BORDER, true: GREEN }}
                thumbColor="#fff"
              />
            ),
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Sosyal</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '📱',
            iconStyle: styles.sriNavy,
            label: 'QR-Bump',
            sub: 'Yakin arkadas ekle',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => setShowQrBump(true),
          })}
          {renderSettingRow({
            icon: '🔗',
            iconStyle: styles.sriGold,
            label: 'Regular Durumu',
            sub: regularStatus?.is_regular
              ? `${regularStatus.pair_count || regularStatus.count || 0} mekân · gizli etiket`
              : 'Henuz regular degil (ozel, paylasilmaz)',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('MyRegulars'),
          })}
          {renderSettingRow({
            icon: '📷',
            iconStyle: styles.sriGreen,
            label: 'Anilarim',
            sub: 'Ritual anilarin',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: () => navigation.navigate('YourMemories'),
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Yakinda (§14)</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {[
            featureStubs.music_sync,
            featureStubs.music_sdk,
            featureStubs.live_avatar,
            featureStubs.brand_host,
            featureStubs.ios_proximity_add,
            featureStubs.badge_llm_pipeline,
          ]
            .filter(Boolean)
            .map((item, idx, arr) =>
              renderSettingRow({
                icon: item.enabled ? '✓' : '⏸',
                iconStyle: item.enabled ? styles.sriGreen : styles.sriNavy,
                label: item.label || 'Ozellik',
                sub: item.enabled ? 'Aktif' : (item.phase || 'Pasif'),
                right: null,
                last: idx === arr.length - 1,
              })
            )}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Gorunum</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '🌓',
            iconStyle: styles.sriDark,
            label: 'Gorunum (Koyu Tema)',
            right: (
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: BORDER, true: NAVY }}
                thumbColor="#fff"
              />
            ),
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Oturum</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '↩',
            iconStyle: styles.sriDark,
            label: 'Cikis Yap',
            sub: profile?.name || user?.email || '',
            right: <Text style={styles.srArrow}>›</Text>,
            onPress: handleLogOut,
            last: true,
          })}
        </View>

        <Text style={[styles.groupLabel, { color: palette.textSoft }]}>Tehlikeli Bolge</Text>
        <View style={[styles.groupCard, { backgroundColor: palette.card }]}>
          {renderSettingRow({
            icon: '⏸',
            iconStyle: styles.sriRed,
            label: 'Hesabi Dondur',
            sub: 'Gecici devre disi · RS korunur',
            right: <Text style={styles.srArrow}>›</Text>,
          })}
          {renderSettingRow({
            icon: '🗑',
            iconStyle: styles.sriRed,
            label: 'Hesabi Sil',
            sub: 'Kalici silme · geri alinamaz',
            right: <Text style={styles.srArrow}>›</Text>,
            last: true,
          })}
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appLogo}>L.</Text>
          <Text style={[styles.appVer, { color: palette.textSoft }]}>v1.0.0 · Milano 2026 · LOCAL Technologies</Text>
          <View style={styles.linkRow}>
            <Text style={styles.infoLink}>Gizlilik</Text>
            <Text style={styles.infoLink}>Kosullar</Text>
            <Text style={styles.infoLink}>Cerezler</Text>
            <Text style={styles.infoLink}>Iletisim</Text>
          </View>
        </View>

      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.navBg, borderTopColor: palette.border }]}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.75} onPress={() => navigation.navigate('Pulse')}>
          <Text style={[styles.navIconOff, { color: palette.textSoft }]}>〰</Text>
          <Text style={[styles.navLabelOff, { color: palette.textSoft }]}>Pulse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.75} onPress={() => navigation.navigate('CityRhythm')}>
          <Text style={[styles.navIconOff, { color: palette.textSoft }]}>📅</Text>
          <Text style={[styles.navLabelOff, { color: palette.textSoft }]}>City Rhythm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.85} onPress={() => navigation.navigate('SocialPassport')}>
          <View style={styles.activeNavCircle}><Text style={styles.activeNavCircleText}>◉</Text></View>
          <Text style={[styles.navLabelOn, { color: palette.text }]}>Passport</Text>
        </TouchableOpacity>
      </View>
      <QRBumpSheet visible={showQrBump} onClose={() => setShowQrBump(false)} />
    </View>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: 54,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: BG,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { width: 90, paddingVertical: 4 },
  backBtnText: { color: NAVY, fontSize: 13, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: TEXT,
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  headerRight: { width: 90 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD,
    ...cardShadow,
  },
  hubCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    ...cardShadow,
  },
  hubCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  hubLogo: { fontSize: 28, fontWeight: '800', color: '#C8A96A' },
  hubTitle: { fontSize: 16, fontWeight: '800' },
  hubSub: { fontSize: 12, marginTop: 2 },
  hubArrow: { fontSize: 22, color: NAVY, fontWeight: '300' },
  pcCover: {
    height: 60,
    backgroundColor: NAVY,
  },
  pcCoverPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    backgroundColor: NAVY_LIGHT,
  },
  pcBody: { paddingHorizontal: 16, paddingBottom: 16 },
  pcAvWrap: { marginTop: -28, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  pcAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#5f4635',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcAvatarImg: { width: '100%', height: '100%' },
  pcAvatarFallback: { color: '#fff', fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  pcEditBtn: { borderWidth: 1.5, borderColor: NAVY_LIGHT, backgroundColor: NAVY_LIGHT, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  pcEditBtnText: { color: NAVY, fontSize: 11, fontWeight: '700' },
  pcName: { color: TEXT, fontSize: 20, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  pcMeta: { color: TEXT_SOFT, fontSize: 11, marginTop: 3, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  badgeChip: { fontSize: 9, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeGold: { backgroundColor: '#C8A96A', color: '#000' },
  badgeNavy: { backgroundColor: NAVY_LIGHT, color: NAVY },
  badgeGreen: { backgroundColor: GREEN_LIGHT, color: GREEN },

  rsCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rsBig: { fontSize: 36, lineHeight: 38, color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  rsDots: { flexDirection: 'row', gap: 3, marginTop: 6 },
  rsDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  rsDotFull: { backgroundColor: 'rgba(255,255,255,0.88)' },
  rsDotHalf: { backgroundColor: 'rgba(255,255,255,0.4)' },
  rsLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  rsStatus: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 2 },
  rsSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  rsArrow: { color: 'rgba(255,255,255,0.45)', fontSize: 16 },

  groupLabel: {
    marginTop: 2,
    marginBottom: 6,
    marginHorizontal: 20,
    color: TEXT_SOFT,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: 'hidden',
    ...cardShadow,
  },
  settingRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  srIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  srIconText: { fontSize: 16 },
  sriNavy: { backgroundColor: NAVY_LIGHT },
  sriGreen: { backgroundColor: GREEN_LIGHT },
  sriAmber: { backgroundColor: AMBER_LIGHT },
  sriBlue: { backgroundColor: '#DBEAFE' },
  sriGold: { backgroundColor: '#FEF3C7' },
  sriDark: { backgroundColor: '#F5F5F5' },
  sriRed: { backgroundColor: RED_LIGHT },
  srBody: { flex: 1 },
  srLabel: { color: TEXT, fontSize: 13, fontWeight: '500' },
  srSub: { color: TEXT_SOFT, fontSize: 10, marginTop: 1 },
  srRight: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  srArrow: { color: '#D4D4D4', fontSize: 14 },

  appInfo: { paddingTop: 12, paddingHorizontal: 16, alignItems: 'center' },
  appLogo: { color: NAVY, fontSize: 30, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  appVer: { marginTop: 2, color: TEXT_SOFT, fontSize: 11 },
  linkRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  infoLink: { color: NAVY, fontSize: 11, fontWeight: '500' },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    borderTopWidth: 1.5,
    borderTopColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.98)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 12,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIconOff: { fontSize: 16, color: TEXT_MID },
  navLabelOff: { fontSize: 8, color: TEXT_SOFT, fontWeight: '500' },
  activeNavCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  activeNavCircleText: { color: '#fff', fontSize: 14 },
  navLabelOn: { fontSize: 8, color: '#000', fontWeight: '700' },
});
