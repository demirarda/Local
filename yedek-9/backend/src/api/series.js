import express from 'express';
import { authenticateToken } from './auth.js';
import {
  getSeries,
  followSeries,
  unfollowSeries,
  getSeriesFollowState,
  cancelFutureSeriesInstances,
  transferSeriesHost,
  updateSeriesSchedule,
  listSeriesInstances,
  decorateSeries,
  SERIES_CADENCES,
} from '../services/seriesService.js';
import {
  listSeriesRegulars,
  isSeriesRegular,
  SERIES_REGULAR_SPEC,
  isSeriesRegularEnabled,
} from '../services/seriesRegularService.js';
import pool from '../config/database.js';

const router = express.Router();

/** GET /api/series/cadences — create/edit ekranlarının kadans listesi */
router.get('/cadences', authenticateToken, (_req, res) => {
  res.json({
    success: true,
    data: Object.entries(SERIES_CADENCES).map(([value, meta]) => ({
      value,
      label: meta.label,
      interval_days: meta.interval_days,
    })),
  });
});

/** GET /api/series/:id */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const series = await getSeries(req.params.id);
    if (!series) return res.status(404).json({ success: false, error: 'Series not found' });
    const follow = await getSeriesFollowState(series.id, req.user.userId);
    const instances = await listSeriesInstances(series.id, { limit: 24 });
    const host = await pool.query(`SELECT id, name, avatar_url FROM users WHERE id = $1`, [
      series.host_id,
    ]);
    const followers = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_series_followers WHERE series_id = $1`,
      [series.id]
    );
    const regularEnabled = isSeriesRegularEnabled();
    const viewerIsRegular = regularEnabled
      ? await isSeriesRegular(req.user.userId, series.id)
      : false;
    const regulars =
      regularEnabled && String(series.host_id) === String(req.user.userId)
        ? await listSeriesRegulars(series.id)
        : [];
    return res.json({
      success: true,
      data: {
        ...decorateSeries(series),
        host: host.rows[0] || null,
        host_name: host.rows[0]?.name || null,
        follower_count: followers.rows[0]?.c || 0,
        follow,
        instances,
        past_instances: instances.filter((i) => i.past),
        upcoming_instances: instances.filter((i) => !i.past),
        is_host: String(series.host_id) === String(req.user.userId),
        series_regular: {
          enabled: regularEnabled,
          viewer_is_regular: viewerIsRegular,
          spec: SERIES_REGULAR_SPEC,
          host_roster: regulars,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/series/:id/regulars — host roster (score boost 0) */
router.get('/:id/regulars', authenticateToken, async (req, res) => {
  try {
    if (!isSeriesRegularEnabled()) {
      return res.status(410).json({
        success: false,
        error: 'Series-Regular kapalı',
        code: 'SERIES_REGULAR_OFF',
      });
    }
    const series = await getSeries(req.params.id);
    if (!series) return res.status(404).json({ success: false, error: 'Series not found' });
    const isHost = String(series.host_id) === String(req.user.userId);
    const viewerIsRegular = await isSeriesRegular(req.user.userId, series.id);
    return res.json({
      success: true,
      data: {
        viewer_is_regular: viewerIsRegular,
        regulars: isHost ? await listSeriesRegulars(series.id) : [],
        spec: SERIES_REGULAR_SPEC,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** PATCH /api/series/:id — kadans (WEEKLY|BIWEEKLY) ve bitiş (N hafta / açık uçlu) */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const data = await updateSeriesSchedule(req.params.id, {
      cadence: body.cadence,
      endAfterWeeks: 'end_after_weeks' in body ? body.end_after_weeks : undefined,
      hour: body.hour,
      minute: body.minute,
      actorUserId: req.user.userId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = /Only series host/i.test(error.message)
      ? 403
      : /not found/i.test(error.message)
        ? 404
        : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
});

/** POST /api/series/:id/follow — seri takip zili */
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const series = await getSeries(req.params.id);
    if (!series || !series.active) {
      return res.status(404).json({ success: false, error: 'Series not found' });
    }
    const bell = req.body?.bell !== false;
    const data = await followSeries(series.id, req.user.userId, bell);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

/** DELETE /api/series/:id/follow */
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  try {
    await unfollowSeries(req.params.id, req.user.userId);
    return res.json({ success: true, data: { ok: true } });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

/** POST /api/series/:id/cancel — gelecek instance düşer, geçmiş arşiv kalır */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const data = await cancelFutureSeriesInstances(req.params.id, {
      actorUserId: req.user.userId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = /Only series host/i.test(error.message) ? 403 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
});

/** POST /api/series/:id/transfer — host devri */
router.post('/:id/transfer', authenticateToken, async (req, res) => {
  try {
    const newHostId = req.body?.new_host_id || req.body?.to_host_id;
    const data = await transferSeriesHost(req.params.id, {
      fromHostId: req.user.userId,
      toHostId: newHostId,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = /Only current host/i.test(error.message) ? 403 : 400;
    return res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
