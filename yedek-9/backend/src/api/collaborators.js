/**
 * Collaborator management — Series / event_group / venue_event
 */
import express from 'express';
import { authenticateToken } from './auth.js';
import { addCollaborator, listCollaborators } from '../services/waveBSocial.js';
import pool from '../config/database.js';

const router = express.Router();

router.get('/:scope/:scopeId', authenticateToken, async (req, res) => {
  try {
    const rows = await listCollaborators(req.params.scope, req.params.scopeId);
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to list collaborators' });
  }
});

router.post('/:scope/:scopeId', authenticateToken, async (req, res) => {
  try {
    const { user_id, permissions } = req.body || {};
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id required' });
    }
    // Owner gate: series.host_id / event_group.created_by / venue manager
    const scope = req.params.scope;
    const scopeId = req.params.scopeId;
    const actor = req.user.userId;
    let ownerOk = false;
    if (scope === 'series') {
      const r = await pool.query(`SELECT host_id FROM ritual_series WHERE id = $1`, [scopeId]);
      ownerOk = r.rows[0] && String(r.rows[0].host_id) === String(actor);
    } else if (scope === 'event_group') {
      const r = await pool.query(`SELECT created_by FROM ritual_event_groups WHERE id = $1`, [scopeId]);
      ownerOk = r.rows[0] && String(r.rows[0].created_by) === String(actor);
    } else if (scope === 'venue_event') {
      const r = await pool.query(
        `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
        [scopeId, actor]
      );
      ownerOk = r.rows.length > 0;
    }
    if (!ownerOk) {
      return res.status(403).json({ success: false, error: 'Only owner can invite collaborators' });
    }

    const result = await addCollaborator({
      scope,
      scopeId,
      userId: user_id,
      invitedBy: actor,
      permissions,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, data: result.collaborator });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Failed to add collaborator' });
  }
});

router.delete('/:scope/:scopeId/:userId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE organizers_collaborators
       SET status = 'revoked'
       WHERE scope = $1::collaborator_scope AND scope_id = $2 AND user_id = $3`,
      [req.params.scope, req.params.scopeId, req.params.userId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to revoke collaborator' });
  }
});

export default router;
