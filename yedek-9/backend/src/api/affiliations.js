/**
 * sonMD §2C affiliations API + §2Ağu-3 friends list helpers mount points
 */
import express from 'express';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  assignBrandAdminAffiliation,
  listAffiliatedHosts,
} from '../services/affiliationService.js';

const router = express.Router();

// GET /api/affiliations/orgs/:orgKind/:orgId/hosts
// orgKind: university | brand
router.get('/orgs/:orgKind/:orgId/hosts', authenticateToken, async (req, res) => {
  try {
    const kind = String(req.params.orgKind || '').toLowerCase();
    if (kind !== 'university' && kind !== 'brand') {
      return res.status(400).json({ success: false, error: 'orgKind must be university|brand' });
    }
    const result = await listAffiliatedHosts(kind, req.params.orgId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list affiliated hosts' });
  }
});

// POST /api/affiliations/brand-admin — admin assigns BRAND_ADMIN
router.post('/brand-admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id, brand_id } = req.body || {};
    const result = await assignBrandAdminAffiliation({
      userId: user_id,
      brandId: brand_id,
      actorId: req.user.userId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.affiliation });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to assign affiliation' });
  }
});

export default router;
