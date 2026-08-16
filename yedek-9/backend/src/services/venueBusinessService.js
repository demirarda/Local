/**
 * Venue İşletme paketleri — LOCAL v2 §8 (FREE / OPERATÖR / HAKİM)
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  buildPackageCatalogV2,
  normalizeTierId,
  resolveTierFromVenue,
  evaluateSalesTrigger,
  startVenueTakeover,
  purchaseAddonSlot,
  packagePrice,
} from './venuePackageService.js';
import { isStripeEnabled, createPackageCheckoutSession } from './stripePayments.js';

const REQUEST_STATUS_LABELS = {
  pending: 'Onay bekliyor',
  contacted: 'Ekip iletişimde',
  activated: 'Aktif',
  cancelled: 'İptal edildi',
};

function presentPackageRequest(row) {
  const awaitingPayment = Boolean(row.stripe_session_id) && row.status === 'pending';
  return {
    id: row.id,
    from_tier: row.from_tier,
    to_tier: row.to_tier,
    status: row.status,
    status_label: awaitingPayment ? 'Ödeme bekleniyor' : REQUEST_STATUS_LABELS[row.status] || row.status,
    payment_provider: row.stripe_session_id ? 'stripe' : null,
    awaiting_payment: awaitingPayment,
    stripe_session_id: row.stripe_session_id || null,
    note: row.note || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function isVenueManager(userId, venueId, email = '') {
  if (!userId) return false;
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (adminIds.includes(String(userId))) return true;
  if (email && adminEmails.includes(String(email).toLowerCase())) return true;
  const r = await pool.query(
    `SELECT 1 FROM venue_managers WHERE venue_id = $1 AND user_id = $2 LIMIT 1`,
    [venueId, userId]
  );
  return r.rows.length > 0;
}

export function buildPackageCatalog(venue = {}) {
  return buildPackageCatalogV2(venue);
}

export async function getVenueBusiness(venueId, viewerUserId, viewerEmail = '') {
  const r = await pool.query(
    `SELECT id, name, subscription_tier, pro_enabled, city_partner_enabled, package_stub,
            size_multiplier, addon_slots, takeover_until, sales_unlocked_at, featured_event_card
     FROM venues WHERE id = $1`,
    [venueId]
  );
  if (r.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const venue = r.rows[0];
  const canManage = await isVenueManager(viewerUserId, venueId, viewerEmail);
  const sales = await evaluateSalesTrigger(venueId).catch(() => ({ unlocked: Boolean(venue.sales_unlocked_at) }));
  const tier = resolveTierFromVenue(venue);
  return {
    ok: true,
    business: {
      venue_id: venue.id,
      venue_name: venue.name,
      can_manage: canManage,
      packages: buildPackageCatalog({ ...venue, sales_unlocked_at: sales.unlocked ? venue.sales_unlocked_at || new Date().toISOString() : null }),
      sales_trigger: sales,
      featured_event_card: venue.featured_event_card || null,
      passive_message:
        tier === 'free' && !sales.unlocked
          ? 'Ücretli paketler satış tetik eşiği veya manuel talep ile açılır'
          : null,
    },
  };
}

export async function updateVenueBusinessNotes(venueId, userId, { manager_notes } = {}, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const cur = await pool.query(`SELECT package_stub FROM venues WHERE id = $1`, [venueId]);
  if (cur.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const next = {
    ...(cur.rows[0].package_stub || {}),
    manager_notes: manager_notes != null ? String(manager_notes).trim().slice(0, 2000) : null,
  };
  const upd = await pool.query(
    `UPDATE venues SET package_stub = $2::jsonb WHERE id = $1 RETURNING *`,
    [venueId, JSON.stringify(next)]
  );
  return { ok: true, venue: upd.rows[0], packages: buildPackageCatalog(upd.rows[0]) };
}

export async function requestVenuePackageUpgrade(venueId, userId, tierId, { note } = {}, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const tier = normalizeTierId(tierId);
  const stub = LOCAL_CONFIG.venue.PACKAGES_STUB || {};
  const tierDef = (stub.tiers || []).find((t) => t.id === tier);
  if (!tierDef || tier === 'free') {
    return { ok: false, status: 400, error: 'Invalid package tier' };
  }
  if (!tierDef.active) {
    return { ok: false, status: 400, error: 'Package tier is not available' };
  }

  const cur = await pool.query(
    `SELECT package_stub, subscription_tier, pro_enabled, city_partner_enabled, sales_unlocked_at
     FROM venues WHERE id = $1`,
    [venueId]
  );
  if (cur.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };
  const current = resolveTierFromVenue(cur.rows[0]);
  if (current === tier) {
    return { ok: false, status: 409, error: 'Already on this tier' };
  }

  const sales = await evaluateSalesTrigger(venueId);
  if (tier === 'hakim' && !sales.unlocked && !cur.rows[0].sales_unlocked_at) {
    return {
      ok: false,
      status: 403,
      error: 'HAKİM paketi satış tetik eşiği sonrası açılır',
      sales_trigger: sales,
    };
  }

  const prev = cur.rows[0].package_stub || {};
  const requests = Array.isArray(prev.upgrade_requests) ? prev.upgrade_requests : [];
  const entry = {
    tier,
    note: note ? String(note).trim().slice(0, 500) : null,
    requested_at: new Date().toISOString(),
    status: 'pending',
    price_try: packagePrice(tierDef.price_try, cur.rows[0]),
  };
  const next = {
    ...prev,
    pending_upgrade_tier: tier,
    upgrade_requests: [...requests, entry].slice(-10),
  };
  const upd = await pool.query(
    `UPDATE venues SET package_stub = $2::jsonb WHERE id = $1 RETURNING *`,
    [venueId, JSON.stringify(next)]
  );
  return { ok: true, venue: upd.rows[0], packages: buildPackageCatalog(upd.rows[0]), request: entry };
}

/**
 * Paket ödemesi — Stripe açıksa Checkout Session, kapalıysa kayıtlı talep.
 * Her iki yolda da venue_package_requests satırı yazılır (migration 108);
 * aktivasyon Stripe webhook veya admin onayı ile olur.
 */
