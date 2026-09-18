/**
 * Ritual waitlist — F1.5 (sonMD Yıldız Listesi)
 * Masa dolduğunda sıraya girilir; koltuk açılınca FIFO terfi eder.
 * WAITLIST_ENABLED:false iken API katmanı 410 döner; servis çağrılmaz.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { computePrelobbyGrace, assertCanJoinRitualConstraints } from './ritualState.js';

/** Koltuğu işgal eden statüler — cancelled/no_show yer açar. */
const OCCUPYING_STATUSES = ['confirmed', 'waitlisted', 'offered'];

export function isWaitlistEnabled() {
  return LOCAL_CONFIG.stubs?.WAITLIST_ENABLED === true;
}

async function countConfirmed(client, ritualId) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM ritual_attendance
     WHERE ritual_id = $1 AND status = 'confirmed'`,
    [ritualId]
  );
  return result.rows[0]?.count ?? 0;
}

async function loadRitual(client, ritualId) {
  const result = await client.query(
    `SELECT id, title, host_id, capacity, start_time, duration, status, collapsed_at,
            event_group_id, origin, time_type, venue_id, visibility, fee_amount
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  return result.rows[0] ?? null;
}

async function notifyBestEffort(userId, type, title, body, data) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body, JSON.stringify(data || {})]
    );
  } catch (_e) {
    // bildirim kaybı akışı bloklamaz
  }
}

/**
 * @returns {Promise<{ ok: boolean, status?: number, body?: object, data?: object }>}
 */
