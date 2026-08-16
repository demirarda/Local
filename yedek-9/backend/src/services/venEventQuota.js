/**
 * VEN-EVENT aylık tavan — sonMD ⭐ AÇIK (değer BOŞ)
 * MONTHLY_CAP null/0 → sınırsız; pozitif → enforce.
 * İlke: keşif mekan-ilanı çöplüğü olmasın (pivot sonrası doldurulur).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

function venEventCfg() {
  return LOCAL_CONFIG.ritual?.VEN_EVENT || {};
}

export function getVenEventMonthlyCap() {
  const raw = venEventCfg().MONTHLY_CAP;
  if (raw == null || raw === '' || Number(raw) === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function isVenEventCapUnlimited() {
  return getVenEventMonthlyCap() == null;
}

function monthBounds(date = new Date()) {
  const d = new Date(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end, month_key: start.toISOString().slice(0, 7) };
}

/**
 * Bu ay kaç VEN_EVENT (venue_id) oluşturuldu
 */
export async function countVenEventsInMonth(venueId, date = new Date(), client = pool) {
  if (!venueId) return 0;
  const { start, end } = monthBounds(date);
  const countCancelled = venEventCfg().COUNT_CANCELLED === true;
  const r = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM rituals
     WHERE venue_id = $1
       AND origin = 'VEN_EVENT'
       AND created_at >= $2
       AND created_at < $3
       ${countCancelled ? '' : `AND status::text NOT IN ('cancelled', 'draft')`}`,
    [venueId, start.toISOString(), end.toISOString()]
  );
  return Number(r.rows[0]?.c || 0);
}

/**
 * @returns {{ ok: boolean, unlimited: boolean, used: number, cap: number|null, remaining: number|null, month_key: string, status: string, code?: string }}
 */
export async function assertVenEventMonthlyCap(venueId, date = new Date()) {
  const { month_key } = monthBounds(date);
  const cap = getVenEventMonthlyCap();
  const used = venueId ? await countVenEventsInMonth(venueId, date) : 0;
  const status = venEventCfg().MONTHLY_CAP_STATUS || 'open_empty';

  if (cap == null) {
    return {
      ok: true,
      unlimited: true,
      used,
      cap: null,
      remaining: null,
      month_key,
      status,
      note: venEventCfg().MONTHLY_CAP_NOTE || null,
    };
  }

  const remaining = Math.max(0, cap - used);
  if (used >= cap) {
    return {
      ok: false,
      unlimited: false,
      used,
      cap,
      remaining: 0,
      month_key,
      status,
      code: 'VEN_EVENT_MONTHLY_CAP',
      error: `Bu ay VEN-EVENT tavanı doldu (${cap})`,
    };
  }

  return {
    ok: true,
    unlimited: false,
    used,
    cap,
    remaining,
    month_key,
    status,
  };
}

export async function getVenEventQuotaSnapshot(venueId) {
  return assertVenEventMonthlyCap(venueId);
}
