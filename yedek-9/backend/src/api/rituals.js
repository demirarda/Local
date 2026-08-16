import express from 'express';
import pool from '../config/database.js';
import { emitRitualUpdate, emitPulseUpdate } from '../websocket/ritualHandlers.js';
import { notifyRitualLive, notifyFriendJoinedRitual, notifyJoinConfirmed, notifyRitualCancelled, notifyExactDetailsUnlocked } from '../services/notifications.js';
import { getRitualEnergyState } from '../services/rsEngine.js';
import { calculateDiversityMultiplier } from '../services/antiGaming.js';
import logger from '../utils/logger.js';
import { authenticateToken } from './auth.js';
import { requireIdentityVerified } from '../middleware/identityGate.js';
import cityRhythmRouter from './cityRhythm.js';
import feedbackRouter from './feedback.js';
import { enqueue } from '../services/queueSystem.js';
import { sendError } from '../utils/errorResponse.js';
import {
  processCheckIn,
  revealCheckinKeyword,
  getCheckinWindowInfo,
} from '../services/checkinService.js';
import { getRsPublicFlags, resolveRsForViewer } from '../services/rsVisibility.js';
import LOCAL_CONFIG, {
  getGpsRadiusMeters,
  isWithinJoinGrace,
  freeCancelThresholdMinutes,
  defaultLiveWindowHours,
} from '../config/localConfig.js';
import {
  hasBlockedPeerOnRitual,
} from '../services/blockVisibility.js';
import {
  RITUAL_STATUS,
  normalizeRitualStatus,
  isLive,
  isWindow,
  isJoinable,
  getLifecyclePhase,
  getWindowEndDate,
  isExactDetailsUnlocked,
  computePrelobbyGrace,
  assertCanJoinRitualConstraints,
  assertCanHostCommit,
  DISCOVERABLE_STATUS_SQL,
  CREATED_STATUS_SQL,
  ritualVisibilitySql,
  ritualDiscoveryAudienceSql,
} from '../services/ritualState.js';
import {
  validateRitualCreateParams,
  getVenueMaxTableSeats,
  validateCheckInRadius,
  resolveRitualGpsAnchor,
  parseRitualFee,
  normalizeRitualAudience,
  feeDtoFromRow,
  assertStartHorizon,
  assertSelfRezDailyCap,
  isScheduledLocationType,
  normalizeRouteId,
  assertScheduledOneShot,
} from '../services/ritualCreateValidation.js';
import { maybeRecordRepeatPinLead } from '../services/venueLeadService.js';
import { computeRitualPulse } from '../services/pulseService.js';
import { displayCode } from '../services/checkinCodeService.js';
import { getHighlightedBadgesForUser } from '../services/badgeEngine.js';
import { attachVenueSlotToRitual } from '../services/venueSlotService.js';
import { transitionLiveToWindow } from '../services/ritualCompletion.js';
import { getFeedbackWindowInfo } from '../services/feedbackWindow.js';
import {
  assertCanHostRitual,
  assertCanJoinRitual,
  claimReplacementSlot,
  getOpenReplacementSlots,
  processAttendanceCancel,
} from '../services/penaltyService.js';
import {
  decodePulseCursor,
  encodePulseCursor,
  sortPulseCandidates,
  applyCursorWindow,
  mixPulseItems,
  scoreMemoryCandidate,
  scoreRitualCandidate,
  getPulseMemoryRatio,
} from '../services/pulseFeedRanking.js';

// Lifecycle statuses — son-part.md §2
// RITUAL_STATUS imported from ritualState.js

const ENTRY_TYPE = {
  OPEN: 'open',
  REQUEST: 'request',
  REFERENCE: 'reference',
};

const TIME_STATE = {
  STARTING_SOON: 'starting_soon',
  LIVE_NOW: 'live_now',
  REOPENED: 'reopened',
  ALMOST_FULL: 'almost_full',
};

// v2 §7 time-type naming compatibility:
// UI/public contract uses INSTANT / PLANNED / SERIES,
// DB enum remains instant / fixed / recurring for backward compatibility.
function normalizeRequestedTimeType(rawTimeType, recurringFlag = false) {
  const t = String(rawTimeType || '').toLowerCase().trim();
  if (t === 'instant') return 'instant';
  if (t === 'planned' || t === 'fixed') return 'fixed';
  if (t === 'series' || t === 'recurring') return 'recurring';
  return recurringFlag ? 'recurring' : 'fixed';
}

const router = express.Router();
const pulseFeedCache = new Map();

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Calculate time state for a ritual
function getTimeState(ritual, currentTime) {
  const startTime = new Date(ritual.start_time);
  const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
  const minutesUntilStart = (startTime - currentTime) / 60000;
  const currentAttendees = ritual.current_attendees || 0;
  const capacity = ritual.capacity;

  if (isLive(ritual.status) || normalizeRitualStatus(ritual.status) === RITUAL_STATUS.LIVE) {
    return TIME_STATE.LIVE_NOW;
  }
  if (minutesUntilStart >= 0 && minutesUntilStart <= 90) {
    return TIME_STATE.STARTING_SOON;
  }
  if (capacity - currentAttendees <= 3 && capacity - currentAttendees > 0) {
    return TIME_STATE.ALMOST_FULL;
  }
  if (isWindow(ritual.status) && (currentTime - endTime) / 60000 <= 60) {
    return TIME_STATE.REOPENED;
  }
  return null;
}

// Helper: Calculate ranking score for a ritual (RS + Diversity + Social Proximity)
async function calculateRitualRankingScore(ritual, viewerId, signals) {
  let score = 0.0;
  
  // Base score from time state (urgency)
  const timeStateWeight = {
    [TIME_STATE.LIVE_NOW]: 1.0,
    [TIME_STATE.STARTING_SOON]: 0.8,
    [TIME_STATE.REOPENED]: 0.6,
    [TIME_STATE.ALMOST_FULL]: 0.7,
  };
  score += (timeStateWeight[signals.timeState] || 0.5) * 0.2; // 20% weight
  
  // Verified host/venue boost (high weight)
  if (signals.isHostVerified) {
    score += 0.25; // 25% boost
  }
  if (signals.isVenueVerified) {
    score += 0.20; // 20% boost
  }
  
  // Social proximity: friends here (masked count)
  if (signals.friendsHere > 0) {
    const friendBoost = Math.min(0.15, signals.friendsHere * 0.05); // Max 15% for 3+ friends
    score += friendBoost;
  }
  // Social proximity: friend is hosting
  if (signals.isFriendHosting) {
    score += 0.12;
  }
  // Social proximity: followed host is hosting
  if (signals.isFollowedHostHosting) {
    score += 0.10;
  }
  // Social proximity: followed venue is active
  if (signals.isFollowedVenueActive) {
    score += 0.08;
  }
  
  // RS fit (if viewer has RS score, match with ritual context)
  if (viewerId) {
    try {
      const viewerQuery = await pool.query(
        'SELECT rs_score FROM users WHERE id = $1',
        [viewerId]
      );
      if (viewerQuery.rows.length > 0) {
        const viewerRS = parseFloat(viewerQuery.rows[0].rs_score) || 6.0;
        // Higher RS users get slight boost for verified rituals
        if (signals.isHostVerified || signals.isVenueVerified) {
          const rsFit = (viewerRS - 5.0) / 5.0; // Normalize to -1 to 1, then scale
          score += rsFit * 0.05; // Small boost for high RS users
        }
      }
    } catch (error) {
      // Ignore RS lookup errors
    }
  }
  
  // Diversity penalty (if viewer has low diversity, slightly penalize)
  if (viewerId) {
    try {
      const diversityMultiplier = await calculateDiversityMultiplier(viewerId, ritual.id);
      // Lower diversity = lower multiplier, so we add a small penalty
      const diversityPenalty = (1.0 - diversityMultiplier) * 0.05; // Max 5% penalty
      score -= diversityPenalty;
    } catch (error) {
      // Ignore diversity calculation errors
    }
  }
  
  // Capacity utilization (more full = slightly higher score)
  const capacityUtil = signals.currentAttendees / Math.max(1, signals.capacity);
  score += capacityUtil * 0.05; // Max 5% boost

  // Shared interests: boost if ritual type matches viewer interests
  if (viewerId && ritual.type) {
    try {
      const ir = await pool.query(
        'SELECT 1 FROM user_interests WHERE user_id = $1 AND category = $2 LIMIT 1',
        [viewerId, ritual.type]
      );
      if (ir.rows.length > 0) score += 0.08;
    } catch (e) { /* ignore */ }
  }

  return Math.max(0.0, Math.min(1.0, score)); // Clamp to 0-1
}

/**
 * Pulse kartlarında görsel için URL (rituals.image_url kolonu yok; tip + id ile deterministik).
 * Picsum, React Native Image ile sorunsuz çalışır.
 */
function pulseCoverImageUrl(ritual) {
  const rawId = String(ritual.id || 'pulse');
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'pulse';
  const t = (ritual.type || '').toLowerCase();
  if (ritual.type === 'Special Event' || t.includes('special')) {
    return `https://picsum.photos/seed/${id}-special/900/600`;
  }
  if (t.includes('music')) return `https://picsum.photos/seed/${id}-music/900/600`;
  if (t.includes('art')) return `https://picsum.photos/seed/${id}-arts/900/600`;
  if (t.includes('food')) return `https://picsum.photos/seed/${id}-food/900/600`;
  if (t.includes('wellness') || t.includes('sport')) return `https://picsum.photos/seed/${id}-well/900/600`;
  return `https://picsum.photos/seed/${id}-locale/900/600`;
}

// GET /api/rituals/feed - Unified, cursor-based Pulse feed
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user?.userId || req.query.viewer_id || null;
    const city = req.query.city || null;
    const limit = Math.min(60, Math.max(8, parseInt(req.query.limit || '24', 10)));
    const cursorObj = decodePulseCursor(req.query.cursor);
    const cacheKey = `${viewerId || 'anon'}|${city || 'all'}|${req.query.cursor || ''}|${limit}`;
    const cached = pulseFeedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ success: true, data: cached.data, cached: true });
    }

    const [memoryRes, ritualRes] = await Promise.all([
      pool.query(
        `SELECT
           m.id,
           m.user_id,
           m.ritual_id,
           m.content,
           m.content_text,
           m.content_url,
           m.spotify_playlist_url,
           m.created_at,
           m.type,
           u.name AS user_name,
           u.city,
           EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'accepted'
               AND (
                 (f.user_id = $1 AND f.friend_id = m.user_id) OR
                 (f.friend_id = $1 AND f.user_id = m.user_id)
               )
           ) AS is_friend_source,
           EXISTS (
             SELECT 1 FROM follows fo
             WHERE fo.follower_id = $1
               AND fo.following_id = m.user_id
           ) AS is_followed_source
         FROM memories m
         JOIN users u ON u.id = m.user_id
         JOIN rituals r ON r.id = m.ritual_id
         WHERE m.memory_type = 'pulse'
           AND (m.expires_at IS NULL OR m.expires_at > CURRENT_TIMESTAMP)
           AND r.suspended_at IS NULL
           AND ($2::text IS NULL OR LOWER(u.city) = LOWER($2::text))
         ORDER BY m.created_at DESC
         LIMIT 240`,
        [viewerId, city]
      ),
      pool.query(
        `SELECT
           r.id,
           r.title,
           r.type,
           r.location_name,
           r.start_time,
           r.status,
           r.capacity,
           r.entry_type,
           r.created_at,
           r.event_group_id,
           u.id AS host_id,
           u.name AS host_name,
           u.city AS host_city,
           COALESCE(att.cnt, 0) AS current_attendees,
           COALESCE(fh.cnt, 0) AS friends_here,
           EXISTS (SELECT 1 FROM host_verifications hv WHERE hv.user_id = r.host_id AND hv.status = 'active') AS is_host_verified,
           EXISTS (
             SELECT 1 FROM venue_verifications vv
             WHERE vv.venue_name = r.location_name
               AND vv.city = u.city
               AND vv.status = 'active'
           ) AS is_venue_verified
         FROM rituals r
         JOIN users u ON u.id = r.host_id
         LEFT JOIN (
           SELECT ritual_id, COUNT(*)::int AS cnt
           FROM ritual_attendance
           WHERE status != 'no_show'
           GROUP BY ritual_id
         ) att ON att.ritual_id = r.id
         LEFT JOIN (
           SELECT ra.ritual_id, COUNT(DISTINCT ra.user_id)::int AS cnt
           FROM ritual_attendance ra
           JOIN friendships f
             ON f.status = 'accepted'
            AND (
              (f.user_id = $1 AND f.friend_id = ra.user_id) OR
              (f.friend_id = $1 AND f.user_id = ra.user_id)
            )
           WHERE ra.status != 'no_show'
           GROUP BY ra.ritual_id
         ) fh ON fh.ritual_id = r.id
         WHERE r.suspended_at IS NULL
           AND r.status::text IN ('prelobby', 'active', 'live', 'window', 'ended')
           AND ($2::text IS NULL OR LOWER(u.city) = LOWER($2::text))
           AND ${ritualDiscoveryAudienceSql('$1', 'r')}
         ORDER BY r.start_time DESC
         LIMIT 180`,
        [viewerId, city]
      ),
    ]);

    const memoryCandidates = memoryRes.rows.map((m) => {
      const ranking = scoreMemoryCandidate(m, { city });
      return {
        kind: 'memory',
        id: m.id,
        cursor_id: `m:${m.id}`,
        created_at: m.created_at,
        ranking_score: ranking,
        payload: m,
      };
    });

    const now = Date.now();
    const ritualCandidates = ritualRes.rows.map((r) => {
      let timeState = 'starting_soon';
      const start = new Date(r.start_time).getTime();
      if (r.status === 'live' || (start <= now && start + 90 * 60000 >= now)) {
        timeState = 'live_now';
      } else if (r.status === 'window' || r.status === 'ended') {
        timeState = 'reopened';
      } else if (Number(r.capacity || 0) - Number(r.current_attendees || 0) <= 3) {
        timeState = 'almost_full';
      }
      const item = { ...r, time_state: timeState };
      const ranking = scoreRitualCandidate(item, { city });
      return {
        kind: 'ritual',
        id: r.id,
        cursor_id: `r:${r.id}`,
        created_at: r.created_at || r.start_time,
        ranking_score: ranking,
        payload: item,
      };
    });

    const sorted = sortPulseCandidates([...memoryCandidates, ...ritualCandidates]);
    const windowed = applyCursorWindow(sorted, cursorObj);
    const mixed = mixPulseItems(windowed, limit, getPulseMemoryRatio());

    const ritualBuckets = {
      live_now: [],
      starting_soon: [],
      almost_full: [],
      reopened: [],
    };
    const pulseMemories = [];
    const ritualPool = {
      live_now: [],
      starting_soon: [],
      almost_full: [],
      reopened: [],
    };
    for (const row of windowed.filter((x) => x.kind === 'ritual').slice(0, 160)) {
      const key = row.payload.time_state || 'starting_soon';
      if (!ritualPool[key]) ritualPool[key] = [];
      ritualPool[key].push({
        ...row.payload,
        venue_name: row.payload.location_name,
        host: { id: row.payload.host_id, name: row.payload.host_name },
        image_url: pulseCoverImageUrl(row.payload),
      });
    }
    for (const row of mixed) {
      if (row.kind === 'memory') {
        pulseMemories.push(row.payload);
      } else {
        const key = row.payload.time_state || 'starting_soon';
        if (!ritualBuckets[key]) ritualBuckets[key] = [];
        ritualBuckets[key].push({
          ...row.payload,
          venue_name: row.payload.location_name,
          host: { id: row.payload.host_id, name: row.payload.host_name },
          image_url: pulseCoverImageUrl(row.payload),
        });
      }
    }

    const nextCursor = mixed.length > 0 ? encodePulseCursor(mixed[mixed.length - 1]) : null;
    const hasMore = windowed.length > mixed.length;

    // v2 §11 ZONE-EVENT: fold event_group members into umbrella cards (same as /pulse)
    try {
      const { foldRitualsWithUmbrellas } = await import('../services/eventGroupService.js');
      for (const key of Object.keys(ritualBuckets)) {
        ritualBuckets[key] = await foldRitualsWithUmbrellas(ritualBuckets[key]);
      }
      for (const key of Object.keys(ritualPool)) {
        ritualPool[key] = await foldRitualsWithUmbrellas(ritualPool[key]);
      }
    } catch (_e) {
      // best effort; fallback to plain ritual rows
    }

    const data = {
      items: mixed.map((m) => ({ kind: m.kind, id: m.id })),
      rituals: ritualBuckets,
      ritual_pool: ritualPool,
      memories: pulseMemories,
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore,
    };
    pulseFeedCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + 30000,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching unified pulse feed', { error: error?.message, stack: error?.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pulse feed',
      data: { items: [], rituals: { live_now: [], starting_soon: [], almost_full: [], reopened: [] }, memories: [], next_cursor: null, has_more: false },
    });
  }
});

