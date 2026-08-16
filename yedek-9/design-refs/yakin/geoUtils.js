/**
 * Geographic utilities
 * Konum tabanlı hesaplamalar: mesafe, bearing, SVG koordinat dönüşümü.
 */

const EARTH_RADIUS_M = 6371000; // metre

/**
 * Haversine formülü ile iki nokta arası mesafe (metre).
 * @param {number} lat1 @param {number} lng1 @param {number} lat2 @param {number} lng2
 * @returns {number} metre cinsinden mesafe
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Bearing (yön) hesabı — user'dan hedefe olan açı.
 * 0° = Kuzey, 90° = Doğu, 180° = Güney, 270° = Batı.
 */
export function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Bearing + mesafe → SVG koordinat (viewBox space).
 *
 * @param {number} bearingDeg  - Hedef bearing'i (0-360)
 * @param {number} distanceM   - Kullanıcıdan mesafe (metre)
 * @param {number} radiusM     - Radar'ın maksimum görünüm yarıçapı (metre)
 * @param {number} svgRadius   - Bu yarıçapın SVG'deki karşılığı (px)
 * @param {number} cx          - Radar merkezi SVG x
 * @param {number} cy          - Radar merkezi SVG y
 * @returns {{ x: number, y: number, inRange: boolean }}
 */
export function bearingDistanceToSvg(bearingDeg, distanceM, radiusM, svgRadius, cx, cy) {
  // SVG'de 0° = sağ (doğu). Bearing'de 0° = kuzey (yukarı).
  // Dönüşüm: bearing - 90 → SVG açısı
  const angleRad = ((bearingDeg - 90) * Math.PI) / 180;
  const pixelDist = (distanceM / radiusM) * svgRadius;
  const x = cx + pixelDist * Math.cos(angleRad);
  const y = cy + pixelDist * Math.sin(angleRad);
  return {
    x,
    y,
    inRange: distanceM <= radiusM,
  };
}

/**
 * Mesafeyi kullanıcı dostu formata çevir.
 * 450m, 1.2km, 5km
 */
export function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters / 1000)}km`;
}

/**
 * Yürüme süresini hesapla (ortalama 5 km/s hız).
 * "3 dk", "12 dk", "1 sa 15 dk"
 */
export function formatWalkTime(meters) {
  if (meters == null) return '';
  const metersPerMin = 5000 / 60; // ~83 m/dk
  const totalMin = meters / metersPerMin;

  if (totalMin < 1) return '1 dk';
  if (totalMin < 60) return `${Math.round(totalMin)} dk`;

  const hours = Math.floor(totalMin / 60);
  const mins = Math.round(totalMin % 60);
  return mins > 0 ? `${hours} sa ${mins} dk` : `${hours} sa`;
}

/**
 * Tüm item'lar için mesafe hesapla ve sırala.
 * Her item'a { distance, bearing } ekler.
 */
export function enrichWithDistance(items, userLocation) {
  if (!userLocation || !items) return items || [];

  return items
    .map((item) => {
      if (item.lat == null || item.lng == null) return item;
      const dist = haversineDistance(userLocation.lat, userLocation.lng, item.lat, item.lng);
      const b = bearing(userLocation.lat, userLocation.lng, item.lat, item.lng);
      return { ...item, distance: dist, bearing: b };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}

/**
 * Item'ları mesafeye göre filtrele (yarıçap içinde olanlar).
 */
export function filterByRadius(items, maxDistance) {
  if (!items) return [];
  return items.filter((item) => item.distance == null || item.distance <= maxDistance);
}
