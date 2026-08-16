import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { pulseHeroImage } from '../constants/pulseExampleImages';

const { width } = Dimensions.get('window');
const PADDING = 20;
const CARD_WIDTH_FULL = width - PADDING * 2;
const CARD_WIDTH_NARROW = width - 52;

const CTA_BG = '#0a0a0a';
const LIGHT_BACKGROUND = '#020617';
const LIGHT_CARD = '#020617';
const DARK_TEXT_PRIMARY = '#e5e7eb';
const DARK_TEXT_SECONDARY = '#9ca3af';

const HERO_RADIUS = 18;
/** Sabit alçak şerit — daha “dar” kart */
const CARD_COMPACT_HEIGHT = 100;

export default function SpecialEventCard({ ritual, onPress, city, fullWidth = false }) {
  const cardWidth = fullWidth ? CARD_WIDTH_FULL : CARD_WIDTH_NARROW;
  const marginH = fullWidth ? 0 : 26;
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getTags = () => {
    // Map type and energy_state to tags
    const tags = [];
    if (ritual.type) {
      tags.push(ritual.type);
    }
    if (ritual.energy_state === 'high') {
      tags.push('Canlı');
    } else if (ritual.energy_state === 'calm') {
      tags.push('Sakin');
    }
    if (ritual.type === 'Music' || ritual.title?.toLowerCase().includes('music') || ritual.title?.toLowerCase().includes('jazz')) {
      if (!tags.includes('Müzik')) tags.unshift('Müzik');
    }
    if (ritual.type === 'Social') {
      if (!tags.includes('Sosyal')) tags.push('Sosyal');
    }
    return tags.slice(0, 2); // Max 2 (dar kart)
  };

  const interestedCount = ritual.interested_count || ritual.current_attendees || 0;
  const friendsInterested = ritual.friends_interested || ritual.friends_here || 0;

  const heroUri = pulseHeroImage(ritual);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { width: cardWidth, height: CARD_COMPACT_HEIGHT, marginHorizontal: marginH, borderRadius: HERO_RADIUS },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <ImageBackground
        source={{ uri: heroUri }}
        resizeMode="cover"
        style={styles.imageBackground}
        imageStyle={[styles.imageStyle, { borderRadius: HERO_RADIUS, opacity: 0.95 }]}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.68)']}
          style={[StyleSheet.absoluteFillObject, { borderRadius: HERO_RADIUS }]}
        />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.specialEventBadge}>
            <Text style={styles.specialEventText}>⭐ ÖZEL ETKİNLİK</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Time and Title — hero-time 28px 700, hero-title 20px 600 */}
          <Text style={styles.timeText}>{formatTime(ritual.start_time)} Bu Gece</Text>
          <Text style={styles.title} numberOfLines={1}>
            {ritual.title}
          </Text>
          <View style={styles.locationRow}>
            {ritual.is_venue_verified ? (
              <MaterialIcons name="verified" size={11} color="#22c55e" style={styles.venueIcon} />
            ) : null}
            <Text style={styles.location} numberOfLines={1}>
              {ritual.venue_name} · {city}
              {` · ${interestedCount} ilgilenen`}
            </Text>
          </View>

          {/* Masked Proximity Signals */}
          {ritual.is_friend_hosting && (
            <View style={styles.proximityRow}>
              <Text style={styles.proximityText}>👤 Bir arkadaş hostluyor</Text>
            </View>
          )}
          {ritual.is_followed_host_hosting && !ritual.is_friend_hosting && (
            <View style={styles.proximityRow}>
              <Text style={styles.proximityText}>⭐ Takip ettiğin biri hostluyor</Text>
            </View>
          )}
          {friendsInterested > 0 && (
            <View style={styles.friendsRow}>
              <View style={styles.friendAvatars}>
                {[...Array(Math.min(friendsInterested, 4))].map((_, i) => (
                  <View key={i} style={[styles.friendAvatar, { marginLeft: i > 0 ? -5 : 0 }]} />
                ))}
              </View>
              <Text style={styles.friendsText}>
                {friendsInterested} arkadaş ilgileniyor
              </Text>
            </View>
          )}

          {/* Tags */}
          {getTags().length > 0 && (
            <View style={styles.tagsContainer}>
              {getTags().map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Yer Kap</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  imageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    backgroundColor: LIGHT_CARD,
  },
  imageStyle: {
    opacity: 0.6,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 0,
  },
  specialEventBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  specialEventText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 0,
    lineHeight: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
    minWidth: 0,
  },
  venueIcon: { marginTop: 1 },
  location: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(255,255,255,0.88)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  friendAvatars: {
    flexDirection: 'row',
  },
  friendAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.8)',
    backgroundColor: '#475569',
  },
  friendsText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  proximityRow: {
    marginBottom: 1,
  },
  proximityText: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 2,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionButton: {
    backgroundColor: CTA_BG,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});
