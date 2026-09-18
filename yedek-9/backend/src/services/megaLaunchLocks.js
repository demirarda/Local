/**
 * MEGA kalan launch kilitleri — EK-26 supersede.
 * F-LATER (R-revizyon, Ortak-an v2, Case-7) ve paket SAYI turu yok.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export const BOND_KINDS = ['EKIP', 'REZIDAN', 'MENSUP'];
export const TOTEM_PATH_C = ['STAFF_DEVICE', 'TAP_POINT', 'FIGUR'];
export const ORTAK_AN_TYPES = ['quiz', 'poll', 'announce'];

export const SYMMETRIC_BLOCK_COPY =
  'Bu masada seninle uyumsuzluğu olan biri var — profil verilmez. Yine de katılmak ister misin?';

export const RAF_REQUEST_EN = 'Create a Ritual Request';

export const EVENT_WALKIN_CARD = {
  title: 'Bugün burada LOCAL Event var',
  actions: ['Bilet', 'Masaları gör'],
  tone: 'invite',
};

export function frenForBond(kind) {
  const k = String(kind || '').toUpperCase();
  if (k === 'EKIP') return { witness: false, regular: false, self_p2v: false };
  if (k === 'REZIDAN' || k === 'MENSUP' || k === 'REZİDAN') {
    return { witness: true, regular: true, self_p2v: false };
  }
  return { witness: true, regular: true, self_p2v: true };
}

export function chainFrenActive({ endedAt = null, now = Date.now(), cooldownD = 90, active = false } = {}) {
  if (active) return true;
  if (!endedAt) return false;
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(end)) return false;
  const days = Number(LOCAL_CONFIG.venue?.CHAIN_FREN_COOLDOWN_D ?? cooldownD);
  return now - end < days * 86400000;
}

export function assertE2SeatSale({
  origin,
  roofTicketed = false,
  subPaid = false,
  seats = null,
  price = null,
} = {}) {
  if (String(origin || '').toUpperCase() !== 'VEN_EVENT') return { ok: true };
  if (!subPaid || Number(price) <= 0) {
    return { ok: true, pass: 'free_sub' };
  }
  if (!roofTicketed) {
    return {
      ok: false,
      error: 'Fiyatlı masa-sub önce çatı-bilet ister',
      code: 'E2_ROOF_TICKET',
    };
  }
  const n = Number(seats);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: 'Fiyatlı sub koltuk-modeli (N koltuk)', code: 'E2_SEAT_MODEL' };
  }
  return { ok: true, model: 'seat', seats: n, price: Number(price) };
}

export function eventWalkInMarketingCard() {
  return { ...EVENT_WALKIN_CARD };
}

export function classifyAt20({
  eventDays30 = 0,
  emptyEvents30 = 0,
  walkInShare = 1,
  doorPolicy = 'WALKIN_OPEN',
} = {}) {
  if (String(doorPolicy || '').toUpperCase() === 'SHELF_ONLY') {
    return { exempt: true, signals: [], reason: 'SHELF_ONLY' };
  }
  const signals = [];
  if (eventDays30 >= 20) signals.push({ code: 'S1', level: 'mod', eventDays30 });
  else if (eventDays30 >= 12) signals.push({ code: 'S1', level: 'watch', eventDays30 });
  if (emptyEvents30 >= 4) signals.push({ code: 'S2', level: 'mod', emptyEvents30 });
  if (walkInShare < 0.1 && eventDays30 >= 12) {
    signals.push({ code: 'S3', level: 'signal', walkInShare, eventDays30 });
  }
  return { exempt: false, signals, auto_penalty: false };
}

export function assertP2cZoneCandidate({ isHome = false, people = 0, rituals = 0 } = {}) {
  if (isHome) {
    return { ok: false, code: 'P2C_HOME_NEVER_ZONE', candidate: false };
  }
  const minP = Number(LOCAL_CONFIG.p2c?.ZONE_MIN_PEOPLE ?? 4);
  const minR = Number(LOCAL_CONFIG.p2c?.ZONE_MIN_RITUALS ?? 2);
  if (people < minP || rituals < minR) {
    return { ok: false, code: 'P2C_THRESHOLD', candidate: false, min_people: minP, min_rituals: minR };
  }
  return { ok: true, candidate: true };
}

/** Tam koordinat kamusallaşmaz. */
export function publicCoordPolicy(lat, lng) {
  const round = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return Number(x.toFixed(2));
  };
  return { lat: round(lat), lng: round(lng), exact: false, enters_scores: false };
}

