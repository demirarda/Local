import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const PRIMARY_GOLD = '#d4af37';
const BACKGROUND = 'rgba(15, 23, 42, 0.96)';

export default function FriendAcceptedToast({
  visible,
  friendName,
  ritualTitle,
  onViewProfile,
  onDismiss,
}) {
  if (!visible) return null;

  const initial = (friendName || '?').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Avatar + badge */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <View style={styles.rsBadge}>
            <Text style={styles.rsBadgeText}>★</Text>
          </View>
        </View>

        {/* Text content */}
        <View style={styles.textColumn}>
          <Text style={styles.title}>You're now friends!</Text>
          {!!ritualTitle && (
            <Text style={styles.subtitle}>From {ritualTitle}</Text>
          )}
          <Text style={styles.body}>
            You can now give each other feedback.
          </Text>
        </View>

        {/* Dismiss button */}
        <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryAction} onPress={onViewProfile}>
          <Text style={styles.primaryActionText}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={onDismiss}>
          <Text style={styles.secondaryActionText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: BACKGROUND,
    borderWidth: 1,
    borderColor: PRIMARY_GOLD,
    shadowColor: PRIMARY_GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  avatarWrapper: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: PRIMARY_GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
  },
  rsBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY_GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  textColumn: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  subtitle: {
    fontSize: 13,
    color: '#e5e7eb',
    marginTop: 2,
  },
  body: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    marginLeft: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#e5e7eb',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  primaryAction: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY_GOLD,
    alignItems: 'center',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  secondaryAction: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e7eb',
  },
});

