import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  REPORT_SURFACES,
  REPORT_CATEGORIES,
  LIVE_SAFETY_ACTIONS,
  MOD_IRON_RULES,
} from '../services/modSurfaces.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('MOD rapor yolu smoke (§5)', () => {
  test('≥11 report surfaces + 4 live safety actions', () => {
    expect(REPORT_SURFACES.length).toBeGreaterThanOrEqual(11);
    expect(LIVE_SAFETY_ACTIONS).toEqual([
      'report',
      'report_and_leave',
      'share_location',
      'help_options',
    ]);
    expect(REPORT_CATEGORIES).toContain('report_cat_csam');
  });

  test('iron rules: raw report never touches RS', () => {
    expect(MOD_IRON_RULES.raw_report_touches_rs).toBe(false);
    expect(MOD_IRON_RULES.rs_path).toBe('applyModAction_MOD_BYPASS_only');
    expect(MOD_IRON_RULES.leave_after_cannot_give_fb).toBe(true);
  });

  test('createReport source does not call RS pipeline', () => {
    const src = readFileSync(join(__dirname, '../services/modEngine.js'), 'utf8');
    // Ham rapor bloğunda rsEngine import yok; MOD-BYPASS yalnız applyModAction içinde
    const createFn = src.slice(src.indexOf('export async function createReport'), src.indexOf('export async function hasActiveSanction'));
    expect(createFn).not.toMatch(/rsEngine|updateRsScore|computeTruthSignal/);
    expect(createFn).toMatch(/leave_after/);
    expect(createFn).toMatch(/cancelAttendancePenaltyFree|left_early/);

    const applyFn = src.slice(src.indexOf('export async function applyModAction'));
    expect(applyFn).toMatch(/MOD-BYPASS/);
    expect(applyFn).toMatch(/L3_RS_BASE/);
  });

  test('mod ladder + SLA config intact', () => {
    expect(LOCAL_CONFIG.mod.L1_PACKET_MIN).toBe(3);
    expect(LOCAL_CONFIG.mod.SLA_H.safety).toBe(2);
    expect(LOCAL_CONFIG.open.csam_status).toBe('ops_review_fallback');
  });

  test('LiveRitualScreen exposes 4 safety CTAs', () => {
    const ui = readFileSync(
      join(__dirname, '../../../mobile/src/screens/LiveRitualScreen.js'),
      'utf8'
    );
    expect(ui).toMatch(/Bildir ve ayrıl/);
    expect(ui).toMatch(/>Bildir</);
    expect(ui).toMatch(/Konum/);
    expect(ui).toMatch(/Yardım/);
    expect(ui).toMatch(/leaveAfter:\s*true/);
  });
});