// GET /api/rituals/pulse - Get rituals for Pulse screen (with basic ranking + social proximity)
router.get('/pulse', authenticateToken, async (req, res) => {
  try {
    const { city, lat, lng, radius = 5000, viewer_id } = req.query; // radius in meters
    const currentTime = new Date();
    const viewerId = req.user?.userId || viewer_id;

    // 1) Basit Ritual listesi (aggregation yok, sadece filtreler); include venue when venue_id set
    let query = `
      SELECT 
        r.id, r.title, r.type, r.location_name, r.start_time, r.duration,
        r.capacity, r.entry_type, r.location_lat, r.location_lng,
        r.min_rs,
        r.host_id, r.status, r.created_at, r.updated_at, r.venue_id, r.event_group_id,
        r.visibility, r.definition_level, r.time_type,
        r.fee_amount, r.fee_currency, r.fee_note, r.audience,
        u.name as host_name,
        u.city as host_city,
        u.university as host_university,
        u.rs_score as host_rs_score,
        v.name as venue_name_from_venue,
        v.city as venue_city,
        v.takeover_until as venue_takeover_until,
        v.featured_event_card as venue_featured_event,
        (
          SELECT vs.audience_tag FROM venue_slots vs
          WHERE vs.ritual_id = r.id OR (vs.venue_id = r.venue_id AND vs.status::text IN ('open','claimed')
            AND vs.starts_at IS NOT NULL
            AND ABS(EXTRACT(EPOCH FROM (vs.starts_at - r.start_time))) < 3600)
          ORDER BY CASE WHEN vs.ritual_id = r.id THEN 0 ELSE 1 END
          LIMIT 1
        ) AS audience_tag
      FROM rituals r
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN venues v ON r.venue_id = v.id
      WHERE r.status::text IN ('prelobby', 'active', 'live', 'window', 'ended') AND (r.suspended_at IS NULL)
    `;

    const params = [];
    let paramIndex = 1;

    if (viewerId) {
      query += ` AND ${ritualVisibilitySql(`$${paramIndex}`, 'r')}`;
      params.push(viewerId);
      paramIndex++;
      query += ` AND ${ritualDiscoveryAudienceSql(`$${paramIndex}`, 'r')}`;
      params.push(viewerId);
      paramIndex++;
    } else {
      query += ` AND COALESCE(r.visibility::text, 'public') = 'public'`;
      query += ` AND ${ritualDiscoveryAudienceSql(null, 'r')}`;
    }

    // Optional city filter (legacy name) OR active_city scope (§12.5)
    if (city) {
      query += ` AND u.city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    } else if (viewerId) {
      try {
        const { resolveActiveCityId, ritualCityFilterSql } = await import('../services/cityScope.js');
        const activeCityId = await resolveActiveCityId(viewerId);
        const scope = ritualCityFilterSql(activeCityId, paramIndex, 'r');
        if (scope.sql) {
          query += scope.sql;
          params.push(...scope.params);
          paramIndex += scope.params.length;
        }
      } catch (_e) {
        /* city_id kolon yoksa sessiz geç */
      }
    }

    // Optional location filter
    if (lat && lng) {
      query += ` AND (
        6371000 * acos(
          cos(radians($${paramIndex})) * 
          cos(radians(r.location_lat)) * 
          cos(radians(r.location_lng) - radians($${paramIndex + 1})) + 
          sin(radians($${paramIndex})) * 
          sin(radians(r.location_lat))
        ) <= $${paramIndex + 2}
      )`;
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
      paramIndex += 3;
    }

    query += `
      ORDER BY r.start_time ASC
      LIMIT 100
    `;

    const result = await pool.query(query, params);
    const rsPublicFlags = await getRsPublicFlags(result.rows.map((r) => r.host_id));

    const grouped = {
      [TIME_STATE.LIVE_NOW]: [],
      [TIME_STATE.STARTING_SOON]: [],
      [TIME_STATE.ALMOST_FULL]: [],
      [TIME_STATE.REOPENED]: []
    };

    let viewerUniversity = null;
    let viewerRS = null;
    if (viewer_id) {
      const viewerResult = await pool.query(
        `SELECT university, rs_score FROM users WHERE id = $1 LIMIT 1`,
        [viewer_id]
      );
      viewerUniversity = viewerResult.rows[0]?.university || null;
      viewerRS = viewerResult.rows[0]?.rs_score != null ? parseFloat(viewerResult.rows[0].rs_score) : null;
    }

    // 2) Her Ritual için attendance ve friend count gibi sinyalleri ayrı sorgu ile hesapla
    for (const ritual of result.rows) {
      // Attendance
      const attendanceResult = await pool.query(
        `SELECT COUNT(*) as count, MAX(created_at) as last_join_at
         FROM ritual_attendance 
         WHERE ritual_id = $1 AND status != 'no_show'`,
        [ritual.id]
      );
      const currentAttendees = parseInt(attendanceResult.rows[0].count) || 0;
      const lastJoinAt = attendanceResult.rows[0].last_join_at || null;

      // Friend count (masked proximity)
      let friendsHere = 0;
      let isFriendHosting = false;
      let isFollowedHostHosting = false;
      let isFollowedVenueActive = false;
      let mutualFriendsCount = 0;
      let isSameUniversity = false;
      let viewerIsAttending = false;
      let hostLateCancelCount = 0;
      let distanceMeters = null;
      
      if (viewer_id) {
        // Friends here
        const friendsResult = await pool.query(
          `SELECT COUNT(DISTINCT ra.user_id) AS count
           FROM ritual_attendance ra
           JOIN friendships f
             ON f.status = 'accepted'
            AND (
              (f.user_id = $1 AND f.friend_id = ra.user_id) OR
              (f.friend_id = $1 AND f.user_id = ra.user_id)
            )
           WHERE ra.ritual_id = $2
             AND ra.status != 'no_show'`,
          [viewer_id, ritual.id]
        );
        friendsHere = parseInt(friendsResult.rows[0].count) || 0;

        // Check if host is a friend
        const friendHostResult = await pool.query(
          `SELECT 1 FROM friendships
           WHERE status = 'accepted'
             AND (
               (user_id = $1 AND friend_id = $2) OR
               (friend_id = $1 AND user_id = $2)
             )
           LIMIT 1`,
          [viewer_id, ritual.host_id]
        );
        isFriendHosting = friendHostResult.rows.length > 0;

        // Check if host is followed
        const followedHostResult = await pool.query(
          `SELECT 1 FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = $2
           LIMIT 1`,
          [viewer_id, ritual.host_id]
        );
        isFollowedHostHosting = followedHostResult.rows.length > 0;

        // Check if venue is followed (venue_follows table)
        if (ritual.venue_id) {
          const venueFollowResult = await pool.query(
            `SELECT 1 FROM venue_follows
             WHERE user_id = $1 AND venue_id = $2
             LIMIT 1`,
            [viewer_id, ritual.venue_id]
          );
          isFollowedVenueActive = venueFollowResult.rows.length > 0;
        }

        const mutualFriendsResult = await pool.query(
          `SELECT COUNT(DISTINCT af.friend_id) AS count
           FROM friendships af
           JOIN friendships hf
             ON hf.status = 'accepted'
            AND hf.user_id = $2
            AND hf.friend_id = af.friend_id
           WHERE af.status = 'accepted'
             AND af.user_id = $1`,
          [viewer_id, ritual.host_id]
        );
        mutualFriendsCount = parseInt(mutualFriendsResult.rows[0]?.count, 10) || 0;

        const attendingResult = await pool.query(
          `SELECT 1
           FROM ritual_attendance
           WHERE ritual_id = $1
             AND user_id = $2
             AND status NOT IN ('no_show', 'cancelled')
           LIMIT 1`,
          [ritual.id, viewer_id]
        );
        viewerIsAttending = attendingResult.rows.length > 0;

        const hostBypassResult = await pool.query(
          `SELECT late_cancel_count
           FROM user_rs_bypass_state
           WHERE user_id = $1
           LIMIT 1`,
          [ritual.host_id]
        );
        hostLateCancelCount = parseInt(hostBypassResult.rows[0]?.late_cancel_count, 10) || 0;
      }

      isSameUniversity =
        !!viewerUniversity &&
        !!ritual.host_university &&
        String(viewerUniversity).trim().toLowerCase() ===
          String(ritual.host_university).trim().toLowerCase();

      if (lat && lng && ritual.location_lat != null && ritual.location_lng != null) {
        const lat1 = parseFloat(lat);
        const lon1 = parseFloat(lng);
        const lat2 = parseFloat(ritual.location_lat);
        const lon2 = parseFloat(ritual.location_lng);
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceMeters = Math.round(6371000 * c);
      }

      // Host verification (simple EXISTS)
      const hostVerifiedResult = await pool.query(
        `SELECT verification_type FROM host_verifications 
         WHERE user_id = $1 
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [ritual.host_id]
      );
      const isHostVerified = hostVerifiedResult.rows.length > 0;
      const isPivotHost = hostVerifiedResult.rows[0]?.verification_type === 'premium';

      const recurringResult = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM rituals r2
         WHERE r2.host_id = $1
           AND LOWER(COALESCE(r2.title, '')) = LOWER(COALESCE($2, ''))
           AND LOWER(COALESCE(r2.location_name, '')) = LOWER(COALESCE($3, ''))`,
        [ritual.host_id, ritual.title, ritual.location_name]
      );
      const isRecurring = (recurringResult.rows[0]?.count || 0) > 1;

      // Enerji durumu (Q2 tabanlı)
      const energy = await getRitualEnergyState(ritual.id);

      // Time-state hesapla (JS tarafında)
      const startTime = new Date(ritual.start_time);
      const endTime = new Date(startTime.getTime() + ritual.duration * 60000);
      const minutesUntilStart = (startTime - currentTime) / 60000;
      const minutesSinceEnd = (currentTime - endTime) / 60000;
      const capacity = ritual.capacity;

      let timeState = null;
      const isSpecialEvent = ritual.type === 'Special Event';
      
      if (ritual.status === 'live' || (startTime <= currentTime && endTime >= currentTime)) {
        timeState = TIME_STATE.LIVE_NOW;
      } else if ((ritual.status === 'window' || ritual.status === 'ended') && minutesSinceEnd >= 0 && minutesSinceEnd <= 60) {
        // Reopened: ended within last 60 minutes
        timeState = TIME_STATE.REOPENED;
      } else if (minutesUntilStart >= 0 && minutesUntilStart <= 90) {
        timeState = TIME_STATE.STARTING_SOON;
      } else if (capacity - currentAttendees <= 3 && capacity - currentAttendees > 0) {
        timeState = TIME_STATE.ALMOST_FULL;
      }
      
      // Special events: Always show if starting within 24 hours, even without time_state
      if (isSpecialEvent && !timeState && minutesUntilStart >= 0 && minutesUntilStart <= 1440) {
        timeState = TIME_STATE.STARTING_SOON; // Use starting_soon as default for special events
      }

      if (!timeState) {
        continue;
      }

      // Venue verification check (use venue city when venue_id set)
      const venueNameForVerification = ritual.venue_name_from_venue || ritual.location_name;
      const venueCityForVerification = ritual.venue_city || ritual.host_city || '';
      const venueVerifiedResult = await pool.query(
        `SELECT 1 FROM venue_verifications 
         WHERE venue_name = $1 
           AND city = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [venueNameForVerification, venueCityForVerification]
      );
      const isVenueVerified = venueVerifiedResult.rows.length > 0;

      // Calculate ranking score
      const rankingScore = await calculateRitualRankingScore(ritual, viewer_id, {
        timeState,
        isHostVerified,
        isVenueVerified,
        friendsHere,
        isFriendHosting,
        isFollowedHostHosting,
        isFollowedVenueActive,
        currentAttendees,
        capacity: ritual.capacity,
      });
      const minRs = ritual.min_rs != null ? Number(ritual.min_rs) : null;
      const rsLocked = minRs != null && viewerRS != null && viewerRS < minRs;
      const specialOccasion =
        /\b(birthday|dogum gunu|anniversary|yildonumu|kutlama|celebration|mezuniyet|graduation)\b/i
          .test(String(ritual.title || ''));
      const sameNeighborhood = distanceMeters != null ? distanceMeters <= 1500 : false;
      const localTakeover =
        ritual.venue_takeover_until && new Date(ritual.venue_takeover_until).getTime() > Date.now();
      const audienceTag = ritual.audience_tag || null;
      let audienceMatch = null;
      if (audienceTag === 'UNI_FRIENDLY' && viewerUniversity) {
        audienceMatch = true;
      } else if (audienceTag === 'INTERNATIONAL') {
        // Keşif işareti — join kısıtı değil; intl hedefe soft match
        audienceMatch = !viewerUniversity || String(viewerUniversity).toLowerCase().includes('intl');
      }

      // Takeover keşif: ranking'e ek skor (ticari brand_slot kullanıcı sıralamasına GİRMEZ)
      let adjustedScore = rankingScore;
      if (localTakeover) adjustedScore += 25;
      if (audienceMatch) adjustedScore += 8;

      grouped[timeState].push({
        id: ritual.id,
        title: ritual.title,
        type: ritual.type,
        spark_born: !!ritual.spark_born,
        venue_id: ritual.venue_id || null,
        venue_name: ritual.venue_name_from_venue || ritual.location_name,
        location_name: ritual.venue_name_from_venue || ritual.location_name,
        image_url: pulseCoverImageUrl(ritual),
        venue_image_url: pulseCoverImageUrl(ritual),
        start_time: ritual.start_time,
        duration: ritual.duration,
        capacity: ritual.capacity,
        min_rs: minRs,
        viewer_rs_score: viewerRS,
        rs_locked: rsLocked,
        current_attendees: currentAttendees,
        occupancy_ratio: ritual.capacity > 0 ? currentAttendees / ritual.capacity : 0,
        entry_type: ritual.entry_type,
        location: {
          lat: parseFloat(ritual.location_lat),
          lng: parseFloat(ritual.location_lng),
        },
        host: {
          id: ritual.host_id,
          name: ritual.host_name,
        },
        time_state: timeState,
        status: ritual.status,
        is_host_verified: isHostVerified,
        is_venue_verified: isVenueVerified,
        friends_here: friendsHere,
        is_friend_hosting: isFriendHosting,
        is_followed_host_hosting: isFollowedHostHosting,
        is_followed_venue_active: isFollowedVenueActive,
        same_university: isSameUniversity,
        same_neighborhood: sameNeighborhood,
        mutual_friends_count: mutualFriendsCount,
        is_recurring: isRecurring,
        is_pivot_host: isPivotHost,
        is_free_entry: String(ritual.entry_type || '').toLowerCase() === 'open',
        fee: feeDtoFromRow(ritual),
        has_fee: ritual.fee_amount != null,
        audience: String(ritual.audience || 'PUBLIC').toUpperCase(),
        viewer_is_attending: viewerIsAttending,
        host_late_cancel_count: hostLateCancelCount,
        special_occasion: specialOccasion,
        host_rs_score: resolveRsForViewer(
          viewerId,
          ritual.host_id,
          ritual.host_rs_score != null ? Number(ritual.host_rs_score) : null,
          rsPublicFlags
        ).rs_score,
        distance_meters: distanceMeters,
        energy_state: energy.state,
        last_join_at: lastJoinAt,
        ranking_score: adjustedScore,
        is_special_event: ritual.type === 'Special Event' || false,
        local_takeover: Boolean(localTakeover),
        audience_tag: audienceTag,
        audience_match: audienceMatch,
        audience_label:
          audienceTag === 'UNI_FRIENDLY'
            ? '🎓 Uni'
            : audienceTag === 'INTERNATIONAL'
              ? '🌍 Intl'
              : null,
        featured_event:
          ritual.venue_featured_event &&
          (!ritual.venue_featured_event.ritual_id ||
            String(ritual.venue_featured_event.ritual_id) === String(ritual.id))
            ? ritual.venue_featured_event
            : null,
      });
    }

    // Sort each group by ranking score (descending)
    for (const key in grouped) {
      grouped[key].sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0));
      // Remove ranking_score from response (internal only)
      grouped[key] = grouped[key].map(({ ranking_score, ...rest }) => rest);
    }

    // v2 §11 ZONE-EVENT: same event_group_id rituals collapse into one umbrella card.
    try {
      const { foldRitualsWithUmbrellas } = await import('../services/eventGroupService.js');
      for (const key of Object.keys(grouped)) {
        grouped[key] = await foldRitualsWithUmbrellas(grouped[key]);
      }
    } catch (_e) {
      // best effort; fallback to plain ritual rows
    }

    return res.json({
      success: true,
      data: grouped,
      timestamp: currentTime.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching pulse rituals:', error);
    // Hata olsa bile client tarafında 500 yerine boş data dön
    return res.json({
      success: false,
      data: {
        [TIME_STATE.LIVE_NOW]: [],
        [TIME_STATE.STARTING_SOON]: [],
        [TIME_STATE.ALMOST_FULL]: [],
        [TIME_STATE.REOPENED]: [],
      },
      error: error && (error.message || String(error)),
    });
  }
});

