import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { pulseLiveCardImage } from '../constants/pulseExampleImages';

const { width } = Dimensions.get('window');
const PADDING = 16;
const GAP = 12;
const CARD_WIDTH_HALF = (width - PADDING * 2 - GAP) / 2;
const CARD_WIDTH_FULL = width - PADDING * 2;

// Match local-pulse-polished.html .card .live-card; livenow.html uses #FF3B30 and black Join
const CARD_BACKGROUND = '#FFFFFF';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#666666';
const TEXT_TERTIARY = '#6B7280';
const LIVE_RED = '#e74c3c';
const LIVE_BADGE_BG = '#ffe5e5';
const ACCENT_RED = '#FF3B30';
const SEATS_WARN = '#525252';
/** Mockup: sağ LIVE kartı biraz daha kısa */
const PAIR_GRID_HEIGHT = 270;

export default function LiveNowCard({ ritual, onPress, city, fullWidth = false, livenowPage = false, pairGrid = false }) {
  const cardWidth = fullWidth ? CARD_WIDTH_FULL : CARD_WIDTH_HALF;
  const liveColor = livenowPage ? ACCENT_RED : LIVE_RED;
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const friendsJustJoined = ritual.friends_just_joined || ritual.friends_here || 0;
  const seatsLeft = ritual.capacity - (ritual.current_attendees || 0);
  const lastJoinAt = ritual.last_join_at ? new Date(ritual.last_join_at) : null;
  const lastJoinMinutesAgo = lastJoinAt ? Math.floor((new Date() - lastJoinAt) / 60000) : null;

  const cardInner = (
    <>
      {/* Header — livenow.html: red dot + "11:30 · LIVE" on one line; else LIVE NOW + time row */}
      <View style={[styles.header, livenowPage && styles.headerLivenow, pairGrid && styles.headerPairGrid]}>
        {livenowPage ? (
          <View style={[styles.timeLiveRow, pairGrid && styles.timeLiveRowPairGrid]}>
            <View style={[styles.liveDot, { backgroundColor: liveColor }]} />
            <Text style={styles.timeLiveLivenow}>
              {formatTime(ritual.start_time)} · <Text style={{ color: liveColor, fontWeight: '700' }}>CANLI</Text>
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.headerLabel}>SIMDI CANLI</Text>
            <View style={styles.timeLiveRow}>
              <View style={[styles.liveDot, { backgroundColor: liveColor }]} />
              <Text style={styles.timeText}>{formatTime(ritual.start_time)}</Text>
              <View style={styles.liveBadge}>
                <Text style={[styles.liveBadgeText, { color: liveColor }]}>CANLI</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, livenowPage && styles.titleLivenow, pairGrid && styles.titlePairGrid]} numberOfLines={2}>
        {ritual.title}
      </Text>

      {/* Location */}
      <Text style={[styles.location, livenowPage && styles.locationLivenow, pairGrid && styles.locationPairGrid]}>
        {ritual.venue_name} · {city}
      </Text>

      {/* Masked Proximity Signals */}
      {ritual.is_friend_hosting && (
        <View style={[styles.proximityRow, pairGrid && styles.proximityRowPairGrid]}>
          <Text style={styles.proximityText}>👤 Bir arkadaş hostluyor</Text>
        </View>
      )}
      {ritual.is_followed_host_hosting && !ritual.is_friend_hosting && (
        <View style={[styles.proximityRow, pairGrid && styles.proximityRowPairGrid]}>
          <Text style={styles.proximityText}>⭐ Someone you follow is hosting</Text>
        </View>
      )}
      {ritual.is_followed_venue_active && (
        <View style={[styles.proximityRow, pairGrid && styles.proximityRowPairGrid]}>
          <Text style={styles.proximityText}>📍 A followed venue is active</Text>
        </View>
      )}
      {/* Last join indicator (presence signal) */}
      {lastJoinMinutesAgo !== null && lastJoinMinutesAgo < 15 && friendsJustJoined === 0 && (
        <View style={styles.lastJoinRow}>
          <View style={styles.liveDot} />
          <Text style={styles.lastJoinText}>
            {lastJoinMinutesAgo < 1 ? 'Just joined' : `Joined ${lastJoinMinutesAgo} min ago`}
          </Text>
        </View>
      )}
      {/* Friends Just Joined / friends here — livenow.html: "5 friends here" */}
      {friendsJustJoined > 0 && (
        <View style={[styles.friendsRow, pairGrid && styles.friendsRowPairGrid]}>
          <View style={styles.friendAvatars}>
            {[...Array(Math.min(friendsJustJoined, 2))].map((_, i) => (
              <View key={i} style={[styles.friendAvatar, { marginLeft: i > 0 ? -8 : 0 }]} />
            ))}
          </View>
          <Text style={styles.friendsText}>
            {livenowPage
              ? `${friendsJustJoined} ${friendsJustJoined === 1 ? 'friend' : 'friends'} here`
              : `${friendsJustJoined} ${friendsJustJoined === 1 ? 'friend' : 'friends'} just joined`}
          </Text>
        </View>
      )}

      {/* Seats Left — livenow.html: orange for "3 seats left", red for urgency */}
      {seatsLeft > 0 && (
        <Text
          style={[
            styles.seatsLeft,
            livenowPage && (seatsLeft <= 3 ? styles.seatsLeftRed : styles.seatsLeftWarn),
            pairGrid && styles.seatsLeftPairGrid,
          ]}
        >
          {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
        </Text>
      )}

      {/* Dogrulanmis Host */}
      {ritual.is_host_verified && (
        <View style={[styles.verifiedRow, pairGrid && styles.verifiedRowPairGrid]}>
          <MaterialIcons name="verified" size={12} color="#22c55e" />
          <Text style={styles.verifiedText}>Dogrulanmis Host</Text>
        </View>
      )}

      {/* Energy State */}
      {ritual.energy_state && (
        <View style={[styles.energyRow, pairGrid && styles.energyRowPairGrid]}>
          <Text style={styles.energyEmoji}>
            {ritual.energy_state === 'high' ? '🔥' : ritual.energy_state === 'calm' ? '🧘' : '⚡'}
          </Text>
          <Text style={styles.energyText}>
            {ritual.energy_state === 'high' ? 'High energy' : ritual.energy_state === 'calm' ? 'Calm' : 'Mixed'}
          </Text>
        </View>
      )}

      {/* Action Button — livenowPage: black; all.html grid: gray; full width: red */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          pairGrid && livenowPage && styles.actionButtonPairGrid,
          !pairGrid && !fullWidth && !livenowPage && styles.actionButtonGrid,
          !pairGrid && livenowPage && styles.actionButtonLivenow,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.actionButtonText,
            pairGrid && livenowPage && styles.actionButtonTextPairGrid,
            !pairGrid && !fullWidth && !livenowPage && styles.actionButtonTextGrid,
            !pairGrid && livenowPage && styles.actionButtonTextLivenow,
          ]}
        >
          Katıl
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <TouchableOpacity
      style={[
        styles.container,
        pairGrid && styles.containerPairGrid,
        !pairGrid && { width: cardWidth },
        !fullWidth && !pairGrid && styles.containerGrid,
        livenowPage && !pairGrid && styles.containerLivenow,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {pairGrid ? (
        <>
          <Image
            source={{ uri: pulseLiveCardImage(ritual) }}
            style={styles.pairTopImage}
            resizeMode="cover"
          />
          <View style={styles.pairInner}>{cardInner}</View>
        </>
      ) : (
        cardInner
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  containerGrid: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  containerLivenow: {
    padding: 12,
    borderRadius: 16,
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  containerPairGrid: {
    width: '100%',
    height: PAIR_GRID_HEIGHT,
    alignSelf: 'flex-start',
    padding: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 0,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  pairTopImage: {
    width: '100%',
    height: 62,
    backgroundColor: '#e8e8e8',
  },
  pairInner: {
    flex: 1,
    padding: 12,
    minHeight: 0,
  },
  header: {
    marginBottom: 12,
  },
  headerPairGrid: {
    marginBottom: 4,
  },
  timeLiveRowPairGrid: {
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_TERTIARY,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  headerLivenow: {
    marginBottom: 4,
  },
  timeLiveLivenow: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },
  timeLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LIVE_RED,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  liveBadge: {
    backgroundColor: LIVE_BADGE_BG,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: LIVE_RED,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  titleLivenow: {
    fontSize: 14,
    marginBottom: 2,
  },
  titlePairGrid: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  location: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  locationLivenow: {
    fontSize: 10,
    marginBottom: 4,
  },
  locationPairGrid: {
    fontSize: 10,
    marginBottom: 3,
    lineHeight: 14,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  friendAvatars: {
    flexDirection: 'row',
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: CARD_BACKGROUND,
    backgroundColor: '#475569',
  },
  friendsRowPairGrid: {
    marginBottom: 4,
  },
  friendsText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  lastJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  lastJoinText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  proximityRow: {
    marginBottom: 6,
  },
  proximityRowPairGrid: {
    marginBottom: 3,
  },
  proximityText: {
    fontSize: 9,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  seatsLeft: {
    fontSize: 13,
    fontWeight: '600',
    color: LIVE_RED,
    marginBottom: 8,
  },
  seatsLeftWarn: {
    color: SEATS_WARN,
    fontSize: 11,
  },
  seatsLeftRed: {
    color: ACCENT_RED,
    fontSize: 10,
    fontWeight: '700',
  },
  seatsLeftPairGrid: {
    marginBottom: 4,
    fontSize: 11,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  verifiedRowPairGrid: {
    marginBottom: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  energyRowPairGrid: {
    marginBottom: 4,
  },
  energyEmoji: {
    fontSize: 12,
  },
  energyText: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: LIVE_RED,
    marginTop: 'auto',
  },
  actionButtonGrid: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextGrid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  actionButtonLivenow: {
    backgroundColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionButtonPairGrid: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginTop: 'auto',
  },
  actionButtonTextLivenow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonTextPairGrid: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