export function venueLifecyclePhase({ lastActivityAt, unansweredNoCapacity = false, now = Date.now() } = {}) {
  if (!lastActivityAt) return { phase: 'active', hours: 0 };
  const hours = (now - new Date(lastActivityAt).getTime()) / 3600000;
  const sped = unansweredNoCapacity ? hours * 2 : hours;
  if (sped < 4) return { phase: 'active', hours: sped };
  if (sped < 8) return { phase: 'silent', hours: sped };
  if (sped < 16) return { phase: 'asleep', hours: sped };
  return { phase: 'archive', hours: sped };
}

/** AT-46: kilit öncesi tam · sonrası replacement-bağlı · mühür sonrası yok. */
export function paidRafRefund({ locked = false, sealed = false, replacementFilled = false } = {}) {
  if (sealed) return { refund: 'none', code: 'POST_SEAL' };
  if (!locked) return { refund: 'full', code: 'PRE_LOCK' };
  return replacementFilled
    ? { refund: 'full', code: 'REPLACEMENT_FILLED' }
    : { refund: 'none', code: 'LATE_NO_REPLACEMENT' };
}

export function assertBrandPublicRafIstek({ target = 'venue' } = {}) {
  const t = String(target || 'venue').toLowerCase();
  if (t === 'brand') {
    return {
      ok: false,
      error: "Brand'e public raf-isteği yok — yalnız bağ kapısı",
      code: 'BRAND_REQUEST_FORBIDDEN',
    };
  }
  return { ok: true };
}

export function bothStamp({ venueId, brandId, both = false } = {}) {
  return Boolean(both || (venueId && brandId));
}

export function kunyeRows({ sellerLabel, brandLogo } = {}) {
  const rows = [];
  if (sellerLabel) rows.push({ kind: 'seller_text', text: sellerLabel });
  const brand = brandLogo ? { kind: 'brand_logo', logo: brandLogo, not_a_row: true } : null;
  return { rows: rows.slice(0, 1), brand_badge: brand, max_text_rows: 2 };
}

export function cityDisplayVeil({ sealsInCity = 0, placementSeals = 5 } = {}) {
  const n = Number(LOCAL_CONFIG.rs?.visibility?.PLACEMENT_SEALS ?? placementSeals);
  return {
    veil: Number(sealsInCity) < n,
    remaining: Math.max(0, n - Number(sealsInCity || 0)),
    copy: 'yeni şehir',
  };
}

export function waitlistPromoteMode({ paid = false } = {}) {
  return paid ? 'OFFER' : 'AUTO';
}

export function waitlistOfferTtlMin() {
  return Number(LOCAL_CONFIG.ritual?.WAITLIST_OFFER_TTL_MIN ?? 15);
}

export function claimRetroTrust() {
  return false;
}

export function claimPinStrength(distanceM) {
  const d = Number(distanceM);
  if (!Number.isFinite(d)) return 'none';
  if (d < 20) return 'strong';
  if (d <= 50) return 'weak';
  return 'out';
}

export function safetyQueueLane() {
  return 'safety';
}

export function totemPathC(raw) {
  const t = String(raw || 'STAFF_DEVICE').toUpperCase();
  if (TOTEM_PATH_C.includes(t)) return t;
  return 'STAFF_DEVICE';
}

export function totemPathLadder() {
  return {
    paths: TOTEM_PATH_C,
    ladder: ['STAFF_DEVICE', 'TAP_POINT', 'FIGUR'],
    copy: 'wifi şifresi sorar gibi mühür istenir',
  };
}

export function assertUserCannotBuyVenuePackage(accountType) {
  const t = String(accountType || '').toLowerCase();
  if (t === 'user' || t === 'person') {
    return { ok: false, error: "Paketler B-account dünyası", code: 'USER_NO_PACKAGE' };
  }
  return { ok: true };
}

export function orgHasPlainFr(orgKind) {
  const k = String(orgKind || '').toLowerCase();
  if (['venue', 'brand', 'both'].includes(k)) return false;
  return true;
}

export function sicilPair({ avgResponseHours, acceptRate } = {}) {
  const h = avgResponseHours != null ? `${Number(avgResponseHours).toFixed(0)}sa` : '—';
  const pct =
    acceptRate == null ? '—' : `%${Math.round(Number(acceptRate) * 100)}`;
  return { label: `${h} · ${pct}`, avg_response_hours: avgResponseHours, accept_rate: acceptRate };
}

