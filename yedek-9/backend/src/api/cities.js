/**
 * sonMD §12.5 — şehir listesi · COMING notify-me · active_city gezgin
 */
import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';
import { comingCityPayload } from '../services/cityScope.js';

const router = express.Router();

const COMING_DEFAULT_TEASER =
  'LOCAL henüz şehrinde değil — açılınca haber verelim.';

/** GET /api/cities — ACTIVE + COMING listesi */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const status = String(req.query.status || '').toUpperCase();
    const params = [];
    let where = '';
    if (status === 'ACTIVE' || status === 'COMING') {
      where = 'WHERE c.status = $1';
      params.push(status);
    }
    const r = await pool.query(
      `SELECT c.id, c.name, c.status, c.teaser_copy, c.notify_enabled,
              c.country, c.timezone, c.center_lat, c.center_lng, c.is_active,
              c.launch_date,
              CASE WHEN n.id IS NOT NULL THEN true ELSE false END AS notified
       FROM cities c
       LEFT JOIN city_notify_requests n
         ON n.city_id = c.id AND n.user_id = $${params.length + 1}
       ${where}
       ORDER BY
         CASE WHEN c.status = 'ACTIVE' THEN 0 ELSE 1 END,
         c.name ASC`,
      [...params, req.user.userId]
    );
    const cities = r.rows.map((row) => ({
      ...comingCityPayload(row),
      country: row.country,
      timezone: row.timezone,
      center_lat: row.center_lat,
      center_lng: row.center_lng,
      launch_date: row.launch_date,
      notified: Boolean(row.notified),
      teaser: row.teaser_copy || (row.status === 'COMING' ? COMING_DEFAULT_TEASER : null),
    }));
    return res.json({ success: true, data: cities });
  } catch (error) {
    console.error('GET /cities', error);
    return res.status(500).json({ success: false, error: 'Şehir listesi alınamadı' });
  }
});

/** GET /api/cities/:id */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, CASE WHEN n.id IS NOT NULL THEN true ELSE false END AS notified
       FROM cities c
       LEFT JOIN city_notify_requests n
         ON n.city_id = c.id AND n.user_id = $2
       WHERE c.id = $1`,
      [req.params.id, req.user.userId]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Şehir bulunamadı' });
    }
    const row = r.rows[0];
    return res.json({
      success: true,
      data: {
        ...comingCityPayload(row),
        notified: Boolean(row.notified),
        teaser: row.teaser_copy || (row.status === 'COMING' ? COMING_DEFAULT_TEASER : null),
      },
    });
  } catch (error) {
    console.error('GET /cities/:id', error);
    return res.status(500).json({ success: false, error: 'Şehir alınamadı' });
  }
});

/**
 * POST /api/cities/:id/notify-me
 * COMING şehir talep logu — ACTIVE şehirde 400
 */
router.post('/:id/notify-me', authenticateToken, async (req, res) => {
  try {
    const city = await pool.query(
      `SELECT id, name, status, notify_enabled, teaser_copy FROM cities WHERE id = $1`,
      [req.params.id]
    );
    if (!city.rows[0]) {
      return res.status(404).json({ success: false, error: 'Şehir bulunamadı', code: 'CITY_NOT_FOUND' });
    }
    const c = city.rows[0];
    if (String(c.status).toUpperCase() !== 'COMING') {
      return res.status(400).json({
        success: false,
        error: 'Notify-me yalnız COMING şehirler için',
        code: 'CITY_NOT_COMING',
      });
    }
    if (c.notify_enabled === false) {
      return res.status(403).json({
        success: false,
        error: 'Bu şehir için bildirim kapalı',
        code: 'NOTIFY_DISABLED',
      });
    }
    await pool.query(
      `INSERT INTO city_notify_requests (city_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (city_id, user_id) DO NOTHING`,
      [c.id, req.user.userId]
    );
    return res.json({
      success: true,
      data: {
        city_id: c.id,
        city_name: c.name,
        notified: true,
        message: c.teaser_copy || COMING_DEFAULT_TEASER,
      },
    });
  } catch (error) {
    console.error('POST /cities/:id/notify-me', error);
    return res.status(500).json({ success: false, error: 'Notify kaydı başarısız' });
  }
});

export default router;
