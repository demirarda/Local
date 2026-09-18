import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { fetchSalesPocket } from '../services/api';

const BLOCK_COPY = {
  plans: { title: 'Planlar', hint: 'Üyelik / kredi tekliflerin' },
  fulfillment: { title: 'Gerçekleşme sicili', hint: 'attempted · fulfilled · denied' },
  buyer_chips: { title: 'Alıcı chip', hint: 'S-chip satıcı siciline akar' },
  customers: { title: 'Kayıtlı müşteri', hint: 'Planına kayıtlı kişiler' },
  approval_queue: { title: 'Onay kuyruğu', hint: 'Eşzamanlı 1' },
  payout: { title: 'Payout', hint: 'Payout vitrin değildir' },
  vitrine: { title: 'Vitrin', hint: 'Vitrin payout değildir' },
};

export default function SalesPocketScreen() {
  const [pocket, setPocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchSalesPocket();
      setPocket(data);
    } catch (_e) {
      setPocket(null);
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const blocks = pocket?.blocks || Object.keys(BLOCK_COPY);
  const fulfillment = pocket?.fulfillment || {};

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <Text style={styles.h1}>{pocket?.ui_noun || 'Satışlarım'}</Text>
      <Text style={styles.sub}>Seller cebi · payout ve vitrin ayrı bloklar</Text>
      {blocks.map((id) => {
        const copy = BLOCK_COPY[id] || { title: id, hint: '' };
        let body = copy.hint;
        if (id === 'plans') body = `${(pocket?.plans || []).length} plan`;
        if (id === 'fulfillment') {
          body = `deneme ${fulfillment.attempted || 0} · oldu ${fulfillment.fulfilled || 0} · red ${fulfillment.denied || 0}`;
        }
        if (id === 'customers') body = `${(pocket?.customers || []).length} kayıt`;
        if (id === 'approval_queue') {
          body = `açık ${(pocket?.approval_queue?.items || []).length} · eşzamanlı ${pocket?.approval_queue?.concurrent_cap || 1}`;
        }
        if (id === 'payout') body = pocket?.payout?.note || copy.hint;
        if (id === 'vitrine') body = pocket?.vitrine?.note || copy.hint;
        return (
          <View key={id} style={styles.card}>
            <Text style={styles.cardTitle}>{copy.title}</Text>
            <Text style={styles.cardBody}>{body}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0F0F0' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 22, fontWeight: '800', color: '#111' },
  sub: { fontSize: 13, color: '#737373', marginTop: 6, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  cardBody: { fontSize: 13, color: '#525252', marginTop: 4 },
});
