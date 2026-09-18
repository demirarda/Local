/**
 * MEGA kilitli ürün akışları — E6 · V13 · E1 · totem · Satışlarım · Badge Studio.
 * EK-26 supersede kazanır.
 */
import crypto from 'crypto';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { isPaidCommerceTier, canonicalPackageName } from './megaSpec.js';
import { resolveTierFromVenue } from './venuePackageService.js';

export const SALES_POCKET_BLOCKS = [
  'plans',
  'fulfillment',
  'buyer_chips',
  'customers',
  'approval_queue',
  'payout',
  'vitrine',
];

export function rezidanLabel({ venueId, boundHost, lang = 'tr' } = {}) {
  const bound = Boolean(boundHost) || Boolean(venueId);
  if (!bound) {
    return lang === 'en' ? 'HOST' : 'HOST';
  }
  return lang === 'en' ? 'RESIDENT' : 'REZİDAN';
}

export function formatRezidanKunya({ name, venueName, verified, lang = 'tr' } = {}) {
  const role = rezidanLabel({ venueId: venueName || true, boundHost: true, lang });
  const who = String(name || '').trim() || '—';
  const place = String(venueName || '').trim();
  const tick = verified ? ' ✓' : '';
  return place ? `${role}: ${who} · ${place}${tick}` : `${role}: ${who}${tick}`;
}

export function rotatingTotemCode(venueId, nowMs = Date.now(), { ttlS, secret } = {}) {
  const ttl = Number(ttlS ?? LOCAL_CONFIG.totem?.ROTATING_CODE_TTL_S ?? 30);
  const slot = Math.floor(Number(nowMs) / 1000 / Math.max(1, ttl));
  const key = secret || process.env.TOTEM_HMAC_SECRET || 'local-totem';
  const h = crypto.createHmac('sha256', key).update(`${venueId}:${slot}`).digest('hex');
  const n = parseInt(h.slice(0, 8), 16) % 1000000;
  return String(n).padStart(6, '0');
}

export function verifyRotatingTotemCode(venueId, code, nowMs = Date.now(), opts = {}) {
  const got = String(code || '').replace(/\D/g, '');
  if (!venueId || got.length < 4) return { ok: false, code: 'TOTEM_CODE_INVALID' };
  const ttl = Number(opts.ttlS ?? LOCAL_CONFIG.totem?.ROTATING_CODE_TTL_S ?? 30);
  const cur = rotatingTotemCode(venueId, nowMs, { ttlS: ttl, secret: opts.secret });
  const prev = rotatingTotemCode(venueId, nowMs - ttl * 1000, { ttlS: ttl, secret: opts.secret });
  if (got === cur || got === prev) return { ok: true };
  return { ok: false, code: 'TOTEM_CODE_INVALID' };
}

/** Venue kapısı: NFC ∨ dönen kod. Statik QR / kalıcı keyword kapı değil. Tablo açıldıktan sonra iç kod serbest. */
export function assertVenueTotemDoor({
  venueId,
  tableOpen = false,
  nfc = false,
  rotatingCode = '',
  nowMs = Date.now(),
  secret,
  ttlS,
} = {}) {
  if (!venueId) return { ok: true, reason: 'not_venue' };
  if (LOCAL_CONFIG.totem?.STATIC_QR_FORBIDDEN === false) return { ok: true };
  if (tableOpen) return { ok: true, reason: 'table_open' };
  if (nfc) return { ok: true, via: 'NFC' };
  const rot = verifyRotatingTotemCode(venueId, rotatingCode, nowMs, { secret, ttlS });
  if (rot.ok) return { ok: true, via: 'ROTATING_CODE' };
  return {
    ok: false,
    error: 'Mekandayken figürü okut veya dönen kod — statik QR kapı değil',
    code: 'TOTEM_REQUIRED',
  };
}

