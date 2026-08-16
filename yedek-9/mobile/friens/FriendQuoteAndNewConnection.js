import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../theme';
import { formatDaysSince } from '../utils/friendshipHeat';
import HeatIndicator from './HeatIndicator';

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * FriendQuoteCard
 * Arkadaşının söylediği bir söz (Pulse'taki Quote kartının Friends version'ı).
 *
 * data: {
 *   id, text, authorName, authorAvatar,
 *   context,                      // "BOOK CLUB · 1h"
 *   heat,
 * }
 */
export function FriendQuoteCard({ data, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.quoteContainer}
    >
      {/* Big decorative quote mark */}
      <Text style={styles.quoteMark}>"</Text>

      <View style={styles.quoteTop}>
        <Image source={{ uri: data.authorAvatar }} style={styles.quoteAvatar} />
        <HeatIndicator heat={data.heat} />
      </View>

      <Text style={styles.quoteText}>{cleanText(data.text)}</Text>

      <View style={styles.quoteFooter}>
        <Text style={styles.quoteByline}>
          <Text style={styles.quoteBylineBold}>{cleanText(data.authorName)}</Text>
        </Text>
        {data.context && <Text style={styles.quoteContext}>{cleanText(data.context)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

/**
 * NewConnectionCard
 * Son 30 günde tanıştığın biri. Cream gradient, el yazısı ilk sohbet notu.
 *
 * data: {
 *   id, name, avatar,
 *   firstMetRitual: { name, date },
 *   firstConversationNote,        // "ilk sohbetiniz Calvino üzerineydi"
 * }
 *
 * @param {boolean} compact - Dual grid içinde mi? (avatar üstte, küçük)
 */
export function NewConnectionCard({ data, compact = false, onPress, onReinforce, onProfile }) {
  const daysAgo = formatDaysSince(data.firstMetRitual?.date);

  if (compact) {
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onPress?.(data)}
        style={[styles.newConnContainer, styles.newConnCompact]}
      >
        <LinearGradient
          colors={[colors.cream, colors.paper]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.newConnBubbleTop} />

        <View style={styles.newConnTop}>
          <View style={styles.newConnLabel}>
            <Icon name="star" size={10} color={colors.gold} style={{ marginRight: 3 }} />
            <Text style={styles.newConnLabelText}>YENİ</Text>
          </View>
          <Text style={styles.newConnDays}>{daysAgo}</Text>
        </View>

        <View style={styles.newConnCompactBody}>
          <View style={styles.newConnAvatar}>
            <Image source={{ uri: data.avatar }} style={styles.newConnAvatarImg} />
          </View>
          <Text style={styles.newConnNameCompact} numberOfLines={1}>
            {cleanText(data.name).split(' ')[0]}
          </Text>
          {data.firstMetRitual && (
            <Text style={styles.newConnFromCompact} numberOfLines={1}>
              <Text style={styles.newConnFromBold}>{cleanText(data.firstMetRitual.name)}</Text>
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.newConnCtaCompact}
          onPress={(e) => {
            e.stopPropagation?.();
            onReinforce?.(data);
          }}
        >
          <Text style={styles.newConnCtaCompactText}>Davet et</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Full-width version
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.newConnContainer}
    >
      <LinearGradient
        colors={[colors.cream, colors.paper]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.newConnBubbleTop} />

      <View style={styles.newConnTop}>
        <View style={styles.newConnLabel}>
          <Icon name="star" size={11} color={colors.gold} style={{ marginRight: 3 }} />
          <Text style={styles.newConnLabelText}>YENİ TANIŞIKLIK</Text>
        </View>
        <Text style={styles.newConnDays}>{daysAgo} önce</Text>
      </View>

      <View style={styles.newConnBody}>
        <View style={styles.newConnAvatar}>
          <Image source={{ uri: data.avatar }} style={styles.newConnAvatarImg} />
        </View>
        <View style={styles.newConnInfo}>
          <Text style={styles.newConnName}>{cleanText(data.name)}</Text>
          {data.firstMetRitual && (
            <Text style={styles.newConnFrom}>
              <Text style={styles.newConnFromBold}>{cleanText(data.firstMetRitual.name)}</Text>
              'da tanıştınız
            </Text>
          )}
        </View>
      </View>

      {data.firstConversationNote && (
        <View style={styles.newConnMemory}>
          <Text style={styles.newConnMemoryText}>
            {cleanText(data.firstConversationNote)}
          </Text>
        </View>
      )}

      <View style={styles.newConnCta}>
        <TouchableOpacity
          style={styles.newConnCtaPrimary}
          onPress={() => onReinforce?.(data)}
        >
          <Icon name="heart" size={11} color="#fff" strokeWidth={2} />
          <Text style={styles.newConnCtaPrimaryText}>Tanışıklığı pekiştir</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newConnCtaGhost}
          onPress={() => onProfile?.(data)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="user" size={11} color={colors.text700} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ===== Quote =====
  quoteContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  quoteMark: {
    position: 'absolute',
    top: -20,
    left: 8,
    fontFamily: fonts.serif,
    fontSize: 90,
    color: 'rgba(0,0,0,0.05)',
    lineHeight: 90,
  },
  quoteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    zIndex: 1,
  },
  quoteAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  quoteText: {
    fontFamily: fonts.serif,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.text900,
    lineHeight: 19,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  quoteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderWarm,
    borderStyle: 'dashed',
  },
  quoteByline: {
    fontSize: 10.5,
    color: colors.text700,
  },
  quoteBylineBold: {
    fontWeight: '700',
    fontFamily: fonts.sansBold,
    color: colors.text900,
  },
  quoteContext: {
    fontSize: 9.5,
    color: colors.text400,
    fontFamily: fonts.sansMedium,
    letterSpacing: 0.5,
  },

  // ===== NewConnection =====
  newConnContainer: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 180,
  },
  newConnCompact: {
    flex: 1,
    minHeight: 160,
  },
  newConnBubbleTop: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(184,137,31,0.06)',
  },
  newConnTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 1,
  },
  newConnLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newConnLabelText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.gold,
  },
  newConnDays: {
    fontSize: 10,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },
  newConnBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    zIndex: 1,
  },
  newConnCompactBody: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 'auto',
    zIndex: 1,
  },
  newConnAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  newConnAvatarImg: {
    width: '100%',
    height: '100%',
  },
  newConnInfo: {
    flex: 1,
    minWidth: 0,
  },
  newConnName: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  newConnNameCompact: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.2,
  },
  newConnFrom: {
    fontSize: 11,
    color: colors.text500,
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    lineHeight: 15,
  },
  newConnFromCompact: {
    fontSize: 10,
    color: colors.text500,
    fontStyle: 'italic',
    fontFamily: fonts.serif,
  },
  newConnFromBold: {
    fontStyle: 'normal',
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text700,
  },
  newConnMemory: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(184,137,31,0.15)',
    marginBottom: 'auto',
    zIndex: 1,
  },
  newConnMemoryText: {
    fontFamily: fonts.hand,
    fontSize: 16,
    color: colors.text700,
    lineHeight: 18,
  },
  newConnCta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    zIndex: 1,
  },
  newConnCtaPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
  },
  newConnCtaPrimaryText: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  newConnCtaGhost: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.pill,
  },
  newConnCtaCompact: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    zIndex: 1,
  },
  newConnCtaCompactText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
});
