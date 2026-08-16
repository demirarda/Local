/**
 * Venue başvuru / onboarding — son-part.md §9.1 (VAPP-UNIFIED)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { notifyVenueApplicationResult } from './notifications.js';

const ONBOARDING_STEPS = LOCAL_CONFIG.venue.ONBOARDING_STEPS;

export function validateApplicationPayload(body = {}) {
  const businessName = String(body.business_name || '').trim();
  const venueName = String(body.venue_name || '').trim();
  const city = String(body.city || '').trim();
  if (!businessName || businessName.length < 2) {
    return { ok: false, error: 'business_name is required (min 2 chars)' };
  }
  if (!venueName || venueName.length < 2) {
    return { ok: false, error: 'venue_name is required (min 2 chars)' };
  }
  if (!city || city.length < 2) {
    return { ok: false, error: 'city is required' };
  }
  const proofNotes = String(body.proof_notes || '').trim();
  if (proofNotes.length < 10) {
    return { ok: false, error: 'proof_notes is required (min 10 chars — işletme kanıtı)' };
  }
  const mapsUrl = body.maps_url ? String(body.maps_url).trim() : '';
  if (!mapsUrl || !/^https?:\/\//i.test(mapsUrl)) {
    return { ok: false, error: 'maps_url zorunlu (https Maps linki)' };
  }
  const photoUrls = Array.isArray(body.photo_urls)
    ? body.photo_urls.map((u) => String(u).trim()).filter(Boolean).slice(0, 20)
    : [];
  const photoMin = LOCAL_CONFIG.venue?.PACKAGES_STUB?.PHOTO_MIN ?? 5;
  if (photoUrls.length < photoMin) {
    return { ok: false, error: `En az ${photoMin} fotoğraf URL'si gerekli` };
  }
  if (!body.commitment_accepted) {
    return { ok: false, error: 'Taahhüt checkbox zorunlu' };
  }
  const commitmentText =
    body.commitment_text ||
    LOCAL_CONFIG.venue?.PACKAGES_STUB?.COMMITMENT_TEXT ||
    '';
  const socialUrl = body.social_url ? String(body.social_url).trim().slice(0, 500) : null;
  const viesVat = body.vies_vat ? String(body.vies_vat).trim().slice(0, 32) : null;
  return {
    ok: true,
    data: {
      business_name: businessName,
      venue_name: venueName,
      city,
      address: body.address ? String(body.address).trim() : null,
      location_lat: body.location_lat != null ? Number(body.location_lat) : null,
      location_lng: body.location_lng != null ? Number(body.location_lng) : null,
      category: body.category ? String(body.category).trim() : null,
      description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      proof_notes: proofNotes.slice(0, 4000),
      proof_url: body.proof_url ? String(body.proof_url).trim() : null,
      contact_email: body.contact_email ? String(body.contact_email).trim() : null,
      contact_phone: body.contact_phone ? String(body.contact_phone).trim() : null,
      maps_url: mapsUrl.slice(0, 1000),
      social_url: socialUrl,
      commitment_accepted: true,
      commitment_text: String(commitmentText).slice(0, 2000),
      vies_vat: viesVat,
      photo_urls: photoUrls,
    },
  };
}

export async function submitVenueApplication(userId, payload) {
  const valid = validateApplicationPayload(payload);
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };

  const pending = await pool.query(
    `SELECT id FROM venue_applications WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  );
  if (pending.rows.length > 0) {
    return { ok: false, status: 409, error: 'You already have a pending venue application' };
  }

  const existingOwner = await pool.query(
    `SELECT 1 FROM venue_managers WHERE user_id = $1 AND role = 'owner' LIMIT 1`,
    [userId]
  );
  if (existingOwner.rows.length > 0) {
    return { ok: false, status: 409, error: 'You already manage a venue' };
  }

  const d = valid.data;
  const r = await pool.query(
    `INSERT INTO venue_applications (
       user_id, business_name, venue_name, city, address,
       location_lat, location_lng, category, description,
       proof_notes, proof_url, contact_email, contact_phone,
       maps_url, social_url, commitment_accepted, commitment_text, vies_vat, photo_urls,
       status, onboarding_step
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,'pending','application_submitted')
     RETURNING *`,
    [
      userId,
      d.business_name,
      d.venue_name,
      d.city,
      d.address,
      d.location_lat,
      d.location_lng,
      d.category,
      d.description,
      d.proof_notes,
      d.proof_url,
      d.contact_email,
      d.contact_phone,
      d.maps_url,
      d.social_url,
      d.commitment_accepted,
      d.commitment_text,
      d.vies_vat,
      JSON.stringify(d.photo_urls || []),
    ]
  );

  return { ok: true, application: r.rows[0] };
}

export async function getMyVenueApplication(userId) {
  const r = await pool.query(
    `SELECT va.*, v.name AS linked_venue_name
     FROM venue_applications va
     LEFT JOIN venues v ON v.id = va.venue_id
     WHERE va.user_id = $1
     ORDER BY va.created_at DESC
     LIMIT 1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

export async function withdrawVenueApplication(userId) {
  const r = await pool.query(
    `UPDATE venue_applications
     SET status = 'withdrawn', updated_at = NOW()
     WHERE user_id = $1 AND status = 'pending'
     RETURNING *`,
    [userId]
  );
  if (r.rows.length === 0) {
    return { ok: false, status: 404, error: 'No pending application' };
  }
  return { ok: true, application: r.rows[0] };
}

export async function listVenueApplications({ status = 'pending', limit = 50, offset = 0 } = {}) {
  const lim = Math.min(Number(limit) || 50, 100);
  const off = Math.max(Number(offset) || 0, 0);
  const r = await pool.query(
    `SELECT va.*, u.name AS applicant_name, u.email AS applicant_email
     FROM venue_applications va
     JOIN users u ON u.id = va.user_id
     WHERE ($1::text IS NULL OR va.status::text = $1)
     ORDER BY va.created_at ASC
     LIMIT $2 OFFSET $3`,
    [status || null, lim, off]
  );
  return r.rows;
}

export async function approveVenueApplication(applicationId, reviewerId, { reviewerNote } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appR = await client.query(
      `SELECT * FROM venue_applications WHERE id = $1 FOR UPDATE`,
      [applicationId]
    );
    if (appR.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'Application not found' };
    }
    const app = appR.rows[0];
    if (app.status !== 'pending') {
      await client.query('ROLLBACK');
      return { ok: false, status: 400, error: 'Application is not pending' };
    }

    const venueR = await client.query(
      `INSERT INTO venues (name, city, address, location_lat, location_lng, description, owner_user_id, subscription_tier, maps_url, social_url, photo_urls, commitment_accepted_at, vies_ok, vies_checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'free', $8, $9, $10::jsonb, NOW(), $11, CASE WHEN $12::text IS NOT NULL THEN NOW() ELSE NULL END)
       ON CONFLICT (name, city) DO UPDATE SET
         address = COALESCE(EXCLUDED.address, venues.address),
         location_lat = COALESCE(EXCLUDED.location_lat, venues.location_lat),
         location_lng = COALESCE(EXCLUDED.location_lng, venues.location_lng),
         description = COALESCE(EXCLUDED.description, venues.description),
         owner_user_id = COALESCE(venues.owner_user_id, EXCLUDED.owner_user_id),
         maps_url = COALESCE(EXCLUDED.maps_url, venues.maps_url),
         social_url = COALESCE(EXCLUDED.social_url, venues.social_url),
         photo_urls = COALESCE(EXCLUDED.photo_urls, venues.photo_urls),
         updated_at = NOW()
       RETURNING *`,
      [
        app.venue_name,
        app.city,
        app.address,
        app.location_lat,
        app.location_lng,
        app.description,
        app.user_id,
        app.maps_url || null,
        app.social_url || null,
        JSON.stringify(app.photo_urls || []),
        app.vies_vat ? true : null,
        app.vies_vat || null,
      ]
    );
    const venue = venueR.rows[0];

    await client.query(
      `INSERT INTO venue_managers (venue_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (venue_id, user_id) DO UPDATE SET role = 'owner'`,
      [venue.id, app.user_id]
    );

    const updated = await client.query(
      `UPDATE venue_applications
       SET status = 'approved',
           venue_id = $2,
           onboarding_step = 'approved',
           reviewed_by = $3,
           reviewed_at = NOW(),
           reviewer_note = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [applicationId, venue.id, reviewerId, reviewerNote || null]
    );

    await client.query('COMMIT');

    notifyVenueApplicationResult(app.user_id, {
      approved: true,
      venueId: venue.id,
      venueName: venue.name,
      city: venue.city,
    }).catch(() => {});

    const { linkShadowVenueHistory } = await import('./shadowVenueService.js');
    const shadow = await linkShadowVenueHistory(venue.id).catch(() => null);
    if (shadow?.ok) {
      await pool.query(
        `UPDATE venue_applications
         SET shadow_pitch = $2::jsonb
         WHERE id = $1`,
        [
          applicationId,
          JSON.stringify({
            internal_region_count: shadow.internal_region_count,
            nearby_ritual_count: shadow.badge?.nearby_ritual_count || 0,
            score_start_at: shadow.score_start_at,
          }),
        ]
      ).catch(() => {});
    }

    return { ok: true, application: updated.rows[0], venue, onboarding_steps: ONBOARDING_STEPS, shadow_pitch: shadow };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function rejectVenueApplication(applicationId, reviewerId, { reviewerNote } = {}) {
  const r = await pool.query(
    `UPDATE venue_applications
     SET status = 'rejected',
         reviewed_by = $2,
         reviewed_at = NOW(),
         reviewer_note = $3,
         updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [applicationId, reviewerId, reviewerNote || null]
  );
  if (r.rows.length === 0) {
    return { ok: false, status: 404, error: 'Pending application not found' };
  }
  const app = r.rows[0];
  notifyVenueApplicationResult(app.user_id, {
    approved: false,
    venueName: app.venue_name,
    reviewerNote: reviewerNote || null,
  }).catch(() => {});
  return { ok: true, application: app };
}

export async function updateOnboardingStep(userId, venueId, step) {
  if (!ONBOARDING_STEPS.includes(step)) {
    return { ok: false, status: 400, error: 'Invalid onboarding step' };
  }
  const r = await pool.query(
    `UPDATE venue_applications
     SET onboarding_step = $3::venue_onboarding_step, updated_at = NOW()
     WHERE user_id = $1 AND venue_id = $2 AND status = 'approved'
     RETURNING *`,
    [userId, venueId, step]
  );
  if (r.rows.length === 0) {
    return { ok: false, status: 404, error: 'Approved application not found' };
  }
  return { ok: true, application: r.rows[0] };
}

/** Vitrin + GPS + ilk slot tamamlandiginda canli adimina gec — §9.1 */
export async function maybeMarkVenueLive(userId, venueId) {
  const venueR = await pool.query(
    `SELECT vitrine_published, gps_verified_at FROM venues WHERE id = $1`,
    [venueId]
  );
  if (venueR.rows.length === 0) return { ok: false, skipped: true };
  const venue = venueR.rows[0];
  const slotR = await pool.query(
    `SELECT 1 FROM venue_slots WHERE venue_id = $1 LIMIT 1`,
    [venueId]
  );
  if (!venue.vitrine_published || !venue.gps_verified_at || slotR.rows.length === 0) {
    return { ok: true, skipped: true };
  }
  return updateOnboardingStep(userId, venueId, 'live');
}
