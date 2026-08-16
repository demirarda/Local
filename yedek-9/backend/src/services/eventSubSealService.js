import pool from '../config/database.js';

async function canManageVenue(venueId, userId) {
  if (!venueId || !userId) return false;
  const r = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  return r.rows.length > 0;
}

/**
 * VEN_EVENT sub'a gir — çoklu mühürlü eşzamanlı varlık (FB zaman-kesişimi).
 */
export async function enterEventSubSeal({ ritualId, userId, subId }) {
  const sid = String(subId || '').trim();
  if (!sid) return { ok: false, status: 400, body: { success: false, error: 'sub_id required' } };

  const ritualR = await pool.query(
    `SELECT id, origin, host_id, venue_id, event_group_id
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritual = ritualR.rows[0];
  if (!ritual) return { ok: false, status: 404, body: { success: false, error: 'Ritual not found' } };
  if (String(ritual.origin || 'WALK_IN') !== 'VEN_EVENT') {
    return { ok: false, status: 422, body: { success: false, error: 'Sub-seal is only enabled for VEN_EVENT' } };
  }

  const sealedR = await pool.query(
    `SELECT 1 FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id = $2
       AND checkin_phase = 'sealed'
     LIMIT 1`,
    [ritualId, userId]
  );
  const venueManager = await canManageVenue(ritual.venue_id, userId);
  const host = String(ritual.host_id || '') === String(userId || '');
  if (!sealedR.rows.length && !venueManager && !host) {
    return { ok: false, status: 403, body: { success: false, error: 'Not authorized for sub-seal' } };
  }

  // Önceki aktif sub'dan çık (masa geçişi = söz değil, log tutulur)
  await pool.query(
    `UPDATE ritual_event_sub_seals
     SET out_ts = NOW()
     WHERE ritual_id = $1
       AND actor_user_id = $2
       AND out_ts IS NULL
       AND sub_id <> $3`,
    [ritualId, userId, sid]
  );

  try {
    const existing = await pool.query(
      `SELECT * FROM ritual_event_sub_seals
       WHERE ritual_id = $1 AND sub_id = $2 AND actor_user_id = $3 AND out_ts IS NULL
       LIMIT 1`,
      [ritualId, sid, userId]
    );
    if (existing.rows[0]) {
      await refreshSubSealFeedbackEligibility(ritualId, userId, sid);
      return { ok: true, data: existing.rows[0], already: true };
    }

    const ins = await pool.query(
      `INSERT INTO ritual_event_sub_seals (ritual_id, sub_id, actor_user_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [ritualId, sid, userId]
    );
    // sonMD §4: köşenin ilk oturanı açar (fraktal first-arriver)
    const prior = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_event_sub_seals
       WHERE ritual_id = $1 AND sub_id = $2 AND id <> $3`,
      [ritualId, sid, ins.rows[0].id]
    );
    const cornerOpener = Number(prior.rows[0]?.c || 0) === 0;
    await refreshSubSealFeedbackEligibility(ritualId, userId, sid);
    return {
      ok: true,
      data: {
        ...ins.rows[0],
        corner_opener: cornerOpener,
        message: cornerOpener ? 'Bu köşeyi sen açıyorsun' : null,
      },
    };
  } catch (_e) {
    return { ok: false, status: 409, body: { success: false, error: 'Could not enter sub-seal' } };
  }
}

export async function exitEventSubSeal({ ritualId, userId, subId }) {
  const sid = String(subId || '').trim();
  if (!sid) return { ok: false, status: 400, body: { success: false, error: 'sub_id required' } };
  const up = await pool.query(
    `UPDATE ritual_event_sub_seals
     SET out_ts = NOW()
     WHERE ritual_id = $1
       AND sub_id = $2
       AND actor_user_id = $3
       AND out_ts IS NULL
     RETURNING *`,
    [ritualId, sid, userId]
  );
  if (!up.rows.length) {
    return { ok: false, status: 404, body: { success: false, error: 'Active sub-seal not found for user' } };
  }
  return { ok: true, data: up.rows[0] };
}

/**
 * Aynı sub'da zaman-kesişen mühürlüler → kişi-FB hakkı (süre yalnız sıra için).
 */
export async function refreshSubSealFeedbackEligibility(ritualId, userId, subId) {
  const peers = await pool.query(
    `SELECT DISTINCT s2.actor_user_id AS user_id
     FROM ritual_event_sub_seals s1
     JOIN ritual_event_sub_seals s2
       ON s2.ritual_id = s1.ritual_id
      AND s2.sub_id = s1.sub_id
      AND s2.actor_user_id <> s1.actor_user_id
     WHERE s1.ritual_id = $1
       AND s1.sub_id = $2
       AND s1.actor_user_id = $3
       AND s1.in_ts < COALESCE(s2.out_ts, NOW())
       AND s2.in_ts < COALESCE(s1.out_ts, NOW())`,
    [ritualId, subId, userId]
  );

  for (const row of peers.rows) {
    const a = userId;
    const b = row.user_id;
    await pool.query(
      `INSERT INTO feedback_eligibility (ritual_id, from_user_id, to_user_id, source)
       VALUES ($1, $2, $3, 'sub_seal'), ($1, $3, $2, 'sub_seal')
       ON CONFLICT (ritual_id, from_user_id, to_user_id) DO UPDATE
         SET source = CASE
           WHEN feedback_eligibility.source = 'co_presence' THEN 'sub_seal'
           ELSE feedback_eligibility.source
         END`,
      [ritualId, a, b]
    );
  }

  // Sıra için overlap süresi (hak filtresi değil — metadata)
  const ordered = await pool.query(
    `SELECT actor_user_id AS user_id, in_ts,
            EXTRACT(EPOCH FROM (COALESCE(out_ts, NOW()) - in_ts)) AS dwell_s
     FROM ritual_event_sub_seals
     WHERE ritual_id = $1 AND sub_id = $2
     ORDER BY dwell_s DESC NULLS LAST, in_ts ASC`,
    [ritualId, subId]
  );

  return {
    peers: peers.rows.length,
    order: ordered.rows.map((r, i) => ({
      user_id: r.user_id,
      rank: i + 1,
      dwell_s: Number(r.dwell_s) || 0,
    })),
  };
}

/**
 * İki kullanıcının aynı sub'da zaman-kesişimi var mı?
 */
export async function usersHaveSubTimeOverlap(ritualId, userA, userB) {
  const r = await pool.query(
    `SELECT 1
     FROM ritual_event_sub_seals a
     JOIN ritual_event_sub_seals b
       ON a.ritual_id = b.ritual_id
      AND a.sub_id = b.sub_id
      AND a.actor_user_id = $2
      AND b.actor_user_id = $3
     WHERE a.ritual_id = $1
       AND a.in_ts < COALESCE(b.out_ts, NOW())
       AND b.in_ts < COALESCE(a.out_ts, NOW())
     LIMIT 1`,
    [ritualId, userA, userB]
  );
  return r.rows.length > 0;
}
