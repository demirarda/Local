import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const SIZE = 62;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}

/**
 * §15 — doluluk = RQ yüzdesi (sürekli). RQ yoksa backend pulse.value / occupancy.
 * Keep in sync with backend/src/services/pulseService.js resolvePulseRingFill.
 */
export function resolvePulseRingFill({ rqAverage = null, ratio = 0 } = {}) {
  if (rqAverage != null && rqAverage !== '' && Number.isFinite(Number(rqAverage))) {
    return clamp01(rqAverage);
  }
  return clamp01(ratio);
}

/**
 * Nabız halkası — v3 §15 görsel dil
 * Yanında "%85 · 4 kişi" · kelime yok · 3 bant ~0.40 / 0.70
 */
export default function PulseRing({
  mode: _mode = 'PRELOBBY',
  ratio = 0,
  count = 0,
  checkinRatio: _checkinRatio = null,
  memoryTempo: _memoryTempo = null,
  rqAverage = null,
  liveMix: _liveMix = null,
  lowThreshold = 0.4,
  midThreshold = 0.7,
  onPress,
}) {
  const value = resolvePulseRingFill({ rqAverage, ratio });
  const color = value < lowThreshold ? '#b45309' : value < midThreshold ? '#c8a96a' : '#16803c';
  const percent = Math.round(value * 100);

  const inner = (
    <View style={styles.row}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#e8e4dc" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={CIRCUMFERENCE * (1 - value)}
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
      </View>
      <Text style={styles.label}>{`%${percent} · ${count} kişi`}</Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ringWrap: { width: SIZE, height: SIZE },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#243342',
    maxWidth: 88,
  },
});
