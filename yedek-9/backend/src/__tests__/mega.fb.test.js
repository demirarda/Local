import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  FB_TREE,
  assertFbTreeLocks,
  assertChipPair,
  assertNoIntentCopy,
  chipsNeverEnterScores,
  isCfAsleep,
  averageIqDimensions,
  assertP2pPeopleCap,
  feedbackEntersPersonScore,
  vrWalls,
  isAuraRelevantChip,
  buildSikAnilanlar,
  sellerSicilPublic,
  configSetsFromTree,
  fbSpecPins,
} from '../services/megaFb.js';
import { validateChipSelection, chipKindForFeedbackType } from '../services/chipService.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { STRING_TABLE } from '../i18n/stringTable.js';
import { getFeedbackWindowInfo } from '../services/feedbackWindow.js';

describe('FB soru-ağacı locks', () => {
  test('anayasa: 3 kategori · min-4 chip · CF uyku · 12h düz', () => {
    const lock = assertFbTreeLocks();
    expect(lock.ok).toBe(true);
    expect(isCfAsleep()).toBe(true);
    expect(LOCAL_CONFIG.rs.W_CF).toBe(0);
    expect(LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS).toBe(12);
    expect(LOCAL_CONFIG.ritual.FEEDBACK_FREEZE_0208).toBe(false);
    expect(chipsNeverEnterScores()).toBe(true);
    expect(fbSpecPins().max_chip_select).toBe(2);
    expect(fbSpecPins().p2p_max_people).toBe(2);
  });

  test('SETS = ağaç · her dal ≥4 · niyet yok', () => {
    const fromTree = configSetsFromTree();
    for (const [key, ids] of Object.entries(fromTree)) {
      expect(LOCAL_CONFIG.chip.SETS[key]).toEqual(ids);
      expect(ids.length).toBeGreaterThanOrEqual(4);
    }
    for (const ids of Object.values(LOCAL_CONFIG.chip.SETS)) {
      for (const id of ids) {
        const row = STRING_TABLE[id];
        expect(row).toBeDefined();
        expect(assertNoIntentCopy(row.TR).ok).toBe(true);
        expect(assertNoIntentCopy(row.EN).ok).toBe(true);
      }
    }
  });

  test('yeşil+kırmızı asla · ilk kategoriden · komşu ok', () => {
    expect(assertChipPair({ feeling: 'green', chipIds: ['rq_g_1', 'rq_r_1'] }).code).toBe(
      'CHIP_GREEN_RED'
    );
    expect(assertChipPair({ feeling: 'green', chipIds: ['rq_g_1', 'rq_y_1'] }).ok).toBe(true);
    expect(assertChipPair({ feeling: 'green', chipIds: ['rq_g_1', 'rq_g_2'] }).ok).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2r',
        chipId: 'rq_g_1',
        chipId2: 'rq_r_1',
        p2r_feeling: 'green',
      }).code
    ).toBe('CHIP_GREEN_RED');
  });

  test('K1/K2 IQ ortalama · P2C/P2Z/VR skor dışı', () => {
    expect(averageIqDimensions(1, 0)).toBe(0.5);
    expect(feedbackEntersPersonScore('p2p')).toBe(true);
    expect(feedbackEntersPersonScore('p2c')).toBe(false);
    expect(feedbackEntersPersonScore('p2z')).toBe(false);
    expect(feedbackEntersPersonScore('vr')).toBe(false);
    expect(feedbackEntersPersonScore('r1_self')).toBe(false);
    expect(vrWalls().enters_rs).toBe(false);
    expect(vrWalls().public).toBe(false);
    expect(assertP2pPeopleCap(3).code).toBe('P2P_MAX_PEOPLE');
    expect(assertP2pPeopleCap(2).ok).toBe(true);
  });

  test('aura_relevant · sık anılanlar · seller MIN-N', () => {
    expect(isAuraRelevantChip('p2v_g_1')).toBe(true);
    expect(isAuraRelevantChip('p2p_g_1')).toBe(false);
    expect(isAuraRelevantChip('rq_g_1')).toBe(false);
    expect(isAuraRelevantChip('p2z_g_4', { place: 'zone' })).toBe(true);
    expect(isAuraRelevantChip('p2z_r_totem', { place: 'zone' })).toBe(false);
    const vit = buildSikAnilanlar({
      chips: [{ chip_id: 'p2v_g_1', label: 'masa hazırdı' }],
      optIn: true,
      distinctRaters: 4,
      distinctRituals: 2,
    });
    expect(vit.copy).toMatch(/^Sık anılanlar:/);
    expect(vit.exact_count).toBeNull();
    expect(sellerSicilPublic({ n: 3, negative: true }).public).toBe(false);
  });

  test('türler · event E chip · P2C chip · K2', () => {
    expect(chipKindForFeedbackType('rq_event')).toBe('E');
    expect(chipKindForFeedbackType('p2c')).toBe('P2C');
    expect(
      validateChipSelection({
        feedbackType: 'rq_event',
        chipId: 'e_g_1',
        p2r_feeling: 'green',
      }).ok
    ).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2c',
        chipId: 'p2c_g_1',
        p2r_feeling: 'green',
      }).ok
    ).toBe(true);
    expect(
      validateChipSelection({
        feedbackType: 'p2p',
        chipId: 'k2_g_1',
        q2_energy: 'green',
        axis: 'q2',
      }).ok
    ).toBe(true);
    expect(FB_TREE.K1.scores).toBe('iq_q1');
    expect(FB_TREE.K2.scores).toBe('iq_q2');
  });

  test('pencere D-sonu+12h · public pins', () => {
    const ritual = {
      start_time: '2026-09-18T10:00:00.000Z',
      duration: 60,
    };
    const win = getFeedbackWindowInfo(ritual, new Date('2026-09-18T12:00:00.000Z'));
    expect(win.floor_hours).toBe(12);
    const cfg = getPublicConfig();
    expect(cfg.ritual.feedback_floor_hours).toBe(12);
    expect(cfg.ritual.feedback_freeze_0208).toBe(false);
    expect(cfg.rs_display.w_cf).toBe(0);
    expect(cfg.chip.p2p_max_people).toBe(2);
  });
});
