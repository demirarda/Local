import crypto from 'crypto';
import {
  createPresignedUploadUrl,
  isS3MediaConfigured,
  resolvePublicMediaUrl,
  toS3Uri,
  verifyS3ObjectExists,
} from '../utils/s3Media.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const PROOF_TYPES = new Set([...IMAGE_TYPES, 'application/pdf']);
const MAX_BYTES = 15 * 1024 * 1024;

function extFor(contentType, kind) {
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (kind === 'proof') return '.jpg';
  return '.jpg';
}

export async function initVenueApplicationUpload(userId, { kind = 'photo', content_type, file_size_bytes } = {}) {
  if (!userId) return { ok: false, status: 401, error: 'Authentication required' };
  if (!isS3MediaConfigured()) {
    return { ok: false, status: 503, error: 'Media storage is not configured' };
  }
  const k = kind === 'proof' ? 'proof' : 'photo';
  const contentType = String(content_type || 'image/jpeg').toLowerCase();
  const allowed = k === 'proof' ? PROOF_TYPES : IMAGE_TYPES;
  if (!allowed.has(contentType)) {
    return { ok: false, status: 400, error: k === 'proof' ? 'Belge JPG/PNG/WebP/PDF olmalı' : 'Foto JPG/PNG/WebP olmalı' };
  }
  const size = Number(file_size_bytes || 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return { ok: false, status: 400, error: 'Dosya en fazla 15MB olmalı' };
  }
  const id = crypto.randomUUID();
  const key = `local-app/venue-applications/${userId}/${k}/${id}${extFor(contentType, k)}`;
  const upload_url = await createPresignedUploadUrl(key, contentType, 300);
  return {
    ok: true,
    upload_url,
    method: 'PUT',
    expires_in_seconds: 300,
    storage_key: key,
    content_type: contentType,
    kind: k,
  };
}

export async function finalizeVenueApplicationUpload(userId, { storage_key } = {}) {
  if (!userId) return { ok: false, status: 401, error: 'Authentication required' };
  const key = String(storage_key || '');
  const prefix = `local-app/venue-applications/${userId}/`;
  if (!key.startsWith(prefix)) {
    return { ok: false, status: 403, error: 'storage_key mismatch' };
  }
  try {
    await verifyS3ObjectExists(key);
  } catch (_e) {
    return { ok: false, status: 400, error: 'Upload not found — PUT tamamlanmadı' };
  }
  const uri = toS3Uri(key);
  const url = await resolvePublicMediaUrl(uri, 60 * 60 * 24 * 30);
  return { ok: true, url, uri, storage_key: key };
}
