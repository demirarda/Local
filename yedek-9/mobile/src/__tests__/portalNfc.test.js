/**
 * TOTEM derin-linki + NFC fallback — Wave 6
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../services/api', () => ({
  fetchRitualDetail: jest.fn(),
  fetchVenueRituals: jest.fn(),
}));

import { buildPortalDeepLink, buildPortalWebLink, parsePortalLink } from '../utils/portalDeepLink';
import { describeNfcFailure, isNfcModuleAvailable, readTotemTag } from '../utils/nfcTotem';

describe('portal deep link', () => {
  it('parses app, web and showcase forms', () => {
    expect(parsePortalLink('local://portal/venue-1/kasa')).toEqual({
      venueId: 'venue-1',
      portalId: 'kasa',
    });
    expect(parsePortalLink('https://local.app/t/venue-1/bar')).toEqual({
      venueId: 'venue-1',
      portalId: 'bar',
    });
    expect(parsePortalLink('https://local.app/w/t/venue-1/dj-onu?utm=qr')).toEqual({
      venueId: 'venue-1',
      portalId: 'dj-onu',
    });
  });

  it('ignores unrelated links', () => {
    expect(parsePortalLink('local://ritual/123')).toBeNull();
    expect(parsePortalLink('https://local.app/w/pulse')).toBeNull();
    expect(parsePortalLink(null)).toBeNull();
  });

  it('builds links that round-trip through the parser', () => {
    const app = buildPortalDeepLink('v1', 'kasa');
    const web = buildPortalWebLink('v1', 'kasa');
    expect(parsePortalLink(app)).toEqual({ venueId: 'v1', portalId: 'kasa' });
    expect(parsePortalLink(web)).toEqual({ venueId: 'v1', portalId: 'kasa' });
  });
});

describe('nfc totem fallback', () => {
  it('reports the native module as absent in Expo Go builds', () => {
    expect(isNfcModuleAvailable()).toBe(false);
  });

  it('degrades gracefully instead of throwing', async () => {
    await expect(readTotemTag()).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });

  it('always has copy that routes back to the code culture', () => {
    expect(describeNfcFailure('unsupported')).toMatch(/kod/i);
    expect(describeNfcFailure('whatever')).toBeTruthy();
  });
});
