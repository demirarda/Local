import { describe, test, expect } from '@jest/globals';
import {
  RITUAL_STATUS,
  computePrelobbyGrace,
  getLifecyclePhase,
  getWindowEndDate,
  isExactDetailsUnlocked,
  normalizeRitualStatus,
} from '../services/ritualState.js';

describe('ritual state machine (son-part.md §2)', () => {
  test('legacy status normalizes to canonical', () => {
    expect(normalizeRitualStatus('active')).toBe(RITUAL_STATUS.PRELOBBY);
    expect(normalizeRitualStatus('ended')).toBe(RITUAL_STATUS.WINDOW);
    expect(normalizeRitualStatus('closed')).toBe(RITUAL_STATUS.ARCHIVED);
  });

  test('exact pin unlocks at LOCK moment (not join+grace)', () => {
    const start = new Date('2026-01-01T12:00:00Z');
    const join = new Date('2026-01-01T11:00:00Z');
    const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(join, start, {
      duration: 60,
    });
    // grace still join+10
    expect(graceEndsAt.toISOString()).toBe('2026-01-01T11:10:00.000Z');
    // lock = start−15 (60*0.25 clamp 15) → 11:45
    expect(exactDetailsUnlockedAt.toISOString()).toBe('2026-01-01T11:45:00.000Z');
  });

  test('prelobby grace unlocks immediately when join is close to start', () => {
    const start = new Date('2026-01-01T12:00:00Z');
    const join = new Date('2026-01-01T11:55:00Z');
    const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(join, start, {
      duration: 60,
    });
    expect(graceEndsAt.getTime()).toBe(join.getTime());
    expect(exactDetailsUnlockedAt.getTime()).toBe(join.getTime());
  });

  test('prelobby grace waits GRACE_MINUTES when join is early', () => {
    const start = new Date('2026-01-01T12:00:00Z');
    const join = new Date('2026-01-01T11:00:00Z');
    const { graceEndsAt } = computePrelobbyGrace(join, start);
    expect(graceEndsAt.toISOString()).toBe('2026-01-01T11:10:00.000Z');
  });

  test('lifecycle phase follows time when status is live', () => {
    const ritual = {
      status: 'live',
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 60,
      live_window_hours: 3,
    };
    expect(getLifecyclePhase(ritual, new Date('2026-01-01T11:30:00Z'))).toBe(
      RITUAL_STATUS.PRELOBBY
    );
    expect(getLifecyclePhase(ritual, new Date('2026-01-01T12:30:00Z'))).toBe(RITUAL_STATUS.LIVE);
    expect(getLifecyclePhase(ritual, new Date('2026-01-01T13:30:00Z'))).toBe(RITUAL_STATUS.WINDOW);
    expect(getLifecyclePhase(ritual, new Date('2026-01-01T17:00:00Z'))).toBe(
      RITUAL_STATUS.ARCHIVED
    );
  });

  test('missing live_window_hours falls back to 12h (spec default)', () => {
    const ritual = {
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 60,
    };
    expect(getWindowEndDate(ritual).toISOString()).toBe('2026-01-02T01:00:00.000Z');
  });

  test('window end uses window_ends_at when set', () => {
    const ritual = {
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 60,
      live_window_hours: 3,
      window_ends_at: new Date('2026-01-01T15:00:00Z'),
    };
    expect(getWindowEndDate(ritual).toISOString()).toBe('2026-01-01T15:00:00.000Z');
  });

  test('exact details unlock after grace timestamp', () => {
    const future = new Date(Date.now() + 600000);
    const past = new Date(Date.now() - 600000);
    expect(isExactDetailsUnlocked({ prelobby_grace_ends_at: future })).toBe(false);
    expect(isExactDetailsUnlocked({ prelobby_grace_ends_at: past })).toBe(true);
  });
});
