import pool from '../config/database.js';

async function createHostMemorySunsetAperitivo() {
  try {
    console.log('Creating host memory share for Sunset Aperitivo...');

    // 1) Find host user (Caffè Host) in Milano
    const hostResult = await pool.query(
      `SELECT id FROM users
       WHERE name = $1 AND city = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      ['Caffè Host', 'Milano']
    );

    if (hostResult.rows.length === 0) {
      throw new Error('Caffè Host not found in Milano. Run Milano seed first.');
    }
    const hostId = hostResult.rows[0].id;
    console.log('Host id:', hostId);

    // 2) Find Sunset Aperitivo ritual
    const ritualResult = await pool.query(
      `SELECT id FROM rituals
       WHERE title = $1 AND venue_name = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      ['Sunset Aperitivo', 'Terrazza Aperol']
    );

    if (ritualResult.rows.length === 0) {
      throw new Error('Sunset Aperitivo ritual not found. Make sure it exists.');
    }
    const ritualId = ritualResult.rows[0].id;
    console.log('Ritual id:', ritualId);

    // 3) Ensure viewer follows the host (so copy matches "Host you follow")
    const viewerId = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';
    await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [viewerId, hostId]
    );

    // 4) Ensure both host and viewer are marked as joined to this ritual
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [ritualId, hostId]
    );

    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [ritualId, viewerId]
    );

    // 5) Create Pulse memory from host if it doesn't already exist
    const existingMemory = await pool.query(
      `SELECT id FROM memories
       WHERE ritual_id = $1
         AND user_id = $2
         AND memory_type = 'pulse'
       ORDER BY created_at DESC
       LIMIT 1`,
      [ritualId, hostId]
    );

    if (existingMemory.rows.length > 0) {
      console.log('Host Pulse memory already exists with id:', existingMemory.rows[0].id);
      process.exit(0);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const memoryResult = await pool.query(
      `INSERT INTO memories (
         ritual_id, user_id, content, memory_type, expires_at
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [ritualId, hostId, 'Sunset Aperitivo', 'pulse', expiresAt]
    );

    console.log('✅ Created host Pulse memory with id:', memoryResult.rows[0].id);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating host memory for Sunset Aperitivo:', error);
    process.exit(1);
  }
}

createHostMemorySunsetAperitivo();

