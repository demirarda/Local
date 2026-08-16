/**
 * fri.html styled cards for Friends tab - matches fri.html UI design exactly
 * Data comes from PulseScreen (pulseMemories, filteredRituals, friendPulseEvents)
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;
const ACCENT_BLUE = '#3478F6';
const ACCENT_PURPLE = '#5856D6';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#F3F4F6';
const GRAY_100 = '#F3F4F6';
const GRAY_500 = '#6B7280';
const GRAY_600 = '#4B5563';
const EMERALD_900 = '#064E3B';
const SPOTIFY_GREEN = '#1DB954';
const DEFAULT_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvqp_oZXzgLONdn2q1RIqACH3_TxTyMV6urX8KZj0y-nFZXlxl3kEA4fFsBxaYZSTkQyKgfXUtg7T5IaGCCBXPqWx2xJ8R1uqPHo4apRICbNu5Ua0OLdPD22Uc1fCmVrv828XIIZhXcMOtKLlhgfc1zbhKp5TqqkAJFc5si9NxN1AYC3P_likqGBZAK18n7RdHLZXVLXJB2YHjT5djxwT5oSaRtcO0B9fY4kLQ3PR2yJ64khd4ZcN2nn01oZfZrQysSg7pgfOMnpw';

const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Simdi';
  if (diffMins < 60) return `${diffMins} dk once`;
  if (diffHours < 24) return `${diffHours} sa once`;
  return `${diffDays} g once`;
};

/** fri.html: Full-width Friend memory card (Elena shared a memory) */
export function FriFriendMemoryCard({ memory, onPress }) {
  const imageUri = memory.image_url || memory.photo_url || memory.ritual_image_url || DEFAULT_IMAGE;
  const title = memory.ritual_title || 'Ritual memory';
  const userName = memory.user_name || memory.host_name || 'Arkadas';
  const quote = memory.content || '';

  return (
    <TouchableOpacity style={styles.friMemoryCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friMemoryHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
        <Text style={styles.friMetaText}>{userName} bir ani paylasti • {formatTimeAgo(memory.created_at)}</Text>
      </View>
      <View style={styles.friMemoryBody}>
        <Image source={{ uri: imageUri }} style={styles.friMemoryImage} resizeMode="cover" />
        <View style={styles.friMemoryContent}>
          <Text style={styles.friMemoryTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.friMemoryLocationRow}>
            <MaterialIcons name="location-on" size={12} color={GRAY_500} />
            <Text style={styles.friMemoryLocation}>Dun · Sosyal · Sakin</Text>
          </View>
          {quote ? <Text style={styles.friMemoryQuote} numberOfLines={2}>"{quote}"</Text> : null}
        </View>
      </View>
      <View style={styles.friMemoryFooter}>
        <TouchableOpacity style={styles.friViewButton} onPress={onPress} activeOpacity={0.9}>
          <Text style={styles.friViewButtonText}>Aniyi Gor</Text>
        </TouchableOpacity>
        <View style={styles.friReactions}>
          <Text style={styles.friReaction}>❤️</Text>
          <Text style={styles.friReaction}>🔥</Text>
          <Text style={styles.friReaction}>😊</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** fri.html: Quote card (Marco posted) */
export function FriQuoteCard({ memory, onPress }) {
  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
      </View>
      <Text style={styles.friQuoteMeta}>Posted • {formatTimeAgo(memory.created_at)}</Text>
      <View style={styles.friQuoteBlock}>
        <MaterialIcons name="format-quote" size={24} color="#D1D5DB" style={styles.friQuoteIconLeft} />
        <Text style={styles.friQuoteText} numberOfLines={3}>
          {memory.content || 'The best conversations happen over coffee, not screens.'}
        </Text>
        <View style={[styles.friQuoteIconRight, { transform: [{ rotate: '180deg' }] }]}>
          <MaterialIcons name="format-quote" size={24} color="#D1D5DB" />
        </View>
      </View>
      <View style={styles.friQuoteFooter}>
        <Text style={styles.friLikesText}>12 likes</Text>
        <TouchableOpacity style={styles.friSmallButton} onPress={onPress} activeOpacity={0.9}>
          <Text style={styles.friSmallButtonText}>Profili Gor</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/** fri.html: Spotify playlist card (dark emerald) */
export function FriSpotifyCard({ memory, onPress, fullWidth = false }) {
  const playlistName = memory.playlist_name || 'Late Night Jazz';
  const coverUrl = memory.playlist_thumbnail_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPLjU0i3Y8xIAWe_7KACkWtX-FY2IO6_W2_qp-sSOykeV35AEqp8zLRvwnK1tWEx4rA2T12-ITGatdQ8b3dM-rcVQpJn2m3c_7_vfGih0-7A2Q8rleCBKxigOvDpwdznYLXx7yA1BmE-vdeHrcEkprlaGeJjm-mBiHoLY4thVMNJ8Jxn21v5CLbI1jx8OPu4Y_LOPeTYWuzytbQ5z_4Y0Hx3IDen0U1OVIAPuG_EAMsdlZGQp-_yKsmfKn-Vc6MF6LHoTBPWValxs';
  const songCount = memory.song_count || 24;

  return (
    <TouchableOpacity
      style={[styles.friCard, fullWidth ? styles.friCardFull : styles.friCardHalf, styles.friSpotifyCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeWhite]}>
          <Text style={styles.friBadgeTextWhite}>Arkadas</Text>
        </View>
      </View>
      <Text style={styles.friSpotifyMeta}>bir calma listesi paylasti • {formatTimeAgo(memory.created_at)}</Text>
      <View style={styles.friSpotifyBody}>
        <View style={styles.friSpotifyLogo}>
          <MaterialIcons name="graphic-eq" size={14} color={SPOTIFY_GREEN} />
          <Text style={styles.friSpotifyLabel}>Spotify</Text>
        </View>
        <View style={styles.friSpotifyInfo}>
          <Image source={{ uri: coverUrl }} style={styles.friSpotifyCover} resizeMode="cover" />
          <View>
            <Text style={styles.friSpotifyTitle} numberOfLines={1}>{playlistName}</Text>
            <Text style={styles.friSpotifySub}>{songCount} songs · 1h 45m</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.friListenButton} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.friListenButtonText}>Dinle</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** fri.html: Event card (Yoga, Join Them) */
export function FriEventCard({ ritual, onPress, city }) {
  const formatTime = (d) => {
    const date = new Date(d);
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  };
  const imageUri = ritual.image_url || ritual.venue_image_url || DEFAULT_IMAGE;
  const friendsCount = ritual.friends_here || ritual.friends_interested || 0;

  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf, styles.friEventCard]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
      </View>
      <View style={styles.friEventRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.friEventTitle} numberOfLines={2}>{ritual.title}</Text>
          <Text style={styles.friEventMeta}>{ritual.venue_name || 'Mekan'} · Bugun {formatTime(ritual.start_time)}</Text>
        </View>
        <Image source={{ uri: imageUri }} style={styles.friEventThumb} resizeMode="cover" />
      </View>
      {friendsCount > 0 && (
        <View style={styles.friFriendsGoingRow}>
          <MaterialIcons name="people" size={10} color={GRAY_500} />
          <Text style={styles.friFriendsGoing}>{friendsCount} arkadas da katiliyor</Text>
        </View>
      )}
      <View style={styles.friTagsRow}>
        <View style={styles.friTag}><Text style={styles.friTagText}>Canli</Text></View>
        <View style={styles.friTag}><Text style={styles.friTagText}>Sakin</Text></View>
      </View>
      <TouchableOpacity style={styles.friJoinButton} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.friJoinButtonText}>Katil</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** fri.html: Mutual Friends card */
export function FriMutualFriendsCard({ event, onPress }) {
  const title = event.ritual_title || 'Basketball Discussion';
  const venue = event.venue_name || 'Karge Coffee';

  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgePurple]}>
          <Text style={styles.friBadgeTextPurple}>Ortak Arkadaslar</Text>
        </View>
      </View>
      <View style={styles.friEventRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.friEventTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.friEventMeta}>Dun gece {venue}</Text>
        </View>
        <Image source={{ uri: DEFAULT_IMAGE }} style={styles.friEventThumb} resizeMode="cover" />
      </View>
      <View style={styles.friViewMemoriesRow}>
        <MaterialIcons name="visibility" size={10} color={GRAY_500} />
        <Text style={styles.friViewMemories}>Anilarini gor</Text>
      </View>
      <View style={styles.friMutualFooter}>
        <Text style={styles.friMutualLabel}>Anilari gor</Text>
        <TouchableOpacity style={styles.friSmallButton} onPress={onPress} activeOpacity={0.9}>
          <Text style={styles.friSmallButtonText}>Gor</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/** fri.html: Book recommendation card */
export function FriBookRecCard({ memory, onPress }) {
  const title = memory.book_title || memory.ritual_title || 'The Art of Gathering';
  const quote = memory.content || 'This book changed how I think about rituals and connection. Highly recommend!';
  const imageUri = memory.image_url || memory.cover_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuC5OztRmx4ofCjyi7Kzro-SfuZUbTFjjHiMNKkBmTsDPGLVW6_tgFiTJ2r2UP1G2jJUXZTCjTk2XL6L6sMWD70ZgXSi6fkoRdaN0fE6nlRPLJAjg6VPr-gqRpBVc_3y5ivC7pnk7Ny9nCf30r1kszviBBlx6OEBeQBFQyaFr34XLn2F-MMiVbsgiJ-gFLf25O2NLxrYTAdelsUyEvIRVXIBWk_R2wt_OQSUX0uydWktZzchxQ2BJW0kam4P68WcW_Py562dmnlhveg';
  const recommender = memory.user_name || 'Anna';

  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
      </View>
      <View style={styles.friBookRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.friBookRecLabel}>{recommender} onerdi</Text>
          <Text style={styles.friEventTitle} numberOfLines={2}>{title}</Text>
        </View>
        <Image source={{ uri: imageUri }} style={styles.friBookCover} resizeMode="cover" />
      </View>
      <Text style={styles.friBookQuote} numberOfLines={3}>"{quote}"</Text>
      <View style={styles.friTagsRow}>
        <View style={styles.friTag}><Text style={styles.friTagText}>Derin</Text></View>
        <View style={styles.friTag}><Text style={styles.friTagText}>Dusunceli</Text></View>
      </View>
      <TouchableOpacity style={styles.friJoinButton} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.friJoinButtonText}>Kitabi Gor</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** fri.html: Host hosting card (Friend + Hosting) */
export function FriHostingCard({ ritual, onPress, city }) {
  const formatTime = (d) => {
    const date = new Date(d);
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
  };
  const imageUri = ritual.image_url || ritual.venue_image_url || DEFAULT_IMAGE;
  const capacity = ritual.capacity || 8;
  const attendees = ritual.current_attendees || 0;

  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
        <View style={[styles.friBadge, styles.friBadgeOrange]}>
          <Text style={styles.friBadgeTextOrange}>Hostluyor</Text>
        </View>
      </View>
      <View style={styles.friEventRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.friEventTitle} numberOfLines={2}>{ritual.title}</Text>
          <View style={styles.friEventMetaRow}>
            <MaterialIcons name="schedule" size={10} color={ACCENT_BLUE} />
            <Text style={styles.friEventMeta}>Hostluyor · Yarin {formatTime(ritual.start_time)}</Text>
          </View>
        </View>
        <Image source={{ uri: imageUri }} style={styles.friEventThumb} resizeMode="cover" />
      </View>
      <View style={styles.friEventMetaRow}>
        <MaterialIcons name="location-on" size={10} color={GRAY_500} />
        <Text style={styles.friEventMeta}>{ritual.venue_name || 'Mekan'} · {attendees}/{capacity} koltuk dolu</Text>
      </View>
      <View style={styles.friTagsRow}>
        <View style={styles.friTag}><Text style={styles.friTagText}>Sosyal</Text></View>
        <View style={styles.friTag}><Text style={styles.friTagText}>Derin</Text></View>
      </View>
      <TouchableOpacity style={styles.friJoinButton} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.friJoinButtonText}>Yer Kap</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** fri.html: Voice memo card */
export function FriVoiceMemoCard({ memory, onPress, fullWidth = false }) {
  const userName = memory.user_name || 'Arkadas';
  const transcript = memory.transcript_summary || memory.content || 'Quick recap: Great vibe, strong participation, and a smooth host flow.';
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!isPlaying) return undefined;
    const t = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 154) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying]);
  const mm = String(Math.floor(seconds / 60)).padStart(1, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <TouchableOpacity
      style={[styles.friCard, fullWidth ? styles.friCardFull : styles.friCardHalf]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas</Text>
        </View>
        <Text style={styles.friMetaText}>{userName} bir dusunce paylasti • {formatTimeAgo(memory.created_at)}</Text>
      </View>
      <View style={styles.friVoiceRow}>
        <View style={styles.friVoiceIcon}>
          <MaterialIcons name="mic" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.friWaveform}>
          {[2, 4, 6, 4, 3, 5, 2, 4, 1].map((h, i) => (
            <View key={i} style={[styles.friWaveBar, { height: h, backgroundColor: i >= 1 && i <= 5 ? ACCENT_BLUE : '#E5E7EB' }]} />
          ))}
        </View>
        <Text style={styles.friVoiceDuration}>{mm}:{ss} / 2:34</Text>
      </View>
      <View style={styles.friVoiceFooter}>
        <Text style={styles.friVoiceTitle}>About last night's ritual...</Text>
        <TouchableOpacity style={styles.friSmallButton} onPress={() => setIsPlaying((x) => !x)} activeOpacity={0.9}>
          <Text style={styles.friSmallButtonText}>{isPlaying ? 'Duraklat' : 'Oynat'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.friVoiceTranscript} numberOfLines={2}>
        Transkript: {transcript}
      </Text>
    </TouchableOpacity>
  );
}

