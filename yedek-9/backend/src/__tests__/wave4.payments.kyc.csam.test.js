import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isStripeEnabled, toStripeForm, parseWebhookEvent, getStripeReadiness } from '../services/stripePayments.js';
import { getActiveKycProviderName, getActiveKycProvider } from '../services/kycProvider.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import {
  getCsamReadiness,
  runCsamScan,
  isCsamHoldStatus,
  csamPublicVisibilitySql,
} from '../services/csamScanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function signPayload(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Stripe paket ödemesi (§8)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('STRIPE_SECRET_KEY yoksa ödeme kapalı', () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeEnabled()).toBe(false);
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(isStripeEnabled()).toBe(true);
  });

  test('form encode nested line_items / metadata', () => {
    const form = toStripeForm({
      mode: 'subscription',
      line_items: [{ quantity: 1, price_data: { currency: 'try', unit_amount: 790000 } }],
      metadata: { venue_id: 'v1' },
      customer_email: null,
    }).toString();
    expect(form).toContain('line_items%5B0%5D%5Bquantity%5D=1');
    expect(form).toContain('line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=try');
    expect(form).toContain('metadata%5Bvenue_id%5D=v1');
    expect(form).not.toContain('customer_email');
  });

  test('webhook imzası doğrulanır, kurcalanmış gövde reddedilir', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } });

    const good = parseWebhookEvent(body, signPayload(body, 'whsec_test'));
    expect(good.ok).toBe(true);
    expect(good.verified).toBe(true);
    expect(good.event.data.object.id).toBe('cs_1');

    const tampered = parseWebhookEvent(`${body} `, signPayload(body, 'whsec_test'));
    expect(tampered.ok).toBe(false);
    expect(tampered.reason).toBe('signature_mismatch');

    const stale = parseWebhookEvent(
      body,
      signPayload(body, 'whsec_test', Math.floor(Date.now() / 1000) - 3600)
    );
    expect(stale.ok).toBe(false);
    expect(stale.reason).toBe('signature_timestamp_out_of_tolerance');
  });

  test('secret yoksa event işlenir ama verified=false', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const parsed = parseWebhookEvent(JSON.stringify({ type: 'ping' }), null);
    expect(parsed.ok).toBe(true);
    expect(parsed.verified).toBe(false);
  });

  test('checkout servisi stub değil: talep satırı + webhook aktivasyonu', () => {
    const src = readFileSync(join(__dirname, '../services/venueBusinessService.js'), 'utf8');
    expect(src).toMatch(/INSERT INTO venue_package_requests/);
    expect(src).toMatch(/activateVenuePackageFromStripeSession/);
    expect(src).not.toMatch(/request_only/);

    const api = readFileSync(join(__dirname, '../api/venues.js'), 'utf8');
    expect(api).toMatch(/business\/package-requests/);
    expect(api).toMatch(/stripe-webhook/);
    expect(api).toMatch(/payment-readiness/);
  });

  test('getStripeReadiness + publicConfig stripe_enabled env ile', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const off = getStripeReadiness();
    expect(off.enabled).toBe(false);
    expect(off.checkout_mode).toBe('request_queue');
    expect(getPublicConfig().stubs.venue_payment.stripe_enabled).toBe(false);
    expect(getPublicConfig().stubs.venue_payment.checkout_mode).toBe('request_queue');

    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    const on = getStripeReadiness();
    expect(on.enabled).toBe(true);
    expect(on.checkout_mode).toBe('stripe');
    expect(getPublicConfig().stubs.venue_payment.stripe_enabled).toBe(true);
    expect(getPublicConfig().stubs.venue_payment.checkout_mode).toBe('stripe');
  });

  test('production + stripe açıkken webhook secret zorunlu', () => {
    const prevNode = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_live_x';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const parsed = parseWebhookEvent(JSON.stringify({ type: 'ping' }), null);
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe('webhook_secret_required_in_production');
    process.env.NODE_ENV = prevNode;
  });
});

