import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * Dot type → renk map'i
 */
const typeColors = {
  live: { halo: colors.live, core: colors.live },
  memory: { halo: colors.gold, core: colors.gold },
  venue: { halo: '#4ade80', core: colors.green },
  friend: { halo: '#60a5fa', core: colors.blue },
  event: { halo: 'rgba(255,255,255,0.3)', core: '#fff' },
};

/**
 * Dot size per type (halo, core)
 */
const typeSizes = {
  live: { halo: 12, core: 5 },
  memory: { halo: 10, core: 4 },
  venue: { halo: 11, core: 4.5 },
  friend: { halo: 11, core: 4.5 },
  event: { halo: 10, core: 4 },
};

/**
 * RadarDot
 * Tek bir içerik noktası. Canlı ritüeller için pulse animasyonu içerir.
 *
 * @param {number} x, y  - SVG koordinatları
 * @param {string} type  - 'live' | 'memory' | 'venue' | 'friend' | 'event'
 * @param {string} id    - Onpress callback için identifier
 * @param {boolean} isActive - Highlight state (tap sonrası)
 * @param {function} onPress
 */
export default function RadarDot({ x, y, type = 'memory', id, isActive, onPress }) {
  const color = typeColors[type] || typeColors.memory;
  const size = typeSizes[type] || typeSizes.memory;

  // Live dot için scale pulse
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (type === 'live') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.35,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [type, scaleAnim]);

  // Active tap pop animasyonu
  const haloAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isActive) {
      haloAnim.setValue(0);
      Animated.timing(haloAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }
  }, [isActive, haloAnim]);

  const activeHaloR = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [size.halo, 22],
  });
  const activeHaloOpacity = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <G onPress={() => onPress?.(id)}>
      {/* Tap target (invisible, larger) */}
      <Circle
        cx={x}
        cy={y}
        r={18}
        fill="transparent"
      />

      {/* Active pop ring */}
      {isActive && (
        <AnimatedCircle
          cx={x}
          cy={y}
          r={activeHaloR}
          fill={color.halo}
          opacity={activeHaloOpacity}
        />
      )}

      {/* Halo */}
      <Circle
        cx={x}
        cy={y}
        r={size.halo}
        fill={color.halo}
        opacity={0.2}
      />

      {/* Core - scale animated for live */}
      {type === 'live' ? (
        <AnimatedCircle
          cx={x}
          cy={y}
          r={size.core}
          fill={color.core}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1.2}
          style={{
            transform: [{ scale: scaleAnim }],
          }}
        />
      ) : (
        <Circle
          cx={x}
          cy={y}
          r={size.core}
          fill={color.core}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1.2}
        />
      )}
    </G>
  );
}
