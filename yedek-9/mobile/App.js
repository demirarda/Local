import React, { useEffect, useRef, useState } from 'react';
import { initSentry, setSentryUser, clearSentryUser } from './src/utils/sentry';

initSentry();
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import FriendAcceptedToast from './src/components/FriendAcceptedToast';
import OnboardingOverlay from './src/components/OnboardingOverlay';
import VerificationGate from './src/components/VerificationGate';
import ActiveRitualBubble, { incrementActiveRitualUnread } from './src/components/ActiveRitualBubble';
import WindowBubbleBar from './src/components/WindowBubbleBar';
import HostWitnessModal from './src/components/HostWitnessModal';
import OfflineBanner from './src/components/OfflineBanner';
import WelcomeScreen from './src/components/WelcomeScreen';
import { initializeNotifications, setupNotificationListeners } from './src/services/notifications';
import { navigateFromNotification } from './src/utils/notificationRouting';
import websocketService from './src/services/websocket';
import useAuthStore from './src/store/authStore';
import useConfigStore from './src/store/configStore';
import { updateUserProfile } from './src/services/api';
import { setVerificationPromptHandler, isUserVerified } from './src/utils/verificationGuard';
import { handlePortalDeepLink, parsePortalLink } from './src/utils/portalDeepLink';

const ONBOARDING_KEY = '@local_has_seen_onboarding';
const ONBOARDING_PROFILE_KEY = '@local_onboarding_profile';
const NOTIFICATION_UNREAD_KEY = '@local_notification_unread_count';

// Global navigation ref for notification handling
export const navigationRef = React.createRef();

const linking = {
  prefixes: ['local://', 'https://local.app', 'http://localhost:19006'],
  config: {
    screens: {
      ResetPassword: 'reset-password/:token',
      VerifyEmail: 'verify-email/:token',
      Main: {
        screens: {
          Pulse: 'pulse',
          CityRhythm: 'city-rhythm',
          SocialPassport: 'social-passport',
          Local: 'local',
        },
      },
      RitualDetail: 'ritual/:ritualId',
      LiveRitual: 'ritual/:ritualId/live',
      ZoneDetail: 'zone/:zoneId',
    },
  },
};

