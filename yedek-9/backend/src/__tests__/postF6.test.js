import { describe, test, expect } from '@jest/globals';
import { simulateScenario, runAllSanitySimulations } from '../services/rsSanitySimulation.js';
import { buildPackageCatalog } from '../services/venueBusinessService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('RS sanity simulation (post-F6)', () => {
  test('first perfect ritual moves RS slightly up', () => {
    const r = simulateScenario({
      id: 't',
      start_rs: 5.0,
      target_rs: 5.08,
      tolerance: 0.1,
      rituals: 1,
      s_r: 0.95,
    });
    expect(r.actual_rs).toBeGreaterThan(5.0);
    expect(r.pass).toBe(true);
  });

  test('three noshow penalties reduce RS', () => {
    const r = simulateScenario({
      id: 't',
      start_rs: 7.5,
      target_rs: 7.27,
      tolerance: 0.05,
      rituals: 0,
      noshow_strikes: 3,
    });
    expect(r.actual_rs).toBeLessThan(7.5);
  });

  test('runAllSanitySimulations returns report shape', () => {
    const report = runAllSanitySimulations();
    expect(report.total).toBeGreaterThan(0);
    expect(Array.isArray(report.results)).toBe(true);
  });
});

describe('venue business stub (§14)', () => {
  test('package catalog has FREE/OPERATÖR/HAKİM', () => {
    const cat = buildPackageCatalog({ subscription_tier: 'free', pro_enabled: false });
    expect(cat.tiers.map((t) => t.id)).toEqual(['free', 'operator', 'hakim']);
    expect(cat.tiers.every((t) => t.active)).toBe(true);
    expect(cat.design_pending).toBe(false);
  });

  test('config has three package tiers', () => {
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.tiers).toHaveLength(3);
  });
});
