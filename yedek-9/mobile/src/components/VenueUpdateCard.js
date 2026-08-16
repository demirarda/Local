import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

// Match pul.html - Venue Update card
const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#F3F4F6';

export default function VenueUpdateCard({ ritual, venue, onPress, city }) {
  const formatTime = (dateString) => {
    const d = new Date(dateString);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  };
  const venueName = venue?.name || venue?.venue_name || ritual?.venue_name || 'Mekan';
  const ritualTitle = ritual?.title || 'Yeni Ritual';
  const interestedCount = ritual?.friends_interested || ritual?.current_attendees || 12;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.metaRow}>
        <MaterialIcons name="domain" size={14} color="#000000" />
        <Text style={styles.metaText}>Takip ettigin mekan</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{venueName} icin yeni Ritual</Text>
      <Text style={styles.subtitle}>{ritualTitle}</Text>
      <Text style={styles.timeText}>Bu Gece {ritual?.start_time ? formatTime(ritual.start_time) : '21:00'} · {city}</Text>
      <View style={styles.verifiedRow}>
        <MaterialIcons name="check-circle" size={10} color="#000000" />
        <Text style={styles.verifiedText}>Dogrulanmis Mekan</Text>
      </View>
      <View style={styles.interestedRow}>
        <MaterialIcons name="group" size={12} color="#9CA3AF" />
        <Text style={styles.interestedText}>{interestedCount} kisi ilgileniyor</Text>
      </View>
      <TouchableOpacity style={styles.getSeatButton} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.getSeatText}>Yer Kap</Text>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    lineHeight: 16,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 8,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  verifiedText: {
    fontSize: 9,
    color: '#6B7280',
  },
  interestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  interestedText: {
    fontSize: 9,
    color: '#4B5563',
  },
  getSeatButton: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  getSeatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
