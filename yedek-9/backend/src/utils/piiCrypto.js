import crypto from 'crypto';

function keyBuffer() {
  const key = process.env.PII_ENCRYPTION_KEY || process.env.JWT_SECRET || 'local-dev-pii-key';
  return crypto.createHash('sha256').update(String(key)).digest();
}

export function encryptJsonAtRest(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(), iv);
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}
