/**
 * son-part.md §2.1 — ritual create validation
 */
import LOCAL_CONFIG, { defaultLiveWindowHours } from '../config/localConfig.js';
import pool from '../config/database.js';

/** §2C — PUBLIC|FRIENDS discovery audience (not visibility) */
export function normalizeRitualAudience(raw) {
  const allowed = LOCAL_CONFIG.ritual.AUDIENCE_VALUES || ['PUBLIC', 'FRIENDS'];
  const def = LOCAL_CONFIG.ritual.AUDIENCE_DEFAULT || 'PUBLIC';
  if (raw == null || raw === '') {
    return { ok: true, audience: def };
  }
  const v = String(raw).trim().toUpperCase();
  if (!allowed.includes(v)) {
    return { ok: false, error: `audience must be one of: ${allowed.join(', ')}` };
  }
  return { ok: true, audience: v };
}

/**
 * §2C — rituals.fee{amount, currency, note} from body.fee or fee_* fields.
 * Null/omitted → no fee (nullable).
 */
export function parseRitualFee(body = {}) {
  const feeObj = body.fee && typeof body.fee === 'object' ? body.fee : null;
  const rawAmount = feeObj?.amount ?? body.fee_amount;
  const rawCurrency = feeObj?.currency ?? body.fee_currency;
  const rawNote = feeObj?.note ?? body.fee_note;

  if (rawAmount == null || rawAmount === '') {
    return { ok: true, fee: null };
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'fee_amount must be a non-negative number' };
  }

  const currencyDefault = LOCAL_CONFIG.ritual.FEE_CURRENCY_DEFAULT || 'TRY';
  const noteDefault = LOCAL_CONFIG.ritual.FEE_NOTE_DEFAULT || 'yerinde ödenir';
  const currency = String(rawCurrency || currencyDefault)
    .trim()
    .toUpperCase()
    .slice(0, 8) || currencyDefault;
  const note =
    rawNote != null && String(rawNote).trim()
      ? String(rawNote).trim().slice(0, 160)
      : noteDefault;

  return {
    ok: true,
    fee: {
      amount: Math.round(amount * 100) / 100,
      currency,
      note,
    },
  };
}

/** Serialize fee for card/detail DTOs */
export function feeDtoFromRow(row) {
  if (row == null || row.fee_amount == null) return null;
  const amount = Number(row.fee_amount);
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    currency: row.fee_currency || LOCAL_CONFIG.ritual.FEE_CURRENCY_DEFAULT || 'TRY',
    note: row.fee_note || LOCAL_CONFIG.ritual.FEE_NOTE_DEFAULT || 'yerinde ödenir',
  };
}

/**
 * Yıldız A6 — start ufku.
 * Instant → INSTANT_MAX_LEAD (ayrı).
 * VEN_EVENT / event_group / brand-event → EVENT_MAX_AHEAD_D.
 * Diğer planned → PLANNED_MAX_AHEAD_D.
 */
export function assertStartHorizon({
  startDate,
  timeType = null,
  origin = null,
  eventGroupId = null,
  brandId = null,
  now = new Date(),
} = {}) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    return { ok: false, error: 'Invalid start_time', code: 'INVALID_START' };
  }

  const tt = String(timeType || '').toLowerCase();
  if (tt === 'instant') {
    return { ok: true, horizon: 'instant', max_ahead_d: null };
  }

  const isEvent =
    String(origin || '').toUpperCase() === 'VEN_EVENT' ||
    Boolean(eventGroupId) ||
    Boolean(brandId);

  const maxDays = isEvent
    ? Number(LOCAL_CONFIG.ritual.EVENT_MAX_AHEAD_D ?? 60)
    : Number(LOCAL_CONFIG.ritual.PLANNED_MAX_AHEAD_D ?? 21);

  const leadMs = startDate.getTime() - now.getTime();
  const maxMs = maxDays * 24 * 3600 * 1000;
  if (leadMs > maxMs) {
    return {
      ok: false,
      error: isEvent
        ? `Event rituals must start within ${maxDays} days of create`
        : `Planned rituals must start within ${maxDays} days of create`,
      code: isEvent ? 'EVENT_MAX_AHEAD' : 'PLANNED_MAX_AHEAD',
      max_ahead_d: maxDays,
      horizon: isEvent ? 'event' : 'planned',
    };
  }

  return {
    ok: true,
    horizon: isEvent ? 'event' : 'planned',
    max_ahead_d: maxDays,
  };
}

