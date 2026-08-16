import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// Valid mood/vibe options - yeni.md 6.2 (40 adet)
const VALID_VIBES = [
  'Sakin',
  'Sosyal',
  'Enerjik',
  'Entelektüel',
  'Yaratıcı',
  'Canlı',
  'Sıcak',
  'Derin',
  'Maceracı',
  'Rahat',
  'Odaklı',
  'Oyuncu',
  'Ruhsal',
  'Kentsel',
  'Açık Hava',
  'Mahrem',
  'Açık',
  'Niş',
  'Yeni Başlayan Dostu',
  'Uzman',
  'Motive Edici',
  'Felsefi',
  'Yansıtıcı',
  'Hızlı Tempolu',
  'Yavaş Tempolu',
  'Gece Geç',
  'Sabah',
  'Hafta Sonu Rituali',
  'Yağmurlu Gün',
  'Güneşli',
  'Rekabetçi',
  'İş Birlikçi',
  'Sessiz',
  'Gürültülü ve Eğlenceli',
  'Bilinçli',
  'Keşif',
  'Nostaljik',
  'Deneysel',
  'Yapılandırılmış',
  'Serbest',
];

// GET /api/vibes/options/list - Must be before /:userId to avoid matching "options" as userId
router.get('/options/list', (req, res) => {
  res.json({
    success: true,
    data: VALID_VIBES
  });
});

// GET /api/vibes/:userId - Get user's vibes
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT vibe, created_at 
       FROM user_vibes 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => row.vibe)
    });
  } catch (error) {
    console.error('Error fetching user vibes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user vibes'
    });
  }
});

// POST /api/vibes - Add vibe to user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vibe } = req.body;
    const userId = req.user.userId;

    if (!vibe) {
      return res.status(400).json({
        success: false,
      error: 'vibe is required'
      });
    }

    if (!VALID_VIBES.includes(String(vibe || '').trim())) {
      return res.status(400).json({
        success: false,
        error: `Invalid vibe. Must be one of: ${VALID_VIBES.join(', ')}`
      });
    }

    const result = await pool.query(
      `INSERT INTO user_vibes (user_id, vibe)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vibe) DO NOTHING
       RETURNING *`,
      [userId, String(vibe).trim()]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Vibe already exists',
        data: { vibe: String(vibe).trim() }
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding vibe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add vibe'
    });
  }
});

// DELETE /api/vibes - Remove vibe from user
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const { vibe } = req.body;
    const userId = req.user.userId;

    if (!vibe) {
      return res.status(400).json({
        success: false,
      error: 'vibe is required'
      });
    }

    const result = await pool.query(
      `DELETE FROM user_vibes 
       WHERE user_id = $1 AND vibe = $2
       RETURNING *`,
      [userId, String(vibe).trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vibe not found'
      });
    }

    res.json({
      success: true,
      message: 'Vibe removed'
    });
  } catch (error) {
    console.error('Error removing vibe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove vibe'
    });
  }
});

export default router;
