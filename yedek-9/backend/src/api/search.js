import express from 'express';
import { authenticateToken } from './auth.js';
import { search, SEARCH_TABS } from '../services/searchService.js';
import {
  buildVenueCharacterCard,
  getChainProfile,
  getBrandProfile,
} from '../services/discoveryProfileService.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const data = await search({
      query: req.query.q,
      tab: req.query.tab,
      limit: req.query.limit,
      viewerId: req.user?.userId || null,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Search failed', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

router.get('/tabs', authenticateToken, (_req, res) => {
  res.json({ success: true, data: { tabs: SEARCH_TABS } });
});

router.get('/venues/:id/character-card', authenticateToken, async (req, res) => {
  try {
    const result = await buildVenueCharacterCard(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Character card failed' });
  }
});

router.get('/chains/:id', authenticateToken, async (req, res) => {
  try {
    const result = await getChainProfile(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
    return res.json({ success: true, data: result.chain });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Chain profile failed' });
  }
});

router.get('/brands/:id', authenticateToken, async (req, res) => {
  try {
    const result = await getBrandProfile(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
    return res.json({ success: true, data: result.brand });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Brand profile failed' });
  }
});

export default router;
