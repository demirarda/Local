import React from 'react';
import { View } from 'react-native';
import WelcomeScreen from '../components/WelcomeScreen';
import useAuthStore from '../store/authStore';

export default function SplashScreen({ navigation }) {
  return (
    <View style={{ flex: 1 }}>
      <WelcomeScreen
        durationMs={2500}
        onFinish={() => {
          const { token, user } = useAuthStore.getState();
          const pendingKyc =
            Boolean(token) &&
            user?.identity_track === 'identity' &&
            !user?.identity_verified &&
            !user?.email_verified;
          navigation.replace(pendingKyc ? 'OnboardingIdentityKyc' : 'AuthWelcome');
        }}
      />
    </View>
  );
}
