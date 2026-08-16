import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { sendFriendRequest } from '../services/api';

const COLORS = {
  bg: '#f6f3ed',
  surface: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  primary: '#c59d5f',
  divider: '#f1f5f9',
};

export default function RitualAttendeesScreen({ route, navigation }) {
  const { ritualId, participants = [], viewerId, isHost = false } = route.params || {};
  const [requestingId, setRequestingId] = useState(null);
  const [friendSent, setFriendSent] = useState({});

  const attendees = useMemo(() => {
    if (!Array.isArray(participants)) return [];
    return participants
      .filter((p) => p && p.status !== 'no_show' && p.status !== 'left_early')
      .map((p) => ({
        id: p.id ?? p.user_id ?? String(Math.random()),
        name: p.name || p.user_name || p.first_name || 'Guest',
        avatar: p.avatar_url || p.image_url || p.profile_image_url || null,
        checkedIn: !!(p.checked_in || p.checkin_at),
        isHost: !!p.is_host,
        isFriend: p.is_friend === true,
        raw: p,
      }));
  }, [participants]);


  const handleAddFriend = async (attendee) => {
    const targetId = attendee.raw?.id ?? attendee.raw?.user_id;
    if (!viewerId || !targetId) return;
    setRequestingId(String(targetId));
    try {
      await sendFriendRequest(viewerId, targetId);
      setFriendSent((prev) => ({ ...prev, [String(targetId)]: true }));
      Alert.alert('Gonderildi', `${attendee.name} icin arkadaslik istegi gonderildi.`);
    } catch (e) {
      Alert.alert('Hata', e.message || 'Istek gonderilemedi');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
          <MaterialIcons name="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Katilimcilar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>KIMLER GELIYOR</Text>
          <Text style={styles.title}>{attendees.length} kisi</Text>

          <View style={styles.list}>
            {attendees.map((a) => {
              const userId = a.raw?.id ?? a.raw?.user_id;
              const isSelf = viewerId && userId && String(viewerId) === String(userId);
              const canAddFriend =
                !isHost &&
                !a.isHost &&
                !isSelf &&
                a.checkedIn &&
                !a.isFriend &&
                !friendSent[String(userId)];

              return (
                <View key={String(a.id)} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (!userId || !viewerId || !ritualId) return;
                      navigation.navigate('ParticipantProfile', { userId, ritualId, viewerId });
                    }}
                  >
                    <View style={styles.avatarWrap}>
                      {a.avatar ? (
                        <Image source={{ uri: a.avatar }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatarFallback}>
                          <MaterialIcons name="person" size={18} color={COLORS.muted} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.sub}>
                        {a.isHost
                          ? 'Host'
                          : a.isFriend
                            ? 'Arkadas'
                            : a.checkedIn
                              ? 'Check-in yapildi'
                              : 'Check-in bekliyor'}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color="#9ca3af" />
                  </TouchableOpacity>


                  {canAddFriend ? (
                    <TouchableOpacity
                      style={styles.addFriendBtn}
                      onPress={() => handleAddFriend(a)}
                      disabled={requestingId === String(userId)}
                    >
                      {requestingId === String(userId) ? (
                        <ActivityIndicator size="small" color="#1B2E4A" />
                      ) : (
                        <Text style={styles.addFriendBtnText}>+ Ekle</Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}

            {attendees.length === 0 ? (
              <Text style={styles.empty}>Henuz katilimci yok.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eyebrow: { fontSize: 10, fontWeight: '700', color: COLORS.muted, letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  list: { gap: 8 },
  row: { borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingBottom: 8 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatarWrap: { width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  approveBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B2E4A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 50,
    marginBottom: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  addFriendBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1B2E4A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 50,
    marginBottom: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  addFriendBtnText: { color: '#1B2E4A', fontWeight: '700', fontSize: 12 },
  empty: { color: COLORS.muted, paddingVertical: 12 },
});
