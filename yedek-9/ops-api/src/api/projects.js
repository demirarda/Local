import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireOpsAuth);

function mapTaskRow(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    column_id: r.column_id,
    title: r.title,
    description: r.description,
    priority: r.priority,
    assignee_id: r.assignee_id,
    assignee_name: r.assignee_name,
    reporter_id: r.reporter_id,
    due_date: r.due_date,
    position: r.position,
    parent_task_id: r.parent_task_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    links: r.links || [],
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
        (SELECT COUNT(*)::int FROM ops.ops_tasks t WHERE t.project_id = p.id) AS task_count
       FROM ops.ops_projects p
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, city, target_date, columns } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Project name required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const proj = await client.query(
        `INSERT INTO ops.ops_projects (name, city, target_date)
         VALUES ($1, $2, $3) RETURNING *`,
        [name.trim(), city?.trim() || null, target_date || null]
      );
      const projectId = proj.rows[0].id;

      const defaultColumns = columns?.length
        ? columns
        : ['Backlog', 'Brief', 'Tasarım', 'Geliştirme', 'QA', 'Tamamlandı'];

      for (let i = 0; i < defaultColumns.length; i++) {
        const colName = typeof defaultColumns[i] === 'string' ? defaultColumns[i] : defaultColumns[i].name;
        await client.query(
          `INSERT INTO ops.ops_board_columns (project_id, name, position) VALUES ($1, $2, $3)`,
          [projectId, colName, i]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: proj.rows[0] });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

router.get('/:id/board', async (req, res) => {
  try {
    const { id } = req.params;

    const proj = await pool.query('SELECT * FROM ops.ops_projects WHERE id = $1', [id]);
    if (!proj.rows[0]) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const columnsResult = await pool.query(
      `SELECT * FROM ops.ops_board_columns WHERE project_id = $1 ORDER BY position`,
      [id]
    );

    const tasksResult = await pool.query(
      `SELECT t.*, u.name AS assignee_name
       FROM ops.ops_tasks t
       LEFT JOIN ops.ops_users u ON u.id = t.assignee_id
       WHERE t.project_id = $1
       ORDER BY t.position, t.created_at`,
      [id]
    );

    const linksResult = await pool.query(
      `SELECT l.* FROM ops.ops_task_links l
       INNER JOIN ops.ops_tasks t ON t.id = l.task_id
       WHERE t.project_id = $1`,
      [id]
    );

    const linksByTask = {};
    for (const link of linksResult.rows) {
      if (!linksByTask[link.task_id]) linksByTask[link.task_id] = [];
      linksByTask[link.task_id].push({
        id: link.id,
        link_type: link.link_type,
        ref_key: link.ref_key,
        ref_label: link.ref_label,
        meta: link.meta,
      });
    }

    const tasksByColumn = {};
    for (const t of tasksResult.rows) {
      const mapped = mapTaskRow({ ...t, links: linksByTask[t.id] || [] });
      if (!tasksByColumn[t.column_id]) tasksByColumn[t.column_id] = [];
      tasksByColumn[t.column_id].push(mapped);
    }

    const columns = columnsResult.rows.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      wip_limit: c.wip_limit,
      tasks: tasksByColumn[c.id] || [],
    }));

    res.json({
      success: true,
      data: {
        project: proj.rows[0],
        columns,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to load board' });
  }
});

export default router;
