/**
 * Venue package economy — LOCAL v2 §8
 * FREE / OPERATOR / HAKIM · concurrent slots · price multiplier · takeover · sales trigger
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const STUB = () => LOCAL_CONFIG.venue?.PACKAGES_STUB || {};

/** Map legacy + §8 tier ids → canonical free|operator|hakim */
export function normalizeTierId(raw) {
  const t = String(raw || 'free').toLowerCase().trim();
  if (t === 'operator' || t === 'pro') return 'operator';
  if (t === 'hakim' || t === 'city_partner' || t === 'partner') return 'hakim';
  if (t === 'free' || t === 'basic' || t === 'none') return 'free';
  return 'free';
}

export function resolveTierFromVenue(venue = {}) {
  const raw = String(venue.subscription_tier || '').toLowerCase();
  if (
    venue.city_partner_enabled ||
    raw === 'city_partner' ||
    raw === 'hakim'
  ) {
    return 'hakim';
  }
  if (venue.pro_enabled || raw === 'pro' || raw === 'operator') {
    return 'operator';
  }
  return 'free';
}

export function getTierDef(tierId) {
  const id = normalizeTierId(tierId);
  return (STUB().tiers || []).find((t) => t.id === id) || { id, concurrent_slots: 1, features: [] };
}

export function isCompactBandEnabled() {
  if (LOCAL_CONFIG.compact?.enabled === false) return false;
  if (STUB().COMPACT_ENABLED === false) return false;
  if (LOCAL_CONFIG.open?.compact_band_approved === false) return false;
  return true;
}

export function resolveSizeMultiplier(venue = {}) {
  if (venue.size_multiplier != null && Number(venue.size_multiplier) > 0) {
    return Number(venue.size_multiplier);
  }
  if (!isCompactBandEnabled()) return 1.0;
  const seats = Number(venue.total_seats || venue.max_seats || 0);
  const mult = Number(LOCAL_CONFIG.compact?.SEAT_LE40_MULT || STUB().SIZE_MULT) || 0.7;
  if (seats > 0 && seats <= 40) return mult;
  return 1.0;
}

/** package_price = base × size_multiplier */
export function packagePrice(baseTry, venue = {}) {
  const base = Number(baseTry) || 0;
  return Math.round(base * resolveSizeMultiplier(venue));
}

export function isTakeoverActive(venue = {}) {
  if (!venue.takeover_until) return false;
  return new Date(venue.takeover_until).getTime() > Date.now();
}

export function getConcurrentSlotCap(venue = {}) {
  if (isTakeoverActive(venue)) return Number.POSITIVE_INFINITY;
  const tier = resolveTierFromVenue(venue);
  const def = getTierDef(tier);
  const base =
    tier === 'hakim'
      ? Number(STUB().HAKIM_SLOTS) || def.concurrent_slots || 5
      : tier === 'operator'
        ? Number(STUB().OP_SLOTS) || def.concurrent_slots || 3
        : Number(STUB().FREE_SLOTS_MO) || 1;
  const addon = Math.max(0, Number(venue.addon_slots) || 0);
  return base + addon;
}

export function hasPackageFeature(venue = {}, feature) {
  const tier = resolveTierFromVenue(venue);
  if (tier === 'hakim') {
    const hakim = getTierDef('hakim').features || [];
    const op = getTierDef('operator').features || [];
    return feature === 'operator_all' || hakim.includes(feature) || op.includes(feature);
  }
  if (tier === 'operator') {
    return (getTierDef('operator').features || []).includes(feature);
  }
  return (getTierDef('free').features || []).includes(feature);
}

/**
 * sonMD §4 TOTEM — ilk kasa/giriş herkese açık; masa totemleri Operatör+ veya VEN_EVENT set.
 */
