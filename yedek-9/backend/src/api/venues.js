import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireAdmin } from './auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/** GET /api/venues/payment-readiness — Stripe smoke (no secrets) */
router.get('/payment-readiness', authenticateToken, async (_req, res) => {
  try {
    const { getStripeReadiness } = await import('../services/stripePayments.js');
    return res.json({ success: true, data: getStripeReadiness() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to read payment readiness' });
  }
});

// Helper: check if venue is verified (venue_verifications by name+city)
async function getVenueVerified(venueName, city) {
  if (!venueName || !city) return false;
  const r = await pool.query(
    `SELECT 1 FROM venue_verifications
     WHERE venue_name = $1 AND city = $2 AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [venueName, city]
  );
  return r.rows.length > 0;
}

function getVenueRSBadge(rsScore) {
  if (rsScore >= 8.5) return '★ LOCAL Doğrulanmış Merkez (HQ)';
  if (rsScore >= 7.0) return 'Güvenilir Mekan';
  if (rsScore >= 5.0) return 'Topluluk Mekanı';
  return null; // 5.0 altı: rozet yok (izleme altında)
}

async function getVenueRS(venueId) {
  const rsResult = await pool.query(
    `SELECT
       AVG(
         CASE COALESCE(f.p2r_feeling, '')
           WHEN 'green' THEN 10.0
           WHEN 'yellow' THEN 6.5
           WHEN 'red' THEN 3.0
           ELSE NULL
         END
       ) AS venue_rs_avg,
       COUNT(*) FILTER (
         WHERE f.p2r_feeling IN ('green', 'yellow', 'red')
       )::int AS venue_rs_count
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     WHERE r.venue_id = $1
       AND f.feedback_type IN ('p2v', 'p2m')`,
    [venueId]
  );
  const rs = rsResult.rows[0];
  const venueRS = rs?.venue_rs_avg != null ? Number(parseFloat(rs.venue_rs_avg).toFixed(2)) : null;
  const ratingCount = Number(rs?.venue_rs_count || 0);
  return {
    venue_rs: venueRS,
    venue_rs_rating_count: ratingCount,
    venue_rs_badge: venueRS != null ? getVenueRSBadge(venueRS) : null,
  };
}

// Helper: check if user is admin (env) or manager of venue
function isAdminUser(userId, email = '') {
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const byId = userId && adminIds.length > 0 && adminIds.includes(userId);
  const byEmail = email && adminEmails.length > 0 && adminEmails.includes((email || '').toLowerCase());
  return !!(byId || byEmail);
}

async function canManageVenue(userId, venueId, email = '') {
  if (isAdminUser(userId, email)) return true;
  const mgr = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  return mgr.rows.length > 0;
}

// GET /api/venues - List venues (public; optional city, search)
router.get('/', async (req, res) => {
  try {
    const { city, city_id, search = '', limit = 50, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = Math.max(0, parseInt(offset) || 0);
    const searchTerm = String(search).trim();
    const params = [];
    let idx = 1;
    let where = 'WHERE 1=1';
    if (city_id && String(city_id).trim()) {
      where += ` AND v.city_id = $${idx}`;
      params.push(String(city_id).trim());
      idx++;
    } else if (city && String(city).trim()) {
      where += ` AND v.city = $${idx}`;
      params.push(String(city).trim());
      idx++;
    }
    if (searchTerm) {
      where += ` AND (v.name ILIKE $${idx} OR v.address ILIKE $${idx})`;
      params.push(`%${searchTerm}%`);
      idx++;
    }
    params.push(limitNum, offsetNum);

    const result = await pool.query(
      `SELECT v.id, v.name, v.city, v.address, v.location_lat, v.location_lng, v.description, v.slug, v.created_at
             ,COALESCE(v.subscription_tier, 'basic') as subscription_tier
             ,COALESCE(v.pro_enabled, false) as pro_enabled
             ,COALESCE(v.city_partner_enabled, false) as city_partner_enabled
       FROM venues v
       ${where}
       ORDER BY v.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const rows = result.rows;
    const withVerified = [];
    for (const row of rows) {
      const [isVerified, rsMeta] = await Promise.all([
        getVenueVerified(row.name, row.city),
        getVenueRS(row.id),
      ]);
      withVerified.push({
        id: row.id,
        name: row.name,
        city: row.city,
        address: row.address || null,
        location_lat: row.location_lat != null ? parseFloat(row.location_lat) : null,
        location_lng: row.location_lng != null ? parseFloat(row.location_lng) : null,
        description: row.description || null,
        slug: row.slug || null,
        is_verified: isVerified,
        subscription_tier: row.subscription_tier || 'basic',
        pro_enabled: Boolean(row.pro_enabled),
        city_partner_enabled: Boolean(row.city_partner_enabled),
        venue_rs: rsMeta.venue_rs,
        venue_rs_rating_count: rsMeta.venue_rs_rating_count,
        venue_rs_badge: rsMeta.venue_rs_badge,
        created_at: row.created_at,
      });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM venues v ${where}`,
      params.slice(0, -2)
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: withVerified,
      total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    logger.error('Error listing venues', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list venues' });
  }
});

// GET /api/venues/managed - My managed venues (auth required)
router.get('/managed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const result = await pool.query(
      `SELECT v.id, v.name, v.city, v.address, v.location_lat, v.location_lng, v.description, v.slug, v.created_at,
              COALESCE(v.subscription_tier, 'basic') as subscription_tier,
              COALESCE(v.pro_enabled, false) as pro_enabled,
              COALESCE(v.city_partner_enabled, false) as city_partner_enabled,
              vm.role
       FROM venue_managers vm
       JOIN venues v ON v.id = vm.venue_id
       WHERE vm.user_id = $1
       ORDER BY v.name ASC`,
      [userId]
    );

    const withVerified = [];
    for (const row of result.rows) {
      const [isVerified, rsMeta] = await Promise.all([
        getVenueVerified(row.name, row.city),
        getVenueRS(row.id),
      ]);
      withVerified.push({
        id: row.id,
        name: row.name,
        city: row.city,
        address: row.address || null,
        location_lat: row.location_lat != null ? parseFloat(row.location_lat) : null,
        location_lng: row.location_lng != null ? parseFloat(row.location_lng) : null,
        description: row.description || null,
        slug: row.slug || null,
        is_verified: isVerified,
        subscription_tier: row.subscription_tier || 'basic',
        pro_enabled: Boolean(row.pro_enabled),
        city_partner_enabled: Boolean(row.city_partner_enabled),
        venue_rs: rsMeta.venue_rs,
        venue_rs_rating_count: rsMeta.venue_rs_rating_count,
        venue_rs_badge: rsMeta.venue_rs_badge,
        role: row.role,
        created_at: row.created_at,
      });
    }

    res.json({ success: true, data: withVerified });
  } catch (error) {
    logger.error('Error listing managed venues', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list managed venues' });
  }
});

// --- Venue applications (F5 §9.1) — must be before /:id ---

router.post('/applications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const { submitVenueApplication } = await import('../services/venueApplicationService.js');
    const result = await submitVenueApplication(userId, req.body);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.application });
  } catch (error) {
    logger.error('venue application submit', { error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to submit application' });
  }
});

router.get('/applications/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const { getMyVenueApplication } = await import('../services/venueApplicationService.js');
    const application = await getMyVenueApplication(userId);
    return res.json({
      success: true,
      data: application,
      onboarding_steps: (await import('../config/localConfig.js')).default.venue.ONBOARDING_STEPS,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch application' });
  }
});

router.patch('/applications/me/withdraw', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const { withdrawVenueApplication } = await import('../services/venueApplicationService.js');
    const result = await withdrawVenueApplication(userId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.application });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to withdraw application' });
  }
});

router.patch('/:venueId/onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { venueId } = req.params;
    const { step } = req.body;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const allowed = await canManageVenue(userId, venueId, req.user?.email);
    if (!allowed) return res.status(403).json({ success: false, error: 'Not allowed' });
    const { updateOnboardingStep } = await import('../services/venueApplicationService.js');
    const result = await updateOnboardingStep(userId, venueId, step);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.application });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update onboarding' });
  }
});

/** Ticari brand-slot kanalı — kullanıcı-yüzü sıralamayla ilgisi yok (§8) */
router.get('/brand-slots', authenticateToken, async (req, res) => {
  try {
    const { listBrandPrioritySlots } = await import('../services/venueInsightsService.js');
    const result = await listBrandPrioritySlots({ city: req.query.city, limit: req.query.limit });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list brand slots' });
  }
});

// GET /api/venues/:id - Venue detail + upcoming rituals
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const venueResult = await pool.query(
      `SELECT id, name, city, address, location_lat, location_lng, description, slug, created_at, updated_at,
              COALESCE(subscription_tier, 'basic') as subscription_tier,
              COALESCE(pro_enabled, false) as pro_enabled,
              COALESCE(city_partner_enabled, false) as city_partner_enabled,
              vitrine, vitrine_published, highlighted_badge_keys,
              takeover_until, featured_event_card
       FROM venues WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (venueResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    const venue = venueResult.rows[0];

    const [isVerified, rsMeta] = await Promise.all([
      getVenueVerified(venue.name, venue.city),
      getVenueRS(venue.id),
    ]);

    const ritualsResult = await pool.query(
      `SELECT r.id, r.title, r.type, r.start_time, r.duration, r.capacity, r.entry_type, r.status,
              (SELECT COUNT(*) FROM ritual_attendance ra WHERE ra.ritual_id = r.id AND ra.status != 'no_show') AS current_attendees
       FROM rituals r
       WHERE r.venue_id = $1 AND r.status IN ('active', 'live') AND (r.suspended_at IS NULL)
       ORDER BY r.start_time ASC
       LIMIT 20`,
      [id]
    );

    const rituals = ritualsResult.rows.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      start_time: r.start_time,
      duration: r.duration,
      capacity: r.capacity,
      entry_type: r.entry_type,
      status: r.status,
      current_attendees: parseInt(r.current_attendees) || 0,
    }));

    const userId = req.user?.userId;
    const canManage = userId ? await canManageVenue(userId, id, req.user?.email) : false;
    const { getVenueProfile } = await import('../services/venueProfileService.js');
    const profileResult = await getVenueProfile(id, userId, req.user?.email);

    let regularProgress = null;
    if (userId) {
      try {
        const { getRegularProgress } = await import('../services/regularService.js');
        regularProgress = await getRegularProgress(userId, id);
      } catch (_e) {
        regularProgress = null;
      }
    }

    res.json({
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        city: venue.city,
        address: venue.address || null,
        location_lat: venue.location_lat != null ? parseFloat(venue.location_lat) : null,
        location_lng: venue.location_lng != null ? parseFloat(venue.location_lng) : null,
        description: venue.description || null,
        slug: venue.slug || null,
        is_verified: isVerified,
        subscription_tier: venue.subscription_tier || 'basic',
        pro_enabled: Boolean(venue.pro_enabled),
        city_partner_enabled: Boolean(venue.city_partner_enabled),
        takeover_until: venue.takeover_until || null,
        local_takeover: venue.takeover_until
          ? new Date(venue.takeover_until).getTime() > Date.now()
          : false,
        featured_event_card: venue.featured_event_card || null,
        venue_rs: rsMeta.venue_rs,
        venue_rs_rating_count: rsMeta.venue_rs_rating_count,
        venue_rs_badge: rsMeta.venue_rs_badge,
        vitrine: profileResult.ok ? profileResult.profile.vitrine : null,
        vitrine_published: Boolean(venue.vitrine_published),
        highlighted_badge_keys: venue.highlighted_badge_keys || [],
        locked_sections: profileResult.ok ? profileResult.profile.locked_sections : [],
        can_manage: canManage,
        archive_public_count: profileResult.ok ? profileResult.profile.archive_public_count : 0,
        archive_preview: profileResult.ok ? profileResult.profile.archive_preview : [],
        trust_display: profileResult.ok ? profileResult.profile.trust_display : null,
        aura_display: profileResult.ok ? profileResult.profile.aura_display : null,
        seating_label: profileResult.ok ? profileResult.profile.seating_label : null,
        chip_breakdown: profileResult.ok ? profileResult.profile.chip_breakdown : null,
        character_card: profileResult.ok ? profileResult.profile.character_card : null,
        character_volume: profileResult.ok ? profileResult.profile.character_volume : null,
        chain_id: profileResult.ok ? profileResult.profile.chain_id : null,
        brand_id: profileResult.ok ? profileResult.profile.brand_id : null,
        regular_progress: regularProgress,
        created_at: venue.created_at,
        updated_at: venue.updated_at,
        upcoming_rituals: rituals,
        profile: profileResult.ok ? profileResult.profile : null,
      },
    });
  } catch (error) {
    logger.error('Error fetching venue', { error: error.message, venueId: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to fetch venue' });
  }
});

// GET /api/venues/:id/regulars — mekan kendi regular listesi (yönetici)
router.get('/:id/regulars', authenticateToken, async (req, res) => {
  try {
    const venueId = req.params.id;
    const userId = req.user?.userId;
    const allowed = userId ? await canManageVenue(userId, venueId, req.user?.email) : false;
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Venue manager access required' });
    }
    const { listVenueRegulars } = await import('../services/regularService.js');
    const data = await listVenueRegulars(venueId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to list venue regulars' });
  }
});

// GET /api/venues/:id/profile — vitrin + kilitli bolumler
router.get('/:id/profile', authenticateToken, async (req, res) => {
  try {
    const { getVenueProfile } = await import('../services/venueProfileService.js');
    const result = await getVenueProfile(req.params.id, req.user?.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 404).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.profile });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load venue profile' });
  }
});

