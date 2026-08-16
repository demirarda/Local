import pool from '../config/database.js';

async function createPulseDemoData() {
  try {
    console.log('Creating Pulse demo data for Milano...');

    // 1) Ensure viewer user exists (matches mobile PulseScreen viewerId)
    const viewerId =
      'e7bac5bc-4793-4f9b-b945-27228ab4e649';

    await pool.query(
      `INSERT INTO users (id, name, city, university, rs_score)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [viewerId, 'You', 'Milano', 'Politecnico di Milano', 7.5]
    );

    // 2) Create hosts and friends
    const hostNames = [
      'Jazz Host',
      'Brunch Host',
      'Yoga Host',
      'Run Host',
      'Caffè Host',
    ];

    const friendNames = ['Friend 1', 'Friend 2'];

    const hostIds = {};
    for (const name of hostNames) {
      const result = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, 'Milano', 'Politecnico di Milano', 7.5]
      );
      hostIds[name] = result.rows[0].id;
    }

    const friendIds = {};
    for (const name of friendNames) {
      const result = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [name, 'Milano', 'Politecnico di Milano', 6.5]
      );
      friendIds[name] = result.rows[0].id;
    }

    console.log('✅ Hosts and friends created');

    const jazzHostId = hostIds['Jazz Host'];
    const brunchHostId = hostIds['Brunch Host'];
    const yogaHostId = hostIds['Yoga Host'];
    const runHostId = hostIds['Run Host'];
    const caffeHostId = hostIds['Caffè Host'];

    const friend1Id = friendIds['Friend 1'];
    const friend2Id = friendIds['Friend 2'];

    // 3) Host / venue verifications
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status`,
      [brunchHostId]
    );

    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status`,
      [caffeHostId]
    );

    await pool.query(
      `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
       VALUES ($1, $2, 'admin', 'standard', 'active')
       ON CONFLICT (venue_name, city) DO UPDATE SET status = EXCLUDED.status`,
      ['Navigli', 'Milano']
    );

    await pool.query(
      `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
       VALUES ($1, $2, 'admin', 'standard', 'active')
       ON CONFLICT (venue_name, city) DO UPDATE SET status = EXCLUDED.status`,
      ['Caffè Letterario', 'Milano']
    );

    console.log('✅ Verifications created');

    // 4) Rituals
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAt = (h, m) => {
      const d = new Date(today);
      d.setHours(h, m, 0, 0);
      return d;
    };
    
    // Special Event: Jazz Night at Blue Note (starting within 60 minutes so it appears in Pulse)
    // First, clean up any duplicates and keep only one
    const existingJazz = await pool.query(
      `SELECT id FROM rituals
       WHERE title = $1 AND venue_name = $2
       ORDER BY created_at ASC`,
      ['Jazz Night at Blue Note', 'Navigli']
    );
    if (existingJazz.rows.length > 1) {
      const idsToDelete = existingJazz.rows.slice(1).map(r => r.id);
      await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1)', [idsToDelete]);
      await pool.query('DELETE FROM rituals WHERE id = ANY($1)', [idsToDelete]);
      console.log(`🧹 Removed ${idsToDelete.length} duplicate Jazz Night rituals`);
    }
    if (existingJazz.rows.length === 0) {
      // Create fresh Special Event Jazz Night
      await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration,
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          'Jazz Night at Blue Note',
          'Special Event',
          'Navigli',
          new Date(now.getTime() + 60 * 60000), // 60 minutes from now
          120,
          45,
          'request_seat',
          45.4642,
          9.1900,
          jazzHostId,
          'upcoming',
        ]
      );
      console.log('✅ Jazz Night at Blue Note created');
    } else {
      // Ensure existing record has correct type/time so it appears as Special Event
      const jazzId = existingJazz.rows[0].id;
      await pool.query(
        `UPDATE rituals
         SET type = $1,
             venue_name = $2,
             start_time = $3,
             duration = $4,
             capacity = $5,
             entry_type = $6,
             location_lat = $7,
             location_lng = $8,
             host_id = $9,
             status = $10
         WHERE id = $11`,
        [
          'Special Event',
          'Navigli',
          new Date(now.getTime() + 60 * 60000), // 60 minutes from now
          120,
          45,
          'request_seat',
          45.4642,
          9.1900,
          jazzHostId,
          'upcoming',
          jazzId,
        ]
      );
      console.log('ℹ️ Jazz Night at Blue Note updated to Special Event');
    }

    // Live Now: Brunch Circle
    const brunchResult = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration,
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Brunch Circle',
        'Social',
        'Brera',
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30, 0, 0),
        90,
        20,
        'open',
        45.472,
        9.186,
        brunchHostId,
        'live',
      ]
    );
    const brunchRitualId = brunchResult.rows[0].id;

    // Starting Soon: Morning Yoga Session (25 min)
    const yogaResult = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration,
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Morning Yoga Session',
        'Active',
        'Parco Sempione',
        new Date(now.getTime() + 25 * 60000),
        60,
        15,
        'open',
        45.4725,
        9.1749,
        yogaHostId,
        'upcoming',
      ]
    );
    const yogaRitualId = yogaResult.rows[0].id;

    // Starting Soon: Sunset Run & Chill (75 min)
    await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration,
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        'Sunset Run & Chill',
        'Active',
        'Parco Sempione',
        new Date(now.getTime() + 75 * 60000),
        90,
        30,
        'open',
        45.4725,
        9.1749,
        runHostId,
        'upcoming',
      ]
    );

    // Caffè Letterario rituals: 14:00, 17:00, 20:00
    await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration,
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11),
        ($12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22),
        ($23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
      [
        'Book Discussion',
        'Culture',
        'Caffè Letterario',
        todayAt(14, 0),
        90,
        12,
        'open',
        45.463,
        9.18,
        caffeHostId,
        'upcoming',

        'Writing Circle',
        'Culture',
        'Caffè Letterario',
        todayAt(17, 0),
        90,
        10,
        'open',
        45.463,
        9.18,
        caffeHostId,
        'upcoming',

        'Poetry Reading',
        'Culture',
        'Caffè Letterario',
        todayAt(20, 0),
        90,
        20,
        'open',
        45.463,
        9.18,
        caffeHostId,
        'upcoming',
      ]
    );

    console.log('✅ Rituals created');

    // 5) Social proximity: friendships and attendance
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

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO NOTHING`,
      [yogaRitualId, friend1Id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO NOTHING`,
      [yogaRitualId, friend2Id]
    );

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO NOTHING`,
      [brunchRitualId, viewerId]
    );

    console.log('✅ Social proximity data created');

    // 6) Sunset Aperitivo ritual + pulse memory
    const aperitivoResult = await pool.query(
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
        new Date(now.getTime() - 60 * 60000),
        120,
        30,
        'open',
        45.4655,
        9.19,
        caffeHostId,
        'live',
      ]
    );
    const aperitivoRitualId = aperitivoResult.rows[0].id;

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO NOTHING`,
      [aperitivoRitualId, viewerId]
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await pool.query(
      `INSERT INTO memories (
        ritual_id, user_id, content, memory_type, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)`,
      [aperitivoRitualId, viewerId, 'Sunset Aperitivo', 'pulse', expiresAt]
    );

    console.log('✅ Sunset Aperitivo pulse memory created');

    console.log('\n🎉 Pulse demo data for Milano created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Pulse demo data:', error);
    process.exit(1);
  }
}

createPulseDemoData();

