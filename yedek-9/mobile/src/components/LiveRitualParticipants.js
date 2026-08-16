import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const COLORS = {
  background: '#080808',
  textPrimary: 'rgba(255,255,255,.75)',
  textTertiary: 'rgba(255,255,255,.35)',
  gold: '#C8A96A',
  green: '#16A34A',
};

function formatJoinedTime(joinedAt) {
  if (!joinedAt) return '';
  const diffMs = Date.now() - new Date(joinedAt).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Simdi katildi';
  if (diffMinutes < 60) return `${diffMinutes} dk once katildi`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa once katildi`;
  return `${Math.floor(diffHours / 24)} gun once katildi`;
}

export default function LiveRitualParticipants({ participants, onParticipantPress, isDark = true }) {
  const renderParticipant = ({ item, index }) => {
    if (item.isPlaceholder) {
      return (
        <View style={styles.peopleHereBox}>
          <View style={[styles.peopleHereAvatar, !isDark && styles.peopleHereAvatarLight]}>
            <Text style={[styles.peopleHereText, !isDark && styles.peopleHereTextLight]}>{participants.length} kisi burada</Text>
          </View>
        </View>
      );
    }

    const friendLevel = item.friend_level || 'FL0';
    const joinedTimeText = formatJoinedTime(item.joined_at);
    const isPending = item.pending_witness || item.checkin_phase === 'pending_witness';
    const isSealed =
      item.checkin_phase === 'sealed' ||
      Boolean(item.checkin_at) ||
      Boolean(item.sealed_at);
    const isOpener = Boolean(item.is_opener);
    // A5: şeritte tek durum — MÜHÜRLÜ=GELDİ (host imtiyazı yok)
    const flLabel = isPending
      ? 'Bekliyor'
      : isOpener
        ? 'Masayi acti'
      : isSealed
        ? 'Geldi'
        : friendLevel === 'FL0'
          ? 'Yabanci'
          : friendLevel;
    const isOnline = !item.left_at && !isPending;

    return (
      <TouchableOpacity
        style={[styles.participantItem, isPending && styles.participantPending]}
        onPress={() => onParticipantPress(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.participantAvatar,
            isOpener && styles.openerRing,
            isPending && styles.pendingAvatar,
            !isDark && styles.participantAvatarLight,
          ]}
        >
          <Text
            style={[
              styles.participantAvatarText,
              isPending && styles.pendingAvatarText,
              !isDark && styles.participantAvatarTextLight,
            ]}
          >
            {item.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
          {!isPending ? (
            <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusAway]} />
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.participantName,
            isPending && styles.pendingName,
            !isDark && styles.participantNameLight,
          ]}
        >
          {item.name || 'Kullanici'}
        </Text>
        <Text
          style={[
            styles.flBadge,
            !isDark && styles.flBadgeLight,
            isOpener && styles.openerBadge,
            isPending && styles.pendingBadge,
          ]}
        >
          {flLabel}
        </Text>
        {!!joinedTimeText && !isPending ? (
          <Text style={[styles.participantJoinedTime, !isDark && styles.participantJoinedTimeLight]}>
            {joinedTimeText}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.participantsSection, !isDark && styles.participantsSectionLight]}>
      <FlatList
        data={[{ id: 'people-here', isPlaceholder: true }, ...participants]}
        renderItem={renderParticipant}
        keyExtractor={(item, index) => index === 0 ? 'people-here' : (item.id || `participant-${index}`)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.participantsList}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  participantsSection: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#080808',
  },
  participantsSectionLight: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  participantsList: {
    paddingRight: 8,
  },
  peopleHereBox: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleHereAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  peopleHereAvatarLight: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  peopleHereText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,.25)',
    textAlign: 'center',
  },
  peopleHereTextLight: {
    color: '#737373',
  },
  participantItem: {
    alignItems: 'center',
    marginRight: 10,
    width: 52,
  },
  participantPending: {
    opacity: 0.45,
  },
  participantJoinedTime: {
    fontSize: 7,
    color: 'rgba(255,255,255,.25)',
    marginTop: 2,
    textAlign: 'center',
  },
  participantJoinedTimeLight: {
    color: '#A3A3A3',
  },
  participantName: {
    marginTop: 4,
    fontSize: 8,
    color: COLORS.textPrimary,
    maxWidth: 52,
    textAlign: 'center',
  },
  pendingName: {
    color: 'rgba(255,255,255,.35)',
  },
  participantNameLight: {
    color: '#A3A3A3',
  },
  flBadge: {
    marginTop: 2,
    fontSize: 7,
    fontWeight: '700',
    color: '#fbbf24',
    backgroundColor: 'rgba(217,119,6,.10)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  flBadgeLight: {
    backgroundColor: '#F5F5F5',
    color: '#737373',
  },
  hostFlBadge: {
    color: COLORS.gold,
    backgroundColor: 'rgba(200,169,106,.15)',
  },
  hostFlBadgeLight: {
    color: '#ffffff',
    backgroundColor: '#1B2E4A',
  },
  openerBadge: {
    color: '#86EFAC',
    backgroundColor: 'rgba(22,163,74,.18)',
  },
  pendingBadge: {
    color: 'rgba(255,255,255,.4)',
    backgroundColor: 'rgba(255,255,255,.06)',
  },
  participantAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,.06)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.08)',
  },
  participantAvatarLight: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
  },
  hostRing: {
    borderColor: COLORS.gold,
  },
  openerRing: {
    borderColor: COLORS.green,
  },
  pendingAvatar: {
    borderColor: 'rgba(255,255,255,.12)',
    backgroundColor: 'rgba(255,255,255,.03)',
  },
  participantAvatarText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,.8)',
  },
  pendingAvatarText: {
    color: 'rgba(255,255,255,.35)',
  },
  participantAvatarTextLight: {
    color: '#737373',
  },
  statusDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#080808',
  },
  statusOnline: {
    backgroundColor: COLORS.green,
  },
  statusAway: {
    backgroundColor: '#D97706',
  },
});
