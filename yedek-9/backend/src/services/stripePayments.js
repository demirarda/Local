/**
 * Stripe adapter — v3 §8 paket ödemeleri.
 * SDK bağımlılığı yok: Checkout Session REST ile açılır, webhook imzası crypto ile doğrulanır.
 * STRIPE_SECRET_KEY yoksa ödeme kapalı → paket talebi kuyruğa yazılır (venueBusinessService).
 */
import crypto from 'crypto';

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_S = 300;

export function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeReadiness() {
  const secretSet = Boolean(process.env.STRIPE_SECRET_KEY);
  const webhookSecretSet = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const currency = (process.env.STRIPE_CURRENCY || 'try').toLowerCase();
  const prices = {
    operator: Boolean(process.env.STRIPE_PRICE_OPERATOR),
    hakim: Boolean(process.env.STRIPE_PRICE_HAKIM),
  };
  const isProd = process.env.NODE_ENV === 'production';
  return {
    enabled: secretSet,
    secret_set: secretSet,
    webhook_secret_set: webhookSecretSet,
    webhook_required_in_production: isProd,
    production_ready: secretSet && (!isProd || webhookSecretSet),
    currency,
    prices_configured: prices,
    checkout_mode: secretSet ? 'stripe' : 'request_queue',
    note: secretSet
      ? webhookSecretSet
        ? 'Checkout + signed webhook ready'
        : isProd
          ? 'STRIPE_WEBHOOK_SECRET required in production'
          : 'Checkout on; webhook unsigned until STRIPE_WEBHOOK_SECRET set'
      : 'STRIPE_SECRET_KEY unset — package requests queue only',
  };
}

function appendParam(params, value, key) {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => appendParam(params, item, `${key}[${i}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      appendParam(params, v, key ? `${key}[${k}]` : k);
    }
    return;
  }
  params.append(key, String(value));
}

export function toStripeForm(payload) {
  const params = new URLSearchParams();
  appendParam(params, payload, '');
  return params;
}

async function stripePost(path, payload, { idempotencyKey = null } = {}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const err = new Error('STRIPE_SECRET_KEY is not configured');
    err.code = 'STRIPE_DISABLED';
    throw err;
  }
  const headers = {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const resp = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers,
    body: toStripeForm(payload).toString(),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(json?.error?.message || `Stripe ${path} failed (${resp.status})`);
    err.status = resp.status;
    err.code = json?.error?.code || 'STRIPE_ERROR';
    throw err;
  }
  return json;
}

function frontendBase() {
  return process.env.FRONTEND_URL || 'http://localhost:19006';
}

/**
 * Venue paket yükseltmesi için Checkout Session.
 * STRIPE_PRICE_<TIER> tanımlıysa hazır price kullanılır, yoksa price_data inline üretilir.
 */
export async function createPackageCheckoutSession({
  tierId,
  tierLabel = null,
  priceTry = 0,
  billing = 'monthly',
  venueId,
  requestId,
  customerEmail = null,
}) {
  const configuredPrice = process.env[`STRIPE_PRICE_${String(tierId).toUpperCase()}`] || null;
  const recurring = billing === 'monthly';
  const lineItem = configuredPrice
    ? { price: configuredPrice, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || 'try').toLowerCase(),
          unit_amount: Math.round(Number(priceTry || 0) * 100),
          product_data: { name: `LOCAL ${tierLabel || tierId}` },
          ...(recurring ? { recurring: { interval: 'month' } } : {}),
        },
      };

  const session = await stripePost(
    '/checkout/sessions',
    {
      mode: recurring ? 'subscription' : 'payment',
      success_url:
        process.env.STRIPE_SUCCESS_URL ||
        `${frontendBase()}/venue-package/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${frontendBase()}/venue-package/cancel`,
      client_reference_id: requestId,
      customer_email: customerEmail || null,
      line_items: [lineItem],
      metadata: {
        source: 'venue_package',
        venue_id: venueId,
        request_id: requestId,
        tier_id: tierId,
      },
    },
    { idempotencyKey: `venue_package_${requestId}` }
  );

  return {
    id: session.id,
    url: session.url || null,
    status: session.status || null,
    payment_status: session.payment_status || null,
  };
}

function parseSignatureHeader(header) {
  const out = { timestamp: null, signatures: [] };
  for (const part of String(header).split(',')) {
    const [k, v] = part.split('=');
    if (!k || !v) continue;
    if (k.trim() === 't') out.timestamp = v.trim();
    if (k.trim() === 'v1') out.signatures.push(v.trim());
  }
  return out;
}

function timingSafeMatch(expected, candidates) {
  const expectedBuf = Buffer.from(expected, 'utf8');
  return candidates.some((candidate) => {
    const buf = Buffer.from(candidate, 'utf8');
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}

/**
 * STRIPE_WEBHOOK_SECRET varsa imza + zaman toleransı zorunlu.
 * Production'da Stripe açıkken secret yoksa reddet.
 * Dev/test'te secret yoksa verified:false ile geçilebilir.
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeOn = isStripeEnabled();
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd && stripeOn) {
      return { ok: false, verified: false, reason: 'webhook_secret_required_in_production' };
    }
    return { ok: true, verified: false, reason: 'webhook_secret_not_configured' };
  }
  if (!signatureHeader) return { ok: false, verified: false, reason: 'missing_signature' };

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return { ok: false, verified: false, reason: 'malformed_signature' };
  }
  const ageS = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageS) || ageS > SIGNATURE_TOLERANCE_S) {
    return { ok: false, verified: false, reason: 'signature_timestamp_out_of_tolerance' };
  }
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  if (!timingSafeMatch(expected, signatures)) {
    return { ok: false, verified: false, reason: 'signature_mismatch' };
  }
  return { ok: true, verified: true, reason: null };
}

export function parseWebhookEvent(rawBody, signatureHeader) {
  const check = verifyWebhookSignature(rawBody, signatureHeader);
  if (!check.ok) return { ...check, event: null };
  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
  try {
    return { ok: true, verified: check.verified, reason: check.reason, event: JSON.parse(payload) };
  } catch (_e) {
    return { ok: false, verified: check.verified, reason: 'invalid_json', event: null };
  }
}

export default {
  isStripeEnabled,
  getStripeReadiness,
  createPackageCheckoutSession,
  verifyWebhookSignature,
  parseWebhookEvent,
};
