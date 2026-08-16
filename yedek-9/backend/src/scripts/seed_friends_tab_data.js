/**
 * Friends sekmesi için örnek veriler.
 * pulseMemories (arkadaşlardan), filteredRituals (friends_here, is_friend_hosting), friendPulseEvents.
 *
 * Kullanım: node src/scripts/seed_friends_tab_data.js
 * Önce create_pulse_sample_data_milano.js çalıştırılmış olabilir (viewer + Milano).
 */

import pool from '../config/database.js';

const PULSE_TEST_EMAIL = 'pulse@test.local';

async function main() {
  try {
    console.log('🔍 Friends tab için örnek veriler ekleniyor...\n');

    // 1) Viewer kullanıcısını bul (Milano pulse test veya ilk Milano kullanıcısı)
    let viewerRes = await pool.query(
      `SELECT id, name, city FROM users WHERE email = $1 LIMIT 1`,
      [PULSE_TEST_EMAIL]
    );
    if (viewerRes.rows.length === 0) {
      viewerRes = await pool.query(
        `SELECT id, name, city FROM users WHERE city = 'Milano' ORDER BY created_at ASC LIMIT 1`
      );
    }
    if (viewerRes.rows.length === 0) {
      viewerRes = await pool.query(
        `SELECT id, name, city FROM users ORDER BY created_at ASC LIMIT 1`
      );
    }
    if (viewerRes.rows.length === 0) {
      console.error('❌ Hiç kullanıcı bulunamadı. Önce kayıt olun veya create_pulse_sample_data_milano.js çalıştırın.');
      process.exit(1);
    }

    const viewerId = viewerRes.rows[0].id;
    const city = viewerRes.rows[0].city || 'Milano';
    console.log(`✅ Viewer: ${viewerRes.rows[0].name} (${city})`);

    // 2) Arkadaşları oluştur / bul
    async function getOrCreateUser(name) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
        [name, city]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const r = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, city, 'Politecnico di Milano', 7.0]
      );
      return r.rows[0].id;
    }

    const elenaId = await getOrCreateUser('Elena');
    const marcoId = await getOrCreateUser('Marco');
    const batuId = await getOrCreateUser('Batu');
    const annaId = await getOrCreateUser('Anna');
    const lucaId = await getOrCreateUser('Luca');

    // 3) Arkadaşlıkları oluştur (viewer ↔ friends)
    const friendPairs = [
      [viewerId, elenaId],
      [viewerId, marcoId],
      [viewerId, batuId],
      [viewerId, annaId],
      [viewerId, lucaId],
    ];
    for (const [u, f] of friendPairs) {
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [u, f]
      );
      // Reverse
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [f, u]
      );
    }
    console.log('✅ Arkadaşlıklar oluşturuldu (Elena, Marco, Batu, Anna, Luca)');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 4) Ritüelleri oluştur / bul
    async function getOrCreateRitual(title, venueName, startTime, hostId, status, type = 'Social') {
      const existing = await pool.query(
        `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 ORDER BY created_at DESC LIMIT 1`,
        [title, venueName]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const r = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, 90, 20, 'open', 45.4642, 9.1900, $5, $6)
         RETURNING id`,
        [title, type, venueName, startTime, hostId, status]
      );
      return r.rows[0].id;
    }

    // Arkadaşların ev sahipliği yaptığı ritüeller (is_friend_hosting için)
    const coffeeRitualId = await getOrCreateRitual(
      'Elena\'s Morning Coffee',
      'Rango Coffee',
      new Date(now.getTime() - 48 * 60 * 60 * 1000),
      elenaId,
      'ended',
      'Social'
    );
    const yogaRitualId = await getOrCreateRitual(
      'Anna\'s Yoga Circle',
      'Parco Sempione',
      new Date(now.getTime() + 2 * 60 * 60 * 1000),
      annaId,
      'upcoming',
      'Active'
    );
    const jazzRitualId = await getOrCreateRitual(
      'Marco\'s Jazz Night',
      'Blue Note Milano',
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0),
      marcoId,
      'upcoming',
      'Music'
    );
    const dinnerRitualId = await getOrCreateRitual(
      'Luca\'s Dinner & Philosophy',
      'Isola Milano',
      new Date(now.getTime() + 24 * 60 * 60 * 1000),
      lucaId,
      'upcoming',
      'Social'
    );
    // Brunch - Friend became friends için (viewer + Elena aynı ritüele katıldı)
    // Ritüel geçmişte başlamalı (friendship created_at'tan önce)
    const brunchStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const brunchRitualId = await getOrCreateRitual(
      'Friends Brunch Circle',
      'Brera',
      brunchStart,
      elenaId,
      'live',
      'Social'
    );

    // 5) Arkadaşlardan pulse memory'ler (Friends sekmesinde görünmesi için is_friend_source = true)
    const memories = [
      {
        ritual_id: coffeeRitualId,
        user_id: elenaId,
        content: 'Such a great vibe! 🤍',
        spotify_playlist_url: null,
      },
      {
        ritual_id: coffeeRitualId,
        user_id: marcoId,
        content: 'The best conversations happen over coffee, not screens.',
        spotify_playlist_url: null,
      },
      {
        ritual_id: jazzRitualId,
        user_id: batuId,
        content: 'Late Night Jazz playlist',
        spotify_playlist_url: 'https://open.spotify.com/playlist/37i9dQZF1DX4sWSpwq3LiO',
      },
      {
        ritual_id: yogaRitualId,
        user_id: annaId,
        content: 'This book changed how I think about rituals and connection. Highly recommend!',
        spotify_playlist_url: null,
      },
    ];

    for (const m of memories) {
      const exists = await pool.query(
        `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
        [m.ritual_id, m.user_id]
      );
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at, spotify_playlist_url)
           VALUES ($1, $2, $3, 'pulse', $4, $5)`,
          [m.ritual_id, m.user_id, m.content, expiresAt, m.spotify_playlist_url]
        );
      }
    }
    console.log('✅ Arkadaşlardan pulse memory\'ler eklendi (Elena, Marco, Batu, Anna)');

    // 6) Arkadaş katılımları (friends_here) - Yoga'da 3 arkadaş
    const yogaAttendees = [elenaId, marcoId, batuId];
    for (const uid of yogaAttendees) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
        [yogaRitualId, uid]
      );
    }

    // Jazz'da arkadaşlar ilgili (friends_interested - ritual_interest tablosu varsa)
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [jazzRitualId, elenaId]
    );

    // 7) Viewer Brunch'a katılsın (friend became friends için)
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
      [brunchRitualId, elenaId]
    );

    // 8) Friend became friends: Elena ile son 24 saat içinde arkadaş oldu + ikisi de Brunch'a katıldı
    await pool.query(
      `UPDATE friendships
       SET created_at = $1
       WHERE (user_id = $2 AND friend_id = $3) OR (user_id = $3 AND friend_id = $2)`,
      [new Date(now.getTime() - 30 * 60 * 1000), viewerId, elenaId]
    );
    console.log('✅ Friend became friends event ayarlandı (Brunch Circle)');

    console.log('\n📱 Friends sekmesi verileri hazır:');
    console.log('   - Pulse memories (arkadaşlardan): Elena, Marco, Batu, Anna');
    console.log('   - Friend activity: Yoga\'da 3 arkadaş, Jazz\'da ilgili arkadaş');
    console.log('   - Friend hosting: Luca (Dinner), Anna (Yoga), Marco (Jazz)');
    console.log('   - Friend became friends: Brunch Circle');
    console.log('\n   Uygulamada Friends sekmesine geçin ve yenileyin.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

main();
