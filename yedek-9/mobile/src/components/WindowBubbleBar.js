import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchWindowBubbles } from '../services/api';
import { t } from '../i18n/stringTable';

const PRIMARY = '#f9a13d';

function formatRemaining(endAt) {
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return '0dk';
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins}dk`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}s ${m}dk` : `${h}s`;
}

export default function WindowBubbleBar({ navigation, style }) {
  const [bubbles, setBubbles] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchWindowBubbles();
      setBubbles(Array.isArray(data) ? data : []);
    } catch (_e) {
      setBubbles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, 60000);
      return () => clearInterval(id);
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.wrap, style]}>
        <ActivityIndicator size="small" color={PRIMARY} />
      </View>
    );
  }

  if (!bubbles.length) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>{t('active_windows')} ({bubbles.length}/10)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {bubbles.map((bubble) => (
          <TouchableOpacity
            key={bubble.id}
            style={styles.bubble}
            activeOpacity={0.85}
            onPress={() => navigation?.navigate?.('RitualDetail', { ritualId: bubble.id })}
          >
            <MaterialIcons name="bubble-chart" size={14} color={PRIMARY} />
            <Text style={styles.title} numberOfLines={1}>
              {bubble.title || 'Ritual'}
            </Text>
            <Text style={styles.timer}>{formatRemaining(bubble.window_end_at)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#71717a',
    marginBottom: 8,
  },
  row: {
    gap: 8,
    paddingRight: 16,
  },
  bubble: {
    minWidth: 120,
    maxWidth: 160,
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  title: {
    color: '#f4f4f5',
    fontSize: 13,
    fontWeight: '600',
  },
  timer: {
    color: PRIMARY,
    fontSize: 11,
    fontWeight: '700',
  },
});
