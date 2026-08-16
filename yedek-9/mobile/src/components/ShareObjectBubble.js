import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SHARE_TYPE_META = {
  memory: { label: 'Ani', icon: 'photo-library' },
  quote: { label: 'Alinti', icon: 'format-quote' },
  photo: { label: 'Fotograf', icon: 'image' },
  forward: { label: 'Ileti', icon: 'forward' },
  quote_challenge: { label: 'Quote Challenge', icon: 'chat-bubble-outline' },
  playlist: { label: 'Playlist', icon: 'queue-music' },
  ritual_send: { label: 'Ritual daveti', icon: 'event' },
  friend_joining: { label: 'Arkadas katiliyor', icon: 'group-add' },
  venue_invite: { label: 'Mekan daveti', icon: 'place' },
  badge: { label: 'Rozet', icon: 'military-tech' },
  passport: { label: 'Passport', icon: 'badge' },
  forum_thread: { label: 'Forum', icon: 'forum' },
  forum_repost: { label: 'Forum repost', icon: 'repeat' },
  reaction_geliyorum: { label: 'Geliyorum', icon: 'directions-walk' },
  reaction_baktim: { label: 'Baktim', icon: 'visibility' },
};

export function getShareTypeMeta(objectType) {
  return SHARE_TYPE_META[objectType] || { label: objectType || 'Paylasim', icon: 'share' };
}

export default function ShareObjectBubble({ item, isMine, onPress, onLongPress }) {
  const meta = getShareTypeMeta(item.object_type);
  const note = String(item.note || '').trim();
  const payloadPreview = item.payload?.title || item.payload?.ritual_title || item.payload?.preview;

  return (
    <TouchableOpacity
      style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={onPress || onLongPress ? 0.8 : 1}
      disabled={!onPress && !onLongPress}
    >
      <View style={styles.typeRow}>
        <MaterialIcons
          name={meta.icon}
          size={16}
          color={isMine ? '#fef3c7' : '#a1a1aa'}
        />
        <Text style={[styles.typeLabel, isMine && styles.typeLabelMine]}>{meta.label}</Text>
      </View>
      {payloadPreview ? (
        <Text style={[styles.previewText, isMine && styles.previewTextMine]} numberOfLines={2}>
          {payloadPreview}
        </Text>
      ) : null}
      {note ? (
        <Text style={[styles.noteText, isMine && styles.noteTextMine]}>{note}</Text>
      ) : null}
      {item.object_id ? (
        <Text style={[styles.objectIdHint, isMine && styles.objectIdHintMine]} numberOfLines={1}>
          #{String(item.object_id).slice(0, 8)}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#b45309',
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  typeLabelMine: {
    color: '#fef3c7',
  },
  previewText: {
    fontSize: 14,
    color: '#e4e4e7',
    marginBottom: 4,
  },
  previewTextMine: {
    color: '#fff',
  },
  noteText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#f4f4f5',
  },
  noteTextMine: {
    color: '#fff',
  },
  objectIdHint: {
    marginTop: 4,
    fontSize: 10,
    color: '#71717a',
  },
  objectIdHintMine: {
    color: 'rgba(255,255,255,0.65)',
  },
});
