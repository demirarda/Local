/**
 * Design tokens from pulse.html (LOCAL — Pulse Final)
 */
import { Platform } from 'react-native';

export const PULSE = {
  bodyGray: '#BEBEBE',
  screenLight: '#FFFFFF',
  screenDark: '#080808',
  navy: '#1B2E4A',
  navyLight: '#2A4470',
  np: '#E8EDF4',
  nm: '#F2F5F9',
  gold: '#C8A96A',
  red: '#DC2626',
  green: '#16A34A',
  amber: '#D97706',
  g200: '#E5E5E5',
  g300: '#D4D4D4',
  g400: '#A3A3A3',
  g500: '#737373',
  g600: '#525252',
  borderLight: '#E5E5E5',
  borderDark: '#1e1e1e',
  cardBodyDark: '#0f0f0f',
  cardSurfaceDark: '#111111',
  textDarkPrimary: '#e8e8e8',
  textDarkMuted: '#555555',
  bottomNavDark: '#0a0a0a',
  bottomNavBorderDark: '#1a1a1a',
  createPillDarkBg: '#1e1e1e',
  createPillDarkBorder: '#2a2a2a',
  createPillDarkText: '#888888',
  bellBorderLight: '#E5E5E5',
  bellBorderDark: '#2a2a2a',
  moreBgDark: '#111111',
};

/** Instrument Serif → Georgia / serif on native */
export const FONT_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});
