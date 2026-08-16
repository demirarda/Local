/**
 * Chip→badge köprüsü — LOCAL v2 §9
 * Tekrarlayan chip desenleri → badge sinyali.
 * CHIP_BRIDGE.open=true (v3): tekrarlayan chip desenleri sinyal yazar.
 * CHIP_BRIDGE.enabled=false (launch): otomatik grant yok.
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

function bridgeConfig() {
  const cfg = LOCAL_CONFIG.badges?.CHIP_BRIDGE || {};
  return {
    open: cfg.open !== false,
    enabled: Boolean(cfg.enabled),
    /** Provisional — founder kalibrasyonu açık */
    min_repeats: Math.max(2, Number(cfg.min_repeats) || 3),
    window_days: Math.max(7, Number(cfg.window_days) || 90),
    /**
     * chip_id → suggested badge slug (provisional map)
     * Boşsa pattern_key = chip:{id} ve suggested null kalır.
     */
    pattern_map: cfg.pattern_map || {
      rq_g_1: 'feedback_giver',
      rq_g_2: 'feedback_giver',
      rq_y_1: 'always_on_time',
      p2v_g_1: 'venue_regular',
      p2v_r_servis: 'feedback_champion',
      p2z_g_1: 'zone_spark',
      p2z_r_marker: 'zone_spark',
    },
  };
}

export function isChipBridgeOpen() {
  return bridgeConfig().open;
}

export function isChipBridgeEnabled() {
  return bridgeConfig().enabled;
}

/**
 * After feedback with chip_id — count pattern and upsert signal.
 * Never grants badges while enabled=false.
 */
export async function observeChipForBadgeSignal({
  userId,
  chipId,
  feedbackId = null,
  ritualId = null,
  feeling = null,
} = {}) {
  if (!userId || !chipId) return { ok: true, skipped: true, reason: 'missing' };
  const cfg = bridgeConfig();
  if (!cfg.open) return { ok: true, skipped: true, reason: 'bridge_closed' };

  const chip = String(chipId).trim().slice(0, 64);
  const suggested = cfg.pattern_map[chip] || null;
  const patternKey = suggested ? `chip_to:${suggested}` : `chip:${chip}`;

  const countR = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM feedback
     WHERE from_user_id = $1
       AND chip_id = $2
       AND submitted_at >= NOW() - ($3::text || ' days')::interval`,
    [userId, chip, String(cfg.window_days)]
  );
  const hitCount = Number(countR.rows[0]?.n || 0);
  const ready = hitCount >= cfg.min_repeats;
  const status = ready ? 'ready' : 'observed';

  const upsert = await pool.query(
    `INSERT INTO chip_badge_signals (
       user_id, chip_id, pattern_key, suggested_badge_slug, hit_count, status,
       last_feedback_id, last_ritual_id, meta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (user_id, pattern_key) DO UPDATE SET
       chip_id = EXCLUDED.chip_id,
       suggested_badge_slug = COALESCE(EXCLUDED.suggested_badge_slug, chip_badge_signals.suggested_badge_slug),
       hit_count = EXCLUDED.hit_count,
       status = CASE
         WHEN chip_badge_signals.status IN ('dismissed', 'granted', 'queued') THEN chip_badge_signals.status
         ELSE EXCLUDED.status
       END,
       last_feedback_id = EXCLUDED.last_feedback_id,
       last_ritual_id = COALESCE(EXCLUDED.last_ritual_id, chip_badge_signals.last_ritual_id),
       meta = EXCLUDED.meta,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      chip,
      patternKey,
      suggested,
      hitCount,
      status,
      feedbackId,
      ritualId,
      JSON.stringify({
        feeling: feeling || null,
        min_repeats: cfg.min_repeats,
        window_days: cfg.window_days,
        bridge_enabled: cfg.enabled,
      }),
    ]
  );

  const signal = upsert.rows[0];
  let grant = null;

  // Launch: enabled=false → sinyal only. enabled=true → optional auto-queue (still no skor etkisi).
  if (cfg.enabled && signal.status === 'ready' && suggested) {
    try {
      const { canEarnBadges } = await import('./modEngine.js');
      if (await canEarnBadges(userId)) {
        const { assignManualBadge } = await import('./badgeEngine.js');
        // System signal path — only if slug is rule/manual catalog; treat as novice hint grant
        grant = await assignManualBadge(userId, suggested, 'novice', { ritualId });
        if (grant?.ok) {
          await pool.query(
            `UPDATE chip_badge_signals SET status = 'granted', updated_at = NOW() WHERE id = $1`,
            [signal.id]
          );
          signal.status = 'granted';
        }
      }
    } catch (_e) {
      /* ignore — signal retained */
    }
  }

  return {
    ok: true,
    signal,
    ready,
    auto_grant: Boolean(grant?.ok),
    bridge_enabled: cfg.enabled,
  };
}

export async function listChipBadgeSignals({ status = 'ready', limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT s.*, u.name AS user_name
     FROM chip_badge_signals s
     JOIN users u ON u.id = s.user_id
     WHERE ($1::text IS NULL OR s.status = $1)
     ORDER BY s.updated_at DESC
     LIMIT $2`,
    [status || null, Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  return r.rows;
}

export async function dismissChipBadgeSignal(signalId, adminId, note = null) {
  const r = await pool.query(
    `UPDATE chip_badge_signals
     SET status = 'dismissed',
         meta = meta || jsonb_build_object('dismissed_by', $2::text, 'dismiss_note', $3::text),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [signalId, String(adminId), note || null]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Not found' };
  return { ok: true, signal: r.rows[0] };
}
