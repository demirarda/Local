import pool from '../config/database.js';

// Viewer user ID (from PulseScreen.js)
const VIEWER_ID = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';
const CITY = 'Milano';

async function createComprehensivePulseData() {
  try {
    console.log('🚀 Creating comprehensive Pulse demo data...\n');

    // 1. Create or get viewer user
    let viewerResult = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [VIEWER_ID]
    );

    if (viewerResult.rows.length === 0) {
      viewerResult = await pool.query(
        `INSERT INTO users (id, name, city, university, rs_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [VIEWER_ID, 'Test Viewer', CITY, 'Bocconi University', 7.0]
      );
      console.log('✅ Created viewer user');
    } else {
      console.log('✅ Viewer user exists');
    }

    // 2. Create hosts
    const hosts = [];
    const hostNames = ['Alessandro', 'Sofia', 'Marco', 'Giulia', 'Luca'];
    for (let i = 0; i < 5; i++) {
      const host = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        [`${hostNames[i]} Host`, CITY, 'Bocconi University', 7.5 + i * 0.3]
      );
      hosts.push(host.rows[0]);
    }
    console.log(`✅ Created ${hosts.length} hosts`);

    // 3. Create friends (for friend activity cards)
    const friends = [];
    const friendNames = ['Emma', 'Tommaso', 'Chiara'];
    for (let i = 0; i < 3; i++) {
      const friend = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        [`${friendNames[i]} Friend`, CITY, 'Bocconi University', 6.5 + i * 0.2]
      );
      friends.push(friend.rows[0]);

      // Create friendship (accepted)
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [VIEWER_ID, friend.rows[0].id]
      );

      // Also create reverse friendship
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [friend.rows[0].id, VIEWER_ID]
      );
    }
    console.log(`✅ Created ${friends.length} friends with friendships`);

    // 4. Create follows (for host memory share)
    for (let i = 0; i < 3; i++) {
      await pool.query(
        `INSERT INTO follows (follower_id, following_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [VIEWER_ID, hosts[i].id]
      );
    }
    console.log('✅ Created follows for host memory share');

    const now = new Date();
    const rituals = [];

    // 5. Create LIVE NOW rituals
    console.log('\n📅 Creating LIVE NOW rituals...');
    const liveRitual1 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Morning Coffee & Study',
        'Study',
        'Caffè Duomo',
        new Date(now.getTime() - 45 * 60000), // Started 45 mins ago
        120,
        15,
        'open',
        45.4642,
        9.1914,
        hosts[0].id,
        'live'
      ]
    );
    rituals.push({ id: liveRitual1.rows[0].id, type: 'live', title: liveRitual1.rows[0].title });

    const liveRitual2 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Yoga in the Park',
        'Wellness',
        'Parco Sempione',
        new Date(now.getTime() - 20 * 60000), // Started 20 mins ago
        60,
        20,
        'open',
        45.4728,
        9.1750,
        hosts[1].id,
        'live'
      ]
    );
    rituals.push({ id: liveRitual2.rows[0].id, type: 'live', title: liveRitual2.rows[0].title });

    // Add attendees to live rituals
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [liveRitual1.rows[0].id, friends[0].id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [liveRitual2.rows[0].id, friends[1].id]
    );
    console.log('✅ Created 2 LIVE NOW rituals with friend attendees');

    // 6. Create STARTING SOON rituals
    console.log('\n⏰ Creating STARTING SOON rituals...');
    const soonRitual1 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Lunch Break Chat',
        'Social',
        'Ristorante Navigli',
        new Date(now.getTime() + 15 * 60000), // 15 mins from now
        60,
        12,
        'open',
        45.4500,
        9.1700,
        hosts[2].id,
        'upcoming'
      ]
    );
    rituals.push({ id: soonRitual1.rows[0].id, type: 'soon', title: soonRitual1.rows[0].title });

    const soonRitual2 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Study Group Session',
        'Study',
        'Biblioteca Bocconi',
        new Date(now.getTime() + 30 * 60000), // 30 mins from now
        120,
        10,
        'request_seat',
        45.4500,
        9.1900,
        hosts[3].id,
        'upcoming'
      ]
    );
    rituals.push({ id: soonRitual2.rows[0].id, type: 'soon', title: soonRitual2.rows[0].title });

    const soonRitual3 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Evening Aperitivo',
        'Social',
        'Terrazza Aperol',
        new Date(now.getTime() + 60 * 60000), // 1 hour from now
        90,
        25,
        'open',
        45.4642,
        9.1914,
        hosts[4].id,
        'upcoming'
      ]
    );
    rituals.push({ id: soonRitual3.rows[0].id, type: 'soon', title: soonRitual3.rows[0].title });

    // Add friend to starting soon ritual
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [soonRitual1.rows[0].id, friends[2].id]
    );
    console.log('✅ Created 3 STARTING SOON rituals with friend attendee');

    // 7. Create ALMOST FULL ritual
    console.log('\n🔥 Creating ALMOST FULL ritual...');
    const almostFullRitual = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Game Night',
        'Social',
        'Game Cafe Milano',
        new Date(now.getTime() + 90 * 60000), // 1.5 hours from now
        180,
        8, // Small capacity
        'open',
        45.4600,
        9.1800,
        hosts[0].id,
        'upcoming'
      ]
    );
    rituals.push({ id: almostFullRitual.rows[0].id, type: 'almost_full', title: almostFullRitual.rows[0].title });

    // Add 6 attendees (out of 8 capacity = almost full)
    for (let i = 0; i < 6; i++) {
      const attendee = await pool.query(
        `INSERT INTO users (name, city, university, rs_score)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`Attendee ${i + 1}`, CITY, 'Bocconi University', 6.0]
      );
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')
         ON CONFLICT DO NOTHING`,
        [almostFullRitual.rows[0].id, attendee.rows[0].id]
      );
    }
    console.log('✅ Created ALMOST FULL ritual with 6/8 attendees');

    // 8. Create SPECIAL EVENT
    console.log('\n🎉 Creating SPECIAL EVENT...');
    const specialEvent = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Milano Music Festival',
        'Special Event',
        'Duomo Square',
        new Date(now.getTime() + 120 * 60000), // 2 hours from now
        240,
        100,
        'open',
        45.4642,
        9.1914,
        hosts[0].id,
        'upcoming'
      ]
    );
    rituals.push({ id: specialEvent.rows[0].id, type: 'special', title: specialEvent.rows[0].title });
    console.log('✅ Created SPECIAL EVENT');

    // 9. Create VENUE ACTIVITY (multiple rituals at same venue)
    console.log('\n🏢 Creating VENUE ACTIVITY (same venue, multiple rituals)...');
    const venueName = 'Caffè Duomo';
    const venueRitual1 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Afternoon Coffee',
        'Social',
        venueName,
        new Date(now.getTime() + 180 * 60000), // 3 hours from now
        60,
        15,
        'open',
        45.4642,
        9.1914,
        hosts[1].id,
        'upcoming'
      ]
    );

    const venueRitual2 = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Evening Study',
        'Study',
        venueName,
        new Date(now.getTime() + 240 * 60000), // 4 hours from now
        120,
        20,
        'open',
        45.4642,
        9.1914,
        hosts[2].id,
        'upcoming'
      ]
    );
    console.log(`✅ Created 2 rituals at ${venueName} for venue activity`);

    // 10. Create HOST MEMORY SHARE (Pulse memory from host)
    console.log('\n💭 Creating HOST MEMORY SHARE...');
    // Use the live ritual that ended recently
    const endedRitual = await pool.query(
      `INSERT INTO rituals (
        title, type, venue_name, start_time, duration, 
        capacity, entry_type, location_lat, location_lng, host_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title`,
      [
        'Sunset Aperitivo',
        'Social',
        'Terrazza Aperol',
        new Date(now.getTime() - 120 * 60000), // Ended 2 hours ago
        90,
        20,
        'open',
        45.4642,
        9.1914,
        hosts[0].id,
        'ended'
      ]
    );

    // Ensure host and viewer attended
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [endedRitual.rows[0].id, hosts[0].id]
    );
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [endedRitual.rows[0].id, VIEWER_ID]
    );

    // Create Pulse memory from host
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const hostMemory = await pool.query(
      `INSERT INTO memories (
        ritual_id, user_id, content, memory_type, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        endedRitual.rows[0].id,
        hosts[0].id,
        'Amazing sunset views and great conversations! 🌅',
        'pulse',
        expiresAt
      ]
    );
    console.log('✅ Created HOST MEMORY SHARE (Pulse memory)');

    // 11. Create FRIEND ACTIVITY (friends attending rituals)
    console.log('\n👥 Ensuring FRIEND ACTIVITY...');
    // Friend 1 attending live ritual (already done above)
    // Friend 2 attending starting soon ritual (already done above)
    // Add friend 3 to another ritual
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [soonRitual2.rows[0].id, friends[0].id]
    );
    console.log('✅ Friend activity configured');

    console.log('\n📊 Summary:');
    console.log(`   ✅ ${hosts.length} hosts created`);
    console.log(`   ✅ ${friends.length} friends created with friendships`);
    console.log(`   ✅ 2 LIVE NOW rituals`);
    console.log(`   ✅ 3 STARTING SOON rituals`);
    console.log(`   ✅ 1 ALMOST FULL ritual`);
    console.log(`   ✅ 1 SPECIAL EVENT`);
    console.log(`   ✅ 2 rituals at same venue (Venue Activity)`);
    console.log(`   ✅ 1 HOST MEMORY SHARE (Pulse memory)`);
    console.log(`   ✅ Friend activity configured`);
    console.log(`   ✅ Follows created for host memory share`);

    console.log('\n🎉 Comprehensive Pulse demo data created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating comprehensive Pulse data:', error);
    process.exit(1);
  }
}

createComprehensivePulseData();
