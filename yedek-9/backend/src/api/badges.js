import express from 'express';
import { authenticateToken } from './auth.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  syncBadgeCatalogFromConfig,
  getBadgeArchive,
  resolveBadgeFamily,
} from '../services/badgeEngine.js';
import {
  submitLlmBadgeSuggestion,
  isLlmPipelineEnabled,
} from '../services/badgeLlmPipeline.js';

const router = express.Router();

router.get('/catalog', authenticateToken, async (_req, res) => {
  try {
    await syncBadgeCatalogFromConfig();
    const catalog = LOCAL_CONFIG.badges.CATALOG || [];
    const glyphs = LOCAL_CONFIG.badges.FAMILY_GLYPHS || {};
    return res.json({
      success: true,
      data: {
        /** v2 §9 — 6 aile */
        categories: LOCAL_CONFIG.badges.CATEGORIES,
        families: LOCAL_CONFIG.badges.CATEGORIES,
        family_glyphs: glyphs,
        category_map: LOCAL_CONFIG.badges.CATEGORY_MAP,
        levels: LOCAL_CONFIG.badges.LEVELS,
        level_labels: LOCAL_CONFIG.badges.LEVEL_LABELS,
        highlight_max: LOCAL_CONFIG.badges.HIGHLIGHT_USER,
        venue_badge: LOCAL_CONFIG.badges.VENUE_BADGE,
        chip_bridge: LOCAL_CONFIG.badges.CHIP_BRIDGE,
        catalog: catalog.map((b) => {
          const family = resolveBadgeFamily(b);
          return {
            ...b,
            family,
            family_glyph: glyphs[family] || '',
          };
        }),
        llm_pipeline_enabled: isLlmPipelineEnabled(),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load badge catalog' });
  }
});

router.post('/llm/suggest', authenticateToken, async (req, res) => {
  try {
    const result = await submitLlmBadgeSuggestion(req.user.userId, {
      ritualId: req.body?.ritual_id,
      suggestedSlug: req.body?.suggested_slug,
      suggestedLevel: req.body?.suggested_level,
      reason: req.body?.reason,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to submit LLM suggestion' });
  }
});

export default router;
