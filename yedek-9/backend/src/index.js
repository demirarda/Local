import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import logger from './utils/logger.js';
import pool from './config/database.js';
import { defaultLiveWindowHours } from './config/localConfig.js';
import redis from './config/redis.js';
import { initSentry } from './utils/sentry.js';
import { securityHeaders, validateEnvironmentVariables, enforceHttps } from './middleware/security.js';
import { sendError } from './utils/errorResponse.js';
import ritualsRouter from './api/rituals.js';
import feedbackRouter from './api/feedback.js';
import attendanceRouter from './api/attendance.js';
import usersRouter from './api/users.js';
import cityRhythmRouter from './api/cityRhythm.js';
import friendsRouter from './api/friends.js';
import followsRouter from './api/follows.js';
import chatRouter from './api/chat.js';
import memoriesRouter from './api/memories.js';
import safetyRouter from './api/safety.js';
import notificationsRouter from './api/notifications.js';
import vibesRouter from './api/vibes.js';
import verificationsRouter from './api/verifications.js';
import interestsRouter from './api/interests.js';
import messagesRouter from './api/messages.js';
import friendsDmRouter from './api/friendsDm.js';
import waitlistRouter from './api/waitlist.js';
import citiesRouter from './api/cities.js';
import geoRouter from './api/geo.js';
import forumRouter from './api/forum.js';
import shareRouter from './api/share.js';
import analyticsRouter from './api/analytics.js';
import adminRouter from './api/admin.js';
import authRouter from './api/auth.js';
import mediaRouter from './api/media.js';
import { JWT_SECRET } from './api/auth.js';
import venuesRouter from './api/venues.js';
import badgesRouter from './api/badges.js';
import configRouter from './api/config.js';
import venueFollowsRouter from './api/venueFollows.js';
import identityRouter from './api/identity.js';
import searchRouter from './api/search.js';
import modRouter from './api/mod.js';
import zonesRouter from './api/zones.js';
import eventGroupsRouter from './api/eventGroups.js';
import seriesRouter from './api/series.js';
import nominationsRouter from './api/nominations.js';
import webShowcaseRouter from './api/webShowcase.js';
import savesRouter from './api/saves.js';
import collaboratorsRouter from './api/collaborators.js';
import affiliationsRouter from './api/affiliations.js';
import {
  handleRitualSubscribe,
  handleRitualUnsubscribe,
  handlePulseSubscribe,
  handlePulseUnsubscribe,
  emitRitualUpdate,
  emitPulseUpdate
} from './websocket/ritualHandlers.js';

// Load environment variables
dotenv.config();

// Initialize Sentry (error tracking)
initSentry();

// Validate environment variables
validateEnvironmentVariables();

const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN || (isProduction ? undefined : '*');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io message limiter: 30 messages/min per user+room
const socketMessageWindow = new Map();
function hitSocketMessageLimit(userId, ritualId) {
  const minuteKey = Math.floor(Date.now() / 60000);
  const key = `${userId}:${ritualId}:${minuteKey}`;
  const nextCount = (socketMessageWindow.get(key) || 0) + 1;
  socketMessageWindow.set(key, nextCount);
  return nextCount > 30;
}
const socketLifecycleEmits = new Set();

// Socket auth (backend-yeni.md: JWT zorunlu)
io.use((socket, next) => {
  try {
    const authToken = socket.handshake?.auth?.token;
    const headerToken = socket.handshake?.headers?.authorization;
    const raw = authToken || headerToken || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;

    if (!token) {
      return next(new Error('Unauthorized: missing token'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.userId = decoded.userId;
    socket.data.email = decoded.email;
    return next();
  } catch (error) {
    return next(new Error('Unauthorized: invalid token'));
  }
});

const PORT = process.env.PORT || 3000;

// Keep one source of truth for API prefixes during migration.
const API_LEGACY_PREFIX = '/api';
const API_V1_PREFIX = '/api/v1';

// Initialize chat WebSocket handlers (after io is created)
import { initializeChatHandlers } from './websocket/chatHandlers.js';
import { initQueueSystem, enqueue } from './services/queueSystem.js';

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com'
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.tailwindcss.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
      ],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Socket.io
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(enforceHttps);
app.use(securityHeaders);
// Local media PUT must receive raw bytes (before JSON parser)
app.use('/api/media/put', express.raw({ type: '*/*', limit: '90mb' }));
app.use('/api/v1/media/put', express.raw({ type: '*/*', limit: '90mb' }));
// Stripe webhook signature needs the untouched raw body (before JSON parser)
app.use('/api/venues/stripe-webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/v1/venues/stripe-webhook', express.raw({ type: '*/*', limit: '1mb' }));
// KYC provider webhook — HMAC over raw body
app.use('/api/identity/kyc-webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use('/api/v1/identity/kyc-webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - General API (backend-yeni.md §5.2: 100 req/min per user)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) return `user:${decoded.userId}`;
      } catch (_e) {
        // fall back to IP
      }
    }
    return `ip:${req.ip}`;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api';
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Rate limiting - Ritual creation (stricter, only for POST)
const ritualCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.RATE_LIMIT_RITUAL_MAX)
    || (isProduction ? 5 : 10),
  message: 'Too many rituals created. Please try again later.',
  skip: (req) => req.method !== 'POST', // Only apply to POST requests
});
app.use('/api/rituals', ritualCreationLimiter);

