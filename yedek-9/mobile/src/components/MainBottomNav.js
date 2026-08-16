import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useThemeStore from '../store/themeStore';

/** son-part.md §8.4 — Pulse · Local World · Social Passport · Create Ritual */
const TABS = [
  { key: 'Pulse', label: 'Pulse', isPulse: true },
  { key: 'Local', label: 'Local World', icon: 'public', shortLabel: 'Local World' },
  { key: 'CreateRitual', label: 'Create', icon: 'add-circle-outline', shortLabel: 'Create' },
  { key: 'SocialPassport', label: 'Social Passport', icon: 'account-circle', shortLabel: 'Passport' },
];

export default function MainBottomNav({ navigation, activeTab, forceDark }) {
  const insets = useSafeAreaInsets();
  const mode = useThemeStore((s) => s.mode);
  const isDark = forceDark || mode === 'dark';

  const goTo = (tabKey) => {
    if (tabKey === activeTab) return;
    // Stack ekranından tab'a dön (Create / City Rhythm vb.)
    const parent = navigation.getParent?.();
    const state = navigation.getState?.();
    const routeNames = state?.routeNames || [];
    if (routeNames.includes(tabKey)) {
      navigation.navigate(tabKey);
      return;
    }
    if (parent) {
      parent.navigate('Main', { screen: tabKey });
      return;
    }
    navigation.navigate('Main', { screen: tabKey });
  };

  return (
    <>
      <View
        style={[
          styles.bottomNav,
          isDark && styles.bottomNavDark,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          if (tab.isPulse) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={active ? styles.btnActive : styles.btn}
                onPress={() => goTo(tab.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.pulseCircle, active && styles.pulseCircleActive]}>
                  <Text style={styles.pulseLogo}>L.</Text>
                </View>
                <Text style={[styles.label, active && styles.labelActive, isDark && styles.labelDark]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={tab.key}
              style={active ? styles.btnActive : styles.btn}
              onPress={() => goTo(tab.key)}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={tab.icon}
                size={24}
                color={active ? (isDark ? '#fff' : '#000') : isDark ? '#9CA3AF' : '#a3a3a3'}
              />
              <Text style={[styles.label, active && styles.labelActive, isDark && styles.labelDark]}>
                {tab.shortLabel || tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={[styles.pill, { bottom: Math.max(insets.bottom, 8) }]} />
    </>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 20,
  },
  bottomNavDark: {
    backgroundColor: '#0a0a0a',
    borderTopColor: '#1a1a1a',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  btnActive: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 4,
  },
  pulseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircleActive: {
    backgroundColor: '#000',
  },
  pulseLogo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D4AF37',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  labelActive: {
    fontWeight: '700',
    color: '#000',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 21,
  },
});
