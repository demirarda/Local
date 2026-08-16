import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../config/database.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js';
import { getUniversityFromEmail, validateUniversityEmail } from '../utils/universityDomain.js';
import { sanitizeString, checkSQLInjection } from '../middleware/security.js';
import logger from '../utils/logger.js';
import { enqueue } from '../services/queueSystem.js';
import { sendError } from '../utils/errorResponse.js';
import { getUserPenaltyStatus } from '../services/penaltyService.js';
import { bindUniversityIdentityHash } from '../services/identityService.js';

const router = express.Router();

// Validate JWT_SECRET configuration (all environments)
const DEFAULT_DEV_JWT_SECRET = 'local-dev-secret-change-in-production';
const isProductionEnv = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  const message = 'JWT_SECRET environment variable must be set';
  if (isProductionEnv) {
    throw new Error(message);
  } else {
    // In non-production, log a clear warning to avoid silently using insecure defaults
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${message}. Set a strong secret in your .env file.`);
  }
}

if (process.env.JWT_SECRET === DEFAULT_DEV_JWT_SECRET && isProductionEnv) {
  throw new Error('Insecure JWT_SECRET value in production. Change JWT_SECRET to a strong, random value.');
}

export const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const BCRYPT_COST = 12;

function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  return passwordRegex.test(password);
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `ip:${req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many register attempts. Try again later.'
  }
});

const verifyEmailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `user:${req.user?.userId || 'anonymous'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many verification email requests. Try again later.'
  }
});

function buildAccessToken(userId, email) {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function buildRefreshToken(userId, email) {
  return jwt.sign(
    { userId, email, typ: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function authenticateRefreshRequest(req, res, next) {
  const cookies = parseCookieHeader(req.headers.cookie || '');
  const provided = req.body?.refresh_token || cookies.refresh_token;
  if (!provided) {
    return res.status(401).json({
      success: false,
      error: 'refresh_token is required'
    });
  }

  try {
    jwt.verify(provided, JWT_REFRESH_SECRET);
    req.refreshToken = provided;
    return next();
  } catch (_e) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
}

async function ensureRefreshTokenTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      replaced_by_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)'
  );
}

async function storeRefreshToken(userId, rawToken) {
  const decoded = jwt.verify(rawToken, JWT_REFRESH_SECRET);
  const expiresAt = new Date(decoded.exp * 1000);
  const tokenHash = hashToken(rawToken);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
  return { tokenHash, expiresAt };
}

async function enqueueEmailOrFallback(kind, payload) {
  try {
    await enqueue('email-send', { kind, payload }, { priority: 5 });
    return true;
  } catch (_e) {
    if (kind === 'verification') {
      await sendVerificationEmail(payload?.email, payload?.token, payload?.code);
      return true;
    }
    if (kind === 'password_reset') {
      await sendPasswordResetEmail(payload?.email, payload?.token);
      return true;
    }
    return false;
  }
}

async function createEmailVerificationOtp(userId, email) {
  const otpCode = generateOtpCode();
  const codeHash = await bcrypt.hash(otpCode, BCRYPT_COST);
  await pool.query(
    `INSERT INTO email_verifications (user_id, email, code, code_hash, expires_at, is_used, attempt_count)
     VALUES ($1, $2, NULL, $3, NOW() + INTERVAL '5 minutes', false, 0)`,
    [userId, String(email).toLowerCase(), codeHash]
  );
  return otpCode;
}

// POST /api/auth/register - Track A (university email) OR Track B (identity KYC)
router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    let { email, password, name, city, university, track } = req.body;
    const identityTrack = track === 'identity' ? 'identity' : 'university';

    // Sanitize inputs
    email = sanitizeString(email);
    name = sanitizeString(name);
    city = sanitizeString(city);

    // Check for SQL injection patterns
    if (checkSQLInjection(email) || checkSQLInjection(name) || checkSQLInjection(city)) {
      logger.warn('Potential SQL injection attempt detected', { email, name, city });
      return res.status(400).json({
        success: false,
        error: 'Invalid input detected'
      });
    }

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, name'
      });
    }

    if (identityTrack === 'university' && !city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, name, city'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
    }

    let finalUniversity = null;
    if (identityTrack === 'university') {
      // REQUIRED: Check if email is from a university domain
      const detectedUniversity = getUniversityFromEmail(email);

      if (!detectedUniversity) {
        return res.status(400).json({
          success: false,
          error: 'Email must be from a recognized university domain. Only university students can register.',
          requires_university_email: true
        });
      }

      // Auto-fill university from detected domain
      finalUniversity = detectedUniversity.name;
    }

    // Track B: city seçimi KYC sonrası (CitySelection). users.city NOT NULL —
    // launch varsayılanı Milano; kullanıcı sonra değiştirir.
    const LAUNCH_CITY = 'Milano';
    const resolvedCity =
      city || (identityTrack === 'identity' ? LAUNCH_CITY : null);

    // Check if email exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Generate verification token (Track A email verify; Track B unused for gate)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24);

    let cityId = null;
    try {
      const cityRow = await pool.query(
        `INSERT INTO cities (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [resolvedCity]
      );
      cityId = cityRow.rows[0]?.id || null;
    } catch {
      try {
        const fallback = await pool.query(
          `SELECT id FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1`,
          [resolvedCity]
        );
        cityId = fallback.rows[0]?.id || null;
      } catch {
        cityId = null;
      }
    }

    const result = await pool.query(
      `INSERT INTO users (
         email, password_hash, name, city, university,
         verification_token, verification_token_expires,
         identity_track, uni_label_visible,
         city_id, active_city_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id, email, name, city, university, email_verified, identity_verified, age_ok, identity_track, uni_label_visible, created_at`,
      [
        email.toLowerCase(),
        passwordHash,
        name,
        resolvedCity,
        finalUniversity,
        verificationToken,
        verificationTokenExpires,
        identityTrack,
        identityTrack === 'university',
        cityId,
      ]
    );

    const user = result.rows[0];

    if (identityTrack === 'university') {
      const otpCode = await createEmailVerificationOtp(user.id, user.email);
      await enqueueEmailOrFallback('verification', {
        email: user.email,
        token: verificationToken,
        code: otpCode,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          city: user.city,
          university: user.university,
          university_auto_detected: true,
          email_verified: user.email_verified,
          identity_verified: false,
          identity_track: 'university',
          verified: false,
          message: 'Registration successful. Please check your email to verify your account.',
          ...(process.env.NODE_ENV === 'development' ? { dev_code: otpCode } : {}),
        }
      });
    }

    // Track B — provisional JWT so KYC can run; gate opens only after identity_verified
    const token = buildAccessToken(user.id, user.email);
    const refreshToken = buildRefreshToken(user.id, user.email);
    await ensureRefreshTokenTable();
    await storeRefreshToken(user.id, refreshToken);

    return res.status(201).json({
      success: true,
      data: {
        token,
        id: user.id,
        email: user.email,
        name: user.name,
        city: user.city,
        university: null,
        email_verified: false,
        identity_verified: false,
        age_ok: false,
        identity_track: 'identity',
        uni_label_visible: false,
        verified: false,
        requires_identity_kyc: true,
        message: 'Account created. Complete identity verification to enter LOCAL.',
      }
    });
  } catch (error) {
    logger.error('Error registering user', { error: error.message, stack: error.stack });
    const message = process.env.NODE_ENV === 'development' && error.message
      ? `Registration failed: ${error.message}`
      : 'Failed to register user';
    res.status(500).json({
      success: false,
      error: message
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Find user
    const result = await pool.query(
      `SELECT id, email, password_hash, name, city, university, email_verified,
              identity_verified, age_ok, identity_track, uni_label_visible, rs_score, suspended_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    if (user.suspended_at) {
      return res.status(403).json({
        success: false,
        error: 'Account suspended. Contact support.'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // §1 gate: Track A email OR Track B identity; Track B pending KYC may resume
    const gateOk = Boolean(user.email_verified || user.identity_verified);
    const pendingIdentityKyc =
      user.identity_track === 'identity' && !user.identity_verified && !user.email_verified;
    if (!gateOk && !pendingIdentityKyc) {
      return res.status(403).json({
        success: false,
        error: 'Email not verified. Please check your email.',
        requires_verification: true
      });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = buildAccessToken(user.id, user.email);
    const refreshToken = buildRefreshToken(user.id, user.email);
    await ensureRefreshTokenTable();
    await storeRefreshToken(user.id, refreshToken);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          city: user.city,
          university: user.identity_track === 'identity' ? null : user.university,
          rs_score: parseFloat(user.rs_score) || 5.0,
          email_verified: user.email_verified,
          identity_verified: Boolean(user.identity_verified),
          age_ok: Boolean(user.age_ok),
          identity_track: user.identity_track,
          uni_label_visible: user.identity_track === 'university' ? user.uni_label_visible !== false : false,
          verified: gateOk,
          requires_identity_kyc: pendingIdentityKyc,
        }
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login'
    });
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      'SELECT id, email, university, verification_token_expires FROM users WHERE verification_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
    }

    const user = result.rows[0];

    // Check if token expired
    if (new Date() > new Date(user.verification_token_expires)) {
      return res.status(400).json({
        success: false,
        error: 'Verification token expired'
      });
    }

    // L4: reject if uni-mail identity hash is blacklisted
    const bound = await bindUniversityIdentityHash(user.id, user.email);
    if (!bound.ok && bound.error === 'identity_blacklisted') {
      return res.status(403).json({
        success: false,
        error: 'identity_blacklisted',
        code: 'L4_RE_REGISTER_BLOCKED',
      });
    }
    if (!bound.ok && bound.error === 'identity_already_registered') {
      return res.status(409).json({
        success: false,
        error: 'identity_already_registered',
        code: 'RE_REGISTER_BLOCKED',
      });
    }

    // Verify email — Track A gate opens + durable identity_hash for L4
    await pool.query(
      `UPDATE users 
       SET email_verified = true,
           identity_track = COALESCE(identity_track, 'university'),
           age_ok = true,
           verification_token = NULL, 
           verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    // §2C UNI_AUTO affiliation from university domain/name
    try {
      const { upsertUniAutoAffiliation } = await import('../services/affiliationService.js');
      const uniName = user.university || null;
      if (uniName) {
        await upsertUniAutoAffiliation(user.id, uniName);
      } else if (user.email) {
        const { getUniversityFromEmail } = await import('../utils/universityDomain.js');
        const info = getUniversityFromEmail(user.email);
        if (info?.name) {
          await pool.query(
            `UPDATE users SET university = COALESCE(university, $1) WHERE id = $2`,
            [info.name, user.id]
          );
          await upsertUniAutoAffiliation(user.id, info.name);
        }
      }
    } catch (_e) {
      /* non-fatal */
    }

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email'
    });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await pool.query(
      'SELECT id, email, email_verified, verification_token FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24);

    await pool.query(
      `UPDATE users 
       SET verification_token = $1, 
           verification_token_expires = $2
       WHERE id = $3`,
      [verificationToken, verificationTokenExpires, user.id]
    );

    const otpCode = await createEmailVerificationOtp(user.id, user.email);
    // Send verification email (legacy link token) + OTP hash-at-rest record.
    await enqueueEmailOrFallback('verification', {
      email: user.email,
      token: verificationToken,
      code: otpCode,
    });

    res.json({
      success: true,
      message: 'Verification email sent',
      ...(process.env.NODE_ENV === 'development' ? { dev_code: otpCode } : {}),
    });
  } catch (error) {
    console.error('Error resending verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email'
    });
  }
});

