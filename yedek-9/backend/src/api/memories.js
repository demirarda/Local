import express from 'express';
import crypto from 'crypto';
import { parseBuffer } from 'music-metadata';
import sharp from 'sharp';
import pool from '../config/database.js';
import logger from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { requireIdentityVerified } from '../middleware/identityGate.js';
import { assertCanJoinRitual } from '../services/penaltyService.js';
import { sanitizeString } from '../middleware/security.js';
import {
  createPresignedUploadUrl,
  deleteS3Object,
  getS3ObjectBuffer,
  isS3MediaConfigured,
  putS3ObjectBuffer,
  toS3Uri,
  verifyS3ObjectExists,
  enrichMemoryMediaUrls,
  enrichMemoryMediaUrlList,
} from '../utils/s3Media.js';
import {
  RITUAL_STATUS,
  getLifecyclePhase,
} from '../services/ritualState.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { excludeBlockedUsersSql } from '../services/blockVisibility.js';
import {
  enrichMemoryMusicFields,
  enrichMemoryMusicList,
} from '../services/musicMetadata.js';
import {
  assertCameraCaptureSource,
  buildStampLabel,
} from '../services/memoryStamp.js';

const router = express.Router();
const MB = 1024 * 1024;
const MEMORY_PHOTO_MAX_BYTES = 15 * MB;
const MEMORY_VIDEO_MAX_BYTES = 80 * MB;
const MEMORY_VIDEO_MAX_SECONDS = Number(LOCAL_CONFIG.video?.MAX_S) || 45;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-m4v']);
const DRAFT_MEDIA_TYPES = new Set(['photo', 'media', 'video']);

function resolveMemoryScope({ memory_scope, memory_type, destination, audience }) {
  // sonMD: WINDOW|CIRCLE|CITY (legacy solo|pulse|all map)
  if (audience) {
    const a = String(audience).toUpperCase();
    if (a === 'CITY') return 'all';
    if (a === 'CIRCLE') return 'pulse';
    if (a === 'WINDOW') return 'solo';
  }
  if (memory_scope) {
    const s = String(memory_scope).toLowerCase();
    if (['solo', 'pulse', 'all', 'window', 'circle', 'city'].includes(s)) {
      if (s === 'window') return 'solo';
      if (s === 'circle') return 'pulse';
      if (s === 'city') return 'all';
      return s;
    }
  }
  if (memory_type === 'pulse' || destination === 'ritual_and_pulse') return 'pulse';
  return 'solo';
}

function resolveMemoryAudience(input) {
  const scope = resolveMemoryScope(input);
  if (scope === 'all') return 'CITY';
  if (scope === 'pulse') return 'CIRCLE';
  return 'WINDOW';
}

function resolveMemoryTypeColumn({ type, memory_type, spotify_playlist_url, content_url, upload_type }) {
  const raw = String(type || memory_type || '').toLowerCase();
  if (upload_type === 'video' || raw === 'video') return 'media';
  if (['quote', 'photo', 'media', 'music'].includes(raw)) return raw;
  if (raw === 'playlist' || spotify_playlist_url) return 'music';
  if (raw === 'voice' || raw === 'text') return 'media';
  if (content_url) return 'photo';
  return 'quote';
}

async function presentMemory(row) {
  const withMedia = await enrichMemoryMediaUrls(row);
  return enrichMemoryMusicFields(withMedia);
}

async function presentMemoryList(rows = []) {
  const withMedia = await enrichMemoryMediaUrlList(rows);
  return enrichMemoryMusicList(withMedia);
}

function validateRitualMemoryCreate(ritual, attendance, { draft = false } = {}) {
  const phase = getLifecyclePhase(ritual);
  // sonMD Check-in §2: ısınma → RULO draft; START/LIVE+WINDOW → paylaşım
  const sealed =
    Boolean(attendance?.checkin_at) &&
    String(attendance?.checkin_phase || 'sealed') !== 'pending_witness';
  if (!sealed && !attendance?.checkin_at) {
    return 'Must check in to share memories';
  }
  if (String(attendance?.checkin_phase || '') === 'pending_witness') {
    return 'Pending witness check-in cannot create memories yet';
  }
  const status = String(attendance.status || '').toLowerCase();
  if (['no_show', 'cancelled'].includes(status)) {
    return 'Invalid attendance status for memory creation';
  }
  if (draft) {
    if (![RITUAL_STATUS.LIVE, RITUAL_STATUS.WINDOW, RITUAL_STATUS.PRELOBBY].includes(phase)) {
      return 'Draft memories require live/warmup or window phase';
    }
    return null;
  }
  if (phase === RITUAL_STATUS.LIVE || phase === RITUAL_STATUS.WINDOW) {
    return null;
  }
  return 'Memories can only be shared after ritual start (live) or during window';
}

function assertNotThrowback(body = {}) {
  if (
    body.throwback === true ||
    body.is_throwback === true ||
    body.original_memory_id ||
    body.source_memory_id ||
    body.repost_of_memory_id
  ) {
    return 'Throwback (re-sharing old memories) is not allowed';
  }
  return null;
}

async function assertNoDuplicateArchivedMemory(pool, userId, ritualId, content) {
  if (!content || !String(content).trim()) return null;
  const dup = await pool.query(
    `SELECT m.id
     FROM memories m
     JOIN rituals r ON r.id = m.ritual_id
     WHERE m.user_id = $1
       AND m.ritual_id != $2
       AND m.content = $3
       AND r.status::text IN ('archived', 'closed')
     LIMIT 1`,
    [userId, ritualId, String(content).trim()]
  );
  if (dup.rows.length > 0) {
    return 'Throwback (re-sharing archived memory content) is not allowed';
  }
  return null;
}

// GET /api/memories/:id - backend-yeni.md contract
// Restrict :id to UUID pattern so static routes like /pulse are not shadowed.
router.get('/:id([0-9a-fA-F-]{36})', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         m.*,
         u.name AS user_name,
         u.rs_score AS user_rs_score
       FROM memories m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1
       LIMIT 1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }
    const row = result.rows[0];
    const holdStatuses = new Set(['pending_review', 'provider_error', 'flagged']);
    if (
      holdStatuses.has(String(row.csam_scan_status || '')) &&
      String(row.user_id) !== String(req.user.userId)
    ) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }
    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch memory' });
  }
});

