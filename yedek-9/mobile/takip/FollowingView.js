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
  ImageBackground,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { colors, fonts, radii } from '../theme';
import {
  enrichWithSignals,
  entityBreakdown,
  filterByKind,
  sortForFeed,
} from '../utils/followSignal';

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function FollowingView({
  initialItems = [],
  fetchFollowing,
  onBack,
  navigation,
  pageSize = 20,
}) {
  const [items, setItems] = useState(initialItems);
  const [activeKind, setActiveKind] = useState('all');
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (fetchFollowing && items.length === 0) {
      loadData({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && fetchFollowing) {
      loadData({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind]);

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
          kind: activeKind,
          offset,
          limit: pageSize,
        });

        const newItems = Array.isArray(result) ? result : result?.items || [];
        const moreAvailable = Array.isArray(result)
          ? newItems.length >= pageSize // heuristic
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
    [fetchFollowing, activeKind, pageSize, items.length, loadingMore, hasMore]
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

  const enrichedItems = useMemo(() => enrichWithSignals(items), [items]);
  const filteredItems = useMemo(
    () => filterByKind(enrichedItems, activeKind),
    [enrichedItems, activeKind]
  );
  const sortedItems = useMemo(() => sortForFeed(filteredItems), [filteredItems]);

  const totalCount = useMemo(() => {
    const ids = new Set(enrichedItems.map((i) => i.entity?.id).filter(Boolean));
    return ids.size;
  }, [enrichedItems]);

  const activeCount = useMemo(
    () => enrichedItems.filter((i) => i.entity?.isActive).length,
    [enrichedItems]
  );
  const breakdown = useMemo(() => entityBreakdown(enrichedItems), [enrichedItems]);
  const counts = useMemo(() => ({ all: totalCount, ...breakdown }), [totalCount, breakdown]);

  const onPressItem = useCallback(
    (item) => {
      const entityKind = item.entity?.kind;
      if (item.type === 'host-ritual' || item.type === 'host-memory') {
        navigation?.navigate('RitualDetail', { id: item.id, ritualId: item.id });
      } else if (entityKind === 'venue' || item.type === 'venue-live') {
        navigation?.navigate('VenueDetail', { id: item.entity?.id });
      } else {
        navigation?.navigate('HostProfile', { id: item.entity?.id });
      }
    },
    [navigation]
  );

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
        keyExtractor={(row, idx) => row.rowKey || `row_${idx}`}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            <RowRenderer row={row} onPress={onPressItem} />
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
            <View style={styles.context}>
              <View style={styles.contextText}>
                <Text style={styles.contextLabel}>Takip ettiğin</Text>
                <Text style={styles.contextName}>
                  {totalCount} <Text style={styles.contextCount}>kişi & yer</Text>
                </Text>
              </View>
              {activeCount > 0 && (
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>{activeCount} AKTİF</Text>
                </View>
              )}
            </View>
            <View style={styles.typeFilter}>
              {[
                ['all', 'Hepsi'],
                ['host', 'Hostlar'],
                ['venue', 'Mekanlar'],
                ['creator', "Creator'lar"],
                ['partner', 'Partnerler'],
              ].map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.typeChip, activeKind === key && styles.typeChipActive]}
                  onPress={() => setActiveKind(key)}
                >
                  <Text style={[styles.typeChipText, activeKind === key && styles.typeChipTextActive]}>
                    {label} <Text style={styles.typeChipCount}>{counts[key] || 0}</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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

function RowRenderer({ row, onPress }) {
  if (row.type === 'dual-memory') {
    return (
      <View style={styles.rowDual}>
        <CardRenderer item={row.items[0]} onPress={onPress} compactMemory />
        <CardRenderer item={row.items[1]} onPress={onPress} compactMemory />
      </View>
    );
  }
  const item = row.items[0];
  return <CardRenderer item={item} onPress={onPress} />;
}

function buildRows(items) {
  const rows = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.type === 'host-memory' && items[i + 1]?.type === 'host-memory') {
      const next = items[i + 1];
      rows.push({
        type: 'dual-memory',
        rowKey: `dual-${i}-${String(item?.id || 'a')}-${String(next?.id || 'b')}`,
        items: [item, next],
      });
      i += 2;
    } else {
      rows.push({
        type: 'single',
        rowKey: `single-${i}-${String(item?.id || 'x')}-${String(item?.type || 'item')}`,
        items: [item],
      });
      i += 1;
    }
  }
  return rows;
}

