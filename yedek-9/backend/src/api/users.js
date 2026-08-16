import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import LOCAL_CONFIG, { liveWindowHoursOf } from '../config/localConfig.js';
import { authenticateToken } from './auth.js';
import { getRsPublicFlags, resolveRsForViewer } from '../services/rsVisibility.js';
import { signMediaPath } from '../utils/mediaSigning.js';
import { buildAvatarStoragePath } from '../utils/mediaPaths.js';
import {
  assertNameChangeAllowed,
  assertUsernameChangeAllowed,
} from '../services/identityNamePolicy.js';
import { getUserPenaltyStatus } from '../services/penaltyService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_FORMATS = new Set(['jpeg', 'png', 'webp']);

const mediaUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `user:${req.user?.userId || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Media upload hourly limit exceeded'
  }
});

function buildAvatarUrl(req, avatarPath) {
  if (!avatarPath) return null;
  if (avatarPath.startsWith('http')) return avatarPath;
  const base = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const normalized = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`;
  const token = signMediaPath(normalized, 3600);
  return `${base}/api/media/access?token=${token}`;
}

// Helper: Get shared interests between two users
async function getSharedInterests(userId, viewerId) {
  try {
    const query = `
      SELECT ui1.category
      FROM user_interests ui1
      INNER JOIN user_interests ui2 ON ui1.category = ui2.category
      WHERE ui1.user_id = $1 AND ui2.user_id = $2
      ORDER BY ui1.category ASC
    `;
    const result = await pool.query(query, [userId, viewerId]);
    return result.rows.map(row => row.category);
  } catch (error) {
    console.error('Error fetching shared interests:', error);
    return [];
  }
}

const router = express.Router();

const RS_PROGRESS_BADGES = [
  { key: 'first_localli', icon: '🌱', label: "İlk LOCAL'li", condition: 'İlk Ritual tamamlandı' },
  { key: 'growing_localli', icon: '🏘', label: "Büyüyen LOCAL'li", condition: '10 Ritual tamamlandı' },
  { key: 'rooted_localli', icon: '🏛', label: "Köklü LOCAL'li", condition: 'RS 7,0+' },
  { key: 'trusted_localli', icon: '⭐', label: "Güvenilir LOCAL'li", condition: 'RS 8,0+' },
  { key: 'exceptional_localli', icon: '👑', label: "Olağanüstü LOCAL'li", condition: 'RS 9,0+' },
  { key: 'student_verified', icon: '🎓', label: 'Öğrenci Doğrulandı', condition: 'Üniversite e-postası onaylandı' },
  { key: 'pivot_host', icon: '🌟', label: 'Pivot Host', condition: 'LOCAL ekibi tarafından seçildi · yalnızca davetliye' },
];
/** under_trial is NOT a badge — internal RS status flag only (v2 §9) */

const BEHAVIOR_CONSISTENCY_BADGES = [
  { key: 'always_on_time', icon: '⏰', label: 'Her Zaman Zamanında', condition: '10 kez Ritualden 6+ saat önce iptal' },
  { key: 'no_no_show', icon: '✓', label: 'Gelmeme Yok', condition: '20 Ritual, sıfır gelmeme' },
  { key: 'feedback_giver', icon: '💬', label: 'Geri Bildirim Veren', condition: '30 Ritual geri bildirimini zamanında gönderdi' },
  { key: 'consistent', icon: '🎯', label: 'Tutarlı', condition: '10 Ritual boyunca BC5_trend ≥ 0,70' },
  { key: 'diversity_champion', icon: '🌈', label: 'Çeşitlilik Şampiyonu', condition: 'DS_ema ≥ 0,80 sürdürüldü' },
  { key: 'on_streak', icon: '🔥', label: 'Seride', condition: '5 ardışık Rituale katılım' },
  { key: 'memory_maker', icon: '📝', label: 'Anı Yapıcı', condition: '20 anı paylaşıldı' },
  { key: 'fast_responder', icon: '⚡', label: 'Hızlı Yanıtlayan', condition: 'Her zaman Rituali erken onaylar' },
  { key: 'perfect_month', icon: '💎', label: 'Mükemmel Ay', condition: 'Tam bir takvim ayı boyunca sıfır IF sürtünmesi' },
  { key: 'gentle_canceller', icon: '🌿', label: 'Nazik İptal Eden', condition: 'Tüm iptallar 6+ saat önce (10+ Ritual)' },
];

