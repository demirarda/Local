import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';

/**
 * Curation signal palette
 */
const palette = {
  'super-event': { bg: colors.gold, text: '#fff', icon: 'star' },
  'editors-pick': { bg: colors.goldSoft, text: colors.goldDeep, icon: 'check-circle' },
  'premium': { bg: '#fff', text: colors.goldDeep, icon: 'star', border: colors.gold },
  'partner': { bg: colors.navy, text: '#fff', icon: 'tag' },
  'special-guest': { bg: colors.purple, text: '#fff', icon: 'user' },
  'limited': { bg: colors.live, text: '#fff', icon: 'clock' },
  'trending': { bg: colors.orange || '#d97706', text: '#fff', icon: 'trending-up' },
};

/**
 * CurationBadge — her kartta "neden bu özel?" göstergesi.
 *
 * @param {string} signal - 'super-event' | 'editors-pick' | 'premium' | 'partner' | 'special-guest' | 'limited' | 'trending'
 * @param {boolean} onDark - koyu arka plan üzerinde
 * @param {boolean} mini - küçük varyant
 * @param {string} overrideLabel - özel label (örn. "SON 2 YER", "SON 4 SAAT")
 */
export default function CurationBadge({
  signal = 'editors-pick',
  onDark = false,
  mini = false,
  overrideLabel,
  style,
}) {
  const p = palette[signal] || palette['editors-pick'];
  const label = overrideLabel || defaultLabel(signal);

  // Renk sistemi — "on dark" için bazı signal'ler aynı kalır, bazıları beyaz olur
  const alwaysColored = ['super-event', 'limited', 'trending', 'partner', 'special-guest'];

  let bg, textColor;
  if (onDark) {
    if (alwaysColored.includes(signal)) {
      bg = p.bg;
      textColor = '#fff';
    } else if (signal === 'premium') {
      bg = '#fff';
      textColor = colors.goldDeep;
    } else {
      // editors-pick vs default
      bg = 'rgba(255,255,255,0.95)';
      textColor = colors.goldDeep;
    }
  } else {
    bg = p.bg;
    textColor = p.text;
  }

  const borderStyle =
    signal === 'premium' && !onDark
      ? { borderWidth: 1, borderColor: p.border }
      : null;

  return (
    <View
      style={[
        styles.base,
        mini && styles.mini,
        { backgroundColor: bg },
        borderStyle,
        style,
      ]}
    >
      <Icon
        name={p.icon}
        size={mini ? 7 : 9}
        color={textColor}
        strokeWidth={signal === 'super-event' ? 2 : 2.5}
      />
      <Text style={[styles.text, mini && styles.textMini, { color: textColor }]}>
        {label}
      </Text>
    </View>
  );
}

function defaultLabel(signal) {
  switch (signal) {
    case 'super-event': return 'SUPER EVENT';
    case 'editors-pick': return "EDITOR'S PICK";
    case 'premium': return 'PREMIUM';
    case 'partner': return 'PARTNER';
    case 'special-guest': return 'SPECIAL GUEST';
    case 'limited': return 'LIMITED';
    case 'trending': return 'TRENDING';
    default: return '';
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  mini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  text: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 11,
  },
  textMini: {
    fontSize: 8,
    letterSpacing: 0.3,
    lineHeight: 10,
  },
});
