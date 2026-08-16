import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isSeriesRegularEnabled,
  SERIES_REGULAR_SPEC,
  assertSeriesRegularOnlyJoin,
} from '../services/seriesRegularService.js';

describe('Series-Regular F1.5', () => {
  test('flag off at launch + zero boosts', () => {
    expect(LOCAL_CONFIG.stubs.SERIES_REGULAR_ENABLED).toBe(false);
    expect(isSeriesRegularEnabled()).toBe(false);
    expect(SERIES_REGULAR_SPEC.score_boost).toBe(0);
    expect(SERIES_REGULAR_SPEC.discovery_boost).toBe(0);
    expect(SERIES_REGULAR_SPEC.min_seals).toBe(5);
    expect(SERIES_REGULAR_SPEC.window).toBe(8);
  });

  test('assertSeriesRegularOnlyJoin allows host even when flag off', async () => {
    const r = await assertSeriesRegularOnlyJoin({
      userId: 'host-1',
      ritual: { visibility: 'series_regular_only', series_id: 's1', host_id: 'host-1' },
    });
    expect(r.ok).toBe(true);
  });

  test('assertSeriesRegularOnlyJoin no-ops for public', async () => {
    const r = await assertSeriesRegularOnlyJoin({
      userId: 'u1',
      ritual: { visibility: 'public', series_id: 's1' },
    });
    expect(r.ok).toBe(true);
  });
});
