/**
 * Venue Trust & Aura display — sonMD VEN-4
 * Hesap 0–1 (prior_internal:0.50) · gösterim ×10
 * Display-only; venue skorları RS'e ASLA girmez.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const {
  K,
  PRIOR,
  PRIOR_INTERNAL,
  DISPLAY_SCALE,
  WINDOW_DAYS,
  OTURMA,
  DIST_MIN_RITUAL,
  KATEGORI_TENTATIVE,
  CATEGORY_PRIOR_ENABLED,
  CATEGORY_PRIOR_SWITCH_N,
  MIN_DISPLAY_N,
  MIN_ANSWERS_PER_OBS,
  REPEAT_RATER_W,
} = LOCAL_CONFIG.venue;

const FEELING_INTERNAL = {
  green: 1.0,
  yellow: 0.65,
  red: 0.3,
};

const scale = () => Number(DISPLAY_SCALE) || 10;
const priorInternal = () =>
  PRIOR_INTERNAL != null ? Number(PRIOR_INTERNAL) : Number(PRIOR || 5) / scale();

/** Display 0–10 (geriye uyum) */
export function feelingToScore(feeling) {
  const internal = feelingToInternal(feeling);
  if (internal == null) return null;
  return Number((internal * scale()).toFixed(2));
}

export function feelingToInternal(feeling) {
  if (!feeling) return null;
  const v = FEELING_INTERNAL[String(feeling).toLowerCase()];
  return v != null ? v : null;
}

/** 0-based visit index → weight */
export function repeatRaterWeight(visitIndexZeroBased) {
  const w = Array.isArray(REPEAT_RATER_W) && REPEAT_RATER_W.length
    ? REPEAT_RATER_W
    : [1.0, 0.5, 0.5, 0.25];
  const i = Math.max(0, Number(visitIndexZeroBased) || 0);
  return Number(w[Math.min(i, w.length - 1)] ?? w[w.length - 1] ?? 1);
}

/**
 * VEN-4: S_display = ((n_eff × S_ham + K × prior) / (n_eff + K)) × DISPLAY_SCALE
 * sHamInternal & priorInternal are 0–1; returned score is display (×10).
 */
export function computeVen4Display(
  sHamInternal,
  nEff,
  k = K,
  priorInt = priorInternal()
) {
  const n = Math.max(0, Number(nEff) || 0);
  const s =
    sHamInternal != null && Number.isFinite(Number(sHamInternal))
      ? Number(sHamInternal)
      : null;
  const p = Number(priorInt);
  const sc = scale();
  if (n === 0 || s == null) {
    return {
      score: Number((p * sc).toFixed(2)),
      score_internal: Number(p.toFixed(4)),
      s_ham: null,
      s_ham_internal: null,
      n_eff: 0,
      prior: Number((p * sc).toFixed(2)),
      prior_internal: Number(p.toFixed(4)),
      k,
      is_prior_fallback: true,
    };
  }
  const internal = (n * s + k * p) / (n + k);
  return {
    score: Number((internal * sc).toFixed(2)),
    score_internal: Number(internal.toFixed(4)),
    s_ham: Number((s * sc).toFixed(2)),
    s_ham_internal: Number(s.toFixed(4)),
    n_eff: n,
    prior: Number((p * sc).toFixed(2)),
    prior_internal: Number(p.toFixed(4)),
    k,
    is_prior_fallback: false,
  };
}

/**
 * Public vitrin: n_eff < MIN_DISPLAY_N → sayı gizle, etiket göster.
 * audience=panel|venue → her zaman sayı.
 */
export function applyMinDisplayGate(display, { audience = 'public' } = {}) {
  const minN = Number(MIN_DISPLAY_N) || 5;
  const n = Number(display?.n_eff) || 0;
  const isPanel = audience === 'panel' || audience === 'venue' || audience === 'manager';
  if (isPanel || n >= minN) {
    return {
      ...display,
      public_numeric: true,
      public_label: null,
      score_hidden: false,
    };
  }
  return {
    ...display,
    score: null,
    public_numeric: false,
    public_label: 'Henüz az gözlem',
    score_hidden: true,
    score_hidden_reason: 'below_min_display_n',
    min_display_n: minN,
  };
}