// GET /api/memories/ritual/:ritualId - Get memories for a ritual
// v2 §2: memory_scope — ALL herkese, PULSE arkadaşa, SOLO yalnız sahibi
router.get('/ritual/:ritualId', authenticateToken, async (req, res) => {
  try {
    const { ritualId } = req.params;
    const { limit = 20, archive = '0' } = req.query;
    const userId = req.user.userId;
    const archiveMode = archive === '1' || archive === 'true';

    const ritualCheck = await pool.query(
      'SELECT start_time, duration, status, live_window_hours FROM rituals WHERE id = $1',
      [ritualId]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }

    const ritual = ritualCheck.rows[0];
    const currentTime = new Date();
    const phase = getLifecyclePhase(ritual, currentTime);

    if (phase === RITUAL_STATUS.PRELOBBY) {
      return res.status(403).json({
        success: false,
        error: 'Ritual has not started yet',
      });
    }

    const attendanceCheck = await pool.query(
      'SELECT 1 FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2 AND status != $3',
      [ritualId, userId, 'no_show']
    );
    const isAttendee = attendanceCheck.rows.length > 0;
    const isHost = (
      await pool.query(`SELECT 1 FROM rituals WHERE id = $1 AND host_id = $2`, [ritualId, userId])
    ).rows.length > 0;

    // Live/window: attendee (or host). Archive: anyone can request; scope filter applies.
    if (!archiveMode && phase !== RITUAL_STATUS.ARCHIVED && !isAttendee && !isHost) {
      return res.status(403).json({
        success: false,
        error: 'User is not attending this ritual',
      });
    }

    const query = `
      SELECT 
        m.*,
        u.name as user_name,
        u.rs_score as user_rs_score,
        EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.status = 'accepted'
            AND (
              (f.user_id = $2 AND f.friend_id = m.user_id)
              OR (f.friend_id = $2 AND f.user_id = m.user_id)
              OR (f.requester_id = $2 AND f.receiver_id = m.user_id)
              OR (f.receiver_id = $2 AND f.requester_id = m.user_id)
            )
        ) AS is_friend_author,
        (
          COALESCE(m.upvote_count, 0) * $4
          + COALESCE(m.comment_count, 0) * $5
          + COALESCE(m.echo_count, 0) * $6
        ) AS liveliness
      FROM memories m
      JOIN users u ON m.user_id = u.id
      WHERE m.ritual_id = $1
        AND COALESCE(m.status, 'published') = 'published'
        AND (
          m.user_id = $2
          OR COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
        )
        AND (
          m.user_id = $2
          OR COALESCE(m.memory_scope::text, 'solo') = 'all'
          OR (
            COALESCE(m.memory_scope::text, 'solo') = 'pulse'
            AND (
              EXISTS (
                SELECT 1 FROM friendships f
                WHERE f.status = 'accepted'
                  AND (
                    (f.user_id = $2 AND f.friend_id = m.user_id)
                    OR (f.friend_id = $2 AND f.user_id = m.user_id)
                    OR (f.requester_id = $2 AND f.receiver_id = m.user_id)
                    OR (f.receiver_id = $2 AND f.requester_id = m.user_id)
                  )
              )
              OR EXISTS (
                SELECT 1 FROM follows fo
                WHERE fo.follower_id = $2 AND fo.following_id = m.user_id
              )
            )
          )
        )
      ORDER BY liveliness DESC, m.created_at DESC
      LIMIT $3
    `;

    const mix = LOCAL_CONFIG.pulse?.MEMORY_RANK_MIX || { upvote: 1, soz: 1.2, yanki: 0.8 };
    const result = await pool.query(query, [
      ritualId,
      userId,
      parseInt(limit, 10) || 20,
      Number(mix.upvote) || 1,
      Number(mix.soz) || 1.2,
      Number(mix.yanki) || 0.8,
    ]);

    const memories = await presentMemoryList(
      result.rows.map((memory) => ({
        id: memory.id,
        ritual_id: memory.ritual_id,
        user_id: memory.user_id,
        user_name: memory.user_name,
        user_rs_score: parseFloat(memory.user_rs_score) || 6.0,
        content: memory.content,
        memory_type: memory.memory_type,
        memory_scope: memory.memory_scope || 'solo',
        is_retro: Boolean(memory.is_retro),
        status: memory.status,
        stamp_label: memory.stamp_label,
        captured_at: memory.captured_at,
        published_at: memory.published_at,
        expires_at: memory.expires_at,
        spotify_playlist_url: memory.spotify_playlist_url,
        spotify_playlist_id: memory.spotify_playlist_id,
        created_at: memory.created_at,
        content_url: memory.content_url,
        image_url: memory.content_url,
        photo_url: memory.content_url,
      }))
    );

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error('Error fetching ritual memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ritual memories',
    });
  }
});

