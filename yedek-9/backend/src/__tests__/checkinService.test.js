import { describe, test, expect } from '@jest/globals';
import {
  getCheckinWindowInfo,
  getDoorCloseTime,
} from '../services/checkinService.js';
import { computeAis, getKapiMinutes, isGpsEdgeDistance, LOCAL_CONFIG } from '../config/localConfig.js';

describe('check-in window (son-part.md §3)', () => {
  test('kapı for 30min ritual is 10 minutes', () => {
    expect(getKapiMinutes(30)).toBe(10);
  });

  test('AIS on-time vs late slices', () => {
    expect(computeAis(3, 30)).toEqual({ ais: 1, status: 'on_time' });
    expect(computeAis(8, 30)).toEqual({ ais: 0.85, status: 'late' });
    expect(computeAis(11, 30)).toEqual({ ais: 0, status: 'no_show' });
  });

  test('door open from start−15 through kapı (firstSeal early window)', () => {
    const ritual = {
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 30,
    };
    const tooEarly = getCheckinWindowInfo(ritual, new Date('2026-01-01T11:44:00Z'));
    expect(tooEarly.door_open).toBe(false);
    expect(tooEarly.can_first_seal).toBe(false);

    const early = getCheckinWindowInfo(ritual, new Date('2026-01-01T11:50:00Z'));
    expect(early.early_window).toBe(true);
    expect(early.door_open).toBe(true);
    expect(early.can_first_seal).toBe(true);
    expect(early.warmup).toBe(true);

    const during = getCheckinWindowInfo(ritual, new Date('2026-01-01T12:05:00Z'));
    expect(during.door_open).toBe(true);
    expect(during.ritual_started).toBe(true);
    expect(during.can_first_seal).toBe(true);

    const after = getCheckinWindowInfo(ritual, new Date('2026-01-01T12:11:00Z'));
    expect(after.door_open).toBe(false);
  });

  test('code entry active in early window once table has keyword', () => {
    const ritual = {
      start_time: new Date('2026-01-01T12:00:00Z'),
      duration: 30,
      checkin_keyword: '472',
    };
    const early = getCheckinWindowInfo(ritual, new Date('2026-01-01T11:50:00Z'));
    expect(early.door_open).toBe(true);
    expect(early.can_first_seal).toBe(false);
    expect(early.code_entry_active).toBe(true);
    expect(early.table_open).toBe(true);
  });

  test('early seal AIS stays on_time (negative lateMinutes)', () => {
    expect(computeAis(-10, 30)).toEqual({ ais: 1, status: 'on_time' });
  });

  test('door close time matches kapı offset', () => {
    const start = new Date('2026-01-01T12:00:00Z');
    const close = getDoorCloseTime(start, 30);
    expect(close.toISOString()).toBe('2026-01-01T12:10:00.000Z');
  });
});

describe('GPS edge pattern (Master Parametre §2)', () => {
  test('isGpsEdgeDistance flags near-radius check-ins', () => {
    expect(isGpsEdgeDistance(28, 30)).toBe(true); // within 5m margin
    expect(isGpsEdgeDistance(27, 30)).toBe(true); // 0.9 ratio
    expect(isGpsEdgeDistance(10, 30)).toBe(false);
    expect(isGpsEdgeDistance(31, 30)).toBe(false); // outside radius
    expect(isGpsEdgeDistance(45, 50)).toBe(true); // margin
  });

  test('GPS_EDGE thresholds are configured', () => {
    const e = LOCAL_CONFIG.checkin.GPS_EDGE;
    expect(e.MIN_HITS).toBe(3);
    expect(e.WINDOW_DAYS).toBe(30);
    expect(e.MARGIN_M).toBe(5);
    expect(e.FACTOR_WEIGHT).toBe(0.15);
  });
});

describe('code display (Build Doc §2)', () => {
  test('displayCode is digits only — no spoken readout', async () => {
    const { displayCode, formatCodeSpoken } = await import('../services/checkinCodeService.js');
    expect(displayCode('472')).toBe('472');
    expect(displayCode(472)).toBe('472');
    expect(displayCode('472')).not.toMatch(/—|DÖRT|YEDİ|İKİ|FOUR/);
    expect(formatCodeSpoken('472')).toBe('472');
    expect(LOCAL_CONFIG.keyword.DIGIT_WORDS_TR).toBeUndefined();
  });
});
