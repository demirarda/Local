import { describe, test, expect } from '@jest/globals';
import { getPublicConfig } from '../services/publicConfigService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('public config (son-part.md §12)', () => {
  test('exposes ritual and check-in limits', () => {
    const cfg = getPublicConfig();
    expect(cfg.ritual.min_size).toBe(3);
    expect(cfg.ritual.window_hours_options).toEqual([3, 6, 12, 24]);
    expect(cfg.ritual.window_hours_default).toBe(12);
    expect(cfg.checkin.gps_radius_meters.custom).toBe(30);
    expect(cfg.checkin.gps_radius_meters.venue).toBe(50);
    expect(cfg.checkin.gps_radius_meters.venue_dense).toBe(75);
    expect(cfg.checkin.android_location_education).toMatch(/Hassas konum/);
  });

  test('badge highlight limits match localConfig', () => {
    const cfg = getPublicConfig();
    expect(cfg.badges.highlight_user).toBe(LOCAL_CONFIG.badges.HIGHLIGHT_USER);
    expect(cfg.badges.highlight_venue).toBe(LOCAL_CONFIG.badges.HIGHLIGHT_VENUE);
    expect(cfg.badges.families).toHaveLength(6);
    expect(cfg.venue.badge_max).toBe(5);
  });

  test('rs_display matches frozen v3.1 constants', () => {
    const cfg = getPublicConfig();
    expect(cfg.rs_display.k_up).toBe(0.15);
    expect(cfg.rs_display.k_down).toBe(0.3);
    expect(cfg.ds_display.mult_mature).toEqual([0.45, 0.75]);
  });

  test('regular threshold is 4 (v3 N:4) with no RS effect in service layer', () => {
    expect(getPublicConfig().regular.threshold).toBe(4);
    expect(getPublicConfig().regular.n).toBe(4);
  });
});