export async function createVenuePackageCheckout(venueId, userId, tierId, { note } = {}, email = '') {
  const upgrade = await requestVenuePackageUpgrade(venueId, userId, tierId, { note }, email);
  if (!upgrade.ok) return upgrade;

  const tier = normalizeTierId(tierId);
  const tierDef = (LOCAL_CONFIG.venue.PACKAGES_STUB?.tiers || []).find((t) => t.id === tier);
  const priceTry = upgrade.request?.price_try ?? packagePrice(tierDef?.price_try, upgrade.venue);

  const inserted = await pool.query(
    `INSERT INTO venue_package_requests (venue_id, requested_by, from_tier, to_tier, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, venue_id, from_tier, to_tier, status, stripe_session_id, note, created_at, updated_at`,
    [
      venueId,
      userId,
      resolveTierFromVenue(upgrade.venue),
      tier,
      note ? String(note).trim().slice(0, 500) : null,
    ]
  );
  let request = inserted.rows[0];

  if (!isStripeEnabled()) {
    return {
      ...upgrade,
      checkout: {
        mode: 'request',
        payment_provider: null,
        request_id: request.id,
        status: request.status,
        price_try: priceTry,
        message: 'Paket talebin kaydedildi — ekip iletişime geçip aktivasyonu tamamlayacak.',
      },
      package_request: presentPackageRequest(request),
    };
  }

  try {
    const session = await createPackageCheckoutSession({
      tierId: tier,
      tierLabel: tierDef?.label || tier,
      priceTry,
      billing: tierDef?.billing || 'monthly',
      venueId,
      requestId: request.id,
      customerEmail: String(email || '').includes('@') ? email : null,
    });
    const upd = await pool.query(
      `UPDATE venue_package_requests
       SET stripe_session_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, venue_id, from_tier, to_tier, status, stripe_session_id, note, created_at, updated_at`,
      [request.id, session.id]
    );
    request = upd.rows[0] || request;
    return {
      ...upgrade,
      checkout: {
        mode: 'stripe',
        payment_provider: 'stripe',
        request_id: request.id,
        status: request.status,
        price_try: priceTry,
        checkout_url: session.url,
        stripe_session_id: session.id,
        message: 'Ödeme sayfası hazır — ödeme tamamlandığında paket otomatik aktifleşir.',
      },
      package_request: presentPackageRequest(request),
    };
  } catch (error) {
    return {
      ...upgrade,
      checkout: {
        mode: 'request',
        payment_provider: 'stripe',
        request_id: request.id,
        status: request.status,
        price_try: priceTry,
        error: error.message,
        message: 'Ödeme sağlayıcısına ulaşılamadı — talebin kaydedildi, ekip iletişime geçecek.',
      },
      package_request: presentPackageRequest(request),
    };
  }
}

