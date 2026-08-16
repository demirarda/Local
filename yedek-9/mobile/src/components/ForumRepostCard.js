import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CARD_BG = '#FFFFFF';
const BORDER_COLOR = '#F3F4F6';
const TEXT_PRIMARY = '#000000';
const TEXT_SECONDARY = '#6B7280';
const ACCENT = '#2563EB';

const formatTimeAgo = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Simdi';
  if (diffMins < 60) return `${diffMins} dk once`;
  if (diffHours < 24) return `${diffHours} sa once`;
  return `${Math.floor(diffHours / 24)} gun once`;
};

export default function ForumRepostCard({ repost, onPress, fullWidth = true }) {
  const snippet = String(repost.snippet || repost.comment_content || repost.memory_content || '').trim();
  const previewUri = repost.preview_image || repost.memory_photo_url || repost.memory_image_url;

  return (
    <TouchableOpacity
      style={[styles.container, fullWidth && styles.containerFull]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={styles.repostTag}>
          <MaterialIcons name="forum" size={12} color="#fff" />
          <Text style={styles.repostTagText}>FORUM REPOST</Text>
        </View>
        <Text style={styles.metaText} numberOfLines={1}>
          {repost.user_name || 'Kullanici'} · {formatTimeAgo(repost.created_at)}
        </Text>
      </View>

      <Text style={styles.ritualTitle} numberOfLines={1}>
        {repost.ritual_title || 'Ritual'}
      </Text>
      {repost.venue_name ? (
        <Text style={styles.venueText} numberOfLines={1}>{repost.venue_name}</Text>
      ) : null}

      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="cover" />
      ) : null}

      {snippet ? (
        <Text style={styles.snippetText} numberOfLines={previewUri ? 2 : 3}>
          {snippet}
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerCta}>Foruma git</Text>
        <MaterialIcons name="chevron-right" size={18} color={ACCENT} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  containerFull: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  repostTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  repostTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  ritualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  venueText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f3f4f6',
  },
  snippetText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  footerCta: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
});
