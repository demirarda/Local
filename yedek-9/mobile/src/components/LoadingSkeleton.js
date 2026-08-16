/**
 * Skeleton loader component for better loading UX
 * Shows placeholder content while data is loading
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const PRIMARY_COLOR = '#D4AF37';
const LIGHT_CARD = '#FFFFFF';
const LIGHT_BACKGROUND = '#FAF9F6';
const SKELETON_COLOR = '#E5E7EB';
const SHIMMER_COLOR = '#F3F4F6';

export function SkeletonBox({ width, height, borderRadius = 8, style }) {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: SKELETON_COLOR,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonText({ width = '80%', height = 16, style }) {
  return <SkeletonBox width={width} height={height} borderRadius={4} style={style} />;
}

export function SkeletonCard({ style }) {
  return (
    <View style={[styles.skeletonCard, style]}>
      <SkeletonBox width="60%" height={20} borderRadius={4} style={styles.skeletonTitle} />
      <SkeletonBox width="40%" height={14} borderRadius={4} style={styles.skeletonSubtitle} />
      <View style={styles.skeletonContent}>
        <SkeletonBox width="100%" height={12} borderRadius={4} style={styles.skeletonLine} />
        <SkeletonBox width="90%" height={12} borderRadius={4} style={styles.skeletonLine} />
        <SkeletonBox width="70%" height={12} borderRadius={4} />
      </View>
    </View>
  );
}

export function SkeletonRitualCard({ style }) {
  return (
    <View style={[styles.skeletonRitualCard, style]}>
      <SkeletonBox width="100%" height={120} borderRadius={12} style={styles.skeletonImage} />
      <View style={styles.skeletonRitualContent}>
        <SkeletonBox width="70%" height={18} borderRadius={4} style={styles.skeletonTitle} />
        <SkeletonBox width="50%" height={14} borderRadius={4} style={styles.skeletonSubtitle} />
        <View style={styles.skeletonTags}>
          <SkeletonBox width={60} height={20} borderRadius={10} />
          <SkeletonBox width={60} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3, renderItem }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.skeletonListItem}>
          {renderItem ? renderItem(index) : <SkeletonCard />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonRitualCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonImage: {
    marginBottom: 12,
  },
  skeletonRitualContent: {
    padding: 12,
  },
  skeletonTitle: {
    marginBottom: 8,
  },
  skeletonSubtitle: {
    marginBottom: 12,
  },
  skeletonContent: {
    marginTop: 8,
  },
  skeletonLine: {
    marginBottom: 6,
  },
  skeletonTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  skeletonListItem: {
    marginBottom: 12,
  },
});
