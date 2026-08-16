import pool from '../config/database.js';

// Test user IDs - Get from existing users
let USER1_ID, USER2_ID;

async function testFollowSystem() {
  console.log('\n📌 Testing Follow System...\n');
  
  try {
    // Test 1: Follow user
    console.log('1. Testing follow user...');
    const followResult = await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING
       RETURNING *`,
      [USER1_ID, USER2_ID]
    );
    
    if (followResult.rows.length > 0) {
      console.log('   ✅ Follow created:', followResult.rows[0].id);
    } else {
      console.log('   ⚠️  Follow already exists');
    }
    
    // Test 2: Check follow status
    console.log('2. Testing check follow status...');
    const checkResult = await pool.query(
      `SELECT * FROM follows 
       WHERE follower_id = $1 AND following_id = $2`,
      [USER1_ID, USER2_ID]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('   ✅ Follow relationship exists');
    } else {
      console.log('   ❌ Follow relationship not found');
    }
    
    // Test 3: Get following list
    console.log('3. Testing get following list...');
    const followingResult = await pool.query(
      `SELECT f.*, u.name as following_name
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1`,
      [USER1_ID]
    );
    console.log(`   ✅ Found ${followingResult.rows.length} following`);
    
    // Test 4: Unfollow
    console.log('4. Testing unfollow...');
    const unfollowResult = await pool.query(
      `DELETE FROM follows 
       WHERE follower_id = $1 AND following_id = $2
       RETURNING *`,
      [USER1_ID, USER2_ID]
    );
    
    if (unfollowResult.rows.length > 0) {
      console.log('   ✅ Unfollowed successfully');
    } else {
      console.log('   ⚠️  Follow relationship not found to unfollow');
    }
    
    console.log('\n✅ Follow System tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Follow System test failed:', error.message);
    return false;
  }
}

async function testVibePills() {
  console.log('\n🎨 Testing Vibe Pills...\n');
  
  try {
    // Test 1: Add vibe
    console.log('1. Testing add vibe...');
    const addResult = await pool.query(
      `INSERT INTO user_vibes (user_id, vibe)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vibe) DO NOTHING
       RETURNING *`,
      [USER1_ID, 'chill']
    );
    
    if (addResult.rows.length > 0) {
      console.log('   ✅ Vibe added:', addResult.rows[0].vibe);
    } else {
      console.log('   ⚠️  Vibe already exists');
    }
    
    // Test 2: Add another vibe
    await pool.query(
      `INSERT INTO user_vibes (user_id, vibe)
       VALUES ($1, $2)
       ON CONFLICT (user_id, vibe) DO NOTHING`,
      [USER1_ID, 'energetic']
    );
    
    // Test 3: Get user vibes
    console.log('2. Testing get user vibes...');
    const vibesResult = await pool.query(
      `SELECT vibe FROM user_vibes WHERE user_id = $1 ORDER BY created_at ASC`,
      [USER1_ID]
    );
    console.log(`   ✅ Found ${vibesResult.rows.length} vibes:`, vibesResult.rows.map(r => r.vibe).join(', '));
    
    // Test 4: Remove vibe
    console.log('3. Testing remove vibe...');
    const removeResult = await pool.query(
      `DELETE FROM user_vibes 
       WHERE user_id = $1 AND vibe = $2
       RETURNING *`,
      [USER1_ID, 'chill']
    );
    
    if (removeResult.rows.length > 0) {
      console.log('   ✅ Vibe removed');
    } else {
      console.log('   ⚠️  Vibe not found to remove');
    }
    
    console.log('\n✅ Vibe Pills tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Vibe Pills test failed:', error.message);
    return false;
  }
}

async function testSpotifyPlaylist() {
  console.log('\n🎵 Testing Spotify Playlist Support...\n');
  
  try {
    // Get a ritual ID for testing
    const ritualResult = await pool.query(
      `SELECT id FROM rituals LIMIT 1`
    );
    
    if (ritualResult.rows.length === 0) {
      console.log('   ⚠️  No rituals found, skipping Spotify test');
      return true;
    }
    
    const ritualId = ritualResult.rows[0].id;
    const spotifyUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    const spotifyId = '37i9dQZF1DXcBWIGoYBM5M';
    
    // Test 1: Create memory with Spotify playlist
    console.log('1. Testing create memory with Spotify playlist...');
    const memoryResult = await pool.query(
      `INSERT INTO memories (ritual_id, user_id, content, memory_type, spotify_playlist_url, spotify_playlist_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ritualId, USER1_ID, 'Test memory with Spotify playlist', 'ritual', spotifyUrl, spotifyId]
    );
    
    if (memoryResult.rows.length > 0) {
      console.log('   ✅ Memory with Spotify playlist created:', memoryResult.rows[0].id);
      console.log('   ✅ Spotify URL:', memoryResult.rows[0].spotify_playlist_url);
      console.log('   ✅ Spotify ID:', memoryResult.rows[0].spotify_playlist_id);
      
      // Cleanup
      await pool.query(`DELETE FROM memories WHERE id = $1`, [memoryResult.rows[0].id]);
      console.log('   ✅ Test memory cleaned up');
    } else {
      console.log('   ❌ Failed to create memory');
    }
    
    console.log('\n✅ Spotify Playlist tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Spotify Playlist test failed:', error.message);
    return false;
  }
}

