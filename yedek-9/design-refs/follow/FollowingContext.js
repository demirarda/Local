import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';

/**
 * FollowingContext
 * Üst bant: "Takip ettiğin 28 kişi & yer" + aktif sayısı
 *
 * @param {number} totalCount
 * @param {number} activeCount - şu an canlı olanlar (venue live, host in ritual)
 */
export function FollowingContext({ totalCount = 0, activeCount = 0 }) {
  // Pulse ring animation
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.context}>
      <View style={styles.contextLeft}>
        <View style={styles.iconWrap}>
          <Animated.View
            style={[styles.iconRing, { opacity, transform: [{ scale }] }]}
          />
          <View style={styles.icon}>
            <Icon name="heart" size={13} color="#fff" strokeWidth={2.2} />
          </View>
        </View>
        <View>
          <Text style={styles.label}>Takip ettiğin</Text>
          <View style={styles.nameRow}>
            <Text style={styles.nameBig}>{totalCount}</Text>
            <Text style={styles.nameSmall}>kişi & yer</Text>
          </View>
        </View>
      </View>

      {activeCount > 0 && (
        <View style={styles.activePill}>
          <View style={styles.activePillDot} />
          <Text style={styles.activePillText}>{activeCount} AKTİF</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  context: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.purple,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text400,
    letterSpacing: 1.5,
    fontFamily: fonts.sansBold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  nameBig: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  nameSmall: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text500,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    paddingLeft: 8,
    backgroundColor: colors.purple,
    borderRadius: radii.pill,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  activePillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  activePillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#fff',
    fontFamily: fonts.sansBold,
    letterSpacing: 0.5,
  },
});