// POST /api/auth/verify-email/send
// backend-yeni.md contract alias
router.post('/verify-email/send', authenticateToken, verifyEmailSendLimiter, async (req, res) => {
  req.body = { ...req.body, email: req.body?.email || req.user?.email };
  return router.handle(
    { ...req, method: 'POST', url: '/resend-verification' },
    res
  );
});

// POST /api/auth/verify-email/confirm
// backend-yeni.md contract alias (OTP-based confirmation; hashed-at-rest)
router.post('/verify-email/confirm', async (req, res) => {
  try {
    const code = req.body?.code || req.body?.token;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'code is required'
      });
    }

    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : null;
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }
    const userResult = await pool.query(`SELECT id, email, university FROM users WHERE email = $1 LIMIT 1`, [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'email is required and must be valid' });
    }
    const userId = userResult.rows[0].id;

    const verificationRow = await pool.query(
      `SELECT id, code_hash, expires_at, is_used, attempt_count
       FROM email_verifications
       WHERE user_id = $1
         AND email = $2
         AND is_used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, userResult.rows[0].email]
    );
    if (verificationRow.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Verification code not found' });
    }

    const record = verificationRow.rows[0];
    if (new Date(record.expires_at) <= new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code expired' });
    }
    if ((record.attempt_count || 0) >= 5) {
      return res.status(429).json({ success: false, error: 'Account temporarily locked due to too many failed verification attempts' });
    }

    const ok = await bcrypt.compare(String(code).trim(), record.code_hash || '');
    if (!ok) {
      await pool.query(
        `UPDATE email_verifications
         SET attempt_count = COALESCE(attempt_count, 0) + 1
         WHERE id = $1`,
        [record.id]
      );
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    await pool.query(
      `UPDATE email_verifications
       SET is_used = true
       WHERE id = $1`,
      [record.id]
    );

    const bound = await bindUniversityIdentityHash(userId, userResult.rows[0].email);
    if (!bound.ok && bound.error === 'identity_blacklisted') {
      return res.status(403).json({
        success: false,
        error: 'identity_blacklisted',
        code: 'L4_RE_REGISTER_BLOCKED',
      });
    }
    if (!bound.ok && bound.error === 'identity_already_registered') {
      return res.status(409).json({
        success: false,
        error: 'identity_already_registered',
        code: 'RE_REGISTER_BLOCKED',
      });
    }

    await pool.query(
      `UPDATE users
       SET email_verified = true,
           identity_track = COALESCE(identity_track, 'university'),
           age_ok = true,
           verification_token = NULL,
           verification_token_expires = NULL
       WHERE id = $1`,
      [userId]
    );

    try {
      const { upsertUniAutoAffiliation } = await import('../services/affiliationService.js');
      const uniName = userResult.rows[0].university || null;
      if (uniName) {
        await upsertUniAutoAffiliation(userId, uniName);
      } else {
        const { getUniversityFromEmail } = await import('../utils/universityDomain.js');
        const info = getUniversityFromEmail(userResult.rows[0].email);
        if (info?.name) {
          await pool.query(
            `UPDATE users SET university = COALESCE(university, $1) WHERE id = $2`,
            [info.name, userId]
          );
          await upsertUniAutoAffiliation(userId, info.name);
        }
      }
    } catch (_e) {
      /* non-fatal */
    }

    return res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to verify email'
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal if email exists (security)
      return res.json({
        success: true,
        message: 'If email exists, password reset link has been sent'
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour

    await pool.query(
      `UPDATE users 
       SET reset_token = $1, 
           reset_token_expires = $2
       WHERE id = $3`,
      [resetToken, resetTokenExpires, user.id]
    );

    // Send password reset email (queue first, fallback direct)
    await enqueueEmailOrFallback('password_reset', {
      email: user.email,
      token: resetToken,
    });

    res.json({
      success: true,
      message: 'If email exists, password reset link has been sent'
    });
  } catch (error) {
    console.error('Error sending password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send password reset email'
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
    }

    const result = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset token'
      });
    }

    const user = result.rows[0];

    // Check if token expired
    if (new Date() > new Date(user.reset_token_expires)) {
      return res.status(400).json({
        success: false,
        error: 'Reset token expired'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Update password and clear reset token
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           reset_token = NULL, 
           reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// POST /api/auth/check-university - Public endpoint for real-time validation
router.post('/check-university', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const university = getUniversityFromEmail(email);

    if (university) {
      res.json({
        success: true,
        data: {
          name: university.name,
          country: university.country,
          domain: university.domain,
          valid: true
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Email must be from a recognized university domain'
        }
      });
    }
  } catch (error) {
    console.error('Error checking university:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check university'
    });
  }
});

// GET /api/auth/university-check?domain=...
// backend-yeni.md contract alias
router.get('/university-check', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'domain is required'
      });
    }
    const normalized = String(domain).trim().toLowerCase();
    const university = getUniversityFromEmail(`check@${normalized}`);
    return res.json({
      success: true,
      data: university
        ? {
            name: university.name,
            country: university.country,
            domain: university.domain,
            valid: true
          }
        : {
            valid: false,
            message: 'Domain does not match a recognized university'
          }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to check university domain'
    });
  }
});

// POST /api/auth/university-request - Save manual university review request (public)
router.post('/university-request', async (req, res) => {
  try {
    let { email, university_name, website } = req.body;

    email = sanitizeString(email);
    university_name = sanitizeString(university_name);
    website = sanitizeString(website);

    if (!email || !university_name) {
      return res.status(400).json({
        success: false,
        error: 'email and university_name are required',
      });
    }

    if (
      checkSQLInjection(email) ||
      checkSQLInjection(university_name) ||
      checkSQLInjection(website || '')
    ) {
      logger.warn('Potential SQL injection attempt on university request', {
        email,
        university_name,
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid input detected',
      });
    }

    const existingKnown = getUniversityFromEmail(email);
    if (existingKnown) {
      return res.status(400).json({
        success: false,
        error: 'Email domain already matches a known university',
      });
    }

    const result = await pool.query(
      `INSERT INTO university_verification_requests (
        email, university_name, website, status
      ) VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (email, university_name) DO UPDATE SET
        website = COALESCE(EXCLUDED.website, university_verification_requests.website),
        status = 'pending',
        reviewed_at = NULL,
        reviewed_by = NULL,
        review_note = NULL,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, email, university_name, website, status, created_at`,
      [email.toLowerCase(), university_name, website || null]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'University request saved for manual review (24-48 hours).',
    });
  } catch (error) {
    logger.error('Error saving university request', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to save university request',
    });
  }
});

// POST /api/auth/university-register
// backend-yeni.md contract alias
router.post('/university-register', authenticateToken, async (req, res) => {
  req.body = {
    ...req.body,
    email: req.body?.email || req.user?.email
  };
  return router.handle(
    { ...req, method: 'POST', url: '/university-request' },
    res
  );
});

// POST /api/auth/logout
// Stateless JWT logout endpoint for contract compatibility.
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await ensureRefreshTokenTable();
    const cookies = parseCookieHeader(req.headers.cookie || '');
    const provided = req.body?.refresh_token || cookies.refresh_token || null;
    if (provided) {
      await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
         WHERE token_hash = $1`,
        [hashToken(provided)]
      );
    }
    try {
      const { revokePresenceTicketsForUser } = await import('../services/presenceTicketService.js');
      await revokePresenceTicketsForUser(req.user.userId);
    } catch (_e) {
      // best effort
    }
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return res.json({
      success: true,
      message: 'Logged out'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to logout'
    });
  }
});

