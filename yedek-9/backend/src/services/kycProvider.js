/**
 * KYC provider adapter — LOCAL v2 §1
 * Ham biyometri bizde saklanmaz. Provider KYC_PROVIDER env (stub|techsign|ihs) ile,
 * env yoksa identity.ACTIVE_PROVIDER ile seçilir.
 *
 * Techsign/İHS: BASE_URL + API_KEY yoksa contract-pending (PASS_STUB mantığı).
 * Anahtarlar set ise canlı HTTP (kycLiveClient) — sahte "live" yok.
 */
import crypto from 'crypto';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  isLiveConfigured,
  liveStartSession,
  liveCompleteSession,
  getLiveReadiness,
} from './kycLiveClient.js';

/** Reject accidental client uploads of raw image / base64 blobs as "identity material". */
export function looksLikeRawMediaBlob(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (s.length > 512) return true;
  if (/^data:image\//i.test(s)) return true;
  if (/^https?:\/\//i.test(s) && /\.(jpg|jpeg|png|webp|heic)(\?|$)/i.test(s)) return true;
  return false;
}

/** KYC_PROVIDER env > config; bilinmeyen değer stub'a düşer. */
export function getActiveKycProviderName() {
  const allowed = LOCAL_CONFIG.identity?.PROVIDERS || ['stub', 'techsign', 'ihs'];
  const requested = String(
    process.env.KYC_PROVIDER || LOCAL_CONFIG.identity?.ACTIVE_PROVIDER || 'stub'
  )
    .trim()
    .toLowerCase();
  return allowed.includes(requested) ? requested : 'stub';
}

export function getActiveKycProvider() {
  const name = getActiveKycProviderName();
  if (name === 'techsign') return resolveVendorProvider('techsign');
  if (name === 'ihs') return resolveVendorProvider('ihs');
  return stubProvider;
}

function sessionBase({ userId, documentType }) {
  const id = LOCAL_CONFIG.identity || {};
  return {
    session_id: `kyc_${userId}_${Date.now()}`,
    document_type: documentType || 'TCKK',
    nfc_required: id.NFC_PRIMARY !== false,
    gallery_upload_allowed: id.GALLERY_UPLOAD_ALLOWED === true,
    target_seconds: id.TARGET_S ?? 60,
    culture_lines: [...(id.CULTURE_LINES || [])],
    liveness_passive_seconds: id.LIVENESS_PASSIVE_S ?? 3,
    supported_documents: [...(id.DOCUMENTS || ['TCKK', 'PASSPORT', 'EU_ID'])],
    paths: {
      primary: 'nfc',
      fallback: id.FALLBACK_PATH || 'card_photo_selfie',
    },
    /** Never surface provider stub label to end users */
    show_provider_banner: false,
    launch_path: 'PASS_STUB',
  };
}

const stubProvider = {
  id: 'stub',
  async startSession(args) {
    return {
      provider: 'stub',
      stub: true,
      show_provider_banner: false,
      ...sessionBase(args),
    };
  },
  async completeSession({
    sessionId,
    nfcPayload,
    livenessOk,
    faceMatchOk,
    ageYears,
    path = 'nfc',
    documentType = 'TCKK',
    documentNumberHint = null,
    userId,
  }) {
    void sessionId;
    void userId;
    if (looksLikeRawMediaBlob(nfcPayload) || looksLikeRawMediaBlob(documentNumberHint)) {
      return {
        ok: false,
        age_ok: false,
        identity_hash: null,
        path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
        provider_status: 'failed',
        error_code: 'PII_MEDIA_REJECTED',
        pii_retained: false,
      };
    }
    const ok = Boolean(livenessOk && faceMatchOk);
    // Stable durable material only — reject ephemeral / user-scoped fallbacks
    const durable = String(documentNumberHint || nfcPayload || '').trim();
    if (durable.length < 6) {
      return {
        ok: false,
        age_ok: false,
        identity_hash: null,
        path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
        provider_status: 'failed',
        error_code: 'DURABLE_IDENTITY_REQUIRED',
        pii_retained: false,
      };
    }
    const raw = `local-id-v1|${documentType}|${durable.toLowerCase()}`;
    const identity_hash = crypto.createHash('sha256').update(raw).digest('hex');
    return {
      ok,
      age_ok: Number(ageYears || 18) >= 18,
      identity_hash,
      path: path === 'fallback' ? 'card_photo_selfie' : 'nfc',
      provider_status: ok ? 'verified' : 'failed',
      error_code: ok ? null : 'LIVENESS_OR_FACE_MATCH_FAILED',
      pii_retained: false,
      provider: 'stub',
    };
  },
};

/** Anahtar yok: stub doğrulama + contract_status (PASS_STUB). */
function contractPendingProvider(id) {
  return {
    id,
    mode: 'contract_pending',
    async startSession(args) {
      const base = await stubProvider.startSession(args);
      return {
        ...base,
        provider: id,
        stub: true,
        show_provider_banner: false,
        contract_status: 'launch_accepted',
        live_ready: false,
      };
    },
    async completeSession(args) {
      const r = await stubProvider.completeSession(args);
      return {
        ...r,
        provider: id,
        contract_status: 'launch_accepted',
        pii_retained: false,
        live: false,
      };
    },
  };
}

/** Anahtar var: gerçek HTTP start/complete. */
function liveHttpProvider(id) {
  return {
    id,
    mode: 'live',
    async startSession(args) {
      const base = sessionBase(args);
      const live = await liveStartSession(id, {
        userId: args.userId,
        documentType: args.documentType,
        callbackUrl: process.env.KYC_WEBHOOK_PUBLIC_URL || null,
      });
      if (!live.ok) {
        // Fail closed to contract-pending rather than inventing verification
        const fallback = await contractPendingProvider(id).startSession(args);
        return {
          ...fallback,
          contract_status: 'live_start_failed',
          live_error: live.error_code,
          note: 'provider_unreachable_fallback_stub',
        };
      }
      return {
        ...base,
        session_id: live.session_id,
        provider: id,
        stub: false,
        show_provider_banner: false,
        contract_status: 'live',
        live_ready: true,
        launch_path: 'LIVE',
        client_token: live.client_token,
        expires_at: live.expires_at,
        ...live.provider_payload,
      };
    },
    async completeSession(args) {
      if (looksLikeRawMediaBlob(args.nfcPayload) || looksLikeRawMediaBlob(args.documentNumberHint)) {
        return {
          ok: false,
          age_ok: false,
          identity_hash: null,
          path: args.path === 'fallback' ? 'card_photo_selfie' : 'nfc',
          provider_status: 'failed',
          error_code: 'PII_MEDIA_REJECTED',
          pii_retained: false,
          live: true,
          provider: id,
        };
      }
      const r = await liveCompleteSession(id, args);
      return {
        ...r,
        provider: id,
        contract_status: 'live',
        pii_retained: false,
      };
    },
  };
}

function resolveVendorProvider(id) {
  if (isLiveConfigured(id)) return liveHttpProvider(id);
  return contractPendingProvider(id);
}

export function getKycLiveReadiness() {
  const active = getActiveKycProviderName();
  const readiness = getLiveReadiness();
  return {
    active_provider: active,
    live_mode: active !== 'stub' && isLiveConfigured(active),
    vendors: readiness,
  };
}

export default {
  getActiveKycProvider,
  getActiveKycProviderName,
  looksLikeRawMediaBlob,
  getKycLiveReadiness,
};
