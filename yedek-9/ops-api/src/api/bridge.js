import express from 'express';
import { getProductionPool } from '../config/database.js';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireOpsAuth);

function prodPoolOrSame() {
  return getProductionPool() || pool;
}

router.get('/hosts', async (req, res) => {
  try {
    const { city, search } = req.query;
    const db = prodPoolOrSame();
    let where = `WHERE EXISTS (
      SELECT 1 FROM rituals r WHERE r.host_id = u.id
    ) OR EXISTS (
      SELECT 1 FROM host_verifications hv WHERE hv.user_id = u.id AND hv.status = 'verified'
    )`;
    const params = [];
    let idx = 1;

    if (city?.trim()) {
      where += ` AND u.city ILIKE $${idx++}`;
      params.push(`%${city.trim()}%`);
    }
    if (search?.trim()) {
      where += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.city, u.rs_score,
        COALESCE(u.is_verified_host, false) AS is_verified
       FROM users u
       ${where}
       ORDER BY u.name
       LIMIT 50`,
      params
    ).catch(() => ({ rows: [] }));

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Bridge hosts:', err.message);
    res.json({ success: true, data: [], note: 'Production users table unavailable' });
  }
});

router.get('/venues', async (req, res) => {
  try {
    const { city, search } = req.query;
    const db = prodPoolOrSame();
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (city?.trim()) {
      where += ` AND v.city ILIKE $${idx++}`;
      params.push(`%${city.trim()}%`);
    }
    if (search?.trim()) {
      where += ` AND v.name ILIKE $${idx++}`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const result = await db.query(
      `SELECT v.id, v.name, v.city, v.address, v.subscription_tier, v.is_verified
       FROM venues v
       ${where}
       ORDER BY v.name
       LIMIT 50`,
      params
    ).catch(() => ({ rows: [] }));

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.json({ success: true, data: [], note: 'Production venues table unavailable' });
  }
});

export default router;
