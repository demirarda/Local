import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  normalizeDoorAndEntry,
  resolveRegularMinSeals,
  canonicalPackageName,
  isPaidCommerceTier,
  assertPaidRAllowed,
  assertSelfRezWorkingDay,
  resolveSelfRezModeForStart,
  windowToolAllowed,
  remoteWalkInCta,
  isHostOrCreator,
  assertCameraRollFirst,
} from '../services/megaSpec.js';
import { assertStartHorizon } from '../services/ritualCreateValidation.js';
import { getConcurrentSlotCap, normalizeTierId } from '../services/venuePackageService.js';
import { chipKindForFeedbackType, validateChipSelection } from '../services/chipService.js';
import { getPublicConfig } from '../services/publicConfigService.js';

describe('MEGA §14-16 + EK-26/27 pins', () => {
  test('regular 5/90 raise-only', () => {
    expect(LOCAL_CONFIG.regular.N).toBe(5);
    expect(LOCAL_CONFIG.regular.WINDOW_D).toBe(90);
    expect(resolveRegularMinSeals(3)).toBe(5);
    expect(resolveRegularMinSeals(8)).toBe(8);
  });

  test('horizons 30 / venue unlimited / event 60', () => {
    expect(LOCAL_CONFIG.ritual.MAX_CREATE_HORIZON_D).toBe(30);
    expect(LOCAL_CONFIG.ritual.VENUE_RAF_HORIZON_UNLIMITED).toBe(true);
    expect(LOCAL_CONFIG.ritual.EVENT_MAX_AHEAD_D).toBe(60);
    const now = new Date('2026-08-12T12:00:00Z');
    const farCustom = assertStartHorizon({
      startDate: new Date('2026-09-20T12:00:00Z'),
      timeType: 'planned',
      locationType: 'custom',
      now,
    });
    expect(farCustom.ok).toBe(false);
    const venueOk = assertStartHorizon({
      startDate: new Date('2027-01-01T12:00:00Z'),
      timeType: 'planned',
      locationType: 'venue',
      venueId: 'v1',
      now,
    });
    expect(venueOk.ok).toBe(true);
    expect(venueOk.horizon).toBe('venue_unlimited');
  });

  test('packages OPEN/OPERATOR/LANDMARK aliases + slot limit removed', () => {
    expect(canonicalPackageName('free')).toBe('OPEN');
    expect(canonicalPackageName('hakim')).toBe('LANDMARK');
    expect(normalizeTierId('open')).toBe('free');
    expect(normalizeTierId('landmark')).toBe('hakim');
    expect(isPaidCommerceTier('operator')).toBe(true);
    expect(isPaidCommerceTier('free')).toBe(false);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.SLOT_LIMIT_REMOVED).toBe(true);
    expect(getConcurrentSlotCap({ subscription_tier: 'operator' })).toBe(Number.POSITIVE_INFINITY);
  });

  test('paid-R OPEN blocked · walk-in never paid · C/Z free', () => {
    expect(
      assertPaidRAllowed({ fee: { amount: 10 }, origin: 'WALK_IN', venueId: 'v1', venueTier: 'operator' })
        .code
    ).toBe('WALK_IN_NEVER_PAID');
    expect(
      assertPaidRAllowed({ fee: { amount: 10 }, origin: 'SLOT_PLANNED', venueId: 'v1', venueTier: 'free' })
        .code
    ).toBe('PAID_R_REQUIRES_OPERATOR');
    expect(
      assertPaidRAllowed({ fee: { amount: 10 }, origin: 'SLOT_PLANNED', venueId: 'v1', venueTier: 'operator' })
        .ok
    ).toBe(true);
    expect(assertPaidRAllowed({ fee: { amount: 10 }, venueId: null }).ok).toBe(true);
  });

  test('doors + business prune', () => {
    expect(normalizeDoorAndEntry('SOLO').door).toBe('SOLO');
    expect(normalizeDoorAndEntry('SOLO', { accountType: 'business' }).ok).toBe(false);
    expect(normalizeDoorAndEntry('FRIENDS').entry_type).toBe('reference');
    expect(normalizeDoorAndEntry('APPROVAL').entry_type).toBe('request');
    expect(normalizeDoorAndEntry('invite_only').door).toBe('FRIENDS');
  });

  test('self-rez buffer + forward date always APPROVAL', () => {
    const hours = {
      wed: { open: '09:00', close: '17:00', closed: false },
    };
    const late = assertSelfRezWorkingDay({
      weeklyHours: hours,
      now: new Date('2026-09-16T16:40:00'),
      bufferMin: 30,
    });
    expect(late.ok).toBe(false);
    expect(late.code).toBe('SELFREZ_BUFFER');
    const ok = assertSelfRezWorkingDay({
      weeklyHours: hours,
      now: new Date('2026-09-16T12:00:00'),
      bufferMin: 30,
    });
    expect(ok.ok).toBe(true);
    const tomorrow = new Date('2026-09-17T20:00:00');
    expect(
      resolveSelfRezModeForStart({
        startDate: tomorrow,
        requestedMode: 'INSTANT',
        now: new Date('2026-09-16T12:00:00'),
      })
    ).toBe('APPROVAL');
  });

  test('P2P chips on · host RQ helper · window tools · remote walk-in', () => {
    expect(LOCAL_CONFIG.chip.P2P_ENABLED).toBe(true);
    expect(chipKindForFeedbackType('p2p')).toBe('P2P');
    expect(
      validateChipSelection({ feedbackType: 'p2p', chipId: 'p2p_g_1', q1_comfort: 'green' }).ok
    ).toBe(true);
    expect(isHostOrCreator({ host_id: 'h1' }, 'h1')).toBe(true);
    expect(windowToolAllowed('quiz').ok).toBe(false);
    expect(windowToolAllowed('quiz', { isVenEvent: true }).ok).toBe(true);
    expect(windowToolAllowed('voice').ok).toBe(false);
    expect(remoteWalkInCta().enabled).toBe(false);
    expect(remoteWalkInCta().copy).toMatch(/figürü okut/i);
    expect(LOCAL_CONFIG.ritual.SUB_FB_MAX).toBe(3);
    expect(LOCAL_CONFIG.penalties.LIFE_JOKER.COUNT).toBe(1);
    expect(LOCAL_CONFIG.totem.STATIC_QR_FORBIDDEN).toBe(true);
    expect(LOCAL_CONFIG.totem.MODES).toEqual(expect.arrayContaining(['NFC', 'ROTATING_CODE']));
    expect(LOCAL_CONFIG.window_tools.CAMERA_ROLL_FIRST).toBe(true);
    expect(assertCameraRollFirst({ type: 'photo', status: 'published' }).code).toBe('CAMERA_ROLL_FIRST');
    expect(assertCameraRollFirst({ type: 'photo', status: 'draft' }).ok).toBe(true);
    expect(assertCameraRollFirst({ type: 'quote', status: 'published' }).ok).toBe(true);
    expect(LOCAL_CONFIG.ritual.FORUM_DEFAULT_ON).toBe(true);
  });

  test('public config exposes mega pins', () => {
    const cfg = getPublicConfig();
    expect(cfg.ritual.planned_max_ahead_d).toBe(30);
    expect(cfg.regular.n).toBe(5);
    expect(cfg.regular.window_d).toBe(90);
    expect(cfg.venue.slot_limit_removed).toBe(true);
    expect(cfg.terminology.ui_noun).toBe('raf');
    expect(cfg.chip.no_chips_for).not.toContain('p2p');
  });
});