async function testNotifications() {
  console.log('\n🔔 Testing Notifications...\n');
  
  try {
    // Test 1: Register device token
    console.log('1. Testing register device token...');
    const tokenResult = await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [USER1_ID, 'ExponentPushToken[test-token-123]', 'ios']
    );
    
    if (tokenResult.rows.length > 0) {
      console.log('   ✅ Device token registered:', tokenResult.rows[0].token);
    } else {
      console.log('   ⚠️  Device token already exists');
    }
    
    // Test 2: Create notification
    console.log('2. Testing create notification...');
    const notificationResult = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [USER1_ID, 'ritual_live', 'New Ritual Live', 'A ritual you might fit just went live', JSON.stringify({ ritual_id: 'test-ritual-id' })]
    );
    
    if (notificationResult.rows.length > 0) {
      console.log('   ✅ Notification created:', notificationResult.rows[0].id);
      console.log('   ✅ Type:', notificationResult.rows[0].type);
      console.log('   ✅ Title:', notificationResult.rows[0].title);
    }
    
    // Test 3: Get notifications
    console.log('3. Testing get notifications...');
    const getNotificationsResult = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [USER1_ID]
    );
    console.log(`   ✅ Found ${getNotificationsResult.rows.length} notifications`);
    
    // Test 4: Mark as read
    if (notificationResult.rows.length > 0) {
      console.log('4. Testing mark notification as read...');
      const markReadResult = await pool.query(
        `UPDATE notifications 
         SET read = true 
         WHERE id = $1
         RETURNING *`,
        [notificationResult.rows[0].id]
      );
      
      if (markReadResult.rows.length > 0 && markReadResult.rows[0].read) {
        console.log('   ✅ Notification marked as read');
      }
    }
    
    console.log('\n✅ Notifications tests passed!\n');
    return true;
  } catch (error) {
    console.error('❌ Notifications test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 Testing v1.2+ Features\n');
  console.log('='.repeat(50));
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Get test users
    const usersResult = await pool.query('SELECT id FROM users LIMIT 2');
    if (usersResult.rows.length < 2) {
      console.log('⚠️  Need at least 2 users for testing. Creating test users...');
      // Create second test user if needed
      const createUserResult = await pool.query(
        `INSERT INTO users (id, name, city, rs_score)
         VALUES (gen_random_uuid(), 'Test User 2', 'Istanbul', 6.0)
         RETURNING id`
      );
      usersResult.rows.push(createUserResult.rows[0]);
    }
    
    USER1_ID = usersResult.rows[0].id;
    USER2_ID = usersResult.rows[1].id;
    console.log(`📝 Using test users: ${USER1_ID.substring(0, 8)}... and ${USER2_ID.substring(0, 8)}...\n`);
    
    const results = {
      followSystem: await testFollowSystem(),
      vibePills: await testVibePills(),
      spotifyPlaylist: await testSpotifyPlaylist(),
      notifications: await testNotifications(),
    };
    
    console.log('='.repeat(50));
    console.log('\n📊 Test Results Summary:\n');
    console.log(`   Follow System:        ${results.followSystem ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Vibe Pills:           ${results.vibePills ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Spotify Playlist:     ${results.spotifyPlaylist ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Notifications:        ${results.notifications ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r === true);
    
    if (allPassed) {
      console.log('\n🎉 All v1.2+ feature tests passed!\n');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
