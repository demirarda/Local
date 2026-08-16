/**
 * sonMD §2C affiliations — UNI_AUTO | BRAND_ADMIN
 * Org profile "Bağlı Hostlar" (Friends component NOT reused).
 */
import pool from '../config/database.js';
import { ensureUniversityRow } from './universityProfileService.js';

export async function upsertUniAutoAffiliation(userId, universityName) {
  if (!userId || !universityName) return null;
  const uni = await ensureUniversityRow(universityName);
  if (!uni?.id) return null;
  const r = await pool.query(
    `INSERT INTO affiliations (user_id, org_id, type)
     VALUES ($1, $2, 'UNI_AUTO')
     ON CONFLICT (user_id, org_id, type) DO NOTHING
     RETURNING *`,
    [userId, uni.id]
  );
  return r.rows[0] || null;
}

export async function assignBrandAdminAffiliation({ userId, brandId, actorId }) {
  if (!userId || !brandId) {
    return { ok: false, status: 400, error: 'user_id and brand_id required' };
  }
  const brand = await pool.query(`SELECT id, name FROM brands WHERE id = $1`, [brandId]);
  if (!brand.rows[0]) return { ok: false, status: 404, error: 'Brand not found' };
  const user = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  if (!user.rows[0]) return { ok: false, status: 404, error: 'User not found' };

  const r = await pool.query(
    `INSERT INTO affiliations (user_id, org_id, type)
     VALUES ($1, $2, 'BRAND_ADMIN')
     ON CONFLICT (user_id, org_id, type) DO UPDATE SET created_at = affiliations.created_at
     RETURNING *`,
    [userId, brandId]
  );
  // Keep brand_members in sync for operational membership
  await pool.query(
    `INSERT INTO brand_members (brand_id, user_id, role, verified)
     VALUES ($1, $2, 'admin', true)
     ON CONFLICT (brand_id, user_id) DO UPDATE SET role = 'admin', verified = true`,
    [brandId, userId]
  ).catch(() => {});

  return { ok: true, affiliation: r.rows[0], actor_id: actorId || null };
}

/**
 * @param {'university'|'brand'} orgKind
 */
export async function listAffiliatedHosts(orgKind, orgId) {
  if (!orgId) return { ok: false, status: 400, error: 'org_id required' };
  const type = orgKind === 'brand' ? 'BRAND_ADMIN' : 'UNI_AUTO';

  let resolvedOrgId = orgId;
  if (orgKind === 'university' && !/^[0-9a-f-]{36}$/i.test(String(orgId))) {
    const uni = await ensureUniversityRow(orgId);
    resolvedOrgId = uni?.id;
    if (!resolvedOrgId) return { ok: true, hosts: [], org: { name: orgId } };
  }

  const rows = await pool.query(
    `SELECT a.user_id, a.type, a.created_at,
            u.name, u.avatar_url, u.username, u.university
     FROM affiliations a
     JOIN users u ON u.id = a.user_id
     WHERE a.org_id = $1 AND a.type = $2
     ORDER BY a.created_at ASC
     LIMIT 200`,
    [resolvedOrgId, type]
  );

  return {
    ok: true,
    hosts: rows.rows.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      username: row.username || null,
      avatar_url: row.avatar_url || null,
      type: row.type,
      university: row.university || null,
    })),
    org_id: resolvedOrgId,
    type,
  };
}
