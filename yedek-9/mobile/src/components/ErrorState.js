/**
 * Error state component for when something goes wrong
 * Provides error message and retry functionality
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PRIMARY_COLOR = '#D4AF37';
const LIGHT_TEXT_PRIMARY = '#000000';
const LIGHT_TEXT_SECONDARY = '#6B7280';
const ERROR_COLOR = '#EF4444';

export default function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn\'t load this content. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  style,
}) {
  return (
    <View style={[styles.container, style]}>
      <MaterialIcons name="error-outline" size={64} color={ERROR_COLOR} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <MaterialIcons name="refresh" size={20} color="#000000" style={styles.retryIcon} />
          <Text style={styles.retryText}>{retryLabel}</Text>
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});
