import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const PRIMARY_COLOR = '#f9a13d';
const LIGHT_BACKGROUND = '#faf9f6';
const LIGHT_CARD = '#ffffff';
const LIGHT_CARD_BORDER = '#e5e5e0';
const DARK_TEXT_PRIMARY = '#1a1a1a';
const DARK_TEXT_SECONDARY = '#6b6b6b';
const DARK_TEXT_TERTIARY = '#9a9a9a';

export default function FriendJoinedLiveRitualCard({ ritual, onPress, city }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const friendsHere = ritual.friends_here || 0;
  const seatsLeft = ritual.capacity - (ritual.current_attendees || 0);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ARKADAS KATILDI · CANLI RITUEL</Text>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(ritual.start_time)}</Text>
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>CANLI</Text>
          </View>
        </View>
      </View>

      {/* Title + Location */}
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>
      <Text style={styles.location}>
        {ritual.venue_name} · {city}
      </Text>

      {/* Friends here */}
      {friendsHere > 0 && (
        <Text style={styles.friendsText}>
          {friendsHere} arkadaş burada
        </Text>
      )}

      {/* Seats + Verified */}
      <View style={styles.footerRow}>
        {seatsLeft > 0 && (
          <Text style={styles.seatsText}>
            {seatsLeft} koltuk kaldı
          </Text>
        )}
        {ritual.is_host_verified && (
          <Text style={styles.verifiedText}>Dogrulanmis Host</Text>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.actionButtonText}>Katıl</Text>
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
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: DARK_TEXT_TERTIARY,
    letterSpacing: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
  },
  livePill: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 4,
  },
  location: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 8,
  },
  friendsText: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seatsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: PRIMARY_COLOR,
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