// POST /api/auth/refresh
// backend-yeni.md contract: refresh token ile yeni JWT.
router.post('/refresh', authenticateRefreshRequest, async (req, res) => {
  try {
    await ensureRefreshTokenTable();
    const provided = req.refreshToken;

    let decoded;
    try {
      decoded = jwt.verify(provided, JWT_REFRESH_SECRET);
    } catch (_e) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }

    const oldHash = hashToken(provided);
    const tokenRow = await pool.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [oldHash]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token not recognized'
      });
    }
    const stored = tokenRow.rows[0];
    if (stored.revoked_at || new Date(stored.expires_at) <= new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token is revoked or expired'
      });
    }

    const userResult = await pool.query(
      `SELECT id, email, suspended_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [decoded.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].suspended_at) {
      return res.status(403).json({
        success: false,
        error: 'User is not active'
      });
    }

    const user = userResult.rows[0];
    const token = buildAccessToken(user.id, user.email);
    const nextRefreshToken = buildRefreshToken(user.id, user.email);
    const nextHash = hashToken(nextRefreshToken);
    const nextDecoded = jwt.verify(nextRefreshToken, JWT_REFRESH_SECRET);
    const nextExpiresAt = new Date(nextDecoded.exp * 1000);

    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP, replaced_by_hash = $2
       WHERE token_hash = $1`,
      [oldHash, nextHash]
    );
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, nextHash, nextExpiresAt]
    );

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', nextRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      data: {
        token,
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