export async function resolveOrgFren({ userId, venueId, brandId } = {}) {
  const empty = frenForBond(null);
  if (!userId) return { ...empty, kinds: [] };
  const kinds = [];
  try {
    if (venueId) {
      const staff = await pool.query(
        `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
        [venueId, userId]
      );
      if (staff.rows[0]) kinds.push('EKIP');
    }
  } catch (_e) {
    /* optional */
  }
  try {
    const bonds = await pool.query(
      `SELECT bond_kind, ended_at
       FROM org_bonds
       WHERE user_id = $1
         AND (
           ($2::uuid IS NOT NULL AND org_kind = 'venue' AND org_id = $2)
           OR ($3::uuid IS NOT NULL AND org_kind = 'brand' AND org_id = $3)
         )`,
      [userId, venueId || null, brandId || null]
    );
    const now = Date.now();
    for (const row of bonds.rows) {
      const active = !row.ended_at;
      if (active || chainFrenActive({ endedAt: row.ended_at, now, active: false })) {
        kinds.push(String(row.bond_kind || '').toUpperCase());
      }
    }
  } catch (_e) {
    /* table optional */
  }
  const uniq = [...new Set(kinds)];
  const merged = {
    witness: !uniq.includes('EKIP'),
    regular: !uniq.includes('EKIP'),
    self_p2v: uniq.length === 0,
    kinds: uniq,
  };
  if (uniq.some((k) => k === 'REZIDAN' || k === 'REZİDAN' || k === 'MENSUP' || k === 'EKIP')) {
    merged.self_p2v = false;
  }
  return merged;
}

export async function detectVenueAt20(venueId) {
  const empty = { exempt: false, signals: [], auto_penalty: false };
  if (!venueId) return empty;
  try {
    const v = await pool.query(`SELECT door_policy FROM venues WHERE id = $1`, [venueId]);
    const doorPolicy = v.rows[0]?.door_policy || 'WALKIN_OPEN';
    const days = await pool.query(
      `SELECT
         COUNT(DISTINCT date_trunc('day', start_time))::int AS event_days,
         COUNT(*) FILTER (
           WHERE origin = 'VEN_EVENT'
             AND NOT EXISTS (
               SELECT 1 FROM ritual_event_sub_seals s WHERE s.ritual_id = r.id
             )
         )::int AS empty_events,
         COUNT(*) FILTER (WHERE origin = 'WALK_IN')::int AS walk_ins,
         COUNT(*)::int AS all_r
       FROM rituals r
       WHERE venue_id = $1
         AND start_time >= NOW() - INTERVAL '30 days'
         AND status::text NOT IN ('cancelled')`,
      [venueId]
    );
    const row = days.rows[0] || {};
    const all = Number(row.all_r) || 0;
    return classifyAt20({
      eventDays30: Number(row.event_days) || 0,
      emptyEvents30: Number(row.empty_events) || 0,
      walkInShare: all > 0 ? Number(row.walk_ins || 0) / all : 1,
      doorPolicy,
    });
  } catch (_e) {
    return empty;
  }
}

export async function venueSicilPair(venueId) {
  try {
    const r = await pool.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (COALESCE(decided_at, NOW()) - created_at)) / 3600.0) AS avg_h,
         COUNT(*) FILTER (WHERE status = 'approved')::float
           / NULLIF(COUNT(*) FILTER (WHERE status IN ('approved','rejected')), 0) AS accept_rate
       FROM venue_slot_suggestions
       WHERE venue_id = $1`,
      [venueId]
    );
    return sicilPair({
      avgResponseHours: r.rows[0]?.avg_h != null ? Number(r.rows[0].avg_h) : null,
      acceptRate: r.rows[0]?.accept_rate != null ? Number(r.rows[0].accept_rate) : null,
    });
  } catch (_e) {
    return sicilPair({});
  }
}

export async function citySealsForUser(userId, cityId) {
  if (!userId || !cityId) return 0;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM ritual_attendance ra
       JOIN rituals rit ON rit.id = ra.ritual_id
       WHERE ra.user_id = $1
         AND ra.checkin_phase = 'sealed'
         AND rit.city_id = $2`,
      [userId, cityId]
    );
    return Number(r.rows[0]?.n) || 0;
  } catch (_e) {
    return 0;
  }
}
