import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { colors, fonts, radii } from '../theme';
import {
  enrichFriends,
  groupByCloseness,
  heatDistribution,
  CLOSENESS,
} from '../utils/friendshipHeat';

import {
  FriendsContext,
  FriendSpotlightCard,
  FriendNowCard,
  RekindleCard,
  SharedMemoryCard,
  RitualTogetherCard,
  FriendQuoteCard,
  NewConnectionCard,
} from '../components/FriendsCards';

/**
 * FriendsView — "Arkadaşlar" filtresi seçildiğinde render edilen ana ekran.
 *
 * Item tipleri (backend shape):
 *   - friend                  → FriendSpotlightCard veya RekindleCard (heat'e göre)
 *   - friend-now              → FriendNowCard (aktif arkadaş)
 *   - shared-memory           → SharedMemoryCard (sen de vardın)
 *   - ritual-together         → RitualTogetherCard (arkadaşların kayıt oldu)
 *   - friend-quote            → FriendQuoteCard
 *   - new-connection          → NewConnectionCard (son 30 gün)
 *
 * @param {object[]} friends   - Ham arkadaş listesi (sadece friend type'ı için)
 * @param {object[]} memories  - Shared memory'ler, quote'lar, rituals-together, vs.
 * @param {string} city
 * @param {function} onBack
 * @param {function} fetchFriends
 * @param {function} navigation
 */
