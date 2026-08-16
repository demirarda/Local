import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { colors, fonts, radii, spacing } from '../theme';
import { buildPulseLayout, layoutMeta } from '../utils/pulseLayoutEngine';
import {
  HeroMemoryCard,
  SquareMemoryCard,
  QuoteCard,
  MiniQuoteCard,
  EventCard,
  PolaroidCard,
  LiveChipCard,
  SpotifyTrackCard,
  SpotifyPlaylistCard,
  NowPlayingCard,
  VoiceMemoCard,
  AudioStoryCard,
  VenueAmbianceCard,
  GroupVoiceCard,
} from '../components/PulseCards';

/**
 * Filter tabs (mevcut CORE_FILTERS + yeni Müzik/Ses)
 */
const FILTERS = [
  'Tümü',
  'Yer Var',
  'Yakınımda',
  'Arkadaşlar',
  'Müzik',
  'Ses',
  'Takip Edilenler',
  'Özel Etkinlikler',
  'Doğrulanmışlar',
  'Tekrarlanan',
  "LOCAL'de Yeni",
];

/**
 * Card renderer map - type'a göre doğru component'i seçer
 */
const CARD_COMPONENTS = {
  hero: HeroMemoryCard,
  square: SquareMemoryCard,
  quote: QuoteCard,
  miniQuote: MiniQuoteCard,
  event: EventCard,
  polaroid: PolaroidCard,
  live: LiveChipCard,
  spotifyTrack: SpotifyTrackCard,
  spotifyPlaylist: SpotifyPlaylistCard,
  nowPlaying: NowPlayingCard,
  voiceMemo: VoiceMemoCard,
  audioStory: AudioStoryCard,
  venueAmbiance: VenueAmbianceCard,
  groupVoice: GroupVoiceCard,
};

/**
 * Layout tipine göre row container style'ı
 */
function getRowStyle(layout) {
  if (layoutMeta.isFullWidth(layout)) return styles.rowFull;
  if (layoutMeta.isDual(layout)) return styles.rowDual;
  if (layout === 'asym-left-mix' || layout === 'asym-spotify-playlist' || layout === 'asym-audio-mix') {
    return styles.rowAsymLeft;
  }
  if (layout === 'asym-right-mix') return styles.rowAsymRight;
  if (layoutMeta.isTriple(layout)) return styles.rowTriple;
  return styles.rowFull;
}

/**
 * Row renderer
 */
function PulseRow({ row, handlers }) {
  const rowStyle = getRowStyle(row.layout);
  const isTriple = layoutMeta.isTriple(row.layout);

  return (
    <View style={[styles.rowBase, rowStyle]}>
      {row.items.map((itemWrapper, i) => {
        const { item, type } = itemWrapper;
        const Component = CARD_COMPONENTS[type];
        if (!Component) return null;

        // Triple grid'de square'lere özel prop
        const extraProps = {};
        if (type === 'square' && isTriple) {
          extraProps.triple = true;
        }
        // Event'lerde compact versiyon (dual/asym içinde)
        if (type === 'event' && !row.layout.startsWith('full-')) {
          extraProps.compact = true;
        }

        return (
          <Component
            key={item.id || i}
            data={item}
            {...extraProps}
            {...handlers}
          />
        );
      })}
    </View>
  );
}

/**
 * Ana Pulse ekranı
 */
