import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';

export default function VerifySuccessScreen({ navigation, route }) {
  const email = route?.params?.email || null;
  const password = route?.params?.password || null;
  const venueApplyAfter = Boolean(route?.params?.venueApplyAfter);
  const city = route?.params?.city || null;
  const { isAuthenticated, login, setPendingVenueApply } = useAuthStore();
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated || !email || !password) return;
    (async () => {
      if (venueApplyAfter) {
        setPendingVenueApply({ city, email });
      }
      setLoggingIn(true);
      await login(email, password, true);
      setLoggingIn(false);
    })();
  }, [email, password, isAuthenticated, login, venueApplyAfter, city, setPendingVenueApply]);

  const handleContinue = () => {
    if (isAuthenticated) return;
    navigation.replace('Login', { email, redirectVenueApply: venueApplyAfter });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <MaterialIcons name="verified" size={64} color="#16a34a" />
        <Text style={styles.title}>Hesabin Hazir</Text>
        <Text style={styles.subtitle}>
          {venueApplyAfter
            ? 'Universite teyidin tamamlandi. LOCAL Venue basvuru formuna yonlendiriliyorsun.'
            : 'Universite e-posta teyidin tamamlandi. LOCAL\'a hos geldin.'}
        </Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
        <Text style={styles.rsPill}>RS 5,0</Text>
        {loggingIn || (isAuthenticated && venueApplyAfter) ? (
          <ActivityIndicator size="small" color="#fff" style={{ marginTop: 12 }} />
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={isAuthenticated}>
            <Text style={styles.buttonText}>
              {isAuthenticated ? 'Yonlendiriliyor...' : "LOCAL'a Gir ->"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f4d', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#11204a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#e5edff' },
  subtitle: { fontSize: 14, color: '#c7d2fe', textAlign: 'center', lineHeight: 20 },
  email: { fontSize: 12, color: '#93c5fd', fontWeight: '700' },
  rsPill: { marginTop: 4, backgroundColor: '#1e3a8a', color: '#dbeafe', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, fontWeight: '800' },
  button: { marginTop: 6, backgroundColor: '#1d4ed8', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  buttonText: { color: '#fff', fontWeight: '700' },
});
