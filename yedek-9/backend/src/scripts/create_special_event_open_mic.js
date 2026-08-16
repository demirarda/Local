import pool from '../config/database.js';

async function createSpecialEventOpenMic() {
  try {
    console.log('Creating Campus Open Mic Night special event...');

    // 1) Host user in Milano (re-use if exists)
    const hostName = 'Open Mic Host';
    let hostId;

    const existingHost = await pool.query(
      'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
      [hostName, 'Milano']
    );

    if (existingHost.rows.length > 0) {
      hostId = existingHost.rows[0].id;
      console.log('ℹ️ Reusing existing host user:', hostId);
    } else {
      const createdHost = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [hostName, 'Milano', 'Politecnico di Milano', 7.8]
      );
      hostId = createdHost.rows[0].id;
      console.log('✅ Created host user:', hostId);
    }

    // 2) Mark host as verified (spec 5.4)
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'active',
             verified_by = EXCLUDED.verified_by,
             verification_type = EXCLUDED.verification_type,
             verified_at = CURRENT_TIMESTAMP`,
      [hostId]
    );

    // 3) Ensure venue verification for Student Union Hall in Milano
    await pool.query(
      `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
       VALUES ($1, $2, 'admin', 'standard', 'active')
       ON CONFLICT (venue_name, city) DO UPDATE
         SET status = 'active',
             verified_by = EXCLUDED.verified_by,
             verification_type = EXCLUDED.verification_type,
             verified_at = CURRENT_TIMESTAMP`,
      ['Student Union Hall', 'Milano']
    );

    const now = new Date();
    // Start 45 minutes from now so it appears as "starting soon"
    const startTime = new Date(now.getTime() + 45 * 60 * 1000);

    // 4) Create ritual if not already existing
    const existingRitual = await pool.query(
      `SELECT id FROM rituals
       WHERE title = $1 AND venue_name = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      ['Campus Open Mic Night', 'Student Union Hall']
    );

    if (existingRitual.rows.length > 0) {
      console.log('ℹ️ Campus Open Mic Night already exists with id:', existingRitual.rows[0].id);
      process.exit(0);
    }

    const result = await pool.query(
      `INSERT INTO rituals (
         title, type, venue_name, start_time, duration,
         capacity, entry_type, location_lat, location_lng, host_id, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        'Campus Open Mic Night',
        'Special Event',       // key for SpecialEventCard
        'Student Union Hall',
        startTime,
        150,                   // 2.5 hours
        80,
        'request_seat',
        45.465,                // sample Milano-ish coords
        9.1905,
        hostId,
        'upcoming',
      ]
    );

    console.log('✅ Created Campus Open Mic Night with id:', result.rows[0].id);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Campus Open Mic Night special event:', error);
    process.exit(1);
  }
}

createSpecialEventOpenMic();

