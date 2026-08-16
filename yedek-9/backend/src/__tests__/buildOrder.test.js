import { describe, test, expect } from '@jest/globals';
import { FOUNDER_DECISIONS } from '../config/founderDecisions.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { runAllSanitySimulations } from '../services/rsSanitySimulation.js';

describe('BUILD SIRASI §13 — modül varlığı', () => {
  test('F1 çekirdek servisleri import edilir', async () => {
    const checkin = await import('../services/checkinService.js');
    const state = await import('../services/ritualState.js');
    expect(typeof checkin.processCheckIn).toBe('function');
    expect(typeof state.getLifecyclePhase).toBe('function');
  });

  test('F2 sosyal — FL + friendship motoru', async () => {
    const { levelFromFbCount } = await import('../config/localConfig.js');
    const fl = await import('../services/friendshipLevel.js');
    expect(levelFromFbCount(4)).toBe('l2');
    expect(typeof fl.recomputeFlForPair).toBe('function');
  });

  test('F3 motorlar — RS sanity geçer', () => {
    const report = runAllSanitySimulations();
    expect(report.all_pass).toBe(true);
  });

  test('F4 dünya — forum + share + notif', async () => {
    const forum = await import('../services/forumService.js');
    const share = await import('../services/shareService.js');
    const notif = await import('../services/notifications.js');
    expect(typeof forum.createForumComment).toBe('function');
    expect(typeof share.sendShareObject).toBe('function');
    expect(typeof notif.notifyFriendRequest).toBe('function');
  });

  test('F5 venue — trust/aura + shadow', async () => {
    const trust = await import('../services/venueTrustAuraService.js');
    const shadow = await import('../services/shadowVenueService.js');
    expect(typeof trust.computeVenueTrustAura).toBe('function');
    expect(typeof shadow.linkShadowVenueHistory).toBe('function');
  });

  test('F6 gamification — badge katalog ≥24', () => {
    expect((LOCAL_CONFIG.badges.CATALOG || []).length).toBeGreaterThanOrEqual(24);
  });

  test('SONRA — series spawn + paket stub', async () => {
    const series = await import('../services/seriesService.js');
    expect(typeof series.generateSeriesInstances).toBe('function');
    const recurring = await import('../services/recurringRitualStub.js');
    expect(typeof recurring.generateRecurringInstances).toBe('function');
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.tiers.length).toBeGreaterThanOrEqual(2);
  });

  test('§12 public config + founder kararları', () => {
    expect(getPublicConfig().ritual.min_size).toBe(3);
    expect(FOUNDER_DECISIONS.length).toBe(12);
  });
});