export async function assertCanAddTableTotem(venueId) {
  const count = await pool.query(
    `SELECT COUNT(*)::int AS n FROM venue_portals WHERE venue_id = $1`,
    [venueId]
  );
  if (Number(count.rows[0]?.n || 0) < 1) {
    return { ok: true, reason: 'mandatory_first' };
  }

  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  if (hasPackageFeature(venue, 'masa_totem') || resolveTierFromVenue(venue) !== 'free') {
    return { ok: true, reason: 'operator' };
  }

  const ev = await pool.query(
    `SELECT 1 FROM rituals
     WHERE venue_id = $1
       AND origin = 'VEN_EVENT'
       AND collapsed_at IS NULL
       AND status::text NOT IN ('cancelled', 'archived', 'closed', 'draft', 'created')
       AND (status::text IN ('live', 'prelobby', 'active') OR start_time >= NOW() - INTERVAL '1 day')
     LIMIT 1`,
    [venueId]
  );
  if (ev.rows.length) return { ok: true, reason: 'event_set' };

  return {
    ok: false,
    status: 403,
    error: 'Masa totemleri Operatör+ veya event-set gerektirir',
    code: 'TABLE_TOTEM_OPERATOR_REQUIRED',
  };
}

export async function loadVenuePackageRow(venueId) {
  const r = await pool.query(
    `SELECT id, name, subscription_tier, pro_enabled, city_partner_enabled, package_stub,
            size_multiplier, addon_slots, takeover_until, takeover_started_at,
            sales_unlocked_at, free_slot_month_key, free_slots_used_month,
            featured_event_card, closing_time, floor_plan, package_stub,
            mini_report_month_key, included_takeover_month_key, included_takeovers_used
     FROM venues WHERE id = $1`,
    [venueId]
  );
  return r.rows[0] || null;
}

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function countOpenSlots(venueId) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM venue_slots
     WHERE venue_id = $1 AND status::text IN ('open', 'claimed')`,
    [venueId]
  );
  return Number(r.rows[0]?.n || 0);
}

/** Enforce concurrent / FREE monthly slot caps before create */
export async function assertCanCreateVenueSlot(venueId, { timeMode } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };

  const tier = resolveTierFromVenue(venue);
  const mode = String(timeMode || 'fixed').toLowerCase();

  if ((mode === 'recurring' || mode === 'instant') && tier === 'free') {
    return { ok: false, status: 403, error: 'Recurring/Instant requires OPERATOR+' };
  }

  if (isTakeoverActive(venue)) {
    return { ok: true, venue, tier, takeover: true };
  }

  if (tier === 'free') {
    const key = monthKey();
    let used = Number(venue.free_slots_used_month) || 0;
    if (venue.free_slot_month_key !== key) used = 0;
    const lim = Number(STUB().FREE_SLOTS_MO) || 1;
    if (used >= lim) {
      return {
        ok: false,
        status: 403,
        error: `FREE paket: ayda ${lim} slot (devretmez). OPERATÖR'e yükselt.`,
      };
    }
    return { ok: true, venue, tier, free_month_key: key, free_used: used };
  }

  const open = await countOpenSlots(venueId);
  const cap = getConcurrentSlotCap(venue);
  if (open >= cap) {
    return {
      ok: false,
      status: 403,
      error: `Eşzamanlı slot limiti doldu (${cap}). Ek slot veya Takeover alın.`,
    };
  }
  return { ok: true, venue, tier, open, cap };
}

export async function recordFreeSlotUsage(venueId) {
  const key = monthKey();
  await pool.query(
    `UPDATE venues
     SET free_slot_month_key = $2,
         free_slots_used_month = CASE
           WHEN free_slot_month_key = $2 THEN free_slots_used_month + 1
           ELSE 1
         END
     WHERE id = $1`,
    [venueId, key]
  );
}

export function computeTakeoverPriceTry(venue = {}, { dayType = 'weekday' } = {}) {
  const formula = STUB().TAKEOVER_FORMULA || {
    weekday: 0.3,
    weekend: 0.5,
    friday: 0.5,
  };
  const tier = resolveTierFromVenue(venue);
  const base =
    tier === 'hakim' ? Number(STUB().PRICE_HAKIM) || 19900 : Number(STUB().PRICE_OP) || 7900;
  const priced = packagePrice(base, venue);
  // Master §12: paket × gün-tipi oranı (hafta içi %30 / sonu %50)
  // Legacy fallback: package_pct × dayMult
  let pct = Number(formula[dayType] ?? formula.weekday);
  if (!Number.isFinite(pct) || pct <= 0) pct = 0.3;
  if (formula.package_pct != null && Number(formula.weekday) >= 1) {
    pct = Number(formula.package_pct) * Number(formula[dayType] ?? formula.weekday ?? 1);
  }
  return Math.round(priced * pct);
}

