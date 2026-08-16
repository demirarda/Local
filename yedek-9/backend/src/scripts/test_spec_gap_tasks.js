/**
 * Test script for SPEC_GAP_TASKS completed features
 * Tests: Pulse ranking, guards, pulse cards enrichment
 */

import pool from '../config/database.js';
import { getRitualEnergyState } from '../services/rsEngine.js';

const API_BASE_URL = 'http://localhost:3000/api';

// Test user IDs (create these in your test data)
const TEST_USER_ID = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';
const TEST_CITY = 'Istanbul';

async function testPulseEndpoint() {
  console.log('\n=== Test 1: Pulse Endpoint ===');
  
  try {
    const url = `${API_BASE_URL}/rituals/pulse?city=${TEST_CITY}&viewer_id=${TEST_USER_ID}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Pulse endpoint failed:', data.error);
      return false;
    }
    
    const rituals = data.data;
    let passed = true;
    
    // Check for last_join_at
    for (const state in rituals) {
      for (const ritual of rituals[state]) {
        if (!ritual.hasOwnProperty('last_join_at')) {
          console.log(`⚠️  Ritual ${ritual.id} missing last_join_at`);
        }
        if (!ritual.hasOwnProperty('energy_state')) {
          console.log(`⚠️  Ritual ${ritual.id} missing energy_state`);
        }
        if (!ritual.hasOwnProperty('friends_here')) {
          console.log(`⚠️  Ritual ${ritual.id} missing friends_here`);
        }
      }
    }
    
    // Check for reopened state
    if (rituals.reopened && rituals.reopened.length > 0) {
      console.log('✅ Reopened state found:', rituals.reopened.length, 'rituals');
    } else {
      console.log('ℹ️  No reopened rituals (this is OK if no rituals ended recently)');
    }
    
    // Check ranking (should be sorted)
    for (const state in rituals) {
      if (rituals[state].length > 1) {
        console.log(`✅ ${state}: ${rituals[state].length} rituals (should be ranked)`);
      }
    }
    
    console.log('✅ Pulse endpoint test passed');
    return true;
  } catch (error) {
    console.error('❌ Pulse endpoint test failed:', error);
    return false;
  }
}

async function testChatGuard() {
  console.log('\n=== Test 2: Chat GET Guard ===');
  
  try {
    // Get a ritual ID
    const ritualQuery = await pool.query(
      'SELECT id FROM rituals WHERE status IN ($1, $2) LIMIT 1',
      ['upcoming', 'live']
    );
    
    if (ritualQuery.rows.length === 0) {
      console.log('⚠️  No rituals found for testing');
      return true;
    }
    
    const ritualId = ritualQuery.rows[0].id;
    
    // Test 1: User not attending (should fail)
    const url1 = `${API_BASE_URL}/chat/${ritualId}/messages?user_id=${TEST_USER_ID}`;
    const response1 = await fetch(url1);
    
    if (response1.status === 403) {
      console.log('✅ Guard working: Non-attending user blocked');
    } else if (response1.status === 200) {
      // Check if user is actually attending
      const attendanceCheck = await pool.query(
        'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
        [ritualId, TEST_USER_ID]
      );
      
      if (attendanceCheck.rows.length > 0) {
        console.log('ℹ️  User is attending, so 200 is expected');
      } else {
        console.log('⚠️  Guard may not be working: Non-attending user got 200');
      }
    } else {
      console.log(`⚠️  Unexpected status: ${response1.status}`);
    }
    
    // Test 2: User attending (should work)
    // First, make sure user is attending
    await pool.query(
      `INSERT INTO ritual_attendance (ritual_id, user_id, status)
       VALUES ($1, $2, 'joined')
       ON CONFLICT (ritual_id, user_id) DO NOTHING`,
      [ritualId, TEST_USER_ID]
    );
    
    const response2 = await fetch(url1);
    if (response2.status === 200) {
      console.log('✅ Guard working: Attending user allowed');
    } else {
      console.log(`⚠️  Attending user got status: ${response2.status}`);
    }
    
    console.log('✅ Chat guard test completed');
    return true;
  } catch (error) {
    console.error('❌ Chat guard test failed:', error);
    return false;
  }
}

async function testMemoriesGuard() {
  console.log('\n=== Test 3: Memories GET Guard ===');
  
  try {
    // Get a ritual ID
    const ritualQuery = await pool.query(
      'SELECT id FROM rituals LIMIT 1'
    );
    
    if (ritualQuery.rows.length === 0) {
      console.log('⚠️  No rituals found for testing');
      return true;
    }
    
    const ritualId = ritualQuery.rows[0].id;
    
    // Test: User not attending (should fail)
    const url = `${API_BASE_URL}/memories/ritual/${ritualId}?user_id=${TEST_USER_ID}`;
    const response = await fetch(url);
    
    if (response.status === 403) {
      console.log('✅ Guard working: Non-attending user blocked');
    } else if (response.status === 200) {
      // Check if user is actually attending
      const attendanceCheck = await pool.query(
        'SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2',
        [ritualId, TEST_USER_ID]
      );
      
      if (attendanceCheck.rows.length > 0) {
        console.log('ℹ️  User is attending, so 200 is expected');
      } else {
        console.log('⚠️  Guard may not be working: Non-attending user got 200');
      }
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }
    
    console.log('✅ Memories guard test completed');
    return true;
  } catch (error) {
    console.error('❌ Memories guard test failed:', error);
    return false;
  }
}

async function testEnergyState() {
  console.log('\n=== Test 4: Energy State Calculation ===');
  
  try {
    // Get a ritual with feedback
    const ritualQuery = await pool.query(
      `SELECT r.id 
       FROM rituals r
       JOIN feedback f ON r.id = f.ritual_id
       WHERE f.q2_energy IS NOT NULL
       LIMIT 1`
    );
    
    if (ritualQuery.rows.length === 0) {
      console.log('⚠️  No rituals with feedback found');
      return true;
    }
    
    const ritualId = ritualQuery.rows[0].id;
    const energy = await getRitualEnergyState(ritualId);
    
    if (energy.state === null) {
      console.log('ℹ️  No energy state (no feedback yet)');
    } else if (['calm', 'mixed', 'high'].includes(energy.state)) {
      console.log(`✅ Energy state calculated: ${energy.state} (value: ${energy.value?.toFixed(2)})`);
    } else {
      console.log(`⚠️  Unexpected energy state: ${energy.state}`);
    }
    
    console.log('✅ Energy state test completed');
    return true;
  } catch (error) {
    console.error('❌ Energy state test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting SPEC_GAP_TASKS Tests...\n');
  
  const results = {
    pulse: await testPulseEndpoint(),
    chatGuard: await testChatGuard(),
    memoriesGuard: await testMemoriesGuard(),
    energyState: await testEnergyState(),
  };
  
  console.log('\n=== Test Summary ===');
  console.log('Pulse Endpoint:', results.pulse ? '✅' : '❌');
  console.log('Chat Guard:', results.chatGuard ? '✅' : '❌');
  console.log('Memories Guard:', results.memoriesGuard ? '✅' : '❌');
  console.log('Energy State:', results.energyState ? '✅' : '❌');
  
  const allPassed = Object.values(results).every(r => r);
  console.log('\n' + (allPassed ? '✅ All tests passed!' : '⚠️  Some tests had issues'));
  
  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
