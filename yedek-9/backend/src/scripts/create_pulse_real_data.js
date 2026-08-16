import pool from '../config/database.js';

const CITY = 'Milano';

async function createPulseRealData() {
  try {
    console.log('🚀 Creating real Pulse data for Milano...\n');
    const now = new Date();

    // 1. Get or create a viewer user (for testing)
    let viewerResult = await pool.query(
      `SELECT id FROM users WHERE city = $1 LIMIT 1`,
      [CITY]
    );

    let viewerId;
    if (viewerResult.rows.length === 0) {
      const newViewer = await pool.query(
        `INSERT INTO users (name, city, rs_score)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['Pulse Viewer', CITY, 7.0]
      );
      viewerId = newViewer.rows[0].id;
      console.log('✅ Created viewer user');
    } else {
      viewerId = viewerResult.rows[0].id;
      console.log('✅ Using existing viewer user');
    }

    // 2. Get or create hosts
    let hosts = [];
    const hostNames = ['Alessandro', 'Sofia', 'Marco', 'Giulia'];
    for (const name of hostNames) {
      const host = await pool.query(
        `SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
        [`${name} Host`, CITY]
      );
      if (host.rows.length === 0) {
        const newHost = await pool.query(
          `INSERT INTO users (name, city, rs_score)
           VALUES ($1, $2, $3)
           RETURNING id, name`,
          [`${name} Host`, CITY, 7.5]
        );
        hosts.push(newHost.rows[0]);
      } else {
        hosts.push(host.rows[0]);
      }
    }
    console.log(`✅ Ensured ${hosts.length} hosts exist`);

    // 3. Create friends
    const friends = [];
    const friendNames = ['Emma', 'Tommaso', 'Chiara'];
    for (const name of friendNames) {
      const friend = await pool.query(
        `SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
        [`${name} Friend`, CITY]
      );
      let friendId;
      if (friend.rows.length === 0) {
        const newFriend = await pool.query(
          `INSERT INTO users (name, city, rs_score)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [`${name} Friend`, CITY, 6.5]
        );
        friendId = newFriend.rows[0].id;
      } else {
        friendId = friend.rows[0].id;
      }

      // Create friendship
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [viewerId, friendId]
      );
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [friendId, viewerId]
      );
      friends.push({ id: friendId, name: `${name} Friend` });
    }
    console.log(`✅ Ensured ${friends.length} friends with friendships`);

    // 4. Create follows (for host memory share)
    for (let i = 0; i < Math.min(3, hosts.length); i++) {
      await pool.query(
        `INSERT INTO follows (follower_id, following_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [viewerId, hosts[i].id]
      );
    }
    console.log('✅ Created follows for host memory share');

    // 5. Create SPECIAL EVENT
    console.log('\n🎉 Creating SPECIAL EVENT...');
    const specialEventCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Jazz Night at Blue Note' 
       AND type = 'Special Event'
       AND venue_name = 'Navigli'
       LIMIT 1`
    );

    let specialEventId;
    if (specialEventCheck.rows.length === 0) {
      const tonight2030 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        20,
        30,
        0,
        0
      );
      if (tonight2030 < now) {
        tonight2030.setDate(tonight2030.getDate() + 1);
      }

      const specialEvent = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          'Jazz Night at Blue Note',
          'Special Event',
          'Navigli',
          tonight2030,
          120,
          50,
          'request_seat',
          45.4642,
          9.1914,
          hosts[0].id,
          'upcoming'
        ]
      );
      specialEventId = specialEvent.rows[0].id;
      console.log('✅ Created SPECIAL EVENT: Jazz Night at Blue Note');
    } else {
      specialEventId = specialEventCheck.rows[0].id;
      console.log('✅ SPECIAL EVENT already exists');
    }

    // Add friend attendees to special event
    for (let i = 0; i < Math.min(4, friends.length); i++) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')
         ON CONFLICT DO NOTHING`,
        [specialEventId, friends[i].id]
      );
    }

    // 6. Create LIVE NOW ritual
    console.log('\n🔴 Creating LIVE NOW ritual...');
    const liveRitualCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Brunch Circle' 
       AND venue_name = 'Brera'
       LIMIT 1`
    );

    let liveRitualId;
    if (liveRitualCheck.rows.length === 0) {
      const today1130 = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        11,
        30,
        0,
        0
      );
      if (today1130 < now) {
        today1130.setDate(today1130.getDate() + 1);
      }
      // Make it live by starting it 30 mins ago
      const liveStart = new Date(now.getTime() - 30 * 60000);

      const liveRitual = await pool.query(
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
          liveStart,
          90,
          20,
          'open',
          45.4728,
          9.1750,
          hosts[1].id,
          'live'
        ]
      );
      liveRitualId = liveRitual.rows[0].id;
      console.log('✅ Created LIVE NOW ritual: Brunch Circle');
    } else {
      liveRitualId = liveRitualCheck.rows[0].id;
      // Update to be live
      await pool.query(
        `UPDATE rituals 
         SET status = 'live', start_time = $1
         WHERE id = $2`,
        [new Date(now.getTime() - 30 * 60000), liveRitualId]
      );
      console.log('✅ Updated ritual to LIVE NOW');
    }

    // Add friend attendees to live ritual
    for (let i = 0; i < Math.min(2, friends.length); i++) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')
         ON CONFLICT DO NOTHING`,
        [liveRitualId, friends[i].id]
      );
    }

    // 7. Create STARTING SOON ritual
    console.log('\n⏰ Creating STARTING SOON ritual...');
    const soonRitualCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Sunset Run & Chill' 
       LIMIT 1`
    );

    let soonRitualId;
    if (soonRitualCheck.rows.length === 0) {
      const soonStart = new Date(now.getTime() + 75 * 60000); // 75 mins from now

      const soonRitual = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          'Sunset Run & Chill',
          'Wellness',
          'Parco Sempione',
          soonStart,
          60,
          15,
          'open',
          45.4728,
          9.1750,
          hosts[2].id,
          'upcoming'
        ]
      );
      soonRitualId = soonRitual.rows[0].id;
      console.log('✅ Created STARTING SOON ritual: Sunset Run & Chill');
    } else {
      soonRitualId = soonRitualCheck.rows[0].id;
      // Update to be starting soon
      await pool.query(
        `UPDATE rituals 
         SET start_time = $1, status = 'upcoming'
         WHERE id = $2`,
        [new Date(now.getTime() + 75 * 60000), soonRitualId]
      );
      console.log('✅ Updated ritual to STARTING SOON');
    }

    // 8. Create HOST MEMORY SHARE
    console.log('\n💭 Creating HOST MEMORY SHARE...');
    const memoryRitualCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Sunset Aperitivo' 
       AND venue_name = 'Terrazza Aperol'
       LIMIT 1`
    );

    let memoryRitualId;
    if (memoryRitualCheck.rows.length === 0) {
      const memoryRitual = await pool.query(
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
      memoryRitualId = memoryRitual.rows[0].id;
    } else {
      memoryRitualId = memoryRitualCheck.rows[0].id;
    }

    // Ensure host attended
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT DO NOTHING`,
      [memoryRitualId, hosts[0].id]
    );

    // Create Pulse memory from host
    const memoryCheck = await pool.query(
      `SELECT id FROM memories 
       WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse'
       LIMIT 1`,
      [memoryRitualId, hosts[0].id]
    );

    if (memoryCheck.rows.length === 0) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO memories (
          ritual_id, user_id, content, memory_type, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          memoryRitualId,
          hosts[0].id,
          'Amazing sunset views and great conversations! 🌅',
          'pulse',
          expiresAt
        ]
      );
      console.log('✅ Created HOST MEMORY SHARE');
    } else {
      console.log('✅ HOST MEMORY SHARE already exists');
    }

    // 9. Create VENUE ACTIVITY (multiple rituals at same venue)
    console.log('\n🏢 Creating VENUE ACTIVITY...');
    const venueName = 'Caffè Letterario';
    const venueRitual1Check = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Book Discussion' 
       AND venue_name = $1
       LIMIT 1`,
      [venueName]
    );

    if (venueRitual1Check.rows.length === 0) {
      const venueRitual1 = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          'Book Discussion',
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
        RETURNING id`,
        [
          'Writing Circle',
          'Social',
          venueName,
          new Date(now.getTime() + 300 * 60000), // 5 hours from now
          90,
          20,
          'open',
          45.4642,
          9.1914,
          hosts[2].id,
          'upcoming'
        ]
      );

      const venueRitual3 = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          'Poetry Reading',
          'Social',
          venueName,
          new Date(now.getTime() + 420 * 60000), // 7 hours from now
          60,
          15,
          'open',
          45.4642,
          9.1914,
          hosts[3].id,
          'upcoming'
        ]
      );
      console.log(`✅ Created 3 rituals at ${venueName} for venue activity`);
    } else {
      console.log(`✅ Venue activity rituals already exist`);
    }

    // 10. Create FRIEND ACTIVITY ritual
    console.log('\n👥 Creating FRIEND ACTIVITY ritual...');
    const friendActivityCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Morning Yoga Session' 
       LIMIT 1`
    );

    let friendActivityRitualId;
    if (friendActivityCheck.rows.length === 0) {
      const friendActivityStart = new Date(now.getTime() + 25 * 60000); // 25 mins from now

      const friendActivityRitual = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          'Morning Yoga Session',
          'Wellness',
          'Parco Sempione',
          friendActivityStart,
          60,
          20,
          'open',
          45.4728,
          9.1750,
          hosts[3].id,
          'upcoming'
        ]
      );
      friendActivityRitualId = friendActivityRitual.rows[0].id;
      console.log('✅ Created FRIEND ACTIVITY ritual: Morning Yoga Session');
    } else {
      friendActivityRitualId = friendActivityCheck.rows[0].id;
      // Update to be starting soon
      await pool.query(
        `UPDATE rituals 
         SET start_time = $1, status = 'upcoming'
         WHERE id = $2`,
        [new Date(now.getTime() + 25 * 60000), friendActivityRitualId]
      );
      console.log('✅ Updated FRIEND ACTIVITY ritual');
    }

    // Add friend attendee
    if (friends.length > 0) {
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')
         ON CONFLICT DO NOTHING`,
        [friendActivityRitualId, friends[0].id]
      );
    }

    // 11. Create ALMOST FULL ritual
    console.log('\n🔥 Creating ALMOST FULL ritual...');
    const almostFullCheck = await pool.query(
      `SELECT id FROM rituals 
       WHERE title = 'Game Night' 
       AND venue_name = 'Game Cafe Milano'
       LIMIT 1`
    );

    let almostFullRitualId;
    if (almostFullCheck.rows.length === 0) {
      const almostFullRitual = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
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
      almostFullRitualId = almostFullRitual.rows[0].id;
      console.log('✅ Created ALMOST FULL ritual: Game Night');
    } else {
      almostFullRitualId = almostFullCheck.rows[0].id;
      console.log('✅ ALMOST FULL ritual already exists');
    }

    // Add 6 attendees (out of 8 capacity = almost full)
    const attendeeCount = await pool.query(
      `SELECT COUNT(*) as count FROM ritual_attendance 
       WHERE ritual_id = $1 AND status != 'no_show'`,
      [almostFullRitualId]
    );
    const currentCount = parseInt(attendeeCount.rows[0].count) || 0;

    if (currentCount < 6) {
      for (let i = currentCount; i < 6; i++) {
        const attendee = await pool.query(
          `INSERT INTO users (name, city, rs_score)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [`Game Attendee ${i + 1}`, CITY, 6.0]
        );
        await pool.query(
          `INSERT INTO ritual_attendance (ritual_id, user_id, status)
           VALUES ($1, $2, 'joined')
           ON CONFLICT DO NOTHING`,
          [almostFullRitualId, attendee.rows[0].id]
        );
      }
      console.log('✅ Added attendees to ALMOST FULL ritual (6/8)');
    } else {
      console.log('✅ ALMOST FULL ritual already has enough attendees');
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Special Event: Jazz Night at Blue Note`);
    console.log(`   ✅ Live Now: Brunch Circle`);
    console.log(`   ✅ Starting Soon: Sunset Run & Chill`);
    console.log(`   ✅ Almost Full: Game Night (6/8)`);
    console.log(`   ✅ Host Memory Share: Sunset Aperitivo`);
    console.log(`   ✅ Venue Activity: Caffè Letterario (3 rituals)`);
    console.log(`   ✅ Friend Activity: Morning Yoga Session`);
    console.log(`   ✅ ${friends.length} friends with activity`);

    console.log('\n🎉 Real Pulse data created successfully!');
    console.log(`\n💡 Note: Make sure your user in the app has city = '${CITY}' to see the data.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Pulse data:', error);
    process.exit(1);
  }
}

createPulseRealData();