// GET /api/rituals - backend-yeni.md contract alias
router.get('/', authenticateToken, async (req, res) => {
  return router.handle(
    { ...req, method: 'GET', url: '/pulse' },
    res
  );
});

// GET /api/rituals/map - backend-yeni.md contract (map pins view)
router.get('/map', authenticateToken, async (req, res) => {
  try {
    const { city, lat, lng, radius = 5000 } = req.query;
    const viewerId = req.user?.userId;
    const queryParts = [
      `SELECT r.id, r.title, r.type, r.location_name, r.location_lat, r.location_lng, r.start_time, r.status, r.visibility`,
      `FROM rituals r`,
      `LEFT JOIN users u ON r.host_id = u.id`,
      `WHERE r.status::text IN ('prelobby', 'active', 'live', 'window', 'ended') AND r.suspended_at IS NULL`,
    ];
    const params = [];
    let idx = 1;

    if (viewerId) {
      queryParts.push(`AND ${ritualVisibilitySql(`$${idx}`, 'r')}`);
      params.push(viewerId);
      idx += 1;
      queryParts.push(`AND ${ritualDiscoveryAudienceSql(`$${idx}`, 'r')}`);
      params.push(viewerId);
      idx += 1;
    } else {
      queryParts.push(`AND COALESCE(r.visibility::text, 'public') = 'public'`);
      queryParts.push(`AND ${ritualDiscoveryAudienceSql(null, 'r')}`);
    }

    if (city) {
      queryParts.push(`AND u.city = $${idx}`);
      params.push(city);
      idx += 1;
    }
    if (lat && lng) {
      queryParts.push(`AND (
        6371000 * acos(
          cos(radians($${idx})) *
          cos(radians(r.location_lat)) *
          cos(radians(r.location_lng) - radians($${idx + 1})) +
          sin(radians($${idx})) *
          sin(radians(r.location_lat))
        ) <= $${idx + 2}
      )`);
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    }

    queryParts.push('ORDER BY r.start_time ASC LIMIT 300');
    const result = await pool.query(queryParts.join('\n'), params);

    return res.json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        venue_name: row.location_name,
        location_name: row.location_name,
        start_time: row.start_time,
        status: row.status,
        location: {
          lat: row.location_lat != null ? parseFloat(row.location_lat) : null,
          lng: row.location_lng != null ? parseFloat(row.location_lng) : null,
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ritual map pins',
    });
  }
});

