import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { colors, fonts, radii } from '../theme';
import { enrichWithAvailability, totalLiveStats } from '../utils/eventAvailability';
import { buildFeedLayout, ROW_LAYOUTS } from '../utils/specialEventsLayout';

import {
  SpecialEventsContext,
  HeroCard,
  FullCard,
  HalfTallCard,
  SquareCard,
  PosterCard,
  WideShortCard,
  MicroCard,
} from '../components/SpecialEventsCards';

/**
 * SpecialEventsView — "Özel Etkinlikler" filtresi.
 *
 * Random bento layout, 7 farklı kart tipi, WebSocket ile live viewer count
 * güncellenmesi, infinite scroll, waitlist state, trending/limited signal'ler.
 *
 * @param {function} fetchSpecialEvents - async ({ offset, limit }) → { items, hasMore }
 * @param {function} subscribeLiveStats - (itemIds, callback) → unsubscribe fn
 *   callback: (updates: { [itemId]: { currentViewers, taken, waitlist } }) => void
 * @param {function} onBack
 * @param {function} navigation
 * @param {number} pageSize - default 15
 */
export default function SpecialEventsView({
  fetchSpecialEvents,
  subscribeLiveStats,
  initialItems = [],
  onBack,
  navigation,
  pageSize = 15,
}) {
  const [items, setItems] = useState(initialItems);
  const [liveOverrides, setLiveOverrides] = useState({}); // { itemId: { currentViewers, taken, waitlist } }
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [layoutSeed, setLayoutSeed] = useState(0); // pull-to-refresh'te yeniden shuffle

  const unsubscribeRef = useRef(null);

  // === Initial load ===
  useEffect(() => {
    if (fetchSpecialEvents && items.length === 0) {
      loadData({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === WebSocket live stats subscription ===
  useEffect(() => {
    if (!subscribeLiveStats || items.length === 0) return;

    const ids = items.map((i) => i.id);
    const unsub = subscribeLiveStats(ids, (updates) => {
      setLiveOverrides((prev) => ({ ...prev, ...updates }));
    });

    unsubscribeRef.current = unsub;
    return () => {
      if (unsub) unsub();
    };
  }, [items, subscribeLiveStats]);

  const loadData = useCallback(
    async ({ reset = false } = {}) => {
      if (!fetchSpecialEvents) return;
      if (!reset && (loadingMore || !hasMore)) return;

      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const offset = reset ? 0 : items.length;
        const result = await fetchSpecialEvents({ offset, limit: pageSize });

        const newItems = Array.isArray(result) ? result : result?.items || [];
        const moreAvailable = Array.isArray(result)
          ? newItems.length >= pageSize
          : result?.hasMore ?? newItems.length >= pageSize;

        setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(moreAvailable);

        if (reset) {
          setLayoutSeed((s) => s + 1); // yeniden shuffle
          setLiveOverrides({}); // reset live data
        }
      } catch (e) {
        console.error('Special events fetch failed:', e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [fetchSpecialEvents, pageSize, items.length, loadingMore, hasMore]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    loadData({ reset: true });
  };

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    loadData({ reset: false });
  }, [loadingMore, hasMore, loading, loadData]);

  // === Merge items + live overrides ===
  const mergedItems = useMemo(() => {
    return items.map((item) => {
      const override = liveOverrides[item.id];
      if (!override) return item;
      return {
        ...item,
        liveStats: {
          ...item.liveStats,
          currentViewers: override.currentViewers ?? item.liveStats?.currentViewers,
          viewsLastHour: override.viewsLastHour ?? item.liveStats?.viewsLastHour,
          bookingsLastHour: override.bookingsLastHour ?? item.liveStats?.bookingsLastHour,
        },
        availability: {
          ...item.availability,
          taken: override.taken ?? item.availability?.taken,
          waitlist: override.waitlist ?? item.availability?.waitlist,
        },
      };
    });
  }, [items, liveOverrides]);

  // === Enrichment ===
  const enriched = useMemo(() => enrichWithAvailability(mergedItems), [mergedItems]);

  // === Live aggregate stats (context strip) ===
  const { totalViewers } = useMemo(() => totalLiveStats(enriched), [enriched]);

  // === Random layout ===
  const feedRows = useMemo(
    () => buildFeedLayout(enriched),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enriched, layoutSeed] // layoutSeed değişince yeniden shuffle
  );

  // === Card event handlers ===
  const handlers = useMemo(
    () => ({
      onPress: (item) => navigation?.navigate('EventDetail', { id: item.id }),
      onRSVP: (item) => navigation?.navigate('RSVPFlow', { id: item.id }),
      onJoinWaitlist: (item) => navigation?.navigate('WaitlistJoin', { id: item.id }),
      onCTA: (item) => {
        // MicroCard, HalfTallCard'dan gelen generic CTA
        const computed = item._computed || {};
        if (computed.availState === 'waitlist-only') {
          navigation?.navigate('WaitlistJoin', { id: item.id });
        } else {
          navigation?.navigate('RSVPFlow', { id: item.id });
        }
      },
    }),
    [navigation]
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Özel etkinlikler hazırlanıyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header onBack={onBack} />

      <FlatList
        data={feedRows}
        keyExtractor={(row, idx) => {
          const firstId = row.items[0]?.id ?? '';
          return `${row.layout}_${firstId}_${idx}`;
        }}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            <RowRenderer row={row} handlers={handlers} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        windowSize={10}
        initialNumToRender={6}
        ListHeaderComponent={
          <SpecialEventsContext totalCount={items.length} totalViewers={totalViewers} />
        }
        ListFooterComponent={
          <>
            {loadingMore && (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={colors.text500} />
                <Text style={styles.loadMoreText}>Daha fazla yükleniyor...</Text>
              </View>
            )}
            {!hasMore && feedRows.length > 0 && (
              <View style={styles.endOfFeed}>
                <Text style={styles.endOfFeedText}>
                  bu ay için hepsi bu kadar
                </Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={!loading ? <EmptyState /> : null}
      />
    </SafeAreaView>
  );
}

// ============================================
// HEADER
// ============================================
function Header({ onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="chevron-left" size={14} color={colors.text700} strokeWidth={2.5} />
        <Text style={styles.backText}>Pulse</Text>
      </TouchableOpacity>

      <View style={styles.headerLogo}>
        <View style={styles.headerLogoRow}>
          <Text style={styles.headerTitle}>Özel Etkinlikler</Text>
          <View style={styles.headerDot} />
        </View>
        <Text style={styles.headerSubtitle}>KÜRATE EDİLMİŞ · MILANO</Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconCircle}>
          <Icon name="search" size={16} color={colors.text500} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// ROW RENDERER — her row layout'ını uygun kart(lar)la render eder
// ============================================
function RowRenderer({ row, handlers }) {
  const { layout, items } = row;

  switch (layout) {
    case ROW_LAYOUTS.HERO:
      return <HeroCard data={items[0]} onPress={handlers.onPress} />;

    case ROW_LAYOUTS.FULL:
      return (
        <FullCard
          data={items[0]}
          onPress={handlers.onPress}
          onRSVP={handlers.onRSVP}
          onJoinWaitlist={handlers.onJoinWaitlist}
        />
      );

    case ROW_LAYOUTS.WIDE_SHORT:
      return (
        <WideShortCard
          data={items[0]}
          onPress={handlers.onPress}
          onCTA={handlers.onCTA}
        />
      );

    case ROW_LAYOUTS.DUAL_HALF_TALL:
      return (
        <View style={styles.rowDual}>
          <HalfTallCard
            data={items[0]}
            onPress={handlers.onPress}
            onCTA={handlers.onCTA}
          />
          <HalfTallCard
            data={items[1]}
            onPress={handlers.onPress}
            onCTA={handlers.onCTA}
          />
        </View>
      );

    case ROW_LAYOUTS.DUAL_SQUARE:
      return (
        <View style={styles.rowDual}>
          <SquareCard data={items[0]} onPress={handlers.onPress} />
          <SquareCard data={items[1]} onPress={handlers.onPress} />
        </View>
      );

    case ROW_LAYOUTS.DUAL_MICRO:
      return (
        <View style={styles.rowDual}>
          <MicroCard data={items[0]} onPress={handlers.onPress} />
          <MicroCard data={items[1]} onPress={handlers.onPress} />
        </View>
      );

    case ROW_LAYOUTS.ASYM_MICRO_TALL:
      return (
        <View style={styles.rowAsymLeft}>
          <MicroCard data={items[0]} onPress={handlers.onPress} />
          <HalfTallCard
            data={items[1]}
            onPress={handlers.onPress}
            onCTA={handlers.onCTA}
          />
        </View>
      );

    case ROW_LAYOUTS.ASYM_TALL_MICRO:
      return (
        <View style={styles.rowAsymRight}>
          <HalfTallCard
            data={items[0]}
            onPress={handlers.onPress}
            onCTA={handlers.onCTA}
          />
          <MicroCard data={items[1]} onPress={handlers.onPress} />
        </View>
      );

    case ROW_LAYOUTS.ASYM_SQUARE_TALL:
      return (
        <View style={styles.rowAsymLeft}>
          <SquareCard data={items[0]} onPress={handlers.onPress} />
          <HalfTallCard
            data={items[1]}
            onPress={handlers.onPress}
            onCTA={handlers.onCTA}
          />
        </View>
      );

    case ROW_LAYOUTS.TRIPLE_POSTER:
      return (
        <View style={styles.rowTriple}>
          <PosterCard data={items[0]} onPress={handlers.onPress} />
          <PosterCard data={items[1]} onPress={handlers.onPress} />
          <PosterCard data={items[2]} onPress={handlers.onPress} />
        </View>
      );

    default:
      return null;
  }
}

// ============================================
// EMPTY
// ============================================
function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="star" size={28} color={colors.gold} />
      </View>
      <Text style={styles.emptyTitle}>Şu an özel etkinlik yok</Text>
      <Text style={styles.emptyText}>
        LOCAL ekibi yakında yeni koleksiyonlar hazırlayacak.{'\n'}
        Bildirimleri aç ki kaçırma.
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================
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
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: colors.text400,
    fontFamily: fonts.sansMedium,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.screen,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingLeft: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  backText: {
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
    color: colors.text700,
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
    fontSize: 22,
    fontWeight: '500',
    color: colors.black,
    lineHeight: 22,
    letterSpacing: -0.6,
  },
  headerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: colors.text400,
    letterSpacing: 1,
    marginTop: 2,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
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
  },

  // Feed
  feedContent: {
    paddingTop: 14,
    paddingBottom: 120,
  },
  rowWrap: {
    paddingHorizontal: 16,
  },
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

  // Load more
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
  endOfFeed: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  endOfFeedText: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text400,
    letterSpacing: 0.3,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 20,
    color: colors.text900,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text500,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
});
