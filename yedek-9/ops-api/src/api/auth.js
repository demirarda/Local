import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { signOpsToken, requireOpsAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const BCRYPT_COST = 12;

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const result = await pool.query(
      `SELECT id, email, name, role, password_hash, is_active
       FROM ops.ops_users WHERE email = $1`,
      [String(email).trim().toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = signOpsToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    console.error('Ops login error:', err);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.get('/me', requireOpsAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, created_at FROM ops.ops_users WHERE id = $1`,
      [req.opsUser.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
});

router.get('/users', requireOpsAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role FROM ops.ops_users WHERE is_active = true ORDER BY name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

router.post('/invite', requireOpsAuth, requireRole('pm', 'founder'), async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    const validRoles = ['pm', 'designer', 'developer', 'host_lead', 'venue_lead', 'founder'];
    if (!email || !name || !password || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid invite payload' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const result = await pool.query(
      `INSERT INTO ops.ops_users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [String(email).trim().toLowerCase(), name.trim(), hash, role]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'Invite failed' });
  }
});

export default router;
