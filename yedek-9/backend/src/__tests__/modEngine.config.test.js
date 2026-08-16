/**
 * v2 §5 modEngine unit tests (pure-ish helpers via package build)
 */
import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('mod config (§5)', () => {
  test('L ladder constants present', () => {
    expect(LOCAL_CONFIG.mod.L2A_H).toBe(72);
    expect(LOCAL_CONFIG.mod.L2B_D).toBe(7);
    expect(LOCAL_CONFIG.mod.L2B_FREE_BAN_D).toBe(30);
    expect(LOCAL_CONFIG.mod.L3_RS_BASE).toBe(-0.15);
    expect(LOCAL_CONFIG.mod.L3_RS_MAX).toBe(-0.3);
    expect(LOCAL_CONFIG.mod.L3_SUSPEND_D).toBe(30);
    expect(LOCAL_CONFIG.mod.L1_PACKET_MIN).toBe(3);
    expect(LOCAL_CONFIG.mod.SLA_H.safety).toBe(2);
    expect(LOCAL_CONFIG.mod.SLA_H.content).toBe(12);
    expect(LOCAL_CONFIG.mod.SLA_H.general).toBe(48);
    expect(LOCAL_CONFIG.mod.LOCATION_SHARE_DEFAULT_H).toBe(1);
  });

  test('CSAM provider is open/null stub', () => {
    expect(LOCAL_CONFIG.open.csam_provider).toBeNull();
  });

  test('GPS edge pattern thresholds present (§2)', () => {
    expect(LOCAL_CONFIG.checkin.GPS_EDGE.MIN_HITS).toBe(3);
    expect(LOCAL_CONFIG.checkin.GPS_EDGE.WINDOW_DAYS).toBe(30);
    expect(LOCAL_CONFIG.checkin.GPS_EDGE.MARGIN_M).toBe(5);
  });

  test('silent-exit pattern thresholds present (§8)', () => {
    expect(LOCAL_CONFIG.mod.SILENT_EXIT.MIN_HITS).toBe(3);
    expect(LOCAL_CONFIG.mod.SILENT_EXIT.WINDOW_DAYS).toBe(30);
  });
});
