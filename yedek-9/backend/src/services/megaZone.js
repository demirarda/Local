/**
 * LOCAL_Zone_Vizyonu + EK-24 — kilitli ürün kuralları.
 * Rafta: ilk-zone-seti sayısı/semtleri, adlandırma hakkı.
 * 🏭 totem üretimi / saha-kurulumu ayrı.
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { assertP2cZoneCandidate, publicCoordPolicy } from './megaLaunchLocks.js';

function zoneCfg() {
  return LOCAL_CONFIG.zone || {};
}

export function zoneHasTrustNumber() {
  return zoneCfg().TRUST_NUMBER === true;
}

export function zoneIdentityParts() {
  return ['aura', 'liveness', 'character'];
}

export function takeRateForZone() {
  const z = Number(zoneCfg().TAKE_RATE_Z ?? LOCAL_CONFIG.venue?.PACKAGES_STUB?.TAKE_RATE?.ZONE ?? 0.08);
  return { rate: z, ladder: 'zone', billed: true, reason: 'Z_KADEME' };
}

export function assertZonePublicDoor(door) {
  if (zoneCfg().DOOR_PUBLIC_ONLY === false) return { ok: true, door };
  const d = String(door || 'PUBLIC').toUpperCase();
  if (d !== 'PUBLIC' && d !== 'OPEN') {
    return {
      ok: false,
      error: 'Zone kamusal — onay/arkadaş/solo kapısı yok',
      code: 'ZONE_PUBLIC_ONLY',
    };
  }
  return { ok: true, door: 'PUBLIC' };
}

export function assertZoneFirstSeal({ gpsOk = false, totemTap = false } = {}) {
  if (!gpsOk) {
    return { ok: false, error: 'Zone ilk-mühür GPS ister', code: 'ZONE_SEAL_GPS' };
  }
  if (!totemTap) {
    return { ok: false, error: 'Zone ilk-mühür zone-totem tap ister', code: 'ZONE_SEAL_TOTEM' };
  }
  return { ok: true };
}

const CHAR_LABELS = {
  muzik: 'müzik',
  müzik: 'müzik',
  music: 'müzik',
  jam: 'müzik',
  playlist: 'müzik',
  tanisma: 'tanışma',
  tanişma: 'tanışma',
  social: 'tanışma',
  meetup: 'tanışma',
  spor: 'spor-sohbeti',
  sport: 'spor-sohbeti',
  motorsport: 'spor-sohbeti',
  f1: 'spor-sohbeti',
  uni: 'üni',
  kampus: 'üni',
  campus: 'üni',
};

export function characterLabel(raw) {
  const k = String(raw || 'diger').toLowerCase().trim();
  return CHAR_LABELS[k] || k || 'diğer';
}

export function buildCharacterDistribution(rows = []) {
  const merged = {};
  let total = 0;
  for (const row of rows) {
    const label = characterLabel(row.category || row.type);
    const n = Number(row.n) || 0;
    merged[label] = (merged[label] || 0) + n;
    total += n;
  }
  const parts = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => ({
      label,
      n,
      pct: total ? Math.round((n / total) * 100) : 0,
    }));
  const ruhu = parts.length
    ? `Bu zone'un ruhu: ${parts
        .slice(0, 3)
        .map((p) => `%${p.pct} ${p.label}`)
        .join(' · ')}.`
    : 'Bu zone henüz karakterini yazıyor.';
  return { window_days: Number(zoneCfg().CHARACTER_WINDOW_D ?? 90), total, parts, ruhu };
}

export function buildLiveness({ pastTables = 0, weeklyTables = 0, liveNow = 0 } = {}) {
  const live = Number(liveNow) > 0;
  return {
    past_tables: Number(pastTables) || 0,
    weekly_rhythm: Number(weeklyTables) || 0,
    live_now: live,
    live_count: Number(liveNow) || 0,
    copy: `${Number(pastTables) || 0} masa · bu hafta ${Number(weeklyTables) || 0} · ${live ? 'şu an canlı' : 'şu an sessiz'}`,
  };
}

export function zoneLeagueSpec() {
  return {
    launch: zoneCfg().LEAGUE_LAUNCH !== false,
    metric: 'liveness',
    never_score: true,
    never_person: true,
    prize: { money: false, kind: 'badge_fame' },
    copy: 'bu hafta en canlı',
  };
}

export function p2zChipLane(chipId) {
  const id = String(chipId || '');
  const ops = zoneCfg().P2Z_OPS_CHIPS || ['p2z_r_marker', 'p2z_r_totem', 'p2z_r_temizlik', 'p2z_r_oturma', 'p2z_r_1'];
  if (ops.includes(id)) return 'ops';
  return 'aura';
}

/** Sık anılanlar = yalnız yeşil P2Z aura kelimeleri (canlı · müzikli · rüzgarlı). */
export function isAuraIdentityChip(chipId) {
  const id = String(chipId || '');
  return p2zChipLane(id) === 'aura' && id.startsWith('p2z_g_');
}

/** Tam koordinat kamusallaşmaz (P2C kapısı). */
export function publicZoneCoords(zone = {}) {
  if (LOCAL_CONFIG.p2c?.PUBLIC_COORD_EXACT === true) {
    return { geo_lat: zone.geo_lat ?? null, geo_lng: zone.geo_lng ?? null, exact: true };
  }
  const p = publicCoordPolicy(zone.geo_lat, zone.geo_lng);
  return { geo_lat: p.lat, geo_lng: p.lng, exact: false };
}

export function sanitizeZonePublic(zone) {
  if (!zone || typeof zone !== 'object') return zone;
  const coords = publicZoneCoords(zone);
  return { ...zone, geo_lat: coords.geo_lat, geo_lng: coords.geo_lng, geo_exact: false };
}

export function zoneCandidateStory() {
  return 'bu köşeyi siz kazandınız';
}

export { assertP2cZoneCandidate };
