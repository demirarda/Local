import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import { isEventGeneralRqEnabled, shouldAskEventGeneralRq } from '../services/eventGeneralRq.js';
import { chipKindForFeedbackType } from '../services/chipService.js';
import { STRING_TABLE, t } from '../i18n/stringTable.js';

describe('EVENT gece-geneli RQ + chip i18n stubs', () => {
  test('EVENT_GENERAL_RQ_ENABLED locked on', () => {
    expect(LOCAL_CONFIG.chip.EVENT_GENERAL_RQ_ENABLED).toBe(true);
    expect(LOCAL_CONFIG.chip.MAX_CHIP_SELECT).toBe(1);
    expect(isEventGeneralRqEnabled()).toBe(true);
  });

  test('rq_event has no chip kind (feeling-only)', () => {
    expect(chipKindForFeedbackType('rq_event')).toBeNull();
    expect(chipKindForFeedbackType('p2r')).toBe('RQ');
  });

  test('shouldAskEventGeneralRq false without ritual', async () => {
    expect(await shouldAskEventGeneralRq(null)).toBe(false);
  });

  test('chip copy locked · no open rows, no [OPEN] prefix', () => {
    expect(STRING_TABLE.fb_event_general_q.TR).toMatch(/Gece geneli/i);
    expect(STRING_TABLE.rq_g_1.open).toBe(false);
    expect(STRING_TABLE.p2v_r_ucret.open).toBe(false);
    expect(t('rq_g_1', 'tr')).toMatch(/Sohbet/);
    expect(t('fb_event_general_q', 'en')).toMatch(/night overall/i);

    const chipKeys = Object.values(LOCAL_CONFIG.chip.SETS).flat();
    for (const key of chipKeys) {
      const row = STRING_TABLE[key];
      expect(row).toBeDefined();
      expect(row.open).toBe(false);
      expect(row.TR).not.toMatch(/\[OPEN\]/);
      expect(row.EN).not.toMatch(/\[OPEN\]/);
    }
  });

  test('RQ 3/renk · P2V 5/renk seed counts match sonMD §9', () => {
    const { SETS } = LOCAL_CONFIG.chip;
    for (const color of ['RQ_GREEN', 'RQ_YELLOW', 'RQ_RED']) {
      expect(SETS[color]).toHaveLength(LOCAL_CONFIG.chip.RQ_OPTIONS_PER_COLOR);
    }
    for (const color of ['P2V_GREEN', 'P2V_YELLOW', 'P2V_RED']) {
      expect(SETS[color]).toHaveLength(LOCAL_CONFIG.chip.P2V_OPTIONS_PER_COLOR);
    }
  });
});
