import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchUserRecentRituals, browseRituals } from '../services/api';
import useAuthStore from '../store/authStore';
import { SkeletonRitualCard, SkeletonList } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import OptimizedImage from '../components/OptimizedImage';
import EventGroupUmbrellaCard from '../components/EventGroupUmbrellaCard';

const { width } = Dimensions.get('window');

const PRIMARY_COLOR = '#D4AF37';
const ACCENT_AMBER = '#FF9900';
const LIGHT_BACKGROUND = '#FAF9F6';
const LIGHT_CARD = '#FFFFFF';
const LIGHT_TEXT_PRIMARY = '#000000';
const LIGHT_TEXT_SECONDARY = '#6B7280';
const LIGHT_TEXT_TERTIARY = '#9CA3AF';
const BORDER_COLOR = '#E5E7EB';

export default function FullRitualsListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthStore();
  const { userId, title = 'Tum Rituals', showUserRituals = false, venueName, venueCity } = route.params || {};
  
  const [rituals, setRituals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    hasMore: false,
  });

  const targetUserId = userId || user?.id;

  const loadRituals = useCallback(async (reset = false, pageOverride = null) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setPagination(prev => ({ ...prev, page: 1 }));
      }

      const page = pageOverride ?? (reset ? 1 : null);
      let response;

      if (showUserRituals && targetUserId) {
        // Fetch user's rituals (backend supports limit only, no offset - fetch 50 once)
        const ritualsData = await fetchUserRecentRituals(targetUserId, 50);
        response = {
          data: ritualsData || [],
          pagination: {
            page: 1,
            totalPages: 1,
            total: (ritualsData || []).length,
          },
        };
      } else {
        const params = {
          page: page ?? 1,
          limit: 20,
        };
        const cityToUse = venueCity || user?.city;
        if (cityToUse) params.city = cityToUse;
        if (venueName) params.search = venueName;
        response = await browseRituals(params);
      }

      const newRituals = response.data || [];
      const effectivePage = page ?? response.pagination?.page ?? 1;

      if (reset) {
        setRituals(newRituals);
      } else {
        setRituals(prev => [...prev, ...newRituals]);
      }

      setPagination(prev => ({
        ...prev,
        page: response.pagination?.page ?? effectivePage,
        totalPages: response.pagination?.totalPages ?? 1,
        hasMore: response.pagination?.hasMore ?? (effectivePage < (response.pagination?.totalPages ?? 1)),
      }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, showUserRituals, venueName, venueCity, user?.city]);

  useEffect(() => {
    loadRituals(true);
  }, [loadRituals]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadRituals(true);
  }, [loadRituals]);

  const handleLoadMore = useCallback(() => {
    if (!loading && pagination.hasMore) {
      loadRituals(false, pagination.page + 1);
    }
  }, [loadRituals, loading, pagination.hasMore, pagination.page]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    loadRituals(true);
  };

  const formatTime = (startTime, duration) => {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60000);
    const startStr = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const endStr = end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `${startStr} - ${endStr}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Bugun';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Yarin';
    } else {
      return date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
    }
  };

  const renderRitualCard = ({ item: ritual }) => {
    if (ritual?.card_type === 'event_group' || (ritual?.tables && ritual?.label && !ritual?.host_id)) {
      return (
        <EventGroupUmbrellaCard
          umbrella={ritual}
          onOpenTable={(ritualId) => navigation.navigate('RitualDetail', { ritualId })}
        />
      );
    }
    const timeRange = formatTime(ritual.start_time, ritual.duration);
    const dateStr = formatDate(ritual.start_time);

    return (
      <TouchableOpacity
        style={styles.ritualCard}
        onPress={() => navigation.navigate('RitualDetail', { ritualId: ritual.id })}
        activeOpacity={0.8}
      >
        <View style={styles.ritualCardContent}>
          <View style={styles.ritualImageContainer}>
            <OptimizedImage
              source={ritual.image_url ? { uri: ritual.image_url } : null}
              style={styles.ritualImage}
              contentFit="cover"
              showPlaceholder={true}
              placeholder={
                <MaterialIcons name="event" size={32} color={LIGHT_TEXT_TERTIARY} />
              }
            />
            {ritual.time_state === 'live_now' && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.ritualCardRight}>
            <View style={styles.ritualCardTop}>
              <Text style={styles.ritualDate}>{dateStr}</Text>
              <Text style={styles.ritualTitle} numberOfLines={2}>
                {ritual.title}
              </Text>
              <View style={styles.ritualLocationRow}>
                <MaterialIcons name="location-on" size={14} color={LIGHT_TEXT_SECONDARY} />
                <Text style={styles.ritualLocation} numberOfLines={1}>
                  {ritual.venue_name}
                </Text>
                {ritual.is_venue_verified && (
                  <MaterialIcons name="verified" size={14} color={ACCENT_AMBER} style={styles.verifiedIcon} />
                )}
              </View>
              <Text style={styles.ritualTime}>{timeRange}</Text>
              {ritual.is_host_verified && (
                <View style={styles.verifiedBadgeRow}>
                  <MaterialIcons name="verified-user" size={12} color={ACCENT_AMBER} />
                  <Text style={styles.verifiedBadgeText}>Dogrulanmis Host</Text>
                </View>
              )}
            </View>

            <View style={styles.ritualCardBottom}>
              <View style={styles.ritualStats}>
                <MaterialIcons name="people" size={14} color={LIGHT_TEXT_SECONDARY} />
                <Text style={styles.attendanceText}>
                  {ritual.attendance_count || 0}/{ritual.capacity}
                </Text>
                {ritual.available_spots !== undefined && ritual.available_spots <= 3 && ritual.available_spots > 0 && (
                  <Text style={styles.spotsRemainingText}>
                    {ritual.available_spots} yer kaldi
                  </Text>
                )}
              </View>
              {ritual.type && (
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{ritual.type}</Text>
                </View>
              )}
              {(ritual.has_fee || ritual.fee?.amount != null || ritual.fee_amount != null) ? (
                <View style={[styles.typeChip, styles.feeChip]}>
                  <Text style={styles.feeChipText}>
                    ₺{Number(ritual.fee?.amount ?? ritual.fee_amount).toFixed(
                      Number(ritual.fee?.amount ?? ritual.fee_amount) % 1 === 0 ? 0 : 2
                    )}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show error state
  if (error && rituals.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="chevron-left" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerRight} />
        </View>
        <ErrorState
          title="Rituals yuklenemedi"
          message="Rituals yuklenemedi. Baglantini kontrol edip tekrar dene."
          onRetry={handleRetry}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="chevron-left" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Rituals List */}
      <FlatList
        data={rituals}
        renderItem={renderRitualCard}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY_COLOR}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonContainer}>
              <SkeletonList
                count={3}
                renderItem={() => <SkeletonRitualCard style={{ marginBottom: 16 }} />}
              />
            </View>
          ) : (
            <EmptyState
              icon="event-busy"
              title="Ritual bulunamadi"
              message={showUserRituals 
                ? 'Henuz olusturdugun veya katildigin Ritual yok.'
                : 'Su an uygun Ritual yok. Daha sonra tekrar kontrol et!'}
              style={{ padding: 32 }}
            />
          )
        }
        ListFooterComponent={
          loading && rituals.length > 0 ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: LIGHT_CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: 16,
  },
  skeletonContainer: {
    padding: 16,
  },
  ritualCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  ritualCardContent: {
    flexDirection: 'row',
  },
  ritualImageContainer: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  ritualImage: {
    width: '100%',
    height: '100%',
  },
  ritualImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  ritualCardRight: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  ritualCardTop: {
    flex: 1,
  },
  ritualDate: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 4,
  },
  ritualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginBottom: 6,
  },
  ritualLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  ritualLocation: {
    fontSize: 13,
    color: LIGHT_TEXT_SECONDARY,
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  ritualTime: {
    fontSize: 12,
    color: LIGHT_TEXT_TERTIARY,
    marginBottom: 4,
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    color: ACCENT_AMBER,
    fontWeight: '500',
  },
  ritualCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ritualStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attendanceText: {
    fontSize: 12,
    color: LIGHT_TEXT_SECONDARY,
  },
  spotsRemainingText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '500',
    marginLeft: 8,
  },
  typeChip: {
    backgroundColor: `${PRIMARY_COLOR}1A`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeChipText: {
    fontSize: 11,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  feeChip: {
    backgroundColor: '#dcfce7',
    marginLeft: 6,
  },
  feeChipText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '700',
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
});
