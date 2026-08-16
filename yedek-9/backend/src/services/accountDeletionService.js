/**
 * sonMD Sosyal §3 — self-serve hesap silme
 * - Rıza onaylı (confirmPhrase = SIL)
 * - Kendi memory'leri şehir/çevre yüzeyinden düşer
 * - Ortak window yaşanmışlığı arşivde kalabilir (isim → "Eski üye")
 * - KVKK export ayrı endpoint
 */
import pool from '../config/database.js';

export const FORMER_MEMBER_NAME = 'Eski üye';
export const DELETE_CONFIRM_PHRASE = 'SIL';

/**
 * @param {{ userId: string, confirmPhrase: string }} args
 */
export async function deleteOwnAccount({ userId, confirmPhrase }) {
  const phrase = String(confirmPhrase || '')
    .trim()
    .toUpperCase()
    .replace(/İ/g, 'I');
  if (phrase !== DELETE_CONFIRM_PHRASE) {
    return {
      ok: false,
      status: 400,
      error: 'Onay için SIL yazmalısın',
      code: 'CONFIRM_PHRASE_REQUIRED',
    };
  }

  const u = await pool.query(
    `SELECT id, name, email, deleted_at FROM users WHERE id = $1`,
    [userId]
  );
  if (!u.rows[0]) {
    return { ok: false, status: 404, error: 'User not found' };
  }
  if (u.rows[0].deleted_at) {
    return { ok: true, already: true, display_name: FORMER_MEMBER_NAME };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Şehir/çevre vitrininden düş: CITY/CIRCLE → WINDOW + withdrawn
    await client.query(
      `UPDATE memories
       SET audience = 'WINDOW',
           withdrawn_at = COALESCE(withdrawn_at, NOW()),
           withdrawn_reason = COALESCE(withdrawn_reason, 'account_deletion')
       WHERE user_id = $1
         AND COALESCE(audience, 'WINDOW') IN ('CITY', 'CIRCLE')`,
      [userId]
    );

    // Ritual'sız solo anıları kaldır
    await client.query(
      `DELETE FROM memories
       WHERE user_id = $1
         AND ritual_id IS NULL`,
      [userId]
    );

    await client.query(
      `UPDATE user_settings SET
         discoverable_by_username = false,
         discoverable_by_email = false,
         discoverable_by_phone = false,
         public_profile = false,
         account_privacy = 'CLOSED',
         show_friends_list = false,
         show_rs_score_publicly = false,
         updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `UPDATE users SET
         name = $2,
         email = NULL,
         password_hash = NULL,
         avatar_url = NULL,
         verification_token = NULL,
         verification_token_expires = NULL,
         reset_token = NULL,
         reset_token_expires = NULL,
         web_named = false,
         deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, FORMER_MEMBER_NAME]
    );

    await client.query(`DELETE FROM device_tokens WHERE user_id = $1`, [userId]);

    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_r) {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }

  return {
    ok: true,
    display_name: FORMER_MEMBER_NAME,
    consent_ack: true,
    note:
      'Kendi memorylerin şehir vitrininden düştü. Ortak masa anıları window arşivinde "Eski üye" olarak kalabilir.',
  };
}
