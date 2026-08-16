import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MOOD_TAGS_40 } from '../constants/moodTags';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#f9a13d';
const DARK_CARD = '#1a1a1a';
const TEXT_PRIMARY = '#f4f4f5';
const TEXT_SECONDARY = '#a1a1aa';

const INTERESTS = [
  // 7 groups x 8 = 56 options
  'Kahve', 'Cay', 'Brunch', 'Sokak Lezzetleri', 'Fine Dining', 'Tatlilar', 'Vegan', 'Yemek Pisirme',
  'Kitaplar', 'Siir', 'Film', 'Dizi', 'Tiyatro', 'Muzeler', 'Fotografcilik', 'Tasarim',
  'Kosu', 'Fitness', 'Yoga', 'Pilates', 'Bisiklet', 'Dogada Yuruyus', 'Tenis', 'Yuzme',
  'Jazz', 'Rock', 'Elektronik', 'Klasik', 'Hip Hop', 'Karaoke', 'DJ Setleri', 'Canli Gruplar',
  'Startuplar', 'Yapay Zeka', 'Kodlama', 'Urun', 'Pazarlama', 'Finans', 'Munazara', 'Diller',
  'Kutu Oyunlari', 'Satranc', 'Trivia', 'Escape Room', 'Oyun', 'Anime', 'Cizgi Roman', 'Podcast',
  'Gonulluluk', 'Networking', 'Mindfulness', 'Meditasyon', 'Seyahat', 'Doga', 'Evcil Hayvanlar', 'Topluluk',
];
const MOOD_TAGS = MOOD_TAGS_40;

const CITIES = ['Milano', 'Istanbul', 'London'];

const PIVOT_HOSTS = {
  Milano: ['Giulia · Coffee & Books', 'Marco · Run Club'],
  Istanbul: ['Ece · Art & Film', 'Kaan · Tech & Startup'],
  London: ['Amelia · Wellnes', 'Noah · Muzik Cemberi'],
};

const STEPS = [
  { key: 'welcome', icon: 'insights', title: "LOCAL'e Hos Geldin" },
  { key: 'interests', icon: 'interests', title: 'Ilgi Alanlarini Sec' },
  { key: 'city', icon: 'location-city', title: 'Sehrini Sec' },
  { key: 'university', icon: 'school', title: 'Universite E-postasi' },
  { key: 'pivot', icon: 'stars', title: 'Onerilen Pivot Hostlar' },
  { key: 'ready', icon: 'check-circle', title: 'Hazirsin' },
];

