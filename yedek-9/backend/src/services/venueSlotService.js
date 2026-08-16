/**
 * Venue slot + oneri kutusu — son-part.md §9.4
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getVenueMaxTableSeats } from './ritualCreateValidation.js';
import { updateOnboardingStep, maybeMarkVenueLive } from './venueApplicationService.js';
import { notifyVenueSuggestion, notifyVenueSlotClaimed, notifySuggestionResolved } from './notifications.js';
import { userMeetsBadgeRequirement } from './badgeEngine.js';
import {
  assertCanCreateVenueSlot,
  recordFreeSlotUsage,
  resolveTierFromVenue,
  hasPackageFeature,
} from './venuePackageService.js';

const BADGE_LEVELS = new Set(LOCAL_CONFIG.badges.LEVELS);

const TIME_MODES = new Set(LOCAL_CONFIG.venue.SLOT_TIME_MODES);
const VISIBILITY = new Set(LOCAL_CONFIG.venue.SLOT_VISIBILITY);
const VISIBILITY_ALIASES = LOCAL_CONFIG.venue.SLOT_VISIBILITY_ALIASES || {};

export function normalizeSlotVisibility(raw = 'public') {
  const key = String(raw || 'public').toLowerCase();
  const mapped = VISIBILITY_ALIASES[key] || key;
  return VISIBILITY.has(mapped) ? mapped : null;
}

export function buildDefaultEconomyStub() {
  if (!LOCAL_CONFIG.stubs.SLOT_ECONOMY_ENABLED) return {};
  const cfg = LOCAL_CONFIG.stubs.SLOT_ECONOMY || {};
  return {
    currency: cfg.currency || 'EUR',
    claim_fee_cents: Number(cfg.claim_fee_cents) || 0,
    suggestion_reward_cents: Number(cfg.suggestion_reward_cents) || 0,
    host_payout_cents: Number(cfg.host_payout_cents) || 0,
  };
}

export function validateEconomyStub(body = {}) {
  if (!LOCAL_CONFIG.stubs.SLOT_ECONOMY_ENABLED) {
    return { ok: true, data: {} };
  }
  const src = body && typeof body === 'object' ? body : {};
  const defaults = buildDefaultEconomyStub();
  const claimFee = src.claim_fee_cents != null ? Number(src.claim_fee_cents) : defaults.claim_fee_cents;
  const reward = src.suggestion_reward_cents != null ? Number(src.suggestion_reward_cents) : defaults.suggestion_reward_cents;
  const payout = src.host_payout_cents != null ? Number(src.host_payout_cents) : defaults.host_payout_cents;
  if (![claimFee, reward, payout].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ok: false, error: 'economy values must be non-negative numbers' };
  }
  return {
    ok: true,
    data: {
      currency: String(src.currency || defaults.currency || 'EUR').slice(0, 8),
      claim_fee_cents: Math.round(claimFee),
      suggestion_reward_cents: Math.round(reward),
      host_payout_cents: Math.round(payout),
    },
  };
}

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

export async function getVenueSlotConstraints(venueId) {
  const r = await pool.query(`SELECT floor_plan FROM venues WHERE id = $1`, [venueId]);
  const maxTableSeats = getVenueMaxTableSeats(r.rows[0]?.floor_plan);
  return {
    max_table_seats: maxTableSeats > 0 ? maxTableSeats : null,
    economy_enabled: Boolean(LOCAL_CONFIG.stubs.SLOT_ECONOMY_ENABLED),
    economy_defaults: buildDefaultEconomyStub(),
    visibility_options: LOCAL_CONFIG.venue.SLOT_VISIBILITY,
    badge_levels: LOCAL_CONFIG.badges.LEVELS,
    badge_catalog: (LOCAL_CONFIG.badges.CATALOG || []).map((b) => ({
      slug: b.slug,
      name: b.name,
      icon_emoji: b.icon_emoji,
      spec_category: b.spec_category,
    })),
  };
}

export function validateSlotPayload(body = {}, { maxTableSeats = null } = {}) {
  const title = String(body.title || '').trim();
  if (!title) return { ok: false, error: 'title is required' };
  const timeMode = String(body.time_mode || 'fixed').toLowerCase();
  if (!TIME_MODES.has(timeMode)) return { ok: false, error: 'invalid time_mode' };
  const visibility = normalizeSlotVisibility(body.visibility);
  if (!visibility) return { ok: false, error: 'invalid visibility' };
  let capacity = Math.max(1, Number(body.capacity) || LOCAL_CONFIG.venue.DEFAULT_SLOT_CAPACITY);
  if (maxTableSeats != null && maxTableSeats > 0 && capacity > maxTableSeats) {
    return {
      ok: false,
      error: `Capacity cannot exceed venue table seats (${maxTableSeats})`,
    };
  }
  const economy = validateEconomyStub(body.economy_stub);
  if (!economy.ok) return economy;

  let requiredBadgeSlug = body.required_badge_slug != null
    ? String(body.required_badge_slug).trim().slice(0, 64)
    : null;
  if (requiredBadgeSlug === '') requiredBadgeSlug = null;
  if (requiredBadgeSlug) {
    const negSlugs = new Set(LOCAL_CONFIG.badges?.NEGATIVE_SLUGS || []);
    if (negSlugs.has(requiredBadgeSlug)) {
      return { ok: false, error: 'Negatif rozetler kapı koşulu olamaz' };
    }
    const known = (LOCAL_CONFIG.badges.CATALOG || []).find((b) => b.slug === requiredBadgeSlug);
    if (!known) return { ok: false, error: 'invalid required_badge_slug' };
    if (known.is_negative) return { ok: false, error: 'Negatif rozetler kapı koşulu olamaz' };
  }
  let minBadgeLevel = body.min_badge_level != null
    ? String(body.min_badge_level).toLowerCase()
    : null;
  if (minBadgeLevel === '') minBadgeLevel = null;
  if (requiredBadgeSlug && !minBadgeLevel) minBadgeLevel = 'novice';
  if (minBadgeLevel && !BADGE_LEVELS.has(minBadgeLevel)) {
    return { ok: false, error: 'invalid min_badge_level' };
  }
  if (!requiredBadgeSlug) minBadgeLevel = null;

  const audienceRaw = body.audience_tag != null ? String(body.audience_tag).toUpperCase() : null;
  const audience_tag =
    audienceRaw && ['UNI_FRIENDLY', 'INTERNATIONAL'].includes(audienceRaw) ? audienceRaw : null;

  return {
    ok: true,
    data: {
      title: title.slice(0, 255),
      description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      location_label: body.location_label ? String(body.location_label).trim().slice(0, 255) : null,
      time_mode: timeMode,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      recurrence_rule: body.recurrence_rule ? String(body.recurrence_rule).slice(0, 500) : null,
      capacity,
      min_host_rs: body.min_host_rs != null ? Number(body.min_host_rs) : null,
      host_only: Boolean(body.host_only),
      visibility,
      economy_stub: economy.data,
      audience_tag,
      required_badge_slug: requiredBadgeSlug,
      min_badge_level: minBadgeLevel,
      brand_priority: Boolean(body.brand_priority),
    },
  };
}

export function validateSuggestionPayload(body = {}, { maxTableSeats = null } = {}) {
  const title = String(body.title || '').trim();
  if (!title) return { ok: false, error: 'title is required' };
  const timeMode = String(body.time_mode || 'loose').toLowerCase();
  if (!TIME_MODES.has(timeMode)) return { ok: false, error: 'invalid time_mode' };
  let proposedCapacity = body.proposed_capacity != null ? Math.max(1, Number(body.proposed_capacity)) : null;
  if (proposedCapacity != null && maxTableSeats != null && maxTableSeats > 0 && proposedCapacity > maxTableSeats) {
    return {
      ok: false,
      error: `Proposed capacity cannot exceed venue table seats (${maxTableSeats})`,
    };
  }
  return {
    ok: true,
    data: {
      title: title.slice(0, 255),
      description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      location_label: body.location_label ? String(body.location_label).trim().slice(0, 255) : null,
      time_mode: timeMode,
      proposed_starts_at: body.proposed_starts_at || null,
      proposed_capacity: proposedCapacity,
    },
  };
}

export async function listVenueSlots(venueId, { status = 'open', limit = 30, viewerUserId = null } = {}) {
  const r = await pool.query(
    `SELECT s.*, u.name AS claimed_by_name
     FROM venue_slots s
     LEFT JOIN users u ON u.id = s.claimed_by
     WHERE s.venue_id = $1
       AND ($2::text IS NULL OR s.status::text = $2)
     ORDER BY s.starts_at ASC NULLS LAST, s.created_at DESC
     LIMIT $3`,
    [venueId, status || null, Math.min(Number(limit) || 30, 100)]
  );

  // §14 — eşleştirme SESSİZ: uygun olmayan slot görünürlükten filtrelenir; sayı/neden yok
  if (!viewerUserId) return r.rows;

  const visible = [];
  for (const slot of r.rows) {
    const ok = await isSlotVisibleToViewer(viewerUserId, slot, venueId);
    if (ok) visible.push(slot);
  }
  return visible;
}

async function isSlotVisibleToViewer(userId, slot, venueId) {
  const vis = String(slot.visibility || 'public').toLowerCase();
  if (vis === 'hidden') return false;
  if (vis === 'regular_only') {
    const { isVenueRegular } = await import('./regularService.js');
    const reg = await isVenueRegular(userId, venueId);
    if (!reg) return false;
  }
  // min_host_rs / badge — sessiz filtre (claim'de de engellenir)
  const eligible = await assertSlotHostEligibility(userId, slot);
  return eligible.ok;
}

export async function createVenueSlot(venueId, userId, payload, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const constraints = await getVenueSlotConstraints(venueId);
  const valid = validateSlotPayload(payload, { maxTableSeats: constraints.max_table_seats });
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };
  const d = valid.data;

  const gate = await assertCanCreateVenueSlot(venueId, { timeMode: d.time_mode });
  if (!gate.ok) return gate;

  let brandPriority = Boolean(d.brand_priority);
  if (brandPriority && resolveTierFromVenue(gate.venue) !== 'hakim') {
    brandPriority = false;
  }

  const r = await pool.query(
    `INSERT INTO venue_slots (
       venue_id, created_by, title, description, location_label, time_mode,
       starts_at, ends_at, recurrence_rule, capacity, min_host_rs, host_only,
       visibility, economy_stub, required_badge_slug, min_badge_level, audience_tag, brand_priority, status
     ) VALUES ($1,$2,$3,$4,$5,$6::venue_slot_time_mode,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,'open')
     RETURNING *`,
    [
      venueId,
      userId,
      d.title,
      d.description,
      d.location_label,
      d.time_mode,
      d.starts_at,
      d.ends_at,
      d.recurrence_rule,
      d.capacity,
      d.min_host_rs,
      d.host_only,
      d.visibility,
      JSON.stringify(d.economy_stub),
      d.required_badge_slug,
      d.min_badge_level,
      d.audience_tag || null,
      brandPriority,
    ]
  );
  if (gate.tier === 'free') {
    await recordFreeSlotUsage(venueId).catch(() => {});
  }
  await updateOnboardingStep(userId, venueId, 'first_slot').catch(() => {});
  await maybeMarkVenueLive(userId, venueId).catch(() => {});
  try {
    const { notifyVenueSlotOpened } = await import('./notifications.js');
    const venueName = gate.venue?.name;
    await notifyVenueSlotOpened(venueId, {
      slotId: r.rows[0].id,
      slotTitle: r.rows[0].title,
      venueName,
    }).catch(() => {});
  } catch (_e) {
    /* non-fatal */
  }
  return { ok: true, slot: r.rows[0], package_tier: gate.tier };
}

