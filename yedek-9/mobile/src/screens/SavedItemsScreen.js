import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchSaves, unsaveObject } from '../services/api';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';

const TYPE_LABEL = {
  ritual: 'Ritual',
  venue: 'Mekan',
  zone: 'Zone',
  memory: 'Ani',
};

export default function SavedItemsScreen() {
  const navigation = useNavigation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchSaves();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setList([]);
      Alert.alert('Hata', e?.message || 'Kayitlar yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleUnsave = (item) => {
    const type = item.object_type;
    const id = item.object_id;
    Alert.alert('Kaydi kaldir', 'Bu ogeyi kayitlardan cikarmak istiyor musun?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Kaldir',
        style: 'destructive',
        onPress: async () => {
          const key = `${type}:${id}`;
          try {
            setBusyKey(key);
            await unsaveObject(type, id);
            setList((prev) => prev.filter((x) => !(x.object_type === type && x.object_id === id)));
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Kaldirilamadi');
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  const openItem = (item) => {
    const type = item.object_type;
    const id = item.object_id;
    if (type === 'ritual') navigation.navigate('RitualDetail', { ritualId: id });
    else if (type === 'venue') navigation.navigate('VenueDetail', { venueId: id });
    else if (type === 'zone') navigation.navigate('ZoneDetail', { zoneId: id });
    else if (type === 'memory') navigation.navigate('MemoryDetail', { memoryId: id });
  };

  const renderItem = ({ item }) => {
    const key = `${item.object_type}:${item.object_id}`;
    const title = item.title || item.preview || null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.8}>
        <View style={styles.cardMain}>
          <Text style={styles.type}>{TYPE_LABEL[item.object_type] || item.object_type}</Text>
          <Text style={[styles.id, !title && styles.idFallback]} numberOfLines={1}>
            {title || 'Baslik yok'}
          </Text>
          {item.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleUnsave(item)}
          disabled={busyKey === key}
        >
          {busyKey === key ? (
            <ActivityIndicator size="small" color="#991b1b" />
          ) : (
            <Text style={styles.removeText}>Kaldir</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Kaydedilenler</Text>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, idx) => `${item.object_type}:${item.object_id}:${idx}`}
          renderItem={renderItem}
          contentContainerStyle={list.length ? styles.list : styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>Henuz kayit yok</Text>}
        />
      )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999', fontSize: 15 },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardMain: { flex: 1 },
  type: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },
  id: { fontSize: 15, color: '#111', fontWeight: '500' },
  idFallback: { color: '#999', fontStyle: 'italic' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 3 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  removeText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
});
