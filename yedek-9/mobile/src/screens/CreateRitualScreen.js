import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { createRitual, publishRitual, fetchUserRecentRituals, getManagedVenues, fetchCategories, fetchVenueSlots, nominateVenuePlace } from '../services/api';
import { getApiErrorMessage, getPenaltyBannerText } from '../utils/penaltyHelpers';
import { t } from '../i18n/stringTable';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import {
  buildLiveWindowOptions,
  buildLocationTypeOptions,
  getGpsBoundsForLocationType,
  isScheduledLocationType,
} from '../constants/localConfig';
import { requireVerifiedUser } from '../utils/verificationGuard';
import MainBottomNav from '../components/MainBottomNav';

const ZONE_RADIUS_PRESETS = [75, 85, 100];

const PRIMARY_COLOR = '#000000';
const LIGHT_BACKGROUND = '#ffffff';
const CARD_BACKGROUND = '#ffffff';
const LIGHT_CARD = '#ffffff';
const LIGHT_CARD_BORDER = '#e8e8e8';
const DARK_TEXT_PRIMARY = '#000000';
const DARK_TEXT_SECONDARY = '#666666';
const DARK_TEXT_TERTIARY = '#999999';
const LIGHT_BUTTON_BG = '#ffffff';
const LIGHT_BUTTON_BORDER = '#dddddd';

const CATEGORIES = [
  // Sosyal ve Yiyecek
  'Kahve', 'Yemek', 'Sarap ve Icecekler', 'Craft Bira', 'Cay Seremonisi', 'Mutfak', 'Aperitivo', 'Vegan',
  'Topluluk', 'Sosyal', 'Mahalle', 'Gun Dogumu', 'Gece Hayati', 'Festival', 'Kutlama', 'Uluslararasi',
  // Zihin ve Bilgi
  'Felsefe', 'Kitaplar', 'Diller', 'Bilim', 'Yazi', 'Tartisma', 'Hikaye Anlatimi', 'Calisma',
  'Finans', 'Hukuk', 'Psikoloji', 'Siyaset', 'Tarih', 'Astronomi', 'Cografya', 'Gazetecilik',
  // Sanat ve Kultur
  'Muzik', 'Gorsel Sanatlar', 'Film', 'Tiyatro', 'Fotografcilik', 'Dans', 'Acik Mikrofon', 'Galeri',
  'Podcast', 'Klasik Muzik', 'Dogaclama', 'Siir', 'Sokak Sanati', 'El Sanatlari', 'Moda', 'Mimari',
  // Aktif ve Spor
  'Kosu', 'Bisiklet', 'Spor', 'Yuzme', 'Tirmanma', 'Yuruyus', 'Futbol', 'Masa Tenisi',
  'Badminton', 'Tenis', 'Kaykay', 'Boks / Dovus Sanatlari', 'Bouldering', 'Akrobasi', 'Su Sporlari', 'Kis Sporlari',
  // Zihin ve Beden
  'Yoga', 'Farkindalik', 'Doga', 'Surdurulebilirlik', 'Gun Dogumu Rituali', 'Oz Bakim',
  'Soguk Maruziyet', 'Beslenme', 'Uyku Bilimi', 'Saglik', 'Cicek ve Botanik', 'Evcil Hayvan Sahipleri',
  // Nis ve Oyunlar
  'Satranc', 'Oyun', 'Kart Oyunlari', 'Masa Oyunlari', 'Tarot', 'Bulmacalar',
  'Dart', 'Koleksiyon', 'Yildiz Gozlemi', 'Comlekcilik', 'Bahcecilik', 'Dikis',
  // Teknoloji ve Kariyer
  'Teknoloji', 'Girisimler', 'Yapay Zeka', 'Veri Bilimi', 'Maker / Donanim', 'Siber Guvenlik', 'Arastirma', 'Web3 ve Kripto',
];
const DURATIONS = ['30 min', '1 hour', '2 hours', '2.5 hours', '3 hours', '4 hours', '6 hours'];
const FORUM_SURFACES = [
  {
    value: 'whole_window',
    label: 'Tum Window',
    description: 'Canli Window icerigi yorumlanabilir',
  },
  {
    value: 'memories_only',
    label: 'Sadece Anilar',
    description: 'Yalnizca Local World\'e paylasilan anilar',
  },
];
const TIME_TYPES = [
  { value: 'instant', label: 'Anlık', description: 'Şimdi başlar' },
  { value: 'planned', label: 'Planlı', description: 'Belirli başlangıç zamanı' },
  { value: 'series', label: 'Seri', description: 'Aynı ritüelin haftalık veya iki haftalık serisi' },
];
/** §7 — host onayli "Yer Iste" yolu kaldirildi; acik veya davetli */
const ENTRY_TYPES = [
  { value: 'open', label: 'Acik', description: 'Herkes katilabilir' },
  { value: 'invite_only', label: 'Davetli', description: 'Yalnizca davet ile' },
];
const SERIES_CADENCES = [
  { value: 'WEEKLY', label: 'Her hafta', description: '7 gunde bir yeni Ritual' },
  { value: 'BIWEEKLY', label: 'Iki haftada bir', description: '14 gunde bir yeni Ritual' },
];
const SERIES_END_OPTIONS = [
  { value: null, label: 'Acik uclu' },
  { value: 4, label: '4 tekrar' },
  { value: 8, label: '8 tekrar' },
  { value: 12, label: '12 tekrar' },
];
/** §14 — min-RS yok; üni kapısı var */
const UNIVERSITY_GATES = [
  { value: null, label: 'Üni koşulu yok', description: 'Herkes (diğer koşullara bağlı)' },
  { value: 'same_uni', label: 'Sadece üniversitem', description: 'Host ile aynı üni' },
  { value: 'uni_only', label: 'Sadece üniversiteliler', description: 'Şerit-B katılamaz' },
];
const RITUAL_VISIBILITY = [
  { value: 'public', label: 'Public', description: 'Kesifte herkese acik' },
  { value: 'venue_only', label: 'Venue Only', description: 'Mekan / katilimcilar' },
  { value: 'regular_only', label: 'Regular Only', description: 'Duzenli musteriler' },
];
/** §2C discovery audience — visibility'den ayrı */
const RITUAL_AUDIENCE = [
  { value: 'PUBLIC', label: 'Herkes', description: 'Kesifte herkese acik' },
  { value: 'FRIENDS', label: 'Arkadaslar', description: 'Yalniz FL arkadaslarina kesif' },
];
const DEFINITION_LEVELS = [
  { value: 'bos', label: 'Bos', description: 'Minimal tanim' },
  { value: 'kategori', label: 'Kategori', description: 'Kategori odakli' },
  { value: 'tam', label: 'Tam', description: 'Baslik + kategori' },
  { value: 'user_oneri', label: 'Oneri', description: 'Kullanici onerisi' },
];
const HOBBIES = ['Reading', 'Cooking', 'Running', 'Music', 'Hiking'];

