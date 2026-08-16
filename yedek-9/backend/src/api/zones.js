import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';
import {
  getZoneProfile,
  recordMarkerScan,
  createZone,
} from '../services/zoneService.js';
import { resolveActiveCityId } from '../services/cityScope.js';
import {
  startSparkMeetup,
  joinSparkMeetup,
  getSparkMeetup,
} from '../services/sparkMeetupService.js';
import {
  followZone,
  unfollowZone,
  setZoneFollowBell,
  getZoneFollowStatus,
} from '../services/zoneFollowService.js';

const router = express.Router();

/** GET /api/zones — list (nearby optional) */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    let cityId = null;
    try {
      cityId = await resolveActiveCityId(req.user?.userId);
    } catch (_e) {
      cityId = null;
    }
    let rows;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const params = [lat, lng, limit];
      const scoped = cityId
        ? ' AND city_id = $4'
        : '';
      if (cityId) params.push(cityId);
      rows = await pool.query(
        `SELECT *,
                (6371000 * acos(LEAST(1, GREATEST(-1,
                  cos(radians($1)) * cos(radians(geo_lat)) *
                  cos(radians(geo_lng) - radians($2)) +
                  sin(radians($1)) * sin(radians(geo_lat))
                )))) AS distance_m
         FROM zones
         WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL
         ${scoped}
         ORDER BY distance_m ASC NULLS LAST
         LIMIT $3`,
        params
      );
    } else {
      const params = [limit];
      const scoped = cityId ? ' WHERE city_id = $2' : '';
      if (cityId) params.push(cityId);
      rows = await pool.query(
        `SELECT * FROM zones ${scoped} ORDER BY created_at DESC LIMIT $1`,
        params
      );
    }
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!String(req.body?.name || '').trim()) {
      return res.status(400).json({ success: false, error: 'name required' });
    }
    const zone = await createZone({
      name: String(req.body.name).trim(),
      geoLat: req.body?.geo_lat,
      geoLng: req.body?.geo_lng,
      markerType: req.body?.marker_type,
      radiusM: req.body?.radius_m,
      cityId: req.body?.city_id || null,
    });
    return res.status(201).json({ success: true, data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** SPARK routes before /:id */
router.get('/spark/:meetupId', authenticateToken, async (req, res) => {
  const result = await getSparkMeetup(req.params.meetupId);
  if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.meetup });
});

router.post('/spark/:meetupId/join', authenticateToken, async (req, res) => {
  const result = await joinSparkMeetup(req.params.meetupId, req.user.userId);
  if (!result.ok) {
    return res
      .status(result.status || 400)
      .json({ success: false, error: result.error, code: result.code });
  }
  return res.json({ success: true, data: result.meetup });
});

/** GET /api/zones/:id — zone profili (Aura, Trust YOK) */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await getZoneProfile(req.params.id);
    if (!result.ok) return res.status(result.status || 404).json({ success: false, error: result.error });
    const follow = await getZoneFollowStatus(req.user.userId, req.params.id).catch(() => ({
      is_following: false,
      bell: false,
    }));
    res.json({
      success: true,
      data: {
        ...result.profile,
        follow: {
          is_following: follow.is_following,
          bell: follow.bell,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/follow', authenticateToken, async (req, res) => {
  const result = await getZoneFollowStatus(req.user.userId, req.params.id);
  return res.json({ success: true, data: result });
});

router.post('/:id/follow', authenticateToken, async (req, res) => {
  const result = await followZone(req.user.userId, req.params.id, req.body?.bell === true);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, data: result });
});

router.delete('/:id/follow', authenticateToken, async (req, res) => {
  const result = await unfollowZone(req.user.userId, req.params.id);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true });
});

router.patch('/:id/follow/bell', authenticateToken, async (req, res) => {
  const result = await setZoneFollowBell(req.user.userId, req.params.id, req.body?.bell === true);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.follow });
});

/** ZONE-KEY: marker QR/NFC scan */
router.post('/:id/marker-scan', authenticateToken, async (req, res) => {
  try {
    const result = await recordMarkerScan(req.params.id, req.user.userId);
    if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/spark', authenticateToken, async (req, res) => {
  const result = await startSparkMeetup({
    zoneId: req.params.id,
    userId: req.user.userId,
    lat: req.body?.lat,
    lng: req.body?.lng,
  });
  if (!result.ok) {
    return res
      .status(result.status || 400)
      .json({ success: false, error: result.error, code: result.code });
  }
  return res.status(201).json({ success: true, data: result.meetup });
});

export default router;
