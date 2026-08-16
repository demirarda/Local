import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import {
  enrichWithSignals,
  sortForFeed,
} from '../utils/followSignal';

import {
  FollowingContext,
  HostRitualCard,
  VenueLiveCard,
  CreatorPulseCard,
  HostVoiceCard,
  HostMemoryCard,
} from '../components/FollowingCards';

/**
 * FollowingView — "Takip Edilenler" filtresi seçildiğinde render edilen ekran.
 *
 * Item shape (backend):
 *   {
 *     id,
 *     type,                    // 'host-ritual' | 'venue-live' | 'creator-pulse'
 *                              // | 'host-voice' | 'host-memory'
 *     postedAt,                // Date string
 *     entity: {
 *       id, name, avatar, verified,
 *       kind,                  // 'host' | 'venue' | 'creator' | 'partner'
 *       followedSince,         // Date
 *       isActive,              // true → venue live veya host in ritual
 *       avgPostsPerWeek,       // regular signal için
 *       ...
 *     },
 *     ...type-specific fields
 *   }
 *
 * @param {object[]} initialItems
 * @param {function} fetchFollowing - async ({ offset, limit }) => { items, hasMore }
 *   Backward-compat: eski API da destekleniyor — async () => items[]
 * @param {function} onBack
 * @param {function} navigation
 * @param {number} pageSize - Sayfa başına item sayısı (default: 20)
 */
