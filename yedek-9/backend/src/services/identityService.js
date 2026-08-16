/**
 * Identity verification service — LOCAL v2 §1
 * Doğrula-ve-at: ham kimlik/biyometri saklanmaz.
 * Bizde kalan: identity_verified · age_ok · identity_hash (PII'siz, ayrı tablo).
 */
import crypto from 'crypto';
import pool from '../config/database.js';
import { getActiveKycProvider, looksLikeRawMediaBlob } from './kycProvider.js';
import { getLiveCredentials, verifyKycWebhookSignature } from './kycLiveClient.js';
import { identityStatusPayload } from '../utils/identityPresentation.js';

const ALLOWED_DOCS = new Set(['TCKK', 'PASSPORT', 'EU_ID']);

/** Track A durable identity material — uni-mail (no raw PII beyond one-way hash) */
export function hashUniversityEmailIdentity(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return crypto.createHash('sha256').update(`local-uni-v1|${normalized}`).digest('hex');
}

export async function bindUniversityIdentityHash(userId, email) {
  const identityHash = hashUniversityEmailIdentity(email);
  if (!identityHash || !userId) return { ok: false };

  const existing = await pool.query(
    `SELECT user_id, blacklisted FROM identity_hashes WHERE identity_hash = $1`,
    [identityHash]
  );
  if (existing.rows[0]?.blacklisted) {
    return { ok: false, error: 'identity_blacklisted' };
  }
  if (existing.rows[0]?.user_id && String(existing.rows[0].user_id) !== String(userId)) {
    return { ok: false, error: 'identity_already_registered' };
  }

  await pool.query(
    `INSERT INTO identity_hashes (identity_hash, user_id)
     VALUES ($1, $2)
     ON CONFLICT (identity_hash) DO UPDATE
       SET user_id = COALESCE(identity_hashes.user_id, EXCLUDED.user_id)`,
    [identityHash, userId]
  );
  return { ok: true, identity_hash: identityHash };
}

