import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

// Test user for Pulse – tüm kartları görmek için bu hesapla giriş yapın
const PULSE_TEST_EMAIL = 'pulse@test.local';
const PULSE_TEST_PASSWORD = 'Test123!';

async function createPulseSampleDataMilano() {
  try {
    console.log('Creating Pulse sample data for Milano...');

    // 1) Ensure viewer user exists and can log in (email + password)
    const viewerId = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';
    const passwordHash = await bcrypt.hash(PULSE_TEST_PASSWORD, 10);

    const existingViewer = await pool.query(
      'SELECT id, email FROM users WHERE id = $1',
      [viewerId]
    );

    if (existingViewer.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (id, name, city, university, rs_score, email, password_hash, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [viewerId, 'Pulse Test', 'Milano', 'Politecnico di Milano', 7.5, PULSE_TEST_EMAIL, passwordHash]
      );
      console.log('✅ Viewer user created (login: ' + PULSE_TEST_EMAIL + ' / ' + PULSE_TEST_PASSWORD + ')');
    } else {
      await pool.query(
        `UPDATE users SET email = $1, password_hash = $2, email_verified = true, name = COALESCE(NULLIF(name, ''), 'Pulse Test')
         WHERE id = $3`,
        [PULSE_TEST_EMAIL, passwordHash, viewerId]
      );
      console.log('ℹ️ Viewer user updated – login: ' + PULSE_TEST_EMAIL + ' / ' + PULSE_TEST_PASSWORD);
    }

    // 2) Create hosts and friends (re-use if already there by name + city)
    async function getOrCreateUser(name) {
      const existing = await pool.query(
        'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
        [name, 'Milano']
      );
      if (existing.rows.length > 0) {
        return existing.rows[0].id;
      }
      const result = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, 'Milano', 'Politecnico di Milano', 7.0]
      );
      return result.rows[0].id;
    }

    const jazzHostId = await getOrCreateUser('Jazz Host');
    const brunchHostId = await getOrCreateUser('Brunch Host');
    const yogaHostId = await getOrCreateUser('Yoga Host');
    const runHostId = await getOrCreateUser('Run Host');
    const caffeHostId = await getOrCreateUser('Caffè Host');
    const friend1Id = await getOrCreateUser('Friend 1');
    const friend2Id = await getOrCreateUser('Friend 2');

    console.log('✅ Hosts and friends ensured');

    // 3) Host / Venue verifications
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'active',
             verified_by = EXCLUDED.verified_by,
             verification_type = EXCLUDED.verification_type,
             verified_at = CURRENT_TIMESTAMP`,
      [brunchHostId]
    );

    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'active',
             verified_by = EXCLUDED.verified_by,
             verification_type = EXCLUDED.verification_type,
             verified_at = CURRENT_TIMESTAMP`,
      [caffeHostId]
    );

    async function upsertVenueVerification(venueName) {
      await pool.query(
        `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
         VALUES ($1, $2, 'admin', 'standard', 'active')
         ON CONFLICT (venue_name, city) DO UPDATE
           SET status = 'active',
               verified_by = EXCLUDED.verified_by,
               verification_type = EXCLUDED.verification_type,
               verified_at = CURRENT_TIMESTAMP`,
        [venueName, 'Milano']
      );
    }

    await upsertVenueVerification('Navigli');
    await upsertVenueVerification('Caffè Letterario');

    console.log('✅ Host and venue verifications ensured');

    // Helper to avoid duplicating rituals on re-run
    async function getOrCreateRitual(title, venueName, startTime, duration, capacity, entryType, hostId, status, type) {
      const existing = await pool.query(
        `SELECT id FROM rituals
         WHERE title = $1 AND venue_name = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [title, venueName]
      );
      if (existing.rows.length > 0) {
        return existing.rows[0].id;
      }

      const result = await pool.query(
        `INSERT INTO rituals (
           title, type, venue_name, start_time, duration,
           capacity, entry_type, location_lat, location_lng, host_id, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          title,
          type,
          venueName,
          startTime,
          duration,
          capacity,
          entryType,
          45.4642,
          9.1900,
          hostId,
          status,
        ]
      );
      return result.rows[0].id;
    }

    const now = new Date();

    // Jazz Night at Blue Note – SPECIAL EVENT, starting_soon (20:30 tonight)
    const tonight2030 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      20,
      30,
      0,
      0
    );
    await getOrCreateRitual(
      'Jazz Night at Blue Note',
      'Navigli',
      tonight2030,
      120,
      50,
      'request_seat',
      jazzHostId,
      'upcoming',
      'Special Event'
    );
    // Ensure existing Jazz Night is also marked Special Event (for re-runs)
    await pool.query(
      `UPDATE rituals SET type = $1 WHERE title = $2 AND venue_name = $3`,
      ['Special Event', 'Jazz Night at Blue Note', 'Navigli']
    );

    // Brunch Circle – live now (11:30 today)
    const today1130 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      11,
      30,
      0,
      0
    );
    const brunchRitualId = await getOrCreateRitual(
      'Brunch Circle',
      'Brera',
      today1130,
      90,
      20,
      'open',
      brunchHostId,
      'live',
      'Social'
    );

    // Morning Yoga Session – starting soon (25 min)
    const yogaStart = new Date(now.getTime() + 25 * 60 * 1000);
    const yogaRitualId = await getOrCreateRitual(
      'Morning Yoga Session',
      'Parco Sempione',
      yogaStart,
      60,
      15,
      'open',
      yogaHostId,
      'upcoming',
      'Active'
    );

    // Sunset Run & Chill – starting soon (75 min)
    const runStart = new Date(now.getTime() + 75 * 60 * 1000);
    await getOrCreateRitual(
      'Sunset Run & Chill',
      'Parco Sempione',
      runStart,
      90,
      30,
      'open',
      runHostId,
      'upcoming',
      'Active'
    );

    // Caffè Letterario rituals for Venue Activity
    const today1400 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      14,
      0,
      0,
      0
    );
    const today1700 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17,
      0,
      0,
      0
    );
    const today2000 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      20,
      0,
      0,
      0
    );

    await getOrCreateRitual(
      'Book Discussion',
      'Caffè Letterario',
      today1400,
      90,
      12,
      'open',
      caffeHostId,
      'upcoming',
      'Culture'
    );
    await getOrCreateRitual(
      'Writing Circle',
      'Caffè Letterario',
      today1700,
      90,
      10,
      'open',
      caffeHostId,
      'upcoming',
      'Culture'
    );
    await getOrCreateRitual(
      'Poetry Reading',
      'Caffè Letterario',
      today2000,
      90,
      20,
      'open',
      caffeHostId,
      'upcoming',
      'Culture'
    );

    console.log('✅ Rituals ensured');

    // 4) Friendships and attendance
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT DO NOTHING`,
      [viewerId, friend1Id]
    );
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'accepted')
       ON CONFLICT DO NOTHING`,
      [viewerId, friend2Id]
    );

    // Friends join Morning Yoga Session
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [yogaRitualId, friend1Id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [yogaRitualId, friend2Id]
    );

    // Viewer joins Brunch Circle (Live Now)
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [brunchRitualId, viewerId]
    );

    // Friend 1 also joins Brunch (for "Friend became friends" pulse event: same ritual, recent friendship)
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [brunchRitualId, friend1Id]
    );

    console.log('✅ Friendships and attendance ensured');

    // 5) Sunset Aperitivo ritual + Pulse memory
    const existingAperitivo = await pool.query(
      `SELECT id FROM rituals
       WHERE title = $1 AND venue_name = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      ['Sunset Aperitivo', 'Terrazza Aperol']
    );

    let aperitivoRitualId;
    if (existingAperitivo.rows.length > 0) {
      aperitivoRitualId = existingAperitivo.rows[0].id;
    } else {
      const aperitivoStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const aperitivo = await pool.query(
        `INSERT INTO rituals (
           title, type, venue_name, start_time, duration,
           capacity, entry_type, location_lat, location_lng, host_id, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          'Sunset Aperitivo',
          'Social',
          'Terrazza Aperol',
          aperitivoStart,
          120,
          30,
          'open',
          45.4655,
          9.1900,
          caffeHostId,
          'live',
        ]
      );
      aperitivoRitualId = aperitivo.rows[0].id;
    }

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [aperitivoRitualId, viewerId]
    );

    // Pulse memory from VIEWER (optional; kept for backward compatibility)
    const existingMemory = await pool.query(
      `SELECT id FROM memories
       WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse'
       ORDER BY created_at DESC
       LIMIT 1`,
      [aperitivoRitualId, viewerId]
    );

    if (existingMemory.rows.length === 0) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO memories (
           ritual_id, user_id, content, memory_type, expires_at
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [aperitivoRitualId, viewerId, 'Sunset Aperitivo', 'pulse', expiresAt]
      );
      console.log('✅ Sunset Aperitivo pulse memory (viewer) created');
    }

    // HOST MEMORY SHARE: pulse memory from the HOST (Caffè Host) so card shows "HOST MEMORY SHARE"
    const existingHostMemory = await pool.query(
      `SELECT id FROM memories
       WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse'
       ORDER BY created_at DESC
       LIMIT 1`,
      [aperitivoRitualId, caffeHostId]
    );

    if (existingHostMemory.rows.length === 0) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO memories (
           ritual_id, user_id, content, memory_type, expires_at
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [aperitivoRitualId, caffeHostId, 'Shared a ritual memory: Sunset Aperitivo at Terrazza Aperol. High energy.', 'pulse', expiresAt]
      );
      console.log('✅ Host Memory Share (Caffè Host) pulse memory created');
    }

    // FRIEND BECAME FRIENDS: viewer and friend1 became friends recently and both attended same ritual (Brunch)
    // Set friendship created_at to 30 min ago so it's "recent" and ritual (Brunch) started before that
    await pool.query(
      `UPDATE friendships
       SET created_at = $1
       WHERE ((user_id = $2 AND friend_id = $3) OR (user_id = $3 AND friend_id = $2))`,
      [new Date(now.getTime() - 30 * 60 * 1000), viewerId, friend1Id]
    );
    console.log('✅ Friend became friends event (viewer + Friend 1 at Brunch) set');

    console.log('\n✅ Pulse sample data for Milano created/updated successfully!');
    console.log('   Cards: Special Event, Host Memory Share, Live Now, Venue Activity, Friend Activity, Starting Soon, Friend Became Friends');
    console.log('\n📱 Tüm kartları görmek için uygulamada şu hesapla giriş yapın:');
    console.log('   Email: ' + PULSE_TEST_EMAIL);
    console.log('   Şifre: ' + PULSE_TEST_PASSWORD);
    console.log('   Şehir: Milano (otomatik). Giriş sonrası Pulse sekmesinde yenileyin.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Pulse sample data for Milano:', error);
    process.exit(1);
  }
}

createPulseSampleDataMilano();

