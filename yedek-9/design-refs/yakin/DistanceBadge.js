import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import { formatDistance, formatWalkTime } from '../../utils/geoUtils';

/**
 * DistanceBadge
 * Yakınımda modunda her kartta kullanılan mesafe + yürüme süresi etiketi.
 *
 * @param {number} distance   - Metre cinsinden mesafe
 * @param {boolean} onDark    - Karanlık arka plan üstünde mi? (default: false)
 * @param {boolean} showWalk  - Yürüme süresi gösterilsin mi? (default: true)
 * @param {boolean} compact   - Sadece mesafe, yürüme süresi yok
 * @param {object} style      - Ek style
 */
export default function DistanceBadge({
  distance,
  onDark = false,
  showWalk = true,
  compact = false,
  style,
}) {
  if (distance == null) return null;

  const distStr = formatDistance(distance);
  const walkStr = formatWalkTime(distance);

  return (
    <View style={[styles.badge, onDark ? styles.onDark : styles.onLight, style]}>
      <Icon name="map-pin" size={9} color={onDark ? '#fff' : colors.navy} />
      <Text style={[styles.distance, onDark && styles.distanceDark]}>{distStr}</Text>
      {showWalk && !compact && (
        <>
          <Text style={[styles.separator, onDark && styles.separatorDark]}>·</Text>
          <Text style={[styles.walk, onDark && styles.walkDark]}>{walkStr}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3,
    paddingLeft: 7,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    gap: 4,
  },
  onLight: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  onDark: {
    backgroundColor: colors.navy,
    borderWidth: 0,
  },
  distance: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.navy,
    letterSpacing: -0.1,
  },
  distanceDark: {
    color: '#fff',
  },
  separator: {
    fontSize: 10,
    color: colors.text500,
    marginHorizontal: 1,
  },
  separatorDark: {
    color: 'rgba(255,255,255,0.5)',
  },
  walk: {
    fontSize: 10,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    color: colors.text500,
  },
  walkDark: {
    color: 'rgba(255,255,255,0.65)',
  },
});
