import { describe, test, expect } from '@jest/globals';
import {
  validateVitrinePayload,
  LOCKED_SECTION_IDS,
} from '../services/venueProfileService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('venue profile vitrin (F5 §9.1)', () => {
  test('vitrine requires minimum content', () => {
    const r = validateVitrinePayload({ vitrine: {} });
    expect(r.ok).toBe(false);
  });

  test('accepts headline vitrine', () => {
    const r = validateVitrinePayload({
      vitrine: { headline: 'Cafe Roma', tagline: 'Brera sabah ritueli' },
    });
    expect(r.ok).toBe(true);
    expect(r.vitrine.headline).toBe('Cafe Roma');
  });

  test('badge highlight max 5 for venue', () => {
    const r = validateVitrinePayload({
      vitrine: { headline: 'X' },
      highlighted_badge_keys: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(r.ok).toBe(false);
    expect(LOCAL_CONFIG.venue.BADGE_HIGHLIGHT_VENUE).toBe(5);
  });

  test('locked section ids cover manager-only areas', () => {
    expect(LOCKED_SECTION_IDS).toContain('floor_plan');
    expect(LOCKED_SECTION_IDS).toContain('archive_full');
  });
});
