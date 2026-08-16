import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import { formatDaysSince } from '../../utils/friendshipHeat';
import HeatIndicator from './HeatIndicator';

/**
 * FriendNowCard
 * Arkadaş şu an ritüelde — yeşil accent, pulse dot.
 *
 * data: {
 *   id, name, avatar,
 *   activeRitual: { name, venue },    // "Morning Yoga · Parco Sempione"
 * }
 */
export function FriendNowCard({ data, onPress, onJoin }) {
  // Pulse animation for "active" dot
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.4],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.nowContainer}
    >
      {/* Left green accent bar */}
      <View style={styles.nowAccent} />

      {/* Avatar with live dot */}
      <View style={styles.nowAvatar}>
        <View style={styles.nowAvatarImg}>
          <Image source={{ uri: data.avatar }} style={{ width: '100%', height: '100%' }} />
        </View>
        <View style={styles.nowDot}>
          <Animated.View
            style={[
              styles.nowDotRing,
              { transform: [{ scale: pulseScale }], opacity: pulseOpacity },
            ]}
          />
        </View>
      </View>

      {/* Info */}
      <View style={styles.nowInfo}>
        <View style={styles.nowNameRow}>
          <Text style={styles.nowName}>{data.name}</Text>
          <View style={styles.nowStatusBadge}>
            <Text style={styles.nowStatusText}>AKTİF</Text>
          </View>
        </View>
        <Text style={styles.nowActivity} numberOfLines={1}>
          <Text style={styles.nowActivityBold}>{data.activeRitual?.name}</Text>
          {data.activeRitual?.venue ? ` · ${data.activeRitual.venue}` : ''}
        </Text>
      </View>

      <TouchableOpacity style={styles.nowJoinBtn} onPress={() => onJoin?.(data)}>
        <Text style={styles.nowJoinText}>Gör</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/**
 * RekindleCard
 * Soğumakta olan yakın arkadaşlık uyarısı.
 *
 * data: {
 *   id, name, avatar,
 *   heat,                           // 'cool' | 'cold'
 *   lastRitualDate,
 *   firstMetRitual: { name },      // "Book Discussion"
 * }
 */
export function RekindleCard({ data, onMessage }) {
  const daysLabel = formatDaysSince(data.lastRitualDate);

  return (
    <View style={styles.rekindleContainer}>
      {/* Left gradient accent (emulated with solid) */}
      <View style={styles.rekindleAccent} />

      {/* Avatar with days badge */}
      <View style={styles.rekindleAvatarStack}>
        <View style={styles.rekindleAvatarMain}>
          <Image
            source={{ uri: data.avatar }}
            style={styles.rekindleAvatarImg}
          />
        </View>
        <View style={styles.rekindleDaysBadge}>
          <Text style={styles.rekindleDaysText}>{daysLabel}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.rekindleInfo}>
        <View style={styles.rekindleNameRow}>
          <Text style={styles.rekindleName}>{data.name}</Text>
          <HeatIndicator heat={data.heat} />
        </View>
        <Text style={styles.rekindleLastMeet} numberOfLines={1}>
          {data.firstMetRitual ? (
            <>
              <Text style={styles.rekindleBold}>{data.firstMetRitual.name}</Text>
              'da tanışmıştınız
            </>
          ) : (
            "Bir süredir görüşmediniz"
          )}
        </Text>
      </View>

      <TouchableOpacity style={styles.rekindleCta} onPress={() => onMessage?.(data)}>
        <Icon name="message-circle" size={10} color={colors.text700} strokeWidth={2} />
        <Text style={styles.rekindleCtaText}>Yaz</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // ===== FriendNow =====
  nowContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingLeft: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  nowAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.green,
  },
  nowAvatar: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  nowAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.screen,
    // shadow as faux outer ring
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  nowDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.screen,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowDotRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.green,
  },
  nowInfo: {
    flex: 1,
    minWidth: 0,
  },
  nowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  nowName: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
  },
  nowStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
  },
  nowStatusText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.green,
    letterSpacing: 0.5,
  },
  nowActivity: {
    fontSize: 11,
    color: colors.text500,
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    lineHeight: 15,
  },
  nowActivityBold: {
    color: colors.text700,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  nowJoinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
  },
  nowJoinText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },

  // ===== Rekindle =====
  rekindleContainer: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingLeft: 17,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  rekindleAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.text500,
  },
  rekindleAvatarStack: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  rekindleAvatarMain: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.paper,
    overflow: 'hidden',
    // faux outer ring via shadow
    shadowColor: colors.borderWarm,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  rekindleAvatarImg: {
    width: '100%',
    height: '100%',
    opacity: 0.7, // desaturation alternative (RN has no CSS filter)
  },
  rekindleDaysBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.text700,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.paper,
  },
  rekindleDaysText: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
  },
  rekindleInfo: {
    flex: 1,
    minWidth: 0,
  },
  rekindleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  rekindleName: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
  },
  rekindleLastMeet: {
    fontSize: 11,
    color: colors.text500,
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    lineHeight: 15,
  },
  rekindleBold: {
    color: colors.text700,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  rekindleCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.pill,
  },
  rekindleCtaText: {
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.text700,
  },
});
