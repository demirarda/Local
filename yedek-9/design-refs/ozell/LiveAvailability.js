import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, fonts, radii } from '../../theme';

/**
 * LiveAvailabilityBar
 * Doluluk barı + üst satırda doluluk metni + viewer count.
 *
 * @param {object} availText - { main, sub }
 * @param {number} percent - 0-100
 * @param {string} state - 'open' | 'almost-full' | 'full' | 'waitlist-only'
 * @param {object} viewerStatus - { text, active, hot } veya null
 */
export function LiveAvailabilityBar({ availText, percent = 0, state = 'open', viewerStatus }) {
  if (!availText?.main) return null;

  let barColors;
  if (state === 'waitlist-only') {
    barColors = { bg: colors.live, from: colors.live, to: colors.live };
  } else if (state === 'almost-full' || state === 'full') {
    barColors = { bg: colors.orange, from: colors.orange, to: colors.live };
  } else {
    barColors = { bg: colors.gold, from: colors.gold, to: colors.gold };
  }

  return (
    <View style={styles.availWrap}>
      <View style={styles.availTopRow}>
        <Text style={styles.availText}>
          <Text style={styles.availMain}>{availText.main}</Text>
          {availText.sub ? ` · ${availText.sub}` : ''}
        </Text>

        {viewerStatus && (
          <Text style={[
            styles.availViewers,
            viewerStatus.active && styles.availViewersActive,
            viewerStatus.hot && styles.availViewersHot,
          ]}>
            {viewerStatus.text}
          </Text>
        )}
      </View>

      <View style={styles.availBar}>
        <View
          style={[
            styles.availFill,
            { width: `${percent}%`, backgroundColor: barColors.bg },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * LiveViewerPill — küçük "147 İZLİYOR" rozeti (dark surface üstünde)
 */
export function LiveViewerPill({ count = 0, small = false }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  if (!count || count < 1) return null;

  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });

  return (
    <View style={[styles.viewerPill, small && styles.viewerPillSmall]}>
      <Animated.View style={[styles.viewerDot, small && styles.viewerDotSmall, { opacity }]} />
      <Text style={[styles.viewerText, small && styles.viewerTextSmall]}>
        {count} İZLİYOR
      </Text>
    </View>
  );
}

/**
 * PricePill — fiyat / erişim rozeti
 *
 * @param {string} kind - 'paid' | 'free' | 'invite-only' | 'rs-gated'
 * @param {string} label - override label ("35€", "ÜCRETSİZ", "DAVETİYELİ")
 * @param {boolean} mini
 */
export function PricePill({ kind = 'paid', label, mini = false, style }) {
  const stylesByKind = {
    paid: { bg: colors.gold, color: '#fff', border: null, fontFamily: fonts.sansBold },
    free: { bg: 'transparent', color: colors.green, border: colors.green, fontFamily: fonts.sansBold },
    'invite-only': {
      bg: 'transparent',
      color: colors.goldDeep,
      border: colors.gold,
      fontFamily: fonts.sansBold,
    },
    'rs-gated': { bg: colors.purple, color: '#fff', border: null, fontFamily: fonts.sansBold },
  };

  const s = stylesByKind[kind] || stylesByKind.paid;
  const defaultLabel =
    kind === 'free' ? 'ÜCRETSİZ' :
    kind === 'invite-only' ? 'DAVETİYELİ' :
    kind === 'rs-gated' ? 'RS 3.5+' :
    '';

  return (
    <View
      style={[
        styles.pricePill,
        mini && styles.pricePillMini,
        {
          backgroundColor: s.bg,
          borderWidth: s.border ? 1.5 : 0,
          borderColor: s.border || 'transparent',
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.priceText,
          mini && styles.priceTextMini,
          { color: s.color, fontFamily: s.fontFamily },
        ]}
      >
        {label || defaultLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Availability Bar
  availWrap: { marginBottom: 10 },
  availTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  availText: {
    fontSize: 10,
    color: colors.text700,
    flex: 1,
    minWidth: 0,
  },
  availMain: {
    color: colors.text900,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
  availViewers: {
    fontSize: 9.5,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  availViewersActive: {
    color: colors.orange,
    fontWeight: '700',
    fontFamily: fonts.sansBold,
  },
  availViewersHot: {
    color: colors.live,
    fontWeight: '700',
    fontFamily: fonts.sansBold,
  },
  availBar: {
    height: 3,
    backgroundColor: colors.borderSoft,
    borderRadius: 2,
    overflow: 'hidden',
  },
  availFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Viewer Pill
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radii.pill,
  },
  viewerPillSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  viewerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.live,
  },
  viewerDotSmall: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  viewerText: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.live,
    letterSpacing: 0.3,
  },
  viewerTextSmall: {
    fontSize: 8,
  },

  // Price Pill
  pricePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  pricePillMini: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  priceTextMini: {
    fontSize: 9,
  },
});