// GET /api/memories/pulse - Get pulse memories (24h, limited)
// Spec 5.6: Only from direct friends, followed host, verified host, verified venue
// Note: Eligibility filtering temporarily simplified - viewer_id parameter is accepted but not yet fully implemented
router.get('/pulse', authenticateToken, async (req, res) => {
  try {
    const { city, limit = 10, scope } = req.query;
    const viewer_id = req.user.userId;

    // Base query with eligibility filtering (Spec 5.6)
    // Memory is eligible if:
    // 1. Memory creator is direct friend of viewer, OR
    // 2. Memory creator is followed host, OR
    // 3. Memory creator is verified host, OR
    // 4. Ritual venue is verified
    let query = `
      SELECT
        m.*,
        u.name as user_name,
        u.rs_score as user_rs_score,
        u.city as user_city,
        r.title as ritual_title,
        r.type as ritual_type,
        r.location_name as ritual_venue,
        r.host_id as ritual_host_id
      FROM memories m
      JOIN users u ON m.user_id = u.id
      JOIN rituals r ON m.ritual_id = r.id
      WHERE m.memory_type = 'pulse'
        AND COALESCE(m.status, 'published') = 'published'
        AND COALESCE(m.is_retro, false) = false
        AND COALESCE(m.captured_at, m.created_at) > NOW() - INTERVAL '24 hours'
        AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
        AND COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
    `;

    const params = [];
    let paramIndex = 1;

    {
      const blockEx = excludeBlockedUsersSql('m.user_id', viewer_id, paramIndex);
      query += blockEx.sql;
      params.push(...blockEx.params);
      paramIndex = blockEx.nextIndex;
    }

    if (city) {
      query += ` AND u.city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    let memories = result.rows.map(memory => ({
      id: memory.id,
      ritual_id: memory.ritual_id,
      ritual_title: memory.ritual_title,
      ritual_type: memory.ritual_type,
      ritual_venue: memory.ritual_venue,
      ritual_host_id: memory.ritual_host_id,
      user_id: memory.user_id,
      user_name: memory.user_name,
      user_rs_score: parseFloat(memory.user_rs_score) || 6.0,
      user_city: memory.user_city,
      content: memory.content,
      memory_type: memory.memory_type,
      expires_at: memory.expires_at,
      spotify_playlist_url: memory.spotify_playlist_url,
      spotify_playlist_id: memory.spotify_playlist_id,
      created_at: memory.created_at,
      content_url: memory.content_url,
      image_url: memory.content_url || memory.image_url,
      photo_url: memory.content_url || memory.photo_url,
      stamp_label: memory.stamp_label,
      captured_at: memory.captured_at,
      published_at: memory.published_at,
      is_retro: Boolean(memory.is_retro),
      // Source flags are populated later when viewer_id is present
      is_friend_source: false,
      is_followed_host_source: false,
      is_verified_host_source: false,
      is_verified_venue_source: false,
    }));
    memories = await presentMemoryList(memories);

    // Eligibility filtering (Spec 5.6) - Only from:
    // 1) direct friends, 2) followed host, 3) verified host, 4) verified venue
    if (viewer_id && memories.length > 0) {
      const viewerId = viewer_id;
      const filtered = [];

      for (const mem of memories) {
      const isOwnMemory = String(mem.user_id) === String(viewerId);

      // 1. Direct friend (viewer ↔ memory creator)
        const friendshipResult = await pool.query(
          `SELECT 1 FROM friendships
           WHERE status = 'accepted'
             AND (
               (user_id = $1 AND friend_id = $2) OR
               (user_id = $2 AND friend_id = $1)
             )
           LIMIT 1`,
          [viewerId, mem.user_id]
        );
        const isFriend = friendshipResult.rows.length > 0;

        let isFlFriend = false;
        if (scope === 'fl' && isFriend) {
          const flResult = await pool.query(
            `SELECT friendship_level::text AS level FROM friendships
             WHERE status = 'accepted'
               AND (
                 (requester_id = $1 AND receiver_id = $2)
                 OR (requester_id = $2 AND receiver_id = $1)
               )
             LIMIT 1`,
            [viewerId, mem.user_id]
          );
          const level = flResult.rows[0]?.level || 'l1';
          isFlFriend = ['l1', 'l2', 'l3'].includes(level);
        }

        // 2. Viewer follows memory creator
        const followResult = await pool.query(
          `SELECT 1 FROM follows
           WHERE follower_id = $1
             AND following_id = $2
           LIMIT 1`,
          [viewerId, mem.user_id]
        );
        const isFollowedHost = followResult.rows.length > 0;

        // 3. Memory creator is verified host
        const hostVerification = await pool.query(
          `SELECT 1 FROM host_verifications
           WHERE user_id = $1
             AND status = 'active'
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           LIMIT 1`,
          [mem.user_id]
        );
        const isVerifiedHost = hostVerification.rows.length > 0;

        // 4. Ritual venue is verified (using memory owner city as proxy)
        const venueVerification = await pool.query(
          `SELECT 1 FROM venue_verifications
           WHERE venue_name = $1
             AND city = $2
             AND status = 'active'
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
           LIMIT 1`,
          [mem.ritual_venue, mem.user_city || '']
        );
        const isVerifiedVenue = venueVerification.rows.length > 0;

      if (scope === 'fl') {
        if (isOwnMemory || isFlFriend) {
          filtered.push({
            ...mem,
            is_own_source: isOwnMemory,
            is_friend_source: isFlFriend,
            is_fl_source: isFlFriend,
            is_followed_host_source: false,
            is_verified_host_source: false,
            is_verified_venue_source: false,
          });
        }
        continue;
      }

      if (isOwnMemory || isFriend || isFollowedHost || isVerifiedHost || isVerifiedVenue) {
          filtered.push({
            ...mem,
          is_own_source: isOwnMemory,
            is_friend_source: isFriend,
            is_followed_host_source: isFollowedHost,
            is_verified_host_source: isVerifiedHost,
            is_verified_venue_source: isVerifiedVenue,
          });
        }
      }

      memories = filtered;
    }

    res.json({
      success: true,
      data: memories
    });
  } catch (error) {
    const cityParam = req?.query?.city || null;
    const viewerIdParam = req?.user?.userId || null;
    logger.error('Error fetching pulse memories', { 
      error: error.message, 
      stack: error.stack,
      city: cityParam,
      viewerId: viewerIdParam,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pulse memories',
      details: error.message,
      code: error.code
    });
  }
});

// GET /api/memories/eligibility - Check if user can share to Pulse
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const { ritual_id } = req.query;
    const user_id = req.user.userId;

    if (!ritual_id) {
      return res.status(400).json({
        success: false,
      error: 'ritual_id is required'
      });
    }

    // Check if ritual is in window phase (memories only during window — son-part.md §2.4)
    const ritualCheck = await pool.query(
      `SELECT status, host_id, start_time, duration, live_window_hours, window_ends_at
       FROM rituals WHERE id = $1`,
      [ritual_id]
    );

    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found'
      });
    }

    const ritual = ritualCheck.rows[0];
    const phase = getLifecyclePhase(ritual);

    if (phase !== RITUAL_STATUS.WINDOW) {
      return res.json({
        success: true,
        data: {
          eligible: false,
          reason: 'Memories can only be shared during the window phase'
        }
      });
    }

    // Spec 5.6: Eligibility for sharing to Pulse
    // Only from live rituals; only from direct friends, followed host, verified host, verified venue
    
    // Check if user is direct friend with host (memory creator will be the user, so check if host is friend)
    const friendshipCheck = await pool.query(
      `SELECT status FROM friendships 
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
       AND status = 'accepted'`,
      [user_id, ritual.host_id]
    );
    const isFriendWithHost = friendshipCheck.rows.length > 0;

    // Check if user follows host
    const followCheck = await pool.query(
      `SELECT * FROM follows 
       WHERE follower_id = $1 AND following_id = $2`,
      [user_id, ritual.host_id]
    );
    const followsHost = followCheck.rows.length > 0;

    // Check if host is verified
    const hostVerificationCheck = await pool.query(
      `SELECT * FROM host_verifications 
       WHERE user_id = $1 
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [ritual.host_id]
    );
    const isHostVerified = hostVerificationCheck.rows.length > 0;

    // Get venue city from ritual or user
    const venueCityQuery = await pool.query(
      `SELECT u.city FROM users u WHERE u.id = $1`,
      [ritual.host_id]
    );
    const venueCity = venueCityQuery.rows[0]?.city || '';

    // Check if venue is verified
    const venueVerificationCheck = await pool.query(
      `SELECT * FROM venue_verifications 
       WHERE venue_name = $1 
         AND city = $2
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [ritual.location_name, venueCity]
    );
    const isVenueVerified = venueVerificationCheck.rows.length > 0;

    // Eligibility: friend with host OR follows host OR host verified OR venue verified
    const eligible = isFriendWithHost || followsHost || isHostVerified || isVenueVerified;

    res.json({
      success: true,
      data: {
        eligible: eligible,
        reason: eligible 
          ? 'Eligible to share to Pulse'
          : 'Must be friends with host, follow host, or host/venue must be verified',
        checks: {
          isFriendWithHost,
          followsHost,
          isHostVerified,
          isVenueVerified
        }
      }
    });
  } catch (error) {
    logger.error('Error checking memory eligibility', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to check eligibility'
    });
  }
});

// POST /api/memories - Create a memory
router.post('/', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const { ritual_id, content, memory_type = 'ritual', spotify_playlist_url, mode } = req.body;
    const user_id = req.user.userId;

    const penaltyCheck = await assertCanJoinRitual(user_id);
    if (!penaltyCheck.ok) {
      return res.status(403).json({
        success: false,
        error: penaltyCheck.message,
        code: penaltyCheck.code,
      });
    }

    if (!ritual_id) {
      return res.status(400).json({
        success: false,
      error: 'ritual_id is required'
      });
    }

    // Validate memory type
    const validTypes = ['ritual', 'pulse'];
    if (!validTypes.includes(memory_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memory_type. Must be "ritual" or "pulse"'
      });
    }

    // Check if user attended the ritual
    const attendanceCheck = await pool.query(
      'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
      [ritual_id, user_id]
    );

    if (attendanceCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'User is not attending this ritual'
      });
    }

    const ritualCheck = await pool.query(
      'SELECT * FROM rituals WHERE id = $1',
      [ritual_id]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found',
      });
    }
    const ritualRow = ritualCheck.rows[0];
    const isDraftCreate = req.body.status === 'draft' || req.body.mode === 'init_upload';
    const ritualMemoryError = validateRitualMemoryCreate(
      ritualRow,
      attendanceCheck.rows[0],
      { draft: Boolean(isDraftCreate && req.body.status === 'draft') }
    );
    if (ritualMemoryError) {
      return res.status(403).json({ success: false, error: ritualMemoryError });
    }

    const throwbackError = assertNotThrowback(req.body);
    if (throwbackError) {
      return res.status(403).json({ success: false, error: throwbackError });
    }

    const memoryPhase = getLifecyclePhase(ritualRow);
    const createdInWindow = memoryPhase === RITUAL_STATUS.WINDOW;

    // For pulse memories, check eligibility
    if (memory_type === 'pulse') {
      const ritual = ritualRow;
      const friendshipCheck = await pool.query(
        `SELECT status FROM friendships 
         WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
         AND status = 'accepted'`,
        [user_id, ritual.host_id]
      );
      const isFriendWithHost = friendshipCheck.rows.length > 0;

      // Check if user follows host
      const followCheck = await pool.query(
        `SELECT * FROM follows 
         WHERE follower_id = $1 AND following_id = $2`,
        [user_id, ritual.host_id]
      );
      const followsHost = followCheck.rows.length > 0;

      // Check if host is verified
      const hostVerificationCheck = await pool.query(
        `SELECT * FROM host_verifications 
         WHERE user_id = $1 
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [ritual.host_id]
      );
      const isHostVerified = hostVerificationCheck.rows.length > 0;

      // Check if venue is verified
      const venueVerificationCheck = await pool.query(
        `SELECT * FROM venue_verifications 
         WHERE venue_name = $1 
           AND city = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [ritual.location_name, ritual.city || '']
      );
      const isVenueVerified = venueVerificationCheck.rows.length > 0;

      const eligible = isFriendWithHost || followsHost || isHostVerified || isVenueVerified;

      if (!eligible) {
        return res.status(403).json({
          success: false,
          error: 'Not eligible to share to Pulse. Must be friends with host, follow host, or host/venue must be verified.'
        });
      }
    }

    // 9.2 upload flow: initialize direct S3 upload URL (5 minutes)
    if (mode === 'init_upload') {
      if (!isS3MediaConfigured()) {
        return res.status(503).json({ success: false, error: 'S3 media storage is not configured' });
      }
      const galleryErr = assertCameraCaptureSource(req.body, LOCAL_CONFIG.visual || {});
      if (galleryErr) {
        return res.status(400).json({
          success: false,
          error: galleryErr,
          message: 'Window/prelobby gorselleri yalniz in-app kamera ile dogar',
        });
      }
      const upload_type = String(req.body.upload_type || 'photo');
      const content_type = String(
        req.body.content_type ||
          (upload_type === 'video'
            ? 'video/mp4'
            : 'image/jpeg')
      );
      const file_size_bytes = Number(req.body.file_size_bytes || 0);
      const duration_seconds = Number(req.body.duration_seconds || 0);
      if (!['photo', 'video'].includes(upload_type)) {
        return res.status(400).json({ success: false, error: 'upload_type must be photo or video (in-app camera only)' });
      }
      if (upload_type === 'photo') {
        if (!IMAGE_TYPES.has(content_type)) {
          return res.status(400).json({ success: false, error: 'Anı fotoğrafı formatı JPG/PNG/WebP olmalı' });
        }
        if (!Number.isFinite(file_size_bytes) || file_size_bytes <= 0 || file_size_bytes > MEMORY_PHOTO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Anı fotoğrafı en fazla 15MB olmalı' });
        }
      }
      if (upload_type === 'video') {
        if (!VIDEO_TYPES.has(content_type)) {
          return res.status(400).json({ success: false, error: 'Anı videosu MP4/MOV olmalı' });
        }
        if (!Number.isFinite(file_size_bytes) || file_size_bytes <= 0 || file_size_bytes > MEMORY_VIDEO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Anı videosu en fazla 80MB olmalı' });
        }
        if (!Number.isFinite(duration_seconds) || duration_seconds <= 0 || duration_seconds > MEMORY_VIDEO_MAX_SECONDS) {
          return res.status(400).json({
            success: false,
            error: `Anı videosu en fazla ${MEMORY_VIDEO_MAX_SECONDS} sn olmalı`,
          });
        }
      }
      const memoryId = req.body.memory_id || crypto.randomUUID();
      const timestamp = Date.now();
      const ext =
        upload_type === 'video' ? '.mp4' : '.jpg';
      const folder = upload_type === 'video' ? 'videos' : 'memories';
      const key = `local-app/${folder}/${user_id}/${memoryId}/${timestamp}${ext}`;
      const upload_url = await createPresignedUploadUrl(key, content_type, 300);
      return res.json({
        success: true,
        data: {
          upload_url,
          method: 'PUT',
          expires_in_seconds: 300,
          memory_id: memoryId,
          storage_key: key,
          content_type,
          max_video_seconds: MEMORY_VIDEO_MAX_SECONDS,
        },
      });
    }

    // 9.2 upload flow: client notifies completion, backend verifies S3 object and saves DB record
    if (mode === 'finalize_upload') {
      if (!isS3MediaConfigured()) {
        return res.status(503).json({ success: false, error: 'S3 media storage is not configured' });
      }
      const galleryErr = assertCameraCaptureSource(req.body, LOCAL_CONFIG.visual || {});
      if (galleryErr) {
        return res.status(400).json({
          success: false,
          error: galleryErr,
          message: 'Window/prelobby gorselleri yalniz in-app kamera ile dogar',
        });
      }
      const memoryId = req.body.memory_id || crypto.randomUUID();
      const storageKey = String(req.body.storage_key || '');
      const uploadType = String(req.body.upload_type || 'photo');
      if (!storageKey) {
        return res.status(400).json({ success: false, error: 'storage_key is required for finalize_upload' });
      }
      const head = await verifyS3ObjectExists(storageKey);
      let finalKey = storageKey;
      if (uploadType === 'photo') {
        if (!IMAGE_TYPES.has(String(head.contentType || '').toLowerCase())) {
          return res.status(400).json({ success: false, error: 'Anı fotoğrafı formatı JPG/PNG/WebP olmalı' });
        }
        if (!Number.isFinite(head.contentLength) || head.contentLength <= 0 || head.contentLength > MEMORY_PHOTO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Anı fotoğrafı en fazla 15MB olmalı' });
        }
        const original = await getS3ObjectBuffer(storageKey);
        const webp = await sharp(original.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        finalKey = storageKey.replace(/\.[^/.]+$/, '.webp');
        await putS3ObjectBuffer(finalKey, webp, 'image/webp');
        if (finalKey !== storageKey) {
          await deleteS3Object(storageKey);
        }
      } else if (uploadType === 'video') {
        const ctype = String(head.contentType || '').toLowerCase();
        if (!VIDEO_TYPES.has(ctype) && !ctype.startsWith('video/')) {
          return res.status(400).json({ success: false, error: 'Anı videosu MP4/MOV olmalı' });
        }
        if (!Number.isFinite(head.contentLength) || head.contentLength <= 0 || head.contentLength > MEMORY_VIDEO_MAX_BYTES) {
          return res.status(400).json({ success: false, error: 'Anı videosu en fazla 80MB olmalı' });
        }
        const video = await getS3ObjectBuffer(storageKey);
        let durationSeconds = Number(req.body.duration_seconds || 0);
        try {
          const metadata = await parseBuffer(video.buffer, ctype || 'video/mp4', { duration: true });
          const parsed = Number(metadata?.format?.duration || 0);
          if (Number.isFinite(parsed) && parsed > 0) durationSeconds = parsed;
        } catch (_) {
          /* client duration_seconds fallback */
        }
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MEMORY_VIDEO_MAX_SECONDS) {
          return res.status(400).json({
            success: false,
            error: `Anı videosu en fazla ${MEMORY_VIDEO_MAX_SECONDS} sn olmalı`,
          });
        }
      } else {
        return res.status(400).json({ success: false, error: 'upload_type must be photo or video (in-app camera only)' });
      }
      const finalizedContent = sanitizeString(req.body.caption || content || toS3Uri(finalKey));
      const dupError = await assertNoDuplicateArchivedMemory(
        pool,
        user_id,
        ritual_id,
        finalizedContent
      );
      if (dupError) {
        return res.status(403).json({ success: false, error: dupError });
      }
      let expiresAt = null;
      if (memory_type === 'pulse') {
        const expiresDate = new Date();
        expiresDate.setHours(expiresDate.getHours() + 24);
        expiresAt = expiresDate.toISOString();
      }
      const status = req.body.status === 'draft' ? 'draft' : 'published';
      const typeCol = resolveMemoryTypeColumn({
        type: req.body.type || (uploadType === 'video' ? 'media' : 'photo'),
        memory_type,
        content_url: toS3Uri(finalKey),
        upload_type: uploadType,
      });
      const stampLabel = buildStampLabel(ritualRow);
      const result = await pool.query(
        `INSERT INTO memories (id, ritual_id, user_id, content, memory_type, expires_at, content_url, memory_scope, created_in_window, type,
           status, captured_at, published_at, stamp_ritual_id, stamp_geo_lat, stamp_geo_lng, stamp_label, is_retro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::memory_scope_enum, $9, $10::memory_type_enum,
           $11, NOW(), CASE WHEN $11 = 'published' THEN NOW() ELSE NULL END, $2, $12, $13, $14, false)
         RETURNING *`,
        [
          memoryId,
          ritual_id,
          user_id,
          finalizedContent,
          status === 'draft' ? 'ritual' : memory_type,
          status === 'draft' ? null : expiresAt,
          toS3Uri(finalKey),
          resolveMemoryScope({ memory_scope: req.body.memory_scope, memory_type }),
          createdInWindow,
          typeCol,
          status,
          ritualRow.location_lat != null ? Number(ritualRow.location_lat) : null,
          ritualRow.location_lng != null ? Number(ritualRow.location_lng) : null,
          stampLabel,
        ]
      );
      const { onMemoryCreatedForVenue } = await import('../services/venueArchiveHooks.js');
      onMemoryCreatedForVenue({
        memoryId: result.rows[0].id,
        ritualId: ritual_id,
        userId: user_id,
      }).catch(() => {});
      const scopeVal = resolveMemoryScope({ memory_scope: req.body.memory_scope, memory_type });
      if (status === 'published' && (scopeVal === 'pulse' || scopeVal === 'all' || memory_type === 'pulse')) {
        const { scanPublicMedia } = await import('../services/modEngine.js');
        await scanPublicMedia({
          contentUrl: result.rows[0].content_url,
          memoryId: result.rows[0].id,
          audience: resolveMemoryAudience({ memory_scope: scopeVal, memory_type }),
        }).catch(() => {});
      }
      return res.status(201).json({
        success: true,
        data: await presentMemory(result.rows[0]),
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
      error: 'content is required'
      });
    }

    // Calculate expires_at for pulse memories (24 hours)
    let expiresAt = null;
    if (memory_type === 'pulse') {
      const expiresDate = new Date();
      expiresDate.setHours(expiresDate.getHours() + 24);
      expiresAt = expiresDate.toISOString();
    }

    // Extract Spotify playlist ID from URL if provided
    let spotifyPlaylistId = null;
    if (spotify_playlist_url) {
      // Extract playlist ID from Spotify URL
      // Format: https://open.spotify.com/playlist/{id} or spotify:playlist:{id}
      const spotifyMatch = spotify_playlist_url.match(/(?:playlist\/|playlist:)([a-zA-Z0-9]+)/);
      if (spotifyMatch && spotifyMatch[1]) {
        spotifyPlaylistId = spotifyMatch[1];
      }
    }

    // Sanitize content to reduce XSS risk
    const sanitizedContent = sanitizeString(content);

    const dupError = await assertNoDuplicateArchivedMemory(
      pool,
      user_id,
      ritual_id,
      sanitizedContent
    );
    if (dupError) {
      return res.status(403).json({ success: false, error: dupError });
    }

    const memoryScope = resolveMemoryScope({
      memory_scope: req.body.memory_scope,
      memory_type,
      destination: req.body.destination,
      audience: req.body.audience,
    });
    const memoryAudience = resolveMemoryAudience({
      memory_scope: memoryScope,
      audience: req.body.audience,
    });

    // CLOSED profil: CITY yalnız closed_lw_exception=true iken
    if (memoryAudience === 'CITY') {
      const { getAccountPrivacy } = await import('../services/waveBSocial.js');
      const privacy = await getAccountPrivacy(user_id);
      const allowLw = LOCAL_CONFIG.account_privacy?.CLOSED_LW_EXCEPTION !== false;
      if (privacy === 'CLOSED' && !allowLw) {
        return res.status(403).json({
          success: false,
          error: 'Closed profile cannot publish to CITY without LW exception',
          code: 'CLOSED_LW_BLOCKED',
        });
      }
      try {
        const { isRitualUnderMin } = await import('../services/underMinGate.js');
        if (ritual_id && (await isRitualUnderMin(ritual_id))) {
          return res.status(403).json({
            success: false,
            error: 'UNDER_MIN rituals cannot publish to CITY / Local World',
            code: 'UNDER_MIN_LW_BLOCKED',
          });
        }
      } catch (_e) {
        /* ignore */
      }
    }

    const memoryTypeEnum = resolveMemoryTypeColumn({
      type: req.body.type,
      memory_type,
      spotify_playlist_url,
      content_url: req.body.content_url,
    });

    const status = req.body.status === 'draft' ? 'draft' : 'published';
    // §3: Rulo drafts are photo/video only — quote/playlist are instant
    if (status === 'draft' && !['photo', 'media'].includes(memoryTypeEnum)) {
      return res.status(400).json({
        success: false,
        error: 'Only photo/video can be saved to Rulo as draft',
        code: 'DRAFT_MEDIA_ONLY',
      });
    }
    if (String(req.body.type || '').toLowerCase() === 'voice') {
      return res.status(400).json({
        success: false,
        error: 'Voice memory is disabled. Use text-only comments (Söz).',
        code: 'VOICE_MEMORY_DISABLED',
      });
    }

    const stampLabel = buildStampLabel(ritualRow);

    // Insert memory (immutable stamp at birth)
    const result = await pool.query(
      `INSERT INTO memories (
         ritual_id, user_id, content, memory_type, expires_at,
         spotify_playlist_url, spotify_playlist_id, memory_scope, audience, created_in_window, type, destination,
         status, captured_at, published_at, stamp_ritual_id, stamp_geo_lat, stamp_geo_lng, stamp_label, is_retro
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::memory_scope_enum, $9, $10, $11::memory_type_enum,
         CASE WHEN $8::text = 'pulse' THEN 'ritual_and_pulse'::memory_destination_enum
              WHEN $8::text = 'all' THEN 'ritual_and_pulse'::memory_destination_enum
              ELSE 'ritual_only'::memory_destination_enum END,
         $12, NOW(), CASE WHEN $12 = 'published' THEN NOW() ELSE NULL END, $1, $13, $14, $15, false)
       RETURNING *`,
      [
        ritual_id,
        user_id,
        sanitizedContent,
        status === 'draft' ? 'ritual' : memory_type,
        status === 'draft' ? null : expiresAt,
        spotify_playlist_url || null,
        spotifyPlaylistId,
        memoryScope,
        memoryAudience,
        createdInWindow,
        memoryTypeEnum,
        status,
        ritualRow.location_lat != null ? Number(ritualRow.location_lat) : null,
        ritualRow.location_lng != null ? Number(ritualRow.location_lng) : null,
        stampLabel,
      ]
    );

    const newMemory = result.rows[0];
    const userResult = await pool.query(
      'SELECT name, rs_score FROM users WHERE id = $1',
      [user_id]
    );

    const { onMemoryCreatedForVenue } = await import('../services/venueArchiveHooks.js');
    onMemoryCreatedForVenue({
      memoryId: newMemory.id,
      ritualId: ritual_id,
      userId: user_id,
    }).catch(() => {});

    const isPublicPulse = ['pulse', 'all', 'public'].includes(String(memoryScope || '').toLowerCase())
      || String(req.body.destination || '').includes('pulse');
    if (isPublicPulse) {
      const creatorName = userResult.rows[0]?.name;
      const { notifyPublicMemoryFollowers } = await import('../services/notifications.js');
      notifyPublicMemoryFollowers(user_id, {
        memoryId: newMemory.id,
        ritualId: ritual_id,
        creatorName,
      }).catch(() => {});
    }

    const memoryData = await presentMemory({
      id: newMemory.id,
      ritual_id: newMemory.ritual_id,
      user_id: newMemory.user_id,
      user_name: userResult.rows[0].name,
      user_rs_score: parseFloat(userResult.rows[0].rs_score) || 6.0,
      content: newMemory.content,
      memory_type: newMemory.memory_type,
      memory_scope: newMemory.memory_scope,
      status: newMemory.status,
      stamp_label: newMemory.stamp_label,
      captured_at: newMemory.captured_at,
      published_at: newMemory.published_at,
      expires_at: newMemory.expires_at,
      spotify_playlist_url: newMemory.spotify_playlist_url,
      spotify_playlist_id: newMemory.spotify_playlist_id,
      created_at: newMemory.created_at,
      content_url: newMemory.content_url,
    });

    res.status(201).json({
      success: true,
      data: memoryData
    });
  } catch (error) {
    logger.error('Error creating memory', { 
      error: error.message, 
      stack: error.stack,
      ritualId,
      userId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create memory'
    });
  }
});

// PATCH /api/memories/:id - backend-yeni.md contract
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { content, privacy_mode } = req.body;

    const ownerCheck = await pool.query(
      'SELECT id FROM memories WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found or user does not have permission'
      });
    }

    const updates = [];
    const values = [id, userId];
    let idx = 3;
    if (content != null) {
      updates.push(`content = $${idx++}`);
      values.push(sanitizeString(content));
    }
    if (privacy_mode != null) {
      updates.push(`privacy_mode = $${idx++}`);
      values.push(String(privacy_mode));
    }
    // §3: stamp fields are immutable — reject if client tries
    if (
      req.body.stamp_label != null ||
      req.body.stamp_ritual_id != null ||
      req.body.captured_at != null ||
      req.body.stamp_geo_lat != null ||
      req.body.stamp_geo_lng != null
    ) {
      return res.status(400).json({
        success: false,
        error: 'stamp_immutable',
        code: 'STAMP_LOCKED',
      });
    }
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updatable fields provided'
      });
    }
    const result = await pool.query(
      `UPDATE memories
       SET ${updates.join(', ')}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      values
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update memory' });
  }
});

// POST /api/memories/:id/reshare - backend-yeni.md contract
router.post('/:id/reshare', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const memoryResult = await pool.query(
      'SELECT ritual_id, content FROM memories WHERE id = $1 LIMIT 1',
      [id]
    );
    if (memoryResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }

    const source = memoryResult.rows[0];
    const created = await pool.query(
      `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
       VALUES ($1, $2, $3, 'pulse', CURRENT_TIMESTAMP + INTERVAL '24 hour')
       RETURNING *`,
      [source.ritual_id, userId, source.content]
    );
    return res.status(201).json({ success: true, data: created.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reshare memory' });
  }
});

// POST /api/memories/:id/tag - backend-yeni.md contract
router.post('/:id/tag', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tagged_user_id } = req.body;
    if (!tagged_user_id) {
      return res.status(400).json({ success: false, error: 'tagged_user_id is required' });
    }
    const result = await pool.query(
      `INSERT INTO memory_tags (memory_id, tagged_user_id, tagger_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (memory_id, tagged_user_id) DO NOTHING
       RETURNING *`,
      [id, tagged_user_id, req.user.userId]
    );
    return res.status(201).json({
      success: true,
      data: result.rows[0] || { memory_id: id, tagged_user_id, tagger_id: req.user.userId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to tag user' });
  }
});

// DELETE /api/memories/:id/tag/:tagged_user_id - backend-yeni.md contract
router.delete('/:id/tag/:tagged_user_id', authenticateToken, async (req, res) => {
  try {
    const { id, tagged_user_id } = req.params;
    await pool.query(
      'DELETE FROM memory_tags WHERE memory_id = $1 AND tagged_user_id = $2 AND tagger_id = $3',
      [id, tagged_user_id, req.user.userId]
    );
    return res.json({ success: true, message: 'Tag removed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to remove tag' });
  }
});

// DELETE /api/memories/:id/tag/:user_id - backend-yeni.md path alias
router.delete('/:id/tag/:user_id', authenticateToken, async (req, res) => {
  req.params = {
    ...req.params,
    tagged_user_id: req.params.user_id,
  };
  return router.handle(
    { ...req, method: 'DELETE', url: `/${req.params.id}/tag/${req.params.tagged_user_id}` },
    res
  );
});

// GET /api/memories/me/feed - backend-yeni.md contract alias
router.get('/me/feed', authenticateToken, async (req, res) => {
  return router.handle(
    { ...req, method: 'GET', url: '/pulse' },
    res
  );
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;

    // Verify user owns the memory
    const check = await pool.query(
      'SELECT * FROM memories WHERE id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found or user does not have permission'
      });
    }

    // §3 Rulo: drafts never delete / expire
    if (String(check.rows[0].status || '') === 'draft') {
      return res.status(403).json({
        success: false,
        error: 'drafts_cannot_be_deleted',
        code: 'RULO_IMMUTABLE',
      });
    }

    // Delete the memory
    await pool.query(
      'DELETE FROM memories WHERE id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Memory deleted'
    });
  } catch (error) {
    logger.error('Error deleting memory', { 
      error: error.message, 
      stack: error.stack,
      memoryId,
      userId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory'
    });
  }
});