describe('KYC provider seçimi (§1)', () => {
  const originalProvider = process.env.KYC_PROVIDER;

  afterEach(() => {
    if (originalProvider == null) delete process.env.KYC_PROVIDER;
    else process.env.KYC_PROVIDER = originalProvider;
  });

  test('KYC_PROVIDER env config üzerine geçer, bilinmeyen değer stub olur', () => {
    delete process.env.KYC_PROVIDER;
    expect(getActiveKycProviderName()).toBe(LOCAL_CONFIG.identity.ACTIVE_PROVIDER);

    process.env.KYC_PROVIDER = 'techsign';
    expect(getActiveKycProviderName()).toBe('techsign');
    expect(getActiveKycProvider().id).toBe('techsign');

    process.env.KYC_PROVIDER = 'bogus';
    expect(getActiveKycProviderName()).toBe('stub');
  });

  test('stub oturumu provider bildirir, UI banner istemez', async () => {
    delete process.env.KYC_PROVIDER;
    const session = await getActiveKycProvider().startSession({ userId: 'u1', documentType: 'TCKK' });
    expect(session.provider).toBe('stub');
    expect(session.show_provider_banner).toBe(false);
  });

  test('techsign anahtarsız contract_pending; anahtarlı live mode', async () => {
    const {
      isLiveConfigured,
      verifyKycWebhookSignature,
      liveCompleteSession,
    } = await import('../services/kycLiveClient.js');
    const { getKycLiveReadiness } = await import('../services/kycProvider.js');

    delete process.env.KYC_TECHSIGN_BASE_URL;
    delete process.env.KYC_TECHSIGN_API_KEY;
    process.env.KYC_PROVIDER = 'techsign';
    expect(isLiveConfigured('techsign')).toBe(false);
    expect(getActiveKycProvider().mode).toBe('contract_pending');
    expect(getKycLiveReadiness().live_mode).toBe(false);

    process.env.KYC_TECHSIGN_BASE_URL = 'https://kyc.test';
    process.env.KYC_TECHSIGN_API_KEY = 'test-key';
    expect(isLiveConfigured('techsign')).toBe(true);
    expect(getActiveKycProvider().mode).toBe('live');
    expect(getKycLiveReadiness().live_mode).toBe(true);

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'verified',
          durable_identity_material: 'opaque-doc-token-abc123',
          age_ok: true,
          liveness_ok: true,
          face_match_ok: true,
        }),
    });
    try {
      const r = await liveCompleteSession('techsign', {
        sessionId: 'sess_1',
        documentType: 'TCKK',
        documentNumberHint: 'opaque-doc-token-abc123',
        livenessOk: true,
        faceMatchOk: true,
        ageYears: 25,
      });
      expect(r.ok).toBe(true);
      expect(r.live).toBe(true);
      expect(r.identity_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(r.pii_retained).toBe(false);
    } finally {
      global.fetch = originalFetch;
      delete process.env.KYC_TECHSIGN_BASE_URL;
      delete process.env.KYC_TECHSIGN_API_KEY;
    }

    const secret = 'whsec_test';
    const body = '{"session_id":"s1","status":"verified"}';
    const crypto = await import('crypto');
    const good = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyKycWebhookSignature(body, good, secret).ok).toBe(true);
    expect(verifyKycWebhookSignature(body, 'bad', secret).ok).toBe(false);
  });

  test('KYC ekranında stub banner yok', () => {
    const ui = readFileSync(
      join(__dirname, '../../../mobile/src/screens/OnboardingIdentityKycScreen.js'),
      'utf8'
    );
    expect(ui).not.toMatch(/stubBanner/);
    expect(ui).not.toMatch(/Stub dogrulama/);
    expect(ui).toMatch(/cameraFrame/);
    expect(ui).toMatch(/NFC/);
  });
});

describe('Public CSAM taraması fail-closed (§5)', () => {
  test('CIRCLE/CITY sağlayıcısız geçmez, WINDOW geçer', () => {
    const src = readFileSync(join(__dirname, '../services/modEngine.js'), 'utf8');
    const scanFn = src.slice(
      src.indexOf('const PUBLIC_SCAN_AUDIENCES'),
      src.indexOf('export async function evaluateSilentExitPattern')
    );
    expect(scanFn).toMatch(/PUBLIC_SCAN_AUDIENCES = new Set\(\['CIRCLE', 'CITY'/);
    expect(scanFn).toMatch(/pending_review/);
    expect(scanFn).toMatch(/window_pass/);
    expect(scanFn).toMatch(/enqueuePublicMediaOpsReview/);
    expect(scanFn).toMatch(/queueLane: 'ops'/);
    expect(scanFn).toMatch(/runCsamScan/);
    expect(scanFn).not.toMatch(/stub_pass/);
  });

  test('memories publish yolları audience geçirir', () => {
    const api = readFileSync(join(__dirname, '../api/memories.js'), 'utf8');
    const calls = api.match(/scanPublicMedia\(\{[\s\S]*?\}\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      expect(call).toMatch(/audience:/);
    }
    expect(api).toMatch(/csam_scan_status/);
  });

  test('csam ürün fail-closed + hold SQL', () => {
    expect(LOCAL_CONFIG.open.csam_status).toBe('ops_review_fallback');
    expect(LOCAL_CONFIG.open.csam_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.csam_hold_enforced).toBe(true);
    expect(isCsamHoldStatus('pending_review')).toBe(true);
    expect(isCsamHoldStatus('clear')).toBe(false);
    expect(csamPublicVisibilitySql('$2')).toMatch(/csam_scan_status/);
    const ready = getCsamReadiness();
    expect(ready.hold_enforced).toBe(true);
    expect(ready.status).toBe('ops_review_fallback');
    expect(getPublicConfig().stubs.csam.hold_enforced).toBe(true);
  });

  test('runCsamScan webhook yoksa hold; webhook temizse clear', async () => {
    delete process.env.CSAM_SCAN_WEBHOOK_URL;
    delete process.env.CSAM_PROVIDER;
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
    const held = await runCsamScan({ contentUrl: 'https://x.test/a.jpg', audience: 'CITY' });
    expect(held.hold_public).toBe(true);
    expect(held.status).toBe('pending_review');

    process.env.CSAM_SCAN_WEBHOOK_URL = 'https://scanner.test/scan';
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ flagged: false, confidence: 0.1, labels: [] }),
    });
    try {
      const ok = await runCsamScan({ contentUrl: 'https://x.test/a.jpg', audience: 'CITY' });
      expect(ok.ok).toBe(true);
      expect(ok.flagged).toBe(false);
      expect(ok.status).toBe('clear');
      expect(ok.hold_public).toBe(false);
    } finally {
      global.fetch = originalFetch;
      delete process.env.CSAM_SCAN_WEBHOOK_URL;
    }
  });
});