router.patch('/:id/vitrine', authenticateToken, async (req, res) => {
  try {
    const { updateVenueVitrine } = await import('../services/venueProfileService.js');
    const result = await updateVenueVitrine(
      req.params.id,
      req.user.userId,
      req.body,
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update vitrine' });
  }
});

router.post('/:id/vitrine/publish', authenticateToken, async (req, res) => {
  try {
    const { publishVenueVitrine } = await import('../services/venueProfileService.js');
    const result = await publishVenueVitrine(req.params.id, req.user.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.venue });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to publish vitrine' });
  }
});

// --- Venue slots + oneri kutusu (F5 §9.4) ---
router.get('/:id/slots/config', authenticateToken, async (req, res) => {
  try {
    const { getVenueSlotConstraints } = await import('../services/venueSlotService.js');
    const config = await getVenueSlotConstraints(req.params.id);
    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load slot config' });
  }
});

router.get('/:id/slots', authenticateToken, async (req, res) => {
  try {
    const { listVenueSlots } = await import('../services/venueSlotService.js');
    const status = req.query.status || 'open';
    const userId = req.user?.userId;
    const manage = userId ? await canManageVenue(userId, req.params.id, req.user?.email) : false;
    const slots = await listVenueSlots(req.params.id, {
      status,
      limit: req.query.limit,
      // yöneticiler tüm slotları görür; diğerleri sessiz filtrelenir
      viewerUserId: manage ? null : userId,
    });
    return res.json({ success: true, data: slots });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list venue slots' });
  }
});