/** Start 24h LOCAL TAKEOVER — slot cap lifts + discovery flag */
export async function startVenueTakeover(venueId, { dayType = 'weekday', included = false } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const tier = resolveTierFromVenue(venue);
  if (!included && tier !== 'hakim' && tier !== 'operator') {
    return { ok: false, status: 403, error: 'Takeover requires OPERATOR+ or add-on purchase' };
  }
  if (included && tier !== 'hakim') {
    return { ok: false, status: 403, error: 'Aylık dahil Takeover yalnız HAKİM pakette' };
  }

  const key = monthKey();
  if (included) {
    let used = Number(venue.included_takeovers_used) || 0;
    if (venue.included_takeover_month_key !== key) used = 0;
    if (used >= 1) {
      return {
        ok: false,
        status: 403,
        error: 'HAKİM dahil Takeover bu ay kullanıldı (ayda 1)',
      };
    }
  }

  if (isTakeoverActive(venue)) {
    return { ok: false, status: 409, error: 'Takeover zaten aktif', until: venue.takeover_until };
  }

  const until = new Date(Date.now() + 24 * 3600 * 1000);
  const price = included ? 0 : computeTakeoverPriceTry(venue, { dayType });
  const stub = {
    ...(venue.package_stub || {}),
    last_takeover: {
      started_at: new Date().toISOString(),
      until: until.toISOString(),
      price_try: price,
      day_type: dayType,
      included: Boolean(included),
      discovery_flag: true,
    },
  };

  const upd = await pool.query(
    `UPDATE venues
     SET takeover_started_at = NOW(),
         takeover_until = $2,
         package_stub = $3::jsonb,
         included_takeover_month_key = CASE WHEN $4 THEN $5 ELSE included_takeover_month_key END,
         included_takeovers_used = CASE
           WHEN $4 AND included_takeover_month_key = $5 THEN included_takeovers_used + 1
           WHEN $4 THEN 1
           ELSE included_takeovers_used
         END
     WHERE id = $1
     RETURNING *`,
    [venueId, until.toISOString(), JSON.stringify(stub), Boolean(included), key]
  );

  // Discovery zil: şehirdeki kullanıcılara takeover işareti (feed flag ayrı; push manager'lara)
  try {
    const { notifyVenueTakeover } = await import('./notifications.js');
    const managers = await pool.query(`SELECT user_id FROM venue_managers WHERE venue_id = $1`, [
      venueId,
    ]);
    for (const m of managers.rows) {
      notifyVenueTakeover(m.user_id, { venueId, until }).catch(() => {});
    }
  } catch (_e) {
    /* best effort */
  }

  return { ok: true, venue: upd.rows[0], price_try: price, until, discovery_flag: true };
}

export async function purchaseAddonSlot(venueId, { qty = 1 } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const n = Math.max(1, Math.min(5, Number(qty) || 1));
  const unit = Number(STUB().ADDON_SLOT) || 2000;
  const upd = await pool.query(
    `UPDATE venues SET addon_slots = COALESCE(addon_slots, 0) + $2 WHERE id = $1 RETURNING *`,
    [venueId, n]
  );
  return {
    ok: true,
    venue: upd.rows[0],
    addon_slots: upd.rows[0].addon_slots,
    price_try: unit * n,
    unit_price_try: unit,
  };
}

