/**
 * Seed script: Arda Demir kullanıcısı için
 * - Geçmiş ritüel katılımları (Past Memories dolu görünsün)
 * - Takip edilen host/kullanıcılar (Following dolu görünsün)
 * Veritabanına kalıcı yazılır.
 *
 * Kullanım: node src/scripts/seed_social_passport_arda.js
 * Önce uygulamada "Arda Demir" ile kayıt olmuş olmalı.
 */

import pool from '../config/database.js';

const TARGET_USER_NAME = 'Arda Demir';
const TARGET_UNIVERSITY = 'Firat (Euphrates) University';
const TARGET_CITY = 'Istanbul';

async function main() {
  try {
    console.log('🔍 Arda Demir kullanıcısı aranıyor...');

    const userRes = await pool.query(
      `SELECT id, name FROM users WHERE name ILIKE $1 OR (name ILIKE $2 AND (university ILIKE $3 OR city = $4)) LIMIT 1`,
      ['%Arda Demir%', 'Arda Demir', '%Firat%', TARGET_CITY]
    );

    if (userRes.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, name FROM users WHERE name ILIKE $1 LIMIT 1`,
        ['%arda%']
      );
      if (fallback.rows.length === 0) {
        console.error('❌ "Arda Demir" kullanıcısı bulunamadı. Önce uygulamada bu isimle kayıt olun.');
        process.exit(1);
      }
      userRes.rows = fallback.rows;
    }

    const ardaId = userRes.rows[0].id;
    const ardaName = userRes.rows[0].name;
    console.log(`✅ Kullanıcı bulundu: ${ardaName} (${ardaId})`);

    // Takip edilecek host/kullanıcılar – yoksa oluştur
    async function getOrCreateUser(name, city = TARGET_CITY, university = TARGET_UNIVERSITY) {
      const r = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
        [name, city]
      );
      if (r.rows.length > 0) return r.rows[0].id;
      const ins = await pool.query(
        `INSERT INTO users (name, city, university, rs_score) VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, city, university, 7.0]
      );
      return ins.rows[0].id;
    }

    const host1Id = await getOrCreateUser('Study Host');
    const host2Id = await getOrCreateUser('Café Host Istanbul');
    const host3Id = await getOrCreateUser('Yoga Host Istanbul');
    const host4Id = await getOrCreateUser('Run Host Istanbul');
    const host5Id = await getOrCreateUser('Brunch Host Istanbul');
    const hostIds = [host1Id, host2Id, host3Id, host4Id, host5Id];
    console.log('✅ Host kullanıcılar hazır');

    // Arda bu hostları takip etsin (Following listesi)
    for (const followingId of hostIds) {
      if (followingId === ardaId) continue;
      await pool.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [ardaId, followingId]
      );
    }
    console.log('✅ Following kayıtları eklendi (Arda → hostlar)');

    // Geçmiş ritüeller (ended) – son 2 hafta içinde bitmiş
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    async function createPastRitual(title, venueName, startTime, duration, hostId, type = 'Social') {
      const r = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, $5, 20, 'open', 41.0082, 28.9784, $6, 'ended')
         RETURNING id`,
        [title, type, venueName, startTime, duration, hostId]
      );
      return r.rows[0].id;
    }

    const pastRituals = [
      { title: 'Study Session', venue: 'Central Library', daysAgo: 2, duration: 120, hostId: host1Id, type: 'Study' },
      { title: 'Coffee & Chat', venue: 'Kadıköy Café', daysAgo: 5, duration: 90, hostId: host2Id, type: 'Social' },
      { title: 'Morning Yoga', venue: 'Maçka Park', daysAgo: 7, duration: 60, hostId: host3Id, type: 'Wellness' },
      { title: 'Sunset Run', venue: 'Maçka Park', daysAgo: 10, duration: 90, hostId: host4Id, type: 'Active' },
      { title: 'Brunch Circle', venue: 'Brera', daysAgo: 12, duration: 90, hostId: host5Id, type: 'Social' },
    ];

    const ritualIds = [];
    for (const r of pastRituals) {
      const start = new Date(twoWeeksAgo.getTime() + r.daysAgo * 24 * 60 * 60 * 1000);
      start.setHours(10, 0, 0, 0);
      const id = await createPastRitual(r.title, r.venue, start, r.duration, r.hostId, r.type);
      ritualIds.push(id);
    }
    console.log('✅ Geçmiş ritüeller oluşturuldu (ended):', ritualIds.length);

    // Arda bu ritüellere katılmış olsun (Past Memories)
    for (const ritualId of ritualIds) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
         VALUES ($1, $2, 'checked_in', CURRENT_TIMESTAMP)
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
        [ritualId, ardaId]
      );
    }
    console.log('✅ Ritüel katılımları eklendi (Arda – Past Memories)');

    console.log('\n📱 Social Passport ekranında Following ve Past Memories artık dolu görünecek.');
    console.log('   Uygulamada profili yenileyin (veya tekrar giriş yapın).\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Hata:', err);
    process.exit(1);
  }
}

main();