router.post('/:id/slots', authenticateToken, async (req, res) => {
  try {
    const { createVenueSlot } = await import('../services/venueSlotService.js');
    const result = await createVenueSlot(req.params.id, req.user.userId, req.body, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.slot });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create venue slot' });
  }
});

router.post('/:id/slots/:slotId/claim', authenticateToken, async (req, res) => {
  try {
    const { claimVenueSlot } = await import('../services/venueSlotService.js');
    const result = await claimVenueSlot(req.params.id, req.params.slotId, req.user.userId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.slot });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to claim venue slot' });
  }
});

router.get('/:id/suggestions/inbox', authenticateToken, async (req, res) => {
  try {
    const { listSuggestionInbox } = await import('../services/venueSlotService.js');
    const result = await listSuggestionInbox(req.params.id, req.user.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      data: result.suggestions,
      unanswered_count: result.unanswered_count,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load suggestion inbox' });
  }
});

router.get('/:id/suggestions/history', authenticateToken, async (req, res) => {
  try {
    const { listVenueSuggestionHistory } = await import('../services/venueSlotService.js');
    const result = await listVenueSuggestionHistory(
      req.params.id,
      req.user.userId,
      req.user?.email,
      { limit: req.query.limit }
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.suggestions });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load suggestion history' });
  }
});

router.post('/:id/suggestions', authenticateToken, async (req, res) => {
  try {
    const { submitSlotSuggestion } = await import('../services/venueSlotService.js');
    const result = await submitSlotSuggestion(req.params.id, req.user.userId, req.body);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to submit suggestion' });
  }
});

