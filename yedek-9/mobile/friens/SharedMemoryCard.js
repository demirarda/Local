import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../theme';
import { formatDaysSince } from '../utils/friendshipHeat';

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * SharedMemoryCard
 * Senin de içinde olduğun bir anı (ritüel) kartı. "SEN DE" altın badge.
 *
 * data: {
 *   id, image, title, venue, date,
 *   participants: [{ name, avatar }, ...],   // senin hariç
 * }
 */
export default function SharedMemoryCard({ data, onPress }) {
  const participants = data.participants || [];
  const withText = formatWithText(participants);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.container}
    >
      {/* Cover */}
      <View style={styles.cover}>
        <Image source={{ uri: data.image }} style={styles.coverImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'transparent', 'rgba(0,0,0,0.8)']}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* "SEN DE" badge */}
        <View style={styles.youBadge}>
          <Icon name="check" size={10} color="#fff" strokeWidth={2.5} />
          <Text style={styles.youBadgeText}>SEN DE</Text>
        </View>

        {/* Caption overlay */}
        <View style={styles.overlay}>
          <Text style={styles.title} numberOfLines={2}>
            {cleanText(data.title)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {cleanText(data.venue)} · {formatDaysSince(data.date)}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.avatarsStack}>
          {participants.slice(0, 2).map((p, i) => (
            <Image
              key={i}
              source={{ uri: p.avatar }}
              style={[styles.stackAvatar, i > 0 && { marginLeft: -7 }]}
            />
          ))}
        </View>
        <Text style={styles.withText} numberOfLines={1}>
          {withText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * "Elena & Alessandro" veya "Elena +2" formatı
 */
function formatWithText(participants) {
  if (!participants || participants.length === 0) return '';
  if (participants.length === 1) return <><Text style={{ fontWeight: '700' }}>{participants[0].name}</Text> ile</>;
  if (participants.length === 2) {
    return (
      <>
        <Text style={{ fontWeight: '700' }}>{participants[0].name}</Text>
        {` & ${participants[1].name}`}
      </>
    );
  }
  return (
    <>
      <Text style={{ fontWeight: '700' }}>{participants[0].name}</Text>
      {` +${participants.length - 1}`}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    aspectRatio: 1 / 1.25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cover: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  youBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    paddingLeft: 6,
    backgroundColor: colors.gold,
    borderRadius: radii.pill,
    zIndex: 2,
  },
  youBadgeText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  overlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    zIndex: 2,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 18,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  meta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.sans,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  avatarsStack: {
    flexDirection: 'row',
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.screen,
    backgroundColor: colors.surfaceMuted,
  },
  withText: {
    flex: 1,
    fontSize: 11,
    color: colors.text700,
    fontFamily: fonts.sans,
  },
});
