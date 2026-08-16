import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii, spacing } from '../../theme';

/**
 * EventCard
 * Koyu arka planlı event kartı.
 *
 * @param {object} data - { id, bg, title, meta, social, avatars, star, ranking }
 * @param {boolean} compact - Asymmetric/dual grid içinde mi? (daha kısa)
 */
export default function EventCard({ data, compact = false, onPress, onJoin }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={[styles.container, compact && styles.compact]}
    >
      <ImageBackground source={{ uri: data.bg }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient
          colors={['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.7)', 'rgba(10,10,10,0.95)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      {/* Top row */}
      <View style={styles.topRow}>
        <RankingBadge type={data.ranking.type} label={data.ranking.label} onDark />
        {data.star && (
          <View style={styles.starPill}>
            <Icon name="star" size={10} color="#FBBF24" style={{ marginRight: 4 }} />
            <Text style={styles.starText}>ÖZEL</Text>
          </View>
        )}
      </View>

      {/* Content at bottom */}
      <View style={styles.content}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
          {data.title}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="clock" size={11} color="rgba(255,255,255,0.75)" style={{ marginRight: 5 }} />
          <Text style={styles.metaText} numberOfLines={1}>
            {data.meta}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.social}>
            {data.avatars && data.avatars.length > 0 && (
              <View style={styles.avatarStack}>
                {data.avatars.slice(0, 3).map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={[styles.stackAvatar, i > 0 && { marginLeft: -6 }]}
                  />
                ))}
              </View>
            )}
            <Text style={styles.socialText} numberOfLines={1}>
              {data.social}
            </Text>
          </View>

          <TouchableOpacity style={styles.ctaBtn} onPress={() => onJoin?.(data)}>
            <Text style={styles.ctaText}>Koltuk Al</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 200,
    padding: 14,
    justifyContent: 'flex-end',
  },
  compact: {
    minHeight: 160,
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.pill,
  },
  starText: {
    color: '#fff',
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  content: {
    position: 'relative',
    zIndex: 2,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.sans,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  social: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0A0A0A',
    backgroundColor: '#ccc',
  },
  socialText: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.sans,
    flex: 1,
  },
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#fff',
    borderRadius: radii.pill,
  },
  ctaText: {
    color: colors.black,
    fontSize: 11,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
});