// GET /api/users/me - backend-yeni.md contract
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT id, email, name, city, university, rs_score, avatar_url, created_at,
              email_verified, identity_verified, age_ok, identity_track,
              uni_label_visible, hosted_count_visible, regular_vitrine_visible
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const user = result.rows[0];
    const penalty = await getUserPenaltyStatus(userId);
    const verified = Boolean(user.email_verified || user.identity_verified);
    const showUni =
      user.identity_track !== 'identity' &&
      Boolean(user.university) &&
      Boolean(user.email_verified) &&
      user.uni_label_visible !== false;
    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        city: user.city,
        university: user.identity_track === 'identity' ? null : user.university,
        rs_score: Number(user.rs_score) || 0,
        avatar_url: buildAvatarUrl(req, user.avatar_url),
        created_at: user.created_at,
        email_verified: Boolean(user.email_verified),
        identity_verified: Boolean(user.identity_verified),
        age_ok: Boolean(user.age_ok),
        identity_track: user.identity_track,
        uni_label_visible: user.identity_track === 'university' ? user.uni_label_visible !== false : false,
        show_uni_label: showUni,
        verified,
        hosted_count_visible: Boolean(user.hosted_count_visible),
        regular_vitrine_visible: Boolean(user.regular_vitrine_visible),
        penalty: penalty
          ? {
              is_penalty_suspended: penalty.is_penalty_suspended,
              is_host_banned: penalty.is_host_banned,
              penalty_suspended_until: penalty.penalty_suspended_until,
              host_ban_until: penalty.host_ban_until,
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/me - backend-yeni.md contract alias
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const body = req.body || {};
    const allowed = [
      'name',
      'username',
      'display_name',
      'bio',
      'city',
      'uni_label_visible',
      'hosted_count_visible',
      'regular_vitrine_visible',
      'bio_quote_memory_id',
      'active_city_id',
    ];
    const sets = [];
    const vals = [];
    let i = 1;

    if (body.name !== undefined) {
      const nameGate = await assertNameChangeAllowed(userId, body.name);
      if (!nameGate.ok) {
        return res.status(nameGate.status || 400).json({
          success: false,
          error: nameGate.error,
          code: nameGate.code,
          retry_after_d: nameGate.retry_after_d,
        });
      }
    }
    if (body.username !== undefined) {
      const userGate = await assertUsernameChangeAllowed(userId, body.username);
      if (!userGate.ok) {
        return res.status(userGate.status || 400).json({
          success: false,
          error: userGate.error,
          code: userGate.code,
          retry_after_d: userGate.retry_after_d,
        });
      }
      body.username = userGate.username;
    }

    for (const key of allowed) {
      if (body[key] === undefined) continue;
      if (key === 'active_city_id') {
        const cityId = body[key] || null;
        if (cityId) {
          const c = await pool.query(
            `SELECT id, status FROM cities WHERE id = $1`,
            [cityId]
          );
          if (!c.rows[0]) {
            return res.status(400).json({ success: false, error: 'active_city_id not found' });
          }
        }
        sets.push(`active_city_id = $${i}`);
        vals.push(cityId);
        i++;
        continue;
      }
      if (key === 'name') {
        sets.push(`name = $${i}`);
        vals.push(body.name);
        i += 1;
        sets.push(`name_changed_at = NOW()`);
        continue;
      }
      if (key === 'username') {
        sets.push(`username = $${i}`);
        vals.push(body.username);
        i += 1;
        sets.push(`username_changed_at = NOW()`);
        continue;
      }
      if (['uni_label_visible', 'hosted_count_visible', 'regular_vitrine_visible'].includes(key)) {
        sets.push(`${key} = $${i}`);
        vals.push(Boolean(body[key]));
      } else if (key === 'bio_quote_memory_id') {
        const mid = body[key] || null;
        if (mid) {
          const own = await pool.query(
            `SELECT id FROM memories
             WHERE id = $1 AND user_id = $2
               AND content IS NOT NULL
               AND length(trim(content)) > 0
               AND length(trim(content)) <= 280
               AND (type::text = 'quote' OR memory_type IN ('quote', 'ritual'))
             LIMIT 1`,
            [mid, userId]
          );
          if (!own.rows[0]) {
            return res.status(400).json({
              success: false,
              error: 'bio_quote_memory_id must be your own quote memory',
            });
          }
        }
        sets.push(`${key} = $${i}`);
        vals.push(mid);
      } else {
        sets.push(`${key} = $${i}`);
        vals.push(body[key]);
      }
      i += 1;
    }
    if (sets.length === 0) {
      // fall through to legacy PUT alias for other profile fields
      req.params = { ...req.params, id: userId };
      return router.handle({ ...req, method: 'PUT', url: `/${userId}` }, res);
    }
    vals.push(userId);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING id, name, username, display_name, city, university, uni_label_visible, hosted_count_visible,
                 regular_vitrine_visible, identity_verified, age_ok, email_verified, name_locked`,
      vals
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('PATCH /users/me failed', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// POST /api/users/me/avatar - backend-yeni.md contract alias
router.post('/me/avatar', authenticateToken, async (req, res) => {
  req.params = { ...req.params, id: req.user.userId };
  return router.handle(
    { ...req, method: 'PUT', url: `/${req.user.userId}/avatar` },
    res
  );
});

// GET /api/users/me/connections - backend-yeni.md contract
router.get('/me/connections', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT
         f.id,
         f.status,
         f.created_at,
         CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END AS connection_id,
         u.name AS connection_name,
         u.city AS connection_city,
         u.university AS connection_university,
         u.rs_score AS connection_rs_score,
         u.avatar_url AS connection_avatar_url
       FROM friendships f
       JOIN users u
         ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
       WHERE (f.user_id = $1 OR f.friend_id = $1)
         AND f.status = 'accepted'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        user: {
          id: row.connection_id,
          name: row.connection_name,
          city: row.connection_city,
          university: row.connection_university,
          rs_score: Number(row.connection_rs_score) || 0,
          avatar_url: buildAvatarUrl(req, row.connection_avatar_url),
        },
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch connections' });
  }
});

// GET /api/users/me/badges - backend-yeni.md contract
router.get('/me/badges', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { getFullBadgeArchive } = await import('../services/badgeEngine.js');
    const data = await getFullBadgeArchive(userId);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch badges' });
  }
});

// PATCH /api/users/me/badges/highlighted — son-part.md §10 archive-first (max 3)
router.patch('/me/badges/highlighted', authenticateToken, async (req, res) => {
  try {
    const { setHighlightedBadges } = await import('../services/badgeEngine.js');
    const result = await setHighlightedBadges(req.user.userId, req.body?.highlighted_badge_keys || []);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update highlighted badges' });
  }
});

// GET /api/users/me/regular — private Regular (opsiyonel ?venue_id=)
router.get('/me/regular', authenticateToken, async (req, res) => {
  try {
    const { getRegularStatus } = await import('../services/regularService.js');
    const venueId = req.query.venue_id || null;
    const data = await getRegularStatus(req.user.userId, {
      viewerUserId: req.user.userId,
      venueId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch regular status' });
  }
});

// GET /api/users/me/regulars — kullanıcının kendi regular mekân listesi (PRIVATE)
router.get('/me/regulars', authenticateToken, async (req, res) => {
  try {
    const { listMyRegulars } = await import('../services/regularService.js');
    const data = await listMyRegulars(req.user.userId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to list regulars' });
  }
});

// GET /api/users/me/rs-transactions - backend-yeni.md contract alias
router.get('/me/rs-transactions', authenticateToken, async (req, res) => {
  req.params = { ...req.params, id: req.user.userId };
  return router.handle(
    { ...req, method: 'GET', url: `/${req.user.userId}/rs-history` },
    res
  );
});

// GET /api/users/me/passport — son-part.md §8.1 (memory/badge/quote)
router.get('/me/passport', authenticateToken, async (req, res) => {
  try {
    const { getPassportEntries } = await import('../services/passportService.js');
    const data = await getPassportEntries(req.user.userId, {
      limit: req.query.limit,
      offset: req.query.offset,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch passport' });
  }
});

// GET /api/users/me/ds-dashboard - private DS radar (son-part.md §6, sadece sahibi)
router.get('/me/ds-dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { getPrivateDsDashboard } = await import('../services/dsEngine.js');
    const data = await getPrivateDsDashboard(userId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch DS dashboard' });
  }
});

// GET /api/users/me/window-bubbles — son-part.md §2.4
router.get('/me/window-bubbles', authenticateToken, async (req, res) => {
  try {
    const { listActiveWindowBubbles } = await import('../services/ritualState.js');
    const bubbles = await listActiveWindowBubbles(pool, req.user.userId);
    return res.json({ success: true, data: bubbles });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch window bubbles' });
  }
});

// GET /api/users/me/notifications - backend-yeni.md contract
router.get('/me/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tab, is_read } = req.query;
    const filters = ['user_id = $1'];
    const params = [userId];
    let idx = 2;

    if (tab) {
      filters.push(`type = $${idx++}`);
      params.push(String(tab));
    }
    if (is_read === 'true' || is_read === 'false') {
      filters.push(`COALESCE(is_read, read, false) = $${idx++}`);
      params.push(is_read === 'true');
    }

    const result = await pool.query(
      `SELECT id, type, title, body, data, COALESCE(is_read, read, false) AS is_read, created_at
       FROM notifications
       WHERE ${filters.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT 200`,
      params
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/users/me/notifications/read - backend-yeni.md contract
router.patch('/me/notifications/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query(
      `UPDATE notifications
       SET is_read = true,
           read = true
       WHERE user_id = $1`,
      [userId]
    );
    return res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
});

// GET /api/users/:id/shared-rituals - backend-yeni.md contract
router.get('/:id/shared-rituals', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.id;
    const me = req.user.userId;
    const result = await pool.query(
      `SELECT r.id, r.title, r.type, r.location_name, r.start_time
       FROM ritual_attendance a1
       JOIN ritual_attendance a2 ON a2.ritual_id = a1.ritual_id
       JOIN rituals r ON r.id = a1.ritual_id
       WHERE a1.user_id = $1
         AND a2.user_id = $2
         AND a1.status NOT IN ('no_show', 'cancelled')
         AND a2.status NOT IN ('no_show', 'cancelled')
       ORDER BY r.start_time DESC`,
      [me, otherUserId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch shared rituals' });
  }
});

// GET /api/users/:id - Get user profile (public basic profile)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user.userId;

    const query = `
      SELECT 
        u.*,
        COUNT(DISTINCT ra.ritual_id) as rituals_attended,
        COUNT(DISTINCT r.id) as rituals_hosted,
        COUNT(DISTINCT f.id) as feedback_count
      FROM users u
      LEFT JOIN ritual_attendance ra ON u.id = ra.user_id AND ra.status != 'no_show'
      LEFT JOIN rituals r ON u.id = r.host_id
      LEFT JOIN feedback f ON u.id = f.to_user_id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Check host verification
    const [verificationCheck, sharedCheck] = await Promise.all([
      pool.query(
        `SELECT * FROM host_verifications 
         WHERE user_id = $1 
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT ra1.ritual_id)::int AS c
         FROM ritual_attendance ra1
         JOIN ritual_attendance ra2 ON ra1.ritual_id = ra2.ritual_id
         WHERE ra1.user_id = $1
           AND ra2.user_id = $2
           AND ra1.status NOT IN ('no_show', 'cancelled')
           AND ra2.status NOT IN ('no_show', 'cancelled')`,
        [viewerId, id]
      )
    ]);
    const isHostVerified = verificationCheck.rows.length > 0;
    const sharedRitualCount = sharedCheck.rows[0]?.c || 0;
    const isSelf = String(viewerId) === String(id);
    const rsScore = parseFloat(user.rs_score) || 6.0;
    const publicFlags = await getRsPublicFlags([id]);
    const rsResolved = resolveRsForViewer(viewerId, id, rsScore, publicFlags);

    // Kapalı profil: yabancıya minimal kart
    if (!isSelf) {
      const { getAccountPrivacy, isApprovedFollower } = await import('../services/waveBSocial.js');
      const privacy = await getAccountPrivacy(id);
      if (privacy === 'CLOSED') {
        const follower = await isApprovedFollower(viewerId, id);
        if (!follower) {
          return res.json({
            success: true,
            data: {
              id: user.id,
              name: user.name,
              username: user.username || null,
              avatar_url: user.avatar_url ? buildAvatarUrl(req, user.avatar_url) : null,
              account_privacy: 'CLOSED',
              closed_profile: true,
              minimal_card: true,
            },
          });
        }
      }
    }

    const { getHighlightedBadgesForUser } = await import('../services/badgeEngine.js');
    const highlightedBadges = await getHighlightedBadgesForUser(id);

    // §1: Track B — üni-etiket alanı yok; Track A — sadece uni_label_visible
    const showUniLabel =
      user.identity_track !== 'identity' &&
      Boolean(user.university) &&
      Boolean(user.email_verified) &&
      user.uni_label_visible !== false;

    const hostedVisible = Boolean(user.hosted_count_visible);
    const ritualsHosted = parseInt(user.rituals_hosted) || 0;

    let bioQuote = null;
    try {
      const bq = await pool.query(
        `SELECT m.id, COALESCE(m.content, m.text, m.title, '') AS text
         FROM users u
         LEFT JOIN memories m ON m.id = u.bio_quote_memory_id
         WHERE u.id = $1`,
        [id]
      );
      if (bq.rows[0]?.id) {
        bioQuote = {
          memory_id: bq.rows[0].id,
          text: String(bq.rows[0].text || '').slice(0, 280),
        };
      }
    } catch (_e) {
      bioQuote = null;
    }

    const { stripFollowerCountsFromProfile } = await import('../services/followerCountPolicy.js');
    let friendsListPublic = false;
    try {
      const fl = await pool.query(
        `SELECT COALESCE(u.friends_list_public, us.show_friends_list, false) AS friends_list_public
         FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         WHERE u.id = $1`,
        [id]
      );
      friendsListPublic = !!fl.rows[0]?.friends_list_public;
    } catch (_e) {
      friendsListPublic = false;
    }
    res.json({
      success: true,
      data: stripFollowerCountsFromProfile({
        id: user.id,
        name: user.name,
        city: user.city,
        university: showUniLabel ? user.university : null,
        show_uni_label: showUniLabel,
        identity_track: user.identity_track || null,
        rs_score: rsResolved.rs_score,
        rs_rounded_10: rsResolved.rs_public_raw && rsResolved.rs_visible ? Math.round(rsScore) : null,
        rs_exact_visible: rsResolved.rs_public_raw === true,
        rs_visible: rsResolved.rs_visible,
        rs_ring_opacity: rsResolved.rs_ring_opacity,
        avatar_url: user.avatar_url ? buildAvatarUrl(req, user.avatar_url) : null,
        rituals_attended: parseInt(user.rituals_attended) || 0,
        /** §14 — M hosted yalnız toggle açıksa (veya self) */
        rituals_hosted: isSelf || hostedVisible ? ritualsHosted : null,
        hosted_count_visible: hostedVisible,
        bio_quote: bioQuote,
        feedback_count: parseInt(user.feedback_count) || 0,
        is_host_verified: isHostVerified,
        created_at: user.created_at,
        highlighted_badge_keys: user.highlighted_badge_keys || [],
        highlighted_badges: highlightedBadges,
        friends_list_public: friendsListPublic,
        ...(isSelf
          ? {
              email_verified: Boolean(user.email_verified),
              identity_verified: Boolean(user.identity_verified),
              age_ok: Boolean(user.age_ok),
              uni_label_visible: user.identity_track === 'university' ? user.uni_label_visible !== false : false,
              regular_vitrine_visible: Boolean(user.regular_vitrine_visible),
              verified: Boolean(user.email_verified || user.identity_verified),
              bio_quote_memory_id: bioQuote?.memory_id || null,
            }
          : {}),
      }),
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// GET /api/users/:id/rs-badges - RS progression badges (yeni.md 6.4)
router.get('/:id/rs-badges', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [userResult, completedResult, pivotResult] = await Promise.all([
      pool.query(
        `SELECT id, rs_score, email_verified
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT ra.ritual_id)::int AS completed_count
         FROM ritual_attendance ra
         JOIN rituals r ON r.id = ra.ritual_id
         WHERE ra.user_id = $1
           AND ra.status NOT IN ('no_show', 'cancelled')
           AND (r.status = 'ended' OR r.start_time < CURRENT_TIMESTAMP)`,
        [id]
      ),
      pool.query(
        `SELECT 1
         FROM host_verifications
         WHERE user_id = $1
           AND status = 'active'
           AND verification_type = 'premium'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [id]
      ),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];
    const rsScore = Number(user.rs_score || 0);
    const completedCount = Number(completedResult.rows[0]?.completed_count || 0);
    const isPivotHost = pivotResult.rows.length > 0;

    const earnedByKey = {
      first_localli: completedCount >= 1,
      growing_localli: completedCount >= 10,
      rooted_localli: rsScore >= 7.0,
      trusted_localli: rsScore >= 8.0,
      exceptional_localli: rsScore >= 9.0,
      student_verified: Boolean(user.email_verified),
      pivot_host: isPivotHost,
    };

    const badges = RS_PROGRESS_BADGES.map((badge) => ({
      ...badge,
      earned: Boolean(earnedByKey[badge.key]),
      internal_only: false,
    }));

    return res.json({
      success: true,
      data: {
        user_id: id,
        rs_score: rsScore,
        completed_ritual_count: completedCount,
        badges,
        /** Dahili durum — rozet değil; skor verisinden badge doğmaz (§9) */
        under_trial_status: rsScore < 3.0,
      },
    });
  } catch (error) {
    console.error('Error fetching rs badges:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch rs badges',
    });
  }
});

// GET /api/users/:id/behavior-badges - Behavior and consistency badges (yeni.md 6.5)
router.get('/:id/behavior-badges', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = String(req.user.userId) === String(id);

    const [userResult, countsResult, trendRowsResult, streakResult, perfectMonthResult, memoryCountResult] = await Promise.all([
      pool.query(
        `SELECT id FROM users WHERE id = $1 LIMIT 1`,
        [id]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE ra.status = 'cancelled')::int AS cancel_count,
           COUNT(*) FILTER (
             WHERE ra.status = 'cancelled'
               AND ra.cancelled_at IS NOT NULL
               AND ra.cancelled_at <= (r.start_time - INTERVAL '6 hours')
           )::int AS early_cancel_count,
           COUNT(*) FILTER (WHERE ra.status = 'no_show')::int AS no_show_count,
           COUNT(*) FILTER (WHERE ra.status NOT IN ('no_show', 'cancelled'))::int AS attended_count
         FROM ritual_attendance ra
         LEFT JOIN rituals r ON r.id = ra.ritual_id
         WHERE ra.user_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT bc5_trend, ds_mult, created_at
         FROM rs_delta_history
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [id]
      ),
      pool.query(
        `WITH ordered AS (
           SELECT
             ra.status,
             r.start_time,
             CASE WHEN ra.status NOT IN ('no_show', 'cancelled') THEN 1 ELSE 0 END AS good
           FROM ritual_attendance ra
           JOIN rituals r ON r.id = ra.ritual_id
           WHERE ra.user_id = $1
           ORDER BY r.start_time DESC
         )
         SELECT COALESCE(MAX(streak_len), 0)::int AS best_streak
         FROM (
           SELECT COUNT(*)::int AS streak_len
           FROM (
             SELECT *,
               SUM(CASE WHEN good = 0 THEN 1 ELSE 0 END) OVER (ORDER BY start_time DESC) AS grp
             FROM ordered
           ) s
           WHERE good = 1
           GROUP BY grp
         ) x`,
        [id]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total_events,
           COUNT(*) FILTER (
             WHERE COALESCE(n_context_frozen, false) = true
                OR COALESCE(bypass_reason, '') != ''
           )::int AS friction_events
         FROM rs_delta_history
         WHERE user_id = $1
           AND date_trunc('month', created_at) = date_trunc('month', CURRENT_TIMESTAMP)`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS memory_count
         FROM memories
         WHERE user_id = $1
           AND memory_type IN ('ritual', 'pulse')`,
        [id]
      ),
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const counts = countsResult.rows[0] || {};
    const trendRows = trendRowsResult.rows || [];
    const bestStreak = Number(streakResult.rows[0]?.best_streak || 0);
    const perfectMonth = perfectMonthResult.rows[0] || {};

    const cancelCount = Number(counts.cancel_count || 0);
    const earlyCancelCount = Number(counts.early_cancel_count || 0);
    const noShowCount = Number(counts.no_show_count || 0);
    const attendedCount = Number(counts.attended_count || 0);
    const memoryCount = Number(memoryCountResult.rows[0]?.memory_count || 0);
    const trendSampleCount = trendRows.length;
    const lastTenTrendRows = trendRows.slice(-10);
    const bc5GoodCount = lastTenTrendRows.filter((r) => Number(r.bc5_trend || 0) >= 0.7).length;
    const dsGoodCount = lastTenTrendRows.filter((r) => Number(r.ds_mult || 0) >= 0.8).length;
    let dsEma = 0;
    let dsEmaInitialized = false;
    const alpha = 0.2;
    for (const row of trendRows) {
      const current = Number(row.ds_mult || 0);
      if (!Number.isFinite(current)) continue;
      if (!dsEmaInitialized) {
        dsEma = current;
        dsEmaInitialized = true;
      } else {
        dsEma = alpha * current + (1 - alpha) * dsEma;
      }
    }
    const perfectMonthSamples = Number(perfectMonth.total_events || 0);
    const perfectMonthFriction = Number(perfectMonth.friction_events || 0);

    const feedbackTimelyResult = await pool.query(
      `SELECT COUNT(DISTINCT f.ritual_id)::int AS timely_feedback_count
       FROM feedback f
       JOIN rituals r ON r.id = f.ritual_id
       WHERE f.from_user_id = $1
         AND f.created_at <= (r.start_time + (COALESCE(r.duration, 120) || ' minutes')::interval + INTERVAL '24 hours')`,
      [id]
    );
    const timelyFeedbackCount = Number(feedbackTimelyResult.rows[0]?.timely_feedback_count || 0);

    const earnedByKey = {
      always_on_time: earlyCancelCount >= 10,
      no_no_show: attendedCount >= 20 && noShowCount === 0,
      feedback_giver: timelyFeedbackCount >= 30,
      consistent: trendSampleCount >= 10 && bc5GoodCount >= 10,
      diversity_champion: trendSampleCount >= 10 && dsEmaInitialized && dsEma >= 0.8 && dsGoodCount >= 10,
      on_streak: bestStreak >= 5,
      memory_maker: memoryCount >= 20,
      fast_responder: false,
      perfect_month: perfectMonthSamples > 0 && perfectMonthFriction === 0,
      gentle_canceller: cancelCount >= 10 && cancelCount === earlyCancelCount,
    };

    // Fast responder strict metric from ritual_attendance join time if available.
    try {
      const fastResponderResult = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE ra.status NOT IN ('no_show', 'cancelled'))::int AS approved_total,
           COUNT(*) FILTER (
             WHERE ra.status NOT IN ('no_show', 'cancelled')
               AND ra.created_at <= (r.start_time - INTERVAL '6 hours')
           )::int AS approved_early
         FROM ritual_attendance ra
         JOIN rituals r ON r.id = ra.ritual_id
         WHERE ra.user_id = $1`,
        [id]
      );
      const approvedTotal = Number(fastResponderResult.rows[0]?.approved_total || 0);
      const approvedEarly = Number(fastResponderResult.rows[0]?.approved_early || 0);
      earnedByKey.fast_responder = approvedTotal > 0 && approvedTotal === approvedEarly;
    } catch (_e) {
      earnedByKey.fast_responder = false;
    }

    const badges = BEHAVIOR_CONSISTENCY_BADGES.map((badge) => ({
      ...badge,
      earned: Boolean(earnedByKey[badge.key]),
    }));

    return res.json({
      success: true,
      data: {
        user_id: id,
        counters: {
          cancel_count: cancelCount,
          early_cancel_count: earlyCancelCount,
          no_show_count: noShowCount,
          attended_count: attendedCount,
          timely_feedback_count: timelyFeedbackCount,
          trend_sample_count: trendSampleCount,
          ds_ema: isSelf && dsEmaInitialized ? Number(dsEma.toFixed(4)) : null,
          best_streak: bestStreak,
          memory_count: memoryCount,
        },
        badges,
      },
    });
  } catch (error) {
    console.error('Error fetching behavior badges:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch behavior badges',
    });
  }
});

// GET /api/users/:id/rituals - Get user's recent rituals (requires auth)
router.get('/:id/rituals', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const query = `
      SELECT 
        r.*,
        u.name as host_name,
        COUNT(DISTINCT ra2.user_id) as attendance_count
      FROM ritual_attendance ra
      JOIN rituals r ON ra.ritual_id = r.id
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN ritual_attendance ra2 ON r.id = ra2.ritual_id
      WHERE ra.user_id = $1
      GROUP BY r.id, u.name
      ORDER BY r.start_time DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [id, parseInt(limit)]);

    res.json({
      success: true,
      data: result.rows.map(ritual => ({
        ...ritual,
        attendance_count: parseInt(ritual.attendance_count) || 0,
      }))
    });
  } catch (error) {
    console.error('Error fetching user rituals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user rituals'
    });
  }
});

// GET /api/users/:id/memories - Get memory grid with privacy rules
router.get('/:id/memories', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // profile owner
    const { viewer_id, limit = 24 } = req.query;
    const viewerId = viewer_id || req.user.userId;
    const maxLimit = Math.max(1, Math.min(parseInt(limit, 10) || 24, 60));

    if (String(viewerId) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'viewer_id must match authenticated user'
      });
    }

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const settingsResult = await pool.query(
      `SELECT show_memories, memory_privacy_mode
       FROM user_settings
       WHERE user_id = $1`,
      [id]
    );

    const settings = settingsResult.rows[0] || {};
    const memoryPrivacyMode = settings.memory_privacy_mode || (settings.show_memories === false ? 'private' : 'public');
    const isOwner = String(id) === String(viewerId);

    let hasL1PlusConnection = false;
    if (!isOwner) {
      // L1+ connection rule (spec): at least one shared ritual.
      const l1Check = await pool.query(
        `SELECT 1
         FROM ritual_attendance ra1
         JOIN ritual_attendance ra2 ON ra1.ritual_id = ra2.ritual_id
         WHERE ra1.user_id = $1
           AND ra2.user_id = $2
           AND ra1.status != 'no_show'
           AND ra2.status != 'no_show'
         LIMIT 1`,
        [viewerId, id]
      );
      hasL1PlusConnection = l1Check.rows.length > 0;
    }

    const fullGridAllowed =
      isOwner ||
      memoryPrivacyMode === 'public' ||
      (memoryPrivacyMode === 'friends_only' && hasL1PlusConnection);

    const totalResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM memories WHERE user_id = $1',
      [id]
    );
    const totalCount = totalResult.rows[0]?.total || 0;

    let visibleLimit = maxLimit;
    let previewOnly = false;

    if (!fullGridAllowed) {
      if (memoryPrivacyMode === 'friends_only') {
        // Strangers can only see a limited generic selection.
        visibleLimit = Math.min(3, maxLimit);
        previewOnly = true;
      } else {
        // Private mode: only owner can see.
        visibleLimit = 0;
      }
    }

    let memories = [];
    if (visibleLimit > 0) {
      const visibilityClause = previewOnly
        ? `AND m.memory_type = 'pulse' AND m.expires_at IS NOT NULL AND m.expires_at > CURRENT_TIMESTAMP`
        : '';

      const memoriesResult = await pool.query(
        `SELECT
          m.id,
          m.ritual_id,
          m.content,
          m.content_url,
          m.caption,
          m.type,
          m.memory_type,
          m.created_at,
          m.spotify_playlist_url,
          m.external_url,
          m.spotify_playlist_id
         FROM memories m
         WHERE m.user_id = $1
           ${visibilityClause}
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [id, visibleLimit]
      );
      memories = memoriesResult.rows.map((m) => ({
        ...m,
        image_url: m.content_url || null,
        photo_url: m.content_url || null,
      }));
    }

    const lockedPlaceholderCount = fullGridAllowed
      ? 0
      : Math.max(0, totalCount - memories.length);

    res.json({
      success: true,
      data: {
        owner_id: id,
        viewer_id: viewerId,
        memory_privacy_mode: memoryPrivacyMode,
        l1_plus_connection: hasL1PlusConnection,
        full_grid_allowed: fullGridAllowed,
        preview_only: previewOnly,
        limited_preview_count: memories.length,
        locked_placeholder_count: lockedPlaceholderCount,
        total_count: totalCount,
        memories
      }
    });
  } catch (error) {
    console.error('Error fetching user memories with privacy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user memories'
    });
  }
});

