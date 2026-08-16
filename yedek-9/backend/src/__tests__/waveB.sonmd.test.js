import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isWeatherCancelEligible,
  toAudience,
  audienceToLegacyScope,
} from '../services/waveBSocial.js';

describe('sonMD Wave B', () => {
  test('weather_cancel config', () => {
    expect(LOCAL_CONFIG.weather_cancel.ENABLED).toBe(true);
    expect(LOCAL_CONFIG.weather_cancel.WINDOW_HOURS_BEFORE_START).toBe(3);
    expect(LOCAL_CONFIG.weather_cancel.CATEGORY_KEYS).toContain('yuruyus_kosu');
  });

  test('weather cancel eligible within 3h outdoor', () => {
    const start = new Date(Date.now() + 2 * 3600 * 1000);
    const r = isWeatherCancelEligible(
      { start_time: start, category_label: 'Yuruyus', location_type: 'custom' },
      new Date()
    );
    expect(r.ok).toBe(true);
  });

  test('weather cancel rejects indoor / too early', () => {
    const start = new Date(Date.now() + 10 * 3600 * 1000);
    const early = isWeatherCancelEligible(
      { start_time: start, category_label: 'Yuruyus', location_type: 'custom' },
      new Date()
    );
    expect(early.ok).toBe(false);
    expect(early.reason).toBe('too_early');

    const soon = new Date(Date.now() + 1 * 3600 * 1000);
    const indoor = isWeatherCancelEligible(
      { start_time: soon, category_label: 'Kahve', location_type: 'custom' },
      new Date()
    );
    expect(indoor.ok).toBe(false);
    expect(indoor.reason).toBe('not_outdoor_category');
  });

  test('memory audience maps legacy scopes', () => {
    expect(toAudience('solo')).toBe('WINDOW');
    expect(toAudience('pulse')).toBe('CIRCLE');
    expect(toAudience('all')).toBe('CITY');
    expect(toAudience('CITY')).toBe('CITY');
    expect(audienceToLegacyScope('WINDOW')).toBe('solo');
    expect(audienceToLegacyScope('CIRCLE')).toBe('pulse');
    expect(audienceToLegacyScope('CITY')).toBe('all');
  });

  test('messaging reactions + edit window', () => {
    expect(LOCAL_CONFIG.messaging.EDIT_WINDOW_MIN).toBe(5);
    expect(LOCAL_CONFIG.messaging.REACTIONS).toEqual(['🤝', '😂', '🙌', '👀', '💡', '❓']);
  });

  test('account privacy + collaborator scopes', () => {
    expect(LOCAL_CONFIG.account_privacy.DEFAULT).toBe('OPEN');
    expect(LOCAL_CONFIG.account_privacy.CLOSED_LW_EXCEPTION).toBe(true);
    expect(LOCAL_CONFIG.collaborator.ALLOWED_SCOPES).toEqual([
      'series',
      'event_group',
      'venue_event',
    ]);
  });

  test('saves rank effect is zero', () => {
    expect(LOCAL_CONFIG.saves.RANK_EFFECT).toBe(0);
  });
});
