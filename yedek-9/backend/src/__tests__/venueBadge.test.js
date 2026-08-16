import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { handDistributeVenueBadge } from '../services/venueBadgeService.js';
import { isNegativeBadgeSlug, resolveBadgeFamily } from '../services/badgeEngine.js';

describe('venue badge §9', () => {
  test('hand-distribute is always forbidden', async () => {
    const r = await handDistributeVenueBadge();
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  test('resolveBadgeFamily maps legacy + venue/milestone', () => {
    expect(resolveBadgeFamily({ spec_category: 'content' })).toBe('MASTERY');
    expect(resolveBadgeFamily({ spec_category: 'location' })).toBe('ZONE');
    expect(resolveBadgeFamily({ spec_category: 'venue' })).toBe('VENUE');
    expect(resolveBadgeFamily({ spec_category: 'milestone' })).toBe('MILESTONE');
    expect(resolveBadgeFamily({ family: 'SPECIAL' })).toBe('SPECIAL');
  });

  test('under_trial is negative and not a catalog earn path', () => {
    expect(isNegativeBadgeSlug('under_trial')).toBe(true);
    expect((LOCAL_CONFIG.badges.CATALOG || []).some((b) => b.slug === 'under_trial')).toBe(false);
  });
});
