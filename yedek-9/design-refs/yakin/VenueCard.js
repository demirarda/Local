import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import { formatDistance } from '../../utils/geoUtils';

/**
 * VenueCard
 * Mekan kartı (Caffè, bar, park vs.) ve aynı yapı ile yakındaki arkadaş kartı.
 *
 * @param {object} data - Mekan data
 *   venue variant: {
 *     id, image, name, verified, distance,
 *     status: 'open' | 'closed',
 *     occupancy (string, e.g., "18 kişi içeride"),
 *     activity (string, e.g., "Miles Davis çalıyor"),
 *     activityIcon (emoji/string, e.g., "♪"),
 *   }
 *
 *   friend variant: {
 *     id, avatar, name, distance, location (e.g., "Parco Sempione'de"),
 *     currentRitual (e.g., "Morning Yoga"),
 *   }
 *
 * @param {string} variant - 'venue' | 'friend'
 * @param {function} onPress
 * @param {function} onAction - CTA button
 */
export default function VenueCard({ data, variant = 'venue', onPress, onAction }) {
  const isFriend = variant === 'friend';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.container}
    >
      {/* Thumb */}
      <View style={[styles.thumb, isFriend && styles.thumbFriend]}>
        <Image
          source={{ uri: isFriend ? data.avatar : data.image }}
          style={styles.thumbImage}
        />
        {data.distance != null && (
          <View
            style={[
              styles.distancePin,
              isFriend && styles.distancePinFriend,
            ]}
          >
            <Text style={styles.distancePinText}>
              {formatDistance(data.distance)}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {data.name}
          </Text>
          {!isFriend && data.verified && (
            <Icon name="check-circle" size={11} color={colors.navy} style={styles.verified} />
          )}
          {isFriend && (
            <View style={styles.friendBadge}>
              <Text style={styles.friendBadgeText}>Arkadaşın</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusBlock}>
            <View
              style={[
                styles.statusDot,
                data.status === 'closed' && styles.statusDotClosed,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                data.status === 'closed' && styles.statusTextClosed,
              ]}
            >
              {isFriend ? 'Aktif' : data.status === 'closed' ? 'Kapalı' : 'Açık'}
            </Text>
          </View>

          <View style={styles.statusSep} />

          <Text style={styles.occupancy} numberOfLines={1}>
            {isFriend ? data.location : data.occupancy}
          </Text>
        </View>

        {(data.activity || data.currentRitual) && (
          <Text style={styles.activity} numberOfLines={1}>
            <Text style={styles.activityIcon}>
              {data.activityIcon || (isFriend ? '◦ ' : '◦ ')}
            </Text>
            {isFriend ? `"${data.currentRitual}" ritüelinde` : data.activity}
          </Text>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.cta, isFriend && styles.ctaFriend]}
        onPress={(e) => {
          e.stopPropagation?.();
          onAction?.(data);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon
          name={isFriend ? 'message-circle' : 'arrow-right'}
          size={14}
          color="#fff"
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  thumbFriend: {
    borderRadius: 32, // circular for friend
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  distancePin: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(15,29,68,0.9)',
    borderRadius: 4,
  },
  distancePinFriend: {
    left: 'auto',
    right: 4,
  },
  distancePinText: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  name: {
    fontSize: 14,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  verified: {
    flexShrink: 0,
  },
  friendBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: colors.blueSoft,
    borderRadius: radii.pill,
  },
  friendBadgeText: {
    fontSize: 10,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.blue,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.green,
  },
  statusDotClosed: {
    backgroundColor: colors.text400,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.green,
  },
  statusTextClosed: {
    color: colors.text400,
  },
  statusSep: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text400,
  },
  occupancy: {
    fontSize: 11,
    color: colors.text500,
    fontFamily: fonts.sans,
    flexShrink: 1,
  },
  activity: {
    fontSize: 11,
    color: colors.text700,
    fontFamily: fonts.sans,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  activityIcon: {
    color: colors.text500,
    marginRight: 3,
  },
  cta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaFriend: {
    backgroundColor: colors.blue,
  },
});
