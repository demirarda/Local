import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { checkUniversityFromEmail, submitUniversityReviewRequest } from '../services/api';

function inferCity(emailValue) {
  const lower = String(emailValue || '').trim().toLowerCase();
  if (!lower.includes('@')) return 'Milano';
  if (lower.endsWith('.it') || lower.includes('polimi') || lower.includes('unimi')) return 'Milano';
  if (lower.includes('.tr')) return 'Istanbul';
  if (lower.includes('.uk') || lower.includes('ac.uk')) return 'London';
  return 'Milano';
}

export default function OnboardingUniversityEmailScreen({ navigation, route }) {
  const firstName = route?.params?.firstName || '';
  const lastName = route?.params?.lastName || '';

  const [email, setEmail] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState('typing'); // typing | matched | no_match | network_error
  const [university, setUniversity] = useState('');
  const [manualUniversityName, setManualUniversityName] = useState('');
  const [manualUniversityWebsite, setManualUniversityWebsite] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!email || !email.includes('@')) {
        setEmailStatus('typing');
        setUniversity('');
        return;
      }

      setCheckingEmail(true);
      try {
        const uniData = await checkUniversityFromEmail(email);
        if (uniData && uniData.valid && uniData.name) {
          setUniversity(uniData.name);
          setEmailStatus('matched');
        } else if (uniData?._networkError) {
          setUniversity('');
          setEmailStatus('network_error');
        } else {
          setUniversity('');
          setEmailStatus('no_match');
        }
      } catch (_) {
        setUniversity('');
        setEmailStatus('network_error');
      } finally {
        setCheckingEmail(false);
      }
    };

    const timer = setTimeout(run, 400);
    return () => clearTimeout(timer);
  }, [email]);

  const city = useMemo(() => inferCity(email), [email]);

  const handleGoToRegister = () => {
    if (emailStatus !== 'matched') return;
    navigation.navigate('CitySelection', {
      firstName,
      lastName,
      email: email.trim(),
      university,
      suggestedCity: city,
    });
  };

  const handleUniversityRequest = async () => {
    if (!manualUniversityName.trim()) {
      Alert.alert('Eksik bilgi', 'Lutfen universite adini gir.');
      return;
    }
    setRequestSubmitting(true);
    try {
      await submitUniversityReviewRequest({
        email: email.trim(),
        universityName: manualUniversityName.trim(),
        website: manualUniversityWebsite.trim() || null,
      });
      Alert.alert('Kaydedildi', 'Universiten manuel inceleme icin kaydedildi (24-48 saat).');
      setManualUniversityName('');
      setManualUniversityWebsite('');
    } catch (error) {
      Alert.alert('Hata', error?.message || 'Talep kaydedilemedi.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>L.</Text>
      <Text style={styles.title}>OB-04 · Universite E-postasi</Text>
      <Text style={styles.subtitle}>Gercek zamanli domain eslestirme.</Text>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="ad.soyad@universite.edu"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {checkingEmail ? <ActivityIndicator color="#6b7280" /> : null}
      </View>

      {emailStatus === 'typing' && (
        <View style={styles.neutralCard}>
          <Text style={styles.neutralText}>E-posta yazma durumu. Eslesme kontrol ediliyor.</Text>
        </View>
      )}

      {emailStatus === 'matched' && (
        <View style={styles.matchCard}>
          <Text style={styles.matchTitle}>OB-04a · Eslesme Bulundu</Text>
          <Text style={styles.matchText}>Tespit edilen universite: {university}</Text>
          <Text style={styles.matchText}>Sehir onerisi: {city}</Text>
          <TouchableOpacity style={styles.matchBtn} onPress={handleGoToRegister}>
            <Text style={styles.matchBtnText}>Dogrulama Kodu Gonder</Text>
          </TouchableOpacity>
        </View>
      )}

      {emailStatus === 'no_match' && (
        <View style={styles.noMatchCard}>
          <Text style={styles.noMatchTitle}>OB-04b · Eslesme Yok</Text>
          <Text style={styles.noMatchText}>Universiten listede yoksa founder&apos;i ol — basvuru (24-48 saat manuel inceleme).</Text>
          <TextInput
            style={styles.noMatchInput}
            placeholder="Universite adi"
            placeholderTextColor="#9ca3af"
            value={manualUniversityName}
            onChangeText={setManualUniversityName}
          />
          <TextInput
            style={styles.noMatchInput}
            placeholder="Universite web sitesi (opsiyonel)"
            placeholderTextColor="#9ca3af"
            value={manualUniversityWebsite}
            onChangeText={setManualUniversityWebsite}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.noMatchBtn, requestSubmitting && styles.disabled]}
            onPress={handleUniversityRequest}
            disabled={requestSubmitting}
          >
            <Text style={styles.noMatchBtnText}>{requestSubmitting ? 'Gonderiliyor...' : "Founder'i ol · basvur"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {emailStatus === 'network_error' && (
        <View style={styles.warnCard}>
          <Text style={styles.warnText}>Baglanti nedeniyle eslesme kontrolu yapilamadi. Tekrar dene.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6', paddingHorizontal: 18, justifyContent: 'center' },
  logo: { textAlign: 'center', fontSize: 62, fontWeight: '900', color: '#111827', marginBottom: 8 },
  title: { textAlign: 'center', fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { textAlign: 'center', marginTop: 6, marginBottom: 20, color: '#4b5563' },
  inputWrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, color: '#111827', fontSize: 16, paddingVertical: 6 },
  neutralCard: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 10 },
  neutralText: { color: '#4b5563', fontSize: 13, fontWeight: '600' },
  matchCard: { marginTop: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 12 },
  matchTitle: { color: '#166534', fontWeight: '800', fontSize: 13, marginBottom: 4 },
  matchText: { color: '#166534', fontSize: 13, marginBottom: 4 },
  matchBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#16a34a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  matchBtnText: { color: '#ecfdf5', fontWeight: '800', fontSize: 12 },
  noMatchCard: { marginTop: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 12, padding: 12 },
  noMatchTitle: { color: '#92400e', fontWeight: '800', fontSize: 13, marginBottom: 4 },
  noMatchText: { color: '#92400e', fontSize: 12, marginBottom: 8 },
  noMatchInput: { marginTop: 6, borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, backgroundColor: '#fff', color: '#111827', paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  noMatchBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#f59e0b', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  noMatchBtnText: { color: '#111827', fontWeight: '800', fontSize: 12 },
  warnCard: { marginTop: 10, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fb923c', borderRadius: 12, padding: 10 },
  warnText: { color: '#9a3412', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.55 },
});
