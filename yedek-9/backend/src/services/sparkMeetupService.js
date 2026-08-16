/**
 * SPARK meetup — LOCAL v2 §11 (absolute 100 B)
 * QR-tanışma → pending meetup; min 3 dolunca instant Ritual doğar (spark_born).
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { isSparkEnabled } from './zoneService.js';

const MIN_SIZE = Number(LOCAL_CONFIG.ritual?.MIN_SIZE) || 3;
const DEFAULT_DURATION_MIN = Number(LOCAL_CONFIG.ritual?.MIN_DURATION_MIN) || 30;

async function notifySparkSideEffects(zoneId, meetup, { actorId } = {}) {
  try {
    const zone = await pool.query(`SELECT name FROM zones WHERE id = $1`, [zoneId]);
    const zoneName = zone.rows[0]?.name;
    const { notifyZoneSpark, notifyZoneFounderOpportunity } = await import('./notifications.js');
    await notifyZoneSpark(zoneId, {
      meetupId: meetup.id,
      memberCount: meetup.member_count,
      zoneName,
      actorId,
    }).catch(() => {});
    if (meetup.can_birth || meetup.status === 'ready' || meetup.status === 'born') {
      const memberIds = (meetup.members || []).map((m) => m.user_id);
      await notifyZoneFounderOpportunity(memberIds, {
        zoneId,
        meetupId: meetup.id,
        zoneName,
        ritualId: meetup.ritual_id || null,
      }).catch(() => {});
    }
  } catch (_e) {
    /* non-fatal */
  }
}

