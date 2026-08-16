import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';

const POLICY_URL = 'https://local.app/privacy';

const SECTIONS = [
  {
    title: 'Konum',
    body: 'Konum yalniz check-in aninda ve masayi acarken istenir. Arka planda surekli takip yoktur; GPS dogrulamasi sonrasi ham koordinat saklanmaz, yalniz mesafe dogrulama izi tutulur.',
  },
  {
    title: 'Kimlik',
    body: 'Kimlik dogrulama saglayicidan gelen sonuc (dogrulandi / dogrulanmadi) ve hash tutulur. Belge goruntusu LOCAL sunucusunda saklanmaz.',
  },
  {
    title: 'Ritual izleri',
    body: 'Katilim, muhur, geri bildirim ve ani kayitlarin RS ve rozet motorunu besler. Window kapandiktan sonra icerik arsiv kurallarina gore saklanir.',
  },
  {
    title: 'Gorunurluk',
    body: 'Profil, ani ve kesfedilebilirlik tercihlerin Gizlilik Ayarlari ekranindan yonetilir. Kapali profilde yabanciya yalniz minimal kart gorunur.',
  },
  {
    title: 'Veri kullanimi',
    body: 'Kisisellestirme, anonim istatistik ve urun duyurulari icin ayri ayri onay verirsin; her biri Gizlilik Ayarlari icinden kapatilabilir.',
  },
  {
    title: 'Silme',
    body: 'Hesabini sildiginde kendi memorylerin ve profil verin kalkar. Ortak masa izleri (katilim sayaci gibi) kimliksiz olarak window arsivinde kalabilir.',
  },
];

/** Ag erisimi yoksa gizlilik metni uygulama icinde okunur */
export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gizlilik Politikasi</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            <Text style={styles.cardBody}>{section.body}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => Linking.openURL(POLICY_URL).catch(() => {})}
        >
          <Text style={styles.linkText}>Tam metin · {POLICY_URL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  back: { padding: 8, marginRight: 8 },
  backText: { fontSize: 22, color: '#000' },
  title: { fontSize: 18, fontWeight: '700', color: '#000' },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  cardBody: { fontSize: 13, color: '#555', lineHeight: 20 },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
});