// Rate limiting - Feedback submission (stricter)
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_FEEDBACK_MAX)
    || (isProduction ? 10 : 20),
  message: 'Too many feedback submissions. Please try again later.',
});
app.use('/api/feedback', feedbackLimiter);

// Health check - Basic
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check - Detailed (for monitoring systems)
app.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks: {},
  };

  try {
    // Database check
    const dbStartTime = Date.now();
    const dbCheck = await pool.query('SELECT 1 as health');
    const dbResponseTime = Date.now() - dbStartTime;
    
    health.checks.database = {
      status: dbCheck.rows[0] ? 'connected' : 'disconnected',
      responseTime: `${dbResponseTime}ms`,
    };
  } catch (error) {
    health.checks.database = {
      status: 'error',
      error: error.message,
    };
    health.status = 'unhealthy';
  }

  try {
    // Redis check
    const redisStartTime = Date.now();
    const redis = (await import('./config/redis.js')).default;
    await redis.ping();
    const redisResponseTime = Date.now() - redisStartTime;
    
    health.checks.redis = {
      status: 'connected',
      responseTime: `${redisResponseTime}ms`,
    };
  } catch (error) {
    health.checks.redis = {
      status: 'error',
      error: error.message,
    };
    health.status = 'unhealthy';
  }

  // Memory usage
  const memoryUsage = process.memoryUsage();
  health.checks.memory = {
    used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB',
  };

  // CPU usage (approximate)
  const cpuUsage = process.cpuUsage();
  health.checks.cpu = {
    user: Math.round(cpuUsage.user / 1000) + 'ms',
    system: Math.round(cpuUsage.system / 1000) + 'ms',
  };

  // Total response time
  health.checks.totalResponseTime = `${Date.now() - startTime}ms`;

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'LOCAL API',
    version: '1.0.0',
    status: 'running'
  });
});

// v1 entrypoint (target contract)
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'LOCAL API v1',
    version: '1.0.0',
    status: 'running',
  });
});

// Deprecation signal for legacy, non-versioned API routes.
app.use(API_LEGACY_PREFIX, (req, res, next) => {
  if (!req.path.startsWith('/v1')) {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  }
  next();
});

// Rituals API (pass io for WebSocket updates)
app.use('/api/rituals', (req, res, next) => {
  req.io = io; // Attach io to request
  next();
}, ritualsRouter);

// Feedback API
app.use('/api/feedback', feedbackRouter);

// Attendance API
app.use('/api/attendance', attendanceRouter);

// Users API
app.use('/api/users', usersRouter);

// City Rhythm API
app.use('/api/city-rhythm', cityRhythmRouter);

// Friends API
app.use('/api/friends', friendsRouter);
app.use('/api/friendships', friendsRouter); // backend-yeni.md alias

// Follows API
app.use('/api/follows', followsRouter);

// Venues API
app.use('/api/venues', venuesRouter);

// Badges API (F6)
app.use('/api/badges', badgesRouter);

// Public config (§12)
app.use('/api/config', configRouter);

// Venue follows API
app.use('/api/venue-follows', venueFollowsRouter);

// Chat API
app.use('/api/chat', chatRouter);

// Memories API
app.use('/api/memories', memoriesRouter);

