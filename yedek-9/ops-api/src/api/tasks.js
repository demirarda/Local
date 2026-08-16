import express from 'express';
import pool from '../config/database.js';
import { requireOpsAuth } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(requireOpsAuth);

async function getTaskDetail(taskId) {
  const task = await pool.query(
    `SELECT t.*, u.name AS assignee_name, r.name AS reporter_name
     FROM ops.ops_tasks t
     LEFT JOIN ops.ops_users u ON u.id = t.assignee_id
     LEFT JOIN ops.ops_users r ON r.id = t.reporter_id
     WHERE t.id = $1`,
    [taskId]
  );
  if (!task.rows[0]) return null;

  const links = await pool.query(
    `SELECT * FROM ops.ops_task_links WHERE task_id = $1`,
    [taskId]
  );
  const comments = await pool.query(
    `SELECT c.*, u.name AS author_name
     FROM ops.ops_comments c
     JOIN ops.ops_users u ON u.id = c.author_id
     WHERE c.task_id = $1 ORDER BY c.created_at`,
    [taskId]
  );
  const attachments = await pool.query(
    `SELECT a.*, u.name AS uploaded_by_name
     FROM ops.ops_attachments a
     JOIN ops.ops_users u ON u.id = a.uploaded_by
     WHERE a.task_id = $1 ORDER BY a.created_at`,
    [taskId]
  );

  return {
    ...task.rows[0],
    links: links.rows,
    comments: comments.rows,
    attachments: attachments.rows,
  };
}

router.get('/', async (req, res) => {
  try {
    const { project_id, assignee_id, search } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (project_id) {
      where += ` AND t.project_id = $${idx++}`;
      params.push(project_id);
    }
    if (assignee_id) {
      where += ` AND t.assignee_id = $${idx++}`;
      params.push(assignee_id);
    }
    if (search?.trim()) {
      where += ` AND (t.title ILIKE $${idx} OR t.description ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const result = await pool.query(
      `SELECT t.*, u.name AS assignee_name
       FROM ops.ops_tasks t
       LEFT JOIN ops.ops_users u ON u.id = t.assignee_id
       ${where}
       ORDER BY t.updated_at DESC
       LIMIT 100`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list tasks' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      project_id,
      column_id,
      title,
      description,
      priority,
      assignee_id,
      due_date,
      parent_task_id,
    } = req.body;

    if (!project_id || !column_id || !title?.trim()) {
      return res.status(400).json({ success: false, error: 'project_id, column_id, title required' });
    }

    const posResult = await pool.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM ops.ops_tasks WHERE column_id = $1`,
      [column_id]
    );
    const position = posResult.rows[0].next_pos;

    const result = await pool.query(
      `INSERT INTO ops.ops_tasks (
        project_id, column_id, title, description, priority,
        assignee_id, reporter_id, due_date, position, parent_task_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        project_id,
        column_id,
        title.trim(),
        description || null,
        priority || 'medium',
        assignee_id || null,
        req.opsUser.id,
        due_date || null,
        position,
        parent_task_id || null,
      ]
    );

    await logActivity({
      taskId: result.rows[0].id,
      actorId: req.opsUser.id,
      action: 'created',
      payload: { title: title.trim() },
    });

    const detail = await getTaskDetail(result.rows[0].id);
    res.status(201).json({ success: true, data: detail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

router.get('/:id', async (req, res) => {
  const detail = await getTaskDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ success: false, error: 'Task not found' });
  }
  res.json({ success: true, data: detail });
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['title', 'description', 'priority', 'assignee_id', 'due_date', 'column_id'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f] === '' ? null : req.body[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    await pool.query(
      `UPDATE ops.ops_tasks SET ${updates.join(', ')} WHERE id = $${idx}`,
      params
    );

    await logActivity({
      taskId: id,
      actorId: req.opsUser.id,
      action: 'updated',
      payload: req.body,
    });

    const detail = await getTaskDetail(id);
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

router.patch('/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, position } = req.body;
    if (!column_id || position === undefined) {
      return res.status(400).json({ success: false, error: 'column_id and position required' });
    }

    const existing = await pool.query('SELECT column_id, position FROM ops.ops_tasks WHERE id = $1', [id]);
    if (!existing.rows[0]) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    await pool.query(
      `UPDATE ops.ops_tasks SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3`,
      [column_id, position, id]
    );

    await logActivity({
      taskId: id,
      actorId: req.opsUser.id,
      action: 'moved',
      payload: {
        from_column: existing.rows[0].column_id,
        to_column: column_id,
        position,
      },
    });

    const detail = await getTaskDetail(id);
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to move task' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ops.ops_tasks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

router.post('/:id/links', async (req, res) => {
  try {
    const { link_type, ref_key, ref_label, meta } = req.body;
    const validTypes = ['screen', 'host', 'venue', 'ritual', 'doc', 'figma', 'file'];
    if (!validTypes.includes(link_type) || !ref_key) {
      return res.status(400).json({ success: false, error: 'Invalid link' });
    }

    const result = await pool.query(
      `INSERT INTO ops.ops_task_links (task_id, link_type, ref_key, ref_label, meta)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, link_type, ref_key, ref_label || null, JSON.stringify(meta || {})]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add link' });
  }
});

router.delete('/:id/links/:linkId', async (req, res) => {
  await pool.query('DELETE FROM ops.ops_task_links WHERE id = $1 AND task_id = $2', [
    req.params.linkId,
    req.params.id,
  ]);
  res.json({ success: true });
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const baseUrl = process.env.OPS_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
    const url = `${baseUrl}/api/ops/uploads/${req.file.filename}`;

    const result = await pool.query(
      `INSERT INTO ops.ops_attachments (task_id, uploaded_by, file_name, storage_key, url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.opsUser.id, req.file.originalname, req.file.filename, url]
    );

    await logActivity({
      taskId: req.params.id,
      actorId: req.opsUser.id,
      action: 'attachment_added',
      payload: { file_name: req.file.originalname },
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Upload failed' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) {
      return res.status(400).json({ success: false, error: 'Comment body required' });
    }

    const result = await pool.query(
      `INSERT INTO ops.ops_comments (task_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.opsUser.id, body.trim()]
    );

    await logActivity({
      taskId: req.params.id,
      actorId: req.opsUser.id,
      action: 'commented',
    });

    const author = await pool.query('SELECT name FROM ops.ops_users WHERE id = $1', [req.opsUser.id]);

    res.status(201).json({
      success: true,
      data: { ...result.rows[0], author_name: author.rows[0]?.name },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

export default router;
