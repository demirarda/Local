import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isFollowerCountListOnly,
  stripFollowerCountsFromProfile,
  listCountMeta,
} from '../services/followerCountPolicy.js';

describe('follower-count liste-içi 🔒', () => {
  test('FOLLOWER_COUNT_IN_LIST_ONLY locked on', () => {
    expect(LOCAL_CONFIG.account_privacy.FOLLOWER_COUNT_IN_LIST_ONLY).toBe(true);
    expect(isFollowerCountListOnly()).toBe(true);
  });

  test('stripFollowerCountsFromProfile removes vanity fields', () => {
    const out = stripFollowerCountsFromProfile({
      id: 'u1',
      name: 'Ada',
      followers_count: 99,
      followingCount: 12,
      rituals_attended: 3,
    });
    expect(out.followers_count).toBeUndefined();
    expect(out.followingCount).toBeUndefined();
    expect(out.rituals_attended).toBe(3);
    expect(out.profile_shows_follower_count).toBe(false);
    expect(out.follower_count_placement).toBe('list_only');
  });

  test('listCountMeta exposes count for list page only', () => {
    const m = listCountMeta(7);
    expect(m.count).toBe(7);
    expect(m.count_placement).toBe('list_only');
    expect(m.profile_shows_count).toBe(false);
  });
});
