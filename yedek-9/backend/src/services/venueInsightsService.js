/**
 * Venue insights — chip trends · AI aylık tavsiye · brand-slot (ticari kanal)
 * LOCAL v2 §8 — kullanıcı-yüzü sıralamadan bağımsız brand önceliği
 */
import pool from '../config/database.js';
import {
  hasPackageFeature,
  resolveTierFromVenue,
  loadVenuePackageRow,
} from './venuePackageService.js';
import { buildMonthlyPulse } from './monthlyPulseService.js';

export async function getChipTrends(venueId, { days = 30 } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  const tier = resolveTierFromVenue(venue);
  if (!hasPackageFeature(venue, 'chip_trends') && tier === 'free') {
    return { ok: false, status: 403, error: 'Chip trendleri OPERATÖR+ gerektirir' };
  }

  const fromStats = await pool.query(
    `SELECT chip_id, feeling, count
     FROM feedback_chip_stats
     WHERE venue_id = $1
     ORDER BY count DESC
     LIMIT 40`,
    [venueId]
  ).catch(() => ({ rows: [] }));

  const fromFeedback = await pool.query(
    `SELECT f.chip_id,
            LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, '')) AS feeling,
            COUNT(*)::int AS count
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE r.venue_id = $1
       AND f.chip_id IS NOT NULL
       AND COALESCE(f.submitted_at, f.created_at) >= NOW() - ($2 || ' days')::interval
     GROUP BY f.chip_id, LOWER(COALESCE(f.p2v_feeling, f.p2r_feeling, f.r1_self, ''))
     ORDER BY count DESC
     LIMIT 40`,
    [venueId, String(days)]
  ).catch(() => ({ rows: [] }));

  const rows = fromStats.rows.length ? fromStats.rows : fromFeedback.rows;
  const byChip = {};
  for (const row of rows) {
    const id = row.chip_id;
    if (!byChip[id]) byChip[id] = { chip_id: id, green: 0, yellow: 0, red: 0, total: 0 };
    const f = String(row.feeling || '').toLowerCase();
    const n = Number(row.count) || 0;
    if (f === 'green' || f === 'g') byChip[id].green += n;
    else if (f === 'yellow' || f === 'y') byChip[id].yellow += n;
    else if (f === 'red' || f === 'r') byChip[id].red += n;
    byChip[id].total += n;
  }
  const trends = Object.values(byChip).sort((a, b) => b.total - a.total);
  return {
    ok: true,
    venue_id: venueId,
    window_days: days,
    trends,
    top: trends[0] || null,
    attention: trends.filter((t) => t.red >= t.green).slice(0, 3),
  };
}

/** Rule-based AI aylık tavsiye (HAKİM) — LLM yok, metrikten üretir */
export async function getAiMonthlyAdvice(venueId, { month } = {}) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  if (resolveTierFromVenue(venue) !== 'hakim') {
    return { ok: false, status: 403, error: 'AI aylık tavsiye HAKİM pakette' };
  }

  const pulse = await buildMonthlyPulse(venueId, { month });
  if (!pulse.ok) return pulse;
  const chips = await getChipTrends(venueId, { days: 30 });
  const advice = [];

  if ((pulse.dead_day_delta_pct || 0) >= 20) {
    advice.push({
      priority: 'high',
      title: 'Ölü gün fırsatı',
      body: `Ölü-gün doluluk farkı %${pulse.dead_day_delta_pct}. Düşük günlere Instant veya Takeover slot aç.`,
    });
  }
  if ((pulse.regular_growth?.new_regulars || 0) === 0) {
    advice.push({
      priority: 'med',
      title: 'Regular büyümesi durgun',
      body: 'Bu ay yeni Regular yok. Regular-only slot veya tekrarlayan seriler dene.',
    });
  } else {
    advice.push({
      priority: 'low',
      title: 'Regular büyüyor',
      body: `+${pulse.regular_growth.new_regulars} yeni Regular — sadakat slotlarını koru.`,
    });
  }

  const top = chips.ok ? chips.top : null;
  if (top) {
    advice.push({
      priority: 'med',
      title: 'Chip trendi',
      body: `Öne çıkan chip: ${top.chip_id} (${top.total}). Dikkat chip'leri: ${(chips.attention || []).map((a) => a.chip_id).join(', ') || 'yok'}.`,
    });
  }

  const heatPeak = (pulse.heatmap || []).slice().sort((a, b) => (b.n || 0) - (a.n || 0))[0];
  if (heatPeak) {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    advice.push({
      priority: 'med',
      title: 'Isı zirvesi',
      body: `En yoğun: ${days[heatPeak.dow] || heatPeak.dow} saat ${heatPeak.hour}:00 (${heatPeak.n} Ritual). Kapasiteyi o banda kaydır.`,
    });
  }

  if (!advice.length) {
    advice.push({
      priority: 'low',
      title: 'Veri birikiyor',
      body: 'Daha fazla Ritual sonrası tavsiyeler netleşir.',
    });
  }

  return {
    ok: true,
    venue_id: venueId,
    month: pulse.month,
    advice,
    source: 'rule_engine_v1',
  };
}

/** Ticari eşleşme kanalı — kullanıcı-yüzü sıralamayla ilgisi yok */
export async function listBrandPrioritySlots({ city, limit = 20 } = {}) {
  const r = await pool.query(
    `SELECT s.*, v.name AS venue_name, v.city AS venue_city, v.subscription_tier
     FROM venue_slots s
     JOIN venues v ON v.id = s.venue_id
     WHERE s.brand_priority = true
       AND s.status::text = 'open'
       AND v.subscription_tier::text IN ('hakim', 'city_partner')
       AND ($1::text IS NULL OR LOWER(v.city) = LOWER($1))
     ORDER BY s.starts_at ASC NULLS LAST, s.created_at DESC
     LIMIT $2`,
    [city || null, Math.min(Number(limit) || 20, 50)]
  );
  return { ok: true, channel: 'brand_slot', slots: r.rows };
}

export async function setSlotBrandPriority(venueId, slotId, enabled, managerUserId) {
  const venue = await loadVenuePackageRow(venueId);
  if (!venue) return { ok: false, status: 404, error: 'Venue not found' };
  if (resolveTierFromVenue(venue) !== 'hakim') {
    return { ok: false, status: 403, error: 'Brand-slot önceliği HAKİM pakette' };
  }
  const upd = await pool.query(
    `UPDATE venue_slots SET brand_priority = $3, updated_at = NOW()
     WHERE id = $1 AND venue_id = $2
     RETURNING *`,
    [slotId, venueId, Boolean(enabled)]
  );
  if (!upd.rows[0]) return { ok: false, status: 404, error: 'Slot not found' };
  return { ok: true, slot: upd.rows[0] };
}
