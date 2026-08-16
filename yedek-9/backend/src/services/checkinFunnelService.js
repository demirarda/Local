/**
 * Check-in C1–C5 izleme — funnel + pending oranı + C2 bölge haritası
 * + C3 mühürsüz oturma + prova notları + C5 white-glove.
 * sonMD LOCAL_CheckIn_Sistemi §8
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const EVENTS = new Set([
  'door_view',
  'join',
  'checkin_start',
  'outside_radius_block',
  'pending_witness',
  'seal',
  'witness_approve',
  'false_witness_flag',
  'door_closed_noshow',
  'code_relay_suspect',
  'totem_scan',
  'totem_request',
  'door_abandon',
  'field_note',
  'culture_path',
  'strip_open',
  'phone_dead',
]);

/** Client may emit kapı hunisi + kültür yolu + telefon-ölü; join/seal sunucuda. */
export const CLIENT_FUNNEL_EVENTS = new Set([
  'door_view',
  'door_abandon',
  'culture_path',
  'phone_dead',
]);

export async function recordCheckinFunnelEvent({
  ritualId = null,
  userId = null,
  event,
  meta = null,
}) {
  if (!EVENTS.has(String(event))) return { ok: false, error: 'unknown_event' };
  try {
    await pool.query(
      `INSERT INTO checkin_funnel_events (ritual_id, user_id, event, meta, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [
        ritualId,
        userId,
        String(event),
        meta ? JSON.stringify(meta) : null,
      ]
    );
    return { ok: true };
  } catch (_e) {
    // Table may not exist yet — soft-fail so check-in never blocks on analytics
    return { ok: false, soft: true };
  }
}

/**
 * C2: bölge-bazlı pending haritası + T1/T2 kırılımı
 */
export async function getPendingRegionMap({ days = 7 } = {}) {
  try {
    const r = await pool.query(
      `SELECT
         COALESCE(v.city_id::text, 'unknown') AS city_id,
         COALESCE(v.id::text, r.venue_id::text, 'custom') AS venue_id,
         COALESCE(v.name, 'custom/outdoor') AS venue_name,
         COUNT(*)::int AS pending_count,
         COUNT(*) FILTER (
           WHERE COALESCE((e.meta->>'t1_gps_fail')::boolean, false)
         )::int AS t1_count,
         COUNT(*) FILTER (
           WHERE COALESCE((e.meta->>'integrity_suspect')::boolean, false)
             OR COALESCE((e.meta->>'t2_integrity')::boolean, false)
         )::int AS t2_count,
         COUNT(*) FILTER (
           WHERE COALESCE((e.meta->>'t3_edge')::boolean, false)
         )::int AS t3_count
       FROM checkin_funnel_events e
       LEFT JOIN rituals r ON r.id = e.ritual_id
       LEFT JOIN venues v ON v.id = r.venue_id
       WHERE e.event = 'pending_witness'
         AND e.created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY 1, 2, 3
       ORDER BY pending_count DESC
       LIMIT 100`,
      [Math.max(1, Number(days) || 7)]
    );
    const regions = r.rows;
    const totalPending = regions.reduce((s, row) => s + Number(row.pending_count || 0), 0);
    const totalT1 = regions.reduce((s, row) => s + Number(row.t1_count || 0), 0);
    const totalT2 = regions.reduce((s, row) => s + Number(row.t2_count || 0), 0);
    const totalT3 = regions.reduce((s, row) => s + Number(row.t3_count || 0), 0);
    return {
      ok: true,
      days: Number(days) || 7,
      regions,
      t1_t2: {
        t1: totalT1,
        t2: totalT2,
        t3: totalT3,
        pending: totalPending,
        t1_share: totalPending > 0 ? Number((totalT1 / totalPending).toFixed(3)) : null,
        t2_share: totalPending > 0 ? Number((totalT2 / totalPending).toFixed(3)) : null,
      },
    };
  } catch (_e) {
    return { ok: false, error: 'pending_map_unavailable' };
  }
}

/**
 * C3: masada bekleyip mühürlenmeyenler (join + confirmed, mühür yok).
 */
export async function getUnsealedSittingReport({ hours = 6 } = {}) {
  try {
    const r = await pool.query(
      `SELECT
         r.id AS ritual_id,
         r.title,
         r.venue_id,
         COALESCE(v.name, r.location_name, 'custom') AS place,
         r.start_time,
         r.status::text AS ritual_status,
         COUNT(*) FILTER (
           WHERE ra.status = 'confirmed'
             AND ra.checkin_at IS NULL
             AND COALESCE(ra.checkin_phase, '') NOT IN ('sealed', 'pending_witness')
         )::int AS unsealed_sitting,
         COUNT(*) FILTER (WHERE ra.checkin_phase = 'pending_witness')::int AS pending,
         COUNT(*) FILTER (
           WHERE ra.checkin_at IS NOT NULL
             AND COALESCE(ra.checkin_phase, 'sealed') = 'sealed'
         )::int AS sealed,
         COUNT(*) FILTER (WHERE ra.status = 'confirmed')::int AS joined
       FROM rituals r
       JOIN ritual_attendance ra ON ra.ritual_id = r.id
       LEFT JOIN venues v ON v.id = r.venue_id
       WHERE r.status::text IN ('live', 'active', 'prelobby')
         AND r.start_time <= NOW() + INTERVAL '15 minutes'
         AND (r.start_time + (COALESCE(r.duration, 60)::text || ' minutes')::interval)
             >= NOW() - ($1::int * INTERVAL '1 hour')
       GROUP BY r.id, r.title, r.venue_id, v.name, r.location_name, r.start_time, r.status
       HAVING COUNT(*) FILTER (
         WHERE ra.status = 'confirmed'
           AND ra.checkin_at IS NULL
           AND COALESCE(ra.checkin_phase, '') NOT IN ('sealed', 'pending_witness')
       ) > 0
       ORDER BY unsealed_sitting DESC
       LIMIT 100`,
      [Math.max(1, Number(hours) || 6)]
    );
    return { ok: true, hours: Number(hours) || 6, rows: r.rows };
  } catch (_e) {
    return { ok: false, error: 'unsealed_sitting_unavailable', rows: [] };
  }
}

export async function enqueueTotemOpsRequest({ venueId, userId = null, note = null }) {
  try {
    const r = await pool.query(
      `INSERT INTO totem_ops_queue (venue_id, requested_by, note, status)
       VALUES ($1, $2, $3, 'queued')
       RETURNING *`,
      [venueId, userId, note]
    );
    return { ok: true, row: r.rows[0] };
  } catch (_e) {
    return { ok: false, soft: true };
  }
}

export async function listTotemOpsQueue({ status = null, limit = 50 } = {}) {
  try {
    const params = [];
    let where = 'WHERE 1=1';
    if (status) {
      params.push(String(status));
      where += ` AND q.status = $${params.length}`;
    }
    params.push(Math.min(200, Math.max(1, Number(limit) || 50)));
    const r = await pool.query(
      `SELECT q.*, v.name AS venue_name, v.totem_status
       FROM totem_ops_queue q
       JOIN venues v ON v.id = q.venue_id
       ${where}
       ORDER BY q.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return { ok: true, rows: r.rows };
  } catch (_e) {
    return { ok: false, error: 'totem_ops_unavailable', rows: [] };
  }
}

export async function updateTotemOpsStatus(id, status) {
  const allowed = new Set(['queued', 'dispatched', 'done', 'cancelled']);
  if (!allowed.has(String(status))) return { ok: false, error: 'invalid_status' };
  try {
    const r = await pool.query(
      `UPDATE totem_ops_queue
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, String(status)]
    );
    if (!r.rows[0]) return { ok: false, error: 'not_found' };
    return { ok: true, row: r.rows[0] };
  } catch (_e) {
    return { ok: false, error: 'totem_ops_update_failed' };
  }
}

export async function createCheckinFieldNote({
  ritualId = null,
  venueId = null,
  authorId = null,
  checklistKey,
  note,
}) {
  const key = String(checklistKey || '').trim().slice(0, 240);
  const body = String(note || '').trim().slice(0, 2000);
  if (!key || !body) return { ok: false, error: 'checklist_key and note required' };
  try {
    const r = await pool.query(
      `INSERT INTO checkin_field_notes (ritual_id, venue_id, author_id, checklist_key, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ritualId, venueId, authorId, key, body]
    );
    void recordCheckinFunnelEvent({
      ritualId,
      userId: authorId,
      event: 'field_note',
      meta: { venue_id: venueId, checklist_key: key },
    });
    if (/telefon-ölü|telefon-olu|phone.?dead/i.test(key)) {
      void recordCheckinFunnelEvent({
        ritualId,
        userId: authorId,
        event: 'phone_dead',
        meta: { via: 'field_note', note: body.slice(0, 280) },
      });
    }
    return { ok: true, row: r.rows[0] };
  } catch (_e) {
    return { ok: false, error: 'field_note_failed' };
  }
}

export async function listCheckinFieldNotes({ limit = 40 } = {}) {
  try {
    const r = await pool.query(
      `SELECT n.*, r.title AS ritual_title, v.name AS venue_name
       FROM checkin_field_notes n
       LEFT JOIN rituals r ON r.id = n.ritual_id
       LEFT JOIN venues v ON v.id = n.venue_id
       ORDER BY n.created_at DESC
       LIMIT $1`,
      [Math.min(200, Math.max(1, Number(limit) || 40))]
    );
    return { ok: true, rows: r.rows };
  } catch (_e) {
    return { ok: false, error: 'field_notes_unavailable', rows: [] };
  }
}

function avgRound(values) {
  const nums = values.filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return Number((nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1));
}

/**
 * §9 pivot izleme — kapı süresi, pending çözülme, walk-in dakika, şerit hızı, kültür, telefon-ölü.
 */
export async function getPivotSahaMetrics({ days = 7 } = {}) {
  const d = Math.max(1, Number(days) || 7);
  const target = Number(LOCAL_CONFIG.checkin?.DOOR_SEAL_TARGET_S ?? 20);
  const alarm = Number(LOCAL_CONFIG.checkin?.DOOR_SEAL_ALARM_S ?? 45);
  const stripWin = Number(LOCAL_CONFIG.checkin?.STRIP_FOLLOW_MIN ?? 15);
  const empty = {
    ok: true,
    door_seal: { n: 0, avg_s: null, on_target_n: 0, alarm_n: 0, target_s: target, alarm_s: alarm },
    pending_resolve: { n: 0, avg_s: null },
    walkin_birth: { n: 0, avg_min: null },
    strip_follow: { opens: 0, follow_n: 0, window_min: stripWin },
    culture_paths: { say: 0, show: 0, local_tag: 0 },
    phone_dead: { n: 0 },
  };
  try {
    const doorR = await pool.query(
      `SELECT seconds FROM (
         SELECT COALESCE(
           NULLIF(s.meta->>'gate_s', '')::numeric,
           EXTRACT(EPOCH FROM (s.created_at - g.created_at))
         ) AS seconds
         FROM checkin_funnel_events s
         LEFT JOIN LATERAL (
           SELECT g.created_at
           FROM checkin_funnel_events g
           WHERE g.event = 'door_view'
             AND g.user_id IS NOT DISTINCT FROM s.user_id
             AND g.ritual_id IS NOT DISTINCT FROM s.ritual_id
             AND COALESCE(g.meta->>'surface', '') = 'gate'
             AND g.created_at <= s.created_at
           ORDER BY g.created_at DESC
           LIMIT 1
         ) g ON true
         WHERE s.event = 'seal'
           AND s.created_at >= NOW() - ($1::int * INTERVAL '1 day')
       ) x
       WHERE seconds IS NOT NULL AND seconds >= 0 AND seconds < 3600`,
      [d]
    );
    const doorSecs = doorR.rows.map((r) => Number(r.seconds));
    const pendingR = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (a.created_at - p.created_at)) AS seconds
       FROM checkin_funnel_events p
       JOIN LATERAL (
         SELECT created_at FROM checkin_funnel_events a
         WHERE a.event IN ('witness_approve', 'seal')
           AND a.user_id IS NOT DISTINCT FROM p.user_id
           AND a.ritual_id IS NOT DISTINCT FROM p.ritual_id
           AND a.created_at >= p.created_at
         ORDER BY a.created_at ASC
         LIMIT 1
       ) a ON true
       WHERE p.event = 'pending_witness'
         AND p.created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [d]
    );
    const pendingSecs = pendingR.rows
      .map((r) => Number(r.seconds))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 7200);
    const walkR = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (first_sealed_at - created_at)) / 60.0 AS mins
       FROM rituals
       WHERE COALESCE(origin::text, 'WALK_IN') = 'WALK_IN'
         AND first_sealed_at IS NOT NULL
         AND created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [d]
    );
    const walkMins = walkR.rows
      .map((r) => Number(r.mins))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 24 * 60);
    const stripR = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE e.event = 'strip_open')::int AS opens,
         COUNT(*) FILTER (
           WHERE e.event IN ('join', 'checkin_start', 'seal')
             AND EXISTS (
               SELECT 1 FROM checkin_funnel_events o
               WHERE o.event = 'strip_open'
                 AND o.ritual_id = e.ritual_id
                 AND e.created_at > o.created_at
                 AND e.created_at <= o.created_at + ($2::int * INTERVAL '1 minute')
             )
         )::int AS follow_n
       FROM checkin_funnel_events e
       WHERE e.created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [d, stripWin]
    );
    const cultR = await pool.query(
      `SELECT COALESCE(meta->>'path', 'say') AS path, COUNT(*)::int AS c
       FROM checkin_funnel_events
       WHERE event = 'culture_path'
         AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY 1`,
      [d]
    );
    const phoneR = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM checkin_funnel_events
       WHERE event = 'phone_dead'
         AND created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [d]
    );
    const culture = { say: 0, show: 0, local_tag: 0 };
    for (const row of cultR.rows) {
      const k = String(row.path || 'say');
      if (k in culture) culture[k] = Number(row.c || 0);
      else culture[k] = Number(row.c || 0);
    }
    return {
      ok: true,
      door_seal: {
        n: doorSecs.length,
        avg_s: avgRound(doorSecs),
        on_target_n: doorSecs.filter((s) => s <= target).length,
        alarm_n: doorSecs.filter((s) => s > alarm).length,
        target_s: target,
        alarm_s: alarm,
        c1_alarm: doorSecs.filter((s) => s > alarm).length > 0,
      },
      pending_resolve: { n: pendingSecs.length, avg_s: avgRound(pendingSecs) },
      walkin_birth: { n: walkMins.length, avg_min: avgRound(walkMins) },
      strip_follow: {
        opens: Number(stripR.rows[0]?.opens || 0),
        follow_n: Number(stripR.rows[0]?.follow_n || 0),
        window_min: stripWin,
      },
      culture_paths: culture,
      phone_dead: { n: Number(phoneR.rows[0]?.c || 0) },
    };
  } catch (_e) {
    return { ...empty, ok: false };
  }
}

