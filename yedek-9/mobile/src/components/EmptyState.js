/**
 * Empty state component for when there's no data to display
 * Provides helpful messages and optional actions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PRIMARY_COLOR = '#D4AF37';
const LIGHT_TEXT_PRIMARY = '#000000';
const LIGHT_TEXT_SECONDARY = '#6B7280';
const LIGHT_TEXT_TERTIARY = '#9CA3AF';

export default function EmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <MaterialIcons name={icon} size={64} color={LIGHT_TEXT_TERTIARY} />
      {title && <Text style={styles.title}>{title}</Text>}
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  actionText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});
