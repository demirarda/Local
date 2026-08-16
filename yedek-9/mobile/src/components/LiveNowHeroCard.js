import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = 340;
const ACCENT_RED = '#FF3B30';
const DEFAULT_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJwQi9zaAf00cAPD1i7uBqijueragkppXV51Dd2Hy5iZ49tF02sTJlEW5p_g1rV090F6hTTpmMXvBiJBkPD9LVn7C3Js67ocBRqCARZGoZ4X3x67JOIJTSwzsnBMH-QeIX62B1h_HroX8gsw5mNynVn-DkwPxNUn4vDntYLu-BuWPUnUadqq3PJBX_t_s9CEwxZhK7wuDtGiApxVOfgvNuPiKvomQjQmx_WttJchGOnZx1iILYG5cM331asxBcTp3fen481NDXLRM';

export default function LiveNowHeroCard({ ritual, onPress, city }) {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const seatsLeft = ritual.capacity - (ritual.current_attendees || 0);
  const friendsHere = ritual.friends_here || ritual.friends_just_joined || 0;
  const imageUri = ritual.image_url || DEFAULT_IMAGE;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <ImageBackground
        source={{ uri: imageUri }}
        style={styles.image}
        imageStyle={styles.imageStyle}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>CANLI</Text>
          </View>
          <View style={styles.timePill}>
            <Text style={styles.timePillText}>{formatTime(ritual.start_time)}</Text>
          </View>
        </View>
        <View style={styles.bottomContent}>
          <Text style={styles.title} numberOfLines={2}>{ritual.title}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={14} color="#D1D5DB" />
            <Text style={styles.location}>
              {ritual.venue_name} · {city}
            </Text>
          </View>
          {seatsLeft > 0 && seatsLeft <= 5 && (
            <View style={styles.seatsRow}>
              <MaterialIcons name="warning" size={14} color={ACCENT_RED} />
              <Text style={styles.seatsText}>{seatsLeft} KOLTUK KALDI!</Text>
            </View>
          )}
          {friendsHere > 0 && (
            <View style={styles.friendsRow}>
              <MaterialIcons name="groups" size={14} color="#FFFFFF" />
              <Text style={styles.friendsText}>
                {friendsHere} {friendsHere === 1 ? 'arkadaş' : 'arkadaş'} şu anda burada
              </Text>
            </View>
          )}
          <View style={styles.tagsRow}>
            {ritual.energy_state === 'high' && (
              <View style={styles.tag}><Text style={styles.tagText}>Canlı</Text></View>
            )}
            {ritual.energy_state === 'calm' && (
              <View style={styles.tag}><Text style={styles.tagText}>Sakin</Text></View>
            )}
            {ritual.type && (
              <View style={styles.tag}><Text style={styles.tagText}>{ritual.type}</Text></View>
            )}
          </View>
          <TouchableOpacity style={styles.joinButton} onPress={onPress} activeOpacity={0.9}>
            <Text style={styles.joinButtonText}>Şimdi Katıl</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HERO_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    flex: 1,
    justifyContent: 'space-between',
  },
  imageStyle: {
    borderRadius: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingLeft: 16,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT_RED,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timePill: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  bottomContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    color: '#D1D5DB',
    marginLeft: 4,
  },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  seatsText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_RED,
  },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  friendsText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  joinButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});