function CardRenderer({ item, onPress, compactMemory = false }) {
  const kind = item?.entity?.kind;
  const title = cleanText(item?.title || item?.text || item?.entity?.name || 'Takip');
  const subtitle = cleanText(item?.entity?.name || item?.ritual?.venue || 'Milano');

  switch (item.type) {
    case 'host-ritual':
      return (
        <TouchableOpacity style={[styles.card, styles.cardHostRitual]} onPress={() => onPress?.(item)} activeOpacity={0.9}>
          <ImageBackground source={{ uri: item?.coverImage || item?.image || item?.image_url }} style={styles.cover} imageStyle={styles.coverImage}>
            <View style={styles.coverOverlay} />
            <Text style={styles.signalOnDark}>2sa ÖNCE DUYURDU</Text>
            <Text style={styles.coverCaption}>{title}</Text>
          </ImageBackground>
          <View style={styles.cardBody}>
            <Text style={styles.cardName}>{subtitle}</Text>
            <Text style={styles.cardMeta}>4 aydır takip ediyorsun</Text>
          </View>
        </TouchableOpacity>
      );
    case 'venue-live':
      return (
        <TouchableOpacity style={[styles.card, styles.cardVenueLive]} onPress={() => onPress?.(item)} activeOpacity={0.9}>
          <Text style={styles.signalBadgeGreen}>🟢 ŞU AN CANLI</Text>
          <Text style={styles.cardNameSpaced}>{subtitle}</Text>
          <Text style={styles.cardMeta}>{`${10 + (Number(item?.id?.length || 0) % 20)} kişi içeride · Brera`}</Text>
        </TouchableOpacity>
      );
    case 'creator-pulse':
      return (
        <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.9}>
          <View style={styles.creatorHeader}>
            <View style={styles.creatorAvatarWrap}>
              <View style={styles.creatorAvatarInner} />
            </View>
            <View style={styles.creatorText}>
              <Text style={styles.cardName}>{subtitle}</Text>
              <Text style={styles.cardMeta}><Text style={styles.bold}>Pivot Host</Text> · 6 aydır takip</Text>
            </View>
            <Text style={styles.signalBadgeGold}>REGULAR</Text>
          </View>
          <View style={styles.creatorBars}>
            {[30, 10, 50, 25, 15, 70, 95].map((h, idx) => (
              <View key={`bar-${idx}`} style={[styles.bar, { height: `${h}%` }, h > 20 ? styles.barOn : styles.barOff]} />
            ))}
          </View>
        </TouchableOpacity>
      );
    case 'host-voice':
      return (
        <TouchableOpacity style={[styles.card, styles.cardVoice]} onPress={() => onPress?.(item)} activeOpacity={0.9}>
          <View style={styles.voiceTop}>
            <Text style={styles.signalBadgeMuted}>YENİ SÖZ</Text>
            <Text style={styles.voiceTime}>6SA</Text>
          </View>
          <Text style={styles.voiceQuote}>"{title}"</Text>
          <View style={styles.voiceBottom}>
            <Text style={styles.cardName}>{subtitle}</Text>
            <Text style={styles.cardMeta}>{`${kind || 'host'} · takipte`}</Text>
          </View>
        </TouchableOpacity>
      );
    case 'host-memory':
      return (
        <TouchableOpacity
          style={[compactMemory ? styles.cardMemory : styles.cardMemorySingle]}
          onPress={() => onPress?.(item)}
          activeOpacity={0.9}
        >
          <ImageBackground source={{ uri: item?.image || item?.image_url || item?.coverImage }} style={styles.memoryBg} imageStyle={styles.memoryBgImage}>
            <View style={styles.memoryOverlay} />
            <Text style={styles.memorySignal}>{(item?.signals?.freshness || 'regular').toUpperCase()}</Text>
            <Text style={styles.memoryMeta}>Dün · Blue Note</Text>
            <Text style={styles.memoryTitle}>{title}</Text>
          </ImageBackground>
        </TouchableOpacity>
      );
    default:
      return null;
  }
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="heart" size={28} color={colors.text400} />
      </View>
      <Text style={styles.emptyTitle}>
        Henüz kimse takip etmiyorsun
      </Text>
      <Text style={styles.emptyText}>
        Keşfet sayfasından host'ları ve mekanları takip et.{'\n'}
        Onların yeni ritüelleri burada görünecek.
      </Text>
    </View>
  );
}

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
  context: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#faf7f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e0cf',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contextText: { flexDirection: 'column' },
  contextLabel: { fontSize: 9, fontWeight: '700', color: '#9a9a9e', letterSpacing: 1.5 },
  contextName: { fontFamily: fonts.serifMedium, fontSize: 18, fontWeight: '600', marginTop: 2, color: '#0a0a0a' },
  contextCount: { color: '#6b6b6f', fontWeight: '500', fontSize: 14, fontStyle: 'italic' },
  activePill: {
    backgroundColor: '#6d3dd8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    paddingLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  activePillText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
  typeFilter: {
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 6,
  },
  typeChip: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#f7f5f0',
  },
  typeChipActive: { backgroundColor: '#000' },
  typeChipText: { fontSize: 11, color: '#6b6b6f' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  typeChipCount: { opacity: 0.6, fontSize: 9.5 },
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
  rowDual: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ededed',
    borderRadius: 18,
    padding: 14,
  },
  cardHostRitual: { padding: 0, overflow: 'hidden' },
  cover: { aspectRatio: 16 / 9, justifyContent: 'flex-end' },
  coverImage: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  signalOnDark: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#6d3dd8',
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  coverCaption: {
    color: '#fff',
    fontFamily: fonts.serifMedium,
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  cardBody: { padding: 14 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#0a0a0a' },
  cardMeta: { marginTop: 2, fontSize: 10.5, color: '#6b6b6f', fontStyle: 'italic' },
  cardVenueLive: { borderLeftWidth: 3, borderLeftColor: '#2f7a47', paddingLeft: 17 },
  signalBadgeGreen: {
    alignSelf: 'flex-start',
    backgroundColor: '#e1f0e6',
    color: '#2f7a47',
    fontSize: 9.5,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardNameSpaced: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#0a0a0a' },
  creatorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  creatorAvatarWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#b8891f', padding: 2 },
  creatorAvatarInner: { flex: 1, borderRadius: 18, backgroundColor: '#d8c4a0', borderWidth: 2, borderColor: '#fff' },
  creatorText: { flex: 1 },
  signalBadgeGold: { backgroundColor: '#f5ecd4', color: '#b8891f', fontSize: 9.5, fontWeight: '700', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  creatorBars: { flexDirection: 'row', gap: 3, height: 22, alignItems: 'flex-end', marginBottom: 2 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barOn: { backgroundColor: '#b8891f' },
  barOff: { backgroundColor: '#f5ecd4' },
  bold: { fontWeight: '700', color: '#0a0a0a' },
  cardVoice: { backgroundColor: '#fdfbf5', borderColor: '#e8e0cf' },
  voiceTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  signalBadgeMuted: { backgroundColor: '#f7f5f0', color: '#2a2a2a', fontSize: 9.5, fontWeight: '700', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  voiceTime: { fontSize: 9.5, color: '#9a9a9e' },
  voiceQuote: { fontFamily: fonts.serif, fontSize: 17, fontStyle: 'italic', lineHeight: 22, marginBottom: 12, color: '#0a0a0a' },
  voiceBottom: { borderTopWidth: 1, borderTopColor: '#e8e0cf', paddingTop: 10 },
  cardMemorySingle: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ededed',
  },
  cardMemory: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ededed',
    aspectRatio: 1 / 1.2,
  },
  memoryBg: { flex: 1, minHeight: 170, justifyContent: 'flex-end' },
  memoryBgImage: { borderRadius: 18 },
  memoryOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  memorySignal: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 8.5,
    fontWeight: '700',
  },
  memoryMeta: { position: 'absolute', bottom: 40, left: 12, right: 12, fontSize: 9, color: 'rgba(255,255,255,0.8)' },
  memoryTitle: { position: 'absolute', bottom: 8, left: 12, right: 12, color: '#fff', fontFamily: fonts.serif, fontSize: 14 },
  singleMemoryWrap: {
    flexDirection: 'row',
    gap: 10,
  },
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
