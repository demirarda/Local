/**
 * University community profile — LOCAL v2 §14
 * Admin: vitrin + görünürlük + resmi etkinlik
 * Öğrenci Ritualsine yetki YOK (silme/onay/moderasyon yok)
 */
import pool from '../config/database.js';

const VIS = new Set(['closed', 'external_uni', 'everyone']);

function normalizeVitrine(raw) {
  const v = raw && typeof raw === 'object' ? raw : {};
  return {
    headline: v.headline ? String(v.headline).slice(0, 120) : null,
    tagline: v.tagline ? String(v.tagline).slice(0, 240) : null,
    cover_url: v.cover_url ? String(v.cover_url).slice(0, 500) : null,
  };
}

export async function ensureUniversityRow(name) {
  const existing = await pool.query(
    `SELECT * FROM universities WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (existing.rows[0]) return existing.rows[0];
  try {
    const ins = await pool.query(
      `INSERT INTO universities (name, is_verified, visibility, vitrine)
       VALUES ($1, true, 'closed', '{}'::jsonb)
       RETURNING *`,
      [name]
    );
    if (ins.rows[0]) return ins.rows[0];
  } catch (_e) {
    /* race or schema */
  }
  const again = await pool.query(
    `SELECT * FROM universities WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return again.rows[0] || { id: null, name, visibility: 'closed', vitrine: {}, admin_user_id: null };
}

export async function canManageUniversity(userId, universityName) {
  if (!userId || !universityName) return false;
  const uni = await ensureUniversityRow(universityName);
  if (uni.admin_user_id && String(uni.admin_user_id) === String(userId)) return true;
  // Founder bootstrap: first confirmed member can claim if no admin
  if (!uni.admin_user_id) {
    const me = await pool.query(
      `SELECT 1 FROM users
       WHERE id = $1 AND email_verified = true
         AND LOWER(university) = LOWER($2)
         AND COALESCE(identity_track, 'university') = 'university'
       LIMIT 1`,
      [userId, universityName]
    );
    return me.rows.length > 0;
  }
  return false;
}

export async function getUniversityProfile(universityName, viewerUserId = null) {
  const name = String(universityName || '').trim();
  if (!name) return { ok: false, status: 400, error: 'university_required' };

  const uni = await ensureUniversityRow(name);
  const visibility = VIS.has(uni.visibility) ? uni.visibility : 'closed';

  const viewer = viewerUserId
    ? (
        await pool.query(
          `SELECT university, identity_track, email_verified FROM users WHERE id = $1`,
          [viewerUserId]
        )
      ).rows[0]
    : null;

  const viewerIsMember =
    viewer &&
    viewer.email_verified &&
    viewer.identity_track !== 'identity' &&
    viewer.university &&
    String(viewer.university).toLowerCase() === name.toLowerCase();

  const viewerIsExternalUni =
    viewer &&
    viewer.email_verified &&
    viewer.identity_track !== 'identity' &&
    Boolean(viewer.university) &&
    !viewerIsMember;

  let canView = false;
  if (visibility === 'everyone') canView = true;
  else if (visibility === 'external_uni') canView = Boolean(viewerIsMember || viewerIsExternalUni);
  else canView = Boolean(viewerIsMember);

  const canManage = viewerUserId
    ? await canManageUniversity(viewerUserId, name)
    : false;

  if (!canView && !canManage) {
    return {
      ok: true,
      data: {
        name,
        visibility,
        locked: true,
        member_count: null,
        vitrine: null,
        official_events: [],
        can_manage: false,
        note: 'Üni profili bu görünürlük seviyesinde kapalı',
      },
    };
  }

  const members = await pool.query(
    `SELECT COUNT(*)::int AS member_count
     FROM users
     WHERE email_verified = true
       AND university IS NOT NULL
       AND LOWER(university) = LOWER($1)
       AND COALESCE(identity_track, 'university') = 'university'
       AND uni_label_visible = true`,
    [name]
  );

  const events = await pool.query(
    `SELECT id, title, description, starts_at, ends_at, created_at
     FROM university_official_events
     WHERE university_id = $1
     ORDER BY starts_at DESC NULLS LAST, created_at DESC
     LIMIT 30`,
    [uni.id]
  ).catch(() => ({ rows: [] }));

  let affiliated_hosts = [];
  try {
    const { listAffiliatedHosts } = await import('./affiliationService.js');
    const ah = await listAffiliatedHosts('university', uni.id);
    affiliated_hosts = ah.hosts || [];
  } catch (_e) {
    affiliated_hosts = [];
  }

  return {
    ok: true,
    data: {
      name,
      university_id: uni.id,
      visibility,
      locked: false,
      member_count: members.rows[0]?.member_count || 0,
      vitrine: normalizeVitrine(uni.vitrine),
      official_events: events.rows,
      affiliated_hosts,
      can_manage: canManage,
      admin_user_id: canManage ? uni.admin_user_id : undefined,
      /** Öğrenci Ritualsine yetki yok */
      student_ritual_moderation: false,
    },
  };
}

export async function updateUniversityProfile(universityName, userId, body = {}) {
  const allowed = await canManageUniversity(userId, universityName);
  if (!allowed) return { ok: false, status: 403, error: 'Üni yönetici yetkisi yok' };

  const uni = await ensureUniversityRow(universityName);
  // Claim admin if empty
  if (!uni.admin_user_id) {
    await pool.query(
      `UPDATE universities SET admin_user_id = $2 WHERE id = $1 AND admin_user_id IS NULL`,
      [uni.id, userId]
    );
  }

  const updates = [];
  const params = [uni.id];
  let i = 2;

  if (body.visibility != null) {
    const vis = String(body.visibility);
    if (!VIS.has(vis)) return { ok: false, status: 400, error: 'visibility: closed|external_uni|everyone' };
    updates.push(`visibility = $${i++}`);
    params.push(vis);
  }
  if (body.vitrine != null) {
    updates.push(`vitrine = $${i++}::jsonb`);
    params.push(JSON.stringify(normalizeVitrine(body.vitrine)));
  }
  if (body.transfer_admin_to) {
    const target = await pool.query(
      `SELECT id FROM users
       WHERE id = $1 AND email_verified = true
         AND LOWER(university) = LOWER($2)
         AND COALESCE(identity_track, 'university') = 'university'`,
      [body.transfer_admin_to, universityName]
    );
    if (!target.rows[0]) {
      return { ok: false, status: 400, error: 'Devralacak kullanıcı bu üni üyesi olmalı' };
    }
    updates.push(`admin_user_id = $${i++}`);
    params.push(body.transfer_admin_to);
  }

  if (!updates.length) return { ok: false, status: 400, error: 'No updates' };

  const r = await pool.query(
    `UPDATE universities SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return { ok: true, university: r.rows[0] };
}

export async function createOfficialEvent(universityName, userId, body = {}) {
  const allowed = await canManageUniversity(userId, universityName);
  if (!allowed) return { ok: false, status: 403, error: 'Üni yönetici yetkisi yok' };
  const uni = await ensureUniversityRow(universityName);
  if (!uni.admin_user_id) {
    await pool.query(
      `UPDATE universities SET admin_user_id = $2 WHERE id = $1 AND admin_user_id IS NULL`,
      [uni.id, userId]
    );
  }
  const title = String(body.title || '').trim();
  if (!title) return { ok: false, status: 400, error: 'title required' };

  const r = await pool.query(
    `INSERT INTO university_official_events
       (university_id, title, description, starts_at, ends_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      uni.id,
      title.slice(0, 255),
      body.description ? String(body.description).slice(0, 2000) : null,
      body.starts_at || null,
      body.ends_at || null,
      userId,
    ]
  );
  return { ok: true, event: r.rows[0] };
}
