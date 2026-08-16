import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function FriendCard({ friend, onPress, onRemove }) {
  const getRSColor = (rs) => {
    if (rs >= 8.0) return '#4CAF50';
    if (rs >= 6.5) return '#2196F3';
    if (rs >= 5.0) return '#FF9800';
    return '#F44336';
  };

  const friendshipBadges = Array.isArray(friend?.friendship_badges) ? friend.friendship_badges : [];

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {friend.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{friend.name}</Text>
          <View style={styles.badgesRow}>
            {friend.friend_level ? <Text style={styles.levelBadge}>FL {friend.friend_level}</Text> : null}
            <Text style={styles.friendshipBadge}>Arkadaslik Rozeti</Text>
            {friendshipBadges.slice(0, 1).map((b) => (
              <Text key={b} style={styles.friendshipBadgeAlt}>{b}</Text>
            ))}
          </View>
          {friend.city && (
            <Text style={styles.city}>{friend.city}</Text>
          )}
          {friend.university && (
            <Text style={styles.university}>{friend.university}</Text>
          )}
        </View>
        <View style={styles.rsContainer}>
          <View
            style={[
              styles.rsBadge,
              { backgroundColor: getRSColor(friend.rs_score) },
            ]}
          >
            <Text style={styles.rsText}>RS {friend.rs_score.toFixed(1)}</Text>
          </View>
        </View>
      </View>
      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(friend.id)}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    color: '#4338ca',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  info: {
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  friendshipBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfeff',
    color: '#155e75',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  friendshipBadgeAlt: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  city: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  university: {
    fontSize: 12,
    color: '#999',
  },
  rsContainer: {
    marginLeft: 12,
  },
  rsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 50,
    alignItems: 'center',
  },
  rsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  removeButton: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
});
