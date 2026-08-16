import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';
import { logAdminAction } from '../utils/auditLog.js';
import bcrypt from 'bcryptjs';
import { sendAnnouncementEmail } from '../services/email.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users - List users (paginated, optional search, university, rs_min, rs_max)
router.get('/users', async (req, res) => {
  try {
    const { limit = 20, offset = 0, search = '', suspended, university, rs_min, rs_max } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    const searchTerm = String(search).trim();
    const suspendedFilter = suspended === 'true' ? 'AND u.suspended_at IS NOT NULL' : suspended === 'false' ? 'AND u.suspended_at IS NULL' : '';

    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (searchTerm) {
      whereClause += ` AND (u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.city ILIKE $${idx})`;
      params.push(`%${searchTerm}%`);
      idx++;
    }
    if (suspendedFilter) {
      whereClause += ` ${suspendedFilter}`;
    }
    if (university && String(university).trim()) {
      whereClause += ` AND u.university ILIKE $${idx}`;
      params.push(`%${String(university).trim()}%`);
      idx++;
    }
    if (rs_min != null && rs_min !== '') {
      const n = parseFloat(rs_min);
      if (!isNaN(n)) {
        whereClause += ` AND u.rs_score >= $${idx}`;
        params.push(n);
        idx++;
      }
    }
    if (rs_max != null && rs_max !== '') {
      const n = parseFloat(rs_max);
      if (!isNaN(n)) {
        whereClause += ` AND u.rs_score <= $${idx}`;
        params.push(n);
        idx++;
      }
    }

    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.city, u.university, u.rs_score, u.created_at, u.suspended_at
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        city: r.city,
        university: r.university,
        rs_score: r.rs_score != null ? parseFloat(r.rs_score) : null,
        created_at: r.created_at,
        suspended_at: r.suspended_at,
      })),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing admin users:', error);
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

