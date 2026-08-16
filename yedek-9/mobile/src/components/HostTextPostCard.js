import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { PULSE_SOCIAL_TAGS } from '../constants/pulseSocialTags';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

// Match pul.html - Host Text Post card
const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#F3F4F6';

export default function HostTextPostCard({ memory, onPress }) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.headerRow}>
        <View style={styles.hostTag}>
          <Text style={styles.hostTagText}>{PULSE_SOCIAL_TAGS.HOST}</Text>
        </View>
        <Text style={styles.metaText} numberOfLines={1}>Takip ettigin host · {memory.timeAgo}</Text>
      </View>
      <Text style={styles.quoteText} numberOfLines={3}>
        "{memory.content}"
      </Text>
      <View style={styles.reliabilityPill}>
        <Text style={styles.reliabilityText}>Host adi + Guvenilirlik Skoru</Text>
      </View>
      <TouchableOpacity style={styles.viewProfileButton} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.viewProfileText}>Profili Gor</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hostTag: {
    backgroundColor: '#000000',
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
    fontSize: 9,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  quoteText: {
    fontSize: 11,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#000000',
    lineHeight: 18,
    marginBottom: 12,
  },
  reliabilityPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  reliabilityText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#4B5563',
  },
  viewProfileButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
});
