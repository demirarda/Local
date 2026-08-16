/**
 * LOCAL Design System
 * Pulse & diğer ekranlar için ortak theme
 */

export const colors = {
  // Base
  screen: '#FFFFFF',
  body: '#FAFAFA',
  cream: '#FAF7F0',
  paper: '#FDFBF5',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F5F0',

  // Border
  border: '#EDEDED',
  borderSoft: '#F3F3F3',
  borderWarm: '#E8E0CF',

  // Text
  text900: '#0A0A0A',
  text700: '#2A2A2A',
  text500: '#6B6B6F',
  text400: '#9A9A9E',
  text300: '#C4C4C8',

  // Brand
  black: '#000000',
  navy: '#0F1D44',

  // Semantic
  live: '#E0303D',
  liveSoft: '#FDE4E6',
  gold: '#B8891F',
  goldSoft: '#F5ECD4',
  green: '#2F7A47',
  greenSoft: '#E1F0E6',
  blue: '#1E5BA8',
  blueSoft: '#E3ECF7',
  purple: '#6D3DD8',
  purpleSoft: '#EFE5FF',
  orange: '#C05621',
  orangeSoft: '#FFE8D9',

  // Spotify
  spotify: '#1DB954',
  spotifyDark: '#0A6B2F',

  // Audio (Voice/Story)
  audio: '#8B5CF6',
  audioDeep: '#4C1D95',
  audioLight: '#C4B5FD',
};

export const fonts = {
  serif: 'CormorantGaramond',           // varsayılan weight = 400
  serifMedium: 'CormorantGaramond-Medium',
  serifSemiBold: 'CormorantGaramond-SemiBold',
  sans: 'Inter',
  sansMedium: 'Inter-Medium',
  sansSemiBold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
  hand: 'Caveat',
  handBold: 'Caveat-Bold',
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 100,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
};

/**
 * Ranking badge renk map'i
 * Backend'den gelen ranking_reason field'ına göre seçilir
 */
export const rankingColors = {
  friend: { bg: colors.blueSoft, text: colors.blue },
  follow: { bg: colors.goldSoft, text: colors.gold },
  nearby: { bg: colors.greenSoft, text: colors.green },
  trending: { bg: colors.orangeSoft, text: colors.orange },
  similar: { bg: colors.purpleSoft, text: colors.purple },
  new: { bg: colors.cream, text: colors.text700 },
};

export default { colors, fonts, radii, spacing, shadows, rankingColors };