// GET /api/users/:id/rs-history - Get RS transparency history (owner only)
router.get('/:id/rs-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot view RS history of another user'
      });
    }

    // Import RS engine functions
    const { getRSCalculationDetails } = await import('../services/rsEngine.js');
    const { calculateDiversityMultiplierV3, calculateNContextScore } = await import(
      '../services/antiGaming.js'
    );

    // Get RS delta history
    const historyQuery = `
      SELECT 
        rdh.*,
        r.title as ritual_title,
        r.start_time as ritual_start_time,
        r.type as ritual_type
      FROM rs_delta_history rdh
      JOIN rituals r ON rdh.ritual_id = r.id
      WHERE rdh.user_id = $1
      ORDER BY rdh.created_at DESC
      LIMIT $2
    `;

    const historyResult = await pool.query(historyQuery, [id, parseInt(limit)]);

    // Always get current RS and feedback count (so UI can show score even when no history yet)
    const userQuery = await pool.query(
      `SELECT rs_score, 
       (SELECT COUNT(*) FROM feedback WHERE to_user_id = $1) as feedback_count
       FROM users WHERE id = $1`,
      [id]
    );

    const currentRS = userQuery.rows.length > 0 
      ? parseFloat(userQuery.rows[0].rs_score) 
      : 5.0;
    const feedbackCount = userQuery.rows.length > 0
      ? parseInt(userQuery.rows[0].feedback_count) || 0
      : 0;

    if (historyResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          currentRS: currentRS,
          feedbackCount: feedbackCount,
          changes: [],
          last30DaysTrend: []
        }
      });
    }

    // Get Last 30 Days trend data
    const trendQuery = `
      SELECT 
        DATE(created_at) as date,
        new_rs,
        old_rs,
        created_at
      FROM rs_delta_history
      WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at ASC
    `;
    const trendResult = await pool.query(trendQuery, [id]);
    
    // Process trend data: group by date and get the last RS value for each day
    const trendByDate = {};
    trendResult.rows.forEach(row => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      // Keep the latest RS value for each day
      if (!trendByDate[date] || new Date(row.created_at) > new Date(trendByDate[date].timestamp)) {
        trendByDate[date] = {
          date: date,
          rs: parseFloat(row.new_rs),
          timestamp: row.created_at
        };
      }
    });
    
    // Also include initial RS if available (30 days ago or earlier)
    const initialRSQuery = await pool.query(
      `SELECT rs_score, created_at 
       FROM users 
       WHERE id = $1`,
      [id]
    );
    
    // Get first RS history entry to establish baseline
    const firstHistoryQuery = await pool.query(
      `SELECT old_rs, created_at 
       FROM rs_delta_history 
       WHERE user_id = $1 
       ORDER BY created_at ASC 
       LIMIT 1`,
      [id]
    );
    
    let baselineRS = currentRS;
    if (firstHistoryQuery.rows.length > 0) {
      baselineRS = parseFloat(firstHistoryQuery.rows[0].old_rs);
    }
    
    // Create 30-day trend array (fill missing days with previous value)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const trendData = [];
    let lastRS = baselineRS;
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (trendByDate[dateStr]) {
        lastRS = trendByDate[dateStr].rs;
      }
      
      trendData.push({
        date: dateStr,
        rs: lastRS
      });
    }
    
    // Sample data points for graph (weekly or every 5 days)
    const sampledTrendData = [];
    const sampleInterval = Math.max(1, Math.floor(trendData.length / 5)); // 5-6 points
    for (let i = 0; i < trendData.length; i += sampleInterval) {
      sampledTrendData.push(trendData[i]);
    }
    // Always include the last point
    if (sampledTrendData[sampledTrendData.length - 1]?.date !== trendData[trendData.length - 1]?.date) {
      sampledTrendData.push(trendData[trendData.length - 1]);
    }

    // Process each history entry
    const changes = await Promise.all(
      historyResult.rows.map(async (row) => {
        const ritualId = row.ritual_id;
        const delta = row.delta != null ? parseFloat(row.delta) : null;
        const deltaCap = parseFloat(row.delta_cap ?? row.delta_before_bc3 ?? row.delta ?? 0);
        const oldRS = parseFloat(row.old_rs);
        const newRS = parseFloat(row.new_rs);

        // Get component-level details
        const details = await getRSCalculationDetails(ritualId, id);
        if (details.error) {
          return {
            ritualId,
            ritualTitle: row.ritual_title || 'Unknown Ritual',
            ritualType: row.ritual_type,
            ritualDate: row.ritual_start_time,
            delta,
            deltaCap: null,
            oldRS,
            newRS,
            reasonSummary: 'No detailed breakdown available',
            details: null,
          };
        }

        let diversityMultiplier = 1.0;
        try {
          if (row.ds_mult != null) {
            diversityMultiplier = parseFloat(row.ds_mult);
          } else {
            diversityMultiplier = (await calculateDiversityMultiplierV3(id, ritualId, 10)).multiplier;
          }
        } catch (error) {
          console.error('Error calculating diversity multiplier:', error);
        }

        let nCtxScore = 0.5;
        try {
          nCtxScore = await calculateNContextScore(id, ritualId);
        } catch (error) {
          console.error('Error calculating N-context:', error);
        }
        const nFrozen = row.n_context_frozen === true;

        const bc5Mult =
          row.bc5_mult != null ? parseFloat(row.bc5_mult) : deltaCap !== 0 && delta != null
            ? delta / deltaCap
            : 1.0;

        // Determine signal levels
        const iqLevel = details.interactionQuality >= 0.7 ? 'high' 
          : details.interactionQuality >= 0.4 ? 'mixed' 
          : 'low';
        
        const cfLevel = details.contextFit >= 0.7 ? 'positive'
          : details.contextFit >= 0.4 ? 'neutral'
          : 'negative';

        // IF events
        const ifEvents = [];
        if (details.integrityFriction > 0) {
          if (details.integrityFriction >= 0.25) ifEvents.push('late_arrival');
          if (details.integrityFriction >= 0.15) ifEvents.push('early_leave_or_missing_feedback');
        }

        // Reason summary
        let reasonSummary = '';
        if (delta != null && delta > 0) {
          if (iqLevel === 'high' && cfLevel === 'positive') {
            reasonSummary = 'Great interaction + good context fit';
          } else if (iqLevel === 'high') {
            reasonSummary = 'Great interaction';
          } else if (cfLevel === 'positive') {
            reasonSummary = 'Good context fit';
          } else {
            reasonSummary = 'Positive ritual experience';
          }
        } else if (delta != null && delta < 0) {
          if (ifEvents.length > 0) {
            reasonSummary = `Integrity issues: ${ifEvents.join(', ')}`;
          } else if (iqLevel === 'low') {
            reasonSummary = 'Low interaction quality';
          } else if (cfLevel === 'negative') {
            reasonSummary = 'Poor context fit';
          } else {
            reasonSummary = 'Mixed feedback';
          }
        } else {
          reasonSummary = 'Neutral ritual experience';
        }

        // Diversity impact
        const diversityImpact = diversityMultiplier < 1.0 
          ? `Diversity multiplier: ${(diversityMultiplier * 100).toFixed(0)}%`
          : null;

        return {
          ritualId: ritualId,
          ritualTitle: row.ritual_title || 'Unknown Ritual',
          ritualType: row.ritual_type,
          ritualDate: row.ritual_start_time,
          delta: delta,
          deltaCap: deltaCap,
          oldRS: oldRS,
          newRS: newRS,
          reasonSummary: reasonSummary,
          details: {
            interactionQuality: {
              value: details.interactionQuality,
              level: iqLevel
            },
            contextFit: {
              value: details.contextFit,
              level: cfLevel
            },
            integrityFriction: {
              value: details.integrityFriction,
              events: ifEvents
            },
            attendance: details.attendance,
            diversityMultiplier: diversityMultiplier,
            nContextScore: nCtxScore,
            nContextFrozen: nFrozen,
            bc5Multiplier: bc5Mult
          }
        };
      })
    );

    res.json({
      success: true,
      data: {
        currentRS: currentRS,
        feedbackCount: feedbackCount,
        changes: changes,
        last30DaysTrend: sampledTrendData
      }
    });
  } catch (error) {
    console.error('Error fetching RS history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RS history'
    });
  }
});

