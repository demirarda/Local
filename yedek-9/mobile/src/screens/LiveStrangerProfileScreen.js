import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import ReportModal from '../components/ReportModal';
import { reportUser } from '../services/api';
import useAuthStore from '../store/authStore';

export default function LiveStrangerProfileScreen({ navigation, route }) {
  const name = route?.params?.name || 'Yabanci Kullanici';
  const rsRounded = Math.round(Number(route?.params?.rs_score || 6.2));
  const ritualTitle = route?.params?.ritualTitle || 'Ayni Ritualde katilimci';
  const targetUserId = route?.params?.userId;
  const [showReportModal, setShowReportModal] = useState(false);
  const { user } = useAuthStore();

  const handleReport = async (payload) => {
    try {
      await reportUser(user?.id, targetUserId, payload.reason, payload.description);
      setShowReportModal(false);
      navigation.navigate('ReportSubmitted');
    } catch (error) {
      Alert.alert('Hata', error?.message || 'Rapor gonderilemedi');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.sub}>Bu kullaniciyla baglanti seviyen dusuk. Profil detaylari sinirli gorunur.</Text>
      <View style={styles.card}>
        <Text style={styles.row}>Katilimci: {name}</Text>
        <Text style={styles.row}>Ritual baglami: {ritualTitle}</Text>
        <Text style={styles.row}>RS: {rsRounded} / 10</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('ParticipantProfile', { userId: route?.params?.userId, ritualId: route?.params?.ritualId, viewerId: route?.params?.viewerId })}>
          <Text style={styles.btnText}>Arkadas Ekle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.reportBtn]} onPress={() => setShowReportModal(true)}>
          <Text style={styles.btnText}>Sikayet Et</Text>
        </TouchableOpacity>
      </View>
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReport}
        reportType="user"
        reportedId={targetUserId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 8, color: '#4b5563' },
  card: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  row: { color: '#111827', marginBottom: 8 },
  btn: { marginTop: 8, backgroundColor: '#111827', borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  reportBtn: { backgroundColor: '#b91c1c' },
  btnText: { color: '#fff', fontWeight: '700' },
});
