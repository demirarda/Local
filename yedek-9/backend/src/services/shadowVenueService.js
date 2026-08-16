/**
 * Golge-venue — LOCAL v2 §8
 * Historical data is read-only: never rebinds rituals, memories, or scores.
 * Sales pitch: internal region count + optional nearby badge.
 */
import pool from '../config/database.js';

export async function linkShadowVenueHistory(venueId, { force = false } = {}) {
  const venueR = await pool.query(
    `SELECT id, name, city, created_at, shadow_link_completed_at, location_lat, location_lng
     FROM venues WHERE id = $1`,
    [venueId]
  );
  if (venueR.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const venue = venueR.rows[0];
  if (venue.shadow_link_completed_at && !force) {
    const pitch = await buildShadowPitch(venue);
    return { ok: true, skipped: true, linked_count: 0, linked_ritual_count: 0, ...pitch };
  }

  const pitch = await buildShadowPitch(venue);
  await pool.query(`UPDATE venues SET shadow_link_completed_at = NOW() WHERE id = $1`, [venueId]);

  return {
    ok: true,
    venue_id: venueId,
    linked_ritual_count: 0,
    trust_aura_from_history: false,
    score_start_at: venue.created_at,
    ...pitch,
  };
}

/** Satış ekranı: bölge verisi içsel + civarda N Ritual rozeti */
export async function getShadowSalesPitch(venueId) {
  const venueR = await pool.query(
    `SELECT id, name, city, created_at, location_lat, location_lng FROM venues WHERE id = $1`,
    [venueId]
  );
  if (!venueR.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };
  const pitch = await buildShadowPitch(venueR.rows[0]);
  return {
    ok: true,
    venue_id: venueId,
    sales_copy: pitch.internal_region_count
      ? `Kayıt öncesi bölgede ~${pitch.internal_region_count} Ritual yaşandı (içsel)`
      : 'Bölge verisi henüz yok',
    badge_copy:
      pitch.badge.nearby_ritual_count > 0
        ? `Civarda ${pitch.badge.nearby_ritual_count} Ritual yaşandı`
        : null,
    ...pitch,
  };
}

async function buildShadowPitch(venue) {
  const registeredAt = venue.created_at;
  const region = await pool.query(
    `SELECT COUNT(*)::int AS count FROM rituals r
     LEFT JOIN users hu ON hu.id = r.host_id
     WHERE r.created_at < $1 AND r.venue_id IS NULL
       AND (LOWER(COALESCE(hu.city, '')) = LOWER($2) OR LOWER(COALESCE(r.location_name, '')) LIKE '%' || LOWER($3) || '%')`,
    [registeredAt, venue.city || '', venue.name]
  );
  const nearby = await pool.query(
    `SELECT COUNT(*)::int AS count FROM rituals
     WHERE start_time >= NOW() - INTERVAL '30 days'
       AND venue_id IS NULL
       AND (
         LOWER(COALESCE(location_name, '')) LIKE '%' || LOWER($1) || '%'
         OR (
           $2::float IS NOT NULL AND location_lat IS NOT NULL
           AND ABS(location_lat - $2) < 0.05 AND ABS(location_lng - $3) < 0.05
         )
       )`,
    [venue.name, venue.location_lat, venue.location_lng]
  );
  return {
    internal_region_count: Number(region.rows[0]?.count || 0),
    badge: { nearby_ritual_count: Number(nearby.rows[0]?.count || 0) },
  };
}
