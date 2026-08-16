/**
 * Pulse ekranında tüm kart türlerini görmek için zengin örnek veri.
 * Ritüeller (canlı, yakında, dolmak üzere, yeniden açıldı, özel etkinlik, pivot/min RS),
 * anılar (foto URL, alıntı, playlist, ses metni, yeniden paylaşım etiketi),
 * mekan aktivitesi (aynı gün aynı mekanda birden fazla ritüel), arkadaş katılımı, pulse-events.
 *
 * Görseller: Unsplash ve Picsum (HTTPS, RN Image ile uyumlu).
 *
 * Kullanım (backend klasöründen):
 *   node src/scripts/seed_pulse_showcase.js
 *
 * Ortam:
 *   PULSE_VIEWER_EMAIL — örnekleri bu kullanıcının şehrine ve arkadaşlıklarına bağlar (varsayılan: 200541032@firat.edu.tr veya ilk kullanıcı)
 */

import 'dotenv/config';
import pool from '../config/database.js';

const PREFIX = '[Pulse Showcase] ';

const IMG = {
  brunch: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&h=650&fit=crop&q=80',
  coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=650&fit=crop&q=80',
  jazz: 'https://images.unsplash.com/photo-1415201364244-b4e9d983eafd?w=900&h=650&fit=crop&q=80',
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&h=650&fit=crop&q=80',
  wine: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900&h=650&fit=crop&q=80',
  chess: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=900&h=650&fit=crop&q=80',
  run: 'https://images.unsplash.com/photo-1476480862121-37bf1b20d605?w=900&h=650&fit=crop&q=80',
  book: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=900&h=650&fit=crop&q=80',
  playlist: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=900&h=650&fit=crop&q=80',
};

async function getViewer() {
  const email = process.env.PULSE_VIEWER_EMAIL || '200541032@firat.edu.tr';
  let r = await pool.query(`SELECT id, name, city, university FROM users WHERE email = $1 LIMIT 1`, [email]);
  if (r.rows.length === 0) {
    r = await pool.query(`SELECT id, name, city, university FROM users ORDER BY created_at ASC LIMIT 1`);
  }
  if (r.rows.length === 0) {
    throw new Error('Veritabanında kullanıcı yok; önce kayıt olun.');
  }
  return r.rows[0];
}

async function ensureUser(name, city, university, rs) {
  const ex = await pool.query(`SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`, [name, city]);
  if (ex.rows.length) return ex.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO users (name, city, university, rs_score) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, city, university || 'Demo University', rs]
  );
  return ins.rows[0].id;
}

async function ensureVenue(name, city, lat, lng) {
  const r = await pool.query(
    `INSERT INTO venues (name, city, location_lat, location_lng, subscription_tier)
     VALUES ($1, $2, $3, $4, 'pro')
     ON CONFLICT (name, city) DO UPDATE SET location_lat = EXCLUDED.location_lat
     RETURNING id`,
    [name, city, lat, lng]
  );
  return r.rows[0].id;
}

async function deleteShowcaseRituals() {
  await pool.query(
    `DELETE FROM memories WHERE ritual_id IN (SELECT id FROM rituals WHERE title LIKE $1)`,
    [`${PREFIX}%`]
  );
  await pool.query(
    `DELETE FROM ritual_attendance WHERE ritual_id IN (SELECT id FROM rituals WHERE title LIKE $1)`,
    [`${PREFIX}%`]
  );
  await pool.query(`DELETE FROM rituals WHERE title LIKE $1`, [`${PREFIX}%`]);
}

async function insertRitual(row) {
  const {
    title,
    type,
    location_name,
    start_time,
    duration,
    capacity,
    entry_type = 'open',
    location_lat,
    location_lng,
    host_id,
    status,
    min_rs = 0,
    is_special_event = false,
    venue_id = null,
    end_time = null,
  } = row;
  const end = end_time || new Date(new Date(start_time).getTime() + duration * 60000);
  const et =
    entry_type === 'request' || entry_type === 'request_seat'
      ? 'request'
      : entry_type === 'reference' || entry_type === 'invite_only'
        ? 'reference'
        : 'open';

  const r = await pool.query(
    `INSERT INTO rituals (
      title, type, location_name, start_time, duration, end_time, capacity, entry_type,
      location_lat, location_lng, host_id, status, min_rs, is_special_event, live_window_hours, venue_id, mood_tags
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::ritual_entry_type,
      $9, $10, $11, $12::ritual_status, $13, $14, 12, $15, $16
    ) RETURNING id`,
    [
      title,
      type,
      location_name,
      start_time,
      duration,
      end,
      capacity,
      et,
      location_lat,
      location_lng,
      host_id,
      status,
      min_rs,
      is_special_event,
      venue_id,
      ['pulse-showcase'],
    ]
  );
  return r.rows[0].id;
}

