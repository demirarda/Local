/**
 * v2 §7 SERIES — seri sahipliği, instance spawn, takip zili, iptal.
 * UI adı: Seri (teknik "recurring" / "SERIES" kullanıcıya gösterilmez).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { notifyRecurringInstance } from './notifications.js';

/** Kadans — UI'da "Her hafta" / "İki haftada bir" */
export const SERIES_CADENCES = {
  WEEKLY: { interval_days: 7, label: 'Her hafta' },
  BIWEEKLY: { interval_days: 14, label: 'İki haftada bir' },
};

export function normalizeCadence(value, intervalDays = null) {
  const raw = String(value || '').toUpperCase();
  if (SERIES_CADENCES[raw]) return raw;
  return Number(intervalDays) === 14 ? 'BIWEEKLY' : 'WEEKLY';
}

/** end_after_weeks: pozitif tamsayı → N tekrar sonra biter; yoksa açık uçlu */
export function normalizeEndAfterWeeks(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(52, Math.round(n));
}

/**
 * recurrence_rule tek kaynak: cadence + end_after_weeks + saat/dakika.
 * interval_days geriye dönük uyumluluk için türetilir.
 */
export function normalizeRecurrenceRule(rule = {}) {
  const src = typeof rule === 'string' ? JSON.parse(rule || '{}') : rule || {};
  const cadence = normalizeCadence(src.cadence, src.interval_days);
  return {
    ...src,
    cadence,
    interval_days: SERIES_CADENCES[cadence].interval_days,
    hour: src.hour ?? 19,
    minute: src.minute ?? 0,
    end_after_weeks: normalizeEndAfterWeeks(src.end_after_weeks),
  };
}

/** Kart / strip etiketi — "Perşembe kahvesi · 7. hafta" */
export function formatSeriesCardLabel(name, week) {
  const n = String(name || 'Seri').trim();
  const w = Number(week);
  if (Number.isFinite(w) && w > 0) return `${n} · ${w}. hafta`;
  return n;
}

/** Seri satırını UI'nin beklediği kadans/bitiş alanlarıyla zenginleştirir */
export function decorateSeries(series) {
  if (!series) return null;
  const rule = normalizeRecurrenceRule(series.recurrence_rule);
  const weekCount = Number(series.week_count) || 0;
  const endAfter = rule.end_after_weeks;
  return {
    ...series,
    recurrence_rule: rule,
    cadence: rule.cadence,
    cadence_label: SERIES_CADENCES[rule.cadence].label,
    interval_days: rule.interval_days,
    end_after_weeks: endAfter,
    open_ended: endAfter == null,
    weeks_remaining: endAfter == null ? null : Math.max(0, endAfter - weekCount),
    completed: endAfter != null && weekCount >= endAfter,
    card_label: formatSeriesCardLabel(series.name, weekCount),
  };
}

export function timeTypeBadgeTr(timeType, { seriesId = null, sparkBorn = false } = {}) {
  const t = String(timeType || '').toLowerCase();
  if (seriesId || t === 'recurring' || t === 'series') return 'Seri';
  if (t === 'instant') return sparkBorn ? 'Anlık' : 'Anlık';
  if (t === 'planned' || t === 'fixed') return 'Planlı';
  return null;
}

export async function createSeries({ name, hostId, recurrenceRule = {}, templateRitualId = null }) {
  const rule = normalizeRecurrenceRule(recurrenceRule);
  if (templateRitualId) rule.template_ritual_id = templateRitualId;
  const result = await pool.query(
    `INSERT INTO ritual_series (name, host_id, recurrence_rule, week_count, active)
     VALUES ($1,$2,$3::jsonb,$4,true) RETURNING *`,
    [name, hostId, JSON.stringify(rule), templateRitualId ? 1 : 0]
  );
  return result.rows[0];
}

