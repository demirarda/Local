/**
 * Venue Trust & Aura display — sonMD VEN-4
 * Hesap 0–1 (prior_internal:0.50) · gösterim ×10
 * Display-only; venue skorları RS'e ASLA girmez.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { decorateAuraChip } from '../i18n/auraCopyMap.js';
import { isAuraRelevantChip } from './megaFb.js';

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
  yellow: 0.5,
  red: 0.0,
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
  const k = Number(LOCAL_CONFIG.venue.REPEAT_RATER_K ?? 1);
  const n = Math.max(0, Number(visitIndexZeroBased) || 0);
  return 1 / (1 + k * n);
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
    public_label: 'Yeni mekan — LOCAL beş kez tanır, sonra konuşur',
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

/** Feedback rater — şemada from_user_id / rater_id (user_id kolonu yok). */
export const RATER_ID_SQL = 'COALESCE(f.from_user_id, f.rater_id)';

/**
 * Weighted ritual observations — MIN_ANSWERS_PER_OBS + REPEAT_RATER_W
 * Returns rows with avg_score on display scale (0–10) for distribution UI.
 * 30-kişilik gece = 1 gözlem (ritüel kovası) 🔒 · kişi-başı gece MAX-2.
 */
async function fetchRitualObservations(placeId, feedbackType, windowStart, { place = 'venue' } = {}) {
  const feelingColumn =
    feedbackType === 'p2v' || feedbackType === 'p2m' ? 'p2v_feeling' : 'p2r_feeling';
  const fbType = feedbackType === 'p2m' ? 'p2v' : feedbackType;
  const minAns = Number(LOCAL_CONFIG.venue.MIN_ANSWERS_PER_OBS ?? 1);
  const placeSql =
    place === 'zone'
      ? `(r.zone_id = $1 OR r.route_id = (SELECT z.route_id FROM zones z WHERE z.id = $1 AND z.route_id IS NOT NULL))`
      : 'r.venue_id = $1';

  const r = await pool.query(
    `SELECT
       f.id AS feedback_id,
       ${RATER_ID_SQL} AS user_id,
       f.created_at AS answered_at,
       r.id AS ritual_id,
       COALESCE(NULLIF(TRIM(r.type), ''), 'diger') AS category,
       r.start_time,
       COALESCE(f.${feelingColumn}, f.p2r_feeling) AS feeling
     FROM rituals r
     JOIN feedback f ON f.ritual_id = r.id AND f.feedback_type = $2
     JOIN ritual_attendance ra
       ON ra.ritual_id = r.id
      AND ra.user_id = ${RATER_ID_SQL}
      AND ra.checkin_at IS NOT NULL
      AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
      AND ra.status::text NOT IN ('no_show', 'cancelled')
     WHERE ${placeSql}
       AND r.suspended_at IS NULL
       AND r.start_time >= $3
       AND COALESCE(f.${feelingColumn}, f.p2r_feeling) IN ('green', 'yellow', 'red')
       AND NOT EXISTS (
         SELECT 1 FROM venue_managers vm
         WHERE vm.venue_id IS NOT DISTINCT FROM r.venue_id
           AND vm.user_id = ${RATER_ID_SQL}
       )
       AND ${RATER_ID_SQL} IS DISTINCT FROM r.host_id
     ORDER BY r.start_time ASC, f.created_at ASC`,
    [placeId, fbType, windowStart]
  );

  const maxPerNight = Number(LOCAL_CONFIG.venue.MAX_OBS_PER_PERSON_PER_NIGHT || 2);
  const userNightCount = new Map();
  const userVisitCount = new Map();
  const byRitual = new Map();

  for (const row of r.rows) {
    const uid = String(row.user_id || '');
    if (!uid) continue;
    const nightKey = `${uid}:${new Date(row.start_time).toISOString().slice(0, 10)}`;
    const nightN = userNightCount.get(nightKey) || 0;
    if (nightN >= maxPerNight) continue;
    userNightCount.set(nightKey, nightN + 1);

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
    if (rawN < minAns) continue; // §12: 1 eligible P2V = 1 gece; 0 cevap yazmaz
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

/**
 * §12 Aura = kelime motoru. RQ kategorisi Trust'a da Aura-tonuna da girmez.
 * P2V-chip + RQ-chip sayacı, 120g pencere, eşiğin altında gizle.
 */
async function fetchAuraWords(venueId, windowStart, nEffTrust) {
  const minWord = Number(LOCAL_CONFIG.venue.AURA_WORD_MIN) || 5;
  const minDisplay = Number(MIN_DISPLAY_N) || 5;
  const topN = Number(LOCAL_CONFIG.venue.AURA_TOP_N) || 3;
  let rows = [];
  try {
    const r = await pool.query(
      `SELECT f.chip_id, COUNT(*)::int AS c
       FROM feedback f
       JOIN rituals rit ON rit.id = f.ritual_id
       WHERE rit.venue_id = $1
         AND f.chip_id IS NOT NULL
         AND f.feedback_type IN ('p2v', 'p2r', 'rq')
         AND rit.start_time >= $2
         AND rit.suspended_at IS NULL
       GROUP BY f.chip_id
       ORDER BY c DESC`,
      [venueId, windowStart]
    );
    rows = r.rows.filter((row) => {
      try {
        return isAuraRelevantChip(row.chip_id, { place: 'venue' });
      } catch (_e) {
        return String(row.chip_id || '').startsWith('p2v_');
      }
    });
  } catch (_e) {
    rows = [];
  }
  try {
    const extra = await pool.query(
      `SELECT f.chip_id_2 AS chip_id, COUNT(*)::int AS c
       FROM feedback f
       JOIN rituals rit ON rit.id = f.ritual_id
       WHERE rit.venue_id = $1
         AND f.chip_id_2 IS NOT NULL
         AND f.feedback_type IN ('p2v', 'p2r', 'rq')
         AND rit.start_time >= $2
         AND rit.suspended_at IS NULL
       GROUP BY f.chip_id_2`,
      [venueId, windowStart]
    );
    const map = new Map(rows.map((x) => [x.chip_id, Number(x.c)]));
    for (const row of extra.rows) {
      try {
        if (!isAuraRelevantChip(row.chip_id, { place: 'venue' })) continue;
      } catch (_e) {
        if (!String(row.chip_id || '').startsWith('p2v_')) continue;
      }
      map.set(row.chip_id, (map.get(row.chip_id) || 0) + Number(row.c));
    }
    rows = [...map.entries()]
      .map(([chip_id, c]) => ({ chip_id, c }))
      .sort((a, b) => b.c - a.c);
  } catch (_e) {
    /* chip_id_2 may be missing */
  }
  const qualifying = rows.filter((row) => Number(row.c) >= minWord);
  const hidden = nEffTrust < minDisplay || qualifying.length === 0;
  const mapped = qualifying.map((row) => decorateAuraChip(row));
  return {
    hidden,
    words: mapped.slice(0, topN).map((row) => row.label),
    top_chips: mapped.slice(0, 5),
    type_fallback: hidden,
  };
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
           WHEN 'yellow' THEN 5.0
           WHEN 'red' THEN 0.0
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

  const [trustRituals] = await Promise.all([
    fetchRitualObservations(venueId, 'p2v', scoreStart, { place: 'venue' }),
  ]);
  const auraWords = await fetchAuraWords(venueId, scoreStart, trustRituals.length);

  const trustInternals = trustRituals.map((r) => r.avg_internal).filter((s) => s != null);

  const trustPriorInt = await computeCategoryPriorInternal(venueId, 'p2v', scoreStart);

  let trustDisplay = computeVen4Display(mean(trustInternals), trustInternals.length, K, trustPriorInt);

  trustDisplay = applyMinDisplayGate(trustDisplay, { audience });

  const seatingN = trustInternals.length;
  const seating = getSeatingLabel(seatingN);

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
      score: null,
      score_hidden: true,
      score_hidden_reason: 'aura_is_words',
      public_numeric: false,
      label: 'Aura',
      source: 'p2v_chip+rq_chip',
      window_days: WINDOW_DAYS,
      words: auraWords.hidden ? [] : auraWords.words,
      top_chips: auraWords.hidden ? [] : auraWords.top_chips,
      hidden: auraWords.hidden,
      type_fallback: Boolean(auraWords.hidden),
      n_eff: trustInternals.length,
      min_display_n: Number(MIN_DISPLAY_N) || 5,
      word_min: Number(LOCAL_CONFIG.venue.AURA_WORD_MIN) || 5,
    },
    seating_label: seating.label,
    seating_key: seating.key,
    score_start_at: scoreStart.toISOString(),
    audience,
  };
}

/**
 * §7 P2Z → Zone-Aura — Trust yok · yalnız p2z · VEN-4 (shrinkage + MIN_DISPLAY + gece=1).
 */
export async function computeZoneAuraDisplay(zoneId, opts = {}) {
  const audience = opts.audience || 'public';
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const rituals = await fetchRitualObservations(zoneId, 'p2z', windowStart, { place: 'zone' });
  const internals = rituals.map((r) => r.avg_internal).filter((s) => s != null);
  let display = computeVen4Display(mean(internals), internals.length, K, priorInternal());
  display = applyMinDisplayGate(display, { audience });

  return {
    ...display,
    score: display.score_hidden ? null : display.score,
    n_eff: internals.length,
    window_days: WINDOW_DAYS,
    source: 'p2z',
    trust: null,
    unit: 'Ritual',
    min_display_n: Number(MIN_DISPLAY_N) || 5,
    min_answers_per_obs: Number(MIN_ANSWERS_PER_OBS) || 2,
    note: 'Zone Aura — Trust yok; yalnız P2Z; VEN-4',
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
