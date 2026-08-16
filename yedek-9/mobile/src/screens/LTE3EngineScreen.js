import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import useConfigStore from '../store/configStore';
import { buildRsDisplayLines } from '../constants/localConfig';

const PIPELINE = [
  '1) Bypass kontrolu: no-show / gec iptal ise direkt ceza',
  '2) Geri bildirim filtresi: ayni Ritual + arkadaslik seviyesi',
  '3) Bilesenler: IQ_r, CF_r, A_r, M_r, IF_r hesaplanir',
  '4) T_r = P_r - W_IF x IF (0..1, notr 0.50)',
  '5) delta_raw hesaplanir (+0.075 / -0.30 raw cap)',
  '6) DS multiplier uygulanir',
  '7) N-context >= 0.65 ise pozitif delta dondurulur',
  '8) BC5 multiplier (davranis tutarliligi) uygulanir',
  '9) MD (maturity dampener) uygulanir',
  '10) BR (boundary resistance) uygulanir',
  '11) delta_final +/-0.12 / -0.15 clamp edilir',
  '12) RS_new = clamp(RS + delta_final, 1.0..10.0)',
];

export default function LTE3EngineScreen() {
  const navigation = useNavigation();
  const publicConfig = useConfigStore((s) => s.config);
  const constants = buildRsDisplayLines(publicConfig);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <MaterialIcons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.title}>LTE-3 Trust Engine</Text>
      <Text style={styles.sub}>LOCAL Guven Motoru v3 sabitleri ve 12 adimli boru hatti.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>LTE-01 · Core Constants</Text>
        {constants.map((x) => (
          <Text key={x} style={styles.row}>- {x}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>LTE-02 · 12-Step Pipeline</Text>
        {PIPELINE.map((x) => (
          <Text key={x} style={styles.row}>{x}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, gap: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#4b5563' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#374151', marginBottom: 8, textTransform: 'uppercase' },
  row: { color: '#111827', fontSize: 13, paddingVertical: 2 },
});
