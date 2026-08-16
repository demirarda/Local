import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { pulseMemoryImage } from '../constants/pulseExampleImages';
import { PULSE_SOCIAL_TAGS } from '../constants/pulseSocialTags';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 176; // h-44 = 176px from pul.html
/** Pulse featured row: same height as LiveNowCard pair grid */
/** Mockup: sol sütun biraz daha uzun (masonry) */
const PAIR_GRID_HEIGHT = 302;

// Match pul.html exactly
const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#F3F4F6'; // pul.html border-gray-100
const TEXT_PRIMARY = '#000000';
const TEXT_SECONDARY = '#6B7280';
const HOST_TAG_BG = '#000000';
const CARD_PADDING = 12; // pul.html p-3

const cleanFeedText = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/\[Pulse Showcase\]\s*/gi, '')
    .replace(/\[Followed\]\s*/gi, '')
    .replace(/\[(PHOTO|QUOTE|VOICE|RESHARE|TAGGED)\]\s*/gi, '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export default function HostMemoryShareCard({ memory, onPress, city, fullWidth = true, gridHalf = false }) {
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'Simdi';
    if (diffMins < 60) return `${diffMins} dk once`;
    if (diffHours < 24) return `${diffHours} sa once`;
    return `${diffHours} sa once`;
  };

  const isFriendSource = memory.is_friend_source;
  const imageUri = pulseMemoryImage(memory);
  const title = cleanFeedText(memory.ritual_title || memory.content || '') || 'Ritual anisi';
  const venueLabel = cleanFeedText(memory.ritual_venue || city);
  const energyLabel = memory.energy_state === 'high' ? 'Yuksek enerji' : memory.energy_state === 'calm' ? 'Sakin' : 'Karisik';

  return (
    <TouchableOpacity
      style={[styles.container, fullWidth && styles.containerFull, gridHalf && styles.containerGridHalf]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      </View>
      <View style={styles.content}>
        <View style={styles.contentTop}>
          <View style={styles.headerRow}>
            <View style={styles.hostTag}>
              <Text style={styles.hostTagText}>{PULSE_SOCIAL_TAGS.HOST}</Text>
            </View>
            <Text style={styles.metaText}>
              {isFriendSource ? 'Arkadas' : 'Takip ettigin host'} · {formatTimeAgo(memory.created_at)}
            </Text>
          </View>
          <Text style={[styles.contextText, gridHalf && styles.contextTextGridHalf]}>
            Ritual anisi paylasti
          </Text>
          <Text style={[styles.title, gridHalf && styles.titleGridHalf]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.venueText}>{venueLabel}</Text>
          <View style={styles.energyRow}>
            <MaterialIcons name="local-fire-department" size={14} color="#525252" />
            <Text style={styles.energyText}>{energyLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.viewButton} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.viewButtonText}>Goruntule</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    height: CARD_HEIGHT,
    padding: CARD_PADDING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  containerFull: {
    width: '100%',
  },
  containerGridHalf: {
    width: '100%',
    height: PAIR_GRID_HEIGHT,
    alignSelf: 'flex-start',
    borderRadius: 20,
  },
  imageContainer: {
    width: '40%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    width: '60%',
    paddingLeft: 12,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  contentTop: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  hostTag: {
    backgroundColor: HOST_TAG_BG,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  contextText: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 8,
  },
  contextTextGridHalf: {
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  titleGridHalf: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  venueText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  energyText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
  viewButton: {
    width: '100%',
    backgroundColor: HOST_TAG_BG,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
