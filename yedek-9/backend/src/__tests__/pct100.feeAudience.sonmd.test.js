/**
 * sonMD §2C structural 100% — fee · audience · SPARK off · escrow gone
 */
import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  parseRitualFee,
  normalizeRitualAudience,
  feeDtoFromRow,
} from '../services/ritualCreateValidation.js';
import { ritualDiscoveryAudienceSql } from '../services/ritualState.js';
import { isSparkEnabled } from '../services/zoneService.js';
import { notifyKeywordEscrowOffer } from '../services/notifications.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('pct100 fee + audience §2C', () => {
  test('SPARK_ENABLED is false (stubs)', () => {
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
    expect(isSparkEnabled()).toBe(false);
  });

  test('audience PUBLIC|FRIENDS enum validation', () => {
    expect(LOCAL_CONFIG.ritual.AUDIENCE_DEFAULT).toBe('PUBLIC');
    expect(LOCAL_CONFIG.ritual.AUDIENCE_VALUES).toEqual(['PUBLIC', 'FRIENDS']);
    expect(normalizeRitualAudience(null).audience).toBe('PUBLIC');
    expect(normalizeRitualAudience('friends').audience).toBe('FRIENDS');
    expect(normalizeRitualAudience('PUBLIC').ok).toBe(true);
    expect(normalizeRitualAudience('CITY').ok).toBe(false);
  });

  test('fee columns accepted conceptually (parse + DTO)', () => {
    expect(LOCAL_CONFIG.ritual.FEE_CURRENCY_DEFAULT).toBe('TRY');
    expect(LOCAL_CONFIG.ritual.FEE_NOTE_DEFAULT).toBe('yerinde ödenir');

    expect(parseRitualFee({}).fee).toBeNull();
    expect(parseRitualFee({ fee_amount: '' }).fee).toBeNull();

    const nested = parseRitualFee({
      fee: { amount: 120.5, currency: 'try', note: 'masada' },
    });
    expect(nested.ok).toBe(true);
    expect(nested.fee).toEqual({
      amount: 120.5,
      currency: 'TRY',
      note: 'masada',
    });

    const flat = parseRitualFee({ fee_amount: 50 });
    expect(flat.ok).toBe(true);
    expect(flat.fee.amount).toBe(50);
    expect(flat.fee.currency).toBe('TRY');
    expect(flat.fee.note).toBe('yerinde ödenir');

    expect(parseRitualFee({ fee_amount: -1 }).ok).toBe(false);

    expect(feeDtoFromRow({ fee_amount: null })).toBeNull();
    expect(feeDtoFromRow({ fee_amount: 80, fee_currency: 'TRY', fee_note: null })).toEqual({
      amount: 80,
      currency: 'TRY',
      note: 'yerinde ödenir',
    });
  });

  test('discovery audience SQL gates FRIENDS to FL1–FL3', () => {
    const sql = ritualDiscoveryAudienceSql('$1', 'r');
    expect(sql).toMatch(/audience/);
    expect(sql).toMatch(/FRIENDS|PUBLIC/);
    expect(sql).toMatch(/l1.*l2.*l3|friendship_level/);
    expect(ritualDiscoveryAudienceSql(null, 'r')).toMatch(/PUBLIC/);
  });

  test('fee surprise chip exists in P2V_RED catalog', () => {
    expect(LOCAL_CONFIG.chip.SETS.P2V_RED).toContain('p2v_r_ucret');
    expect(LOCAL_CONFIG.chip.ROUTES.p2v_r_ucret).toBe('venue_itibar');
  });

  test('escrow claim endpoint returns gone/removed', () => {
    const ritualsSrc = readFileSync(
      join(__dirname, '../api/rituals.js'),
      'utf8'
    );
    expect(ritualsSrc).toMatch(/claim-escrow/);
    expect(ritualsSrc).toMatch(/ESCROW_REMOVED/);
    expect(ritualsSrc).toMatch(/status\(410\)/);
    expect(ritualsSrc).not.toMatch(/keyword_escrow_user_id:/);
  });

  test('keyword_escrow_offer push is disabled', async () => {
    const r = await notifyKeywordEscrowOffer('user-1', { id: 'r1', title: 'x' });
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('ESCROW_REMOVED');
  });

  test('migration 118 registered', () => {
    const runner = readFileSync(
      join(__dirname, '../../scripts/run-migrations.js'),
      'utf8'
    );
    expect(runner).toMatch(/118_ritual_fee_audience\.sql/);
    const mig = readFileSync(
      join(__dirname, '../migrations/118_ritual_fee_audience.sql'),
      'utf8'
    );
    expect(mig).toMatch(/fee_amount/);
    expect(mig).toMatch(/audience/);
    expect(mig).toMatch(/PUBLIC.*FRIENDS|FRIENDS.*PUBLIC/);
  });
});
