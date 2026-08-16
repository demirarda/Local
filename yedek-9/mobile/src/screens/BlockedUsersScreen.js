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
import useAuthStore from '../store/authStore';
import { fetchBlockedUsers, unblockUser } from '../services/api';

const PULSE_SCREEN_BG = '#f5f5f5';
const PULSE_CARD_BG = '#fff';
const PULSE_HEADER_BG = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_TEXT = '#000';
const PULSE_SUBTLE = '#999';
const PULSE_USERNAME = '#666';

// Simple relative time (e.g. "Blocked 2 weeks ago")
function formatBlockedDate(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  const now = new Date();
  const sec = Math.floor((now - date) / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  const week = Math.floor(day / 7);
  const month = Math.floor(day / 30);
  if (month >= 1) return `Blocked ${month} month${month !== 1 ? 's' : ''} ago`;
  if (week >= 1) return `Blocked ${week} week${week !== 1 ? 's' : ''} ago`;
  if (day >= 1) return `Blocked ${day} day${day !== 1 ? 's' : ''} ago`;
  if (hour >= 1) return `Blocked ${hour} hour${hour !== 1 ? 's' : ''} ago`;
  if (min >= 1) return `Blocked ${min} minute${min !== 1 ? 's' : ''} ago`;
  return 'Blocked just now';
}

// Gradient placeholder colors for avatar (by string hash)
const AVATAR_GRADIENTS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
];

function getAvatarGradient(id) {
  if (!id) return AVATAR_GRADIENTS[0];
  const idx = Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[idx];
}

export default function BlockedUsersScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await fetchBlockedUsers(currentUserId);
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error loading blocked users:', e);
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

  const handleUnblock = (blockedUserId, name) => {
    Alert.alert(
      'Unblock',
      `Unblock ${name || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            if (!currentUserId) return;
            try {
              setUnblockingId(blockedUserId);
              await unblockUser(currentUserId, blockedUserId);
              setList(prev => prev.filter(item => (item.blocked_user?.id || item.blocked_user_id) !== blockedUserId));
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not unblock.');
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading && list.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PULSE_TEXT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
      </View>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id || item.blocked_user?.id || String(Math.random())}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Blocked users cannot see your profile, send you messages, or invite you to rituals. You won't see their content in your feed.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No blocked users</Text>
            <Text style={styles.emptySub}>Block someone from their profile to see them here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const bu = item.blocked_user || {};
          const id = bu.id || item.blocked_user_id;
          const name = bu.name || 'Unknown';
          const city = bu.city;
          const avatarUrl = bu.avatar_url || null;
          const blockedDate = formatBlockedDate(item.created_at);
          const [color1, color2] = getAvatarGradient(id);
          const isUnblocking = unblockingId === id;
          return (
            <View style={styles.userCard}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarPlaceholder, { backgroundColor: color1 }]} />
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{name}</Text>
                {city ? <Text style={styles.userUsername}>{city}</Text> : null}
                {blockedDate ? <Text style={styles.blockedDate}>{blockedDate}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.unblockBtn, isUnblocking && styles.unblockBtnDisabled]}
                onPress={() => handleUnblock(id, name)}
                disabled={isUnblocking}
                activeOpacity={0.7}
              >
                {isUnblocking ? (
                  <ActivityIndicator size="small" color={PULSE_TEXT} />
                ) : (
                  <Text style={styles.unblockBtnText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PULSE_SCREEN_BG },
  centered: { justifyContent: 'center', alignItems: 'center' },
  statusBarSpacer: { height: 44 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: PULSE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  backButton: { marginRight: 16, padding: 4 },
  backBtnText: { fontSize: 24, color: PULSE_TEXT },
  headerTitle: { fontSize: 20, fontWeight: '700', color: PULSE_TEXT },
  listContent: { padding: 16, paddingBottom: 40 },
  infoCard: {
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: PULSE_USERNAME,
    lineHeight: 22,
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: PULSE_TEXT, marginBottom: 4 },
  emptySub: { fontSize: 13, color: PULSE_SUBTLE },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userAvatarPlaceholder: {
    backgroundColor: '#ddd',
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 16, fontWeight: '700', color: PULSE_TEXT, marginBottom: 2 },
  userUsername: { fontSize: 14, color: PULSE_USERNAME, marginBottom: 4 },
  blockedDate: { fontSize: 12, color: PULSE_SUBTLE },
  unblockBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: PULSE_TEXT,
    borderRadius: 20,
  },
  unblockBtnDisabled: { opacity: 0.6 },
  unblockBtnText: { fontSize: 14, fontWeight: '600', color: PULSE_TEXT },
});
