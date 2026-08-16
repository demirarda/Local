import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Svg, {
  Circle,
  Line,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { colors, fonts, radii } from '../../theme';
import { bearingDistanceToSvg } from '../../utils/geoUtils';
import RadarDot from './RadarDot';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// SVG viewBox coordinates
const SVG_W = 400;
const SVG_H = 280;
const CENTER_X = 200;
const CENTER_Y = 140;

// Ring radii in SVG px (fixed)
const RING_1 = 45; // inner
const RING_2 = 85; // mid
const RING_3 = 125; // outer = current selected radius

/**
 * NearbyRadar
 * Kullanıcı merkezli radar görseli. Item'ları bearing+distance'a göre yerleştirir.
 *
 * @param {object} userLocation   - { lat, lng } (null ise merkez-based demo coord'ları kullanır)
 * @param {array} items           - [{ id, type, lat, lng, distance, bearing, svgX, svgY }]
 *                                  Eğer lat/lng varsa otomatik hesaplar.
 *                                  svgX/svgY varsa direkt kullanır (demo için).
 * @param {number} radius         - Seçili yarıçap (metre). Radar en dış halka = bu mesafe.
 * @param {string} activeDotId    - Highlight edilmiş dot
 * @param {function} onDotPress   - (itemId) => void
 * @param {string} neighborhood   - "BRERA" gibi
 * @param {string} accuracy       - "GPS · 8m" gibi
 */
export default function NearbyRadar({
  userLocation,
  items = [],
  radius = 1000,
  activeDotId,
  onDotPress,
  neighborhood = 'BRERA',
}) {
  // === Animations ===
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const userPulse1 = useRef(new Animated.Value(0)).current;
  const userPulse2 = useRef(new Animated.Value(0)).current;

  // Sweep rotation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweepAnim]);

  // User pulse rings (staggered)
  useEffect(() => {
    const createLoop = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      );

    const l1 = createLoop(userPulse1, 0);
    const l2 = createLoop(userPulse2, 1250);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [userPulse1, userPulse2]);

  // Sweep rotation transform
  const sweepTransform = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`rotate(0 ${CENTER_X} ${CENTER_Y})`, `rotate(360 ${CENTER_X} ${CENTER_Y})`],
  });

  // User pulse interpolations
  const pulse1R = userPulse1.interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
  const pulse1Opacity = userPulse1.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const pulse2R = userPulse2.interpolate({ inputRange: [0, 1], outputRange: [6, 18] });
  const pulse2Opacity = userPulse2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  // === Item positioning ===
  const positionedItems = useMemo(() => {
    return items
      .map((item) => {
        // Eğer svgX/svgY verilmişse direkt kullan (demo)
        if (item.svgX != null && item.svgY != null) {
          return { ...item, x: item.svgX, y: item.svgY, inRange: true };
        }

        // Mesafe + bearing'den hesapla
        if (item.distance != null && item.bearing != null) {
          const { x, y, inRange } = bearingDistanceToSvg(
            item.bearing,
            item.distance,
            radius,
            RING_3,
            CENTER_X,
            CENTER_Y
          );
          return { ...item, x, y, inRange };
        }

        return null;
      })
      .filter((item) => item && item.inRange);
  }, [items, radius]);

  return (
    <View style={styles.panel}>
      {/* Top strip: label + live clock */}
      <View style={styles.topRow}>
        <View style={styles.topLabel}>
          <View style={styles.topLabelDot} />
          <Text style={styles.topLabelText}>CANLI TARAMA</Text>
        </View>
        <LiveClock />
      </View>

      {/* Radar SVG */}
      <View style={styles.radarView}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <LinearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="rgba(184,137,31,0)" />
              <Stop offset="100%" stopColor="rgba(184,137,31,0.3)" />
            </LinearGradient>
          </Defs>

          {/* Grid cross lines */}
          <Line
            x1={CENTER_X - RING_3 - 15}
            y1={CENTER_Y}
            x2={CENTER_X + RING_3 + 15}
            y2={CENTER_Y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
          <Line
            x1={CENTER_X}
            y1={CENTER_Y - RING_3 - 15}
            x2={CENTER_X}
            y2={CENTER_Y + RING_3 + 15}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />

          {/* Rings */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={RING_1}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={RING_2}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={RING_3}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />

          {/* Distance labels (top of each ring) */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - RING_1 + 4}
            fill="rgba(255,255,255,0.35)"
            fontSize="8.5"
            fontFamily={fonts.sansMedium}
            fontWeight="500"
            textAnchor="middle"
          >
            {formatRingLabel(radius * (RING_1 / RING_3))}
          </SvgText>
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - RING_2 + 4}
            fill="rgba(255,255,255,0.35)"
            fontSize="8.5"
            fontFamily={fonts.sansMedium}
            fontWeight="500"
            textAnchor="middle"
          >
            {formatRingLabel(radius * (RING_2 / RING_3))}
          </SvgText>
          <SvgText
            x={CENTER_X}
            y={CENTER_Y - RING_3 + 4}
            fill="rgba(255,255,255,0.35)"
            fontSize="8.5"
            fontFamily={fonts.sansMedium}
            fontWeight="500"
            textAnchor="middle"
          >
            {formatRingLabel(radius)}
          </SvgText>

          {/* Compass markers (K/G/D/B) */}
          <SvgText
            x={CENTER_X}
            y={10}
            fill="rgba(255,255,255,0.45)"
            fontSize="10"
            fontWeight="700"
            fontFamily={fonts.sansBold}
            textAnchor="middle"
          >
            K
          </SvgText>
          <SvgText
            x={CENTER_X}
            y={SVG_H - 2}
            fill="rgba(255,255,255,0.45)"
            fontSize="10"
            fontWeight="700"
            fontFamily={fonts.sansBold}
            textAnchor="middle"
          >
            G
          </SvgText>
          <SvgText
            x={20}
            y={CENTER_Y + 4}
            fill="rgba(255,255,255,0.45)"
            fontSize="10"
            fontWeight="700"
            fontFamily={fonts.sansBold}
            textAnchor="middle"
          >
            B
          </SvgText>
          <SvgText
            x={SVG_W - 20}
            y={CENTER_Y + 4}
            fill="rgba(255,255,255,0.45)"
            fontSize="10"
            fontWeight="700"
            fontFamily={fonts.sansBold}
            textAnchor="middle"
          >
            D
          </SvgText>

          {/* Rotating sweep wedge */}
          <AnimatedG transform={sweepTransform}>
            <Path
              d={`M ${CENTER_X} ${CENTER_Y} L ${CENTER_X + RING_3 + 15} ${CENTER_Y} A ${RING_3 + 15} ${RING_3 + 15} 0 0 0 ${CENTER_X + (RING_3 + 15) * Math.cos(-0.6)} ${CENTER_Y + (RING_3 + 15) * Math.sin(-0.6)} Z`}
              fill="url(#sweepGrad)"
              opacity={0.65}
            />
          </AnimatedG>

          {/* Content dots */}
          {positionedItems.map((item) => (
            <RadarDot
              key={item.id}
              id={item.id}
              x={item.x}
              y={item.y}
              type={item.type}
              isActive={activeDotId === item.id}
              onPress={onDotPress}
            />
          ))}

          {/* User pulse rings */}
          <AnimatedCircle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={pulse1R}
            fill={colors.gold}
            opacity={pulse1Opacity}
          />
          <AnimatedCircle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={pulse2R}
            fill={colors.gold}
            opacity={pulse2Opacity}
          />

          {/* User center core */}
          <Circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={5}
            fill={colors.gold}
            stroke="#fff"
            strokeWidth={1.5}
          />

          {/* "SEN" label */}
          <SvgText
            x={CENTER_X}
            y={CENTER_Y + 22}
            fill="rgba(184,137,31,0.9)"
            fontSize="8.5"
            fontWeight="700"
            fontFamily={fonts.sansBold}
            textAnchor="middle"
            letterSpacing="1"
          >
            SEN
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Legend counts={computeLegendCounts(positionedItems)} />
      </View>
    </View>
  );
}

