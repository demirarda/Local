import { describe, test, expect } from '@jest/globals';
import {
  validateRitualCreateParams,
  getVenueMaxTableSeats,
  validateCheckInRadius,
  isScheduledLocationType,
  assertScheduledOneShot,
  shouldCollapseHomeEmptyDoor,
  normalizeRouteId,
} from '../services/ritualCreateValidation.js';

describe('ritual create validation (son-part.md §2.1)', () => {
  test('rejects duration below 30 minutes', () => {
    const r = validateRitualCreateParams({ duration: 20, capacity: 5, live_window_hours: 12 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/30 minutes/);
  });

  test('rejects duration above 24 hours', () => {
    const r = validateRitualCreateParams({ duration: 24 * 60 + 1, capacity: 5, live_window_hours: 24 });
    expect(r.ok).toBe(false);
  });

  test('rejects capacity below MIN_SIZE (3)', () => {
    const r = validateRitualCreateParams({ duration: 60, capacity: 2, live_window_hours: 12 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least 3/);
  });

  test('rejects window not in WINDOW_HOURS_OPTIONS', () => {
    const r = validateRitualCreateParams({ duration: 60, capacity: 5, live_window_hours: 5 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/live_window_hours must be one of/);
  });

  test('rejects window shorter than duration', () => {
    const r = validateRitualCreateParams({ duration: 240, capacity: 5, live_window_hours: 3 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/window/i);
  });

  test('rejects capacity above venue table seats', () => {
    const r = validateRitualCreateParams({
      duration: 60,
      capacity: 20,
      live_window_hours: 12,
      venueMaxSeats: 8,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/venue table seats/);
  });

  test('omitted live_window_hours defaults to 12', () => {
    const r = validateRitualCreateParams({ duration: 90, capacity: 6 });
    expect(r.ok).toBe(true);
    expect(r.data.lwh).toBe(12);
  });

  test('accepts valid params', () => {
    const r = validateRitualCreateParams({ duration: 90, capacity: 6, live_window_hours: 6 });
    expect(r.ok).toBe(true);
    expect(r.data.durMin).toBe(90);
    expect(r.data.cap).toBe(6);
    expect(r.data.lwh).toBe(6);
  });

  test('getVenueMaxTableSeats sums table seats', () => {
    const seats = getVenueMaxTableSeats({
      tables: [{ seats: 4 }, { seats: 6 }, { seats: 0 }],
    });
    expect(seats).toBe(10);
  });

  test('validateCheckInRadius enforces zone 75-100m', () => {
    expect(validateCheckInRadius('zone', 74).ok).toBe(false);
    expect(validateCheckInRadius('zone', 75).ok).toBe(true);
    expect(validateCheckInRadius('zone', 100).ok).toBe(true);
    expect(validateCheckInRadius('zone', 101).ok).toBe(false);
  });
});

describe('sonMD §4 lokasyon %100', () => {
  test('scheduled/ferry is one-shot', () => {
    expect(isScheduledLocationType('scheduled')).toBe(true);
    expect(isScheduledLocationType('ferry')).toBe(true);
    expect(isScheduledLocationType('custom')).toBe(false);
    expect(assertScheduledOneShot({ locationType: 'scheduled', isRecurring: true }).ok).toBe(false);
    expect(assertScheduledOneShot({ locationType: 'ferry', timeType: 'series' }).code).toBe('ROUTE_ONE_SHOT');
    expect(assertScheduledOneShot({ locationType: 'scheduled', timeType: 'fixed' }).ok).toBe(true);
    expect(assertScheduledOneShot({ locationType: 'custom', isRecurring: true }).ok).toBe(true);
  });

  test('route_id normalizes hat key', () => {
    expect(normalizeRouteId('Kadıköy-Beşiktaş')).toBe('kadıköy-beşiktaş');
    expect(normalizeRouteId(null, 'Hat 1')).toBe('hat-1');
  });

  test('home empty door collapses without sealed count', () => {
    expect(shouldCollapseHomeEmptyDoor({ isHome: true, sealedCount: 0 })).toBe(true);
    expect(shouldCollapseHomeEmptyDoor({ isHome: true, sealedCount: 1 })).toBe(false);
    expect(shouldCollapseHomeEmptyDoor({ isHome: false, sealedCount: 0 })).toBe(false);
  });

  test('scheduled radius is 50m', () => {
    expect(validateCheckInRadius('scheduled', 50).ok).toBe(true);
    expect(validateCheckInRadius('ferry', 30).ok).toBe(false);
    expect(validateCheckInRadius('home', 30).ok).toBe(true);
  });
});
