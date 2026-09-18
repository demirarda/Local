/**
 * Master Parametre §10 — REGULAR
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { formatRegularCounter, computeIsRegular } from '../services/regularService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('regular config (§10)', () => {
  test('N=5 / 90g · vitrin default kapalı · counter UI açık', () => {
    expect(LOCAL_CONFIG.regular.N).toBe(5);
    expect(LOCAL_CONFIG.regular.THRESHOLD).toBe(5);
    expect(LOCAL_CONFIG.regular.WINDOW_D).toBe(90);
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
    expect(pub.n).toBe(5);
    expect(pub.window_d).toBe(90);
    expect(pub.vitrin_default).toBe(false);
    expect(pub.counter_ui).toBe(true);
    expect(pub.badge_ladder).toEqual([3, 10, 25]);
  });

  test('formatRegularCounter renders 2/4 style', () => {
    expect(formatRegularCounter(2, 5)).toBe('2/5');
    expect(formatRegularCounter(0, 5)).toBe('0/5');
    expect(formatRegularCounter(6, 5)).toBe('5/5');
  });

  test('§7 staff Regular sayacı hariç (ekip-bağı)', () => {
    const src = readFileSync(join(__dirname, '../services/regularService.js'), 'utf8');
    expect(src).toContain('staff_excluded');
    expect(src).toContain('venue_managers');
    expect(src).toContain('owner_user_id');
  });

  test('sönüm: 4/45 kazanır; son mühürden 60g sonra düşer', () => {
    const now = new Date('2026-08-14T12:00:00Z');
    expect(
      computeIsRegular({
        windowCount: 5,
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
