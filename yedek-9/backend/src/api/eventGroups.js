/**
 * Event-group / ZONE-EVENT API — LOCAL v2 §11
 */
import express from 'express';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  createEventGroup,
  attachRitualToEventGroup,
  detachRitualFromEventGroup,
  getEventGroupUmbrella,
  listLiveEventGroupUmbrellas,
  listEventGroups,
} from '../services/eventGroupService.js';

const router = express.Router();

router.get('/live', authenticateToken, async (_req, res) => {
  const result = await listLiveEventGroupUmbrellas();
  return res.json({ success: true, data: result.umbrellas });
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  const result = await listEventGroups({ limit: req.query.limit });
  return res.json({ success: true, data: result.groups });
});

router.get('/:id', authenticateToken, async (req, res) => {
  const result = await getEventGroupUmbrella(req.params.id);
  if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.umbrella });
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { name, zone_id, capacity_total } = req.body || {};
  if (!name) return res.status(400).json({ success: false, error: 'name required' });
  const result = await createEventGroup({
    name,
    zoneId: zone_id,
    capacityTotal: capacity_total,
    createdBy: req.user.userId,
  });
  if (!result.ok) {
    return res.status(result.status || 400).json({
      success: false,
      error: result.error,
      code: result.code || undefined,
    });
  }
  return res.json({ success: true, data: result.group });
});

router.post('/:id/rituals/:ritualId', authenticateToken, requireAdmin, async (req, res) => {
  const result = await attachRitualToEventGroup(req.params.ritualId, req.params.id);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.ritual });
});

router.delete('/:id/rituals/:ritualId', authenticateToken, requireAdmin, async (req, res) => {
  const result = await detachRitualFromEventGroup(req.params.ritualId);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.ritual });
});

export default router;
