import express from 'express';
import { getPublicConfig } from '../services/publicConfigService.js';

const router = express.Router();

/** GET /api/config/public — son-part.md §12 mobile mirror (auth gerekmez) */
router.get('/public', (_req, res) => {
  try {
    return res.json({ success: true, data: getPublicConfig() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load public config' });
  }
});

export default router;
