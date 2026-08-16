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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import { fetchBlockedKeywords, addBlockedKeyword, removeBlockedKeyword } from '../services/api';

const PULSE_BG = '#f5f5f5';
const PULSE_CARD = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_TEXT = '#000';
const PULSE_SUBTLE = '#999';

export default function BlockedKeywordsScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await fetchBlockedKeywords(currentUserId);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading blocked keywords:', e);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleAdd = async () => {
    const keyword = input.trim().toLowerCase();
    if (!keyword || !currentUserId) return;
    try {
      setAdding(true);
      await addBlockedKeyword(currentUserId, keyword);
      setInput('');
      await load();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not add keyword.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (item) => {
    const keyword = item.keyword;
    Alert.alert(
      'Remove keyword',
      `Remove "${keyword}" from blocked keywords?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            try {
              setRemovingId(item.id);
              await removeBlockedKeyword(currentUserId, keyword);
              setList(prev => prev.filter(x => x.keyword !== keyword));
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not remove.');
            } finally {
              setRemovingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading && list.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.statusBarSpacer} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Keywords</Text>
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add keyword to block..."
          placeholderTextColor={PULSE_SUBTLE}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!input.trim() || adding) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!input.trim() || adding}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id || item.keyword || String(Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No blocked keywords</Text>
            <Text style={styles.emptySub}>Add words above to hide content containing them.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isRemoving = removingId === item.id;
          return (
            <View style={styles.row}>
              <Text style={styles.keyword}>{item.keyword}</Text>
              <TouchableOpacity
                style={[styles.removeBtn, isRemoving && styles.removeBtnDisabled]}
                onPress={() => handleRemove(item)}
                disabled={isRemoving}
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.removeBtnText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PULSE_BG },
  centered: { justifyContent: 'center', alignItems: 'center' },
  statusBarSpacer: { height: 44 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  backButton: { marginRight: 16, padding: 4 },
  backBtnText: { fontSize: 24, color: PULSE_TEXT },
  headerTitle: { fontSize: 20, fontWeight: '700', color: PULSE_TEXT },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: PULSE_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: PULSE_TEXT,
  },
  addBtn: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    height: 44,
    justifyContent: 'center',
    borderRadius: 10,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  listContent: { padding: 16, paddingBottom: 40 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: PULSE_TEXT, marginBottom: 4 },
  emptySub: { fontSize: 13, color: PULSE_SUBTLE },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PULSE_CARD,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: PULSE_BORDER,
  },
  keyword: { flex: 1, fontSize: 16, color: PULSE_TEXT },
  removeBtn: {
    backgroundColor: '#666',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeBtnDisabled: { opacity: 0.6 },
  removeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
