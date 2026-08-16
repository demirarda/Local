import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { PULSE_SOCIAL_TAGS } from '../constants/pulseSocialTags';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

// Match pul.html - Host Hosting New Ritual card
const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#F3F4F6';
const TAG_BG = '#F3F4F6';

export default function HostHostingNewRitualCard({ ritual, onPress, city }) {
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };
  const seatsLeft = (ritual.capacity || 0) - (ritual.current_attendees || 0);
  const tags = ritual.tags || ritual.vibes || ['Sosyal', 'Canli', 'Sakin'];

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.hostTag}>
        <Text style={styles.hostTagText}>{PULSE_SOCIAL_TAGS.HOST}</Text>
      </View>
      <Text style={styles.metaText}>Takip ettigin host duzenliyor:</Text>
      <Text style={styles.title} numberOfLines={2}>
        {formatTime(ritual.start_time)} Bu Gece{'\n'}{ritual.title}
      </Text>
      <Text style={styles.location}>{ritual.venue_name || 'Mekan'} · {city}</Text>
      <Text style={styles.seatsText}>{seatsLeft} bos koltuk</Text>
      <View style={styles.tagsRow}>
        {(Array.isArray(tags) ? tags : [tags]).slice(0, 3).map((tag, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{typeof tag === 'string' ? tag : tag.name || 'Tag'}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.joinButton} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.joinButtonText}>Katil</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: 'space-between',
  },
  hostTag: {
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  hostTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 18,
    marginBottom: 4,
  },
  location: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 4,
  },
  seatsText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: TAG_BG,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 9,
    color: '#4B5563',
  },
  joinButton: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
