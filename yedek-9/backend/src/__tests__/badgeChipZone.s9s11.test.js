/**
 * §9–§11 Badge / Chip / Zone — v3 satır 264–305 kapanış
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  chipSetKey,
  validateChipSelection,
  ritualTopChipPublic,
  routeForChip,
} from '../services/chipService.js';
import { isChipBridgeOpen, isChipBridgeEnabled } from '../services/chipBadgeBridgeService.js';
import { isSparkEnabled } from '../services/zoneService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, '../../../mobile/src');

function readMobile(rel) {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('§9–§11 pct100', () => {
  test('chip→badge signals open · auto-grant off · LLM off', () => {
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.open).toBe(true);
    expect(isChipBridgeOpen()).toBe(true);
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.enabled).toBe(false);
    expect(isChipBridgeEnabled()).toBe(false);
    expect(LOCAL_CONFIG.badges.LLM_PIPELINE_ENABLED).toBe(false);
  });

  test('P2V yellow validates yellow set, not green', () => {
    expect(chipSetKey('P2V', 'yellow')).toBe('P2V_YELLOW');
    expect(
      validateChipSelection({
        feedbackType: 'p2v',
        chipId: 'p2v_y_3',
        p2v_feeling: 'yellow',
      }).ok
    ).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2v',
        chipId: 'p2v_g_1',
        p2v_feeling: 'yellow',
      }).ok
    ).toBe(false);
  });

  test('RitualFeedbackScreen P2V yellow + P2Z satırı', () => {
    const src = readMobile('screens/RitualFeedbackScreen.js');
    expect(src).toContain("feeling === 'yellow' ? 'P2V_YELLOW'");
    expect(src).not.toMatch(/kind === 'P2V'\) key = feeling === 'red' \? 'P2V_RED' : 'P2V_GREEN'/);
    expect(src).toContain("feedback_type: 'p2z'");
    expect(src).toContain('P2Z — Zone nasildi?');
    expect(src).toContain("chipIdsFor('P2Z'");
  });

  test('ritual top-chip ≥3 distinct · venue ≥10 · no person_score', () => {
    expect(LOCAL_CONFIG.chip.TOP_CHIP_RITUAL_MIN_DISTINCT).toBe(3);
    expect(LOCAL_CONFIG.chip.PUBLIC_MIN_N).toBe(10);
    expect(ritualTopChipPublic({ distinctAnswerCount: 2, minDistinct: 3 })).toBe(false);
    expect(ritualTopChipPublic({ distinctAnswerCount: 3, minDistinct: 3 })).toBe(true);
    const ritualsApi = readFileSync(join(__dirname, '../api/rituals.js'), 'utf8');
    expect(ritualsApi).toContain('getPublicRitualChipBreakdown');
    expect(ritualsApi).toContain('chip_breakdown');
    const detail = readMobile('screens/RitualDetailScreen.js');
    expect(detail).toContain('kisi puani degil');
  });

  test('route enum excludes aura; marker → ops', () => {
    expect(routeForChip('p2z_r_marker')).toBe('ops');
    for (const r of Object.values(LOCAL_CONFIG.chip.ROUTES)) {
      expect(['host_private', 'venue_itibar', 'ops']).toContain(r);
    }
  });

  test('SPARK off · zone badge 3p/1p · 6 aile', () => {
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
    expect(isSparkEnabled()).toBe(false);
    expect(LOCAL_CONFIG.zone.BADGE_RITUAL_P).toBe(3);
    expect(LOCAL_CONFIG.zone.MARKER_P).toBe(1);
    expect(LOCAL_CONFIG.badges.CATEGORIES).toEqual([
      'SPECIAL',
      'MASTERY',
      'BEHAVIORAL',
      'VENUE',
      'ZONE',
      'MILESTONE',
    ]);
  });
});
