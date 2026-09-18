import { describe, test, expect } from '@jest/globals';
import {
  packageSeats,
  assertAuthoritySeat,
  takeRateForTier,
  announcementQuotaMo,
  assertAnnouncementAllowed,
  badgeStudioQuota,
  assertBadgeStudioKind,
  assertPaidVenueMoney,
  assertSelfRezFineTune,
  nightReportModeForTier,
  seriesSleepWeeks,
  seriesIntelligenceAllowed,
  seriesVitrinePriority,
  customFigurOnLandmark,
  followerPushAllowed,
  packageEur,
  multiBranchDiscountVisible,
} from '../services/megaPackages.js';
import { getConcurrentSlotCap, hasPackageFeature } from '../services/venuePackageService.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { assertUserCannotBuyVenuePackage } from '../services/megaLaunchLocks.js';

describe('Venue packages v1 locks', () => {
  test('series unlimited all tiers · slot cap removed', () => {
    expect(getConcurrentSlotCap({ subscription_tier: 'free' })).toBe(Number.POSITIVE_INFINITY);
    expect(getConcurrentSlotCap({ subscription_tier: 'operator' })).toBe(Number.POSITIVE_INFINITY);
    expect(seriesSleepWeeks()).toBe(3);
    expect(seriesIntelligenceAllowed('free')).toBe(false);
    expect(seriesIntelligenceAllowed('operator')).toBe(true);
    expect(seriesVitrinePriority('hakim')).toBe(true);
  });

  test('authority seats 1M2D / 3M5D / infM12D · bonds unlimited', () => {
    expect(packageSeats('open')).toEqual({ manager: 1, staff_door: 2, bonds_unlimited: true });
    expect(packageSeats('operator').manager).toBe(3);
    expect(packageSeats('landmark').manager).toBe(Number.POSITIVE_INFINITY);
    expect(packageSeats('landmark').staff_door).toBe(12);
    expect(assertAuthoritySeat({ tierId: 'open', role: 'manager', managerCount: 1 }).code).toBe(
      'SEAT_MANAGER_FULL'
    );
    expect(assertAuthoritySeat({ tierId: 'open', role: 'staff', staffCount: 2 }).code).toBe('SEAT_DOOR_FULL');
    expect(assertAuthoritySeat({ tierId: 'open', role: 'owner' }).ok).toBe(true);
  });

  test('OPEN money closed · take-rate ladder · user no package', () => {
    expect(assertPaidVenueMoney({ amount: 100, venueId: 'v1', venueTier: 'free' }).code).toBe(
      'PAID_R_REQUIRES_OPERATOR'
    );
    expect(assertPaidVenueMoney({ amount: 100, venueId: 'v1', venueTier: 'operator' }).ok).toBe(true);
    expect(assertPaidVenueMoney({ amount: 100, venueId: null, venueTier: 'free' }).ok).toBe(true);
    expect(takeRateForTier('operator').rate).toBe(0.08);
    expect(takeRateForTier('landmark').rate).toBe(0.05);
    expect(takeRateForTier('open').billed).toBe(false);
  });

  test('announce 0/4/12 · OPEN no push', () => {
    expect(announcementQuotaMo('open')).toBe(0);
    expect(announcementQuotaMo('operator')).toBe(4);
    expect(announcementQuotaMo('landmark')).toBe(12);
    expect(assertAnnouncementAllowed({ tierId: 'open' }).code).toBe('ANNOUNCE_OPEN_NO_PUSH');
    expect(followerPushAllowed('open')).toBe(false);
    expect(followerPushAllowed('operator')).toBe(true);
  });

  test('badge studio OPEN 0 · OPERATOR A×2 · LANDMARK A+B×5 · seller no A', () => {
    expect(badgeStudioQuota('open').max).toBe(0);
    expect(assertBadgeStudioKind({ tierId: 'operator', kind: 'A' }).ok).toBe(true);
    expect(assertBadgeStudioKind({ tierId: 'operator', kind: 'B' }).code).toBe('BADGE_KIND_TIER');
    expect(assertBadgeStudioKind({ tierId: 'hakim', kind: 'B' }).ok).toBe(true);
    expect(assertBadgeStudioKind({ tierId: 'hakim', kind: 'A', seller: true }).code).toBe('BADGE_SELLER_NO_A');
    expect(assertBadgeStudioKind({ tierId: 'open', kind: 'A' }).ok).toBe(false);
  });

  test('self-rez fine-tune OPERATOR+ · OPEN night 3-line · LANDMARK figur · EUR pin', () => {
    expect(assertSelfRezFineTune({ venueTier: 'free', perRafMode: 'INSTANT' }).code).toBe(
      'SELFREZ_FINE_TUNE_OPERATOR'
    );
    expect(assertSelfRezFineTune({ venueTier: 'operator', perRafMode: 'APPROVAL' }).ok).toBe(true);
    expect(nightReportModeForTier('free')).toBe('summary_3');
    expect(nightReportModeForTier('operator')).toBe('full');
    expect(customFigurOnLandmark('hakim')).toBe(true);
    expect(packageEur('operator')).toBe(300);
    expect(packageEur('landmark')).toBe(500);
    expect(multiBranchDiscountVisible()).toBe(true);
  });

  test('public config exposes package pins', () => {
    const cfg = getPublicConfig();
    expect(cfg.venue.take_rate.OPERATOR).toBe(0.08);
    expect(cfg.venue.seats.OPEN.manager).toBe(1);
    expect(cfg.venue.badge_studio.OPERATOR.max).toBe(2);
    expect(cfg.venue.price_eur.LANDMARK).toBe(500);
    expect(cfg.venue.custom_totem_order_open).toBe(true);
    expect(cfg.venue.series_empty_sleep_w).toBe(3);
  });

  test('OPEN series unlimited · USER no package · LANDMARK figur pin', () => {
    expect(hasPackageFeature({ subscription_tier: 'free' }, 'recurring')).toBe(true);
    expect(hasPackageFeature({ subscription_tier: 'free' }, 'series_unlimited')).toBe(true);
    expect(assertUserCannotBuyVenuePackage('user').code).toBe('USER_NO_PACKAGE');
    expect(assertUserCannotBuyVenuePackage('venue').ok).toBe(true);
  });
});
