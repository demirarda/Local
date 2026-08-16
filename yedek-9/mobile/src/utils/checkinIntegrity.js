import { Platform } from 'react-native';

/**
 * §1 T2: mock / root / integrity-fail → istemci bayrağı.
 * Temiz cihazda undefined bırakılır (backend PENDING'e düşmez).
 */
export function buildCheckinIntegrity({ mockLocation = false } = {}) {
  const mock = Boolean(mockLocation);
  const android = Platform.OS === 'android';
  const ios = Platform.OS === 'ios';
  return {
    mock_location: mock,
    play_integrity: android && mock ? false : undefined,
    app_attest: ios && mock ? false : undefined,
    root: mock,
  };
}

export const LOCAL_TAG_QR_PREFIX = 'local-tag:';

export function buildLocalTagQrPayload(token) {
  const t = String(token || '').trim();
  return t ? `${LOCAL_TAG_QR_PREFIX}${t}` : '';
}

export function parseLocalTagQrPayload(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.toLowerCase().startsWith(LOCAL_TAG_QR_PREFIX)) {
    return s.slice(LOCAL_TAG_QR_PREFIX.length).trim();
  }
  if (/^[a-f0-9]{16,64}$/i.test(s)) return s;
  return '';
}
