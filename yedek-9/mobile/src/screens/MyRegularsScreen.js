import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { fetchMyRegulars } from '../services/api';

const PRIMARY = '#f9a13d';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';

/** v2 §6 — kullanıcının kendi Regular mekân listesi (PRIVATE) */
export default function MyRegularsScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyRegulars();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Liste yüklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Regular’larım</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.sub}>Yalnız sen görürsün · konum deseni korunur</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.venue_id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[PRIMARY]}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Henüz Regular mekânın yok</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('VenueDetail', { venueId: item.venue_id })}
          >
            <Text style={styles.name}>{item.venue_name}</Text>
            <Text style={styles.meta}>
              {item.venue_city || '—'}
              {item.is_regular
                ? ' · Regular'
                : ` · ${item.counter || `${item.count}/${item.threshold || 3}`}`}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 22, color: TEXT },
  title: { fontSize: 18, fontWeight: '700', color: TEXT },
  sub: { paddingHorizontal: 16, color: MUTED, fontSize: 12, marginBottom: 4 },
  empty: { color: MUTED, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
  name: { fontSize: 16, fontWeight: '700', color: TEXT },
  meta: { fontSize: 13, color: MUTED, marginTop: 4 },
});