// GET /api/admin/rituals - List rituals (paginated, optional status, city, date_from, date_to)
router.get('/rituals', async (req, res) => {
  try {
    const { limit = 20, offset = 0, status = '', city = '', date_from = '', date_to = '' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    const validStatuses = ['draft', 'active', 'live', 'ended', 'cancelled'];
    const statusFilter = status && validStatuses.includes(status) ? status : null;

    const params = [];
    let idx = 1;
    let whereClause = 'WHERE 1=1';
    if (statusFilter) {
      whereClause += ` AND r.status = $${idx}`;
      params.push(statusFilter);
      idx++;
    }
    if (city && String(city).trim()) {
      whereClause += ` AND u.city ILIKE $${idx}`;
      params.push(`%${String(city).trim()}%`);
      idx++;
    }
    if (date_from) {
      whereClause += ` AND r.start_time >= $${idx}::date`;
      params.push(date_from);
      idx++;
    }
    if (date_to) {
      whereClause += ` AND r.start_time < ($${idx}::date + interval '1 day')`;
      params.push(date_to);
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT r.id, r.title, r.type, r.location_name, r.start_time, r.status, r.capacity, r.entry_type, r.created_at, r.suspended_at,
              u.name AS host_name, u.city AS host_city
       FROM rituals r
       JOIN users u ON r.host_id = u.id
       ${whereClause}
       ORDER BY r.start_time DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM rituals r JOIN users u ON r.host_id = u.id ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing admin rituals:', error);
    res.status(500).json({ success: false, error: 'Failed to list rituals' });
  }
});

// GET /api/admin/venues - List venues (admin only, paginated, optional city, search)
router.get('/venues', async (req, res) => {
  try {
    const { limit = 50, offset = 0, city = '', search = '' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (city && String(city).trim()) {
      whereClause += ` AND v.city ILIKE $${idx}`;
      params.push(`%${String(city).trim()}%`);
      idx++;
    }
    if (search && String(search).trim()) {
      whereClause += ` AND (v.name ILIKE $${idx} OR v.address ILIKE $${idx})`;
      params.push(`%${String(search).trim()}%`);
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT v.id, v.name, v.city, v.address, v.location_lat, v.location_lng, v.slug, v.created_at,
              v.subscription_tier, v.pro_enabled, v.city_partner_enabled, v.package_stub,
              v.shadow_link_completed_at,
              (SELECT COUNT(*) FROM venue_managers vm WHERE vm.venue_id = v.id) AS managers_count,
              (SELECT COUNT(*) FROM rituals r WHERE r.venue_id = v.id AND r.status IN ('active', 'live')) AS upcoming_rituals_count
       FROM venues v
       ${whereClause}
       ORDER BY v.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM venues v ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows.map(r => {
        const stub = r.package_stub && typeof r.package_stub === 'object' ? r.package_stub : {};
        return {
        id: r.id,
        name: r.name,
        city: r.city,
        address: r.address || null,
        location_lat: r.location_lat != null ? parseFloat(r.location_lat) : null,
        location_lng: r.location_lng != null ? parseFloat(r.location_lng) : null,
        slug: r.slug || null,
        subscription_tier: r.subscription_tier || 'basic',
        pro_enabled: Boolean(r.pro_enabled),
        city_partner_enabled: Boolean(r.city_partner_enabled),
        pending_upgrade_tier: stub.pending_upgrade_tier || null,
        shadow_link_completed_at: r.shadow_link_completed_at || null,
        managers_count: parseInt(r.managers_count) || 0,
        upcoming_rituals_count: parseInt(r.upcoming_rituals_count) || 0,
        created_at: r.created_at,
      };
      }),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing admin venues:', error);
    res.status(500).json({ success: false, error: 'Failed to list venues' });
  }
});

// GET /api/admin/feedback - List feedback (admin only, paginated, optional ritual_id)
router.get('/feedback', async (req, res) => {
  try {
    const { limit = 50, offset = 0, ritual_id = '' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (ritual_id && ritual_id.trim()) {
      whereClause += ` AND f.ritual_id = $${idx}`;
      params.push(ritual_id.trim());
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT f.id, f.ritual_id, f.from_user_id, f.to_user_id, f.feedback_type,
              f.q1_comfort, f.q2_energy, f.p2r_feeling, f.created_at,
              u1.name AS from_user_name, u2.name AS to_user_name,
              rt.title AS ritual_title
       FROM feedback f
       LEFT JOIN users u1 ON f.from_user_id = u1.id
       LEFT JOIN users u2 ON f.to_user_id = u2.id
       LEFT JOIN rituals rt ON f.ritual_id = rt.id
       ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM feedback f ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing admin feedback:', error);
    res.status(500).json({ success: false, error: 'Failed to list feedback' });
  }
});

// GET /api/admin/users/:id - User detail (for drill-down)
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.city, u.university, u.rs_score, u.created_at, u.suspended_at
       FROM users u WHERE u.id = $1`,
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const user = userResult.rows[0];

    const [hostedCount, attendedCount, reportsAgainstCount, hostVerification] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM rituals WHERE host_id = $1', [id]),
      pool.query('SELECT COUNT(*) AS c FROM ritual_attendance WHERE user_id = $1', [id]),
      pool.query('SELECT COUNT(*) AS c FROM reports WHERE reported_user_id = $1', [id]),
      pool.query(
        `SELECT * FROM host_verifications WHERE user_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        ...user,
        rs_score: user.rs_score != null ? parseFloat(user.rs_score) : null,
        hosted_count: parseInt(hostedCount.rows[0]?.c || 0),
        attended_count: parseInt(attendedCount.rows[0]?.c || 0),
        reports_against_count: parseInt(reportsAgainstCount.rows[0]?.c || 0),
        is_verified_host: hostVerification.rows.length > 0,
        host_verification: hostVerification.rows[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching admin user detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// PATCH /api/admin/users/:id - Update user (rs_score, name, city, university)
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rs_score, name, city, university } = req.body;
    const authUserId = req.user?.userId;

    const userResult = await pool.query('SELECT id, rs_score FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const user = userResult.rows[0];
    const updates = [];
    const values = [];
    let idx = 1;

    if (rs_score !== undefined) {
      const rs = parseFloat(rs_score);
      if (isNaN(rs) || rs < 1 || rs > 10) {
        return res.status(400).json({ success: false, error: 'rs_score must be between 1 and 10' });
      }
      updates.push(`rs_score = $${idx}`);
      values.push(rs);
      idx++;
    }
    if (name !== undefined && String(name).trim() !== '') {
      updates.push(`name = $${idx}`);
      values.push(String(name).trim());
      idx++;
    }
    if (city !== undefined && String(city).trim() !== '') {
      updates.push(`city = $${idx}`);
      values.push(String(city).trim());
      idx++;
    }
    if (university !== undefined) {
      updates.push(`university = $${idx}`);
      values.push(String(university).trim() || null);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // RS history for admin override
    if (rs_score !== undefined) {
      const newRs = parseFloat(rs_score);
      const oldRs = user.rs_score != null ? parseFloat(user.rs_score) : 6.0;
      await pool.query(
        `INSERT INTO rs_history (user_id, old_rs, new_rs, source, admin_user_id)
         VALUES ($1, $2, $3, 'admin', $4)`,
        [id, oldRs, newRs, authUserId]
      );
    }

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'update_user',
      targetType: 'user',
      targetId: id,
      details: { rs_score, name, city, university },
    });

    const updated = await pool.query(
      'SELECT id, name, email, city, university, rs_score, updated_at FROM users WHERE id = $1',
      [id]
    );
    res.json({
      success: true,
      data: {
        ...updated.rows[0],
        rs_score: updated.rows[0].rs_score != null ? parseFloat(updated.rows[0].rs_score) : null,
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// POST /api/admin/users/:id/reset-password - Admin sets new password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    const authUserId = req.user?.userId;

    if (!new_password || String(new_password).length < 8) {
      return res.status(400).json({ success: false, error: 'new_password required, min 8 characters' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hash, id]
    );

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'admin_reset_password',
      targetType: 'user',
      targetId: id,
    });

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// GET /api/admin/users/:id/rs-history - RS change history for user
router.get('/users/:id/rs-history', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const result = await pool.query(
      `SELECT h.id, h.old_rs, h.new_rs, h.source, h.ritual_id, h.admin_user_id, h.details, h.created_at,
              u.name AS admin_name, r.title AS ritual_title
       FROM rs_history h
       LEFT JOIN users u ON h.admin_user_id = u.id
       LEFT JOIN rituals r ON h.ritual_id = r.id
       WHERE h.user_id = $1
       ORDER BY h.created_at DESC
       LIMIT $2`,
      [id, limit]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        old_rs: r.old_rs != null ? parseFloat(r.old_rs) : null,
        new_rs: r.new_rs != null ? parseFloat(r.new_rs) : null,
        source: r.source,
        ritual_id: r.ritual_id,
        ritual_title: r.ritual_title,
        admin_user_id: r.admin_user_id,
        admin_name: r.admin_name,
        details: r.details,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    if (error.code === '42P01') {
      return res.json({ success: true, data: [] });
    }
    console.error('Error fetching rs-history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch RS history' });
  }
});

// GET /api/admin/rituals/:id - Ritual detail (for drill-down)
router.get('/rituals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ritualResult = await pool.query(
      `SELECT r.id, r.title, r.type, r.location_name, r.start_time, r.duration, r.capacity, r.entry_type, r.status, r.created_at, r.suspended_at,
              u.id AS host_id, u.name AS host_name, u.email AS host_email, u.city AS host_city
       FROM rituals r
       JOIN users u ON r.host_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    if (ritualResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    const ritual = ritualResult.rows[0];

    const [participantsCount, reportsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM ritual_attendance WHERE ritual_id = $1', [id]),
      pool.query('SELECT COUNT(*) AS c FROM reports WHERE reported_ritual_id = $1', [id]),
    ]);

    res.json({
      success: true,
      data: {
        ...ritual,
        participants_count: parseInt(participantsCount.rows[0]?.c || 0),
        reports_count: parseInt(reportsCount.rows[0]?.c || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching admin ritual detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ritual' });
  }
});

// PATCH /api/admin/rituals/:id - Update ritual (title, start_time, capacity, status)
router.patch('/rituals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, start_time, capacity, status } = req.body;
    const authUserId = req.user?.userId;

    const ritualResult = await pool.query('SELECT id FROM rituals WHERE id = $1', [id]);
    if (ritualResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined && String(title).trim() !== '') {
      updates.push(`title = $${idx}`);
      values.push(String(title).trim());
      idx++;
    }
    if (start_time !== undefined) {
      updates.push(`start_time = $${idx}`);
      values.push(start_time);
      idx++;
    }
    if (capacity !== undefined) {
      const cap = parseInt(capacity);
      if (isNaN(cap) || cap < 1) {
        return res.status(400).json({ success: false, error: 'capacity must be a positive number' });
      }
      updates.push(`capacity = $${idx}`);
      values.push(cap);
      idx++;
    }
    if (status !== undefined) {
      if (!['draft', 'active', 'live', 'ended', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'status must be draft, active, live, ended, or cancelled' });
      }
      updates.push(`status = $${idx}`);
      values.push(status);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await pool.query(
      `UPDATE rituals SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'update_ritual',
      targetType: 'ritual',
      targetId: id,
      details: { title, start_time, capacity, status },
    });

    const updated = await pool.query(
      'SELECT id, title, start_time, capacity, status, updated_at FROM rituals WHERE id = $1',
      [id]
    );
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error('Error updating ritual:', error);
    res.status(500).json({ success: false, error: 'Failed to update ritual' });
  }
});

// POST /api/admin/users/bulk-rs - Bulk update RS (body: { updates: [{ user_id or email, rs_score }] })
router.post('/users/bulk-rs', async (req, res) => {
  try {
    const { updates: updatesList } = req.body;
    const authUserId = req.user?.userId;

    if (!Array.isArray(updatesList) || updatesList.length === 0) {
      return res.status(400).json({ success: false, error: 'updates array required (items: user_id or email, rs_score)' });
    }

    const results = { updated: 0, errors: [] };

    for (const item of updatesList) {
      const { user_id, email, rs_score: rsStr } = item;
      const rs = parseFloat(rsStr);
      if (isNaN(rs) || rs < 1 || rs > 10) {
        results.errors.push({ item, error: 'Invalid rs_score' });
        continue;
      }

      let userId = user_id;
      if (!userId && email) {
        const r = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [String(email).trim()]);
        if (r.rows.length === 0) {
          results.errors.push({ item, error: 'User not found' });
          continue;
        }
        userId = r.rows[0].id;
      }
      if (!userId) {
        results.errors.push({ item, error: 'user_id or email required' });
        continue;
      }

      const userResult = await pool.query('SELECT rs_score FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        results.errors.push({ item, error: 'User not found' });
        continue;
      }
      const oldRs = userResult.rows[0].rs_score != null ? parseFloat(userResult.rows[0].rs_score) : 6.0;

      await pool.query(
        'UPDATE users SET rs_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [rs, userId]
      );
      await pool.query(
        `INSERT INTO rs_history (user_id, old_rs, new_rs, source, admin_user_id)
         VALUES ($1, $2, $3, 'bulk', $4)`,
        [userId, oldRs, rs, authUserId]
      );
      results.updated++;
    }

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'bulk_rs_update',
      targetType: 'bulk',
      targetId: null,
      details: { updated: results.updated, errors: results.errors.length },
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error bulk RS update:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk update RS' });
  }
});

// POST /api/admin/announcements - Send announcement email to users
router.post('/announcements', async (req, res) => {
  try {
    const { user_ids, send_to_all, subject, body } = req.body;
    const authUserId = req.user?.userId;

    if (!subject || !body) {
      return res.status(400).json({ success: false, error: 'subject and body required' });
    }

    let emails = [];
    if (send_to_all) {
      const r = await pool.query('SELECT email FROM users WHERE email IS NOT NULL AND email != \'\' AND suspended_at IS NULL');
      emails = r.rows.map(row => row.email).filter(Boolean);
    } else if (Array.isArray(user_ids) && user_ids.length > 0) {
      const placeholders = user_ids.map((_, i) => `$${i + 1}`).join(',');
      const r = await pool.query(
        `SELECT email FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL AND email != ''`,
        user_ids
      );
      emails = r.rows.map(row => row.email).filter(Boolean);
    } else {
      return res.status(400).json({ success: false, error: 'user_ids or send_to_all required' });
    }

    const sent = [];
    const failed = [];
    for (const email of emails) {
      try {
        await sendAnnouncementEmail(email, subject, body);
        sent.push(email);
      } catch (e) {
        failed.push({ email, error: e.message });
      }
    }

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'send_announcement',
      targetType: 'announcement',
      targetId: null,
      details: { subject, sent: sent.length, failed: failed.length },
    });

    res.json({
      success: true,
      data: { sent: sent.length, failed: failed.length, sent_list: sent, failed_list: failed },
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ success: false, error: 'Failed to send announcement' });
  }
});

