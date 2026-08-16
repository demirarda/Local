import { describe, test, expect } from '@jest/globals';
import {
  computeVen4Display,
  getSeatingLabel,
  feelingToScore,
  feelingToInternal,
  buildAuraDistribution,
  applyMinDisplayGate,
  repeatRaterWeight,
} from '../services/venueTrustAuraService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('venue Trust/Aura VEN-4 (sonMD)', () => {
  test('config: 0–1 prior_internal · MIN_DISPLAY · REPEAT_RATER', () => {
    expect(LOCAL_CONFIG.venue.PRIOR_INTERNAL).toBe(0.5);
    expect(LOCAL_CONFIG.venue.DISPLAY_SCALE).toBe(10);
    expect(LOCAL_CONFIG.venue.PRIOR).toBe(5.0);
    expect(LOCAL_CONFIG.venue.MIN_DISPLAY_N).toBe(5);
    expect(LOCAL_CONFIG.venue.MIN_ANSWERS_PER_OBS).toBe(2);
    expect(LOCAL_CONFIG.venue.REPEAT_RATER_W).toEqual([1.0, 0.5, 0.5, 0.25]);
  });

  test('feelingToInternal 0–1 · feelingToScore display ×10', () => {
    expect(feelingToInternal('green')).toBe(1);
    expect(feelingToInternal('yellow')).toBe(0.65);
    expect(feelingToInternal('red')).toBe(0.3);
    expect(feelingToScore('green')).toBe(10);
    expect(feelingToScore('yellow')).toBe(6.5);
    expect(feelingToScore('red')).toBe(3);
  });

  test('repeatRaterWeight bands', () => {
    expect(repeatRaterWeight(0)).toBe(1);
    expect(repeatRaterWeight(1)).toBe(0.5);
    expect(repeatRaterWeight(2)).toBe(0.5);
    expect(repeatRaterWeight(3)).toBe(0.25);
    expect(repeatRaterWeight(9)).toBe(0.25);
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
    expect(pub.public_label).toMatch(/gözlem/i);
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
});
