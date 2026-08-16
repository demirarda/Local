/**
 * Master Parametre §10 — REGULAR
 */
import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { formatRegularCounter, computeIsRegular } from '../services/regularService.js';

describe('regular config (§10)', () => {
  test('N=4 / 45g · vitrin default kapalı · counter UI açık', () => {
    expect(LOCAL_CONFIG.regular.N).toBe(4);
    expect(LOCAL_CONFIG.regular.THRESHOLD).toBe(4);
    expect(LOCAL_CONFIG.regular.WINDOW_D).toBe(45);
    expect(LOCAL_CONFIG.regular.DECAY_D).toBe(60);
    expect(LOCAL_CONFIG.regular.VITRIN_DEFAULT).toBe(false);
    expect(LOCAL_CONFIG.regular.COUNTER_UI).toBe(true);
    expect(LOCAL_CONFIG.regular.SILENT_DECAY).toBe(true);
    expect(LOCAL_CONFIG.regular.BADGE_LADDER).toEqual([3, 10, 25]);
  });

  test('venue_regular badge ladder matches 3 / 10 / 25', () => {
    const badge = LOCAL_CONFIG.badges.CATALOG.find((b) => b.slug === 'venue_regular');
    expect(badge).toBeTruthy();
    expect(badge.rule.thresholds).toEqual({ novice: 3, regular: 10, master: 25 });
  });

  test('public config exposes counter + vitrin defaults', () => {
    const pub = getPublicConfig().regular;
    expect(pub.n).toBe(4);
    expect(pub.window_d).toBe(45);
    expect(pub.vitrin_default).toBe(false);
    expect(pub.counter_ui).toBe(true);
    expect(pub.badge_ladder).toEqual([3, 10, 25]);
  });

  test('formatRegularCounter renders 2/4 style', () => {
    expect(formatRegularCounter(2, 4)).toBe('2/4');
    expect(formatRegularCounter(0, 4)).toBe('0/4');
    expect(formatRegularCounter(5, 4)).toBe('4/4');
  });

  test('sönüm: 4/45 kazanır; son mühürden 60g sonra düşer', () => {
    const now = new Date('2026-08-14T12:00:00Z');
    expect(
      computeIsRegular({
        windowCount: 4,
        lastCheckinAt: '2026-08-14T10:00:00Z',
        wasRegular: false,
        now,
      })
    ).toBe(true);
    expect(
      computeIsRegular({
        windowCount: 1,
        lastCheckinAt: '2026-06-30T12:00:00Z',
        wasRegular: true,
        now,
      })
    ).toBe(true);
    expect(
      computeIsRegular({
        windowCount: 0,
        lastCheckinAt: '2026-06-10T12:00:00Z',
        wasRegular: true,
        now,
      })
    ).toBe(false);
    expect(
      computeIsRegular({
        windowCount: 2,
        lastCheckinAt: '2026-08-01T12:00:00Z',
        wasRegular: false,
        now,
      })
    ).toBe(false);
  });
});
