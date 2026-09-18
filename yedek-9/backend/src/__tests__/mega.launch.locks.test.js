import { describe, test, expect } from '@jest/globals';
import {
  BOND_KINDS,
  TOTEM_PATH_C,
  ORTAK_AN_TYPES,
  SYMMETRIC_BLOCK_COPY,
  RAF_REQUEST_EN,
  EVENT_WALKIN_CARD,
  frenForBond,
  chainFrenActive,
  assertE2SeatSale,
  classifyAt20,
  assertP2cZoneCandidate,
  publicCoordPolicy,
  venueLifecyclePhase,
  paidRafRefund,
  assertBrandPublicRafIstek,
  bothStamp,
  cityDisplayVeil,
  waitlistPromoteMode,
  claimRetroTrust,
  claimPinStrength,
  safetyQueueLane,
  totemPathC,
  totemPathLadder,
  assertUserCannotBuyVenuePackage,
  orgHasPlainFr,
  sicilPair,
} from '../services/megaLaunchLocks.js';
import { getPublicConfig } from '../services/publicConfigService.js';

describe('MEGA remaining launch locks', () => {
  test('E2 paid sub needs roof ticket + seat cap', () => {
    expect(assertE2SeatSale({ origin: 'WALK_IN', subPaid: true, price: 10 }).ok).toBe(true);
    expect(
      assertE2SeatSale({ origin: 'VEN_EVENT', subPaid: true, price: 2500, roofTicketed: false }).code
    ).toBe('E2_ROOF_TICKET');
    expect(
      assertE2SeatSale({
        origin: 'VEN_EVENT',
        subPaid: true,
        price: 2500,
        roofTicketed: true,
        seats: 0,
      }).code
    ).toBe('E2_SEAT_MODEL');
    expect(
      assertE2SeatSale({
        origin: 'VEN_EVENT',
        subPaid: true,
        price: 2500,
        roofTicketed: true,
        seats: 6,
      }).model
    ).toBe('seat');
  });

  test('AT-20 S1/S2/S3 · SHELF_ONLY exempt · no auto penalty', () => {
    expect(classifyAt20({ doorPolicy: 'SHELF_ONLY', eventDays30: 25 }).exempt).toBe(true);
    const hot = classifyAt20({ eventDays30: 20, emptyEvents30: 4, walkInShare: 0.05 });
    expect(hot.signals.map((s) => s.code).sort()).toEqual(['S1', 'S2', 'S3']);
    expect(hot.auto_penalty).toBe(false);
  });

  test('bonds EKIP/REZIDAN/MENSUP + 90d chain fren', () => {
    expect(BOND_KINDS).toEqual(['EKIP', 'REZIDAN', 'MENSUP']);
    expect(frenForBond('EKIP')).toEqual({ witness: false, regular: false, self_p2v: false });
    expect(frenForBond('REZIDAN').self_p2v).toBe(false);
    expect(frenForBond('MENSUP').witness).toBe(true);
    expect(chainFrenActive({ endedAt: Date.now() - 10 * 86400000 })).toBe(true);
    expect(chainFrenActive({ endedAt: Date.now() - 91 * 86400000 })).toBe(false);
  });

  test('P2C never home · 4 people · 2 rituals · coords rounded', () => {
    expect(assertP2cZoneCandidate({ isHome: true, people: 10, rituals: 5 }).code).toBe(
      'P2C_HOME_NEVER_ZONE'
    );
    expect(assertP2cZoneCandidate({ people: 3, rituals: 2 }).candidate).toBe(false);
    expect(assertP2cZoneCandidate({ people: 4, rituals: 2 }).ok).toBe(true);
    const c = publicCoordPolicy(41.0082, 28.9784);
    expect(c.exact).toBe(false);
    expect(c.lat).toBe(41.01);
  });

  test('brand raf-isteği forbidden · BOTH stamp · refund ladder', () => {
    expect(assertBrandPublicRafIstek({ target: 'brand' }).code).toBe('BRAND_REQUEST_FORBIDDEN');
    expect(assertBrandPublicRafIstek({ target: 'venue' }).ok).toBe(true);
    expect(bothStamp({ venueId: 'v', brandId: 'b' })).toBe(true);
    expect(paidRafRefund({ locked: false }).refund).toBe('full');
    expect(paidRafRefund({ locked: true, replacementFilled: true }).code).toBe('REPLACEMENT_FILLED');
    expect(paidRafRefund({ sealed: true }).refund).toBe('none');
    expect(assertUserCannotBuyVenuePackage('user').ok).toBe(false);
    expect(orgHasPlainFr('venue')).toBe(false);
  });

  test('city veil · claim no retro Trust · waitlist offer vs auto', () => {
    expect(cityDisplayVeil({ sealsInCity: 2, placementSeals: 5 }).veil).toBe(true);
    expect(cityDisplayVeil({ sealsInCity: 5 }).copy).toBe('yeni şehir');
    expect(claimRetroTrust()).toBe(false);
    expect(claimPinStrength(10)).toBe('strong');
    expect(claimPinStrength(40)).toBe('weak');
    expect(waitlistPromoteMode({ paid: true })).toBe('OFFER');
    expect(waitlistPromoteMode({ paid: false })).toBe('AUTO');
  });

  test('totem PATH_C · symmetric block · safety lane · raf EN', () => {
    expect(TOTEM_PATH_C).toEqual(['STAFF_DEVICE', 'TAP_POINT', 'FIGUR']);
    expect(totemPathC('figur')).toBe('FIGUR');
    expect(totemPathLadder().copy).toMatch(/wifi/);
    expect(SYMMETRIC_BLOCK_COPY).toMatch(/uyumsuzluğu/);
    expect(SYMMETRIC_BLOCK_COPY).not.toMatch(/engelledin|engellendin/);
    expect(safetyQueueLane()).toBe('safety');
    expect(RAF_REQUEST_EN).toBe('Create a Ritual Request');
    expect(EVENT_WALKIN_CARD.title).toMatch(/LOCAL Event/);
    expect(ORTAK_AN_TYPES).toEqual(['quiz', 'poll', 'announce']);
  });

  test('lifecycle 4/8/16h · sicil pair', () => {
    const now = Date.now();
    expect(venueLifecyclePhase({ lastActivityAt: now - 2 * 3600000, now }).phase).toBe('active');
    expect(venueLifecyclePhase({ lastActivityAt: now - 5 * 3600000, now }).phase).toBe('silent');
    expect(venueLifecyclePhase({ lastActivityAt: now - 10 * 3600000, now }).phase).toBe('asleep');
    expect(venueLifecyclePhase({ lastActivityAt: now - 17 * 3600000, now }).phase).toBe('archive');
    expect(sicilPair({ avgResponseHours: 3, acceptRate: 0.8 }).label).toBe('3sa · %80');
  });

  test('public config exposes launch pins', () => {
    const cfg = getPublicConfig();
    expect(cfg.terminology.raf_request_en).toBe('Create a Ritual Request');
    expect(cfg.totem.path_c).toEqual(['STAFF_DEVICE', 'TAP_POINT', 'FIGUR']);
    expect(cfg.totem.static_qr_forbidden).toBe(true);
    expect(cfg.block.symmetric_anonymous).toBe(true);
    expect(cfg.bonds.kinds).toContain('EKIP');
  });
});
