/**
 * v2 §6 REGULAR — aynı mekanda 45g / 4 check-in → private Regular; sönüm 60g.
 * Ham durum başkasına asla sızmaz; sönüm sessiz (bildirim yok).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const THRESHOLD = Number(LOCAL_CONFIG.regular?.N || LOCAL_CONFIG.regular?.THRESHOLD || 3);
const WINDOW_D = Number(LOCAL_CONFIG.regular?.WINDOW_D || 90);
const DECAY_D = Number(LOCAL_CONFIG.regular?.DECAY_D || 60);
const COUNTER_UI = LOCAL_CONFIG.regular?.COUNTER_UI !== false;

/**
 * sonMD §7 / Master §10 — kazanım: WINDOW_D içinde N mühür.
 * Sönüm: son mühürden DECAY_D sonra sessiz düşüş (kazanım penceresi sönüm değildir).
 */
export function computeIsRegular({
  windowCount,
  lastCheckinAt,
  wasRegular,
  now = new Date(),
  threshold = THRESHOLD,
  decayD = DECAY_D,
}) {
  if (Number(windowCount) >= Number(threshold)) return true;
  if (!wasRegular || !lastCheckinAt) return false;
  const last = new Date(lastCheckinAt);
  if (!Number.isFinite(last.getTime())) return false;
  const decayMs = Number(decayD) * 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() <= decayMs;
}

/** Master Parametre §10 — “2/3” geri sayım etiketi */
export function formatRegularCounter(count, threshold = THRESHOLD) {
  const c = Math.max(0, Number(count) || 0);
  const t = Math.max(1, Number(threshold) || THRESHOLD);
  return `${Math.min(c, t)}/${t}`;
}

export async function getRegularProgress(userId, venueId) {
  if (!userId || !venueId) {
    return {
      count: 0,
      needed: THRESHOLD,
      is_regular: false,
      threshold: THRESHOLD,
      window_d: WINDOW_D,
      decay_d: DECAY_D,
      counter: COUNTER_UI ? formatRegularCounter(0, THRESHOLD) : null,
      counter_ui: COUNTER_UI,
    };
  }

  const prev = await pool.query(
    `SELECT is_regular FROM venue_regulars WHERE user_id = $1 AND venue_id = $2 LIMIT 1`,
    [userId, venueId]
  );
  const wasRegular = Boolean(prev.rows[0]?.is_regular);

  const stats = await pool.query(
    `SELECT
       COUNT(DISTINCT ra.ritual_id) FILTER (
         WHERE ra.checkin_at >= NOW() - ($3 || ' days')::interval
       )::int AS window_count,
       MAX(ra.checkin_at) AS last_checkin_at
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.user_id = $1 AND r.venue_id = $2 AND ra.checkin_at IS NOT NULL
       AND ra.status::text NOT IN ('no_show', 'cancelled')
       AND COALESCE(r.under_min, false) = false`,
    [userId, venueId, WINDOW_D]
  );

  const windowCount = Number(stats.rows[0]?.window_count) || 0;
  const lastCheckinAt = stats.rows[0]?.last_checkin_at || null;
  const isRegular = computeIsRegular({
    windowCount,
    lastCheckinAt,
    wasRegular,
  });

  const result = await pool.query(
    `INSERT INTO venue_regulars (user_id, venue_id, checkin_count, last_checkin_at, is_regular, regular_since, updated_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (user_id, venue_id) DO UPDATE SET
       checkin_count = EXCLUDED.checkin_count,
       last_checkin_at = EXCLUDED.last_checkin_at,
       is_regular = EXCLUDED.is_regular,
       regular_since = CASE
         WHEN EXCLUDED.is_regular THEN COALESCE(venue_regulars.regular_since, EXCLUDED.regular_since)
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING checkin_count, is_regular, regular_since, last_checkin_at`,
    [userId, venueId, windowCount, lastCheckinAt, isRegular]
  );

  const row = result.rows[0] || { checkin_count: windowCount, is_regular: isRegular };
  const count = Number(row.checkin_count) || 0;
  return {
    count,
    needed: Math.max(0, THRESHOLD - count),
    is_regular: Boolean(row.is_regular),
    threshold: THRESHOLD,
    window_d: WINDOW_D,
    decay_d: DECAY_D,
    regular_since: row.regular_since || null,
    last_checkin_at: row.last_checkin_at || null,
    newly_gained: !wasRegular && isRegular,
    newly_lost: wasRegular && !isRegular,
    counter: COUNTER_UI ? formatRegularCounter(count, THRESHOLD) : null,
    counter_ui: COUNTER_UI,
  };
}

