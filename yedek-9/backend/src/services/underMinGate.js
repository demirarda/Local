/**
 * sonMD UNDER_MIN — seal_count < min → skor-izolasyonu; seal_count=0 → hard-delete
 */
import pool from '../config/database.js';
import LOCAL_CONFIG, { getCategorySoftCap } from '../config/localConfig.js';
import { countSealedAtRitual } from './firstSealService.js';

export function resolveMinCapacity(ritual) {
  const soft = getCategorySoftCap(
    ritual?.category_label || ritual?.category || ritual?.category_key || ritual?.title
  );
  // category_label exact key shortcut
  const caps = LOCAL_CONFIG.ritual?.CATEGORY_SOFT_CAPS || {};
  const keyHint = String(ritual?.category_label || ritual?.category_key || '').toLowerCase();
  const fromKey = caps[keyHint];
  const floor = Number(LOCAL_CONFIG.ritual?.MIN_SIZE ?? 3);
  const softMin = Number((fromKey || soft)?.soft_min ?? floor);
  return Math.max(floor, softMin);
}

/**
 * @returns {Promise<{ mode: 'normal'|'under_min'|'hard_delete', seal_count: number, min: number }>}
 */
export async function classifyUnderMin(ritualId, ritualRow = null) {
  let ritual = ritualRow;
  if (!ritual) {
    const r = await pool.query(
      `SELECT id, title, capacity, under_min FROM rituals WHERE id = $1`,
      [ritualId]
    );
    ritual = r.rows[0];
  }
  if (!ritual) {
    return { mode: 'hard_delete', seal_count: 0, min: 3 };
  }
  const seal_count = await countSealedAtRitual(ritualId);
  const min = resolveMinCapacity(ritual);
  if (seal_count <= 0) {
    return { mode: 'hard_delete', seal_count, min };
  }
  if (seal_count < min) {
    return { mode: 'under_min', seal_count, min };
  }
  return { mode: 'normal', seal_count, min };
}

export async function isRitualUnderMin(ritualId) {
  const r = await pool.query(
    `SELECT under_min FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (r.rows[0]?.under_min === true) return true;
  const c = await classifyUnderMin(ritualId);
  return c.mode === 'under_min';
}

/**
 * Mark ritual as under_min private window (no RS/FB/Regular/LW).
 */
export async function markRitualUnderMin(ritualId, { sealCount, min } = {}) {
  await pool.query(
    `UPDATE rituals
     SET under_min = true,
         cancel_reason = COALESCE(cancel_reason, 'under_min'),
         visibility = CASE
           WHEN visibility IS NULL THEN 'venue_only'
           ELSE visibility
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [ritualId]
  );
  return { ok: true, under_min: true, seal_count: sealCount, min };
}

/**
 * 0-mühür: iz bırakmadan düşür (hard-delete best-effort cascade).
 */
export async function hardDeleteZeroSealRitual(ritualId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ritual_checkin_attempts WHERE ritual_id = $1`, [ritualId]);
    await client.query(`DELETE FROM ritual_attendance WHERE ritual_id = $1`, [ritualId]);
    await client.query(`DELETE FROM chat_messages WHERE ritual_id = $1`, [ritualId]).catch(() => {});
    await client.query(`DELETE FROM memories WHERE ritual_id = $1`, [ritualId]).catch(() => {});
    await client.query(`DELETE FROM rituals WHERE id = $1`, [ritualId]);
    await client.query('COMMIT');
    return { ok: true, deleted: true };
  } catch (e) {
    await client.query('ROLLBACK');
    // Fallback: soft cancel if FK blocks hard delete
    await pool.query(
      `UPDATE rituals
       SET status = 'cancelled',
           cancel_reason = 'under_min',
           under_min = true,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [ritualId]
    );
    return { ok: true, deleted: false, soft_cancelled: true, error: e.message };
  } finally {
    client.release();
  }
}

/**
 * Window girişinde sınıflandır + yan etki.
 * @returns {Promise<{ proceed: boolean, classification: object }>}
 * proceed=false → feedback/RS/notify pipeline atlanır
 */
export async function applyUnderMinOnWindowEntry(ritualId) {
  const classification = await classifyUnderMin(ritualId);
  if (classification.mode === 'hard_delete') {
    await hardDeleteZeroSealRitual(ritualId);
    return { proceed: false, classification };
  }
  if (classification.mode === 'under_min') {
    await markRitualUnderMin(ritualId, {
      sealCount: classification.seal_count,
      min: classification.min,
    });
    return { proceed: false, classification };
  }
  await pool.query(
    `UPDATE rituals SET under_min = false, updated_at = NOW() WHERE id = $1 AND under_min IS DISTINCT FROM false`,
    [ritualId]
  ).catch(() => {});
  return { proceed: true, classification };
}
