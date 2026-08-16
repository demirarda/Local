/**
 * TOTEM / MARKER okuma — sonMD check-in ② kısayolu (🔵 NFC).
 *
 * `react-native-nfc-manager` bir native modüldür ve Expo Go'da yoktur; bu yüzden
 * paket bağımlılığa eklenmez, opsiyonel require ile aranır. Modül yoksa veya
 * cihaz desteklemiyorsa akış { ok:false, reason:'unsupported' } döner ve
 * kullanıcı ana kültüre (kod söyle/göster · LOCAL-TAG) yönlendirilir.
 */
import { Platform } from 'react-native';
import { parsePortalLink } from './portalDeepLink';

const DEFAULT_TIMEOUT_MS = 20000;

let cachedModule;

/** @returns {object|null} react-native-nfc-manager modülü (yoksa null) */
export function getNfcModule() {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('react-native-nfc-manager');
    cachedModule = mod?.default ? mod : null;
  } catch (_e) {
    cachedModule = null;
  }
  return cachedModule;
}

export function isNfcModuleAvailable() {
  return getNfcModule() != null;
}

/** @returns {Promise<{ ok: boolean, reason?: string }>} */
export async function isNfcAvailable() {
  const mod = getNfcModule();
  if (!mod) return { ok: false, reason: 'unsupported' };
  const NfcManager = mod.default;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return { ok: false, reason: 'unsupported' };
    if (Platform.OS === 'android' && typeof NfcManager.isEnabled === 'function') {
      const enabled = await NfcManager.isEnabled();
      if (!enabled) return { ok: false, reason: 'disabled' };
    }
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'unsupported' };
  }
}

function decodeNdefPayload(mod, tag) {
  const Ndef = mod?.Ndef;
  const records = Array.isArray(tag?.ndefMessage) ? tag.ndefMessage : [];
  if (!Ndef || records.length === 0) return null;
  for (const record of records) {
    try {
      const uri = Ndef.uri?.decodePayload?.(record?.payload);
      if (uri) return uri;
    } catch (_e) {
      /* sıradaki kayda bak */
    }
    try {
      const text = Ndef.text?.decodePayload?.(record?.payload);
      if (text) return text;
    } catch (_e) {
      /* sıradaki kayda bak */
    }
  }
  return null;
}

function normalizeTagId(tag) {
  if (!tag) return null;
  if (typeof tag.id === 'string' && tag.id) return tag.id;
  if (Array.isArray(tag.id)) {
    return tag.id.map((b) => Number(b).toString(16).padStart(2, '0')).join('');
  }
  return null;
}

/**
 * Bir totem/marker etiketini okur.
 * @param {{ timeoutMs?: number, alertMessage?: string }} [options]
 * @returns {Promise<{ ok: true, tagId: string|null, payload: string|null, portal: object|null }
 *   | { ok: false, reason: 'unsupported'|'disabled'|'cancelled'|'timeout'|'empty'|'error', error?: string }>}
 */
export async function readTotemTag(options = {}) {
  const mod = getNfcModule();
  if (!mod) return { ok: false, reason: 'unsupported' };

  const availability = await isNfcAvailable();
  if (!availability.ok) return { ok: false, reason: availability.reason || 'unsupported' };

  const NfcManager = mod.default;
  const NfcTech = mod.NfcTech || {};
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  let timer = null;

  try {
    await NfcManager.start();
    const request = NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: options.alertMessage || 'Telefonu totem/marker’a yaklaştır',
    });
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('nfc_timeout')), timeoutMs);
    });
    await Promise.race([request, timeout]);

    const tag = await NfcManager.getTag();
    const tagId = normalizeTagId(tag);
    const payload = decodeNdefPayload(mod, tag);
    if (!tagId && !payload) return { ok: false, reason: 'empty' };

    return {
      ok: true,
      tagId,
      payload: payload || null,
      portal: payload ? parsePortalLink(payload) : null,
    };
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message === 'nfc_timeout') return { ok: false, reason: 'timeout' };
    if (/cancel/i.test(message)) return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'error', error: message };
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await mod.default.cancelTechnologyRequest();
    } catch (_e) {
      /* zaten kapalı */
    }
  }
}

/** Kullanıcıya gösterilecek kopya — ana kültüre (kod) yönlendirir */
export function describeNfcFailure(reason) {
  switch (reason) {
    case 'unsupported':
      return 'Bu cihazda NFC totem okuma yok. Masadaki 3 haneli kodu ya da LOCAL-TAG’i kullan.';
    case 'disabled':
      return 'NFC kapalı görünüyor. Ayarlardan aç ya da masadaki kodu kullan.';
    case 'timeout':
      return 'Totem okunamadı (süre doldu). Telefonu totemin üstüne koyup tekrar dene.';
    case 'cancelled':
      return 'Okuma iptal edildi.';
    case 'empty':
      return 'Totem boş okundu. Tekrar dene ya da masadaki kodu kullan.';
    default:
      return 'Totem okunamadı. Masadaki kodu kullanabilirsin.';
  }
}
