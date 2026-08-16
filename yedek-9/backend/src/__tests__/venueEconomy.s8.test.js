/**
 * §8 venue package economy unit tests (no DB)
 */
import { describe, test, expect } from '@jest/globals';
import {
  normalizeTierId,
  resolveTierFromVenue,
  packagePrice,
  getConcurrentSlotCap,
  hasPackageFeature,
  computeTakeoverPriceTry,
  buildPackageCatalogV2,
} from '../services/venuePackageService.js';
import { buildPackageCatalog } from '../services/venueBusinessService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('venue package §8', () => {
  test('normalizes legacy pro/city_partner', () => {
    expect(normalizeTierId('pro')).toBe('operator');
    expect(normalizeTierId('city_partner')).toBe('hakim');
    expect(normalizeTierId('basic')).toBe('free');
  });

  test('resolveTierFromVenue prefers flags', () => {
    expect(resolveTierFromVenue({ subscription_tier: 'free', city_partner_enabled: true })).toBe('hakim');
    expect(resolveTierFromVenue({ subscription_tier: 'free', pro_enabled: true })).toBe('operator');
  });

  test('package_price = base × size_multiplier', () => {
    expect(packagePrice(7900, { size_multiplier: 0.7 })).toBe(5530);
    expect(packagePrice(19900, { size_multiplier: 1 })).toBe(19900);
  });

  test('concurrent caps + addon + takeover', () => {
    expect(getConcurrentSlotCap({ subscription_tier: 'operator' })).toBe(3);
    expect(getConcurrentSlotCap({ subscription_tier: 'hakim', addon_slots: 2 })).toBe(7);
    expect(
      getConcurrentSlotCap({
        subscription_tier: 'free',
        takeover_until: new Date(Date.now() + 3600000).toISOString(),
      })
    ).toBe(Number.POSITIVE_INFINITY);
  });

  test('features gate by tier', () => {
    expect(hasPackageFeature({ subscription_tier: 'operator' }, 'gece_raporu')).toBe(true);
    expect(hasPackageFeature({ subscription_tier: 'free' }, 'gece_raporu')).toBe(false);
    expect(hasPackageFeature({ subscription_tier: 'hakim' }, 'pazar_payi')).toBe(true);
    expect(hasPackageFeature({ subscription_tier: 'operator' }, 'masa_totem')).toBe(true);
    expect(hasPackageFeature({ subscription_tier: 'free' }, 'masa_totem')).toBe(false);
    expect(hasPackageFeature({ subscription_tier: 'hakim' }, 'masa_totem')).toBe(true);
  });

  test('takeover price uses formula', () => {
    const price = computeTakeoverPriceTry({ subscription_tier: 'operator', size_multiplier: 1 }, { dayType: 'friday' });
    expect(price).toBeGreaterThan(0);
  });

  test('takeover = package × weekday 30% / weekend 50% (Master §12)', () => {
    const venue = { subscription_tier: 'operator', size_multiplier: 1 };
    expect(computeTakeoverPriceTry(venue, { dayType: 'weekday' })).toBe(Math.round(7900 * 0.3));
    expect(computeTakeoverPriceTry(venue, { dayType: 'weekend' })).toBe(Math.round(7900 * 0.5));
    expect(computeTakeoverPriceTry(venue, { dayType: 'friday' })).toBe(Math.round(7900 * 0.5));
    expect(LOCAL_CONFIG.open.takeover_formula).toMatchObject({ weekday: 0.3, weekend: 0.5 });
    expect(LOCAL_CONFIG.open.compact_band_approved).toBe(false);
  });

  test('catalog exposes three active tiers with TRY prices', () => {
    const cat = buildPackageCatalogV2({ subscription_tier: 'free', size_multiplier: 1 });
    expect(cat.tiers).toHaveLength(3);
    expect(cat.tiers.map((t) => t.id)).toEqual(['free', 'operator', 'hakim']);
    expect(cat.active_tier).toBe('free');
    const op = cat.tiers.find((t) => t.id === 'operator');
    expect(op.price_try).toBe(LOCAL_CONFIG.venue.PACKAGES_STUB.PRICE_OP);
  });

  test('compact band gated off — seats≤40 does not auto-multiply', () => {
    expect(LOCAL_CONFIG.compact.enabled).toBe(false);
    expect(packagePrice(7900, { total_seats: 30 })).toBe(7900);
  });

  test('buildPackageCatalog alias matches v2', () => {
    const cat = buildPackageCatalog({ subscription_tier: 'operator' });
    expect(cat.active_tier).toBe('operator');
    expect(cat.design_pending).toBe(false);
  });
});

describe('venue insights §8', () => {
  test('chip trends / ai advice modules export', async () => {
    const mod = await import('../services/venueInsightsService.js');
    expect(typeof mod.getChipTrends).toBe('function');
    expect(typeof mod.getAiMonthlyAdvice).toBe('function');
    expect(typeof mod.listBrandPrioritySlots).toBe('function');
  });
});
