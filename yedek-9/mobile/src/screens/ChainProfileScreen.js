import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchChainProfile } from '../services/api';

const PRIMARY = '#f9a13d';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';

/** §12 zincir — şube ayrı skor; aralık harman yok */
export default function ChainProfileScreen({ route, navigation }) {
  const chainId = route.params?.chainId;
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chainId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchChainProfile(chainId);
        if (!cancelled) setChain(data);
      } catch (e) {
        if (!cancelled) Alert.alert('Hata', e?.message || 'Zincir yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  const branches = chain?.branches || [];

  return (
    <View style={styles.container}>
      <FlatList
        data={branches}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
              <MaterialIcons name="arrow-back" size={22} color={TEXT} />
            </TouchableOpacity>
            <Text style={styles.eyebrow}>ZİNCİR</Text>
            <Text style={styles.title}>{chain?.name || 'Zincir'}</Text>
            <Text style={styles.meta}>
              Aralık: {chain?.score_range || '—'} · harman yok
            </Text>
            <Text style={styles.section}>Şubeler (ayrı profil/skor)</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('VenueDetail', { venueId: item.id })}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.city || '—'}
              {item.trust_score != null ? ` · Trust ${Number(item.trust_score).toFixed(1)}` : ''}
              {item.aura_score != null ? ` · Aura ${Number(item.aura_score).toFixed(1)}` : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.muted}>Şube yok</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf9f6' },
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: PRIMARY },
  title: { fontSize: 26, fontWeight: '700', color: TEXT, marginTop: 4 },
  meta: { fontSize: 14, color: MUTED, marginTop: 6 },
  section: { marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '800', color: TEXT },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e0',
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 4 },
  muted: { color: MUTED, marginTop: 12 },
});
