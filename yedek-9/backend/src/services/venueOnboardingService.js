/**
 * Venue onboarding — floor_plan + gps_verified — LOCAL v2 §8
 * Zone name+capacity required; table grid OPTIONAL
 */
import pool from '../config/database.js';
import { updateOnboardingStep, maybeMarkVenueLive } from './venueApplicationService.js';

async function isVenueManager(userId, venueId, email = '') {
  if (!userId) return false;
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (adminIds.includes(String(userId))) return true;
  if (email && adminEmails.includes(String(email).toLowerCase())) return true;
  const r = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  return r.rows.length > 0;
}

export function normalizeFloorPlan(raw = {}) {
  const v = raw && typeof raw === 'object' ? raw : {};
  const zones = Array.isArray(v.zones)
    ? v.zones
        .map((z, idx) => ({
          id: String(z.id || `zone-${idx + 1}`),
          name: String(z.name || z.label || `Zon ${idx + 1}`).slice(0, 80),
          capacity: Math.max(1, Number(z.capacity || z.seats) || 10),
        }))
        .filter((z) => z.name)
        .slice(0, 30)
    : [];
  const tables = Array.isArray(v.tables)
    ? v.tables
        .map((t, idx) => ({
          id: String(t.id || `table-${idx + 1}`),
          label: String(t.label || `Masa ${idx + 1}`).slice(0, 40),
          seats: Math.max(1, Number(t.seats) || 4),
          zone: t.zone ? String(t.zone).slice(0, 40) : null,
        }))
        .slice(0, 50)
    : [];
  return {
    version: 2,
    zones,
    tables,
    notes: v.notes ? String(v.notes).slice(0, 500) : null,
    grid_optional: true,
  };
}

export async function getVenueFloorPlan(venueId, viewerUserId, viewerEmail = '') {
  const r = await pool.query(
    `SELECT id, floor_plan, gps_verified_at, dense_canyon, gps_radius_m FROM venues WHERE id = $1`,
    [venueId]
  );
  if (r.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const canManage = await isVenueManager(viewerUserId, venueId, viewerEmail);
  return {
    ok: true,
    floor_plan: normalizeFloorPlan(r.rows[0].floor_plan),
    gps_verified_at: r.rows[0].gps_verified_at,
    dense_canyon: Boolean(r.rows[0].dense_canyon),
    gps_radius_m: r.rows[0].gps_radius_m != null ? Number(r.rows[0].gps_radius_m) : null,
    can_manage: canManage,
  };
}

export async function updateVenueFloorPlan(venueId, userId, payload, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const plan = normalizeFloorPlan(payload?.floor_plan || payload);
  // §8: zon adı + kapasite zorunlu; masa-grid opsiyonel
  if (plan.zones.length === 0 && plan.tables.length === 0) {
    return { ok: false, status: 400, error: 'En az bir zon (ad + kapasite) gerekli; masa-grid opsiyonel' };
  }
  if (plan.zones.length === 0 && plan.tables.length > 0) {
    // Legacy: derive a single zone from tables so slot location works at zone level
    plan.zones = [
      {
        id: 'zone-main',
        name: 'Ana alan',
        capacity: plan.tables.reduce((s, t) => s + Number(t.seats || 0), 0) || 10,
      },
    ];
  }
  const r = await pool.query(
    `UPDATE venues SET floor_plan = $2::jsonb WHERE id = $1 RETURNING floor_plan`,
    [venueId, JSON.stringify(plan)]
  );
  await updateOnboardingStep(userId, venueId, 'floor_plan').catch(() => {});
  return { ok: true, floor_plan: normalizeFloorPlan(r.rows[0].floor_plan) };
}

export async function verifyVenueGps(venueId, userId, { lat, lng } = {}, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const venueR = await pool.query(
    `SELECT location_lat, location_lng FROM venues WHERE id = $1`,
    [venueId]
  );
  if (venueR.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const vLat = Number(venueR.rows[0].location_lat);
  const vLng = Number(venueR.rows[0].location_lng);
  const cLat = Number(lat);
  const cLng = Number(lng);
  if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) {
    return { ok: false, status: 400, error: 'Venue coordinates not set' };
  }
  if (!Number.isFinite(cLat) || !Number.isFinite(cLng)) {
    return { ok: false, status: 400, error: 'lat and lng required' };
  }
  const distM = haversineM(vLat, vLng, cLat, cLng);
  const maxM = Number(process.env.VENUE_GPS_VERIFY_RADIUS_M || 100);
  if (distM > maxM) {
    return { ok: false, status: 400, error: `GPS mismatch (${Math.round(distM)}m > ${maxM}m)` };
  }
  const r = await pool.query(
    `UPDATE venues SET gps_verified_at = NOW() WHERE id = $1 RETURNING gps_verified_at`,
    [venueId]
  );
  await updateOnboardingStep(userId, venueId, 'gps_verified').catch(() => {});
  await maybeMarkVenueLive(userId, venueId).catch(() => {});
  return { ok: true, gps_verified_at: r.rows[0].gps_verified_at, distance_m: Math.round(distM) };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
