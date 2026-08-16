/**
 * TOTEM / PORTAL derin-linki — sonMD "TOTEM 3-hal kapısı"
 *
 * Okutan kişiye göre:
 *  1) o mekanda sözü var  → doğrudan kapı (check-in) ekranı
 *  2) kayıtlı ama sözsüz  → buradasın-modu (90dk bilet · salt UX, yetki sıfır)
 *  3) app'siz             → web-vitrin hunisi (/w/t/... backend tarafı)
 *
 * Bilet kozmetiktir: backend presence_ticket'ı yalnız mühür anında üretir
 * (checkinService). Burada tutulan kayıt hiçbir yetki taşımaz, sadece
 * "buradasın" yüzeyinin ne kadar açık kalacağını bilir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRitualDetail, fetchVenueRituals } from '../services/api';
import { getCheckinWindowInfo } from './checkinWindow';
import { DEFAULT_PUBLIC_CONFIG } from '../constants/localConfig';

const PRESENCE_MODE_KEY = '@local_presence_mode_v1';
const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://local.app').replace(
  /\/+$/,
  ''
);

/** Sözü olan masayı ararken bakılacak aday sayısı (ağ maliyeti freni) */
const MAX_CANDIDATE_LOOKUPS = 4;

export function buildPortalDeepLink(venueId, portalId) {
  return `local://portal/${venueId}/${encodeURIComponent(portalId)}`;
}

/** Totem üstüne basılan QR — app'siz okuyan web-vitrine düşer */
export function buildPortalWebLink(venueId, portalId) {
  return `${WEB_BASE_URL}/w/t/${venueId}/${encodeURIComponent(portalId)}`;
}

/**
 * Desteklenen biçimler:
 *   local://portal/<venueId>/<portalId>
 *   https://local.app/t/<venueId>/<portalId>
 *   https://local.app/w/t/<venueId>/<portalId>
 * @returns {{ venueId: string, portalId: string }|null}
 */
export function parsePortalLink(url) {
  if (!url || typeof url !== 'string') return null;
  const withoutQuery = url.split('?')[0].split('#')[0];
  const match = withoutQuery.match(/(?:^local:\/\/portal|\/w\/t|\/t|\/portal)\/([^/]+)\/([^/]+)\/?$/i);
  if (!match) return null;
  const venueId = decodeURIComponent(match[1]);
  const portalId = decodeURIComponent(match[2]);
  if (!venueId || !portalId) return null;
  return { venueId, portalId };
}

function presenceTtlMinutes(config) {
  return Number(
    config?.presence?.ticket_ttl_min ?? DEFAULT_PUBLIC_CONFIG.presence.ticket_ttl_min
  ) || 90;
}

/** Kozmetik buradasın bileti yaz — yetki üretmez, yalnız yüzey açar */
export async function issuePresenceMode(venueId, portalId, { config, now = Date.now() } = {}) {
  const ttlMin = presenceTtlMinutes(config);
  const ticket = {
    venue_id: String(venueId),
    portal_id: String(portalId),
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMin * 60000).toISOString(),
    ttl_min: ttlMin,
    cosmetic: true,
  };
  try {
    await AsyncStorage.setItem(PRESENCE_MODE_KEY, JSON.stringify(ticket));
  } catch (_e) {
    // non-fatal: bilet kaybolursa yüzey kapanır, akış bozulmaz
  }
  return ticket;
}

/** @returns {Promise<object|null>} süresi geçmemiş bilet */
export async function getPresenceMode(venueId = null, now = Date.now()) {
  try {
    const raw = await AsyncStorage.getItem(PRESENCE_MODE_KEY);
    if (!raw) return null;
    const ticket = JSON.parse(raw);
    if (!ticket?.expires_at || new Date(ticket.expires_at).getTime() <= now) {
      await AsyncStorage.removeItem(PRESENCE_MODE_KEY);
      return null;
    }
    if (venueId && String(ticket.venue_id) !== String(venueId)) return null;
    return ticket;
  } catch (_e) {
    return null;
  }
}

export async function clearPresenceMode() {
  try {
    await AsyncStorage.removeItem(PRESENCE_MODE_KEY);
  } catch (_e) {}
}

function viewerHasSeat(ritual, userId) {
  if (!ritual || !userId) return false;
  if (ritual.viewer_joined === true || ritual.is_participant === true) return true;
  if (ritual.viewer_checkin?.checked_in === true) return true;
  const participants = Array.isArray(ritual.participants) ? ritual.participants : [];
  return participants.some((p) => String(p?.id || p?.user_id) === String(userId));
}

/**
 * Totemi okutan kullanıcının bu mekanda açık kapısı var mı?
 * @returns {Promise<object|null>} kapı ekranına götürecek ritüel
 */
export async function findOpenDoorRitual(venueId, userId) {
  if (!venueId || !userId) return null;
  let rituals = [];
  try {
    rituals = await fetchVenueRituals(venueId, { limit: 40 });
  } catch (_e) {
    return null;
  }
  const now = Date.now();
  const candidates = (Array.isArray(rituals) ? rituals : [])
    .filter((r) => {
      const status = String(r?.status || '').toLowerCase();
      if (['cancelled', 'ended', 'completed'].includes(status)) return false;
      const info = getCheckinWindowInfo(r, now);
      // Kapı açık ya da warm-up'a girmiş masalar
      return info.door_open || info.early_window;
    })
    .slice(0, MAX_CANDIDATE_LOOKUPS);

  for (const candidate of candidates) {
    try {
      const detail = await fetchRitualDetail(candidate.id, userId);
      if (detail && viewerHasSeat(detail, userId)) return detail;
    } catch (_e) {
      // aday atlanır, sıradakine bakılır
    }
  }
  return null;
}

/**
 * Totem derin-linkini karşıla ve doğru yüzeye götür.
 * @returns {Promise<'checkin'|'presence'|'ignored'>}
 */
export async function handlePortalDeepLink(navigationRef, url, { userId, config } = {}) {
  const parsed = parsePortalLink(url);
  if (!parsed) return 'ignored';
  const navigate = navigationRef?.current?.navigate;
  if (typeof navigate !== 'function') return 'ignored';

  const { venueId, portalId } = parsed;

  const openDoor = await findOpenDoorRitual(venueId, userId);
  if (openDoor) {
    navigationRef.current.navigate('RitualCheckIn', {
      ritualId: openDoor.id,
      ritual: openDoor,
      portalId,
    });
    return 'checkin';
  }

  const ticket = await issuePresenceMode(venueId, portalId, { config });
  navigationRef.current.navigate('VenueDetail', {
    venueId,
    presenceMode: true,
    portalId,
    presenceExpiresAt: ticket.expires_at,
  });
  return 'presence';
}
