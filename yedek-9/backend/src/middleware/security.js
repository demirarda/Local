/**
 * Security Middleware
 * Additional security checks and validations
 */

import logger from '../utils/logger.js';

/**
 * Validate email format (basic)
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function isValidPassword(password) {
  if (!password || password.length < 8) return false;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  return passwordRegex.test(password);
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}


/**
 * Check for SQL injection patterns in string inputs
 */
export function checkSQLInjection(str) {
  if (typeof str !== 'string') return false;
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL comment patterns
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i, // SQL injection patterns
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i, // OR patterns
    /((\%27)|(\'))union/i, // UNION patterns
  ];
  return sqlPatterns.some(pattern => pattern.test(str));
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Security headers middleware
 */
export function securityHeaders(req, res, next) {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

export function enforceHttps(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const xfProto = req.headers['x-forwarded-proto'];
  if (req.secure || xfProto === 'https') return next();
  return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
}

/**
 * Validate environment variables on startup
 */
export function validateEnvironmentVariables() {
  const required = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    logger.error('Missing required environment variables', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET || '';

  if (jwtSecret.length < 64) {
    const message = 'JWT_SECRET must be at least 64 characters';
    if (isProduction) {
      logger.error(message);
      throw new Error(message);
    } else {
      logger.warn(`⚠️  ${message} (dev only warning)`);
    }
  }

  // Warn/guard against insecure defaults
  if (process.env.JWT_SECRET === 'local-secret-key-change-in-production') {
    const message = '⚠️  Using default JWT_SECRET. Change this in production!';
    if (isProduction) {
      logger.error(message);
      throw new Error('Insecure JWT_SECRET value in production');
    } else {
      logger.warn(message);
    }
  }

  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin || corsOrigin === '*') {
    const message = '⚠️  CORS is set to allow all origins. Restrict this in production!';
    if (isProduction) {
      logger.error(message);
      throw new Error('Insecure CORS_ORIGIN configuration in production');
    } else {
      logger.warn(message);
    }
  }
}
