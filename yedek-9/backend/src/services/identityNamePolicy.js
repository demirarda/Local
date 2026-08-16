/**
 * §1 — username / display-name change cooldowns
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function getNameChangeDays() {
  return Number(LOCAL_CONFIG.identity?.NAME_CHANGE_D) || 90;
}

export function getUsernameChangeDays() {
  return Number(LOCAL_CONFIG.identity?.USERNAME_CHANGE_D) || 90;
}

function daysSince(ts) {
  if (!ts) return Infinity;
  const ms = Date.now() - new Date(ts).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, error: string, code?: string, retry_after_d?: number }}
 */
export async function assertNameChangeAllowed(userId, nextName) {
  if (nextName === undefined) return { ok: true };
  const r = await pool.query(
    `SELECT name, name_locked, name_changed_at FROM users WHERE id = $1`,
    [userId]
  );
  const u = r.rows[0];
  if (!u) return { ok: false, status: 404, error: 'user_not_found' };
  if (String(nextName) === String(u.name || '')) return { ok: true };

  const limitD = getNameChangeDays();
  const elapsed = daysSince(u.name_changed_at);
  if (u.name_locked && Number.isFinite(elapsed) && elapsed < limitD) {
    return {
      ok: false,
      status: 429,
      error: 'name_change_cooldown',
      code: 'NAME_CHANGE_D',
      retry_after_d: Math.ceil(limitD - elapsed),
    };
  }
  return { ok: true };
}

/**
 * @returns {{ ok: true, username: string } | { ok: false, status: number, error: string, code?: string, retry_after_d?: number }}
 */
export async function assertUsernameChangeAllowed(userId, nextUsername) {
  if (nextUsername === undefined) return { ok: true };
  const raw = String(nextUsername || '').trim();
  if (!USERNAME_RE.test(raw)) {
    return { ok: false, status: 400, error: 'username_invalid', code: 'USERNAME_FORMAT' };
  }
  const lower = raw.toLowerCase();

  const reserved = await pool.query(
    `SELECT 1 FROM reserved_usernames WHERE username = $1 LIMIT 1`,
    [lower]
  );
  if (reserved.rows[0]) {
    return { ok: false, status: 400, error: 'username_reserved', code: 'USERNAME_RESERVED' };
  }

  const taken = await pool.query(
    `SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
    [lower, userId]
  );
  if (taken.rows[0]) {
    return { ok: false, status: 409, error: 'username_taken', code: 'USERNAME_TAKEN' };
  }

  const r = await pool.query(
    `SELECT username, username_changed_at FROM users WHERE id = $1`,
    [userId]
  );
  const u = r.rows[0];
  if (!u) return { ok: false, status: 404, error: 'user_not_found' };
  if (u.username && String(u.username).toLowerCase() === lower) {
    return { ok: true, username: lower };
  }

  const limitD = getUsernameChangeDays();
  const elapsed = daysSince(u.username_changed_at);
  if (u.username && Number.isFinite(elapsed) && elapsed < limitD) {
    return {
      ok: false,
      status: 429,
      error: 'username_change_cooldown',
      code: 'USERNAME_CHANGE_D',
      retry_after_d: Math.ceil(limitD - elapsed),
    };
  }
  return { ok: true, username: lower };
}
