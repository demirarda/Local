import { describe, test, expect } from '@jest/globals';
import {
  computeVen4Display,
  getSeatingLabel,
  feelingToScore,
  feelingToInternal,
  buildAuraDistribution,
  applyMinDisplayGate,
  repeatRaterWeight,
  RATER_ID_SQL,
} from '../services/venueTrustAuraService.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { canSeeFulfillmentSicil } from '../services/venueProfileService.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('venue Trust/Aura VEN-4 (sonMD)', () => {
  test('config: 0–1 prior_internal · MIN_DISPLAY · REPEAT_RATER', () => {
    expect(LOCAL_CONFIG.venue.PRIOR_INTERNAL).toBe(0.5);
    expect(LOCAL_CONFIG.venue.DISPLAY_SCALE).toBe(10);
    expect(LOCAL_CONFIG.venue.PRIOR).toBe(5.0);
    expect(LOCAL_CONFIG.venue.MIN_DISPLAY_N).toBe(5);
    expect(LOCAL_CONFIG.venue.MIN_ANSWERS_PER_OBS).toBe(1);
    expect(LOCAL_CONFIG.venue.K).toBe(5);
    expect(LOCAL_CONFIG.venue.WINDOW_DAYS).toBe(120);
    expect(LOCAL_CONFIG.venue.MAX_OBS_PER_PERSON_PER_NIGHT).toBe(2);
  });

  test('feelingToInternal 0–1 · feelingToScore display ×10', () => {
    expect(feelingToInternal('green')).toBe(1);
    expect(feelingToInternal('yellow')).toBe(0.5);
    expect(feelingToInternal('red')).toBe(0);
    expect(feelingToScore('green')).toBe(10);
    expect(feelingToScore('yellow')).toBe(5);
    expect(feelingToScore('red')).toBe(0);
  });

  test('repeatRaterWeight 1/(1+k·n)', () => {
    expect(repeatRaterWeight(0)).toBe(1);
    expect(repeatRaterWeight(1)).toBeCloseTo(0.5, 5);
    expect(repeatRaterWeight(3)).toBeCloseTo(0.25, 5);
  });

  test('VEN-4 prior fallback when n_eff=0 (display 5.0)', () => {
    const r = computeVen4Display(null, 0);
    expect(r.score).toBe(5);
    expect(r.prior_internal).toBe(0.5);
    expect(r.is_prior_fallback).toBe(true);
    expect(r.n_eff).toBe(0);
  });

  test('VEN-4 blends toward prior with low n (0–1 input)', () => {
    const r = computeVen4Display(1.0, 1, 3, 0.5);
    expect(r.score).toBeGreaterThan(5);
    expect(r.score).toBeLessThan(10);
    expect(r.is_prior_fallback).toBe(false);
  });

  test('VEN-4 approaches S_ham with high n', () => {
    const r = computeVen4Display(0.85, 1000, 3, 0.5);
    expect(r.score).toBeCloseTo(8.5, 1);
  });

  test('MIN_DISPLAY_N gate: public hides score; panel keeps', () => {
    const base = computeVen4Display(1.0, 2, 3, 0.5);
    const pub = applyMinDisplayGate(base, { audience: 'public' });
    expect(pub.score_hidden).toBe(true);
    expect(pub.score).toBeNull();
    expect(pub.public_label).toMatch(/beş kez|Yeni mekan/i);
    const panel = applyMinDisplayGate(base, { audience: 'panel' });
    expect(panel.score_hidden).toBe(false);
    expect(panel.score).toBe(base.score);
  });

  test('MIN_DISPLAY_N gate opens at n≥5', () => {
    const base = computeVen4Display(0.8, 5, 3, 0.5);
    const pub = applyMinDisplayGate(base, { audience: 'public' });
    expect(pub.score_hidden).toBe(false);
    expect(pub.public_numeric).toBe(true);
  });

  test('seating labels from OTURMA thresholds', () => {
    expect(getSeatingLabel(0).key).toBe('yeni');
    expect(getSeatingLabel(2).key).toBe('oturuyor');
    expect(getSeatingLabel(10).key).toBe('oturmus');
    expect(LOCAL_CONFIG.venue.OTURMA).toEqual([2, 10]);
  });

  test('aura distribution hidden when n_rituel < 5', () => {
    const r = buildAuraDistribution([
      { category: 'kahve', avg_score: 8 },
      { category: 'muzik', avg_score: 7 },
    ]);
    expect(r.hidden).toBe(true);
  });

  test('aura category tentative below 3 instances', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      category: i < 2 ? 'kahve' : 'muzik',
      avg_score: 8,
    }));
    const r = buildAuraDistribution(rows);
    expect(r.hidden).toBe(false);
    const kahve = r.categories.find((c) => c.category === 'kahve');
    expect(kahve.status).toBe('tentative');
    const muzik = r.categories.find((c) => c.category === 'muzik');
    expect(muzik.status).toBe('stable');
  });

  test('§7 rater id is from_user_id/rater_id — f.user_id yok', () => {
    expect(RATER_ID_SQL).toBe('COALESCE(f.from_user_id, f.rater_id)');
    const src = readFileSync(join(__dirname, '../services/venueTrustAuraService.js'), 'utf8');
    expect(src).not.toMatch(/f\.user_id,/);
    expect(src).toContain("place === 'zone'");
  });

  test('§7 gerçekleşme-sicili yalnız para-alan yönetici', () => {
    expect(canSeeFulfillmentSicil({ canManage: false, venue: { subscription_tier: 'hakim' } })).toBe(
      false
    );
    expect(canSeeFulfillmentSicil({ canManage: true, venue: { subscription_tier: 'free' } })).toBe(
      false
    );
    expect(canSeeFulfillmentSicil({ canManage: true, venue: { subscription_tier: 'operator' } })).toBe(
      true
    );
    expect(canSeeFulfillmentSicil({ canManage: true, venue: { pro_enabled: true } })).toBe(true);
  });
});
