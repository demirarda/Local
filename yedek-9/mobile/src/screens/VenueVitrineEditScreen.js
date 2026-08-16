import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { updateVenueVitrine, publishVenueVitrine, getVenue, fetchBadgeCatalog } from '../services/api';
import useConfigStore from '../store/configStore';
import { getHighlightVenueMax } from '../constants/localConfig';

export default function VenueVitrineEditScreen({ route, navigation }) {
  const { venueId } = route.params || {};
  const highlightMax = getHighlightVenueMax(useConfigStore((s) => s.config));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headline, setHeadline] = useState('');
  const [tagline, setTagline] = useState('');
  const [hours, setHours] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [amenitiesText, setAmenitiesText] = useState('');
  const [published, setPublished] = useState(false);
  const [highlighted, setHighlighted] = useState([]);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (!venueId) return;
    (async () => {
      try {
        const [data, catalogData] = await Promise.all([
          getVenue(venueId),
          fetchBadgeCatalog().catch(() => ({ catalog: [] })),
        ]);
        const v = data?.profile?.vitrine_draft || data?.vitrine || data?.profile?.vitrine || {};
        setHeadline(v.headline || data?.name || '');
        setTagline(v.tagline || '');
        setHours(v.hours || '');
        setCoverUrl(v.cover_url || '');
        setAmenitiesText((v.amenities || []).join(', '));
        setPublished(Boolean(data?.vitrine_published || data?.profile?.vitrine_published));
        setHighlighted(data?.profile?.highlighted_badge_keys || data?.highlighted_badge_keys || []);
        setCatalog(catalogData?.catalog || []);
      } catch (e) {
        Alert.alert('Hata', e.message || 'Yuklenemedi');
      } finally {
        setLoading(false);
      }
    })();
  }, [venueId]);

  const buildPayload = () => ({
    vitrine: {
      headline: headline.trim(),
      tagline: tagline.trim(),
      hours: hours.trim(),
      cover_url: coverUrl.trim() || null,
      amenities: amenitiesText.split(',').map((s) => s.trim()).filter(Boolean),
    },
    highlighted_badge_keys: highlighted,
  });

  const toggleBadge = (slug) => {
    setHighlighted((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= highlightMax) return [...prev.slice(1), slug];
      return [...prev, slug];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateVenueVitrine(venueId, buildPayload());
      Alert.alert('Kaydedildi', 'Vitrin taslagi guncellendi.');
    } catch (e) {
      Alert.alert('Hata', e.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await updateVenueVitrine(venueId, buildPayload());
      await publishVenueVitrine(venueId);
      setPublished(true);
      Alert.alert('Yayinda', 'Vitrin artik herkese acik.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Yayinlanamadi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Vitrin Duzenle</Text>
      <Text style={styles.subtitle}>Onboarding: vitrin adimi · public profilde gorunur</Text>
      {published ? <Text style={styles.publishedBadge}>YAYINDA</Text> : null}

      <Text style={styles.label}>Baslik</Text>
      <TextInput style={styles.input} value={headline} onChangeText={setHeadline} />
      <Text style={styles.label}>Tagline</Text>
      <TextInput style={styles.input} value={tagline} onChangeText={setTagline} />
      <Text style={styles.label}>Calisma saatleri</Text>
      <TextInput style={styles.input} value={hours} onChangeText={setHours} placeholder="Orn. 08:00-23:00" />
      <Text style={styles.label}>Kapak gorsel URL</Text>
      <TextInput style={styles.input} value={coverUrl} onChangeText={setCoverUrl} autoCapitalize="none" />
      <Text style={styles.label}>Olanaklar (virgulle)</Text>
      <TextInput style={styles.input} value={amenitiesText} onChangeText={setAmenitiesText} placeholder="WiFi, teras, vegan" />

      <Text style={styles.label}>One cikan rozetler (max {highlightMax})</Text>
      <Text style={styles.hint}>Mekan vitrininde gorunecek rozetler</Text>
      <View style={styles.badgeRow}>
        {catalog.map((b) => (
          <TouchableOpacity
            key={b.slug}
            style={[styles.badgeChip, highlighted.includes(b.slug) && styles.badgeChipOn]}
            onPress={() => toggleBadge(b.slug)}
          >
            <Text style={styles.badgeChipText}>{b.icon_emoji || '🏅'} {b.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.secondaryBtnText}>{saving ? '...' : 'Taslak Kaydet'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryBtn} onPress={handlePublish} disabled={saving}>
        <Text style={styles.primaryBtnText}>{saving ? '...' : 'Vitrini Yayinla'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  publishedBadge: { color: '#166534', fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 11, color: '#888', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  badgeChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  badgeChipOn: { borderColor: '#C8A96A', backgroundColor: '#FFF8E8' },
  badgeChipText: { fontSize: 12, color: '#111' },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { fontWeight: '600' },
});
