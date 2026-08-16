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
import { pulseVenueImage } from '../constants/pulseExampleImages';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 236;

// Match pul.html exactly
const CARD_BG = '#1C1C1E';
const BUTTON_BG = '#0a0a0a';

export default function VenueActivityCard({ venue, onPress, city }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  };

  const upcomingRituals = venue.upcoming_rituals || [];
  const ritualCount = upcomingRituals.length;
  const venueName = venue.name || venue.venue_name || 'Mekan';
  const imageUri = pulseVenueImage(venue);
  const isVerified = venue.is_verified !== false;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {isVerified && (
          <View style={styles.verifiedOverlay}>
            <MaterialIcons name="check-circle" size={10} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Dogrulanmis Mekan</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <MaterialIcons name="domain" size={12} color="#9CA3AF" />
          <Text style={styles.metaText} numberOfLines={1}>Takip ettigin mekan · Simdi aktif</Text>
        </View>
        <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
        {ritualCount > 0 && (
          <>
            <Text style={styles.ritualsTitle}>Gunun ritual programi</Text>
            <View style={styles.ritualList}>
              {upcomingRituals.slice(0, 3).map((ritual, index) => (
                <View key={index} style={styles.ritualItem}>
                  <View style={styles.bullet} />
                  <Text style={styles.ritualItemText} numberOfLines={1}>
                    {formatTime(ritual.start_time)} {ritual.title}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
        <TouchableOpacity style={styles.seeAllButton} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.seeAllText}>Tumunu Gor →</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 124,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  verifiedOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    flex: 1,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ritualsTitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  ritualList: {
    gap: 2,
  },
  ritualItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bullet: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#6B7280',
  },
  ritualItemText: {
    fontSize: 10,
    color: '#D1D5DB',
    flex: 1,
  },
  seeAllButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: BUTTON_BG,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  seeAllText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
