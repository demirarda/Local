/**
 * Cezalar unit testleri — son-part.md §7
 */
import { describe, test, expect } from '@jest/globals';
import {
  LOCAL_CONFIG,
  isFreeCancelWindow,
  isWithinJoinGrace,
  requiresReplacement,
  freeCancelThresholdMinutes,
  getNoShowSuspensionHours,
  getHostBanConfig,
  getLateCancelRsPenalty,
  getNoShowRsPenalty,
} from '../config/localConfig.js';

describe('penalties (son-part.md §7)', () => {
  test('free cancel when >25% duration remains (60dk → eşik 15dk)', () => {
    const ritual = {
      start_time: new Date('2026-06-01T12:00:00Z'),
      duration: 60,
    };
    expect(freeCancelThresholdMinutes(ritual)).toBe(15);
    const now = new Date('2026-06-01T11:00:00Z');
    expect(isFreeCancelWindow(ritual, now)).toBe(true);
    expect(requiresReplacement(ritual, now)).toBe(false);
  });

  test('replacement required when <25% duration remains', () => {
    const ritual = {
      start_time: new Date('2026-06-01T12:00:00Z'),
      duration: 60,
    };
    const now = new Date('2026-06-01T11:50:00Z');
    expect(isFreeCancelWindow(ritual, now)).toBe(false);
    expect(requiresReplacement(ritual, now)).toBe(true);
  });

  test('KİLİT-ANI clamp min 15dk (kısa Ritual)', () => {
    const ritual = { start_time: new Date('2026-06-01T12:00:00Z'), duration: 30 };
    // %25×30 = 7.5 → clamp 15
    expect(freeCancelThresholdMinutes(ritual)).toBe(15);
  });

  test('KİLİT-ANI clamp max 3h (uzun Ritual)', () => {
    const ritual = { start_time: new Date('2026-06-01T12:00:00Z'), duration: 24 * 60 };
    // %25×1440 = 360 → clamp 180
    expect(freeCancelThresholdMinutes(ritual)).toBe(180);
  });

  test('join grace is penalty-free within GRACE_MINUTES', () => {
    const joined = new Date('2026-06-01T10:00:00Z');
    const now = new Date('2026-06-01T10:05:00Z');
    expect(
      isWithinJoinGrace({ joined_at: joined.toISOString() }, now)
    ).toBe(true);
    const late = new Date('2026-06-01T10:15:00Z');
    expect(
      isWithinJoinGrace({ joined_at: joined.toISOString() }, late)
    ).toBe(false);
  });

  test('no-show RS penalties', () => {
    expect(getNoShowRsPenalty(1)).toBe(-0.08);
    expect(getNoShowRsPenalty(2)).toBe(-0.15);
    expect(getNoShowRsPenalty(5)).toBe(-0.2);
  });

  test('late-cancel RS penalties', () => {
    expect(getLateCancelRsPenalty(1)).toBe(null);
    expect(getLateCancelRsPenalty(2)).toBe(-0.06);
    expect(getLateCancelRsPenalty(4)).toBe(-0.15);
  });

  test('no-show suspension from 3rd strike', () => {
    expect(getNoShowSuspensionHours(1)).toBe(null);
    expect(getNoShowSuspensionHours(2)).toBe(null);
    expect(getNoShowSuspensionHours(3)).toBe(3);
    expect(getNoShowSuspensionHours(6)).toBe(24);
  });

  test('host-ban tiers', () => {
    expect(getHostBanConfig(1)).toEqual({ warning: true, hours: 3 });
    expect(getHostBanConfig(4).hours).toBe(168);
  });

  test('cancel threshold from config', () => {
    expect(LOCAL_CONFIG.ritual.CANCEL_FREE_THRESHOLD_PCT).toBe(0.25);
    expect(LOCAL_CONFIG.penalties.ROLLING_DAYS).toBe(30);
    expect(LOCAL_CONFIG.ritual.GRACE_MINUTES).toBe(10);
    expect(LOCAL_CONFIG.rs.CAP_NEG).toBe(0.15);
    expect(LOCAL_CONFIG.rs.BYPASS_CAP_NEG).toBe(0.2);
  });
});
