import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from './auth.js';
import { signMediaPath, verifyMediaToken } from '../utils/mediaSigning.js';
import {
  mediaHealthSnapshot,
  resolvePublicMediaUrl,
  writeLocalUploadFromToken,
} from '../utils/s3Media.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');

/** GET /api/media/health — storage mode (no secrets) */
router.get('/health', (_req, res) => {
  return res.json({ success: true, data: mediaHealthSnapshot() });
});

router.get('/signed-url', authenticateToken, async (req, res) => {
  try {
    const rawPath = String(req.query.path || req.query.uri || '');
    if (!rawPath) {
      return res.status(400).json({ success: false, error: 'path or uri required' });
    }
    // Accept /uploads/... or s3://...
    if (rawPath.startsWith('/uploads/')) {
      const token = signMediaPath(rawPath, 3600);
      const base = process.env.API_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
      return res.json({
        success: true,
        data: { url: `${base}/api/media/access?token=${token}`, expires_in_seconds: 3600 },
      });
    }
    const url = await resolvePublicMediaUrl(rawPath, 3600);
    return res.json({
      success: true,
      data: { url, expires_in_seconds: 3600 },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'signed-url failed' });
  }
});

router.get('/access', async (req, res) => {
  const { token } = req.query;
  const check = verifyMediaToken(token);
  if (!check.ok) {
    return res.status(403).json({ success: false, error: 'invalid or expired media token' });
  }
  const normalized = path.normalize(check.filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.resolve(uploadsRoot, normalized.replace(/^\/uploads\//, ''));
  if (!abs.startsWith(uploadsRoot)) {
    return res.status(403).json({ success: false, error: 'invalid media path' });
  }
  return res.sendFile(abs);
});

/**
 * PUT /api/media/put?token=... — local-storage upload target (S3-presign equivalent)
 * Body: raw bytes (same as S3 PUT)
 */
router.put('/put', express.raw({ type: '*/*', limit: '90mb' }), async (req, res) => {
  try {
    const token = String(req.query.token || '');
    const contentType = String(req.query.contentType || req.headers['content-type'] || 'application/octet-stream');
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!body.length) {
      return res.status(400).json({ success: false, error: 'empty body' });
    }
    const written = await writeLocalUploadFromToken(token, body, contentType);
    return res.status(200).json({ success: true, data: written });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'upload failed',
    });
  }
});

export default router;
