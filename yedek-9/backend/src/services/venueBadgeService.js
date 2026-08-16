/**
 * Venue-created badges — LOCAL v2 §9
 * Shield template fixed · logo only (no venue-written text) · max 5 · admin approval
 * Conditions: visit/category/slot/event · spend/subjective forbidden
 * System grants only — venue cannot hand-distribute
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const VB = LOCAL_CONFIG.badges?.VENUE_BADGE || {};
const ALLOWED_CONDITIONS = new Set(VB.ALLOWED_CONDITIONS || ['visit', 'category', 'slot', 'event']);
const FORBIDDEN_CONDITIONS = new Set([
  ...(VB.FORBIDDEN_CONDITIONS || ['spend', 'subjective']),
  'manual_handout',
]);
const SHIELD = VB.SHIELD_TEMPLATE || 'shield_v1';
const MAX_VENUE = VB.MAX || LOCAL_CONFIG.venue?.BADGE_MAX || 5;
const SYSTEM_BADGE_NAMES = {
  visit: 'Mekan Müdavimi',
  category: 'Kategori Ustasi',
  slot: 'Slot Katilimcisi',
  event: 'Etkinlik Rozeti',
};

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

function sanitizeSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/** Create venue badge draft — admin must approve before live */
export async function createVenueBadge(venueId, managerId, payload = {}, email = '') {
  const allowed = await isVenueManager(managerId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };

  const countR = await pool.query(
    `SELECT COUNT(*)::int AS n FROM venue_badges
     WHERE venue_id = $1 AND status IN ('pending_approval', 'approved')`,
    [venueId]
  );
  if (Number(countR.rows[0]?.n || 0) >= MAX_VENUE) {
    return { ok: false, status: 403, error: `Mekan başına en fazla ${MAX_VENUE} venue-badge` };
  }

  const conditionType = String(payload.condition_type || '').toLowerCase();
  if (FORBIDDEN_CONDITIONS.has(conditionType) || !ALLOWED_CONDITIONS.has(conditionType)) {
    return {
      ok: false,
      status: 400,
      error: 'Koşul tipi: visit|category|slot|event (harcama/öznel yasak)',
    };
  }

  // Mekan metin yazamaz — rozet adı sistem şablonundan üretilir.
  const name = SYSTEM_BADGE_NAMES[conditionType] || 'Venue Rozeti';
  if (payload.custom_text || payload.body_text || payload.description) {
    return { ok: false, status: 400, error: 'Mekan rozete metin yazamaz; yalnızca logo' };
  }

  const logoUrl = payload.logo_url ? String(payload.logo_url).trim().slice(0, 1000) : null;
  if (!logoUrl) return { ok: false, status: 400, error: 'logo_url zorunlu' };

  const slug = sanitizeSlug(payload.slug || `${name}_${conditionType}`);
  const config = {
    threshold: Math.max(1, Number(payload.threshold) || 1),
    category: payload.category ? String(payload.category).slice(0, 64) : null,
    slot_id: payload.slot_id || null,
    event_key: payload.event_key ? String(payload.event_key).slice(0, 64) : null,
  };

  try {
    const r = await pool.query(
      `INSERT INTO venue_badges (
         venue_id, slug, name, logo_url, shield_template, condition_type,
         condition_config, status, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'pending_approval',$8)
       RETURNING *`,
      [venueId, slug, name, logoUrl, SHIELD, conditionType, JSON.stringify(config), managerId]
    );
    return { ok: true, venue_badge: r.rows[0] };
  } catch (e) {
    if (String(e.message || '').includes('unique')) {
      return { ok: false, status: 409, error: 'Slug already exists for venue' };
    }
    throw e;
  }
}

export async function listVenueBadges(venueId, { status } = {}) {
  const r = await pool.query(
    `SELECT * FROM venue_badges
     WHERE venue_id = $1
       AND ($2::text IS NULL OR status = $2)
     ORDER BY created_at DESC`,
    [venueId, status || null]
  );
  return { ok: true, badges: r.rows, max: MAX_VENUE, shield_template: SHIELD };
}

