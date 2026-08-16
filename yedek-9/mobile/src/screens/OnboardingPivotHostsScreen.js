import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import useAuthStore from '../store/authStore';
import { updateUserProfile } from '../services/api';

const HOSTS_BY_CITY = {
  Milano: ['Giulia · Coffee & Books', 'Marco · Run Club'],
  Istanbul: ['Ece · Art & Film', 'Kaan · Tech & Startup'],
  London: ['Amelia · Wellness', 'Noah · Music Circle'],
};

export default function OnboardingPivotHostsScreen({ navigation, route }) {
  const { enterAuthenticatedSession, updateUser } = useAuthStore();
  const city = route?.params?.city || 'Milano';
  const interests = route?.params?.interests || [];
  const moods = route?.params?.moods || [];
  const firstName = route?.params?.firstName || '';
  const lastName = route?.params?.lastName || '';
  const email = route?.params?.email || '';
  const university = route?.params?.university || '';
  const track = route?.params?.track;
  const hosts = HOSTS_BY_CITY[city] || HOSTS_BY_CITY.Milano;

  const finishIdentityTrack = async (pivotHost) => {
    try {
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        await updateUserProfile(userId, { city }).catch(() => {});
      }
      // Server gate only — do not client-spoof identity_verified
      await enterAuthenticatedSession({
        city,
        identity_track: 'identity',
        university: null,
        show_uni_label: false,
        pivotHost,
        interests,
        moods,
      });
      await updateUser({ city, requires_identity_kyc: false });
    } catch (error) {
      Alert.alert(
        'Giris tamamlanamadi',
        error?.message || 'Once kimlik dogrulamasini tamamla.'
      );
      navigation.replace('OnboardingIdentityKyc');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OB-09 Pivot Hosts</Text>
      <Text style={styles.sub}>
        City: {city} · Interests: {interests.slice(0, 2).join(', ') || 'General'} · Mood: {moods.slice(0, 1).join(', ') || 'Open'}
      </Text>
      {hosts.map((h) => (
        <View key={h} style={styles.card}>
          <Text style={styles.host}>{h}</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              if (track === 'identity') {
                finishIdentityTrack(h);
                return;
              }
              navigation.navigate('Register', {
                firstName,
                lastName,
                email,
                city,
                university,
                interests,
                moods,
                pivotHost: h,
              });
            }}
          >
            <Text style={styles.btnText}>{track === 'identity' ? 'LOCAL\'e gir' : 'Rituale Katil'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 16 },
  title: { color: '#f9fafb', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  sub: { color: '#cbd5e1', marginBottom: 10 },
  card: { backgroundColor: '#1f2937', borderRadius: 12, borderWidth: 1, borderColor: '#374151', padding: 12, marginBottom: 8 },
  host: { color: '#e5e7eb', fontWeight: '700', marginBottom: 8 },
  btn: { backgroundColor: '#f9a13d', borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  btnText: { color: '#111827', fontWeight: '800' },
});
