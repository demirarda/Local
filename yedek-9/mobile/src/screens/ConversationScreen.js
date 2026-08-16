import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import ShareObjectBubble, { getShareTypeMeta } from '../components/ShareObjectBubble';
import ShareObjectPicker, { PUBLIC_SHARE_TYPES } from '../components/ShareObjectPicker';
import { getDirectMessages, sendShareObject, createModReport } from '../services/api';
import ReportModal from '../components/ReportModal';

const PRIMARY = '#f9a13d';
const DARK_BG = '#0a0a0a';
const CARD_BG = '#1a1a1a';
const TEXT_PRIMARY = '#f4f4f5';
const TEXT_SECONDARY = '#a1a1aa';

export default function ConversationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user: currentUser } = useAuthStore();
  const friendsDmEnabled = useConfigStore(
    (s) => s.config?.stubs?.friends_dm?.enabled !== false
  );
  const {
    userId,
    userName,
    objectType: initialObjectType,
    objectId: initialObjectId,
    objectLabel,
    note: initialNote,
    payload: initialPayload,
  } = route.params || {};
  const currentUserId = currentUser?.id;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState(initialNote || '');
  const [objectType, setObjectType] = useState(initialObjectType || 'ritual_send');
  const [selectedObject, setSelectedObject] = useState(
    initialObjectId
      ? { id: initialObjectId, label: objectLabel || initialObjectId, object_type: initialObjectType }
      : null
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [reportItem, setReportItem] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!currentUserId || !userId) {
      navigation.goBack();
      return;
    }
    loadMessages();
  }, [currentUserId, userId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getDirectMessages(userId);
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolvedObjectId = () => {
    if (objectType === 'passport') return currentUserId;
    return selectedObject?.id || initialObjectId || null;
  };

  const canSend = () => {
    if (sending || !userId || !currentUserId) return false;
    if (PUBLIC_SHARE_TYPES.has(objectType)) return true;
    if (objectType === 'passport') return true;
    return !!resolvedObjectId();
  };

  const handleSend = async () => {
    if (!canSend()) return;

    const text = inputText.trim();
    const objectId = resolvedObjectId();
    const payload = {
      ...(initialPayload || {}),
      preview: selectedObject?.label || objectLabel || undefined,
      ritual_id: selectedObject?.ritual_id || initialPayload?.ritual_id,
    };

    setInputText('');
    setSending(true);
    try {
      const newMsg = await sendShareObject(userId, {
        object_type: objectType,
        object_id: objectId,
        note: text || null,
        payload,
      });
      setMessages((prev) => [...prev, { ...newMsg, is_mine: true }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      setInputText(text);
      Alert.alert('Paylasim', error.message || 'Gonderilemedi');
    } finally {
      setSending(false);
    }
  };

  const handleSharePress = (item) => {
    const ritualId = item.payload?.ritual_id || item.payload?.ritualId;
    if (item.object_type === 'ritual_send' && item.object_id) {
      navigation.navigate('RitualDetail', { ritualId: item.object_id });
      return;
    }
    if ((item.object_type === 'forum_thread' || item.object_type === 'forum_repost') && ritualId) {
      navigation.navigate('RitualForum', { ritualId });
      return;
    }
    if (['memory', 'quote', 'photo'].includes(item.object_type) && item.object_id) {
      navigation.navigate('MemoryDetail', { memory: { id: item.object_id, ...item.payload } });
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const selectedMeta = getShareTypeMeta(objectType);
  const selectionHint = selectedObject?.label
    || (objectType === 'passport' ? 'Passport (public)' : null)
    || (PUBLIC_SHARE_TYPES.has(objectType) ? 'Mekan/davet nesnesi' : null);

  const renderMessage = ({ item }) => (
    <View style={item.is_mine ? styles.rowMine : styles.rowTheirs}>
      <ShareObjectBubble
        item={item}
        isMine={item.is_mine}
        onPress={item.object_type ? () => handleSharePress(item) : undefined}
        onLongPress={
          !item.is_mine
            ? () => setReportItem(item)
            : undefined
        }
      />
      <Text style={[styles.bubbleTime, item.is_mine && styles.bubbleTimeMine]}>
        {formatTime(item.created_at)}
      </Text>
    </View>
  );

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.textSecondary}>Gecersiz sohbet</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="chevron-left" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{userName || 'Share-2-Person'}</Text>
          <Text style={styles.headerSub}>Her mesaj bir nesne · not tek basina yok</Text>
        </View>
        {friendsDmEnabled ? (
          <TouchableOpacity
            style={styles.dmBtn}
            onPress={() => navigation.navigate('FriendsDm', { friendId: userId, friendName: userName })}
          >
            <MaterialIcons name="chat-bubble-outline" size={20} color={PRIMARY} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.textSecondary}>Henuz paylasim yok. Asagidan bir nesne gonder.</Text>
            </View>
          }
        />
      )}

      <View style={styles.typeBar}>
        <TouchableOpacity style={styles.typeChip} onPress={() => setPickerVisible(true)}>
          <MaterialIcons name={selectedMeta.icon} size={16} color={PRIMARY} />
          <View style={styles.typeChipTextWrap}>
            <Text style={styles.typeChipText}>{selectedMeta.label}</Text>
            {selectionHint ? (
              <Text style={styles.typeChipHint} numberOfLines={1}>{selectionHint}</Text>
            ) : null}
          </View>
          <MaterialIcons name="expand-more" size={16} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Kisa not (opsiyonel, max 280)"
          placeholderTextColor={TEXT_SECONDARY}
          multiline
          maxLength={280}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!canSend() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <MaterialIcons name="send" size={22} color="#000" />
          )}
        </TouchableOpacity>
      </View>

      <ShareObjectPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        selectedType={objectType}
        onSelectType={setObjectType}
        selectedObject={selectedObject}
        onSelectObject={setSelectedObject}
      />
      <ReportModal
        visible={Boolean(reportItem)}
        onClose={() => setReportItem(null)}
        reportType="share2person"
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: 'share2person',
              targetId: reportItem?.id || reportItem?.object_id,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', 'Paylaşım raporu kuyruğa alındı');
            setReportItem(null);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { width: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 44,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  backBtn: { padding: 8 },
  dmBtn: { width: 40, alignItems: 'center', justifyContent: 'center', padding: 8 },
  headerBody: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: TEXT_PRIMARY },
  headerSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 24 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  rowMine: { alignSelf: 'flex-end', marginBottom: 8, maxWidth: '88%' },
  rowTheirs: { alignSelf: 'flex-start', marginBottom: 8, maxWidth: '88%' },
  bubbleTime: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.55)' },
  typeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipTextWrap: { flex: 1 },
  typeChipText: { color: TEXT_PRIMARY, fontSize: 13, fontWeight: '600' },
  typeChipHint: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: DARK_BG,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: TEXT_PRIMARY,
    fontSize: 15,
    marginRight: 8,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  textSecondary: { color: TEXT_SECONDARY, fontSize: 14 },
});
