/**
 * Venue panel roles — owner / manager / staff (+ admin override)
 * Source: mekan kayıt IA — staff = vardiya, manager = işletme, owner = hukuk/fatura
 */
import pool from '../config/database.js';
import { isVenuePlatformOverride } from './productOpsRoles.js';

export const VENUE_ROLES = ['staff', 'manager', 'owner'];
export const ROLE_RANK = { staff: 1, manager: 2, owner: 3, admin: 99 };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DEFAULT_WEEKLY_HOURS = {
  mon: { open: '09:00', close: '23:00', closed: false },
  tue: { open: '09:00', close: '23:00', closed: false },
  wed: { open: '09:00', close: '23:00', closed: false },
  thu: { open: '09:00', close: '23:00', closed: false },
  fri: { open: '09:00', close: '00:00', closed: false },
  sat: { open: '10:00', close: '00:00', closed: false },
  sun: { open: '10:00', close: '22:00', closed: false },
};

function isAdminUser(userId, email = '') {
  return isVenuePlatformOverride(userId, email);
}

export function permissionsFor(role) {
  const rank = ROLE_RANK[role] || 0;
  return {
    role: role || null,
    shift: rank >= 1,
    report_read: rank >= 1,
    night_archive: rank >= 2,
    totem: rank >= 1,
    gps: rank >= 1,
    slots: rank >= 2,
    profile: rank >= 2,
    hours: rank >= 2,
    regulars: rank >= 2,
    badges: rank >= 2,
    events: rank >= 2,
    reputation: rank >= 2,
    invite_staff: rank >= 2,
    invite_manager: rank >= 3,
    business: rank >= 3,
    transfer_owner: rank >= 3,
  };
}

export function normalizeWeeklyHours(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const day of DAYS) {
    const row = src[day] && typeof src[day] === 'object' ? src[day] : DEFAULT_WEEKLY_HOURS[day];
    const closed = Boolean(row.closed);
    const open = String(row.open || DEFAULT_WEEKLY_HOURS[day].open).slice(0, 5);
    const close = String(row.close || DEFAULT_WEEKLY_HOURS[day].close).slice(0, 5);
    const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t) || t === '24:00' || t === '00:00';
    out[day] = {
      closed,
      open: timeOk(open) ? open : DEFAULT_WEEKLY_HOURS[day].open,
      close: timeOk(close) ? close : DEFAULT_WEEKLY_HOURS[day].close,
    };
  }
  return out;
}

/** Night report uses a single closing_time — pick today's close, else weekday close. */
export function closingTimeFromWeeklyHours(hours, now = new Date()) {
  const normalized = normalizeWeeklyHours(hours);
  const jsDay = now.getDay();
  const day = DAYS[(jsDay + 6) % 7];
  const today = normalized[day];
  if (today && !today.closed && today.close) return today.close;
  const weekday = normalized.mon?.close || normalized.fri?.close;
  return weekday || null;
}

export async function getVenueAccess(userId, venueId, email = '') {
  if (!userId || !venueId) {
    return { ok: false, status: 401, error: 'Authentication required', role: null, permissions: permissionsFor(null) };
  }
  if (isAdminUser(userId, email)) {
    return { ok: true, role: 'admin', permissions: permissionsFor('admin') };
  }
  const r = await pool.query(
    `SELECT role FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  if (r.rows.length === 0) {
    return { ok: false, status: 403, error: 'Not a venue manager', role: null, permissions: permissionsFor(null) };
  }
  const role = r.rows[0].role;
  return { ok: true, role, permissions: permissionsFor(role) };
}

export async function hasMinRole(userId, venueId, minRole = 'staff', email = '') {
  const access = await getVenueAccess(userId, venueId, email);
  if (!access.ok) return false;
  return (ROLE_RANK[access.role] || 0) >= (ROLE_RANK[minRole] || 1);
}

export async function assertVenuePermission(userId, venueId, permission, email = '') {
  const access = await getVenueAccess(userId, venueId, email);
  if (!access.ok) return access;
  if (!access.permissions[permission]) {
    return { ok: false, status: 403, error: `Requires ${permission}`, role: access.role, permissions: access.permissions };
  }
  return access;
}
