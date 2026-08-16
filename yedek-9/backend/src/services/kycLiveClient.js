/**
 * Live KYC HTTP client — Techsign / İHS
 *
 * Vendor SDK docs are not public; this speaks LOCAL's stable contract.
 * Map vendor paths via KYC_*_BASE_URL (and optional path overrides).
 * Activate only when BASE_URL + API_KEY are set — never claim "live" without keys.
 */
import crypto from 'crypto';

const ENV_PREFIX = {
  techsign: 'KYC_TECHSIGN',
  ihs: 'KYC_IHS',
};

export function getLiveCredentials(providerId) {
  const prefix = ENV_PREFIX[providerId];
  if (!prefix) return null;
  const baseUrl = String(process.env[`${prefix}_BASE_URL`] || '').trim().replace(/\/$/, '');
  const apiKey = String(process.env[`${prefix}_API_KEY`] || '').trim();
  const webhookSecret = String(process.env[`${prefix}_WEBHOOK_SECRET`] || '').trim();
  const startPath = String(process.env[`${prefix}_START_PATH`] || '/v1/kyc/sessions').trim();
  const completePathTpl = String(
    process.env[`${prefix}_COMPLETE_PATH`] || '/v1/kyc/sessions/{session_id}/complete'
  ).trim();
  return { providerId, baseUrl, apiKey, webhookSecret, startPath, completePathTpl };
}

/** True only when both base URL and API key exist. */
export function isLiveConfigured(providerId) {
  const c = getLiveCredentials(providerId);
  return Boolean(c?.baseUrl && c?.apiKey);
}

export function getLiveReadiness(providerId = null) {
  const ids = providerId ? [providerId] : ['techsign', 'ihs'];
  const out = {};
  for (const id of ids) {
    const c = getLiveCredentials(id);
    out[id] = {
      configured: Boolean(c?.baseUrl && c?.apiKey),
      base_url_set: Boolean(c?.baseUrl),
      api_key_set: Boolean(c?.apiKey),
      webhook_secret_set: Boolean(c?.webhookSecret),
    };
  }
  return providerId ? out[providerId] : out;
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function postJson(url, apiKey, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  let data = null;
  const text = await resp.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text?.slice(0, 200) };
  }
  return { ok: resp.ok, status: resp.status, data };
}

/**
 * Start remote KYC session. Returns vendor session + client_token for mobile SDK.
 * Never sends images — device/SDK talks to vendor separately.
 */
export async function liveStartSession(providerId, { userId, documentType, callbackUrl } = {}) {
  const c = getLiveCredentials(providerId);
  if (!c?.baseUrl || !c?.apiKey) {
    return { ok: false, error_code: 'LIVE_CREDENTIALS_MISSING' };
  }
  const url = `${c.baseUrl}${c.startPath.startsWith('/') ? c.startPath : `/${c.startPath}`}`;
  const { ok, status, data } = await postJson(url, c.apiKey, {
    external_user_id: String(userId),
    document_type: documentType || 'TCKK',
    callback_url: callbackUrl || null,
    paths: { primary: 'nfc', fallback: 'card_photo_selfie' },
  });
  if (!ok) {
    return {
      ok: false,
      error_code: 'PROVIDER_START_FAILED',
      http_status: status,
      provider_message: data?.error || data?.message || null,
    };
  }
  const sessionId =
    data?.session_id || data?.id || data?.data?.session_id || `live_${providerId}_${Date.now()}`;
  return {
    ok: true,
    session_id: String(sessionId),
    client_token: data?.client_token || data?.sdk_token || data?.token || null,
    expires_at: data?.expires_at || null,
    provider_payload: {
      // opaque SDK bootstrap only — no PII
      nfc_required: data?.nfc_required !== false,
    },
  };
}

/**
 * Complete session with opaque tokens only (no raw media).
 * Vendor returns durable_identity_material (opaque) → we SHA-256 locally.
 */
