import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii, rankingColors } from '../../theme';

/**
 * Ranking Badge
 * Kullanıcıya "neden bu kart?" anlatan mini etiket.
 *
 * @param {string} type - 'friend' | 'follow' | 'nearby' | 'trending' | 'similar' | 'new'
 * @param {string} label - Badge'de görünecek metin
 * @param {boolean} onDark - Karanlık arka plan üstünde mi? (hero/event kartları için)
 * @param {object} style - Ek style
 */
const iconByType = {
  friend: 'users',
  follow: 'heart',
  nearby: 'map-pin',
  trending: 'trending-up',
  similar: 'target',
  new: 'clock',
};

export default function RankingBadge({ type = 'new', label, onDark = false, style }) {
  const palette = rankingColors[type] || rankingColors.new;
  const iconName = iconByType[type] || 'clock';

  const containerStyle = onDark
    ? styles.onDarkContainer
    : { backgroundColor: palette.bg };
  const textStyle = onDark ? styles.onDarkText : { color: palette.text };

  return (
    <View style={[styles.base, containerStyle, style]}>
      <Icon
        name={iconName}
        size={10}
        color={onDark ? '#fff' : palette.text}
        style={styles.icon}
      />
      <Text style={[styles.text, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  onDarkContainer: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  onDarkText: {
    color: '#fff',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 10,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    lineHeight: 13,
  },
});
