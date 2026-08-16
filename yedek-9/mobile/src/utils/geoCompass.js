/**
 * Check-in yön yardımı — GPS radius dışındayken pusula ipucu (v2 §2)
 */

const CARDINALS = [
  'kuzey',
  'kuzeydogu',
  'dogu',
  'guneydogu',
  'guney',
  'guneybati',
  'bati',
  'kuzeybati',
];

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(Number(v)))) return null;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 0=kuzey, saat yönünde derece */
export function bearingDegrees(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(Number(v)))) return null;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function cardinalLabel(bearing) {
  if (!Number.isFinite(Number(bearing))) return null;
  return CARDINALS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

/** Cihaz pusulasına göre ok — kullanıcı hangi tarafa dönmeli */
export function relativeArrow(bearing, heading) {
  if (!Number.isFinite(Number(bearing))) return null;
  if (!Number.isFinite(Number(heading))) return '↑';
  const delta = (((bearing - heading) % 360) + 360) % 360;
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round(delta / 45) % 8];
}

export function formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/**
 * Radius dışı ipucu: "↗ 180m · kuzeydogu yonunde"
 */
export function buildCompassHint({ from, to, heading }) {
  if (!from || !to) return null;
  const distance = haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude);
  const bearing = bearingDegrees(from.latitude, from.longitude, to.latitude, to.longitude);
  if (distance == null || bearing == null) return null;
  return {
    distance_m: Math.round(distance),
    distance_label: formatDistance(distance),
    bearing,
    cardinal: cardinalLabel(bearing),
    arrow: relativeArrow(bearing, heading),
    heading_known: Number.isFinite(Number(heading)),
  };
}