// GET /api/rituals/venue-activity - Aggregated venue activity for Pulse
router.get('/venue-activity', async (req, res) => {
  try {
    const { city, viewer_id, limit = 5 } = req.query;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const params = [todayStart, todayEnd];
    let idx = 3;

    let query = `
      SELECT
        r.venue_id,
        r.location_name,
        u.city as host_city,
        COUNT(*) as ritual_count,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', r.id,
            'title', r.title,
            'start_time', r.start_time
          ) ORDER BY r.start_time ASC
        ) as rituals
      FROM rituals r
      JOIN users u ON r.host_id = u.id
      WHERE r.status::text IN ('prelobby', 'active', 'live')
        AND (r.suspended_at IS NULL)
        AND r.start_time BETWEEN $1 AND $2
    `;

    if (city) {
      query += ` AND (u.city = $${idx} OR EXISTS (SELECT 1 FROM venues v WHERE v.id = r.venue_id AND v.city = $${idx}))`;
      params.push(city);
      idx++;
    }

    query += `
      GROUP BY r.venue_id, r.location_name, u.city
      ORDER BY MIN(r.start_time) ASC
      LIMIT $${idx}
    `;
    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);

    const venues = [];
    for (const row of result.rows) {
      const verification = await pool.query(
        `SELECT 1 FROM venue_verifications
         WHERE venue_name = $1
           AND city = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [row.location_name, row.host_city]
      );

      venues.push({
        id: row.venue_id || `${row.location_name}-${row.host_city}`,
        venue_id: row.venue_id || null,
        name: row.location_name,
        venue_name: row.location_name,
        city: row.host_city,
        is_verified: verification.rows.length > 0,
        upcoming_rituals: row.rituals || [],
      });
    }

    res.json({
      success: true,
      data: venues,
      viewer_id: viewer_id || null,
    });
  } catch (error) {
    logger.error('Error fetching venue activity', { 
      error: error.message, 
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch venue activity',
    });
  }
});

// GET /api/rituals/city-rhythm - backend-yeni.md contract alias
router.get('/city-rhythm', authenticateToken, async (req, res) => {
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  return cityRhythmRouter.handle(
    { ...req, method: 'GET', url: `/browse${query}` },
    res
  );
});

// GET /api/rituals/:id/public — outer layer preview (no auth, son-part.md §2.2)
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         r.id, r.title, r.type, r.description, r.start_time, r.duration, r.end_time,
         r.capacity, r.entry_type, r.status, r.location_type, r.location_name,
         r.window_type, r.live_window_hours, r.definition_level, r.visibility,
         r.mood_tags, r.min_rs, r.is_recurring, r.time_type, r.category_id,
         r.fee_amount, r.fee_currency, r.fee_note, r.audience,
         COALESCE(r.window_visibility::text, 'CLOSED') AS window_visibility,
         r.brand_id,
         u.id as host_id, u.name as host_name, u.city as host_city,
         u.avatar_url as host_avatar_url, u.rs_score as host_rs_score,
         v.name as venue_name_from_venue, v.city as venue_city,
         (SELECT COUNT(*) FROM ritual_attendance ra
          WHERE ra.ritual_id = r.id AND ra.status != 'no_show') as current_attendees
       FROM rituals r
       LEFT JOIN users u ON r.host_id = u.id
       LEFT JOIN venues v ON r.venue_id = v.id
       WHERE r.id = $1 AND r.suspended_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }

    const ritual = result.rows[0];
    const viewerId = req.query.viewer_id || null;
    const rsFlags = await getRsPublicFlags([ritual.host_id]);
    const hostRsResolved = resolveRsForViewer(
      viewerId,
      ritual.host_id,
      ritual.host_rs_score != null ? parseFloat(ritual.host_rs_score) : null,
      rsFlags
    );
    const currentTime = new Date();
    const lifecyclePhase = getLifecyclePhase(ritual, currentTime);
    const timeState = getTimeState(ritual, currentTime);

    const participantsResult = await pool.query(
      `SELECT u.id, u.name, u.avatar_url
       FROM ritual_attendance ra
       JOIN users u ON ra.user_id = u.id
       WHERE ra.ritual_id = $1 AND ra.status != 'no_show'
       ORDER BY ra.created_at ASC
       LIMIT 12`,
      [id]
    );

    // v2 §2 outer layer: public preview never renders participant list
    void participantsResult;

    const replacementSlots = await getOpenReplacementSlots(id);

    const locationName = ritual.venue_name_from_venue || ritual.location_name;
    const city = ritual.venue_city || ritual.host_city || '';
    const typeLabel = ritual.location_type || 'custom';
    const pulse = await computeRitualPulse(id, ritual);

    res.json({
      success: true,
      data: {
        id: ritual.id,
        title: ritual.title,
        type: ritual.type,
        description: ritual.description || null,
        start_time: ritual.start_time,
        duration: ritual.duration,
        capacity: ritual.capacity,
        current_attendees: parseInt(ritual.current_attendees, 10) || 0,
        entry_type: ritual.entry_type,
        location_type: typeLabel,
        location_name: locationName,
        location_summary: city ? `${typeLabel} · ${locationName}, ${city}` : `${typeLabel} · ${locationName}`,
        host: {
          id: ritual.host_id,
          name: ritual.host_name,
          city: ritual.host_city,
          avatar_url: ritual.host_avatar_url,
          rs_score: hostRsResolved.rs_score,
          rs_visible: hostRsResolved.rs_visible,
        },
        participants: [],
        participant_list_visible: false,
        window_visibility: String(ritual.window_visibility || 'CLOSED').toUpperCase(),
        brand_id: ritual.brand_id || null,
        pulse,
        occupancy_ratio: pulse.occupancy_ratio,
        checkin_ratio: pulse.checkin_ratio,
        memory_tempo: pulse.memory_tempo,
        rq_average: pulse.rq_average,
        lifecycle_phase: lifecyclePhase,
        status: ritual.status,
        time_state: timeState,
        min_rs: ritual.min_rs,
        mood_tags: ritual.mood_tags,
        visibility: ritual.visibility,
        fee: feeDtoFromRow(ritual),
        has_fee: ritual.fee_amount != null,
        audience: String(ritual.audience || 'PUBLIC').toUpperCase(),
        time_type: ritual.time_type,
        window_type: ritual.window_type || 'ephemeral',
        is_public_preview: true,
        replacement_slots: replacementSlots.map((s) => ({
          id: s.id,
          vacated_by_user_id: s.vacated_by_user_id,
          expires_at: s.expires_at,
          created_at: s.created_at,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching public ritual preview', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ success: false, error: 'Failed to fetch ritual preview' });
  }
});

// GET /api/rituals/:id - Get ritual details
router.get('/:id', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    logger.debug('Fetching ritual detail', { ritualId: id });

    // Optimized: Single query to get ritual with host info, venue (when linked), and attendee count
    const query = `
      SELECT 
        r.*,
        u.name as host_name,
        u.city as host_city,
        u.rs_score as host_rs_score,
        u.avatar_url as host_avatar_url,
        u.university as host_university,
        u.identity_track as host_identity_track,
        u.uni_label_visible as host_uni_label_visible,
        u.hosted_count_visible as host_hosted_count_visible,
        v.id as venue_id_joined,
        v.name as venue_name_from_venue,
        v.city as venue_city,
        rs.name as series_name,
        rs.week_count as series_week_count,
        rs.recurrence_rule as series_recurrence_rule,
        rs.active as series_active,
        (SELECT COUNT(*) FROM ritual_attendance ra 
         WHERE ra.ritual_id = r.id AND ra.status != 'no_show') as current_attendees,
        (SELECT COUNT(*) FROM rituals hr
         WHERE hr.host_id = r.host_id
           AND hr.status::text IN ('archived', 'ended', 'completed', 'window')
           AND hr.collapsed_at IS NULL) as host_hosted_count
      FROM rituals r
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN venues v ON r.venue_id = v.id
      LEFT JOIN ritual_series rs ON rs.id = r.series_id
      WHERE r.id = $1 AND (r.suspended_at IS NULL)
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ritual not found'
      });
    }

    const ritual = result.rows[0];
    const currentTime = new Date();
    const timeState = getTimeState(ritual, currentTime);
    const viewerId = req.query.viewer_id || req.user?.userId || null;
    const isHostViewer = String(req.user.userId) === String(ritual.host_id);
    const viewerAttendanceResult = await pool.query(
      `SELECT checkin_at, ais_score, status, created_at AS joined_at,
              prelobby_grace_ends_at, exact_details_unlocked_at, join_count,
              checkin_phase, witness_required, witness_count, checkin_attempt_at
       FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );
    const viewerAttendance = viewerAttendanceResult.rows[0] || null;
    const viewerCheckedIn = !!viewerAttendance?.checkin_at;
    const viewerSealed =
      viewerCheckedIn &&
      (viewerAttendance?.checkin_phase === 'sealed' || !viewerAttendance?.checkin_phase);
    const tableOpen = Boolean(ritual.checkin_keyword);
    const canViewCheckinKeyword = tableOpen && viewerSealed;
    const keywordRevealed = tableOpen;
    const checkinWindow = getCheckinWindowInfo(ritual, currentTime);

    // Run all additional queries in parallel for better performance
    const [
      participantsResult,
      hostVerificationCheck,
      venueVerificationCheck,
      lastMemoryResult,
      socialSignalsResult,
      replacementSlots,
      pulse,
    ] = await Promise.all([
      // Get participants
      pool.query(`
        SELECT 
          u.id,
          u.name,
          u.rs_score,
          ra.status,
          ra.checkin_at,
          ra.checkin_phase,
          ra.witness_required,
          ra.witness_count,
          ra.checkin_attempt_at,
          ra.created_at as joined_at,
          CASE WHEN r.host_id = u.id THEN true ELSE false END as is_host,
          CASE WHEN r.first_sealed_by = u.id THEN true ELSE false END as is_opener,
          CASE WHEN fr.id IS NOT NULL THEN true ELSE false END as is_friend,
          COALESCE(fr.friendship_level::text, 'stranger') as friend_level,
          COALESCE(fr.fb_count, 0) as fb_count
        FROM ritual_attendance ra
        JOIN users u ON ra.user_id = u.id
        JOIN rituals r ON ra.ritual_id = r.id
        LEFT JOIN friendships fr
          ON fr.status = 'accepted'
         AND (
           (fr.requester_id = $2 AND fr.receiver_id = u.id)
           OR (fr.receiver_id = $2 AND fr.requester_id = u.id)
         )
        WHERE ra.ritual_id = $1
          AND ra.status != 'no_show'
        ORDER BY ra.created_at ASC
      `, [id, req.user.userId]),
      
      // Check host verification
      pool.query(
        `SELECT 1 FROM host_verifications 
         WHERE user_id = $1 
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [ritual.host_id]
      ),
      
      // Check venue verification (use venue city when venue_id set)
      pool.query(
        `SELECT 1 FROM venue_verifications 
         WHERE venue_name = $1 
           AND city = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [ritual.venue_name_from_venue || ritual.location_name, ritual.venue_city || ritual.host_city || '']
      ),
      
      // Get last memory from this ritual (for "Memory from Last Time")
      pool.query(
        `SELECT 
          m.id,
          m.content,
          m.created_at,
          m.user_id,
          u.name as user_name
         FROM memories m
         JOIN users u ON m.user_id = u.id
         WHERE m.ritual_id = $1
           AND m.memory_type = 'ritual'
         ORDER BY m.created_at DESC
         LIMIT 1`,
        [id]
      ),
      
      // Get social signals (friends interested)
      viewerId ? pool.query(
        `SELECT 
          COUNT(DISTINCT CASE 
            WHEN f.status = 'accepted'
             AND (
              (f.user_id = $1 AND f.friend_id = ra.user_id) OR
              (f.friend_id = $1 AND f.user_id = ra.user_id) OR
              (f.requester_id = $1 AND f.receiver_id = ra.user_id) OR
              (f.receiver_id = $1 AND f.requester_id = ra.user_id)
            ) THEN ra.user_id
          END) as friends_interested,
          COUNT(DISTINCT ra.user_id) as total_interested
         FROM ritual_attendance ra
         LEFT JOIN friendships f ON (
           f.status = 'accepted' AND (
             (f.user_id = $1 AND f.friend_id = ra.user_id) OR
             (f.friend_id = $1 AND f.user_id = ra.user_id) OR
             (f.requester_id = $1 AND f.receiver_id = ra.user_id) OR
             (f.receiver_id = $1 AND f.requester_id = ra.user_id)
           )
         )
         WHERE ra.ritual_id = $2
           AND ra.status != 'no_show'`,
        [viewerId, id]
      ) : Promise.resolve({ rows: [{ friends_interested: 0, total_interested: 0 }] }),

      getOpenReplacementSlots(id),
      computeRitualPulse(id, ritual),
    ]);

    const participants = participantsResult.rows.map(p => ({
      id: p.id,
      user_id: p.id,
      name: p.name,
      rs_score: parseFloat(p.rs_score) || 6.0,
      is_host: p.is_host,
      is_opener: Boolean(p.is_opener),
      status: p.status,
      checkin_at: p.checkin_at,
      checkin_phase: p.checkin_phase || null,
      witness_required: p.witness_required != null ? Number(p.witness_required) : null,
      witness_count: p.witness_count != null ? Number(p.witness_count) : 0,
      checkin_attempt_at: p.checkin_attempt_at || null,
      pending_witness: p.checkin_phase === 'pending_witness',
      joined_at: p.joined_at // For "joined X min ago" display
    }));

    const rsPublicFlags = await getRsPublicFlags([
      ritual.host_id,
      ...participants.map((p) => p.id),
    ]);
    const hostRsResolved = resolveRsForViewer(
      viewerId,
      ritual.host_id,
      parseFloat(ritual.host_rs_score) || 6.0,
      rsPublicFlags
    );
    const maskedParticipants = participants.map((p) => {
      const resolved = resolveRsForViewer(viewerId, p.id, p.rs_score, rsPublicFlags);
      return { ...p, rs_score: resolved.rs_score, rs_visible: resolved.rs_visible };
    });

    const isHostVerified = hostVerificationCheck.rows.length > 0;
    const isVenueVerified = venueVerificationCheck.rows.length > 0;
    
    // Get last memory
    const lastMemory = lastMemoryResult.rows.length > 0 ? {
      id: lastMemoryResult.rows[0].id,
      content: lastMemoryResult.rows[0].content,
      created_at: lastMemoryResult.rows[0].created_at,
      user_id: lastMemoryResult.rows[0].user_id,
      user_name: lastMemoryResult.rows[0].user_name,
    } : null;
    
    // Get social signals
    const socialSignals = socialSignalsResult.rows[0] || { friends_interested: 0, total_interested: 0 };
    const friendsInterestedCount = parseInt(socialSignals.friends_interested, 10) || 0;
    const viewerJoined = !!viewerAttendance;
    // v2 §2 outer layer: participant list only after join (or host)
    const outerLayer = !viewerJoined && !isHostViewer;
    const windowVisibility = String(ritual.window_visibility || 'CLOSED').toUpperCase();
    // CLOSED: window akışı yalnız katılımcılara; TRANSPARENT: detayda şehre okunur
    const canReadWindowFlow =
      !outerLayer || windowVisibility === 'TRANSPARENT';
    const lastMemoryForViewer = canReadWindowFlow ? lastMemory : null;

    let seriesStrip = null;
    if (ritual.series_id) {
      const archiveLinks = await pool.query(
        `SELECT id, title, series_week, start_time, status
         FROM rituals
         WHERE series_id = $1
           AND id != $2
           AND status::text IN ('archived', 'ended', 'completed', 'window')
         ORDER BY start_time DESC
         LIMIT 12`,
        [ritual.series_id, id]
      );
      seriesStrip = {
        series_id: ritual.series_id,
        series_name: ritual.series_name || null,
        week: ritual.series_week || ritual.series_week_count || null,
        week_count: ritual.series_week_count || ritual.series_week || null,
        card_label: null,
        archive_links: archiveLinks.rows.map((row) => ({
          id: row.id,
          title: row.title,
          series_week: row.series_week,
          start_time: row.start_time,
          status: row.status,
        })),
      };
      try {
        const {
          formatSeriesCardLabel,
          getSeriesFollowState,
          normalizeRecurrenceRule,
          SERIES_CADENCES,
        } = await import('../services/seriesService.js');
        seriesStrip.card_label = formatSeriesCardLabel(
          ritual.series_name || ritual.title,
          seriesStrip.week
        );
        const rule = normalizeRecurrenceRule(ritual.series_recurrence_rule);
        seriesStrip.cadence = rule.cadence;
        seriesStrip.cadence_label = SERIES_CADENCES[rule.cadence].label;
        seriesStrip.end_after_weeks = rule.end_after_weeks;
        seriesStrip.open_ended = rule.end_after_weeks == null;
        seriesStrip.active = ritual.series_active !== false;
        if (viewerId) {
          seriesStrip.follow = await getSeriesFollowState(ritual.series_id, viewerId);
        }
        seriesStrip.is_host = String(ritual.host_id) === String(viewerId);
      } catch (_e) {
        seriesStrip.card_label = ritual.series_name || ritual.title;
      }
    }

    let hostHighlightedBadges = [];
    try {
      hostHighlightedBadges = await getHighlightedBadgesForUser(ritual.host_id);
    } catch (_e) {
      hostHighlightedBadges = [];
    }

    const showUniLabel =
      ritual.host_identity_track === 'university' &&
      ritual.host_uni_label_visible !== false &&
      !!ritual.host_university;
    const showHostedCount = ritual.host_hosted_count_visible === true;

    const timeTypeRaw = String(ritual.time_type || '').toLowerCase();
    let typeBadge = 'Planlı';
    try {
      const { timeTypeBadgeTr } = await import('../services/seriesService.js');
      typeBadge =
        timeTypeBadgeTr(timeTypeRaw, {
          seriesId: ritual.series_id,
          sparkBorn: !!ritual.spark_born,
        }) || 'Planlı';
    } catch (_e) {
      typeBadge =
        timeTypeRaw === 'instant'
          ? 'Anlık'
          : ritual.series_id || timeTypeRaw === 'recurring'
            ? 'Seri'
            : 'Planlı';
    }

    const lockMomentAt = new Date(
      new Date(ritual.start_time).getTime() -
        freeCancelThresholdMinutes(ritual) * 60000
    );

    const duration = Date.now() - startTime;
    console.log(`[RitualDetail] Completed in ${duration}ms for ritual ${id}`);

    const coverUrl = pulseCoverImageUrl(ritual);
    const exactUnlocked =
      isHostViewer || isExactDetailsUnlocked(viewerAttendance, currentTime);
    const lifecyclePhase = getLifecyclePhase(ritual, currentTime);
    const windowEndsAt = getWindowEndDate(ritual);
    const feedbackWindow = getFeedbackWindowInfo(ritual, currentTime);

    let chipBreakdown = { hidden: true, breakdown: [], person_score: null };
    try {
      const { getPublicRitualChipBreakdown } = await import('../services/chipService.js');
      chipBreakdown = await getPublicRitualChipBreakdown(id);
    } catch (_e) {
      /* best effort */
    }

    res.json({
      success: true,
      data: {
        id: ritual.id,
        title: ritual.title,
        type: ritual.type,
        time_type: ritual.time_type || null,
        type_badge: typeBadge,
        spark_born: !!ritual.spark_born,
        zone_id: ritual.zone_id || null,
        event_group_id: ritual.event_group_id || null,
        chip_breakdown: chipBreakdown,
        description: ritual.description || null,
        /** Pulse listesi ile aynı deterministik kapak; mobil `image_url` / `venue_image_url` ile eşleşir */
        image_url: coverUrl,
        venue_image_url: coverUrl,
        photo_url: coverUrl,
        venue_id: ritual.venue_id_joined || ritual.venue_id || null,
        venue_name: ritual.venue_name_from_venue || ritual.location_name,
        location_name: ritual.venue_name_from_venue || ritual.location_name,
        location_type: ritual.location_type || 'custom',
        location_lat: exactUnlocked ? ritual.location_lat : null,
        location_lng: exactUnlocked ? ritual.location_lng : null,
        location_address: exactUnlocked ? ritual.location_address : null,
        check_in_radius: ritual.check_in_radius || null,
        find_note: exactUnlocked ? ritual.find_note || null : null,
        open_note: exactUnlocked ? ritual.open_note || null : null,
        exact_details_unlocked: exactUnlocked,
        prelobby_grace_ends_at: viewerAttendance?.prelobby_grace_ends_at || null,
        viewer_prelobby: viewerAttendance
          ? {
              grace_ends_at: viewerAttendance.prelobby_grace_ends_at,
              exact_details_unlocked_at: viewerAttendance.exact_details_unlocked_at,
              exact_details_unlocked: exactUnlocked,
              join_count: Number(viewerAttendance.join_count) || 1,
            }
          : null,
        start_time: ritual.start_time,
        duration: ritual.duration,
        capacity: ritual.capacity,
        current_attendees: parseInt(ritual.current_attendees) || 0,
        entry_type: ritual.entry_type,
        location: null,
        host: {
          id: ritual.host_id,
          name: ritual.host_name,
          city: ritual.host_city,
          is_verified: isHostVerified,
          // P2H skor ASLA render edilmez — host bloğunda p2h yok
          rs_score: hostRsResolved.rs_score,
          rs_visible: hostRsResolved.rs_visible,
          avatar_url: ritual.host_avatar_url || null,
          image_url: ritual.host_avatar_url || null,
          uni_label: showUniLabel ? ritual.host_university : null,
          show_uni_label: showUniLabel,
          hosted_count: showHostedCount ? Number(ritual.host_hosted_count) || 0 : null,
          hosted_count_visible: showHostedCount,
          highlight_badges: hostHighlightedBadges,
        },
        host_id: ritual.host_id,
        is_host_verified: isHostVerified,
        is_venue_verified: isVenueVerified,
        participants: outerLayer ? [] : maskedParticipants,
        participant_list_visible: !outerLayer,
        window_visibility: String(ritual.window_visibility || 'CLOSED').toUpperCase(),
        brand_id: ritual.brand_id || null,
        brand_signature: ritual.brand_id
          ? { brand_id: ritual.brand_id, affects_ranking: false }
          : null,
        friend_joining: friendsInterestedCount > 0,
        friend_joining_count: friendsInterestedCount,
        time_state: timeState,
        status: ritual.status,
        lifecycle_phase: lifecyclePhase,
        lock_moment_at: lockMomentAt.toISOString(),
        cancel_free_threshold_pct: cancelFreePct,
        window_type: ritual.window_type || 'ephemeral',
        forum_surface: ritual.forum_surface || 'memories_only',
        forum_enabled: String(ritual.window_type || '') === 'open_forum',
        repost_count: Number(ritual.repost_count) || 0,
        reposted_at: ritual.reposted_at || null,
        window_ends_at: windowEndsAt.toISOString(),
        feedback_window: feedbackWindow,
        replacement_slots: replacementSlots.map((s) => ({
          id: s.id,
          vacated_by_user_id: s.vacated_by_user_id,
          expires_at: s.expires_at,
          created_at: s.created_at,
        })),
        collapsed_at: ritual.collapsed_at || null,
        collapse_reason: ritual.collapse_reason || null,
        created_at: ritual.created_at,
        live_window_hours: ritual.live_window_hours,
        min_rs: ritual.min_rs,
        mood_tags: ritual.mood_tags,
        checkin_keyword: canViewCheckinKeyword ? ritual.checkin_keyword : null,
        code_display: canViewCheckinKeyword ? displayCode(ritual.checkin_keyword, 'tr') : null,
        code_display_en: canViewCheckinKeyword ? displayCode(ritual.checkin_keyword, 'en') : null,
        keyword_revealed: !!keywordRevealed,
        can_reveal_keyword: false,
        checkin_window: checkinWindow,
        fee: feeDtoFromRow(ritual),
        has_fee: ritual.fee_amount != null,
        audience: String(ritual.audience || 'PUBLIC').toUpperCase(),
        visibility: ritual.visibility || 'public',
        pulse,
        occupancy_ratio: pulse?.occupancy_ratio ?? null,
        checkin_ratio: pulse?.checkin_ratio ?? null,
        memory_tempo: pulse?.memory_tempo ?? null,
        rq_average: pulse?.rq_average ?? null,
        series: seriesStrip,
        viewer_checkin: viewerAttendance
          ? {
              checked_in: viewerCheckedIn,
              ais_score: viewerAttendance.ais_score != null
                ? Number(viewerAttendance.ais_score)
                : null,
              status: viewerAttendance.status,
              joined_at: viewerAttendance.joined_at,
              in_join_grace: isWithinJoinGrace(
                { joined_at: viewerAttendance.joined_at },
                currentTime
              ),
              join_grace_minutes: LOCAL_CONFIG.ritual.GRACE_MINUTES,
            }
          : null,
        last_memory: lastMemoryForViewer,
        social_signals: {
          friends_interested: friendsInterestedCount,
          total_interested: parseInt(socialSignals.total_interested, 10) || 0,
          friend_joining: friendsInterestedCount > 0,
        },
      }
    });
  } catch (error) {
    logger.error('Error fetching ritual', { 
      error: error.message, 
      stack: error.stack,
      ritualId: id 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ritual'
    });
  }
});

// PATCH /api/rituals/:id - backend-yeni.md contract (host only)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const {
      title,
      type,
      venue_name,
      location_name,
      start_time,
      duration,
      capacity,
      entry_type,
      location_lat,
      location_lng,
      live_window_hours,
      min_rs,
      min_rs_threshold,
      mood_tags,
      related_hobbies,
      checkin_keyword,
      check_in_keyword,
    } = req.body;

    const ritualCheck = await pool.query(
      'SELECT id, host_id FROM rituals WHERE id = $1',
      [id]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    if (ritualCheck.rows[0].host_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only host can edit ritual' });
    }

    const locName = location_name ?? venue_name;
    const tags = mood_tags ?? related_hobbies;
    // §14 — min-RS kullanıcı Ritualsinde yok
    const { rejectUserRitualMinRs, normalizeUniversityGate } = await import(
      '../services/ritualAudienceGate.js'
    );
    const minRsReject = rejectUserRitualMinRs(req.body);
    if (!minRsReject.ok) {
      return res.status(400).json({ success: false, error: minRsReject.error });
    }
    const universityGate =
      req.body.university_gate !== undefined
        ? normalizeUniversityGate(req.body.university_gate)
        : undefined;
    const requiredBadgeSlug =
      req.body.required_badge_slug !== undefined
        ? req.body.required_badge_slug
          ? String(req.body.required_badge_slug).trim().slice(0, 64)
          : null
        : undefined;
    const rawKw = checkin_keyword ?? check_in_keyword;
    // v2 §2: no custom/fixed codes via PATCH
    if (rawKw != null && String(rawKw).trim() !== '') {
      return res.status(400).json({
        success: false,
        error: 'Custom check-in codes are not allowed; system generates code at start',
      });
    }

    const existing = await pool.query(
      `SELECT location_type, venue_id, location_lat, location_lng FROM rituals WHERE id = $1`,
      [id]
    );
    const current = existing.rows[0] || {};
    const locType = String(current.location_type || 'custom').toLowerCase();
    // sonMD §2: PİN DEĞİŞMEZDİR 🔒 — host yalnız iptal veya radius-içi not
    if (location_lat != null || location_lng != null) {
      return res.status(400).json({
        success: false,
        error: 'Pin is immutable — cancel ritual or update find/open note instead',
        code: 'PIN_IMMUTABLE',
        location_type: locType,
      });
    }
    const nextLat = null;
    const nextLng = null;

    const result = await pool.query(
      `UPDATE rituals
       SET
         title = COALESCE($2, title),
         type = COALESCE($3, type),
         location_name = COALESCE($4, location_name),
         start_time = COALESCE($5, start_time),
         duration = COALESCE($6, duration),
         end_time = CASE
           WHEN $5 IS NOT NULL AND $6 IS NOT NULL THEN $5::timestamptz + ($6::integer * interval '1 minute')
           ELSE end_time
         END,
         capacity = COALESCE($7, capacity),
         entry_type = COALESCE($8::text::ritual_entry_type, entry_type),
         location_lat = COALESCE($9, location_lat),
         location_lng = COALESCE($10, location_lng),
         live_window_hours = COALESCE($11, live_window_hours),
         min_rs = NULL,
         mood_tags = COALESCE($12, mood_tags),
         university_gate = COALESCE($13, university_gate),
         required_badge_slug = COALESCE($14, required_badge_slug),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        title ?? null,
        type ?? null,
        locName != null ? String(locName).trim() : null,
        start_time ? new Date(start_time) : null,
        duration != null ? parseInt(duration, 10) : null,
        capacity != null ? parseInt(capacity, 10) : null,
        entry_type ?? null,
        nextLat,
        nextLng,
        live_window_hours != null ? Number(live_window_hours) : null,
        Array.isArray(tags) ? tags : null,
        universityGate !== undefined ? universityGate : null,
        requiredBadgeSlug !== undefined ? requiredBadgeSlug : null,
      ]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update ritual' });
  }
});

