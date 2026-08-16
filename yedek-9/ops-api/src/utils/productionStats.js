import { getProductionPool } from '../config/database.js';
import pool from '../config/database.js';

export async function fetchHostRitualCount(productionUserId) {
  const db = getProductionPool() || pool;
  try {
    const r = await db.query(
      `SELECT COUNT(*)::int AS n FROM rituals WHERE host_id = $1`,
      [productionUserId]
    );
    return r.rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}

export async function syncHostRitualCount(hostPipelineId, productionUserId) {
  if (!productionUserId) return null;
  const count = await fetchHostRitualCount(productionUserId);
  if (count === null) return null;
  await pool.query(
    `UPDATE ops.ops_host_pipeline
     SET rituals_hosted = $1, rituals_hosted_synced_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [count, hostPipelineId]
  );
  return count;
}
