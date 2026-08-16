import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';

// loading.html ile aynı karşılama arayüzü: L. / Local + spinner, #FAF9F6 arka plan
const DEFAULT_DURATION_MS = 2500;

export default function WelcomeScreen({ onFinish, durationMs = DEFAULT_DURATION_MS }) {
  useEffect(() => {
    const t = setTimeout(() => {
      onFinish?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [onFinish, durationMs]);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={1}
      onPress={onFinish}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>L.</Text>
        <Text style={styles.brand}>Local</Text>
        <Text style={styles.tagline}>No followers, no likes. Just real rituals.</Text>
        <ActivityIndicator size="small" color="#000000" style={styles.spinner} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 32,
  },
  logo: {
    fontSize: 112,
    fontWeight: '800',
    letterSpacing: -0.02 * 16,
    color: '#000000',
    marginBottom: 4,
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(0, 0, 0, 0.75)',
    marginBottom: 16,
    minHeight: 16,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 40,
  },
  spinner: {
    marginTop: 0,
  },
});
