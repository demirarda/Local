import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

// GET /api/analytics/summary - Basic analytics (admin only)
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [usersCount, ritualsCount, ritualsByCity, recentRituals] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM users'),
      pool.query('SELECT COUNT(*) AS count FROM rituals WHERE status IN (\'active\', \'live\', \'ended\')'),
      pool.query(
        `SELECT u.city, COUNT(r.id) AS ritual_count
         FROM rituals r
         JOIN users u ON r.host_id = u.id
         WHERE r.status IN ('active', 'live', 'ended')
         GROUP BY u.city
         ORDER BY ritual_count DESC
         LIMIT 20`
      ),
      pool.query(
        `SELECT r.id, r.title, r.status, r.start_time, u.city
         FROM rituals r
         JOIN users u ON r.host_id = u.id
         ORDER BY r.created_at DESC
         LIMIT 10`
      ),
    ]);

    res.json({
      success: true,
      data: {
        total_users: parseInt(usersCount.rows[0]?.count || 0),
        total_rituals: parseInt(ritualsCount.rows[0]?.count || 0),
        by_city: ritualsByCity.rows.map(r => ({ city: r.city, count: parseInt(r.ritual_count) })),
        recent_rituals: recentRituals.rows.map(r => ({
          id: r.id,
          title: r.title,
          status: r.status,
          start_time: r.start_time,
          city: r.city,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

// GET /api/analytics/dashboard - Extended metrics for admin dashboard (optional ?days=7|30)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));
    const interval = `INTERVAL '${days} days'`;

    const [
      usersCount,
      ritualsCount,
      ritualsByCity,
      recentRituals,
      recentUsers,
      ritualsByDay,
      feedbackCount,
      attendanceCount,
      reportsPending,
      suspendedUsers,
      suspendedRituals,
      usersByDay,
      rsDistribution,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM users'),
      pool.query('SELECT COUNT(*) AS count FROM rituals'),
      pool.query(
        `SELECT u.city, COUNT(r.id) AS ritual_count
         FROM rituals r
         JOIN users u ON r.host_id = u.id
         GROUP BY u.city
         ORDER BY ritual_count DESC
         LIMIT 15`
      ),
      pool.query(
        `SELECT r.id, r.title, r.status, r.start_time, u.city
         FROM rituals r
         JOIN users u ON r.host_id = u.id
         ORDER BY r.created_at DESC
         LIMIT 15`
      ),
      pool.query(
        `SELECT id, name, email, city, created_at FROM users ORDER BY created_at DESC LIMIT 10`
      ),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM rituals
         WHERE created_at >= CURRENT_DATE - ${interval}
         GROUP BY DATE(created_at)
         ORDER BY day`,
        []
      ),
      pool.query('SELECT COUNT(*) AS count FROM feedback'),
      pool.query('SELECT COUNT(*) AS count FROM ritual_attendance'),
      pool.query("SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'"),
      pool.query('SELECT COUNT(*) AS count FROM users WHERE suspended_at IS NOT NULL'),
      pool.query('SELECT COUNT(*) AS count FROM rituals WHERE suspended_at IS NOT NULL'),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*) AS count
         FROM users
         WHERE created_at >= CURRENT_DATE - ${interval}
         GROUP BY DATE(created_at)
         ORDER BY day`,
        []
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE rs_score >= 1 AND rs_score < 4) AS bucket_1_4,
           COUNT(*) FILTER (WHERE rs_score >= 4 AND rs_score < 7) AS bucket_4_7,
           COUNT(*) FILTER (WHERE rs_score >= 7 AND rs_score <= 10) AS bucket_7_10
         FROM users WHERE rs_score IS NOT NULL`
      ),
    ]);

    const daySet = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      daySet[key] = { day: key, rituals: 0, users: 0 };
    }
    ritualsByDay.rows.forEach(r => {
      const key = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
      if (daySet[key]) daySet[key].rituals = parseInt(r.count);
    });
    usersByDay.rows.forEach(r => {
      const key = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10);
      if (daySet[key]) daySet[key].users = parseInt(r.count);
    });

    const rs = rsDistribution.rows[0];
    res.json({
      success: true,
      data: {
        total_users: parseInt(usersCount.rows[0]?.count || 0),
        total_rituals: parseInt(ritualsCount.rows[0]?.count || 0),
        total_feedback: parseInt(feedbackCount.rows[0]?.count || 0),
        total_attendance: parseInt(attendanceCount.rows[0]?.count || 0),
        reports_pending: parseInt(reportsPending.rows[0]?.count || 0),
        suspended_users: parseInt(suspendedUsers.rows[0]?.count || 0),
        suspended_rituals: parseInt(suspendedRituals.rows[0]?.count || 0),
        by_city: ritualsByCity.rows.map(r => ({ city: r.city, count: parseInt(r.ritual_count) })),
        recent_rituals: recentRituals.rows.map(r => ({
          id: r.id,
          title: r.title,
          status: r.status,
          start_time: r.start_time,
          city: r.city,
        })),
        recent_users: recentUsers.rows.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          city: u.city,
          created_at: u.created_at,
        })),
        chart_days: Object.values(daySet).sort((a, b) => a.day.localeCompare(b.day)),
        days_param: days,
        rs_distribution: {
          '1-3.9': parseInt(rs?.bucket_1_4 || 0),
          '4-6.9': parseInt(rs?.bucket_4_7 || 0),
          '7-10': parseInt(rs?.bucket_7_10 || 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics dashboard',
    });
  }
});

// GET /api/analytics/rs-anomalies - Users with unusual RS changes (admin only)
router.get('/rs-anomalies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days) || 30));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    // Note: days is numeric and clamped, safe to interpolate into INTERVAL
    const result = await pool.query(
      `
      SELECT
        h.user_id,
        u.name,
        u.email,
        u.city,
        u.university,
        u.rs_score,
        COUNT(*) AS change_count,
        SUM(ABS(h.new_rs - h.old_rs)) AS total_abs_change,
        MAX(ABS(h.new_rs - h.old_rs)) AS max_abs_change,
        MIN(h.created_at) AS first_change_at,
        MAX(h.created_at) AS last_change_at
      FROM rs_history h
      JOIN users u ON u.id = h.user_id
      WHERE h.created_at >= NOW() - INTERVAL '${days} days'
        AND (h.source IS NULL OR h.source <> 'admin')
        AND h.old_rs IS NOT NULL
        AND h.new_rs IS NOT NULL
      GROUP BY h.user_id, u.name, u.email, u.city, u.university, u.rs_score
      HAVING COUNT(*) >= 3 OR MAX(ABS(h.new_rs - h.old_rs)) >= 1.0
      ORDER BY total_abs_change DESC
      LIMIT $1
      `,
      [limit]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        user_id: r.user_id,
        name: r.name,
        email: r.email,
        city: r.city,
        university: r.university,
        current_rs: r.rs_score != null ? parseFloat(r.rs_score) : null,
        change_count: parseInt(r.change_count || 0),
        total_abs_change: r.total_abs_change != null ? parseFloat(r.total_abs_change) : 0,
        max_abs_change: r.max_abs_change != null ? parseFloat(r.max_abs_change) : 0,
        first_change_at: r.first_change_at,
        last_change_at: r.last_change_at,
      })),
      days,
      limit,
    });
  } catch (error) {
    if (error.code === '42P01') {
      // rs_history table not found (migration not run yet) – return empty
      return res.json({ success: true, data: [], days: null, limit: null });
    }
    console.error('Error fetching RS anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RS anomalies',
    });
  }
});

// GET /api/analytics/notifications - Aggregate notification metrics (admin only)
router.get('/notifications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));

    const [totals, byType] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*) AS sent,
          COUNT(*) FILTER (WHERE read = true) AS read_count
        FROM notifications
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        `
      ),
      pool.query(
        `
        SELECT
          type,
          COUNT(*) AS sent,
          COUNT(*) FILTER (WHERE read = true) AS read_count
        FROM notifications
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY type
        ORDER BY sent DESC
        `
      ),
    ]);

    const t = totals.rows[0] || {};
    const totalSent = parseInt(t.sent || 0);
    const totalRead = parseInt(t.read_count || 0);

    res.json({
      success: true,
      data: {
        days_param: days,
        total_sent: totalSent,
        total_read: totalRead,
        total_read_rate: totalSent > 0 ? totalRead / totalSent : 0,
        by_type: byType.rows.map(r => {
          const sent = parseInt(r.sent || 0);
          const readCount = parseInt(r.read_count || 0);
          return {
            type: r.type || 'unknown',
            sent,
            read: readCount,
            read_rate: sent > 0 ? readCount / sent : 0,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching notification analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification analytics',
    });
  }
});

// GET /api/analytics/safety - High-level safety / reports overview (admin only)
router.get('/safety', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));

    const [
      totals,
      byType,
      topUsers,
      topRituals,
    ] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
          COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed
        FROM reports
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        `
      ),
      pool.query(
        `
        SELECT report_type, COUNT(*) AS count
        FROM reports
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY report_type
        ORDER BY count DESC
        `
      ),
      pool.query(
        `
        SELECT
          r.reported_user_id AS user_id,
          u.name,
          u.email,
          u.city,
          COUNT(*) AS report_count,
          MAX(r.status) FILTER (WHERE r.status = 'pending') IS NOT NULL AS has_pending
        FROM reports r
        JOIN users u ON u.id = r.reported_user_id
        WHERE r.report_type = 'user'
          AND r.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY r.reported_user_id, u.name, u.email, u.city
        ORDER BY report_count DESC
        LIMIT 10
        `
      ),
      pool.query(
        `
        SELECT
          r.reported_ritual_id AS ritual_id,
          rt.title,
          u.name AS host_name,
          COUNT(*) AS report_count,
          MAX(r.status) FILTER (WHERE r.status = 'pending') IS NOT NULL AS has_pending
        FROM reports r
        JOIN rituals rt ON rt.id = r.reported_ritual_id
        JOIN users u ON u.id = rt.host_id
        WHERE r.report_type = 'ritual'
          AND r.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY r.reported_ritual_id, rt.title, u.name
        ORDER BY report_count DESC
        LIMIT 10
        `
      ),
    ]);

    const t = totals.rows[0] || {};

    res.json({
      success: true,
      data: {
        days_param: days,
        total_reports: parseInt(t.total || 0),
        pending_reports: parseInt(t.pending || 0),
        resolved_reports: parseInt(t.resolved || 0),
        dismissed_reports: parseInt(t.dismissed || 0),
        by_type: byType.rows.map(r => ({
          report_type: r.report_type,
          count: parseInt(r.count || 0),
        })),
        top_reported_users: topUsers.rows.map(r => ({
          user_id: r.user_id,
          name: r.name,
          email: r.email,
          city: r.city,
          report_count: parseInt(r.report_count || 0),
          has_pending: !!r.has_pending,
        })),
        top_reported_rituals: topRituals.rows.map(r => ({
          ritual_id: r.ritual_id,
          title: r.title,
          host_name: r.host_name,
          report_count: parseInt(r.report_count || 0),
          has_pending: !!r.has_pending,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching safety analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch safety analytics',
    });
  }
});

export default router;