/** E1: çatı-mühür (kapı) şart; sub oturma = masa-NFC ∨ staff-tap. */
export function assertE1Seating({ origin, roofSealed, channel } = {}) {
  if (String(origin || '').toUpperCase() !== 'VEN_EVENT') return { ok: true };
  if (!roofSealed) {
    return {
      ok: false,
      error: 'Önce çatı mührü (kapı). Sub oturma sonra.',
      code: 'E1_ROOF_SEAL_REQUIRED',
    };
  }
  const ch = String(channel || 'staff_tap').toLowerCase();
  if (ch && !['table_nfc', 'staff_tap'].includes(ch)) {
    return {
      ok: false,
      error: 'Oturma izi: masa-NFC veya görevli-tap',
      code: 'E1_SEATING_CHANNEL',
    };
  }
  return { ok: true, channel: ch || 'staff_tap' };
}

export function assertBadgeStudioAllowed(venueTier) {
  if (!isPaidCommerceTier(venueTier)) {
    return {
      ok: false,
      error: 'FREE’de badge üretimi yok — OPERATOR+ gerekli',
      code: 'BADGE_STUDIO_OPERATOR',
    };
  }
  return { ok: true, package: canonicalPackageName(venueTier) };
}

export async function assertVenuePaidCommerce(venueId) {
  if (!venueId) return { ok: true, reason: 'custom_or_zone' };
  const v = await pool.query(
    `SELECT subscription_tier, pro_enabled, city_partner_enabled FROM venues WHERE id = $1`,
    [venueId]
  );
  const tier = resolveTierFromVenue(v.rows[0] || {});
  if (!isPaidCommerceTier(tier)) {
    return {
      ok: false,
      error: 'ücretli masa için mekanın ticaret-katmanı gerekli',
      code: 'PAID_R_REQUIRES_OPERATOR',
    };
  }
  return { ok: true, tier };
}

async function cloneRitualShell(sourceId, newHostId) {
  const src = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [sourceId]);
  const s = src.rows[0];
  if (!s) return { ok: false, error: 'Source ritual missing' };
  const sqlFull = `INSERT INTO rituals (
       title, type, location_name, venue_id, start_time, duration, end_time,
       capacity, entry_type, location_lat, location_lng, host_id, status,
       live_window_hours, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, is_recurring,
       definition_level, visibility, time_type, check_in_radius,
       university_gate, required_badge_slug, open_note, origin,
       self_rez_mode, zone_id, is_home, rebuilt_from_id, door
     )
     SELECT
       title, type, location_name, venue_id, start_time, duration, end_time,
       capacity, entry_type, location_lat, location_lng, $2, 'prelobby',
       live_window_hours, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, is_recurring,
       definition_level, visibility, time_type, check_in_radius,
       university_gate, required_badge_slug, open_note, origin,
       self_rez_mode, zone_id, is_home, id, door
     FROM rituals WHERE id = $1
     RETURNING *`;
  const sqlLite = `INSERT INTO rituals (
       title, type, location_name, venue_id, start_time, duration, end_time,
       capacity, entry_type, location_lat, location_lng, host_id, status,
       live_window_hours, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, is_recurring,
       definition_level, visibility, time_type, check_in_radius,
       university_gate, required_badge_slug, open_note, origin,
       self_rez_mode, zone_id, is_home
     )
     SELECT
       title, type, location_name, venue_id, start_time, duration, end_time,
       capacity, entry_type, location_lat, location_lng, $2, 'prelobby',
       live_window_hours, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, is_recurring,
       definition_level, visibility, time_type, check_in_radius,
       university_gate, required_badge_slug, open_note, origin,
       self_rez_mode, zone_id, is_home
     FROM rituals WHERE id = $1
     RETURNING *`;
  try {
    const ins = await pool.query(sqlFull, [sourceId, newHostId]);
    return { ok: true, ritual: ins.rows[0] };
  } catch (e) {
    if (String(e.code) !== '42703') throw e;
    const ins = await pool.query(sqlLite, [sourceId, newHostId]);
    return { ok: true, ritual: ins.rows[0] };
  }
}

