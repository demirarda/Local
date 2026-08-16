import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const PRIMARY_COLOR = '#f9a13d';
const LIGHT_BACKGROUND = '#020617';
const LIGHT_CARD = '#020617';
const LIGHT_CARD_BORDER = '#1f2937';
const DARK_TEXT_PRIMARY = '#e5e7eb';
const DARK_TEXT_SECONDARY = '#9ca3af';
const DARK_TEXT_TERTIARY = '#6b7280';

export default function FriendInterestedEventCard({ ritual, onPress, city }) {
  const friendsInterested = ritual.friends_interested || 0;

  const formatTimeLabel = () => {
    const start = new Date(ritual.start_time);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const hours = start.getHours().toString().padStart(2, '0');
    const minutes = start.getMinutes().toString().padStart(2, '0');
    const timePart = `${hours}:${minutes}`;
    return isToday ? `Bu Gece ${timePart}` : `${timePart}`;
  };

  if (friendsInterested <= 0) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ARKADAS AKTIVITE KARTI</Text>
      </View>

      {/* Body copy */}
      <Text style={styles.subtitle}>
        {friendsInterested}{' '}
        {friendsInterested === 1 ? 'arkadaş ilgileniyor:' : 'arkadaş ilgileniyor:'}
      </Text>

      {/* Title + meta */}
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>
      <Text style={styles.meta}>
        {formatTimeLabel()} · {ritual.venue_name} · {city}
      </Text>

      {/* CTA */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.actionButtonText}>
          {ritual.entry_type === 'open' ? 'Katil' : 'Yer Kap'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: LIGHT_CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LIGHT_CARD_BORDER,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: DARK_TEXT_TERTIARY,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 4,
  },
  meta: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 12,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
});

