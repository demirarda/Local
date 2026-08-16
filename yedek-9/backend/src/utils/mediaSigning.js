import crypto from 'crypto';

function signingSecret() {
  return process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || 'local-media-signing-dev';
}

export function signMediaPath(filePath, expiresInSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + Number(expiresInSeconds || 3600);
  const payload = `${filePath}|${exp}`;
  const sig = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex');
  return Buffer.from(`${filePath}|${exp}|${sig}`).toString('base64url');
}

export function verifyMediaToken(token) {
  try {
    const raw = Buffer.from(String(token), 'base64url').toString('utf8');
    const [filePath, expStr, sig] = raw.split('|');
    if (!filePath || !expStr || !sig) return { ok: false };
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return { ok: false };
    const payload = `${filePath}|${exp}`;
    const expected = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex');
    if (expected !== sig) return { ok: false };
    return { ok: true, filePath };
  } catch (_e) {
    return { ok: false };
  }
}
