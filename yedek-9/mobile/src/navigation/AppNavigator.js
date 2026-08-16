import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet, NativeModules } from 'react-native';

// Main App Screens
import PulseScreen from '../screens/PulseScreen';
import CityRhythmScreen from '../screens/CityRhythmScreen';
import SocialPassportScreen from '../screens/SocialPassportScreen';
import RitualDetailScreen from '../screens/RitualDetailScreen';
import LiveRitualScreen from '../screens/LiveRitualScreen';
import RSTransparencyScreen from '../screens/RSTransparencyScreen';
import ParticipantProfileScreen from '../screens/ParticipantProfileScreen';
import RitualAttendeesScreen from '../screens/RitualAttendeesScreen';
import VenueMapScreen from '../screens/VenueMapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import BlockedKeywordsScreen from '../screens/BlockedKeywordsScreen';
import SavedItemsScreen from '../screens/SavedItemsScreen';
import MutedItemsScreen from '../screens/MutedItemsScreen';
import FollowRequestsScreen from '../screens/FollowRequestsScreen';
import CollaboratorsScreen from '../screens/CollaboratorsScreen';
import CreateRitualScreen from '../screens/CreateRitualScreen';
import FriendsListScreen from '../screens/FriendsListScreen';
import QRBumpScreen from '../screens/QRBumpScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import ModerationScreen from '../screens/ModerationScreen';
import RitualFeedbackScreen from '../screens/RitualFeedbackScreen';
import ParticipantFeedbackScreen from '../screens/ParticipantFeedbackScreen';
import FullRitualsListScreen from '../screens/FullRitualsListScreen';
import RitualCompleteScreen from '../screens/RitualCompleteScreen';
import ConversationScreen from '../screens/ConversationScreen';
import RitualForumScreen from '../screens/RitualForumScreen';
import VenueDetailScreen from '../screens/VenueDetailScreen';
import ZoneDetailScreen from '../screens/ZoneDetailScreen';
import SearchScreen from '../screens/SearchScreen';
import ChainProfileScreen from '../screens/ChainProfileScreen';
import BrandProfileScreen from '../screens/BrandProfileScreen';
import MyRegularsScreen from '../screens/MyRegularsScreen';
import YourMemoriesScreen from '../screens/YourMemoriesScreen';
import WaitingRoomScreen from '../screens/WaitingRoomScreen';
import RitualCheckInScreen from '../screens/RitualCheckInScreen';
import DSUserDashboardScreen from '../screens/DSUserDashboardScreen';
import DSVenueProDashboardScreen from '../screens/DSVenueProDashboardScreen';
import LocalScreen from '../screens/LocalScreen';
import BadgeGalleryScreen from '../screens/BadgeGalleryScreen';
import HostHistoryScreen from '../screens/HostHistoryScreen';
import VenueCityPartnerScreen from '../screens/VenueCityPartnerScreen';
import SeriesDetailScreen from '../screens/SeriesDetailScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import FriendsDmScreen from '../screens/FriendsDmScreen';
import VenuePortalsScreen from '../screens/VenuePortalsScreen';
import VenueApplyScreen from '../screens/VenueApplyScreen';
import VenueVitrineEditScreen from '../screens/VenueVitrineEditScreen';
import VenueSlotsScreen from '../screens/VenueSlotsScreen';
import VenueArchiveScreen from '../screens/VenueArchiveScreen';
import VenueFloorPlanScreen from '../screens/VenueFloorPlanScreen';
import VenueManagerScreen from '../screens/VenueManagerScreen';
import VenueBusinessScreen from '../screens/VenueBusinessScreen';
import ProfileAccessStateScreen from '../screens/ProfileAccessStateScreen';
import LTE3EngineScreen from '../screens/LTE3EngineScreen';
import GlossaryScreen from '../screens/GlossaryScreen';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import VerifySuccessScreen from '../screens/VerifySuccessScreen';
import VerificationRequiredScreen from '../screens/VerificationRequiredScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import AuthWelcomeScreen from '../screens/AuthWelcomeScreen';
import UP02RitualContextScreen from '../screens/UP02RitualContextScreen';
import OnboardingInterestsScreen from '../screens/OnboardingInterestsScreen';
import SplashScreen from '../screens/SplashScreen';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import UPMemoriesAccessScreen from '../screens/UPMemoriesAccessScreen';
import OnboardingPivotHostsScreen from '../screens/OnboardingPivotHostsScreen';
import LiveStrangerProfileScreen from '../screens/LiveStrangerProfileScreen';
import ReportSubmittedScreen from '../screens/ReportSubmittedScreen';
import CitySelectionScreen from '../screens/CitySelectionScreen';
import UP04L2FriendScreen from '../screens/UP04L2FriendScreen';
import OnboardingNameScreen from '../screens/OnboardingNameScreen';
import OnboardingIdentityKycScreen from '../screens/OnboardingIdentityKycScreen';
import UniversityProfileScreen from '../screens/UniversityProfileScreen';
import OnboardingUniversityEmailScreen from '../screens/OnboardingUniversityEmailScreen';
import UP03L1AcquaintanceScreen from '../screens/UP03L1AcquaintanceScreen';
import useThemeStore from '../store/themeStore';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const PRIMARY_COLOR = '#f9a13d';
const DARK_BACKGROUND = '#0a0a0a';
const DARK_TAB_BG = 'rgba(24, 24, 27, 0.8)'; // zinc-900/80
const DARK_TAB_BORDER = '#27272a'; // zinc-800
const USE_MAPBOX_LOCAL = process.env.EXPO_PUBLIC_USE_MAPBOX_LOCAL === 'true';