export function getSeatingLabel(nEff) {
  const n = Number(nEff) || 0;
  const [low, high] = OTURMA || [2, 10];
  if (n < low) return { key: 'yeni', label: 'Yeni' };
  if (n < high) return { key: 'oturuyor', label: 'Oturuyor' };
  return { key: 'oturmus', label: 'Oturmus' };
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildAuraDistribution(
  ritualRows = [],
  minRituals = DIST_MIN_RITUAL,
  tentativeMin = KATEGORI_TENTATIVE
) {
  const nRitual = ritualRows.length;
  if (nRitual < minRituals) {
    return { hidden: true, reason: 'n_Ritual_below_min', n_ritual: nRitual, categories: [] };
  }
  const byCat = new Map();
  for (const row of ritualRows) {
    const cat = String(row.category || 'diger').trim() || 'diger';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(Number(row.avg_score));
  }
  const categories = [];
  for (const [category, scores] of byCat.entries()) {
    const count = scores.length;
    const avg = mean(scores);
    categories.push({
      category,
      count,
      avg_score: avg != null ? Number(avg.toFixed(2)) : null,
      status: count < tentativeMin ? 'tentative' : 'stable',
    });
  }
  categories.sort((a, b) => b.count - a.count);
  return { hidden: false, n_ritual: nRitual, categories };
}

/**
 * Weighted ritual observations — MIN_ANSWERS_PER_OBS + REPEAT_RATER_W
 * Returns rows with avg_score on display scale (0–10) for distribution UI.
 */
async function fetchRitualObservations(venueId, feedbackType, windowStart) {
  const feelingColumn =
    feedbackType === 'p2v' || feedbackType === 'p2m' ? 'p2v_feeling' : 'p2r_feeling';
  const fbType = feedbackType === 'p2m' ? 'p2v' : feedbackType;
  const minAns = Number(MIN_ANSWERS_PER_OBS) || 2;

  const r = await pool.query(
    `SELECT
       f.id AS feedback_id,
       f.user_id,
       f.created_at AS answered_at,
       r.id AS ritual_id,
       COALESCE(NULLIF(TRIM(r.type), ''), 'diger') AS category,
       r.start_time,
       COALESCE(f.${feelingColumn}, f.p2r_feeling) AS feeling
     FROM rituals r
     JOIN feedback f ON f.ritual_id = r.id AND f.feedback_type = $2
     JOIN ritual_attendance ra
       ON ra.ritual_id = r.id
      AND ra.user_id = COALESCE(f.from_user_id, f.rater_id, f.user_id)
      AND ra.checkin_at IS NOT NULL
      AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
      AND ra.status::text NOT IN ('no_show', 'cancelled')
     WHERE r.venue_id = $1
       AND r.suspended_at IS NULL
       AND r.start_time >= $3
       AND COALESCE(f.${feelingColumn}, f.p2r_feeling) IN ('green', 'yellow', 'red')
     ORDER BY r.start_time ASC, f.created_at ASC`,
    [venueId, fbType, windowStart]
  );

  // visit ordinal per user within window (0-based for weight)
  const userVisitCount = new Map();
  const byRitual = new Map();

  for (const row of r.rows) {
    const uid = String(row.user_id);
    const visitIdx = userVisitCount.get(uid) || 0;
    userVisitCount.set(uid, visitIdx + 1);
    const internal = feelingToInternal(row.feeling);
    if (internal == null) continue;
    const w = repeatRaterWeight(visitIdx);
    if (!byRitual.has(row.ritual_id)) {
      byRitual.set(row.ritual_id, {
        ritual_id: row.ritual_id,
        category: row.category,
        start_time: row.start_time,
        answers: [],
      });
    }
    byRitual.get(row.ritual_id).answers.push({ internal, weight: w });
  }

  const out = [];
  for (const obs of byRitual.values()) {
    const rawN = obs.answers.length;
    if (rawN < minAns) continue; // eşik altı gözlem üretmez; chip ayrı kaydedilir
    let wSum = 0;
    let vSum = 0;
    for (const a of obs.answers) {
      wSum += a.weight;
      vSum += a.internal * a.weight;
    }
    if (wSum <= 0) continue;
    const avgInternal = vSum / wSum;
    out.push({
      ritual_id: obs.ritual_id,
      category: obs.category,
      start_time: obs.start_time,
      avg_score: Number((avgInternal * scale()).toFixed(2)),
      avg_internal: Number(avgInternal.toFixed(4)),
      feedback_count: rawN,
      weighted_n: Number(wSum.toFixed(3)),
    });
  }
  out.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  return out;
}

/** Post-launch: şehir Ritual ortalamalarından prior — §18 geçiş n≥35 · dönüş 0–1 */
async function computeCategoryPriorInternal(venueId, feedbackType, windowStart) {
  if (!CATEGORY_PRIOR_ENABLED) return priorInternal();
  const venueR = await pool.query(`SELECT city FROM venues WHERE id = $1`, [venueId]);
  const city = venueR.rows[0]?.city;
  if (!city) return priorInternal();

  const feelingColumn =
    feedbackType === 'p2v' || feedbackType === 'p2m' ? 'p2v_feeling' : 'p2r_feeling';
  const switchN = Number(CATEGORY_PRIOR_SWITCH_N) || 35;
  const sc = scale();
  const r = await pool.query(
    `SELECT AVG(sub.avg_score) AS prior, COUNT(*)::int AS n
     FROM (
       SELECT AVG(
         CASE COALESCE(f.${feelingColumn}, f.p2r_feeling, '')
           WHEN 'green' THEN 10.0
           WHEN 'yellow' THEN 6.5
           WHEN 'red' THEN 3.0
           ELSE NULL
         END
       ) AS avg_score
       FROM rituals r
       JOIN venues v ON v.id = r.venue_id
       JOIN feedback f ON f.ritual_id = r.id AND f.feedback_type = $2
       WHERE LOWER(v.city) = LOWER($1)
         AND r.suspended_at IS NULL
         AND r.start_time >= $3
         AND COALESCE(f.${feelingColumn}, f.p2r_feeling) IN ('green', 'yellow', 'red')
       GROUP BY r.id
       HAVING COUNT(f.id) > 0
     ) sub`,
    [city, feedbackType === 'p2m' ? 'p2v' : feedbackType, windowStart]
  );
  const n = Number(r.rows[0]?.n) || 0;
  if (n < switchN) return priorInternal();
  const priorDisplay = r.rows[0]?.prior != null ? Number(r.rows[0].prior) : null;
  if (priorDisplay == null || !Number.isFinite(priorDisplay)) return priorInternal();
  return Number((priorDisplay / sc).toFixed(4));
}

/**
 * @param {string} venueId
 * @param {{ audience?: 'public'|'panel'|'venue'|'manager' }} [opts]
 */
export async function computeVenueTrustAura(venueId, opts = {}) {
  const audience = opts.audience || 'panel';
  const venueR = await pool.query(`SELECT id, created_at FROM venues WHERE id = $1`, [venueId]);
  if (venueR.rows.length === 0) return null;

  const venueCreated = venueR.rows[0].created_at;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const scoreStart = venueCreated > windowStart ? venueCreated : windowStart;

  const [trustRituals, auraRituals] = await Promise.all([
    fetchRitualObservations(venueId, 'p2v', scoreStart),
    fetchRitualObservations(venueId, 'p2r', scoreStart),
  ]);

  const trustInternals = trustRituals.map((r) => r.avg_internal).filter((s) => s != null);
  const auraInternals = auraRituals.map((r) => r.avg_internal).filter((s) => s != null);

  const [trustPriorInt, auraPriorInt] = await Promise.all([
    computeCategoryPriorInternal(venueId, 'p2v', scoreStart),
    computeCategoryPriorInternal(venueId, 'p2r', scoreStart),
  ]);

  let trustDisplay = computeVen4Display(mean(trustInternals), trustInternals.length, K, trustPriorInt);
  let auraDisplay = computeVen4Display(mean(auraInternals), auraInternals.length, K, auraPriorInt);

  trustDisplay = applyMinDisplayGate(trustDisplay, { audience });
  auraDisplay = applyMinDisplayGate(auraDisplay, { audience });

  const seatingN = Math.max(trustInternals.length, auraInternals.length);
  const seating = getSeatingLabel(seatingN);
  const auraDistribution = buildAuraDistribution(auraRituals);

  return {
    trust_display: {
      ...trustDisplay,
      label: 'Trust',
      source: 'p2v',
      window_days: WINDOW_DAYS,
      unit: 'Ritual',
      min_display_n: Number(MIN_DISPLAY_N) || 5,
      min_answers_per_obs: Number(MIN_ANSWERS_PER_OBS) || 2,
    },
    aura_display: {
      ...auraDisplay,
      label: 'Aura',
      source: 'p2r',
      window_days: WINDOW_DAYS,
      unit: 'Ritual',
      distribution: auraDistribution.hidden ? null : auraDistribution,
      distribution_hidden: auraDistribution.hidden,
      distribution_reason: auraDistribution.hidden ? auraDistribution.reason : null,
      min_display_n: Number(MIN_DISPLAY_N) || 5,
      min_answers_per_obs: Number(MIN_ANSWERS_PER_OBS) || 2,
    },
    seating_label: seating.label,
    seating_key: seating.key,
    score_start_at: scoreStart.toISOString(),
    audience,
  };
}

/** Oturma etiketi değişince venue manager'lara bildir — §11-F */
export async function refreshVenueSeatingNotifications(venueId) {
  const scores = await computeVenueTrustAura(venueId, { audience: 'panel' });
  const prev = await pool.query(
    `SELECT seating_key_cache, name FROM venues WHERE id = $1`,
    [venueId]
  );
  if (prev.rows.length === 0) return { skipped: true };
  const oldKey = prev.rows[0].seating_key_cache;
  const newKey = scores.seating_key;
  if (oldKey && newKey && oldKey !== newKey) {
    const { notifySeatingStatusChange } = await import('./notifications.js');
    const managers = await pool.query(
      `SELECT user_id FROM venue_managers WHERE venue_id = $1`,
      [venueId]
    );
    for (const m of managers.rows) {
      notifySeatingStatusChange(m.user_id, {
        venueId,
        venueName: prev.rows[0].name,
        seatingLabel: scores.seating_label,
        seatingKey: newKey,
      }).catch(() => {});
    }
  }
  await pool.query(`UPDATE venues SET seating_key_cache = $2 WHERE id = $1`, [venueId, newKey || null]);
  return { venue_id: venueId, seating_key: newKey, changed: oldKey !== newKey };
}
