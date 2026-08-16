import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image } from 'react-native';
import MemoryActionRow from './MemoryActionRow';

const MUSIC_ATTRIBUTION = {
  spotify: 'Spotify · link-out · ses LOCAL\'den akmaz',
  apple: 'Apple Music · link-out · ses LOCAL\'den akmaz',
  youtube: 'YouTube · link-out (3. sıra) · ses LOCAL\'den akmaz',
};

function detectMusicPlatform(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('spotify')) return 'spotify';
  if (u.includes('apple.com') || u.includes('music.apple')) return 'apple';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return 'spotify';
}

export default function MemoryCard({ memory, onPress, onDelete, isOwn, onUpvote, onDownvote, onSoz, onEcho }) {
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
    return `${diffDays} gun once`;
  };

  const musicUrl = memory.spotify_playlist_url || memory.external_url || memory.music_url;
  const platform = memory.music_platform || detectMusicPlatform(musicUrl);
  const coverUri = memory.music_cover_url || memory.cover_url || null;
  const canDelete = isOwn && onDelete && memory?.status !== 'draft';
  const attribution =
    memory.music_attribution ||
    MUSIC_ATTRIBUTION[platform] ||
    MUSIC_ATTRIBUTION.spotify;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(memory.user_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{memory.user_name}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(memory.created_at || memory.captured_at)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.content}>{memory.content}</Text>
      
      {musicUrl ? (
        <TouchableOpacity
          style={styles.spotifyCard}
          onPress={async () => {
            try {
              const supported = await Linking.canOpenURL(musicUrl);
              if (supported) await Linking.openURL(musicUrl);
            } catch (error) {
              console.error('Error opening music URL:', error);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.spotifyCardContent}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverThumb} />
            ) : (
              <Text style={styles.spotifyIcon}>🎵</Text>
            )}
            <View style={styles.spotifyCardText}>
              <Text style={styles.spotifyCardTitle}>
                {memory.music_title || memory.track_name || 'Calma listesi / parca'}
              </Text>
              <Text style={styles.spotifyCardSubtitle}>{attribution}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}
      
      {memory.ritual_title && (
        <View style={styles.ritualInfo}>
          <Text style={styles.ritualTitle}>{memory.ritual_title}</Text>
          {memory.ritual_venue && (
            <Text style={styles.ritualVenue}>{memory.ritual_venue}</Text>
          )}
        </View>
      )}
      {(memory.stamp_label || memory.captured_at) && (
        <View style={styles.stampBlock}>
          <Text style={styles.stamp}>
            {memory.stamp_label || ''}
            {memory.captured_at
              ? ` · ${new Date(memory.captured_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`
              : ''}
          </Text>
          {memory.is_retro && memory.published_at ? (
            <Text style={styles.stampPublish}>
              Yayın {new Date(memory.published_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </Text>
          ) : null}
        </View>
      )}
      <MemoryActionRow
        upvotes={memory.upvote_count || 0}
        downvotes={memory.downvote_count || memory.downvotes || 0}
        quotes={memory.comment_count || 0}
        echoes={memory.echo_count || 0}
        onUpvote={onUpvote}
        onDownvote={onDownvote}
        onSoz={onSoz}
        onEcho={onEcho}
        style={{ marginTop: 10 }}
      />
      {canDelete ? (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(memory.id)}
        >
          <Text style={styles.deleteButtonText}>Sil</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontWeight: '700', color: '#111' },
  userDetails: { flex: 1 },
  userName: { fontWeight: '700', color: '#111', fontSize: 14 },
  timeAgo: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  rsBadge: {
    minWidth: 36,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignItems: 'center',
  },
  rsText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  content: { color: '#111', fontSize: 15, lineHeight: 22 },
  spotifyCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 10,
  },
  spotifyCardContent: { flexDirection: 'row', alignItems: 'center' },
  coverThumb: { width: 44, height: 44, borderRadius: 6, marginRight: 10 },
  spotifyIcon: { fontSize: 22, marginRight: 10 },
  spotifyCardText: { flex: 1 },
  spotifyCardTitle: { fontWeight: '700', color: '#111', fontSize: 13 },
  spotifyCardSubtitle: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  ritualInfo: { marginTop: 10 },
  ritualTitle: { fontSize: 12, fontWeight: '700', color: '#374151' },
  ritualVenue: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  stampBlock: { marginTop: 8 },
  stamp: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  stampPublish: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  deleteButton: { marginTop: 10, alignSelf: 'flex-start' },
  deleteButtonText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
});