export async function getCheckinFunnelSummary({
  days = 7,
  includePendingMap = true,
  includeOps = false,
} = {}) {
  try {
    const r = await pool.query(
      `SELECT event, COUNT(*)::int AS c
       FROM checkin_funnel_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY event
       ORDER BY c DESC`,
      [Math.max(1, Number(days) || 7)]
    );
    const byEvent = Object.fromEntries(r.rows.map((row) => [row.event, row.c]));
    const seals = byEvent.seal || 0;
    const pending = byEvent.pending_witness || 0;
    const joins = byEvent.join || 0;
    const outside = byEvent.outside_radius_block || 0;
    const doorViews = byEvent.door_view || 0;
    const abandons = byEvent.door_abandon || 0;

    let detailViews = doorViews;
    let gateViews = 0;
    try {
      const surfaces = await pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE COALESCE(meta->>'surface', 'detail') = 'detail'
           )::int AS detail_views,
           COUNT(*) FILTER (
             WHERE meta->>'surface' = 'gate'
           )::int AS gate_views
         FROM checkin_funnel_events
         WHERE event = 'door_view'
           AND created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
        [Math.max(1, Number(days) || 7)]
      );
      detailViews = Number(surfaces.rows[0]?.detail_views || 0);
      gateViews = Number(surfaces.rows[0]?.gate_views || 0);
    } catch (_e) {
      /* meta surface yoksa door_view toplamı */
    }

    const pendingRatio = seals > 0 ? Number((pending / seals).toFixed(3)) : null;
    const watch = Number(LOCAL_CONFIG.checkin?.PENDING_SEAL_WATCH ?? 0.1);
    const alarm = Number(LOCAL_CONFIG.checkin?.PENDING_SEAL_ALARM ?? 0.15);

    const summary = {
      ok: true,
      days: Number(days) || 7,
      by_event: byEvent,
      ratios: {
        view_to_join:
          detailViews > 0 ? Number((joins / detailViews).toFixed(3)) : (doorViews > 0 ? Number((joins / doorViews).toFixed(3)) : null),
        join_to_seal: joins > 0 ? Number((seals / joins).toFixed(3)) : null,
        gate_abandon:
          gateViews > 0
            ? Number((abandons / gateViews).toFixed(3))
            : doorViews > 0
              ? Number((abandons / doorViews).toFixed(3))
              : null,
        pending_to_seal: pendingRatio,
        outside_block_share:
          doorViews > 0 ? Number((outside / doorViews).toFixed(3)) : null,
      },
      pending_watch: pendingRatio != null && pendingRatio > watch,
      pending_alarm: pendingRatio != null && pendingRatio > alarm,
    };
    if (includePendingMap) {
      const map = await getPendingRegionMap({ days });
      if (map.ok) {
        summary.pending_by_region = map.regions;
        summary.t1_t2 = map.t1_t2;
      }
    }
    if (includeOps) {
      const [sitting, totem, notes, saha] = await Promise.all([
        getUnsealedSittingReport({ hours: 6 }),
        listTotemOpsQueue({ status: 'queued', limit: 40 }),
        listCheckinFieldNotes({ limit: 40 }),
        getPivotSahaMetrics({ days }),
      ]);
      summary.unsealed_sitting = sitting.ok ? sitting.rows : [];
      summary.totem_ops_queue = totem.ok ? totem.rows : [];
      summary.field_notes = notes.ok ? notes.rows : [];
      summary.pivot_checklist = LOCAL_CONFIG.checkinPivotChecklist || [];
      summary.pivot_saha = saha;
    }
    return summary;
  } catch (_e) {
    return { ok: false, error: 'funnel_unavailable' };
  }
}

export default {
  recordCheckinFunnelEvent,
  getCheckinFunnelSummary,
  getPendingRegionMap,
  getUnsealedSittingReport,
  enqueueTotemOpsRequest,
  listTotemOpsQueue,
  updateTotemOpsStatus,
  createCheckinFieldNote,
  listCheckinFieldNotes,
  getPivotSahaMetrics,
  CLIENT_FUNNEL_EVENTS,
};