export async function joinWaitlist(userId, ritualId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ritual = await loadRitual(client, ritualId);
    if (!ritual) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, body: { success: false, error: 'Ritual not found' } };
    }
    if (ritual.collapsed_at || ritual.status === 'cancelled') {
      await client.query('ROLLBACK');
      return { ok: false, status: 410, body: { success: false, error: 'Ritual is closed' } };
    }
    if (new Date(ritual.start_time) <= new Date()) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        status: 422,
        body: { success: false, error: 'Başlamış Ritual için sıraya girilemez', code: 'WAITLIST_TOO_LATE' },
      };
    }
    if (String(ritual.host_id) === String(userId)) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        status: 422,
        body: { success: false, error: 'Host kendi masasının sırasına giremez', code: 'WAITLIST_HOST' },
      };
    }

    const attendance = await client.query(
      `SELECT status FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
    if (attendance.rows.length > 0 && OCCUPYING_STATUSES.includes(attendance.rows[0].status)) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        status: 409,
        body: { success: false, error: 'Zaten bu Ritualdesin', code: 'WAITLIST_ALREADY_JOINED' },
      };
    }

    const confirmed = await countConfirmed(client, ritualId);
    if (confirmed < Number(ritual.capacity)) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        status: 422,
        body: {
          success: false,
          error: 'Masa dolu değil — doğrudan katılabilirsin',
          code: 'WAITLIST_NOT_FULL',
          seats_left: Number(ritual.capacity) - confirmed,
        },
      };
    }

    const existing = await client.query(
      `SELECT * FROM ritual_waitlist WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === 'waiting') {
      await client.query('ROLLBACK');
      return {
        ok: true,
        status: 200,
        data: { entry: existing.rows[0], already_waiting: true },
      };
    }

    const nextPosition = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next
       FROM ritual_waitlist
       WHERE ritual_id = $1 AND status = 'waiting'`,
      [ritualId]
    );
    const position = nextPosition.rows[0]?.next ?? 1;

    const upserted = await client.query(
      `INSERT INTO ritual_waitlist (ritual_id, user_id, position, status, created_at)
       VALUES ($1, $2, $3, 'waiting', NOW())
       ON CONFLICT (ritual_id, user_id)
       DO UPDATE SET status = 'waiting',
                     position = EXCLUDED.position,
                     promoted_at = NULL,
                     left_at = NULL,
                     created_at = NOW()
       RETURNING *`,
      [ritualId, userId, position]
    );

    await client.query('COMMIT');
    return { ok: true, status: 201, data: { entry: upserted.rows[0], already_waiting: false } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function leaveWaitlist(userId, ritualId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE ritual_waitlist
       SET status = 'left', left_at = NOW()
       WHERE ritual_id = $1 AND user_id = $2 AND status = 'waiting'
       RETURNING *`,
      [ritualId, userId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, body: { success: false, error: 'Waitlist entry not found' } };
    }
    await resequencePositions(client, ritualId);
    await client.query('COMMIT');
    return { ok: true, status: 200, data: { entry: result.rows[0] } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resequencePositions(client, ritualId) {
  await client.query(
    `UPDATE ritual_waitlist w
     SET position = ranked.rn
     FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY position, created_at) AS rn
       FROM ritual_waitlist
       WHERE ritual_id = $1 AND status = 'waiting'
     ) ranked
     WHERE w.id = ranked.id AND w.position IS DISTINCT FROM ranked.rn`,
    [ritualId]
  );
}

export async function listWaitlist(ritualId) {
  const result = await pool.query(
    `SELECT w.id, w.ritual_id, w.user_id, w.position, w.status, w.created_at,
            u.name AS user_name, u.city AS user_city, u.university AS user_university,
            u.avatar_url AS user_avatar_url
     FROM ritual_waitlist w
     JOIN users u ON u.id = w.user_id
     WHERE w.ritual_id = $1 AND w.status = 'waiting'
     ORDER BY w.position ASC`,
    [ritualId]
  );
  return result.rows;
}

export async function getWaitlistStatus(userId, ritualId) {
  const [entry, total] = await Promise.all([
    pool.query(
      `SELECT * FROM ritual_waitlist WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ritual_waitlist
       WHERE ritual_id = $1 AND status = 'waiting'`,
      [ritualId]
    ),
  ]);
  const row = entry.rows[0] ?? null;
  return {
    waiting: row?.status === 'waiting',
    position: row?.status === 'waiting' ? row.position : null,
    status: row?.status ?? null,
    total_waiting: total.rows[0]?.count ?? 0,
    entry: row,
  };
}

export async function listMyWaitlistEntries(userId) {
  const result = await pool.query(
    `SELECT w.id, w.ritual_id, w.position, w.status, w.created_at, w.promoted_at,
            r.title AS ritual_title, r.start_time, r.capacity, r.location_name,
            (SELECT COUNT(*)::int FROM ritual_waitlist w2
             WHERE w2.ritual_id = w.ritual_id AND w2.status = 'waiting') AS total_waiting
     FROM ritual_waitlist w
     JOIN rituals r ON r.id = w.ritual_id
     WHERE w.user_id = $1 AND w.status IN ('waiting', 'promoted')
     ORDER BY r.start_time ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Koltuk açıldığında FIFO terfi. İptal/no-show sonrası çağrılır.
 * Boş koltuk sayısı kadar bekleyeni 'confirmed' yapar.
 * @returns {Promise<Array<{ user_id: string, position: number }>>} terfi edenler
 */
export async function promoteWaitlistForRitual(ritualId) {
  if (!isWaitlistEnabled()) return [];

  const client = await pool.connect();
  const promoted = [];
  try {
    await client.query('BEGIN');

    const ritual = await loadRitual(client, ritualId);
    if (!ritual || ritual.collapsed_at || ritual.status === 'cancelled') {
      await client.query('ROLLBACK');
      return [];
    }
    if (new Date(ritual.start_time) <= new Date()) {
      await client.query('ROLLBACK');
      return [];
    }

    let seatsLeft = Number(ritual.capacity) - (await countConfirmed(client, ritualId));
    try {
      const held = await client.query(
        `SELECT COUNT(*)::int AS n
         FROM ritual_waitlist
         WHERE ritual_id = $1
           AND status = 'offered'
           AND (offer_expires_at IS NULL OR offer_expires_at > NOW())`,
        [ritualId]
      );
      seatsLeft -= Number(held.rows[0]?.n || 0);
    } catch (_e) {
      /* optional */
    }
    if (seatsLeft <= 0) {
      await client.query('ROLLBACK');
      return [];
    }

    const { waitlistPromoteMode, waitlistOfferTtlMin } = await import('./megaLaunchLocks.js');
    const paid = Number(ritual.fee_amount || 0) > 0;
    const mode = waitlistPromoteMode({ paid });
    const ttlMin = waitlistOfferTtlMin();

    await client.query(
      `UPDATE ritual_waitlist
       SET status = 'waiting', offered_at = NULL, offer_expires_at = NULL
       WHERE ritual_id = $1
         AND status = 'offered'
         AND offer_expires_at IS NOT NULL
         AND offer_expires_at < NOW()`,
      [ritualId]
    );

    const queue = await client.query(
      `SELECT * FROM ritual_waitlist
       WHERE ritual_id = $1 AND status = 'waiting'
       ORDER BY position ASC, created_at ASC
       FOR UPDATE`,
      [ritualId]
    );

    for (const entry of queue.rows) {
      if (seatsLeft <= 0) break;

      const gate = await assertCanJoinRitualConstraints(client, entry.user_id, ritual);
      if (!gate.ok) continue;

      if (mode === 'OFFER') {
        await client.query(
          `UPDATE ritual_waitlist
           SET status = 'offered', offered_at = NOW(),
               offer_expires_at = NOW() + ($2::int * INTERVAL '1 minute')
           WHERE id = $1`,
          [entry.id, ttlMin]
        );
        promoted.push({
          user_id: entry.user_id,
          position: entry.position,
          mode: 'OFFER',
          offer_ttl_min: ttlMin,
        });
        seatsLeft -= 1;
        continue;
      }

      const joinedAt = new Date();
      const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(
        joinedAt,
        ritual.start_time,
        ritual
      );

      await client.query(
        `INSERT INTO ritual_attendance (
           ritual_id, user_id, status, joined_at,
           prelobby_grace_ends_at, exact_details_unlocked_at, join_count
         )
         VALUES ($1, $2, 'confirmed', $3, $4, $5, 1)
         ON CONFLICT (ritual_id, user_id)
         DO UPDATE SET status = 'confirmed',
                       joined_at = EXCLUDED.joined_at,
                       prelobby_grace_ends_at = EXCLUDED.prelobby_grace_ends_at,
                       exact_details_unlocked_at = EXCLUDED.exact_details_unlocked_at,
                       join_count = COALESCE(ritual_attendance.join_count, 0) + 1,
                       cancelled_at = NULL,
                       cancellation_type = NULL`,
        [ritualId, entry.user_id, joinedAt, graceEndsAt, exactDetailsUnlockedAt]
      );

      await client.query(
        `UPDATE ritual_waitlist
         SET status = 'promoted', promoted_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );

      promoted.push({ user_id: entry.user_id, position: entry.position });
      seatsLeft -= 1;
    }

    if (promoted.length > 0) {
      await resequencePositions(client, ritualId);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  for (const item of promoted) {
    const isOffer = item.mode === 'OFFER';
    await notifyBestEffort(
      item.user_id,
      isOffer ? 'waitlist_offer' : 'waitlist_promoted',
      isOffer ? 'Koltuk teklifi' : 'Koltuk açıldı',
      isOffer
        ? 'Sıradaki koltuk senin — teklif kartı. Cevapsızsa sonraki sıraya geçer.'
        : 'Boş koltuk otomatik sana geçti.',
      { ritual_id: ritualId, mode: item.mode || 'AUTO', offer_ttl_min: item.offer_ttl_min || null }
    );
  }

  return promoted;
}

export async function acceptWaitlistOffer(userId, ritualId) {
  if (!isWaitlistEnabled()) {
    return { ok: false, status: 410, body: { success: false, error: 'Waitlist park' } };
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const entry = await client.query(
      `SELECT * FROM ritual_waitlist
       WHERE ritual_id = $1 AND user_id = $2 AND status = 'offered'
       FOR UPDATE`,
      [ritualId, userId]
    );
    if (!entry.rows[0]) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, body: { success: false, error: 'Teklif yok veya doldu' } };
    }
    if (entry.rows[0].offer_expires_at && new Date(entry.rows[0].offer_expires_at) < new Date()) {
      await client.query(
        `UPDATE ritual_waitlist SET status = 'waiting', offered_at = NULL, offer_expires_at = NULL WHERE id = $1`,
        [entry.rows[0].id]
      );
      await client.query('COMMIT');
      return { ok: false, status: 410, body: { success: false, error: 'Teklif süresi doldu', code: 'OFFER_EXPIRED' } };
    }
    const ritual = await loadRitual(client, ritualId);
    const joinedAt = new Date();
    const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(
      joinedAt,
      ritual.start_time,
      ritual
    );
    await client.query(
      `INSERT INTO ritual_attendance (
         ritual_id, user_id, status, joined_at,
         prelobby_grace_ends_at, exact_details_unlocked_at, join_count
       )
       VALUES ($1, $2, 'confirmed', $3, $4, $5, 1)
       ON CONFLICT (ritual_id, user_id)
       DO UPDATE SET status = 'confirmed',
                     joined_at = EXCLUDED.joined_at,
                     cancelled_at = NULL`,
      [ritualId, userId, joinedAt, graceEndsAt, exactDetailsUnlockedAt]
    );
    await client.query(
      `UPDATE ritual_waitlist SET status = 'promoted', promoted_at = NOW() WHERE id = $1`,
      [entry.rows[0].id]
    );
    await client.query('COMMIT');
    return { ok: true, data: { mode: 'OFFER', accepted: true } };
  } catch (e) {
    await client.query('ROLLBACK');
    return { ok: false, status: 500, body: { success: false, error: e.message } };
  } finally {
    client.release();
  }
}

/** Koltuk açılınca terfi denemesi — çağıran akışı bloklamaz. */
export function promoteWaitlistBestEffort(ritualId) {
  if (!isWaitlistEnabled()) return;
  promoteWaitlistForRitual(ritualId).catch((error) => {
    console.warn('waitlist promote failed:', error.message);
  });
}
