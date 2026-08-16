/**
 * Media storage — S3 (prod) + local disk fallback (dev).
 * §3 memory photo/video uploads use createPresignedUploadUrl → client PUT → finalize.
 */
import fs from 'fs/promises';
import path from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileURLToPath } from 'url';
import { signMediaPath } from './mediaSigning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');

const region = process.env.AWS_S3_REGION || process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

function resolveMode() {
  const forced = String(process.env.MEDIA_STORAGE || 'auto').toLowerCase();
  if (forced === 'local' || forced === 's3') return forced;
  // auto
  if (region && bucket && hasAwsCreds) return 's3';
  return 'local';
}

export function mediaStorageMode() {
  return resolveMode();
}

function s3Client() {
  return new S3Client({ region });
}

/** True when memory/chat media upload pipeline can run */
export function isS3MediaConfigured() {
  const mode = resolveMode();
  if (mode === 'local') return true;
  return Boolean(region && bucket && hasAwsCreds);
}

export function s3MediaBucket() {
  return bucket || null;
}

export function parseS3Uri(uri) {
  const raw = String(uri || '');
  if (!raw.startsWith('s3://')) return null;
  const without = raw.slice('s3://'.length);
  const slash = without.indexOf('/');
  if (slash <= 0) return null;
  return {
    bucket: without.slice(0, slash),
    key: without.slice(slash + 1),
  };
}

export function toS3Uri(key) {
  if (resolveMode() === 'local') {
    // Local objects are addressed as /uploads/...
    if (String(key).startsWith('/uploads/')) return key;
    return `/uploads/${String(key).replace(/^\/+/, '')}`;
  }
  return `s3://${bucket}/${key}`;
}

function publicApiBase() {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.PUBLIC_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ).replace(/\/$/, '');
}

export async function createPresignedDownloadUrl(key, expiresInSeconds = 3600) {
  if (resolveMode() === 'local') {
    const filePath = String(key).startsWith('/uploads/')
      ? key
      : `/uploads/${String(key).replace(/^\/+/, '')}`;
    const token = signMediaPath(filePath, expiresInSeconds);
    return `${publicApiBase()}/api/media/access?token=${token}`;
  }
  const client = s3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** Turn s3:// or /uploads/ into a client-loadable HTTPS/HTTP URL */
export async function resolvePublicMediaUrl(uri, expiresInSeconds = 3600) {
  if (!uri) return null;
  const raw = String(uri);
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('file:')) {
    return raw;
  }
  if (raw.startsWith('/uploads/')) {
    const token = signMediaPath(raw, expiresInSeconds);
    return `${publicApiBase()}/api/media/access?token=${token}`;
  }
  const parsed = parseS3Uri(raw);
  if (parsed?.key) {
    return createPresignedDownloadUrl(parsed.key, expiresInSeconds);
  }
  // bare S3 key
  if (resolveMode() === 's3' && bucket) {
    return createPresignedDownloadUrl(raw.replace(/^\/+/, ''), expiresInSeconds);
  }
  return raw;
}

export async function enrichMemoryMediaUrls(memory) {
  if (!memory || typeof memory !== 'object') return memory;
  const resolved = await resolvePublicMediaUrl(memory.content_url);
  return {
    ...memory,
    content_url: resolved || memory.content_url,
    image_url: resolved || memory.image_url || memory.content_url,
    photo_url: resolved || memory.photo_url || memory.content_url,
    media_storage: resolveMode(),
  };
}

export async function enrichMemoryMediaUrlList(rows = []) {
  return Promise.all(rows.map((row) => enrichMemoryMediaUrls(row)));
}

function localAbsFromKey(key) {
  const rel = String(key).startsWith('/uploads/')
    ? key.slice('/uploads/'.length)
    : String(key).replace(/^\/+/, '');
  const abs = path.resolve(uploadsRoot, rel);
  if (!abs.startsWith(uploadsRoot)) {
    throw new Error('invalid local media path');
  }
  return abs;
}

export async function createPresignedUploadUrl(key, contentType, expiresInSeconds = 300) {
  if (resolveMode() === 'local') {
    const token = signMediaPath(
      String(key).startsWith('/uploads/') ? key : `/uploads/${key}`,
      expiresInSeconds
    );
    // Client PUTs raw bytes to this URL (same as S3 presign contract)
    return `${publicApiBase()}/api/media/put?token=${encodeURIComponent(token)}&contentType=${encodeURIComponent(
      contentType || 'application/octet-stream'
    )}`;
  }
  const client = s3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function verifyS3ObjectExists(key) {
  if (resolveMode() === 'local') {
    const abs = localAbsFromKey(key);
    const stat = await fs.stat(abs);
    const ext = path.extname(abs).toLowerCase();
    const contentType =
      ext === '.webp'
        ? 'image/webp'
        : ext === '.png'
          ? 'image/png'
          : ext === '.mp4'
            ? 'video/mp4'
            : ext === '.mov'
              ? 'video/quicktime'
              : ext === '.m4a'
                ? 'audio/m4a'
                : 'image/jpeg';
    return {
      exists: true,
      contentType,
      contentLength: Number(stat.size || 0),
      metadata: {},
    };
  }
  const client = s3Client();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return {
    exists: true,
    contentType: head.ContentType || null,
    contentLength: Number(head.ContentLength || 0),
    metadata: head.Metadata || {},
  };
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function getS3ObjectBuffer(key) {
  if (resolveMode() === 'local') {
    const abs = localAbsFromKey(key);
    const buffer = await fs.readFile(abs);
    const head = await verifyS3ObjectExists(key);
    return {
      buffer,
      contentType: head.contentType,
      metadata: {},
    };
  }
  const client = s3Client();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buffer = await streamToBuffer(result.Body);
  return {
    buffer,
    contentType: result.ContentType || null,
    metadata: result.Metadata || {},
  };
}

export async function putS3ObjectBuffer(key, buffer, contentType) {
  if (resolveMode() === 'local') {
    const abs = localAbsFromKey(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer);
    return;
  }
  const client = s3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );
}

export async function deleteS3Object(key) {
  if (resolveMode() === 'local') {
    try {
      await fs.unlink(localAbsFromKey(key));
    } catch (_) {
      /* ignore missing */
    }
    return;
  }
  const client = s3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Local PUT body handler used by /api/media/put */
export async function writeLocalUploadFromToken(token, bodyBuffer, contentType) {
  const { verifyMediaToken } = await import('./mediaSigning.js');
  const check = verifyMediaToken(token);
  if (!check.ok) {
    const err = new Error('invalid or expired media token');
    err.status = 403;
    throw err;
  }
  const abs = localAbsFromKey(check.filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, bodyBuffer);
  return {
    path: check.filePath,
    bytes: bodyBuffer.length,
    contentType: contentType || 'application/octet-stream',
  };
}

export function mediaHealthSnapshot() {
  return {
    mode: resolveMode(),
    configured: isS3MediaConfigured(),
    bucket: bucket || null,
    region: region || null,
    has_aws_creds: hasAwsCreds,
    api_public_url: publicApiBase(),
    uploads_root: uploadsRoot,
  };
}

export default {
  isS3MediaConfigured,
  mediaStorageMode,
  mediaHealthSnapshot,
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  resolvePublicMediaUrl,
  enrichMemoryMediaUrls,
  enrichMemoryMediaUrlList,
};