async function assertSlotHostEligibility(userId, slot) {
  if (slot.min_host_rs != null) {
    const userRs = await pool.query(`SELECT rs_score FROM users WHERE id = $1`, [userId]);
    const rs = userRs.rows[0]?.rs_score != null ? Number(userRs.rows[0].rs_score) : null;
    if (rs == null || rs < Number(slot.min_host_rs)) {
      return { ok: false, status: 403, error: 'RS below slot minimum' };
    }
  }
  if (slot.required_badge_slug) {
    const meets = await userMeetsBadgeRequirement(
      userId,
      slot.required_badge_slug,
      slot.min_badge_level || 'novice'
    );
    if (!meets) {
      return {
        ok: false,
        status: 403,
        error: `Badge requirement not met (${slot.required_badge_slug} ${slot.min_badge_level || 'novice'}+)`,
      };
    }
  }
  return { ok: true };
}

/** Link an open venue slot to a newly created ritual (son-part.md §2.1) */
export async function attachVenueSlotToRitual(venueId, slotId, userId, ritualId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotR = await client.query(
      `SELECT * FROM venue_slots WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
      [slotId, venueId]
    );
    if (slotR.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Slot not found' };
    }
    const slot = slotR.rows[0];
    if (slot.status !== 'open') {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'Slot is not open' };
    }
    const eligible = await assertSlotHostEligibility(userId, slot);
    if (!eligible.ok) {
      await client.query('ROLLBACK');
      return eligible;
    }
    const upd = await client.query(
      `UPDATE venue_slots
       SET status = 'claimed', claimed_by = $2, claimed_at = NOW(), ritual_id = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [slotId, userId, ritualId]
    );
    await client.query('COMMIT');

    const managers = await pool.query(
      `SELECT user_id FROM venue_managers WHERE venue_id = $1`,
      [venueId]
    );
    for (const m of managers.rows) {
      notifyVenueSlotClaimed(m.user_id, {
        venueId,
        slotId,
        slotTitle: slot.title,
        claimerId: userId,
      }).catch(() => {});
    }

    return { ok: true, slot: upd.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function claimVenueSlot(venueId, slotId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotR = await client.query(
      `SELECT * FROM venue_slots WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
      [slotId, venueId]
    );
    if (slotR.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Slot not found' };
    }
    const slot = slotR.rows[0];
    if (slot.status !== 'open') {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'Slot is not open' };
    }
    const eligible = await assertSlotHostEligibility(userId, slot);
    if (!eligible.ok) {
      await client.query('ROLLBACK');
      return eligible;
    }
    const upd = await client.query(
      `UPDATE venue_slots
       SET status = 'claimed', claimed_by = $2, claimed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [slotId, userId]
    );
    await client.query('COMMIT');

    const managers = await pool.query(
      `SELECT user_id FROM venue_managers WHERE venue_id = $1`,
      [venueId]
    );
    for (const m of managers.rows) {
      notifyVenueSlotClaimed(m.user_id, { venueId, slotId, slotTitle: slot.title, claimerId: userId }).catch(() => {});
    }

    return { ok: true, slot: upd.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function buildBehaviorSummary(userId) {
  /** Davranış özeti — RS SAYISI ASLA */
  const r = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM ritual_attendance ra
         WHERE ra.user_id = $1 AND ra.checkin_at IS NOT NULL
           AND ra.checkin_at >= NOW() - INTERVAL '90 days') AS checkins_90d,
       (SELECT COUNT(*)::int FROM rituals r
         WHERE r.host_id = $1 AND r.start_time >= NOW() - INTERVAL '90 days'
           AND r.status::text NOT IN ('cancelled','draft')) AS hosted_90d,
       (SELECT COUNT(*)::int FROM venue_regulars vr
         WHERE vr.user_id = $1 AND vr.is_regular = true) AS regular_venues
    `,
    [userId]
  );
  const row = r.rows[0] || {};
  const parts = [];
  if (row.hosted_90d > 0) parts.push(`${row.hosted_90d} host (90g)`);
  if (row.checkins_90d > 0) parts.push(`${row.checkins_90d} check-in (90g)`);
  if (row.regular_venues > 0) parts.push(`${row.regular_venues} regular mekân`);
  return parts.length ? parts.join(' · ') : 'Yeni öneren';
}

export async function listSuggestionInbox(venueId, userId, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  await expireDueSuggestions(venueId).catch(() => {});
  const r = await pool.query(
    `SELECT sug.id, sug.venue_id, sug.user_id, sug.title, sug.description,
            sug.location_label, sug.time_mode, sug.proposed_starts_at, sug.proposed_capacity,
            sug.status, sug.created_at, sug.behavior_summary, sug.alt_suggested, sug.alt_note,
            sug.expires_at, u.name AS user_name
     FROM venue_slot_suggestions sug
     JOIN users u ON u.id = sug.user_id
     WHERE sug.venue_id = $1 AND sug.status = 'pending'
     ORDER BY sug.created_at ASC`,
    [venueId]
  );
  const unanswered = r.rows.length;
  return {
    ok: true,
    suggestions: r.rows.map((s) => ({
      ...s,
      // RS never exposed
      behavior_summary: s.behavior_summary || 'Davranış özeti yok',
    })),
    unanswered_count: unanswered,
  };
}

export async function expireDueSuggestions(venueId = null) {
  const hours = LOCAL_CONFIG.venue?.PACKAGES_STUB?.SUGGESTION_EXPIRE_HOURS_BEFORE ?? 24;
  const r = await pool.query(
    `UPDATE venue_slot_suggestions sug
     SET status = 'rejected',
         reviewer_note = COALESCE(reviewer_note, 'Ritual 24s kala otomatik süresi doldu'),
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE sug.status = 'pending'
       AND sug.proposed_starts_at IS NOT NULL
       AND sug.proposed_starts_at <= NOW() + ($1 || ' hours')::interval
       AND ($2::uuid IS NULL OR sug.venue_id = $2)
     RETURNING sug.id, sug.user_id, sug.venue_id, sug.title`,
    [String(hours), venueId]
  );
  for (const row of r.rows) {
    notifySuggestionResolved(row.user_id, {
      venueId: row.venue_id,
      title: row.title,
      approved: false,
      reviewerNote: 'Ritual 24s kala otomatik süresi doldu',
      expired: true,
    }).catch(() => {});
  }
  return { expired: r.rows.length };
}

export async function submitSlotSuggestion(venueId, userId, payload) {
  const constraints = await getVenueSlotConstraints(venueId);
  const valid = validateSuggestionPayload(payload, { maxTableSeats: constraints.max_table_seats });
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };
  const d = valid.data;

  const pendingCap = Number(
    LOCAL_CONFIG.venue?.PACKAGES_STUB?.SUGGESTION_PENDING_PER_VENUE ?? 1
  );
  const pendingSame = await pool.query(
    `SELECT id FROM venue_slot_suggestions
     WHERE venue_id = $1 AND user_id = $2 AND status = 'pending'`,
    [venueId, userId]
  );
  if (pendingSame.rows.length >= pendingCap) {
    return {
      ok: false,
      status: 429,
      error: `Bu mekânda en fazla ${pendingCap} bekleyen önerin olabilir`,
      code: 'SUGGESTION_PENDING_CAP',
    };
  }

  const dailyCap = LOCAL_CONFIG.venue?.PACKAGES_STUB?.SUGGESTION_DAILY_CAP ?? 5;
  const daily = await pool.query(
    `SELECT COUNT(*)::int AS n FROM venue_slot_suggestions
     WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
    [userId]
  );
  if (Number(daily.rows[0]?.n || 0) >= dailyCap) {
    return { ok: false, status: 429, error: `Günlük öneri limiti (${dailyCap}) doldu` };
  }

  const hours = LOCAL_CONFIG.venue?.PACKAGES_STUB?.SUGGESTION_EXPIRE_HOURS_BEFORE ?? 24;
  let expiresAt = null;
  if (d.proposed_starts_at) {
    expiresAt = new Date(new Date(d.proposed_starts_at).getTime() - hours * 3600 * 1000);
  }

  const behavior = await buildBehaviorSummary(userId);
  const r = await pool.query(
    `INSERT INTO venue_slot_suggestions (
       venue_id, user_id, title, description, location_label, time_mode,
       proposed_starts_at, proposed_capacity, status, behavior_summary, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6::venue_slot_time_mode,$7,$8,'pending',$9,$10)
     RETURNING *`,
    [
      venueId,
      userId,
      d.title,
      d.description,
      d.location_label,
      d.time_mode,
      d.proposed_starts_at,
      d.proposed_capacity,
      behavior,
      expiresAt,
    ]
  );
  const managers = await pool.query(`SELECT user_id FROM venue_managers WHERE venue_id = $1`, [venueId]);
  for (const m of managers.rows) {
    notifyVenueSuggestion(m.user_id, { venueId, suggestionId: r.rows[0].id, title: d.title }).catch(() => {});
  }
  return { ok: true, suggestion: { ...r.rows[0], behavior_summary: behavior } };
}

/** Alternatif öner — tek tur (OPERATÖR+) */
export async function suggestAlternativeSlot(venueId, suggestionId, reviewerId, { altNote } = {}, email = '') {
  const allowed = await isVenueManager(reviewerId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const venueR = await pool.query(
    `SELECT subscription_tier, pro_enabled, city_partner_enabled FROM venues WHERE id = $1`,
    [venueId]
  );
  const venue = venueR.rows[0];
  if (!venue || (!hasPackageFeature(venue, 'alt_oneri') && resolveTierFromVenue(venue) === 'free')) {
    return { ok: false, status: 403, error: 'Alternatif öner OPERATÖR+ gerektirir' };
  }
  const sugR = await pool.query(
    `SELECT * FROM venue_slot_suggestions WHERE id = $1 AND venue_id = $2 AND status = 'pending'`,
    [suggestionId, venueId]
  );
  if (!sugR.rows[0]) return { ok: false, status: 404, error: 'Pending suggestion not found' };
  if (sugR.rows[0].alt_suggested) {
    return { ok: false, status: 409, error: 'Alternatif öner yalnız tek tur' };
  }
  const upd = await pool.query(
    `UPDATE venue_slot_suggestions
     SET alt_suggested = true, alt_note = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [suggestionId, altNote ? String(altNote).slice(0, 500) : null]
  );
  notifySuggestionResolved(sugR.rows[0].user_id, {
    venueId,
    title: sugR.rows[0].title,
    approved: false,
    reviewerNote: altNote || 'Mekân alternatif önerdi',
    alternative: true,
  }).catch(() => {});
  return { ok: true, suggestion: upd.rows[0] };
}

export async function approveSlotSuggestion(venueId, suggestionId, reviewerId, { reviewerNote } = {}, email = '') {
  const allowed = await isVenueManager(reviewerId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };

  const sugR = await pool.query(
    `SELECT * FROM venue_slot_suggestions WHERE id = $1 AND venue_id = $2 AND status = 'pending'`,
    [suggestionId, venueId]
  );
  if (sugR.rows.length === 0) return { ok: false, status: 404, error: 'Pending suggestion not found' };
  const sug = sugR.rows[0];

  const slotResult = await createVenueSlot(
    venueId,
    reviewerId,
    {
      title: sug.title,
      description: sug.description,
      location_label: sug.location_label,
      time_mode: sug.time_mode,
      starts_at: sug.proposed_starts_at,
      capacity: sug.proposed_capacity || LOCAL_CONFIG.venue.DEFAULT_SLOT_CAPACITY,
      visibility: 'public',
    },
    email
  );
  if (!slotResult.ok) return slotResult;

  const upd = await pool.query(
    `UPDATE venue_slot_suggestions
     SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(),
         reviewer_note = $3, resulting_slot_id = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [suggestionId, reviewerId, reviewerNote || null, slotResult.slot.id]
  );

  notifySuggestionResolved(sug.user_id, {
    venueId,
    title: sug.title,
    approved: true,
    reviewerNote: reviewerNote || null,
  }).catch(() => {});

  return { ok: true, suggestion: upd.rows[0], slot: slotResult.slot };
}

export async function rejectSlotSuggestion(venueId, suggestionId, reviewerId, { reviewerNote } = {}, email = '') {
  const allowed = await isVenueManager(reviewerId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const r = await pool.query(
    `UPDATE venue_slot_suggestions
     SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
         reviewer_note = $3, updated_at = NOW()
     WHERE id = $1 AND venue_id = $4 AND status = 'pending'
     RETURNING *`,
    [suggestionId, reviewerId, reviewerNote || null, venueId]
  );
  if (r.rows.length === 0) return { ok: false, status: 404, error: 'Pending suggestion not found' };
  const sug = r.rows[0];
  notifySuggestionResolved(sug.user_id, {
    venueId,
    title: sug.title,
    approved: false,
    reviewerNote: reviewerNote || null,
  }).catch(() => {});
  return { ok: true, suggestion: sug };
}

export async function listVenueSuggestionHistory(venueId, reviewerId, email = '', { limit = 30 } = {}) {
  const allowed = await isVenueManager(reviewerId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const r = await pool.query(
    `SELECT s.*, u.name AS user_name, ru.name AS reviewer_name
     FROM venue_slot_suggestions s
     LEFT JOIN users u ON u.id = s.user_id
     LEFT JOIN users ru ON ru.id = s.reviewed_by
     WHERE s.venue_id = $1 AND s.status::text IN ('approved', 'rejected')
     ORDER BY s.reviewed_at DESC NULLS LAST
     LIMIT $2`,
    [venueId, limit]
  );
  return { ok: true, suggestions: r.rows };
}