// ===== Helpers =====

function formatRingLabel(meters) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}

function computeLegendCounts(items) {
  const counts = { live: 0, memory: 0, venue: 0, friend: 0, event: 0 };
  items.forEach((item) => {
    if (counts[item.type] != null) counts[item.type]++;
  });
  return counts;
}

// ===== Sub-components =====

function LiveClock() {
  const [time, setTime] = useState(() => formatNow());
  useEffect(() => {
    const t = setInterval(() => setTime(formatNow()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.topTime}>{time}</Text>;
}

function formatNow() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function Legend({ counts }) {
  const entries = [
    { key: 'live', label: 'canlı', color: colors.live, count: counts.live },
    { key: 'memory', label: 'anı', color: colors.gold, count: counts.memory },
    { key: 'venue', label: 'mekan', color: colors.green, count: counts.venue },
    { key: 'friend', label: 'arkadaş', color: colors.blue, count: counts.friend },
  ].filter((e) => e.count > 0);

  return (
    <>
      {entries.map((e) => (
        <View key={e.key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: e.color }]} />
          <Text style={styles.legendText}>
            {e.count} {e.label}
          </Text>
        </View>
      ))}
    </>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.navy,
    position: 'relative',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 14,
  },
  topLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  topLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  topLabelText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.gold,
  },
  topTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  radarView: {
    height: 280,
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },
});