/** İlk Ritualden seri oluştur ve bağla */
export async function bindRitualAsSeries({ ritualId, hostId, name, startTime, recurrenceRule = {} }) {
  const loc = await pool.query(`SELECT location_type FROM rituals WHERE id = $1`, [ritualId]);
  const { isScheduledLocationType } = await import('./ritualCreateValidation.js');
  if (isScheduledLocationType(loc.rows[0]?.location_type)) {
    const err = new Error('Tarifeli/vapur rotası tek seferdir (seri yok)');
    err.code = 'ROUTE_ONE_SHOT';
    throw err;
  }
  const start = startTime ? new Date(startTime) : new Date();
  const series = await createSeries({
    name: name || 'Seri',
    hostId,
    templateRitualId: ritualId,
    recurrenceRule: {
      hour: start.getHours(),
      minute: start.getMinutes(),
      ...recurrenceRule,
    },
  });
  await pool.query(
    `UPDATE rituals
     SET series_id = $2,
         series_week = 1,
         is_recurring = true,
         time_type = 'recurring',
         updated_at = NOW()
     WHERE id = $1`,
    [ritualId, series.id]
  );
  await followSeries(series.id, hostId, true);
  return series;
}

export async function getSeries(seriesId) {
  const r = await pool.query(`SELECT * FROM ritual_series WHERE id = $1`, [seriesId]);
  return r.rows[0] || null;
}