// GET /api/memories/me/rulo — owner drafts (Rulo)
router.get('/me/rulo', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM memories
       WHERE user_id = $1 AND COALESCE(status, 'published') = 'draft'
       ORDER BY COALESCE(captured_at, created_at) DESC`,
      [req.user.userId]
    );
    return res.json({
      success: true,
      data: await presentMemoryList(result.rows),
    });
  } catch (error) {
    console.error('Error fetching rulo', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch rulo' });
  }
});

// POST /api/memories/:id/publish — publish draft (retro if delayed)
router.post('/:id/publish', authenticateToken, async (req, res) => {
  try {
    const { memory_scope, audience } = req.body || {};
    const row = await pool.query(`SELECT * FROM memories WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.userId,
    ]);
    if (!row.rows[0]) return res.status(404).json({ success: false, error: 'Memory not found' });
    const m = row.rows[0];
    const captured = new Date(m.captured_at || m.created_at);
    const freshH = 24;
    const isRetro = Date.now() - captured.getTime() > freshH * 3600 * 1000;
    const scope = resolveMemoryScope({
      memory_scope: memory_scope || m.memory_scope || 'solo',
      audience: audience || m.audience,
    });
    const aud = resolveMemoryAudience({ memory_scope: scope, audience });
    const result = await pool.query(
      `UPDATE memories
       SET status = 'published',
           published_at = NOW(),
           is_retro = $2,
           memory_scope = COALESCE($3::memory_scope_enum, memory_scope),
           audience = COALESCE($4, audience),
           memory_type = CASE WHEN $2 THEN 'ritual' ELSE COALESCE(memory_type, 'ritual') END,
           expires_at = CASE
             WHEN $2 THEN NULL
             WHEN $3 = 'pulse' OR $3 = 'all' THEN NOW() + INTERVAL '24 hours'
             ELSE expires_at
           END
       WHERE id = $1
       RETURNING *`,
      [req.params.id, isRetro, scope, aud]
    );
    // Retro: no notification (v2 §3 / §13)
    // Public scopes → CSAM/nudity taraması; sağlayıcı yoksa ops incelemesi (v2 §5)
    if (!isRetro && (scope === 'pulse' || scope === 'all')) {
      const { scanPublicMedia } = await import('../services/modEngine.js');
      await scanPublicMedia({
        contentUrl: result.rows[0].content_url,
        memoryId: result.rows[0].id,
        audience: aud,
      }).catch(() => {});
    }
    return res.json({
      success: true,
      data: await presentMemory(result.rows[0]),
      retro: isRetro,
      notify: false,
    });
  } catch (error) {
    console.error('Error publishing memory', error);
    return res.status(500).json({ success: false, error: 'Failed to publish memory' });
  }
});