// Safety API
app.use('/api/safety', safetyRouter);
app.use('/api/reports', (req, res, next) => {
  if (req.method === 'POST' && req.url === '/') {
    req.url = '/report';
  } else if (req.method === 'GET' && req.url === '/') {
    req.url = '/reports';
  } else if (req.method === 'PATCH' && /^\/[^/]+$/.test(req.url)) {
    req.url = `/reports${req.url}`;
  }
  next();
}, safetyRouter);

// Notifications API
app.use('/api/notifications', notificationsRouter);

// Vibes API
app.use('/api/vibes', vibesRouter);

// Verifications API
app.use('/api/verifications', verificationsRouter);

// Interests API
app.use('/api/interests', interestsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/friends-dm', friendsDmRouter);
app.use('/api/later', waitlistRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/geo', geoRouter);
app.use('/api/forum', forumRouter);
app.use('/api/share', shareRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', adminRouter);

// Auth API
app.use('/api/auth', authRouter);
app.use('/api/identity', identityRouter);
app.use('/api/media', mediaRouter);
app.use('/api/search', searchRouter);
app.use('/api/mod', modRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/event-groups', eventGroupsRouter);
app.use('/api/series', seriesRouter);
app.use('/api/nominations', nominationsRouter);
/** §12 WEB-VİTRİN — /w/* salt-okunur (WEB_SHOWCASE_ENABLED:false ile stub) */
app.use('/w', webShowcaseRouter);
app.use('/api/w', webShowcaseRouter);
app.use('/api/social', savesRouter);
app.use('/api/collaborators', collaboratorsRouter);
app.use('/api/affiliations', affiliationsRouter);

// v1 API Routes (preferred during contract migration)
app.use(`${API_V1_PREFIX}/rituals`, (req, res, next) => {
  req.io = io;
  next();
}, ritualsRouter);
app.use(`${API_V1_PREFIX}/feedback`, feedbackRouter);
app.use(`${API_V1_PREFIX}/attendance`, attendanceRouter);
app.use(`${API_V1_PREFIX}/users`, usersRouter);
app.use(`${API_V1_PREFIX}/city-rhythm`, cityRhythmRouter);
app.use(`${API_V1_PREFIX}/friends`, friendsRouter);
app.use(`${API_V1_PREFIX}/friendships`, friendsRouter); // compatibility alias
app.use(`${API_V1_PREFIX}/follows`, followsRouter);
app.use(`${API_V1_PREFIX}/venues`, venuesRouter);
app.use(`${API_V1_PREFIX}/config`, configRouter);
app.use(`${API_V1_PREFIX}/venue-follows`, venueFollowsRouter);
app.use(`${API_V1_PREFIX}/chat`, chatRouter);
app.use(`${API_V1_PREFIX}/memories`, memoriesRouter);
app.use(`${API_V1_PREFIX}/safety`, safetyRouter);
app.use(`${API_V1_PREFIX}/reports`, (req, res, next) => {
  if (req.method === 'POST' && req.url === '/') {
    req.url = '/report';
  } else if (req.method === 'GET' && req.url === '/') {
    req.url = '/reports';
  } else if (req.method === 'PATCH' && /^\/[^/]+$/.test(req.url)) {
    req.url = `/reports${req.url}`;
  }
  next();
}, safetyRouter);
app.use(`${API_V1_PREFIX}/notifications`, notificationsRouter);
app.use(`${API_V1_PREFIX}/vibes`, vibesRouter);
app.use(`${API_V1_PREFIX}/verifications`, verificationsRouter);
app.use(`${API_V1_PREFIX}/interests`, interestsRouter);
app.use(`${API_V1_PREFIX}/messages`, messagesRouter);
app.use(`${API_V1_PREFIX}/friends-dm`, friendsDmRouter);
app.use(`${API_V1_PREFIX}/later`, waitlistRouter);
app.use(`${API_V1_PREFIX}/cities`, citiesRouter);
app.use(`${API_V1_PREFIX}/geo`, geoRouter);
app.use(`${API_V1_PREFIX}/analytics`, analyticsRouter);
app.use(`${API_V1_PREFIX}/admin`, adminRouter);
app.use(`${API_V1_PREFIX}/auth`, authRouter);
app.use(`${API_V1_PREFIX}/media`, mediaRouter);
app.use(`${API_V1_PREFIX}/search`, searchRouter);
app.use(`${API_V1_PREFIX}/mod`, modRouter);
app.use(`${API_V1_PREFIX}/zones`, zonesRouter);
app.use(`${API_V1_PREFIX}/series`, seriesRouter);

// Admin panel (static)
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// Standalone admin HTML pages (served from project root)
const projectRoot = path.join(__dirname, '..', '..');

app.get('/dasboard.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'dasboard.html'));
});

app.get('/kullanici.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'kullanici.html'));
});

app.get('/rite.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'rite.html'));
});

app.get('/mekan.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'mekan.html'));
});

