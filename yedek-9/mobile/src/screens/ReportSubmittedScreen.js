import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function ReportSubmittedScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sikayet Onayi</Text>
      <Text style={styles.sub}>Moderatörlere iletildi, kullanici bilgilendirildi.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
        <Text style={styles.btnText}>Tamam</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 8, fontSize: 14, color: '#4b5563' },
  btn: { marginTop: 14, backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
