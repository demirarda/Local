import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

// Istanbul test user – tüm Pulse kartlarını görmek için bu hesapla giriş yapın
const PULSE_TEST_EMAIL_IST = 'istanbul@test.local';
const PULSE_TEST_PASSWORD = 'Test123!';
const VIEWER_ID_ISTANBUL = 'a1b2c3d4-5678-90ab-cdef-222222222222';

async function createPulseSampleDataIstanbul() {
  try {
    console.log('Creating Pulse sample data for Istanbul...');

    const viewerId = VIEWER_ID_ISTANBUL;
    const city = 'Istanbul';
    const passwordHash = await bcrypt.hash(PULSE_TEST_PASSWORD, 10);

    const existingViewer = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [viewerId]
    );

    if (existingViewer.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (id, name, city, university, rs_score, email, password_hash, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [viewerId, 'Pulse Istanbul', city, 'Boğaziçi University', 7.5, PULSE_TEST_EMAIL_IST, passwordHash]
      );
      console.log('✅ Istanbul viewer created (login: ' + PULSE_TEST_EMAIL_IST + ' / ' + PULSE_TEST_PASSWORD + ')');
    } else {
      await pool.query(
        `UPDATE users SET email = $1, password_hash = $2, email_verified = true, city = $3, name = COALESCE(NULLIF(name, ''), 'Pulse Istanbul')
         WHERE id = $4`,
        [PULSE_TEST_EMAIL_IST, passwordHash, city, viewerId]
      );
      console.log('ℹ️ Istanbul viewer updated – login: ' + PULSE_TEST_EMAIL_IST + ' / ' + PULSE_TEST_PASSWORD);
    }

    async function getOrCreateUser(name) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
        [name, city]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const result = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, city, 'Boğaziçi University', 7.0]
      );
      return result.rows[0].id;
    }

    const studyHostId = await getOrCreateUser('Study Host');
    const brunchHostId = await getOrCreateUser('Brunch Host Istanbul');
    const yogaHostId = await getOrCreateUser('Yoga Host Istanbul');
    const runHostId = await getOrCreateUser('Run Host Istanbul');
    const cafeHostId = await getOrCreateUser('Café Host Istanbul');
    const friend1Id = await getOrCreateUser('Friend Istanbul 1');
    const friend2Id = await getOrCreateUser('Friend Istanbul 2');

    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [studyHostId]
    );
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [cafeHostId]
    );

    async function upsertVenueVerification(venueName) {
      await pool.query(
        `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
         VALUES ($1, $2, 'admin', 'standard', 'active')
         ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
        [venueName, city]
      );
    }
    await upsertVenueVerification('Central Library');
    await upsertVenueVerification('Kadıköy Café');

    async function getOrCreateRitual(title, venueName, startTime, duration, capacity, entryType, hostId, status, type) {
      const existing = await pool.query(
        `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 ORDER BY created_at DESC LIMIT 1`,
        [title, venueName]
      );
      if (existing.rows.length > 0) return existing.rows[0].id;
      const result = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 41.0082, 28.9784, $8, $9)
         RETURNING id`,
        [title, type, venueName, startTime, duration, capacity, entryType, hostId, status]
      );
      return result.rows[0].id;
    }

    const now = new Date();

    // Special Event – Istanbul
    const tonight2030 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0, 0);
    await getOrCreateRitual(
      'Istanbul Jazz Night',
      'Kadıköy Moda',
      tonight2030,
      120,
      50,
      'request_seat',
      studyHostId,
      'upcoming',
      'Special Event'
    );
    await pool.query(
      `UPDATE rituals SET type = $1 WHERE title = $2 AND venue_name = $3`,
      ['Special Event', 'Istanbul Jazz Night', 'Kadıköy Moda']
    );

    // Live Now – Live Study Session (screenshot’taki gibi)
    const todayStart = new Date(now.getTime() - 60 * 60 * 1000);
    const liveStudyId = await getOrCreateRitual(
      'Live Study Session',
      'Central Library',
      todayStart,
      120,
      20,
      'open',
      studyHostId,
      'live',
      'Social'
    );

    // Brunch – Friend Became Friends için
    const brunchStart = new Date(now.getTime() - 90 * 60 * 1000);
    const brunchRitualId = await getOrCreateRitual(
      'Brunch Circle',
      'Brera',
      brunchStart,
      90,
      20,
      'open',
      brunchHostId,
      'live',
      'Social'
    );

    // Starting soon
    const yogaStart = new Date(now.getTime() + 25 * 60 * 1000);
    const yogaRitualId = await getOrCreateRitual(
      'Morning Yoga Session',
      'Maçka Park',
      yogaStart,
      60,
      15,
      'open',
      yogaHostId,
      'upcoming',
      'Active'
    );
    const runStart = new Date(now.getTime() + 75 * 60 * 1000);
    await getOrCreateRitual(
      'Sunset Run & Chill',
      'Maçka Park',
      runStart,
      90,
      30,
      'open',
      runHostId,
      'upcoming',
      'Active'
    );

    // Venue Activity – Kadıköy Café
    const today14 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);
    const today17 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0, 0);
    const today20 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
    await getOrCreateRitual('Book Club', 'Kadıköy Café', today14, 90, 12, 'open', cafeHostId, 'upcoming', 'Culture');
    await getOrCreateRitual('Writing Hour', 'Kadıköy Café', today17, 90, 10, 'open', cafeHostId, 'upcoming', 'Culture');
    await getOrCreateRitual('Poetry Night', 'Kadıköy Café', today20, 90, 20, 'open', cafeHostId, 'upcoming', 'Culture');

    // Friendships & attendance
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`,
      [viewerId, friend1Id]
    );
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'accepted') ON CONFLICT DO NOTHING`,
      [viewerId, friend2Id]
    );

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status) VALUES ($1, $2, 'joined') ON CONFLICT DO NOTHING`,
      [yogaRitualId, friend1Id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status) VALUES ($1, $2, 'joined') ON CONFLICT DO NOTHING`,
      [yogaRitualId, friend2Id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status) VALUES ($1, $2, 'joined') ON CONFLICT DO NOTHING`,
      [liveStudyId, viewerId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status) VALUES ($1, $2, 'joined') ON CONFLICT DO NOTHING`,
      [brunchRitualId, viewerId]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status) VALUES ($1, $2, 'joined') ON CONFLICT DO NOTHING`,
      [brunchRitualId, friend1Id]
    );

    // Host Memory Share – café host’un paylaştığı memory
    const aperitivoStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    let memRitualRes = await pool.query(
      `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 LIMIT 1`,
      ['Sunset Aperitivo Istanbul', 'Bebek Terrace']
    );
    let memRitualId = memRitualRes.rows[0]?.id;
    if (!memRitualId) {
      const ins = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, 120, 30, 'open', 41.0082, 28.9784, $5, 'ended')
         RETURNING id`,
        ['Sunset Aperitivo Istanbul', 'Social', 'Bebek Terrace', aperitivoStart, cafeHostId]
      );
      memRitualId = ins.rows[0].id;
    }
    const existingHostMem = await pool.query(
      `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
      [memRitualId, cafeHostId]
    );
    if (existingHostMem.rows.length === 0) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
         VALUES ($1, $2, $3, 'pulse', $4)`,
        [memRitualId, cafeHostId, 'Shared a ritual memory: Sunset Aperitivo at Bebek Terrace.', expiresAt]
      );
      console.log('✅ Host Memory Share (Istanbul) created');
    }

    await pool.query(
      `UPDATE friendships SET created_at = $1
       WHERE ((user_id = $2 AND friend_id = $3) OR (user_id = $3 AND friend_id = $2))`,
      [new Date(now.getTime() - 30 * 60 * 1000), viewerId, friend1Id]
    );

    console.log('\n✅ Pulse sample data for Istanbul created/updated.');
    console.log('\n📱 Istanbul kullanıcısıyla tüm kartları görmek için:');
    console.log('   Email: ' + PULSE_TEST_EMAIL_IST);
    console.log('   Şifre: ' + PULSE_TEST_PASSWORD);
    console.log('   Giriş sonrası Pulse sekmesinde yenileyin.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createPulseSampleDataIstanbul();