async function attend(ritualId, userId, status = 'confirmed') {
  await pool.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status)
     VALUES ($1, $2, $3::ritual_participant_status)
     ON CONFLICT (ritual_id, user_id) DO NOTHING`,
    [ritualId, userId, status]
  );
}

async function friendship(viewerId, otherId) {
  await pool.query(
    `INSERT INTO friendships (user_id, friend_id, requester_id, receiver_id, status, accepted_at)
     VALUES ($1, $2, $1, $2, 'accepted', NOW())
     ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted', accepted_at = COALESCE(friendships.accepted_at, NOW())`,
    [viewerId, otherId]
  );
  await pool.query(
    `INSERT INTO friendships (user_id, friend_id, requester_id, receiver_id, status, accepted_at)
     VALUES ($1, $2, $2, $1, 'accepted', NOW())
     ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
    [viewerId, otherId]
  );
}

async function follow(viewerId, hostId) {
  await pool.query(
    `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [viewerId, hostId]
  );
}

async function hostVerification(userId, type = 'standard') {
  await pool.query(
    `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
     VALUES ($1, 'seed', $2, 'active')
     ON CONFLICT (user_id) DO UPDATE SET verification_type = EXCLUDED.verification_type, status = 'active'`,
    [userId, type]
  );
}

async function venueVerification(venueName, city) {
  await pool.query(
    `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
     VALUES ($1, $2, 'seed', 'standard', 'active')
     ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active'`,
    [venueName, city]
  );
}

