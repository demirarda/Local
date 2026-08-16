import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { JWT_SECRET } from '../api/auth.js';
import { getUniversityFromEmail } from '../utils/universityDomain.js';
import { updateRSForRitualParticipants } from './rsEngine.js';
import { updateDsForUser } from './dsUpdate.js';
import { applyFriendshipLevelOnCheckin } from './friendshipLevel.js';
import { cleanupExpiredMemories } from '../api/memories.js';
import { sendNotificationToUser } from './notifications.js';
import { evaluateBadgesForRitual } from './badgeEvaluation.js';
import { createPresignedUploadUrl, verifyS3ObjectExists } from '../utils/s3Media.js';
import { enqueue } from './queueSystem.js';

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const AuthService = {
  verifyJwt(token) {
    return jwt.verify(token, JWT_SECRET);
  },
  generateOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  },
  resolveUniversity(email) {
    return getUniversityFromEmail(email);
  },
};

export const UserService = {
  async getProfile(userId) {
    const r = await pool.query('SELECT id, name, email, city, university, rs_score, avatar_url FROM users WHERE id = $1 LIMIT 1', [userId]);
    return r.rows[0] || null;
  },
};

export const RitualService = {
  async getById(ritualId) {
    const r = await pool.query('SELECT * FROM rituals WHERE id = $1 LIMIT 1', [ritualId]);
    return r.rows[0] || null;
  },
};

export const CheckinService = {
  distanceMeters: haversineMeters,
};

export const FeedbackService = {
  async hasSubmitted(fromUserId, ritualId, feedbackType, toUserId) {
    const r = await pool.query(
      `SELECT 1 FROM feedback
       WHERE from_user_id = $1 AND ritual_id = $2 AND feedback_type = $3
         AND COALESCE(to_user_id, '00000000-0000-0000-0000-000000000000') = COALESCE($4, '00000000-0000-0000-0000-000000000000')
       LIMIT 1`,
      [fromUserId, ritualId, feedbackType, toUserId || null]
    );
    return r.rows.length > 0;
  },
};

export const RSCalculationService = {
  updateRSForRitualParticipants,
};

export const DSService = {
  updateDsForUser,
};

export const FriendshipService = {
  applyFriendshipLevelOnCheckin,
};

export const MemoryService = {
  cleanupExpiredMemories,
};

export const ChatService = {
  normalizeType(type) {
    const allowed = new Set(['text', 'photo', 'quote', 'playlist', 'voice']);
    return allowed.has(type) ? type : 'text';
  },
};

export const NotificationService = {
  sendNotificationToUser,
};

export const BadgeService = {
  evaluateBadgesForRitual,
};

export const VenueService = {
  async getVenueRs(venueId) {
    const r = await pool.query('SELECT ROUND(AVG(rating)::numeric, 2) AS avg FROM venue_ratings WHERE venue_id = $1', [venueId]);
    return r.rows[0]?.avg != null ? Number(r.rows[0].avg) : null;
  },
};

export const ReportService = {
  async countByStatus() {
    const r = await pool.query('SELECT status, COUNT(*)::int AS total FROM reports GROUP BY status');
    return r.rows;
  },
};

export const MediaService = {
  createPresignedUploadUrl,
  verifyS3ObjectExists,
};

export const UniversityService = {
  resolveByEmail(email) {
    return getUniversityFromEmail(email);
  },
};

export const CronService = {
  enqueue,
};

export const SearchService = {
  async searchRituals(q, limit = 20) {
    const r = await pool.query(
      `SELECT id, title, location_name, start_time
       FROM rituals
       WHERE to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(location_name, ''))
             @@ plainto_tsquery('simple', $1)
       ORDER BY start_time DESC
       LIMIT $2`,
      [q, Math.max(1, Math.min(Number(limit) || 20, 100))]
    );
    return r.rows;
  },
};

export const AnalyticsService = {
  async weeklyCityStats() {
    const r = await pool.query(
      `SELECT u.city,
              COUNT(DISTINCT u.id)::int AS active_users,
              COUNT(DISTINCT rt.id)::int AS ritual_count
       FROM users u
       LEFT JOIN rituals rt ON rt.city = u.city
         AND rt.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
       WHERE u.last_login >= CURRENT_TIMESTAMP - INTERVAL '7 days'
       GROUP BY u.city
       ORDER BY active_users DESC`
    );
    return r.rows;
  },
};
