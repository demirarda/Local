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
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchFollowRequests, resolveFollowRequest } from '../services/api';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';

export default function FollowRequestsScreen() {
  const navigation = useNavigation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchFollowRequests();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setList([]);
      Alert.alert('Hata', e?.message || 'Istekler yuklenemedi');
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

  const resolve = async (requestId, accept) => {
    try {
      setBusyId(requestId);
      await resolveFollowRequest(requestId, accept);
      setList((prev) => prev.filter((x) => x.id !== requestId));
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Islem basarisiz');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }) => {
    const name = item.from_name || item.from_user?.name || 'Kullanici';
    const handle = item.from_username || item.from_user?.username;
    const avatar = item.from_avatar || item.from_avatar_url || item.from_user?.avatar_url;
    const fromId = item.from_user_id || item.from_user?.id;
    const busy = busyId === item.id;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.left}
          onPress={() =>
            navigation.navigate('ParticipantProfile', {
              userId: fromId,
            })
          }
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>{(name || '?')[0]}</Text>
            </View>
          )}
          <View style={styles.meta}>
            <Text style={styles.name}>{name}</Text>
            {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          {busy ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <TouchableOpacity style={styles.accept} onPress={() => resolve(item.id, true)}>
                <Text style={styles.acceptText}>Onayla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.decline} onPress={() => resolve(item.id, false)}>
                <Text style={styles.declineText}>Reddet</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Takip Istekleri</Text>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={renderItem}
          contentContainerStyle={list.length ? styles.list : styles.emptyWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>Bekleyen istek yok</Text>}
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
  list: { padding: 16 },
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
  left: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '700', color: '#333' },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  handle: { fontSize: 13, color: '#666', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accept: {
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  decline: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  declineText: { color: '#666', fontWeight: '600', fontSize: 13 },
});
