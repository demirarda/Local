/**
 * Pulse görselleri — gerçek URL yoksa:
 * - varsayılan: nötr gri (sahte foto yok)
 * - EXPO_PUBLIC_PULSE_PLACEHOLDER_IMAGES=true → demo Picsum
 */
const USE_STOCK_PLACEHOLDERS = process.env.EXPO_PUBLIC_PULSE_PLACEHOLDER_IMAGES === 'true';

export const PULSE_NEUTRAL_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect fill="#E8E8E4" width="100%" height="100%"/></svg>'
  );

/** Picsum — yalnızca demo modunda */
export const PULSE_IMG = {
  hero: 'https://picsum.photos/seed/locale-pulse-hero/1200/800',
  memory: 'https://picsum.photos/seed/locale-memory/800/600',
  venue: 'https://picsum.photos/seed/locale-venue/800/600',
  live: 'https://picsum.photos/seed/locale-live/800/600',
  yoga: 'https://picsum.photos/seed/locale-yoga/800/600',
  food: 'https://picsum.photos/seed/locale-food/800/600',
  arts: 'https://picsum.photos/seed/locale-arts/800/600',
  city: 'https://picsum.photos/seed/locale-city/800/600',
  night: 'https://picsum.photos/seed/locale-night/800/600',
};

const GRID_ROTATION = [
  PULSE_IMG.live,
  PULSE_IMG.food,
  PULSE_IMG.arts,
  PULSE_IMG.city,
  PULSE_IMG.night,
  PULSE_IMG.yoga,
];

function pickUrl(...candidates) {
  for (const c of candidates) {
    if (c == null || typeof c !== 'string') continue;
    const s = c.trim();
    if (!s || s === 'null' || s === 'undefined') continue;
    if (/^https?:\/\//i.test(s) || s.startsWith('data:image/')) return s;
  }
  return null;
}

function fallback(kind, index = 0) {
  if (USE_STOCK_PLACEHOLDERS) {
    if (kind === 'hero') return PULSE_IMG.hero;
    if (kind === 'memory') return PULSE_IMG.memory;
    if (kind === 'venue') return PULSE_IMG.venue;
    if (kind === 'live') return PULSE_IMG.live;
    return GRID_ROTATION[index % GRID_ROTATION.length];
  }
  return PULSE_NEUTRAL_PLACEHOLDER;
}

export function pulseHeroImage(ritual) {
  if (!ritual) return fallback('hero');
  return (
    pickUrl(ritual.image_url, ritual.imageUrl, ritual.venue_image_url, ritual.cover_image_url) ||
    fallback('hero')
  );
}

export function pulseGridCardImage(ritual, index = 0) {
  if (!ritual) return fallback('grid', index);
  const direct = pickUrl(
    ritual.image_url,
    ritual.imageUrl,
    ritual.venue_image_url,
    ritual.cover_image_url
  );
  if (direct) return direct;
  if (USE_STOCK_PLACEHOLDERS) {
    const t = (ritual.type || '').toLowerCase();
    if (t.includes('music')) return PULSE_IMG.live;
    if (t.includes('food')) return PULSE_IMG.food;
    if (t.includes('wellness')) return PULSE_IMG.yoga;
    if (t.includes('arts')) return PULSE_IMG.arts;
    return GRID_ROTATION[index % GRID_ROTATION.length];
  }
  return PULSE_NEUTRAL_PLACEHOLDER;
}

export function pulseMemoryImage(memory) {
  if (!memory) return fallback('memory');
  return pickUrl(memory.image_url, memory.photo_url, memory.ritual_image_url) || fallback('memory');
}

export function pulseVenueImage(venue) {
  if (!venue) return fallback('venue');
  return pickUrl(venue.image_url, venue.cover_image_url) || fallback('venue');
}

export function pulseLiveCardImage(ritual) {
  if (!ritual) return fallback('live');
  return pickUrl(ritual.image_url, ritual.imageUrl, ritual.venue_image_url) || fallback('live');
}

export function pulseFriendActivityImage(ritual) {
  if (!ritual) return fallback('live');
  const direct = pickUrl(ritual.image_url, ritual.imageUrl, ritual.venue_image_url);
  if (direct) return direct;
  if (USE_STOCK_PLACEHOLDERS) {
    const t = (ritual.type || '').toLowerCase();
    if (t.includes('wellness') || t.includes('yoga')) return PULSE_IMG.yoga;
    if (t.includes('food')) return PULSE_IMG.food;
    if (t.includes('music')) return PULSE_IMG.live;
    return PULSE_IMG.city;
  }
  return PULSE_NEUTRAL_PLACEHOLDER;
}
