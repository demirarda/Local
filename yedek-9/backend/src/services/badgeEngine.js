/**
 * Badge motoru — son-part.md §10
 * Katman 1: rule-engine · Katman 3: LLM pipeline (stub, ayri servis)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { notifyBadgeEarned } from './notifications.js';

const LEVELS = LOCAL_CONFIG.badges.LEVELS;
const LEVEL_RANK = { novice: 1, regular: 2, master: 3 };
const LEVEL_LABELS = LOCAL_CONFIG.badges.LEVEL_LABELS || {};
const CATEGORY_MAP = LOCAL_CONFIG.badges.CATEGORY_MAP || {};
const NEGATIVE_SLUGS = new Set(LOCAL_CONFIG.badges.NEGATIVE_SLUGS || ['under_trial']);

export function resolveBadgeFamily(item = {}) {
  if (item.family && LOCAL_CONFIG.badges.CATEGORIES.includes(item.family)) {
    return item.family;
  }
  const spec = String(item.spec_category || '').toLowerCase();
  return CATEGORY_MAP[spec] || 'BEHAVIORAL';
}

export function isNegativeBadgeSlug(slug) {
  return NEGATIVE_SLUGS.has(String(slug || '').trim());
}

export function levelFromProgress(value, thresholds = {}) {
  let achieved = null;
  for (const level of LEVELS) {
    const min = Number(thresholds[level]);
    if (min != null && value >= min) achieved = level;
  }
  return achieved;
}

export function compareLevels(a, b) {
  return (LEVEL_RANK[a] || 0) - (LEVEL_RANK[b] || 0);
}

export async function syncBadgeCatalogFromConfig() {
  const catalog = LOCAL_CONFIG.badges.CATALOG || [];
  let synced = 0;
  for (const item of catalog) {
    const family = resolveBadgeFamily(item);
    const isNeg = Boolean(item.is_negative) || isNegativeBadgeSlug(item.slug);
    await pool.query(
      `INSERT INTO badges (slug, name, description, category, icon_emoji, trigger_condition, spec_category, family, badge_level, rule_engine, assignment_layer, is_negative)
       VALUES ($1, $2, $3, 'behavior'::badge_category, $4, $5::jsonb, $6, $7, 'novice', $5::jsonb, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         icon_emoji = EXCLUDED.icon_emoji,
         trigger_condition = EXCLUDED.trigger_condition,
         spec_category = EXCLUDED.spec_category,
         family = EXCLUDED.family,
         rule_engine = EXCLUDED.rule_engine,
         assignment_layer = EXCLUDED.assignment_layer,
         is_negative = EXCLUDED.is_negative`,
      [
        item.slug,
        item.name,
        item.description || null,
        item.icon_emoji || null,
        JSON.stringify(item.rule || {}),
        item.spec_category || 'behavior',
        family,
        item.assignment_layer || 'rule',
        isNeg,
      ]
    );
    synced += 1;
  }
  return { synced };
}

export async function collectUserBadgeMetrics(userId) {
  const [attendance, cities, memories, forum, pivot, feedback, hosted, earlyCheckins, windowMem, shares, venueRituals, pulse] =
    await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ra.status NOT IN ('no_show', 'cancelled'))::int AS attended,
         COUNT(*) FILTER (WHERE ra.status = 'no_show')::int AS no_show,
         COUNT(*) FILTER (
           WHERE ra.status = 'cancelled'
             AND ra.cancelled_at IS NOT NULL
             AND ra.cancelled_at <= (r.start_time - INTERVAL '6 hours')
         )::int AS early_cancel
       FROM ritual_attendance ra
       LEFT JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT r.city_id)::int AS unique_cities
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND ra.status NOT IN ('no_show', 'cancelled')`,
      [userId]
    ),
    pool.query(`SELECT COUNT(*)::int AS c FROM memories WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM forum_comments WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT 1 FROM host_verifications
       WHERE user_id = $1 AND status = 'active' AND verification_type = 'premium'
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT f.ritual_id)::int AS c
       FROM feedback f
       JOIN ritual_attendance ra ON ra.ritual_id = f.ritual_id AND ra.user_id = $1
       WHERE f.from_user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM rituals WHERE host_id = $1 AND status::text NOT IN ('cancelled')`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1
         AND ra.checkin_at IS NOT NULL
         AND ra.checkin_at <= r.start_time + INTERVAL '5 minutes'`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c
       FROM memories m
       JOIN rituals r ON r.id = m.ritual_id
       WHERE m.user_id = $1 AND r.status::text IN ('window', 'archived', 'ended')`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM share_objects WHERE from_user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance ra
       JOIN rituals r ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND r.venue_id IS NOT NULL
         AND ra.status NOT IN ('no_show', 'cancelled')`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS c FROM pulse_reposts WHERE user_id = $1`,
      [userId]
    ),
  ]);

  const att = attendance.rows[0] || {};
  const attended = Number(att.attended || 0);
  const noShow = Number(att.no_show || 0);
  const earlyCancel = Number(att.early_cancel || 0);

  return {
    attended,
    no_show: noShow,
    early_cancel: earlyCancel,
    attended_without_noshow: Math.max(0, attended - noShow),
    unique_cities: Number(cities.rows[0]?.unique_cities || 0),
    rituals_in_city: attended,
    memory_count: Number(memories.rows[0]?.c || 0),
    forum_posts: Number(forum.rows[0]?.c || 0),
    feedback_count: Number(feedback.rows[0]?.c || 0),
    feedback_given: Number(feedback.rows[0]?.c || 0),
    hosted_rituals: Number(hosted.rows[0]?.c || 0),
    early_checkins: Number(earlyCheckins.rows[0]?.c || 0),
    window_memories: Number(windowMem.rows[0]?.c || 0),
    share_objects_sent: Number(shares.rows[0]?.c || 0),
    rituals_at_venue: Number(venueRituals.rows[0]?.c || 0),
    pulse_posts: Number(pulse.rows[0]?.c || 0),
    is_pivot_host: pivot.rows.length > 0,
    clean_attendance: noShow === 0 ? attended : 0,
  };
}

export function evaluateRuleLevel(rule = {}, metrics = {}) {
  const type = rule.type;
  if (type === 'manual_pivot_host') {
    return metrics.is_pivot_host ? 'novice' : null;
  }
  if (type === 'manual_admin') return null;

  const thresholds = rule.thresholds || {};
  let value = 0;
  switch (type) {
    case 'unique_cities':
      value = metrics.unique_cities;
      break;
    case 'rituals_in_city':
      value = metrics.rituals_in_city;
      break;
    case 'early_cancel_streak':
      value = metrics.early_cancel;
      break;
    case 'attended_without_noshow':
      value = metrics.attended_without_noshow;
      break;
    case 'memory_count':
      value = metrics.memory_count;
      break;
    case 'forum_posts':
      value = metrics.forum_posts;
      break;
    case 'clean_attendance':
      value = metrics.clean_attendance;
      break;
    case 'hosted_rituals':
      value = metrics.hosted_rituals;
      break;
    case 'early_checkins':
      value = metrics.early_checkins;
      break;
    case 'window_memories':
      value = metrics.window_memories;
      break;
    case 'share_objects_sent':
      value = metrics.share_objects_sent;
      break;
    case 'rituals_at_venue':
      value = metrics.rituals_at_venue;
      break;
    case 'feedback_given':
      value = metrics.feedback_given;
      break;
    case 'pulse_posts':
      value = metrics.pulse_posts;
      break;
    default:
      return null;
  }
  return levelFromProgress(value, thresholds);
}

async function upsertUserBadgeLevel(userId, badge, achievedLevel, ritualId = null) {
  if (!achievedLevel) return { changed: false };
  try {
    const { canEarnBadges } = await import('./modEngine.js');
    if (!(await canEarnBadges(userId))) {
      // Askıda yeni rozet kazanımı durur; kazanılmış silinmez
      return { changed: false, paused: true };
    }
  } catch (_e) {
    /* ignore */
  }
  const existing = await pool.query(
    `SELECT id, badge_level, earned_at FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
    [userId, badge.id]
  );
  const prevLevel = existing.rows[0]?.badge_level;
  const upgraded = !prevLevel || compareLevels(achievedLevel, prevLevel) > 0;
  const target = LEVEL_RANK[achievedLevel] || 1;

  if (existing.rows.length === 0) {
    const ins = await pool.query(
      `INSERT INTO user_badges (user_id, badge_id, badge_level, progress_value, target_value, earned_at, ritual_id, badge_key, badge_label)
       VALUES ($1,$2,$3,$4,$4,NOW(),$5,$6,$7)
       RETURNING id, earned_at, badge_level`,
      [userId, badge.id, achievedLevel, target, ritualId, badge.slug, badge.name]
    );
    await notifyBadgeEarned(userId, {
      badge_label: badge.name,
      condition: `${achievedLevel} seviye`,
      ritual_id: ritualId,
    }).catch(() => {});
    return { changed: true, earned: true, level: ins.rows[0].badge_level };
  }

  if (!upgraded) return { changed: false, level: prevLevel };

  const upd = await pool.query(
    `UPDATE user_badges
     SET badge_level = $3,
         progress_value = $4,
         target_value = $4,
         earned_at = COALESCE(earned_at, NOW()),
         ritual_id = COALESCE($5, ritual_id)
     WHERE user_id = $1 AND badge_id = $2
     RETURNING id, badge_level, earned_at`,
    [userId, badge.id, achievedLevel, target, ritualId]
  );
  await notifyBadgeEarned(userId, {
    badge_label: badge.name,
    condition: `${achievedLevel} seviye`,
    ritual_id: ritualId,
  }).catch(() => {});
  return { changed: true, upgraded: true, level: upd.rows[0].badge_level };
}

export async function evaluateBadgesForUser(userId, { ritualId = null } = {}) {
  await syncBadgeCatalogFromConfig();
  const metrics = await collectUserBadgeMetrics(userId);
  const catalog = await pool.query(
    `SELECT id, slug, name, rule_engine, assignment_layer, spec_category, is_negative
     FROM badges
     WHERE (assignment_layer = 'rule' OR assignment_layer IS NULL)
       AND COALESCE(is_negative, false) = false`
  );

  let changed = 0;
  for (const badge of catalog.rows) {
    if (isNegativeBadgeSlug(badge.slug)) continue;
    const rule = badge.rule_engine && typeof badge.rule_engine === 'object'
      ? badge.rule_engine
      : {};
    const level = evaluateRuleLevel(rule, metrics);
    const result = await upsertUserBadgeLevel(userId, badge, level, ritualId);
    if (result.changed) changed += 1;
  }
  return { user_id: userId, changed };
}

export async function evaluateBadgesForRitual(ritualId) {
  if (!ritualId) return { skipped: true, reason: 'missing_ritual_id' };
  const participants = await pool.query(
    `SELECT DISTINCT user_id
     FROM ritual_attendance
     WHERE ritual_id = $1 AND status::text NOT IN ('no_show', 'cancelled')`,
    [ritualId]
  );
  const venueR = await pool.query(`SELECT venue_id FROM rituals WHERE id = $1`, [ritualId]);
  const venueId = venueR.rows[0]?.venue_id || null;

  let changed = 0;
  let venueGranted = 0;
  for (const row of participants.rows) {
    const r = await evaluateBadgesForUser(row.user_id, { ritualId });
    changed += r.changed || 0;
    await notifyBadgeApproachingIfNeeded(row.user_id).catch(() => {});
    if (venueId) {
      const { grantVenueBadgeIfEarned } = await import('./venueBadgeService.js');
      const vg = await grantVenueBadgeIfEarned(row.user_id, venueId, { ritualId }).catch(() => null);
      venueGranted += vg?.granted || 0;
    }
  }
  return { ritual_id: ritualId, users: participants.rows.length, changed, venue_granted: venueGranted };
}

export function remainingToNextLevel({ value = 0, next_threshold } = {}) {
  if (next_threshold == null || next_threshold === '') return null;
  return Math.max(0, Number(next_threshold) - Number(value || 0));
}

export async function notifyBadgeApproachingIfNeeded(userId) {
  const full = await getFullBadgeArchive(userId);
  for (const b of full.in_progress || []) {
    const remaining = remainingToNextLevel(b);
    if (remaining !== 2 || !b.slug) continue;
    const { notifyBadgeApproaching } = await import('./notifications.js');
    await notifyBadgeApproaching(userId, {
      slug: b.slug,
      name: b.name,
      progress_pct: b.progress_pct,
      next_level: b.next_level,
      remaining_rituals: 2,
    }).catch(() => {});
  }
}

function metricValueForRule(type, metrics = {}) {
  switch (type) {
    case 'unique_cities': return metrics.unique_cities;
    case 'rituals_in_city': return metrics.rituals_in_city;
    case 'early_cancel_streak': return metrics.early_cancel;
    case 'attended_without_noshow': return metrics.attended_without_noshow;
    case 'memory_count': return metrics.memory_count;
    case 'forum_posts': return metrics.forum_posts;
    case 'clean_attendance': return metrics.clean_attendance;
    case 'hosted_rituals': return metrics.hosted_rituals;
    case 'early_checkins': return metrics.early_checkins;
    case 'window_memories': return metrics.window_memories;
    case 'share_objects_sent': return metrics.share_objects_sent;
    case 'rituals_at_venue': return metrics.rituals_at_venue;
    case 'feedback_given': return metrics.feedback_given;
    case 'pulse_posts': return metrics.pulse_posts;
    default: return 0;
  }
}

export function formatRuleCondition(rule = {}) {
  const type = rule.type;
  if (type === 'manual_pivot_host') return 'LOCAL ekibi tarafindan secildi';
  if (type === 'manual_admin') return 'Yalnizca admin atamasi';
  if (type === 'manual_brand') return 'Marka ortakligi rozeti';
  if (type === 'manual_venue') return 'Mekan kurucusu rozeti';
  const th = rule.thresholds || {};
  if (!th.novice && !th.regular && !th.master) return 'Ozel kosul';
  const parts = LEVELS.filter((l) => th[l] != null).map((l) => `${LEVEL_LABELS[l] || l}: ${th[l]}`);
  return `Esik — ${parts.join(' · ')}`;
}

export function computeRuleProgress(rule = {}, metrics = {}) {
  const type = rule.type;
  if (['manual_pivot_host', 'manual_admin', 'manual_brand', 'manual_venue'].includes(type)) {
    return { value: 0, progress_pct: 0, next_level: null, next_threshold: null };
  }
  const thresholds = rule.thresholds || {};
  const value = Number(metricValueForRule(type, metrics) || 0);
  const achievedLevel = levelFromProgress(value, thresholds);
  let nextLevel = 'novice';
  let nextThreshold = thresholds.novice;
  if (achievedLevel === 'novice') {
    nextLevel = 'regular';
    nextThreshold = thresholds.regular;
  } else if (achievedLevel === 'regular') {
    nextLevel = 'master';
    nextThreshold = thresholds.master;
  } else if (achievedLevel === 'master') {
    return { value, progress_pct: 100, next_level: null, next_threshold: null, achieved_level: 'master' };
  }
  const pct = nextThreshold != null && nextThreshold > 0
    ? Math.min(100, Math.round((value / nextThreshold) * 100))
    : 0;
  return {
    value,
    progress_pct: pct,
    next_level: nextThreshold != null ? nextLevel : null,
    next_threshold: nextThreshold ?? null,
    achieved_level: achievedLevel,
  };
}

export async function userMeetsBadgeRequirement(userId, slug, minLevel = 'novice') {
  const key = String(slug || '').trim();
  if (!key) return true;
  // Negatif rozetler kapı koşulu olamaz
  if (isNegativeBadgeSlug(key)) return false;

  let isNegInDb = false;
  try {
    const negCheck = await pool.query(
      `SELECT is_negative FROM badges WHERE slug = $1 LIMIT 1`,
      [key]
    );
    isNegInDb = Boolean(negCheck.rows[0]?.is_negative);
  } catch (_e) {
    /* migration 087 henüz yoksa sessiz geç */
  }
  if (isNegInDb) return false;

  const min = LEVELS.includes(minLevel) ? minLevel : 'novice';
  try {
    const r = await pool.query(
      `SELECT ub.badge_level
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND b.slug = $2 AND ub.earned_at IS NOT NULL
         AND COALESCE(b.is_negative, false) = false`,
      [userId, key]
    );
    if (r.rows.length === 0) return false;
    return compareLevels(r.rows[0].badge_level, min) >= 0;
  } catch (_e) {
    const r = await pool.query(
      `SELECT ub.badge_level
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND b.slug = $2 AND ub.earned_at IS NOT NULL`,
      [userId, key]
    );
    if (r.rows.length === 0) return false;
    return compareLevels(r.rows[0].badge_level, min) >= 0;
  }
}

/** Public alias for system grants (venue badges) */
export async function upsertUserBadgeLevelPublic(userId, badge, achievedLevel, ritualId = null) {
  return upsertUserBadgeLevel(userId, badge, achievedLevel, ritualId);
}

export async function resolveBadgeKeys(slugs = []) {
  const keys = (Array.isArray(slugs) ? slugs : []).map((s) => String(s).trim()).filter(Boolean);
  if (keys.length === 0) return [];
  await syncBadgeCatalogFromConfig();
  const r = await pool.query(
    `SELECT slug, name, icon_emoji, spec_category FROM badges WHERE slug = ANY($1::text[])`,
    [keys]
  );
  const map = new Map(r.rows.map((row) => [row.slug, row]));
  return keys.map((slug) => {
    const row = map.get(slug);
    const cfg = (LOCAL_CONFIG.badges.CATALOG || []).find((b) => b.slug === slug);
    return {
      slug,
      name: row?.name || cfg?.name || slug,
      icon_emoji: row?.icon_emoji || cfg?.icon_emoji || '🏅',
      spec_category: row?.spec_category || cfg?.spec_category || 'special',
    };
  });
}

export async function getHighlightedBadgesForUser(userId) {
  const r = await pool.query(`SELECT highlighted_badge_keys FROM users WHERE id = $1`, [userId]);
  const keys = r.rows[0]?.highlighted_badge_keys || [];
  const resolved = await resolveBadgeKeys(keys);
  const earnedR = await pool.query(
    `SELECT b.slug, ub.badge_level
     FROM user_badges ub
     JOIN badges b ON b.id = ub.badge_id
     WHERE ub.user_id = $1 AND ub.earned_at IS NOT NULL AND b.slug = ANY($2::text[])`,
    [userId, keys.length ? keys : ['__none__']]
  );
  const levelMap = new Map(earnedR.rows.map((row) => [row.slug, row.badge_level]));
  return resolved.map((b) => ({
    ...b,
    badge_level: levelMap.get(b.slug) || null,
  }));
}

export async function getFullBadgeArchive(userId) {
  await syncBadgeCatalogFromConfig();
  const [metrics, userBadges, userRow] = await Promise.all([
    collectUserBadgeMetrics(userId),
    pool.query(
      `SELECT ub.*, b.slug, b.name, b.description, b.spec_category, b.icon_emoji, b.family, b.is_negative
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1`,
      [userId]
    ),
    pool.query(`SELECT highlighted_badge_keys FROM users WHERE id = $1`, [userId]),
  ]);
  const userMap = new Map(userBadges.rows.map((row) => [row.slug, row]));
  const highlighted = userRow.rows[0]?.highlighted_badge_keys || [];
  const catalog = LOCAL_CONFIG.badges.CATALOG || [];

  const archive = catalog.map((item) => {
    const ub = userMap.get(item.slug);
    const earned = Boolean(ub?.earned_at);
    const level = ub?.badge_level || null;
    const rule = item.rule || {};
    const progress = computeRuleProgress(rule, metrics);
    const liveLevel = evaluateRuleLevel(rule, metrics);
    let status = 'locked';
    if (earned || liveLevel) status = 'earned';
    else if (progress.value > 0 || progress.progress_pct > 0) status = 'in_progress';
    const isNeg = isNegativeBadgeSlug(item.slug) || Boolean(item.is_negative);

    return {
      slug: item.slug,
      key: item.slug,
      name: item.name,
      label: item.name,
      icon_emoji: item.icon_emoji || '🏅',
      icon: item.icon_emoji || '🏅',
      spec_category: item.spec_category || 'behavior',
      family: resolveBadgeFamily(item),
      family_glyph: LOCAL_CONFIG.badges.FAMILY_GLYPHS?.[resolveBadgeFamily(item)] || '',
      assignment_layer: item.assignment_layer || 'rule',
      condition: formatRuleCondition(rule),
      rule,
      earned,
      badge_level: level || liveLevel || progress.achieved_level || null,
      status,
      progress_value: progress.value,
      progress_pct: progress.progress_pct,
      next_level: progress.next_level,
      next_threshold: progress.next_threshold,
      highlighted: highlighted.includes(item.slug),
      earned_at: ub?.earned_at || null,
      is_negative: isNeg,
      internal_only: isNeg,
    };
  });

  // Approved venue-created badges earned by user (not in static catalog)
  const catalogSlugs = new Set(catalog.map((c) => c.slug));
  for (const [slug, ub] of userMap.entries()) {
    if (catalogSlugs.has(slug) || !ub?.earned_at) continue;
    const family = ub.family || resolveBadgeFamily({ spec_category: ub.spec_category, family: ub.family });
    archive.push({
      slug,
      key: slug,
      name: ub.name || slug,
      label: ub.name || slug,
      icon_emoji: ub.icon_emoji || '🛡',
      icon: ub.icon_emoji || '🛡',
      spec_category: ub.spec_category || 'venue',
      family,
      family_glyph: LOCAL_CONFIG.badges.FAMILY_GLYPHS?.[family] || '🛡',
      assignment_layer: 'system',
      condition: 'Mekan rozeti',
      rule: {},
      earned: true,
      badge_level: ub.badge_level || 'novice',
      status: 'earned',
      progress_value: 0,
      progress_pct: 100,
      next_level: null,
      next_threshold: null,
      highlighted: highlighted.includes(slug),
      earned_at: ub.earned_at,
      is_negative: Boolean(ub.is_negative),
      internal_only: Boolean(ub.is_negative),
    });
  }

  const earned = archive.filter((b) => b.earned);
  const inProgress = archive.filter((b) => b.status === 'in_progress');
  const locked = archive.filter((b) => b.status === 'locked');

  return {
    archive,
    earned,
    in_progress: inProgress,
    locked,
    highlighted_badge_keys: highlighted,
    total: archive.length,
  };
}

export async function assignManualBadge(userId, slug, level = 'novice', { ritualId = null } = {}) {
  await syncBadgeCatalogFromConfig();
  const key = String(slug || '').trim();
  if (!key) return { ok: false, status: 400, error: 'slug is required' };
  if (!LEVELS.includes(level)) return { ok: false, status: 400, error: 'Invalid badge level' };
  if (isNegativeBadgeSlug(key)) {
    return { ok: false, status: 400, error: 'Negatif rozetler skor/kapı/manuel atama yolu değildir' };
  }

  const catalogItem = (LOCAL_CONFIG.badges.CATALOG || []).find((b) => b.slug === key);
  if (!catalogItem) return { ok: false, status: 404, error: 'Unknown badge slug' };
  if (catalogItem.is_negative) {
    return { ok: false, status: 400, error: 'Negatif rozetler skor/kapı/manuel atama yolu değildir' };
  }

  const badgeR = await pool.query(`SELECT id, slug, name FROM badges WHERE slug = $1`, [key]);
  if (badgeR.rows.length === 0) {
    return { ok: false, status: 404, error: 'Badge not synced' };
  }
  const badge = badgeR.rows[0];
  const target = LEVEL_RANK[level] || 1;

  const existing = await pool.query(
    `SELECT id, badge_level FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
    [userId, badge.id]
  );
  if (existing.rows.length > 0) {
    const prev = existing.rows[0].badge_level;
    if (compareLevels(level, prev) <= 0) {
      return { ok: true, badge: { slug: key, badge_level: prev }, unchanged: true };
    }
    await pool.query(
      `UPDATE user_badges
       SET badge_level = $3, progress_value = $4, target_value = $4, earned_at = COALESCE(earned_at, NOW())
       WHERE user_id = $1 AND badge_id = $2`,
      [userId, badge.id, level, target]
    );
  } else {
    await pool.query(
      `INSERT INTO user_badges (user_id, badge_id, badge_level, progress_value, target_value, earned_at, ritual_id, badge_key, badge_label)
       VALUES ($1,$2,$3,$4,$4,NOW(),$5,$6,$7)`,
      [userId, badge.id, level, target, ritualId, badge.slug, badge.name]
    );
    await notifyBadgeEarned(userId, {
      badge_label: badge.name,
      condition: `${level} seviye (manuel)`,
      ritual_id: ritualId,
    }).catch(() => {});
  }

  return { ok: true, badge: { slug: key, name: badge.name, badge_level: level } };
}

export async function getBadgeArchive(userId) {
  const full = await getFullBadgeArchive(userId);
  return full.archive.filter((b) => b.earned_at != null || b.earned);
}

export async function setHighlightedBadges(userId, slugs = []) {
  const max = LOCAL_CONFIG.badges.HIGHLIGHT_USER;
  const keys = Array.isArray(slugs)
    ? slugs.map((s) => String(s).trim()).filter(Boolean).slice(0, max)
    : [];
  if (keys.length > 0) {
    const valid = await pool.query(
      `SELECT b.slug
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND ub.earned_at IS NOT NULL AND b.slug = ANY($2::text[])`,
      [userId, keys]
    );
    if (valid.rows.length !== keys.length) {
      return { ok: false, status: 400, error: 'Highlighted badges must be earned' };
    }
  }
  await pool.query(
    `UPDATE users SET highlighted_badge_keys = $2::text[] WHERE id = $1`,
    [userId, keys]
  );
  await pool.query(
    `UPDATE user_badges ub
     SET highlighted = b.slug = ANY($2::text[])
     FROM badges b
     WHERE ub.user_id = $1 AND ub.badge_id = b.id`,
    [userId, keys]
  );
  return { ok: true, highlighted_badge_keys: keys };
}
