import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

const PRIMARY_COLOR = '#f9a13d';
const LIGHT_BACKGROUND = '#020617';
const LIGHT_CARD = '#020617';
const LIGHT_CARD_BORDER = '#1f2937';
const DARK_TEXT_PRIMARY = '#e5e7eb';
const DARK_TEXT_SECONDARY = '#9ca3af';
const DARK_TEXT_TERTIARY = '#6b7280';

export default function ReopenedCard({ ritual, onPress, city }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const friendsHere = ritual.friends_here || ritual.friends_interested || 0;
  const currentAttendees = ritual.current_attendees || 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>YENIDEN ACILDI</Text>
        <View style={styles.reopenedBadge}>
          <MaterialIcons name="refresh" size={12} color={PRIMARY_COLOR} />
          <Text style={styles.reopenedBadgeText}>Yeniden Acildi</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>

      {/* Location */}
      <Text style={styles.location}>
        {ritual.venue_name} · {city}
      </Text>

      {/* Time Info */}
      <Text style={styles.timeInfo}>
        Baslangic: {formatTime(ritual.start_time)}
      </Text>

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
      {ritual.is_followed_venue_active && (
        <View style={styles.proximityRow}>
          <Text style={styles.proximityText}>📍 Takip edilen mekan aktif</Text>
        </View>
      )}
      {/* Friends Here */}
      {friendsHere > 0 && (
        <View style={styles.friendsRow}>
          <View style={styles.friendAvatars}>
            {[...Array(Math.min(friendsHere, 2))].map((_, i) => (
              <View key={i} style={[styles.friendAvatar, { marginLeft: i > 0 ? -8 : 0 }]} />
            ))}
          </View>
          <Text style={styles.friendsText}>
            {friendsHere} arkadaş burada
          </Text>
        </View>
      )}

      {/* Attendance Count */}
      {currentAttendees > 0 && (
        <Text style={styles.attendanceText}>
          {currentAttendees} kisi katildi
        </Text>
      )}

      {/* Verified Badge */}
      {(ritual.is_host_verified || ritual.is_venue_verified) && (
        <View style={styles.verifiedRow}>
          <MaterialIcons 
            name="verified" 
            size={12} 
            color="#22c55e" 
          />
          <Text style={styles.verifiedText}>
            {ritual.is_venue_verified ? 'Dogrulanmis Mekan' : 'Dogrulanmis Host'}
          </Text>
        </View>
      )}

      {/* Energy State */}
      {ritual.energy_state && (
        <View style={styles.energyRow}>
          <Text style={styles.energyEmoji}>
            {ritual.energy_state === 'high' ? '🔥' : ritual.energy_state === 'calm' ? '🧘' : '⚡'}
          </Text>
          <Text style={styles.energyText}>
            {ritual.energy_state === 'high' ? 'Yuksek enerji' : ritual.energy_state === 'calm' ? 'Sakin' : 'Karisik'}
          </Text>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onPress}
        activeOpacity={0.8}
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
    width: CARD_WIDTH,
    backgroundColor: LIGHT_CARD,
    borderWidth: 1,
    borderColor: LIGHT_CARD_BORDER,
    borderRadius: 24,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: DARK_TEXT_TERTIARY,
    letterSpacing: 1,
    flex: 1,
  },
  reopenedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LIGHT_BACKGROUND,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  reopenedBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    marginBottom: 4,
    color: DARK_TEXT_PRIMARY,
  },
  location: {
    fontSize: 10,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 9,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  friendAvatars: {
    flexDirection: 'row',
  },
  friendAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: LIGHT_BACKGROUND,
    backgroundColor: '#475569',
  },
  friendsText: {
    fontSize: 9,
    color: DARK_TEXT_SECONDARY,
  },
  proximityRow: {
    marginBottom: 6,
  },
  proximityText: {
    fontSize: 9,
    color: DARK_TEXT_SECONDARY,
    fontWeight: '500',
  },
  attendanceText: {
    fontSize: 10,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 8,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#22c55e',
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  energyEmoji: {
    fontSize: 12,
  },
  energyText: {
    fontSize: 10,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    marginTop: 'auto',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
});
