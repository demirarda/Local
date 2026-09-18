/**
 * §12 üyelik vitrini — mekan planı + SELLER-AT-VENUE + ORG-TO-ORG.
 * Launch-direkt (flag değil). Satıcı künyesi zorunlu. Payout satıcıya.
 * RS/DS'e dokunmaz.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const SELLER_TYPES = new Set(['venue', 'seller_at_venue', 'org_to_org', 'brand']);
const PLAN_KINDS = new Set(['monthly', 'credit']);

export function formatSellerLabel({ seller_name, seller_verified } = {}) {
  const name = String(seller_name || '').trim();
  if (!name) return null;
  return `Satıcı: ${name}${seller_verified ? ' ✓' : ''}`;
}

export function membershipVitrineDefaultOn() {
  return LOCAL_CONFIG.venue?.MEMBERSHIP_VITRINE_DEFAULT !== false;
}

function dtoFromRow(row, { sicil = null, enrolled = false } = {}) {
  const seller_label = formatSellerLabel(row);
  return {
    id: row.id,
    host_venue_id: row.host_venue_id,
    seller_type: row.seller_type,
    seller_venue_id: row.seller_venue_id,
    seller_user_id: row.seller_user_id,
    seller_name: row.seller_name,
    seller_verified: Boolean(row.seller_verified),
    seller_label,
    title: row.title,
    plan_kind: row.plan_kind,
    credits: row.credits != null ? Number(row.credits) : null,
    auto_drop_on_seal: row.auto_drop_on_seal !== false,
    instant_admit: row.instant_admit !== false,
    active: row.active !== false,
    payout_to: row.seller_user_id || row.seller_venue_id || row.host_venue_id,
    venue_share: null,
    rs_touch: false,
    ds_touch: false,
    seller_sicil: sicil,
    enrolled,
  };
}

export async function isMembershipVitrineEnabled(venueId) {
  try {
    const r = await pool.query(
      `SELECT membership_vitrine_enabled FROM venues WHERE id = $1`,
      [venueId]
    );
    if (!r.rows[0]) return membershipVitrineDefaultOn();
    const v = r.rows[0].membership_vitrine_enabled;
    if (v == null) return membershipVitrineDefaultOn();
    return v !== false;
  } catch (_e) {
    return membershipVitrineDefaultOn();
  }
}

export async function setMembershipVitrineEnabled(venueId, enabled) {
  const on = enabled !== false;
  await pool.query(
    `UPDATE venues SET membership_vitrine_enabled = $2, updated_at = NOW() WHERE id = $1`,
    [venueId, on]
  );
  return { enabled: on };
}

async function sellerSicilForPlan(row) {
  try {
    const r = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE kind = 'attempted')::int AS attempted,
         COUNT(*) FILTER (WHERE kind = 'fulfilled')::int AS fulfilled,
         COUNT(*) FILTER (WHERE kind = 'denied')::int AS denied
       FROM seller_fulfillment_events
       WHERE ($1::uuid IS NOT NULL AND seller_user_id = $1)
          OR ($2::uuid IS NOT NULL AND seller_venue_id = $2)`,
      [row.seller_user_id || null, row.seller_venue_id || row.host_venue_id]
    );
    const a = r.rows[0] || {};
    return {
      attempted: Number(a.attempted) || 0,
      fulfilled: Number(a.fulfilled) || 0,
      denied: Number(a.denied) || 0,
    };
  } catch (_e) {
    return { attempted: 0, fulfilled: 0, denied: 0 };
  }
}

export async function listMembershipPlans(venueId, { includeInactive = false, viewerUserId = null } = {}) {
  let rows = [];
  try {
    rows = (
      await pool.query(
        `SELECT * FROM venue_membership_plans
         WHERE host_venue_id = $1
           AND ($2::boolean = true OR active = true)
         ORDER BY created_at ASC`,
        [venueId, includeInactive]
      )
    ).rows;
  } catch (_e) {
    return [];
  }

  const enrolled = new Set();
  if (viewerUserId && rows.length) {
    try {
      const en = await pool.query(
        `SELECT plan_id FROM venue_membership_enrollments
         WHERE user_id = $1 AND plan_id = ANY($2::uuid[]) AND status = 'active'`,
        [viewerUserId, rows.map((p) => p.id)]
      );
      for (const e of en.rows) enrolled.add(String(e.plan_id));
    } catch (_e) {
      /* ignore */
    }
  }

  const out = [];
  for (const row of rows) {
    const sicil = await sellerSicilForPlan(row);
    out.push(dtoFromRow(row, { sicil, enrolled: enrolled.has(String(row.id)) }));
  }
  return out;
}

export function buildMembershipBadge(plans, vitrineEnabled) {
  if (!vitrineEnabled) return null;
  const n = (plans || []).filter((p) => p.active !== false).length;
  if (!n) return null;
  return {
    label: `Üyelik & Kredi satışta · ${n} plan`,
    plan_count: n,
    screen: 'VenueMembership',
  };
}

export async function getVenueMembershipBundle(venueId, { canManage = false, viewerUserId = null } = {}) {
  const enabled = await isMembershipVitrineEnabled(venueId);
  const plans = await listMembershipPlans(venueId, {
    includeInactive: canManage,
    viewerUserId,
  });
  const publicPlans = enabled ? plans.filter((p) => p.active !== false) : [];
  return {
    vitrine_enabled: enabled,
    vitrine_default_on: membershipVitrineDefaultOn(),
    seller_at_venue: LOCAL_CONFIG.venue?.SELLER_AT_VENUE !== false,
    org_to_org: LOCAL_CONFIG.venue?.ORG_TO_ORG !== false,
    badge: buildMembershipBadge(publicPlans, enabled),
    plans: canManage ? plans : publicPlans,
  };
}

