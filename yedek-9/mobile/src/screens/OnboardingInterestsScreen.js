import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MOOD_TAGS_40 } from '../constants/moodTags';

const INTEREST_GROUPS = [
  {
    title: 'Sosyal ve Yiyecek',
    items: [
      'Kahve', 'Yemek', 'Sarap ve Icecekler', 'Craft Bira', 'Cay Seremonisi', 'Mutfak', 'Aperitivo', 'Vegan',
      'Topluluk', 'Sosyal', 'Mahalle', 'Gun Dogumu', 'Gece Hayati', 'Festival', 'Kutlama', 'Uluslararasi',
    ],
  },
  {
    title: 'Zihin ve Bilgi',
    items: [
      'Felsefe', 'Kitaplar', 'Diller', 'Bilim', 'Yazi', 'Tartisma', 'Hikaye Anlatimi', 'Calisma',
      'Finans', 'Hukuk', 'Psikoloji', 'Siyaset', 'Tarih', 'Astronomi', 'Cografya', 'Gazetecilik',
    ],
  },
  {
    title: 'Sanat ve Kultur',
    items: [
      'Muzik', 'Gorsel Sanatlar', 'Film', 'Tiyatro', 'Fotografcilik', 'Dans', 'Acik Mikrofon', 'Galeri',
      'Podcast', 'Klasik Muzik', 'Dogaclama', 'Siir', 'Sokak Sanati', 'El Sanatlari', 'Moda', 'Mimari',
    ],
  },
  {
    title: 'Aktif ve Spor',
    items: [
      'Kosu', 'Bisiklet', 'Spor', 'Yuzme', 'Tirmanma', 'Yuruyus', 'Futbol', 'Masa Tenisi',
      'Badminton', 'Tenis', 'Kaykay', 'Boks / Dovus Sanatlari', 'Bouldering', 'Akrobasi', 'Su Sporlari', 'Kis Sporlari',
    ],
  },
  {
    title: 'Zihin ve Beden',
    items: [
      'Yoga', 'Farkindalik', 'Doga', 'Surdurulebilirlik', 'Gun Dogumu Rituali', 'Oz Bakim',
      'Soguk Maruziyet', 'Beslenme', 'Uyku Bilimi', 'Saglik', 'Cicek ve Botanik', 'Evcil Hayvan Sahipleri',
    ],
  },
  {
    title: 'Nis ve Oyunlar',
    items: [
      'Satranc', 'Oyun', 'Kart Oyunlari', 'Masa Oyunlari', 'Tarot', 'Bulmacalar',
      'Dart', 'Koleksiyon', 'Yildiz Gozlemi', 'Comlekcilik', 'Bahcecilik', 'Dikis',
    ],
  },
  {
    title: 'Teknoloji ve Kariyer',
    items: ['Teknoloji', 'Girisimler', 'Yapay Zeka', 'Veri Bilimi', 'Maker / Donanim', 'Siber Guvenlik', 'Arastirma', 'Web3 ve Kripto'],
  },
];

const MOODS = MOOD_TAGS_40;

export default function OnboardingInterestsScreen({ navigation, route }) {
  const [selected, setSelected] = useState([]);
  const [moods, setMoods] = useState([]);
  const routeParams = route?.params || {};
  const firstName = routeParams.firstName || '';
  const lastName = routeParams.lastName || '';
  const email = routeParams.email || '';
  const city = routeParams.city || 'Milano';
  const university = routeParams.university || '';
  const track = routeParams.track;
  const toggle = (value, stateSetter, current) => stateSetter(current.includes(value) ? current.filter((x) => x !== value) : [...current, value]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>OB-07 Interest Selection</Text>
      <Text style={styles.sub}>Dokumandaki Ritual kategorilerinden sec. Min 3 zorunlu.</Text>
      {INTEREST_GROUPS.map((group) => (
        <View key={group.title} style={styles.groupSection}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.wrap}>
            {group.items.map((x) => (
              <TouchableOpacity key={x} style={[styles.chip, selected.includes(x) && styles.chipActive]} onPress={() => toggle(x, setSelected, selected)}>
                <Text style={[styles.chipText, selected.includes(x) && styles.chipTextActive]}>{x}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <Text style={styles.sub}>Mood Etiketleri</Text>
      <View style={styles.wrap}>
        {MOODS.map((x) => (
          <TouchableOpacity key={x} style={[styles.chip, moods.includes(x) && styles.chipActive]} onPress={() => toggle(x, setMoods, moods)}>
            <Text style={[styles.chipText, moods.includes(x) && styles.chipTextActive]}>{x}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.counter}>Selected: {selected.length} / min 3</Text>
      <TouchableOpacity
        style={[styles.btn, selected.length < 3 && styles.btnDisabled]}
        disabled={selected.length < 3}
        onPress={() =>
          navigation.navigate('OnboardingPivotHosts', {
            firstName,
            lastName,
            email,
            city,
            university,
            track,
            interests: selected,
            moods,
          })
        }
      >
        <Text style={styles.btnText}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 8, fontSize: 13, color: '#4b5563' },
  groupSection: { marginTop: 12 },
  groupTitle: { fontSize: 13, fontWeight: '800', color: '#374151', textTransform: 'uppercase' },
  wrap: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#fff', borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { color: '#111827', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  counter: { marginTop: 14, color: '#374151', fontWeight: '700' },
  btn: { marginTop: 14, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontWeight: '700' },
});
