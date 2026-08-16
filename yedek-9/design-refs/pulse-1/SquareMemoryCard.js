import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii, shadows } from '../../theme';

/**
 * SquareMemoryCard
 * Kare (aspect 1:1.2) memory kartı.
 * Dual veya triple grid içinde kullanılır.
 *
 * @param {object} data - { id, image, title, meta, author, authorAvatar, reactions, ranking }
 * @param {boolean} triple - Üçlü grid'de mi? (true ise footer gizli, daha dar)
 */
export default function SquareMemoryCard({ data, triple = false, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={[styles.container, triple && styles.containerTriple]}
    >
      {/* Cover */}
      <View style={styles.cover}>
        <Image source={{ uri: data.image }} style={styles.coverImage} />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Ranking badge top-left */}
        <View style={styles.topBadge}>
          <RankingBadge type={data.ranking.type} label={data.ranking.label} onDark />
        </View>

        {/* Caption bottom */}
        <View style={styles.captionOverlay}>
          <Text style={[styles.captionTitle, triple && styles.captionTitleTriple]} numberOfLines={2}>
            {data.title}
          </Text>
          <Text style={styles.captionMeta} numberOfLines={1}>
            {data.meta}
          </Text>
        </View>
      </View>

      {/* Footer - only if not triple */}
      {!triple && (
        <View style={styles.footer}>
          <Image source={{ uri: data.authorAvatar }} style={styles.footerAvatar} />
          <Text style={styles.footerName} numberOfLines={1}>
            {data.author}
          </Text>
          <View style={styles.footerReaction}>
            {data.reactions?.startsWith?.('🔥') ? (
              <Text style={styles.reactionText}>{data.reactions}</Text>
            ) : (
              <>
                <Icon name="heart" size={11} color={colors.text500} />
                <Text style={styles.reactionText}>{data.reactions}</Text>
              </>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    aspectRatio: 1 / 1.2,
    ...shadows.sm,
  },
  containerTriple: {
    aspectRatio: 1 / 1.3,
  },
  cover: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    zIndex: 2,
  },
  captionTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 19,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  captionTitleTriple: {
    fontSize: 13,
    lineHeight: 15,
  },
  captionMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.sans,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  footerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  footerName: {
    flex: 1,
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.text700,
  },
  footerReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reactionText: {
    fontSize: 10,
    color: colors.text500,
    fontFamily: fonts.sans,
  },
});
