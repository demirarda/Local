import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { witnessThresholdForSealedCount } from '../services/firstSealService.js';
import { falseWitnessPatternHit } from '../services/modEngine.js';
import { comingCityPayload, ritualCityFilterSql } from '../services/cityScope.js';

describe('sonMD P2 stubs — intentional gates', () => {
  test('witness ACTIVE_SCHEME is LEGACY_2_TIER; 3-tier flag off', () => {
    expect(LOCAL_CONFIG.witness.ACTIVE_SCHEME).toBe('LEGACY_2_TIER');
    expect(LOCAL_CONFIG.witness.FUTURE_3_TIER_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.witness.FUTURE_3_TIER).toEqual({
      le3: 1,
      mid_lo: 4,
      mid_hi: 12,
      mid: 2,
      ge13: 3,
    });
  });

  test('LEGACY_2_TIER thresholds: ≤3→1 · ≥4→2', () => {
    expect(witnessThresholdForSealedCount(1)).toBe(1);
    expect(witnessThresholdForSealedCount(3)).toBe(1);
    expect(witnessThresholdForSealedCount(4)).toBe(2);
    expect(witnessThresholdForSealedCount(40)).toBe(2);
  });

  test('FALSE_WITNESS sicil thresholds are set', () => {
    expect(LOCAL_CONFIG.witness.FALSE_WITNESS.WINDOW_DAYS).toBe(30);
    expect(LOCAL_CONFIG.witness.FALSE_WITNESS.MIN_SUSPECT_SUBJECTS).toBe(3);
    expect(LOCAL_CONFIG.witness.FALSE_WITNESS.MIN_PAIR_REPEATS).toBe(2);
    expect(LOCAL_CONFIG.witness.FALSE_WITNESS.FACTOR_WEIGHT).toBe(0.2);
  });

  test('falseWitnessPatternHit: 3 şüpheli özne veya 1 tekrar çift', () => {
    expect(
      falseWitnessPatternHit({ suspectSubjects: 2, repeatPairs: 0, minSuspectSubjects: 3 })
    ).toBe(false);
    expect(
      falseWitnessPatternHit({ suspectSubjects: 3, repeatPairs: 0, minSuspectSubjects: 3 })
    ).toBe(true);
    expect(
      falseWitnessPatternHit({ suspectSubjects: 1, repeatPairs: 1, minSuspectSubjects: 3 })
    ).toBe(true);
  });

  test('F1.5 Friends-DM + Series-Regular launch kapalı; waitlist on; SPARK stub off; F2 still closed', () => {
    expect(LOCAL_CONFIG.stubs.FRIENDS_DM_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.WAITLIST_ENABLED).toBe(true);
    expect(LOCAL_CONFIG.stubs.ROLE_SLOT_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.SERIES_REGULAR_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.RITUAL_DESIGNER_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
  });

  test('web showcase stub-closed until prova (v3)', () => {
    expect(LOCAL_CONFIG.stubs.WEB_SHOWCASE_ENABLED).toBe(false);
  });

  test('CSAM ops_review_fallback + KYC stub provider', () => {
    expect(LOCAL_CONFIG.open.csam_provider).toBeNull();
    expect(LOCAL_CONFIG.open.csam_status).toBe('ops_review_fallback');
    expect(LOCAL_CONFIG.open.csam_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.csam_hold_enforced).toBe(true);
    expect(LOCAL_CONFIG.identity.ACTIVE_PROVIDER).toBe('stub');
    expect(LOCAL_CONFIG.open.kyc_provider_contract.active).toBe('stub');
    expect(LOCAL_CONFIG.open.kyc_provider_contract.launch_accepted).toBe(true);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.status).toBe('pass_stub_launch');
    expect(LOCAL_CONFIG.open.kyc_provider_contract.phase2_code_ready).toBe(true);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.treat_as_complete).toBe(true);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.still_open).toBe(true);
  });

  test('comingCityPayload teaser for COMING', () => {
    const p = comingCityPayload({
      id: 'x',
      name: 'Istanbul',
      status: 'COMING',
      teaser_copy: null,
      notify_enabled: true,
    });
    expect(p.is_coming).toBe(true);
    expect(p.teaser).toMatch(/henüz/i);
  });

  test('ritualCityFilterSql scopes by city_id', () => {
    const { sql, params } = ritualCityFilterSql('cid-1', 3, 'r');
    expect(sql).toContain('r.city_id = $3');
    expect(params).toEqual(['cid-1']);
  });

  test('CHIP_BRIDGE signals open · auto-grant parked; escrow removed', () => {
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.enabled).toBe(false);
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.open).toBe(true);
    expect(LOCAL_CONFIG.open.sales_trigger_thresholds).toEqual({
      N_RITUAL: 5,
      X_CHECKIN: 20,
      DEAD_DAY_DELTA: 15,
    });
    expect(LOCAL_CONFIG.keyword.ESCROW_MIN).toBeUndefined();
  });
});
