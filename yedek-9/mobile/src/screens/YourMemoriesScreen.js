import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { fetchUserRecentRituals, fetchMemories } from '../services/api';
import EmptyState from '../components/EmptyState';

const GRAY_BG = '#f5f5f5';
const GRAY_CARD = '#ffffff';
const GRAY_TEXT = '#000000';
const GRAY_TEXT_SEC = '#666666';
const GRAY_TEXT_TERT = '#999999';
const GRAY_BORDER = '#e8e8e8';

export default function YourMemoriesScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMemories = async () => {
    if (!currentUserId) return;
    try {
      const rituals = await fetchUserRecentRituals(currentUserId, 15);
      const memoryPromises = (rituals || []).map((r) =>
        fetchMemories(r.id, 5).catch(() => [])
      );
      const results = await Promise.all(memoryPromises);
      const flattened = results.flat().filter((m) => m.user_id === currentUserId);
      flattened.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setMemories(flattened);
    } catch (error) {
      console.error('Error loading memories:', error);
      setMemories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!currentUserId) {
      navigation.replace('Login');
      return;
    }
    loadMemories();
  }, [currentUserId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMemories();
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Bugun';
    if (diff < 172800000) return 'Dun';
    const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={GRAY_TEXT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={GRAY_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anilarin</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {memories.length === 0 ? (
          <EmptyState
            icon="photo-library"
            title="Henuz ani yok"
            message="Ritualsden anilarin burada gorunecek. Baslamak icin bir Rituale katilip ani paylas."
            actionLabel="City Rhythm'u Kesfet"
            onAction={() => navigation.navigate('CityRhythm')}
          />
        ) : (
          memories.map((memory) => (
            <TouchableOpacity
              key={memory.id}
              style={styles.memoryCard}
              onPress={() =>
                navigation.navigate('MemoryDetail', { memory })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.memoryDate}>
                {formatDate(memory.created_at)}
              </Text>
              {memory.content && (
                <Text style={styles.memoryContent} numberOfLines={3}>
                  {memory.content}
                </Text>
              )}
              {memory.spotify_playlist_url && (
                <TouchableOpacity
                  style={styles.spotifyRow}
                  onPress={() => {
                    try {
                      Linking.openURL(memory.spotify_playlist_url);
                    } catch (_) {}
                  }}
                >
                  <Text style={styles.spotifyEmoji}>🎵</Text>
                  <Text style={styles.spotifyText}>Spotify Calma Listesi</Text>
                  <MaterialIcons name="open-in-new" size={18} color="#1DB954" />
                </TouchableOpacity>
              )}
              <Text style={styles.memoryRitualHint}>Ani detayini acmak icin dokun</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAY_BG,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GRAY_CARD,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_BORDER,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: GRAY_TEXT,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  memoryCard: {
    backgroundColor: GRAY_CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  memoryDate: {
    fontSize: 12,
    color: GRAY_TEXT_TERT,
    marginBottom: 8,
  },
  memoryContent: {
    fontSize: 14,
    color: GRAY_TEXT,
    lineHeight: 20,
    marginBottom: 8,
  },
  spotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 4,
    gap: 8,
  },
  spotifyEmoji: {
    fontSize: 18,
  },
  spotifyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  memoryRitualHint: {
    fontSize: 11,
    color: GRAY_TEXT_TERT,
    marginTop: 8,
  },
});
