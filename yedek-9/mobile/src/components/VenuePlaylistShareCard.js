import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

const PLAYLIST_BG = '#282828';
const DEFAULT_PLAYLIST_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVgdasQ0aGadua3LOTcURexrzmzI0bv_6IVJ1MNVgh8C7zNVrmI08kLzq-mWP55Apt6GyoCH3DK2nLiwIYuUbMcCi34GEdnOmgpY-n67ggHGQGW1xxzIqh6veYAmP9rjlWG0Zfhc0UwG6L5Pfch9gk-EAq4l-jIZsEuLMWeMYqgoruYB7xAOpJpiBESAeQb1k4FLTR2yRgFB3GuZE435vRy3xFEg46HdUzkv_dxIZkqbYHySC39GgwS3DHhg-w_F4YeiuUF-1r8CyA';

export default function VenuePlaylistShareCard({ memory, onPress }) {
  const venueName = memory.ritual_venue || 'Venue';
  const playlistName = memory.playlist_name || 'Evening Vibes';
  const songCount = memory.song_count || 32;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.headerRow}>
        <MaterialIcons name="domain" size={14} color="#000000" />
        <Text style={styles.metaText} numberOfLines={1}>Venue you follow · {memory.timeAgo}</Text>
      </View>
      <View style={styles.playlistBox}>
        <Image
          source={{ uri: memory.playlist_thumbnail_url || DEFAULT_PLAYLIST_IMG }}
          style={styles.playlistThumb}
        />
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName} numberOfLines={1}>{playlistName}</Text>
          <Text style={styles.playlistSub} numberOfLines={1}>at {venueName}</Text>
          <Text style={styles.songCount}>{songCount} songs</Text>
        </View>
      </View>
      <Text style={styles.descText} numberOfLines={2}>{venueName} shared their ritual playlist</Text>
      <TouchableOpacity style={styles.listenButton} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.listenText}>Listen</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    gap: 6,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  playlistBox: {
    backgroundColor: PLAYLIST_BG,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  playlistThumb: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playlistSub: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },
  songCount: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 2,
  },
  descText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  listenButton: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  listenText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
