/**
 * sonMD Build v3 — yapısal %100 kabul testi
 * §19 canlı vendor (KYC/CSAM/Stripe keys) ops tavanı; kod boşluğu sayılmaz.
 */
import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import STRING_TABLE from '../i18n/stringTable.js';
import { CHIP_COPY_STUBS } from '../i18n/chipCopyStubs.js';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const REQUIRED_SERVICES = [
  'firstSealService.js',
  'checkinService.js',
  'modEngine.js',
  'regularService.js',
  'shadowVenueService.js',
  'zoneService.js',
  'searchService.js',
  'rsEngine.js',
  'nightReportService.js',
  'ritualCreateValidation.js',
  'seriesService.js',
  'chipService.js',
  'eventGroupService.js',
  'venueLeadService.js',
];

const REQUIRED_STRING_KEYS = [
  'fee_badge',
  'audience_public',
  'audience_friends',
  'win_report',
  'win_report_leave',
  'win_share_location',
  'win_help',
  'tab_rulo',
  'share_window',
  'share_circle',
  'share_city',
  'save_to_rulo',
  'forum_after_window',
  'find_note_label',
  'night_report_title',
  'regular_progress',
  'checkin_find_table',
  'pending_witness',
  'culture_id_1',
  'report_cat_uncomfortable',
  'soz',
  'yanki',
  'rulo',
];

describe('pct100 structural Build v3', () => {
  test('core services exist', () => {
    for (const name of REQUIRED_SERVICES) {
      expect(existsSync(join(root, 'services', name))).toBe(true);
    }
  });

  test('fee + audience config locked', () => {
    expect(LOCAL_CONFIG.ritual.AUDIENCE_DEFAULT).toBe('PUBLIC');
    expect(LOCAL_CONFIG.ritual.AUDIENCE_VALUES).toEqual(['PUBLIC', 'FRIENDS']);
    expect(LOCAL_CONFIG.ritual.FEE_CURRENCY_DEFAULT).toBe('TRY');
    expect(LOCAL_CONFIG.ritual.FEE_NOTE_DEFAULT).toBeTruthy();
  });

  test('SPARK stub flag false', () => {
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
  });

  test('Master §16 growth + §2E event_group + LW weights', () => {
    expect(LOCAL_CONFIG.growth.WEEKLY_RITUALS_CLUSTER_MIN).toBe(50);
    expect(LOCAL_CONFIG.event_group.CORNER_CAP).toBe(12);
    expect(LOCAL_CONFIG.event_group.MAX_CORNERS).toBe(8);
    expect(LOCAL_CONFIG.pulse.LW_WEIGHTS.place).toBe(0.3);
    expect(LOCAL_CONFIG.pulse.LW_WEIGHTS.pop).toBe(0.1);
  });

  test('no-peer 0.35 / 7.5', () => {
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_DAMPENER).toBe(0.35);
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_CEILING).toBe(7.5);
  });

  test('regular PARKED false · N4 · WINDOW 45', () => {
    expect(LOCAL_CONFIG.regular.PARKED).toBe(false);
    expect(LOCAL_CONFIG.regular.N).toBe(4);
    expect(LOCAL_CONFIG.regular.WINDOW_D).toBe(45);
  });

  test('badge 6 aile', () => {
    expect(LOCAL_CONFIG.badges.CATEGORIES).toHaveLength(6);
  });

  test('chip RQ3 / P2V5 + fee surprise', () => {
    expect(LOCAL_CONFIG.chip.RQ_OPTIONS_PER_COLOR).toBe(3);
    expect(LOCAL_CONFIG.chip.P2V_OPTIONS_PER_COLOR).toBe(5);
    expect(LOCAL_CONFIG.chip.SETS.P2V_RED).toContain('p2v_r_ucret');
  });

  test('§19 product-complete stubs', () => {
    expect(LOCAL_CONFIG.open.kyc_provider_contract.treat_as_complete).toBe(true);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.launch_accepted).toBe(true);
    expect(LOCAL_CONFIG.open.csam_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.csam_hold_enforced).toBe(true);
    expect(LOCAL_CONFIG.identity.ACTIVE_PROVIDER).toBe('stub');
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.tiers.length).toBeGreaterThanOrEqual(3);
  });

  test('witness LEGACY_2_TIER · FUTURE_3 off', () => {
    expect(LOCAL_CONFIG.witness.ACTIVE_SCHEME).toBe('LEGACY_2_TIER');
    expect(LOCAL_CONFIG.witness.FUTURE_3_TIER_ENABLED).toBe(false);
  });

  test('string table product surface keys present', () => {
    const keyCount = Object.keys(STRING_TABLE).length;
    expect(keyCount).toBeGreaterThanOrEqual(90);
    for (const k of REQUIRED_STRING_KEYS) {
      expect(STRING_TABLE[k]).toBeTruthy();
      expect(STRING_TABLE[k].EN || STRING_TABLE[k].TR).toBeTruthy();
    }
    expect(CHIP_COPY_STUBS.p2v_r_ucret?.TR).toMatch(/ücret|Ücret/i);
  });

  test('migration 118 fee+audience registered', () => {
    const runner = readFileSync(join(root, '../scripts/run-migrations.js'), 'utf8');
    expect(runner).toContain('118_ritual_fee_audience.sql');
    expect(existsSync(join(root, 'migrations/118_ritual_fee_audience.sql'))).toBe(true);
  });

  test('escrow permanently removed from product path', () => {
    const ritualsSrc = readFileSync(join(root, 'api/rituals.js'), 'utf8');
    expect(ritualsSrc).toMatch(/ESCROW_REMOVED/);
    expect(ritualsSrc).not.toMatch(/keyword_escrow_user_id:/);
  });

  test('v3 launch flags: F1.5/web/compact/chip-bridge closed', () => {
    expect(LOCAL_CONFIG.stubs.WEB_SHOWCASE_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.FRIENDS_DM_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.SERIES_REGULAR_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.stubs.RITUAL_DESIGNER_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.compact.enabled).toBe(false);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.COMPACT_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.open.compact_band_approved).toBe(false);
    expect(LOCAL_CONFIG.badges.CHIP_BRIDGE.enabled).toBe(false);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.SUGGESTION_PENDING_PER_VENUE).toBe(1);
  });

  test('§18 aliases locked', () => {
    expect(LOCAL_CONFIG.ritual.MIN_DURATION_MIN).toBe(30);
    expect(LOCAL_CONFIG.ritual.ABSOLUTE_TABLE_CAP).toBe(40);
    expect(LOCAL_CONFIG.checkin.CODE_BAN_MIN_SIZE).toBe(100);
    expect(LOCAL_CONFIG.compact.SEAT_LE40_MULT).toBe(0.7);
  });
});