export default function App() {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [friendToast, setFriendToast] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [verifyPromptMessage, setVerifyPromptMessage] = useState('');
  const [verifyPromptNonce, setVerifyPromptNonce] = useState(0);
  const lastForceRouteRef = useRef(null);

  const handledPortalUrlRef = useRef(null);

  const { initialize, isAuthenticated, user, isLoading, updateUser, pendingVenueApply, clearPendingVenueApply } = useAuthStore();
  const initializeConfig = useConfigStore((s) => s.initializeConfig);
  const publicConfig = useConfigStore((s) => s.config);

  // Set Sentry user context when logged in
  useEffect(() => {
    if (user) {
      setSentryUser(user);
    } else {
      clearSentryUser();
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated || !pendingVenueApply) return;
    const timer = setTimeout(() => {
      navigationRef.current?.navigate('VenueApply', {
        prefillEmail: pendingVenueApply.email || user?.email,
        prefillCity: pendingVenueApply.city,
      });
      clearPendingVenueApply();
    }, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, pendingVenueApply, user?.email, clearPendingVenueApply]);

  // TOTEM 3-hal kapısı: linking config'te eşleşen ekran yok, portal URL'ini burada çözüyoruz
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    let cancelled = false;

    const route = (url) => {
      if (cancelled || !url || handledPortalUrlRef.current === url) return;
      if (!parsePortalLink(url)) return;
      handledPortalUrlRef.current = url;
      handlePortalDeepLink(navigationRef, url, {
        userId: user.id,
        config: publicConfig,
      }).catch(() => {});
    };

    Linking.getInitialURL()
      .then((url) => route(url))
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => route(url));

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [isAuthenticated, user?.id, publicConfig]);

  useEffect(() => {
    if (!isAuthenticated) return;
    websocketService.connect();

    const onChatMessage = async (payload) => {
      const ritualId = payload?.ritual_id || payload?.message?.ritual_id;
      if (!ritualId) return;

      const route = navigationRef.current?.getCurrentRoute?.();
      const isOnSameLiveRitual =
        (route?.name === 'LiveRitual' || route?.name === 'LiveRitualDark') &&
        String(route?.params?.ritualId) === String(ritualId);

      if (!isOnSameLiveRitual) {
        await incrementActiveRitualUnread(ritualId);
      }
    };

    websocketService.on('chat:message', onChatMessage);
    return () => {
      websocketService.off('chat:message', onChatMessage);
    };
  }, [isAuthenticated]);

  // Show onboarding once per user (first time they see the main app)
  useEffect(() => {
    if (!isAuthenticated || onboardingChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!cancelled && !seen) setShowOnboarding(true);
      } catch (_) {
        if (!cancelled) setShowOnboarding(false);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, onboardingChecked]);

  // Initialize auth + public config on app start
  useEffect(() => {
    const initAuth = async () => {
      await Promise.all([initialize(), initializeConfig()]);
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  useEffect(() => {
    setVerificationPromptHandler((message) => {
      setVerifyPromptMessage(message || 'Verify your university email to continue.');
      setVerifyPromptNonce((x) => x + 1);
    });
    return () => setVerificationPromptHandler(null);
  }, []);

  useEffect(() => {
    // Initialize notifications with current user ID
    const userId = user?.id || null;
    if (userId) {
      initializeNotifications(userId);
    }

    // Setup notification listeners (always setup, even if no user yet)
    const [receivedListener, responseListener] = setupNotificationListeners(
      // Foreground notification handler
      (notification) => {
        const data = notification?.request?.content?.data || {};
        if (__DEV__) console.log('Notification received:', data);
        AsyncStorage.getItem(NOTIFICATION_UNREAD_KEY)
          .then((raw) => Number(raw || '0'))
          .then((count) => AsyncStorage.setItem(NOTIFICATION_UNREAD_KEY, String(count + 1)))
          .catch(() => {});

        if (data.type === 'friend_request_accepted') {
          setFriendToast({
            friendName: data.friend_name || 'New friend',
            friendId: data.friend_id || null,
            ritualTitle: data.ritual_title || null,
          });
          return;
        }
      },
      // Notification tap — §11 masaya çağırır (data.screen)
      (response) => {
        const data = response.notification.request.content.data || {};
        if (__DEV__) console.log('Notification tapped:', data);
        AsyncStorage.setItem(NOTIFICATION_UNREAD_KEY, '0').catch(() => {});
        if (navigationRef.current) {
          navigateFromNotification(navigationRef, data);
        }
      }
    );

    notificationListener.current = receivedListener;
    responseListener.current = responseListener;

    // Cleanup
    return () => {
      // In newer expo-notifications versions, subscriptions expose a .remove() method
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  // Uygulama ilk açıldığında karşılama arayüzü (loading.html ile aynı)
  if (showWelcome) {
    return (
      <View style={styles.loadingContainer}>
        <WelcomeScreen onFinish={() => setShowWelcome(false)} />
      </View>
    );
  }

  // Show loading screen while initializing auth
  if (isInitializing || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  const handleOnboardingFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch (_) {}
    setShowOnboarding(false);
  };

  const handleOnboardingProfileSave = async (profile) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile || {}));
      if (user?.id && profile) {
        const updates = {};
        if (profile.city) updates.city = profile.city;
        if (Array.isArray(profile.interests)) updates.interests = profile.interests;
        if (profile.university_email) updates.university_email = profile.university_email;
        if (Object.keys(updates).length > 0) {
          const serverUser = await updateUserProfile(user.id, updates);
          await updateUser(serverUser || updates);
        }
      }
    } catch (_) {}
  };

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <NavigationContainer
        ref={navigationRef}
        linking={linking}
        theme={DefaultTheme}
        onStateChange={() => {
          const routeName = navigationRef.current?.getCurrentRoute?.()?.name || null;
          if (!isAuthenticated || isUserVerified(user)) return;
          if (!routeName || routeName === 'VerifyEmail' || routeName === 'OnboardingIdentityKyc') return;
          lastForceRouteRef.current = routeName;
        }}
      >
        <AppNavigator isAuthenticated={isAuthenticated} />
        {isAuthenticated && (
          <OnboardingOverlay
            visible={showOnboarding}
            onFinish={handleOnboardingFinish}
            onSaveProfile={handleOnboardingProfileSave}
          />
        )}
        {isAuthenticated && !isUserVerified(user) && (
          <VerificationGate
            visible
            promptMessage={verifyPromptMessage}
            promptNonce={verifyPromptNonce}
            onVerifyNow={() => {
              if (user?.identity_track === 'identity') {
                navigationRef.current?.navigate('OnboardingIdentityKyc');
                return;
              }
              navigationRef.current?.navigate('VerifyEmail', { email: user?.email });
            }}
            onDismiss={() => {}}
          />
        )}
        {isAuthenticated && (
          <ActiveRitualBubble navigation={navigationRef.current} />
        )}
        {isAuthenticated ? <HostWitnessModal /> : null}
        {isAuthenticated && (
          <View style={styles.windowBubbleOverlay} pointerEvents="box-none">
            <WindowBubbleBar navigation={navigationRef.current} />
          </View>
        )}
        <FriendAcceptedToast
          visible={!!friendToast}
          friendName={friendToast?.friendName}
          ritualTitle={friendToast?.ritualTitle}
          onViewProfile={() => {
            setFriendToast(null);
            if (navigationRef.current) {
              navigationRef.current.navigate('Main', { screen: 'SocialPassport' });
            }
          }}
          onDismiss={() => setFriendToast(null)}
        />
        <StatusBar style="dark" />
      </NavigationContainer>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  windowBubbleOverlay: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 50,
  },
});
