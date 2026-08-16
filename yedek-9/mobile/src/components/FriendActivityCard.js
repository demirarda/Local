import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { pulseFriendActivityImage } from '../constants/pulseExampleImages';

// all.html: white card, border gray-100, blue tag #1D68C5, black button
const CARD_BACKGROUND = '#FFFFFF';
const CARD_BORDER = '#F3F4F6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#666666';
const TEXT_TERTIARY = '#6B7280';
const FRIEND_TAG_BG = '#1a1a1a';

export default function FriendActivityCard({ ritual, onPress, city }) {
  const getTimeRemaining = () => {
    const startTime = new Date(ritual.start_time);
    const now = new Date();
    const minutes = Math.floor((startTime - now) / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}sa ${minutes % 60}dk sonra`;
    }
    return `${minutes}dk sonra`;
  };

  const getTags = () => {
    const tags = [];
    if (ritual.energy_state === 'calm') {
      tags.push('Sakin');
    }
    if (ritual.energy_state === 'high' || ritual.type === 'Active') {
      tags.push('Canlı');
    }
    return tags;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: pulseFriendActivityImage(ritual) }}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <View style={styles.inner}>
      {/* Header — all.html: blue tag Friend Activity */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Friend Activity</Text>
      </View>

      <Text style={styles.description}>
        {`${ritual.friends_here || 1} arkadas bu Rituale katiliyor:`}
      </Text>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>

      {/* Location and Time */}
      <Text style={styles.locationTime}>
        {ritual.venue_name} • {city} • {getTimeRemaining()}
      </Text>

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
        <Text style={styles.actionButtonText}>Onlara Katil</Text>
      </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 0,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  heroImage: {
    width: '100%',
    height: 132,
    backgroundColor: '#e8e8e8',
  },
  inner: {
    padding: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: FRIEND_TAG_BG,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  locationTime: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
