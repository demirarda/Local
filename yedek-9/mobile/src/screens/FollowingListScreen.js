import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { getFollows, unfollowUser } from '../services/api';
import useAuthStore from '../store/authStore';

const PRIMARY_COLOR = '#D4AF37';
const LIGHT_BACKGROUND = '#FFFFFF';
const LIGHT_CARD = '#F8F9FA';
const LIGHT_TEXT_PRIMARY = '#000000';
const LIGHT_TEXT_SECONDARY = '#6B7280';
const LIGHT_TEXT_TERTIARY = '#9CA3AF';
const GREEN_ACCENT = '#10B981';
const ORANGE_ACCENT = '#F97316';
const BRAND_ACCENT = '#7C3AED';

function normalizeInitialTab(route) {
  const filter = String(route.params?.filter || '').toLowerCase();
  const initialType = String(route.params?.initialType || '').toLowerCase();
  const initialTab = String(route.params?.initialTab || '').toLowerCase();
  if (filter === 'brand' || initialTab === 'brand' || initialTab === 'brands') return 'brands';
  if (filter === 'venue' || initialTab === 'venue' || initialTab === 'venues') return 'venues';
  if (initialType === 'followers' || initialTab === 'followers') return 'followers';
  if (filter === 'host' || initialTab === 'hosts' || initialTab === 'host') return 'hosts';
  if (initialType === 'following') return 'hosts';
  return 'hosts';
}

