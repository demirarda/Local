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

// all.html: bg-white border border-gray-100, Almost Full badge #FEEAD1/#E67E22, button black
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#F3F4F6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const ALMOST_FULL_BADGE_BG = '#FEEAD1';
const ALMOST_FULL_ORANGE = '#E67E22';
const PROGRESS_TRACK = '#F3F4F6';

export default function AlmostFullCard({ ritual, onPress, city }) {
  const seatsLeft = ritual.capacity - (ritual.current_attendees || 0);
  const friendsHere = ritual.friends_here || ritual.friends_interested || 0;
  const fillPercent = ritual.capacity > 0
    ? Math.round(((ritual.current_attendees || 0) / ritual.capacity) * 100)
    : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Almost Full</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>
      <Text style={styles.seatsLeftText}>
        {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left!
      </Text>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fillPercent}%` }]} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.percentText}>{fillPercent}%</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {ritual.entry_type === 'open' ? 'Katıl' : 'Hızlı Katıl'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.location}>
        {ritual.venue_name} · {city}
      </Text>

      {ritual.is_friend_hosting && (
        <View style={styles.proximityRow}>
          <Text style={styles.proximityText}>👤 A friend is hosting</Text>
        </View>
      )}
      {ritual.is_followed_host_hosting && !ritual.is_friend_hosting && (
        <View style={styles.proximityRow}>
          <Text style={styles.proximityText}>⭐ Someone you follow is hosting</Text>
        </View>
      )}
      {friendsHere > 0 && (
        <View style={styles.friendsRow}>
          <View style={styles.friendAvatars}>
            {[...Array(Math.min(friendsHere, 2))].map((_, i) => (
              <View key={i} style={[styles.friendAvatar, { marginLeft: i > 0 ? -8 : 0 }]} />
            ))}
          </View>
          <Text style={styles.friendsText}>
            {friendsHere} {friendsHere === 1 ? 'friend' : 'friends'} here
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: ALMOST_FULL_BADGE_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: ALMOST_FULL_ORANGE,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  seatsLeftText: {
    fontSize: 11,
    fontWeight: '700',
    color: ALMOST_FULL_ORANGE,
    marginBottom: 12,
  },
  progressWrap: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: PROGRESS_TRACK,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ALMOST_FULL_ORANGE,
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  location: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  proximityRow: {
    marginBottom: 4,
  },
  proximityText: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendAvatars: {
    flexDirection: 'row',
  },
  friendAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CARD_BG,
    backgroundColor: '#9CA3AF',
  },
  friendsText: {
    fontSize: 10,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
});
