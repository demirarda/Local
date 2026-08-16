import { describe, test, expect } from '@jest/globals';
import {
  validateSlotPayload,
  validateSuggestionPayload,
  normalizeSlotVisibility,
  validateEconomyStub,
} from '../services/venueSlotService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('venue slots (F5 §9.4)', () => {
  test('slot requires title', () => {
    expect(validateSlotPayload({}).ok).toBe(false);
  });

  test('accepts valid slot payload', () => {
    const r = validateSlotPayload({
      title: 'Pencere masasi',
      time_mode: 'fixed',
      capacity: 4,
      visibility: 'public',
    });
    expect(r.ok).toBe(true);
    expect(r.data.capacity).toBe(4);
    expect(r.data.time_mode).toBe('fixed');
  });

  test('rejects capacity above table seats', () => {
    const r = validateSlotPayload(
      { title: 'X', capacity: 20, time_mode: 'fixed' },
      { maxTableSeats: 12 }
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/table seats/);
  });

  test('rejects invalid time_mode', () => {
    const r = validateSlotPayload({ title: 'X', time_mode: 'invalid' });
    expect(r.ok).toBe(false);
  });

  test('normalizes visibility aliases', () => {
    expect(normalizeSlotVisibility('members')).toBe('venue_only');
    expect(normalizeSlotVisibility('regular_only')).toBe('regular_only');
    expect(normalizeSlotVisibility('PUBLIC')).toBe('public');
  });

  test('validates economy stub when enabled', () => {
    const r = validateEconomyStub({ claim_fee_cents: 100, suggestion_reward_cents: 50 });
    expect(r.ok).toBe(true);
    expect(r.data.claim_fee_cents).toBe(100);
  });

  test('suggestion rejects capacity above table seats', () => {
    const r = validateSuggestionPayload({ title: 'X', proposed_capacity: 30 }, { maxTableSeats: 8 });
    expect(r.ok).toBe(false);
  });

  test('suggestion requires title', () => {
    expect(validateSuggestionPayload({}).ok).toBe(false);
  });

  test('suggestion defaults to loose time mode', () => {
    const r = validateSuggestionPayload({ title: 'Cumartesi aksam' });
    expect(r.ok).toBe(true);
    expect(r.data.time_mode).toBe('loose');
  });

  test('accepts slot badge requirement fields', () => {
    const r = validateSlotPayload({
      title: 'Basketbol',
      time_mode: 'fixed',
      required_badge_slug: 'host_streak',
      min_badge_level: 'master',
    });
    expect(r.ok).toBe(true);
    expect(r.data.required_badge_slug).toBe('host_streak');
    expect(r.data.min_badge_level).toBe('master');
  });

  test('rejects unknown badge slug on slot', () => {
    const r = validateSlotPayload({
      title: 'X',
      time_mode: 'fixed',
      required_badge_slug: 'not_a_real_badge',
    });
    expect(r.ok).toBe(false);
  });

  test('rejects negative badge as slot door condition (§9)', () => {
    const r = validateSlotPayload({
      title: 'X',
      time_mode: 'fixed',
      required_badge_slug: 'under_trial',
    });
    expect(r.ok).toBe(false);
    expect(String(r.error || '')).toMatch(/Negatif|kapı/i);
  });

  test('config exposes slot time modes', () => {
    expect(LOCAL_CONFIG.venue.SLOT_TIME_MODES).toContain('instant');
    expect(LOCAL_CONFIG.venue.SLOT_VISIBILITY).toContain('venue_only');
    expect(LOCAL_CONFIG.stubs.SLOT_ECONOMY_ENABLED).toBe(true);
  });
});
