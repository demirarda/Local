import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import {
  fetchCollaborators,
  addCollaborator,
  revokeCollaborator,
  searchPeople,
} from '../services/api';

const BG = '#f5f5f5';
const CARD = '#fff';
const BORDER = '#e8e8e8';

const TIER_LABEL = {
  friends: 'Arkadas',
  followers: 'Takipci',
  fl_network: 'FL agi',
  everyone: '',
};

/**
 * sonMD collaborator — yalnız series / event_group / venue_event
 * Yetkiler: announce, participant_comms, instance_manage — mühür/RS/MOD yok
 */
export default function CollaboratorsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scope = route.params?.scope || 'series';
  const scopeId = route.params?.scopeId;
  const canManage = route.params?.canManage !== false;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) return;
    try {
      const data = await fetchCollaborators(scope, scopeId);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setList([]);
      Alert.alert('Hata', e?.message || 'Liste yuklenemedi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, scopeId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleAdd = async () => {
    const uid = String(selectedUser?.id || '').trim();
    if (!uid) {
      Alert.alert('Eksik', 'Once aramadan bir kisi sec');
      return;
    }
    try {
      setBusy(true);
      await addCollaborator(scope, scopeId, uid, ['announce', 'participant_comms', 'instance_manage']);
      setUserIdInput('');
      setSelectedUser(null);
      setPeople([]);
      await load();
      Alert.alert('Tamam', 'Collaborator eklendi');
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const onSearchPeople = async (q) => {
    setUserIdInput(q);
    setSelectedUser(null);
    if (String(q || '').trim().length < 2) {
      setPeople([]);
      return;
    }
    try {
      const rows = await searchPeople(q.trim());
      setPeople(Array.isArray(rows) ? rows.slice(0, 8) : []);
    } catch (_e) {
      setPeople([]);
    }
  };

  const handleRevoke = (item) => {
    Alert.alert('Kaldir', 'Bu collaborator yetkisini iptal et?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Kaldir',
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeCollaborator(scope, scopeId, item.user_id);
            setList((prev) => prev.filter((x) => x.user_id !== item.user_id));
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Kaldirilamadi');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.user_name || item.name || item.user_id}</Text>
        <Text style={styles.meta}>
          {(item.permissions || []).join(' · ') || 'announce · comms · instance'}
        </Text>
        <Text style={styles.hint}>Muhur / RS / MOD yetkisi yok</Text>
      </View>
      {canManage ? (
        <TouchableOpacity onPress={() => handleRevoke(item)}>
          <Text style={styles.revoke}>Kaldir</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Collaborators</Text>
      </View>
      <Text style={styles.scopeLabel}>
        {scope} · {String(scopeId || '').slice(0, 8)}…
      </Text>

      {canManage ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={userIdInput}
            onChangeText={onSearchPeople}
            placeholder={
              selectedUser ? selectedUser.label || selectedUser.name : 'Kisi ara (isim)'
            }
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.addText}>Ekle</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
      {canManage && people.length > 0 ? (
        <View style={styles.suggestions}>
          {people.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.suggestionRow}
              onPress={() => {
                setSelectedUser(p);
                setUserIdInput(p.label || p.name || p.username || '');
                setPeople([]);
              }}
            >
              <Text style={styles.suggestionName}>{p.label || p.name || p.username}</Text>
              {p.meta?.tier ? <Text style={styles.suggestionMeta}>{TIER_LABEL[p.meta.tier]}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={list.filter((x) => x.status !== 'revoked')}
          keyExtractor={(item, idx) => String(item.user_id || idx)}
          renderItem={renderItem}
          contentContainerStyle={list.length ? styles.list : styles.emptyWrap}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>Henuz collaborator yok</Text>}
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
  scopeLabel: { paddingHorizontal: 16, paddingVertical: 8, color: '#666', fontSize: 12 },
  addRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addText: { color: '#fff', fontWeight: '700' },
  suggestions: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  suggestionRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  suggestionName: { fontSize: 14, fontWeight: '600', color: '#111' },
  suggestionMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#999' },
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
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  meta: { fontSize: 12, color: '#666', marginTop: 4 },
  hint: { fontSize: 11, color: '#999', marginTop: 4 },
  revoke: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
});
