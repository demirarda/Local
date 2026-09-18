/**
 * Venue profil — vitrin (public) + kilitli bolumler — son-part.md §9.1, §9.6
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { updateOnboardingStep, maybeMarkVenueLive } from './venueApplicationService.js';
import { hasMinRole, getVenueAccess } from './venueRoleService.js';
import { notifyBadgeApproval } from './notifications.js';
import { computeVenueTrustAura } from './venueTrustAuraService.js';
import { getFeaturedArchivePreview } from './venueArchiveService.js';
import { resolveBadgeKeys } from './badgeEngine.js';
import { resolveTierFromVenue } from './venuePackageService.js';

const BADGE_MAX = LOCAL_CONFIG.venue.BADGE_HIGHLIGHT_VENUE;

export const LOCKED_SECTION_IDS = [
  'floor_plan',
  'slots',
  'analytics',
  'archive_full',
  'business_tab',
];

/** §7 gerçekleşme-sicili yalnız para-alan panel (ücretli yönetici). */
export function canSeeFulfillmentSicil({ canManage, venue } = {}) {
  if (!canManage) return false;
  return resolveTierFromVenue(venue || {}) !== 'free';
}

async function computeVenueLifeLine(venueId, { includeFulfillment = false } = {}) {
  const minN = Number(LOCAL_CONFIG.venue.LIFE_LINE_MIN || LOCAL_CONFIG.venue.MIN_DISPLAY_N || 5);
  let past = 0;
  let live = 0;
  let planned = 0;
  let denied = 0;
  let attempted = 0;

  try {
    const sealed = await pool.query(
      `SELECT COUNT(DISTINCT DATE(r.start_time))::int AS c
       FROM rituals r
       JOIN ritual_attendance ra ON ra.ritual_id = r.id
       WHERE r.venue_id = $1
         AND ra.checkin_at IS NOT NULL
         AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
         AND r.suspended_at IS NULL`,
      [venueId]
    );
    past = Number(sealed.rows[0]?.c || 0);
  } catch (_e) {
    past = 0;
  }

  try {
    const liveR = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM rituals
       WHERE venue_id = $1
         AND status::text IN ('live')
         AND suspended_at IS NULL`,
      [venueId]
    );
    live = Number(liveR.rows[0]?.c || 0);
  } catch (_e) {
    live = 0;
  }

  try {
    const slots = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM venue_slots
       WHERE venue_id = $1
         AND status::text = 'open'
         AND starts_at IS NOT NULL
         AND starts_at > NOW()`,
      [venueId]
    );
    planned = Number(slots.rows[0]?.c || 0);
  } catch (_e) {
    planned = 0;
  }

  try {
    const futureRituals = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM rituals
       WHERE venue_id = $1
         AND start_time > NOW()
         AND status::text IN ('prelobby', 'active', 'created')
         AND suspended_at IS NULL`,
      [venueId]
    );
    planned += Number(futureRituals.rows[0]?.c || 0);
  } catch (_e) {
    /* ignore */
  }

  try {
    const fulfill = await pool.query(
      `SELECT
         COUNT(*)::int AS attempted,
         COUNT(*) FILTER (WHERE cancel_reason = 'yer_veremedik')::int AS denied
       FROM rituals
       WHERE venue_id = $1`,
      [venueId]
    );
    attempted = Number(fulfill.rows[0]?.attempted || 0);
    denied = Number(fulfill.rows[0]?.denied || 0);
  } catch (_e) {
    attempted = 0;
    denied = 0;
  }

  const soft = past < minN;
  const given = Math.max(0, attempted - denied);
  const placeRate = attempted > 0 ? given / attempted : null;

  const fulfillment = includeFulfillment
    ? {
        place_given_rate: placeRate,
        place_given_label:
          placeRate == null ? null : `Yer-verme %${Math.round(placeRate * 100)}`,
      }
    : {
        place_given_rate: null,
        place_given_label: null,
      };

  return {
    past: soft ? null : past,
    live,
    planned: soft ? null : planned,
    soft,
    min_n: minN,
    placeholder: soft ? 'Yeni mekan' : null,
    ...fulfillment,
  };
}

function defaultLockedSections(isManager) {
  const mk = (id, label, teaser) => ({
    id,
    label,
    locked: !isManager,
    teaser: teaser || null,
    reason: isManager ? null : 'Yalnizca mekan yoneticisi',
  });
  return [
    mk('floor_plan', 'Ic harita (masa/koltuk)', 'Onboarding adimi'),
    mk('slots', 'Slot & takvim', '6 boyutlu slot modeli'),
    mk('analytics', 'Isletme analitigi', 'PRO / Isletme sekmesi'),
    mk('archive_full', 'Tam memory arsivi', 'PUBLIC anilar — gizlenemez'),
    mk('business_tab', 'Isletme paketleri', 'Tasarim bekliyor'),
  ];
}

function normalizeVitrine(raw = {}) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    headline: String(v.headline || '').trim().slice(0, 120),
    tagline: String(v.tagline || '').trim().slice(0, 200),
    cover_url: v.cover_url ? String(v.cover_url).trim() : null,
    photo_urls: Array.isArray(v.photo_urls)
      ? v.photo_urls.map((u) => String(u).trim()).filter(Boolean).slice(0, 12)
      : [],
    hours: String(v.hours || '').trim().slice(0, 500),
    amenities: Array.isArray(v.amenities)
      ? v.amenities.map((a) => String(a).trim()).filter(Boolean).slice(0, 20)
      : [],
    categories: Array.isArray(v.categories)
      ? v.categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 8)
      : [],
    featured_memory_ids: Array.isArray(v.featured_memory_ids)
      ? v.featured_memory_ids.map((id) => String(id).trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

export function validateVitrinePayload(body = {}) {
  const vitrine = normalizeVitrine(body.vitrine || body);
  if (!vitrine.headline && !vitrine.tagline && !vitrine.cover_url) {
    return { ok: false, error: 'vitrine requires at least headline, tagline, or cover_url' };
  }
  const badges = Array.isArray(body.highlighted_badge_keys)
    ? body.highlighted_badge_keys.map((b) => String(b).trim()).filter(Boolean)
    : null;
  if (badges && badges.length > BADGE_MAX) {
    return { ok: false, error: `highlighted_badge_keys max ${BADGE_MAX}` };
  }
  return { ok: true, vitrine, highlighted_badge_keys: badges };
}

async function isVenueManager(userId, venueId, email = '', minRole = 'staff') {
  return hasMinRole(userId, venueId, minRole, email);
}

export async function getVenueProfile(venueId, viewerUserId = null, viewerEmail = '') {
  let r;
  try {
    r = await pool.query(
      `SELECT id, name, city, address, description, slug, vitrine, vitrine_published,
              highlighted_badge_keys, subscription_tier, is_verified, owner_user_id,
              venue_rs, rs_rating_count, badge_tier, total_rituals, created_at,
              chain_id, brand_id, pro_enabled, city_partner_enabled, category,
              membership_vitrine_enabled
       FROM venues WHERE id = $1`,
      [venueId]
    );
  } catch (_e) {
    r = await pool.query(
      `SELECT id, name, city, address, description, slug, vitrine, vitrine_published,
              highlighted_badge_keys, subscription_tier, is_verified, owner_user_id,
              venue_rs, rs_rating_count, badge_tier, total_rituals, created_at
       FROM venues WHERE id = $1`,
      [venueId]
    );
  }
  if (r.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };

  const row = r.rows[0];
  const access = await getVenueAccess(viewerUserId, venueId, viewerEmail);
  const canManage = Boolean(access.ok);
  const canEdit = Boolean(access.permissions?.profile);
  const vitrine = normalizeVitrine(row.vitrine);
  const showVitrine = canManage || row.vitrine_published;

  const archiveCount = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM memories m
     JOIN rituals r ON r.id = m.ritual_id
     WHERE r.venue_id = $1
       AND r.suspended_at IS NULL
       AND (m.privacy::text = 'public' OR m.privacy_mode = 'public' OR m.destination::text = 'ritual_and_pulse')`,
    [venueId]
  );

  const [trustAura, archivePreview, highlightedBadges, chipBreakdown, characterCard, lifeLine, membership] =
    await Promise.all([
      computeVenueTrustAura(venueId, { audience: canManage ? 'panel' : 'public' }),
      getFeaturedArchivePreview(venueId, 3),
      resolveBadgeKeys((row.highlighted_badge_keys || []).slice(0, BADGE_MAX)),
      import('./chipService.js').then((m) => m.getPublicChipBreakdown(venueId)).catch(() => null),
      import('./discoveryProfileService.js')
        .then((m) => m.buildVenueCharacterCard(venueId))
        .catch(() => null),
      computeVenueLifeLine(venueId, {
        includeFulfillment: canSeeFulfillmentSicil({ canManage, venue: row }),
      }).catch(() => null),
      import('./venueMembershipService.js')
        .then((m) =>
          m.getVenueMembershipBundle(venueId, { canManage, viewerUserId })
        )
        .catch(() => ({
          vitrine_enabled: true,
          badge: null,
          plans: [],
        })),
    ]);

  return {
    ok: true,
    profile: {
      venue_id: row.id,
      name: row.name,
      city: row.city,
      address: canManage ? row.address : (showVitrine ? row.address : null),
      description: row.description,
      slug: row.slug,
      is_verified: row.is_verified,
      subscription_tier: row.subscription_tier,
      chain_id: row.chain_id || null,
      brand_id: row.brand_id || null,
      vitrine: showVitrine ? vitrine : null,
      vitrine_published: row.vitrine_published,
      vitrine_draft: canManage ? vitrine : null,
      highlighted_badge_keys: (row.highlighted_badge_keys || []).slice(0, BADGE_MAX),
      highlighted_badges: highlightedBadges,
      trust_display: trustAura?.trust_display || null,
      aura_display: trustAura?.aura_display || null,
      seating_label: trustAura?.seating_label || null,
      seating_key: trustAura?.seating_key || null,
      archive_public_count: archiveCount.rows[0]?.c || 0,
      archive_preview: archivePreview,
      archive_preview_count: canManage
        ? archiveCount.rows[0]?.c || 0
        : Math.min(archiveCount.rows[0]?.c || 0, 3),
      locked_sections: defaultLockedSections(canEdit),
      can_manage: canManage,
      my_role: access.ok ? access.role : null,
      permissions: access.ok ? access.permissions : null,
      chip_breakdown: chipBreakdown || { hidden: true, breakdown: [] },
      /** §12 karakter kartı — hacim kartta yok */
      character_card: characterCard?.card || null,
      character_volume: characterCard?.profile_volume || null,
      life_line: lifeLine,
      category: row.category || vitrine.categories?.[0] || null,
      membership: membership || { vitrine_enabled: true, badge: null, plans: [] },
      membership_badge: membership?.badge || null,
    },
  };
}

