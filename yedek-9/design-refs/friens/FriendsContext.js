import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../../theme';

/**
 * Sıcaklık renkleri - internal
 */
const heatColors = {
  hot: colors.live,
  warm: colors.gold,
  cool: colors.text500,
  cold: colors.text400,
};

/**
 * FriendsContext
 * Arkadaşlar ekranının üstünde duran özet bandı.
 *
 * @param {number} totalFriends - Toplam arkadaş sayısı
 * @param {number} activeCount - Şu an aktif olan arkadaş sayısı
 * @param {object} distribution - { hot, warm, cool, cold } sayıları
 * @param {string} city - "Milano"
 */
export default function FriendsContext({
  totalFriends = 0,
  activeCount = 0,
  distribution = { hot: 0, warm: 0, cool: 0, cold: 0 },
  city = 'Milano',
}) {
  const total = distribution.hot + distribution.warm + distribution.cool + distribution.cold;

  return (
    <View style={styles.container}>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryMain}>
          <Text style={styles.countBig}>{totalFriends}</Text>
          <Text style={styles.countLabel}>arkadaşın</Text>
        </View>

        {activeCount > 0 && (
          <View style={styles.activePill}>
            <View style={styles.activePillDot} />
            <Text style={styles.activePillText}>
              {activeCount} şu an aktif
            </Text>
          </View>
        )}
      </View>

      {/* Heat distribution bar */}
      {total > 0 && (
        <View style={styles.heatBar}>
          {distribution.hot > 0 && (
            <View style={[styles.heatSegment, { flex: distribution.hot, backgroundColor: heatColors.hot }]} />
          )}
          {distribution.warm > 0 && (
            <View style={[styles.heatSegment, { flex: distribution.warm, backgroundColor: heatColors.warm }]} />
          )}
          {distribution.cool > 0 && (
            <View style={[styles.heatSegment, { flex: distribution.cool, backgroundColor: heatColors.cool }]} />
          )}
          {distribution.cold > 0 && (
            <View style={[styles.heatSegment, { flex: distribution.cold, backgroundColor: heatColors.cold }]} />
          )}
        </View>
      )}

      {/* Heat legend */}
      <View style={styles.legend}>
        {distribution.hot > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: heatColors.hot }]} />
            <Text style={styles.legendText}>{distribution.hot} canlı</Text>
          </View>
        )}
        {distribution.warm > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: heatColors.warm }]} />
            <Text style={styles.legendText}>{distribution.warm} sıcak</Text>
          </View>
        )}
        {distribution.cool > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: heatColors.cool }]} />
            <Text style={styles.legendText}>{distribution.cool} tanıdık</Text>
          </View>
        )}
        {distribution.cold > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: heatColors.cold }]} />
            <Text style={styles.legendText}>{distribution.cold} soğuyan</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  countBig: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  countLabel: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.text500,
    fontStyle: 'italic',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    paddingLeft: 8,
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  activePillText: {
    fontSize: 10.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
  },
  heatBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.borderSoft,
    marginBottom: 8,
  },
  heatSegment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendText: {
    fontSize: 9,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
