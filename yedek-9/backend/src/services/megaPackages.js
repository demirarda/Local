/**
 * LOCAL_Venue_Paketleri_v1 — kilitli ürün kuralları.
 * ⭐ fiyat/oran kalibrasyonu config'de; 🏭 PSP/totem-üretim ve F1.5/F2 yok.
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { canonicalPackageName, isPaidCommerceTier } from './megaSpec.js';

function pkg() {
  return LOCAL_CONFIG.venue?.PACKAGES_STUB || {};
}

export function packageSeats(tierId) {
  const name = canonicalPackageName(tierId);
  const seats = pkg().SEATS || {};
  const row = seats[name] || seats.OPEN || { manager: 1, staff_door: 2 };
  return {
    manager: row.manager == null || row.manager === Infinity ? Number.POSITIVE_INFINITY : Number(row.manager),
    staff_door: Number(row.staff_door ?? 2),
    bonds_unlimited: true,
  };
}

export function assertAuthoritySeat({ tierId, role, managerCount = 0, staffCount = 0 } = {}) {
  const caps = packageSeats(tierId);
  const r = String(role || 'staff').toLowerCase();
  if (r === 'owner') return { ok: true, reason: 'owner_always', caps };
  if (r === 'manager') {
    if (Number.isFinite(caps.manager) && managerCount >= caps.manager) {
      return {
        ok: false,
        error: `Manager koltuğu doldu (${caps.manager}). Bağ sınırsız; yetki kıt.`,
        code: 'SEAT_MANAGER_FULL',
        caps,
      };
    }
    return { ok: true, caps };
  }
  if (Number.isFinite(caps.staff_door) && staffCount >= caps.staff_door) {
    return {
      ok: false,
      error: `Staff-door koltuğu doldu (${caps.staff_door}). Kapı-ekranı cihaz kotası.`,
      code: 'SEAT_DOOR_FULL',
      caps,
    };
  }
  return { ok: true, caps };
}

export function takeRateForTier(tierId) {
  const name = canonicalPackageName(tierId);
  const rates = pkg().TAKE_RATE || { OPERATOR: 0.08, LANDMARK: 0.05, ORG_FLOOR: 0.04 };
  if (name === 'LANDMARK') return { rate: Number(rates.LANDMARK ?? 0.05), ladder: 'landmark', billed: true };
  if (name === 'OPERATOR') return { rate: Number(rates.OPERATOR ?? 0.08), ladder: 'operator', billed: true };
  return { rate: null, ladder: 'open', billed: false, reason: 'OPEN_NO_COMMERCE' };
}

export function announcementQuotaMo(tierId) {
  const name = canonicalPackageName(tierId);
  const q = pkg().ANNOUNCE_QUOTA_MO || { OPEN: 0, OPERATOR: 4, LANDMARK: 12 };
  return Number(q[name] ?? 0);
}

export function assertAnnouncementAllowed({ tierId, sentThisMonth = 0 } = {}) {
  const cap = announcementQuotaMo(tierId);
  if (cap <= 0) {
    return {
      ok: false,
      error: 'OPEN takipçi-zili var; duyuru-push yok — OPERATOR+ gerekir',
      code: 'ANNOUNCE_OPEN_NO_PUSH',
      cap: 0,
    };
  }
  if (sentThisMonth >= cap) {
    return { ok: false, error: `Aylık duyuru kotası doldu (${cap})`, code: 'ANNOUNCE_QUOTA', cap };
  }
  return { ok: true, cap, remaining: cap - sentThisMonth };
}

export function badgeStudioQuota(tierId) {
  const name = canonicalPackageName(tierId);
  const q = pkg().BADGE_STUDIO || {
    OPEN: { max: 0, kinds: [] },
    OPERATOR: { max: 2, kinds: ['A'] },
    LANDMARK: { max: 5, kinds: ['A', 'B'] },
  };
  return q[name] || q.OPEN;
}

export function assertBadgeStudioKind({ tierId, kind = 'A', seller = false } = {}) {
  const q = badgeStudioQuota(tierId);
  const k = String(kind || 'A').toUpperCase() === 'B' ? 'B' : 'A';
  if (!q.max) {
    return { ok: false, error: "FREE'de badge üretimi yok — OPERATOR+ gerekli", code: 'BADGE_STUDIO_OPERATOR' };
  }
  if (seller && k === 'A') {
    return { ok: false, error: "Seller TÜR-A üretmez — sicil+chip yeter", code: 'BADGE_SELLER_NO_A' };
  }
  if (!q.kinds.includes(k)) {
    return {
      ok: false,
      error: k === 'B' ? 'TÜR-B yalnız LANDMARK' : 'Bu katta bu rozet türü yok',
      code: 'BADGE_KIND_TIER',
    };
  }
  return { ok: true, kind: k, max: q.max, kinds: q.kinds };
}

export function assertPaidVenueMoney({ amount = 0, venueId = null, venueTier = 'free' } = {}) {
  if (!Number(amount)) return { ok: true };
  if (!venueId) return { ok: true, reason: 'custom_or_zone' };
  if (!isPaidCommerceTier(venueTier)) {
    return {
      ok: false,
      error: 'ücretli masa için mekanın ticaret-katmanı gerekli',
      code: 'PAID_R_REQUIRES_OPERATOR',
    };
  }
  return { ok: true, take_rate: takeRateForTier(venueTier) };
}

export function assertSelfRezFineTune({ venueTier, perRafMode = null } = {}) {
  if (!perRafMode) return { ok: true, default: true };
  if (!isPaidCommerceTier(venueTier)) {
    return {
      ok: false,
      error: 'Raf-başına ⚡/⏳ ince ayar OPERATOR+ konforu',
      code: 'SELFREZ_FINE_TUNE_OPERATOR',
    };
  }
  const mode = String(perRafMode).toUpperCase();
  if (!['INSTANT', 'APPROVAL'].includes(mode)) {
    return { ok: false, error: 'self_rez_mode INSTANT|APPROVAL', code: 'SELFREZ_MODE' };
  }
  return { ok: true, mode };
}

export function nightReportModeForTier(tierId) {
  return isPaidCommerceTier(tierId) ? 'full' : 'summary_3';
}

export function seriesSleepWeeks() {
  return Number(pkg().SERIES_EMPTY_SLEEP_W ?? 3);
}

export function seriesIntelligenceAllowed(tierId) {
  return isPaidCommerceTier(tierId);
}

export function seriesVitrinePriority(tierId) {
  return canonicalPackageName(tierId) === 'LANDMARK';
}

export function customFigurOnLandmark(tierId) {
  return canonicalPackageName(tierId) === 'LANDMARK';
}

export function followerPushAllowed(tierId) {
  return isPaidCommerceTier(tierId);
}

export function packageEur(tierId) {
  const name = canonicalPackageName(tierId);
  const eur = pkg().PRICE_EUR || { OPERATOR: 300, LANDMARK: 500, OPEN: 0 };
  return Number(eur[name] ?? 0);
}

export function multiBranchDiscountVisible() {
  return pkg().MULTI_BRANCH_DISCOUNT_VISIBLE !== false;
}
