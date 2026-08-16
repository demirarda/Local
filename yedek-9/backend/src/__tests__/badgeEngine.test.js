import { describe, test, expect } from '@jest/globals';
import {
  levelFromProgress,
  evaluateRuleLevel,
  compareLevels,
  formatRuleCondition,
  computeRuleProgress,
  userMeetsBadgeRequirement,
} from '../services/badgeEngine.js';
import { buildLiveActivityPayload } from '../services/liveActivityService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('badge engine F6 (§10)', () => {
  test('levelFromProgress picks highest achieved tier', () => {
    expect(levelFromProgress(4, { novice: 1, regular: 3, master: 6 })).toBe('regular');
    expect(levelFromProgress(10, { novice: 1, regular: 3, master: 6 })).toBe('master');
  });

  test('compareLevels orders novice < regular < master', () => {
    expect(compareLevels('master', 'novice')).toBeGreaterThan(0);
  });

  test('evaluateRuleLevel for unique_cities', () => {
    const level = evaluateRuleLevel(
      { type: 'unique_cities', thresholds: { novice: 1, regular: 3, master: 6 } },
      { unique_cities: 3 }
    );
    expect(level).toBe('regular');
  });

  test('config has 6 badge families (§9)', () => {
    expect(LOCAL_CONFIG.badges.CATEGORIES).toEqual([
      'SPECIAL', 'MASTERY', 'BEHAVIORAL', 'VENUE', 'ZONE', 'MILESTONE',
    ]);
    const families = new Set(
      (LOCAL_CONFIG.badges.CATALOG || []).map((b) =>
        LOCAL_CONFIG.badges.CATEGORY_MAP[b.spec_category] || b.family
      )
    );
    expect(families.has('VENUE')).toBe(true);
    expect(families.has('MILESTONE')).toBe(true);
    expect(families.has('ZONE')).toBe(true);
  });

  test('negative badges cannot be door conditions', async () => {
    const ok = await userMeetsBadgeRequirement(
      '00000000-0000-0000-0000-000000000000',
      'under_trial',
      'novice'
    );
    expect(ok).toBe(false);
  });

  test('highlight max user is 3', () => {
    expect(LOCAL_CONFIG.badges.HIGHLIGHT_USER).toBe(3);
  });

  test('venue badge rules: max 5, shield, allowed conditions', () => {
    expect(LOCAL_CONFIG.badges.VENUE_BADGE.MAX).toBe(5);
    expect(LOCAL_CONFIG.badges.VENUE_BADGE.SHIELD_TEMPLATE).toBe('shield_v1');
    expect(LOCAL_CONFIG.badges.VENUE_BADGE.ALLOWED_CONDITIONS).toEqual(
      expect.arrayContaining(['visit', 'category', 'slot', 'event'])
    );
    expect(LOCAL_CONFIG.badges.VENUE_BADGE.FORBIDDEN_CONDITIONS).toEqual(
      expect.arrayContaining(['spend', 'subjective'])
    );
  });

  test('LLM pipeline stays off at launch', () => {
    expect(LOCAL_CONFIG.badges.LLM_PIPELINE_ENABLED).toBe(false);
  });

  test('formatRuleCondition renders thresholds', () => {
    const text = formatRuleCondition({
      type: 'hosted_rituals',
      thresholds: { novice: 2, regular: 5, master: 12 },
    });
    expect(text).toMatch(/Novice: 2/);
    expect(text).toMatch(/Master: 12/);
  });

  test('computeRuleProgress for partial hosted_rituals', () => {
    const p = computeRuleProgress(
      { type: 'hosted_rituals', thresholds: { novice: 2, regular: 5, master: 12 } },
      { hosted_rituals: 1 }
    );
    expect(p.value).toBe(1);
    expect(p.next_level).toBe('novice');
    expect(p.progress_pct).toBeGreaterThan(0);
  });

  test('userMeetsBadgeRequirement without DB returns false', async () => {
    const ok = await userMeetsBadgeRequirement('00000000-0000-0000-0000-000000000000', 'founder', 'novice');
    expect(ok).toBe(false);
  });

  test('catalog has at least 24 badges', () => {
    expect((LOCAL_CONFIG.badges.CATALOG || []).length).toBeGreaterThanOrEqual(24);
  });
});

describe('live activity payload F6 (§8.4)', () => {
  test('buildLiveActivityPayload for live phase', () => {
    const start = new Date(Date.now() - 15 * 60000);
    const ritual = {
      id: 'r1',
      title: 'Test Ritual',
      status: 'live',
      start_time: start.toISOString(),
      duration: 60,
      live_window_hours: 3,
    };
    const payload = buildLiveActivityPayload(ritual);
    expect(payload.active).toBe(true);
    expect(payload.phase).toBe('live');
    expect(payload.brand_mark).toBe('L');
    expect(payload.remaining_seconds).toBeGreaterThan(0);
  });
});
