import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { fetchDsDashboard } from '../services/api';
import DsCompassCard from '../components/DsCompassCard';

export default function DSUserDashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const dash = await fetchDsDashboard();
        if (mounted) {
          setData(dash);
          setError(null);
        }
      } catch (e) {
        if (mounted) {
          setError(e.message || 'DS paneli yuklenemedi');
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>Keşif Pusulası</Text>
        <View style={{ width: 18 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1B2E4A" /></View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorHint}>{error}</Text>
        </View>
      ) : data?.hidden ? (
        <View style={styles.center}>
          <Text style={styles.errorHint}>
            {data.note || 'Keşif Pusulası HENÜZ GÖSTERİLMİYOR — beş mühür tamamlanınca açılır.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <DsCompassCard data={data} />
          {data?.last_updated_at ? (
            <Text style={styles.metaSmall}>
              Son güncelleme: {new Date(data.last_updated_at).toLocaleString('tr-TR')}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 22, color: '#111' },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  content: { padding: 16, paddingBottom: 40 },
  errorHint: { color: '#b45309', fontSize: 14, textAlign: 'center' },
  metaSmall: { fontSize: 11, color: '#9ca3af', marginTop: 10, lineHeight: 16 },
});
