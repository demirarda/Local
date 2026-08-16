import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PULSE_SCREEN_BG = '#f5f5f5';
const PULSE_CARD_BG = '#fff';
const PULSE_HEADER_BG = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_TEXT = '#000';
const PULSE_TEXT_META = '#666';

const GLOSSARY_ITEMS = [
  { term: 'RS', definition: 'Güvenilirlik Skoru · 1,0-10,0 · temel güven metriği' },
  { term: 'LTE-3', definition: "LOCAL Güven Motoru v3 · RS'i hesaplayan algoritma" },
  { term: 'Ritual', definition: 'Bir host tarafından oluşturulan küçük, tekrarlanabilir gerçek dünya buluşması' },
  { term: 'Canlı Window', definition: 'Ritual bittikten sonra sohbet ve anıların aktif olduğu süre' },
  { term: 'FL', definition: 'Arkadaşlık Seviyesi · Yabancı / L1 / L2 / L3 Çekirdek Daire' },
  { term: 'L1 Tanışık', definition: '1-3 ortak Ritual · geri bildirimde tam RS ağırlığı' },
  { term: 'L2 Arkadaş', definition: '4-9 ortak Ritual · geri bildirimde yarım RS ağırlığı' },
  { term: 'L3 Çekirdek Daire', definition: '10+ ortak Ritual · sıfır RS ağırlığı · yalnızca sosyal rozet' },
  { term: 'DS', definition: 'Çeşitlilik Skoru · bağlantı, mekan ve Ritual tipi çeşitliliğini ölçer' },
  { term: 'MD', definition: 'Olgunluk Engelleyici · yeni kullanıcılar için RS hareketini yavaşlatır' },
  { term: 'BC5', definition: 'Son 5 Ritualdeki Davranış Tutarlılığı' },
  { term: 'BR', definition: 'Sınır Direnci · RS aşırılıklarına (1,0, 10,0) yakın hareketi yavaşlatır' },
  { term: 'IF', definition: 'Dürüstlük Sürtünmesi · gecikmeli gelme, erken ayrılma, geri bildirim vermeme cezası' },
  { term: 'IQ_r', definition: 'Ritual sonrası akranlardan gelen Etkileşim Kalitesi derecelendirmesi' },
  { term: 'CF_r', definition: 'Bağlam Uyumu derecelendirmesi (kullanıcının Ritual bağlamına uyumu)' },
  { term: 'A_r', definition: 'Katılım bileşeni (zamanında = 1,0)' },
  { term: 'M_r', definition: 'Anı bileşeni (anı paylaşımı için bonus)' },
  { term: 'P2M', definition: "Katılımcıdan Mekan'a derecelendirme (Mekan RS hesaplaması için)" },
  { term: 'HQS', definition: 'Host Kalite Skoru · hosta özgü RS metriği' },
  { term: 'Pivot Host', definition: 'LOCAL ekibi tarafından seçilen küratörlüklü host' },
  { term: 'Bypass', definition: 'Normal boru hattını atlayan doğrudan RS cezası (gelmeme, geç iptal)' },
  { term: 'Giriş Yapma', definition: 'Gerçek katılımı doğrulayan GPS + anahtar kelime doğrulaması' },
  { term: 'Pulse', definition: "LOCAL'in ana akışı · Sekme 1" },
  { term: 'City Rhythm', definition: 'Ritual keşif ekranı · Sekme 2' },
  { term: 'Sosyal Pasaport', definition: 'Kullanıcı profili · Sekme 3' },
];

export default function GlossaryScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>10. Sözlük</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {GLOSSARY_ITEMS.map((item) => (
          <View key={item.term} style={styles.card}>
            <Text style={styles.term}>{item.term}</Text>
            <Text style={styles.definition}>{item.definition}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PULSE_SCREEN_BG,
  },
  statusBarSpacer: {
    height: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: PULSE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  backBtnText: {
    fontSize: 24,
    color: PULSE_TEXT,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: PULSE_TEXT,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PULSE_BORDER,
    padding: 14,
  },
  term: {
    fontSize: 16,
    fontWeight: '700',
    color: PULSE_TEXT,
    marginBottom: 6,
  },
  definition: {
    fontSize: 14,
    lineHeight: 20,
    color: PULSE_TEXT_META,
  },
});