// DELETE /api/rituals/:id - host cancel (weather_cancel + birth_cancel destekli)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const reason = String(req.body?.reason || req.query?.reason || 'host_cancel');
    const categoryLabel = req.body?.category || req.query?.category || null;

    // §2D birth_cancel — Instant ≤10dk · seal==1 · hard-delete
    if (reason === 'birth_cancel') {
      const { birthCancelAsHost } = await import('../services/birthCancelService.js');
      const birth = await birthCancelAsHost({ ritualId: id, hostId: userId });
      if (!birth.ok) {
        return res.status(birth.status || 400).json({
          success: false,
          error: birth.error,
          code: birth.code,
          detail: birth.detail,
        });
      }
      return res.json({
        success: true,
        mode: birth.mode,
        penalty_free: true,
        cancel_reason: 'birth_cancel',
      });
    }

    // Auto-try birth path when eligible (host cancel within window)
    try {
      const { evaluateBirthCancel, birthCancelAsHost } = await import('../services/birthCancelService.js');
      const gate = await evaluateBirthCancel(id, userId);
      if (gate.eligible && reason === 'host_cancel') {
        const birth = await birthCancelAsHost({ ritualId: id, hostId: userId });
        if (birth.ok) {
          return res.json({
            success: true,
            mode: birth.mode,
            penalty_free: true,
            cancel_reason: 'birth_cancel',
          });
        }
      }
    } catch (_e) {
      /* fall through to soft cancel */
    }

    const { cancelRitualAsHost } = await import('../services/waveBSocial.js');
    const { notifyRitualCancelled } = await import('../services/notifications.js');

    const cancelled = await cancelRitualAsHost({
      ritualId: id,
      hostId: userId,
      reason,
      categoryLabel,
    });
    if (!cancelled.ok) {
      return res.status(cancelled.status || 400).json({
        success: false,
        error: cancelled.error,
        code: cancelled.code,
        detail: cancelled.detail,
      });
    }

    const participants = await pool.query(
      `SELECT user_id FROM ritual_attendance
       WHERE ritual_id = $1 AND status::text NOT IN ('no_show', 'cancelled') AND user_id != $2`,
      [id, userId]
    );
    const ritualData = {
      id,
      title: cancelled.ritual.title,
      cancel_reason: cancelled.ritual.cancel_reason,
    };

    for (const p of participants.rows) {
      notifyRitualCancelled(p.user_id, ritualData).catch(() => {});
    }

    if (req.headers.accept?.includes('application/json') || reason === 'weather_cancel') {
      return res.json({
        success: true,
        mode: 'soft_cancelled',
        cancel_reason: cancelled.ritual.cancel_reason,
        penalty_free: cancelled.penalty_free,
        weather: cancelled.weather || null,
      });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Error cancelling ritual', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel ritual' });
  }
});

// PATCH /api/rituals/:id/find-note — sonMD ≤60ch masa bulma notu
router.patch('/:id/find-note', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const maxCh = Number(LOCAL_CONFIG.ritual?.FIND_NOTE_MAX_CH || 60);
    const noteRaw = req.body?.find_note ?? req.body?.note ?? '';
    const findNote =
      noteRaw == null || String(noteRaw).trim() === ''
        ? null
        : String(noteRaw).trim().slice(0, maxCh);

    const r = await pool.query(
      `SELECT id, host_id, status, start_time, duration, checkin_keyword
       FROM rituals WHERE id = $1`,
      [id]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    const ritual = r.rows[0];
    const windowInfo = getCheckinWindowInfo(ritual);
    if (!windowInfo.door_open && String(ritual.status) === 'live') {
      return res.status(403).json({
        success: false,
        error: 'find_note is read-only after door close',
        code: 'FIND_NOTE_LOCKED',
      });
    }

    const status = String(ritual.status || '');
    const isHost = String(ritual.host_id) === String(userId);
    let allowed = false;
    if (['prelobby', 'draft', 'scheduled'].includes(status) || !windowInfo.ritual_started) {
      allowed = isHost;
    } else if (status === 'live' || windowInfo.door_open) {
      const sealed = await pool.query(
        `SELECT 1 FROM ritual_attendance
         WHERE ritual_id = $1 AND user_id = $2
           AND checkin_phase = 'sealed' AND checkin_at IS NOT NULL
         LIMIT 1`,
        [id, userId]
      );
      allowed = sealed.rows.length > 0 || isHost;
    } else {
      return res.status(403).json({
        success: false,
        error: 'find_note is read-only',
        code: 'FIND_NOTE_LOCKED',
      });
    }
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Only creator (pre-lock) or sealed participant (live) can update find_note',
      });
    }

    const upd = await pool.query(
      `UPDATE rituals SET find_note = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, find_note`,
      [id, findNote]
    );
    return res.json({
      success: true,
      data: upd.rows[0],
      event: 'find_note_updated',
    });
  } catch (e) {
    console.error('find_note update', e);
    return res.status(500).json({ success: false, error: 'Failed to update find_note' });
  }
});

