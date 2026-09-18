import { describe, test, expect } from '@jest/globals';
import {
  zoneHasTrustNumber,
  zoneIdentityParts,
  takeRateForZone,
  assertZonePublicDoor,
  assertZoneFirstSeal,
  buildCharacterDistribution,
  buildLiveness,
  zoneLeagueSpec,
  p2zChipLane,
  zoneCandidateStory,
  assertP2cZoneCandidate,
  publicZoneCoords,
  isAuraIdentityChip,
} from '../services/megaZone.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { routeForChip } from '../services/chipService.js';

describe('Zone vizyon locks', () => {
  test('Trust number yok · kimlik Aura+canlılık+karakter', () => {
    expect(zoneHasTrustNumber()).toBe(false);
    expect(zoneIdentityParts()).toEqual(['aura', 'liveness', 'character']);
    expect(LOCAL_CONFIG.zone.TRUST_NUMBER).toBe(false);
  });

  test('kamusal kapı · ilk mühür GPS+totem', () => {
    expect(assertZonePublicDoor('APPROVAL').code).toBe('ZONE_PUBLIC_ONLY');
    expect(assertZonePublicDoor('PUBLIC').ok).toBe(true);
    expect(assertZoneFirstSeal({ gpsOk: true, totemTap: false }).code).toBe('ZONE_SEAL_TOTEM');
    expect(assertZoneFirstSeal({ gpsOk: false, totemTap: true }).code).toBe('ZONE_SEAL_GPS');
    expect(assertZoneFirstSeal({ gpsOk: true, totemTap: true }).ok).toBe(true);
  });

  test('karakter % dağılımı · lig canlılık · para yok', () => {
    const dist = buildCharacterDistribution([
      { category: 'music', n: 42 },
      { category: 'meetup', n: 20 },
      { category: 'spor', n: 15 },
      { category: 'diger', n: 23 },
    ]);
    expect(dist.parts[0]).toMatchObject({ label: 'müzik', pct: 42 });
    expect(dist.ruhu).toContain("%42 müzik");
    expect(dist.ruhu).toContain('tanışma');
    const live = buildLiveness({ pastTables: 12, weeklyTables: 3, liveNow: 1 });
    expect(live.live_now).toBe(true);
    expect(live.copy).toContain('şu an canlı');
    const lig = zoneLeagueSpec();
    expect(lig.launch).toBe(true);
    expect(lig.never_score).toBe(true);
    expect(lig.prize.money).toBe(false);
  });

  test('C→Z kapıları · Z take-rate · P2Z aura/ops', () => {
    expect(assertP2cZoneCandidate({ isHome: true, people: 10, rituals: 5 }).code).toBe(
      'P2C_HOME_NEVER_ZONE'
    );
    expect(assertP2cZoneCandidate({ people: 4, rituals: 2 }).ok).toBe(true);
    expect(zoneCandidateStory()).toMatch(/köşeyi siz kazandınız/);
    expect(takeRateForZone().rate).toBe(0.08);
    expect(p2zChipLane('p2z_g_1')).toBe('aura');
    expect(p2zChipLane('p2z_r_totem')).toBe('ops');
    expect(isAuraIdentityChip('p2z_g_1')).toBe(true);
    expect(isAuraIdentityChip('p2z_r_totem')).toBe(false);
    expect(routeForChip('p2z_r_temizlik')).toBe('ops');
    const pub = publicZoneCoords({ geo_lat: 41.0082, geo_lng: 28.9784 });
    expect(pub.exact).toBe(false);
    expect(pub.geo_lat).toBe(41.01);
  });

  test('public config zone pins', () => {
    const cfg = getPublicConfig();
    expect(cfg.zone.trust_number).toBe(false);
    expect(cfg.zone.league_launch).toBe(true);
    expect(cfg.zone.door_public_only).toBe(true);
    expect(cfg.zone.first_seal).toEqual(['GPS', 'ZONE_TOTEM_TAP']);
    expect(cfg.zone.take_rate_z).toBe(0.08);
    expect(cfg.zone.identity).toEqual(['aura', 'liveness', 'character']);
    expect(cfg.zone.public_coord_exact).toBe(false);
    expect(cfg.venue.take_rate.ZONE).toBe(0.08);
  });
});