// GET /api/users/:id/profile-in-ritual - Get participant profile (ritual context)
router.get('/:id/profile-in-ritual', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ritual_id, viewer_id } = req.query;

    if (String(viewer_id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'viewer_id must match authenticated user'
      });
    }

    if (!ritual_id || !viewer_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: ritual_id, viewer_id'
      });
    }

    // Allow access if viewer is participant, ritual host, or requesting own profile.
    const ritualMeta = await pool.query(
      `SELECT id, host_id FROM rituals WHERE id = $1 LIMIT 1`,
      [ritual_id]
    );
    if (ritualMeta.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found'
      });
    }

    const isSelfProfile = String(viewer_id) === String(id);
    const isViewerHost = String(ritualMeta.rows[0].host_id) === String(viewer_id);

    const attendanceCheck = await pool.query(
      `SELECT 1 FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2 AND status != 'no_show'
       LIMIT 1`,
      [ritual_id, viewer_id]
    );

    if (!isSelfProfile && !isViewerHost && attendanceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Viewer is not allowed to view this participant profile'
      });
    }

    // Check if profile user is in the same ritual
    const profileAttendanceCheck = await pool.query(
      `SELECT * FROM ritual_attendance 
       WHERE ritual_id = $1 AND user_id = $2 AND status != 'no_show'`,
      [ritual_id, id]
    );

    if (profileAttendanceCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User is not a participant in this ritual'
      });
    }

    // Get user profile with stats
    const profileQuery = `
      SELECT 
        u.*,
        COUNT(DISTINCT ra.ritual_id) as rituals_attended,
        COUNT(DISTINCT r.id) as rituals_hosted,
        MIN(ra.created_at) as first_ritual_date
      FROM users u
      LEFT JOIN ritual_attendance ra ON u.id = ra.user_id AND ra.status != 'no_show'
      LEFT JOIN rituals r ON u.id = r.host_id
      WHERE u.id = $1
      GROUP BY u.id
    `;

    const profileResult = await pool.query(profileQuery, [id]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = profileResult.rows[0];
    const rsScore = parseFloat(user.rs_score) || 6.0;

    // Get RS status
    const getRSStatus = (rs) => {
      if (rs >= 9.0) return { label: 'Olağanüstü LOCAL', color: '#1B5E20' };
      if (rs >= 7.5) return { label: 'Güvenilir', color: '#2E7D32' };
      if (rs >= 6.0) return { label: 'Köklü', color: '#1976D2' };
      if (rs >= 4.5) return { label: 'Gelişmekte', color: '#F57C00' };
      if (rs >= 3.0) return { label: 'Dikkat Gerektirir', color: '#E64A19' };
      return { label: 'Kritik', color: '#C62828' };
    };

    const rsStatus = getRSStatus(rsScore);

    // Check if profile user is host of this ritual
    const ritualCheck = await pool.query(
      `SELECT id, title, location_name, start_time, duration, host_id, live_window_hours
       FROM rituals WHERE id = $1`,
      [ritual_id]
    );
    const ritualRow = ritualCheck.rows[0];
    const isHost = ritualCheck.rows.length > 0 && ritualRow.host_id === id;

    // Check host verification
    const hostVerificationCheck = await pool.query(
      `SELECT * FROM host_verifications 
       WHERE user_id = $1 
         AND status = 'active' 
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [id]
    );
    const isHostVerified = hostVerificationCheck.rows.length > 0;

    // Check if users are friends
    const friendshipCheck = await pool.query(
      `SELECT status FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
       AND status = 'accepted'`,
      [viewer_id, id]
    );
    const isFriend = friendshipCheck.rows.length > 0;

    // Check if friendship request is pending
    const pendingCheck = await pool.query(
      `SELECT id, status FROM friendships 
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
       AND status = 'pending'`,
      [viewer_id, id]
    );
    const hasPendingRequest = pendingCheck.rows.length > 0;
    const pendingFriendshipId = pendingCheck.rows[0]?.id || null;

    // Format member since date
    const memberSince = user.first_ritual_date 
      ? new Date(user.first_ritual_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null;

    // Current ritual summary
    let currentRitual = null;
    let isWithinRitualMessageWindow = false;
    if (ritualRow) {
      const start = new Date(ritualRow.start_time);
      const end = new Date(start.getTime() + ritualRow.duration * 60000);
      const liveHours = liveWindowHoursOf(ritualRow);
      const liveEnd = new Date(end.getTime() + Math.min(liveHours, 24) * 3600000);
      const now = new Date();
      isWithinRitualMessageWindow = now >= start && now <= liveEnd;
      currentRitual = {
        id: ritualRow.id,
        title: ritualRow.title,
        venue_name: ritualRow.location_name,
        location_name: ritualRow.location_name,
        start_time: ritualRow.start_time,
        duration: ritualRow.duration,
        time_range: `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
      };
    }

    const friendsCountQuery = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM friendships
       WHERE status = 'accepted'
         AND (user_id = $1 OR friend_id = $1)`,
      [id]
    );
    const friendsCount = friendsCountQuery.rows[0]?.c || 0;

    // Past rituals together (excluding current ritual)
    const pastTogetherQuery = `
      SELECT 
        r.id,
        r.title,
        r.location_name,
        r.start_time
      FROM ritual_attendance ra1
      JOIN ritual_attendance ra2 
        ON ra1.ritual_id = ra2.ritual_id
      JOIN rituals r ON ra1.ritual_id = r.id
      WHERE ra1.user_id = $1
        AND ra2.user_id = $2
        AND ra1.status != 'no_show'
        AND ra2.status != 'no_show'
        AND r.id != $3
      ORDER BY r.start_time DESC
      LIMIT 5
    `;

    const pastTogetherResult = await pool.query(pastTogetherQuery, [viewer_id, id, ritual_id]);
    const pastRitualsTogether = pastTogetherResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      venue_name: row.location_name,
      location_name: row.location_name,
      start_time: row.start_time,
    }));

    const sharedCountQuery = await pool.query(
      `SELECT COUNT(DISTINCT ra1.ritual_id)::int AS c
       FROM ritual_attendance ra1
       JOIN ritual_attendance ra2 ON ra1.ritual_id = ra2.ritual_id
       WHERE ra1.user_id = $1
         AND ra2.user_id = $2
         AND ra1.status != 'no_show'
         AND ra2.status != 'no_show'
         AND ra1.ritual_id != $3`,
      [viewer_id, id, ritual_id]
    );
    const priorSharedRitualCount = sharedCountQuery.rows[0]?.c || 0;
    const connectionLevel = priorSharedRitualCount === 0 ? 'stranger_same_ritual' : (priorSharedRitualCount <= 3 ? 'l1' : 'l2');
    const rsExactVisible = connectionLevel === 'l1' || connectionLevel === 'l2';
    const rsRounded10 = Math.round(rsScore);
    const statsVisibility = connectionLevel === 'stranger_same_ritual' ? 'ritual_host_only' : 'all';
    const sharedHistoryMode = connectionLevel === 'stranger_same_ritual'
      ? 'current_only'
      : (connectionLevel === 'l1' ? 'limited_1_3' : 'full');
    const visiblePastRitualsTogether = connectionLevel === 'stranger_same_ritual'
      ? []
      : (connectionLevel === 'l1' ? pastRitualsTogether.slice(0, 3) : pastRitualsTogether);
    const friendshipBadgesVisible = connectionLevel === 'l1' || connectionLevel === 'l2';
    const canMessageCta = connectionLevel === 'stranger_same_ritual'
      ? isWithinRitualMessageWindow
      : true;

    const [sharedRitualDetailsResult, viewerMetaResult, overlapResult, coreCircleBadgeCheck] = await Promise.all([
      pool.query(
      `SELECT
         r.id,
         r.title,
         r.type,
         r.location_name,
         r.start_time,
         r.location_lat,
         r.location_lng
       FROM ritual_attendance ra1
       JOIN ritual_attendance ra2 ON ra1.ritual_id = ra2.ritual_id
       JOIN rituals r ON r.id = ra1.ritual_id
       WHERE ra1.user_id = $1
         AND ra2.user_id = $2
         AND ra1.status NOT IN ('no_show', 'cancelled')
         AND ra2.status NOT IN ('no_show', 'cancelled')
       ORDER BY r.start_time ASC`,
      [viewer_id, id]
    ),
      pool.query(
        `SELECT university, rs_score
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [viewer_id]
      ),
      pool.query(
        `WITH v AS (
           SELECT DISTINCT ritual_id
           FROM ritual_attendance
           WHERE user_id = $1
             AND status NOT IN ('no_show', 'cancelled')
         ),
         t AS (
           SELECT DISTINCT ritual_id
           FROM ritual_attendance
           WHERE user_id = $2
             AND status NOT IN ('no_show', 'cancelled')
         ),
         inter AS (
           SELECT ritual_id FROM v INTERSECT SELECT ritual_id FROM t
         ),
         uni AS (
           SELECT ritual_id FROM v UNION SELECT ritual_id FROM t
         )
         SELECT
           (SELECT COUNT(*)::int FROM inter) AS intersection_count,
           (SELECT COUNT(*)::int FROM uni) AS union_count`,
        [viewer_id, id]
      ),
      pool.query(
        `SELECT 1
         FROM user_badges
         WHERE user_id = $1
           AND badge_key = $2
         LIMIT 1`,
        [viewer_id, `core_circle_${id}`]
      ),
    ]);
    const sharedRituals = sharedRitualDetailsResult.rows || [];
    const normalize = (v) =>
      String(v || '')
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const ritualType = (r) => normalize(r.type);
    const isTypeIn = (r, set) => set.has(ritualType(r));
    const countByPredicate = (predicate) => sharedRituals.filter(predicate).length;
    const sportsTypes = new Set(['kosu', 'bisiklet', 'spor', 'yuzme', 'tırmanma', 'tirmanma', 'yuruyus', 'futbol', 'masa tenisi', 'badminton', 'tenis', 'kaykay', 'boks / dovus sanatlari', 'bouldering', 'akrobasi', 'su sporlari', 'kis sporlari']);
    const chessTypes = new Set(['satranc']);
    const coffeeTypes = new Set(['kahve']);
    const bookTypes = new Set(['kitaplar']);
    const musicTypes = new Set(['muzik', 'klasik muzik']);
    const wellnessTypes = new Set(['yoga', 'farkindalik', 'saglik', 'beslenme', 'uyku bilimi']);
    const foodDrinkTypes = new Set(['yemek', 'sarap ve icecekler', 'craft bira', 'cay seremonisi', 'aperitivo', 'vegan']);
    const runTypes = new Set(['kosu']);
    const filmTypes = new Set(['film']);
    const philosophyTypes = new Set(['felsefe']);

    const sportsCount = countByPredicate((r) => isTypeIn(r, sportsTypes));
    const chessCount = countByPredicate((r) => isTypeIn(r, chessTypes));
    const coffeeCount = countByPredicate((r) => isTypeIn(r, coffeeTypes));
    const bookCount = countByPredicate((r) => isTypeIn(r, bookTypes));
    const musicCount = countByPredicate((r) => isTypeIn(r, musicTypes));
    const morningCount = countByPredicate((r) => new Date(r.start_time).getHours() < 11);
    const wellnessCount = countByPredicate((r) => isTypeIn(r, wellnessTypes));
    const foodDrinkCount = countByPredicate((r) => isTypeIn(r, foodDrinkTypes));
    const runCount = countByPredicate((r) => isTypeIn(r, runTypes));
    const filmCount = countByPredicate((r) => isTypeIn(r, filmTypes));
    const philosophyCount = countByPredicate((r) => isTypeIn(r, philosophyTypes));
    const venueCounts = sharedRituals.reduce((acc, r) => {
      const k = normalize(r.location_name || '');
      if (!k) return acc;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const maxSameVenueShared = Math.max(0, ...Object.values(venueCounts));
    const distinctTitles = new Set(sharedRituals.map((r) => normalize(r.title || '')).filter(Boolean)).size;
    const oldestSharedStart = sharedRituals[0]?.start_time ? new Date(sharedRituals[0].start_time) : null;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oldFriends = Boolean(oldestSharedStart && oldestSharedStart <= oneYearAgo);
    const viewerMeta = viewerMetaResult.rows[0] || {};
    const sameUniversity = Boolean(
      user.university &&
      viewerMeta.university &&
      normalize(viewerMeta.university) === normalize(user.university)
    );
    const viewerRs = Number(viewerMeta.rs_score || 0);
    const bothRs8Plus = rsScore >= 8 && viewerRs >= 8;
    const hasCoreCircle = coreCircleBadgeCheck.rows.length > 0;
    const intersectionCount = Number(overlapResult.rows[0]?.intersection_count || 0);
    const unionCount = Number(overlapResult.rows[0]?.union_count || 0);
    const overlapRatio = unionCount > 0 ? intersectionCount / unionCount : 0;
    const strongOverlap = overlapRatio >= 0.75 && intersectionCount >= 10;
    const hasMind = countByPredicate((r) => isTypeIn(r, new Set(['felsefe', 'kitaplar', 'psikoloji', 'tartisma']))) > 0;
    const hasBody = countByPredicate((r) => isTypeIn(r, new Set(['yoga', 'saglik', 'wellness', 'kosu', 'spor']))) > 0;

    const coords = sharedRituals
      .filter((r) => r.location_lat != null && r.location_lng != null)
      .map((r) => ({ lat: Number(r.location_lat), lng: Number(r.location_lng) }));
    const haversine = (aLat, aLng, bLat, bLng) => {
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const p =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * 6371000 * Math.atan2(Math.sqrt(p), Math.sqrt(1 - p));
    };
    const centroid = coords.length
      ? {
          lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
          lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
        }
      : null;
    const sameNeighborhoodCount = centroid
      ? sharedRituals.filter((r) => r.location_lat != null && r.location_lng != null && haversine(centroid.lat, centroid.lng, Number(r.location_lat), Number(r.location_lng)) <= 1500).length
      : maxSameVenueShared;

    const friendshipBadges = [
      { key: 'rooted_neighborhood_friend', icon: '🏘', label: 'Köklü Mahalle Arkadaşı', condition: 'Aynı mahallede 10 Ritual', earned: sameNeighborhoodCount >= 10 },
      { key: 'team_mates', icon: '⚽', label: 'Takım Arkadaşları', condition: 'Birlikte 10 spor Rituali', earned: sportsCount >= 10 },
      { key: 'respected_chess_friend', icon: '♟', label: 'Saygın Satranç Arkadaşı', condition: 'Birlikte 10 satranç Rituali', earned: chessCount >= 10 },
      { key: 'coffee_partners', icon: '☕', label: 'Kahve Ortakları', condition: 'Birlikte 10 kahve Rituali', earned: coffeeCount >= 10 },
      { key: 'book_club_duo', icon: '📚', label: 'Kitap Kulübü İkilisi', condition: 'Birlikte 10 kitap Rituali', earned: bookCount >= 10 },
      { key: 'music_lovers', icon: '🎵', label: 'Müzik Severler', condition: 'Birlikte 10 müzik Rituali', earned: musicCount >= 10 },
      { key: 'early_birds', icon: '🌅', label: 'Sabah Kuşları', condition: 'Birlikte 5 sabah Rituali', earned: morningCount >= 5 },
      { key: 'wellness_duo', icon: '🧘', label: 'Sağlık İkilisi', condition: 'Birlikte 10 wellness Rituali', earned: wellnessCount >= 10 },
      { key: 'food_drink_friends', icon: '🍷', label: 'Yemek ve İçki Arkadaşları', condition: 'Birlikte 10 yemek/içki Rituali', earned: foodDrinkCount >= 10 },
      { key: 'old_friends', icon: '🕰', label: 'Eski Arkadaşlar', condition: '1 yıl+ ortak Ritual geçmişi', earned: oldFriends },
      { key: 'university_friends', icon: '🎓', label: 'Üniversite Arkadaşları', condition: 'Aynı üniversite + 5 Ritual', earned: sameUniversity && priorSharedRitualCount >= 5 },
      { key: 'core_circle', icon: '🔮', label: 'Geri Bildirim Yok (Derin Bağ)', condition: "Çekirdek Daire'ye ulaşıldı", earned: hasCoreCircle },
      { key: 'strong_overlap', icon: '🌐', label: 'Güçlü Örtüşme', condition: 'Çok yüksek Ritual örtüşmesi (algoritmik)', earned: strongOverlap },
      { key: 'running_team', icon: '🏃', label: 'Koşu Ekibi', condition: 'Birlikte 10 koşu Rituali', earned: runCount >= 10 },
      { key: 'cinema_duo', icon: '🎬', label: 'Sinema İkilisi', condition: 'Birlikte 10 film Rituali', earned: filmCount >= 10 },
      { key: 'philosophy_circle', icon: '💡', label: 'Felsefe Çevresi', condition: 'Birlikte 10 felsefe Rituali', earned: philosophyCount >= 10 },
      { key: 'neighborhood_ritual_pair', icon: '🏠', label: 'Mahalle Ritual Çifti', condition: 'Aynı bölge, farklı Rituals', earned: sameNeighborhoodCount >= 2 && distinctTitles >= 2 },
      { key: 'power_duo', icon: '⭐', label: 'Güç İkilisi', condition: 'Her iki kullanıcı da RS 8,0+', earned: bothRs8Plus },
      { key: 'active_couple', icon: '🤸', label: 'Aktif Çift', condition: 'Birlikte 10 spor Rituali', earned: sportsCount >= 10 },
      { key: 'health_warriors', icon: '🌊', label: 'Sağlık Savaşçıları', condition: 'Zihin + beden Rituali kombinasyonu', earned: hasMind && hasBody },
    ];

    const sharedInterests =
      connectionLevel === 'stranger_same_ritual' ? [] : await getSharedInterests(id, viewer_id);
    const { stripFollowerCountsFromProfile } = await import('../services/followerCountPolicy.js');
    res.json({
      success: true,
      data: stripFollowerCountsFromProfile({
        id: user.id,
        name: user.name, // Masked in ritual context (full name shown)
        city: user.city,
        university: user.university,
        rsScore: rsExactVisible ? rsScore : null,
        rsRounded10: rsRounded10,
        rsExactVisible: rsExactVisible,
        rsStatus: rsStatus,
        friendsCount: statsVisibility === 'all' ? friendsCount : null,
        ritualsAttended: statsVisibility === 'all' ? (parseInt(user.rituals_attended) || 0) : null,
        ritualsHosted: parseInt(user.rituals_hosted) || 0,
        memberSince: statsVisibility === 'all' ? memberSince : null,
        isHost: isHost,
        isHostVerified: isHostVerified,
        isFriend: isFriend,
        connectionLevel,
        priorSharedRitualCount,
        statsVisibility,
        sharedHistoryMode,
        friendshipBadgesVisible,
        friendshipBadges: friendshipBadgesVisible ? friendshipBadges : [],
        canMessageCta,
        isWithinRitualMessageWindow,
        hasPendingRequest: hasPendingRequest,
        pendingFriendshipId: pendingFriendshipId,
        currentRitual: currentRitual,
        pastRitualsTogether: visiblePastRitualsTogether,
        sharedInterests,
      }),
    });
  } catch (error) {
    console.error('Error fetching participant profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch participant profile'
    });
  }
});