export async function startIdentityVerification(userId, { documentType, track } = {}) {
  const doc = String(documentType || 'TCKK').toUpperCase();
  if (!ALLOWED_DOCS.has(doc)) {
    return { ok: false, status: 400, error: 'unsupported_document_type' };
  }

  const existing = await pool.query(
    `SELECT identity_verified FROM users WHERE id = $1`,
    [userId]
  );
  if (existing.rows[0]?.identity_verified) {
    return { ok: false, status: 409, error: 'already_verified', code: 'ONCE_IN_LIFETIME' };
  }

  // Any blacklisted hash for this user OR pending blacklisted session
  const blacklist = await pool.query(
    `SELECT 1 FROM identity_hashes
     WHERE (user_id = $1 OR identity_hash IN (
       SELECT identity_hash FROM identity_verifications
       WHERE user_id = $1 AND identity_hash IS NOT NULL
     )) AND blacklisted = true
     LIMIT 1`,
    [userId]
  );
  if (blacklist.rows.length > 0) {
    return { ok: false, status: 403, error: 'identity_blacklisted', code: 'IDENTITY_BLACKLISTED' };
  }

  const provider = getActiveKycProvider();
  const session = await provider.startSession({ userId, documentType: doc });

  const ins = await pool.query(
    `INSERT INTO identity_verifications (user_id, provider, status, document_type, provider_session_id)
     VALUES ($1, $2, 'pending', $3, $4)
     RETURNING id, status, provider, document_type, provider_session_id, created_at`,
    [userId, session.provider, doc, session.session_id]
  );

  await pool.query(
    `UPDATE users
     SET identity_track = 'identity',
         university = NULL,
         uni_label_visible = false,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  return {
    ok: true,
    data: {
      verification: ins.rows[0],
      session,
      provider: session.provider,
      stub: session.stub !== false,
      note: session.note || null,
      gallery_upload_allowed: session.gallery_upload_allowed === true,
      supported_documents: session.supported_documents || [...ALLOWED_DOCS],
      target_seconds: session.target_seconds,
      culture_lines: session.culture_lines,
    },
  };
}

export async function completeIdentityVerification(
  userId,
  {
    verificationId,
    nfcPayload,
    livenessOk = true,
    faceMatchOk = true,
    ageYears = 18,
    path = 'nfc',
    documentNumberHint = null,
  } = {}
) {
  const row = await pool.query(
    `SELECT * FROM identity_verifications WHERE id = $1 AND user_id = $2`,
    [verificationId, userId]
  );
  if (row.rows.length === 0) {
    return { ok: false, status: 404, error: 'verification_not_found' };
  }
  const ver = row.rows[0];

  if (ver.status === 'verified') {
    return {
      ok: true,
      data: { verified: true, age_ok: true, identity_hash_stored: true, pii_retained: false },
    };
  }

  const already = await pool.query(
    `SELECT identity_verified FROM users WHERE id = $1`,
    [userId]
  );
  if (already.rows[0]?.identity_verified) {
    return { ok: false, status: 409, error: 'already_verified', code: 'ONCE_IN_LIFETIME' };
  }

  const provider = getActiveKycProvider();
  const result = await provider.completeSession({
    sessionId: ver.provider_session_id,
    nfcPayload,
    livenessOk,
    faceMatchOk,
    ageYears,
    path,
    documentType: ver.document_type,
    documentNumberHint,
    userId,
  });

  // Durable hash material required (stub/prod) — no ephemeral Date.now() payloads alone
  if (looksLikeRawMediaBlob(nfcPayload) || looksLikeRawMediaBlob(documentNumberHint)) {
    return {
      ok: false,
      status: 400,
      error: 'raw_media_not_accepted',
      code: 'PII_MEDIA_REJECTED',
    };
  }
  if (!result.identity_hash) {
    return {
      ok: false,
      status: 400,
      error: 'identity_hash_missing',
      code: result.error_code || 'IDENTITY_HASH_MISSING',
    };
  }
  // Live provider already validated durable material remotely; stub still needs local hint
  if (!result.live) {
    const hint = String(documentNumberHint || nfcPayload || '').trim();
    if (hint.length < 6) {
      return {
        ok: false,
        status: 400,
        error: 'document_number_or_nfc_required',
        code: 'DURABLE_IDENTITY_REQUIRED',
      };
    }
  }

  const bl = await pool.query(
    `SELECT user_id, blacklisted FROM identity_hashes WHERE identity_hash = $1`,
    [result.identity_hash]
  );
  const existingHash = bl.rows[0];
  if (existingHash?.blacklisted) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'blacklisted', error_code = 'IDENTITY_BLACKLISTED',
           identity_hash = $2, updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [verificationId, result.identity_hash]
    );
    return { ok: false, status: 403, error: 'identity_blacklisted', code: 'IDENTITY_BLACKLISTED' };
  }

  // Ömürde bir / tekrar-kayıt engeli: hash başka hesaba bağlıysa reddet
  if (existingHash?.user_id && String(existingHash.user_id) !== String(userId)) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'failed', error_code = 'IDENTITY_ALREADY_USED',
           identity_hash = $2, updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [verificationId, result.identity_hash]
    );
    return { ok: false, status: 409, error: 'identity_already_registered', code: 'RE_REGISTER_BLOCKED' };
  }

  await pool.query(
    `INSERT INTO identity_hashes (identity_hash, user_id)
     VALUES ($1, $2)
     ON CONFLICT (identity_hash) DO UPDATE
       SET user_id = COALESCE(identity_hashes.user_id, EXCLUDED.user_id)`,
    [result.identity_hash, userId]
  );

  if (!result.ok || !result.age_ok) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'failed', age_ok = $2, identity_hash = $3, error_code = $4,
           updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [verificationId, result.age_ok, result.identity_hash, result.error_code || 'VERIFY_FAILED']
    );
    return { ok: false, status: 400, error: result.error_code || 'verify_failed', code: result.error_code || 'VERIFY_FAILED', data: result };
  }

  await pool.query(
    `UPDATE identity_verifications
     SET status = 'verified', age_ok = true, identity_hash = $2,
         updated_at = NOW(), completed_at = NOW()
     WHERE id = $1`,
    [verificationId, result.identity_hash]
  );

  await pool.query(
    `UPDATE users
     SET identity_verified = true,
         age_ok = true,
         identity_track = 'identity',
         university = NULL,
         uni_label_visible = false,
         name_locked = true,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  return {
    ok: true,
    data: {
      verified: true,
      age_ok: true,
      identity_hash_stored: true,
      pii_retained: false,
      name_locked: true,
    },
  };
}

/** L4 ban — identity_hash kara liste → aynı kimlikle re-register imkansız */
export async function blacklistIdentityForUser(userId) {
  // Track A: ensure uni-mail hash exists before blacklist
  const u = await pool.query(
    `SELECT email, email_verified, identity_track FROM users WHERE id = $1`,
    [userId]
  );
  const row = u.rows[0];
  if (row?.email_verified && row.email) {
    await bindUniversityIdentityHash(userId, row.email);
  }

  await pool.query(
    `UPDATE identity_hashes SET blacklisted = true, blacklisted_at = NOW()
     WHERE user_id = $1 OR identity_hash IN (
       SELECT identity_hash FROM identity_verifications
       WHERE user_id = $1 AND identity_hash IS NOT NULL
     )`,
    [userId]
  );
  return { ok: true };
}

export async function getIdentityStatus(userId) {
  const u = await pool.query(
    `SELECT identity_verified, age_ok, identity_track, university, uni_label_visible, email_verified
     FROM users WHERE id = $1`,
    [userId]
  );
  if (!u.rows[0]) return { ok: false, status: 404, error: 'user_not_found' };
  return {
    ok: true,
    data: identityStatusPayload(u.rows[0]),
  };
}

export async function getUniversityProfile(universityName) {
  const name = String(universityName || '').trim();
  if (!name) return { ok: false, status: 400, error: 'university_required' };

  const members = await pool.query(
    `SELECT COUNT(*)::int AS member_count
     FROM users
     WHERE email_verified = true
       AND university IS NOT NULL
       AND LOWER(university) = LOWER($1)
       AND COALESCE(identity_track, 'university') = 'university'
       AND uni_label_visible = true`,
    [name]
  );

  return {
    ok: true,
    data: {
      name,
      member_count: members.rows[0]?.member_count || 0,
    },
  };
}

/**
 * Async vendor webhook — signature required when secret configured.
 * Body (LOCAL contract): { session_id, status, durable_identity_material, document_type, age_ok, age_years, error_code }
 * Never persists raw PII from webhook payload.
 */
export async function handleKycProviderWebhook({ rawBody, signatureHeader, providerHint = null }) {
  const providerId = String(providerHint || process.env.KYC_PROVIDER || 'techsign')
    .trim()
    .toLowerCase();
  const creds = getLiveCredentials(providerId === 'ihs' ? 'ihs' : 'techsign');
  const secret = creds?.webhookSecret || process.env.KYC_WEBHOOK_SECRET || '';
  const sig = verifyKycWebhookSignature(rawBody, signatureHeader, secret);
  if (!sig.ok) {
    return { ok: false, status: 401, error: sig.reason || 'invalid_signature', code: 'WEBHOOK_SIGNATURE_INVALID' };
  }

  let body;
  try {
    body = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(String(rawBody || '{}'));
  } catch {
    return { ok: false, status: 400, error: 'invalid_json', code: 'WEBHOOK_BAD_BODY' };
  }

  const sessionId = String(body.session_id || body.provider_session_id || '').trim();
  if (!sessionId) {
    return { ok: false, status: 400, error: 'session_id_required', code: 'WEBHOOK_SESSION_REQUIRED' };
  }

  const verRes = await pool.query(
    `SELECT * FROM identity_verifications WHERE provider_session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );
  const ver = verRes.rows[0];
  if (!ver) {
    return { ok: false, status: 404, error: 'verification_not_found', code: 'WEBHOOK_UNKNOWN_SESSION' };
  }
  if (ver.status === 'verified') {
    return { ok: true, data: { already_verified: true, pii_retained: false } };
  }

  const statusStr = String(body.status || '').toLowerCase();
  const verified = body.verified === true || statusStr === 'verified' || statusStr === 'approved';
  const durable = String(
    body.durable_identity_material || body.identity_token || body.document_id_token || ''
  ).trim();

  if (!verified || durable.length < 6) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'failed', error_code = $2, updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [ver.id, body.error_code || 'PROVIDER_WEBHOOK_FAILED']
    );
    return { ok: true, data: { verified: false, pii_retained: false } };
  }

  const docType = String(body.document_type || ver.document_type || 'TCKK').toUpperCase();
  const identityHash = crypto
    .createHash('sha256')
    .update(`local-id-v1|${ver.provider || providerId}|${docType}|${durable.toLowerCase()}`)
    .digest('hex');

  const ageOk =
    body.age_ok === true || body.age_ok === false
      ? Boolean(body.age_ok)
      : Number(body.age_years || 18) >= 18;

  if (!ageOk) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'failed', age_ok = false, identity_hash = $2, error_code = 'AGE_UNDER_18',
           updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [ver.id, identityHash]
    );
    return { ok: true, data: { verified: false, age_ok: false, pii_retained: false } };
  }

  const bl = await pool.query(
    `SELECT user_id, blacklisted FROM identity_hashes WHERE identity_hash = $1`,
    [identityHash]
  );
  if (bl.rows[0]?.blacklisted) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'blacklisted', error_code = 'IDENTITY_BLACKLISTED', identity_hash = $2,
           updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [ver.id, identityHash]
    );
    return { ok: false, status: 403, error: 'identity_blacklisted', code: 'IDENTITY_BLACKLISTED' };
  }
  if (bl.rows[0]?.user_id && String(bl.rows[0].user_id) !== String(ver.user_id)) {
    await pool.query(
      `UPDATE identity_verifications
       SET status = 'failed', error_code = 'IDENTITY_ALREADY_USED', identity_hash = $2,
           updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
      [ver.id, identityHash]
    );
    return { ok: false, status: 409, error: 'identity_already_registered', code: 'RE_REGISTER_BLOCKED' };
  }

  await pool.query(
    `INSERT INTO identity_hashes (identity_hash, user_id)
     VALUES ($1, $2)
     ON CONFLICT (identity_hash) DO UPDATE
       SET user_id = COALESCE(identity_hashes.user_id, EXCLUDED.user_id)`,
    [identityHash, ver.user_id]
  );

  await pool.query(
    `UPDATE identity_verifications
     SET status = 'verified', age_ok = true, identity_hash = $2,
         updated_at = NOW(), completed_at = NOW()
     WHERE id = $1`,
    [ver.id, identityHash]
  );

  await pool.query(
    `UPDATE users
     SET identity_verified = true,
         age_ok = true,
         identity_track = 'identity',
         university = NULL,
         uni_label_visible = false,
         name_locked = true,
         updated_at = NOW()
     WHERE id = $1`,
    [ver.user_id]
  );

  return {
    ok: true,
    data: { verified: true, age_ok: true, identity_hash_stored: true, pii_retained: false },
  };
}
