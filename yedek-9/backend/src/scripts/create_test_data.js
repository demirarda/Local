import pool from '../config/database.js';

async function createTestData() {
  try {
    console.log('Creating test data...');

    // Create test users
    const user1 = await pool.query(
      `INSERT INTO users (name, city, university, rs_score)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Test Host 1', 'Istanbul', 'Test University', 7.5]
    );
    const host1Id = user1.rows[0].id;

    const user2 = await pool.query(
      `INSERT INTO users (name, city, university, rs_score)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Test Host 2', 'Istanbul', 'Test University', 8.0]
    );
    const host2Id = user2.rows[0].id;

    const user3 = await pool.query(
      `INSERT INTO users (name, city, university, rs_score)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      ['Test User', 'Istanbul', 'Test University', 6.5]
    );
    const userId = user3.rows[0].id;

    console.log('✅ Test users created');

    // Create test rituals
    const now = new Date();
    
    // Live Now ritual
    const liveRitual = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Live Study Session',
        'Study',
        'Central Library',
        new Date(now.getTime() - 30 * 60000), // Started 30 mins ago
        120,
        20,
        'open',
        41.0082, // Istanbul coordinates
        28.9784,
        host1Id,
        'live'
      ]
    );
    const liveRitualId = liveRitual.rows[0].id;

    // Starting Soon ritual (15 minutes)
    const soonRitual = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Coffee Meetup',
        'Social',
        'Café Central',
        new Date(now.getTime() + 15 * 60000), // 15 mins from now
        60,
        10,
        'open',
        41.0082,
        28.9784,
        host1Id,
        'upcoming'
      ]
    );
    const soonRitualId = soonRitual.rows[0].id;

    // Starting Soon ritual (45 minutes)
    const soonRitual2 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Yoga Session',
        'Wellness',
        'Park Square',
        new Date(now.getTime() + 45 * 60000), // 45 mins from now
        90,
        15,
        'request_seat',
        41.0082,
        28.9784,
        host2Id,
        'upcoming'
      ]
    );
    const soonRitual2Id = soonRitual2.rows[0].id;

    // Almost Full ritual
    const fullRitual = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        'Game Night',
        'Social',
        'Game Cafe',
        new Date(now.getTime() + 60 * 60000), // 1 hour from now
        180,
        8,
        'open',
        41.0082,
        28.9784,
        host2Id,
        'upcoming'
      ]
    );
    const fullRitualId = fullRitual.rows[0].id;

    // Add attendees to almost full ritual (5 out of 8)
    // Create additional test users for attendance
    const attendeeUsers = [];
    for (let i = 0; i < 5; i++) {
      const attendee = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`Test Attendee ${i + 1}`, 'Istanbul', 'Test University', 6.0]
      );
      attendeeUsers.push(attendee.rows[0].id);
    }

    // Add attendees to almost full ritual
    for (const attendeeId of attendeeUsers) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')`,
        [fullRitualId, attendeeId]
      );
    }

    console.log('✅ Test rituals created');

    // Add some attendees to live ritual
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')`,
      [liveRitualId, userId]
    );

    console.log('✅ Test attendance created');

    console.log('\n📊 Test Data Summary:');
    console.log(`   Users: 3 (2 hosts, 1 user)`);
    console.log(`   Rituals: 4`);
    console.log(`   - Live Now: 1`);
    console.log(`   - Starting Soon: 2`);
    console.log(`   - Almost Full: 1`);
    console.log(`   Attendance: 6 records`);

    console.log('\n✅ Test data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
}

createTestData();
