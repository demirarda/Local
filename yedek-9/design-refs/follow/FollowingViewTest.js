/**
 * FollowingView Test Wrapper
 * ===========================
 *
 * Mock paginated fetch ile gerçek davranış.
 *
 * Kullanım:
 *   import FollowingViewTest from './screens/FollowingViewTest';
 *   export default function App() {
 *     return <FollowingViewTest />;
 *   }
 *
 * Davranış:
 *   - Toplam 60 mock item, 5 tip karışık (random feed)
 *   - Sayfa başına 15 item
 *   - 800ms network delay
 *   - 4 sayfa sonra "hepsi bu kadar"
 *   - Pull-to-refresh state'i sıfırlar
 */

import React from 'react';
import FollowingView from './FollowingView';

const TOTAL_MOCK_ITEMS = 60;
const PAGE_SIZE = 15;
const NETWORK_DELAY_MS = 800;

const mockNav = {
  navigate: (screen, params) => {
    console.log(`[MOCK] navigate → ${screen}`, params);
  },
};

function generateMockItems() {
  const items = [];
  const kinds = ['host', 'venue', 'creator', 'partner'];

  for (let i = 0; i < TOTAL_MOCK_ITEMS; i++) {
    const kind = kinds[i % 4];
    const hoursAgo = i * 3;
    const daysFollowed = 30 + i * 15;
    const postedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    const followedSince = new Date(Date.now() - daysFollowed * 24 * 60 * 60 * 1000).toISOString();

    const typeIdx = i % 5;

    if (typeIdx === 0) {
      items.push({
        id: `item_${i}`,
        type: 'host-ritual',
        postedAt,
        title: `Sunset Aperitivo #${i + 1}`,
        coverImage: `https://picsum.photos/seed/ritual${i}/900/500`,
        ritual: {
          time: i % 2 === 0 ? 'Cuma 18:30' : 'Cumartesi 19:00',
          venue: 'Terrazza Aperol',
          seats: 12 - (i % 8),
        },
        entity: {
          id: `host_${i}`,
          kind: 'host',
          name: `Host ${i + 1}`,
          avatar: `https://picsum.photos/seed/host${i}/200/200`,
          verified: i % 3 === 0,
          followedSince,
          isActive: false,
          avgPostsPerWeek: 2,
        },
        going: {
          count: 8 + (i % 5),
          friendsCount: i % 5,
          avatars: [
            `https://picsum.photos/seed/g1_${i}/80/80`,
            `https://picsum.photos/seed/g2_${i}/80/80`,
            `https://picsum.photos/seed/g3_${i}/80/80`,
          ],
        },
      });
    } else if (typeIdx === 1) {
      items.push({
        id: `item_${i}`,
        type: 'venue-live',
        postedAt,
        entity: {
          id: `venue_${i}`,
          kind: 'venue',
          name: `Venue ${i + 1}`,
          avatar: `https://picsum.photos/seed/venue${i}/400/400`,
          verified: i % 2 === 0,
          followedSince,
          isActive: i % 10 < 2,
          occupancy: 8 + (i % 20),
          location: `Bölge ${(i % 5) + 1}'de ${(i % 3) + 1}${(i % 4) * 10}0m`,
          avgPostsPerWeek: 1,
        },
        nowPlaying: i % 2 === 0 ? { title: 'So What', artist: 'Miles Davis' } : null,
        friendsInside:
          i % 3 === 0
            ? [
                { name: 'Alessandro', avatar: `https://picsum.photos/seed/f1_${i}/80/80` },
                { name: 'Sofia', avatar: `https://picsum.photos/seed/f2_${i}/80/80` },
              ]
            : [],
      });
    } else if (typeIdx === 2) {
      items.push({
        id: `item_${i}`,
        type: 'creator-pulse',
        postedAt,
        entity: {
          id: `creator_${i}`,
          kind: 'creator',
          name: `Creator ${i + 1}`,
          avatar: `https://picsum.photos/seed/creator${i}/300/300`,
          isPivot: true,
          tag: ['Poetry Nights', 'Jazz Sessions', 'Book Clubs'][i % 3],
          followedSince,
          ritualsTotal: 20 + i,
          ritualsThisMonth: 4 + (i % 8),
          avgPostsPerWeek: 3,
          weeklyActivityDates: [
            new Date(Date.now() - 6 * 86400000).toISOString(),
            new Date(Date.now() - 5 * 86400000).toISOString(),
            new Date(Date.now() - 3 * 86400000).toISOString(),
            new Date(Date.now() - 1 * 86400000).toISOString(),
            new Date().toISOString(),
          ],
        },
        recentHighlight: {
          text: `Bugün "Thursday Walk" ritüelini ${(i % 3) + 2}. kez düzenliyor`,
          boldText: 'Thursday Walk',
        },
      });
    } else if (typeIdx === 3) {
      items.push({
        id: `item_${i}`,
        type: 'host-voice',
        postedAt,
        text: [
          'Burada sadece içki içmiyoruz. Belki kendimizi yazıyoruz, belki birbirimizi.',
          'Cumartesi sabahları sessiz başlamalı. Kahve, defter, pencere.',
          'Şehri yürürken keşfedersin. Otururken anlarsın.',
        ][i % 3],
        timestamp: `${Math.floor(hoursAgo) || 1}SA`,
        entity: {
          id: `host_voice_${i}`,
          kind: 'host',
          name: `Host ${i + 1}`,
          avatar: `https://picsum.photos/seed/hv${i}/200/200`,
          verified: i % 2 === 0,
          role: 'Poetry Nights · host',
          followedSince,
          avgPostsPerWeek: 1,
        },
      });
    } else {
      items.push({
        id: `item_${i}`,
        type: 'host-memory',
        postedAt,
        image: `https://picsum.photos/seed/mem${i}/600/800`,
        title: ['Jazz Night', 'Dinner Series', 'Morning Coffee'][i % 3],
        meta: `${i % 2 === 0 ? 'Dün' : `${(i % 7) + 1}g`} · ${['Blue Note', 'Navigli', 'Brera'][i % 3]}`,
        reactions: `${i % 2 === 0 ? '🔥' : '♥'} ${40 + i * 2}`,
        entity: {
          id: `memory_entity_${i % 10}`,
          kind,
          name: `Entity ${(i % 10) + 1}`,
          avatar: `https://picsum.photos/seed/me${i}/100/100`,
          followedSince,
          avgPostsPerWeek: 2,
        },
      });
    }
  }

  return items;
}

const ALL_MOCK_ITEMS = generateMockItems();

/**
 * Paginated fetch simulator.
 * @param {object} params - { offset, limit }
 * @returns {Promise<{items, hasMore}>}
 */
async function mockFetchFollowing({ offset, limit }) {
  await new Promise((r) => setTimeout(r, NETWORK_DELAY_MS));

  const page = ALL_MOCK_ITEMS.slice(offset, offset + limit);
  const hasMore = offset + limit < ALL_MOCK_ITEMS.length;

  console.log(
    `[MOCK] fetchFollowing({offset: ${offset}, limit: ${limit}}) → ${page.length} items, hasMore: ${hasMore}`
  );

  return { items: page, hasMore };
}

export default function FollowingViewTest() {
  return (
    <FollowingView
      fetchFollowing={mockFetchFollowing}
      navigation={mockNav}
      onBack={() => console.log('[MOCK] back pressed')}
      pageSize={PAGE_SIZE}
    />
  );
}