export async function getRegularStatus(userId, { viewerUserId, venueId } = {}) {
  if (!venueId) {
    const list = await listMyRegulars(userId);
    const active = list.filter((x) => x.is_regular);
    return {
      count: active.length,
      needed: 0,
      is_regular: active.length > 0,
      threshold: THRESHOLD,
      venues: list,
      pair_count: active.length,
      label: active.length ? LOCAL_CONFIG.regular.PRIVATE_LABEL : null,
      parked: Boolean(LOCAL_CONFIG.regular.PARKED),
      visible: String(viewerUserId) === String(userId),
      note: 'Private venue-based status; never expose on public profiles.',
    };
  }
  const progress = await getRegularProgress(userId, venueId);
  return {
    ...progress,
    label: progress.is_regular ? LOCAL_CONFIG.regular.PRIVATE_LABEL : null,
    parked: Boolean(LOCAL_CONFIG.regular.PARKED),
    visible: String(viewerUserId) === String(userId),
    note: 'Private venue-based status; never expose on public profiles.',
  };
}

export async function listMyRegulars(userId) {
  if (!userId) return [];
  // Soft decay: recompute rows that claim regular or have recent checkins
  const rows = await pool.query(
    `SELECT vr.venue_id, vr.is_regular, vr.checkin_count, vr.regular_since, vr.last_checkin_at,
            v.name AS venue_name, v.city AS venue_city
     FROM venue_regulars vr
     JOIN venues v ON v.id = vr.venue_id
     WHERE vr.user_id = $1
     ORDER BY vr.is_regular DESC, vr.checkin_count DESC, v.name ASC`,
    [userId]
  );
  const out = [];
  for (const row of rows.rows) {
    const progress = await getRegularProgress(userId, row.venue_id);
    out.push({
      venue_id: row.venue_id,
      venue_name: row.venue_name,
      venue_city: row.venue_city,
      ...progress,
      label: progress.is_regular ? LOCAL_CONFIG.regular.PRIVATE_LABEL : null,
    });
  }
  return out;
}

export async function listVenueRegulars(venueId) {
  if (!venueId) return [];
  const rows = await pool.query(
    `SELECT vr.user_id, vr.is_regular, vr.checkin_count, vr.regular_since, vr.last_checkin_at,
            u.name AS user_name
     FROM venue_regulars vr
     JOIN users u ON u.id = vr.user_id
     WHERE vr.venue_id = $1 AND vr.is_regular = true
     ORDER BY vr.regular_since ASC NULLS LAST, u.name ASC`,
    [venueId]
  );
  return rows.rows.map((r) => ({
    user_id: r.user_id,
    user_name: r.user_name,
    is_regular: true,
    checkin_count: Number(r.checkin_count) || 0,
    regular_since: r.regular_since,
    last_checkin_at: r.last_checkin_at,
  }));
}

export async function isVenueRegular(userId, venueId) {
  if (!userId || !venueId) return false;
  const progress = await getRegularProgress(userId, venueId);
  return Boolean(progress.is_regular);
}

/** Check-in sonrası: kazanım bildirimi; sönüm sessiz (SILENT_DECAY) */
export async function afterVenueCheckin({ userId, venueId }) {
  if (!userId || !venueId || LOCAL_CONFIG.regular?.PARKED) {
    return { skipped: true };
  }
  const progress = await getRegularProgress(userId, venueId);
  // Master Parametre §10 — sönüm (newly_lost) bildirimsiz; yalnız newly_gained push
  if (progress.newly_gained) {
    try {
      const { notifyRegularGainedVenue } = await import('./notifications.js');
      const managers = await pool.query(
        `SELECT DISTINCT user_id FROM venue_managers WHERE venue_id = $1
         UNION
         SELECT owner_user_id AS user_id FROM venues WHERE id = $1 AND owner_user_id IS NOT NULL`,
        [venueId]
      );
      for (const m of managers.rows) {
        if (!m.user_id || String(m.user_id) === String(userId)) continue;
        await notifyRegularGainedVenue(m.user_id, { venueId, userId }).catch(() => {});
      }
    } catch (_e) {
      /* best effort */
    }
  }
  return progress;
}

export default {
  getRegularProgress,
  getRegularStatus,
  listMyRegulars,
  listVenueRegulars,
  isVenueRegular,
  afterVenueCheckin,
  formatRegularCounter,
  computeIsRegular,
};