/** fri.html: Jazz / Friend Activity with avatars */
export function FriJazzActivityCard({ ritual, onPress, city }) {
  const imageUri = ritual.image_url || ritual.venue_image_url || DEFAULT_IMAGE;
  const friendsCount = ritual.friends_interested || ritual.friends_here || 0;

  return (
    <TouchableOpacity style={[styles.friCard, styles.friCardHalf]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.friCardHeader}>
        <View style={[styles.friBadge, styles.friBadgeBlue]}>
          <Text style={styles.friBadgeTextBlue}>Arkadas Aktivitesi</Text>
        </View>
      </View>
      <View style={styles.friEventRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.friEventTitle} numberOfLines={2}>{ritual.title}</Text>
          <View style={styles.friEventMetaRow}>
            <MaterialIcons name="location-on" size={10} color={GRAY_500} />
            <Text style={styles.friEventMeta}>Bu Gece 20:30 · {ritual.venue_name || city}</Text>
          </View>
        </View>
        <Image source={{ uri: imageUri }} style={styles.friEventThumb} resizeMode="cover" />
      </View>
      {friendsCount > 0 && (
        <View style={styles.friAvatarRow}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.friAvatar} />
          ))}
          <Text style={styles.friAvatarLabel}>{friendsCount} arkadas ilgili</Text>
        </View>
      )}
      <View style={styles.friTagsRow}>
        <View style={styles.friTag}><Text style={styles.friTagText}>Muzik</Text></View>
        <View style={styles.friTag}><Text style={styles.friTagText}>Sosyal</Text></View>
        <View style={styles.friTag}><Text style={styles.friTagText}>Canli</Text></View>
      </View>
      <TouchableOpacity style={styles.friJoinButton} onPress={onPress} activeOpacity={0.9}>
        <Text style={styles.friJoinButtonText}>Katil</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  friBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  friBadgeBlue: { backgroundColor: `${ACCENT_BLUE}1A` },
  friBadgeTextBlue: { fontSize: 10, fontWeight: '700', color: ACCENT_BLUE },
  friBadgePurple: { backgroundColor: `${ACCENT_PURPLE}1A` },
  friBadgeTextPurple: { fontSize: 9, fontWeight: '700', color: ACCENT_PURPLE },
  friBadgeWhite: { backgroundColor: 'rgba(255,255,255,0.2)' },
  friBadgeTextWhite: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  friBadgeOrange: { backgroundColor: 'rgba(249,115,22,0.2)' },
  friBadgeTextOrange: { fontSize: 8, fontWeight: '700', color: '#EA580C' },
  friMetaText: { fontSize: 11, color: GRAY_500, fontWeight: '500' },
  friCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  friCardHalf: { width: CARD_WIDTH },
  friCardFull: { width: '100%' },
  friMemoryCard: {
    ...{ backgroundColor: CARD_BG, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: CARD_BORDER },
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  friMemoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  friMemoryBody: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  friMemoryImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  friMemoryContent: { flex: 1 },
  friMemoryTitle: { fontSize: 18, fontWeight: '700', color: '#000', lineHeight: 22 },
  friMemoryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  friMemoryLocation: { fontSize: 12, color: GRAY_600 },
  friMemoryQuote: { fontSize: 14, fontStyle: 'italic', color: GRAY_600, marginTop: 8 },
  friMemoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friViewButton: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  friViewButtonText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  friReactions: { flexDirection: 'row', gap: 4 },
  friReaction: { fontSize: 18 },
  friQuoteMeta: { fontSize: 10, color: GRAY_500, marginBottom: 8 },
  friQuoteBlock: { position: 'relative', paddingVertical: 8 },
  friQuoteIconLeft: { position: 'absolute', top: -4, left: -4 },
  friQuoteIconRight: { position: 'absolute', bottom: -4, right: 0 },
  friQuoteText: { fontSize: 16, fontWeight: '700', color: '#000', lineHeight: 22, paddingHorizontal: 8 },
  friQuoteFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  friLikesText: { fontSize: 10, fontWeight: '600', color: GRAY_500 },
  friSmallButton: {
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  friSmallButtonText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  friSpotifyCard: {
    backgroundColor: EMERALD_900,
  },
  friSpotifyMeta: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 12 },
  friSpotifyBody: { marginBottom: 12 },
  friSpotifyLogo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  friSpotifyLabel: { fontSize: 10, fontWeight: '700', color: SPOTIFY_GREEN },
  friSpotifyInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friSpotifyCover: { width: 48, height: 48, borderRadius: 8 },
  friSpotifyTitle: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  friSpotifySub: { fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  friListenButton: {
    backgroundColor: '#FFF',
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  friListenButtonText: { fontSize: 10, fontWeight: '700', color: '#000' },
  friEventCard: {},
  friEventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  friEventTitle: { fontSize: 12, fontWeight: '700', color: '#000' },
  friEventMeta: { fontSize: 9, color: GRAY_500, marginTop: 2 },
  friEventThumb: { width: 40, height: 40, borderRadius: 8 },
  friFriendsGoingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  friFriendsGoing: { fontSize: 9, color: GRAY_500 },
  friEventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  friTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  friTag: { backgroundColor: GRAY_100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  friTagText: { fontSize: 8, fontWeight: '700', color: GRAY_600 },
  friJoinButton: {
    width: '100%',
    backgroundColor: '#000',
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
  },
  friJoinButtonText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  friViewMemoriesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  friViewMemories: { fontSize: 9, color: GRAY_500 },
  friMutualFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  friMutualLabel: { fontSize: 9, fontWeight: '600', color: '#9CA3AF' },
  friBookRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  friBookRecLabel: { fontSize: 9, color: GRAY_500, marginBottom: 4 },
  friBookCover: { width: 40, height: 56, borderRadius: 6 },
  friBookQuote: { fontSize: 9, fontStyle: 'italic', color: GRAY_600, marginBottom: 8 },
  friVoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  friVoiceIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT_BLUE, justifyContent: 'center', alignItems: 'center' },
  friWaveform: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 24 },
  friWaveBar: { width: 3, borderRadius: 2 },
  friVoiceDuration: { fontSize: 10, color: GRAY_500 },
  friVoiceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  friVoiceTitle: { fontSize: 10, fontWeight: '700', color: '#000' },
  friVoiceTranscript: { marginTop: 8, fontSize: 10, color: GRAY_600, lineHeight: 14 },
  friAvatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  friAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#D1D5DB', marginLeft: -6, borderWidth: 1, borderColor: '#FFF' },
  friAvatarLabel: { fontSize: 7, color: GRAY_500, marginLeft: 8 },
});
