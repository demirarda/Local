import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  chipsForFeeling,
  validateChipSelection,
  routeForChip,
  getChipPublicConfig,
  chipSetKey,
  ritualTopChipPublic,
} from '../services/chipService.js';

describe('chip system §10 / E2.8', () => {
  test('RQ sets match locked counts (3 per color)', () => {
    expect(LOCAL_CONFIG.chip.SETS.RQ_GREEN).toHaveLength(3);
    expect(LOCAL_CONFIG.chip.SETS.RQ_YELLOW).toHaveLength(3);
    expect(LOCAL_CONFIG.chip.SETS.RQ_RED).toHaveLength(3);
    expect(LOCAL_CONFIG.chip.RQ_OPTIONS_PER_COLOR).toBe(3);
    expect(LOCAL_CONFIG.chip.P2V_OPTIONS_PER_COLOR).toBe(5);
  });

  test('P2V sets are 5 per color', () => {
    expect(LOCAL_CONFIG.chip.SETS.P2V_GREEN).toHaveLength(5);
    expect(LOCAL_CONFIG.chip.SETS.P2V_YELLOW).toHaveLength(5);
    expect(LOCAL_CONFIG.chip.SETS.P2V_RED).toEqual(
      expect.arrayContaining([
        'p2v_r_servis',
        'p2v_r_gurultu',
        'p2v_r_temizlik',
        'p2v_r_ucret',
        'p2v_r_masa',
      ])
    );
  });

  test('single select + rotate defaults', () => {
    expect(LOCAL_CONFIG.chip.SINGLE_SELECT).toBe(true);
    expect(LOCAL_CONFIG.chip.ROTATE).toBe(true);
    expect(LOCAL_CONFIG.chip.PUBLIC_MIN_N).toBe(10);
  });

  test('chipsForFeeling returns route + shuffled list', () => {
    const chips = chipsForFeeling('RQ', 'yellow');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveProperty('id');
    expect(chips[0]).toHaveProperty('route');
  });

  test('P2V red routes to venue_itibar; marker to ops', () => {
    expect(routeForChip('p2v_r_servis')).toBe('venue_itibar');
    expect(routeForChip('p2v_g_1')).toBe('venue_itibar');
    expect(routeForChip('p2z_r_marker')).toBe('ops');
    expect(routeForChip('rq_g_1')).toBe('host_private');
  });

  test('validateChipSelection rejects P2P chips and invalid ids', () => {
    expect(validateChipSelection({ feedbackType: 'p2p', chipId: 'rq_g_1' }).ok).toBe(false);
    expect(
      validateChipSelection({
        feedbackType: 'p2r',
        chipId: 'rq_g_1',
        p2r_feeling: 'green',
      }).ok
    ).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2z',
        chipId: 'p2z_y_1',
        p2r_feeling: 'yellow',
      }).ok
    ).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2v',
        chipId: 'p2v_y_1',
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
    expect(
      validateChipSelection({
        feedbackType: 'p2r',
        chipId: 'p2v_r_servis',
        p2r_feeling: 'green',
      }).ok
    ).toBe(false);
    expect(validateChipSelection({ feedbackType: 'p2r', chipId: null }).ok).toBe(true);
  });

  test('public config exposes sets', () => {
    const cfg = getChipPublicConfig();
    expect(cfg.single_select).toBe(true);
    expect(cfg.sets.RQ_GREEN).toHaveLength(3);
    expect(cfg.no_chips_for).toContain('p2p');
    expect(cfg.top_chip_ritual_min_distinct).toBe(3);
  });

  test('chipSetKey maps P2V yellow to P2V_YELLOW not GREEN', () => {
    expect(chipSetKey('P2V', 'yellow')).toBe('P2V_YELLOW');
    expect(chipSetKey('P2V', 'green')).toBe('P2V_GREEN');
    expect(chipSetKey('P2Z', 'red')).toBe('P2Z_RED');
    expect(chipsForFeeling('P2V', 'yellow').map((c) => c.id)).toEqual(
      expect.arrayContaining(['p2v_y_1', 'p2v_y_5'])
    );
  });

  test('route enum has no aura value', () => {
    const routes = Object.values(LOCAL_CONFIG.chip.ROUTES);
    expect(routes).not.toContain('aura');
    for (const r of routes) {
      expect(['host_private', 'venue_itibar', 'ops']).toContain(r);
    }
  });

  test('ritual top-chip public gate is 3 distinct answers', () => {
    expect(ritualTopChipPublic({ distinctAnswerCount: 2 })).toBe(false);
    expect(ritualTopChipPublic({ distinctAnswerCount: 3 })).toBe(true);
    expect(LOCAL_CONFIG.chip.TOP_CHIP_RITUAL_MIN_DISTINCT).toBe(3);
  });
});
