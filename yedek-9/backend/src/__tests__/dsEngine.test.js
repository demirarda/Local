/**
 * DS motoru unit testleri — son-part.md §6
 */
import { describe, test, expect } from '@jest/globals';
import {
  computeDsRaw,
  computeDsMultiplierFromEma,
  dsFlWeight,
  isExcludedFromDsAdjusted,
  tierFromDsFull,
  updateDsEma,
  tierLabelTr,
  computeWindowVd,
  LOCAL_CONFIG,
} from '../config/localConfig.js';

describe('DS engine (son-part.md §6)', () => {
  test('DS_raw uses weighted PD/CtxD/VD', () => {
    const raw = computeDsRaw(0.8, 0.6, 0.4);
    expect(raw).toBeCloseTo(0.6 * 0.8 + 0.3 * 0.6 + 0.1 * 0.4, 6);
  });

  test('EMA alpha 0.30 symmetric', () => {
    const next = updateDsEma(0.5, 0.8);
    expect(next).toBeCloseTo(0.7 * 0.5 + 0.3 * 0.8, 6);
  });

  test('multiplier new user formula', () => {
    const mult = computeDsMultiplierFromEma(0.5, 10);
    expect(mult).toBeCloseTo(0.55 + 0.55 * 0.5, 6);
    expect(mult).toBeLessThanOrEqual(1.2);
    expect(mult).toBeGreaterThanOrEqual(0.55);
  });

  test('multiplier mature user formula', () => {
    const mult = computeDsMultiplierFromEma(0.6, 25);
    expect(mult).toBeCloseTo(0.45 + 0.75 * 0.6, 6);
  });

  test('FL weights for DS_full', () => {
    expect(dsFlWeight('stranger')).toBe(1.0);
    expect(dsFlWeight('l1')).toBe(0.85);
    expect(dsFlWeight('l2')).toBe(0.55);
    expect(dsFlWeight('l3')).toBe(0.2);
    expect(dsFlWeight('l1', true)).toBe(0.85);
  });

  test('DS_adjusted excludes FL3 and regular', () => {
    expect(isExcludedFromDsAdjusted('l3')).toBe(true);
    expect(isExcludedFromDsAdjusted('l1', true)).toBe(true);
    expect(isExcludedFromDsAdjusted('l2')).toBe(false);
  });

  test('tier mapping from DS_full EMA', () => {
    expect(tierFromDsFull(0.2)).toBe('homebody');
    expect(tierFromDsFull(0.4)).toBe('familiar');
    expect(tierFromDsFull(0.9)).toBe('voyager');
  });

  test('config weights match spec', () => {
    expect(LOCAL_CONFIG.ds.W_PD).toBe(0.6);
    expect(LOCAL_CONFIG.ds.W_CTX).toBe(0.3);
    expect(LOCAL_CONFIG.ds.W_VD).toBe(0.1);
    expect(LOCAL_CONFIG.ds.RITUAL_WINDOW).toBe(5);
  });

  test('VD window score uses max_window_capacity denominator', () => {
    expect(computeWindowVd(6, 12)).toBeCloseTo(0.5, 6);
    expect(computeWindowVd(12, 12)).toBe(1);
    expect(computeWindowVd(20, 12)).toBe(1);
  });

  test('tier labels for dashboard', () => {
    expect(tierLabelTr('explorer')).toContain('Kesifci');
    expect(tierLabelTr('homebody')).toContain('Evci');
  });
});
