import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

// Match local-pulse-polished.html .soon-card (horizontal: content left, time pill right)
const CARD_BACKGROUND = '#FFFFFF';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#666666';
const TEXT_TERTIARY = '#6B7280';
const TIME_PILL_BG = '#e8e8e8';

export default function StartingSoonCard({ ritual, onPress, city, fullWidth = false }) {
  const getTimeRemaining = () => {
    const startTime = new Date(ritual.start_time);
    const now = new Date();
    const minutes = Math.max(0, Math.floor((startTime - now) / 60000));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}sa ${minutes % 60}dk`;
    }
    return `${minutes} dk`;
  };

  // Full-width feed variant: horizontal row, vertical label on left (tasarım: solda dikey yazı)
  if (fullWidth) {
    const verticalLabel = 'BASLAMAK UZERE KARTI';
    return (
      <TouchableOpacity
        style={[styles.container, styles.containerFull]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.soonLabelVerticalWrap}>
          {verticalLabel.split('').map((char, i) => (
            <Text key={i} style={styles.soonLabelVertical}>
              {char}
            </Text>
          ))}
        </View>
        <View style={styles.soonContent}>
          <Text style={styles.soonTitle} numberOfLines={2}>
            {ritual.title}
          </Text>
        </View>
        <View style={styles.timePill}>
          <Text style={styles.timePillText}>Başlangıca {getTimeRemaining()}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, !fullWidth && styles.containerGrid]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.headerLabel}>BAŞLAMAK ÜZERE</Text>
        <View style={styles.timePill}>
          <Text style={styles.timePillText}>Başlangıca {getTimeRemaining()}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {ritual.title}
      </Text>
      <Text style={styles.location}>
        {ritual.venue_name} · {city}
      </Text>
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
      {ritual.friends_here > 0 && (
        <View style={styles.friendsRow}>
          <View style={styles.friendAvatars}>
            {[...Array(Math.min(ritual.friends_here, 2))].map((_, i) => (
              <View key={i} style={[styles.friendAvatar, { marginLeft: i > 0 ? -8 : 0 }]} />
            ))}
          </View>
          <Text style={styles.friendsText}>
            {ritual.friends_here} arkadaş burada
          </Text>
        </View>
      )}
      {ritual.energy_state && (
        <View style={styles.energyRow}>
          <Text style={styles.energyEmoji}>
            {ritual.energy_state === 'high' ? '🔥' : ritual.energy_state === 'calm' ? '🧘' : '⚡'}
          </Text>
          <Text style={styles.energyText}>
            {ritual.energy_state === 'high' ? 'Yüksek enerji' : ritual.energy_state === 'calm' ? 'Sakin' : 'Karışık'}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>
          {ritual.entry_type === 'open' ? 'Katıl' : 'Yer Kap'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  containerFull: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soonLabelVerticalWrap: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 12,
    justifyContent: 'center',
  },
  soonLabelVertical: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TEXT_TERTIARY,
    lineHeight: 12,
  },
  soonContent: {
    flex: 1,
    marginRight: 12,
  },
  soonLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TEXT_TERTIARY,
    marginBottom: 8,
  },
  soonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TEXT_TERTIARY,
    flex: 1,
  },
  timePill: {
    backgroundColor: TIME_PILL_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
    color: TEXT_PRIMARY,
  },
  location: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 12,
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
    color: TEXT_SECONDARY,
  },
  proximityRow: {
    marginBottom: 6,
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
    borderColor: CARD_BACKGROUND,
    backgroundColor: '#475569',
  },
  friendsText: {
    fontSize: 9,
    color: TEXT_SECONDARY,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: '#000000',
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