/** Sales trigger: N ritual + X check-in + dead-day Δ% */
export async function evaluateSalesTrigger(venueId) {
  const trigger = STUB().TRIGGER || {};
  const nNeed = Number(trigger.N_RITUAL);
  const xNeed = Number(trigger.X_CHECKIN);
  const deadNeed = Number(trigger.DEAD_DAY_DELTA);
  if (![nNeed, xNeed].every((n) => Number.isFinite(n) && n > 0)) {
    return { ok: true, unlocked: false, reason: 'thresholds_unset' };
  }

  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  if (venue.sales_unlocked_at) {
    return { ok: true, unlocked: true, since: venue.sales_unlocked_at };
  }

  const stats = await pool.query(
    `SELECT
       COUNT(DISTINCT r.id)::int AS ritual_n,
       COUNT(DISTINCT ra.user_id) FILTER (WHERE ra.checkin_at IS NOT NULL)::int AS checkin_n
     FROM rituals r
     LEFT JOIN ritual_attendance ra ON ra.ritual_id = r.id
     WHERE r.venue_id = $1
       AND r.start_time >= NOW() - INTERVAL '90 days'
       AND r.status::text NOT IN ('cancelled', 'draft')`,
    [venueId]
  );
  const ritualN = Number(stats.rows[0]?.ritual_n || 0);
  const checkinN = Number(stats.rows[0]?.checkin_n || 0);

  let deadOk = true;
  let deadDelta = null;
  if (Number.isFinite(deadNeed) && deadNeed > 0) {
    const dead = await pool.query(
      `WITH daily AS (
         SELECT DATE(r.start_time) AS d,
                COUNT(*)::float AS cnt
         FROM rituals r
         WHERE r.venue_id = $1
           AND r.start_time >= NOW() - INTERVAL '60 days'
         GROUP BY 1
       ),
       ranked AS (
         SELECT cnt, NTILE(4) OVER (ORDER BY cnt) AS q FROM daily
       )
       SELECT
         COALESCE(AVG(cnt) FILTER (WHERE q = 1), 0) AS low,
         COALESCE(AVG(cnt) FILTER (WHERE q = 4), 0) AS high
       FROM ranked`,
      [venueId]
    );
    const low = Number(dead.rows[0]?.low || 0);
    const high = Number(dead.rows[0]?.high || 0);
    deadDelta = high > 0 ? ((high - low) / high) * 100 : 0;
    deadOk = deadDelta >= deadNeed;
  }

  const pass = ritualN >= nNeed && checkinN >= xNeed && deadOk;
  if (pass) {
    await pool.query(
      `UPDATE venues SET sales_unlocked_at = COALESCE(sales_unlocked_at, NOW()) WHERE id = $1`,
      [venueId]
    );
  }
  return {
    ok: true,
    unlocked: pass,
    metrics: { ritual_n: ritualN, checkin_n: checkinN, dead_day_delta_pct: deadDelta },
    thresholds: { N_RITUAL: nNeed, X_CHECKIN: xNeed, DEAD_DAY_DELTA: deadNeed || null },
  };
}

export function buildPackageCatalogV2(venue = {}) {
  const stub = STUB();
  const active = resolveTierFromVenue(venue);
  const venueStub = venue.package_stub && typeof venue.package_stub === 'object' ? venue.package_stub : {};
  const pendingTier = venueStub.pending_upgrade_tier
    ? normalizeTierId(venueStub.pending_upgrade_tier)
    : null;
  const mult = resolveSizeMultiplier(venue);
  const sales = Boolean(venue.sales_unlocked_at);

  return {
    design_pending: Boolean(stub.design_pending),
    active_tier: active,
    size_multiplier: mult,
    addon_slots: Number(venue.addon_slots) || 0,
    takeover_active: isTakeoverActive(venue),
    takeover_until: venue.takeover_until || null,
    sales_unlocked: sales,
    sales_unlocked_at: venue.sales_unlocked_at || null,
    concurrent_cap: getConcurrentSlotCap(venue),
    pending_upgrade_tier: pendingTier,
    upgrade_requests: Array.isArray(venueStub.upgrade_requests) ? venueStub.upgrade_requests.slice(-5) : [],
    addons: {
      extra_slot_try: Number(stub.ADDON_SLOT) || 2000,
      takeover_formula: stub.TAKEOVER_FORMULA,
    },
    tiers: (stub.tiers || []).map((t) => {
      const base = Number(t.price_try) || 0;
      const priced = packagePrice(base, venue);
      return {
        ...t,
        price_try: priced,
        price_try_base: base,
        size_multiplier: mult,
        is_current: t.id === active,
        purchasable: t.id !== 'free' && t.active && active !== t.id && (sales || t.id === 'operator'),
        upgrade_pending: pendingTier === t.id,
      };
    }),
    manager_notes: venueStub.manager_notes || null,
    slot_economy: LOCAL_CONFIG.stubs?.SLOT_ECONOMY_ENABLED
      ? LOCAL_CONFIG.stubs.SLOT_ECONOMY
      : null,
  };
}