export async function updateVenueVitrine(venueId, userId, payload, email = '') {
  const allowed = await isVenueManager(userId, venueId, email, 'manager');
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed to edit vitrine' };

  const valid = validateVitrinePayload(payload);
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };

  const prevBadges = await pool.query(
    `SELECT highlighted_badge_keys FROM venues WHERE id = $1`,
    [venueId]
  );
  const oldKeys = new Set(prevBadges.rows[0]?.highlighted_badge_keys || []);

  const updates = [valid.vitrine];
  let sql = `UPDATE venues SET vitrine = $2::jsonb, updated_at = NOW()`;
  let idx = 3;
  if (valid.highlighted_badge_keys) {
    sql += `, highlighted_badge_keys = $${idx}`;
    updates.push(valid.highlighted_badge_keys);
    idx++;
  }
  sql += ` WHERE id = $1 RETURNING *`;
  updates.unshift(venueId);

  const r = await pool.query(sql, updates);
  await updateOnboardingStep(userId, venueId, 'vitrine').catch(() => {});

  if (valid.highlighted_badge_keys?.length) {
    await updateOnboardingStep(userId, venueId, 'venue_badge').catch(() => {});
  }

  if (valid.highlighted_badge_keys) {
    for (const key of valid.highlighted_badge_keys) {
      if (!oldKeys.has(key)) {
        notifyBadgeApproval(userId, { venueId, badgeName: key }).catch(() => {});
      }
    }
  }

  return { ok: true, venue: r.rows[0], vitrine: normalizeVitrine(r.rows[0].vitrine) };
}

export async function publishVenueVitrine(venueId, userId, email = '') {
  const allowed = await isVenueManager(userId, venueId, email, 'manager');
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };

  const check = await pool.query(`SELECT vitrine FROM venues WHERE id = $1`, [venueId]);
  if (check.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const vitrine = normalizeVitrine(check.rows[0].vitrine);
  if (!vitrine.headline && !vitrine.tagline) {
    return { ok: false, status: 400, error: 'Vitrine needs headline or tagline before publish' };
  }

  const r = await pool.query(
    `UPDATE venues SET vitrine_published = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [venueId]
  );
  await maybeMarkVenueLive(userId, venueId).catch(() => {});
  return { ok: true, venue: r.rows[0] };
}
