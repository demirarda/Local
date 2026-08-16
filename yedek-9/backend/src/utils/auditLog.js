/**
 * Log admin moderation actions to admin_audit_log table.
 * @param {object} pool - pg pool
 * @param {object} opts - { adminUserId, action, targetType, targetId?, details? }
 */
export async function logAdminAction(pool, opts) {
  const { adminUserId, action, targetType, targetId = null, details = null } = opts;
  if (!adminUserId || !action || !targetType) return;
  try {
    await pool.query(
      `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminUserId, action, targetType, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
