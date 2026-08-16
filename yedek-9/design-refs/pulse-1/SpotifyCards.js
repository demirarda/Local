import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radii } from '../../theme';

/**
 * Spotify logo as a small component
 */
function SpotifyLogo({ size = 12, color = colors.spotify }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.9-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </Svg>
  );
}

/**
 * SpotifyTrackCard
 * Tek şarkı paylaşımı. Full-width yatay.
 *
 * data: { id, cover, title, artist, sharedBy, sharedAvatar, sharedContext,
 *         progress, currentTime, totalTime, rankingText, spotifyUrl }
 */
export function SpotifyTrackCard({ data, onPress, onPlay }) {
  const [playing, setPlaying] = useState(false);

  const handlePlay = (e) => {
    e.stopPropagation?.();
    setPlaying(!playing);
    onPlay?.(data, !playing);
    // Backend hook: Spotify Web Playback SDK
    // playing = false → play, playing = true → pause
  };

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress?.(data)} style={styles.trackContainer}>
      {/* Green glow top-right */}
      <LinearGradient
        colors={['rgba(29,185,84,0.18)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.3, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.trackCover}>
        <Image source={{ uri: data.cover }} style={styles.trackCoverImage} />
      </View>

      <View style={styles.trackInfo}>
        <View style={styles.trackTop}>
          <View style={styles.spotifyBrand}>
            <SpotifyLogo size={12} />
            <Text style={styles.spotifyBrandText}>SPOTIFY</Text>
          </View>
          <Text style={styles.trackRankingText} numberOfLines={1}>
            {data.rankingText}
          </Text>
        </View>

        <View>
          <Text style={styles.trackTitle} numberOfLines={1}>{data.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{data.artist}</Text>

          <View style={styles.trackPlayer}>
            <TouchableOpacity onPress={handlePlay} style={styles.trackPlayCircle}>
              <Icon
                name={playing ? 'pause' : 'play'}
                size={11}
                color="#000"
                style={!playing && { marginLeft: 1.5 }}
              />
            </TouchableOpacity>

            <View style={styles.trackProgressWrap}>
              <Text style={styles.trackProgressTime}>{data.currentTime}</Text>
              <View style={styles.trackProgress}>
                <View style={[styles.trackProgressFill, { width: `${data.progress}%` }]} />
              </View>
              <Text style={styles.trackProgressTime}>{data.totalTime}</Text>
            </View>
          </View>
        </View>

        <View style={styles.trackSharedBy}>
          <Image source={{ uri: data.sharedAvatar }} style={styles.trackSharedAvatar} />
          <Text style={styles.trackSharedText} numberOfLines={1}>
            <Text style={styles.trackSharedName}>{data.sharedBy}</Text> · {data.sharedContext}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * SpotifyPlaylistCard
 * Ritüele eşlik eden çalma listesi. Kare, yeşil gradient.
 *
 * data: { id, covers: [url, url, url], title, source, trackCount, ritual, spotifyUrl }
 */
export function SpotifyPlaylistCard({ data, onPress, onPlay }) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.playlistContainer}
    >
      <LinearGradient
        colors={['#1DB954', '#0A6B2F', '#084220']}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative blurs - soft bubbles */}
      <View style={styles.playlistBubbleTop} />
      <View style={styles.playlistBubbleBottom} />

      <View style={styles.playlistTopRow}>
        <View style={styles.spotifyBrand}>
          <SpotifyLogo size={12} color="#fff" />
          <Text style={[styles.spotifyBrandText, { color: '#fff' }]}>PLAYLIST</Text>
        </View>
      </View>

      {/* Cover stack */}
      <View style={styles.playlistCoverStack}>
        <Image source={{ uri: data.covers[1] }} style={[styles.stackedCover, styles.stackedCoverLeft]} />
        <Image source={{ uri: data.covers[2] }} style={[styles.stackedCover, styles.stackedCoverRight]} />
        <Image source={{ uri: data.covers[0] }} style={[styles.stackedCover, styles.stackedCoverMain]} />
      </View>

      <View style={styles.playlistInfo}>
        <Text style={styles.playlistLabel}>{data.ritual.toUpperCase()}</Text>
        <Text style={styles.playlistTitle} numberOfLines={2}>{data.title}</Text>
        <Text style={styles.playlistMeta}>
          {data.source} · {data.trackCount} şarkı
        </Text>
      </View>

      <TouchableOpacity
        style={styles.playlistPlayBtn}
        onPress={(e) => { e.stopPropagation?.(); onPlay?.(data); }}
      >
        <Icon name="play" size={13} color={colors.spotifyDark} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/**
 * NowPlayingCard
 * Mekan veya kişi şu an ne dinliyor — canlı hissi.
 *
 * data: { id, cover, title, artist, sourceName, sourceAvatar, sourceLabel }
 */
export function NowPlayingCard({ data, onPress, onListen }) {
  // Top shimmer bar animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // EQ animation
  const eq1 = useRef(new Animated.Value(0.5)).current;
  const eq2 = useRef(new Animated.Value(0.8)).current;
  const eq3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const createEqLoop = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 0.9, duration: 400, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
        ])
      );
    const l1 = createEqLoop(eq1, 0);
    const l2 = createEqLoop(eq2, 150);
    const l3 = createEqLoop(eq3, 300);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.nowPlayingContainer}
    >
      <LinearGradient
        colors={['#0F1D44', '#1A2B5F', '#0F1D44']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial green glow - simulated */}
      <View style={styles.nowPlayingGlow} />

      {/* Top shimmer strip */}
      <View style={styles.nowPlayingShimmerBar} />

      <View style={styles.nowPlayingHeader}>
        <View style={styles.nowPlayingLabel}>
          <View style={styles.nowPlayingDot} />
          <Text style={styles.nowPlayingLabelText}>ŞİMDİ ÇALIYOR</Text>
        </View>

        <View style={styles.nowPlayingSource}>
          <Image source={{ uri: data.sourceAvatar }} style={styles.nowPlayingSourceAvatar} />
          <Text style={styles.nowPlayingSourceText} numberOfLines={1}>
            <Text style={styles.nowPlayingSourceName}>{data.sourceName}</Text> · {data.sourceLabel}
          </Text>
        </View>
      </View>

      <View style={styles.nowPlayingBody}>
        <View style={styles.nowPlayingCover}>
          <Image source={{ uri: data.cover }} style={{ width: '100%', height: '100%' }} />
          {/* EQ animation overlay */}
          <View style={styles.nowPlayingEq}>
            <Animated.View style={[styles.nowPlayingEqBar, { height: eq1.interpolate({ inputRange: [0, 1], outputRange: ['30%', '95%'] }) }]} />
            <Animated.View style={[styles.nowPlayingEqBar, { height: eq2.interpolate({ inputRange: [0, 1], outputRange: ['30%', '95%'] }) }]} />
            <Animated.View style={[styles.nowPlayingEqBar, { height: eq3.interpolate({ inputRange: [0, 1], outputRange: ['30%', '95%'] }) }]} />
          </View>
        </View>

        <View style={styles.nowPlayingTrack}>
          <Text style={styles.nowPlayingTitle} numberOfLines={1}>{data.title}</Text>
          <Text style={styles.nowPlayingArtist} numberOfLines={1}>{data.artist}</Text>
        </View>

        <TouchableOpacity
          style={styles.nowPlayingListenBtn}
          onPress={(e) => { e.stopPropagation?.(); onListen?.(data); }}
        >
          <SpotifyLogo size={11} color="#000" />
          <Text style={styles.nowPlayingListenText}>Dinle</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // === TRACK ===
  trackContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
  },
  trackCover: {
    width: 76,
    height: 76,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 4,
  },
  trackCoverImage: {
    width: '100%',
    height: '100%',
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  trackTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  spotifyBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotifyBrandText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.spotify,
    letterSpacing: 0.5,
  },
  trackRankingText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.sans,
  },
  trackTitle: {
    fontSize: 15,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fonts.sans,
    marginBottom: 8,
  },
  trackPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackPlayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.spotify,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackProgressWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackProgressTime: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
  },
  trackProgress: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  trackProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: radii.pill,
  },
  trackSharedBy: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackSharedAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  trackSharedText: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.sans,
  },
  trackSharedName: {
    color: '#fff',
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },

  // === PLAYLIST ===
  playlistContainer: {
    flex: 1,
    aspectRatio: 1 / 1.35,
    borderRadius: radii.lg,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  playlistBubbleTop: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  playlistBubbleBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playlistTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  playlistCoverStack: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    marginVertical: 12,
    zIndex: 2,
  },
  stackedCover: {
    position: 'absolute',
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 5,
  },
  stackedCoverMain: {
    top: 0,
    left: '12%',
    width: '76%',
    aspectRatio: 1,
    zIndex: 3,
  },
  stackedCoverLeft: {
    top: '8%',
    left: '2%',
    width: '60%',
    aspectRatio: 1,
    opacity: 0.7,
    transform: [{ rotate: '-8deg' }],
    zIndex: 2,
  },
  stackedCoverRight: {
    top: '8%',
    right: '2%',
    width: '60%',
    aspectRatio: 1,
    opacity: 0.6,
    transform: [{ rotate: '8deg' }],
    zIndex: 1,
  },
  playlistInfo: {
    zIndex: 2,
  },
  playlistLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  playlistTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  playlistMeta: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.sans,
  },
  playlistPlayBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },

  // === NOW PLAYING ===
  nowPlayingContainer: {
    borderRadius: radii.lg,
    padding: 14,
    overflow: 'hidden',
    minHeight: 110,
    position: 'relative',
  },
  nowPlayingGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(29,185,84,0.22)',
  },
  nowPlayingShimmerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.spotify,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
    zIndex: 1,
  },
  nowPlayingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nowPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.spotify,
  },
  nowPlayingLabelText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.spotify,
  },
  nowPlayingSource: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  nowPlayingSourceAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nowPlayingSourceText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
    flexShrink: 1,
  },
  nowPlayingSourceName: {
    color: '#fff',
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  nowPlayingBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
  },
  nowPlayingCover: {
    width: 54,
    height: 54,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  nowPlayingEq: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 3,
    height: 12,
  },
  nowPlayingEqBar: {
    width: 2,
    backgroundColor: colors.spotify,
    borderRadius: 1,
  },
  nowPlayingTrack: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontSize: 14,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  nowPlayingArtist: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
  },
  nowPlayingListenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.spotify,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nowPlayingListenText: {
    color: '#000',
    fontSize: 10.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
});
