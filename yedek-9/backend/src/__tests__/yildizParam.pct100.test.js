import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  assertStartHorizon,
  validateRitualCreateParams,
} from '../services/ritualCreateValidation.js';
import { getRepeatPinThreshold } from '../services/venueLeadService.js';
import { getPublicConfig } from '../services/publicConfigService.js';

describe('yıldız liste %100 gaps', () => {
  test('PLANNED_MAX_AHEAD 21g enforce', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    const ok = assertStartHorizon({
      startDate: new Date('2026-08-20T12:00:00Z'),
      timeType: 'planned',
      now,
    });
    expect(ok.ok).toBe(true);
    expect(ok.horizon).toBe('planned');

    const far = assertStartHorizon({
      startDate: new Date('2026-09-15T12:00:00Z'),
      timeType: 'planned',
      now,
    });
    expect(far.ok).toBe(false);
    expect(far.code).toBe('PLANNED_MAX_AHEAD');
    expect(far.max_ahead_d).toBe(21);
  });

  test('EVENT_MAX_AHEAD 60g for VEN_EVENT / event_group', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    const ok = assertStartHorizon({
      startDate: new Date('2026-09-20T12:00:00Z'),
      origin: 'VEN_EVENT',
      now,
    });
    expect(ok.ok).toBe(true);
    expect(ok.horizon).toBe('event');

    const far = assertStartHorizon({
      startDate: new Date('2026-11-01T12:00:00Z'),
      eventGroupId: 'eg-1',
      now,
    });
    expect(far.ok).toBe(false);
    expect(far.code).toBe('EVENT_MAX_AHEAD');
    expect(far.max_ahead_d).toBe(60);
  });

  test('instant skips PLANNED/EVENT horizon', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    const r = assertStartHorizon({
      startDate: new Date('2026-12-01T12:00:00Z'),
      timeType: 'instant',
      now,
    });
    expect(r.ok).toBe(true);
    expect(r.horizon).toBe('instant');
  });

  test('SELF_REZ_PER_DAY_PER_VENUE = 1', () => {
    expect(LOCAL_CONFIG.ritual.SELF_REZ_PER_DAY_PER_VENUE).toBe(1);
  });

  test('SUGGESTION_PENDING_PER_VENUE = 1 (v3 §8)', () => {
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.SUGGESTION_PENDING_PER_VENUE).toBe(1);
  });

  test('REPEAT_PIN_N = 3', () => {
    expect(LOCAL_CONFIG.leads.REPEAT_PIN_N).toBe(3);
    expect(getRepeatPinThreshold()).toBe(3);
  });

  test('publicConfig exposes horizon + self-rez + leads', () => {
    const cfg = getPublicConfig();
    expect(cfg.ritual.planned_max_ahead_d).toBe(21);
    expect(cfg.ritual.event_max_ahead_d).toBe(60);
    expect(cfg.ritual.self_rez_per_day_per_venue).toBe(1);
    expect(cfg.venue.suggestion_pending_per_venue).toBe(1);
    expect(cfg.leads.repeat_pin_n).toBe(3);
  });

  test('create validation still accepts core params', () => {
    const r = validateRitualCreateParams({
      duration: 60,
      capacity: 4,
      live_window_hours: 12,
    });
    expect(r.ok).toBe(true);
  });
});
