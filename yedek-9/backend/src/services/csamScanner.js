/**
 * CSAM / nudity public-media scanner — LOCAL v2 §5
 * Generic webhook OR Sightengine. No credentials → ops_review_fallback (fail-closed for public).
 */
import LOCAL_CONFIG from '../config/localConfig.js';

/** Statuses that may appear in CITY/CIRCLE/PULSE feeds (non-author). */
export const CSAM_FEED_CLEAR_STATUSES = new Set([
  'clear',
  'provider_scanned',
  'window_pass',
]);

/** Statuses that hold public visibility. */
export const CSAM_HOLD_STATUSES = new Set([
  'pending_review',
  'provider_error',
  'flagged',
]);

export function isCsamHoldStatus(status) {
  return CSAM_HOLD_STATUSES.has(String(status || ''));
}

export function isCsamFeedClearStatus(status) {
  if (status == null || status === '') return true; // legacy unscanned window / pre-column
  return CSAM_FEED_CLEAR_STATUSES.has(String(status));
}

/**
 * SQL fragment: public scopes hide held scans unless viewer is author.
 * Alias `m` = memories. Params: viewerUserIdParam e.g. `$2`
 */
export function csamPublicVisibilitySql(viewerUserIdParam = '$2') {
  return `(
    m.user_id = ${viewerUserIdParam}
    OR COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
  )`;
}

export function resolveCsamProviderName() {
  const env = String(process.env.CSAM_PROVIDER || '').trim().toLowerCase();
  if (env === 'sightengine') return 'sightengine';
  if (env === 'webhook' || env === 'generic') return 'webhook';
  if (process.env.CSAM_SCAN_WEBHOOK_URL) return 'webhook';
  if (process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET) return 'sightengine';
  return LOCAL_CONFIG.open?.csam_provider || null;
}

export function isCsamLiveConfigured() {
  const name = resolveCsamProviderName();
  if (name === 'sightengine') {
    return Boolean(process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET);
  }
  if (name === 'webhook') {
    return Boolean(process.env.CSAM_SCAN_WEBHOOK_URL);
  }
  return Boolean(process.env.CSAM_SCAN_WEBHOOK_URL);
}

export function getCsamReadiness() {
  const provider = resolveCsamProviderName();
  const live = isCsamLiveConfigured();
  const webhookSet = Boolean(process.env.CSAM_SCAN_WEBHOOK_URL);
  const sightengineSet = Boolean(
    process.env.SIGHTENGINE_API_USER && process.env.SIGHTENGINE_API_SECRET
  );
  return {
    provider,
    live,
    status: live ? 'live' : 'ops_review_fallback',
    webhook_url_set: webhookSet,
    sightengine_set: sightengineSet,
    hold_enforced: true,
    note: live
      ? `Scanner live via ${provider}`
      : 'No scanner credentials — public media held + ops queue',
  };
}

function timeoutMs() {
  const n = Number(process.env.CSAM_SCAN_TIMEOUT_MS || 8000);
  return Number.isFinite(n) && n > 500 ? n : 8000;
}

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function scanViaWebhook({ contentUrl, memoryId, audience, provider }) {
  const webhook = process.env.CSAM_SCAN_WEBHOOK_URL;
  if (!webhook) {
    return { ok: false, status: 'provider_error', flagged: false, error: 'webhook_missing' };
  }
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const apiKey = String(process.env.CSAM_SCAN_API_KEY || '').trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const resp = await fetchWithTimeout(webhook, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider,
      content_url: contentUrl,
      memory_id: memoryId || null,
      audience,
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false,
      status: 'provider_error',
      flagged: false,
      labels: [],
      confidence: 0,
      error: json?.error || `http_${resp.status}`,
    };
  }
  return {
    ok: true,
    status: 'provider_scanned',
    flagged: Boolean(json?.flagged),
    labels: Array.isArray(json?.labels) ? json.labels : [],
    confidence: Number(json?.confidence || 0),
  };
}

/**
 * Sightengine check.json — nudity + offensive. Maps to LOCAL flagged contract.
 * Docs: https://sightengine.com/docs/reference
 */
async function scanViaSightengine({ contentUrl }) {
  const user = process.env.SIGHTENGINE_API_USER;
  const secret = process.env.SIGHTENGINE_API_SECRET;
  if (!user || !secret) {
    return { ok: false, status: 'provider_error', flagged: false, error: 'sightengine_credentials_missing' };
  }
  if (!contentUrl) {
    return { ok: false, status: 'provider_error', flagged: false, error: 'content_url_required' };
  }

  const params = new URLSearchParams({
    url: contentUrl,
    models: 'nudity-2.1,offensive',
    api_user: user,
    api_secret: secret,
  });
  const resp = await fetchWithTimeout(`https://api.sightengine.com/1.0/check.json?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.status === 'failure') {
    return {
      ok: false,
      status: 'provider_error',
      flagged: false,
      labels: [],
      confidence: 0,
      error: json?.error?.message || `http_${resp.status}`,
    };
  }

  const nudity = json?.nudity || {};
  const sexual =
    Number(nudity.sexual_activity || 0) ||
    Number(nudity.sexual_display || 0) ||
    Number(nudity.erotica || 0);
  const offensive = Number(json?.offensive?.prob || 0);
  const threshold = Number(process.env.CSAM_FLAG_THRESHOLD || 0.5);
  const flagged = sexual >= threshold || offensive >= threshold;
  const labels = [];
  if (sexual >= threshold) labels.push('nudity');
  if (offensive >= threshold) labels.push('offensive');

  return {
    ok: true,
    status: flagged ? 'flagged' : 'clear',
    flagged,
    labels,
    confidence: Math.max(sexual, offensive),
  };
}

/**
 * Call active scanner. Returns LOCAL result shape (never throws).
 */
export async function runCsamScan({ contentUrl = null, memoryId = null, audience = 'CITY' } = {}) {
  const provider = resolveCsamProviderName();
  if (!isCsamLiveConfigured()) {
    return {
      ok: false,
      status: 'pending_review',
      flagged: false,
      labels: [],
      confidence: 0,
      provider: null,
      hold_public: true,
    };
  }

  try {
    let result;
    if (provider === 'sightengine') {
      result = await scanViaSightengine({ contentUrl });
    } else {
      result = await scanViaWebhook({ contentUrl, memoryId, audience, provider });
      // Webhook clean scan → clear; flagged stays flagged
      if (result.ok && !result.flagged) {
        result.status = 'clear';
      } else if (result.ok && result.flagged) {
        result.status = 'flagged';
      }
    }
    return {
      ...result,
      provider,
      hold_public: Boolean(result.flagged || !result.ok || isCsamHoldStatus(result.status)),
    };
  } catch (_e) {
    return {
      ok: false,
      status: 'provider_error',
      flagged: false,
      labels: [],
      confidence: 0,
      provider,
      hold_public: true,
      error: 'scan_exception',
    };
  }
}

export default {
  runCsamScan,
  getCsamReadiness,
  isCsamLiveConfigured,
  csamPublicVisibilitySql,
  isCsamHoldStatus,
  isCsamFeedClearStatus,
  CSAM_FEED_CLEAR_STATUSES,
  CSAM_HOLD_STATUSES,
};
