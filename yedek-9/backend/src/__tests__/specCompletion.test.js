import { describe, it, expect } from '@jest/globals';
import { runAllSanitySimulations } from '../services/rsSanitySimulation.js';
import { normalizeFloorPlan } from '../services/venueOnboardingService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('spec completion v1', () => {
  it('RS sanity scenarios all pass after calibration', () => {
    const report = runAllSanitySimulations();
    expect(report.all_pass).toBe(true);
    expect(report.passed).toBe(report.total);
  });

  it('DS MAX_WINDOW_CAPACITY is set', () => {
    expect(LOCAL_CONFIG.ds.MAX_WINDOW_CAPACITY).toBe(12);
  });

  it('badge catalog has expanded entries', () => {
    expect(LOCAL_CONFIG.badges.CATALOG.length).toBeGreaterThanOrEqual(24);
  });

  it('normalizeFloorPlan requires tables array', () => {
    const plan = normalizeFloorPlan({ tables: [{ label: 'A', seats: 6 }] });
    expect(plan.tables).toHaveLength(1);
    expect(plan.tables[0].seats).toBe(6);
  });

  it('stubs document passive Yıl 1+ features', () => {
    expect(LOCAL_CONFIG.stubs.MUSIC_SYNC_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.RECURRING_RITUALS_ENABLED).toBe(true);
  });
});
