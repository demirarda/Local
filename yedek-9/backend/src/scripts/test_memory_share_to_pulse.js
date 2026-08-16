import pool from '../config/database.js';

const API_BASE_URL = 'http://localhost:3000/api';

async function testMemoryShareToPulse() {
  try {
    console.log('🧪 Testing Memory Share-to-Pulse Feature\n');
    console.log('=' .repeat(60));
    console.log('');

    // Get test users
    const usersResult = await pool.query(
      `SELECT id, name FROM users ORDER BY created_at DESC LIMIT 3`
    );

    if (usersResult.rows.length < 2) {
      console.log('❌ Need at least 2 users for testing');
      console.log('   Run: node src/scripts/create_test_data.js');
      process.exit(1);
    }

    const host = usersResult.rows[0];
    const user = usersResult.rows[1];
    const otherUser = usersResult.rows[2] || usersResult.rows[0];

    console.log('👥 Test Users:');
    console.log(`   Host: ${host.name} (${host.id})`);
    console.log(`   User: ${user.name} (${user.id})`);
    console.log('');

    // Get or create a live ritual
    let liveRitualResult = await pool.query(
      `SELECT id, title, status, host_id FROM rituals 
       WHERE status = 'live' 
       ORDER BY created_at DESC LIMIT 1`
    );

    let ritualId;
    if (liveRitualResult.rows.length === 0) {
      console.log('📅 Creating live ritual...');
      const now = new Date();
      const ritualResult = await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration, 
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, title, status, host_id`,
        [
          'Test Live Ritual',
          'Test',
          'Test Venue',
          new Date(now.getTime() - 30 * 60000), // Started 30 mins ago
          120,
          20,
          'open',
          41.0082,
          28.9784,
          host.id,
          'live'
        ]
      );
      ritualId = ritualResult.rows[0].id;
      console.log(`   ✅ Created live ritual: ${ritualId}`);
    } else {
      ritualId = liveRitualResult.rows[0].id;
      console.log(`📅 Using existing live ritual: ${ritualId}`);
    }
    console.log('');

    // Ensure user is attending the ritual
    const attendanceCheck = await pool.query(
      `SELECT * FROM ritual_attendance 
       WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, user.id]
    );

    if (attendanceCheck.rows.length === 0) {
      console.log('👤 Adding user to ritual attendance...');
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'joined')`,
        [ritualId, user.id]
      );
      console.log('   ✅ User added to ritual');
      console.log('');
    }

    // Test 1: Check eligibility (not friend)
    console.log('📋 Test 1: Check Eligibility (Not Friend)');
    console.log('-'.repeat(60));
    try {
      const response = await fetch(
        `${API_BASE_URL}/memories/eligibility?ritual_id=${ritualId}&user_id=${user.id}`
      );
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Eligibility check successful`);
        console.log(`   Eligible: ${data.data.eligible}`);
        console.log(`   Reason: ${data.data.reason}`);
        console.log(`   Checks:`, data.data.checks);
      } else {
        console.log(`   ❌ Eligibility check failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 2: Create friendship
    console.log('📋 Test 2: Create Friendship');
    console.log('-'.repeat(60));
    try {
      // Get ritual host
      const ritualHostResult = await pool.query(
        `SELECT host_id FROM rituals WHERE id = $1`,
        [ritualId]
      );
      const ritualHostId = ritualHostResult.rows[0].host_id;

      // Create friendship between user and host
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
        [user.id, ritualHostId]
      );
      console.log(`   ✅ Friendship created between user and host`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 3: Check eligibility (friend)
    console.log('📋 Test 3: Check Eligibility (Friend)');
    console.log('-'.repeat(60));
    try {
      const response = await fetch(
        `${API_BASE_URL}/memories/eligibility?ritual_id=${ritualId}&user_id=${user.id}`
      );
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Eligibility check successful`);
        console.log(`   Eligible: ${data.data.eligible}`);
        console.log(`   Reason: ${data.data.reason}`);
        console.log(`   Checks:`, data.data.checks);
      } else {
        console.log(`   ❌ Eligibility check failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 4: Create ritual-only memory
    console.log('📋 Test 4: Create Ritual-Only Memory');
    console.log('-'.repeat(60));
    try {
      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ritual_id: ritualId,
          user_id: user.id,
          content: 'This is a ritual-only memory for testing.',
          memory_type: 'ritual'
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Memory created successfully`);
        console.log(`   Memory ID: ${data.data.id}`);
        console.log(`   Type: ${data.data.memory_type}`);
        console.log(`   Expires: ${data.data.expires_at || 'Never'}`);
      } else {
        console.log(`   ❌ Memory creation failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 5: Create pulse memory (eligible)
    console.log('📋 Test 5: Create Pulse Memory (Eligible)');
    console.log('-'.repeat(60));
    try {
      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ritual_id: ritualId,
          user_id: user.id,
          content: 'This is a pulse memory for testing. It will expire in 24 hours.',
          memory_type: 'pulse'
        }),
      });
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Pulse memory created successfully`);
        console.log(`   Memory ID: ${data.data.id}`);
        console.log(`   Type: ${data.data.memory_type}`);
        console.log(`   Expires: ${data.data.expires_at}`);
        
        // Parse expiration
        const expiresAt = new Date(data.data.expires_at);
        const now = new Date();
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        console.log(`   Hours until expiry: ${hoursUntilExpiry.toFixed(2)}`);
      } else {
        console.log(`   ❌ Pulse memory creation failed: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 6: Create pulse memory (not eligible - no friendship)
    console.log('📋 Test 6: Create Pulse Memory (Not Eligible)');
    console.log('-'.repeat(60));
    try {
      // Remove friendship
      const ritualHostResult = await pool.query(
        `SELECT host_id FROM rituals WHERE id = $1`,
        [ritualId]
      );
      const ritualHostId = ritualHostResult.rows[0].host_id;
      
      await pool.query(
        `DELETE FROM friendships 
         WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
        [user.id, ritualHostId]
      );
      console.log(`   Removed friendship for test`);

      const response = await fetch(`${API_BASE_URL}/memories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ritual_id: ritualId,
          user_id: user.id,
          content: 'This should fail - not eligible.',
          memory_type: 'pulse'
        }),
      });
      const data = await response.json();
      
      if (!data.success) {
        console.log(`   ✅ Correctly rejected (not eligible)`);
        console.log(`   Error: ${data.error}`);
      } else {
        console.log(`   ❌ Should have been rejected but wasn't`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    // Test 7: Fetch pulse memories
    console.log('📋 Test 7: Fetch Pulse Memories');
    console.log('-'.repeat(60));
    try {
      const response = await fetch(`${API_BASE_URL}/memories/pulse?city=Istanbul&limit=10`);
      const data = await response.json();
      
      if (data.success) {
        console.log(`   ✅ Pulse memories fetched successfully`);
        console.log(`   Count: ${data.data.length}`);
        data.data.forEach((memory, index) => {
          console.log(`   ${index + 1}. ${memory.content.substring(0, 50)}...`);
          console.log(`      Type: ${memory.memory_type}, Expires: ${memory.expires_at}`);
        });
      } else {
        console.log(`   ❌ Failed to fetch pulse memories: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');

    console.log('=' .repeat(60));
    console.log('✅ Memory Share-to-Pulse Tests Completed!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

testMemoryShareToPulse();
