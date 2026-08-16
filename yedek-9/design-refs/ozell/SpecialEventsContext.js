import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';

/**
 * SpecialEventsContext
 * Üst bant: "Küratör seçimi · 28 özel etkinlik" + "412 ŞU AN BAKIYOR" live pill.
 *
 * @param {number} totalCount - toplam özel etkinlik sayısı
 * @param {number} totalViewers - şu an bakan toplam kullanıcı (5000 aktif için)
 */
export default function SpecialEventsContext({ totalCount = 0, totalViewers = 0 }) {
  // Pulse animation for live viewers dot
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const dotOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });

  return (
    <View style={styles.container}>
      {/* Dekoratif altın glow */}
      <View style={styles.decorativeGlow} pointerEvents="none" />

      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Icon name="star" size={14} color="#fff" />
        </View>
        <View>
          <Text style={styles.label}>Küratör seçimi</Text>
          <View style={styles.nameRow}>
            <Text style={styles.nameBig}>{totalCount}</Text>
            <Text style={styles.nameSmall}>özel etkinlik</Text>
          </View>
        </View>
      </View>

      {totalViewers > 0 && (
        <View style={styles.livePill}>
          <Animated.View style={[styles.liveDot, { opacity: dotOpacity }]} />
          <Text style={styles.liveText}>
            {formatViewerCount(totalViewers)} ŞU AN BAKIYOR
          </Text>
        </View>
      )}
    </View>
  );
}

function formatViewerCount(n) {
  if (n < 1000) return n.toString();
  return `${(n / 1000).toFixed(1)}K`;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.goldSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gold,
    opacity: 0.08,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.goldDeep,
    letterSpacing: 1.5,
    fontFamily: fonts.sansBold,
    textTransform: 'uppercase',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  nameBig: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.4,
    lineHeight: 20,
  },
  nameSmall: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text500,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    paddingLeft: 8,
    backgroundColor: colors.live,
    borderRadius: radii.pill,
    shadowColor: colors.live,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  liveText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#fff',
    fontFamily: fonts.sansBold,
    letterSpacing: 0.3,
  },
});
