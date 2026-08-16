import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';
import { HEAT_LABELS, HEAT_PIP_COUNT } from '../../utils/friendshipHeat';

/**
 * Sıcaklık renkleri — ayrı bir palette (theme'e taşınabilir)
 */
const heatColors = {
  hot: colors.live,    // kırmızı
  warm: colors.gold,   // altın
  cool: colors.text500, // gri-koyu
  cold: colors.text400, // açık gri
};

/**
 * HeatIndicator
 * 4 pip noktası + opsiyonel label.
 * Arkadaşlık sıcaklığını gösterir.
 *
 * @param {string} heat - 'hot' | 'warm' | 'cool' | 'cold'
 * @param {boolean} showLabel - Yanında "CANLI" etiketi göster (default: false)
 * @param {boolean} onDark - Karanlık arka plan üzerinde mi? (badge wrapper için)
 * @param {object} style
 */
export default function HeatIndicator({ heat = 'cool', showLabel = false, onDark = false, style }) {
  const filledCount = HEAT_PIP_COUNT[heat] || 0;
  const color = heatColors[heat] || heatColors.cool;

  const Wrapper = onDark ? OnDarkWrapper : React.Fragment;
  const wrapperProps = onDark ? { style } : {};

  return (
    <Wrapper {...wrapperProps}>
      <View style={[styles.container, !onDark && style]}>
        <View style={styles.pipGroup}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.pip,
                { backgroundColor: i < filledCount ? color : colors.text300 },
              ]}
            />
          ))}
        </View>
        {showLabel && (
          <Text style={[styles.label, { color }]}>{HEAT_LABELS[heat]}</Text>
        )}
      </View>
    </Wrapper>
  );
}

function OnDarkWrapper({ children, style }) {
  return <View style={[styles.onDarkBadge, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  onDarkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 100,
  },
  pipGroup: {
    flexDirection: 'row',
    gap: 2,
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