async function inviteAttendees(sourceId, cloneId, exceptUserId) {
  await pool.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status)
     SELECT $2, user_id, 'going'
     FROM ritual_attendance
     WHERE ritual_id = $1
       AND status::text NOT IN ('no_show', 'cancelled')
       AND user_id IS DISTINCT FROM $3
     ON CONFLICT DO NOTHING`,
    [sourceId, cloneId, exceptUserId || null]
  );
}

/** E6: iptal-anı seçimi — bekleme yok. */
export async function cancelWithRebuild({
  ritualId,
  hostId,
  mode = 'open_claim',
  cancelFn,
} = {}) {
  const modeU = String(mode || 'open_claim');
  const cancelled = await cancelFn();
  if (!cancelled?.ok) return cancelled;

  if (modeU === 'cancel_only' || modeU === 'weather_cancel') {
    return cancelled;
  }

  if (modeU === 'rebuild_now') {
    const clone = await cloneRitualShell(ritualId, hostId);
    if (!clone.ok) return { ...cancelled, rebuild: clone };
    await inviteAttendees(ritualId, clone.ritual.id, hostId);
    await pool.query(
      `INSERT INTO ritual_rebuild_offers (source_ritual_id, clone_ritual_id, mode, created_by, claimed_by, claimed_at)
       VALUES ($1, $2, 'rebuild_now', $3, $3, NOW())`,
      [ritualId, clone.ritual.id, hostId]
    );
    return {
      ...cancelled,
      rebuild: { mode: 'rebuild_now', clone_id: clone.ritual.id },
    };
  }

  await pool.query(
    `INSERT INTO ritual_rebuild_offers (source_ritual_id, mode, created_by)
     VALUES ($1, 'open_claim', $2)`,
    [ritualId, hostId]
  );
  return {
    ...cancelled,
    rebuild: { mode: 'open_claim', message: 'Kadroya kart: yeniden kurmak isteyen? İlk basan alır.' },
  };
}

export async function claimRebuildOffer({ sourceRitualId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const offer = await client.query(
      `SELECT * FROM ritual_rebuild_offers
       WHERE source_ritual_id = $1 AND mode = 'open_claim' AND claimed_by IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [sourceRitualId]
    );
    if (!offer.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Açık yeniden-kur teklifi yok', code: 'REBUILD_GONE' };
    }
    const clone = await cloneRitualShell(sourceRitualId, userId);
    if (!clone.ok) {
      await client.query('ROLLBACK');
      return { ok: false, status: 500, error: clone.error };
    }
    await inviteAttendees(sourceRitualId, clone.ritual.id, userId);
    await client.query(
      `UPDATE ritual_rebuild_offers
       SET claimed_by = $2, claimed_at = NOW(), clone_ritual_id = $3
       WHERE id = $1`,
      [offer.rows[0].id, userId, clone.ritual.id]
    );
    await client.query('COMMIT');
    return { ok: true, clone_id: clone.ritual.id, ritual: clone.ritual };
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '42P01') return { ok: false, status: 503, error: 'rebuild schema missing' };
    throw e;
  } finally {
    client.release();
  }
}

/** V13: host rolü boşalır, R aynen kalır. */
export async function vacateHostRole({ ritualId, userId }) {
  const r = await pool.query(
    `SELECT id, host_id, status, creator_id, created_by FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritual = r.rows[0];
  if (!ritual) return { ok: false, status: 404, error: 'Ritual not found' };
  if (String(ritual.host_id) !== String(userId)) {
    return { ok: false, status: 403, error: 'Only current host can vacate' };
  }
  if (String(ritual.status) === 'cancelled') {
    return { ok: false, status: 400, error: 'Cancelled ritual cannot vacate host' };
  }
  await pool.query(
    `UPDATE rituals
     SET host_id = NULL,
         host_role_open = true,
         host_vacated_at = NOW(),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [ritualId]
  );
  return {
    ok: true,
    host_role_open: true,
    message: 'Hostluk boşta, üstlenmek ister misin?',
  };
}