async function insertPulseMemory({
  ritual_id,
  user_id,
  content,
  type,
  content_url = null,
  spotify_url = null,
  caption = null,
}) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO memories (
      ritual_id, user_id, content, memory_type, expires_at,
      type, destination, content_text, content_url, external_url, spotify_playlist_url, caption
    ) VALUES (
      $1, $2, $3, 'pulse', $4,
      $5::memory_type_enum, 'ritual_and_pulse'::memory_destination_enum, $3, $6, $7, $8, $9
    )`,
    [
      ritual_id,
      user_id,
      content,
      expires,
      type,
      content_url,
      spotify_url,
      spotify_url,
      caption,
    ]
  );
}

async function main() {
  const viewer = await getViewer();
  const city = viewer.city || 'Milano';
  const viewerId = viewer.id;

  console.log(`Viewer: ${viewer.name} (${viewerId}) — şehir: ${city}\n`);

  await deleteShowcaseRituals();
  console.log('Önceki [Pulse Showcase] ritüelleri temizlendi.\n');

  const hostBrunch = await ensureUser(`${PREFIX}Host Brunch`, city, null, 8.2);
  const hostPivot = await ensureUser(`${PREFIX}Pivot Host`, city, null, 8.5);
  const hostPhil = await ensureUser(`${PREFIX}Host Philosophy`, city, null, 7.8);
  const hostVenue = await ensureUser(`${PREFIX}Caffè Host`, city, null, 7.4);
  const friendElena = await ensureUser(`${PREFIX}Elena`, city, null, 7.0);
  const friendMarco = await ensureUser(`${PREFIX}Marco`, city, null, 6.9);
  const friendLuca = await ensureUser(`${PREFIX}Luca`, city, null, 7.1);
  const newFriendForEvent = await ensureUser(`${PREFIX}Yeni Arkadas`, city, null, 6.5);

  await friendship(viewerId, friendElena);
  await friendship(viewerId, friendMarco);
  await friendship(viewerId, friendLuca);
  await follow(viewerId, hostBrunch);
  await follow(viewerId, hostPivot);

  await hostVerification(hostBrunch, 'standard');
  await hostVerification(hostPivot, 'premium');
  await hostVerification(hostPhil, 'standard');
  await hostVerification(hostVenue, 'standard');

  const venueCaffeId = await ensureVenue('Caffè Letterario', city, 45.464, 9.19);
  const venueNavigliId = await ensureVenue('Blue Note Milano', city, 45.45, 9.17);
  await venueVerification('Caffè Letterario', city);
  await venueVerification('Blue Note Milano', city);
  await venueVerification('Brera', city);

  await pool.query(
    `INSERT INTO venue_follows (user_id, venue_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [viewerId, venueCaffeId]
  );

  const now = new Date();

  // 1) CANLI — Brunch (pivot + arkadaşlar)
  const liveStart = new Date(now.getTime() - 35 * 60000);
  const liveEnd = new Date(now.getTime() + 4 * 60 * 60000);
  const idLive = await insertRitual({
    title: `${PREFIX}Brunch Circle`,
    type: 'Social',
    location_name: 'Brera',
    start_time: liveStart,
    duration: Math.ceil((liveEnd - liveStart) / 60000),
    capacity: 24,
    entry_type: 'open',
    location_lat: 45.472,
    location_lng: 9.188,
    host_id: hostPivot,
    status: 'live',
    min_rs: 0,
    is_special_event: false,
    end_time: liveEnd,
  });
  await attend(idLive, friendElena);
  await attend(idLive, friendMarco);
  await attend(idLive, viewerId);

  // 2) CANLI — Kahve (ikinci live kartı)
  const idCoffee = await insertRitual({
    title: `${PREFIX}Morning Coffee & Study`,
    type: 'Study',
    location_name: 'Caffè Duomo',
    start_time: new Date(now.getTime() - 50 * 60000),
    duration: 180,
    capacity: 15,
    entry_type: 'open',
    location_lat: 45.4642,
    location_lng: 9.1914,
    host_id: hostBrunch,
    status: 'live',
    min_rs: 0,
    end_time: new Date(now.getTime() + 130 * 60000),
  });
  await attend(idCoffee, friendLuca);

  // 3) Yakında başlıyor (90 dk içinde)
  const idSoon = await insertRitual({
    title: `${PREFIX}Philosophy Walk`,
    type: 'Culture',
    location_name: 'Darsena',
    start_time: new Date(now.getTime() + 40 * 60000),
    duration: 90,
    capacity: 8,
    entry_type: 'request',
    location_lat: 45.453,
    location_lng: 9.175,
    host_id: hostPhil,
    status: 'active',
    min_rs: 6.5,
  });

  // 4) Neredeyse dolu
  const idFull = await insertRitual({
    title: `${PREFIX}Wine Tasting Evening`,
    type: 'Food',
    location_name: 'Navigli',
    start_time: new Date(now.getTime() + 3 * 60 * 60000),
    duration: 120,
    capacity: 8,
    entry_type: 'open',
    location_lat: 45.448,
    location_lng: 9.172,
    host_id: hostBrunch,
    status: 'active',
    min_rs: 0,
  });
  for (let i = 0; i < 6; i++) {
    const u = await ensureUser(`${PREFIX}Guest ${i}`, city, null, 6.0);
    await attend(idFull, u);
  }

  // 5) Yeniden açıldı (bitti, < 60 dk)
  const endedStart = new Date(now.getTime() - 150 * 60000);
  const endedEnd = new Date(now.getTime() - 25 * 60000);
  const idReopen = await insertRitual({
    title: `${PREFIX}Chess Evening`,
    type: 'Games',
    location_name: 'Isola',
    start_time: endedStart,
    duration: Math.ceil((endedEnd - endedStart) / 60000),
    capacity: 12,
    entry_type: 'open',
    location_lat: 45.491,
    location_lng: 9.188,
    host_id: hostPhil,
    status: 'ended',
    min_rs: 0,
    end_time: endedEnd,
  });

  // 6) Özel etkinlik
  const tonight = new Date(now);
  tonight.setHours(20, 30, 0, 0);
  if (tonight <= now) tonight.setDate(tonight.getDate() + 1);
  const idSpecial = await insertRitual({
    title: `${PREFIX}Jazz Night`,
    type: 'Special Event',
    location_name: 'Blue Note Milano',
    start_time: tonight,
    duration: 150,
    capacity: 50,
    entry_type: 'request',
    location_lat: 45.451,
    location_lng: 9.171,
    host_id: hostPivot,
    status: 'active',
    min_rs: 0,
    is_special_event: true,
    venue_id: venueNavigliId,
  });
  await attend(idSpecial, friendElena);
  await attend(idSpecial, friendMarco);
  await attend(idSpecial, friendLuca);

  // 7) Mekan: Caffè Letterario — bugün 3 ritüel
  const t14 = new Date(now);
  t14.setHours(14, 0, 0, 0);
  const t17 = new Date(now);
  t17.setHours(17, 0, 0, 0);
  const t20 = new Date(now);
  t20.setHours(20, 0, 0, 0);
  if (t14 <= now) {
    t14.setDate(t14.getDate() + 1);
    t17.setDate(t17.getDate() + 1);
    t20.setDate(t20.getDate() + 1);
  }
  await insertRitual({
    title: `${PREFIX}Book Discussion`,
    type: 'Culture',
    location_name: 'Caffè Letterario',
    start_time: t14,
    duration: 90,
    capacity: 14,
    entry_type: 'open',
    location_lat: 45.46,
    location_lng: 9.185,
    host_id: hostVenue,
    status: 'active',
    venue_id: venueCaffeId,
  });
  await insertRitual({
    title: `${PREFIX}Writing Circle`,
    type: 'Culture',
    location_name: 'Caffè Letterario',
    start_time: t17,
    duration: 90,
    capacity: 12,
    entry_type: 'open',
    location_lat: 45.46,
    location_lng: 9.185,
    host_id: hostVenue,
    status: 'active',
    venue_id: venueCaffeId,
  });
  await insertRitual({
    title: `${PREFIX}Poetry Reading`,
    type: 'Culture',
    location_name: 'Caffè Letterario',
    start_time: t20,
    duration: 75,
    capacity: 22,
    entry_type: 'open',
    location_lat: 45.46,
    location_lng: 9.185,
    host_id: hostVenue,
    status: 'active',
    venue_id: venueCaffeId,
  });

  // 8) Arkadaşlarla koşu (friend_activity sinyali)
  const idRun = await insertRitual({
    title: `${PREFIX}Sunset Run & Chill`,
    type: 'Wellness',
    location_name: 'Parco Sempione',
    start_time: new Date(now.getTime() + 5 * 60 * 60000),
    duration: 60,
    capacity: 20,
    entry_type: 'open',
    location_lat: 45.4728,
    location_lng: 9.175,
    host_id: hostBrunch,
    status: 'active',
    min_rs: 0,
  });
  await attend(idRun, friendElena);
  await attend(idRun, friendMarco);

  // Anılar (canlı ritüele bağlı — Pulse sorgusu JOIN rituals)
  await insertPulseMemory({
    ritual_id: idLive,
    user_id: hostBrunch,
    content: `Harika bir sabah ritüeli — Pulse Showcase Seed`,
    type: 'photo',
    content_url: IMG.brunch,
    caption: 'Great vibes this morning',
  });

  await insertPulseMemory({
    ritual_id: idLive,
    user_id: friendMarco,
    content: `[QUOTE] 'The unexamined life is not worth living.' — Pulse Showcase Seed`,
    type: 'quote',
  });

  await insertPulseMemory({
    ritual_id: idLive,
    user_id: hostPivot,
    content: 'Morning Coffee Vibes — Pulse Showcase Seed',
    type: 'playlist',
    spotify_url: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  });

  await insertPulseMemory({
    ritual_id: idCoffee,
    user_id: friendElena,
    content: '[VOICE] Bugün grup çalışması için harika bir ortam — Pulse Showcase Seed',
    type: 'voice',
  });

  await insertPulseMemory({
    ritual_id: idCoffee,
    user_id: friendLuca,
    content: '[RESHARE] Elena|Marco — Pulse Showcase Seed',
    type: 'text',
  });

  await insertPulseMemory({
    ritual_id: idSoon,
    user_id: friendLuca,
    content: '[TAGGED] Seni burada görmek güzel — Pulse Showcase Seed',
    type: 'text',
  });

  // Pulse friend event: ortak ritüelde yeni arkadaşlık
  const sharedStart = new Date(now.getTime() - 48 * 60 * 60000);
  const sharedEnd = new Date(sharedStart.getTime() + 90 * 60000);
  const idShared = await insertRitual({
    title: `${PREFIX}Shared Ritual Meet`,
    type: 'Social',
    location_name: 'Brera',
    start_time: sharedStart,
    duration: 90,
    capacity: 30,
    entry_type: 'open',
    location_lat: 45.47,
    location_lng: 9.19,
    host_id: hostBrunch,
    status: 'ended',
    end_time: sharedEnd,
  });
  await attend(idShared, viewerId);
  await attend(idShared, newFriendForEvent);

  await pool.query(
    `INSERT INTO friendships (user_id, friend_id, requester_id, receiver_id, status, created_at, accepted_at)
     VALUES ($1, $2, $1, $2, 'accepted', NOW(), NOW())
     ON CONFLICT (user_id, friend_id) DO UPDATE SET created_at = NOW(), accepted_at = NOW()`,
    [viewerId, newFriendForEvent]
  );
  await pool.query(
    `INSERT INTO friendships (user_id, friend_id, requester_id, receiver_id, status, created_at, accepted_at)
     VALUES ($1, $2, $2, $1, 'accepted', NOW(), NOW())
     ON CONFLICT (user_id, friend_id) DO UPDATE SET created_at = NOW()`,
    [viewerId, newFriendForEvent]
  );

  console.log('✅ [Pulse Showcase] verileri eklendi.');
  console.log(`   Şehir filtresi: ${city} (kullanıcı şehri ile Pulse eşleşmeli)`);
  console.log('   Görseller: memories.content_url (foto), playlist URL, quote/voice metinleri.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
