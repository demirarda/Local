/**
 * Master Parametre Dosyası — yapısal %100 kapanış
 * LOCAL_Master_Parametre_Dosyasi.md ↔ localConfig + servisler
 */
import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { eventGroupLimits } from '../services/eventGroupService.js';
import {
  getLwPulseWeights,
  scoreLwPulse,
  scoreMemoryCandidate,
  scoreRitualCandidate,
} from '../services/pulseFeedRanking.js';
import { getPublicConfig } from '../services/publicConfigService.js';

describe('Master Parametre pct100', () => {
  test('§16 growth healthy bands locked in config', () => {
    const g = LOCAL_CONFIG.growth;
    expect(g.WEEKLY_RITUALS_CLUSTER_MIN).toBe(50);
    expect(g.REPEAT_PARTICIPATION_30D_MIN).toBe(0.4);
    expect(g.NOSHOW_RATE_MAX).toBe(0.15);
    expect(g.FEEDBACK_COMPLETION_MIN).toBe(0.4);
    expect(g.RS_CENTER).toBe(5);
    expect(g.RS_CENTER_TOLERANCE).toBe(0.5);
    expect(g.NEW_VENUE_SETTLE_WEEKS_MIN).toBe(1);
    expect(g.NEW_VENUE_SETTLE_WEEKS_MAX).toBe(3);
    expect(g.SPARK_REACH_3_MIN).toBe(0.3);
    expect(g.YELLOW_CHIP_DEAD_FORBIDDEN).toBe(true);
    expect(g.LOCKED_AT).toBeTruthy();
  });

  test('§2E event_group corner 12 · max 8 · ceiling 96', () => {
    expect(LOCAL_CONFIG.event_group.CORNER_CAP).toBe(12);
    expect(LOCAL_CONFIG.event_group.MAX_CORNERS).toBe(8);
    expect(LOCAL_CONFIG.event_group.EFFECTIVE_CEILING).toBe(96);
    const lim = eventGroupLimits();
    expect(lim.cornerCap).toBe(12);
    expect(lim.maxCorners).toBe(8);
    expect(lim.ceiling).toBe(96);
  });

  test('§2D LW-Pulse weights yer.30 mesafe.20 kat.20 sosyal.20 pop.10', () => {
    const w = getLwPulseWeights();
    expect(w).toEqual({
      place: 0.3,
      distance: 0.2,
      category: 0.2,
      social: 0.2,
      pop: 0.1,
    });
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(scoreLwPulse({ place: 1, distance: 1, category: 1, social: 1, pop: 1 })).toBeCloseTo(1, 5);
    expect(scoreLwPulse({ place: 1, distance: 0, category: 0, social: 0, pop: 0 })).toBeCloseTo(0.3, 5);
  });

  test('LW scorers produce finite sortable scores', () => {
    const m = scoreMemoryCandidate(
      { created_at: new Date().toISOString(), city: 'Istanbul' },
      { city: 'Istanbul', social: 0.8 }
    );
    const r = scoreRitualCandidate(
      { start_time: new Date().toISOString(), status: 'live', host_city: 'Istanbul', friends_here: 2 },
      { city: 'Istanbul' }
    );
    expect(Number.isFinite(m)).toBe(true);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(m);
  });

  test('§8 L1 packet + §12 economy locks', () => {
    expect(LOCAL_CONFIG.mod.L1_PACKET_MIN).toBe(3);
    expect(LOCAL_CONFIG.mod.L1_PACKET_LOCKED_AT).toBeTruthy();
    expect(LOCAL_CONFIG.open.compact_band_approved).toBe(false);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.TAKEOVER_FORMULA.weekday).toBe(0.3);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.treat_as_complete).toBe(true);
  });

  test('publicConfig exposes growth · event_group · lw_weights', () => {
    const cfg = getPublicConfig();
    expect(cfg.growth.weekly_rituals_cluster_min).toBe(50);
    expect(cfg.event_group.corner_cap).toBe(12);
    expect(cfg.event_group.max_corners).toBe(8);
    expect(cfg.pulse.lw_weights.place).toBe(0.3);
    expect(cfg.pulse.lw_weights.pop).toBe(0.1);
  });
});