export async function createMembershipPlan(venueId, body = {}, { hostName, hostVerified } = {}) {
  const sellerType = String(body.seller_type || 'venue').toLowerCase();
  if (!SELLER_TYPES.has(sellerType)) {
    return { ok: false, status: 400, error: 'Invalid seller_type' };
  }
  if (sellerType === 'seller_at_venue' && LOCAL_CONFIG.venue?.SELLER_AT_VENUE === false) {
    return { ok: false, status: 400, error: 'seller_at_venue required at launch' };
  }
  if (sellerType === 'org_to_org' && LOCAL_CONFIG.venue?.ORG_TO_ORG === false) {
    return { ok: false, status: 400, error: 'org_to_org required at launch' };
  }
  const kind = String(body.plan_kind || 'monthly').toLowerCase();
  if (!PLAN_KINDS.has(kind)) {
    return { ok: false, status: 400, error: 'plan_kind monthly|credit' };
  }
  const title = String(body.title || '').trim().slice(0, 80);
  if (!title) return { ok: false, status: 400, error: 'title required' };

  let sellerName = String(body.seller_name || '').trim();
  let sellerVerified = Boolean(body.seller_verified);
  if (sellerType === 'venue') {
    sellerName = sellerName || String(hostName || '').trim();
    if (hostVerified) sellerVerified = true;
  }
  if (!sellerName) {
    return { ok: false, status: 400, error: 'Satıcı künyesi zorunlu (Satıcı: X ✓)' };
  }

  const { assertVenuePaidCommerce } = await import('./megaLockFlows.js');
  const paid = await assertVenuePaidCommerce(venueId);
  if (!paid.ok) return { ...paid, status: paid.status || 403 };

  try {
    const r = await pool.query(
      `INSERT INTO venue_membership_plans (
         host_venue_id, seller_type, seller_venue_id, seller_user_id,
         seller_name, seller_verified, title, plan_kind, credits,
         auto_drop_on_seal, instant_admit, active
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
       RETURNING *`,
      [
        venueId,
        sellerType,
        body.seller_venue_id || (sellerType === 'venue' ? venueId : null),
        body.seller_user_id || null,
        sellerName,
        sellerVerified,
        title,
        kind,
        kind === 'credit' ? Number(body.credits) || 1 : null,
        body.auto_drop_on_seal !== false,
        body.instant_admit !== false,
      ]
    );
    return { ok: true, plan: dtoFromRow(r.rows[0]) };
  } catch (e) {
    return { ok: false, status: 500, error: e.message || 'plan insert failed' };
  }
}

export async function setPlanActive(venueId, planId, active) {
  const r = await pool.query(
    `UPDATE venue_membership_plans
     SET active = $3
     WHERE id = $2 AND host_venue_id = $1
     RETURNING *`,
    [venueId, planId, active !== false]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Plan not found' };
  return { ok: true, plan: dtoFromRow(r.rows[0]) };
}

/**
 * [Kaydım var] — anında kayıt. RS/DS yazılmaz.
 */
export async function enrollMembership(planId, userId) {
  const plan = await pool.query(`SELECT * FROM venue_membership_plans WHERE id = $1 AND active = true`, [
    planId,
  ]);
  if (!plan.rows[0]) return { ok: false, status: 404, error: 'Plan not found' };
  const row = plan.rows[0];
  const { assertVenuePaidCommerce } = await import('./megaLockFlows.js');
  const paid = await assertVenuePaidCommerce(row.host_venue_id);
  if (!paid.ok) return { ...paid, status: paid.status || 403 };
  try {
    await pool.query(
      `INSERT INTO venue_membership_enrollments (plan_id, user_id, status, credits_left)
       VALUES ($1, $2, 'active', $3)
       ON CONFLICT (plan_id, user_id) DO UPDATE SET status = 'active'`,
      [planId, userId, row.plan_kind === 'credit' ? Number(row.credits) || 1 : null]
    );
    await pool.query(
      `INSERT INTO seller_fulfillment_events
         (seller_user_id, seller_venue_id, host_venue_id, plan_id, kind)
       VALUES ($1,$2,$3,$4,'attempted')`,
      [
        row.seller_user_id,
        row.seller_venue_id || row.host_venue_id,
        row.host_venue_id,
        planId,
      ]
    ).catch(() => {});
    const { takeRateForTier } = await import('./megaPackages.js');
    const { resolveTierFromVenue } = await import('./venuePackageService.js');
    const v = await pool.query(
      `SELECT subscription_tier, pro_enabled, city_partner_enabled FROM venues WHERE id = $1`,
      [row.host_venue_id]
    );
    return {
      ok: true,
      enrolled: true,
      rs_touch: false,
      ds_touch: false,
      take_rate: takeRateForTier(resolveTierFromVenue(v.rows[0] || {})),
    };
  } catch (e) {
    return { ok: false, status: 500, error: e.message || 'enroll failed' };
  }
}

/** Mühürde kredi oto-düşüm — RS/DS yok. */
export async function applySealCreditDrop({ userId, venueId }) {
  if (!userId || !venueId) return { dropped: 0 };
  try {
    const r = await pool.query(
      `UPDATE venue_membership_enrollments e
       SET credits_left = GREATEST(0, COALESCE(e.credits_left, p.credits, 1) - 1)
       FROM venue_membership_plans p
       WHERE e.plan_id = p.id
         AND e.user_id = $1
         AND e.status = 'active'
         AND p.active = true
         AND p.auto_drop_on_seal = true
         AND p.plan_kind = 'credit'
         AND p.host_venue_id = $2
       RETURNING e.id`,
      [userId, venueId]
    );
    return { dropped: r.rowCount || 0, rs_touch: false };
  } catch (_e) {
    return { dropped: 0 };
  }
}
