/**
 * RS pre-launch sanity simulations — LOCAL_RS §16, son-part.md config kalibrasyonu
 */
import LOCAL_CONFIG, {
  computeRsPipeline,
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

export function runAllSanitySimulations(scenarios = LOCAL_CONFIG.rsSanity?.SCENARIOS || []) {
  const results = scenarios.map((s) => simulateScenario(s));
  const passed = results.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    all_pass: passed === results.length,
    results,
  };
}