export async function listVenuePackageRequests(venueId, userId, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const r = await pool.query(
    `SELECT id, from_tier, to_tier, status, stripe_session_id, note, created_at, updated_at
     FROM venue_package_requests
     WHERE venue_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [venueId]
  );
  return {
    ok: true,
    payment_enabled: isStripeEnabled(),
    requests: r.rows.map(presentPackageRequest),
  };
}

/** Stripe webhook — ödenmiş Checkout Session paketi aktive eder (idempotent). */
export async function activateVenuePackageFromStripeSession(sessionId) {
  if (!sessionId) return { ok: false, status: 400, error: 'Missing session id' };
  const r = await pool.query(
    `SELECT id, venue_id, to_tier, status FROM venue_package_requests
     WHERE stripe_session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );
  const request = r.rows[0];
  if (!request) return { ok: false, status: 404, error: 'Package request not found for session' };
  if (request.status === 'activated') {
    return {
      ok: true,
      already_activated: true,
      request_id: request.id,
      venue_id: request.venue_id,
      tier: request.to_tier,
    };
  }

  const activated = await activateVenuePackageTier(request.venue_id, request.to_tier);
  if (!activated.ok) return activated;

  return {
    ok: true,
    request_id: request.id,
    venue_id: request.venue_id,
    tier: request.to_tier,
    venue: activated.venue,
    packages: activated.packages,
  };
}

/** Admin / webhook — paket aktivasyonu (ödeme sonrası) */
export async function activateVenuePackageTier(venueId, tierId) {
  const tier = normalizeTierId(tierId);
  const stub = LOCAL_CONFIG.venue.PACKAGES_STUB || {};
  const tierDef = (stub.tiers || []).find((t) => t.id === tier);
  if (!tierDef || tier === 'free') {
    return { ok: false, status: 400, error: 'Invalid package tier' };
  }

  const cur = await pool.query(`SELECT package_stub FROM venues WHERE id = $1`, [venueId]);
  if (cur.rows.length === 0) return { ok: false, status: 404, error: 'Venue not found' };

  const prev = cur.rows[0].package_stub || {};
  const nextStub = {
    ...prev,
    pending_upgrade_tier: null,
    activated_at: new Date().toISOString(),
    activated_tier: tier,
  };

  const proEnabled = tier === 'operator' || tier === 'hakim';
  const cityPartner = tier === 'hakim';

  const upd = await pool.query(
    `UPDATE venues
     SET subscription_tier = $2,
         pro_enabled = $3,
         city_partner_enabled = $4,
         package_stub = $5::jsonb
     WHERE id = $1
     RETURNING *`,
    [venueId, tier, proEnabled, cityPartner, JSON.stringify(nextStub)]
  );

  await pool.query(
    `UPDATE venue_package_requests
     SET status = 'activated', updated_at = NOW()
     WHERE venue_id = $1 AND to_tier = $2 AND status IN ('pending', 'contacted')`,
    [venueId, tier]
  );

  return { ok: true, venue: upd.rows[0], packages: buildPackageCatalog(upd.rows[0]) };
}

export async function requestAddonSlot(venueId, userId, { qty } = {}, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  return purchaseAddonSlot(venueId, { qty });
}

export async function requestTakeover(venueId, userId, { dayType, included } = {}, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const result = await startVenueTakeover(venueId, { dayType, included });
  if (result.ok) {
    try {
      const { notifyVenueTakeover } = await import('./notifications.js');
      const managers = await pool.query(`SELECT user_id FROM venue_managers WHERE venue_id = $1`, [venueId]);
      for (const m of managers.rows) {
        notifyVenueTakeover(m.user_id, {
          venueId,
          until: result.until,
        }).catch(() => {});
      }
    } catch (_e) {
      /* optional notify */
    }
  }
  return result;
}

export async function setFeaturedEventCard(venueId, userId, card, email = '') {
  const allowed = await isVenueManager(userId, venueId, email);
  if (!allowed) return { ok: false, status: 403, error: 'Not allowed' };
  const venue = await pool.query(
    `SELECT subscription_tier, pro_enabled, city_partner_enabled FROM venues WHERE id = $1`,
    [venueId]
  );
  if (!venue.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };
  if (resolveTierFromVenue(venue.rows[0]) !== 'hakim') {
    return { ok: false, status: 403, error: 'Öne çıkan etkinlik kartı HAKİM pakette' };
  }
  const payload =
    card == null
      ? null
      : {
          title: String(card.title || '').slice(0, 120),
          subtitle: card.subtitle ? String(card.subtitle).slice(0, 240) : null,
          ritual_id: card.ritual_id || null,
          image_url: card.image_url || null,
        };
  const upd = await pool.query(
    `UPDATE venues SET featured_event_card = $2::jsonb WHERE id = $1 RETURNING featured_event_card`,
    [venueId, payload ? JSON.stringify(payload) : null]
  );
  return { ok: true, featured_event_card: upd.rows[0].featured_event_card };
}