export default function PulseScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [freshCount, setFreshCount] = useState(0);

  const freshPillAnim = useRef(new Animated.Value(0)).current;

  // ========================================
  // DATA FETCHING - Backend integration
  // ========================================
  const fetchPulseFeed = useCallback(async (opts = {}) => {
    const { refresh = false, filter = activeFilter } = opts;

    try {
      // TODO: backend endpoint
      // const response = await api.get('/pulse/feed', {
      //   params: { filter, limit: 30, offset: refresh ? 0 : items.length }
      // });
      // const newItems = response.data.items;

      // Placeholder for now - replace with real API
      const newItems = await mockFetchFeed(filter);

      const finalItems = refresh ? newItems : [...items, ...newItems];
      setItems(finalItems);

      // Layout engine ile bento row'lara dönüştür
      const newRows = buildPulseLayout(finalItems, { maxRows: 30 });
      setRows(newRows);

      setHasMore(newItems.length >= 20);
    } catch (error) {
      console.error('Pulse fetch failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeFilter, items]);

  // İlk yükleme
  useEffect(() => {
    setLoading(true);
    fetchPulseFeed({ refresh: true });
  }, []);

  // Filter değişimi
  useEffect(() => {
    if (!loading) {
      setLoading(true);
      setItems([]);
      fetchPulseFeed({ refresh: true, filter: activeFilter });
    }
  }, [activeFilter]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setFreshCount(0);
    hideFreshPill();
    fetchPulseFeed({ refresh: true });
  }, [fetchPulseFeed]);

  // Infinite scroll
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    fetchPulseFeed({ refresh: false });
  }, [loadingMore, hasMore, loading, fetchPulseFeed]);

  // ========================================
  // WEBSOCKET - fresh content indicator
  // ========================================
  useEffect(() => {
    // TODO: WebSocket entegrasyonu
    // const ws = websocketService.subscribe('pulse:new_items', (data) => {
    //   setFreshCount(prev => prev + data.count);
    //   showFreshPill();
    // });
    // return () => ws.unsubscribe();

    // Demo amaçlı: 15 saniye sonra sahte yeni içerik bildirimi
    const timer = setTimeout(() => {
      setFreshCount(8);
      showFreshPill();
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const showFreshPill = () => {
    Animated.spring(freshPillAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  };

  const hideFreshPill = () => {
    Animated.timing(freshPillAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // ========================================
  // CARD EVENT HANDLERS
  // ========================================
  const handlers = useMemo(() => ({
    onPress: (item) => {
      // Detay sayfasına git
      if (item.type === 'event' || item.eventId) {
        navigation?.navigate('EventDetail', { id: item.id });
      } else if (item.type === 'live') {
        navigation?.navigate('LiveRitual', { id: item.id });
      } else {
        navigation?.navigate('MemoryDetail', { id: item.id });
      }
    },
    onDismiss: async (item) => {
      // Backend'e feedback gönder
      // await api.post('/pulse/feedback', { memory_id: item.id, action: 'not_interested' });
      setItems(prev => prev.filter(i => i.id !== item.id));
    },
    onJoin: (item) => {
      // Ritüel/event'e katılma
      navigation?.navigate('EventJoin', { id: item.id });
    },
    onPlay: (item, isPlaying) => {
      // Spotify/Audio oynatma
      // Backend: audioService.play(item.audioUrl) veya spotifyService.play(item.trackId)
      console.log('Play:', item.id, 'playing:', isPlaying);
    },
    onListen: (item) => {
      // Venue ambiance stream başlat
      navigation?.navigate('AmbianceListener', { id: item.id });
    },
  }), [navigation]);

  // ========================================
  // RENDER
  // ========================================
  if (loading && rows.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* === HEADER === */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Create Ritual pill */}
          <TouchableOpacity
            style={styles.createPill}
            onPress={() => navigation?.navigate('CreateRitual')}
          >
            <Icon name="plus" size={13} color="#fff" />
            <Text style={styles.createPillText}>Ritüel Oluştur</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.headerLogo}>
            <View style={styles.headerLogoRow}>
              <Text style={styles.headerTitle}>Pulse</Text>
              <View style={styles.headerTitleDot} />
            </View>
            <Text style={styles.headerCity}>MILANO</Text>
          </View>

          {/* Bell + More */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={() => navigation?.navigate('Notifications')}
            >
              <Icon name="bell" size={16} color={colors.text500} />
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle}>
              <Text style={styles.moreDots}>···</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* === FRESH PILL === */}
      {freshCount > 0 && (
        <Animated.View
          style={[
            styles.freshPillWrap,
            {
              opacity: freshPillAnim,
              transform: [
                {
                  translateY: freshPillAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={styles.freshPill} onPress={handleRefresh}>
            <Icon name="chevrons-up" size={11} color="#fff" />
            <Text style={styles.freshPillText}>{freshCount} yeni anı</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* === FEED === */}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item: row }) => <PulseRow row={row} handlers={handlers} />}
        contentContainerStyle={styles.feed}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.navy} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={colors.text500} />
              <Text style={styles.loadMoreText}>Daha fazla yükleniyor...</Text>
            </View>
          ) : null
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={6}
      />
    </SafeAreaView>
  );
}

// ========================================
// MOCK DATA (replace with real API)
// ========================================
async function mockFetchFeed(filter) {
  await new Promise(r => setTimeout(r, 300));

  return [
    {
      id: 'm1', type: 'hero',
      image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=900',
      caption: "Navigli'de güneşin batışı",
      author: 'Elena M.', authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
      meta: 'Terrazza Aperol · 45 dk', verified: true,
      note: '"Bugün 12 kişiydik. Kimse telefona bakmadı."',
      reactions: { hearts: 42, fire: 142 },
      ranking: { type: 'follow', label: 'Takip ettiğin host' },
    },
    {
      id: 'm2', type: 'square',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      title: 'Book Discussion', meta: 'Caffè · dün',
      author: 'Chiara V.', authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      reactions: '28', ranking: { type: 'similar', label: 'Benzer' },
    },
    {
      id: 'm3', type: 'square',
      image: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=600',
      title: 'Evening Tales', meta: 'Navigli · 2 sa',
      author: 'Giulia T.', authorAvatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100',
      reactions: '🔥 64', ranking: { type: 'friend', label: 'Arkadaşın' },
    },
    {
      id: 'spt1', type: 'spotifyTrack',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
      title: 'Blue in Green', artist: 'Miles Davis · Kind of Blue',
      sharedBy: 'Elena M.',
      sharedAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      sharedContext: 'Jazz Night sonrası',
      progress: 32, currentTime: '1:48', totalTime: '5:37',
      rankingText: 'takip ettiğin host paylaştı',
    },
    {
      id: 'vm1', type: 'voiceMemo',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      name: 'Luca F.', meta: 'Coffee · 1 sa', duration: '0:42',
      ranking: { type: 'nearby', label: 'Brera' },
    },
    {
      id: 'mq1', type: 'miniQuote',
      text: '"Kahveden önce insan, kahveden sonra şair oluyoruz."',
      author: 'Alessandro',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
      ranking: { type: 'trending', label: 'Trend' },
    },
    {
      id: 'e1', type: 'event',
      bg: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800',
      title: 'Jazz Night · Blue Note', meta: '20:30 · Navigli',
      social: '8 arkadaş',
      avatars: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
      ],
      star: true, ranking: { type: 'trending', label: 'Popüler' },
    },
    {
      id: 'spp1', type: 'spotifyPlaylist',
      covers: [
        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
      ],
      title: 'Jazz & Vinyl Sunset', source: 'Caffè Letterario',
      trackCount: 18, ritual: 'Jazz Night',
    },
    {
      id: 'as1', type: 'audioStory',
      cover: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400',
      title: "Navigli'de bir akşam: Elena'nın hikayesi",
      author: 'Elena M.', authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80',
      preview: '"Bu ritüeli neden başlattığımı hiç anlatmamıştım..."',
      duration: '3:42', progress: 0, currentTime: '0:00',
    },
    {
      id: 'va1', type: 'venueAmbiance',
      thumb: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400',
      venue: 'Caffè Letterario',
      description: 'Vinil çalar, sohbetler, bardak sesleri',
      listeners: 12,
      listenerAvatars: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60',
      ],
    },
    {
      id: 'gv1', type: 'groupVoice',
      title: 'Birlikte "Bella Ciao"', caption: 'gece 23:47, herkes söyledi',
      ritual: 'Dinner Circle', duration: '0:54', participants: 9,
      avatars: [
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80',
      ],
    },
    {
      id: 'np1', type: 'nowPlaying',
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
      title: 'So What', artist: 'Miles Davis',
      sourceName: 'Caffè Letterario',
      sourceAvatar: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=100',
      sourceLabel: 'şu an burada çalıyor',
    },
    {
      id: 'q1', type: 'quote',
      text: "Her perşembe 19:00'da Navigli'de buluşuyoruz. Kimse yalnız yürümesin.",
      author: 'Sofia B.', authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      sub: 'Host · 2 sa', reactions: '112',
      ranking: { type: 'follow', label: 'Takip ettiğin host' },
    },
    {
      id: 'p1', type: 'polaroid',
      image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
      caption: '"pazar sabahı" ☕',
      author: 'Matteo', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80',
      meta: '2 sa', ranking: { label: 'Matteo' },
    },
    {
      id: 'l1', type: 'live',
      image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=200',
      title: 'Brunch Circle', meta: 'Brera', seats: '6 yer kaldı',
      rankingText: '2 arkadaş içeride',
    },
  ];
}

// ========================================
// STYLES
// ========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.screen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    zIndex: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  createPill: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.black,
    paddingHorizontal: 11,
    paddingVertical: 6,
    paddingLeft: 8,
    borderRadius: radii.pill,
  },
  createPillText: {
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: '#fff',
  },
  headerLogo: {
    alignItems: 'center',
    flex: 1,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  headerTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 28,
    fontWeight: '500',
    color: colors.black,
    lineHeight: 28,
    letterSpacing: -0.8,
  },
  headerTitleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.black,
    marginBottom: 5,
  },
  headerCity: {
    fontSize: 10,
    color: colors.text400,
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D9D9D9',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.screen,
    position: 'relative',
  },
  moreDots: {
    fontSize: 13,
    color: colors.text500,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    marginTop: -4,
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.screen,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.body,
  },
  filterChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    color: colors.text500,
  },
  filterChipTextActive: {
    color: '#fff',
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  freshPillWrap: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  freshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  freshPillText: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  feed: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 14,
  },
  rowBase: {},
  rowFull: {},
  rowDual: {
    flexDirection: 'row',
    gap: 10,
  },
  rowAsymLeft: {
    flexDirection: 'row',
    gap: 10,
  },
  rowAsymRight: {
    flexDirection: 'row',
    gap: 10,
  },
  rowTriple: {
    flexDirection: 'row',
    gap: 8,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadMoreText: {
    color: colors.text400,
    fontSize: 12,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },
});
