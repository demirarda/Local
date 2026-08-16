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
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import {
  fetchMyVenueApplication,
  submitVenueApplication,
  withdrawVenueApplication,
} from '../services/api';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';
const TEXT = '#000';
const MUTED = '#666';

const ONBOARDING_LABELS = {
  application_submitted: 'Basvuru gonderildi',
  approved: 'Onaylandi',
  vitrine: 'Vitrin',
  floor_plan: 'Ic harita',
  gps_verified: 'GPS dogrulama',
  first_slot: 'Ilk slot',
  venue_badge: 'Rozet (opsiyonel)',
  live: 'Canli',
};

const STATUS_LABELS = {
  pending: 'Incelemede',
  approved: 'Onaylandi',
  rejected: 'Reddedildi',
  withdrawn: 'Geri cekildi',
};

const COMMITMENT_TEXT =
  'LOCAL mekan ortağı olarak doğruluğu, fiziksel mekânı ve kullanıcı güvenliğini taahhüt ederim. Sahte veya yanıltıcı bilgi hesabımı kapatır.';

const PHOTO_MIN = 5;

export default function VenueApplyScreen({ navigation, route }) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState(null);
  const [onboardingSteps, setOnboardingSteps] = useState([]);

  const [businessName, setBusinessName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState(user?.city || 'Milano');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Kahve');
  const [description, setDescription] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [mapsUrl, setMapsUrl] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [photoUrlsRaw, setPhotoUrlsRaw] = useState('');
  const [viesVat, setViesVat] = useState('');
  const [commitmentAccepted, setCommitmentAccepted] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchMyVenueApplication();
      setApplication(data?.application || null);
      setOnboardingSteps(data?.onboarding_steps || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (route?.params?.prefillEmail) setContactEmail(route.params.prefillEmail);
    if (route?.params?.prefillCity) setCity(route.params.prefillCity);
  }, [route?.params?.prefillEmail, route?.params?.prefillCity]);

  const canSubmit = !application || ['rejected', 'withdrawn'].includes(application.status);

  const parsePhotoUrls = (raw) =>
    String(raw || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    const photos = parsePhotoUrls(photoUrlsRaw);
    if (!businessName.trim() || !venueName.trim() || !city.trim() || proofNotes.trim().length < 10) {
      Alert.alert('Eksik bilgi', 'Isletme adi, mekan adi, sehir ve isletme kaniti (min 10 karakter) gerekli.');
      return;
    }
    if (!mapsUrl.trim()) {
      Alert.alert('Eksik bilgi', 'Google Maps linki zorunlu.');
      return;
    }
    if (photos.length < PHOTO_MIN) {
      Alert.alert('Eksik bilgi', `En az ${PHOTO_MIN} foto URL gerekli (virgul veya satir ile ayir).`);
      return;
    }
    if (!commitmentAccepted) {
      Alert.alert('Taahhut', 'Devam etmek icin taahhüt metnini kabul etmelisin.');
      return;
    }
    setSubmitting(true);
    try {
      await submitVenueApplication({
        business_name: businessName.trim(),
        venue_name: venueName.trim(),
        city: city.trim(),
        address: address.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        proof_notes: proofNotes.trim(),
        contact_email: contactEmail.trim() || null,
        maps_url: mapsUrl.trim(),
        social_url: socialUrl.trim() || null,
        photo_urls: photos,
        vies_vat: viesVat.trim() || null,
        commitment_accepted: true,
        commitment_text: COMMITMENT_TEXT,
      });
      Alert.alert('Basvuru gonderildi', 'LOCAL ekibi basvurunu inceleyecek.');
      await load();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Basvuru gonderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      await withdrawVenueApplication();
      await load();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Geri cekilemedi');
    }
  };

  const renderOnboardingTrack = () => {
    if (!application || application.status !== 'approved') return null;
    const current = application.onboarding_step || 'approved';
    const steps = onboardingSteps.length
      ? onboardingSteps
      : ['application_submitted', 'approved', 'vitrine', 'floor_plan', 'gps_verified', 'first_slot', 'live'];
    const currentIdx = Math.max(0, steps.indexOf(current));

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Onboarding</Text>
        {steps.map((step, idx) => (
          <View key={step} style={styles.stepRow}>
            <MaterialIcons
              name={idx <= currentIdx ? 'check-circle' : 'radio-button-unchecked'}
              size={18}
              color={idx <= currentIdx ? '#16a34a' : MUTED}
            />
            <Text style={[styles.stepText, idx <= currentIdx && styles.stepTextDone]}>
              {ONBOARDING_LABELS[step] || step}
            </Text>
          </View>
        ))}
        {application.venue_id ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('VenueDetail', { venueId: application.venue_id })}
          >
            <Text style={styles.secondaryBtnText}>Mekan profiline git</Text>
          </TouchableOpacity>
        ) : null}
        {application.venue_id && application.status === 'approved' ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('VenueVitrineEdit', { venueId: application.venue_id })}
          >
            <Text style={styles.primaryBtnText}>Vitrini Kur</Text>
          </TouchableOpacity>
        ) : null}
        {application.venue_id && application.status === 'approved' ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('VenueSlots', { venueId: application.venue_id })}
          >
            <Text style={styles.secondaryBtnText}>Ilk Slotu Ac</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
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
      <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
        <MaterialIcons name="chevron-left" size={24} color={TEXT} />
        <Text style={styles.backText}>Geri</Text>
      </TouchableOpacity>

      <Text style={styles.title}>LOCAL Venue Basvurusu</Text>
      <Text style={styles.subtitle}>
        Ayri uygulama yok — onay sonrasi ayni app icinde mekan arayuzune gecersin.
      </Text>

      {application ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Durum</Text>
          <Text style={styles.statusValue}>{STATUS_LABELS[application.status] || application.status}</Text>
          <Text style={styles.statusMeta}>{application.venue_name} · {application.city}</Text>
          {application.status === 'pending' ? (
            <TouchableOpacity style={styles.linkBtn} onPress={handleWithdraw}>
              <Text style={styles.linkBtnText}>Basvuruyu geri cek</Text>
            </TouchableOpacity>
          ) : null}
          {application.reviewer_note && application.status === 'rejected' ? (
            <Text style={styles.reviewerNote}>Not: {application.reviewer_note}</Text>
          ) : null}
        </View>
      ) : null}

      {renderOnboardingTrack()}

      {canSubmit ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basvuru Formu</Text>
          <Text style={styles.label}>Isletme unvani</Text>
          <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Orn. Cafe Roma SRL" />
          <Text style={styles.label}>Mekan adi (vitrinte gorunur)</Text>
          <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholder="Cafe Roma" />
          <Text style={styles.label}>Sehir</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} />
          <Text style={styles.label}>Adres</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Opsiyonel" />
          <Text style={styles.label}>Kategori</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} />
          <Text style={styles.label}>Kisa aciklama</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline />
          <Text style={styles.label}>Isletme kaniti</Text>
          <Text style={styles.hint}>Partita IVA, ruhsat veya mekan sahipligi kaniti (min 10 karakter)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={proofNotes}
            onChangeText={setProofNotes}
            multiline
            placeholder="Kisa aciklama ve referans linkleri..."
          />
          <Text style={styles.label}>Iletisim e-posta</Text>
          <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.label}>Google Maps linki *</Text>
          <TextInput
            style={styles.input}
            value={mapsUrl}
            onChangeText={setMapsUrl}
            placeholder="https://maps.google.com/..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.label}>Sosyal / web linki (tek, opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={socialUrl}
            onChangeText={setSocialUrl}
            placeholder="https://instagram.com/..."
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.label}>Foto URL'leri (min {PHOTO_MIN})</Text>
          <Text style={styles.hint}>Virgul veya satir ile ayir · en az {PHOTO_MIN} URL</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={photoUrlsRaw}
            onChangeText={setPhotoUrlsRaw}
            multiline
            placeholder={'https://...\nhttps://...'}
            autoCapitalize="none"
          />
          <Text style={styles.label}>VIES / VAT (opsiyonel)</Text>
          <TextInput style={styles.input} value={viesVat} onChangeText={setViesVat} placeholder="TR1234567890" autoCapitalize="characters" />
          <Text style={styles.label}>Taahhut</Text>
          <Text style={styles.commitmentText}>{COMMITMENT_TEXT}</Text>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setCommitmentAccepted((v) => !v)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={commitmentAccepted ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={commitmentAccepted ? '#16a34a' : MUTED}
            />
            <Text style={styles.checkLabel}>Taahhüt metnini okudum ve kabul ediyorum</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Basvuruyu Gonder</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { fontSize: 16, color: TEXT },
  title: { fontSize: 24, fontWeight: '700', color: TEXT, marginBottom: 8 },
  subtitle: { fontSize: 14, color: MUTED, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: TEXT },
  label: { fontSize: 13, fontWeight: '600', color: TEXT, marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 12, color: MUTED, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '600', color: TEXT },
  statusLabel: { fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusValue: { fontSize: 20, fontWeight: '700', color: '#166534', marginTop: 4 },
  statusMeta: { fontSize: 14, color: MUTED, marginTop: 4 },
  linkBtn: { marginTop: 10 },
  linkBtnText: { color: '#b45309', fontWeight: '600' },
  reviewerNote: { marginTop: 8, fontSize: 13, color: MUTED },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stepText: { fontSize: 14, color: MUTED },
  stepTextDone: { color: TEXT, fontWeight: '600' },
  commitmentText: {
    fontSize: 13,
    color: TEXT,
    lineHeight: 20,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  checkLabel: { flex: 1, fontSize: 14, color: TEXT, fontWeight: '600' },
});
