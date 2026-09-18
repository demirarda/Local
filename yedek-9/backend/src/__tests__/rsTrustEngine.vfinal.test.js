/**
 * 24 Ağu v-final — RS & Trust Engine şartname pinleri
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG, {
  computeAis,
  computeTruthSignalFromComponents,
  applyNoPeerEngagementGate,
  ifLateFromCount,
  clampDayPositiveDelta,
  fbWeightFromLevel,
  farPhase,
  applyFarToDelta,
  farDiscoveryWeight,
  getKapiMinutes,
  feelingToCategory,
  applyIfModL3,
  applyIfPeerRedHeavy,
  computeRsPipeline,
} from '../config/localConfig.js';
import { feelingToInternal, repeatRaterWeight } from '../services/venueTrustAuraService.js';
import {
  RS_PIPELINE_SCORE_EVENT_TYPES,
  buildRsPipelineScoreEvents,
} from '../services/scoreEventService.js';
import { filterFeedbackRowsForViewer } from '../services/r1ArchiveService.js';
import { classifyNoPeerTrace } from '../services/at9TraceFarmingService.js';
import { runIqWeightBandMatrix, runAllSanitySimulations } from '../services/rsSanitySimulation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('LOCAL_RS_TrustEngine_GamificationRules v-final', () => {
  test('§1 weights CF asleep', () => {
    expect(LOCAL_CONFIG.rs.W_A).toBe(0.3);
    expect(LOCAL_CONFIG.rs.W_IQ).toBe(0.4);
    expect(LOCAL_CONFIG.rs.W_CF).toBe(0);
    expect(LOCAL_CONFIG.rs.W_MB).toBe(0.05);
    expect(LOCAL_CONFIG.rs.S_POS_MAX).toBe(0.75);
  });

  test('§1 AIS 1.00 / 0.80 / 0.60', () => {
    expect(LOCAL_CONFIG.checkin.AIS_REDUCED).toBe(1);
    expect(LOCAL_CONFIG.checkin.AIS_LATE).toBe(0.8);
    expect(LOCAL_CONFIG.checkin.AIS_DEEP_LATE).toBe(0.6);
    const kapı = getKapiMinutes(60);
    const onTime = computeAis(0, 60);
    expect(onTime.ais).toBe(1);
    expect(onTime.status).toBe('on_time');
    const late = computeAis(kapı * 0.7, 60);
    expect(late.ais).toBe(0.8);
    expect(late.status).toBe('late');
    const deep = computeAis(kapı * 0.95, 60);
    expect(deep.ais).toBe(0.6);
    expect(deep.status).toBe('deep_late');
  });

  test('§2 BC NEG_AMP 1.20 · gün tavanı · bant 0–10', () => {
    expect(LOCAL_CONFIG.rs.BC.NEG_AMP).toBe(1.2);
    expect(LOCAL_CONFIG.rs.CAP_DAY_POS).toBe(0.12);
    expect(LOCAL_CONFIG.rs.MIN).toBe(0);
    expect(clampDayPositiveDelta(0.1, 0.05)).toBeCloseTo(0.07, 5);
    expect(clampDayPositiveDelta(0.2, 0.12)).toBe(0);
  });

  test('§2 DS her ritüelde · score_events çarpanları AYRI', () => {
    expect(LOCAL_CONFIG.rs.DS_APPLY_FROM).toBe(1);
    const early = computeRsPipeline({
      S_r: 0.7,
      currentRS: 5.5,
      ritualIndex: 1,
      dsMultiplier: 1.2,
      bcTrend: 0.5,
    });
    expect(early.dsApplied).toBe(true);
    expect(early.dsMult).toBe(1.2);
    expect(early.deltaAfterDs).toBeCloseTo(early.deltaRawCapped * 1.2, 6);

    const rows = buildRsPipelineScoreEvents({
      ritualIndex: 1,
      iqMeta: { n: 1, conf: 0.5, IQ_raw: 1, IQ_r: 0.7, iq_null: false },
      pipeline: early,
      dayCap: { delta_in: 0.05, delta_out: 0.05, used_today: 0 },
    });
    expect(rows.map((r) => r.eventType)).toEqual(RS_PIPELINE_SCORE_EVENT_TYPES);
    expect(new Set(rows.map((r) => r.eventType)).size).toBe(6);
    expect(rows.find((r) => r.eventType === 'rs_mult_ds').breakdown.mult).toBe(1.2);
    const src = readFileSync(join(__dirname, '../services/rsEngine.js'), 'utf8');
    expect(src).toMatch(/logRsPipelineScoreEvents/);
  });

  test('§3 NULL vs 0', () => {
    const none = computeTruthSignalFromComponents({
      A_r: 1,
      IQ_r: null,
      CF_r: 0.9,
      M_r: 1,
      IF_r: 0,
    });
    expect(none.iq_null).toBe(true);
    expect(none.P_r).toBeCloseTo(0.75, 5);
    const red = computeTruthSignalFromComponents({
      A_r: 1,
      IQ_r: 0,
      CF_r: 0.9,
      M_r: 0,
      IF_r: 0,
    });
    expect(red.P_r).toBeCloseTo(0.3, 5);
  });

  test('§4 no-peer iz RQ ∨ R1 ∨ memory · dampener config', () => {
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_DAMPENER).toBe(0.35);
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_CEILING).toBe(7.5);
    expect(
      applyNoPeerEngagementGate(0.1, {
        noPeerPath: true,
        hasRq: true,
        hasR1: false,
        hasMemory: false,
      })
    ).toBe(0.1);
  });

  test('§4 no-peer akran kırmızısı IF’e girmez', () => {
    expect(applyIfPeerRedHeavy(0.25, { noPeerPath: true, redHeavy: true })).toBe(0.25);
    expect(applyIfPeerRedHeavy(0.25, { noPeerPath: false, redHeavy: true })).toBeCloseTo(0.35, 5);
    expect(applyIfPeerRedHeavy(0.25, { noPeerPath: false, redHeavy: false })).toBe(0.25);
    const src = readFileSync(join(__dirname, '../services/rsEngine.js'), 'utf8');
    expect(src).toMatch(/applyIfPeerRedHeavy/);
    expect(src).toMatch(/noPeerPath: iq\.iq_null === true/);
  });

  test('§1 IF late merdiveni 0.25/0.35/0.50', () => {
    expect(ifLateFromCount(1)).toBe(0.25);
    expect(ifLateFromCount(2)).toBe(0.25);
    expect(ifLateFromCount(3)).toBe(0.35);
    expect(ifLateFromCount(4)).toBe(0.35);
    expect(ifLateFromCount(5)).toBe(0.5);
    expect(ifLateFromCount(9)).toBe(0.5);
  });

  test('§1 MOD-L3 → IF=1.0 · T = P − 0.20', () => {
    expect(LOCAL_CONFIG.rs.IF_MOD_L3).toBe(1.0);
    expect(applyIfModL3(0.3, false)).toBe(0.3);
    expect(applyIfModL3(0.3, true)).toBe(1);
    expect(applyIfModL3(0, true)).toBe(1);
    const l3 = computeTruthSignalFromComponents({
      A_r: 1,
      IQ_r: 1,
      CF_r: 1,
      M_r: 1,
      IF_r: 1,
    });
    expect(l3.P_r).toBeCloseTo(0.75, 5);
    expect(l3.T_r).toBeCloseTo(0.55, 5);
  });

  test('§6 FL mühür ağırlıkları', () => {
    expect(LOCAL_CONFIG.fl.METRIC).toBe('co_seal');
    expect(fbWeightFromLevel('l1', 1)).toBe(0.5);
    expect(fbWeightFromLevel('l1', 2)).toBe(1);
    expect(fbWeightFromLevel('l2', 4)).toBe(0.5);
    expect(fbWeightFromLevel('l3', 8)).toBe(0);
  });

  test('§7 venue Trust/Aura', () => {
    expect(LOCAL_CONFIG.venue.WINDOW_DAYS).toBe(120);
    expect(LOCAL_CONFIG.venue.K).toBe(5);
    expect(LOCAL_CONFIG.venue.MAX_OBS_PER_PERSON_PER_NIGHT).toBe(2);
    expect(feelingToInternal('green')).toBe(1);
    expect(feelingToInternal('yellow')).toBe(0.5);
    expect(feelingToInternal('red')).toBe(0);
    expect(repeatRaterWeight(0)).toBe(1);
    expect(repeatRaterWeight(1)).toBeCloseTo(0.5, 5);
    const aura = readFileSync(join(__dirname, '../services/venueTrustAuraService.js'), 'utf8');
    expect(aura).toContain('COALESCE(f.from_user_id, f.rater_id)');
    expect(aura).not.toMatch(/f\.user_id,/);
    expect(aura).toContain('computeZoneAuraDisplay');
    expect(aura).toContain("fetchRitualObservations(zoneId, 'p2z'");
    const zone = readFileSync(join(__dirname, '../services/zoneService.js'), 'utf8');
    expect(zone).toContain('computeZoneAuraDisplay');
    expect(zone).not.toContain("'p2r','p2v','p2z','rq'");
    const regular = readFileSync(join(__dirname, '../services/regularService.js'), 'utf8');
    expect(regular).toContain('staff_excluded');
    expect(regular).toContain('venue_managers');
    const profile = readFileSync(join(__dirname, '../services/venueProfileService.js'), 'utf8');
    expect(profile).toContain('canSeeFulfillmentSicil');
    expect(profile).toContain('includeFulfillment');
    const p2c = readFileSync(join(__dirname, '../services/p2cArchiveService.js'), 'utf8');
    expect(p2c).toContain("feedback_type = 'p2c'");
    expect(p2c).toContain('enters_trust: false');
    expect(p2c).toContain('p2c_zone_candidate');
    const admin = readFileSync(join(__dirname, '../api/admin.js'), 'utf8');
    expect(admin).toContain('/p2c-heatmap');
    const showcase = readFileSync(join(__dirname, '../api/webShowcase.js'), 'utf8');
    expect(showcase).toContain('p2c_tag');
  });

  test('§8 isolation: UNDER_MIN all FB · host P2V · self-vote', () => {
    const fb = readFileSync(join(__dirname, '../api/feedback.js'), 'utf8');
    expect(fb).toContain('assertFeedbackNotUnderMin');
    expect(fb).toContain('denyIfUnderMin');
    expect(fb).toContain('host_p2v_forbidden');
    const mem = readFileSync(join(__dirname, '../api/memories.js'), 'utf8');
    expect(mem).toContain('SELF_VOTE_FORBIDDEN');
    const forum = readFileSync(join(__dirname, '../services/forumService.js'), 'utf8');
    expect(forum).toContain('SELF_VOTE_FORBIDDEN');
  });

  test('§9 FAR launch = 0 · placement 5 · keşif 0 · ham sayı mask · R1 arşiv', () => {
    expect(farPhase()).toBe(0);
    expect(farDiscoveryWeight()).toBe(0);
    expect(LOCAL_CONFIG.rs.visibility.PLACEMENT_SEALS).toBe(5);
    expect(applyFarToDelta(0.1)).toBe(0.1);
    const rituals = readFileSync(join(__dirname, '../api/rituals.js'), 'utf8');
    expect(rituals).toContain('farDiscoveryWeight');
    expect(rituals).toContain('maskRsScoreList');
    const vis = readFileSync(join(__dirname, '../services/rsVisibility.js'), 'utf8');
    expect(vis).toContain('maskRsScoreList');
    const mem = readFileSync(join(__dirname, '../api/memories.js'), 'utf8');
    expect(mem).toContain('presentMemoriesForViewer');
    const chat = readFileSync(join(__dirname, '../api/chat.js'), 'utf8');
    expect(chat).toContain('maskRsScoreList');
    expect(chat).toMatch(/user_rs_score:\s*null/);
    const follows = readFileSync(join(__dirname, '../api/follows.js'), 'utf8');
    expect(follows).toContain('resolveRsForViewer');
    const users = readFileSync(join(__dirname, '../api/users.js'), 'utf8');
    expect(users).toContain('/me/r1-archive');
    expect(users).toContain('resolveRsForViewer');
    const idx = readFileSync(join(__dirname, '../index.js'), 'utf8');
    expect(idx).toMatch(/user_rs_score:\s*null/);
    const fb = readFileSync(join(__dirname, '../api/feedback.js'), 'utf8');
    expect(fb).toContain('filterFeedbackRowsForViewer');
    expect(fb).toMatch(/router\.get\('\/ritual\/:ritualId',\s*authenticateToken/);
    const passport = readFileSync(join(__dirname, '../services/passportService.js'), 'utf8');
    expect(passport).toContain('getOwnerR1Archive');
    expect(passport).toContain("entry_type: 'r1'");
    const auth = readFileSync(join(__dirname, '../api/auth.js'), 'utf8');
    expect(auth).toContain('resolveRsForViewer');
    const ownerKeep = filterFeedbackRowsForViewer(
      [
        { feedback_type: 'r1_self', from_user_id: 'u1', r1_self: 'green' },
        { feedback_type: 'r1_self', from_user_id: 'u2', r1_self: 'red' },
        { feedback_type: 'p2p', from_user_id: 'u2', r1_self: 'yellow' },
      ],
      'u1'
    );
    expect(ownerKeep).toHaveLength(2);
    expect(ownerKeep.find((r) => r.feedback_type === 'r1_self').r1_self).toBe('green');
    expect(ownerKeep.find((r) => r.feedback_type === 'p2p').r1_self).toBeNull();
  });

  test('§10 AT-9 tek-tık iz · AT-2 IQ band sim · AT-5/7 duruyor', () => {
    const one = classifyNoPeerTrace({
      noPeerPath: true,
      hasR1: true,
      hasRq: false,
      hasMemory: false,
      delta: 0.04,
      engagementBlocked: false,
    });
    expect(one.farm_watch).toBe(true);
    expect(one.bucket).toBe('one_tap_r1');
    const full = classifyNoPeerTrace({
      noPeerPath: true,
      hasR1: true,
      hasRq: true,
      hasMemory: true,
      delta: 0.04,
    });
    expect(full.farm_watch).toBe(false);
    const peer = classifyNoPeerTrace({ noPeerPath: false, hasR1: true, delta: 0.1 });
    expect(peer.farm_watch).toBe(false);

    const band = runIqWeightBandMatrix();
    expect(band.live_w_iq).toBe(0.4);
    expect(band.band).toEqual([0.35, 0.4]);
    const high = band.rows.find((r) => r.id === 'high_peer');
    expect(high.delta_p_040_minus_035).toBeCloseTo(0.05, 4);
    const sim = runAllSanitySimulations();
    expect(sim.results.some((r) => r.id === 'recovery_climb')).toBe(true);
    expect(sim.iq_weight_band.rows).toHaveLength(4);

    expect(LOCAL_CONFIG.checkin.AIS_LATE).toBe(0.8);
    expect(ifLateFromCount(1)).toBe(0.25);
    const admin = readFileSync(join(__dirname, '../api/admin.js'), 'utf8');
    expect(admin).toContain('/at9-trace-farming');
    const analytics = readFileSync(join(__dirname, '../api/analytics.js'), 'utf8');
    expect(analytics).toContain('/at9-trace-farming');
  });

  test('§5 söz-soğuma parametreleri', () => {
    expect(LOCAL_CONFIG.penalties.PROMISE_COOL.LOCK_NEAR_HOURS).toBe(2);
    expect(LOCAL_CONFIG.penalties.PROMISE_COOL.N).toBe(3);
    const host = readFileSync(join(__dirname, '../services/penaltyService.js'), 'utf8');
    const hostFn = host.slice(host.indexOf('export async function assertCanHostRitual'));
    expect(hostFn).toMatch(/PROMISE_COOLED/);
    expect(host).toMatch(/countPromiseCoolHits/);
    expect(host).toMatch(/isPromiseCoolMixHit/);
    const ident = readFileSync(join(__dirname, '../services/identityService.js'), 'utf8');
    expect(ident).toMatch(/snapshotDisciplineToIdentityHash/);
    expect(ident).toMatch(/discipline_events/);
    expect(ident).toMatch(/INSERT INTO penalty_events/);
    const del = readFileSync(join(__dirname, '../services/accountDeletionService.js'), 'utf8');
    expect(del).toMatch(/snapshotDisciplineToIdentityHash/);
  });

  test('§4 no-peer P rescale AIS=1 MB=0', () => {
    const p = computeTruthSignalFromComponents({
      A_r: 1,
      IQ_r: null,
      CF_r: 1,
      M_r: 0,
      IF_r: 0,
    });
    expect(p.P_r).toBeCloseTo((0.3 / 0.35) * 0.75, 5);
  });

  test('§11 category enum POSITIVE|OBSERVATION|NEGATIVE', () => {
    expect(feelingToCategory('green')).toBe('POSITIVE');
    expect(feelingToCategory('yellow')).toBe('OBSERVATION');
    expect(feelingToCategory('red')).toBe('NEGATIVE');
    expect(LOCAL_CONFIG.feedback.PIPELINE_VALUE.POSITIVE).toBe(1);
    expect(LOCAL_CONFIG.feedback.PIPELINE_VALUE.NEGATIVE).toBe(0);
  });

  test('§11 deadline SABİT 12h', () => {
    expect(LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS).toBe(12);
  });

  test('§1 pipeline applies MOD-L3 IF clamp', () => {
    const src = readFileSync(join(__dirname, '../services/rsEngine.js'), 'utf8');
    expect(src).toMatch(/hasActiveModL3/);
    expect(src).toMatch(/applyIfModL3/);
    expect(src).toMatch(/level = 'L3'/);
  });

  test('§12 life-line min 5', () => {
    expect(LOCAL_CONFIG.venue.LIFE_LINE_MIN).toBe(5);
  });

  test('§11 max-2 chip · §12 aura word min', () => {
    expect(LOCAL_CONFIG.chip.MAX_CHIP_SELECT).toBe(2);
    expect(LOCAL_CONFIG.chip.SINGLE_SELECT).toBe(false);
    expect(LOCAL_CONFIG.venue.AURA_WORD_MIN).toBe(5);
    expect(LOCAL_CONFIG.venue.AURA_TOP_N).toBe(3);
  });

  test('§11 kapanış bildirimi tek kart paketi · 18s leftover yok', () => {
    const indexSrc = readFileSync(join(__dirname, '../index.js'), 'utf8');
    expect(indexSrc).toMatch(/processFeedbackClosingWarnings/);
    expect(indexSrc).not.toMatch(/INTERVAL '18 hours'/);
    expect(indexSrc).not.toMatch(/feedback-deadline-notify/);

    const closeSrc = readFileSync(join(__dirname, '../services/ritualCompletion.js'), 'utf8');
    expect(closeSrc).toMatch(/notifyFeedbackAvailable/);
    expect(closeSrc).not.toMatch(
      /notifyWindowOpened\(p\.user_id, ritualData\)[\s\S]{0,120}notifyFeedbackAvailable/
    );
  });
});