export default function FollowingView({
  initialItems = [],
  fetchFollowing,
  onBack,
  navigation,
  pageSize = 20,
}) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // === Data fetching ===
  useEffect(() => {
    // İlk yükleme
    if (fetchFollowing && items.length === 0) {
      loadData({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Unified fetch — hem ilk yükleme hem load-more için kullanılır.
   * Backend'in yeni API'si: fetchFollowing({ offset, limit }) → { items, hasMore }
   * Eski API backward-compat: fetchFollowing() → items[]
   */
  const loadData = useCallback(
    async ({ reset = false } = {}) => {
      if (!fetchFollowing) return;
      if (!reset && (loadingMore || !hasMore)) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const offset = reset ? 0 : items.length;
        const result = await fetchFollowing({
          offset,
          limit: pageSize,
        });

        // Backward-compat: eğer array döndüyse, hasMore heuristic
        const newItems = Array.isArray(result) ? result : result?.items || [];
        const moreAvailable = Array.isArray(result)
          ? newItems.length >= pageSize
          : result?.hasMore ?? newItems.length >= pageSize;

        setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
        setHasMore(moreAvailable);
      } catch (e) {
        console.error('Following fetch failed:', e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [fetchFollowing, pageSize, items.length, loadingMore, hasMore]
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

  // === Enrichment + sorting ===
  const enrichedItems = useMemo(() => enrichWithSignals(items), [items]);
  const sortedItems = useMemo(() => sortForFeed(enrichedItems), [enrichedItems]);

  // === Stats ===
  const totalCount = useMemo(() => {
    const ids = new Set(enrichedItems.map((i) => i.entity?.id).filter(Boolean));
    return ids.size;
  }, [enrichedItems]);

  const activeCount = useMemo(
    () => enrichedItems.filter((i) => i.entity?.isActive).length,
    [enrichedItems]
  );

  // === Handlers ===
  const handlers = useMemo(
    () => ({
      onPress: (item) => {
        const entityKind = item.entity?.kind;
        if (item.type === 'host-ritual') {
          navigation?.navigate('RitualDetail', { id: item.id });
        } else if (entityKind === 'venue') {
          navigation?.navigate('VenueDetail', { id: item.entity.id });
        } else {
          navigation?.navigate('HostProfile', { id: item.entity?.id });
        }
      },
      onReserve: (item) => navigation?.navigate('ReserveRitual', { id: item.id }),
      onListen: (item) =>
        navigation?.navigate('VenueAmbiance', { id: item.entity?.id }),
      onViewRituals: (item) =>
        navigation?.navigate('HostRituals', { id: item.entity?.id }),
    }),
    [navigation]
  );

  // Feed için row'ları hazırla (dual memory grupları için)
  const feedRows = useMemo(() => buildRows(sortedItems), [sortedItems]);

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.purple} />
        <Text style={styles.loadingText}>Takip ettiklerin yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header totalCount={totalCount} onBack={onBack} />

      <FlatList
        data={feedRows}
        keyExtractor={(row, idx) => row.items[0]?.id ?? `row_${idx}`}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            <RowRenderer row={row} handlers={handlers} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.purple} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        windowSize={10}
        initialNumToRender={6}
        ListHeaderComponent={
          <>
            <FollowingContext totalCount={totalCount} activeCount={activeCount} />
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>son 24 saatte</Text>
              <Text style={styles.sectionCount}>
                {sortedItems.length} YENİ · KARIŞIK
              </Text>
            </View>
          </>
        }
        ListFooterComponent={
          <>
            {loadingMore && (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={colors.text500} />
                <Text style={styles.loadMoreText}>Daha fazla yükleniyor...</Text>
              </View>
            )}
            {!hasMore && sortedItems.length > 0 && (
              <View style={styles.endOfFeed}>
                <Text style={styles.endOfFeedText}>hepsi bu kadar</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? <EmptyState /> : null
        }
      />
    </SafeAreaView>
  );
}

// ============================================
// HEADER
// ============================================
function Header({ totalCount, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="chevron-left" size={14} color={colors.text700} strokeWidth={2.5} />
        <Text style={styles.backText}>Pulse</Text>
      </TouchableOpacity>

      <View style={styles.headerLogo}>
        <View style={styles.headerLogoRow}>
          <Text style={styles.headerTitle}>Takip Ettiklerin</Text>
          <View style={styles.headerDot} />
        </View>
        <Text style={styles.headerSubtitle}>
          {totalCount} TAKİP · MILANO
        </Text>
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
// ROW RENDERER (FlatList item)
// ============================================
/**
 * Bir feed row'u render eder.
 *
 * Row types:
 *   - 'dual-memory' → iki kare memory yan yana
 *   - 'single'      → tek full-width kart
 */
function RowRenderer({ row, handlers }) {
  if (row.type === 'dual-memory') {
    return (
      <View style={styles.rowDual}>
        <HostMemoryCard data={row.items[0]} onPress={handlers.onPress} />
        <HostMemoryCard data={row.items[1]} onPress={handlers.onPress} />
      </View>
    );
  }
  const item = row.items[0];
  return <CardRenderer item={item} handlers={handlers} />;
}

/**
 * Item listesini row'lara böl: ardışık memory'leri 2'li gruplar.
 * Pagination için idempotent olmalı — yeni item eklendiğinde
 * zaten render edilen row'lar değişmemeli (key stability).
 */
function buildRows(items) {
  const rows = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.type === 'host-memory' && items[i + 1]?.type === 'host-memory') {
      rows.push({ type: 'dual-memory', items: [item, items[i + 1]] });
      i += 2;
    } else {
      rows.push({ type: 'single', items: [item] });
      i += 1;
    }
  }
  return rows;
}

function CardRenderer({ item, handlers }) {
  switch (item.type) {
    case 'host-ritual':
      return (
        <HostRitualCard
          data={item}
          onPress={handlers.onPress}
          onReserve={handlers.onReserve}
        />
      );
    case 'venue-live':
      return (
        <VenueLiveCard
          data={item}
          onPress={handlers.onPress}
          onListen={handlers.onListen}
        />
      );
    case 'creator-pulse':
      return (
        <CreatorPulseCard
          data={item}
          onPress={handlers.onPress}
          onViewRituals={handlers.onViewRituals}
        />
      );
    case 'host-voice':
      return <HostVoiceCard data={item} onPress={handlers.onPress} />;
    case 'host-memory':
      return (
        <View style={styles.singleMemoryWrap}>
          <HostMemoryCard data={item} onPress={handlers.onPress} />
        </View>
      );
    default:
      return null;
  }
}

// ============================================
// EMPTY STATE
// ============================================
function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="heart" size={28} color={colors.text400} />
      </View>
      <Text style={styles.emptyTitle}>Henüz kimse takip etmiyorsun</Text>
      <Text style={styles.emptyText}>
        Keşfet sayfasından host'ları ve mekanları takip et.{'\n'}
        Onların yeni ritüelleri burada görünecek.
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
  feedContent: {
    paddingBottom: 120,
  },
  rowWrap: {
    paddingHorizontal: 16,
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
    backgroundColor: colors.black,
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

  // Section
  sectionLabel: {
    marginTop: 18,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.text500,
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 10.5,
    color: colors.text400,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Row layouts
  rowDual: {
    flexDirection: 'row',
    gap: 10,
  },
  singleMemoryWrap: {
    flexDirection: 'row',
    gap: 10,
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
    backgroundColor: colors.surfaceMuted,
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