router.post('/:id/suggestions/:suggestionId/approve', authenticateToken, async (req, res) => {
  try {
    const { approveSlotSuggestion } = await import('../services/venueSlotService.js');
    const result = await approveSlotSuggestion(
      req.params.id,
      req.params.suggestionId,
      req.user.userId,
      { reviewerNote: req.body?.reviewer_note },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: { suggestion: result.suggestion, slot: result.slot } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to approve suggestion' });
  }
});

router.post('/:id/suggestions/:suggestionId/reject', authenticateToken, async (req, res) => {
  try {
    const { rejectSlotSuggestion } = await import('../services/venueSlotService.js');
    const result = await rejectSlotSuggestion(
      req.params.id,
      req.params.suggestionId,
      req.user.userId,
      { reviewerNote: req.body?.reviewer_note },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reject suggestion' });
  }
});

router.post('/:id/suggestions/:suggestionId/alt', authenticateToken, async (req, res) => {
  try {
    const { suggestAlternativeSlot } = await import('../services/venueSlotService.js');
    const result = await suggestAlternativeSlot(
      req.params.id,
      req.params.suggestionId,
      req.user.userId,
      { altNote: req.body?.alt_note || req.body?.reviewer_note },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to suggest alternative' });
  }
});

// --- Venue memory arsivi (F5 §9.5) ---

// --- Floor plan + GPS onboarding (§9.1) ---
router.get('/:id/floor-plan', authenticateToken, async (req, res) => {
  try {
    const { getVenueFloorPlan } = await import('../services/venueOnboardingService.js');
    const result = await getVenueFloorPlan(req.params.id, req.user?.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load floor plan' });
  }
});

router.patch('/:id/floor-plan', authenticateToken, async (req, res) => {
  try {
    const { updateVenueFloorPlan } = await import('../services/venueOnboardingService.js');
    const result = await updateVenueFloorPlan(
      req.params.id,
      req.user.userId,
      req.body,
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update floor plan' });
  }
});

router.post('/:id/gps-verify', authenticateToken, async (req, res) => {
  try {
    const { verifyVenueGps } = await import('../services/venueOnboardingService.js');
    const result = await verifyVenueGps(
      req.params.id,
      req.user.userId,
      req.body,
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'GPS verification failed' });
  }
});

router.get('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { listVenueArchive } = await import('../services/venueArchiveService.js');
    const featuredOnly = String(req.query.featured || '') === '1';
    const data = await listVenueArchive(req.params.id, {
      limit: req.query.limit,
      offset: req.query.offset,
      featuredOnly,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load venue archive' });
  }
});

router.patch('/:id/archive/featured', authenticateToken, async (req, res) => {
  try {
    const { setFeaturedArchiveMemories } = await import('../services/venueArchiveService.js');
    const result = await setFeaturedArchiveMemories(
      req.params.id,
      req.user.userId,
      req.body?.featured_memory_ids || [],
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update featured memories' });
  }
});

// --- Venue Isletme paket stub (post-F6 §14) ---
router.get('/:id/business', authenticateToken, async (req, res) => {
  try {
    const { getVenueBusiness } = await import('../services/venueBusinessService.js');
    const result = await getVenueBusiness(req.params.id, req.user.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.business });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load venue business' });
  }
});

router.patch('/:id/business', authenticateToken, async (req, res) => {
  try {
    const { updateVenueBusinessNotes } = await import('../services/venueBusinessService.js');
    const result = await updateVenueBusinessNotes(
      req.params.id,
      req.user.userId,
      { manager_notes: req.body?.manager_notes },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update venue business' });
  }
});

router.post('/:id/business/upgrade-request', authenticateToken, async (req, res) => {
  try {
    const { requestVenuePackageUpgrade } = await import('../services/venueBusinessService.js');
    const result = await requestVenuePackageUpgrade(
      req.params.id,
      req.user.userId,
      req.body?.tier_id,
      { note: req.body?.note },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to submit upgrade request' });
  }
});

// POST /api/venues/:id/business/checkout — Stripe Checkout ya da kayıtlı paket talebi
// (checkout-stub eski istemciler için alias)
const packageCheckoutHandler = async (req, res) => {
  try {
    const { createVenuePackageCheckout } = await import('../services/venueBusinessService.js');
    const result = await createVenuePackageCheckout(
      req.params.id,
      req.user.userId,
      req.body?.tier_id,
      { note: req.body?.note },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to start package checkout' });
  }
};

router.post('/:id/business/checkout', authenticateToken, packageCheckoutHandler);
router.post('/:id/business/checkout-stub', authenticateToken, packageCheckoutHandler);

// GET /api/venues/:id/business/package-requests — paket talep geçmişi + ödeme durumu
router.get('/:id/business/package-requests', authenticateToken, async (req, res) => {
  try {
    const { listVenuePackageRequests } = await import('../services/venueBusinessService.js');
    const result = await listVenuePackageRequests(req.params.id, req.user.userId, req.user?.email);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch package requests' });
  }
});

// POST /api/venues/stripe-webhook — ödeme tamamlanınca paketi aktive eder (auth yok, imza doğrulanır)
router.post('/stripe-webhook', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  try {
    const { parseWebhookEvent } = await import('../services/stripePayments.js');
    const parsed = parseWebhookEvent(req.body, req.headers['stripe-signature']);
    if (!parsed.ok) {
      logger.warn('Stripe webhook rejected', { reason: parsed.reason });
      return res.status(400).json({ success: false, error: parsed.reason });
    }
    if (!parsed.verified) {
      logger.warn('Stripe webhook accepted without signature verification', {
        reason: parsed.reason,
      });
    }

    const event = parsed.event || {};
    const handledTypes = new Set([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
    ]);
    if (!handledTypes.has(event.type)) {
      return res.json({ success: true, data: { received: true, handled: false, type: event.type || null } });
    }

    const session = event.data?.object || {};
    const paid = !session.payment_status || ['paid', 'no_payment_required'].includes(session.payment_status);
    if (!paid) {
      return res.json({
        success: true,
        data: { received: true, handled: false, reason: 'not_paid', session_id: session.id || null },
      });
    }

    const { activateVenuePackageFromStripeSession } = await import(
      '../services/venueBusinessService.js'
    );
    const result = await activateVenuePackageFromStripeSession(session.id);
    if (!result.ok) {
      // 2xx döndür: bilinmeyen oturum için Stripe retry döngüsüne girmesin
      logger.warn('Stripe webhook could not activate package', {
        session_id: session.id || null,
        error: result.error,
      });
      return res.json({
        success: true,
        data: { received: true, handled: false, reason: result.error, session_id: session.id || null },
      });
    }
    return res.json({
      success: true,
      data: {
        received: true,
        handled: true,
        verified: parsed.verified,
        venue_id: result.venue_id,
        tier: result.tier,
        already_activated: Boolean(result.already_activated),
      },
    });
  } catch (error) {
    logger.error('Stripe webhook failed', { error: error.message });
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// POST /api/venues/:id/rituals/:ritualId/reveal-keyword — VEN-EVENT venue staff opens code (v2 §2)
router.post('/:id/rituals/:ritualId/reveal-keyword', authenticateToken, async (req, res) => {
  try {
    const venueId = req.params.id;
    const ritualId = req.params.ritualId;
    const manager = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [venueId, req.user.userId]
    );
    if (manager.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Venue staff only' });
    }
    const ritualCheck = await pool.query(
      `SELECT id FROM rituals WHERE id = $1 AND venue_id = $2 LIMIT 1`,
      [ritualId, venueId]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found for this venue' });
    }
    const { revealCheckinKeyword } = await import('../services/checkinService.js');
    const result = await revealCheckinKeyword(ritualId, req.user.userId);
    if (!result.ok) {
      return res.status(result.status).json(result.body);
    }
    return res.json({ success: true, data: result.data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to reveal keyword' });
  }
});

// POST /api/venues/:id/rituals/:ritualId/no-capacity — §2D [yer veremedik]
router.post('/:id/rituals/:ritualId/no-capacity', authenticateToken, async (req, res) => {
  try {
    const { venueNoCapacityCancel } = await import('../services/birthCancelService.js');
    const { notifyVenueNoCapacity } = await import('../services/notifications.js');
    const result = await venueNoCapacityCancel({
      venueId: req.params.id,
      ritualId: req.params.ritualId,
      managerId: req.user.userId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }
    if (result.notify_host && result.ritual?.host_id) {
      notifyVenueNoCapacity(result.ritual.host_id, {
        id: result.ritual.id,
        title: result.ritual.title,
        venue_id: req.params.id,
      }).catch(() => {});
    }
    return res.json({
      success: true,
      mode: result.mode,
      penalty_free: result.penalty_free !== false,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to cancel walk-in' });
  }
});

// GET /api/venues/:id/claimable-rituals — nearby custom for [Sahiplen]
router.get('/:id/claimable-rituals', authenticateToken, async (req, res) => {
  try {
    const manager = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, req.user.userId]
    );
    if (manager.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Venue staff only' });
    }
    const { listClaimableCustomRituals } = await import('../services/venueClaimService.js');
    const result = await listClaimableCustomRituals(req.params.id, {
      limit: req.query.limit,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data, radius_m: result.radius_m });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list claimable rituals' });
  }
});

// POST /api/venues/:id/rituals/:ritualId/claim — §2D venue_claim
router.post('/:id/rituals/:ritualId/claim', authenticateToken, async (req, res) => {
  try {
    const { claimCustomRitualAsVenue } = await import('../services/venueClaimService.js');
    const result = await claimCustomRitualAsVenue({
      venueId: req.params.id,
      ritualId: req.params.ritualId,
      managerId: req.user.userId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        code: result.code,
        detail: result.detail,
      });
    }
    return res.json({ success: true, data: result.ritual, distance_m: result.distance_m });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to claim ritual' });
  }
});

// GET /api/venues/:id/rituals - backend-yeni.md contract
router.get('/:id/rituals', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, status } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const params = [id];
    let idx = 2;
    let whereStatus = '';
    if (status) {
      whereStatus = ` AND r.status = $${idx}`;
      params.push(String(status));
      idx++;
    }
    params.push(limitNum, offsetNum);
    const result = await pool.query(
      `SELECT
         r.id, r.title, r.type, r.start_time, r.duration, r.capacity, r.entry_type, r.status, r.host_id,
         r.open_note, r.first_sealed_at, r.first_sealed_by, r.origin, r.time_type,
         r.claimed_at, r.claimed_by_venue_id,
         (r.checkin_keyword IS NOT NULL) AS table_open,
         (SELECT COUNT(*)::int FROM ritual_attendance ra WHERE ra.ritual_id = r.id AND ra.status != 'no_show') AS current_attendees,
         (SELECT COUNT(*)::int FROM ritual_attendance ra
           WHERE ra.ritual_id = r.id AND ra.checkin_at IS NOT NULL AND ra.checkin_phase = 'sealed') AS sealed_count,
         (SELECT COUNT(*)::int FROM ritual_attendance ra
           WHERE ra.ritual_id = r.id AND ra.checkin_at IS NOT NULL AND ra.checkin_phase = 'sealed') AS anon_sealed_count
       FROM rituals r
       WHERE r.venue_id = $1
         AND r.suspended_at IS NULL
         ${whereStatus}
       ORDER BY r.start_time DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch venue rituals' });
  }
});

// GET /api/venues/:id/ven-event-quota — aylık tavan snapshot (⭐ boş = sınırsız)
router.get('/:id/ven-event-quota', authenticateToken, async (req, res) => {
  try {
    const { getVenEventQuotaSnapshot } = await import('../services/venEventQuota.js');
    const data = await getVenEventQuotaSnapshot(req.params.id);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch VEN-EVENT quota' });
  }
});

// GET /api/venues/:id/night-report — Gece Raporu digest (v2 §8)
router.get('/:id/night-report', authenticateToken, async (req, res) => {
  try {
    const { buildNightReport } = await import('../services/nightReportService.js');
    const data = await buildNightReport(req.params.id, {
      date: req.query.date,
      mini: req.query.mini === '1' || req.query.mini === 'true',
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, error: error.message || 'Failed to build night report' });
  }
});

// GET /api/venues/:id/monthly-pulse — Aylık Nabız (OPERATÖR+)
router.get('/:id/monthly-pulse', authenticateToken, async (req, res) => {
  try {
    const { buildMonthlyPulse } = await import('../services/monthlyPulseService.js');
    const result = await buildMonthlyPulse(req.params.id, { month: req.query.month });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to build monthly pulse' });
  }
});

// GET /api/venues/:id/market-share — Pazar Payı (HAKİM) / kilitli teaser (OPERATÖR)
router.get('/:id/market-share', authenticateToken, async (req, res) => {
  try {
    const { buildMarketShare } = await import('../services/monthlyPulseService.js');
    const result = await buildMarketShare(req.params.id, { month: req.query.month });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to build market share' });
  }
});

router.post('/:id/business/addon-slot', authenticateToken, async (req, res) => {
  try {
    const { requestAddonSlot } = await import('../services/venueBusinessService.js');
    const result = await requestAddonSlot(
      req.params.id,
      req.user.userId,
      { qty: req.body?.qty },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to purchase addon slot' });
  }
});

router.post('/:id/business/takeover', authenticateToken, async (req, res) => {
  try {
    const { requestTakeover } = await import('../services/venueBusinessService.js');
    const result = await requestTakeover(
      req.params.id,
      req.user.userId,
      { dayType: req.body?.day_type, included: Boolean(req.body?.included) },
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to start takeover' });
  }
});

router.put('/:id/business/featured-event', authenticateToken, async (req, res) => {
  try {
    const { setFeaturedEventCard } = await import('../services/venueBusinessService.js');
    const result = await setFeaturedEventCard(
      req.params.id,
      req.user.userId,
      req.body?.card ?? req.body,
      req.user?.email
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to set featured event' });
  }
});

router.get('/:id/sales-trigger', authenticateToken, async (req, res) => {
  try {
    const { evaluateSalesTrigger } = await import('../services/venuePackageService.js');
    const result = await evaluateSalesTrigger(req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to evaluate sales trigger' });
  }
});

router.get('/:id/shadow-pitch', authenticateToken, async (req, res) => {
  try {
    const { getShadowSalesPitch } = await import('../services/shadowVenueService.js');
    const result = await getShadowSalesPitch(req.params.id);
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load shadow pitch' });
  }
});

router.get('/:id/chip-trends', authenticateToken, async (req, res) => {
  try {
    const { getChipTrends } = await import('../services/venueInsightsService.js');
    const result = await getChipTrends(req.params.id, { days: req.query.days });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load chip trends' });
  }
});

router.get('/:id/ai-advice', authenticateToken, async (req, res) => {
  try {
    const { getAiMonthlyAdvice } = await import('../services/venueInsightsService.js');
    const result = await getAiMonthlyAdvice(req.params.id, { month: req.query.month });
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load AI advice' });
  }
});

router.post('/:id/slots/:slotId/brand-priority', authenticateToken, async (req, res) => {
  try {
    const { setSlotBrandPriority } = await import('../services/venueInsightsService.js');
    const result = await setSlotBrandPriority(
      req.params.id,
      req.params.slotId,
      req.body?.enabled !== false,
      req.user.userId
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.slot });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to set brand priority' });
  }
});

/** v2 §9 — venue-created badges (shield · logo · max 5 · admin onay) */
router.get('/:id/venue-badges', authenticateToken, async (req, res) => {
  try {
    const { listVenueBadges } = await import('../services/venueBadgeService.js');
    const result = await listVenueBadges(req.params.id, { status: req.query.status });
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to list venue badges' });
  }
});

router.post('/:id/venue-badges', authenticateToken, async (req, res) => {
  try {
    const { createVenueBadge } = await import('../services/venueBadgeService.js');
    const result = await createVenueBadge(
      req.params.id,
      req.user.userId,
      req.body || {},
      req.user.email || ''
    );
    if (!result.ok) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.status(201).json({ success: true, data: result.venue_badge });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create venue badge' });
  }
});

/** Explicit ban — mekan elle dağıtamaz */
router.post('/:id/venue-badges/:badgeId/handout', authenticateToken, async (_req, res) => {
  const { handDistributeVenueBadge } = await import('../services/venueBadgeService.js');
  const result = await handDistributeVenueBadge();
  return res.status(result.status || 403).json({ success: false, error: result.error });
});

// GET /api/venues/:id/analytics - backend-yeni.md contract (OPERATÖR+)
router.get('/:id/analytics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const venueResult = await pool.query(
      `SELECT id, owner_user_id, subscription_tier, pro_enabled, city_partner_enabled
       FROM venues
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (venueResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    const venue = venueResult.rows[0];
    const isOwner = String(venue.owner_user_id || '') === String(userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only venue owner can view analytics' });
    }
    const { resolveTierFromVenue } = await import('../services/venuePackageService.js');
    const tier = resolveTierFromVenue(venue);
    if (tier === 'free') {
      return res.status(403).json({ success: false, error: 'OPERATÖR+ subscription required' });
    }

    const [ritualStats, ratingStats] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_rituals,
           COUNT(*) FILTER (WHERE status IN ('active', 'live'))::int AS active_rituals,
           COUNT(*) FILTER (WHERE status = 'ended')::int AS ended_rituals
         FROM rituals
         WHERE venue_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS rating_count,
           AVG(score)::numeric(10,2) AS avg_score
         FROM venue_ratings
         WHERE venue_id = $1`,
        [id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        total_rituals: ritualStats.rows[0]?.total_rituals || 0,
        active_rituals: ritualStats.rows[0]?.active_rituals || 0,
        ended_rituals: ritualStats.rows[0]?.ended_rituals || 0,
        rating_count: ratingStats.rows[0]?.rating_count || 0,
        avg_score: ratingStats.rows[0]?.avg_score != null ? Number(ratingStats.rows[0].avg_score) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch venue analytics' });
  }
});

// POST /api/venues/:id/follow - backend-yeni.md contract
router.post('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const venueCheck = await pool.query('SELECT id FROM venues WHERE id = $1', [id]);
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    await pool.query(
      `INSERT INTO venue_follows (user_id, venue_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, venue_id) DO NOTHING`,
      [userId, id]
    );
    return res.status(201).json({ success: true, message: 'Venue followed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to follow venue' });
  }
});

// DELETE /api/venues/:id/follow - backend-yeni.md contract
router.delete('/:id/follow', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    const result = await pool.query(
      `DELETE FROM venue_follows
       WHERE user_id = $1 AND venue_id = $2
       RETURNING id`,
      [userId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Follow relationship not found' });
    }
    return res.json({ success: true, message: 'Venue unfollowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to unfollow venue' });
  }
});

// POST /api/venues/:id/rate - backend-yeni.md contract
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const venueId = req.params.id;
    const { ritual_id, score } = req.body;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!ritual_id || score == null) {
      return res.status(400).json({ success: false, error: 'ritual_id and score are required' });
    }
    const scoreNum = Number(score);
    if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
      return res.status(400).json({ success: false, error: 'score must be an integer between 1 and 5' });
    }
    const ritualCheck = await pool.query(
      `SELECT id, venue_id, status FROM rituals WHERE id = $1 LIMIT 1`,
      [ritual_id]
    );
    if (ritualCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ritual not found' });
    }
    if (String(ritualCheck.rows[0].venue_id || '') !== String(venueId)) {
      return res.status(400).json({ success: false, error: 'Ritual does not belong to this venue' });
    }
    if (String(ritualCheck.rows[0].status) !== 'ended') {
      return res.status(403).json({ success: false, error: 'Venue rating is allowed only after ritual ends' });
    }
    const attended = await pool.query(
      `SELECT 1
       FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2 AND status NOT IN ('no_show', 'cancelled')
       LIMIT 1`,
      [ritual_id, userId]
    );
    if (attended.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Only participants can rate venue' });
    }
    const inserted = await pool.query(
      `INSERT INTO venue_ratings (venue_id, user_id, ritual_id, score)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [venueId, userId, ritual_id, scoreNum]
    );
    return res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to rate venue' });
  }
});

// POST /api/venues - Create venue (admin only); optional owner_user_id to add first manager
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, city, address, location_lat, location_lng, description, slug, owner_user_id } = req.body;
    if (!name || !city) {
      return res.status(400).json({ success: false, error: 'name and city are required' });
    }

    const result = await pool.query(
      `INSERT INTO venues (name, city, address, location_lat, location_lng, description, slug, subscription_tier, pro_enabled, city_partner_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'basic', false, false)
       ON CONFLICT (name, city) DO UPDATE SET
         address = COALESCE(EXCLUDED.address, venues.address),
         location_lat = COALESCE(EXCLUDED.location_lat, venues.location_lat),
         location_lng = COALESCE(EXCLUDED.location_lng, venues.location_lng),
         description = COALESCE(EXCLUDED.description, venues.description),
         slug = COALESCE(EXCLUDED.slug, venues.slug),
        subscription_tier = COALESCE(venues.subscription_tier, 'basic'),
        pro_enabled = false,
        city_partner_enabled = false,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        String(name).trim(),
        String(city).trim(),
        address ? String(address).trim() : null,
        location_lat != null ? parseFloat(location_lat) : null,
        location_lng != null ? parseFloat(location_lng) : null,
        description ? String(description).trim() : null,
        slug ? String(slug).trim() : null,
      ]
    );
    const venue = result.rows[0];

    if (owner_user_id) {
      await pool.query(
        `INSERT INTO venue_managers (venue_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (venue_id, user_id) DO UPDATE SET role = 'owner'`,
        [venue.id, owner_user_id]
      );
    }

    const [isVerified, rsMeta] = await Promise.all([
      getVenueVerified(venue.name, venue.city),
      getVenueRS(venue.id),
    ]);
    res.status(201).json({
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        city: venue.city,
        address: venue.address || null,
        location_lat: venue.location_lat != null ? parseFloat(venue.location_lat) : null,
        location_lng: venue.location_lng != null ? parseFloat(venue.location_lng) : null,
        description: venue.description || null,
        slug: venue.slug || null,
        is_verified: isVerified,
        subscription_tier: venue.subscription_tier || 'basic',
        pro_enabled: Boolean(venue.pro_enabled),
        city_partner_enabled: Boolean(venue.city_partner_enabled),
        venue_rs: rsMeta.venue_rs,
        venue_rs_rating_count: rsMeta.venue_rs_rating_count,
        venue_rs_badge: rsMeta.venue_rs_badge,
        created_at: venue.created_at,
      },
    });
  } catch (error) {
    logger.error('Error creating venue', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create venue' });
  }
});

// PATCH /api/venues/:id - Update venue (admin or venue manager)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const allowed = await canManageVenue(userId, id, req.user?.email);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'Not allowed to update this venue' });
    }

    const { name, city, address, location_lat, location_lng, description, slug, dense_canyon, gps_radius_m } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx}`); values.push(String(name).trim()); idx++; }
    if (city !== undefined) { updates.push(`city = $${idx}`); values.push(String(city).trim()); idx++; }
    if (address !== undefined) { updates.push(`address = $${idx}`); values.push(address ? String(address).trim() : null); idx++; }
    if (location_lat !== undefined) { updates.push(`location_lat = $${idx}`); values.push(location_lat != null ? parseFloat(location_lat) : null); idx++; }
    if (location_lng !== undefined) { updates.push(`location_lng = $${idx}`); values.push(location_lng != null ? parseFloat(location_lng) : null); idx++; }
    if (description !== undefined) { updates.push(`description = $${idx}`); values.push(description ? String(description).trim() : null); idx++; }
    if (slug !== undefined) { updates.push(`slug = $${idx}`); values.push(slug ? String(slug).trim() : null); idx++; }
    if (dense_canyon !== undefined) {
      updates.push(`dense_canyon = $${idx}`);
      values.push(Boolean(dense_canyon));
      idx++;
    }
    if (gps_radius_m !== undefined) {
      const n = gps_radius_m == null || gps_radius_m === '' ? null : Math.round(Number(gps_radius_m));
      if (n != null && (!Number.isFinite(n) || n < 10 || n > 200)) {
        return res.status(400).json({ success: false, error: 'gps_radius_m must be 10–200 or null' });
      }
      updates.push(`gps_radius_m = $${idx}`);
      values.push(n);
      idx++;
    }

    if (updates.length === 0) {
      const existing = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ success: false, error: 'Venue not found' });
      const v = existing.rows[0];
      const [isVerified, rsMeta] = await Promise.all([
        getVenueVerified(v.name, v.city),
        getVenueRS(v.id),
      ]);
      return res.json({
        success: true,
        data: {
          id: v.id,
          name: v.name,
          city: v.city,
          address: v.address || null,
          location_lat: v.location_lat != null ? parseFloat(v.location_lat) : null,
          location_lng: v.location_lng != null ? parseFloat(v.location_lng) : null,
          description: v.description || null,
          slug: v.slug || null,
          is_verified: isVerified,
          venue_rs: rsMeta.venue_rs,
          venue_rs_rating_count: rsMeta.venue_rs_rating_count,
          venue_rs_badge: rsMeta.venue_rs_badge,
          created_at: v.created_at,
          updated_at: v.updated_at,
        },
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE venues SET ${updates.join(', ')}, subscription_tier = 'basic', pro_enabled = false, city_partner_enabled = false WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    const venue = result.rows[0];
    const [isVerified, rsMeta] = await Promise.all([
      getVenueVerified(venue.name, venue.city),
      getVenueRS(venue.id),
    ]);
    res.json({
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        city: venue.city,
        address: venue.address || null,
        location_lat: venue.location_lat != null ? parseFloat(venue.location_lat) : null,
        location_lng: venue.location_lng != null ? parseFloat(venue.location_lng) : null,
        description: venue.description || null,
        slug: venue.slug || null,
        is_verified: isVerified,
        subscription_tier: venue.subscription_tier || 'basic',
        pro_enabled: Boolean(venue.pro_enabled),
        city_partner_enabled: Boolean(venue.city_partner_enabled),
        venue_rs: rsMeta.venue_rs,
        venue_rs_rating_count: rsMeta.venue_rs_rating_count,
        venue_rs_badge: rsMeta.venue_rs_badge,
        created_at: venue.created_at,
        updated_at: venue.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error updating venue', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update venue' });
  }
});

// POST /api/venues/:id/managers - Add manager (admin only)
router.post('/:id/managers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, role = 'manager' } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }
    const validRoles = ['owner', 'manager', 'staff'];
    const roleValue = validRoles.includes(role) ? role : 'manager';

    const venueCheck = await pool.query('SELECT id FROM venues WHERE id = $1', [id]);
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO venue_managers (venue_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (venue_id, user_id) DO UPDATE SET role = $3`,
      [id, user_id, roleValue]
    );

    res.status(201).json({
      success: true,
      message: 'Manager added',
      data: { venue_id: id, user_id, role: roleValue },
    });
  } catch (error) {
    logger.error('Error adding venue manager', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to add manager' });
  }
});

// DELETE /api/venues/:id/managers/:userId - Remove manager (admin only, or owner removing non-owner)
router.delete('/:id/managers/:userId', authenticateToken, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const authUserId = req.user?.userId;
    if (!authUserId) return res.status(401).json({ success: false, error: 'Authentication required' });

    const isAdmin = isAdminUser(authUserId, req.user?.email);
    const isOwner = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 AND role = 'owner' LIMIT 1`,
      [id, authUserId]
    );

    if (!isAdmin && isOwner.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not allowed to remove managers' });
    }
    if (isOwner.rows.length > 0 && authUserId !== targetUserId) {
      const targetRole = await pool.query(
        `SELECT role FROM venue_managers WHERE venue_id = $1 AND user_id = $2`,
        [id, targetUserId]
      );
      if (targetRole.rows.length > 0 && targetRole.rows[0].role === 'owner') {
        return res.status(403).json({ success: false, error: 'Cannot remove another owner' });
      }
    }

    const result = await pool.query(
      `DELETE FROM venue_managers WHERE venue_id = $1 AND user_id = $2 RETURNING id`,
      [id, targetUserId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Manager not found' });
    }
    res.json({ success: true, message: 'Manager removed' });
  } catch (error) {
    logger.error('Error removing venue manager', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to remove manager' });
  }
});

// GET /api/venues/:id/portals — sonMD venue_portals
router.get('/:id/portals', authenticateToken, async (req, res) => {
  try {
    const [r, venue] = await Promise.all([
      pool.query(
        `SELECT id, venue_id, portal_id, label, created_at
         FROM venue_portals WHERE venue_id = $1 ORDER BY created_at ASC`,
        [req.params.id]
      ),
      pool.query(`SELECT multi_room_flag FROM venues WHERE id = $1`, [req.params.id]),
    ]);
    const { assertCanAddTableTotem } = await import('../services/venuePackageService.js');
    const tableGate = await assertCanAddTableTotem(req.params.id);
    res.json({
      success: true,
      data: r.rows,
      // label yalnız odalı mekanda tanımlanır (sonMD portal seti)
      multi_room_flag: Boolean(venue.rows[0]?.multi_room_flag),
      can_add_table_totem: tableGate.ok,
      table_totem_reason: tableGate.reason || tableGate.code || null,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to list portals' });
  }
});

// POST /api/venues/:id/portals
router.post('/:id/portals', authenticateToken, async (req, res) => {
  try {
    const venueId = req.params.id;
    const actor = req.user.userId;
    const mgr = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [venueId, actor]
    );
    if (!mgr.rows.length) {
      return res.status(403).json({ success: false, error: 'Venue manager required' });
    }
    const portalId = String(req.body?.portal_id || '').trim().slice(0, 64);
    if (!portalId) {
      return res.status(400).json({ success: false, error: 'portal_id required' });
    }
    const venue = await pool.query(
      `SELECT multi_room_flag FROM venues WHERE id = $1`,
      [venueId]
    );
    const multi = Boolean(venue.rows[0]?.multi_room_flag);
    const label =
      multi && req.body?.label != null
        ? String(req.body.label).trim().slice(0, 80) || null
        : null;
    const existingPortal = await pool.query(
      `SELECT 1 FROM venue_portals WHERE venue_id = $1 AND portal_id = $2 LIMIT 1`,
      [venueId, portalId]
    );
    if (!existingPortal.rows.length) {
      const { assertCanAddTableTotem } = await import('../services/venuePackageService.js');
      const tableGate = await assertCanAddTableTotem(venueId);
      if (!tableGate.ok) {
        return res.status(tableGate.status || 403).json({
          success: false,
          error: tableGate.error,
          code: tableGate.code,
        });
      }
    }
    const ins = await pool.query(
      `INSERT INTO venue_portals (venue_id, portal_id, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (venue_id, portal_id) DO UPDATE SET label = EXCLUDED.label
       RETURNING *`,
      [venueId, portalId, label]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create portal' });
  }
});

// DELETE /api/venues/:id/portals/:portalId
router.delete('/:id/portals/:portalId', authenticateToken, async (req, res) => {
  try {
    const actor = req.user.userId;
    const mgr = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.id, actor]
    );
    if (!mgr.rows.length) {
      return res.status(403).json({ success: false, error: 'Venue manager required' });
    }
    // sonMD 🔒 mekan başına min 1 totem (kasa/giriş) — son portal silinemez
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM venue_portals WHERE venue_id = $1`,
      [req.params.id]
    );
    if ((count.rows[0]?.n || 0) <= 1) {
      return res.status(409).json({
        success: false,
        error: 'Mekan başına en az 1 totem zorunlu (kasa/giriş)',
        code: 'PORTAL_MIN_ONE',
      });
    }
    await pool.query(
      `DELETE FROM venue_portals WHERE venue_id = $1 AND portal_id = $2`,
      [req.params.id, req.params.portalId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete portal' });
  }
});

/** C5: totem kayıp/kırık bildir → kod fallback */
router.patch('/:id/totem-status', authenticateToken, async (req, res) => {
  try {
    const venueId = req.params.id;
    const userId = req.user.userId;
    const status = String(req.body?.totem_status || '').toLowerCase();
    if (!['ok', 'broken', 'missing'].includes(status)) {
      return res.status(400).json({ success: false, error: 'totem_status must be ok|broken|missing' });
    }
    const mgr = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [venueId, userId]
    );
    if (mgr.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Venue manager only' });
    }
    const r = await pool.query(
      `UPDATE venues SET totem_status = $2 WHERE id = $1
       RETURNING id, totem_status`,
      [venueId, status]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update totem status' });
  }
});

/** C5: panelden totem talebi — missing + funnel olay */
router.post('/:id/totem-request', authenticateToken, async (req, res) => {
  try {
    const venueId = req.params.id;
    const userId = req.user.userId;
    const note =
      typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 280) : null;
    const mgr = await pool.query(
      `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
      [venueId, userId]
    );
    if (mgr.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Venue manager only' });
    }
    const r = await pool.query(
      `UPDATE venues SET totem_status = 'missing' WHERE id = $1
       RETURNING id, totem_status, name`,
      [venueId]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ success: false, error: 'Venue not found' });
    }
    try {
      const { recordCheckinFunnelEvent, enqueueTotemOpsRequest } = await import('../services/checkinFunnelService.js');
      void recordCheckinFunnelEvent({
        ritualId: null,
        userId,
        event: 'totem_request',
        meta: { venue_id: venueId, note, venue_name: r.rows[0].name },
      });
      await enqueueTotemOpsRequest({ venueId, userId, note });
    } catch (_e) {
      /* soft */
    }
    res.json({
      success: true,
      data: {
        ...r.rows[0],
        request: 'queued',
        message: 'Totem talebi alındı — white-glove / yedek set ops kuyruğunda',
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to request totem' });
  }
});

export default router;
