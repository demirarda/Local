import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii, spacing, shadows } from '../../theme';

/**
 * HeroMemoryCard
 * Full-width, editorial büyük memory kartı.
 * Genelde feed'de tek başına (row-full) kullanılır.
 *
 * Backend data shape:
 * {
 *   id, image, caption, author, authorAvatar, meta, note,
 *   reactions: { hearts, fire },
 *   ranking: { type, label },    // type: 'follow' | 'nearby' | ...
 *   verified: boolean,
 * }
 */
export default function HeroMemoryCard({ data, onPress, onDismiss }) {
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.container}
    >
      {/* COVER */}
      <View style={styles.cover}>
        <Image source={{ uri: data.image }} style={styles.coverImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top row: ranking badge + dismiss */}
        <View style={styles.coverTop}>
          <RankingBadge type={data.ranking.type} label={data.ranking.label} onDark />
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => onDismiss?.(data)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="more-horizontal" size={13} color={colors.text700} />
          </TouchableOpacity>
        </View>

        <Text style={styles.coverCaption} numberOfLines={2}>
          {data.caption}
        </Text>
      </View>

      {/* BODY */}
      <View style={styles.body}>
        {/* Author */}
        <View style={styles.authorRow}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: data.authorAvatar }} style={styles.avatar} />
          </View>
          <View style={styles.authorInfo}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{data.author}</Text>
              {data.verified && (
                <Icon name="check-circle" size={12} color={colors.navy} style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.authorMeta} numberOfLines={1}>
              {data.meta}
            </Text>
          </View>
        </View>

        {/* Note */}
        {data.note ? <Text style={styles.note}>{data.note}</Text> : null}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.reactions}>
            <View style={styles.reaction}>
              <Icon name="heart" size={14} color={colors.text500} />
              <Text style={styles.reactionText}>{data.reactions?.hearts ?? 0}</Text>
            </View>
            {data.reactions?.fire > 0 && (
              <View style={styles.reaction}>
                <Text style={styles.fireEmoji}>🔥</Text>
                <Text style={[styles.reactionText, { color: colors.gold, fontFamily: fonts.sansSemiBold }]}>
                  {data.reactions.fire}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => onPress?.(data)}>
            <Text style={styles.ctaText}>Oku</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  coverCaption: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 25,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  body: {
    padding: spacing.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.screen,
    marginRight: 10,
    // Gold outer ring via extra View ideally, but quick approach:
    // simulate with backgroundColor & padding if needed
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  authorName: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  authorMeta: {
    fontSize: 11,
    color: colors.text400,
    fontFamily: fonts.sans,
  },
  note: {
    fontSize: 13,
    color: colors.text700,
    lineHeight: 19,
    fontFamily: fonts.sans,
    fontStyle: 'italic',
    padding: 10,
    paddingLeft: 12,
    backgroundColor: colors.cream,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderTopRightRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  reactions: {
    flexDirection: 'row',
    gap: 14,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionText: {
    fontSize: 12,
    color: colors.text500,
    fontFamily: fonts.sans,
  },
  fireEmoji: {
    fontSize: 12,
  },
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
});
