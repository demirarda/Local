import pool from '../config/database.js';

async function createSpecialEvent() {
  try {
    console.log('Creating special event...');

    // Find a host in Milano
    const hostResult = await pool.query(
      `SELECT id FROM users WHERE city = 'Milano' LIMIT 1`
    );

    if (hostResult.rows.length === 0) {
      console.log('No host found in Milano. Creating one...');
      const newHost = await pool.query(
        `INSERT INTO users (name, city, rs_score)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Special Event Host', 'Milano', 8.5]
      );
      var hostId = newHost.rows[0].id;
    } else {
      var hostId = hostResult.rows[0].id;
    }

    // Create a special event ritual
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60000); // 1 hour from now

    const specialEvent = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, type`,
      [
        'Milano Music Festival',
        'Special Event',
        'Duomo Square',
        startTime,
        180, // 3 hours
        100,
        'open',
        45.4642, // Milano Duomo coordinates
        9.1914,
        hostId,
        'upcoming'
      ]
    );

    console.log('✅ Special event created:', specialEvent.rows[0]);

    // Also update an existing ritual to be a special event (for testing)
    // PostgreSQL doesn't support LIMIT in UPDATE, so we use a subquery
    const updateResult = await pool.query(
      `UPDATE rituals 
       SET type = 'Special Event'
       WHERE id = (
         SELECT id FROM rituals
         WHERE host_id IN (SELECT id FROM users WHERE city = 'Milano')
           AND type != 'Special Event'
         LIMIT 1
       )
       RETURNING id, title, type`
    );

    if (updateResult.rows.length > 0) {
      console.log('✅ Updated existing ritual to special event:', updateResult.rows[0]);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating special event:', error);
    process.exit(1);
  }
}

createSpecialEvent();
