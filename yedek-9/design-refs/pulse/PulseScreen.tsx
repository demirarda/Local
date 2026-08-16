import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const PulseScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Create Ritual Button */}
          <TouchableOpacity>
            <LinearGradient
              colors={['#e8b86d', '#d4a05a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createBtn}
            >
              <View style={styles.createIcon}>
                <Text style={styles.createIconText}>+</Text>
              </View>
              <Text style={styles.createText}>Create{'\n'}Ritual</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Logo */}
          <Text style={styles.logo}>L.</Text>

          {/* Menu Button */}
          <TouchableOpacity style={styles.menuBtn}>
            <Text style={styles.menuText}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabs}
        >
          <LinearGradient
            colors={['#e8b86d', '#d4a05a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.tab, styles.tabActive]}
          >
            <Text style={styles.tabTextActive}>All</Text>
          </LinearGradient>
          <View style={styles.tab}>
            <Text style={styles.tabText}>Live Now</Text>
          </View>
          <View style={styles.tab}>
            <Text style={styles.tabText}>Friends</Text>
          </View>
          <View style={styles.tab}>
            <Text style={styles.tabText}>Followed</Text>
          </View>
          <View style={styles.tab}>
            <Text style={styles.tabText}>Special Events</Text>
          </View>
        </ScrollView>
      </View>

      {/* Feed */}
      <ScrollView style={styles.feed} showsVerticalScrollIndicator={false}>
        {/* Hero Special Event Card */}
        <View style={styles.heroCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&h=500&fit=crop' }}
            style={styles.heroBg}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(40,30,20,0.9)']}
            style={styles.heroOverlay}
          >
            <LinearGradient
              colors={['#e8b86d', '#d4a05a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.specialBadge}
            >
              <Text style={styles.specialBadgeText}>⭐ SPECIAL EVENT</Text>
            </LinearGradient>

            <Text style={styles.heroTime}>20:30 Tonight</Text>
            <Text style={styles.heroTitle}>Jazz Night at Blue Note</Text>
            <Text style={styles.heroLocation}>Navigli · Milano</Text>
            
            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>✓ Verified Venue</Text>
              <Text style={styles.heroMetaText}>·</Text>
              <Text style={styles.heroMetaText}>45 people interested</Text>
            </View>

            <View style={styles.heroTags}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>Music</Text>
              </View>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>Social</Text>
              </View>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>Vibrant</Text>
              </View>
            </View>

            <View style={styles.heroBottom}>
              <View style={styles.friendsInterested}>
                <View style={styles.avatarStack}>
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=1' }} style={[styles.avatar, { marginLeft: 0 }]} />
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=2' }} style={styles.avatar} />
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=3' }} style={styles.avatar} />
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=4' }} style={styles.avatar} />
                </View>
                <Text style={styles.friendsText}>8 friends are interested</Text>
              </View>
              
              <TouchableOpacity>
                <LinearGradient
                  colors={['#e8b86d', '#d4a05a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Get Seat</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Two Column Section */}
        <View style={styles.twoCol}>
          {/* Host Memory Share */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>HOST MEMORY SHARE</Text>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop' }}
              style={styles.memoryImage}
            />
            <Text style={styles.memoryMeta}>🟡 Host you follow · 45m ago</Text>
            <Text style={styles.memorySubtitle}>Shared a ritual memory</Text>
            <Text style={styles.memoryTitle}>Sunset Aperitivo</Text>
            <Text style={styles.memoryLocation}>Terrazza Aperol</Text>
            <Text style={styles.memoryTag}>🔥 High energy</Text>
            
            <TouchableOpacity>
              <LinearGradient
                colors={['#e8b86d', '#d4a05a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnSmall}
              >
                <Text style={styles.btnText}>View</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Live Now Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LIVE NOW</Text>
            
            <View style={styles.liveTime}>
              <View style={styles.liveDot} />
              <Text style={styles.timeText}>11:30</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            <Text style={styles.liveTitle}>Brunch Circle</Text>
            <Text style={styles.liveLocation}>Brera · Milano</Text>
            <Text style={styles.liveFriends}>2 friends just joined</Text>

            <View style={styles.liveAvatars}>
              <Image source={{ uri: 'https://i.pravatar.cc/150?img=5' }} style={[styles.smallAvatar, { marginLeft: 0 }]} />
              <Image source={{ uri: 'https://i.pravatar.cc/150?img=6' }} style={styles.smallAvatar} />
            </View>

            <Text style={styles.liveSeats}>6 seats left</Text>
            <Text style={styles.liveVerified}>✓ Verified Host</Text>

            <TouchableOpacity>
              <LinearGradient
                colors={['#e74c3c', '#c0392b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.btnSmall}
              >
                <Text style={styles.btnTextWhite}>Join</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Venue Activity Card */}
        <LinearGradient
          colors={['#2a2a2a', '#1a1a1a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.venueCard}
        >
          <Text style={styles.venueLabel}>VENUE ACTIVITY CARD</Text>
          <Text style={styles.venueMeta}>Venue you follow · Active now</Text>
          <Text style={styles.venueName}>Caffè Letterario</Text>
          <Text style={styles.venueVerified}>✓ Verified Venue</Text>

          <View style={styles.venueRituals}>
            <Text style={styles.ritualsTitle}>3 rituals happening today:</Text>
            <Text style={styles.ritualsList}>
              • 14:00 Book Discussion{'\n'}
              • 17:00 Writing Circle{'\n'}
              • 20:00 Poetry Reading
            </Text>
          </View>

          <TouchableOpacity>
            <LinearGradient
              colors={['#e8b86d', '#d4a05a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnSmall}
            >
              <Text style={styles.btnText}>See All</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Friend Activity Card */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <View style={styles.friendHeader}>
            <Text style={styles.friendHeaderText}>👥 FRIEND ACTIVITY CARD</Text>
          </View>
          <Text style={styles.friendSubtitle}>Someone you know joined:</Text>
          <Text style={styles.friendTitle}>Morning Yoga Session</Text>
          <Text style={styles.friendLocation}>Parco Sempione · Starting in 25 min</Text>

          <View style={styles.friendTags}>
            <View style={styles.friendTag}>
              <Text style={styles.friendTagText}>Calm</Text>
            </View>
            <View style={styles.friendTag}>
              <Text style={styles.friendTagText}>Active</Text>
            </View>
          </View>

          <TouchableOpacity>
            <LinearGradient
              colors={['#e8b86d', '#d4a05a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnSmall}
            >
              <Text style={styles.btnText}>Join Them</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Starting Soon Card */}
        <View style={[styles.card, styles.soonCard]}>
          <View style={styles.soonContent}>
            <Text style={styles.soonLabel}>STARTING SOON CARD</Text>
            <Text style={styles.soonTitle}>Sunset Run & Chill</Text>
          </View>
          <View style={styles.soonTime}>
            <Text style={styles.soonTimeText}>Starting in 1h 15m</Text>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <LinearGradient
            colors={['#e8b86d', '#d4a05a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.navIconFilled}
          >
            <View style={styles.navIconCircle} />
          </LinearGradient>
          <Text style={styles.navTextActive}>Pulse</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📅</Text>
          <Text style={styles.navText}>City Rhythm</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Social Passport</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  header: {
    backgroundColor: '#f5f0e8',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    shadowColor: '#d4a05a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createIcon: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconText: {
    fontSize: 24,
    color: '#000',
    fontWeight: '600',
  },
  createText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    lineHeight: 16,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    position: 'absolute',
    left: '50%',
    marginLeft: -32,
  },
  menuBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 24,
    color: '#000',
  },
  filterTabs: {
    marginTop: 16,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 8,
  },
  tabActive: {
    shadowColor: '#d4a05a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  tabTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  feed: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    height: 280,
  },
  heroBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  heroOverlay: {
    flex: 1,
    padding: 20,
  },
  specialBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  specialBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
  },
  heroTime: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  heroLocation: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  heroMetaText: {
    fontSize: 13,
    color: '#fff',
  },
  heroTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  heroTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
  },
  heroTagText: {
    fontSize: 12,
    color: '#fff',
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendsInterested: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.8)',
    marginLeft: -8,
  },
  friendsText: {
    fontSize: 12,
    color: '#fff',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    shadowColor: '#d4a05a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  btnTextWhite: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  memoryImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  memoryMeta: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  memorySubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  memoryLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  memoryTag: {
    fontSize: 12,
    marginBottom: 12,
  },
  btnSmall: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  liveTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    backgroundColor: '#e74c3c',
    borderRadius: 4,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: '#ffe5e5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e74c3c',
  },
  liveTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  liveLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  liveFriends: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  liveAvatars: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    marginLeft: -8,
  },
  liveSeats: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '600',
    marginBottom: 8,
  },
  liveVerified: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  venueCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  venueLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#ccc',
    marginBottom: 8,
  },
  venueMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  venueName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  venueVerified: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 16,
  },
  venueRituals: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  ritualsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  ritualsList: {
    fontSize: 13,
    lineHeight: 23,
    color: '#ccc',
  },
  friendHeader: {
    marginBottom: 12,
  },
  friendHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  friendSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  friendTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  friendLocation: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  friendTags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  friendTag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  friendTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  soonCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  soonContent: {
    flex: 1,
  },
  soonLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  soonTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  soonTime: {
    backgroundColor: '#e8e8e8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  soonTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f5f0e8',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  navItem: {
    alignItems: 'center',
    gap: 6,
  },
  navIconFilled: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconCircle: {
    width: 16,
    height: 16,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  navIcon: {
    fontSize: 24,
  },
  navText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999',
  },
  navTextActive: {
    fontSize: 11,
    fontWeight: '500',
    color: '#d4a05a',
  },
});

export default PulseScreen;
