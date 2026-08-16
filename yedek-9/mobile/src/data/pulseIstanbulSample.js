/**
 * API boş döndüğünde (__DEV__ + İstanbul) Pulse listesini doldurmak için örnek veri.
 * Kalıcı veri için backend: node src/scripts/seed_pulse_istanbul.js
 */

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

export function isIstanbulCity(city) {
  if (!city || typeof city !== 'string') return false;
  const n = city.replace(/İ/g, 'I').replace(/ı/g, 'i').trim().toLowerCase();
  return n === 'istanbul';
}

/** Sunucu yanıtı boşsa kullanılacak yapı (fetchPulseRituals ile uyumlu). */
export function buildIstanbulPulsePlaceholder() {
  return {
    live_now: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        title: 'Boğaz Caz & Kahve',
        type: 'Music',
        venue_name: 'Galata Port Saha',
        start_time: hoursAgo(0.65),
        duration: 90,
        capacity: 20,
        current_attendees: 7,
        entry_type: 'open',
        location: { lat: 41.0256, lng: 28.9744 },
        host: { id: '00000000-0000-4000-8000-000000000001', name: 'Deniz A.' },
        time_state: 'live_now',
        status: 'live',
        is_host_verified: true,
        is_venue_verified: true,
        friends_here: 0,
        is_friend_hosting: false,
        is_followed_host_hosting: false,
        is_followed_venue_active: false,
        energy_state: 'high',
        is_special_event: false,
        image_url: 'https://picsum.photos/seed/istanbul-live-caz/900/600',
      },
    ],
    starting_soon: [
      {
        id: '00000000-0000-4000-8000-000000000102',
        title: 'Kadıköy Indie Yayını',
        type: 'Music',
        venue_name: 'Moda Sahil Yürüyüş',
        start_time: hoursFromNow(0.85),
        duration: 90,
        capacity: 24,
        current_attendees: 4,
        entry_type: 'open',
        location: { lat: 40.9875, lng: 29.025 },
        host: { id: '00000000-0000-4000-8000-000000000002', name: 'Melis K.' },
        time_state: 'starting_soon',
        status: 'upcoming',
        is_host_verified: true,
        is_venue_verified: true,
        friends_here: 0,
        is_friend_hosting: false,
        is_followed_host_hosting: false,
        is_followed_venue_active: false,
        energy_state: 'calm',
        is_special_event: false,
        image_url: 'https://picsum.photos/seed/istanbul-indie/900/600',
      },
      {
        id: '00000000-0000-4000-8000-000000000103',
        title: 'İstanbul Tasarım Turu',
        type: 'Special Event',
        venue_name: 'Karaköy Kayıkhane',
        start_time: hoursFromNow(6),
        duration: 120,
        capacity: 30,
        current_attendees: 11,
        entry_type: 'open',
        location: { lat: 41.0223, lng: 28.977 },
        host: { id: '00000000-0000-4000-8000-000000000001', name: 'Deniz A.' },
        time_state: 'starting_soon',
        status: 'upcoming',
        is_host_verified: true,
        is_venue_verified: true,
        friends_here: 0,
        is_friend_hosting: false,
        is_followed_host_hosting: false,
        is_followed_venue_active: false,
        energy_state: 'high',
        is_special_event: true,
        image_url: 'https://picsum.photos/seed/istanbul-tasarim/900/600',
      },
    ],
    almost_full: [
      {
        id: '00000000-0000-4000-8000-000000000104',
        title: 'Akşam Çizim Kulübü',
        type: 'Arts',
        venue_name: 'Maslak Atölye',
        start_time: hoursFromNow(5),
        duration: 90,
        capacity: 14,
        current_attendees: 12,
        entry_type: 'open',
        location: { lat: 41.11, lng: 29.02 },
        host: { id: '00000000-0000-4000-8000-000000000003', name: 'Barış Ö.' },
        time_state: 'almost_full',
        status: 'upcoming',
        is_host_verified: true,
        is_venue_verified: true,
        friends_here: 0,
        is_friend_hosting: false,
        is_followed_host_hosting: false,
        is_followed_venue_active: false,
        energy_state: 'calm',
        is_special_event: false,
        image_url: 'https://picsum.photos/seed/istanbul-cizim/900/600',
      },
    ],
    reopened: [
      {
        id: '00000000-0000-4000-8000-000000000105',
        title: 'Karaköy Brunch Buluşması',
        type: 'Food',
        venue_name: 'Karaköy Kayıkhane',
        start_time: hoursAgo(2.2),
        duration: 90,
        capacity: 16,
        current_attendees: 14,
        entry_type: 'open',
        location: { lat: 41.0223, lng: 28.977 },
        host: { id: '00000000-0000-4000-8000-000000000003', name: 'Barış Ö.' },
        time_state: 'reopened',
        status: 'ended',
        is_host_verified: true,
        is_venue_verified: true,
        friends_here: 0,
        is_friend_hosting: false,
        is_followed_host_hosting: false,
        is_followed_venue_active: false,
        energy_state: 'calm',
        is_special_event: false,
        image_url: 'https://picsum.photos/seed/istanbul-brunch/900/600',
      },
    ],
  };
}

export function mergePulseIfEmpty(apiData, city) {
  if (!__DEV__ || !isIstanbulCity(city)) return apiData;
  const buckets = apiData || {};
  const total = ['live_now', 'starting_soon', 'almost_full', 'reopened'].reduce(
    (acc, k) => acc + (Array.isArray(buckets[k]) ? buckets[k].length : 0),
    0
  );
  if (total > 0) return apiData;
  return buildIstanbulPulsePlaceholder();
}
