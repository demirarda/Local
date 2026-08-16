import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii } from '../../theme';

/**
 * PolaroidCard
 * Arkadaş anısı, el yazısı caption, polaroid paper görünümü.
 *
 * data: { id, image, caption, author, avatar, meta, ranking }
 */
export function PolaroidCard({ data, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.polaroidContainer}
    >
      <View style={styles.polaroidTop}>
        <RankingBadge type="friend" label={data.ranking.label} />
      </View>

      <Image source={{ uri: data.image }} style={styles.polaroidPhoto} />

      <Text style={styles.polaroidCaption} numberOfLines={2}>
        {data.caption}
      </Text>

      <View style={styles.polaroidBottom}>
        <View style={styles.polaroidAuthor}>
          <Image source={{ uri: data.avatar }} style={styles.polaroidAvatar} />
          <Text style={styles.polaroidAuthorName}>{data.author}</Text>
        </View>
        <Text style={styles.polaroidMeta}>{data.meta}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * LiveChipCard
 * Canlı ritüel chip'i. Sol kenarda kırmızı şerit + nabız noktası.
 *
 * data: { id, image, title, meta, seats, rankingText }
 */
export function LiveChipCard({ data, onPress, onJoin }) {
  // Live pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.liveContainer}
    >
      {/* Left red accent bar */}
      <View style={styles.liveAccent} />

      <Image source={{ uri: data.image }} style={styles.liveThumb} />

      <View style={styles.liveInfo}>
        <View style={styles.liveBadges}>
          <View style={styles.livePulse}>
            <Animated.View
              style={[
                styles.livePulseDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.livePulseText}>CANLI</Text>
          </View>
          <RankingBadge type="friend" label={data.rankingText} />
        </View>

        <Text style={styles.liveTitle} numberOfLines={1}>
          {data.title}
        </Text>
        <Text style={styles.liveMeta} numberOfLines={1}>
          {data.meta} · <Text style={styles.liveSeats}>{data.seats}</Text>
        </Text>
      </View>

      <TouchableOpacity style={styles.liveCtaBtn} onPress={() => onJoin?.(data)}>
        <Text style={styles.liveCtaText}>Katıl</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // === Polaroid ===
  polaroidContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  polaroidTop: {
    marginBottom: 8,
  },
  polaroidPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.surfaceMuted,
  },
  polaroidCaption: {
    fontFamily: fonts.hand,
    fontSize: 17,
    color: colors.text900,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 6,
  },
  polaroidBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.borderWarm,
    borderStyle: 'dashed',
    gap: 6,
  },
  polaroidAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  polaroidAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  polaroidAuthorName: {
    fontSize: 10,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.text700,
  },
  polaroidMeta: {
    fontSize: 9.5,
    color: colors.text400,
    fontFamily: fonts.sans,
  },

  // === Live ===
  liveContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingLeft: 17, // space for accent bar
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  liveAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.live,
  },
  liveThumb: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  liveInfo: {
    flex: 1,
  },
  liveBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.liveSoft,
    borderRadius: radii.pill,
    gap: 3,
  },
  livePulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.live,
  },
  livePulseText: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#B91B28',
    letterSpacing: 0.5,
  },
  liveTitle: {
    fontSize: 14,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
    marginBottom: 1,
  },
  liveMeta: {
    fontSize: 11,
    color: colors.text500,
    fontFamily: fonts.sans,
  },
  liveSeats: {
    color: colors.live,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
  liveCtaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
  },
  liveCtaText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
});