export default function CreateRitualScreen({ navigation, route }) {
  const publicConfig = useConfigStore((s) => s.config);
  const sparkMeetupId = route?.params?.sparkMeetupId || route?.params?.spark_meetup_id || null;
  const minRitualSize = publicConfig.ritual.min_size;
  const absoluteMaxCap = Number(publicConfig.ritual.custom_max_cap) || 40;
  const categorySoftCaps = publicConfig.ritual.category_soft_caps || {};
  const minDurationMinutes = publicConfig.ritual.duration_min_minutes;
  const maxDurationMinutes = publicConfig.ritual.duration_max_minutes;
  const liveWindows = buildLiveWindowOptions(publicConfig);
  const locationTypes = buildLocationTypeOptions(publicConfig);
  const isDark = !!route?.params?.forceDark;
  const theme = isDark
    ? {
        bg: '#020617',
        card: '#0f172a',
        border: '#1e293b',
        text: '#f8fafc',
        muted: '#94a3b8',
        inputBg: '#111827',
        inputBorder: '#334155',
        chipBg: '#1f2937',
        chipText: '#e5e7eb',
        footerBg: '#020617',
      }
    : {
        bg: CARD_BACKGROUND,
        card: LIGHT_CARD,
        border: LIGHT_CARD_BORDER,
        text: DARK_TEXT_PRIMARY,
        muted: DARK_TEXT_SECONDARY,
        inputBg: LIGHT_BUTTON_BG,
        inputBorder: LIGHT_BUTTON_BORDER,
        chipBg: '#e8e8e8',
        chipText: DARK_TEXT_SECONDARY,
        footerBg: '#ffffff',
      };
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('Morning Coffee Circle');
  const [selectedCategory, setSelectedCategory] = useState('Coffee');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('9:00');
  const [location, setLocation] = useState('Brera');
  const [selectedDuration, setSelectedDuration] = useState('2 hours');
  const [selectedLiveWindow, setSelectedLiveWindow] = useState(
    () => Number(publicConfig?.ritual?.window_hours_default) || 12
  );
  const [openForum, setOpenForum] = useState(false);
  const [forumSurface, setForumSurface] = useState('whole_window');
  /** §12 — DEFAULT CLOSED; TRANSPARENT = window şehre okunur */
  const [windowVisibility, setWindowVisibility] = useState('CLOSED');
  /** §2 — default false; true ise alım kilit anında kapanır */
  const [plannersOnly, setPlannersOnly] = useState(false);
  const [capacity, setCapacity] = useState(10);
  const [selectedEntryType, setSelectedEntryType] = useState('open');
  const [universityGate, setUniversityGate] = useState(null);
  const [ritualVisibility, setRitualVisibility] = useState('public');
  const [discoveryAudience, setDiscoveryAudience] = useState('PUBLIC');
  const [feeAmount, setFeeAmount] = useState('');
  const [definitionLevel, setDefinitionLevel] = useState('tam');
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [checkInRadius, setCheckInRadius] = useState('');
  const [locationType, setLocationType] = useState('custom');
  const [isHome, setIsHome] = useState(false);
  const [timeType, setTimeType] = useState('planned');
  const [seriesCadence, setSeriesCadence] = useState('WEEKLY');
  const [seriesEndAfterWeeks, setSeriesEndAfterWeeks] = useState(null);
  const [apiCategories, setApiCategories] = useState([]);
  const [selectedHobbies, setSelectedHobbies] = useState(['Running']);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [managedVenues, setManagedVenues] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState(null); // venue_id when user manages a venue and selects it
  const [venueSlots, setVenueSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const eligibilityCheckRef = useRef(false); // Prevent multiple simultaneous calls
  const isMountedRef = useRef(true);

  const { user } = useAuthStore();
  const penaltyBannerText = getPenaltyBannerText(user?.penalty);
  const hostCreateBlocked =
    !!user?.penalty?.is_host_banned || !!user?.penalty?.is_penalty_suspended;
  const currentUserId = user?.id;

  const handleLocationTypeChange = (nextType) => {
    setLocationType(nextType);
    if (nextType !== 'custom') setIsHome(false);
    if (isScheduledLocationType(nextType) && (timeType === 'series' || timeType === 'recurring')) {
      setTimeType('planned');
    }
    if (nextType === 'zone') {
      const zoneDefault = String(getGpsBoundsForLocationType('zone', publicConfig).min);
      setCheckInRadius((prev) => (prev.trim() ? prev : zoneDefault));
    }
  };

  const leaveCreate = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Pulse');
  };

  useEffect(() => {
    isMountedRef.current = true;
    checkEligibility();
    loadManagedVenues();
    fetchCategories().then((cats) => {
      if (isMountedRef.current && Array.isArray(cats) && cats.length) {
        setApiCategories(cats.map((c) => c.name || c.slug || c.title).filter(Boolean));
      }
    }).catch(() => {});
    return () => { isMountedRef.current = false; };
  }, [currentUserId]);

  const loadManagedVenues = async () => {
    if (!currentUserId) return;
    try {
      const list = await getManagedVenues();
      if (isMountedRef.current) setManagedVenues(Array.isArray(list) ? list : []);
    } catch (e) {
      if (__DEV__) console.warn('Could not load managed venues:', e?.message);
      if (isMountedRef.current) setManagedVenues([]);
    }
  };

  const parseDurationMinutes = (durationStr) => {
    const s = String(durationStr || '').trim().toLowerCase();
    if (s.includes('hour')) {
      const num = parseFloat(s);
      return Math.round(num * 60);
    }
    return parseInt(s, 10);
  };

  useEffect(() => {
    if (!selectedVenueId) {
      setVenueSlots([]);
      setSelectedSlotId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingSlots(true);
        const slots = await fetchVenueSlots(selectedVenueId, { status: 'open' });
        if (!cancelled) {
          setVenueSlots(Array.isArray(slots) ? slots : []);
          setSelectedSlotId(null);
        }
      } catch (_e) {
        if (!cancelled) setVenueSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVenueId]);

  const checkEligibility = async () => {
    if (!currentUserId) {
      if (isMountedRef.current) {
        setCanCreate(false);
        setCheckingEligibility(false);
      }
      return;
    }

    // Prevent multiple simultaneous calls
    if (eligibilityCheckRef.current) {
      return;
    }

    eligibilityCheckRef.current = true;

    try {
      setCheckingEligibility(true);
      // Check if user has attended any rituals
      const rituals = await fetchUserRecentRituals(currentUserId, 1);
      if (isMountedRef.current) {
        setCanCreate(rituals && rituals.length > 0);
      }
    } catch (error) {
      // Handle rate limiting (429) gracefully
      if (error.message?.includes('429') || error.status === 429) {
        if (__DEV__) console.warn('Rate limited while checking eligibility. Will retry later.');
        // Silently fail for rate limiting - user can still try to create
        // The backend will validate eligibility when creating anyway
        if (isMountedRef.current) {
          setCanCreate(false);
        }
      } else {
        console.error('Error checking eligibility:', error);
        if (isMountedRef.current) {
          setCanCreate(false);
        }
      }
    } finally {
      eligibilityCheckRef.current = false;
      if (isMountedRef.current) {
        setCheckingEligibility(false);
      }
    }
  };

  const toggleHobby = (hobby) => {
    setSelectedHobbies(prev =>
      prev.includes(hobby)
        ? prev.filter(h => h !== hobby)
        : [...prev, hobby]
    );
  };

  const handleCreate = async (opts = {}) => {
    const forceSoftCap = opts.forceSoftCap === true;
    if (!requireVerifiedUser(user, 'Ritual olusturmadan once universite e-postani dogrulamalisin.')) {
      return;
    }

    if (!canCreate) {
      Alert.alert(
        'Once Bir Rituale Katil',
        'Kendi Ritualsini olusturmadan once en az bir Rituale katilmalisin. Baslamak icin Pulse veya City Rhythm ekraninda Ritual kesfet.',
        [
          { text: 'Tamam' },
          {
            text: 'Ritualsi Kesfet',
            onPress: () => navigation.navigate('Main', { screen: 'Pulse' })
          }
        ]
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert('Hata', 'Lutfen Ritual basligi gir');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Hata', 'Lutfen bir kategori sec');
      return;
    }

    if (!time || !location) {
      Alert.alert('Hata', 'Lutfen saat ve konum gir');
      return;
    }

    try {
      setCreating(true);

      // Parse time
      const [hours, minutes] = time.split(':').map(Number);
      const startTime = timeType === 'instant' ? new Date() : new Date();
      if (timeType !== 'instant') {
        startTime.setHours(hours, minutes || 0, 0, 0);
      }

      const durationMinutes = parseDurationMinutes(selectedDuration);

      if (
        !Number.isFinite(durationMinutes) ||
        durationMinutes < minDurationMinutes ||
        durationMinutes > maxDurationMinutes
      ) {
        Alert.alert('Hata', `Sure ${minDurationMinutes} dakika ile 24 saat arasinda olmali`);
        return;
      }

      if (capacity < minRitualSize) {
        Alert.alert('Hata', `Kapasite en az ${minRitualSize} olmali`);
        return;
      }

      if (capacity > absoluteMaxCap) {
        Alert.alert(
          'Kapasite tavanı',
          `Tek masa en fazla ${absoluteMaxCap} kişi. ${absoluteMaxCap + 1}+ için event_group veya venue event gerekir.`
        );
        return;
      }

      const soft =
        categorySoftCaps[selectedCategory] ||
        categorySoftCaps[String(selectedCategory || '').toLowerCase().replace(/\s+/g, '_')] ||
        categorySoftCaps.diger ||
        null;
      const softMax = soft?.soft_max != null ? Number(soft.soft_max) : null;
      if (softMax != null && capacity > softMax && !forceSoftCap) {
        setCreating(false);
        Alert.alert(
          'Kategori önerisi',
          `${selectedCategory} için önerilen üst sınır ~${softMax}. Aşıp devam etmek ister misin?`,
          [
            { text: 'Düzenle', style: 'cancel' },
            {
              text: 'Aşıp devam et',
              onPress: () => handleCreate({ forceSoftCap: true }),
            },
          ]
        );
        return;
      }

      if (selectedLiveWindow * 60 < durationMinutes) {
        Alert.alert('Hata', 'Window suresi Ritual suresinden kisa olamaz (window >= duration)');
        return;
      }

      const locationLat = 45.4718;
      const locationLng = 9.1881;

      const locType = selectedVenueId ? 'venue' : locationType;
      if (isScheduledLocationType(locType) && (timeType === 'series' || timeType === 'recurring')) {
        Alert.alert('Tarifeli', 'Rota tek seferdir — seri açılamaz.');
        return;
      }
      const zoneBounds = getGpsBoundsForLocationType('zone', publicConfig);
      let parsedRadius = checkInRadius.trim() ? Number(checkInRadius) : null;
      if (locType === 'zone' && (parsedRadius == null || Number.isNaN(parsedRadius))) {
        parsedRadius = zoneBounds.min;
      }

      if (parsedRadius != null && !Number.isNaN(parsedRadius)) {
        const b = getGpsBoundsForLocationType(locType, publicConfig);
        if (parsedRadius < b.min || parsedRadius > b.max) {
          Alert.alert('Hata', `GPS yaricapi (${locType}) ${b.min}-${b.max}m arasinda olmali`);
          return;
        }
      }

      const ritualData = {
        title: title.trim(),
        type: selectedCategory,
        venue_name: location.trim(),
        start_time: startTime.toISOString(),
        duration: durationMinutes,
        capacity: capacity,
        entry_type: selectedEntryType,
        university_gate: universityGate,
        location_lat: locationLat,
        location_lng: locationLng,
        host_id: currentUserId,
        description: description.trim() || null,
        live_window_hours: selectedLiveWindow,
        window_type: openForum ? 'open_forum' : 'ephemeral',
        forum_surface: forumSurface,
        window_visibility: windowVisibility,
        planners_only: plannersOnly,
        location_type: selectedVenueId ? 'venue' : locationType,
        is_home: !selectedVenueId && locationType === 'custom' && isHome,
        is_recurring:
          isScheduledLocationType(selectedVenueId ? 'venue' : locationType)
            ? false
            : timeType === 'series' || timeType === 'recurring',
        time_type: isScheduledLocationType(selectedVenueId ? 'venue' : locationType)
          ? (timeType === 'instant' ? 'instant' : 'fixed')
          : timeType === 'planned'
            ? 'fixed'
            : timeType === 'series'
              ? 'recurring'
              : timeType,
        definition_level: definitionLevel,
        visibility: ritualVisibility,
        audience: discoveryAudience,
        related_hobbies: selectedHobbies,
        draft: saveAsDraft,
        spark_born: !selectedVenueId && locationType === 'zone' && timeType === 'instant',
      };
      const feeNum = feeAmount.trim() ? Number(feeAmount.replace(',', '.')) : null;
      if (feeNum != null && Number.isFinite(feeNum) && feeNum >= 0) {
        ritualData.fee = {
          amount: feeNum,
          currency: publicConfig?.ritual?.fee_currency_default || 'TRY',
          note: publicConfig?.ritual?.fee_note_default || 'yerinde ödenir',
        };
      }
      if (sparkMeetupId) {
        ritualData.spark_meetup_id = sparkMeetupId;
        ritualData.spark_born = true;
      }
      if (timeType === 'series' && !isScheduledLocationType(selectedVenueId ? 'venue' : locationType)) {
        ritualData.series_cadence = seriesCadence;
        ritualData.series_end_after_weeks = seriesEndAfterWeeks;
      }
      if (isScheduledLocationType(selectedVenueId ? 'venue' : locationType) && location.trim()) {
        ritualData.route_id = location.trim();
      }
      if (selectedVenueId) ritualData.venue_id = selectedVenueId;
      if (selectedSlotId) ritualData.slot_id = selectedSlotId;
      if (parsedRadius != null && !Number.isNaN(parsedRadius) && parsedRadius > 0) {
        ritualData.check_in_radius = Math.round(parsedRadius);
      }

      const result = await createRitual(ritualData);
      if (__DEV__) console.log('Ritual created:', result);

      const successMsg = saveAsDraft
        ? 'Taslak kaydedildi. Yayinlamak icin Ritual detayindan "Yayinla"ya bas.'
        : 'Ritual basariyla olusturuldu!';

      const isFreeCreate = !selectedVenueId && !saveAsDraft;
      const buttons = [
        {
          text: 'Tamam',
          onPress: () => {
            if (saveAsDraft && result?.id) {
              navigation.navigate('RitualDetail', { ritualId: result.id, ritual: result });
            } else {
              leaveCreate();
            }
          },
        },
      ];
      if (isFreeCreate) {
        buttons.unshift({
          text: 'Mekanı öner',
          onPress: async () => {
            try {
              await nominateVenuePlace({
                source: 'free_ritual',
                name: location.trim() || title.trim() || 'Onerilen mekan',
                lat: 45.4718,
                lng: 9.1881,
                note: `free_ritual:${result?.id || ''}`,
              });
              Alert.alert('Tesekkurler', 'Mekan onerin havuza dustu', [
                { text: 'Tamam', onPress: leaveCreate },
              ]);
            } catch (e) {
              Alert.alert('Hata', e?.message || 'Oneri gonderilemedi', [
                { text: 'Tamam', onPress: leaveCreate },
              ]);
            }
          },
        });
      }

      Alert.alert('Basarili', successMsg, buttons);
    } catch (error) {
      console.error('Error creating ritual:', error);
      
      // Handle specific error for attendance requirement
      if (error.requires_attendance || error.message?.includes('attend at least one ritual')) {
        Alert.alert(
          'Once Bir Rituale Katil',
          'Kendi Ritualsini olusturmadan once en az bir Rituale katilmalisin. Baslamak icin Pulse veya City Rhythm ekraninda Ritual kesfet.',
          [
            { text: 'Tamam' },
            {
              text: 'Ritualsi Kesfet',
              onPress: () => navigation.navigate('Main', { screen: 'Pulse' })
            }
          ]
        );
      } else if (error.code === 'HOST_BANNED' || error.code === 'PENALTY_SUSPENDED') {
        Alert.alert('Ritual Acilamaz', getApiErrorMessage(error, 'Ritual olusturma gecici olarak kapali.'));
      } else {
        Alert.alert('Hata', getApiErrorMessage(error, 'Ritual olusturma basarisiz'));
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && { backgroundColor: '#020617' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={[styles.safeArea, isDark && { backgroundColor: '#020617' }]} edges={['top']}>
        <View style={[styles.backgroundWrapper, isDark && { backgroundColor: '#020617' }]}>
          {/* Üst header */}
          <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={leaveCreate}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('create_ritual')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Form alanı */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {penaltyBannerText ? (
            <View style={styles.penaltyBanner}>
              <Text style={styles.penaltyBannerText}>{penaltyBannerText}</Text>
            </View>
          ) : null}
          {checkingEligibility ? (
            <View style={styles.eligibilityCheck}>
              <ActivityIndicator size="large" color={PRIMARY_COLOR} />
              <Text style={styles.eligibilityText}>Uygunluk kontrol ediliyor...</Text>
            </View>
          ) : !canCreate ? (
            <View style={styles.eligibilityMessage}>
              <MaterialIcons name="info-outline" size={48} color={PRIMARY_COLOR} style={styles.eligibilityIcon} />
              <Text style={styles.eligibilityTitle}>Once Bir Rituale Katil</Text>
              <Text style={styles.eligibilityMessageText}>
                Kendi Ritualsini olusturmadan once en az bir Rituale katilmalisin. Bu, kaliteyi ve topluluk uyumunu destekler.
              </Text>
              <Text style={styles.eligibilitySubtext}>
                Ilgini ceken bir sey bulmak icin Pulse veya City Rhythm ekraninda Ritual kesfet!
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate('Main', { screen: 'Pulse' })}
              >
                <MaterialIcons name="insights" size={20} color="#fff" style={styles.browseButtonIcon} />
                <Text style={styles.browseButtonText}>Ritualsi Kesfet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.browseButtonSecondary}
                onPress={() => navigation.navigate('Main', { screen: 'CityRhythm' })}
              >
                <MaterialIcons name="calendar-today" size={20} color={PRIMARY_COLOR} style={styles.browseButtonIcon} />
                <Text style={styles.browseButtonSecondaryText}>City Rhythm</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.formCard, { backgroundColor: theme.card }]}>
            {/* Ritual Title */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Ritual Basligi</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Ritual basligini gir"
                placeholderTextColor={DARK_TEXT_TERTIARY}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Kategori</Text>
              <View style={styles.tagContainer}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.tag,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      selectedCategory === category && styles.tagSelected,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: theme.chipText },
                        selectedCategory === category && styles.tagTextSelected,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Intent/Description */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Niyet/Aciklama</Text>
              <Text style={[styles.subLabel, { color: theme.muted }]}>Ne yapacagiz? (Opsiyonel)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Rituali acikla..."
                placeholderTextColor={DARK_TEXT_TERTIARY}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Venue (optional) - show when user manages venues */}
            {managedVenues.length > 0 && (
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Mekana Bagla</Text>
                <Text style={styles.subLabel}>Bu Rituali yonettigin bir mekana bagla (opsiyonel)</Text>
                <View style={styles.tagContainer}>
                  <TouchableOpacity
                    style={[styles.tag, !selectedVenueId && styles.tagSelected]}
                    onPress={() => {
                      setSelectedVenueId(null);
                    }}
                  >
                    <Text style={[styles.tagText, !selectedVenueId && styles.tagTextSelected]}>Yok</Text>
                  </TouchableOpacity>
                  {managedVenues.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.tag, selectedVenueId === v.id && styles.tagSelected]}
                      onPress={() => {
                        setSelectedVenueId(v.id);
                        setLocation(v.name || location);
                      }}
                    >
                      <Text style={[styles.tagText, selectedVenueId === v.id && styles.tagTextSelected]} numberOfLines={1}>
                        {v.name}{v.city ? ` · ${v.city}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedVenueId && (
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Mekan Slotu</Text>
                <Text style={[styles.subLabel, { color: theme.muted }]}>
                  Acik slot sec (opsiyonel — slot kapilir ve Rituale baglanir)
                </Text>
                {loadingSlots ? (
                  <ActivityIndicator size="small" color={theme.text} style={{ marginTop: 8 }} />
                ) : venueSlots.length === 0 ? (
                  <Text style={[styles.subLabel, { color: theme.muted, marginTop: 8 }]}>
                    Bu mekanda acik slot yok
                  </Text>
                ) : (
                  <View style={styles.tagContainer}>
                    <TouchableOpacity
                      style={[styles.tag, !selectedSlotId && styles.tagSelected]}
                      onPress={() => setSelectedSlotId(null)}
                    >
                      <Text style={[styles.tagText, !selectedSlotId && styles.tagTextSelected]}>Slot yok</Text>
                    </TouchableOpacity>
                    {venueSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot.id}
                        style={[styles.tag, selectedSlotId === slot.id && styles.tagSelected]}
                        onPress={() => setSelectedSlotId(slot.id)}
                      >
                        <Text
                          style={[styles.tagText, selectedSlotId === slot.id && styles.tagTextSelected]}
                          numberOfLines={1}
                        >
                          {slot.title}{slot.capacity ? ` · ${slot.capacity} kisi` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Time & Location */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Saat ve Konum</Text>
              <View style={styles.rowContainer}>
                <View style={[styles.halfInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <MaterialIcons
                    name="access-time"
                    size={20}
                    color={theme.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, styles.halfInput, { color: theme.text }]}
                    value={time}
                    onChangeText={setTime}
                    placeholder="9:00"
                    placeholderTextColor={DARK_TEXT_TERTIARY}
                  />
                </View>
                <View style={[styles.halfInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <MaterialIcons
                    name="place"
                    size={20}
                    color={theme.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.textInput, styles.halfInput, { color: theme.text }]}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Brera"
                    placeholderTextColor={DARK_TEXT_TERTIARY}
                  />
                </View>
              </View>
            </View>

            {/* Duration */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Sure</Text>
              <TouchableOpacity
                style={[styles.dropdownContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                onPress={() => setShowDurationPicker(!showDurationPicker)}
              >
                <MaterialIcons
                  name="access-time"
                  size={20}
                  color={theme.muted}
                  style={styles.inputIcon}
                />
                <Text style={[styles.dropdownText, { color: theme.text }]}>{selectedDuration}</Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={22}
                  color={theme.muted}
                />
              </TouchableOpacity>
              {showDurationPicker && (
                <View style={[styles.dropdownMenu, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {DURATIONS.map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      style={[styles.dropdownItem, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setSelectedDuration(duration);
                        setShowDurationPicker(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: theme.text }]}>{duration}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Live Ritual Window */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Canli Ritual Window</Text>
              <View style={styles.optionContainer}>
                {liveWindows.map((window) => (
                  <TouchableOpacity
                    key={window.value}
                    style={[
                      styles.optionButton,
                      selectedLiveWindow === window.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setSelectedLiveWindow(window.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        selectedLiveWindow === window.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {window.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.helperText, { color: theme.muted }]}>
                Anilarin ve sohbetin ne kadar aktif kalacagi
              </Text>
            </View>

            {/* §12 window_visibility — 7. adım/toggle · DEFAULT CLOSED */}
            <View style={styles.fieldContainer}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelBlock}>
                  <Text style={[styles.label, { color: theme.text, marginBottom: 4 }]}>
                    Window sehre acik
                  </Text>
                  <Text style={[styles.subLabel, { color: theme.muted }]}>
                    Kapali: soz/thought yalniz katilimcilara. Acik (TRANSPARENT): detayda sehir okur.
                    Katilimci listesi hicbir durumda disa acilmaz.
                  </Text>
                </View>
                <Switch
                  value={windowVisibility === 'TRANSPARENT'}
                  onValueChange={(on) => setWindowVisibility(on ? 'TRANSPARENT' : 'CLOSED')}
                  trackColor={{ false: theme.inputBorder, true: isDark ? '#3b82f6' : PRIMARY_COLOR }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Open Forum — §13: masa bitince tartışma devam etsin mi? */}
            <View style={styles.fieldContainer}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelBlock}>
                  <Text style={[styles.label, { color: theme.text, marginBottom: 4 }]}>
                    Masa bitince tartışma devam etsin mi?
                  </Text>
                  <Text style={[styles.subLabel, { color: theme.muted }]}>
                    Hayır — izler kalır, defter kapanır. Evet — forum açık kalır.
                  </Text>
                </View>
                <Switch
                  value={openForum}
                  onValueChange={setOpenForum}
                  trackColor={{ false: theme.inputBorder, true: isDark ? '#3b82f6' : PRIMARY_COLOR }}
                  thumbColor="#ffffff"
                />
              </View>
              {openForum && (
                <>
                  <Text style={[styles.subLabel, { color: theme.muted, marginTop: 12, marginBottom: 8 }]}>
                    Forum yuzeyi
                  </Text>
                  <View style={styles.forumSurfaceContainer}>
                    {FORUM_SURFACES.map((surface) => (
                      <TouchableOpacity
                        key={surface.value}
                        style={[
                          styles.forumSurfaceButton,
                          { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                          forumSurface === surface.value && styles.forumSurfaceButtonSelected,
                        ]}
                        onPress={() => setForumSurface(surface.value)}
                      >
                        <Text
                          style={[
                            styles.forumSurfaceLabel,
                            { color: theme.text },
                            forumSurface === surface.value && styles.forumSurfaceLabelSelected,
                          ]}
                        >
                          {surface.label}
                        </Text>
                        <Text
                          style={[
                            styles.forumSurfaceDescription,
                            { color: theme.muted },
                            forumSurface === surface.value && styles.forumSurfaceDescriptionSelected,
                          ]}
                        >
                          {surface.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* §2 planners_only */}
            <View style={styles.fieldContainer}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelBlock}>
                  <Text style={[styles.label, { color: theme.text, marginBottom: 4 }]}>
                    Sadece planlayanlar
                  </Text>
                  <Text style={[styles.subLabel, { color: theme.muted }]}>
                    Açıkken alım kilit anında kapanır. Kapalıyken join kapı kapanana dek açıktır.
                  </Text>
                </View>
                <Switch
                  value={plannersOnly}
                  onValueChange={setPlannersOnly}
                  trackColor={{ false: theme.inputBorder, true: isDark ? '#3b82f6' : PRIMARY_COLOR }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Capacity */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Kapasite</Text>
              <View style={styles.capacityContainer}>
                <TouchableOpacity
                  style={[styles.capacityButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                  onPress={() => {
                    setCapacity(Math.max(minRitualSize, capacity - 1));
                  }}
                >
                  <MaterialIcons
                    name="remove"
                    size={20}
                    color={theme.text}
                  />
                </TouchableOpacity>
                <Text style={[styles.capacityText, { color: theme.text }]}>{capacity} kisi</Text>
                <TouchableOpacity
                  style={[styles.capacityButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                  onPress={() => {
                    setCapacity(Math.min(absoluteMaxCap, capacity + 1));
                  }}
                >
                  <MaterialIcons
                    name="add"
                    size={20}
                    color={theme.text}
                  />
                </TouchableOpacity>
              </View>
              {(() => {
                const soft =
                  categorySoftCaps[selectedCategory] ||
                  categorySoftCaps[String(selectedCategory || '').toLowerCase().replace(/\s+/g, '_')] ||
                  categorySoftCaps.diger;
                const softMax = soft?.soft_max != null ? Number(soft.soft_max) : null;
                if (softMax != null && capacity > softMax) {
                  return (
                    <Text style={[styles.helperText, { color: '#b45309', marginTop: 8 }]}>
                      Öneri ~{softMax} · mutlak tavan {absoluteMaxCap}. Aşım host onaylı soft uyarıdır.
                    </Text>
                  );
                }
                return (
                  <Text style={[styles.helperText, { color: theme.muted, marginTop: 8 }]}>
                    Kategori soft öneri · tek masa mutlak tavan {absoluteMaxCap}
                  </Text>
                );
              })()}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Lokasyon Tipi</Text>
              <View style={styles.optionContainer}>
                {locationTypes.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.optionButton, { backgroundColor: theme.chipBg, borderColor: theme.chipBg }, locationType === t.value && styles.optionButtonSelected]}
                    onPress={() => handleLocationTypeChange(t.value)}
                  >
                    <Text style={[styles.optionButtonText, { color: theme.chipText }, locationType === t.value && styles.optionButtonTextSelected]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {locationType === 'custom' && !selectedVenueId ? (
              <View style={[styles.fieldContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.label, { color: theme.text }]}>Ev</Text>
                  <Text style={[styles.helperText, { color: theme.muted }]}>
                    Kimse girmezse kapıda düşer · katılımcı cezasız
                  </Text>
                </View>
                <Switch value={isHome} onValueChange={setIsHome} />
              </View>
            ) : null}

            {locationType === 'zone' && !selectedVenueId ? (
              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Zone GPS Yaricapi (75–100m)</Text>
                <View style={styles.optionContainer}>
                  {ZONE_RADIUS_PRESETS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.optionButton,
                        { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                        Number(checkInRadius) === m && styles.optionButtonSelected,
                      ]}
                      onPress={() => setCheckInRadius(String(m))}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          { color: theme.chipText },
                          Number(checkInRadius) === m && styles.optionButtonTextSelected,
                        ]}
                      >
                        {m}m
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Zaman Tipi</Text>
              <View style={styles.optionContainer}>
                {(isScheduledLocationType(locationType)
                  ? TIME_TYPES.filter((t) => t.value !== 'series')
                  : TIME_TYPES
                ).map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.optionButton, { backgroundColor: theme.chipBg, borderColor: theme.chipBg }, timeType === t.value && styles.optionButtonSelected]}
                    onPress={() => setTimeType(t.value)}
                  >
                    <Text style={[styles.optionButtonText, { color: theme.chipText }, timeType === t.value && styles.optionButtonTextSelected]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {isScheduledLocationType(locationType) && !selectedVenueId ? (
              <Text style={[styles.helperText, { color: theme.muted, marginTop: -8, marginBottom: 12 }]}>
                Tarifeli rota tek seferdir · skor hat-Aura
              </Text>
            ) : null}

            {timeType === 'series' ? (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, { color: theme.text }]}>Seri Tekrari</Text>
                  <Text style={[styles.subLabel, { color: theme.muted, marginBottom: 8 }]}>
                    Her tekrar ayri Ritual · kayit / kod / window / feedback bagimsiz
                  </Text>
                  <View style={styles.optionContainer}>
                    {SERIES_CADENCES.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        style={[
                          styles.optionButton,
                          { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                          seriesCadence === c.value && styles.optionButtonSelected,
                        ]}
                        onPress={() => setSeriesCadence(c.value)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            { color: theme.chipText },
                            seriesCadence === c.value && styles.optionButtonTextSelected,
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.subLabel, { color: theme.muted, marginTop: 6 }]}>
                    {SERIES_CADENCES.find((c) => c.value === seriesCadence)?.description}
                  </Text>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={[styles.label, { color: theme.text }]}>Seri Bitisi</Text>
                  <View style={styles.optionContainer}>
                    {SERIES_END_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={String(opt.value)}
                        style={[
                          styles.optionButton,
                          { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                          seriesEndAfterWeeks === opt.value && styles.optionButtonSelected,
                        ]}
                        onPress={() => setSeriesEndAfterWeeks(opt.value)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            { color: theme.chipText },
                            seriesEndAfterWeeks === opt.value && styles.optionButtonTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.subLabel, { color: theme.muted, marginTop: 6 }]}>
                    {seriesEndAfterWeeks
                      ? `${seriesEndAfterWeeks} tekrar sonra seri kapanir`
                      : 'Sen iptal edene kadar devam eder'}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Tanim Seviyesi</Text>
              <View style={styles.optionContainer}>
                {DEFINITION_LEVELS.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      definitionLevel === level.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setDefinitionLevel(level.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: theme.chipText },
                        definitionLevel === level.value && styles.optionButtonTextSelected,
                      ]}
                    >
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Gorunurluk (Kesif)</Text>
              <View style={styles.optionContainer}>
                {RITUAL_VISIBILITY.map((vis) => (
                  <TouchableOpacity
                    key={vis.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      ritualVisibility === vis.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setRitualVisibility(vis.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: theme.chipText },
                        ritualVisibility === vis.value && styles.optionButtonTextSelected,
                      ]}
                    >
                      {vis.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Kitle (Audience)</Text>
              <Text style={[styles.subLabel, { color: theme.muted, marginBottom: 8 }]}>
                FRIENDS: kesifte yalniz FL arkadaslarina. Visibility alanindan ayri.
              </Text>
              <View style={styles.optionContainer}>
                {RITUAL_AUDIENCE.map((aud) => (
                  <TouchableOpacity
                    key={aud.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      discoveryAudience === aud.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setDiscoveryAudience(aud.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: theme.chipText },
                        discoveryAudience === aud.value && styles.optionButtonTextSelected,
                      ]}
                    >
                      {aud.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Ucret (opsiyonel)</Text>
              <Text style={[styles.subLabel, { color: theme.muted, marginBottom: 8 }]}>
                Beyan edilir; yerinde odenir. Bos = ucretsiz. Kartta ₺ rozeti.
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
                ]}
                value={feeAmount}
                onChangeText={setFeeAmount}
                placeholder="ornek: 150"
                placeholderTextColor={theme.muted}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>
                {locationType === 'zone' && !selectedVenueId
                  ? 'Check-in Yaricapi (zone: 75–100m)'
                  : 'Check-in Yaricapi (m, opsiyonel)'}
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={checkInRadius}
                onChangeText={setCheckInRadius}
                keyboardType="number-pad"
                placeholder={
                  locationType === 'zone'
                    ? '75–100 (varsayilan 75)'
                    : 'Bos birak: lokasyon tipine gore (30-75m)'
                }
                placeholderTextColor={theme.muted}
              />
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelBlock}>
                  <Text style={[styles.label, { color: theme.text, marginBottom: 4 }]}>Taslak Olarak Kaydet</Text>
                  <Text style={[styles.subLabel, { color: theme.muted }]}>
                    Yayinlanmadan once duzenlemek icin CREATED durumunda tutulur
                  </Text>
                </View>
                <Switch
                  value={saveAsDraft}
                  onValueChange={setSaveAsDraft}
                  trackColor={{ false: theme.inputBorder, true: isDark ? '#3b82f6' : PRIMARY_COLOR }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Entry Type */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Katilim Tipi</Text>
              <View style={styles.optionContainer}>
                {ENTRY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      selectedEntryType === type.value &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setSelectedEntryType(type.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: theme.chipText },
                        selectedEntryType === type.value &&
                          styles.optionButtonTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.entryTypeDescriptions}>
                {ENTRY_TYPES.map((type) => (
                  <Text
                    key={type.value}
                    style={[styles.entryTypeDescription, { color: theme.muted }]}
                  >
                    {type.description}
                  </Text>
                ))}
              </View>
            </View>

            {/* §14 Üni kapısı — min-RS yok */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Üni koşulu</Text>
              <Text style={[styles.subLabel, { color: theme.muted, marginBottom: 8 }]}>
                min-RS yok · badge / kategori / kapasite ayrı
              </Text>
              <View style={styles.optionContainer}>
                {UNIVERSITY_GATES.map((g) => (
                  <TouchableOpacity
                    key={String(g.value)}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      universityGate === g.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setUniversityGate(g.value)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        { color: theme.chipText },
                        universityGate === g.value && styles.optionButtonTextSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Related Hobbies */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Ilgili Ilgi Alanlari</Text>
              <View style={styles.tagContainer}>
                {HOBBIES.map((hobby) => (
                  <TouchableOpacity
                    key={hobby}
                    style={[
                      styles.tag,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBg },
                      selectedHobbies.includes(hobby) && styles.tagSelected,
                    ]}
                    onPress={() => toggleHobby(hobby)}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        { color: theme.chipText },
                        selectedHobbies.includes(hobby) &&
                          styles.tagTextSelected,
                      ]}
                    >
                      {hobby}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          )}
        </ScrollView>
        {/* Footer butonu - ekranın en altında, safe area ile */}
        {canCreate && !checkingEligibility && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 16, backgroundColor: theme.footerBg, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.createButton,
                (creating || !canCreate || hostCreateBlocked) && styles.createButtonDisabled,
              ]}
              onPress={handleCreate}
              disabled={creating || !canCreate || hostCreateBlocked}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>
                  {saveAsDraft ? 'Taslak Kaydet' : 'Ritual Olustur ve Yayinla'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
      </SafeAreaView>
      <MainBottomNav navigation={navigation} activeTab="CreateRitual" forceDark={isDark} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0e0e0',
  },
  safeArea: {
    flex: 1,
    backgroundColor: CARD_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_CARD_BORDER,
  },
  backButton: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: DARK_TEXT_PRIMARY,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  backgroundWrapper: {
    flex: 1,
    backgroundColor: CARD_BACKGROUND,
    marginHorizontal: 0,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  formCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 0,
    padding: 20,
    borderWidth: 0,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: LIGHT_BUTTON_BG,
    borderWidth: 1,
    borderColor: LIGHT_BUTTON_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: DARK_TEXT_PRIMARY,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_BUTTON_BG,
    borderWidth: 1,
    borderColor: LIGHT_BUTTON_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  halfInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_BUTTON_BG,
    borderWidth: 1,
    borderColor: LIGHT_BUTTON_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: DARK_TEXT_PRIMARY,
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: LIGHT_CARD,
    borderWidth: 1,
    borderColor: LIGHT_CARD_BORDER,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_CARD_BORDER,
  },
  dropdownItemText: {
    fontSize: 15,
    color: DARK_TEXT_PRIMARY,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  tagSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK_TEXT_SECONDARY,
  },
  tagTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  optionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: DARK_TEXT_SECONDARY,
  },
  optionButtonTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: DARK_TEXT_TERTIARY,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabelBlock: {
    flex: 1,
  },
  forumSurfaceContainer: {
    gap: 8,
  },
  forumSurfaceButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  forumSurfaceButtonSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  forumSurfaceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  forumSurfaceLabelSelected: {
    color: '#ffffff',
  },
  forumSurfaceDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  forumSurfaceDescriptionSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  capacityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_BUTTON_BG,
    borderWidth: 1,
    borderColor: LIGHT_BUTTON_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  capacityText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: DARK_TEXT_PRIMARY,
    textAlign: 'center',
  },
  entryTypeDescriptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  entryTypeDescription: {
    flex: 1,
    fontSize: 11,
    color: DARK_TEXT_TERTIARY,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: LIGHT_CARD_BORDER,
  },
  createButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  eligibilityCheck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  eligibilityText: {
    marginTop: 16,
    fontSize: 16,
    color: DARK_TEXT_SECONDARY,
  },
  eligibilityMessage: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 24,
    padding: 32,
    margin: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LIGHT_CARD_BORDER,
  },
  eligibilityIcon: {
    marginBottom: 16,
  },
  eligibilityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
  },
  eligibilityMessageText: {
    fontSize: 16,
    color: DARK_TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  eligibilitySubtext: {
    fontSize: 14,
    color: DARK_TEXT_TERTIARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    width: '100%',
    marginBottom: 12,
  },
  browseButtonSecondary: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    width: '100%',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  browseButtonIcon: {
    marginRight: 8,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  browseButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  penaltyBanner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  penaltyBannerText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#92400e',
    fontWeight: '600',
  },
});