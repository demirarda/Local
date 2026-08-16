/**
 * Brand entity — LOCAL v2 §12
 * Admin-only create · brand_member opens ritual · brand_id signs · Trust yok
 */
import pool from '../config/database.js';

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function isBrandMember(userId, brandId) {
  if (!userId || !brandId) return false;
  const r = await pool.query(
    `SELECT 1 FROM brand_members WHERE brand_id = $1 AND user_id = $2 LIMIT 1`,
    [brandId, userId]
  );
  return r.rows.length > 0;
}

/** Launch: admin-only brand create (self-serve yok) */
export async function createBrandAdmin({
  name,
  logoUrl = null,
  category = null,
  oneLiner = null,
  slug = null,
  memberUserIds = [],
} = {}) {
  const n = String(name || '').trim();
  if (!n) return { ok: false, status: 400, error: 'name required' };
  const s = slug || slugify(n);
  const ins = await pool.query(
    `INSERT INTO brands (name, logo_url, category, one_liner, slug)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [n, logoUrl, category, oneLiner, s || null]
  );
  const brand = ins.rows[0];
  for (const uid of memberUserIds || []) {
    if (!uid) continue;
    await pool.query(
      `INSERT INTO brand_members (brand_id, user_id, role, verified)
       VALUES ($1,$2,'member',true)
       ON CONFLICT DO NOTHING`,
      [brand.id, uid]
    );
  }
  return { ok: true, brand };
}

export async function addBrandMember(brandId, userId, { role = 'member', verified = true } = {}) {
  if (!brandId || !userId) return { ok: false, status: 400, error: 'brand_id and user_id required' };
  await pool.query(
    `INSERT INTO brand_members (brand_id, user_id, role, verified)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (brand_id, user_id) DO UPDATE SET role = EXCLUDED.role, verified = EXCLUDED.verified`,
    [brandId, userId, role, Boolean(verified)]
  );
  return { ok: true };
}

export async function listBrands({ limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT id, name, slug, logo_url, category, one_liner, created_at
     FROM brands
     ORDER BY name ASC
     LIMIT $1`,
    [Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  return { ok: true, brands: r.rows };
}

/**
 * Brand cannot host. Person (brand_member) opens; brand_id is signature only.
 */
export async function assertCanAttachBrandSignature(userId, brandId) {
  if (!brandId) return { ok: true, brand_id: null };
  const brand = await pool.query(`SELECT id, name FROM brands WHERE id = $1`, [brandId]);
  if (!brand.rows[0]) return { ok: false, status: 404, error: 'Brand not found' };
  const member = await isBrandMember(userId, brandId);
  if (!member) {
    return {
      ok: false,
      status: 403,
      error: 'Brand ritüel açamaz; yalnızca brand_member kişi brand_id ile imzalayabilir',
    };
  }
  return { ok: true, brand_id: brandId, brand: brand.rows[0] };
}

export function displayWebAuthorName({ webNamed, name, city } = {}) {
  if (webNamed) return name || 'LOCAL üyesi';
  const region = city ? String(city) : 'bölge';
  return `bir LOCAL üyesi · ${region}`;
}
