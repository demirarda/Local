/**
 * §13 DS ikinci yüz — Keşif Pusulası + hakim agregat kilitleri
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import LOCAL_CONFIG, {
  dsTrendFromEmaRaw,
  binDsValues,
  crowdFitScore,
} from '../config/localConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('§13 DS ikinci yüz', () => {
  test('agregat MIN-N ⭐ launch 20', () => {
    expect(LOCAL_CONFIG.ds.AGGREGATE_MIN_N).toBe(20);
  });

  test('Yüz-2 ağırlık / EMA / 5-R / tier eşikleri', () => {
    expect(LOCAL_CONFIG.ds.W_PD).toBe(0.6);
    expect(LOCAL_CONFIG.ds.W_CTX).toBe(0.3);
    expect(LOCAL_CONFIG.ds.W_VD).toBe(0.1);
    expect(LOCAL_CONFIG.ds.ALPHA).toBe(0.3);
    expect(LOCAL_CONFIG.ds.RITUAL_WINDOW).toBe(5);
    expect(LOCAL_CONFIG.ds.TIER_THRESHOLDS).toEqual([0.35, 0.5, 0.65, 0.8]);
  });

  test('trend: yargı yok — açılıyor / durağan / daralıyor', () => {
    expect(dsTrendFromEmaRaw(0.5, 0.56)).toEqual({ trend: 'rising', label: 'açılıyor' });
    expect(dsTrendFromEmaRaw(0.5, 0.5)).toEqual({ trend: 'steady', label: 'durağan' });
    expect(dsTrendFromEmaRaw(0.5, 0.44)).toEqual({ trend: 'falling', label: 'daralıyor' });
  });

  test('binDsValues MIN-N altında gizler; user_id yok', () => {
    const hidden = binDsValues([0.2, 0.4, 0.6], 20);
    expect(hidden.hidden).toBe(true);
    expect(hidden).not.toHaveProperty('user_id');
    expect(JSON.stringify(hidden)).not.toMatch(/user_id/);

    const shown = binDsValues(Array.from({ length: 20 }, (_, i) => (i < 10 ? 0.2 : 0.7)), 20);
    expect(shown.hidden).toBe(false);
    expect(shown.n).toBe(20);
    expect(shown.bins.every((b) => typeof b.share === 'number')).toBe(true);
    expect(JSON.stringify(shown)).not.toMatch(/user_id/);
  });

  test('crowdFitScore örtüşme 0–1', () => {
    const a = [{ range: '0.00–0.20', share: 1 }, { range: '0.20–0.35', share: 0 }];
    const b = [{ range: '0.00–0.20', share: 1 }, { range: '0.20–0.35', share: 0 }];
    expect(crowdFitScore(a, b)).toBe(1);
    const c = [{ range: '0.00–0.20', share: 0 }, { range: '0.20–0.35', share: 1 }];
    expect(crowdFitScore(a, c)).toBe(0);
  });

  test('placement fail-closed + dashboard Yüz-1 sızdırmaz', () => {
    const engine = readFileSync(join(root, 'services/dsEngine.js'), 'utf8');
    expect(engine).toMatch(/placementComplete = false/);
    const dashFn = engine.slice(engine.indexOf('export async function getPrivateDsDashboard'));
    const body = dashFn.slice(0, dashFn.indexOf('export async function getCityDsCurveByCityId'));
    expect(body).not.toMatch(/ds_multiplier/);
    expect(body).not.toMatch(/ds_ema:/);
    const usersApi = readFileSync(join(root, 'api/users.js'), 'utf8');
    expect(usersApi).toMatch(/delete data\[k\]/);
    expect(usersApi).toMatch(/ds_multiplier/);
  });

  test('hakim agregat: venue / zone / brand — user_id payload yok', () => {
    const agg = readFileSync(join(root, 'services/dsAggregateService.js'), 'utf8');
    expect(agg).toContain('getVenueCrowdMix');
    expect(agg).toContain('getZoneDiscoveryIndex');
    expect(agg).toContain('getBrandCrowdFit');
    expect(agg).toMatch(/SELECT uds\.ds_full_ema/);
    expect(agg).not.toMatch(/user_id,/);
    expect(agg).toContain("teaser: true");
    const venuesApi = readFileSync(join(root, 'api/venues.js'), 'utf8');
    expect(venuesApi).toContain('/:id/ds-crowd-mix');
    expect(venuesApi).toContain("'reputation'");
    const searchApi = readFileSync(join(root, 'api/search.js'), 'utf8');
    expect(searchApi).toContain('/brands/:id/ds-fit');
    expect(searchApi).toContain('isBrandMember');
    const zone = readFileSync(join(root, 'services/zoneService.js'), 'utf8');
    expect(zone).toContain('ds_discovery');
    const web = readFileSync(join(root, 'api/webShowcase.js'), 'utf8');
    expect(web).toContain('delete safe.ds_discovery');
  });

  test('share payload kişisel DS anahtarlarını söker', () => {
    const share = readFileSync(join(root, 'services/shareService.js'), 'utf8');
    expect(share).toContain("'ds_full_ema'");
    expect(share).toContain("'ds_multiplier'");
    expect(share).toContain("'city_curve'");
  });
});