/** Host kadans / bitiş kuralını günceller — geçmiş instance'lar dokunulmaz */
export async function updateSeriesSchedule(
  seriesId,
  { cadence, endAfterWeeks, hour, minute, actorUserId } = {}
) {
  const series = await getSeries(seriesId);
  if (!series) throw new Error('Series not found');
  if (actorUserId && String(series.host_id) !== String(actorUserId)) {
    throw new Error('Only series host can update');
  }
  const current = normalizeRecurrenceRule(series.recurrence_rule);
  const next = normalizeRecurrenceRule({
    ...current,
    cadence: cadence === undefined ? current.cadence : cadence,
    end_after_weeks: endAfterWeeks === undefined ? current.end_after_weeks : endAfterWeeks,
    hour: hour === undefined ? current.hour : hour,
    minute: minute === undefined ? current.minute : minute,
  });
  const updated = await pool.query(
    `UPDATE ritual_series SET recurrence_rule = $2::jsonb, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [seriesId, JSON.stringify(next)]
  );
  return decorateSeries(updated.rows[0]);
}

/** end_after_weeks dolduysa seri pasifleşir; açık uçlu seride limit yok */
async function closeSeriesIfCompleted(series) {
  const rule = normalizeRecurrenceRule(series.recurrence_rule);
  if (rule.end_after_weeks == null) return false;
  if (Number(series.week_count || 0) < rule.end_after_weeks) return false;
  await pool.query(`UPDATE ritual_series SET active = false, updated_at = NOW() WHERE id = $1`, [
    series.id,
  ]);
  return true;
}

export async function spawnSeriesInstance(seriesId, scheduledAt) {
  const seriesRes = await pool.query(`SELECT * FROM ritual_series WHERE id = $1 AND active = true`, [
    seriesId,
  ]);
  if (!seriesRes.rows[0]) return null;
  const s = seriesRes.rows[0];
  const rule = normalizeRecurrenceRule(s.recurrence_rule);
  if (await closeSeriesIfCompleted(s)) return null;
  const week = Number(s.week_count || 0) + 1;
  const startDate = new Date(scheduledAt);

  const existing = await pool.query(
    `SELECT id FROM rituals WHERE series_id = $1 AND start_time = $2 LIMIT 1`,
    [seriesId, startDate]
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, skipped: true };

  let templateId = rule.template_ritual_id || null;
  if (!templateId) {
    const first = await pool.query(
      `SELECT id FROM rituals WHERE series_id = $1 ORDER BY series_week ASC NULLS LAST, start_time ASC LIMIT 1`,
      [seriesId]
    );
    templateId = first.rows[0]?.id || null;
  }
  if (!templateId) return null;

  const template = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [templateId]);
  if (!template.rows[0]) return null;
  const p = template.rows[0];
  const { isScheduledLocationType } = await import('./ritualCreateValidation.js');
  if (isScheduledLocationType(p.location_type)) {
    return { skipped: true, reason: 'ROUTE_ONE_SHOT' };
  }
  const durMin = Number(p.duration) || 60;
  const endDate = new Date(startDate.getTime() + durMin * 60000);
  const cardTitle = formatSeriesCardLabel(s.name, week);

  const created = await pool.query(
    `INSERT INTO rituals (
       title, type, location_name, venue_id, start_time, duration, end_time,
       capacity, entry_type, location_lat, location_lng, host_id, status,
       live_window_hours, min_rs, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, is_recurring,
       definition_level, visibility, time_type, check_in_radius,
       series_id, series_week, spark_born, is_home, route_id, zone_id
     )
     SELECT
       $2, type, location_name, venue_id, $3, duration, $4,
       capacity, entry_type, location_lat, location_lng, $5, 'prelobby',
       live_window_hours, min_rs, mood_tags, city_id, category_id,
       window_type, forum_surface, location_type, false,
       definition_level, visibility, 'recurring', check_in_radius,
       $6, $7, false, is_home, route_id, zone_id
     FROM rituals WHERE id = $1
     RETURNING id, title, host_id, start_time, series_id, series_week`,
    [templateId, cardTitle, startDate, endDate, s.host_id, seriesId, week]
  );

  await pool.query(`UPDATE ritual_series SET week_count = $2, updated_at = NOW() WHERE id = $1`, [
    seriesId,
    week,
  ]);
  await closeSeriesIfCompleted({ ...s, week_count: week });

  const child = created.rows[0];
  const followers = await pool.query(
    `SELECT user_id FROM ritual_series_followers WHERE series_id = $1 AND bell = true`,
    [seriesId]
  );
  for (const follower of followers.rows) {
    notifyRecurringInstance(follower.user_id, {
      id: child.id,
      title: child.title,
      series_id: seriesId,
      series_week: week,
    }).catch(() => {});
  }
  return child;
}

export async function cancelFutureSeriesInstances(seriesId, { actorUserId } = {}) {
  const series = await getSeries(seriesId);
  if (!series) throw new Error('Series not found');
  if (actorUserId && String(series.host_id) !== String(actorUserId)) {
    throw new Error('Only series host can cancel');
  }
  await pool.query(`UPDATE ritual_series SET active = false, updated_at = NOW() WHERE id = $1`, [
    seriesId,
  ]);
  const result = await pool.query(
    `UPDATE rituals SET status = 'cancelled', updated_at = NOW()
     WHERE series_id = $1
       AND start_time > NOW()
       AND status::text IN ('prelobby', 'active', 'created', 'draft', 'live')
     RETURNING id`,
    [seriesId]
  );
  return { cancelled: result.rows.length, series_id: seriesId };
}

export async function transferSeriesHost(seriesId, { fromHostId, toHostId }) {
  if (!toHostId) throw new Error('new host required');
  const series = await getSeries(seriesId);
  if (!series) throw new Error('Series not found');
  if (String(series.host_id) !== String(fromHostId)) {
    throw new Error('Only current host can transfer');
  }
  if (String(toHostId) === String(fromHostId)) {
    return decorateSeries(series);
  }
  const user = await pool.query(`SELECT id FROM users WHERE id = $1`, [toHostId]);
  if (!user.rows[0]) throw new Error('New host not found');

  const updated = await pool.query(
    `UPDATE ritual_series SET host_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [seriesId, toHostId]
  );
  // Gelecek instance host'larını da yeni host'a taşı (geçmiş arşiv kalır)
  await pool.query(
    `UPDATE rituals SET host_id = $2, updated_at = NOW()
     WHERE series_id = $1
       AND start_time > NOW()
       AND status::text IN ('prelobby', 'active', 'created', 'draft')`,
    [seriesId, toHostId]
  );
  await followSeries(seriesId, toHostId, true);
  return decorateSeries(updated.rows[0]);
}

