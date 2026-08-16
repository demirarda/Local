/**
 * Test Attendee 2 kullanıcısı için Pulse ekranına örnek veriler.
 * Bu kullanıcı: Test Attendee 2, Istanbul, Test University.
 * Social Passport'ta Marco Host ve Sofia Host takip ediyor.
 *
 * Kullanım: node src/scripts/seed_pulse_test_attendee2.js
 */

import pool from '../config/database.js';

const TARGET_NAME = 'Test Attendee 2';
const TARGET_CITY = 'Istanbul';
const TARGET_UNIVERSITY = 'Test University';

async function main() {
  try {
    console.log('🔍 Test Attendee 2 kullanıcısı için Pulse verileri ekleniyor...\n');

    const userRes = await pool.query(
      `SELECT id, name, city FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
      [TARGET_NAME, TARGET_CITY]
    );
    if (userRes.rows.length === 0) {
      console.error('❌ "Test Attendee 2" (Istanbul) bulunamadı. Önce create_test_data.js çalıştırın veya uygulamada bu hesapla kayıt olun.');
      process.exit(1);
    }

    const viewerId = userRes.rows[0].id;
    const city = TARGET_CITY;
    console.log(`✅ Kullanıcı: ${userRes.rows[0].name} (${viewerId})`);

    async function getOrCreateUser(name, university = 'Test University') {
      const existing = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
        [name, city]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const r = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, city, university, 7.0]
      );
      return r.rows[0].id;
    }

    const marcoHostId = await getOrCreateUser('Marco Host', 'Bocconi University');
    const sofiaHostId = await getOrCreateUser('Sofia Host', 'Bocconi University');
    const studyHostId = await getOrCreateUser('Study Host');
    const cafeHostId = await getOrCreateUser('Café Host Istanbul');

    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [marcoHostId]
    );
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [sofiaHostId]
    );
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [cafeHostId]
    );

    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [viewerId, marcoHostId]
    );
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [viewerId, sofiaHostId]
    );
    console.log('✅ Marco Host ve Sofia Host takip ediliyor');

    const friendId = await getOrCreateUser('Pulse Friend Istanbul');

    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [viewerId, friendId]
    );
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [friendId, viewerId]
    );
    console.log('✅ Arkadaş eklendi');

    await pool.query(
      `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
       VALUES ($1, $2, 'admin', 'standard', 'active')
       ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active'`,
      ['Central Library', city]
    );
    await pool.query(
      `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
       VALUES ($1, $2, 'admin', 'standard', 'active')
       ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active'`,
      ['Kadıköy Café', city]
    );

    async function getOrCreateRitual(title, venueName, startTime, hostId, status, type = 'Social') {
      const existing = await pool.query(
        `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 ORDER BY created_at DESC LIMIT 1`,
        [title, venueName]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const r = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, 90, 20, 'open', 41.0082, 28.9784, $5, $6)
         RETURNING id`,
        [title, type, venueName, startTime, hostId, status]
      );
      return r.rows[0].id;
    }

    const now = new Date();

    const liveRitualId = await getOrCreateRitual(
      'Live Study Session',
      'Central Library',
      new Date(now.getTime() - 45 * 60 * 1000),
      studyHostId,
      'live',
      'Study'
    );

    const specialRitualId = await getOrCreateRitual(
      'Istanbul Jazz Night',
      'Kadıköy Moda',
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0),
      marcoHostId,
      'upcoming',
      'Special Event'
    );
    await pool.query(
      `UPDATE rituals SET type = $1 WHERE id = $2`,
      ['Special Event', specialRitualId]
    );

    const yogaRitualId = await getOrCreateRitual(
      'Morning Yoga Session',
      'Maçka Park',
      new Date(now.getTime() + 30 * 60 * 1000),
      sofiaHostId,
      'upcoming',
      'Active'
    );

    const brunchRitualId = await getOrCreateRitual(
      'Brunch Circle',
      'Brera Istanbul',
      new Date(now.getTime() - 2 * 60 * 60 * 1000),
      marcoHostId,
      'live',
      'Social'
    );

    const aperitivoRitualId = await getOrCreateRitual(
      'Sunset Aperitivo',
      'Bebek Terrace',
      new Date(now.getTime() - 3 * 60 * 60 * 1000),
      cafeHostId,
      'ended',
      'Social'
    );

    await getOrCreateRitual(
      'Book Club',
      'Kadıköy Café',
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0),
      cafeHostId,
      'upcoming',
      'Culture'
    );
    await getOrCreateRitual(
      'Writing Hour',
      'Kadıköy Café',
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0),
      cafeHostId,
      'upcoming',
      'Culture'
    );

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [liveRitualId, viewerId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [liveRitualId, friendId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [yogaRitualId, friendId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [brunchRitualId, viewerId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [brunchRitualId, friendId]
    );

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const existingMarcoMem = await pool.query(
      `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
      [aperitivoRitualId, marcoHostId]
    );
    if (existingMarcoMem.rows.length === 0) {
      await pool.query(
        `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
         VALUES ($1, $2, $3, 'pulse', $4)`,
        [aperitivoRitualId, marcoHostId, 'Harika bir akşam oldu! Sunset Aperitivo at Bebek Terrace. 🤍', expiresAt]
      );
    }

    const existingSofiaMem = await pool.query(
      `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
      [yogaRitualId, sofiaHostId]
    );
    if (existingSofiaMem.rows.length === 0) {
      await pool.query(
        `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
         VALUES ($1, $2, $3, 'pulse', $4)`,
        [yogaRitualId, sofiaHostId, 'The best conversations happen over coffee, not screens.', expiresAt]
      );
    }

    const existingCafeMem = await pool.query(
      `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
      [aperitivoRitualId, cafeHostId]
    );
    if (existingCafeMem.rows.length === 0) {
      await pool.query(
        `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at, spotify_playlist_url)
         VALUES ($1, $2, $3, 'pulse', $4, $5)`,
        [aperitivoRitualId, cafeHostId, 'Late Night Jazz playlist', expiresAt, 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO']
      );
    }

    await pool.query(
      `UPDATE friendships SET created_at = $1
       WHERE (user_id = $2 AND friend_id = $3) OR (user_id = $3 AND friend_id = $2)`,
      [new Date(now.getTime() - 30 * 60 * 1000), viewerId, friendId]
    );

    console.log('✅ Pulse verileri eklendi:');
    console.log('   - Live Now, Special Event, Starting Soon');
    console.log('   - Host Memory Share (Marco, Sofia, Café)');
    console.log('   - Venue Activity (Kadıköy Café)');
    console.log('   - Friend Activity (arkadaş Yoga\'da)');
    console.log('   - Friend Became Friends (Brunch)');
    console.log('\n📱 Test Attendee 2 ile giriş yapıp Pulse ekranını yenileyin.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

main();
