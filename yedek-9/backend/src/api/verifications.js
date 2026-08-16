import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';
import { logAdminAction } from '../utils/auditLog.js';

const router = express.Router();

// GET /api/verifications/host/:userId - Check if user is verified host
router.get('/host/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT * FROM host_verifications 
       WHERE user_id = $1 
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId]
    );

    const isVerified = result.rows.length > 0;

    res.json({
      success: true,
      data: {
        is_verified: isVerified,
        verification: isVerified ? {
          type: result.rows[0].verification_type,
          verified_by: result.rows[0].verified_by,
          verified_at: result.rows[0].verified_at,
        } : null
      }
    });
  } catch (error) {
    console.error('Error checking host verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check host verification'
    });
  }
});

// GET /api/verifications/venue - Check if venue is verified
router.get('/venue', async (req, res) => {
  try {
    const { venue_name, city } = req.query;

    if (!venue_name || !city) {
      return res.status(400).json({
        success: false,
        error: 'venue_name and city are required'
      });
    }

    const result = await pool.query(
      `SELECT * FROM venue_verifications 
       WHERE venue_name = $1 
         AND city = $2
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [venue_name, city]
    );

    const isVerified = result.rows.length > 0;

    res.json({
      success: true,
      data: {
        is_verified: isVerified,
        verification: isVerified ? {
          type: result.rows[0].verification_type,
          verified_by: result.rows[0].verified_by,
          verified_at: result.rows[0].verified_at,
        } : null
      }
    });
  } catch (error) {
    console.error('Error checking venue verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check venue verification'
    });
  }
});

// POST /api/verifications/host - Verify a host (admin only)
router.post('/host', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { user_id, verified_by = 'admin', verification_type = 'standard', expires_at } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'user_id is required'
      });
    }

    // Check if already verified
    const existing = await pool.query(
      `SELECT * FROM host_verifications WHERE user_id = $1`,
      [user_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing verification
      result = await pool.query(
        `UPDATE host_verifications 
         SET verified_by = $1, 
             verification_type = $2,
             verified_at = CURRENT_TIMESTAMP,
             expires_at = $3,
             status = 'active'
         WHERE user_id = $4
         RETURNING *`,
        [verified_by, verification_type, expires_at || null, user_id]
      );
    } else {
      // Create new verification
      result = await pool.query(
        `INSERT INTO host_verifications (user_id, verified_by, verification_type, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user_id, verified_by, verification_type, expires_at || null]
      );
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error verifying host:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify host'
    });
  }
});

// POST /api/verifications/venue - Verify a venue (admin only)
router.post('/venue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { venue_name, city, verified_by = 'admin', verification_type = 'standard', expires_at } = req.body;

    if (!venue_name || !city) {
      return res.status(400).json({
        success: false,
        error: 'venue_name and city are required'
      });
    }

    // Check if already verified
    const existing = await pool.query(
      `SELECT * FROM venue_verifications WHERE venue_name = $1 AND city = $2`,
      [venue_name, city]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing verification
      result = await pool.query(
        `UPDATE venue_verifications 
         SET verified_by = $1, 
             verification_type = $2,
             verified_at = CURRENT_TIMESTAMP,
             expires_at = $3,
             status = 'active'
         WHERE venue_name = $4 AND city = $5
         RETURNING *`,
        [verified_by, verification_type, expires_at || null, venue_name, city]
      );
    } else {
      // Create new verification
      result = await pool.query(
        `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [venue_name, city, verified_by, verification_type, expires_at || null]
      );
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error verifying venue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify venue'
    });
  }
});

// ---------- Admin: list & revoke verifications ----------

// GET /api/verifications/admin/hosts - List host verifications (admin only)
router.get('/admin/hosts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT hv.id, hv.user_id, hv.verified_by, hv.verification_type, hv.verified_at, hv.expires_at, hv.status,
              u.name AS user_name, u.email AS user_email
       FROM host_verifications hv
       JOIN users u ON hv.user_id = u.id
       ORDER BY hv.verified_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error listing host verifications:', error);
    res.status(500).json({ success: false, error: 'Failed to list host verifications' });
  }
});

// GET /api/verifications/admin/venues - List venue verifications (admin only)
router.get('/admin/venues', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, venue_name, city, verified_by, verification_type, verified_at, expires_at, status
       FROM venue_verifications
       ORDER BY verified_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error listing venue verifications:', error);
    res.status(500).json({ success: false, error: 'Failed to list venue verifications' });
  }
});

// PATCH /api/verifications/admin/host/:id - Revoke host verification (admin only)
router.patch('/admin/host/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE host_verifications SET status = 'revoked' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Host verification not found' });
    }
    const row = result.rows[0];
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'revoke_host_verification',
      targetType: 'host_verification',
      targetId: id,
      details: { user_id: row.user_id },
    });
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('Error revoking host verification:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke' });
  }
});

// PATCH /api/verifications/admin/venue/:id - Revoke venue verification (admin only)
router.patch('/admin/venue/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE venue_verifications SET status = 'revoked' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue verification not found' });
    }
    const row = result.rows[0];
    await logAdminAction(pool, {
      adminUserId: req.user?.userId,
      action: 'revoke_venue_verification',
      targetType: 'venue_verification',
      targetId: id,
      details: { venue_name: row.venue_name, city: row.city },
    });
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('Error revoking venue verification:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke' });
  }
});

export default router;
