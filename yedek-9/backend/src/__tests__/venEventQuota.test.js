import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  getVenEventMonthlyCap,
  isVenEventCapUnlimited,
  assertVenEventMonthlyCap,
} from '../services/venEventQuota.js';

describe('VEN-EVENT aylık tavan ⭐ open_empty', () => {
  test('MONTHLY_CAP is null · unlimited', () => {
    expect(LOCAL_CONFIG.ritual.VEN_EVENT.MONTHLY_CAP).toBeNull();
    expect(LOCAL_CONFIG.ritual.VEN_EVENT.MONTHLY_CAP_STATUS).toBe('open_empty');
    expect(getVenEventMonthlyCap()).toBeNull();
    expect(isVenEventCapUnlimited()).toBe(true);
  });

  test('assert without venue still unlimited when cap empty', async () => {
    const q = await assertVenEventMonthlyCap(null);
    expect(q.ok).toBe(true);
    expect(q.unlimited).toBe(true);
    expect(q.cap).toBeNull();
    expect(q.status).toBe('open_empty');
  });

  test('horizon configs present', () => {
    expect(LOCAL_CONFIG.ritual.PLANNED_MAX_AHEAD_D).toBe(21);
    expect(LOCAL_CONFIG.ritual.EVENT_MAX_AHEAD_D).toBe(60);
  });
});