export default function FriendsView({
  friends: initialFriends = [],
  memories: initialMemories = [],
  city = 'Milano',
  onBack,
  fetchFriends,
  navigation,
}) {
  const [friends, setFriends] = useState(initialFriends);
  const [memories, setMemories] = useState(initialMemories);
  const [loading, setLoading] = useState(initialFriends.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  // ===== Data fetching =====
  useEffect(() => {
    if (fetchFriends && friends.length === 0) {
      loadData();
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!fetchFriends) return;
    setLoading(true);
    try {
      const data = await fetchFriends();
      setFriends(data.friends || []);
      setMemories(data.memories || []);
    } catch (e) {
      console.error('Friends fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchFriends]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ===== Enrichment & grouping =====
  const enrichedFriends = useMemo(() => enrichFriends(friends), [friends]);
  const groups = useMemo(() => groupByCloseness(enrichedFriends), [enrichedFriends]);
  const distribution = useMemo(() => heatDistribution(enrichedFriends), [enrichedFriends]);
  const activeCount = useMemo(
    () => enrichedFriends.filter((f) => f.isActive).length,
    [enrichedFriends]
  );

  // ===== Card event handlers =====
  const handlers = useMemo(
    () => ({
      onPress: (item) => {
        if (item.type === 'ritual-together') {
          navigation?.navigate('RitualDetail', { id: item.id });
        } else {
          navigation?.navigate('FriendProfile', { id: item.id });
        }
      },
      onJoin: (item) => navigation?.navigate('JoinRitual', { id: item.id }),
      onMessage: (item) => navigation?.navigate('Message', { friendId: item.id }),
      onReinforce: (item) => navigation?.navigate('InviteToRitual', { friendId: item.id }),
      onProfile: (item) => navigation?.navigate('FriendProfile', { id: item.id }),
    }),
    [navigation]
  );

  if (loading && friends.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Arkadaşlar yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header totalFriends={enrichedFriends.length} city={city} onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.navy} />
        }
      >
        {/* Üst özet bandı */}
        <FriendsContext
          totalFriends={enrichedFriends.length}
          activeCount={activeCount}
          distribution={distribution}
          city={city}
        />

        {/* ============================================
             SECTION 1: YAKINLARIN
        ============================================ */}
        {groups.close.length > 0 && (
          <FeedSection title="yakınların" count={`${groups.close.length} KİŞİ`}>
            <CloseFriendsLayout
              friends={groups.close}
              memories={memories}
              handlers={handlers}
            />
          </FeedSection>
        )}

        {/* ============================================
             SECTION 2: TANIDIKLARIN
        ============================================ */}
        {groups.acquaintance.length > 0 && (
          <FeedSection
            title="tanıdıkların"
            count={`${groups.acquaintance.length} KİŞİ · SICAK`}
          >
            <AcquaintanceLayout
              friends={groups.acquaintance}
              memories={memories}
              handlers={handlers}
            />
          </FeedSection>
        )}

        {/* ============================================
             SECTION 3: YENİ TANIŞTIKLARIN
        ============================================ */}
        {groups.new.length > 0 && (
          <FeedSection title="yeni tanıştıkların" count={`${groups.new.length} KİŞİ · SON 30 GÜN`}>
            <NewConnectionsLayout friends={groups.new} handlers={handlers} />
          </FeedSection>
        )}

        {/* Empty state */}
        {enrichedFriends.length === 0 && !loading && <EmptyState />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// HEADER
// ============================================
function Header({ totalFriends, city, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="chevron-left" size={14} color={colors.text700} strokeWidth={2.5} />
        <Text style={styles.backText}>Pulse</Text>
      </TouchableOpacity>

      <View style={styles.headerLogo}>
        <View style={styles.headerLogoRow}>
          <Text style={styles.headerTitle}>Arkadaşların</Text>
          <View style={styles.headerDot} />
        </View>
        <Text style={styles.headerSubtitle}>
          {totalFriends} KİŞİ · {city.toUpperCase()}
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
// LAYOUT COMPONENTS
// ============================================

/**
 * Yakınların bölümü - karışık bento
 * Spotlight (ilk) + Now (aktif olanlar) + SharedMemory dual + RitualTogether + Rekindle
 */
function CloseFriendsLayout({ friends, memories, handlers }) {
  if (!friends.length) return null;

  // İlk friend (en sıcak) → Spotlight
  const spotlight = friends[0];

  // Aktif olanlar (isActive=true) → FriendNow
  const activeOnes = friends.filter((f) => f.isActive && f.id !== spotlight?.id);

  // Soğumakta olanlar → Rekindle
  const coolingOnes = friends.filter(
    (f) => (f.heat === 'cool' || f.heat === 'cold') && f.id !== spotlight?.id
  );

  // Memories: shared-memory tipindekiler (yakınlarla ilgili)
  const sharedMemories = memories
    .filter((m) => m.type === 'shared-memory')
    .slice(0, 2);

  // Ritual together kartları
  const ritualsTogether = memories.filter((m) => m.type === 'ritual-together').slice(0, 1);

  return (
    <>
      {/* Spotlight */}
      {spotlight && (
        <FriendSpotlightCard
          data={spotlight}
          onPress={handlers.onPress}
          onJoin={handlers.onJoin}
          onMessage={handlers.onMessage}
        />
      )}

      {/* Active friends */}
      {activeOnes.slice(0, 2).map((friend) => (
        <FriendNowCard
          key={friend.id}
          data={friend}
          onPress={handlers.onPress}
          onJoin={handlers.onJoin}
        />
      ))}

      {/* Shared memories dual */}
      {sharedMemories.length === 2 && (
        <View style={styles.rowDual}>
          <SharedMemoryCard data={sharedMemories[0]} onPress={handlers.onPress} />
          <SharedMemoryCard data={sharedMemories[1]} onPress={handlers.onPress} />
        </View>
      )}
      {sharedMemories.length === 1 && (
        <View style={styles.rowDual}>
          <SharedMemoryCard data={sharedMemories[0]} onPress={handlers.onPress} />
          <View style={styles.flex1} />
        </View>
      )}

      {/* Ritual Together */}
      {ritualsTogether.map((r) => (
        <RitualTogetherCard
          key={r.id}
          data={r}
          onPress={handlers.onPress}
          onJoin={handlers.onJoin}
        />
      ))}

      {/* Rekindle for close but cooling */}
      {coolingOnes.slice(0, 1).map((friend) => (
        <RekindleCard
          key={friend.id}
          data={friend}
          onMessage={handlers.onMessage}
        />
      ))}
    </>
  );
}

/**
 * Tanıdıklar bölümü - asym (quote + shared memory) + rekindle
 */
function AcquaintanceLayout({ friends, memories, handlers }) {
  const quotes = memories.filter((m) => m.type === 'friend-quote').slice(0, 1);
  const sharedMemories = memories
    .filter((m) => m.type === 'shared-memory')
    .slice(2, 3); // sonraki ones

  const coolingOnes = friends.filter(
    (f) => f.heat === 'cool' || f.heat === 'cold'
  );

  return (
    <>
      {/* Asym: quote + shared memory */}
      {quotes.length > 0 && sharedMemories.length > 0 && (
        <View style={styles.rowAsymLeft}>
          <View style={styles.flex1}>
            <FriendQuoteCard data={quotes[0]} onPress={handlers.onPress} />
          </View>
          <View style={styles.flex16}>
            <SharedMemoryCard data={sharedMemories[0]} onPress={handlers.onPress} />
          </View>
        </View>
      )}

      {/* Standalone quote */}
      {quotes.length > 0 && sharedMemories.length === 0 && (
        <FriendQuoteCard data={quotes[0]} onPress={handlers.onPress} />
      )}

      {/* Rekindles */}
      {coolingOnes.slice(0, 2).map((friend) => (
        <RekindleCard
          key={friend.id}
          data={friend}
          onMessage={handlers.onMessage}
        />
      ))}
    </>
  );
}

/**
 * Yeni tanışıklar - 1 full + dual compact (varsa)
 */
function NewConnectionsLayout({ friends, handlers }) {
  if (!friends.length) return null;

  const first = friends[0];
  const rest = friends.slice(1);

  return (
    <>
      {/* First: full-width */}
      <NewConnectionCard
        data={first}
        onPress={handlers.onPress}
        onReinforce={handlers.onReinforce}
        onProfile={handlers.onProfile}
      />

      {/* Rest: dual grid (2'li gruplar) */}
      {rest.length >= 2 && (
        <View style={styles.rowDual}>
          <NewConnectionCard
            data={rest[0]}
            compact
            onPress={handlers.onPress}
            onReinforce={handlers.onReinforce}
          />
          <NewConnectionCard
            data={rest[1]}
            compact
            onPress={handlers.onPress}
            onReinforce={handlers.onReinforce}
          />
        </View>
      )}
      {rest.length === 1 && (
        <View style={styles.rowDual}>
          <NewConnectionCard
            data={rest[0]}
            compact
            onPress={handlers.onPress}
            onReinforce={handlers.onReinforce}
          />
          <View style={styles.flex1} />
        </View>
      )}
    </>
  );
}

// ============================================
// HELPERS
// ============================================
function FeedSection({ title, count, children }) {
  return (
    <View style={styles.feedSection}>
      <View style={styles.feedSectionLabel}>
        <Text style={styles.feedSectionTitle}>{title}</Text>
        <Text style={styles.feedSectionCount}>{count}</Text>
      </View>
      <View style={styles.feedSectionBody}>{children}</View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="users" size={28} color={colors.text400} />
      </View>
      <Text style={styles.emptyTitle}>Henüz arkadaşın yok</Text>
      <Text style={styles.emptyText}>
        Bir ritüele katıldığında tanıştığın insanlar{'\n'}
        burada görünecek.
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
  scrollContent: {
    paddingBottom: 120,
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

  // Feed section
  feedSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  feedSectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  feedSectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.text500,
    letterSpacing: 0.3,
  },
  feedSectionCount: {
    fontSize: 10.5,
    color: colors.text400,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  feedSectionBody: {
    gap: 14,
  },

  // Rows
  rowDual: {
    flexDirection: 'row',
    gap: 10,
  },
  rowAsymLeft: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  flex16: {
    flex: 1.6,
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
  },
  emptyText: {
    fontSize: 13,
    color: colors.text500,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: fonts.sans,
  },
});