export default function OnboardingOverlay({ visible, onFinish, onSaveProfile }) {
  const [step, setStep] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedCity, setSelectedCity] = useState('Milano');
  const [universityEmail, setUniversityEmail] = useState('');
  const [selectedMoods, setSelectedMoods] = useState([]);
  const current = STEPS[step] || STEPS[0];
  const isLast = step === STEPS.length - 1;
  const hasValidUniversityEmail = /^[^\s@]+@[^\s@]+\.(edu|ac\.[a-z]{2,})$/i.test(
    universityEmail.trim()
  );
  const canContinue =
    (current.key !== 'interests' || selectedInterests.length >= 3) &&
    (current.key !== 'university' || hasValidUniversityEmail);

  const pivotHosts = useMemo(
    () => PIVOT_HOSTS[selectedCity] || PIVOT_HOSTS.Milano,
    [selectedCity]
  );
  const suggestedCity = useMemo(() => {
    const value = universityEmail.trim().toLowerCase();
    if (!value.includes('@')) return null;
    if (value.endsWith('.it') || value.includes('polimi') || value.includes('unimi')) return 'Milano';
    if (value.includes('.tr')) return 'Istanbul';
    if (value.includes('.uk') || value.includes('ac.uk')) return 'London';
    return null;
  }, [universityEmail]);
  useEffect(() => {
    if (suggestedCity) setSelectedCity(suggestedCity);
  }, [suggestedCity]);

  const handleNext = () => {
    if (!canContinue) return;
    if (isLast) {
      if (onSaveProfile) {
        onSaveProfile({
          city: selectedCity,
          interests: selectedInterests,
          moods: selectedMoods,
          university_email: universityEmail.trim(),
        });
      }
      onFinish();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  if (!visible) return null;

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      return [...prev, interest];
    });
  };

  const renderStepContent = () => {
    if (current.key === 'welcome') {
      return (
        <>
          <Text style={styles.description}>
            Real moments, real connections. LOCAL ranks trust with behavior, not
            likes.
          </Text>
          <Text style={styles.helper}>
            Sirada: ilgi alanlarini sec, sehir sec ve iki pivot hostu gor.
          </Text>
        </>
      );
    }

    if (current.key === 'interests') {
      return (
        <>
          <Text style={styles.description}>
            Select at least 3 interests so we can personalize rituals for you.
          </Text>
          <View style={styles.chips}>
            {INTERESTS.map((interest) => {
              const active = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.helper}>
            Selected: {selectedInterests.length} / min 3
          </Text>
          <Text style={[styles.helper, { marginTop: 8 }]}>Mood tags</Text>
          <View style={styles.chips}>
            {MOOD_TAGS.map((mood) => {
              const active = selectedMoods.includes(mood);
              return (
                <TouchableOpacity
                  key={mood}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setSelectedMoods((prev) =>
                      prev.includes(mood) ? prev.filter((x) => x !== mood) : [...prev, mood]
                    )
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{mood}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (current.key === 'city') {
      return (
        <>
          <Text style={styles.description}>
            Your city sets Pulse and City Rhythm defaults.
          </Text>
          <View style={styles.cityList}>
            {suggestedCity ? (
              <Text style={styles.helper}>Auto suggestion from email domain: {suggestedCity}</Text>
            ) : null}
            {CITIES.map((city) => {
              const active = city === selectedCity;
              return (
                <TouchableOpacity
                  key={city}
                  style={[styles.cityItem, active && styles.cityItemActive]}
                  onPress={() => setSelectedCity(city)}
                >
                  <Text style={[styles.cityText, active && styles.cityTextActive]}>
                    {city}
                    {city === 'Milano' ? ' (active)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      );
    }

    if (current.key === 'university') {
      return (
        <>
          <Text style={styles.description}>
            Add your university email now to speed up verification and unlock all actions.
          </Text>
          <TextInput
            value={universityEmail}
            onChangeText={setUniversityEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@university.edu"
            placeholderTextColor="#71717a"
            style={styles.emailInput}
          />
          <Text style={styles.helper}>
            Accepted formats: `.edu` or `.ac.xx` domains
          </Text>
        </>
      );
    }

    if (current.key === 'ready') {
      return (
        <View style={styles.readyCard}>
          <Text style={styles.description}>
            Your profile is ready. RS starts at 5.0 and grows with real participation.
          </Text>
          <Text style={styles.readyRs}>RS 5,0</Text>
          <Text style={styles.helper}>
            LOCAL'a Gir ->
          </Text>
        </View>
      );
    }

    return (
      <>
        <Text style={styles.description}>
          Based on your interests and city, start with these community anchors.
        </Text>
        <View style={styles.hostList}>
          {pivotHosts.map((host) => (
            <View key={host} style={styles.hostCard}>
              <MaterialIcons name="verified" size={16} color={PRIMARY_COLOR} />
              <Text style={styles.hostText}>{host}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.helper}>
          You can join one now from Pulse after onboarding.
        </Text>
        <View style={styles.pivotActions}>
          {pivotHosts.map((host, idx) => (
            <TouchableOpacity key={`${host}-cta`} style={styles.pivotCta}>
              <Text style={styles.pivotCtaText}>Rituale Katil · Pivot Host {idx + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name={current.icon} size={48} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.title}>{current.title}</Text>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {renderStepContent()}
            </ScrollView>

            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === step && styles.dotActive]}
                />
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Gec</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextButton, !canContinue && styles.nextButtonDisabled]}
                onPress={handleNext}
                disabled={!canContinue}
              >
                <Text style={styles.nextText}>{isLast ? 'Baslayalim' : 'Ileri'}</Text>
                {!isLast && (
                  <MaterialIcons name="arrow-forward" size={18} color="#000" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  safe: {
    alignItems: 'center',
  },
  card: {
    width: width - 48,
    maxWidth: 360,
    backgroundColor: DARK_CARD,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  readyCard: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#11204a',
  },
  readyRs: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#dbeafe',
    textAlign: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(249, 161, 61, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  body: {
    maxHeight: 260,
    width: '100%',
    marginBottom: 24,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  helper: {
    fontSize: 13,
    color: '#d4d4d8',
    textAlign: 'center',
    marginTop: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: PRIMARY_COLOR,
    width: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonDisabled: {
    opacity: 0.45,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(249, 161, 61, 0.2)',
  },
  chipText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
  },
  chipTextActive: {
    color: '#ffe1be',
    fontWeight: '600',
  },
  cityList: {
    marginTop: 14,
    gap: 8,
  },
  cityItem: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cityItemActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(249, 161, 61, 0.2)',
  },
  cityText: {
    color: TEXT_PRIMARY,
    textAlign: 'center',
    fontSize: 14,
  },
  cityTextActive: {
    fontWeight: '700',
    color: '#ffe1be',
  },
  emailInput: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT_PRIMARY,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  hostList: {
    marginTop: 14,
    gap: 10,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hostText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
  },
  pivotActions: { marginTop: 10, gap: 8 },
  pivotCta: {
    borderRadius: 10,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 9,
    alignItems: 'center',
  },
  pivotCtaText: { color: '#111', fontWeight: '800', fontSize: 12 },
});