export async function claimHostRole({ ritualId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT id, host_id, host_role_open, status FROM rituals WHERE id = $1 FOR UPDATE`,
      [ritualId]
    );
    const ritual = r.rows[0];
    if (!ritual) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Ritual not found' };
    }
    if (ritual.host_id) {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'Hostluk dolu', code: 'HOST_TAKEN' };
    }
    if (ritual.host_role_open === false) {
      await client.query('ROLLBACK');
      return { ok: false, status: 403, error: 'Hostluk açık değil' };
    }
    const att = await client.query(
      `SELECT 1 FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2
         AND status::text NOT IN ('no_show', 'cancelled')
       LIMIT 1`,
      [ritualId, userId]
    );
    if (!att.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, status: 403, error: 'Yalnız sözlü üstlenir' };
    }
    await client.query(
      `UPDATE rituals
       SET host_id = $2, host_role_open = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ritualId, userId]
    );
    await client.query('COMMIT');
    return { ok: true, host_id: userId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listOpenRebuildOffers(userId) {
  const r = await pool.query(
    `SELECT o.*, src.title, src.start_time
     FROM ritual_rebuild_offers o
     JOIN rituals src ON src.id = o.source_ritual_id
     JOIN ritual_attendance a ON a.ritual_id = o.source_ritual_id AND a.user_id = $1
     WHERE o.mode = 'open_claim' AND o.claimed_by IS NULL
       AND a.status::text NOT IN ('no_show', 'cancelled')
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [userId]
  );
  return r.rows;
}

export function emptySalesPocket() {
  return {
    ui_noun: 'Satışlarım',
    payout_separate_from_vitrine: true,
    blocks: SALES_POCKET_BLOCKS,
    plans: [],
    fulfillment: { attempted: 0, fulfilled: 0, denied: 0 },
    buyer_chips: [],
    customers: [],
    approval_queue: { items: [], concurrent_cap: 1 },
    payout: { pending: 0, currency: 'TRY', note: 'payout vitrinden ayrı' },
    vitrine: { published: false, note: 'vitrin payout değildir' },
  };
}

export async function getSalesPocket(userId) {
  const pocket = emptySalesPocket();
  if (!userId) return pocket;
  try {
    const plans = await pool.query(
      `SELECT id, title, plan_kind, seller_type, host_venue_id, active, created_at
       FROM venue_membership_plans
       WHERE seller_user_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [userId]
    );
    pocket.plans = plans.rows;
  } catch (_e) {
    /* table optional */
  }
  try {
    const sicil = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE kind = 'attempted')::int AS attempted,
         COUNT(*) FILTER (WHERE kind = 'fulfilled')::int AS fulfilled,
         COUNT(*) FILTER (WHERE kind = 'denied')::int AS denied
       FROM seller_fulfillment_events
       WHERE seller_user_id = $1`,
      [userId]
    );
    pocket.fulfillment = sicil.rows[0] || pocket.fulfillment;
  } catch (_e) {
    /* optional */
  }
  try {
    const customers = await pool.query(
      `SELECT e.user_id, e.created_at, p.title
       FROM venue_membership_enrollments e
       JOIN venue_membership_plans p ON p.id = e.plan_id
       WHERE p.seller_user_id = $1
       ORDER BY e.created_at DESC
       LIMIT 40`,
      [userId]
    );
    pocket.customers = customers.rows;
  } catch (_e) {
    /* optional */
  }
  try {
    const queue = await pool.query(
      `SELECT s.id, s.venue_id, s.status, s.created_at
       FROM venue_slot_suggestions s
       WHERE s.user_id = $1 AND s.status = 'pending'
       ORDER BY s.created_at ASC
       LIMIT 5`,
      [userId]
    );
    pocket.approval_queue.items = queue.rows.slice(0, 1);
    pocket.approval_queue.overflow = Math.max(0, queue.rows.length - 1);
  } catch (_e) {
    /* optional */
  }
  return pocket;
}