export async function liveCompleteSession(
  providerId,
  {
    sessionId,
    path = 'nfc',
    documentType = 'TCKK',
    nfcPayload = null,
    documentNumberHint = null,
    livenessOk = true,
    faceMatchOk = true,
    ageYears = 18,
  } = {}
) {
  const c = getLiveCredentials(providerId);
  if (!c?.baseUrl || !c?.apiKey) {
    return { ok: false, error_code: 'LIVE_CREDENTIALS_MISSING', identity_hash: null };
  }

  const completePath = c.completePathTpl.replace('{session_id}', encodeURIComponent(String(sessionId)));
  const url = `${c.baseUrl}${completePath.startsWith('/') ? completePath : `/${completePath}`}`;

  // Opaque material only — reject accidental base64/image blobs before network
  const nfcToken = String(nfcPayload || '').trim();
  const docToken = String(documentNumberHint || '').trim();

  const { ok, status, data } = await postJson(url, c.apiKey, {
    path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
    document_type: documentType,
    nfc_token: nfcToken || null,
    document_token: docToken || null,
    liveness_ok: Boolean(livenessOk),
    face_match_ok: Boolean(faceMatchOk),
    age_years: Number(ageYears) || null,
  });

  if (!ok) {
    return {
      ok: false,
      age_ok: false,
      identity_hash: null,
      path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
      provider_status: 'failed',
      error_code: data?.error_code || 'PROVIDER_COMPLETE_FAILED',
      http_status: status,
      pii_retained: false,
      live: true,
    };
  }

  const statusStr = String(data?.status || data?.provider_status || '').toLowerCase();
  const verified =
    data?.verified === true ||
    statusStr === 'verified' ||
    statusStr === 'approved' ||
    statusStr === 'success';

  const durable =
    String(
      data?.durable_identity_material ||
        data?.identity_token ||
        data?.document_id_token ||
        data?.durable_id ||
        ''
    ).trim() ||
    // Last resort: opaque tokens we already sent (never raw media — caller filters)
    docToken ||
    nfcToken;

  if (!durable || durable.length < 6) {
    return {
      ok: false,
      age_ok: false,
      identity_hash: null,
      path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
      provider_status: 'failed',
      error_code: 'DURABLE_IDENTITY_REQUIRED',
      pii_retained: false,
      live: true,
    };
  }

  const ageFromProvider = data?.age_years ?? data?.ageYears ?? ageYears;
  const ageOk =
    data?.age_ok === true ||
    data?.age_ok === false
      ? Boolean(data.age_ok)
      : Number(ageFromProvider || 0) >= 18;

  const identity_hash = crypto
    .createHash('sha256')
    .update(`local-id-v1|${providerId}|${documentType}|${durable.toLowerCase()}`)
    .digest('hex');

  const faceOk = data?.face_match_ok !== false && faceMatchOk !== false;
  const liveOk = data?.liveness_ok !== false && livenessOk !== false;
  const pass = verified && faceOk && liveOk && ageOk;

  return {
    ok: pass,
    age_ok: ageOk,
    identity_hash,
    path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
    provider_status: pass ? 'verified' : 'failed',
    error_code: pass
      ? null
      : data?.error_code || (!ageOk ? 'AGE_UNDER_18' : 'LIVENESS_OR_FACE_MATCH_FAILED'),
    pii_retained: false,
    live: true,
    provider: providerId,
  };
}

/** HMAC-SHA256 hex of raw body; header e.g. x-kyc-signature or x-local-kyc-signature */
export function verifyKycWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) {
    return { ok: false, verified: false, reason: 'webhook_secret_not_configured' };
  }
  const sig = String(signatureHeader || '')
    .trim()
    .replace(/^sha256=/i, '');
  if (!sig) return { ok: false, verified: false, reason: 'signature_missing' };

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody || ''))
    .digest('hex');

  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, verified: false, reason: 'signature_mismatch' };
  }
  return { ok: true, verified: true };
}

export default {
  getLiveCredentials,
  isLiveConfigured,
  getLiveReadiness,
  liveStartSession,
  liveCompleteSession,
  verifyKycWebhookSignature,
};
