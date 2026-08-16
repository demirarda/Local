import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  fetchDmThreads,
  openDmThread,
  fetchDmMessages,
  sendDmMessage,
  markDmThreadRead,
  fetchFriends,
} from '../services/api';

const MESSAGE_MAX = 2000;

export default function FriendsDmScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const threadIdParam = route.params?.threadId;
  const friendIdParam = route.params?.friendId;

  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(threadIdParam || null);
  const [peerName, setPeerName] = useState(route.params?.friendName || '');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const listRef = useRef(null);

  const loadInbox = useCallback(async () => {
    const data = await fetchDmThreads();
    setThreads(Array.isArray(data) ? data : []);
  }, []);

  const loadMessages = useCallback(async (tid) => {
    if (!tid) return;
    const data = await fetchDmMessages(tid);
    setMessages(Array.isArray(data) ? data : []);
    markDmThreadRead(tid).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let tid = threadIdParam || null;
        if (friendIdParam && !threadIdParam) {
          const opened = await openDmThread(friendIdParam);
          if (cancelled) return;
          tid = opened?.id || null;
          setActiveThread(tid);
          setPeerName(opened?.friend?.name || route.params?.friendName || '');
        }
        await loadInbox();
        if (tid) await loadMessages(tid);
      } catch (e) {
        if (!cancelled) {
          setError(
            e.featureDisabled
              ? 'Friends-DM su an kapali.'
              : e.message || 'Yuklenemedi'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendIdParam, threadIdParam]);

  const openThread = async (row) => {
    setActiveThread(row.id);
    setPeerName(row.friend?.name || '');
    setLoading(true);
    try {
      await loadMessages(row.id);
    } catch (e) {
      setError(e.message || 'Mesajlar yuklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const onSend = async () => {
    const body = text.trim();
    if (!body || !activeThread || sending) return;
    setSending(true);
    try {
      const sent = await sendDmMessage(activeThread, body);
      setText('');
      setMessages((prev) => [...prev, { ...sent, is_mine: true }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      loadInbox().catch(() => {});
    } catch (e) {
      setError(e.message || 'Mesaj gonderilemedi');
    } finally {
      setSending(false);
    }
  };

  const openFriendPicker = async () => {
    setError(null);
    try {
      const data = await fetchFriends();
      const list = (Array.isArray(data) ? data : data?.friends || []).map((item) => {
        const friend = item.friend || item.user || item;
        return { id: friend.id || item.friend_id, name: friend.name || 'Arkadas' };
      });
      if (!list.length) {
        setError('Once arkadas ekle — Friends-DM yalniz karsilikli arkadaslar.');
        return;
      }
      setFriends(list);
      setPickerOpen(true);
    } catch (e) {
      setError(e.message || 'Arkadas listesi alinamadi');
    }
  };

  const startWithFriend = async (friend) => {
    setPickerOpen(false);
    setLoading(true);
    try {
      const opened = await openDmThread(friend.id);
      setActiveThread(opened.id);
      setPeerName(opened.friend?.name || friend.name || '');
      await loadMessages(opened.id);
      await loadInbox();
    } catch (e) {
      setError(e.message || 'Sohbet acilamadi');
    } finally {
      setLoading(false);
    }
  };

  if (!activeThread) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialIcons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>Mesajlar</Text>
        <Text style={styles.sub}>Yalniz karsilikli arkadaslar (Friends-DM).</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : (
          <>
            <TouchableOpacity style={styles.primary} onPress={openFriendPicker}>
              <Text style={styles.primaryText}>Arkadasla yaz</Text>
            </TouchableOpacity>
            <FlatList
              data={threads}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => openThread(item)}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{item.friend?.name || 'Arkadas'}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.last_message_preview || 'Yeni konusma'}
                    </Text>
                  </View>
                  {item.unread_count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread_count}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.sub}>Henuz konusma yok.</Text>}
            />
          </>
        )}

        <Modal visible={pickerOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Kiminle yazacaksin?</Text>
              <FlatList
                data={friends}
                keyExtractor={(i) => String(i.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickRow} onPress={() => startWithFriend(item)}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.modalClose} onPress={() => setPickerOpen(false)}>
                <Text style={styles.primaryText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            setActiveThread(null);
            setMessages([]);
            loadInbox().catch(() => {});
          }}
        >
          <MaterialIcons name="arrow-back" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>{peerName || 'Konusma'}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.is_mine && styles.bubbleMine]}>
              <Text style={[styles.bubbleText, item.is_mine && styles.bubbleTextMine]}>
                {item.deleted ? 'Mesaj silindi' : item.body}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.sub}>Ilk mesaji sen yaz.</Text>}
        />
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Mesaj yaz..."
          maxLength={MESSAGE_MAX}
          multiline
        />
        <TouchableOpacity
          style={[styles.send, (sending || !text.trim()) && styles.sendDisabled]}
          onPress={onSend}
          disabled={sending || !text.trim()}
        >
          <MaterialIcons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', paddingTop: 48 },
  back: { marginLeft: 16, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111', paddingHorizontal: 16 },
  sub: { color: '#6b7280', paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  error: { color: '#b91c1c', padding: 16 },
  primary: {
    marginHorizontal: 16,
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { fontWeight: '700', color: '#111' },
  rowMeta: { color: '#6b7280', marginTop: 4, fontSize: 13 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', paddingHorizontal: 16, marginBottom: 12 },
  pickRow: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
  },
  modalClose: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#111' },
  bubbleText: { color: '#111' },
  bubbleTextMine: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