// POST /api/rituals - Create a new ritual (for hosts)
// Protected: host is always the authenticated user
router.post('/', authenticateToken, requireIdentityVerified, async (req, res) => {
  const authUserId = req.user?.userId;
  try {
    const {
      title,
      type,
      venue_name,
      location_name,
      venue_id,
      start_time,
      duration,
      capacity,
      entry_type,
      location_lat,
      location_lng,
      host_id,
      live_window_hours,
      min_rs,
      min_rs_threshold,
      mood_tags,
      related_hobbies,
      checkin_keyword,
      check_in_keyword,
      window_type,
      forum_surface,
      location_type,
      is_recurring,
      definition_level,
      visibility,
      time_type,
      check_in_radius,
      draft,
      slot_id,
      self_rez_mode,
    } = req.body;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const hostCheck = await assertCanHostRitual(authUserId);
    if (!hostCheck.ok) {
      return res.status(403).json({
        success: false,
        error: hostCheck.message,
        code: hostCheck.code,
        until: hostCheck.until,
      });
    }

    // v2 §5 L2b free-location ban
    if (String(location_type || 'custom').toLowerCase() === 'custom') {
      try {
        const { canUseFreeLocation } = await import('../services/modEngine.js');
        const free = await canUseFreeLocation(authUserId);
        if (!free.ok) {
          return res.status(403).json({
            success: false,
            error: free.message,
            code: free.code,
          });
        }
      } catch (_e) {
        /* ignore */
      }
    }

    // Resolve location_name (doc) / venue_name (alias) and optional venue_id
    let finalVenueName = (location_name || venue_name) ? String(location_name || venue_name).trim() : null;
    let finalVenueId = null;
    let venueCity = null;

    // Self-rez: slot_id veya self_rez_mode → manager şartı yok (1/gün/mekan ayrı enforce)
    const isSelfRezPath =
      Boolean(slot_id) ||
      (self_rez_mode != null && String(self_rez_mode).trim() !== '');

    if (venue_id) {
      if (!isSelfRezPath) {
        const managerCheck = await pool.query(
          `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
          [venue_id, authUserId]
        );
        if (managerCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'You are not a manager of this venue. Only venue managers can create rituals for this venue.',
          });
        }
      }
      const venueRow = await pool.query(
        `SELECT id, name, city FROM venues WHERE id = $1 LIMIT 1`,
        [venue_id]
      );
      if (venueRow.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Venue not found' });
      }
      finalVenueId = venueRow.rows[0].id;
      finalVenueName = venueRow.rows[0].name;
      venueCity = venueRow.rows[0].city || null;
    }

    if (!finalVenueName) {
      return res.status(400).json({
        success: false,
        error: 'Missing venue: provide either venue_id (as venue manager) or venue_name',
      });
    }

    // Validation (venue_name now resolved above)
    if (!title || !start_time || !duration || !capacity || !entry_type || !location_lat || !location_lng) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Do not trust host_id from client – enforce that host is the authenticated user
    if (host_id && host_id !== authUserId) {
      return res.status(403).json({
        success: false,
        error: 'host_id does not match authenticated user',
      });
    }

    // Check if user has attended at least one ritual before allowing creation
    const attendanceCheck = await pool.query(
      `SELECT COUNT(*) as count 
       FROM ritual_attendance 
       WHERE user_id = $1 AND status != 'no_show' AND status != 'cancelled'`,
      [authUserId]
    );

    if (parseInt(attendanceCheck.rows[0].count) === 0) {
      return res.status(403).json({
        success: false,
        error: 'You must attend at least one ritual before creating your own. Join a ritual first to get started!',
        requires_attendance: true
      });
    }

    if (!Object.values(ENTRY_TYPE).includes(entry_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entry_type'
      });
    }

    const lwh = live_window_hours != null ? Number(live_window_hours) : defaultLiveWindowHours();
    if (live_window_hours != null && (Number.isNaN(lwh) || lwh < 1 || lwh > 168)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid live_window_hours'
      });
    }

    let venueMaxSeats = null;
    if (finalVenueId) {
      const fpRow = await pool.query(`SELECT floor_plan FROM venues WHERE id = $1`, [finalVenueId]);
      const seats = getVenueMaxTableSeats(fpRow.rows[0]?.floor_plan);
      if (seats > 0) venueMaxSeats = seats;
    }

    const createValidation = validateRitualCreateParams({
      duration,
      capacity,
      live_window_hours: lwh,
      venueMaxSeats,
    });
    if (!createValidation.ok) {
      return res.status(400).json({ success: false, error: createValidation.error });
    }
    const { durMin, cap, lwh: validatedLwh } = createValidation.data;

    // §14 — kullanıcı Ritualsinde min-RS YOK
    const { rejectUserRitualMinRs, normalizeUniversityGate } = await import(
      '../services/ritualAudienceGate.js'
    );
    const minRsReject = rejectUserRitualMinRs(req.body);
    if (!minRsReject.ok) {
      return res.status(400).json({ success: false, error: minRsReject.error });
    }
    const minRsVal = null;
    const universityGate = normalizeUniversityGate(req.body.university_gate);
    const requiredBadgeSlug = req.body.required_badge_slug
      ? String(req.body.required_badge_slug).trim().slice(0, 64)
      : null;

    const rawKw = checkin_keyword ?? check_in_keyword;
    // v2 §2: CUSTOM/SABİT KOD YOK — sistem start anında üretir
    if (rawKw != null && String(rawKw).trim() !== '') {
      return res.status(400).json({
        success: false,
        error: 'Custom check-in codes are not allowed; system generates a 3-digit code at start',
      });
    }
    const keyword = null;

    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + durMin * 60000);

    const [catRow, hostCityRow] = await Promise.all([
      pool.query(`SELECT id FROM categories WHERE slug = 'genel' LIMIT 1`),
      pool.query(`SELECT city_id FROM users WHERE id = $1`, [authUserId]),
    ]);
    const categoryId = catRow.rows[0]?.id;
    const cityId = hostCityRow.rows[0]?.city_id ?? null;
    if (!categoryId) {
      return res.status(500).json({ success: false, error: 'Default category missing' });
    }

    const mood = Array.isArray(mood_tags) ? mood_tags : (Array.isArray(related_hobbies) ? related_hobbies : []);
    const openNote = typeof req.body.open_note === 'string' ? req.body.open_note.trim().slice(0, 280) : null;

    const resolvedWindowType =
      window_type === 'open_forum' ? 'open_forum' : 'ephemeral';
    const resolvedForumSurface =
      forum_surface === 'whole_window' ? 'whole_window' : 'memories_only';

    const rawLocationType = String(location_type || '').toLowerCase();
    const isHome =
      req.body.is_home === true ||
      req.body.is_home === 'true' ||
      rawLocationType === 'home';
    const resolvedLocationType = ['custom', 'venue', 'zone', 'moving', 'scheduled', 'ferry'].includes(
      rawLocationType === 'home' ? 'custom' : rawLocationType
    )
      ? (rawLocationType === 'home' ? 'custom' : rawLocationType)
      : (finalVenueId ? 'venue' : 'custom');
    const recurring = is_recurring === true || is_recurring === 'true';
    const resolvedTimeType = normalizeRequestedTimeType(time_type, recurring);
    const oneShot = assertScheduledOneShot({
      locationType: resolvedLocationType,
      isRecurring: recurring,
      timeType: resolvedTimeType,
    });
    if (!oneShot.ok) {
      return res.status(400).json({
        success: false,
        error: oneShot.error,
        code: oneShot.code,
      });
    }
    const resolvedDefinition = ['bos', 'kategori', 'tam', 'user_oneri'].includes(
      String(definition_level || '').toLowerCase()
    )
      ? String(definition_level).toLowerCase()
      : 'tam';
    const resolvedVisibility = ['public', 'venue_only', 'regular_only'].includes(
      String(visibility || '').toLowerCase()
    )
      ? String(visibility).toLowerCase()
      : 'public';

    const feeParse = parseRitualFee(req.body);
    if (!feeParse.ok) {
      return res.status(400).json({ success: false, error: feeParse.error });
    }
    const audienceParse = normalizeRitualAudience(req.body.audience);
    if (!audienceParse.ok) {
      return res.status(400).json({ success: false, error: audienceParse.error });
    }
    const resolvedAudience = audienceParse.audience;
    const resolvedFee = feeParse.fee;

    const resolvedOrigin = req.body.origin === 'SLOT_PLANNED' || slot_id
      ? 'SLOT_PLANNED'
      : (req.body.origin === 'VEN_EVENT' ? 'VEN_EVENT' : 'WALK_IN');

    if (resolvedOrigin === 'VEN_EVENT') {
      if (!finalVenueId) {
        return res.status(400).json({
          success: false,
          error: 'VEN_EVENT requires venue_id',
          code: 'VEN_EVENT_VENUE_REQUIRED',
        });
      }
      const { assertVenEventMonthlyCap } = await import('../services/venEventQuota.js');
      const quota = await assertVenEventMonthlyCap(finalVenueId);
      if (!quota.ok) {
        return res.status(403).json({
          success: false,
          error: quota.error,
          code: quota.code || 'VEN_EVENT_MONTHLY_CAP',
          quota,
        });
      }
    }

    const selfRezModeRaw = String(self_rez_mode || '').toUpperCase();
    const selfRezModes = Array.isArray(LOCAL_CONFIG.ritual.SELF_REZ_MODES)
      ? LOCAL_CONFIG.ritual.SELF_REZ_MODES
      : ['INSTANT', 'APPROVAL'];
    const resolvedSelfRezMode = selfRezModeRaw && selfRezModes.includes(selfRezModeRaw)
      ? selfRezModeRaw
      : null;
    if (slot_id) {
      if (!resolvedSelfRezMode) {
        return res.status(400).json({
          success: false,
          error: `self_rez_mode required for slot rituals (${selfRezModes.join('/')})`,
        });
      }
      if (resolvedSelfRezMode === 'INSTANT' && resolvedTimeType !== 'instant') {
        return res.status(400).json({
          success: false,
          error: 'self_rez_mode=INSTANT requires time_type=instant',
        });
      }
    }
    if (resolvedTimeType === 'instant') {
      const instantMaxLeadH = Number(LOCAL_CONFIG.ritual.INSTANT_MAX_LEAD_H || 2);
      const leadMs = startDate.getTime() - Date.now();
      if (leadMs > instantMaxLeadH * 3600000) {
        return res.status(400).json({
          success: false,
          error: `INSTANT rituals must start within ${instantMaxLeadH} hours of create`,
        });
      }
    } else {
      // A6 — PLANNED_MAX_AHEAD / EVENT_MAX_AHEAD enforce
      const horizon = assertStartHorizon({
        startDate,
        timeType: resolvedTimeType,
        origin: resolvedOrigin,
        eventGroupId: req.body.event_group_id || null,
        brandId: req.body.brand_id || null,
      });
      if (!horizon.ok) {
        return res.status(400).json({
          success: false,
          error: horizon.error,
          code: horizon.code,
          max_ahead_d: horizon.max_ahead_d,
        });
      }
    }

    // Self-rez 1/gün/mekan ⭐
    if (resolvedSelfRezMode) {
      if (!finalVenueId) {
        return res.status(400).json({
          success: false,
          error: 'self_rez_mode requires venue_id',
          code: 'SELF_REZ_VENUE_REQUIRED',
        });
      }
      const selfRezCap = await assertSelfRezDailyCap(authUserId, finalVenueId);
      if (!selfRezCap.ok) {
        return res.status(429).json({
          success: false,
          error: selfRezCap.error,
          code: selfRezCap.code || 'SELF_REZ_DAILY_CAP',
          used: selfRezCap.used,
          cap: selfRezCap.cap,
        });
      }
    }
    if (resolvedLocationType === 'custom') {
      const { validateRitualCapacity } = await import('../config/localConfig.js');
      const capCheck = validateRitualCapacity(
        cap,
        req.body.category || req.body.category_label || title,
        { locationType: resolvedLocationType }
      );
      if (!capCheck.ok) {
        return res.status(400).json({
          success: false,
          error: capCheck.error,
          code: capCheck.code,
        });
      }
      // soft_warning response'a create sonrası eklenir
      req._softCapacityWarning = capCheck.soft_warning || null;
    }

    const gpsAnchor = await resolveRitualGpsAnchor(pool, {
      locationType: resolvedLocationType,
      venueId: finalVenueId,
      zoneId: req.body.zone_id || null,
      locationLat: location_lat,
      locationLng: location_lng,
    });
    if (!gpsAnchor.ok) {
      return res.status(400).json({ success: false, error: gpsAnchor.error });
    }

    let routeId = null;
    let resolvedZoneId = gpsAnchor.zone_id || req.body.zone_id || null;
    if (isScheduledLocationType(resolvedLocationType)) {
      routeId = normalizeRouteId(req.body.route_id, finalVenueName);
      if (routeId) {
        const { getOrCreateLineZone } = await import('../services/zoneService.js');
        const lineZone = await getOrCreateLineZone(routeId);
        if (lineZone?.id) resolvedZoneId = lineZone.id;
      }
    }

    const radiusMeters =
      check_in_radius != null && Number(check_in_radius) > 0
        ? Math.round(Number(check_in_radius))
        : getGpsRadiusMeters(resolvedLocationType);

    const radiusValidation = validateCheckInRadius(
      resolvedLocationType,
      check_in_radius != null && Number(check_in_radius) > 0
        ? radiusMeters
        : null
    );
    if (radiusValidation.ok === false) {
      return res.status(400).json({ success: false, error: radiusValidation.error });
    }

    // §12 brand_id — validate before insert (brand cannot host; member signs)
    const { assertCanAttachBrandSignature } = await import('../services/brandService.js');
    const brandAttach = await assertCanAttachBrandSignature(authUserId, req.body.brand_id || null);
    if (!brandAttach.ok) {
      return res.status(brandAttach.status || 403).json({
        success: false,
        error: brandAttach.error,
      });
    }
    const resolvedWindowVisibility =
      String(req.body.window_visibility || 'CLOSED').toUpperCase() === 'TRANSPARENT'
        ? 'TRANSPARENT'
        : 'CLOSED';

    const initialStatus = draft === true || draft === 'true' ? 'created' : 'prelobby';
    const gateOverrideUntil = resolvedLocationType === 'zone' && resolvedTimeType === 'fixed'
      ? new Date(startDate.getTime() + 5 * 60000)
      : null;

    if (initialStatus !== 'created') {
      const hostCommit = await assertCanHostCommit(pool, authUserId, {
        start_time: startDate,
        duration: durMin,
        time_type: resolvedTimeType,
        event_group_id: req.body.event_group_id || null,
      });
      if (!hostCommit.ok) {
        return res.status(422).json({
          success: false,
          error: hostCommit.error,
          code: hostCommit.code,
          conflicting_ritual_id: hostCommit.conflicting_ritual_id,
        });
      }
    }

    const query = `
      INSERT INTO rituals (
        title, type, location_name, venue_id, start_time, duration, end_time,
        capacity, entry_type, location_lat, location_lng, host_id, status,
        live_window_hours, min_rs, mood_tags, checkin_keyword, city_id, category_id,
        window_type, forum_surface, location_type, is_recurring,
        definition_level, visibility, time_type, check_in_radius,
        university_gate, required_badge_slug, open_note, origin, gate_override_until,
        self_rez_mode, zone_id, is_home, route_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::ritual_window_type, $21, $22, $23, $24::ritual_definition_level, $25::ritual_visibility, $26::ritual_time_type, $27, $28, $29, $30, $31::ritual_origin_type, $32, $33, $34, $35, $36)
      RETURNING *
    `;

    const result = await pool.query(query, [
      title,
      type,
      finalVenueName,
      finalVenueId,
      startDate,
      durMin,
      endDate,
      cap,
      entry_type,
      gpsAnchor.location_lat,
      gpsAnchor.location_lng,
      authUserId,
      initialStatus,
      validatedLwh,
      minRsVal,
      mood,
      keyword,
      cityId,
      categoryId,
      resolvedWindowType,
      resolvedForumSurface,
      resolvedLocationType,
      recurring,
      resolvedDefinition,
      resolvedVisibility,
      resolvedTimeType,
      radiusMeters,
      universityGate,
      requiredBadgeSlug,
      openNote,
      resolvedOrigin,
      gateOverrideUntil,
      resolvedSelfRezMode,
      resolvedZoneId,
      isHome,
      routeId,
    ]);

    const newRitual = result.rows[0];

    // v2 §7 SERIES — create → ritual_series bağla (tarifeli tek sefer; yukarıda 400)
    if (!isScheduledLocationType(resolvedLocationType) && (resolvedTimeType === 'recurring' || recurring)) {
      try {
        const { bindRitualAsSeries } = await import('../services/seriesService.js');
        const series = await bindRitualAsSeries({
          ritualId: newRitual.id,
          hostId: authUserId,
          name: title,
          startTime: startDate,
          recurrenceRule: {
            ...(req.body.recurrence_rule || {}),
            ...(req.body.series_cadence ? { cadence: req.body.series_cadence } : {}),
            ...('series_end_after_weeks' in req.body
              ? { end_after_weeks: req.body.series_end_after_weeks }
              : {}),
          },
        });
        newRitual.series_id = series.id;
        newRitual.series_week = 1;
        newRitual.is_recurring = true;
        newRitual.time_type = 'recurring';
      } catch (e) {
        logger.warn('Series bind failed after ritual create', {
          ritualId: newRitual.id,
          error: e.message,
        });
      }
    }

    // v2 §7 SPARK — zone'dan doğan INSTANT (tip değil, doğum etiketi)
    const wantSpark =
      req.body.spark_born === true ||
      req.body.spark_born === 'true' ||
      (resolvedLocationType === 'zone' && resolvedTimeType === 'instant');
    if (wantSpark) {
      try {
        await pool.query(`UPDATE rituals SET spark_born = true, updated_at = NOW() WHERE id = $1`, [
          newRitual.id,
        ]);
        newRitual.spark_born = true;
      } catch (_e) {
        /* optional col */
      }
    }

    // Absolute 100 B — CreateRitual ↔ spark_meetup seal
    if (req.body.spark_meetup_id) {
      try {
        const { sealMeetupToRitual } = await import('../services/sparkMeetupService.js');
        await sealMeetupToRitual(req.body.spark_meetup_id, newRitual.id);
        newRitual.spark_born = true;
        newRitual.spark_meetup_id = req.body.spark_meetup_id;
      } catch (e) {
        logger.warn('SPARK meetup seal failed', { error: e.message });
      }
    }

    // §2C fee + discovery audience (ayrı: visibility)
    try {
      const stampedFeeAud = await pool.query(
        `UPDATE rituals
         SET fee_amount = $1,
             fee_currency = $2,
             fee_note = $3,
             audience = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING fee_amount, fee_currency, fee_note, audience`,
        [
          resolvedFee ? resolvedFee.amount : null,
          resolvedFee ? resolvedFee.currency : null,
          resolvedFee ? resolvedFee.note : null,
          resolvedAudience,
          newRitual.id,
        ]
      );
      const fa = stampedFeeAud.rows[0] || {};
      newRitual.fee_amount = fa.fee_amount ?? null;
      newRitual.fee_currency = fa.fee_currency ?? null;
      newRitual.fee_note = fa.fee_note ?? null;
      newRitual.audience = fa.audience || resolvedAudience;
      newRitual.fee = feeDtoFromRow(newRitual);
      newRitual.has_fee = newRitual.fee_amount != null;
    } catch (e) {
      logger.warn('Fee/audience stamp failed', { error: e.message });
      newRitual.audience = resolvedAudience;
      newRitual.fee = resolvedFee;
      newRitual.has_fee = !!resolvedFee;
    }

    // §12 — brand_id imza + window_visibility (DEFAULT CLOSED)
    try {
      const stamped = await pool.query(
        `UPDATE rituals
         SET brand_id = $1,
             window_visibility = $2::ritual_window_visibility,
             updated_at = NOW()
         WHERE id = $3
         RETURNING brand_id, window_visibility`,
        [brandAttach.brand_id, resolvedWindowVisibility, newRitual.id]
      ).catch(() => ({ rows: [{}] }));
      newRitual.brand_id = stamped.rows[0]?.brand_id ?? brandAttach.brand_id;
      newRitual.window_visibility = stamped.rows[0]?.window_visibility || resolvedWindowVisibility;
    } catch (e) {
      logger.warn('Brand/window_visibility stamp failed', { error: e.message });
      newRitual.window_visibility = resolvedWindowVisibility;
    }

    // §2 planners_only — default false; true ise alım kilitte kapanır
    const plannersOnly =
      req.body.planners_only === true || req.body.planners_only === 'true';
    if (plannersOnly) {
      try {
        await pool.query(
          `UPDATE rituals SET planners_only = true, updated_at = NOW() WHERE id = $1`,
          [newRitual.id]
        );
        newRitual.planners_only = true;
      } catch (_e) {
        /* optional col */
      }
    }

    if (slot_id && finalVenueId) {
      const slotResult = await attachVenueSlotToRitual(
        finalVenueId,
        slot_id,
        authUserId,
        newRitual.id
      );
      if (!slotResult.ok) {
        logger.warn('Venue slot attach failed after ritual create', {
          ritualId: newRitual.id,
          slotId: slot_id,
          error: slotResult.error,
        });
      }
    }

    // §2C VENUE-LEAD RADARI — custom pin tekrar ≥ REPEAT_PIN_N
    if (resolvedLocationType === 'custom' && !finalVenueId) {
      maybeRecordRepeatPinLead({
        ritualId: newRitual.id,
        lat: gpsAnchor.location_lat,
        lng: gpsAnchor.location_lng,
        hostId: authUserId,
        city: venueCity || null,
      }).catch((e) => {
        logger.warn('venue lead radar failed', { error: e.message, ritualId: newRitual.id });
      });
    }

    // Emit pulse update for the host's city
    const hostQuery = await pool.query('SELECT city FROM users WHERE id = $1', [authUserId]);
    if (hostQuery.rows.length > 0 && req.io) {
      const hostCity = hostQuery.rows[0].city;
      console.log(`Emitting pulse update for city: ${hostCity} after ritual creation`);
      emitPulseUpdate(req.io, hostCity);
    } else if (!req.io) {
      logger.warn('req.io is not available, cannot emit pulse update', { hostId: authUserId });
    }

    res.status(201).json({
      success: true,
      data: newRitual,
      soft_warning: req._softCapacityWarning || undefined,
    });
  } catch (error) {
    logger.error('Error creating ritual', { 
      error: error.message, 
      stack: error.stack,
      hostId: authUserId || null,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create ritual'
    });
  }
});

// POST /api/rituals/:id/publish — created/draft → prelobby (son-part.md §1)
router.post('/:id/publish', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = req.user?.userId;
    if (!authUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const hostCheck = await assertCanHostRitual(authUserId);
    if (!hostCheck.ok) {
      return res.status(403).json({
        success: false,
        error: hostCheck.message,
        code: hostCheck.code,
        until: hostCheck.until,
      });
    }

    const ritualResult = await pool.query(
      `SELECT * FROM rituals WHERE id = $1`,
      [id]
    );
    if (ritualResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }

    const ritual = ritualResult.rows[0];
    if (ritual.host_id !== authUserId) {
      return res.status(403).json({ success: false, error: 'Only the host can publish this ritual' });
    }

    const status = normalizeRitualStatus(ritual.status);
    if (status !== RITUAL_STATUS.CREATED && status !== RITUAL_STATUS.DRAFT) {
      return res.status(400).json({
        success: false,
        error: 'Only draft/created rituals can be published',
        current_status: ritual.status,
      });
    }

    const hostCommit = await assertCanHostCommit(pool, authUserId, ritual);
    if (!hostCommit.ok) {
      return res.status(422).json({
        success: false,
        error: hostCommit.error,
        code: hostCommit.code,
        conflicting_ritual_id: hostCommit.conflicting_ritual_id,
      });
    }

    const updated = await pool.query(
      `UPDATE rituals SET status = 'prelobby', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );

    const hostQuery = await pool.query('SELECT city FROM users WHERE id = $1', [authUserId]);
    if (hostQuery.rows.length > 0 && req.io) {
      emitPulseUpdate(req.io, hostQuery.rows[0].city);
    }

    try {
      const { notifyRareHostFollowers, notifyFollowedHostBell } = await import('../services/notifications.js');
      await notifyRareHostFollowers(authUserId, updated.rows[0]);
      await notifyFollowedHostBell(authUserId, updated.rows[0]);
    } catch (_e) {
      // best effort
    }

    return res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    logger.error('Error publishing ritual', { error: error.message, ritualId: req.params.id });
    return res.status(500).json({ success: false, error: 'Failed to publish ritual' });
  }
});

// POST /api/rituals/:id/join - Join a ritual
// Protected: user_id must match authenticated user
router.post('/:id/join', authenticateToken, requireIdentityVerified, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, invite_token } = req.body;
    
    const authUserId = req.user?.userId;

    if (!authUserId) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!user_id) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'user_id is required');
    }

    // Ensure the caller cannot join on behalf of another user
    if (user_id !== authUserId) {
      return sendError(res, 403, 'FORBIDDEN', 'user_id does not match authenticated user');
    }

    const joinPenaltyCheck = await assertCanJoinRitual(authUserId);
    if (!joinPenaltyCheck.ok) {
      return sendError(res, 403, joinPenaltyCheck.code || 'PENALTY_SUSPENDED', joinPenaltyCheck.message, {
        until: joinPenaltyCheck.until,
      });
    }

    // Check if ritual exists and is joinable
    const ritualCheck = await pool.query(
      `SELECT * FROM rituals WHERE id = $1 AND status::text IN ('prelobby', 'active', 'live')`,
      [id]
    );

    if (ritualCheck.rows.length === 0) {
      return sendError(res, 404, 'RITUAL_NOT_FOUND', 'Ritual not found or not joinable');
    }

    const ritual = ritualCheck.rows[0];
    const now = new Date();
    const checkinWindow = getCheckinWindowInfo(ritual, now);
    const lockMomentAt = new Date(
      new Date(ritual.start_time).getTime() - freeCancelThresholdMinutes(ritual) * 60000
    );

    // §2 JOIN KURALI + JOIN_BUFFER_MIN (varsayılan 0)
    const joinBufferMin = Number(LOCAL_CONFIG.ritual.JOIN_BUFFER_MIN || 0);
    const effectiveDoorClose = new Date(
      new Date(checkinWindow.door_closes_at).getTime() + Math.max(0, joinBufferMin) * 60000
    );
    if (checkinWindow.ritual_started && now > effectiveDoorClose) {
      return sendError(res, 403, 'JOIN_DOOR_CLOSED', 'Katılım kapısı kapandı');
    }

    // §2 planners_only:true => alım kilit anında kapanır
    if (Boolean(ritual.planners_only) && now > lockMomentAt) {
      return sendError(res, 403, 'JOIN_LOCKED_PLANNERS_ONLY', 'Bu ritüelde alım kilit anında kapanır');
    }

    // v2 §6 regular_only — yalnız regular / host / venue manager
    const vis = String(ritual.visibility || 'public').toLowerCase();
    if (vis === 'regular_only' && ritual.venue_id && String(ritual.host_id) !== String(authUserId)) {
      const mgr = await pool.query(
        `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
        [ritual.venue_id, authUserId]
      );
      if (!mgr.rows.length) {
        const { isVenueRegular } = await import('../services/regularService.js');
        const ok = await isVenueRegular(authUserId, ritual.venue_id);
        if (!ok) {
          return sendError(res, 403, 'REGULAR_ONLY', 'Bu Ritual yalnız mekan Regular üyelerine açık');
        }
      }
    }

    // F1.5 Series-Regular only
    if (vis === 'series_regular_only') {
      const { assertSeriesRegularOnlyJoin } = await import('../services/seriesRegularService.js');
      const sro = await assertSeriesRegularOnlyJoin({
        userId: authUserId,
        ritual,
        hostId: ritual.host_id,
      });
      if (!sro.ok) {
        return sendError(res, 403, sro.code || 'SERIES_REGULAR_ONLY', sro.error);
      }
    }

    // §1 auth v2: davet kapı-anahtarı değildir; token yalnız hızlandırıcı link olarak kabul edilir.
    // Join kararı davet tokenına bağlı değildir.

    // Check capacity
    const attendanceCount = await pool.query(
      'SELECT COUNT(*) FROM ritual_attendance WHERE ritual_id = $1 AND status != $2',
      [id, 'no_show']
    );

    if (parseInt(attendanceCount.rows[0].count) >= ritual.capacity) {
      return sendError(
        res,
        422,
        'RITUAL_CAPACITY_FULL',
        'Bu Ritualin kapasitesi doldu.',
        {
          capacity: Number(ritual.capacity),
          current: Number(attendanceCount.rows[0].count),
        }
      );
    }

    const joinConstraints = await assertCanJoinRitualConstraints(pool, authUserId, ritual);
    if (!joinConstraints.ok) {
      return sendError(res, 422, joinConstraints.code || 'JOIN_CONSTRAINT', joinConstraints.error);
    }

    // Check if already joined
    const existing = await pool.query(
      'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
      [id, authUserId]
    );

    if (existing.rows.length > 0) {
      const previous = existing.rows[0];
      if (previous.status !== 'cancelled') {
        return sendError(res, 409, 'RITUAL_ALREADY_JOINED', 'Already joined this ritual');
      }
    }

    let attendanceRow;
    let isRejoin = false;

    if (existing.rows.length > 0 && existing.rows[0].status === 'cancelled') {
      // Re-join: grace yenilenmez, exact detay anında açılır (son-part.md §2.2)
      const now = new Date();
      const rejoinResult = await pool.query(
        `UPDATE ritual_attendance
         SET status = 'confirmed',
             join_count = COALESCE(join_count, 1) + 1,
             prelobby_grace_ends_at = $3,
             exact_details_unlocked_at = $3,
             cancelled_at = NULL,
             cancellation_type = NULL
         WHERE ritual_id = $1 AND user_id = $2
         RETURNING *`,
        [id, authUserId, now]
      );
      attendanceRow = rejoinResult.rows[0];
      isRejoin = true;
    } else {
      const joinedAt = new Date();
      const { graceEndsAt, exactDetailsUnlockedAt } = computePrelobbyGrace(
        joinedAt,
        ritual.start_time,
        ritual
      );

      const result = await pool.query(
        `INSERT INTO ritual_attendance (
           ritual_id, user_id, status, joined_at,
           prelobby_grace_ends_at, exact_details_unlocked_at, join_count
         )
         VALUES ($1, $2, 'confirmed', $3, $4, $5, 1)
         RETURNING *`,
        [id, authUserId, joinedAt, graceEndsAt, exactDetailsUnlockedAt]
      );
      attendanceRow = result.rows[0];
    }

    void invite_token;

    // Get updated attendance count
    const updatedAttendanceCount = await pool.query(
      'SELECT COUNT(*) as count FROM ritual_attendance WHERE ritual_id = $1 AND status != $2',
      [id, 'no_show']
    );

    // Emit ritual update
    emitRitualUpdate(req.io, id, 'attendance_update', {
      current_attendees: parseInt(updatedAttendanceCount.rows[0].count),
      capacity: ritual.capacity
    });

    // Emit pulse update
    const hostQuery = await pool.query(
      'SELECT u.city FROM rituals r JOIN users u ON r.host_id = u.id WHERE r.id = $1',
      [id]
    );
    if (hostQuery.rows.length > 0) {
      emitPulseUpdate(req.io, hostQuery.rows[0].city);
    }

    // Notify friends
    const userQuery = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [authUserId]
    );
    const userName = userQuery.rows[0]?.name || 'Someone';

    const ritualData = {
      id: id,
      title: ritual.title,
    };

    {
      const friendsQuery = await pool.query(
        `SELECT friend_id FROM friendships 
         WHERE user_id = $1 AND status = 'accepted'
         UNION
         SELECT user_id FROM friendships 
         WHERE friend_id = $1 AND status = 'accepted'`,
        [authUserId]
      );
      for (const friend of friendsQuery.rows) {
        await notifyFriendJoinedRitual(friend.friend_id, userName, ritualData);
      }
    }

    if (!isRejoin) {
      await notifyJoinConfirmed(authUserId, ritualData).catch(() => {});
      if (attendanceRow.exact_details_unlocked_at && new Date(attendanceRow.exact_details_unlocked_at) <= new Date()) {
        await notifyExactDetailsUnlocked(authUserId, ritualData).catch(() => {});
      }
    }

    try {
      const { recordCheckinFunnelEvent } = await import('../services/checkinFunnelService.js');
      void recordCheckinFunnelEvent({
        ritualId: id,
        userId: authUserId,
        event: 'join',
        meta: { rejoin: Boolean(isRejoin) },
      });
    } catch (_e) {
      /* soft */
    }

    // sonMD Sosyal §3: join engellenmez; yalnız blocklayan görür
    const blockedPeerWarning = await hasBlockedPeerOnRitual(authUserId, id).catch(() => false);

    res.json({
      success: true,
      data: attendanceRow,
      rejoin: isRejoin,
      blocked_peer_warning: Boolean(blockedPeerWarning),
    });
  } catch (error) {
    logger.error('Error joining ritual', { 
      error: error.message, 
      stack: error.stack,
      ritualId: req.params?.id,
      userId: req.user?.userId || null,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to join ritual'
    });
  }
});

// POST /api/rituals/:id/rsvp - backend-yeni.md contract alias
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  req.body = {
    ...req.body,
    user_id: req.user?.userId
  };
  return router.handle(
    { ...req, method: 'POST', url: `/${req.params.id}/join` },
    res
  );
});

// DELETE /api/rituals/:id/rsvp - son-part.md §7.1 iptal kuralları
router.delete('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    const ritualId = req.params.id;
    const userId = req.user.userId;
    const force = req.query.force_without_replacement === 'true' || req.body?.force_without_replacement;

    const result = await processAttendanceCancel(userId, ritualId, {
      force_without_replacement: !!force,
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      success: true,
      ...result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel RSVP',
    });
  }
});

// POST /api/rituals/:id/replacement/claim — yer açıldı (son-part.md §7.1)
router.post('/:id/replacement/claim', authenticateToken, async (req, res) => {
  try {
    const ritualId = req.params.id;
    const userId = req.user.userId;
    const result = await claimReplacementSlot(ritualId, userId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ success: true, ...result.data });
  } catch (error) {
    logger.error('Error claiming replacement slot', { error: error.message, ritualId: req.params.id });
    return res.status(500).json({ success: false, error: 'Failed to claim replacement slot' });
  }
});

// POST /api/rituals/:id/reveal-keyword — host/escrow opens system code (v2 §2)
router.post('/:id/reveal-keyword', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await revealCheckinKeyword(id, req.user.userId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    logger.error('Error revealing check-in keyword', { error: error.message, ritualId: req.params.id });
    return res.status(500).json({ success: false, error: 'Failed to reveal keyword' });
  }
});

// POST /api/rituals/:id/claim-escrow — REMOVED (firstSeal model)
router.post('/:id/claim-escrow', authenticateToken, async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Escrow removed — use first seal at table',
    code: 'ESCROW_REMOVED',
  });
});

// POST /api/rituals/:id/checkin-funnel — C1 kapı hunisi (door_view / door_abandon)
router.post('/:id/checkin-funnel', authenticateToken, async (req, res) => {
  try {
    const { recordCheckinFunnelEvent, CLIENT_FUNNEL_EVENTS } = await import('../services/checkinFunnelService.js');
    const event = String(req.body?.event || '');
    if (!CLIENT_FUNNEL_EVENTS.has(event)) {
      return res.status(400).json({ success: false, error: 'unknown_funnel_event' });
    }
    const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
    const surfaceDefault =
      event === 'door_abandon' ? 'gate' : event === 'door_view' ? (meta.surface || 'detail') : undefined;
    const result = await recordCheckinFunnelEvent({
      ritualId: req.params.id,
      userId: req.user?.userId || null,
      event,
      meta: surfaceDefault
        ? { ...meta, surface: meta.surface || surfaceDefault }
        : meta,
    });
    return res.json({ success: true, data: { recorded: Boolean(result.ok) } });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/rituals/:id/checkin - backend-yeni.md contract
router.post('/:id/checkin', authenticateToken, async (req, res) => {
  try {
    const ritualId = req.params.id;
    const userId = req.user.userId;
    const rawCheckin = req.body.checkin_keyword ?? req.body.check_in_keyword ?? req.body.host_keyword;
    const {
      latitude,
      longitude,
      location_suspect: locationSuspect,
      nfc_marker: nfcMarker,
      open_note: openNote,
      mock_location: mockLocation,
      play_integrity: playIntegrity,
      app_attest: appAttest,
    } = req.body;

    const result = await processCheckIn({
      ritualId,
      userId,
      latitude,
      longitude,
      keyword: rawCheckin,
      locationSuspect: Boolean(locationSuspect),
      nfcMarker: Boolean(nfcMarker),
      openNote: typeof openNote === 'string' ? openNote.trim().slice(0, 280) : null,
      integritySignals: {
        mock_location: Boolean(mockLocation),
        play_integrity: playIntegrity === false ? false : undefined,
        app_attest: appAttest === false ? false : undefined,
      },
    });

    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }

    const { attendance, ...meta } = result.data;
    return res.json({
      success: true,
      data: attendance,
      ...meta,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to check in' });
  }
});

// POST /api/rituals/:id/checkin/marker — v2 §2 NFC/totem marker check-in
router.post('/:id/checkin/marker', authenticateToken, async (req, res) => {
  try {
    const result = await processCheckIn({
      ritualId: req.params.id,
      userId: req.user.userId,
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
      locationSuspect: Boolean(req.body?.location_suspect),
      nfcMarker: true,
      openNote: typeof req.body?.open_note === 'string' ? req.body.open_note.trim().slice(0, 280) : null,
      integritySignals: {
        mock_location: Boolean(req.body?.mock_location),
        play_integrity: req.body?.play_integrity === false ? false : undefined,
        app_attest: req.body?.app_attest === false ? false : undefined,
      },
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    const { attendance, ...meta } = result.data;
    return res.json({ success: true, data: attendance, ...meta });
  } catch (_e) {
    return res.status(500).json({ success: false, error: 'Failed to check in via marker' });
  }
});

// POST /api/rituals/:id/checkin/witness — v2 §2 tanık onayı
router.post('/:id/checkin/witness', authenticateToken, async (req, res) => {
  try {
    const { subject_user_id: subjectUserId } = req.body || {};
    if (!subjectUserId) {
      return res.status(400).json({ success: false, error: 'subject_user_id required' });
    }
    const { witnessPendingCheckin } = await import('../services/firstSealService.js');
    const result = await witnessPendingCheckin(req.params.id, req.user.userId, subjectUserId);
    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Witness failed' });
  }
});

// POST /api/rituals/:id/checkin/local-tag — v2 §2 LOCAL-TAG üret
router.post('/:id/checkin/local-tag', authenticateToken, async (req, res) => {
  try {
    const { createLocalCheckinTag } = await import('../services/firstSealService.js');
    const result = await createLocalCheckinTag(req.params.id, req.user.userId);
    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'LOCAL-TAG failed' });
  }
});

// POST /api/rituals/:id/checkin/redeem-tag
router.post('/:id/checkin/redeem-tag', authenticateToken, async (req, res) => {
  try {
    const token = req.body?.token;
    const { redeemLocalCheckinTag } = await import('../services/firstSealService.js');
    const result = await redeemLocalCheckinTag(req.params.id, req.user.userId, token, {
      latitude: req.body?.latitude,
      longitude: req.body?.longitude,
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Tag redeem failed' });
  }
});

// POST /api/rituals/:id/sub-seal/in — v2 §2 VEN_EVENT sub seat ownership
router.post('/:id/sub-seal/in', authenticateToken, async (req, res) => {
  try {
    const { enterEventSubSeal } = await import('../services/eventSubSealService.js');
    const result = await enterEventSubSeal({
      ritualId: req.params.id,
      userId: req.user.userId,
      subId: req.body?.sub_id,
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ success: true, data: result.data });
  } catch (_e) {
    return res.status(500).json({ success: false, error: 'Sub-seal entry failed' });
  }
});

// POST /api/rituals/:id/sub-seal/out
router.post('/:id/sub-seal/out', authenticateToken, async (req, res) => {
  try {
    const { exitEventSubSeal } = await import('../services/eventSubSealService.js');
    const result = await exitEventSubSeal({
      ritualId: req.params.id,
      userId: req.user.userId,
      subId: req.body?.sub_id,
    });
    if (!result.ok) return res.status(result.status).json(result.body);
    return res.json({ success: true, data: result.data });
  } catch (_e) {
    return res.status(500).json({ success: false, error: 'Sub-seal exit failed' });
  }
});

// GET /api/rituals/:id/participants
// §12 API-level guard: dış-katman (katılımcı/host değil) → liste ASLA serialize edilmez
router.get('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const ritualId = req.params.id;
    const viewerId = req.user.userId;
    const ritual = await pool.query(`SELECT id, host_id FROM rituals WHERE id = $1`, [ritualId]);
    if (ritual.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    const isHost = String(ritual.rows[0].host_id) === String(viewerId);
    const att = await pool.query(
      `SELECT 1 FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2
         AND status::text NOT IN ('no_show','cancelled')
       LIMIT 1`,
      [ritualId, viewerId]
    );
    const isParticipant = att.rows.length > 0;
    if (!isHost && !isParticipant) {
      return res.json({
        success: true,
        data: [],
        participant_list_visible: false,
        code: 'OUTER_LAYER_EMPTY',
      });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.rs_score, ra.status, ra.checkin_at, ra.created_at AS joined_at
       FROM ritual_attendance ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.ritual_id = $1
         AND ra.status::text NOT IN ('no_show','cancelled')
       ORDER BY ra.created_at ASC`,
      [ritualId]
    );
    return res.json({
      success: true,
      data: result.rows,
      participant_list_visible: true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch participants' });
  }
});

