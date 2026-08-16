import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { fetchNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../services/notifications';
import { fetchPendingRequests, acceptFriendRequest, declineFriendRequest } from '../services/api';
import { NOTIF_TABS, getNotifMeta, buildNotifBody, normalizeNotifType } from '../constants/notifTaxonomy';
import { navigateFromNotification } from '../utils/notificationRouting';

function mergeFriendRequests(items, pendingRequests) {
  const hasReq = new Set(
    (items || [])
      .filter((x) => normalizeNotifType(x?.type) === 'friend_request')
      .map((x) => String(x?.data?.sender_id || x?.data?.from_user_id || x?.data?.friend_id || ''))
      .filter(Boolean)
  );
  const synthetic = (pendingRequests || [])
    .filter((r) => !hasReq.has(String(r?.requester?.id || r?.user_id)))
    .map((r) => ({
      id: `pending-${r.id}`,
      type: 'friend_request',
      title: 'Arkadaşlık İsteği',
      body: `${r?.requester?.name || r?.name || 'Biri'} bağlanmak istiyor`,
      data: { sender_id: r?.requester?.id || r?.user_id, friendship_id: r.id, friend_name: r?.requester?.name || r?.name },
      read_at: null,
      is_read: false,
      created_at: r.created_at,
    }));
  return [...(items || []), ...synthetic].sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
}

export default function NotificationCenterScreen({ navigation, route }) {
  const isDark = !!route?.params?.forceDark;
  const { user } = useAuthStore();
  const [tab, setTab] = useState('Tümü');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [respondingId, setRespondingId] = useState(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [data, pending] = await Promise.all([
      fetchNotifications(user.id, 80, false),
      fetchPendingRequests(user.id).catch(() => []),
    ]);
    const normalizedItems = Array.isArray(data) ? data.map((x) => ({ ...x, is_read: x.is_read ?? x.read })) : [];
    setPendingRequests(Array.isArray(pending) ? pending : []);
    setItems(mergeFriendRequests(normalizedItems, pending));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === 'Tümü') return items;
    return items.filter((x) => getNotifMeta(x).category === tab);
  }, [items, tab]);

  const unreadCount = items.filter((x) => !x.read_at && !x.is_read).length;

  const onMarkAll = async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true, read_at: x.read_at || new Date().toISOString() })));
  };

  const onPressItem = async (item) => {
    if (item?.id && !item?.is_read && !item?.read_at) {
      await markNotificationAsRead(item.id, user?.id);
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_read: true, read_at: new Date().toISOString() } : x)));
    }
    navigateFromNotification({ current: navigation }, { ...(item?.data || {}), type: item?.type, screen: item?.data?.screen });
  };

  const onAcceptRequest = async (item) => {
    if (!user?.id) return;
    const friendshipId = item?.data?.friendship_id;
    const senderId = item?.data?.sender_id || item?.data?.from_user_id || item?.data?.friend_id;
    const req = (pendingRequests || []).find((r) => String(r?.id) === String(friendshipId) || String(r?.requester?.id || r?.user_id) === String(senderId));
    const id = friendshipId || req?.id;
    if (!id) return;
    setRespondingId(String(item.id));
    try {
      await acceptFriendRequest(id);
      await markNotificationAsRead(item.id, user.id);
      await load();
    } finally {
      setRespondingId(null);
    }
  };

  const onRejectRequest = async (item) => {
    if (!user?.id) return;
    const friendshipId = item?.data?.friendship_id;
    const senderId = item?.data?.sender_id || item?.data?.from_user_id || item?.data?.friend_id;
    const req = (pendingRequests || []).find((r) => String(r?.requester?.id || r?.user_id) === String(senderId));
    const id = friendshipId || req?.id;
    if (!id) return;
    setRespondingId(String(item.id));
    try {
      await declineFriendRequest(id);
      await markNotificationAsRead(item.id, user.id);
      await load();
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#f9fafb' : '#111'} />
        </TouchableOpacity>
        <Text style={[styles.title, isDark && styles.titleDark]}>Bildirimler</Text>
        <TouchableOpacity onPress={onMarkAll} disabled={!unreadCount}>
          <Text style={[styles.markAll, isDark && styles.markAllDark, !unreadCount && styles.disabled]}>Tümünü okundu yap</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, isDark && styles.tabsDark]}>
        {NOTIF_TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, isDark && styles.tabDark, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, isDark && styles.tabTextDark, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#111" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {filtered.map((item) => {
            const unread = !item.read_at && !item.is_read;
            const meta = getNotifMeta(item);
            const isFriendReq = normalizeNotifType(item?.type) === 'friend_request';
            return (
              <TouchableOpacity key={String(item.id)} style={[styles.row, isDark && styles.rowDark]} onPress={() => onPressItem(item)}>
                <View style={[styles.dot, unread && styles.dotUnread]} />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, isDark && styles.rowTitleDark]} numberOfLines={2}>{meta.title}</Text>
                  <Text style={styles.rowMeta}>{buildNotifBody(item)}</Text>
                  <Text style={styles.rowCat}>{meta.category}</Text>
                  {isFriendReq && (
                    <View style={styles.inlineActions}>
                      <TouchableOpacity style={[styles.inlineBtn, styles.acceptBtn]} disabled={respondingId === String(item.id)} onPress={() => onAcceptRequest(item)}>
                        <Text style={styles.inlineBtnText}>Kabul</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.inlineBtn, styles.rejectBtn]} disabled={respondingId === String(item.id)} onPress={() => onRejectRequest(item)}>
                        <Text style={styles.inlineBtnText}>Reddet</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && <Text style={styles.empty}>Bu sekmede bildirim yok.</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  containerDark: { backgroundColor: '#030712' },
  header: {
    paddingTop: 58,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  headerDark: { backgroundColor: '#030712', borderBottomColor: '#1f2937' },
  back: { width: 34, alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  titleDark: { color: '#f9fafb' },
  markAll: { fontSize: 12, fontWeight: '700', color: '#111' },
  markAllDark: { color: '#fbbf24' },
  disabled: { opacity: 0.35 },
  tabs: { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: '#fff' },
  tabsDark: { backgroundColor: '#030712' },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f0f0f0' },
  tabDark: { backgroundColor: '#111827' },
  tabActive: { backgroundColor: '#111' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 12 },
  tabTextDark: { color: '#9ca3af' },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 12, gap: 8 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowDark: { backgroundColor: '#111827', borderColor: '#1f2937' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  dotUnread: { backgroundColor: '#ef4444' },
  rowBody: { flex: 1 },
  rowTitle: { color: '#111', fontWeight: '600', fontSize: 14 },
  rowTitleDark: { color: '#f3f4f6' },
  rowMeta: { marginTop: 4, color: '#888', fontSize: 11, fontWeight: '600' },
  rowCat: { marginTop: 4, color: '#aaa', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  inlineActions: { marginTop: 8, flexDirection: 'row', gap: 8 },
  inlineBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  acceptBtn: { backgroundColor: '#16a34a' },
  rejectBtn: { backgroundColor: '#dc2626' },
  inlineBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#888', marginTop: 24, fontSize: 14 },
});
