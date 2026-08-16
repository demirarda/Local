/**
 * Identity / KYC API — LOCAL v2 §1
 */
import express from 'express';
import { authenticateToken } from './auth.js';
import {
  startIdentityVerification,
  completeIdentityVerification,
  getIdentityStatus,
  handleKycProviderWebhook,
} from '../services/identityService.js';
import {
  getUniversityProfile,
  updateUniversityProfile,
  createOfficialEvent,
} from '../services/universityProfileService.js';
import { t } from '../i18n/stringTable.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getKycLiveReadiness } from '../services/kycProvider.js';

const router = express.Router();

router.get('/status', authenticateToken, async (req, res) => {
  const result = await getIdentityStatus(req.user.userId);
  if (!result.ok) return res.status(result.status || 500).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.data });
});

router.get('/culture-lines', async (req, res) => {
  const lang = String(req.query.lang || 'tr').toLowerCase() === 'en' ? 'en' : 'tr';
  const keys = LOCAL_CONFIG.identity?.CULTURE_LINES || ['culture_id_1', 'culture_id_2', 'culture_id_3'];
  return res.json({
    success: true,
    data: {
      keys,
      lines: keys.map((key) => ({ key, text: t(key, lang) })),
    },
  });
});

/** Launch acceptance snapshot — stub KYC OK; canlı provider env ile */
router.get('/acceptance', authenticateToken, async (_req, res) => {
  const { getIdentityAcceptance } = await import('../services/identityAcceptance.js');
  return res.json({ success: true, data: getIdentityAcceptance() });
});

router.get('/live-readiness', authenticateToken, async (_req, res) => {
  return res.json({ success: true, data: getKycLiveReadiness() });
});

/**
 * Vendor async callback — no auth token; HMAC signature required when secret set.
 * Prefer raw body mount in index.js for signature integrity.
 */
router.post('/kyc-webhook', async (req, res) => {
  const signature =
    req.headers['x-kyc-signature'] ||
    req.headers['x-local-kyc-signature'] ||
    req.headers['x-techsign-signature'] ||
    req.headers['x-ihs-signature'] ||
    '';
  const providerHint = req.query.provider || req.headers['x-kyc-provider'] || process.env.KYC_PROVIDER;
  let rawBody = req.body;
  if (Buffer.isBuffer(rawBody)) {
    rawBody = rawBody.toString('utf8');
  } else if (typeof rawBody === 'object' && rawBody != null) {
    rawBody = JSON.stringify(rawBody);
  } else {
    rawBody = String(rawBody || '');
  }
  const result = await handleKycProviderWebhook({
    rawBody,
    signatureHeader: signature,
    providerHint,
  });
  if (!result.ok) {
    return res.status(result.status || 400).json({
      success: false,
      error: result.error,
      code: result.code,
    });
  }
  return res.json({ success: true, data: result.data });
});

router.get('/university-profile', authenticateToken, async (req, res) => {
  const result = await getUniversityProfile(req.query.name, req.user.userId);
  if (!result.ok) return res.status(result.status || 500).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.data });
});

router.patch('/university-profile', authenticateToken, async (req, res) => {
  const result = await updateUniversityProfile(req.body?.name || req.query.name, req.user.userId, req.body);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.json({ success: true, data: result.university });
});

router.post('/university-profile/events', authenticateToken, async (req, res) => {
  const result = await createOfficialEvent(req.body?.name || req.query.name, req.user.userId, req.body);
  if (!result.ok) return res.status(result.status || 400).json({ success: false, error: result.error });
  return res.status(201).json({ success: true, data: result.event });
});

router.post('/start', authenticateToken, async (req, res) => {
  const { document_type, track } = req.body || {};
  const result = await startIdentityVerification(req.user.userId, {
    documentType: document_type,
    track: track || 'identity',
  });
  if (!result.ok) return res.status(result.status || 500).json({ success: false, error: result.error, code: result.code });
  return res.json({ success: true, data: result.data });
});

router.post('/complete', authenticateToken, async (req, res) => {
  const body = req.body || {};
  // Doğrula-ve-at: ham görüntü/biyometri asla kabul edilmez
  const forbiddenMediaKeys = [
    'card_image',
    'selfie',
    'selfie_image',
    'image',
    'photo',
    'media',
    'biometric',
    'face_scan',
    'nfc_raw_bytes',
  ];
  const leaked = forbiddenMediaKeys.filter((k) => body[k] != null && body[k] !== '');
  if (leaked.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'raw_media_not_accepted',
      code: 'PII_MEDIA_REJECTED',
      detail: 'Verify-and-discard: images/biometrics are never stored or uploaded',
    });
  }

  const {
    verification_id,
    nfc_payload,
    liveness_ok,
    face_match_ok,
    age_years,
    path,
    document_number_hint,
  } = body;
  if (!verification_id) {
    return res.status(400).json({ success: false, error: 'verification_id required' });
  }
  const result = await completeIdentityVerification(req.user.userId, {
    verificationId: verification_id,
    nfcPayload: nfc_payload,
    livenessOk: liveness_ok !== false,
    faceMatchOk: face_match_ok !== false,
    ageYears: age_years ?? 18,
    path: path || 'nfc',
    documentNumberHint: document_number_hint || null,
  });
  if (!result.ok) {
    return res.status(result.status || 500).json({
      success: false,
      error: result.error,
      code: result.code || result.error,
      data: result.data
        ? {
            // never echo provider internals that could leak PII
            provider_status: result.data.provider_status,
            error_code: result.data.error_code,
            pii_retained: false,
          }
        : undefined,
    });
  }
  return res.json({
    success: true,
    data: {
      verified: true,
      age_ok: true,
      identity_hash_stored: true,
      pii_retained: false,
      name_locked: true,
    },
  });
});

export default router;
