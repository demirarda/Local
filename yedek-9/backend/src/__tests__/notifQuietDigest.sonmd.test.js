import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isWithinQuietHours,
  piercesQuietHours,
  QUIET_HOURS_OVERRIDE_TYPES,
} from '../services/notifications.js';

describe('notif quiet hours + digest (absolute 100 B)', () => {
  test('defaults are 01:00–09:00 + weekly digest on', () => {
    expect(LOCAL_CONFIG.notifications.QUIET_HOURS_DEFAULT).toEqual({
      enabled: true,
      start: '01:00',
      end: '09:00',
    });
    expect(LOCAL_CONFIG.notifications.PUSH_DEFAULTS.weekly_digest).toBe(true);
  });

  test('isWithinQuietHours overnight window', () => {
    const mid = new Date('2026-08-12T03:00:00');
    const noon = new Date('2026-08-12T12:00:00');
    expect(isWithinQuietHours('01:00', '09:00', mid)).toBe(true);
    expect(isWithinQuietHours('01:00', '09:00', noon)).toBe(false);
  });

  test('own-ritual types pierce quiet', () => {
    expect(piercesQuietHours('ritual_opened')).toBe(true);
    expect(piercesQuietHours('door_closing')).toBe(true);
    expect(piercesQuietHours('zone_spark')).toBe(false);
    expect(QUIET_HOURS_OVERRIDE_TYPES.has('join_confirmed')).toBe(true);
  });
});
