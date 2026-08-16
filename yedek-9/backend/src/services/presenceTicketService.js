import crypto from 'crypto';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function issuePresenceTicket(userId, ritualId) {
  const ttlMin = Number(LOCAL_CONFIG.presence?.TICKET_TTL_MIN || 90);
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMin * 60000);
  await pool.query(
    `INSERT INTO presence_tickets (user_id, ritual_id, ticket_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, ritualId, hashToken(token), expiresAt]
  );
  return { token, expires_at: expiresAt.toISOString(), ttl_min: ttlMin };
}

export async function revokePresenceTicketsForUser(userId) {
  await pool.query(
    `UPDATE presence_tickets
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * sonMD Check-in §7 — buradayım bileti kozmetik; yetki sıfır.
 * validatePresenceTicket kapı olarak kullanılmaz (witness/tag/reveal JWT+mühür ile yürür).
 */
export async function validatePresenceTicket(userId, ritualId, token) {
  if (!token) return { ok: false, status: 401, error: 'presence ticket required' };
  const r = await pool.query(
    `SELECT id
     FROM presence_tickets
     WHERE user_id = $1
       AND ritual_id = $2
       AND ticket_hash = $3
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, ritualId, hashToken(token)]
  );
  if (!r.rows.length) return { ok: false, status: 401, error: 'invalid or expired presence ticket' };
  return { ok: true };
}
