import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii } from '../../theme';

/**
 * QuoteCard
 * Full-width tırnak işareti dekoratif quote kartı.
 *
 * data: { id, text, author, authorAvatar, sub, reactions, ranking }
 */
export function QuoteCard({ data, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.quoteContainer}
    >
      {/* Decorative big quote mark */}
      <Text style={styles.quoteMark}>"</Text>

      <View style={styles.quoteTopRow}>
        <RankingBadge type={data.ranking.type} label={data.ranking.label} />
      </View>

      <Text style={styles.quoteText}>{data.text}</Text>

      <View style={styles.quoteAttribution}>
        <View style={styles.quoteAuthor}>
          <Image source={{ uri: data.authorAvatar }} style={styles.quoteAvatar} />
          <View>
            <Text style={styles.quoteAuthorName}>{data.author}</Text>
            <Text style={styles.quoteAuthorSub}>{data.sub}</Text>
          </View>
        </View>

        <View style={styles.quoteReaction}>
          <Icon name="heart" size={11} color={colors.text500} />
          <Text style={styles.quoteReactionText}>{data.reactions}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * MiniQuoteCard
 * Dar, dikey mini alıntı kartı.
 * Dual veya asym grid'lerde kullanılır.
 *
 * data: { id, text, author, avatar, ranking }
 */
export function MiniQuoteCard({ data, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.miniContainer}
    >
      <View style={styles.miniBadge}>
        <RankingBadge type={data.ranking.type} label={data.ranking.label} />
      </View>

      <Text style={styles.miniText}>{data.text}</Text>

      <View style={styles.miniFooter}>
        <Image source={{ uri: data.avatar }} style={styles.miniAvatar} />
        <Text style={styles.miniName}>{data.author}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // === QuoteCard ===
  quoteContainer: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  quoteMark: {
    position: 'absolute',
    top: -24,
    left: 12,
    fontFamily: fonts.serifMedium,
    fontSize: 100,
    color: 'rgba(0,0,0,0.06)',
    lineHeight: 100,
  },
  quoteTopRow: {
    marginBottom: 10,
  },
  quoteText: {
    fontFamily: fonts.serif,
    fontSize: 19,
    color: colors.text900,
    lineHeight: 25,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  quoteAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderWarm,
  },
  quoteAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  quoteAuthorName: {
    fontSize: 11.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
  },
  quoteAuthorSub: {
    fontSize: 10,
    color: colors.text400,
    fontFamily: fonts.sans,
  },
  quoteReaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.pill,
  },
  quoteReactionText: {
    fontSize: 11,
    color: colors.text500,
    fontFamily: fonts.sans,
  },

  // === MiniQuoteCard ===
  miniContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    padding: 12,
    minHeight: 160,
  },
  miniBadge: {
    marginBottom: 8,
  },
  miniText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.text900,
    lineHeight: 20,
    letterSpacing: -0.2,
    flex: 1,
    paddingBottom: 8,
  },
  miniFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderWarm,
    borderStyle: 'dashed',
  },
  miniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
  },
  miniName: {
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.text700,
  },
});
