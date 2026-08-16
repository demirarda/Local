/**
 * §12–§13 Arama / şehir / bildirim — v3 satır 307–367 kapanış
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  SEARCH_TABS,
  CITY_SCOPED_TABS,
  appendCitySql,
} from '../services/searchService.js';
import { remainingToNextLevel } from '../services/badgeEngine.js';
import { PUSH_SILENT_TYPES } from '../services/notifications.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mobileRoot = join(__dirname, '../../../mobile/src');

function readSrc(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function readMobile(rel) {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('§12–§13 pct100', () => {
  test('CITY_SCOPED_TABS cover keşif/slot; forum/people/brands stay unscoped', () => {
    expect(CITY_SCOPED_TABS).toEqual(
      expect.arrayContaining([
        'rituals',
        'series',
        'slots',
        'venues',
        'zones',
        'memories',
        'category',
        'location',
      ])
    );
    expect(CITY_SCOPED_TABS).not.toContain('forum');
    expect(CITY_SCOPED_TABS).not.toContain('people');
    expect(CITY_SCOPED_TABS).not.toContain('brands');
    expect(SEARCH_TABS).toEqual(expect.arrayContaining(['forum', 'people', 'brands']));
  });

  test('appendCitySql mutates params and no-ops without city', () => {
    expect(appendCitySql(['q'], null, 'r.city_id')).toBe('');
    const params = ['q'];
    expect(appendCitySql(params, 'cid-1', 'r.city_id')).toBe(' AND r.city_id = $2');
    expect(params).toEqual(['q', 'cid-1']);
  });

  test('searchService runners pass scoped city except forum/people/brands', () => {
    const src = readSrc('services/searchService.js');
    expect(src).toContain('resolveActiveCityId');
    expect(src).toContain('searchRituals(query, viewerId, lim, scopedCity)');
    expect(src).toContain('searchSlots(query, lim, scopedCity)');
    expect(src).toContain('searchForum(query, lim)');
    expect(src).toContain('searchPeople(query, viewerId, lim)');
    expect(src).toContain('searchBrands(query, lim)');
    expect(src).not.toContain('searchForum(query, lim, scopedCity)');
  });

  test('zones + memories city_id migration + stamp trigger', () => {
    const mig = readFileSync(join(root, 'migrations/123_city_scope_s12s13.sql'), 'utf8');
    expect(mig).toContain('ALTER TABLE zones');
    expect(mig).toContain('ADD COLUMN IF NOT EXISTS city_id');
    expect(mig).toContain('ALTER TABLE memories');
    expect(mig).toContain('stamp_memory_city_id');
    expect(mig).toContain('notify_badge_approaching SET DEFAULT true');
    const zone = readSrc('services/zoneService.js');
    expect(zone).toContain('city_id');
    expect(zone).toMatch(/INSERT INTO zones \(name, geo_lat, geo_lng, marker_type, radius_m, city_id\)/);
  });

  test('badge approaching: remaining===2 · copy · not silent · push default on', () => {
    expect(remainingToNextLevel({ value: 3, next_threshold: 5 })).toBe(2);
    expect(remainingToNextLevel({ value: 4, next_threshold: 5 })).toBe(1);
    expect(remainingToNextLevel({ value: 5, next_threshold: 5 })).toBe(0);
    expect(PUSH_SILENT_TYPES.has('badge_approaching')).toBe(false);
    expect(LOCAL_CONFIG.notifications.PUSH_DEFAULTS.badge_approach).toBe(true);
    expect(LOCAL_CONFIG.notifications.PUSH_DEFAULTS.memory_downvote).toBe(false);
    expect(LOCAL_CONFIG.notifications.PUSH_DEFAULTS.retro_publish).toBe(false);
    const notif = readSrc('services/notifications.js');
    expect(notif).toContain('ritüel kaldı');
    expect(notif).not.toMatch(/badge_approaching',\s*\n\s*'fl_change'/);
    const engine = readSrc('services/badgeEngine.js');
    expect(engine).toContain('remaining !== 2');
    expect(engine).not.toContain('progress_pct || 0) >= 70');
  });

  test('prefs copy moved off silent card; pulse city filter still present', () => {
    const prefs = readMobile('screens/NotificationPreferencesScreen.js');
    expect(prefs).toContain('2 ritüel kaldı');
    expect(prefs).not.toContain('%70+ yakin');
    const rituals = readSrc('api/rituals.js');
    expect(rituals).toContain('ritualCityFilterSql');
  });
});
