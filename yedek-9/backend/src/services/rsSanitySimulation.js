/**
 * RS pre-launch sanity simulations — LOCAL_RS §16, son-part.md config kalibrasyonu
 */
import LOCAL_CONFIG, {
  computeRsPipeline,
  computeTruthSignalFromComponents,
  getNoShowRsPenalty,
  getLateCancelRsPenalty,
  RS_CONSTANTS,
} from '../config/localConfig.js';

function clampRs(rs) {
  return Math.max(RS_CONSTANTS.MIN, Math.min(RS_CONSTANTS.MAX, Number(rs.toFixed(2))));
}

export function simulateScenario(def) {
  let rs = Number(def.start_rs);
  const ritualCount = Number(def.rituals || 0);
  const sR = Number(def.s_r ?? 0.85);

  for (let i = 1; i <= ritualCount; i += 1) {
    const pipeline = computeRsPipeline({
      S_r: sR,
      currentRS: rs,
      ritualIndex: i,
      dsMultiplier: 1.0,
      bcTrend: 0.75,
      nFrozen: false,
    });
    rs = clampRs(rs + pipeline.deltaFinal);
  }

  const noshowStrikes = Number(def.noshow_strikes || 0);
  if (noshowStrikes > 0 && def.noshow_rs !== false) {
    for (let s = 1; s <= noshowStrikes; s += 1) {
      const pen = getNoShowRsPenalty(s);
      if (pen != null) rs = clampRs(rs + pen);
    }
  }

  const lateStrikes = Number(def.late_cancel_strikes || 0);
  if (lateStrikes > 0) {
    for (let s = 1; s <= lateStrikes; s += 1) {
      const pen = getLateCancelRsPenalty(s);
      if (pen != null) rs = clampRs(rs + pen);
    }
  }

  const target = Number(def.target_rs);
  const tolerance = Number(def.tolerance || 0.1);
  const delta = Math.abs(rs - target);
  const pass = delta <= tolerance;

  return {
    id: def.id,
    label: def.label,
    start_rs: def.start_rs,
    expected_rs: target,
    actual_rs: rs,
    tolerance,
    delta: Number(delta.toFixed(3)),
    pass,
  };
}

/** §10 AT-2 — IQ ağırlık bandı .35–.40 sim-matrisi. Canlı W_IQ değişmez. */
export function runIqWeightBandMatrix({
  band = [0.35, 0.4],
  live = LOCAL_CONFIG.rs.W_IQ,
} = {}) {
  const wA = LOCAL_CONFIG.rs.W_A;
  const wM = LOCAL_CONFIG.rs.W_MB;
  const cases = [
    { id: 'high_peer', A_r: 1, IQ_r: 1, M_r: 1, IF_r: 0 },
    { id: 'mid_peer', A_r: 1, IQ_r: 0.5, M_r: 0.5, IF_r: 0 },
    { id: 'red_iq', A_r: 1, IQ_r: 0, M_r: 0, IF_r: 0 },
    { id: 'late_clean_iq', A_r: 0.8, IQ_r: 1, M_r: 1, IF_r: 0.25 },
  ];
  const rows = cases.map((c) => {
    const byWeight = band.map((wIQ) => {
      const ts = computeTruthSignalFromComponents({
        ...c,
        CF_r: 0,
        weights: { wA, wIQ, wM, wCF: 0 },
      });
      return {
        w_iq: wIQ,
        P_r: Number(ts.P_r.toFixed(4)),
        T_r: Number(ts.T_r.toFixed(4)),
      };
    });
    const p35 = byWeight.find((x) => Number(x.w_iq) === 0.35)?.P_r;
    const p40 = byWeight.find((x) => Number(x.w_iq) === 0.4)?.P_r;
    return {
      id: c.id,
      A_r: c.A_r,
      IQ_r: c.IQ_r,
      M_r: c.M_r,
      IF_r: c.IF_r,
      by_weight: byWeight,
      delta_p_040_minus_035:
        p35 != null && p40 != null ? Number((p40 - p35).toFixed(4)) : null,
    };
  });
  return {
    spec: 'AT-2 IQ weight band .35-.40 — sim only',
    live_w_iq: live,
    band,
    rows,
  };
}

export function runAllSanitySimulations(scenarios = LOCAL_CONFIG.rsSanity?.SCENARIOS || []) {
  const results = scenarios.map((s) => simulateScenario(s));
  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    all_pass: passed === results.length,
    results,
    iq_weight_band: runIqWeightBandMatrix(),
  };
}