function resolveLocalTabComponent() {
  if (!USE_MAPBOX_LOCAL) return LocalScreen;
  const hasMapboxNative = Boolean(
    NativeModules?.RNMBXModule ||
      NativeModules?.RNMBXMapView ||
      NativeModules?.RNMBXOfflineModule
  );
  if (!hasMapboxNative) {
    return LocalScreen;
  }
  try {
    // Lazy require prevents runtime crash when native module is unavailable (Expo Go / no rebuild).
    return require('../screens/MapboxLocalScreen').default;
  } catch (error) {
    console.warn('Mapbox local screen unavailable, falling back to LocalScreen:', error?.message || error);
    return LocalScreen;
  }
}

// Main Tab Navigator — §17: tek ürün ekranı
function MainTabs() {
  const LocalTabComponent = resolveLocalTabComponent();

  return (
    <Tab.Navigator
      // Custom bottom nav inside each tab (Pulse/Local/Create/Passport). Hide default TabBar.
      tabBar={() => null}
      screenOptions={({ route }) => ({
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Pulse" 
        component={PulseScreen}
        options={{
          tabBarLabel: 'Pulse',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: 'bold',
            color: PRIMARY_COLOR,
            marginTop: 4,
          },
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.activeTabIconContainer,
              focused && styles.activeTabIconGlow,
            ]}>
              <MaterialIcons 
                name="timeline" 
                size={18} 
                color={focused ? '#000' : 'rgba(161, 161, 170, 0.4)'} 
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Local"
        component={LocalTabComponent}
        options={{
          tabBarLabel: 'Local',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: 'bold',
            color: PRIMARY_COLOR,
            marginTop: 4,
          },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.activeTabIconContainer, focused && styles.activeTabIconGlow]}>
              <MaterialIcons
                name="public"
                size={18}
                color={focused ? '#000' : 'rgba(161, 161, 170, 0.4)'}
              />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="CreateRitual"
        component={CreateRitualScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons
              name="add-circle-outline"
              size={24}
              color={focused ? DARK_TAB_BORDER : 'rgba(161, 161, 170, 0.4)'}
            />
          ),
        }}
      />
      <Tab.Screen 
        name="SocialPassport" 
        component={SocialPassportScreen}
        options={{
          tabBarLabel: 'Social Passport',
          tabBarIcon: ({ focused }) => (
            <MaterialIcons 
              name="account-circle" 
              size={24} 
              color={focused ? DARK_TAB_BORDER : 'rgba(161, 161, 170, 0.4)'} 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function AppNavigator({ isAuthenticated }) {
  const initializeTheme = useThemeStore((s) => s.initializeTheme);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  return (
    <Stack.Navigator
        screenOptions={{
          ...TransitionPresets.SlideFromRightIOS,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          gestureEnabled: true,
        }}
      >
        {!isAuthenticated ? (
          // Auth Stack
          <>
            <Stack.Screen 
              name="Splash"
              component={SplashScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="AuthWelcome"
              component={AuthWelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Login" 
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Register" 
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingName"
              component={OnboardingNameScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingIdentityKyc"
              component={OnboardingIdentityKycScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UniversityProfile"
              component={UniversityProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingUniversityEmail"
              component={OnboardingUniversityEmailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CitySelection"
              component={CitySelectionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingInterests"
              component={OnboardingInterestsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingPivotHosts"
              component={OnboardingPivotHostsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="VerifyEmail" 
              component={VerifyEmailScreen}
              options={{ 
                title: 'Verify Email',
                headerBackTitle: 'Back'
              }}
            />
            <Stack.Screen
              name="VerifySuccess"
              component={VerifySuccessScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPasswordScreen}
              options={{ 
                title: 'Forgot Password',
                headerBackTitle: 'Back'
              }}
            />
            <Stack.Screen 
              name="ResetPassword" 
              component={ResetPasswordScreen}
              options={{ 
                title: 'Reset Password',
                headerBackTitle: 'Back'
              }}
            />
            <Stack.Screen
              name="RitualDetail"
              component={RitualDetailScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Main App Stack
          <>
            <Stack.Screen 
              name="Main" 
              component={MainTabs}
              options={{ headerShown: false }}
            />
        <Stack.Screen
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{ title: 'Verify Email' }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ title: 'Reset Password', headerBackTitle: 'Back' }}
        />
        <Stack.Screen 
          name="RitualDetail" 
          component={RitualDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="LiveRitual" 
          component={LiveRitualScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="RitualFeedback" 
          component={RitualFeedbackScreen}
          options={{ 
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ParticipantFeedback" 
          component={ParticipantFeedbackScreen}
          options={{ 
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="RitualComplete"
          component={RitualCompleteScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="VerificationRequired"
          component={VerificationRequiredScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="RSTransparency" 
          component={RSTransparencyScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DSUserDashboard"
          component={DSUserDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DSVenueProDashboard"
          component={DSVenueProDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="BadgeGallery" component={BadgeGalleryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="HostHistory" component={HostHistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VenueCityPartner" component={VenueCityPartnerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FriendsDm" component={FriendsDmScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VenuePortals" component={VenuePortalsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VenueApply" component={VenueApplyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VenueVitrineEdit" component={VenueVitrineEditScreen} options={{ title: 'Vitrin' }} />
        <Stack.Screen name="VenueSlots" component={VenueSlotsScreen} options={{ title: 'Slotlar' }} />
        <Stack.Screen name="VenueArchive" component={VenueArchiveScreen} options={{ title: 'Arsiv' }} />
        <Stack.Screen name="VenueFloorPlan" component={VenueFloorPlanScreen} options={{ title: 'Kat Plani' }} />
        <Stack.Screen name="VenueManager" component={VenueManagerScreen} options={{ title: 'Mekan Yonetimi' }} />
        <Stack.Screen name="VenueBusiness" component={VenueBusinessScreen} options={{ title: 'Isletme Notlari' }} />
        <Stack.Screen name="UP01" component={ProfileAccessStateScreen} options={{ headerShown: false }} />
        <Stack.Screen name="UP02" component={UP02RitualContextScreen} options={{ headerShown: false }} />
        <Stack.Screen name="UP03" component={UP03L1AcquaintanceScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="UP04"
          component={UP04L2FriendScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="UP05" component={UPMemoriesAccessScreen} initialParams={{ mode: 'UP05' }} options={{ headerShown: false }} />
        <Stack.Screen name="UP06" component={UPMemoriesAccessScreen} initialParams={{ mode: 'UP06' }} options={{ headerShown: false }} />
        <Stack.Screen name="UP07" component={UPMemoriesAccessScreen} initialParams={{ mode: 'UP07' }} options={{ headerShown: false }} />
        <Stack.Screen name="UP08" component={UPMemoriesAccessScreen} initialParams={{ mode: 'UP08' }} options={{ headerShown: false }} />
        <Stack.Screen name="LTE3Engine" component={LTE3EngineScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MemoryDetail" component={MemoryDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="LiveStrangerProfile" component={LiveStrangerProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ReportSubmitted" component={ReportSubmittedScreen} options={{ headerShown: false }} />
        <Stack.Screen 
          name="ParticipantProfile" 
          component={ParticipantProfileScreen}
          options={{ 
            title: 'Participant Profile',
            headerBackTitle: 'Back'
          }}
        />
        <Stack.Screen
          name="Conversation"
          component={ConversationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RitualForum"
          component={RitualForumScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RitualAttendees"
          component={RitualAttendeesScreen}
          options={{
            title: 'Attendees',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="WaitingRoom"
          component={WaitingRoomScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RitualCheckIn"
          component={RitualCheckInScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VenueMap"
          component={VenueMapScreen}
          options={{
            title: 'Map',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ 
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="EditProfile" 
          component={EditProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="UniversityProfile"
          component={UniversityProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OnboardingIdentityKyc"
          component={OnboardingIdentityKycScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="PrivacySettings" 
          component={PrivacySettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="NotificationPreferences" 
          component={NotificationPreferencesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NotificationCenter"
          component={NotificationCenterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="BlockedUsers" 
          component={BlockedUsersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="BlockedKeywords" 
          component={BlockedKeywordsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SavedItems"
          component={SavedItemsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MutedItems"
          component={MutedItemsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FollowRequests"
          component={FollowRequestsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Collaborators"
          component={CollaboratorsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="VenueDetail" 
          component={VenueDetailScreen}
          options={{ title: 'Venue', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="ZoneDetail"
          component={ZoneDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ChainProfile"
          component={ChainProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BrandProfile"
          component={BrandProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MyRegulars"
          component={MyRegularsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CityRhythm"
          component={CityRhythmScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="FriendsList" 
          component={FriendsListScreen}
          options={{ 
            headerShown: false
          }}
        />
        <Stack.Screen
          name="QRBump"
          component={QRBumpScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="FollowingList" 
          component={FollowingListScreen}
          options={{ 
            headerShown: false
          }}
        />
            <Stack.Screen 
              name="Moderation" 
              component={ModerationScreen}
              options={{ 
                title: 'Moderation',
                headerBackTitle: 'Back',
                headerStyle: {
                  backgroundColor: '#0a0a0a',
                },
                headerTintColor: '#f4f4f5',
              }}
            />
            <Stack.Screen 
              name="FullRitualsList" 
              component={FullRitualsListScreen}
              options={{ 
                headerShown: false
              }}
            />
            <Stack.Screen
              name="YourMemories"
              component={YourMemoriesScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  activeTabIconContainer: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 999,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabIconGlow: {
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
