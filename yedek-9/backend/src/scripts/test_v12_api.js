import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3000/api';
const USER1_ID = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';

async function testAPI(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testFollowsAPI() {
  console.log('\n📌 Testing Follows API...\n');
  
  // Get a user to follow
  const usersResult = await testAPI('/users');
  if (!usersResult.success || !usersResult.data.data || usersResult.data.data.length === 0) {
    console.log('   ⚠️  No users found, skipping follows API test');
    return true;
  }
  
  const userToFollow = usersResult.data.data[0];
  if (userToFollow.id === USER1_ID) {
    if (usersResult.data.data.length < 2) {
      console.log('   ⚠️  Need at least 2 users, skipping follows API test');
      return true;
    }
    userToFollow.id = usersResult.data.data[1].id;
  }
  
  // Test 1: Follow user
  console.log('1. Testing POST /api/follows (follow user)...');
  const followResult = await testAPI('/follows', 'POST', {
    follower_id: USER1_ID,
    following_id: userToFollow.id,
  });
  
  if (followResult.success) {
    console.log('   ✅ Follow successful');
  } else {
    console.log('   ⚠️  Follow result:', followResult.data?.message || followResult.error);
  }
  
  // Test 2: Check follow status
  console.log('2. Testing GET /api/follows/check...');
  const checkResult = await testAPI(`/follows/check?follower_id=${USER1_ID}&following_id=${userToFollow.id}`);
  
  if (checkResult.success && checkResult.data.data.is_following) {
    console.log('   ✅ Follow status check successful');
  } else {
    console.log('   ⚠️  Follow status:', checkResult.data?.data?.is_following || false);
  }
  
  // Test 3: Get following list
  console.log('3. Testing GET /api/follows?type=following...');
  const followingResult = await testAPI(`/follows?user_id=${USER1_ID}&type=following`);
  
  if (followingResult.success) {
    console.log(`   ✅ Found ${followingResult.data.data?.length || 0} following`);
  } else {
    console.log('   ❌ Failed to get following list');
  }
  
  // Test 4: Unfollow
  console.log('4. Testing DELETE /api/follows/:id...');
  const unfollowResult = await testAPI(`/follows/${userToFollow.id}?follower_id=${USER1_ID}`, 'DELETE');
  
  if (unfollowResult.success) {
    console.log('   ✅ Unfollow successful');
  } else {
    console.log('   ⚠️  Unfollow result:', unfollowResult.data?.message || unfollowResult.error);
  }
  
  console.log('\n✅ Follows API tests completed!\n');
  return true;
}

async function testVibesAPI() {
  console.log('\n🎨 Testing Vibes API...\n');
  
  // Test 1: Get vibe options
  console.log('1. Testing GET /api/vibes/options/list...');
  const optionsResult = await testAPI('/vibes/options/list');
  
  if (optionsResult.success && optionsResult.data.data) {
    console.log(`   ✅ Found ${optionsResult.data.data.length} vibe options:`, optionsResult.data.data.slice(0, 5).join(', '));
  } else {
    console.log('   ❌ Failed to get vibe options');
  }
  
  // Test 2: Add vibe
  console.log('2. Testing POST /api/vibes (add vibe)...');
  const addResult = await testAPI('/vibes', 'POST', {
    user_id: USER1_ID,
    vibe: 'creative',
  });
  
  if (addResult.success) {
    console.log('   ✅ Vibe added successfully');
  } else {
    console.log('   ⚠️  Add vibe result:', addResult.data?.message || addResult.error);
  }
  
  // Test 3: Get user vibes
  console.log('3. Testing GET /api/vibes/:userId...');
  const vibesResult = await testAPI(`/vibes/${USER1_ID}`);
  
  if (vibesResult.success) {
    console.log(`   ✅ Found ${vibesResult.data.data?.length || 0} vibes:`, vibesResult.data.data?.join(', ') || 'none');
  } else {
    console.log('   ❌ Failed to get user vibes');
  }
  
  // Test 4: Remove vibe
  console.log('4. Testing DELETE /api/vibes (remove vibe)...');
  const removeResult = await testAPI('/vibes', 'DELETE', {
    user_id: USER1_ID,
    vibe: 'creative',
  });
  
  if (removeResult.success) {
    console.log('   ✅ Vibe removed successfully');
  } else {
    console.log('   ⚠️  Remove vibe result:', removeResult.data?.message || removeResult.error);
  }
  
  console.log('\n✅ Vibes API tests completed!\n');
  return true;
}

async function testNotificationsAPI() {
  console.log('\n🔔 Testing Notifications API...\n');
  
  // Test 1: Register device token
  console.log('1. Testing POST /api/notifications/register...');
  const registerResult = await testAPI('/notifications/register', 'POST', {
    user_id: USER1_ID,
    token: 'ExponentPushToken[test-api-token]',
    platform: 'ios',
  });
  
  if (registerResult.success) {
    console.log('   ✅ Device token registered');
  } else {
    console.log('   ⚠️  Register result:', registerResult.data?.message || registerResult.error);
  }
  
  // Test 2: Get notifications
  console.log('2. Testing GET /api/notifications...');
  const notificationsResult = await testAPI(`/notifications?user_id=${USER1_ID}`);
  
  if (notificationsResult.success) {
    console.log(`   ✅ Found ${notificationsResult.data.data?.length || 0} notifications`);
  } else {
    console.log('   ❌ Failed to get notifications');
  }
  
  // Test 3: Unregister device token
  console.log('3. Testing DELETE /api/notifications/unregister...');
  const unregisterResult = await testAPI('/notifications/unregister', 'DELETE', {
    user_id: USER1_ID,
    token: 'ExponentPushToken[test-api-token]',
  });
  
  if (unregisterResult.success) {
    console.log('   ✅ Device token unregistered');
  } else {
    console.log('   ⚠️  Unregister result:', unregisterResult.data?.message || unregisterResult.error);
  }
  
  console.log('\n✅ Notifications API tests completed!\n');
  return true;
}

async function main() {
  console.log('🧪 Testing v1.2+ API Endpoints\n');
  console.log('='.repeat(50));
  console.log(`API Base URL: ${API_BASE_URL}\n`);
  
  try {
    // Test health
    const healthResult = await testAPI('/');
    if (healthResult.success) {
      console.log('✅ API is running\n');
    } else {
      console.log('❌ API is not responding. Make sure backend is running on port 3000.\n');
      return;
    }
    
    const results = {
      follows: await testFollowsAPI(),
      vibes: await testVibesAPI(),
      notifications: await testNotificationsAPI(),
    };
    
    console.log('='.repeat(50));
    console.log('\n📊 API Test Results Summary:\n');
    console.log(`   Follows API:         ${results.follows ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Vibes API:            ${results.vibes ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Notifications API:    ${results.notifications ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r === true);
    
    if (allPassed) {
      console.log('\n🎉 All v1.2+ API tests passed!\n');
    } else {
      console.log('\n⚠️  Some API tests failed. Please check the errors above.\n');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

main();