// POST /api/memories/:id/vote — ▲/▼ (her iki sayaç public; ▼ push yok)
router.post('/:id/vote', authenticateToken, async (req, res) => {
  try {
    const vote = Number(req.body.vote);
    if (vote !== 1 && vote !== -1) {
      return res.status(400).json({ success: false, error: 'vote must be 1 or -1' });
    }
    await pool.query(
      `INSERT INTO memory_votes (memory_id, user_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (memory_id, user_id) DO UPDATE SET vote = $3`,
      [req.params.id, req.user.userId, vote]
    );
    const tally = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE vote = 1)::int AS upvotes,
         COUNT(*) FILTER (WHERE vote = -1)::int AS downvotes
       FROM memory_votes WHERE memory_id = $1`,
      [req.params.id]
    );
    await pool.query(
      `UPDATE memories SET upvote_count = $2, downvote_count = $3 WHERE id = $1`,
      [req.params.id, tally.rows[0].upvotes, tally.rows[0].downvotes]
    );

    // ▼ asla push edilmez; ▲ eşikli push
    if (vote === 1) {
      const mem = await pool.query(
        `SELECT user_id, COALESCE(upvote_notify_milestone, 0)::int AS upvote_notify_milestone
         FROM memories WHERE id = $1`,
        [req.params.id]
      ).catch(() => ({ rows: [] }));
      const ownerId = mem.rows[0]?.user_id;
      const currentMilestone = mem.rows[0]?.upvote_notify_milestone || 0;
      if (ownerId && String(ownerId) !== String(req.user.userId)) {
        const { nextUpvoteNotifyMilestone, notifyMemoryUpvoteMilestone } = await import(
          '../services/notifications.js'
        );
        const milestone = nextUpvoteNotifyMilestone(currentMilestone, tally.rows[0].upvotes);
        if (milestone) {
          await pool
            .query(`UPDATE memories SET upvote_notify_milestone = $2 WHERE id = $1`, [
              req.params.id,
              milestone,
            ])
            .catch(() => {});
          notifyMemoryUpvoteMilestone(ownerId, {
            memoryId: req.params.id,
            upvotes: tally.rows[0].upvotes,
            milestone,
          }).catch(() => {});
        }
      }
    }

    return res.json({
      success: true,
      data: {
        upvote_count: tally.rows[0].upvotes,
        downvote_count: tally.rows[0].downvotes,
      },
    });
  } catch (error) {
    console.error('Error voting memory', error);
    return res.status(500).json({ success: false, error: 'Failed to vote' });
  }
});

// POST /api/memories/:id/echo — Yankı (24h Pulse surface; passport-pure; count permanent)
router.post('/:id/echo', authenticateToken, async (req, res) => {
  try {
    const mem = await pool.query(
      `SELECT id, user_id, ritual_id, audience, memory_scope
       FROM memories WHERE id = $1`,
      [req.params.id]
    );
    if (!mem.rows[0]) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }
    const source = mem.rows[0];
    const { toAudience } = await import('../services/waveBSocial.js');
    const audience = toAudience(source.audience || source.memory_scope);
    const echoGuard = LOCAL_CONFIG.memory_audience?.ECHO_CANNOT_RAISE !== false;

    const ins = await pool.query(
      `INSERT INTO memory_echoes (memory_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (memory_id, user_id) DO NOTHING
       RETURNING id`,
      [req.params.id, req.user.userId]
    );
    const c = await pool.query(
      `SELECT COUNT(*)::int AS n FROM memory_echoes WHERE memory_id = $1`,
      [req.params.id]
    );
    await pool.query(`UPDATE memories SET echo_count = $2 WHERE id = $1`, [
      req.params.id,
      c.rows[0].n,
    ]);

    // §15 / sonMD: echo asla kapsam yükseltmez
    // WINDOW → Pulse/LW'ye düşmez · CIRCLE → Your Pulse OK, CITY/LW'ye sızmaz · CITY → Pulse OK
    if (ins.rows[0]) {
      const allowPulseSurface =
        !echoGuard || audience === 'CIRCLE' || audience === 'CITY';
      if (allowPulseSurface && source.ritual_id) {
        const ttl = LOCAL_CONFIG.pulse?.FRESH_HOURS ?? LOCAL_CONFIG.content?.PULSE_TTL_HOURS ?? 24;
        await pool
          .query(
            `INSERT INTO pulse_reposts (source_ritual_id, user_id, memory_id, expires_at)
             VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval)
             ON CONFLICT DO NOTHING`,
            [source.ritual_id, req.user.userId, source.id, String(ttl)]
          )
          .catch(() => {});
      }
    }

    if (source.user_id && String(source.user_id) !== String(req.user.userId)) {
      const { notifyMemoryEcho } = await import('../services/notifications.js');
      if (typeof notifyMemoryEcho === 'function') {
        notifyMemoryEcho(source.user_id, {
          memoryId: req.params.id,
          fromUserId: req.user.userId,
        }).catch(() => {});
      }
    }
    return res.json({
      success: true,
      data: {
        echo_count: c.rows[0].n,
        audience,
        echo_raised: false,
        pulse_surface: echoGuard ? audience !== 'WINDOW' : true,
      },
    });
  } catch (error) {
    console.error('Error echoing memory', error);
    return res.status(500).json({ success: false, error: 'Failed to echo' });
  }
});

// POST /api/memories/:id/soz — text-only comment (Söz)
router.post('/:id/soz', authenticateToken, async (req, res) => {
  try {
    const body = String(req.body.body || req.body.text || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'body required (text only)' });
    if (req.body.media_url || req.body.image_url || req.body.gif_url) {
      return res.status(400).json({ success: false, error: 'Söz is text-only' });
    }
    const ins = await pool.query(
      `INSERT INTO memory_comments (memory_id, user_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.userId, body]
    );
    await pool.query(
      `UPDATE memories SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = $1`,
      [req.params.id]
    );
    try {
      const mem = await pool.query(`SELECT ritual_id FROM memories WHERE id = $1`, [req.params.id]);
      const { resolveMentionTargets, persistMentions } = await import('../services/mentionService.js');
      const resolved = await resolveMentionTargets({
        text: body,
        actorId: req.user.userId,
        ritualId: mem.rows[0]?.ritual_id || null,
      });
      await persistMentions({
        sourceType: 'memory_soz',
        sourceId: ins.rows[0].id,
        ritualId: mem.rows[0]?.ritual_id || null,
        actorId: req.user.userId,
        mentions: (resolved.mentions || []).slice(0, LOCAL_CONFIG.mention?.MAX_PER_MESSAGE ?? 5),
      });
    } catch (_e) {
      /* non-fatal */
    }
    const owner = await pool.query(`SELECT user_id FROM memories WHERE id = $1`, [req.params.id]);
    if (owner.rows[0]?.user_id && String(owner.rows[0].user_id) !== String(req.user.userId)) {
      const { notifyMemorySoz } = await import('../services/notifications.js');
      if (typeof notifyMemorySoz === 'function') {
        notifyMemorySoz(owner.rows[0].user_id, {
          memoryId: req.params.id,
          fromUserId: req.user.userId,
        }).catch(() => {});
      }
    }
    return res.json({ success: true, data: ins.rows[0] });
  } catch (error) {
    console.error('Error adding soz', error);
    return res.status(500).json({ success: false, error: 'Failed to add soz' });
  }
});

// Background job: Clean up expired pulse memories
// This should be run periodically (e.g., via cron)
export async function cleanupExpiredMemories() {
  try {
    const result = await pool.query(
      `DELETE FROM memories 
       WHERE memory_type = 'pulse' 
         AND COALESCE(status, 'published') <> 'draft'
         AND expires_at IS NOT NULL 
         AND expires_at < CURRENT_TIMESTAMP`
    );
    logger.info('Cleaned up expired pulse memories', { count: result.rowCount });
    return result.rowCount;
  } catch (error) {
    logger.error('Error cleaning up expired memories', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

export default router;
