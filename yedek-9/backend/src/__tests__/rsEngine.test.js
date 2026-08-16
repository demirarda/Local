/**
 * RS pipeline unit tests — son-part.md §5 + v2 §4 no_peer
 */
import { describe, test, expect } from '@jest/globals';
import {
  RS_CONSTANTS,
  clampRawDelta,
  clampRsDelta,
  computeRsPipeline,
  rawDeltaFromTruthSignal,
  boundaryResistance,
  getMaturationMultiplier,
  computeTruthSignalFromComponents,
  blendIqFromRaw,
  blendCf,
  applyNoPeerEngagementGate,
  applySoloEngagementGate,
  aisFromAttendanceRow,
  LOCAL_CONFIG,
} from '../config/localConfig.js';

describe('RS pipeline (son-part.md §5)', () => {
  test('raw delta caps at +0.075 / -0.30', () => {
    expect(clampRawDelta(0.2)).toBe(0.075);
    expect(clampRawDelta(-0.5)).toBe(-0.3);
    expect(clampRawDelta(0.04)).toBe(0.04);
  });

  test('final delta caps at +0.12 / -0.15', () => {
    expect(clampRsDelta(0.2)).toBe(0.12);
    expect(clampRsDelta(-0.2)).toBe(-0.15);
  });

  test('positive truth signal produces bounded raw delta', () => {
    const raw = rawDeltaFromTruthSignal(0.75);
    expect(raw).toBeCloseTo(0.075, 5);
    expect(clampRawDelta(raw)).toBe(0.075);
  });

  test('MD dampens early rituals', () => {
    expect(getMaturationMultiplier(1)).toBe(0.5);
    expect(getMaturationMultiplier(12)).toBe(1.0);
  });

  test('DS skipped before ritual 6', () => {
    const early = computeRsPipeline({
      S_r: 0.7,
      currentRS: 5.5,
      ritualIndex: 3,
      dsMultiplier: 1.2,
      bcTrend: 0.8,
    });
    expect(early.dsApplied).toBe(false);
    expect(early.deltaAfterDs).toBe(early.deltaRawCapped);
  });

  test('BC skipped before ritual 4', () => {
    const r = computeRsPipeline({
      S_r: 0.7,
      currentRS: 5.5,
      ritualIndex: 3,
      dsMultiplier: 1.0,
      bcTrend: 0.2,
    });
    expect(r.bcApplied).toBe(false);
    expect(r.deltaAfterBc).toBe(r.deltaAfterDs);
  });

  test('BR dampens gains near RS upper bound', () => {
    const br = boundaryResistance(8.5, 0.05);
    expect(br).toBeLessThan(1.0);
    expect(br).toBeGreaterThanOrEqual(RS_CONSTANTS.BR_MIN);
  });

  test('full pipeline applies multipliers in order', () => {
    const r = computeRsPipeline({
      S_r: 0.65,
      currentRS: 6.0,
      ritualIndex: 8,
      dsMultiplier: 1.1,
      bcTrend: 0.7,
    });
    expect(r.dsApplied).toBe(true);
    expect(r.bcApplied).toBe(true);
    expect(r.deltaAfterDs).toBeCloseTo(r.deltaRawCapped * 1.1, 6);
    expect(Math.abs(r.deltaFinal)).toBeLessThanOrEqual(0.12);
  });

  test('n-context freeze zeroes positive delta after DS', () => {
    const frozen = computeRsPipeline({
      S_r: 0.8,
      currentRS: 5.0,
      ritualIndex: 10,
      dsMultiplier: 1.0,
      bcTrend: 0.5,
      nFrozen: true,
    });
    expect(frozen.deltaAfterDs).toBe(0);
    expect(frozen.deltaFinal).toBe(0);
  });

  test('P_r clamps to S_POS_MAX and T_r follows (§5)', () => {
    const mid = computeTruthSignalFromComponents({
      A_r: 0.5,
      IQ_r: 0.5,
      CF_r: 0.5,
      M_r: 0,
      IF_r: 0,
    });
    expect(mid.P_r).toBeCloseTo(0.35, 5);
    expect(mid.T_r).toBeCloseTo(0.35, 5);
    expect(mid.S_r).toBe(mid.T_r);
    expect(mid.T_r).toBeLessThan(RS_CONSTANTS.THRESHOLD);

    const atCap = computeTruthSignalFromComponents({
      A_r: 1,
      IQ_r: 1,
      CF_r: 1,
      M_r: 1,
      IF_r: 0,
    });
    expect(atCap.P_r).toBeCloseTo(RS_CONSTANTS.S_POS_MAX, 5);

    const over = computeTruthSignalFromComponents({
      A_r: 2,
      IQ_r: 2,
      CF_r: 2,
      M_r: 2,
      IF_r: 0,
    });
    expect(over.P_r).toBe(RS_CONSTANTS.S_POS_MAX);
  });

  test('blendIqFromRaw n=1 uses 60% neutral + 40% raw', () => {
    expect(blendIqFromRaw(1.0, 1, 0.5)).toBeCloseTo(0.7, 5);
    expect(blendIqFromRaw(0.0, 1, 0.5)).toBeCloseTo(0.3, 5);
  });

  test('EMPTY_FB_IF is 0.30 (Master Parametre §4)', () => {
    expect(LOCAL_CONFIG.rs.IF_FEEDBACK_MISSING).toBe(0.3);
    expect(LOCAL_CONFIG.rs.IF_LATE_SLICE).toBe(0.25);
  });
});