export default function FollowingListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthStore();
  const userId = route.params?.userId || user?.id;

  const [activeTab, setActiveTab] = useState(() => normalizeInitialTab(route));
  const [hosts, setHosts] = useState([]);
  const [venues, setVenues] = useState([]);
  const [brands, setBrands] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [userId]);

  useEffect(() => {
    setActiveTab(normalizeInitialTab(route));
  }, [route.params?.filter, route.params?.initialType, route.params?.initialTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [followingData, followersData] = await Promise.all([
        getFollows(userId, 'following'),
        getFollows(userId, 'followers').catch(() => []),
      ]);

      const hostsList = (followingData || [])
        .filter((item) => item.role === 'host' || item.role === 'user' || !item.role)
        .map((item) => {
          const u = item.user || {};
          return {
            id: u.id || item.user_id,
            follow_id: item.id,
            name: u.name || 'Bilinmiyor',
            city: u.city,
            university: u.university,
            rs_score: u.rs_score || 5.0,
            role: item.role || 'host',
            is_verified: u.is_host_verified || false,
          };
        });

      const venuesList = (followingData || [])
        .filter((item) => item.role === 'venue')
        .map((item) => {
          const u = item.user || {};
          return {
            id: u.id || item.user_id,
            follow_id: item.id,
            name: u.name || item.venue_name || 'Bilinmiyor',
            city: u.city,
            address: u.address,
            role: 'venue',
            is_verified: u.is_venue_verified || false,
          };
        });

      const brandsList = (followingData || [])
        .filter((item) => item.role === 'brand' || item.brand_id || item.user?.brand_id)
        .map((item) => {
          const u = item.user || {};
          const brandId = item.brand_id || u.brand_id;
          return {
            id: u.id || item.user_id,
            brand_id: brandId,
            follow_id: item.id,
            name: u.name || item.venue_name || 'Bilinmiyor',
            city: u.city,
            role: 'brand',
            is_verified: true,
          };
        });

      const followersList = (followersData || []).map((item) => {
        const u = item.user || {};
        return {
          id: u.id || item.user_id,
          follow_id: item.id,
          name: u.name || 'Bilinmiyor',
          city: u.city,
          university: u.university,
          rs_score: u.rs_score || 5.0,
          role: item.role || 'user',
          is_verified: u.is_host_verified || false,
        };
      });

      setHosts(hostsList);
      setVenues(venuesList);
      setBrands(brandsList);
      setFollowers(followersList);
    } catch (error) {
      console.error('Takip listesi yukleme hatasi:', error);
      Alert.alert('Hata', 'Veriler yuklenemedi. Lutfen tekrar dene.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUnfollow = async (item) => {
    if (activeTab === 'followers') return;
    Alert.alert(
      'Takipten Cik',
      `${item.name} icin takipten cikmak istedigine emin misin?`,
      [
        { text: 'Iptal', style: 'cancel' },
        {
          text: 'Takipten Cik',
          style: 'destructive',
          onPress: async () => {
            try {
              await unfollowUser(userId, item.id);
              loadData();
            } catch (error) {
              console.error('Takipten cikma hatasi:', error);
              Alert.alert('Hata', 'Takipten cikilamadi. Lutfen tekrar dene.');
            }
          },
        },
      ]
    );
  };

  const handleItemPress = (item) => {
    if (item.role === 'brand' && item.brand_id) {
      navigation.navigate('BrandProfile', { brandId: item.brand_id });
      return;
    }
    if (item.role === 'venue') {
      navigation.navigate('VenueDetail', { venueId: item.id });
      return;
    }
    if (item.id) {
      navigation.navigate('ParticipantProfile', { userId: item.id });
    }
  };

  const tabs = useMemo(
    () => [
      { id: 'hosts', label: `Hostlar (${hosts.length})` },
      { id: 'venues', label: `Mekanlar (${venues.length})` },
      { id: 'brands', label: `Brand (${brands.length})` },
      // Takipçi sayısı tab'da değil — liste başında (vanity freni 🔒)
      { id: 'followers', label: 'Takipçiler' },
    ],
    [hosts.length, venues.length, brands.length]
  );

  const currentData =
    activeTab === 'venues'
      ? venues
      : activeTab === 'brands'
        ? brands
        : activeTab === 'followers'
          ? followers
          : hosts;
  const count = currentData.length;

  const renderItem = ({ item }) => {
    const isHost = item.role === 'host' || item.role === 'user' || !item.role;
    const isBrand = item.role === 'brand';

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemContent}>
          <View style={[styles.avatar, isBrand && styles.avatarBrand]}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_verified && (
                <MaterialIcons
                  name={isHost ? 'verified' : isBrand ? 'storefront' : 'business'}
                  size={16}
                  color={isHost ? PRIMARY_COLOR : isBrand ? BRAND_ACCENT : GREEN_ACCENT}
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            {item.city ? (
              <Text style={styles.city} numberOfLines={1}>
                {item.city}
                {item.university ? ` • ${item.university}` : ''}
              </Text>
            ) : null}
            {item.address ? (
              <Text style={styles.address} numberOfLines={1}>
                {item.address}
              </Text>
            ) : null}
            {isHost && item.rs_score !== undefined ? (
              <View style={styles.rsBadge}>
                <MaterialIcons name="star" size={12} color={ORANGE_ACCENT} />
                <Text style={styles.rsText}>{Number(item.rs_score).toFixed(1)} RS</Text>
              </View>
            ) : null}
            {!isHost && !isBrand ? (
              <View style={styles.venueBadge}>
                <MaterialIcons name="business" size={12} color={GREEN_ACCENT} />
                <Text style={styles.venueBadgeText}>Mekan</Text>
              </View>
            ) : null}
            {isBrand ? (
              <View style={[styles.venueBadge, styles.brandBadge]}>
                <MaterialIcons name="storefront" size={12} color={BRAND_ACCENT} />
                <Text style={[styles.venueBadgeText, { color: BRAND_ACCENT }]}>Brand</Text>
              </View>
            ) : null}
          </View>
        </View>
        {activeTab !== 'followers' ? (
          <TouchableOpacity style={styles.unfollowButton} onPress={() => handleUnfollow(item)}>
            <Text style={styles.unfollowButtonText}>Takipten Cik</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const emptyCopy = {
    hosts: {
      title: 'Henuz takip edilen host yok',
      sub: 'Hostlari takip ederek Ritualsini Pulse akisinda gorebilirsin.',
      icon: 'person-outline',
    },
    venues: {
      title: 'Henuz takip edilen mekan yok',
      sub: 'Mekanlari takip ederek favori yerlerindeki Ritualsi kesfedebilirsin.',
      icon: 'business',
    },
    brands: {
      title: 'Henuz takip edilen brand yok',
      sub: 'Brand bagli mekanlari takip ettiginde burada listelenir.',
      icon: 'storefront',
    },
    followers: {
      title: 'Henuz takipci yok',
      sub: 'Seni takip edenler burada gorunur.',
      icon: 'group',
    },
  }[activeTab];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="chevron-left" size={24} color={LIGHT_TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeTab === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {activeTab === 'followers' && !loading ? (
        <View style={styles.listCountBanner}>
          <Text style={styles.listCountText}>
            {followers.length} takipçi
          </Text>
        </View>
      ) : null}

      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : count === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name={emptyCopy.icon} size={64} color={LIGHT_TEXT_TERTIARY} />
          <Text style={styles.emptyText}>{emptyCopy.title}</Text>
          <Text style={styles.emptySubtext}>{emptyCopy.sub}</Text>
        </View>
      ) : (
        <FlatList
          data={currentData}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.role}-${item.id}-${item.follow_id || ''}`}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
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
    paddingTop: 44,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  placeholder: {
    width: 40,
  },
  listCountBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  listCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: LIGHT_TEXT_SECONDARY,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '500',
    color: LIGHT_TEXT_TERTIARY,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  itemContainer: {
    backgroundColor: LIGHT_CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: LIGHT_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarBrand: {
    borderRadius: 10,
    borderColor: `${BRAND_ACCENT}55`,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: LIGHT_TEXT_PRIMARY,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginRight: 4,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  city: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    marginBottom: 2,
  },
  address: {
    fontSize: 12,
    color: LIGHT_TEXT_TERTIARY,
    marginBottom: 4,
  },
  rsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${ORANGE_ACCENT}15`,
  },
  rsText: {
    fontSize: 11,
    fontWeight: '600',
    color: ORANGE_ACCENT,
    marginLeft: 4,
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${GREEN_ACCENT}15`,
  },
  brandBadge: {
    backgroundColor: `${BRAND_ACCENT}15`,
  },
  venueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: GREEN_ACCENT,
    marginLeft: 4,
  },
  unfollowButton: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  unfollowButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: LIGHT_TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