/** Admin approval — materializes into global badges catalog (family=VENUE) */
export async function reviewVenueBadge(venueBadgeId, adminId, { approve = true, note } = {}) {
  const cur = await pool.query(`SELECT * FROM venue_badges WHERE id = $1`, [venueBadgeId]);
  if (!cur.rows[0]) return { ok: false, status: 404, error: 'Not found' };
  const vb = cur.rows[0];
  if (vb.status !== 'pending_approval') {
    return { ok: false, status: 409, error: 'Not pending' };
  }

  if (!approve) {
    const upd = await pool.query(
      `UPDATE venue_badges
       SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
           reviewer_note = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [venueBadgeId, adminId, note || null]
    );
    return { ok: true, venue_badge: upd.rows[0] };
  }

  const globalSlug = `venue_${String(vb.venue_id).slice(0, 8)}_${vb.slug}`.slice(0, 100);
  const badgeIns = await pool.query(
    `INSERT INTO badges (
       slug, name, description, category, icon_emoji, trigger_condition,
       spec_category, family, badge_level, rule_engine, assignment_layer, venue_id, is_negative
     ) VALUES (
       $1, $2, $3, 'behavior'::badge_category, '🛡', $4::jsonb,
       'venue', 'VENUE', 'novice', $4::jsonb, 'system', $5, false
     )
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       rule_engine = EXCLUDED.rule_engine,
       family = 'VENUE',
       spec_category = 'venue',
       venue_id = EXCLUDED.venue_id
     RETURNING id`,
    [
      globalSlug,
      vb.name,
      `Venue badge · ${vb.condition_type}`,
      JSON.stringify({
        type: `venue_${vb.condition_type}`,
        venue_id: vb.venue_id,
        venue_badge_id: vb.id,
        ...vb.condition_config,
      }),
      vb.venue_id,
    ]
  );

  const upd = await pool.query(
    `UPDATE venue_badges
     SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(),
         reviewer_note = $3, global_badge_id = $4, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [venueBadgeId, adminId, note || null, badgeIns.rows[0].id]
  );
  return { ok: true, venue_badge: upd.rows[0], badge_id: badgeIns.rows[0].id };
}

/** System-only grant — managers cannot call with arbitrary user handout */
export async function grantVenueBadgeIfEarned(userId, venueId, { ritualId = null } = {}) {
  if (!userId || !venueId) return { ok: true, granted: 0 };
  try {
    const { canEarnBadges } = await import('./modEngine.js');
    if (!(await canEarnBadges(userId))) {
      return { ok: true, granted: 0, paused: true };
    }
  } catch (_e) {
    /* ignore */
  }

  const badges = await pool.query(
    `SELECT vb.*, b.id AS global_badge_id_resolved, b.slug AS global_slug, b.name AS global_name
     FROM venue_badges vb
     LEFT JOIN badges b ON b.id = vb.global_badge_id
     WHERE vb.venue_id = $1 AND vb.status = 'approved'`,
    [venueId]
  );

  let granted = 0;
  for (const vb of badges.rows) {
    const already = await pool.query(
      `SELECT 1 FROM venue_badge_grants WHERE venue_badge_id = $1 AND user_id = $2`,
      [vb.id, userId]
    );
    if (already.rows.length) continue;

    const earned = await userMeetsVenueBadgeCondition(userId, vb);
    if (!earned) continue;

    await pool.query(
      `INSERT INTO venue_badge_grants (venue_badge_id, user_id, granted_by_system, ritual_id)
       VALUES ($1,$2,true,$3)
       ON CONFLICT DO NOTHING`,
      [vb.id, userId, ritualId]
    );

    const badgeId = vb.global_badge_id || vb.global_badge_id_resolved;
    if (badgeId) {
      const { upsertUserBadgeLevelPublic } = await import('./badgeEngine.js');
      await upsertUserBadgeLevelPublic(
        userId,
        {
          id: badgeId,
          slug: vb.global_slug || `venue_${String(vb.venue_id).slice(0, 8)}_${vb.slug}`,
          name: vb.global_name || vb.name,
        },
        'novice',
        ritualId
      ).catch(() => {});
    }
    granted += 1;
  }
  return { ok: true, granted };
}

export async function listPendingVenueBadges({ limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT vb.*, v.name AS venue_name
     FROM venue_badges vb
     JOIN venues v ON v.id = vb.venue_id
     WHERE vb.status = 'pending_approval'
     ORDER BY vb.created_at ASC
     LIMIT $1`,
    [Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  return r.rows;
}

async function userMeetsVenueBadgeCondition(userId, vb) {
  const cfg = vb.condition_config || {};
  const th = Math.max(1, Number(cfg.threshold) || 1);
  const type = vb.condition_type;

  if (type === 'visit') {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND r.venue_id = $2 AND ra.checkin_at IS NOT NULL`,
      [userId, vb.venue_id]
    );
    return Number(r.rows[0]?.n || 0) >= th;
  }
  if (type === 'category') {
    const cat = cfg.category;
    if (!cat) return false;
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND r.venue_id = $2
         AND ra.checkin_at IS NOT NULL
         AND LOWER(COALESCE(r.type, r.category, '')) = LOWER($3)`,
      [userId, vb.venue_id, cat]
    );
    return Number(r.rows[0]?.n || 0) >= th;
  }
  if (type === 'slot') {
    if (!cfg.slot_id) return false;
    const r = await pool.query(
      `SELECT 1 FROM venue_slots vs
       JOIN ritual_attendance ra ON ra.ritual_id = vs.ritual_id
       WHERE vs.id = $1 AND ra.user_id = $2 AND ra.checkin_at IS NOT NULL
       LIMIT 1`,
      [cfg.slot_id, userId]
    );
    return r.rows.length > 0;
  }
  if (type === 'event') {
    const key = cfg.event_key;
    if (!key) return false;
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND r.venue_id = $2 AND ra.checkin_at IS NOT NULL
         AND (
           LOWER(COALESCE(r.title, '')) LIKE '%' || LOWER($3) || '%'
           OR COALESCE(r.metadata->>'event_key', '') = $3
         )`,
      [userId, vb.venue_id, key]
    );
    return Number(r.rows[0]?.n || 0) >= th;
  }
  return false;
}

/** Explicit ban: venue cannot hand-distribute */
export async function handDistributeVenueBadge() {
  return {
    ok: false,
    status: 403,
    error: 'Sistem verir; mekan elle dağıtamaz',
  };
}
