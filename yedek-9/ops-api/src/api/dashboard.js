import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { canViewAll, canAccessSection } from '../utils/roles.js';

const router = express.Router();
router.use(requireOpsAuth);

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ success: false, error: 'project_id required' });
    }

    const role = req.opsUser.role;
    const userId = req.opsUser.id;
    const out = { role, sections: {} };

    if (canAccessSection(role, 'hosts')) {
      const hosts = await pool.query(
        `SELECT pipeline_status, COUNT(*)::int AS n
         FROM ops.ops_host_pipeline WHERE project_id = $1
         GROUP BY pipeline_status`,
        [project_id]
      );
      const hostList = await pool.query(
        `SELECT id, display_name, pipeline_status, rituals_hosted,
          CASE WHEN host_feedback IS NOT NULL AND TRIM(host_feedback) <> '' THEN true ELSE false END AS has_feedback
         FROM ops.ops_host_pipeline WHERE project_id = $1
         ORDER BY updated_at DESC LIMIT 8`,
        [project_id]
      );
      out.sections.hosts = {
        by_status: Object.fromEntries(hosts.rows.map((r) => [r.pipeline_status, r.n])),
        recent: hostList.rows,
      };
    }

    if (canAccessSection(role, 'venues')) {
      const venues = await pool.query(
        `SELECT pipeline_status, COUNT(*)::int AS n
         FROM ops.ops_venue_pipeline WHERE project_id = $1
         GROUP BY pipeline_status`,
        [project_id]
      );
      out.sections.venues = {
        by_status: Object.fromEntries(venues.rows.map((r) => [r.pipeline_status, r.n])),
        target: venues.rows.find((r) => r.pipeline_status === 'target')?.n || 0,
        agreed: (venues.rows.find((r) => r.pipeline_status === 'agreed')?.n || 0) +
          (venues.rows.find((r) => r.pipeline_status === 'active')?.n || 0),
        declined: venues.rows.find((r) => r.pipeline_status === 'declined')?.n || 0,
      };
    }

    if (canAccessSection(role, 'screens')) {
      let screenWhere = 'WHERE project_id = $1';
      const screenParams = [project_id];
      if (!canViewAll(role) && role === 'designer') {
        screenWhere += ' AND (designer_id = $2 OR designer_id IS NULL)';
        screenParams.push(userId);
      } else if (!canViewAll(role) && role === 'developer') {
        screenWhere += ' AND (developer_id = $2 OR developer_id IS NULL)';
        screenParams.push(userId);
      }

      const screens = await pool.query(
        `SELECT design_status, dev_status, is_target FROM ops.ops_screens ${screenWhere}`,
        screenParams
      );

      const stats = {
        target_total: 0,
        design_done: 0,
        dev_done: 0,
        design_in_progress: 0,
        dev_in_progress: 0,
      };
      for (const s of screens.rows) {
        if (s.is_target) stats.target_total++;
        if (s.design_status === 'done') stats.design_done++;
        if (s.dev_status === 'done') stats.dev_done++;
        if (s.design_status === 'in_progress' || s.design_status === 'review') stats.design_in_progress++;
        if (s.dev_status === 'in_progress' || s.dev_status === 'qa') stats.dev_in_progress++;
      }
      out.sections.screens = stats;
    }

    if (canAccessSection(role, 'projects')) {
      let taskWhere = 'WHERE t.project_id = $1';
      const taskParams = [project_id];
      if (!canViewAll(role)) {
        taskWhere += ' AND t.assignee_id = $2';
        taskParams.push(userId);
      }
      const tasks = await pool.query(
        `SELECT t.id, t.title, t.priority, c.name AS column_name
         FROM ops.ops_tasks t
         JOIN ops.ops_board_columns c ON c.id = t.column_id
         ${taskWhere}
         ORDER BY t.updated_at DESC LIMIT 10`,
        taskParams
      );
      out.sections.my_tasks = tasks.rows;
    }

    const nav = ['dashboard'];
    if (canAccessSection(role, 'projects')) nav.push('projects');
    if (canAccessSection(role, 'hosts')) nav.push('hosts');
    if (canAccessSection(role, 'venues')) nav.push('venues');
    if (canAccessSection(role, 'screens')) nav.push('screens');
    if (canAccessSection(role, 'bridge')) nav.push('bridge');
    if (canAccessSection(role, 'venues') || canAccessSection(role, 'bridge')) nav.push('nominations');
    if (canAccessSection(role, 'venues') || canAccessSection(role, 'bridge')) nav.push('event_groups');
    if (canAccessSection(role, 'team')) nav.push('team');

    out.nav = nav;
    out.can_view_all = canViewAll(role);

    res.json({ success: true, data: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Dashboard failed' });
  }
});

router.get('/permissions', (req, res) => {
  const role = req.opsUser.role;
  res.json({
    success: true,
    data: {
      role,
      can_view_all: canViewAll(role),
      nav: [
        canAccessSection(role, 'dashboard') && { key: 'dashboard', path: '/dashboard', label: 'Özet' },
        canAccessSection(role, 'hosts') && { key: 'hosts', path: '/hosts', label: 'Hostlar' },
        canAccessSection(role, 'venues') && { key: 'venues', path: '/venues', label: 'Mekanlar' },
        canAccessSection(role, 'screens') && { key: 'screens', path: '/screens', label: 'Ekranlar' },
        canAccessSection(role, 'projects') && { key: 'projects', path: '/', label: 'Kanban' },
        canAccessSection(role, 'bridge') && { key: 'bridge', path: '/bridge', label: 'Köprü' },
        (canAccessSection(role, 'venues') || canAccessSection(role, 'bridge')) && {
          key: 'nominations',
          path: '/nominations',
          label: 'Öneriler',
        },
        (canAccessSection(role, 'venues') || canAccessSection(role, 'bridge')) && {
          key: 'event_groups',
          path: '/event-groups',
          label: 'ZONE-EVENT',
        },
        canAccessSection(role, 'team') && { key: 'team', path: '/team', label: 'Ekip' },
      ].filter(Boolean),
      default_route:
        role === 'host_lead'
          ? '/hosts'
          : role === 'venue_lead'
            ? '/venues'
            : role === 'designer' || role === 'developer'
              ? '/screens'
              : '/dashboard',
    },
  });
});

export default router;