// PUT /api/users/:id/avatar - Upload profile photo (owner only)
router.put('/:id/avatar', authenticateToken, mediaUploadRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { image } = req.body; // base64 string (optional data:image/...;base64,... prefix)

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot update another user profile'
      });
    }

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!image || typeof image !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'image (base64) is required'
      });
    }

    let base64 = image;
    if (base64.includes(',')) {
      base64 = base64.split(',')[1];
    }
    const buf = Buffer.from(base64, 'base64');
    if (buf.length > AVATAR_MAX_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'Image too large (max 5MB)'
      });
    }

    const img = sharp(buf, { failOn: 'error' });
    const meta = await img.metadata();
    if (!AVATAR_FORMATS.has(String(meta.format || '').toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Avatar must be JPG, PNG, or WebP'
      });
    }
    const transformed = await img
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const avatarPath = buildAvatarStoragePath(id, Date.now(), '.webp');
    const relativeDiskPath = avatarPath.replace(/^\/uploads\//, '');
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', path.dirname(relativeDiskPath));
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(__dirname, '..', '..', 'uploads', relativeDiskPath);
    await fs.writeFile(filePath, transformed);

    await pool.query(
      'UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarPath, id]
    );

    const avatarUrl = buildAvatarUrl(req, avatarPath);
    res.json({
      success: true,
      data: { avatar_url: avatarUrl }
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
});

// PUT /api/users/:id - Update user profile (owner only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, university } = req.body;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot update another user profile'
      });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (city !== undefined) {
      updates.push(`city = $${paramIndex}`);
      values.push(city);
      paramIndex++;
    }

    if (university !== undefined) {
      updates.push(`university = $${paramIndex}`);
      values.push(university);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

// GET /api/users/:id/settings - Get user settings (owner only)
router.get('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot view settings of another user'
      });
    }

    // Check if user exists + §12 web_named opt-in
    const userCheck = await pool.query(
      'SELECT id, COALESCE(web_named, false) AS web_named FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get or create default settings
    let settingsResult = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [id]
    );

    if (settingsResult.rows.length === 0) {
      // Create default settings
      await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1)`,
        [id]
      );
      settingsResult = await pool.query(
        'SELECT * FROM user_settings WHERE user_id = $1',
        [id]
      );
    }

    const settings = settingsResult.rows[0];

    res.json({
      success: true,
      data: {
        notifications: {
          ritual_live: settings.notify_ritual_live,
          friend_joined_ritual: settings.notify_friend_joined_ritual,
          feedback_available: settings.notify_feedback_available,
          ritual_starting_soon: settings.notify_ritual_starting_soon,
          ritual_almost_full: settings.notify_ritual_almost_full,
          friend_request_accepted: settings.notify_friend_request_accepted !== false,
          venue_reopened: settings.notify_venue_reopened !== false,
          share_object: settings.notify_share_object !== false,
          forum_comment: settings.notify_forum_comment !== false,
          forum_repost: settings.notify_forum_repost !== false,
          forum_upvote: settings.notify_forum_upvote === true,
          penalty: settings.notify_penalty !== false,
          fl_change: settings.notify_fl_change === true,
          ds_tier: settings.notify_ds_tier === true,
          public_memory_follow: settings.notify_public_memory_follow === true,
          badge_approaching: settings.notify_badge_approaching === true,
          quiet_hours_enabled: settings.notify_quiet_hours_enabled !== false,
          quiet_start: settings.notify_quiet_start || '01:00',
          quiet_end: settings.notify_quiet_end || '09:00',
          weekly_digest: settings.notify_weekly_digest !== false,
          cat_ritual_door: settings.notify_cat_ritual_door !== false,
          cat_mention_soz: settings.notify_cat_mention_soz !== false,
          cat_friendship: settings.notify_cat_friendship !== false,
          cat_series_venue: settings.notify_cat_series_venue !== false,
          cat_consent_safety: settings.notify_cat_consent_safety !== false,
          cat_product_digest: settings.notify_cat_product_digest !== false,
        },
        privacy: {
          allow_p2p_feedback_from_friends_only: settings.allow_p2p_feedback_from_friends_only,
          show_rs_score_publicly: settings.show_rs_score_publicly,
          public_profile: settings.public_profile !== false,
          show_location: settings.show_location !== false,
          show_ritual_history: settings.show_ritual_history !== false,
          show_friends_list: !!settings.show_friends_list,
          /** §2Ağu-3 alias — same source as show_friends_list */
          friends_list_public: !!settings.show_friends_list,
          account_privacy: settings.account_privacy || 'OPEN',
          show_memories: settings.show_memories !== false,
          memory_privacy_mode: settings.memory_privacy_mode || 'public',
          discoverable_by_username: settings.discoverable_by_username !== false,
          discoverable_by_email: !!settings.discoverable_by_email,
          discoverable_by_phone: !!settings.discoverable_by_phone,
          data_personalization: settings.data_personalization !== false,
          data_analytics_opt_in: settings.data_analytics_opt_in !== false,
          data_marketing_opt_in: !!settings.data_marketing_opt_in,
          /** §12 — web-vitrin isim opt-in (DEFAULT false); app içi isimler etkilenmez */
          web_named: userCheck.rows[0].web_named === true,
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user settings'
    });
  }
});

// PUT /api/users/:id/settings - Update user settings (owner only)
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { notifications, privacy } = req.body;

    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Cannot update settings of another user'
      });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (notifications) {
      if (notifications.ritual_live !== undefined) {
        updates.push(`notify_ritual_live = $${paramIndex}`);
        values.push(notifications.ritual_live);
        paramIndex++;
      }
      if (notifications.friend_joined_ritual !== undefined) {
        updates.push(`notify_friend_joined_ritual = $${paramIndex}`);
        values.push(notifications.friend_joined_ritual);
        paramIndex++;
      }
      if (notifications.feedback_available !== undefined) {
        updates.push(`notify_feedback_available = $${paramIndex}`);
        values.push(notifications.feedback_available);
        paramIndex++;
      }
      if (notifications.ritual_starting_soon !== undefined) {
        updates.push(`notify_ritual_starting_soon = $${paramIndex}`);
        values.push(notifications.ritual_starting_soon);
        paramIndex++;
      }
      if (notifications.ritual_almost_full !== undefined) {
        updates.push(`notify_ritual_almost_full = $${paramIndex}`);
        values.push(notifications.ritual_almost_full);
        paramIndex++;
      }
      if (notifications.friend_request_accepted !== undefined) {
        updates.push(`notify_friend_request_accepted = $${paramIndex}`);
        values.push(notifications.friend_request_accepted);
        paramIndex++;
      }
      if (notifications.venue_reopened !== undefined) {
        updates.push(`notify_venue_reopened = $${paramIndex}`);
        values.push(notifications.venue_reopened);
        paramIndex++;
      }
      if (notifications.share_object !== undefined) {
        updates.push(`notify_share_object = $${paramIndex}`);
        values.push(notifications.share_object);
        paramIndex++;
      }
      if (notifications.forum_comment !== undefined) {
        updates.push(`notify_forum_comment = $${paramIndex}`);
        values.push(notifications.forum_comment);
        paramIndex++;
      }
      if (notifications.forum_repost !== undefined) {
        updates.push(`notify_forum_repost = $${paramIndex}`);
        values.push(notifications.forum_repost);
        paramIndex++;
      }
      if (notifications.forum_upvote !== undefined) {
        updates.push(`notify_forum_upvote = $${paramIndex}`);
        values.push(notifications.forum_upvote);
        paramIndex++;
      }
      if (notifications.penalty !== undefined) {
        updates.push(`notify_penalty = $${paramIndex}`);
        values.push(notifications.penalty);
        paramIndex++;
      }
      if (notifications.fl_change !== undefined) {
        updates.push(`notify_fl_change = $${paramIndex}`);
        values.push(notifications.fl_change);
        paramIndex++;
      }
      if (notifications.ds_tier !== undefined) {
        updates.push(`notify_ds_tier = $${paramIndex}`);
        values.push(notifications.ds_tier);
        paramIndex++;
      }
      if (notifications.public_memory_follow !== undefined) {
        updates.push(`notify_public_memory_follow = $${paramIndex}`);
        values.push(notifications.public_memory_follow);
        paramIndex++;
      }
      if (notifications.badge_approaching !== undefined) {
        updates.push(`notify_badge_approaching = $${paramIndex}`);
        values.push(notifications.badge_approaching);
        paramIndex++;
      }
      if (notifications.quiet_hours_enabled !== undefined) {
        updates.push(`notify_quiet_hours_enabled = $${paramIndex}`);
        values.push(notifications.quiet_hours_enabled);
        paramIndex++;
      }
      if (notifications.quiet_start !== undefined) {
        updates.push(`notify_quiet_start = $${paramIndex}`);
        values.push(String(notifications.quiet_start).slice(0, 5));
        paramIndex++;
      }
      if (notifications.quiet_end !== undefined) {
        updates.push(`notify_quiet_end = $${paramIndex}`);
        values.push(String(notifications.quiet_end).slice(0, 5));
        paramIndex++;
      }
      if (notifications.weekly_digest !== undefined) {
        updates.push(`notify_weekly_digest = $${paramIndex}`);
        values.push(notifications.weekly_digest);
        paramIndex++;
      }
      const catMap = {
        cat_ritual_door: 'notify_cat_ritual_door',
        cat_mention_soz: 'notify_cat_mention_soz',
        cat_friendship: 'notify_cat_friendship',
        cat_series_venue: 'notify_cat_series_venue',
        cat_consent_safety: 'notify_cat_consent_safety',
        cat_product_digest: 'notify_cat_product_digest',
      };
      for (const [key, col] of Object.entries(catMap)) {
        if (notifications[key] !== undefined) {
          updates.push(`${col} = $${paramIndex}`);
          values.push(Boolean(notifications[key]));
          paramIndex++;
        }
      }
    }

    if (privacy) {
      if (privacy.allow_p2p_feedback_from_friends_only !== undefined) {
        updates.push(`allow_p2p_feedback_from_friends_only = $${paramIndex}`);
        values.push(privacy.allow_p2p_feedback_from_friends_only);
        paramIndex++;
      }
      if (privacy.show_rs_score_publicly !== undefined) {
        const wantPublic = privacy.show_rs_score_publicly === true;
        const vis = LOCAL_CONFIG.rs.visibility || {};
        const minRituals = Number(vis.MIN_RITUALS_FOR_RING || 10);
        const toggleDays = Number(vis.TOGGLE_DAYS || 30);

        const cur = await pool.query(
          `SELECT COALESCE(show_rs_score_publicly, false) AS public,
                  show_rs_toggled_at
           FROM user_settings WHERE user_id = $1`,
          [userId]
        );
        const wasPublic = cur.rows[0]?.public === true;
        if (wantPublic !== wasPublic) {
          if (wantPublic) {
            const sealed = await pool.query(
              `SELECT COUNT(*)::int AS c
               FROM ritual_attendance
               WHERE user_id = $1
                 AND checkin_at IS NOT NULL
                 AND COALESCE(checkin_phase, 'sealed') = 'sealed'`,
              [userId]
            );
            if (Number(sealed.rows[0]?.c || 0) < minRituals) {
              return res.status(400).json({
                success: false,
                error: `RS halkasi icin en az ${minRituals} muhurlu ritual gerekir`,
                code: 'RS_RING_MIN_RITUALS',
                min_rituals: minRituals,
              });
            }
          }
          const toggledAt = cur.rows[0]?.show_rs_toggled_at
            ? new Date(cur.rows[0].show_rs_toggled_at)
            : null;
          if (toggledAt) {
            const nextAllowed = new Date(toggledAt.getTime() + toggleDays * 86400000);
            if (nextAllowed > new Date()) {
              return res.status(400).json({
                success: false,
                error: `RS gorunurlugu ${toggleDays} gunde bir degistirilebilir`,
                code: 'RS_TOGGLE_COOLDOWN',
                next_allowed_at: nextAllowed.toISOString(),
              });
            }
          }
          updates.push(`show_rs_score_publicly = $${paramIndex}`);
          values.push(wantPublic);
          paramIndex++;
          updates.push(`show_rs_toggled_at = NOW()`);
        }
      }
      if (privacy.public_profile !== undefined) {
        updates.push(`public_profile = $${paramIndex}`);
        values.push(privacy.public_profile);
        paramIndex++;
      }
      if (privacy.show_location !== undefined) {
        updates.push(`show_location = $${paramIndex}`);
        values.push(privacy.show_location);
        paramIndex++;
      }
      if (privacy.show_ritual_history !== undefined) {
        updates.push(`show_ritual_history = $${paramIndex}`);
        values.push(privacy.show_ritual_history);
        paramIndex++;
      }
      if (privacy.show_friends_list !== undefined || privacy.friends_list_public !== undefined) {
        const val =
          privacy.friends_list_public !== undefined
            ? privacy.friends_list_public
            : privacy.show_friends_list;
        updates.push(`show_friends_list = $${paramIndex}`);
        values.push(!!val);
        paramIndex++;
        // keep users.friends_list_public in sync (spec name)
        await pool.query(
          `UPDATE users SET friends_list_public = $1 WHERE id = $2`,
          [!!val, id]
        ).catch(() => {});
      }
      if (privacy.account_privacy !== undefined) {
        const ap = String(privacy.account_privacy).toUpperCase();
        if (!['OPEN', 'CLOSED'].includes(ap)) {
          return res.status(400).json({
            success: false,
            error: 'account_privacy must be OPEN or CLOSED',
          });
        }
        updates.push(`account_privacy = $${paramIndex}`);
        values.push(ap);
        paramIndex++;
        // sync legacy public_profile
        updates.push(`public_profile = $${paramIndex}`);
        values.push(ap === 'OPEN');
        paramIndex++;
      }
      if (privacy.show_memories !== undefined) {
        updates.push(`show_memories = $${paramIndex}`);
        values.push(privacy.show_memories);
        paramIndex++;
      }
      if (privacy.memory_privacy_mode !== undefined) {
        const allowedMemoryModes = ['public', 'friends_only', 'private'];
        if (!allowedMemoryModes.includes(privacy.memory_privacy_mode)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid memory_privacy_mode. Must be one of: public, friends_only, private'
          });
        }
        updates.push(`memory_privacy_mode = $${paramIndex}`);
        values.push(privacy.memory_privacy_mode);
        paramIndex++;
      }
      if (privacy.discoverable_by_username !== undefined) {
        updates.push(`discoverable_by_username = $${paramIndex}`);
        values.push(privacy.discoverable_by_username);
        paramIndex++;
      }
      if (privacy.discoverable_by_email !== undefined) {
        updates.push(`discoverable_by_email = $${paramIndex}`);
        values.push(privacy.discoverable_by_email);
        paramIndex++;
      }
      if (privacy.discoverable_by_phone !== undefined) {
        updates.push(`discoverable_by_phone = $${paramIndex}`);
        values.push(privacy.discoverable_by_phone);
        paramIndex++;
      }
      // Veri kullanımı tercihleri — gizlilik ekranındaki gerçek toggle'lar
      for (const key of [
        'data_personalization',
        'data_analytics_opt_in',
        'data_marketing_opt_in',
      ]) {
        if (privacy[key] !== undefined) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(Boolean(privacy[key]));
          paramIndex++;
        }
      }
    }

    // §12 web_named lives on users (not user_settings)
    let webNamedUpdated = null;
    if (privacy?.web_named !== undefined) {
      const wn = await pool.query(
        `UPDATE users SET web_named = $1, updated_at = NOW() WHERE id = $2
         RETURNING COALESCE(web_named, false) AS web_named`,
        [Boolean(privacy.web_named), id]
      ).catch(() => ({ rows: [] }));
      webNamedUpdated = wn.rows[0]?.web_named === true;
    }

    if (updates.length === 0 && webNamedUpdated === null) {
      return res.status(400).json({
        success: false,
        error: 'No settings to update'
      });
    }

    let row = null;
    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      // Ensure settings row exists
      await pool.query(
        `INSERT INTO user_settings (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [id]
      );

      const query = `
        UPDATE user_settings 
        SET ${updates.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      row = result.rows[0];
    } else {
      const settingsResult = await pool.query(
        'SELECT * FROM user_settings WHERE user_id = $1',
        [id]
      );
      row = settingsResult.rows[0] || {};
      if (webNamedUpdated === null) {
        const wn = await pool.query(
          `SELECT COALESCE(web_named, false) AS web_named FROM users WHERE id = $1`,
          [id]
        );
        webNamedUpdated = wn.rows[0]?.web_named === true;
      }
    }

    if (webNamedUpdated === null) {
      const wn = await pool.query(
        `SELECT COALESCE(web_named, false) AS web_named FROM users WHERE id = $1`,
        [id]
      );
      webNamedUpdated = wn.rows[0]?.web_named === true;
    }

    res.json({
      success: true,
      data: {
        notifications: {
          ritual_live: row.notify_ritual_live,
          friend_joined_ritual: row.notify_friend_joined_ritual,
          feedback_available: row.notify_feedback_available,
          ritual_starting_soon: row.notify_ritual_starting_soon,
          ritual_almost_full: row.notify_ritual_almost_full,
          friend_request_accepted: row.notify_friend_request_accepted !== false,
          venue_reopened: row.notify_venue_reopened !== false,
          share_object: row.notify_share_object !== false,
          forum_comment: row.notify_forum_comment !== false,
          forum_repost: row.notify_forum_repost !== false,
          forum_upvote: row.notify_forum_upvote === true,
          penalty: row.notify_penalty !== false,
          fl_change: row.notify_fl_change === true,
          ds_tier: row.notify_ds_tier === true,
          public_memory_follow: row.notify_public_memory_follow === true,
          badge_approaching: row.notify_badge_approaching === true,
          quiet_hours_enabled: row.notify_quiet_hours_enabled !== false,
          quiet_start: row.notify_quiet_start || '01:00',
          quiet_end: row.notify_quiet_end || '09:00',
          weekly_digest: row.notify_weekly_digest !== false,
          cat_ritual_door: row.notify_cat_ritual_door !== false,
          cat_mention_soz: row.notify_cat_mention_soz !== false,
          cat_friendship: row.notify_cat_friendship !== false,
          cat_series_venue: row.notify_cat_series_venue !== false,
          cat_consent_safety: row.notify_cat_consent_safety !== false,
          cat_product_digest: row.notify_cat_product_digest !== false,
        },
        privacy: {
          allow_p2p_feedback_from_friends_only: row.allow_p2p_feedback_from_friends_only,
          show_rs_score_publicly: row.show_rs_score_publicly,
          public_profile: row.public_profile !== false,
          show_location: row.show_location !== false,
          show_ritual_history: row.show_ritual_history !== false,
          show_friends_list: !!row.show_friends_list,
          friends_list_public: !!row.show_friends_list,
          account_privacy: row.account_privacy || 'OPEN',
          show_memories: row.show_memories !== false,
          memory_privacy_mode: row.memory_privacy_mode || 'public',
          discoverable_by_username: row.discoverable_by_username !== false,
          discoverable_by_email: !!row.discoverable_by_email,
          discoverable_by_phone: !!row.discoverable_by_phone,
          data_personalization: row.data_personalization !== false,
          data_analytics_opt_in: row.data_analytics_opt_in !== false,
          data_marketing_opt_in: !!row.data_marketing_opt_in,
          web_named: webNamedUpdated === true,
        }
      }
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user settings'
    });
  }
});

// GET /api/users/:id/blocked-keywords - List blocked keywords (owner only)
router.get('/:id/blocked-keywords', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const result = await pool.query(
      'SELECT id, keyword, created_at FROM user_blocked_keywords WHERE user_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching blocked keywords:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blocked keywords' });
  }
});

// POST /api/users/:id/blocked-keywords - Add blocked keyword (owner only)
router.post('/:id/blocked-keywords', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return res.status(400).json({ success: false, error: 'keyword is required' });
    }
    const k = keyword.trim().toLowerCase();
    await pool.query(
      `INSERT INTO user_blocked_keywords (user_id, keyword) VALUES ($1, $2)
       ON CONFLICT (user_id, LOWER(keyword)) DO NOTHING`,
      [id, k]
    );
    const result = await pool.query(
      'SELECT id, keyword, created_at FROM user_blocked_keywords WHERE user_id = $1 AND LOWER(keyword) = $2',
      [id, k]
    );
    res.json({ success: true, data: result.rows[0] || { keyword: k } });
  } catch (error) {
    console.error('Error adding blocked keyword:', error);
    res.status(500).json({ success: false, error: 'Failed to add keyword' });
  }
});

// DELETE /api/users/:id/blocked-keywords/:keyword - Remove blocked keyword (owner only)
router.delete('/:id/blocked-keywords/:keyword', authenticateToken, async (req, res) => {
  try {
    const { id, keyword } = req.params;
    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const decoded = decodeURIComponent(keyword).trim().toLowerCase();
    await pool.query(
      'DELETE FROM user_blocked_keywords WHERE user_id = $1 AND LOWER(keyword) = $2 RETURNING id',
      [id, decoded]
    );
    res.json({ success: true, message: 'Keyword removed' });
  } catch (error) {
    console.error('Error removing blocked keyword:', error);
    res.status(500).json({ success: false, error: 'Failed to remove keyword' });
  }
});

// DELETE /api/users/:id/account — self-serve hesap silme (Sosyal §3)
router.delete('/:id/account', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const { deleteOwnAccount } = await import('../services/accountDeletionService.js');
    const result = await deleteOwnAccount({
      userId: id,
      confirmPhrase: req.body?.confirm || req.body?.confirm_phrase || '',
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
    return res.json({
      success: true,
      data: {
        display_name: result.display_name,
        already: Boolean(result.already),
        note: result.note || null,
      },
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

// GET /api/users/:id/export-data - Export user data (owner only, JSON)
router.get('/:id/export-data', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const [userRow, ritualsRow, settingsRow] = await Promise.all([
      pool.query('SELECT id, name, city, university, rs_score, created_at FROM users WHERE id = $1', [id]),
      pool.query(
        `SELECT r.id, r.title, r.type, r.location_name, r.start_time, ra.status
         FROM ritual_attendance ra
         JOIN rituals r ON ra.ritual_id = r.id
         WHERE ra.user_id = $1
         ORDER BY r.start_time DESC
         LIMIT 500`,
        [id]
      ),
      pool.query('SELECT * FROM user_settings WHERE user_id = $1', [id])
    ]);
    const user = userRow.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const exportData = {
      exported_at: new Date().toISOString(),
      profile: {
        id: user.id,
        name: user.name,
        city: user.city,
        university: user.university,
        rs_score: parseFloat(user.rs_score),
        created_at: user.created_at,
      },
      rituals_attended: ritualsRow.rows.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        venue_name: r.location_name,
        location_name: r.location_name,
        start_time: r.start_time,
        attendance_status: r.status,
      })),
      settings: settingsRow.rows[0] ? {
        notifications: {
          ritual_live: settingsRow.rows[0].notify_ritual_live,
          friend_joined_ritual: settingsRow.rows[0].notify_friend_joined_ritual,
          feedback_available: settingsRow.rows[0].notify_feedback_available,
          ritual_starting_soon: settingsRow.rows[0].notify_ritual_starting_soon,
          ritual_almost_full: settingsRow.rows[0].notify_ritual_almost_full,
        },
        privacy: {
          show_rs_score_publicly: settingsRow.rows[0].show_rs_score_publicly,
          allow_p2p_feedback_from_friends_only: settingsRow.rows[0].allow_p2p_feedback_from_friends_only,
        },
      } : null,
    };
    res.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
});

// GET /api/users/:id/host-ledger — private host geçmişi (owner or self)
router.get('/:id/host-ledger', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (String(targetId) !== String(req.user.userId)) {
      return res.status(403).json({ success: false, error: 'Host ledger is private' });
    }
    const { getHostLedger } = await import('../services/hostLedgerService.js');
    const data = await getHostLedger(targetId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('host-ledger error', error);
    return res.status(500).json({ success: false, error: 'Failed to load host ledger' });
  }
});

export default router;
