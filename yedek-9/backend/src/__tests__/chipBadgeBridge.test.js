import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isChipBridgeEnabled,
  isChipBridgeOpen,
} from '../services/chipBadgeBridgeService.js';

describe('chip→badge bridge §9', () => {
  test('bridge open for signals — no auto-grant at launch', () => {
    expect(isChipBridgeOpen()).toBe(true);
    expect(isChipBridgeEnabled()).toBe(false);
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.min_repeats).toBeGreaterThanOrEqual(2);
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.pattern_map.p2v_g_1).toBe('venue_regular');
  });

  test('LLM pipeline remains off', () => {
    expect(LOCAL_CONFIG.badges.LLM_PIPELINE_ENABLED).toBe(false);
  });
});
