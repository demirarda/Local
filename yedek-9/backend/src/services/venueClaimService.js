/**
 * sonMD §2D venue_claim — custom ritual claimed from venue panel → venue channel.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { logAdminAction } from '../utils/auditLog.js';

const CLAIM_RADIUS_M = Number(LOCAL_CONFIG.venue?.CLAIM_RADIUS_M || 120);

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function listClaimableCustomRituals(venueId, { limit = 20 } = {}) {
  const v = await pool.query(
    `SELECT id, location_lat, location_lng FROM venues WHERE id = $1`,
    [venueId]
  );
  if (!v.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };
  const venue = v.rows[0];
  const lat = Number(venue.location_lat);
  const lng = Number(venue.location_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: true, data: [], radius_m: CLAIM_RADIUS_M };
  }

  const rows = await pool.query(
    `SELECT r.id, r.title, r.host_id, r.status, r.start_time, r.location_type,
            r.location_lat, r.location_lng, r.origin, r.created_at
     FROM rituals r
     WHERE r.venue_id IS NULL
       AND LOWER(COALESCE(r.location_type::text, 'custom')) IN ('custom', 'free')
       AND r.status::text NOT IN ('cancelled', 'archived')
       AND r.claimed_at IS NULL
       AND r.start_time > NOW() - INTERVAL '6 hours'
       AND r.start_time < NOW() + INTERVAL '48 hours'
       AND r.location_lat IS NOT NULL
       AND r.location_lng IS NOT NULL
     ORDER BY r.start_time ASC
     LIMIT $1`,
    [Math.min(Number(limit) || 20, 50)]
  );

  const data = rows.rows
    .map((row) => {
      const dist = haversineM(lat, lng, row.location_lat, row.location_lng);
      return { ...row, distance_m: Math.round(dist) };
    })
    .filter((row) => row.distance_m <= CLAIM_RADIUS_M)
    .sort((a, b) => a.distance_m - b.distance_m);

  return { ok: true, data, radius_m: CLAIM_RADIUS_M };
}

export async function claimCustomRitualAsVenue({ venueId, ritualId, managerId }) {
  const mgr = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, managerId]
  );
  if (mgr.rows.length === 0) {
    return { ok: false, status: 403, error: 'Venue staff only', code: 'VENUE_STAFF_ONLY' };
  }

  const v = await pool.query(
    `SELECT id, location_lat, location_lng FROM venues WHERE id = $1`,
    [venueId]
  );
  if (!v.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };

  const r = await pool.query(
    `SELECT id, title, host_id, status, venue_id, location_type, location_lat, location_lng,
            claimed_at, claimed_by_venue_id, origin
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  const ritual = r.rows[0];

  if (ritual.venue_id || ritual.claimed_at) {
    return { ok: false, status: 409, error: 'Already venue-channel', code: 'ALREADY_CLAIMED' };
  }
  const loc = String(ritual.location_type || '').toLowerCase();
  if (loc && loc !== 'custom' && loc !== 'free') {
    return { ok: false, status: 400, error: 'Only custom rituals', code: 'NOT_CUSTOM' };
  }

  const dist = haversineM(
    v.rows[0].location_lat,
    v.rows[0].location_lng,
    ritual.location_lat,
    ritual.location_lng
  );
  if (!Number.isFinite(dist) || dist > CLAIM_RADIUS_M) {
    return { ok: false, status: 400, error: 'Outside claim radius', code: 'OUT_OF_RADIUS', detail: { dist_m: dist, radius_m: CLAIM_RADIUS_M } };
  }

  const upd = await pool.query(
    `UPDATE rituals
     SET venue_id = $1,
         location_type = 'venue',
         claimed_at = NOW(),
         claimed_by_venue_id = $1,
         updated_at = NOW()
     WHERE id = $2
       AND venue_id IS NULL
       AND claimed_at IS NULL
     RETURNING id, venue_id, location_type, claimed_at, claimed_by_venue_id, host_id, title, origin`,
    [venueId, ritualId]
  );
  if (!upd.rows[0]) {
    return { ok: false, status: 409, error: 'Claim race lost', code: 'CLAIM_RACE' };
  }

  await logAdminAction(pool, {
    adminUserId: managerId,
    action: 'venue_claim',
    targetType: 'ritual',
    targetId: ritualId,
    details: { venue_id: venueId, distance_m: Math.round(dist) },
  });

  return { ok: true, ritual: upd.rows[0], distance_m: Math.round(dist) };
}
