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

export default function FriendBecameFriendsCard({ event, onPress }) {
  const { ritual_title, venue_name, start_time, new_friends } = event;

  const formatTimeLabel = () => {
    const start = new Date(start_time);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const hours = start.getHours().toString().padStart(2, '0');
    const minutes = start.getMinutes().toString().padStart(2, '0');
    const timePart = `${hours}:${minutes}`;
    return isToday ? `${timePart} • Tonight` : timePart;
  };

  const renderSubtitle = () => {
    if (!new_friends || new_friends <= 0) {
      return 'After this ritual, new friendships formed in your circle';
    }
    if (new_friends === 1) {
      return 'After this ritual, you became friends with 1 person';
    }
    return `After this ritual, you became friends with ${new_friends} people`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>FRIEND BECAME FRIENDS</Text>
        <Text style={styles.timeText}>{formatTimeLabel()}</Text>
      </View>

      {/* Body copy */}
      <Text style={styles.subtitle}>
        {renderSubtitle()}
      </Text>

      {/* Ritual info */}
      <View style={styles.ritualInfo}>
        <Text style={styles.ritualTitle} numberOfLines={2}>
          {ritual_title}
        </Text>
        <Text style={styles.ritualMeta}>
          {venue_name}
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.actionButtonText}>View Ritual</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: DARK_TEXT_TERTIARY,
    letterSpacing: 1,
  },
  timeText: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
  },
  subtitle: {
    fontSize: 12,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 8,
  },
  ritualInfo: {
    marginBottom: 10,
  },
  ritualTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 2,
  },
  ritualMeta: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
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

