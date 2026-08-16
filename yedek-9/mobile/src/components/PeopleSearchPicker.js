import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { searchDiscovery, fetchFriends } from '../services/api';
import useAuthStore from '../store/authStore';

const CARD = '#fff';
const BORDER = '#e8e8e8';

const TIER_LABEL = {
  friends: 'Arkadas',
  followers: 'Takipci',
  fl_network: 'FL agi',
  everyone: '',
};

/**
 * Ham UUID yerine kisi secimi — bos sorguda arkadas listesi, yazinca §12 people araması.
 */
export default function PeopleSearchPicker({
  visible,
  onClose,
  onSelect,
  title = 'Kisi sec',
  hint,
  excludeIds = [],
  confirmLabel = 'Sec',
}) {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setPeople([]);
      setSelected(null);
      setError(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFriends(user.id, 'accepted');
        if (cancelled) return;
        setFriends(
          (data || [])
            .map((item) => {
              const friend = item.friend || item.user || {};
              return {
                id: friend.id || item.friend_id || item.user_id,
                label: friend.name || 'Arkadas',
                meta: { tier: 'friends' },
              };
            })
            .filter((x) => x.id)
        );
      } catch (_e) {
        if (!cancelled) setFriends([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user?.id]);

  const runSearch = useCallback(async (q) => {
    const trimmed = String(q || '').trim();
    if (!trimmed) {
      setPeople([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchDiscovery({ q: trimmed, tab: 'people', limit: 25 });
      setPeople(data?.results || []);
    } catch (e) {
      setError(e?.message || 'Arama basarisiz');
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const handle = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(handle);
  }, [visible, query, runSearch]);

  const excluded = new Set([...(excludeIds || []), user?.id].map(String));
  const list = (String(query).trim() ? people : friends).filter(
    (p) => !excluded.has(String(p.id))
  );

  const handleConfirm = async () => {
    if (!selected) return;
    try {
      setBusy(true);
      await onSelect?.(selected);
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = String(selected?.id) === String(item.id);
    const tier = TIER_LABEL[item.meta?.tier] ?? '';
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => setSelected(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(item.label || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.label}
          </Text>
          {tier ? <Text style={styles.rowMeta}>{tier}</Text> : null}
        </View>
        {isSelected ? <Text style={styles.check}>✓</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Isim ara…"
            placeholderTextColor="#9a9a9a"
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <ActivityIndicator color="#111" style={{ marginVertical: 8 }} /> : null}
          <FlatList
            data={list}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>
                  {String(query).trim() ? 'Kisi bulunamadi' : 'Arkadas listen bos · isim ara'}
                </Text>
              ) : null
            }
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Vazgec</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!selected || busy) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!selected || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d4d4d4',
    marginVertical: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  hint: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  input: {
    marginTop: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  list: { marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowSelected: { borderColor: '#111', backgroundColor: '#f0f0f0' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: '#444' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  check: { fontSize: 16, fontWeight: '800', color: '#111' },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
  error: { color: '#b45309', fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
  },
  cancelText: { fontWeight: '600', color: '#666' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontWeight: '700', color: '#fff' },
});
