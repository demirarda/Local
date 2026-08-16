/**
 * Badge LLM pipeline stub — son-part.md §10 Katman 3
 * Launch'ta onay kuyrugu; otomatik atama YOK.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

export function isLlmPipelineEnabled() {
  return Boolean(LOCAL_CONFIG.badges.LLM_PIPELINE_ENABLED);
}

export async function submitLlmBadgeSuggestion(userId, { ritualId, suggestedSlug, suggestedLevel = 'novice', reason } = {}) {
  if (!isLlmPipelineEnabled()) {
    return { ok: false, status: 503, error: 'LLM badge pipeline is disabled' };
  }
  const slug = String(suggestedSlug || '').trim();
  if (!slug) return { ok: false, status: 400, error: 'suggested_slug is required' };

  const r = await pool.query(
    `INSERT INTO badge_llm_suggestions (user_id, ritual_id, suggested_slug, suggested_level, reason, status)
     VALUES ($1,$2,$3,$4,$5,'pending')
     RETURNING *`,
    [userId, ritualId || null, slug, suggestedLevel, reason || null]
  );
  return { ok: true, suggestion: r.rows[0] };
}

export async function listPendingLlmSuggestions({ limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT s.*, u.name AS user_name
     FROM badge_llm_suggestions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'pending'
     ORDER BY s.created_at ASC
     LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)]
  );
  return r.rows;
}

export async function reviewLlmSuggestion(suggestionId, reviewerId, { approve, note } = {}) {
  const sugR = await pool.query(
    `SELECT * FROM badge_llm_suggestions WHERE id = $1 AND status = 'pending'`,
    [suggestionId]
  );
  if (sugR.rows.length === 0) return { ok: false, status: 404, error: 'Pending suggestion not found' };
  const sug = sugR.rows[0];

  const status = approve ? 'approved' : 'rejected';
  await pool.query(
    `UPDATE badge_llm_suggestions
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(), reason = COALESCE($4, reason)
     WHERE id = $1`,
    [suggestionId, status, reviewerId, note || null]
  );

  if (!approve) return { ok: true, status };

  const badgeR = await pool.query(`SELECT id, slug, name FROM badges WHERE slug = $1`, [sug.suggested_slug]);
  let badgeId = badgeR.rows[0]?.id;
  if (!badgeId) {
    const ins = await pool.query(
      `INSERT INTO badges (slug, name, spec_category, badge_level, assignment_layer, category)
       VALUES ($1, $2, 'special', $3, 'llm', 'social')
       RETURNING id, slug, name`,
      [sug.suggested_slug, sug.suggested_slug, sug.suggested_level || 'novice']
    );
    badgeId = ins.rows[0].id;
  }

  await pool.query(
    `INSERT INTO user_badges (user_id, badge_id, badge_level, progress_value, target_value, earned_at, ritual_id, badge_key, badge_label)
     VALUES ($1,$2,$3,1,1,NOW(),$4,$5,$6)
     ON CONFLICT DO NOTHING`,
    [
      sug.user_id,
      badgeId,
      sug.suggested_level || 'novice',
      sug.ritual_id,
      sug.suggested_slug,
      badgeR.rows[0]?.name || sug.suggested_slug,
    ]
  );

  return { ok: true, status: 'approved' };
}
