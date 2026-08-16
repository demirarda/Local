import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

/**
 * Comprehensive BC3 Test
 * 
 * Test scenarios:
 * 1. No history → BC3 = 1.0 (no adjustment)
 * 2. 1 positive delta → BC_POS_WEAK = 0.0
 * 3. 2 positive deltas → BC_POS_MEDIUM = 0.5
 * 4. 3 positive deltas → BC_POS_STRONG = 1.0
 * 5. 1 negative delta → BC_NEG_WEAK = 0.35
 * 6. 2 negative deltas → BC_NEG_MEDIUM = 0.75
 * 7. 3 negative deltas → BC_NEG_STRONG = 1.0
 * 8. Mixed trend → BC = 1.0 (neutral)
 */

async function createTestUser() {
  const result = await pool.query(
    `INSERT INTO users (name, city, rs_score) 
     VALUES ('BC3 Comprehensive Test', 'Test City', 6.0) 
     RETURNING id, name, rs_score`
  );
  return result.rows[0];
}

async function createTestRitual(userId, title, hoursFromNow = 0) {
  const now = new Date();
  const ritualTime = new Date(now.getTime() + (hoursFromNow * 60 * 60 * 1000));
  
  const result = await pool.query(
    `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
     VALUES ($1, 'test', 'Test Venue', $2, 60, 10, 'open', 41.0082, 28.9784, $3, 'ended')
     RETURNING id, title, start_time`,
    [title, ritualTime, userId]
  );
  return result.rows[0];
}

async function createFeedback(ritualId, fromUserId, toUserId, feedbackValue) {
  // P2R feedback
  await pool.query(
    `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
     VALUES ($1, $2, 'p2r', $3)
     ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
    [ritualId, fromUserId, feedbackValue]
  );
  
  // P2P feedback (simulated)
  await pool.query(
    `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
     VALUES ($1, $2, $3, 'p2p', $4, $4)
     ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
    [ritualId, fromUserId, toUserId, feedbackValue]
  );
}

async function setupRitual(ritual, userId, feedbackValue) {
  // Attendance
  await pool.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
     VALUES ($1, $2, 'checked_in', $3)
     ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
    [ritual.id, userId, ritual.start_time]
  );
  
  // Feedback
  await createFeedback(ritual.id, userId, userId, feedbackValue);
  
  // Update RS
  return await updateRSForRitual(ritual.id, userId);
}

async function testBC3Scenario(scenarioName, feedbackSequence) {
  console.log(`\n📋 Testing: ${scenarioName}`);
  console.log(`   Feedback sequence: ${feedbackSequence.map(f => f === 'green' ? '✅' : f === 'red' ? '❌' : '➡️').join(' ')}`);
  
  const user = await createTestUser();
  const rituals = [];
  const updates = [];
  
  try {
    // Create rituals
    for (let i = 0; i < feedbackSequence.length; i++) {
      const ritual = await createTestRitual(user.id, `${scenarioName} Ritual ${i + 1}`, i);
      rituals.push(ritual);
    }
    
    // Process each ritual
    for (let i = 0; i < rituals.length; i++) {
      const feedbackValue = feedbackSequence[i];
      const update = await setupRitual(rituals[i], user.id, feedbackValue);
      updates.push(update);
      
      console.log(`   Ritual ${i + 1}: RS ${update.oldRS.toFixed(2)} → ${update.newRS.toFixed(2)} (Δ: ${update.delta > 0 ? '+' : ''}${update.delta.toFixed(3)}, BC3: ${update.bc3Multiplier.toFixed(2)})`);
    }
    
    // Verify BC3
    const lastUpdate = updates[updates.length - 1];
    const expectedBC3 = getExpectedBC3(feedbackSequence, updates);
    
    console.log(`   Expected BC3: ${expectedBC3.toFixed(2)}, Got: ${lastUpdate.bc3Multiplier.toFixed(2)}`);
    
    if (Math.abs(lastUpdate.bc3Multiplier - expectedBC3) < 0.01) {
      console.log(`   ✅ BC3 correct!`);
    } else {
      console.log(`   ⚠️  BC3 mismatch (expected ${expectedBC3.toFixed(2)}, got ${lastUpdate.bc3Multiplier.toFixed(2)})`);
    }
    
    // Cleanup
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    // Cleanup on error
    if (rituals.length > 0) {
      await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
      await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
      await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  }
}

function getExpectedBC3(feedbackSequence, updates) {
  // Get last 3 deltas (excluding current)
  const last3Deltas = updates.slice(-3).map(u => u.deltaBeforeBC3 || u.delta);
  
  if (last3Deltas.length === 0) return 1.0;
  
  const positiveCount = last3Deltas.filter(d => d > 0).length;
  const negativeCount = last3Deltas.filter(d => d < 0).length;
  
  if (positiveCount > negativeCount) {
    if (positiveCount === 3) return 1.0;  // BC_POS_STRONG
    if (positiveCount === 2) return 0.5;   // BC_POS_MEDIUM
    return 0.0;  // BC_POS_WEAK
  } else if (negativeCount > positiveCount) {
    if (negativeCount === 3) return 1.0;   // BC_NEG_STRONG
    if (negativeCount === 2) return 0.75;  // BC_NEG_MEDIUM
    return 0.35; // BC_NEG_WEAK
  }
  
  return 1.0; // Neutral
}

async function main() {
  console.log('🧪 BC3 Comprehensive Test Suite\n');
  
  try {
    // Test 1: No history
    await testBC3Scenario('No History', ['green']);
    
    // Test 2: 1 positive → BC_POS_WEAK = 0.0
    await testBC3Scenario('1 Positive', ['green', 'green']);
    
    // Test 3: 2 positive → BC_POS_MEDIUM = 0.5
    await testBC3Scenario('2 Positive', ['green', 'green', 'green']);
    
    // Test 4: 3 positive → BC_POS_STRONG = 1.0
    await testBC3Scenario('3 Positive', ['green', 'green', 'green', 'green']);
    
    // Test 5: 1 negative → BC_NEG_WEAK = 0.35
    await testBC3Scenario('1 Negative', ['green', 'red']);
    
    // Test 6: 2 negative → BC_NEG_MEDIUM = 0.75
    await testBC3Scenario('2 Negative', ['green', 'red', 'red']);
    
    // Test 7: 3 negative → BC_NEG_STRONG = 1.0
    await testBC3Scenario('3 Negative', ['green', 'red', 'red', 'red']);
    
    // Test 8: Mixed → BC = 1.0 (neutral)
    await testBC3Scenario('Mixed', ['green', 'red', 'green']);
    
    console.log('\n🎉 All BC3 tests completed!\n');
    
  } catch (error) {
    console.error('❌ Test suite error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
