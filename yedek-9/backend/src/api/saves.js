/**
 * Saves + mutes — sonMD Wave B (private pointer, feed mute)
 */
import express from 'express';
import { authenticateToken } from './auth.js';
import {
  saveObject,
  unsaveObject,
  listSaves,
  muteObject,
  unmuteObject,
} from '../services/waveBSocial.js';
import pool from '../config/database.js';

const router = express.Router();

/** object_type → başlık çözücü; liste ekranları ham UUID göstermesin */
const TITLE_RESOLVERS = {
  ritual: {
    sql: `SELECT id::text AS id, title AS title, start_time AS subtitle_at FROM rituals WHERE id = ANY($1::uuid[])`,
  },
  venue: {
    sql: `SELECT id::text AS id, name AS title, city AS subtitle FROM venues WHERE id = ANY($1::uuid[])`,
  },
  zone: {
    sql: `SELECT id::text AS id, name AS title, marker_type AS subtitle FROM zones WHERE id = ANY($1::uuid[])`,
  },
  memory: {
    sql: `SELECT id::text AS id, LEFT(COALESCE(content, text, title, 'Ani'), 120) AS title, NULL AS subtitle
          FROM memories WHERE id = ANY($1::uuid[])`,
  },
  user: {
    sql: `SELECT id::text AS id, name AS title, city AS subtitle FROM users WHERE id = ANY($1::uuid[])`,
  },
  series: {
    sql: `SELECT id::text AS id, name AS title, NULL AS subtitle FROM ritual_series WHERE id = ANY($1::uuid[])`,
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kayıt/mute satırlarına title + subtitle ekler. Tip başına tek sorgu.
 * object_id yoksa (ör. category mute) object_key başlık olur.
 */
async function enrichObjectRows(rows) {
  const byType = new Map();
  for (const row of rows) {
    const type = row.object_type;
    const id = row.object_id;
    if (!TITLE_RESOLVERS[type] || !id || !UUID_RE.test(String(id))) continue;
    if (!byType.has(type)) byType.set(type, new Set());
    byType.get(type).add(String(id));
  }

  const titles = new Map();
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      try {
        const r = await pool.query(TITLE_RESOLVERS[type].sql, [[...ids]]);
        for (const found of r.rows) {
          titles.set(`${type}:${found.id}`, {
            title: found.title || null,
            subtitle: found.subtitle || found.subtitle_at || null,
          });
        }
      } catch (_e) {
        /* eksik tablo/kolon: ham id ile devam */
      }
    })
  );

  return rows.map((row) => {
    const hit = titles.get(`${row.object_type}:${row.object_id}`);
    return {
      ...row,
      title: hit?.title || row.object_key || null,
      subtitle: hit?.subtitle || null,
      resolved: Boolean(hit?.title),
    };
  });
}

router.get('/saves', authenticateToken, async (req, res) => {
  try {
    const rows = await listSaves(req.user.userId);
    res.json({ success: true, data: await enrichObjectRows(rows) });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to list saves' });
  }
});

router.post('/saves', authenticateToken, async (req, res) => {
  try {
    const { object_type, object_id } = req.body || {};
    const result = await saveObject({
      userId: req.user.userId,
      objectType: object_type,
      objectId: object_id,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, data: result.save, already: result.already });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

router.delete('/saves/:objectType/:objectId', authenticateToken, async (req, res) => {
  try {
    await unsaveObject({
      userId: req.user.userId,
      objectType: req.params.objectType,
      objectId: req.params.objectId,
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to unsave' });
  }
});

router.get('/mutes', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM user_mutes WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ success: true, data: await enrichObjectRows(r.rows) });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to list mutes' });
  }
});

router.post('/mutes', authenticateToken, async (req, res) => {
  try {
    const { object_type, object_id, object_key } = req.body || {};
    const result = await muteObject({
      userId: req.user.userId,
      objectType: object_type,
      objectId: object_id || null,
      objectKey: object_key || null,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    res.status(201).json({ success: true, data: result.mute });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to mute' });
  }
});

router.delete('/mutes/:id', authenticateToken, async (req, res) => {
  try {
    await unmuteObject({ userId: req.user.userId, muteId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to unmute' });
  }
});

export default router;
