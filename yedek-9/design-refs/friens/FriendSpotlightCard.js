import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import { formatDaysSince } from '../../utils/friendshipHeat';
import HeatIndicator from './HeatIndicator';

/**
 * FriendSpotlightCard
 * En yakın arkadaşlar için büyük editoryal kart.
 *
 * data: {
 *   id, name, avatar,
 *   firstMetRitual: { name, date },     // "Jazz Night'ta · 8 ay"
 *   heat,                                // 'hot' | 'warm' | ...
 *   isActive,                            // şu an ritüelde mi
 *   activeRitual,                        // { name, venue, handwrittenQuote }
 *   coverImage,                          // büyük üst fotoğraf
 *   handwrittenQuote,                    // "geçen akşam dopdoluydu..."
 *   stats: {
 *     sharedRituals,                     // 23
 *     lastMeetingDate,                   // Date
 *     sharedMemories,                    // 47
 *   },
 *   ctaLabel,                            // "Terrazza Aperol'e katıl" veya null
 * }
 */
export default function FriendSpotlightCard({ data, onPress, onMessage, onJoin }) {
  const { stats = {} } = data;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.container}
    >
      {/* COVER */}
      <View style={styles.cover}>
        <Image source={{ uri: data.coverImage }} style={styles.coverImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.55)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.coverTop}>
          {data.isActive && (
            <View style={styles.activeBadge}>
              <View style={styles.activeBadgeDot} />
              <Text style={styles.activeBadgeText}>ŞU AN AKTİF</Text>
            </View>
          )}
          {!data.isActive && <View />}

          <HeatIndicator heat={data.heat} showLabel onDark />
        </View>

        {data.handwrittenQuote && (
          <Text style={styles.handwritten} numberOfLines={2}>
            {data.handwrittenQuote}
          </Text>
        )}
      </View>

      {/* BODY */}
      <View style={styles.body}>
        <View style={styles.identityRow}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: data.avatar }} style={styles.avatar} />
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.name}>{data.name}</Text>
            {data.firstMetRitual && (
              <Text style={styles.meta} numberOfLines={1}>
                {data.firstMetRitual.name}'ta tanıştınız · {formatDaysSince(data.firstMetRitual.date)}
              </Text>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat number={stats.sharedRituals || 0} label="Ortak Ritüel" />
          <View style={styles.statDivider} />
          <Stat number={formatDaysSince(stats.lastMeetingDate)} label="Son Buluşma" />
          <View style={styles.statDivider} />
          <Stat number={stats.sharedMemories || 0} label="Ortak Anı" />
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => onJoin?.(data)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaPrimaryText} numberOfLines={1}>
              {data.ctaLabel || 'Profili Gör'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => onMessage?.(data)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="message-circle" size={13} color={colors.text700} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ number, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cover: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceMuted,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    paddingLeft: 7,
    backgroundColor: colors.green,
    borderRadius: radii.pill,
  },
  activeBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  activeBadgeText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  handwritten: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    fontFamily: fonts.hand,
    fontSize: 26,
    color: '#fff',
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
    zIndex: 2,
  },
  body: {
    padding: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#fff',
    padding: 1,
    // gold ring via wrapper
    backgroundColor: colors.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  identityInfo: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.3,
    lineHeight: 21,
    marginBottom: 1,
  },
  meta: {
    fontSize: 11,
    color: colors.text500,
    fontFamily: fonts.sans,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statNumber: {
    fontSize: 16,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.3,
    lineHeight: 16,
  },
  statLabel: {
    fontSize: 9,
    color: colors.text400,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderSoft,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  ctaPrimary: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#fff',
    fontSize: 11.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  ctaSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
