/**
 * Seed script: Arda Demir için Pulse ekranında All, Live Now, Friends, Followed,
 * Special Events ve Nearby sekmelerinde görünecek verileri veritabanına ekler.
 *
 * - All: karışık ritüeller (live, starting soon, special, almost full) + host memory + venue activity + friend activity
 * - Live Now: canlı ritüeller (takip edilen host + arkadaş katılımlı)
 * - Friends: arkadaşların katıldığı ritüeller + arkadaş pulse memory + friend became friends
 * - Followed: Brunch Host / Run Host tarafından host edilen ritüeller + venue activity
 * - Special Events: type = 'Special Event' ritüeller
 * - Nearby: aynı ritüeller konum açıldığında (lat/lng/radius) filtrelenir
 *
 * Önce seed_social_passport_arda.js çalıştırılmış olmalı (Arda + takip edilen hostlar).
 * Kullanım: node src/scripts/seed_pulse_arda.js
 */

import pool from '../config/database.js';

const TARGET_USER_NAME = 'Arda Demir';
const TARGET_CITY = 'Istanbul';
const TARGET_UNIVERSITY = 'Firat (Euphrates) University';

function now() {
  return new Date();
}

function addMinutes(d, mins) {
  return new Date(d.getTime() + mins * 60 * 1000);
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  try {
    console.log('🔍 Arda Demir kullanıcısı aranıyor...');

    const userRes = await pool.query(
      `SELECT id, name, city FROM users WHERE name ILIKE $1 AND city = $2 LIMIT 1`,
      ['%Arda Demir%', TARGET_CITY]
    );
    if (userRes.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, name, city FROM users WHERE name ILIKE $1 LIMIT 1`,
        ['%arda%']
      );
      if (fallback.rows.length === 0) {
        console.error('❌ "Arda Demir" kullanıcısı bulunamadı. Önce uygulamada bu isimle kayıt olun veya seed_social_passport_arda.js çalıştırın.');
        process.exit(1);
      }
      userRes.rows = fallback.rows;
    }

    const ardaId = userRes.rows[0].id;
    const ardaName = userRes.rows[0].name;
    console.log(`✅ Kullanıcı: ${ardaName} (${ardaId})`);

    // Host'ları al (Istanbul, Arda'nın takip ettiği) – seed_social_passport_arda ile uyumlu isimler
    const hostsRes = await pool.query(
      `SELECT u.id, u.name FROM users u
       INNER JOIN follows f ON f.following_id = u.id AND f.follower_id = $1
       WHERE u.city = $2
       LIMIT 10`,
      [ardaId, TARGET_CITY]
    );
    if (hostsRes.rows.length === 0) {
      console.error('❌ Arda\'nın takip ettiği Istanbul host bulunamadı. Önce seed_social_passport_arda.js çalıştırın.');
      process.exit(1);
    }
    const hostIds = hostsRes.rows.map(r => r.id);
    const brunchHostId = hostsRes.rows.find(h => (h.name || '').includes('Brunch'))?.id || hostIds[0];
    const runHostId = hostsRes.rows.find(h => (h.name || '').includes('Run'))?.id || hostIds[1] || hostIds[0];
    const studyHostId = hostsRes.rows.find(h => (h.name || '').includes('Study'))?.id || hostIds[0];
    const cafeHostId = hostsRes.rows.find(h => (h.name || '').includes('Café') || (h.name || '').includes('Cafe'))?.id || hostIds[1] || hostIds[0];

    // Takip edilen host'ları verified yap (Followed sekmesi + pulse memory uygunluğu)
    for (const hid of [brunchHostId, runHostId]) {
      await pool.query(
        `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
         VALUES ($1, 'admin', 'standard', 'active')
         ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
        [hid]
      );
    }
    console.log('✅ Brunch & Run Host verified (Followed + memories).');

    // Venue verification (Venue Activity kartları için)
    const venuesToVerify = ['Kadıköy Sahil', 'Kadıköy Café', 'Maçka Park', 'Central Library'];
    for (const venueName of venuesToVerify) {
      await pool.query(
        `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
         VALUES ($1, $2, 'admin', 'standard', 'active')
         ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
        [venueName, TARGET_CITY]
      );
    }
    console.log('✅ Venue verifications eklendi (Venue Activity).');

    // Arda'nın arkadaşları – yoksa oluştur (Friends sekmesi için)
    let friendIds = [];
    const friendNames = ['Elif', 'Burak', 'Cem'];
    for (const fname of friendNames) {
      let friendRes = await pool.query(
        `SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
        [fname, TARGET_CITY]
      );
      if (friendRes.rows.length === 0) {
        const ins = await pool.query(
          `INSERT INTO users (name, city, university, rs_score) VALUES ($1, $2, $3, 6.5) RETURNING id`,
          [fname, TARGET_CITY, 'Boğaziçi University']
        );
        friendIds.push(ins.rows[0].id);
      } else {
        friendIds.push(friendRes.rows[0].id);
      }
    }
    for (const fid of friendIds) {
      if (fid === ardaId) continue;
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [ardaId, fid]
      );
    }
    console.log('✅ Arkadaşlar hazır (Friends sekmesi):', friendNames.join(', '));

    const baseTime = now();
    const lat = 41.0082;
    const lng = 28.9784;
    const duration = 90;
    const capacity = 20;

    /** Aynı title+venue için tek satır — script tekrar çalışınca çift “Sunset Yoga” oluşmasın */
    async function getOrCreateRitual(title, type, venueName, startTime, hostId, status = 'upcoming', cap = capacity) {
      const existing = await pool.query(
        `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 ORDER BY created_at DESC LIMIT 1`,
        [title, venueName]
      );
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await pool.query(
          `UPDATE rituals SET type = $1, start_time = $2, duration = $3, capacity = $4, host_id = $5, status = $6,
           location_lat = $7, location_lng = $8, entry_type = 'open', updated_at = CURRENT_TIMESTAMP
           WHERE id = $9`,
          [type, startTime, duration, cap, hostId, status, lat, lng, id]
        );
        return { id, title, start_time: startTime };
      }
      const r = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10)
         RETURNING id, title, start_time`,
        [title, type, venueName, startTime, duration, cap, lat, lng, hostId, status]
      );
      return r.rows[0];
    }

    // ----- Live Now (5+) -----
    const liveStart = addMinutes(baseTime, -35);
    const liveVenue = 'Kadıköy Sahil';
    const liveRituals = [];
    const liveTitles = ['Sunrise Yoga', 'Morning Run Club', 'Coffee & Focus', 'Study Sprint', 'Brunch Circle Live'];
    for (let i = 0; i < 5; i++) {
      const start = addMinutes(liveStart, i * 5);
      const hostId = [brunchHostId, runHostId, cafeHostId, studyHostId, brunchHostId][i];
      const r = await getOrCreateRitual(liveTitles[i], 'Social', liveVenue, start, hostId, 'live');
      liveRituals.push(r);
    }
    console.log('✅ 5 Live Now ritüeli eklendi.');

    // Arkadaşları bazı live ritüellere katılmış yap (Friends + Live Now)
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'joined', CURRENT_TIMESTAMP)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [liveRituals[0].id, friendIds[0]]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'joined', CURRENT_TIMESTAMP)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [liveRituals[1].id, friendIds[1]]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'joined', CURRENT_TIMESTAMP)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [liveRituals[2].id, friendIds[0]]
    );
    console.log('✅ Friends Live Now: Elif/Burak/Cem bazı canlı ritüellere katıldı.');

    // ----- Special Events (3) -----
    const specialLiveStart = addMinutes(baseTime, -20);
    const special1 = await getOrCreateRitual('Istanbul Marathon Warm-Up', 'Special Event', 'Maçka Park', specialLiveStart, runHostId, 'live');
    const special2Start = addMinutes(baseTime, 25);
    const special2 = await getOrCreateRitual('Boğaziçi Night Run', 'Special Event', 'Boğaziçi Kampus', special2Start, runHostId, 'upcoming');
    const special3Start = addMinutes(baseTime, 60);
    const special3 = await getOrCreateRitual('Campus Festival Opening', 'Special Event', 'Kadıköy Sahil', special3Start, brunchHostId, 'upcoming');
    console.log('✅ 3 Special Event eklendi (1 live, 2 starting soon).');

    // ----- Starting Soon (2) -----
    const soon1Start = addMinutes(baseTime, 15);
    const soon2Start = addMinutes(baseTime, 45);
    const soon1 = await getOrCreateRitual('Evening Study Group', 'Study', 'Central Library', soon1Start, studyHostId || hostIds[0], 'upcoming');
    const soon2 = await getOrCreateRitual('Night Café Session', 'Social', 'Kadıköy Café', soon2Start, cafeHostId, 'upcoming');
    console.log('✅ 2 Starting Soon ritüeli eklendi.');

    // ----- Almost Full (Followed + All) – 8/10 dolu -----
    const almostFullStart = addMinutes(baseTime, 30);
    const almostFull = await getOrCreateRitual('Sunset Yoga', 'Wellness', 'Maçka Park', almostFullStart, brunchHostId, 'upcoming', 10);
    const eightAttendees = [friendIds[0], friendIds[1], friendIds[2], ardaId, ...hostIds.slice(0, 4)].filter(Boolean);
    for (const uid of eightAttendees.slice(0, 8)) {
      if (uid === brunchHostId) continue; // host zaten var
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
         VALUES ($1, $2, 'joined', CURRENT_TIMESTAMP)
         ON CONFLICT (ritual_id, user_id) DO NOTHING`,
        [almostFull.id, uid]
      );
    }
    console.log('✅ 1 Almost Full ritüeli eklendi (Sunset Yoga).');

    // ----- Friend Activity: Arkadaş starting-soon ritüeline katılmış -----
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'joined', CURRENT_TIMESTAMP)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
      [soon1.id, friendIds[0]]
    );
    console.log('✅ Friend Activity: Elif "Evening Study Group" ritüeline katıldı.');

    // ----- Host Memory Share (Followed + All): Brunch Host pulse memory -----
    const memoryRitualId = special3.id;
    const expiresAt = addMinutes(baseTime, 24 * 60);
    await pool.query(
      `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
       VALUES ($1, $2, $3, 'pulse', $4)`,
      [memoryRitualId, brunchHostId, 'Harika bir açılış ritüeli oldu. Herkese teşekkürler! 🎉', expiresAt]
    );
    console.log('✅ 1 Host Memory Share (Brunch Host) pulse memory eklendi.');

    // ----- Friend pulse memory (Friends sekmesi) – arkadaş paylaşımı -----
    const friendMemoryRitualId = liveRituals[2].id;
    await pool.query(
      `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
       VALUES ($1, $2, $3, 'pulse', $4)`,
      [friendMemoryRitualId, friendIds[0], 'Such a great vibe! ☕', expiresAt]
    );
    console.log('✅ 1 Friend pulse memory eklendi (Friends sekmesi).');

    // ----- Friend became friends (pulse-events): Arda + arkadaş aynı ritüelde, son 24 saatte arkadaşlık
    const sharedRitualStart = addDays(baseTime, -2);
    sharedRitualStart.setHours(19, 0, 0, 0);
    const sharedRitual = await getOrCreateRitual('Past Brunch Meet', 'Social', 'Kadıköy Café', sharedRitualStart, brunchHostId, 'ended');
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'checked_in', $3)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
      [sharedRitual.id, ardaId, sharedRitualStart]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
       VALUES ($1, $2, 'checked_in', $3)
       ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
      [sharedRitual.id, friendIds[1], sharedRitualStart]
    );
    await pool.query(
      `UPDATE friendships SET created_at = NOW() - INTERVAL '2 hours'
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [ardaId, friendIds[1]]
    );
    console.log('✅ Friend became friends: Arda & Burak aynı ritüelde, son 24h içinde arkadaş oldu.');

    console.log('\n📱 Pulse sekmeleri (veritabanından):');
    console.log('   • All: live, starting soon, special, almost full, host memory, friend activity, venue activity');
    console.log('   • Live Now: canlı ritüeller (arkadaş katılımlı)');
    console.log('   • Friends: arkadaş katıldığı ritüeller + arkadaş memory + friend became friends');
    console.log('   • Followed: Brunch/Run Host ritüelleri + venue activity');
    console.log('   • Special Events: 3 özel etkinlik');
    console.log('   • Nearby: Aynı ritüeller konum açıkken mesafeye göre listelenir.');
    console.log('\n   Uygulamada Arda Demir ile giriş yapıp Pulse ekranını yenileyin.\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

main();
