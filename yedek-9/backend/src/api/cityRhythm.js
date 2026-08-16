import express from 'express';
import pool from '../config/database.js';
import { ritualDiscoveryAudienceSql } from '../services/ritualState.js';
import { feeDtoFromRow } from '../services/ritualCreateValidation.js';

const router = express.Router();

// Helper: Calculate time state for a ritual (same logic as rituals.js)
function getTimeState(startTime, duration, attendanceCount, capacity) {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + duration * 60000);
  const now = new Date();
  const minutesUntilStart = (start - now) / 60000;
  const availableSpots = capacity - attendanceCount;

  if (minutesUntilStart < 0 && now < end) {
    return 'live_now';
  }
  if (minutesUntilStart >= 0 && minutesUntilStart <= 90) {
    return 'starting_soon';
  }
  if (availableSpots <= 3 && availableSpots > 0) {
    return 'almost_full';
  }
  if (now > end && (now - end) / 60000 <= 60) {
    return 'reopened';
  }
  return null;
}

// GET /api/city-rhythm/browse — kronolojik browse (son-part §0: engagement algoritması yok)
router.get('/browse', async (req, res) => {
  try {
    const {
      city,
      search,
      type,
      status,
      entry_type,
      page = 1,
      limit = 20,
      lat,
      lng,
      radius = 10, // km
      viewer_id,
      feed_scope,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let paramIndex = 1;
    const conditions = ['(r.suspended_at IS NULL)'];

    // City filter (from users table)
    if (city) {
      conditions.push(`u.city = $${paramIndex}`);
      params.push(city);
      paramIndex++;
    }

    // Search filter (title, venue_name, type)
    if (search) {
      conditions.push(`(
        r.title ILIKE $${paramIndex} OR
        r.location_name ILIKE $${paramIndex} OR
        r.type ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Type filter
    if (type) {
      conditions.push(`r.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    // Status filter
    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Entry type filter
    if (entry_type) {
      conditions.push(`r.entry_type = $${paramIndex}`);
      params.push(entry_type);
      paramIndex++;
    }

    // son-part.md §8.4 feed scopes
    if (feed_scope === 'local_world') {
      conditions.push(`COALESCE(r.window_type, 'ephemeral') = 'open_forum'`);
    }

    if (feed_scope === 'fl' && viewer_id) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM friendships fr
          WHERE fr.status = 'accepted'
            AND fr.friendship_level::text IN ('l1', 'l2', 'l3')
            AND (
              (fr.requester_id = $${paramIndex}::uuid AND fr.receiver_id = r.host_id)
              OR (fr.receiver_id = $${paramIndex}::uuid AND fr.requester_id = r.host_id)
            )
        )
        OR EXISTS (
          SELECT 1 FROM ritual_attendance ra_fl
          JOIN friendships fr2 ON fr2.status = 'accepted'
            AND fr2.friendship_level::text IN ('l1', 'l2', 'l3')
            AND (
              (fr2.requester_id = $${paramIndex}::uuid AND fr2.receiver_id = ra_fl.user_id)
              OR (fr2.receiver_id = $${paramIndex}::uuid AND fr2.requester_id = ra_fl.user_id)
            )
          WHERE ra_fl.ritual_id = r.id AND ra_fl.status NOT IN ('no_show', 'cancelled')
        )
      )`);
      params.push(viewer_id);
      paramIndex++;
    }

    if (feed_scope === 'friends' && viewer_id) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM friendships fr
          WHERE fr.status = 'accepted'
            AND (
              (fr.requester_id = $${paramIndex}::uuid AND fr.receiver_id = r.host_id)
              OR (fr.receiver_id = $${paramIndex}::uuid AND fr.requester_id = r.host_id)
            )
        )
        OR EXISTS (
          SELECT 1 FROM ritual_attendance ra_f
          JOIN friendships fr3 ON fr3.status = 'accepted'
            AND (
              (fr3.requester_id = $${paramIndex}::uuid AND fr3.receiver_id = ra_f.user_id)
              OR (fr3.receiver_id = $${paramIndex}::uuid AND fr3.requester_id = ra_f.user_id)
            )
          WHERE ra_f.ritual_id = r.id AND ra_f.status NOT IN ('no_show', 'cancelled')
        )
      )`);
      params.push(viewer_id);
      paramIndex++;
    }

    if (feed_scope === 'uni' && viewer_id) {
      conditions.push(`EXISTS (
        SELECT 1 FROM users vu WHERE vu.id = $${paramIndex}::uuid
          AND vu.university IS NOT NULL
          AND vu.university = u.university
      )`);
      params.push(viewer_id);
      paramIndex++;
    }

    if (feed_scope === 'hidden' && viewer_id) {
      conditions.push(`(
        r.entry_type::text != 'open'
        AND (
          EXISTS (
            SELECT 1 FROM ritual_attendance ra_h
            WHERE ra_h.ritual_id = r.id AND ra_h.user_id = $${paramIndex}::uuid
              AND ra_h.status NOT IN ('no_show', 'cancelled')
          )
          OR EXISTS (
            SELECT 1 FROM ritual_invites ri
            WHERE ri.ritual_id = r.id AND ri.invitee_id = $${paramIndex}::uuid
              AND (ri.expires_at IS NULL OR ri.expires_at > NOW())
          )
        )
      )`);
      params.push(viewer_id);
      paramIndex++;
    }

    // son-part.md §8.4 — varsayılan browse: gizli (non-open) yalnızca katılımcı/davetli görür
    if (feed_scope !== 'hidden') {
      if (viewer_id) {
        conditions.push(`(
          COALESCE(r.entry_type::text, 'open') = 'open'
          OR EXISTS (
            SELECT 1 FROM ritual_attendance ra_vis
            WHERE ra_vis.ritual_id = r.id AND ra_vis.user_id = $${paramIndex}::uuid
              AND ra_vis.status NOT IN ('no_show', 'cancelled')
          )
          OR EXISTS (
            SELECT 1 FROM ritual_invites ri_vis
            WHERE ri_vis.ritual_id = r.id AND ri_vis.invitee_id = $${paramIndex}::uuid
              AND (ri_vis.expires_at IS NULL OR ri_vis.expires_at > NOW())
          )
        )`);
        params.push(viewer_id);
        paramIndex++;
      } else {
        conditions.push(`COALESCE(r.entry_type::text, 'open') = 'open'`);
      }
    }

    // §2C rituals.audience PUBLIC|FRIENDS discovery gate
    if (viewer_id) {
      conditions.push(ritualDiscoveryAudienceSql(`$${paramIndex}::uuid`, 'r'));
      params.push(viewer_id);
      paramIndex++;
    } else {
      conditions.push(ritualDiscoveryAudienceSql(null, 'r'));
    }

    // Location filter (if lat/lng provided)
    if (lat && lng) {
      // Using Haversine formula for distance calculation
      conditions.push(`(
        6371 * acos(
          cos(radians($${paramIndex})) *
          cos(radians(r.location_lat)) *
          cos(radians(r.location_lng) - radians($${paramIndex + 1})) +
          sin(radians($${paramIndex})) *
          sin(radians(r.location_lat))
        ) <= $${paramIndex + 2}
      )`);
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
      paramIndex += 3;
    }

    // Time window constraint
    // Orijinal spes: "now" ile "now + 7 gün" arasıydı.
    // Geliştirme ortamında verilerin görünmesi için geçmiş 365 günü de dahil edelim.
    const now = new Date();
    const pastWindow = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    conditions.push(`r.start_time BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(pastWindow, oneWeekFromNow);
    paramIndex += 2;
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM rituals r
      LEFT JOIN users u ON r.host_id = u.id
      ${whereClause.replace(/r\.city/g, 'u.city')}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const orderClause = 'ORDER BY r.start_time ASC';

    // Get rituals with attendance count
    const query = `
      SELECT 
        r.*,
        u.name as host_name,
        u.city as city,
        COUNT(DISTINCT ra.user_id) as attendance_count,
        r.capacity - COUNT(DISTINCT ra.user_id) as available_spots
      FROM rituals r
      LEFT JOIN users u ON r.host_id = u.id
      LEFT JOIN ritual_attendance ra ON r.id = ra.ritual_id
      ${whereClause.replace(/r\.city/g, 'u.city')}
      GROUP BY r.id, u.name, u.city
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Add time_state, verification status to each ritual
    const rituals = await Promise.all(result.rows.map(async (ritual) => {
      const timeState = getTimeState(
        ritual.start_time,
        ritual.duration,
        parseInt(ritual.attendance_count),
        ritual.capacity
      );

      // Check host verification
      const hostVerifiedResult = await pool.query(
        `SELECT 1 FROM host_verifications 
         WHERE user_id = $1 
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [ritual.host_id]
      );
      const isHostVerified = hostVerifiedResult.rows.length > 0;

      // Check venue verification
      const venueVerifiedResult = await pool.query(
        `SELECT 1 FROM venue_verifications 
         WHERE venue_name = $1 
           AND city = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         LIMIT 1`,
        [ritual.location_name, ritual.city || '']
      );
      const isVenueVerified = venueVerifiedResult.rows.length > 0;

      let is_fl_friend_hosting = false;
      let is_fl_friend_attending = false;
      if (viewer_id) {
        const flHost = await pool.query(
          `SELECT 1 FROM friendships fr
           WHERE fr.status = 'accepted'
             AND fr.friendship_level::text IN ('l1', 'l2', 'l3')
             AND (
               (fr.requester_id = $1 AND fr.receiver_id = $2)
               OR (fr.receiver_id = $1 AND fr.requester_id = $2)
             )
           LIMIT 1`,
          [viewer_id, ritual.host_id]
        );
        is_fl_friend_hosting = flHost.rows.length > 0;

        const flAtt = await pool.query(
          `SELECT 1 FROM ritual_attendance ra
           JOIN friendships fr ON fr.status = 'accepted'
             AND fr.friendship_level::text IN ('l1', 'l2', 'l3')
             AND (
               (fr.requester_id = $1 AND fr.receiver_id = ra.user_id)
               OR (fr.receiver_id = $1 AND fr.requester_id = ra.user_id)
             )
           WHERE ra.ritual_id = $2
             AND ra.status NOT IN ('no_show', 'cancelled')
           LIMIT 1`,
          [viewer_id, ritual.id]
        );
        is_fl_friend_attending = flAtt.rows.length > 0;
      }

      let viewer_is_attending = false;
      let has_invite = false;
      if (viewer_id) {
        const attVis = await pool.query(
          `SELECT 1 FROM ritual_attendance ra_v
           WHERE ra_v.ritual_id = $1 AND ra_v.user_id = $2
             AND ra_v.status NOT IN ('no_show', 'cancelled')
           LIMIT 1`,
          [ritual.id, viewer_id]
        );
        viewer_is_attending = attVis.rows.length > 0;

        const invVis = await pool.query(
          `SELECT 1 FROM ritual_invites ri_v
           WHERE ri_v.ritual_id = $1 AND ri_v.invitee_id = $2
             AND (ri_v.expires_at IS NULL OR ri_v.expires_at > NOW())
           LIMIT 1`,
          [ritual.id, viewer_id]
        );
        has_invite = invVis.rows.length > 0;
      }

      return {
        ...ritual,
        time_state: timeState,
        attendance_count: parseInt(ritual.attendance_count),
        current_attendees: parseInt(ritual.attendance_count),
        available_spots: Math.max(0, parseInt(ritual.available_spots)),
        is_host_verified: isHostVerified,
        is_venue_verified: isVenueVerified,
        reposted_at: ritual.reposted_at || null,
        repost_count: Number(ritual.repost_count) || 0,
        is_reposted: ritual.reposted_at != null,
        forum_enabled: String(ritual.window_type || '') === 'open_forum',
        is_fl_friend_hosting,
        is_fl_friend_attending,
        viewer_is_attending,
        has_invite,
        fee: feeDtoFromRow(ritual),
        has_fee: ritual.fee_amount != null,
        audience: String(ritual.audience || 'PUBLIC').toUpperCase(),
      };
    }));

    const { foldRitualsWithUmbrellas } = await import('../services/eventGroupService.js');
    const folded = await foldRitualsWithUmbrellas(rituals);

    res.json({
      success: true,
      data: folded,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error browsing rituals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to browse rituals'
    });
  }
});

// GET /api/city-rhythm/categories - Get available categories/types
router.get('/categories', async (req, res) => {
  try {
    const SPEC_CATEGORIES = [
      'Kahve', 'Yemek', 'Sarap ve Icecekler', 'Craft Bira', 'Cay Seremonisi', 'Mutfak', 'Aperitivo', 'Vegan',
      'Topluluk', 'Sosyal', 'Mahalle', 'Gun Dogumu', 'Gece Hayati', 'Festival', 'Kutlama', 'Uluslararasi',
      'Felsefe', 'Kitaplar', 'Diller', 'Bilim', 'Yazi', 'Tartisma', 'Hikaye Anlatimi', 'Calisma',
      'Finans', 'Hukuk', 'Psikoloji', 'Siyaset', 'Tarih', 'Astronomi', 'Cografya', 'Gazetecilik',
      'Muzik', 'Gorsel Sanatlar', 'Film', 'Tiyatro', 'Fotografcilik', 'Dans', 'Acik Mikrofon', 'Galeri',
      'Podcast', 'Klasik Muzik', 'Dogaclama', 'Siir', 'Sokak Sanati', 'El Sanatlari', 'Moda', 'Mimari',
      'Kosu', 'Bisiklet', 'Spor', 'Yuzme', 'Tirmanma', 'Yuruyus', 'Futbol', 'Masa Tenisi',
      'Badminton', 'Tenis', 'Kaykay', 'Boks / Dovus Sanatlari', 'Bouldering', 'Akrobasi', 'Su Sporlari', 'Kis Sporlari',
      'Yoga', 'Farkindalik', 'Doga', 'Surdurulebilirlik', 'Gun Dogumu Rituali', 'Oz Bakim',
      'Soguk Maruziyet', 'Beslenme', 'Uyku Bilimi', 'Saglik', 'Cicek ve Botanik', 'Evcil Hayvan Sahipleri',
      'Satranc', 'Oyun', 'Kart Oyunlari', 'Masa Oyunlari', 'Tarot', 'Bulmacalar',
      'Dart', 'Koleksiyon', 'Yildiz Gozlemi', 'Comlekcilik', 'Bahcecilik', 'Dikis',
      'Teknoloji', 'Girisimler', 'Yapay Zeka', 'Veri Bilimi', 'Maker / Donanim', 'Siber Guvenlik', 'Arastirma', 'Web3 ve Kripto',
    ];

    const result = await pool.query(
      `SELECT DISTINCT type, COUNT(*) as count
       FROM rituals
       WHERE type IS NOT NULL
       GROUP BY type
       ORDER BY count DESC`
    );

    const countMap = new Map(
      result.rows.map((row) => [String(row.type || '').toLowerCase().trim(), parseInt(row.count)])
    );

    res.json({
      success: true,
      data: SPEC_CATEGORIES.map((type) => ({
        type,
        count: countMap.get(type.toLowerCase()) || 0,
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

export default router;