export async function followSeries(seriesId, userId, bell = true) {
  await pool.query(
    `INSERT INTO ritual_series_followers (series_id, user_id, bell) VALUES ($1,$2,$3)
     ON CONFLICT (series_id,user_id) DO UPDATE SET bell = EXCLUDED.bell`,
    [seriesId, userId, Boolean(bell)]
  );
  return { series_id: seriesId, user_id: userId, bell: Boolean(bell) };
}

export async function unfollowSeries(seriesId, userId) {
  await pool.query(`DELETE FROM ritual_series_followers WHERE series_id = $1 AND user_id = $2`, [
    seriesId,
    userId,
  ]);
  return { ok: true };
}

export async function getSeriesFollowState(seriesId, userId) {
  const r = await pool.query(
    `SELECT bell FROM ritual_series_followers WHERE series_id = $1 AND user_id = $2 LIMIT 1`,
    [seriesId, userId]
  );
  if (!r.rows[0]) return { following: false, bell: false };
  return { following: true, bell: Boolean(r.rows[0].bell) };
}

export async function listSeriesInstances(seriesId, { limit = 40 } = {}) {
  const r = await pool.query(
    `SELECT id, title, series_week, start_time, status, host_id
     FROM rituals
     WHERE series_id = $1
     ORDER BY start_time DESC
     LIMIT $2`,
    [seriesId, limit]
  );
  const now = Date.now();
  return r.rows.map((row) => ({
    ...row,
    past: new Date(row.start_time).getTime() < now,
    card_label: formatSeriesCardLabel(
      // prefer series name via join later; title already may include week
      row.title,
      row.series_week
    ),
  }));
}

export async function generateSeriesInstances() {
  if (!LOCAL_CONFIG.stubs?.RECURRING_RITUALS_ENABLED) {
    return { skipped: true, reason: 'disabled' };
  }
  const series = await pool.query(`SELECT * FROM ritual_series WHERE active = true`);
  let created = 0;
  const now = new Date();

  for (const row of series.rows) {
    const rule = normalizeRecurrenceRule(row.recurrence_rule);
    const days = rule.interval_days;
    if (await closeSeriesIfCompleted(row)) continue;

    const last = await pool.query(
      `SELECT start_time FROM rituals WHERE series_id = $1 ORDER BY start_time DESC LIMIT 1`,
      [row.id]
    );
    let next = last.rows[0]?.start_time ? new Date(last.rows[0].start_time) : new Date();
    next.setDate(next.getDate() + days);
    next.setHours(Number(rule.hour ?? next.getHours()), Number(rule.minute ?? next.getMinutes()), 0, 0);

    // Kadans kadar ufuk (weekly 8 gün, biweekly 15 gün)
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + days);
    }
    if (next.getTime() - now.getTime() > (days + 1) * 24 * 3600000) continue;

    const spawned = await spawnSeriesInstance(row.id, next);
    if (spawned && !spawned.skipped) created += 1;
  }
  return { created, series: series.rows.length };
}

export default {
  SERIES_CADENCES,
  normalizeCadence,
  normalizeEndAfterWeeks,
  normalizeRecurrenceRule,
  decorateSeries,
  formatSeriesCardLabel,
  timeTypeBadgeTr,
  createSeries,
  bindRitualAsSeries,
  getSeries,
  updateSeriesSchedule,
  spawnSeriesInstance,
  cancelFutureSeriesInstances,
  transferSeriesHost,
  followSeries,
  unfollowSeries,
  getSeriesFollowState,
  listSeriesInstances,
  generateSeriesInstances,
};
