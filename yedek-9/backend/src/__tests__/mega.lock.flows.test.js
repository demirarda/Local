import { describe, test, expect } from '@jest/globals';
import {
  SALES_POCKET_BLOCKS,
  rezidanLabel,
  formatRezidanKunya,
  rotatingTotemCode,
  verifyRotatingTotemCode,
  assertVenueTotemDoor,
  assertE1Seating,
  assertBadgeStudioAllowed,
  emptySalesPocket,
} from '../services/megaLockFlows.js';

describe('MEGA locked flows E6/V13/E1/totem/sales/badge', () => {
  test('Satışlarım 7 blok · payout ≠ vitrin', () => {
    expect(SALES_POCKET_BLOCKS).toEqual([
      'plans',
      'fulfillment',
      'buyer_chips',
      'customers',
      'approval_queue',
      'payout',
      'vitrine',
    ]);
    const pocket = emptySalesPocket();
    expect(pocket.ui_noun).toBe('Satışlarım');
    expect(pocket.payout_separate_from_vitrine).toBe(true);
    expect(pocket.payout.note).toMatch(/vitrinden ayrı/);
    expect(pocket.vitrine.note).toMatch(/payout değildir/);
    expect(pocket.blocks).toHaveLength(7);
  });

  test('REZİDAN künye · venue bound', () => {
    expect(rezidanLabel({ venueId: 'v1' })).toBe('REZİDAN');
    expect(rezidanLabel({ venueId: 'v1', lang: 'en' })).toBe('RESIDENT');
    expect(rezidanLabel({})).toBe('HOST');
    expect(formatRezidanKunya({ name: 'Arda', venueName: 'Roast', verified: true })).toBe(
      'REZİDAN: Arda · Roast ✓'
    );
  });

  test('totem rotating HMAC · previous window valid · static 3-digit dead as door', () => {
    const venueId = '11111111-1111-1111-1111-111111111111';
    const now = 1_700_000_000_000;
    const code = rotatingTotemCode(venueId, now, { ttlS: 30, secret: 'test' });
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyRotatingTotemCode(venueId, code, now, { ttlS: 30, secret: 'test' }).ok).toBe(true);
    expect(
      verifyRotatingTotemCode(venueId, code, now + 29_000, { ttlS: 30, secret: 'test' }).ok
    ).toBe(true);
    expect(verifyRotatingTotemCode(venueId, '123', now, { ttlS: 30, secret: 'test' }).ok).toBe(false);
    expect(
      assertVenueTotemDoor({ venueId, nfc: false, rotatingCode: '000111' }).ok
    ).toBe(false);
    expect(assertVenueTotemDoor({ venueId, nfc: true }).via).toBe('NFC');
    expect(assertVenueTotemDoor({ venueId, tableOpen: true, nfc: false }).reason).toBe('table_open');
    expect(
      assertVenueTotemDoor({
        venueId,
        rotatingCode: code,
        nowMs: now,
        secret: 'test',
        ttlS: 30,
      }).via
    ).toBe('ROTATING_CODE');
    expect(assertVenueTotemDoor({ venueId: null, nfc: false }).ok).toBe(true);
  });

  test('E1 roof seal then table_nfc|staff_tap', () => {
    expect(assertE1Seating({ origin: 'WALK_IN' }).ok).toBe(true);
    expect(assertE1Seating({ origin: 'VEN_EVENT', roofSealed: false }).code).toBe(
      'E1_ROOF_SEAL_REQUIRED'
    );
    expect(
      assertE1Seating({ origin: 'VEN_EVENT', roofSealed: true, channel: 'gps' }).code
    ).toBe('E1_SEATING_CHANNEL');
    expect(
      assertE1Seating({ origin: 'VEN_EVENT', roofSealed: true, channel: 'table_nfc' }).ok
    ).toBe(true);
  });

  test('Badge Studio FREE yok · OPERATOR+', () => {
    expect(assertBadgeStudioAllowed('free').code).toBe('BADGE_STUDIO_OPERATOR');
    expect(assertBadgeStudioAllowed('open').ok).toBe(false);
    expect(assertBadgeStudioAllowed('operator').ok).toBe(true);
    expect(assertBadgeStudioAllowed('hakim').ok).toBe(true);
  });
});
