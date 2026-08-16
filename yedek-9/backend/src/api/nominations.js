/**
 * Venue nominations API — LOCAL v2 §8
 */
import express from 'express';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  nominateVenue,
  listNominations,
  setNominationStatus,
} from '../services/nominationService.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  const { source, name, lat, lng, note } = req.body || {};
  const result = await nominateVenue({
    nominatorId: req.user.userId,
    source,
    name,
    lat,
    lng,
    note,
  });
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.nomination });
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  const result = await listNominations({ status: req.query.status, limit: req.query.limit });
  return res.json({ success: true, data: result.nominations });
});

router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const result = await setNominationStatus(req.params.id, req.body.status || 'reviewed');
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.nomination });
});

export default router;