// GET /api/rituals/:id/window - backend-yeni.md contract
// §12 window_visibility: CLOSED → yalnız katılımcı/host; TRANSPARENT → şehir okuyabilir
router.get('/:id/window', authenticateToken, async (req, res) => {
  try {
    const ritualResult = await pool.query(
      `SELECT id, status, start_time, duration, live_window_hours, host_id,
              COALESCE(window_visibility::text, 'CLOSED') AS window_visibility
       FROM rituals
       WHERE id = $1`,
      [req.params.id]
    );
    if (ritualResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }

    const ritual = ritualResult.rows[0];
    const viewerId = req.user.userId;
    const isHost = String(ritual.host_id) === String(viewerId);
    const att = await pool.query(
      `SELECT 1 FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2
         AND status::text NOT IN ('no_show','cancelled')
       LIMIT 1`,
      [req.params.id, viewerId]
    );
    const isParticipant = att.rows.length > 0;
    const winVis = String(ritual.window_visibility || 'CLOSED').toUpperCase();
    const canReadWindow =
      isHost || isParticipant || winVis === 'TRANSPARENT';

    if (!canReadWindow) {
      return res.status(403).json({
        success: false,
        error: 'Window akışı (söz/thought) yalnız katılımcılara (CLOSED)',
        code: 'WINDOW_CLOSED',
        window_visibility: 'CLOSED',
      });
    }

    const readOnly = !(isHost || isParticipant);
    let readerCount = 0;
    if (winVis === 'TRANSPARENT') {
      try {
        const { touchWindowReader } = await import('../services/windowReaderService.js');
        const touched = await touchWindowReader(req.params.id, viewerId);
        readerCount = touched.reader_count;
      } catch (_e) {
        readerCount = 0;
      }
    }

    const messagesResult = await pool.query(
      `SELECT id, ritual_id, sender_id, message_type, content, media_url, created_at
       FROM chat_messages
       WHERE ritual_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.params.id]
    );

    return res.json({
      success: true,
      data: {
        ritual: {
          ...ritual,
          window_visibility: winVis,
        },
        messages: messagesResult.rows.reverse(),
        reader_count: winVis === 'TRANSPARENT' ? readerCount : null,
        read_only: readOnly,
        // Katılımcı listesi HİÇBİR durumda window payload'ında yok
        participants: undefined,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch ritual window' });
  }
});

// POST /api/rituals/:id/window/presence — transparent window heartbeat
router.post('/:id/window/presence', authenticateToken, async (req, res) => {
  try {
    const ritualResult = await pool.query(
      `SELECT id, host_id, COALESCE(window_visibility::text, 'CLOSED') AS window_visibility
       FROM rituals WHERE id = $1`,
      [req.params.id]
    );
    if (!ritualResult.rows[0]) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    const ritual = ritualResult.rows[0];
    const winVis = String(ritual.window_visibility || 'CLOSED').toUpperCase();
    if (winVis !== 'TRANSPARENT') {
      return res.status(403).json({
        success: false,
        error: 'Presence only for TRANSPARENT windows',
        code: 'WINDOW_CLOSED',
      });
    }
    const { touchWindowReader } = await import('../services/windowReaderService.js');
    const touched = await touchWindowReader(req.params.id, req.user.userId);
    return res.json({ success: true, data: { reader_count: touched.reader_count } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update presence' });
  }
});

// PATCH /api/rituals/:id/end - backend-yeni.md contract
router.patch('/:id/end', authenticateToken, async (req, res) => {
  try {
    const ritualCheck = await pool.query(
      'SELECT id, host_id FROM rituals WHERE id = $1',
      [req.params.id]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    if (ritualCheck.rows[0].host_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Only host can end ritual' });
    }
    const transition = await transitionLiveToWindow(req.params.id);
    const result = await pool.query(`SELECT * FROM rituals WHERE id = $1`, [req.params.id]);
    return res.json({ success: true, data: result.rows[0], transition });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to end ritual' });
  }
});

// PATCH /api/rituals/:id/extend-window - backend-yeni.md contract
router.patch('/:id/extend-window', authenticateToken, async (req, res) => {
  try {
    const { hours } = req.body;
    const allowed = [3, 6, 12, 24];
    const nextHours = Number(hours);
    if (!allowed.includes(nextHours)) {
      return res.status(400).json({ success: false, error: 'Invalid window extension hours' });
    }
    const ritualCheck = await pool.query(
      'SELECT id, host_id FROM rituals WHERE id = $1',
      [req.params.id]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    if (ritualCheck.rows[0].host_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Only host can extend window' });
    }
    const result = await pool.query(
      `UPDATE rituals
       SET live_window_hours = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [req.params.id, nextHours]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to extend ritual window' });
  }
});

// POST /api/rituals/:id/feedback - backend-yeni.md contract alias
router.post('/:id/feedback', authenticateToken, async (req, res) => {
  req.body = {
    ...req.body,
    ritual_id: req.params.id,
    from_user_id: req.user?.userId,
  };
  return feedbackRouter.handle(
    { ...req, method: 'POST', url: '/' },
    res
  );
});

// POST /api/rituals/:id/invites - Create an invite token (host or participants only)
// Protected: inviter_id must match authenticated user
router.post('/:id/invites', authenticateToken, async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Ritual davet kotası/Faz-B mekanizması kaldırıldı',
    code: 'INVITE_PHASE_B_REMOVED',
  });
});

// --- Live Activity (F6 §8.4) ---
router.get('/:id/live-activity', authenticateToken, async (req, res) => {
  try {
    const { getLiveActivityForUser } = await import('../services/liveActivityService.js');
    const result = await getLiveActivityForUser(req.user.userId, req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load live activity' });
  }
});

router.post('/:id/live-activity/start', authenticateToken, async (req, res) => {
  try {
    const { startLiveActivitySession } = await import('../services/liveActivityService.js');
    const result = await startLiveActivitySession(
      req.user.userId,
      req.params.id,
      req.body?.platform || 'unknown'
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to start live activity' });
  }
});

router.post('/:id/live-activity/end', authenticateToken, async (req, res) => {
  try {
    const { endLiveActivitySession } = await import('../services/liveActivityService.js');
    const result = await endLiveActivitySession(req.user.userId, req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to end live activity' });
  }
});

export default router;
