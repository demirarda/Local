/**
 * Check-in code helpers — LOCAL v2 §2 (3-digit numeric code)
 * Gösterim: yalnız rakam — yazı-okunuş satırı YOK (founder final).
 */
import LOCAL_CONFIG from '../config/localConfig.js';

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Normalize to 3-digit display string (no spoken readout). */
export function displayCode(code, _lang = 'tr') {
  const digits = String(code ?? '').replace(/\D/g, '').slice(0, 3);
  return digits || '';
}

/** @deprecated v2 §2 — spoken readout removed; alias of displayCode */
export function formatCodeSpoken(code, lang = 'tr') {
  return displayCode(code, lang);
}

export function randomCheckinCode() {
  const min = LOCAL_CONFIG.keyword.CODE_MIN ?? 100;
  const max = LOCAL_CONFIG.keyword.CODE_MAX ?? 999;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

/**
 * Generate unique 3-digit code for ritual at START — collision within radius × active window.
 */
export async function generateUniqueCheckinCode(pool, ritual) {
  const radius = LOCAL_CONFIG.keyword.COLLISION_RADIUS_M ?? 500;
  const lat = Number(ritual.location_lat);
  const lng = Number(ritual.location_lng);
  const maxTries = 40;

  for (let i = 0; i < maxTries; i++) {
    const code = randomCheckinCode();
    const nearby = await pool.query(
      `SELECT id, checkin_keyword, location_lat, location_lng, start_time, duration, status, event_group_id
       FROM rituals
       WHERE id != $1
         AND checkin_keyword IS NOT NULL
         AND checkin_code_generated_at IS NOT NULL
         AND status IN ('live', 'prelobby', 'active', 'window')
         AND start_time > NOW() - INTERVAL '12 hours'
         AND start_time < NOW() + INTERVAL '12 hours'`,
      [ritual.id]
    );

    let collision = false;
    for (const row of nearby.rows) {
      if (String(row.checkin_keyword) !== String(code)) continue;
      if (ritual.event_group_id && row.event_group_id && String(ritual.event_group_id) === String(row.event_group_id)) {
        collision = true;
        break;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        collision = true;
        break;
      }
      const d = haversineMeters(lat, lng, Number(row.location_lat), Number(row.location_lng));
      if (d <= radius) {
        collision = true;
        break;
      }
    }
    if (!collision) return code;
  }
  throw new Error('Unable to allocate unique check-in code');
}

export function getEarlyCheckinInfo(ritual, now = new Date()) {
  const earlyMin = LOCAL_CONFIG.keyword.CHECKIN_EARLY_OPEN_MIN ?? 15;
  const start = new Date(ritual.start_time);
  const earlyOpen = new Date(start.getTime() - earlyMin * 60000);
  const started = now >= start;
  const earlyWindow = now >= earlyOpen && !started;
  const tableOpen = Boolean(ritual.checkin_keyword);
  const doorOpen = now >= earlyOpen; // kapı kapanışı getCheckinWindowInfo'da
  return {
    early_open_at: earlyOpen.toISOString(),
    early_window: earlyWindow,
    code_entry_active: doorOpen && tableOpen,
    table_open: tableOpen,
    can_first_seal: earlyWindow || started ? !tableOpen : false,
    seconds_until_start: started ? 0 : Math.max(0, Math.ceil((start - now) / 1000)),
  };
}
