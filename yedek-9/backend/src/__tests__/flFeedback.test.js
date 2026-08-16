import { describe, test, expect } from '@jest/globals';
import {
  levelFromFbCount,
  fbWeightFromLevel,
} from '../config/localConfig.js';
import {
  getFeedbackOpensAt,
  getFeedbackClosesAt,
  getFeedbackWindowInfo,
} from '../services/feedbackWindow.js';
import { countFreshFeedbackBetween } from '../services/friendshipLevel.js';

describe('FL + feedback window (son-part.md §4)', () => {
  test('FL thresholds map to l1/l2/l3', () => {
    expect(levelFromFbCount(0)).toBe('stranger');
    expect(levelFromFbCount(1)).toBe('l1');
    expect(levelFromFbCount(3)).toBe('l1');
    expect(levelFromFbCount(4)).toBe('l2');
    expect(levelFromFbCount(7)).toBe('l2');
    expect(levelFromFbCount(8)).toBe('l3');
  });

  test('IQ weights by FL level', () => {
    expect(fbWeightFromLevel('l1')).toBe(1.0);
    expect(fbWeightFromLevel('l2')).toBe(0.5);
    expect(fbWeightFromLevel('l3')).toBe(0.0);
    expect(fbWeightFromLevel('stranger')).toBe(0);
  });

  test('feedback window uses 12h floor after duration', () => {
    const ritual = {
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 60,
      live_window_hours: 3,
      window_ends_at: new Date('2026-01-01T16:00:00Z'),
    };
    expect(getFeedbackOpensAt(ritual).toISOString()).toBe('2026-01-01T13:00:00.000Z');
    expect(getFeedbackClosesAt(ritual).toISOString()).toBe('2026-01-02T01:00:00.000Z');

    const during = getFeedbackWindowInfo(ritual, new Date('2026-01-01T14:00:00Z'));
    expect(during.open).toBe(true);

    const after = getFeedbackWindowInfo(ritual, new Date('2026-01-02T02:00:00Z'));
    expect(after.open).toBe(false);
  });

  test('countFreshFeedbackBetween excludes pre-friendship feedback via accepted_at join', async () => {
    let capturedSql = '';
    const mockClient = {
      query: async (sql) => {
        capturedSql = sql;
        return { rows: [{ c: 1 }] };
      },
    };
    const count = await countFreshFeedbackBetween('user-a', 'user-b', mockClient);
    expect(count).toBe(1);
    expect(capturedSql).toMatch(/INNER JOIN friendships fr/);
    expect(capturedSql).toMatch(/accepted_at/);
    expect(capturedSql).toMatch(/first_feedback_at/);
  });
});
