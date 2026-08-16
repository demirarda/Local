/**
 * §2C VENUE-LEAD RADARI — aynı custom-pin N tekrar → ops lead
 * Config: leads.REPEAT_PIN_N:3 ⭐
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

function leadsCfg() {
  return LOCAL_CONFIG.leads || {};
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Custom ritual create sonrası: yakın pin tekrarı ≥ N ise venue_leads upsert.
 * Fire-and-forget güvenli — create'i kırmaz.
 */
export async function maybeRecordRepeatPinLead({
  ritualId,
  lat,
  lng,
  hostId = null,
  city = null,
} = {}) {
  const n = Number(leadsCfg().REPEAT_PIN_N ?? 3);
  const radiusM = Number(leadsCfg().PIN_CLUSTER_RADIUS_M ?? 30);
  const windowD = Number(leadsCfg().WINDOW_D ?? 90);
  if (!Number.isFinite(n) || n <= 0) return { ok: true, skipped: true, reason: 'disabled' };

  const pinLat = Number(lat);
  const pinLng = Number(lng);
  if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
    return { ok: true, skipped: true, reason: 'no_coords' };
  }

  // Bounding box ≈ radius (degree approx) then haversine filter
  const deg = radiusM / 111320;
  const r = await pool.query(
    `SELECT id, location_lat, location_lng, host_id, created_at
     FROM rituals
     WHERE COALESCE(location_type::text, 'custom') = 'custom'
       AND venue_id IS NULL
       AND location_lat IS NOT NULL
       AND location_lng IS NOT NULL
       AND created_at >= NOW() - ($1::text || ' days')::interval
       AND status::text NOT IN ('cancelled', 'draft')
       AND location_lat BETWEEN $2 AND $3
       AND location_lng BETWEEN $4 AND $5`,
    [String(windowD), pinLat - deg, pinLat + deg, pinLng - deg, pinLng + deg]
  );

  const cluster = r.rows.filter((row) => {
    const d = haversineMeters(
      pinLat,
      pinLng,
      Number(row.location_lat),
      Number(row.location_lng)
    );
    return d <= radiusM;
  });

  const repeatCount = cluster.length;
  if (repeatCount < n) {
    return { ok: true, triggered: false, repeat_count: repeatCount, threshold: n };
  }

  const clusterKey = `${pinLat.toFixed(5)},${pinLng.toFixed(5)}`;
  const hostIds = [...new Set(cluster.map((c) => c.host_id).filter(Boolean))];
  const ritualIds = cluster.map((c) => c.id);

  const upsert = await pool.query(
    `INSERT INTO venue_leads (
       cluster_key, lat, lng, repeat_count, threshold_n, radius_m,
       window_d, ritual_ids, host_ids, city, last_ritual_id, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9::uuid[], $10, $11, 'open')
     ON CONFLICT (cluster_key) DO UPDATE SET
       repeat_count = EXCLUDED.repeat_count,
       ritual_ids = EXCLUDED.ritual_ids,
       host_ids = EXCLUDED.host_ids,
       last_ritual_id = EXCLUDED.last_ritual_id,
       city = COALESCE(EXCLUDED.city, venue_leads.city),
       updated_at = NOW(),
       status = CASE
         WHEN venue_leads.status = 'closed' THEN venue_leads.status
         ELSE 'open'
       END
     RETURNING *`,
    [
      clusterKey,
      pinLat,
      pinLng,
      repeatCount,
      n,
      radiusM,
      windowD,
      ritualIds,
      hostIds,
      city || null,
      ritualId || null,
    ]
  );

  return {
    ok: true,
    triggered: true,
    repeat_count: repeatCount,
    threshold: n,
    lead: upsert.rows[0] || null,
  };
}

export function getRepeatPinThreshold() {
  return Number(leadsCfg().REPEAT_PIN_N ?? 3);
}