app.get('/bildirim.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'bildirim.html'));
});

app.get('/dogrulama.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'dogrulama.html'));
});

app.get('/anilar.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'anilar.html'));
});

// User uploads are served only through signed URLs (/api/media/access)

// Initialize chat WebSocket handlers
initializeChatHandlers(io);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('WebSocket client connected', { socketId: socket.id });
  if (socket.data?.userId) {
    socket.join(`user:${socket.data.userId}`);
    redis.set(`user_online:${socket.data.userId}`, '1', { EX: 30 }).catch(() => {});
  }

  socket.on('disconnect', () => {
    if (socket.data?.userId) {
      redis.del(`user_online:${socket.data.userId}`).catch(() => {});
    }
    if (socket.data?.currentRitualId && socket.data?.userId) {
      redis.sRem(`ritual_participants:${socket.data.currentRitualId}`, socket.data.userId).catch(() => {});
    }
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });

  socket.on('heartbeat', () => {
    if (socket.data?.userId) {
      redis.set(`user_online:${socket.data.userId}`, '1', { EX: 30 }).catch(() => {});
    }
  });

  // Ritual subscription
  socket.on('ritual:subscribe', (ritualId) => {
    socket.data.currentRitualId = ritualId;
    handleRitualSubscribe(socket, ritualId);
  });

  socket.on('ritual:unsubscribe', (ritualId) => {
    if (socket.data.currentRitualId === ritualId) {
      socket.data.currentRitualId = null;
    }
    handleRitualUnsubscribe(socket, ritualId);
  });

  // Pulse subscription
  socket.on('pulse:subscribe', (city) => {
    handlePulseSubscribe(socket, city);
  });

  socket.on('pulse:unsubscribe', (city) => {
    handlePulseUnsubscribe(socket, city);
  });

  // backend-yeni.md aliases
  socket.on('join_ritual_window', (ritualId) => {
    socket.data.currentRitualId = ritualId;
    handleRitualSubscribe(socket, ritualId);
    if (socket.data?.userId) {
      redis.sAdd(`ritual_participants:${ritualId}`, socket.data.userId).catch(() => {});
      redis.expire(`ritual_participants:${ritualId}`, 24 * 60 * 60).catch(() => {});
      redis.set(`user_online:${socket.data.userId}`, '1', { EX: 30 }).catch(() => {});
    }
    pool.query(
      `SELECT u.id, u.name, ra.status, ra.checkin_at
       FROM ritual_attendance ra
       JOIN users u ON u.id = ra.user_id
       WHERE ra.ritual_id = $1
         AND ra.status::text NOT IN ('no_show', 'cancelled')
       ORDER BY ra.created_at ASC`,
      [ritualId]
    ).then((r) => {
      socket.emit('ritual_participants', {
        ritual_id: ritualId,
        participants: r.rows,
      });
    }).catch(() => {});
    socket.to(`ritual:${ritualId}`).emit('participant_joined', {
      ritual_id: ritualId,
      user_id: socket.data.userId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('leave_ritual_window', (ritualId) => {
    if (socket.data.currentRitualId === ritualId) {
      socket.data.currentRitualId = null;
    }
    handleRitualUnsubscribe(socket, ritualId);
    if (socket.data?.userId) {
      redis.sRem(`ritual_participants:${ritualId}`, socket.data.userId).catch(() => {});
    }
    socket.to(`ritual:${ritualId}`).emit('participant_left', {
      ritual_id: ritualId,
      user_id: socket.data.userId,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('user_typing', (payload = {}) => {
    const ritualId = payload.ritual_id || socket.data.currentRitualId;
    if (!ritualId) return;
    socket.to(`ritual:${ritualId}`).emit('user_typing', {
      ritual_id: ritualId,
      user_id: socket.data.userId,
      typing: payload.typing !== false,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('react_message', (payload = {}) => {
    const ritualId = payload.ritual_id || socket.data.currentRitualId;
    if (!ritualId || !payload.message_id) return;
    io.to(`ritual:${ritualId}`).emit('react_message', {
      ritual_id: ritualId,
      message_id: payload.message_id,
      user_id: socket.data.userId,
      reaction: payload.reaction || 'heart',
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('send_message', async (payload = {}) => {
    try {
      const ritualId = payload.ritual_id || socket.data.currentRitualId;
      const content = payload.content;
      const type = payload.type || 'text';
      const mediaUrl = payload.media_url || null;
      const externalUrl = payload.external_url || null;
      const allowedTypes = new Set(['text', 'photo', 'quote', 'playlist', 'voice']);
      if (!ritualId || !content) return;
      if (!allowedTypes.has(type)) return;
      redis.set(`user_online:${socket.data.userId}`, '1', { EX: 30 }).catch(() => {});
      if (hitSocketMessageLimit(socket.data.userId, ritualId)) {
        socket.emit('error', { code: 'rate_limited', message: 'Socket message rate limit exceeded' });
        return;
      }

      const attendance = await pool.query(
        `SELECT 1
         FROM ritual_attendance
         WHERE ritual_id = $1 AND user_id = $2 AND status != 'no_show'
         LIMIT 1`,
        [ritualId, socket.data.userId]
      );
      if (attendance.rows.length === 0) return;

      const inserted = await pool.query(
        `INSERT INTO chat_messages (ritual_id, user_id, message, message_type, media_url, external_url, content, type)
         VALUES ($1, $2, $3, 'user', $4, $5, $3, $6::chat_message_type)
         RETURNING id, ritual_id, user_id, message, message_type, media_url, external_url, content, type, created_at`,
        [ritualId, socket.data.userId, String(content).trim(), mediaUrl, externalUrl, type]
      );
      const userResult = await pool.query(
        'SELECT name, rs_score FROM users WHERE id = $1',
        [socket.data.userId]
      );
      const user = userResult.rows[0] || {};
      const message = inserted.rows[0];

      io.to(`ritual:${ritualId}`).emit('new_message', {
        id: message.id,
        ritual_id: message.ritual_id,
        user_id: message.user_id,
        user_name: user.name || 'Unknown',
        user_rs_score: parseFloat(user.rs_score) || 0,
        content: message.content || message.message,
        type: message.type || type,
        media_url: message.media_url,
        external_url: message.external_url,
        created_at: message.created_at,
      });

      const ritualPhase = await pool.query(
        `SELECT status::text AS status FROM rituals WHERE id = $1`,
        [ritualId]
      );
      const phase = ritualPhase.rows[0]?.status;
      if (phase && ['prelobby', 'active', 'live'].includes(phase)) {
        const { notifyPrelobbyMessage } = await import('./services/notifications.js');
        const peers = await pool.query(
          `SELECT user_id FROM ritual_attendance
           WHERE ritual_id = $1 AND user_id != $2
             AND status::text NOT IN ('no_show', 'cancelled')`,
          [ritualId, socket.data.userId]
        );
        const preview = message.content || message.message;
        for (const peer of peers.rows) {
          notifyPrelobbyMessage(peer.user_id, {
            ritualId,
            senderUserId: socket.data.userId,
            senderName: user.name || 'Biri',
            preview,
          }).catch(() => {});
        }
      }
    } catch (error) {
      logger.warn('send_message socket event failed', { error: error.message });
    }
  });
});

// Export io for use in API routes
export { app, io, emitRitualUpdate, emitPulseUpdate };

// Error handling
app.use(async (err, req, res, next) => {
  // Log error (don't expose sensitive info in logs)
  logger.error('Unhandled error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Only log stack in dev
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send to Sentry (non-blocking)
  try {
    const { captureException } = await import('./utils/sentry.js');
    captureException(err, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      // Don't send body/query to Sentry in production (may contain sensitive data)
      ...(process.env.NODE_ENV === 'development' ? { body: req.body, query: req.query } : {}),
    });
  } catch (sentryError) {
    // Ignore Sentry errors - don't block response
  }

  // Don't expose error details in production
  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'Something went wrong!',
    process.env.NODE_ENV === 'development' ? { message: err.message } : undefined
  );
});

// 404 handler
app.use((req, res) => {
  return sendError(res, 404, 'ROUTE_NOT_FOUND', 'Route not found');
});

// Start server (skip when running tests so Jest can import app without binding the port)
if (process.env.NODE_ENV !== 'test') {
  initQueueSystem().catch((err) => {
    logger.warn('Queue system init failed', { error: err.message });
  });

  import('node-cron').then((cron) => {
    import('./services/ritualCompletion.js').then(({ checkAndStartRituals, checkAndCloseCheckinDoors, checkAndTransitionLiveToWindow, checkAndArchiveRituals }) => {
      import('./services/badgeEvaluation.js').then(({ evaluateDailyActivityBadges }) => {
      cron.default.schedule('* * * * *', async () => {
        try {
          await checkAndStartRituals();
          await checkAndCloseCheckinDoors();
          const windowRituals = await checkAndTransitionLiveToWindow();
          for (const row of windowRituals) {
            const windowEmitKey = `ritual_window:${row.id}`;
            if (!socketLifecycleEmits.has(windowEmitKey)) {
              await redis.set(`ritual_status:${row.id}`, 'window', { EX: 48 * 60 * 60 }).catch(() => {});
              io.to(`ritual:${row.id}`).emit('ritual_window_opened', {
                ritual_id: row.id,
                timestamp: new Date().toISOString(),
              });
              socketLifecycleEmits.add(windowEmitKey);
            }
          }
          const archivedRituals = await checkAndArchiveRituals();
          for (const row of archivedRituals) {
            const archiveKey = `ritual_archived:${row.id}`;
            if (!socketLifecycleEmits.has(archiveKey)) {
              await redis.set(`ritual_status:${row.id}`, 'archived', { EX: 48 * 60 * 60 }).catch(() => {});
              io.to(`ritual:${row.id}`).emit('ritual_archived', {
                ritual_id: row.id,
                window_type: row.window_type,
                timestamp: new Date().toISOString(),
              });
              socketLifecycleEmits.add(archiveKey);
            }
          }

          // Window lifecycle events
          const windows = await pool.query(
            `SELECT id, start_time, duration, window_ends_at, COALESCE(live_window_hours, ${defaultLiveWindowHours()}) AS live_window_hours
             FROM rituals
             WHERE status::text IN ('window', 'ended')`
          );
          const now = Date.now();
          for (const ritual of windows.rows) {
            const closeMs = ritual.window_ends_at
              ? new Date(ritual.window_ends_at).getTime()
              : new Date(ritual.start_time).getTime()
                + Number(ritual.duration || 0) * 60000
                + Number(ritual.live_window_hours || defaultLiveWindowHours()) * 3600000;
            const closeIso = new Date(closeMs).toISOString();
            const diffMin = Math.ceil((closeMs - now) / 60000);
            if (now < closeMs) {
              await redis.set(`ritual_status:${ritual.id}`, 'window_open', { EX: 24 * 60 * 60 }).catch(() => {});
              await redis.set(`ritual_window_end:${ritual.id}`, closeIso, { EX: 24 * 60 * 60 }).catch(() => {});
            }
            if (diffMin <= 30 && diffMin > 0) {
              const expKey = `window_expiring:${ritual.id}:${Math.floor(now / 60000)}`;
              if (!socketLifecycleEmits.has(expKey)) {
                io.to(`ritual:${ritual.id}`).emit('window_expiring', {
                  ritual_id: ritual.id,
                  minutes_left: diffMin,
                  timestamp: new Date().toISOString(),
                });
                socketLifecycleEmits.add(expKey);
              }
            }
          }

          const { pushLiveActivityUpdatesForActiveSessions } = await import('./services/liveActivityService.js');
          await pushLiveActivityUpdatesForActiveSessions().catch(() => {});

          const {
            processPrelobbyGraceUnlocks,
            processDoorClosingWarnings,
            processPenaltyEndNotifications,
          } = await import('./services/ritualNotificationCron.js');
          await processPrelobbyGraceUnlocks().catch(() => {});
          await processDoorClosingWarnings().catch(() => {});
          await processPenaltyEndNotifications().catch(() => {});

          try {
            const { dispatchDueNightReports } = await import('./services/nightReportService.js');
            await dispatchDueNightReports().catch(() => {});
            const { expireDueSuggestions } = await import('./services/venueSlotService.js');
            await expireDueSuggestions().catch(() => {});
          } catch (_e) {
            /* §8 night digest / suggestion expire — best effort */
          }
        } catch (err) {
          logger.warn('Cron ritual check failed', { error: err.message });
        }
      });
      logger.info('Cron: ritual lifecycle every minute');

      // Ritual reminder: start_time - 2 hours (every 15 minutes)
      cron.default.schedule('*/15 * * * *', async () => {
        try {
          const reminders = await pool.query(
            `SELECT r.id AS ritual_id, r.title, ra.user_id
             FROM rituals r
             JOIN ritual_attendance ra ON ra.ritual_id = r.id
             WHERE r.status::text IN ('prelobby', 'active', 'live')
               AND ra.status::text NOT IN ('no_show', 'cancelled')
               AND r.start_time > NOW()
               AND r.start_time <= NOW() + INTERVAL '2 hours'`
          );
          for (const row of reminders.rows) {
            await enqueue(
              'ritual-reminder',
              {
                user_id: row.user_id,
                ritual_id: row.ritual_id,
                title: row.title,
              },
              { priority: 2, jobId: `ritual-reminder:${row.ritual_id}:${row.user_id}` }
            );
          }
        } catch (err) {
          logger.warn('Cron ritual reminder failed', { error: err.message });
        }
      });

      // Feedback deadline reminder: window_end - 6 hours (hourly cron)
      cron.default.schedule('0 * * * *', async () => {
        try {
          const { processFeedbackClosingWarnings } = await import('./services/ritualNotificationCron.js');
          await processFeedbackClosingWarnings();
          const feedbackNotifications = await pool.query(
            `SELECT r.id AS ritual_id, r.title, ra.user_id
             FROM rituals r
             JOIN ritual_attendance ra ON ra.ritual_id = r.id
             WHERE ra.status::text NOT IN ('no_show', 'cancelled')
               AND (
                 r.start_time
                 + (COALESCE(r.duration, 60)::text || ' minutes')::interval
                 + INTERVAL '18 hours'
               ) <= NOW()
               AND (
                 r.start_time
                 + (COALESCE(r.duration, 60)::text || ' minutes')::interval
                 + INTERVAL '18 hours'
               ) > NOW() - INTERVAL '1 minute'`
          );
          for (const row of feedbackNotifications.rows) {
            await enqueue(
              'feedback-deadline',
              {
                user_id: row.user_id,
                ritual_id: row.ritual_id,
                title: row.title,
                mode: 'notify',
              },
              { priority: 5, jobId: `feedback-deadline-notify:${row.ritual_id}:${row.user_id}` }
            );
          }
        } catch (err) {
          logger.warn('Cron feedback deadline reminder failed', { error: err.message });
        }
      });

      // Venue update digest: followed venues with rituals today (08:00)
      cron.default.schedule('0 8 * * *', async () => {
        try {
          const venueDigest = await pool.query(
            `SELECT vf.user_id, v.id AS venue_id, v.name AS venue_name, MIN(r.id) AS ritual_id, MIN(r.title) AS ritual_title
             FROM venue_follows vf
             JOIN venues v ON v.id = vf.venue_id
             JOIN rituals r ON r.venue_id = v.id
             WHERE DATE(r.start_time) = CURRENT_DATE
             GROUP BY vf.user_id, v.id, v.name`
          );
          for (const row of venueDigest.rows) {
            await enqueue(
              'venue-daily-digest',
              {
                user_id: row.user_id,
                venue_id: row.venue_id,
                venue_name: row.venue_name,
                ritual_id: row.ritual_id,
                ritual_title: row.ritual_title,
              },
              { priority: 4, jobId: `venue-update:${row.user_id}:${row.venue_id}:${new Date().toISOString().slice(0, 10)}` }
            );
          }
        } catch (err) {
          logger.warn('Cron venue digest failed', { error: err.message });
        }
      });

      // sonMD weekly digest — Sunday 10:00 (FOMO-free copy)
      cron.default.schedule('0 10 * * 0', async () => {
        try {
          const { sendWeeklyDigests } = await import('./services/notifications.js');
          await sendWeeklyDigests({ limit: 2000 });
        } catch (err) {
          logger.warn('Cron weekly digest failed', { error: err.message });
        }
      });

      // Activity badges: daily at 00:00 for last-30-day checks
      cron.default.schedule('0 0 * * *', async () => {
        try {
          await evaluateDailyActivityBadges();
        } catch (err) {
          logger.warn('Cron daily badge evaluation failed', { error: err.message });
        }
      });

      // Media cleanup (daily 02:00)
      cron.default.schedule('0 2 * * *', async () => {
        try {
          await enqueue('media-cleanup', {}, { priority: 5, jobId: `media-cleanup:${new Date().toISOString().slice(0, 10)}` });
        } catch (err) {
          logger.warn('Cron media cleanup enqueue failed', { error: err.message });
        }
      });

      // DS score recomputation (daily 02:00)
      cron.default.schedule('0 2 * * *', async () => {
        try {
          const users = await pool.query(`SELECT id FROM users`);
          for (const row of users.rows) {
            await enqueue('ds-update', { user_id: row.id }, { priority: 7, jobId: `ds-nightly:${new Date().toISOString().slice(0, 10)}:${row.id}` });
          }
        } catch (err) {
          logger.warn('Cron nightly DS update failed', { error: err.message });
        }
      });

      // Cleanup: email verification codes (daily 03:00)
      cron.default.schedule('0 3 * * *', async () => {
        try {
          await pool.query(
            `DELETE FROM email_verifications
             WHERE is_used = false
               AND expires_at < CURRENT_TIMESTAMP`
          );
        } catch (err) {
          logger.warn('Cron email verification cleanup failed', { error: err.message });
        }
      });

      // Cleanup: old refresh tokens (weekly, 90+ days)
      cron.default.schedule('0 4 * * 0', async () => {
        try {
          await pool.query(
            `DELETE FROM refresh_tokens
             WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`
          );
        } catch (err) {
          logger.warn('Cron refresh token cleanup failed', { error: err.message });
        }
      });

      // Venue RS refresh (daily 01:00)
      cron.default.schedule('0 1 * * *', async () => {
        try {
          await pool.query(
            `UPDATE venues v
             SET venue_rs = COALESCE((
               SELECT ROUND(AVG(vr.rating)::numeric, 2)
               FROM venue_ratings vr
               WHERE vr.venue_id = v.id
             ), 5.0),
             updated_at = CURRENT_TIMESTAMP`
          );
          const { refreshVenueSeatingNotifications } = await import('./services/venueTrustAuraService.js');
          const venueIds = await pool.query(`SELECT id FROM venues`);
          for (const row of venueIds.rows) {
            await refreshVenueSeatingNotifications(row.id).catch(() => {});
          }
        } catch (err) {
          logger.warn('Cron venue RS refresh failed', { error: err.message });
        }
      });

      // Recurring ritual instance stub (daily 01:30)
      cron.default.schedule('30 1 * * *', async () => {
        try {
          const { generateSeriesInstances } = await import('./services/seriesService.js');
          const result = await generateSeriesInstances();
          if (result.created > 0) {
            logger.info('Recurring ritual instances generated', result);
          }
        } catch (err) {
          logger.warn('Cron recurring ritual stub failed', { error: err.message });
        }
      });

      // Weekly city statistics report
      cron.default.schedule('0 5 * * 0', async () => {
        try {
          const stats = await pool.query(
            `SELECT u.city,
                    COUNT(DISTINCT u.id)::int AS active_users,
                    COUNT(DISTINCT r.id)::int AS ritual_count
             FROM users u
             LEFT JOIN rituals r
               ON r.city = u.city
              AND r.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
             WHERE u.last_login >= CURRENT_TIMESTAMP - INTERVAL '7 days'
             GROUP BY u.city
             ORDER BY active_users DESC`
          );
          logger.info('Weekly city statistics generated', { cities: stats.rows });
        } catch (err) {
          logger.warn('Cron city statistics failed', { error: err.message });
        }
      });
      });
    });
  });

  // Listen on all network interfaces (0.0.0.0) so it's accessible from physical devices
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 LOCAL Backend running on port ${PORT}`);
    logger.info(`📡 WebSocket server ready`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 Accessible at: http://localhost:${PORT}`);
    
    // Log startup info
    logger.info('Application started', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });
  });
}
