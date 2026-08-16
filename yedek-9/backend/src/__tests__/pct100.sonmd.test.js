import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { readerTtlSeconds } from '../services/windowReaderService.js';

describe('sonMD pct100 gaps — config', () => {
  test('BIRTH_CANCEL_MIN is 10', () => {
    expect(LOCAL_CONFIG.ritual.BIRTH_CANCEL_MIN).toBe(10);
  });

  test('window reader TTL default 120s', () => {
    expect(readerTtlSeconds()).toBe(120);
  });

  test('venue claim radius fallback', () => {
    const r = Number(LOCAL_CONFIG.venue?.CLAIM_RADIUS_M || 120);
    expect(r).toBeGreaterThan(0);
  });
});
