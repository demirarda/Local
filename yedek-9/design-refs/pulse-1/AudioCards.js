import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import RankingBadge from './RankingBadge';
import { colors, fonts, radii } from '../../theme';

/**
 * Waveform generator - her render'da farklı bar yükseklikleri
 * Gerçek kullanımda backend'den gelen waveform data array'i kullanılır
 */
function generateBars(count, playedUntil = 0) {
  const bars = [];
  for (let i = 0; i < count; i++) {
    bars.push({
      height: 25 + Math.floor(Math.random() * 65),
      played: i < playedUntil,
    });
  }
  return bars;
}

/**
 * 1. VoiceMemoCard
 * Kişisel sesli not (30sn-1dk). Cream/paper.
 *
 * data: { id, avatar, name, meta, duration, waveform (optional), ranking }
 */
export function VoiceMemoCard({ data, onPress, onPlay }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(5);

  // Backend'den gelen waveform varsa onu kullan, yoksa generate et
  const bars = useMemo(
    () => data.waveform || generateBars(18, 5),
    [data.waveform]
  );

  const togglePlay = (e) => {
    e.stopPropagation?.();
    setPlaying(!playing);
    onPlay?.(data, !playing);
    // Backend hook: react-native-audio ile dosya oynat
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.vmContainer}
    >
      <View style={styles.vmTop}>
        <RankingBadge type={data.ranking.type} label={data.ranking.label} />
      </View>

      <View style={styles.vmHeader}>
        <Image source={{ uri: data.avatar }} style={styles.vmAvatar} />
        <View style={styles.vmInfo}>
          <Text style={styles.vmName}>{data.name}</Text>
          <Text style={styles.vmMeta}>{data.meta}</Text>
        </View>
        <View style={styles.vmDurationBadge}>
          <Text style={styles.vmDurationText}>{data.duration}</Text>
        </View>
      </View>

      <View style={styles.vmPlayer}>
        <TouchableOpacity onPress={togglePlay} style={styles.vmPlayBtn}>
          <Icon
            name={playing ? 'pause' : 'play'}
            size={11}
            color="#fff"
            style={!playing && { marginLeft: 1 }}
          />
        </TouchableOpacity>

        <View style={styles.vmWaveform}>
          {bars.map((bar, i) => (
            <View
              key={i}
              style={[
                styles.vmBar,
                { height: `${bar.height}%` },
                bar.played && styles.vmBarPlayed,
              ]}
            />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * 2. AudioStoryCard
 * Uzun anlatım (3-5 dk). Podcast hissi. Navy/mor gradient.
 *
 * data: { id, cover, title, author, authorAvatar, preview,
 *         duration, progress, currentTime, audioUrl }
 */
export function AudioStoryCard({ data, onPress, onPlay }) {
  const [playing, setPlaying] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation?.();
    setPlaying(!playing);
    onPlay?.(data, !playing);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.storyContainer}
    >
      <LinearGradient
        colors={['#1A1A2E', '#0F1D44', '#16213E']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Radial highlights */}
      <View style={styles.storyHighlightTL} />
      <View style={styles.storyHighlightBR} />

      <View style={styles.storyTop}>
        <View style={styles.storyBrand}>
          <Icon name="clock" size={11} color={colors.audioLight} />
          <Text style={styles.storyBrandText}>SESLİ HİKAYE</Text>
        </View>
        <View style={styles.storyDurationBadge}>
          <Text style={styles.storyDurationText}>{data.duration}</Text>
        </View>
      </View>

      <View style={styles.storyBody}>
        <View style={styles.storyCover}>
          <Image source={{ uri: data.cover }} style={{ width: '100%', height: '100%' }} />
        </View>

        <View style={styles.storyText}>
          <Text style={styles.storyTitle} numberOfLines={2}>{data.title}</Text>
          <View style={styles.storyAuthor}>
            <Image source={{ uri: data.authorAvatar }} style={styles.storyAuthorAvatar} />
            <Text style={styles.storyAuthorName}>{data.author}</Text>
          </View>
          <Text style={styles.storyPreview} numberOfLines={2}>
            {data.preview}
          </Text>
        </View>
      </View>

      <View style={styles.storyControls}>
        <TouchableOpacity onPress={togglePlay} style={styles.storyPlayBtn}>
          <Icon
            name={playing ? 'pause' : 'play'}
            size={12}
            color="#0F1D44"
            style={!playing && { marginLeft: 2 }}
          />
        </TouchableOpacity>

        <View style={styles.storyProgress}>
          <Text style={styles.storyProgressTime}>{data.currentTime}</Text>
          <View style={styles.storyProgressBar}>
            <LinearGradient
              colors={[colors.audio, colors.audioLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.storyProgressFill, { width: `${data.progress}%` }]}
            />
          </View>
          <Text style={styles.storyProgressTime}>{data.duration}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * 3. VenueAmbianceCard
 * Mekandan canlı ortam sesi.
 *
 * data: { id, thumb, venue, description, listeners, listenerAvatars, streamUrl }
 */
export function VenueAmbianceCard({ data, onPress, onListen }) {
  // Visualizer animasyonu - 8 bar
  const bars = useRef([...Array(8)].map(() => new Animated.Value(0.4))).current;

  useEffect(() => {
    const loops = bars.map((bar, i) => {
      const base = [0.4, 0.7, 0.5, 0.85, 0.6, 0.75, 0.45, 0.65][i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(bar, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(bar, { toValue: base, duration: 600, useNativeDriver: false }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.vaContainer}
    >
      <LinearGradient
        colors={['#2D1B4E', '#4C1D95', '#1A1A2E']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top shimmer strip */}
      <View style={styles.vaShimmerBar} />

      <View style={styles.vaHeader}>
        <View style={styles.vaLabel}>
          <View style={styles.vaLabelDot} />
          <Text style={styles.vaLabelText}>CANLI ORTAM SESİ</Text>
        </View>

        <View style={styles.vaListeners}>
          <View style={styles.vaListenerAvatars}>
            {data.listenerAvatars.slice(0, 3).map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.vaListenerAvatar, i > 0 && { marginLeft: -5 }]}
              />
            ))}
          </View>
          <Text style={styles.vaListenersText}>{data.listeners} dinliyor</Text>
        </View>
      </View>

      <View style={styles.vaBody}>
        <View style={styles.vaThumb}>
          <Image source={{ uri: data.thumb }} style={{ width: '100%', height: '100%' }} />
          <View style={styles.vaThumbOverlay}>
            <Icon name="volume-2" size={18} color="#fff" />
          </View>
        </View>

        <View style={styles.vaInfo}>
          <Text style={styles.vaVenue} numberOfLines={1}>{data.venue}</Text>
          <Text style={styles.vaDescription} numberOfLines={1}>{data.description}</Text>

          {/* Live visualizer */}
          <View style={styles.vaVisualizer}>
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.vaVizBar,
                  {
                    height: bar.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['30%', '100%'],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.vaListenBtn}
          onPress={(e) => { e.stopPropagation?.(); onListen?.(data); }}
        >
          <Icon name="play" size={10} color={colors.audioDeep} />
          <Text style={styles.vaListenText}>Dinle</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/**
 * 4. GroupVoiceCard
 * Ritüelden kolektif ses (kahkaha, şarkı). Paper + mor accent.
 *
 * data: { id, title, caption, ritual, duration, participants, avatars }
 */
export function GroupVoiceCard({ data, onPress, onPlay }) {
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => generateBars(24, 0), []);

  const togglePlay = (e) => {
    e.stopPropagation?.();
    setPlaying(!playing);
    onPlay?.(data, !playing);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => onPress?.(data)}
      style={styles.gvContainer}
    >
      {/* Left mor accent */}
      <LinearGradient
        colors={[colors.audio, colors.audioLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gvAccent}
      />

      <View style={styles.gvTop}>
        <View style={styles.gvLabel}>
          <Icon name="users" size={12} color={colors.audio} />
          <Text style={styles.gvLabelText}>GRUP SESİ</Text>
        </View>
        <Text style={styles.gvRitual}>{data.ritual}</Text>
      </View>

      <View style={styles.gvBody}>
        <View style={styles.gvAvatarStack}>
          {data.avatars.slice(0, 3).map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[styles.gvStackAvatar, i > 0 && { marginLeft: -8 }]}
            />
          ))}
          {data.participants > 3 && (
            <View style={[styles.gvStackAvatar, styles.gvStackMore, { marginLeft: -8 }]}>
              <Text style={styles.gvStackMoreText}>+{data.participants - 3}</Text>
            </View>
          )}
        </View>

        <View style={styles.gvInfo}>
          <Text style={styles.gvTitle} numberOfLines={1}>{data.title}</Text>
          <Text style={styles.gvCaption} numberOfLines={1}>{data.caption}</Text>
        </View>

        <View style={styles.gvDurationBadge}>
          <Text style={styles.gvDurationText}>{data.duration}</Text>
        </View>
      </View>

      <View style={styles.gvPlayer}>
        <TouchableOpacity onPress={togglePlay} style={styles.gvPlayBtn}>
          <Icon
            name={playing ? 'pause' : 'play'}
            size={12}
            color="#fff"
            style={!playing && { marginLeft: 1 }}
          />
        </TouchableOpacity>

        <View style={styles.gvWaveform}>
          {bars.map((bar, i) => (
            <View
              key={i}
              style={[
                styles.gvBar,
                { height: `${bar.height}%` },
                bar.played && styles.gvBarPlayed,
              ]}
            />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // === VoiceMemo ===
  vmContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    padding: 12,
  },
  vmTop: { marginBottom: 10 },
  vmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  vmAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  vmInfo: { flex: 1 },
  vmName: {
    fontSize: 11.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
  },
  vmMeta: {
    fontSize: 9.5,
    color: colors.text400,
    fontFamily: fonts.sans,
  },
  vmDurationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
  },
  vmDurationText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text700,
  },
  vmPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderWarm,
  },
  vmPlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vmWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: 22,
  },
  vmBar: {
    flex: 1,
    backgroundColor: colors.text400,
    borderRadius: 2,
    minWidth: 1.5,
    maxWidth: 2.5,
  },
  vmBarPlayed: {
    backgroundColor: colors.text900,
  },

  // === AudioStory ===
  storyContainer: {
    borderRadius: radii.lg,
    padding: 16,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  storyHighlightTL: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  storyHighlightBR: {
    position: 'absolute',
    bottom: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(139,92,246,0.1)',
  },
  storyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 1,
  },
  storyBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  storyBrandText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.audioLight,
    letterSpacing: 1,
  },
  storyDurationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
  },
  storyDurationText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  storyBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    zIndex: 1,
  },
  storyCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
  },
  storyText: {
    flex: 1,
  },
  storyTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  storyAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  storyAuthorAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  storyAuthorName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
  },
  storyPreview: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fonts.sans,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  storyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    zIndex: 1,
  },
  storyPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyProgress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyProgressTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
  },
  storyProgressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  storyProgressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },

  // === VenueAmbiance ===
  vaContainer: {
    borderRadius: radii.lg,
    padding: 14,
    minHeight: 110,
    overflow: 'hidden',
    position: 'relative',
  },
  vaShimmerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.audio,
  },
  vaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  vaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vaLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.audio,
  },
  vaLabelText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.audioLight,
  },
  vaListeners: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vaListenerAvatars: {
    flexDirection: 'row',
  },
  vaListenerAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2D1B4E',
  },
  vaListenersText: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.sans,
  },
  vaBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vaThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  vaThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(76,29,149,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaInfo: {
    flex: 1,
  },
  vaVenue: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  vaDescription: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fonts.sans,
    marginBottom: 8,
  },
  vaVisualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
  },
  vaVizBar: {
    width: 2,
    backgroundColor: colors.audio,
    borderRadius: 1,
  },
  vaListenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vaListenText: {
    fontSize: 10.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.audioDeep,
  },

  // === GroupVoice ===
  gvContainer: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    borderRadius: radii.lg,
    padding: 14,
    paddingLeft: 17,
    position: 'relative',
    overflow: 'hidden',
  },
  gvAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  gvTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  gvLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  gvLabelText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.audio,
  },
  gvRitual: {
    fontSize: 10,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },
  gvBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  gvAvatarStack: {
    flexDirection: 'row',
  },
  gvStackAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.paper,
    backgroundColor: colors.surfaceMuted,
  },
  gvStackMore: {
    backgroundColor: colors.audio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gvStackMoreText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
  gvInfo: { flex: 1 },
  gvTitle: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  gvCaption: {
    fontFamily: fonts.hand,
    fontSize: 15,
    color: colors.text700,
    lineHeight: 17,
  },
  gvDurationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.purpleSoft,
    borderRadius: radii.pill,
  },
  gvDurationText: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.audio,
  },
  gvPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(139,92,246,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    borderRadius: radii.sm,
  },
  gvPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.audio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gvWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: 26,
  },
  gvBar: {
    flex: 1,
    backgroundColor: 'rgba(139,92,246,0.3)',
    borderRadius: 2,
    minWidth: 1.5,
    maxWidth: 3,
  },
  gvBarPlayed: {
    backgroundColor: colors.audio,
  },
});