/**
 * Self-rez 1/gün/mekan ⭐ — host × venue × gün.
 */
export async function assertSelfRezDailyCap(userId, venueId, { now = new Date(), client = pool } = {}) {
  if (!userId || !venueId) return { ok: true, skipped: true };

  const cap = Number(LOCAL_CONFIG.ritual.SELF_REZ_PER_DAY_PER_VENUE ?? 1);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { ok: true, unlimited: true };
  }

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const r = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM rituals
     WHERE host_id = $1
       AND venue_id = $2
       AND self_rez_mode IS NOT NULL
       AND created_at >= $3
       AND created_at < $4
       AND status::text NOT IN ('cancelled', 'draft')`,
    [userId, venueId, dayStart.toISOString(), dayEnd.toISOString()]
  );
  const used = Number(r.rows[0]?.n || 0);
  if (used >= cap) {
    return {
      ok: false,
      error: `Self-rez daily limit (${cap}/gün/mekan) doldu`,
      code: 'SELF_REZ_DAILY_CAP',
      used,
      cap,
    };
  }
  return { ok: true, used, cap, remaining: cap - used };
}

export function validateRitualCreateParams({
  duration,
  capacity,
  live_window_hours,
  venueMaxSeats = null,
}) {
  const durMin = Number(duration);
  if (
    !Number.isFinite(durMin) ||
    durMin < LOCAL_CONFIG.ritual.DURATION_MIN_MINUTES ||
    durMin > LOCAL_CONFIG.ritual.DURATION_MAX_MINUTES
  ) {
    return {
      ok: false,
      error: `Duration must be between ${LOCAL_CONFIG.ritual.DURATION_MIN_MINUTES} minutes and 24 hours`,
    };
  }

  const cap = Number(capacity);
  if (!Number.isFinite(cap) || cap < LOCAL_CONFIG.ritual.MIN_SIZE) {
    return {
      ok: false,
      error: `Capacity must be at least ${LOCAL_CONFIG.ritual.MIN_SIZE}`,
    };
  }

  const lwh = live_window_hours != null ? Number(live_window_hours) : defaultLiveWindowHours();
  const allowedWindows = LOCAL_CONFIG.ritual.WINDOW_HOURS_OPTIONS || [3, 6, 12, 24];
  if (!Number.isFinite(lwh) || !allowedWindows.includes(lwh)) {
    return {
      ok: false,
      error: `live_window_hours must be one of: ${allowedWindows.join(', ')}`,
    };
  }

  const windowMinutes = lwh * 60;
  if (windowMinutes < durMin) {
    return {
      ok: false,
      error: 'Window duration must be >= ritual duration (window_h >= duration)',
    };
  }

  if (venueMaxSeats != null && venueMaxSeats > 0 && cap > venueMaxSeats) {
    return {
      ok: false,
      error: `Capacity cannot exceed venue table seats (${venueMaxSeats})`,
    };
  }

  return { ok: true, data: { durMin: Math.round(durMin), cap: Math.round(cap), lwh } };
}

export function getVenueMaxTableSeats(floorPlan) {
  const plan = floorPlan && typeof floorPlan === 'object' ? floorPlan : {};
  const zones = Array.isArray(plan.zones) ? plan.zones : [];
  if (zones.length > 0) {
    return zones.reduce((sum, z) => sum + Math.max(0, Number(z.capacity || z.seats) || 0), 0);
  }
  const tables = Array.isArray(plan.tables) ? plan.tables : [];
  return tables.reduce((sum, t) => sum + Math.max(0, Number(t.seats) || 0), 0);
}

/** son-part.md §3 — GPS radius bounds per location type */
export function validateCheckInRadius(locationType, radiusMeters) {
  if (radiusMeters == null) return { ok: true };
  const r = Number(radiusMeters);
  if (!Number.isFinite(r) || r <= 0) {
    return { ok: false, error: 'Invalid check_in_radius' };
  }
  const type = String(locationType || 'custom').toLowerCase();
  const gps = LOCAL_CONFIG.checkin.GPS_RADIUS_METERS;
  const scheduledR = gps.scheduled ?? gps.ferry ?? gps.venue;
  const bounds = {
    custom: { min: gps.custom, max: gps.custom },
    home: { min: gps.custom, max: gps.custom },
    venue: { min: gps.venue, max: gps.venue },
    zone: { min: gps.zone, max: gps.zone_max ?? 100 },
    moving: { min: gps.moving, max: gps.moving },
    scheduled: { min: scheduledR, max: scheduledR },
    ferry: { min: scheduledR, max: scheduledR },
    tarifeli: { min: scheduledR, max: scheduledR },
    vapur: { min: scheduledR, max: scheduledR },
  };
  const b = bounds[type] || bounds.custom;
  if (r < b.min || r > b.max) {
    return {
      ok: false,
      error: `check_in_radius for ${type} must be between ${b.min}m and ${b.max}m`,
    };
  }
  return { ok: true };
}

/** sonMD §4 TARİFELİ/VAPUR — rota = tek sefer */
export function isScheduledLocationType(locationType) {
  const k = String(locationType || '').toLowerCase();
  return k === 'scheduled' || k === 'ferry' || k === 'tarifeli' || k === 'vapur';
}

export function normalizeRouteId(raw, locationName = null) {
  const s = String(raw || locationName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .slice(0, 80);
  return s || null;
}

export function assertScheduledOneShot({ locationType, isRecurring, timeType, seriesId } = {}) {
  if (!isScheduledLocationType(locationType)) return { ok: true };
  const tt = String(timeType || '').toLowerCase();
  if (
    isRecurring === true ||
    isRecurring === 'true' ||
    seriesId ||
    tt === 'recurring' ||
    tt === 'series'
  ) {
    return {
      ok: false,
      error: 'Tarifeli/vapur rotası tek seferdir (seri yok)',
      code: 'ROUTE_ONE_SHOT',
    };
  }
  return { ok: true };
}

export function shouldCollapseHomeEmptyDoor({ isHome, sealedCount } = {}) {
  return Boolean(isHome) && Number(sealedCount || 0) === 0;
}

/**
 * v2 §2 GPS ÇAPA — radius merkezi kaynak tipe göre sabitlenir.
 * Custom = host pini · Venue = doğrulanmış mekan pini · Zone = marker/centroid · Moving = start point (+15m radius)
 */
export async function resolveRitualGpsAnchor(poolArg, {
  locationType,
  venueId = null,
  zoneId = null,
  locationLat = null,
  locationLng = null,
}) {
  const db = poolArg || pool;
  const type = String(locationType || 'custom').toLowerCase();

  if (type === 'venue') {
    if (!venueId) {
      return { ok: false, error: 'venue location_type requires venue_id' };
    }
    const v = await db.query(
      `SELECT location_lat, location_lng, is_verified, name
       FROM venues WHERE id = $1 LIMIT 1`,
      [venueId]
    );
    const venue = v.rows[0];
    if (!venue) {
      return { ok: false, error: 'Venue not found for GPS anchor' };
    }
    if (!venue.is_verified) {
      return { ok: false, error: 'Venue pin must be verified before use as GPS anchor' };
    }
    const lat = Number(venue.location_lat);
    const lng = Number(venue.location_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: 'Verified venue is missing GPS coordinates' };
    }
    return {
      ok: true,
      location_lat: lat,
      location_lng: lng,
      location_type: 'venue',
      anchor_source: 'venue_verified_pin',
      host_can_move: false,
    };
  }

  if (type === 'zone') {
    if (zoneId) {
      const z = await db.query(
        `SELECT geo_lat, geo_lng, name FROM zones WHERE id = $1 LIMIT 1`,
        [zoneId]
      );
      if (z.rows[0]) {
        const lat = Number(z.rows[0].geo_lat);
        const lng = Number(z.rows[0].geo_lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            ok: true,
            location_lat: lat,
            location_lng: lng,
            location_type: 'zone',
            zone_id: zoneId,
            anchor_source: 'zone_marker_centroid',
            host_can_move: false,
          };
        }
      }
    }
    const lat = Number(locationLat);
    const lng = Number(locationLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: 'Zone rituals require marker/centroid coordinates' };
    }
    return {
      ok: true,
      location_lat: lat,
      location_lng: lng,
      location_type: 'zone',
      zone_id: zoneId || null,
      anchor_source: 'zone_marker',
      host_can_move: false,
    };
  }

  const lat = Number(locationLat);
  const lng = Number(locationLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'location_lat and location_lng are required' };
  }

  if (type === 'moving') {
    return {
      ok: true,
      location_lat: lat,
      location_lng: lng,
      location_type: 'moving',
      anchor_source: 'moving_start_point',
      host_can_move: false,
      note: 'radius walks 15m around start point',
    };
  }

  return {
    ok: true,
    location_lat: lat,
    location_lng: lng,
    location_type: 'custom',
    anchor_source: 'host_pin',
    host_can_move: true,
  };
}