export async function startSparkMeetup({ zoneId, userId, lat = null, lng = null } = {}) {
  if (!isSparkEnabled()) {
    return { ok: false, status: 403, error: 'SPARK kapalı (SPARK_ENABLED:false)', code: 'SPARK_OFF' };
  }
  if (!zoneId || !userId) return { ok: false, status: 400, error: 'zone_id and user required' };

  const existing = await pool.query(
    `SELECT * FROM spark_meetups
     WHERE zone_id = $1 AND status = 'pending'
       AND created_at > NOW() - INTERVAL '2 hours'
     ORDER BY created_at DESC LIMIT 1`,
    [zoneId]
  );

  let meetup = existing.rows[0];
  if (!meetup) {
    const ins = await pool.query(
      `INSERT INTO spark_meetups (zone_id, created_by, status, geo_lat, geo_lng)
       VALUES ($1,$2,'pending',$3,$4) RETURNING *`,
      [zoneId, userId, lat, lng]
    );
    meetup = ins.rows[0];
  }

  await pool.query(
    `INSERT INTO spark_meetup_members (meetup_id, user_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [meetup.id, userId]
  );

  const state = await maybeBirthRitual(meetup.id);
  if (state.ok) {
    await notifySparkSideEffects(zoneId, state.meetup, { actorId: userId });
  }
  return state;
}

export async function joinSparkMeetup(meetupId, userId) {
  if (!isSparkEnabled()) {
    return { ok: false, status: 403, error: 'SPARK kapalı', code: 'SPARK_OFF' };
  }
  const cur = await pool.query(`SELECT * FROM spark_meetups WHERE id = $1`, [meetupId]);
  if (!cur.rows[0]) return { ok: false, status: 404, error: 'Meetup not found' };
  if (cur.rows[0].status !== 'pending') {
    return { ok: false, status: 409, error: 'Meetup no longer pending', meetup_id: meetupId };
  }
  await pool.query(
    `INSERT INTO spark_meetup_members (meetup_id, user_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [meetupId, userId]
  );
  const state = await maybeBirthRitual(meetupId);
  if (state.ok) {
    await notifySparkSideEffects(cur.rows[0].zone_id, state.meetup, { actorId: userId });
  }
  return state;
}

export async function getSparkMeetup(meetupId) {
  const m = await pool.query(`SELECT * FROM spark_meetups WHERE id = $1`, [meetupId]);
  if (!m.rows[0]) return { ok: false, status: 404, error: 'Not found' };
  const members = await pool.query(
    `SELECT sm.user_id, u.name
     FROM spark_meetup_members sm
     JOIN users u ON u.id = sm.user_id
     WHERE sm.meetup_id = $1`,
    [meetupId]
  );
  const count = members.rows.length;
  const status = m.rows[0].status;
  return {
    ok: true,
    meetup: {
      ...m.rows[0],
      members: members.rows,
      member_count: count,
      min_size: MIN_SIZE,
      card_copy:
        status === 'born' && m.rows[0].ritual_id
          ? 'SPARK Ritual doğdu'
          : count < MIN_SIZE
            ? `${count} kişi başlattı · ${MIN_SIZE} dolmazsa Ritual doğmaz, ekleşme kalır`
            : 'Min doldu — instant Ritual doğuyor',
      can_birth: count >= MIN_SIZE && status === 'pending',
    },
  };
}

/**
 * CreateRitual sonrası meetup bağla (manuel SPARK create yolu).
 */
export async function sealMeetupToRitual(meetupId, ritualId) {
  if (!meetupId || !ritualId) return { ok: false, error: 'meetup_id and ritual_id required' };
  const upd = await pool.query(
    `UPDATE spark_meetups
     SET status = 'born', ritual_id = $2, updated_at = NOW()
     WHERE id = $1 AND ritual_id IS NULL
     RETURNING *`,
    [meetupId, ritualId]
  );
  if (!upd.rows[0]) return { ok: false, error: 'Meetup not sealed' };
  await pool
    .query(`UPDATE rituals SET spark_born = true, updated_at = NOW() WHERE id = $1`, [ritualId])
    .catch(() => {});
  return { ok: true, meetup: upd.rows[0] };
}

async function maybeBirthRitual(meetupId) {
  const state = await getSparkMeetup(meetupId);
  if (!state.ok) return state;
  if (state.meetup.ritual_id || state.meetup.status === 'born') return state;
  if (!state.meetup.can_birth || state.meetup.status !== 'pending') return state;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lock = await client.query(
      `SELECT sm.*, z.name AS zone_name, z.geo_lat AS zone_lat, z.geo_lng AS zone_lng, z.city_id
       FROM spark_meetups sm
       JOIN zones z ON z.id = sm.zone_id
       WHERE sm.id = $1 AND sm.status = 'pending'
       FOR UPDATE OF sm`,
      [meetupId]
    );
    if (!lock.rows[0]) {
      await client.query('ROLLBACK');
      return getSparkMeetup(meetupId);
    }
    const meetupRow = lock.rows[0];
    const members = await client.query(
      `SELECT user_id FROM spark_meetup_members WHERE meetup_id = $1 ORDER BY joined_at ASC`,
      [meetupId]
    );
    if (members.rows.length < MIN_SIZE) {
      await client.query('ROLLBACK');
      return getSparkMeetup(meetupId);
    }

    const hostId = meetupRow.created_by || members.rows[0].user_id;
    const start = new Date();
    const duration = DEFAULT_DURATION_MIN;
    const end = new Date(start.getTime() + duration * 60000);
    const lat = meetupRow.geo_lat ?? meetupRow.zone_lat;
    const lng = meetupRow.geo_lng ?? meetupRow.zone_lng;
    const title = `SPARK · ${meetupRow.zone_name || 'Zone'}`;
    const capacity = Math.max(members.rows.length, MIN_SIZE);

    const ritualIns = await client.query(
      `INSERT INTO rituals (
         title, type, location_name, start_time, duration, end_time,
         capacity, location_lat, location_lng, host_id, status,
         live_window_hours, location_type, time_type, visibility,
         origin, zone_id, spark_born, city_id
       )
       VALUES (
         $1, 'social', $2, $3, $4, $5,
         $6, $7, $8, $9, 'prelobby',
         12, 'zone', 'instant'::ritual_time_type, 'public'::ritual_visibility,
         'WALK_IN'::ritual_origin_type, $10, true, $11
       )
       RETURNING id`,
      [
        title,
        meetupRow.zone_name || 'Zone',
        start,
        duration,
        end,
        capacity,
        lat,
        lng,
        hostId,
        meetupRow.zone_id,
        meetupRow.city_id || null,
      ]
    );
    const ritualId = ritualIns.rows[0].id;

    for (const m of members.rows) {
      await client.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, joined_at, join_count)
         VALUES ($1, $2, 'confirmed', NOW(), 1)
         ON CONFLICT DO NOTHING`,
        [ritualId, m.user_id]
      ).catch(async () => {
        await client.query(
          `INSERT INTO ritual_attendance (ritual_id, user_id, status, joined_at)
           VALUES ($1, $2, 'confirmed', NOW())
           ON CONFLICT DO NOTHING`,
          [ritualId, m.user_id]
        ).catch(() => {});
      });
    }

    await client.query(
      `UPDATE spark_meetups
       SET status = 'born', ritual_id = $2, updated_at = NOW()
       WHERE id = $1`,
      [meetupId, ritualId]
    );

    await client.query('COMMIT');
    const born = await getSparkMeetup(meetupId);
    if (born.ok) {
      born.meetup.note = 'SPARK Ritual doğdu';
      born.meetup.ritual_id = ritualId;
    }
    return born;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_r) {
      /* ignore */
    }
    // Fallback: mark ready so CreateRitual path can seal
    await pool.query(
      `UPDATE spark_meetups SET status = 'ready', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [meetupId]
    );
    const fallback = await getSparkMeetup(meetupId);
    if (fallback.ok) {
      fallback.meetup.note = `Birth deferred: ${e.message}`;
      fallback.meetup.birth_error = e.message;
    }
    return fallback;
  } finally {
    client.release();
  }
}

export { maybeBirthRitual };