// POST /api/admin/users/:id/anonymize - Anonymize user (GDPR: clear PII, keep rs_score etc.)
router.post('/users/:id/anonymize', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = req.user?.userId;

    const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const anonymizedId = `anon-${id.slice(0, 8)}-${Date.now()}`;
    await pool.query(
      `UPDATE users SET
        name = $1,
        email = NULL,
        password_hash = NULL,
        avatar_url = NULL,
        verification_token = NULL,
        verification_token_expires = NULL,
        reset_token = NULL,
        reset_token_expires = NULL,
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [anonymizedId, id]
    );

    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'anonymize_user',
      targetType: 'user',
      targetId: id,
      details: { previous_email: userResult.rows[0].email },
    });

    res.json({ success: true, message: 'User anonymized' });
  } catch (error) {
    console.error('Error anonymizing user:', error);
    res.status(500).json({ success: false, error: 'Failed to anonymize user' });
  }
});

// GET /api/admin/report-templates - List report note templates
router.get('/report-templates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, body, created_at, updated_at FROM report_templates ORDER BY name ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    if (error.code === '42P01') {
      return res.json({ success: true, data: [] });
    }
    console.error('Error listing report templates:', error);
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
});

// POST /api/admin/report-templates - Create template
router.post('/report-templates', async (req, res) => {
  try {
    const { name, body } = req.body;
    if (!name || !body) {
      return res.status(400).json({ success: false, error: 'name and body required' });
    }
    const result = await pool.query(
      `INSERT INTO report_templates (name, body) VALUES ($1, $2)
       RETURNING id, name, body, created_at, updated_at`,
      [String(name).trim(), String(body).trim()]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// PATCH /api/admin/report-templates/:id
router.patch('/report-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, body } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) {
      updates.push(`name = $${idx}`);
      values.push(String(name).trim());
      idx++;
    }
    if (body !== undefined) {
      updates.push(`body = $${idx}`);
      values.push(String(body).trim());
      idx++;
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    const result = await pool.query(
      `UPDATE report_templates SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, body, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// DELETE /api/admin/report-templates/:id
router.delete('/report-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM report_templates WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// GET /api/admin/audit-log - List admin audit log (paginated, optional action filter)
router.get('/audit-log', async (req, res) => {
  try {
    const { limit = 50, offset = 0, action = '' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    let whereClause = '';
    const params = [];
    let idx = 1;
    if (action && String(action).trim()) {
      whereClause = `WHERE a.action = $${idx}`;
      params.push(String(action).trim());
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT a.id, a.admin_user_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
              u.name AS admin_name, u.email AS admin_email
       FROM admin_audit_log a
       LEFT JOIN users u ON a.admin_user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM admin_audit_log a ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing audit log:', error);
    res.status(500).json({ success: false, error: 'Failed to list audit log' });
  }
});

// GET /api/admin/memories - List memories (admin only, paginated)
router.get('/memories', async (req, res) => {
  try {
    const { limit = 50, offset = 0, ritual_id = '' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    let whereClause = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (ritual_id && ritual_id.trim()) {
      whereClause += ` AND m.ritual_id = $${idx}`;
      params.push(ritual_id.trim());
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT m.id, m.ritual_id, m.user_id, m.content, m.memory_type, m.expires_at, m.created_at,
              u.name AS user_name, rt.title AS ritual_title
       FROM memories m
       LEFT JOIN users u ON m.user_id = u.id
       LEFT JOIN rituals rt ON m.ritual_id = rt.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM memories m ${whereClause}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows.map(r => ({
        ...r,
        content_preview: r.content ? String(r.content).slice(0, 200) + (r.content.length > 200 ? '…' : '') : '',
      })),
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error listing admin memories:', error);
    res.status(500).json({ success: false, error: 'Failed to list memories' });
  }
});

// DELETE /api/admin/memories/:id - Delete a memory (admin only)
router.delete('/memories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authUserId = req.user?.userId;
    const result = await pool.query('SELECT id, ritual_id, user_id FROM memories WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Memory not found' });
    }
    await pool.query('DELETE FROM memories WHERE id = $1', [id]);
    await logAdminAction(pool, {
      adminUserId: authUserId,
      action: 'delete_memory',
      targetType: 'memory',
      targetId: id,
      details: { ritual_id: result.rows[0].ritual_id, user_id: result.rows[0].user_id },
    });
    res.json({ success: true, message: 'Memory deleted' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ success: false, error: 'Failed to delete memory' });
  }
});

// GET /api/admin/system-info - Basic system info (admin only)
router.get('/system-info', async (req, res) => {
  try {
    let dbStatus = 'unknown';
    try {
      await pool.query('SELECT 1 as health');
      dbStatus = 'ok';
    } catch (e) {
      dbStatus = 'error';
    }
    res.json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || 'development',
        uptime_seconds: Math.round(process.uptime()),
        database: dbStatus,
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch system info' });
  }
});

// GET /api/admin/venue-applications — pending venue başvuruları
router.get('/venue-applications', async (req, res) => {
  try {
    const { status = 'pending', limit, offset } = req.query;
    const { listVenueApplications } = await import('../services/venueApplicationService.js');
    const rows = await listVenueApplications({ status, limit, offset });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list venue applications' });
  }
});

router.post('/venue-applications/:id/approve', async (req, res) => {
  try {
    const { approveVenueApplication } = await import('../services/venueApplicationService.js');
    const result = await approveVenueApplication(req.params.id, req.user.userId, {
      reviewerNote: req.body?.reviewer_note,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    await logAdminAction(pool, {
      adminId: req.user.userId,
      action: 'approve_venue_application',
      targetType: 'venue_application',
      targetId: req.params.id,
      details: { venue_id: result.venue?.id },
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve application' });
  }
});

router.post('/venue-applications/:id/reject', async (req, res) => {
  try {
    const { rejectVenueApplication } = await import('../services/venueApplicationService.js');
    const result = await rejectVenueApplication(req.params.id, req.user.userId, {
      reviewerNote: req.body?.reviewer_note,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    await logAdminAction(pool, {
      adminId: req.user.userId,
      action: 'reject_venue_application',
      targetType: 'venue_application',
      targetId: req.params.id,
    });
    return res.json({ success: true, data: result.application });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reject application' });
  }
});

// §10 — 🟡-chip kullanım oranı (kalibrasyon)
router.get('/chip-calibration', async (req, res) => {
  try {
    const { getYellowChipCalibration } = await import('../services/chipService.js');
    const data = await getYellowChipCalibration({ days: req.query.days });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load chip calibration' });
  }
});

// §9 — Chip→badge bridge signals (auto-grant kapalı; inceleme kuyruğu)
router.get('/chip-badge-signals', async (req, res) => {
  try {
    const { listChipBadgeSignals } = await import('../services/chipBadgeBridgeService.js');
    const rows = await listChipBadgeSignals({
      status: req.query.status || 'ready',
      limit: req.query.limit,
    });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list chip-badge signals' });
  }
});

router.post('/chip-badge-signals/:id/dismiss', async (req, res) => {
  try {
    const { dismissChipBadgeSignal } = await import('../services/chipBadgeBridgeService.js');
    const result = await dismissChipBadgeSignal(req.params.id, req.user.userId, req.body?.note);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.signal });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to dismiss signal' });
  }
});

// §9 — Venue-created badge admin onayı
router.get('/venue-badges/pending', async (req, res) => {
  try {
    const { listPendingVenueBadges } = await import('../services/venueBadgeService.js');
    const rows = await listPendingVenueBadges({ limit: req.query.limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list venue badges' });
  }
});

router.post('/venue-badges/:id/approve', async (req, res) => {
  try {
    const { reviewVenueBadge } = await import('../services/venueBadgeService.js');
    const result = await reviewVenueBadge(req.params.id, req.user.userId, {
      approve: true,
      note: req.body?.note,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve venue badge' });
  }
});

router.post('/venue-badges/:id/reject', async (req, res) => {
  try {
    const { reviewVenueBadge } = await import('../services/venueBadgeService.js');
    const result = await reviewVenueBadge(req.params.id, req.user.userId, {
      approve: false,
      note: req.body?.note,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reject venue badge' });
  }
});

// F6 — LLM badge onay kuyrugu (stub)
router.get('/badge-llm-suggestions', async (req, res) => {
  try {
    const { listPendingLlmSuggestions } = await import('../services/badgeLlmPipeline.js');
    const rows = await listPendingLlmSuggestions({ limit: req.query.limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list suggestions' });
  }
});

router.post('/badge-llm-suggestions/:id/approve', async (req, res) => {
  try {
    const { reviewLlmSuggestion } = await import('../services/badgeLlmPipeline.js');
    const result = await reviewLlmSuggestion(req.params.id, req.user.userId, { approve: true, note: req.body?.note });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve suggestion' });
  }
});

router.post('/badge-llm-suggestions/:id/reject', async (req, res) => {
  try {
    const { reviewLlmSuggestion } = await import('../services/badgeLlmPipeline.js');
    const result = await reviewLlmSuggestion(req.params.id, req.user.userId, { approve: false, note: req.body?.note });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reject suggestion' });
  }
});

// POST /api/admin/users/:id/badges/grant — manuel rozet atama (§10 launch)
router.post('/users/:id/badges/grant', async (req, res) => {
  try {
    const { assignManualBadge } = await import('../services/badgeEngine.js');
    const result = await assignManualBadge(req.params.id, req.body?.slug, req.body?.level || 'novice', {
      ritualId: req.body?.ritual_id || null,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to grant badge' });
  }
});

// POST /api/admin/venues/:id/shadow-link — golge-venue gecmis baglama (§9.5)
router.post('/venues/:id/shadow-link', async (req, res) => {
  try {
    const { linkShadowVenueHistory } = await import('../services/shadowVenueService.js');
    const result = await linkShadowVenueHistory(req.params.id, { force: req.body?.force === true });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Shadow link failed' });
  }
});

// GET /api/admin/rs-sanity — config kalibrasyon simülasyonu (§16)
router.get('/rs-sanity', async (req, res) => {
  try {
    const { runAllSanitySimulations } = await import('../services/rsSanitySimulation.js');
    const report = runAllSanitySimulations();
    return res.json({ success: true, data: report });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Simulation failed' });
  }
});

// GET /api/admin/config — §12 kalibrasyon snapshot (read-only)
router.get('/config', async (_req, res) => {
  try {
    const { getPublicConfig } = await import('../services/publicConfigService.js');
    const LOCAL_CONFIG = (await import('../config/localConfig.js')).default;
    return res.json({
      success: true,
      data: {
        public: getPublicConfig(),
        badges_catalog_count: (LOCAL_CONFIG.badges.CATALOG || []).length,
        stubs: LOCAL_CONFIG.stubs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load config' });
  }
});

// GET /api/admin/founder-decisions — son-part1.md §10 çözümleri
router.get('/founder-decisions', async (_req, res) => {
  try {
    const { getFounderDecisionsSummary } = await import('../config/founderDecisions.js');
    return res.json({ success: true, data: getFounderDecisionsSummary() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load founder decisions' });
  }
});

// GET /api/admin/users/:id/score-events
router.get('/users/:id/score-events', async (req, res) => {
  try {
    const { listScoreEventsForUser } = await import('../services/scoreEventService.js');
    const rows = await listScoreEventsForUser(req.params.id, { limit: req.query.limit });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load score events' });
  }
});

// POST /api/admin/venues/:id/package-activate — odeme sonrasi manuel tier
router.post('/venues/:id/package-activate', async (req, res) => {
  try {
    const { activateVenuePackageTier } = await import('../services/venueBusinessService.js');
    const result = await activateVenuePackageTier(req.params.id, req.body?.tier_id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to activate package' });
  }
});

/** §12 — brand oluşturma admin-only (pilot; self-serve yok) */
router.get('/brands', async (req, res) => {
  try {
    const { listBrands } = await import('../services/brandService.js');
    const result = await listBrands({ limit: req.query.limit });
    return res.json({ success: true, data: result.brands });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list brands' });
  }
});

router.post('/brands', async (req, res) => {
  try {
    const { createBrandAdmin } = await import('../services/brandService.js');
    const result = await createBrandAdmin({
      name: req.body?.name,
      logoUrl: req.body?.logo_url,
      category: req.body?.category,
      oneLiner: req.body?.one_liner,
      slug: req.body?.slug,
      memberUserIds: req.body?.member_user_ids || [],
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    await logAdminAction(pool, {
      adminUserId: req.user.userId,
      action: 'brand.create',
      targetType: 'brand',
      targetId: result.brand.id,
      details: { name: result.brand.name },
    }).catch(() => {});
    return res.status(201).json({ success: true, data: result.brand });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to create brand' });
  }
});

router.post('/brands/:id/members', async (req, res) => {
  try {
    const { addBrandMember } = await import('../services/brandService.js');
    const result = await addBrandMember(req.params.id, req.body?.user_id, {
      role: req.body?.role,
      verified: req.body?.verified !== false,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to add brand member' });
  }
});

export default router;
