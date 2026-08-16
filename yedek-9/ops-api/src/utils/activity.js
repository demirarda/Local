import pool from '../config/database.js';

export async function logActivity({ taskId, actorId, action, payload = {} }) {
  await pool.query(
    `INSERT INTO ops.ops_activity_log (task_id, actor_id, action, payload)
     VALUES ($1, $2, $3, $4)`,
    [taskId, actorId, action, JSON.stringify(payload)]
  );
}