// GET /api/auth/me - Get current user (protected)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id, u.email, u.name, u.city, u.university, 
        u.rs_score, u.email_verified, u.identity_verified, u.age_ok,
        u.identity_track, u.uni_label_visible, u.created_at,
        COUNT(DISTINCT ra.ritual_id) as rituals_attended,
        COUNT(DISTINCT r.id) as rituals_hosted
       FROM users u
       LEFT JOIN ritual_attendance ra ON u.id = ra.user_id AND ra.status != 'no_show'
       LEFT JOIN rituals r ON u.id = r.host_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const penalty = await getUserPenaltyStatus(req.user.userId);
    const verified = Boolean(user.email_verified || user.identity_verified);
    const showUni =
      user.identity_track !== 'identity' &&
      Boolean(user.university) &&
      Boolean(user.email_verified) &&
      user.uni_label_visible !== false;

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        city: user.city,
        university: user.identity_track === 'identity' ? null : user.university,
        rs_score: parseFloat(user.rs_score) || 5.0,
        email_verified: user.email_verified,
        identity_verified: Boolean(user.identity_verified),
        age_ok: Boolean(user.age_ok),
        identity_track: user.identity_track,
        uni_label_visible: user.identity_track === 'university' ? user.uni_label_visible !== false : false,
        show_uni_label: showUni,
        verified,
        rituals_attended: parseInt(user.rituals_attended) || 0,
        rituals_hosted: parseInt(user.rituals_hosted) || 0,
        created_at: user.created_at,
        penalty: penalty
          ? {
              is_penalty_suspended: penalty.is_penalty_suspended,
              is_host_banned: penalty.is_host_banned,
              penalty_suspended_until: penalty.penalty_suspended_until,
              host_ban_until: penalty.host_ban_until,
            }
          : null,
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// JWT Authentication Middleware
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return sendError(res, 401, 'TOKEN_INVALID', 'Invalid or expired token');
    }
    try {
      const userRow = await pool.query(
        `SELECT email_verified, identity_verified, identity_track, suspended_at
         FROM users WHERE id = $1 LIMIT 1`,
        [user.userId]
      );
      if (userRow.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }
      if (userRow.rows[0].suspended_at) {
        return res.status(403).json({ success: false, error: 'Account suspended' });
      }
      const path = req.originalUrl || '';
      const isAuthPath = path.startsWith('/api/auth') || path.startsWith('/api/v1/auth');
      const isIdentityPath = path.startsWith('/api/identity');
      const row = userRow.rows[0];
      const gateOk = Boolean(row.email_verified || row.identity_verified);
      // §1: unverified accounts cannot use product APIs; auth + identity KYC routes stay open
      if (!isAuthPath && !isIdentityPath && !gateOk) {
        return res.status(403).json({
          success: false,
          error: 'Identity verification required',
          requires_verification: true,
          requires_identity_kyc: row.identity_track === 'identity',
        });
      }

      req.user = user;
      return next();
    } catch (_e) {
      return res.status(500).json({
        success: false,
        error: 'Authentication check failed'
      });
    }
  });
}

// Admin-only middleware (ADMIN_USER_IDS = comma-separated UUIDs, or ADMIN_EMAILS = comma-separated emails)
export function requireAdmin(req, res, next) {
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (adminIds.length === 0 && adminEmails.length === 0) {
    return res.status(403).json({ success: false, error: 'Admin access not configured' });
  }
  const userId = req.user?.userId;
  const email = (req.user?.email || '').toLowerCase();
  const allowedById = userId && adminIds.length > 0 && adminIds.includes(userId);
  const allowedByEmail = email && adminEmails.length > 0 && adminEmails.includes(email);
  if (!allowedById && !allowedByEmail) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

export default router;