describe('§6 TEK KÖPRÜ — AIS saati = deneme anı', () => {
  const start = '2026-08-14T12:00:00.000Z';
  const duration = 60; // KAPI=12, full=7.2

  test('basılı on-time ais_score, geç checkin_at IF late açmaz', () => {
    const r = aisFromAttendanceRow(
      {
        ais_score: 1.0,
        checkin_at: '2026-08-14T12:10:00.000Z',
        checkin_attempt_at: null,
      },
      start,
      duration
    );
    expect(r.status).toBe('on_time');
    expect(r.source).toBe('ais_score');
  });

  test('ais_score yoksa attempt on-time, mühür late → on_time', () => {
    const r = aisFromAttendanceRow(
      {
        ais_score: null,
        checkin_attempt_at: '2026-08-14T12:05:00.000Z',
        checkin_at: '2026-08-14T12:10:00.000Z',
      },
      start,
      duration
    );
    expect(r.status).toBe('on_time');
    expect(r.ais).toBe(LOCAL_CONFIG.checkin.AIS_REDUCED);
    expect(r.source).toBe('checkin_attempt_at');
  });

  test('basılı AIS_LATE late kalır', () => {
    const r = aisFromAttendanceRow(
      {
        ais_score: LOCAL_CONFIG.checkin.AIS_LATE,
        checkin_at: '2026-08-14T12:20:00.000Z',
        checkin_attempt_at: null,
      },
      start,
      duration
    );
    expect(r.status).toBe('late');
    expect(r.source).toBe('ais_score');
  });

  test('legacy yedek: yalnız checkin_at late → late', () => {
    const r = aisFromAttendanceRow(
      {
        ais_score: null,
        checkin_attempt_at: null,
        checkin_at: '2026-08-14T12:10:00.000Z',
      },
      start,
      duration
    );
    expect(r.status).toBe('late');
    expect(r.source).toBe('checkin_at');
  });
});

describe('No-peer path (§4)', () => {
  test('blendCf uses CF_SELF_NO_PEER_W when peerCount=0', () => {
    const w = LOCAL_CONFIG.rs.no_peer.CF_SELF_NO_PEER_W;
    expect(w).toBe(0.5);
    expect(blendCf({ CF_peers: 0.5, CF_self: 1.0, peerCount: 0 })).toBeCloseTo(
      w * 1.0 + (1 - w) * 0.5,
      5
    );
    expect(blendCf({ CF_peers: 0.5, CF_self: 0.0, peerCount: 0 })).toBeCloseTo(
      w * 0.0 + (1 - w) * 0.5,
      5
    );
  });

  test('blendCf uses CF_PEER/CF_SELF when peers present', () => {
    expect(blendCf({ CF_peers: 1.0, CF_self: 0.0, peerCount: 2 })).toBeCloseTo(
      RS_CONSTANTS.CF_PEER * 1.0 + RS_CONSTANTS.CF_SELF * 0.0,
      5
    );
  });

  test('no_peer engagement blocks positive delta without R1 or memory', () => {
    expect(
      applyNoPeerEngagementGate(0.05, { noPeerPath: true, hasR1: false, hasMemory: false })
    ).toBe(0);
    expect(
      applyNoPeerEngagementGate(0.05, { noPeerPath: true, hasR1: true, hasMemory: false })
    ).toBe(0.05);
    expect(
      applyNoPeerEngagementGate(0.05, { noPeerPath: true, hasR1: false, hasMemory: true })
    ).toBe(0.05);
  });

  test('no_peer engagement allows negative delta without R1/memory', () => {
    expect(
      applyNoPeerEngagementGate(-0.08, { noPeerPath: true, hasR1: false, hasMemory: false })
    ).toBe(-0.08);
  });

  test('engagement gate is no-op off no_peer path', () => {
    expect(
      applyNoPeerEngagementGate(0.05, { noPeerPath: false, hasR1: false, hasMemory: false })
    ).toBe(0.05);
  });

  test('deprecated applySoloEngagementGate aliases no_peer', () => {
    expect(
      applySoloEngagementGate(0.05, { soloPath: true, hasR1: false, hasMemory: false })
    ).toBe(0);
  });
});
