import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

import { colors, fonts, radii, spacing } from '../theme';
import { enrichWithDistance, filterByRadius, formatWalkTime } from '../utils/geoUtils';

import NearbyRadar from '../components/NearbyRadar';
import {
  SquareMemoryCard,
  MiniQuoteCard,
  EventCard,
  LiveChipCard,
  VenueCard,
  DistanceBadge,
} from '../components/PulseCards';

/**
 * Yarıçap seçenekleri
 */
const RADIUS_OPTIONS = [
  { value: 250, label: '250m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

/**
 * NearbyView — "Yakınımda" filtresi seçildiğinde render edilen ana ekran.
 *
 * @param {object} userLocation - { lat, lng }
 * @param {array} items - Backend'den gelen yakın içerikler
 * @param {string} neighborhood - "Brera"
 * @param {function} onBack - Pulse'a dön
 * @param {function} fetchNearby - (radius) => Promise<items>
 */
export default function NearbyView({
  userLocation = { lat: 45.4719, lng: 9.1882 }, // default: Brera, Milano
  initialItems = [],
  neighborhood = 'Brera',
  onBack,
  fetchNearby,
  navigation,
}) {
  const [items, setItems] = useState(initialItems);
  const [radius, setRadius] = useState(1000);
  const [activeDotId, setActiveDotId] = useState(null);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef(null);
  const cardRefs = useRef({}); // id -> ref

  // Enrich items with distance/bearing based on userLocation
  const enrichedItems = useMemo(
    () => enrichWithDistance(items, userLocation),
    [items, userLocation]
  );

  // Filter by current radius
  const visibleItems = useMemo(
    () => filterByRadius(enrichedItems, radius),
    [enrichedItems, radius]
  );

  // Split items into sections
  const sections = useMemo(() => {
    const live = visibleItems.filter((i) => i.type === 'live');
    const venues = visibleItems.filter((i) => i.type === 'venue');
    const friends = visibleItems.filter((i) => i.type === 'friend');
    const memories = visibleItems.filter((i) =>
      ['memory', 'hero', 'square', 'quote', 'miniQuote', 'polaroid'].includes(i.type)
    );
    const events = visibleItems.filter((i) => i.type === 'event');
    return { live, venues, friends, memories, events };
  }, [visibleItems]);

  // === Data fetching ===
  useEffect(() => {
    if (fetchNearby && items.length === 0) {
      loadData();
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!fetchNearby) return;
    setLoading(true);
    try {
      const data = await fetchNearby(radius);
      setItems(data);
    } catch (e) {
      console.error('Nearby fetch failed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchNearby, radius]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // === Radar dot → card scroll ===
  const handleDotPress = useCallback((itemId) => {
    setActiveDotId(itemId);
    // Auto-clear after animation
    setTimeout(() => setActiveDotId(null), 1500);

    // Scroll to corresponding card
    const cardRef = cardRefs.current[itemId];
    if (cardRef && scrollRef.current) {
      cardRef.measureLayout(
        scrollRef.current.getInnerViewNode(),
        (x, y) => {
          scrollRef.current.scrollTo({ y: Math.max(0, y - 100), animated: true });
        },
        () => {} // onFail
      );
    }
  }, []);

  // Register card ref
  const setCardRef = (id) => (ref) => {
    if (ref) cardRefs.current[id] = ref;
  };

  // Card press handlers (delegates to navigation or custom)
  const cardHandlers = useMemo(
    () => ({
      onPress: (item) => {
        setActiveDotId(item.id);
        setTimeout(() => setActiveDotId(null), 1500);
        navigation?.navigate('DetailScreen', { id: item.id, type: item.type });
      },
      onJoin: (item) => navigation?.navigate('JoinRitual', { id: item.id }),
      onAction: (item) => navigation?.navigate('VenueDetail', { id: item.id }),
    }),
    [navigation]
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.navy} />
        <Text style={styles.loadingText}>Etrafın taranıyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Header neighborhood={neighborhood} onBack={onBack} />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.navy} />
        }
      >
        {/* Context strip */}
        <NearbyContextStrip neighborhood={neighborhood} accuracyMeters={8} />

        {/* Radar */}
        <NearbyRadar
          userLocation={userLocation}
          items={enrichedItems}
          radius={radius}
          activeDotId={activeDotId}
          onDotPress={handleDotPress}
          neighborhood={neighborhood}
        />

        {/* Proximity control */}
        <ProximityControl value={radius} onChange={setRadius} />

        {/* --- Sections --- */}

        {sections.live.length > 0 && (
          <FeedSection title="şu an burada" count={`${sections.live.length} CANLI`}>
            {sections.live.map((item) => (
              <View key={item.id} ref={setCardRef(item.id)}>
                <LiveChipCard
                  data={{
                    ...item,
                    rankingText: `${formatWalkTime(item.distance)} · ${item.rankingText || 'yakında'}`,
                  }}
                  onPress={cardHandlers.onPress}
                  onJoin={cardHandlers.onJoin}
                />
              </View>
            ))}
          </FeedSection>
        )}

        {sections.venues.length > 0 && (
          <FeedSection
            title="mekanlar"
            count={`${sections.venues.length} ${sections.venues.filter((v) => v.status !== 'closed').length === sections.venues.length ? 'AÇIK' : 'MEKAN'}`}
          >
            {sections.venues.map((item) => (
              <View key={item.id} ref={setCardRef(item.id)}>
                <VenueCard
                  data={item}
                  variant="venue"
                  onPress={cardHandlers.onPress}
                  onAction={cardHandlers.onAction}
                />
              </View>
            ))}
          </FeedSection>
        )}

        {sections.memories.length > 0 && (
          <FeedSection title="yakınındaki anılar" count={`${sections.memories.length} ANI · SON 24SA`}>
            <MemoriesLayout
              items={sections.memories}
              cardHandlers={cardHandlers}
              setCardRef={setCardRef}
            />
          </FeedSection>
        )}

        {sections.events.length > 0 && (
          <FeedSection title="yaklaşan etkinlikler" count={`${sections.events.length} ETKİNLİK`}>
            {sections.events.map((item) => (
              <View key={item.id} ref={setCardRef(item.id)} style={{ marginBottom: 10 }}>
                <EventCard data={item} onPress={cardHandlers.onPress} onJoin={cardHandlers.onJoin} />
              </View>
            ))}
          </FeedSection>
        )}

        {sections.friends.length > 0 && (
          <FeedSection title="yakındaki arkadaşlar" count={`${sections.friends.length} AKTİF`}>
            {sections.friends.map((item) => (
              <View key={item.id} ref={setCardRef(item.id)}>
                <VenueCard
                  data={item}
                  variant="friend"
                  onPress={cardHandlers.onPress}
                  onAction={cardHandlers.onAction}
                />
              </View>
            ))}
          </FeedSection>
        )}

        {/* Empty state */}
        {visibleItems.length === 0 && !loading && (
          <EmptyState radius={radius} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// HEADER
// ============================================
function Header({ neighborhood, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Icon name="chevron-left" size={14} color={colors.text700} strokeWidth={2.5} />
        <Text style={styles.backText}>Pulse</Text>
      </TouchableOpacity>

      <View style={styles.headerLogo}>
        <View style={styles.headerLogoRow}>
          <Text style={styles.headerTitle}>Yakınımda</Text>
          <View style={styles.headerDot} />
        </View>
        <Text style={styles.headerCity}>MILANO · {neighborhood.toUpperCase()}</Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.iconCircle}>
          <Icon name="map-pin" size={16} color={colors.text500} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================
// NEARBY CONTEXT STRIP
// ============================================
function NearbyContextStrip({ neighborhood, accuracyMeters }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.3] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.contextStrip}>
      <View style={styles.contextLeft}>
        <View style={styles.contextIconWrap}>
          <Animated.View
            style={[
              styles.contextIconRing,
              { opacity, transform: [{ scale }] },
            ]}
          />
          <View style={styles.contextIcon}>
            <Icon name="map-pin" size={13} color="#fff" strokeWidth={2.5} />
          </View>
        </View>
        <View>
          <Text style={styles.contextLabel}>Etrafında</Text>
          <Text style={styles.contextName}>{neighborhood} · Milano</Text>
        </View>
      </View>

      <View style={styles.accuracy}>
        <View style={styles.accuracyDot} />
        <Text style={styles.accuracyText}>GPS · {accuracyMeters}m</Text>
      </View>
    </View>
  );
}

// ============================================
// PROXIMITY CONTROL
// ============================================
function ProximityControl({ value, onChange }) {
  const currentLabel = RADIUS_OPTIONS.find((o) => o.value === value)?.label || '1km';
  const walkTime = formatWalkTime(value);

  return (
    <View style={styles.proximityControl}>
      <View style={styles.proxLabelGroup}>
        <Text style={styles.proxLabel}>YARIÇAP</Text>
        <View style={styles.proxValueRow}>
          <Text style={styles.proxValue}>{currentLabel}</Text>
          <Text style={styles.proxWalk}>~{walkTime} yürü</Text>
        </View>
      </View>

      <View style={styles.proxPills}>
        {RADIUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.proxPill, value === opt.value && styles.proxPillActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.proxPillText, value === opt.value && styles.proxPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ============================================
// FEED SECTION WRAPPER
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

// ============================================
// MEMORIES LAYOUT (dual / asym carousel)
// ============================================
function MemoriesLayout({ items, cardHandlers, setCardRef }) {
  // Çiftlere böl: her 2 kart dual grid, sonra tek kaldıysa full
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <>
      {rows.map((row, idx) => {
        if (row.length === 2) {
          const [a, b] = row;
          // Eğer her ikisi square'ler ise dual-square, değilse asym-left (mini + square)
          if (a.type === 'square' && b.type === 'square') {
            return (
              <View key={idx} style={styles.rowDual}>
                <View ref={setCardRef(a.id)} style={styles.flex1}>
                  <SquareMemoryCard data={a} onPress={cardHandlers.onPress} />
                </View>
                <View ref={setCardRef(b.id)} style={styles.flex1}>
                  <SquareMemoryCard data={b} onPress={cardHandlers.onPress} />
                </View>
              </View>
            );
          }
          return (
            <View key={idx} style={styles.rowAsymLeft}>
              <View ref={setCardRef(a.id)} style={styles.flex1}>
                {renderMemoryCard(a, cardHandlers)}
              </View>
              <View ref={setCardRef(b.id)} style={styles.flex1asym}>
                {renderMemoryCard(b, cardHandlers)}
              </View>
            </View>
          );
        }

        // Tek kart
        const a = row[0];
        return (
          <View key={idx} ref={setCardRef(a.id)} style={styles.rowFull}>
            {renderMemoryCard(a, cardHandlers)}
          </View>
        );
      })}
    </>
  );
}

function renderMemoryCard(item, handlers) {
  switch (item.type) {
    case 'square':
      return <SquareMemoryCard data={item} onPress={handlers.onPress} />;
    case 'miniQuote':
      return <MiniQuoteCard data={item} onPress={handlers.onPress} />;
    default:
      return <SquareMemoryCard data={item} onPress={handlers.onPress} />;
  }
}

// ============================================
// EMPTY STATE
// ============================================
function EmptyState({ radius }) {
  const radiusLabel = RADIUS_OPTIONS.find((o) => o.value === radius)?.label || '1km';
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="map-pin" size={28} color={colors.text400} />
      </View>
      <Text style={styles.emptyTitle}>Şu an çok sessiz</Text>
      <Text style={styles.emptyText}>
        {radiusLabel} içinde yeni aktivite yok.{'\n'}
        Yarıçapı genişletmeyi dene veya kendin bir ritüel başlat.
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
  headerCity: {
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

  // Context strip
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarm,
  },
  contextLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextIconRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  contextIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text400,
    letterSpacing: 1.5,
    fontFamily: fonts.sansBold,
  },
  contextName: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text900,
    lineHeight: 20,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  accuracy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    paddingLeft: 8,
    backgroundColor: colors.greenSoft,
    borderRadius: radii.pill,
  },
  accuracyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.green,
  },
  accuracyText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.green,
    fontFamily: fonts.sansSemiBold,
  },

  // Proximity
  proximityControl: {
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  proxLabelGroup: {
    flexShrink: 0,
  },
  proxLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.text400,
    letterSpacing: 1,
    fontFamily: fonts.sansBold,
  },
  proxValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 2,
  },
  proxValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text900,
    fontFamily: fonts.sansBold,
    letterSpacing: -0.2,
  },
  proxWalk: {
    fontSize: 10.5,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },
  proxPills: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
  },
  proxPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  proxPillActive: {
    backgroundColor: colors.black,
  },
  proxPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text500,
    fontFamily: fonts.sansSemiBold,
  },
  proxPillTextActive: {
    color: '#fff',
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
    gap: 10,
  },

  // Rows
  rowDual: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  rowAsymLeft: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  rowFull: {
    marginBottom: 10,
  },
  flex1: {
    flex: 1,
  },
  flex1asym: {
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
