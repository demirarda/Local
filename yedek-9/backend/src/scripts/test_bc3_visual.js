import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

/**
 * Visual BC3 Test - Shows BC3 behavior in different scenarios
 */

async function createTestUser(name) {
  const result = await pool.query(
    `INSERT INTO users (name, city, rs_score) 
     VALUES ($1, 'Test City', 6.0) 
     RETURNING id, name, rs_score`,
    [name]
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

async function setupRitual(ritual, userId, feedbackValue) {
  // Attendance
  await pool.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
     VALUES ($1, $2, 'checked_in', $3)
     ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
    [ritual.id, userId, ritual.start_time]
  );
  
  // P2R feedback
  await pool.query(
    `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
     VALUES ($1, $2, 'p2r', $3)
     ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
    [ritual.id, userId, feedbackValue]
  );
  
  // P2P feedback
  await pool.query(
    `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
     VALUES ($1, $2, $3, 'p2p', $4, $4)
     ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
    [ritual.id, userId, userId, feedbackValue]
  );
  
  // Update RS
  return await updateRSForRitual(ritual.id, userId);
}

function getBC3Label(multiplier) {
  if (multiplier === 1.0) return 'STRONG (1.0x)';
  if (multiplier === 0.75) return 'MEDIUM (0.75x)';
  if (multiplier === 0.5) return 'MEDIUM (0.5x)';
  if (multiplier === 0.35) return 'WEAK (0.35x)';
  if (multiplier === 0.0) return 'WEAK (0.0x)';
  return `${multiplier.toFixed(2)}x`;
}

function getTrendIcon(multiplier, deltaBeforeBC3) {
  if (deltaBeforeBC3 > 0) {
    if (multiplier === 1.0) return '📈📈📈';
    if (multiplier === 0.5) return '📈📈';
    if (multiplier === 0.0) return '📈';
  } else if (deltaBeforeBC3 < 0) {
    if (multiplier === 1.0) return '📉📉📉';
    if (multiplier === 0.75) return '📉📉';
    if (multiplier === 0.35) return '📉';
  }
  return '➡️';
}

async function testScenario(scenarioName, feedbackSequence) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${scenarioName}`);
  console.log(`${'='.repeat(60)}`);
  
  const user = await createTestUser(`BC3 Test - ${scenarioName}`);
  const rituals = [];
  const updates = [];
  
  try {
    // Create rituals
    for (let i = 0; i < feedbackSequence.length; i++) {
      const ritual = await createTestRitual(user.id, `Ritual ${i + 1}`, i);
      rituals.push(ritual);
    }
    
    // Process each ritual
    console.log(`\n🔄 Processing ${feedbackSequence.length} rituals...\n`);
    
    for (let i = 0; i < rituals.length; i++) {
      const feedbackValue = feedbackSequence[i];
      const update = await setupRitual(rituals[i], user.id, feedbackValue);
      updates.push(update);
      
      const icon = feedbackValue === 'green' ? '✅' : feedbackValue === 'red' ? '❌' : '➡️';
      const trendIcon = getTrendIcon(update.bc3Multiplier, update.deltaBeforeBC3);
      const bc3Label = getBC3Label(update.bc3Multiplier);
      
      console.log(`Ritual ${i + 1} ${icon}`);
      console.log(`   Feedback: ${feedbackValue.toUpperCase()}`);
      console.log(`   RS: ${update.oldRS.toFixed(2)} → ${update.newRS.toFixed(2)}`);
      console.log(`   Delta (raw): ${update.deltaBeforeBC3 > 0 ? '+' : ''}${update.deltaBeforeBC3.toFixed(3)}`);
      console.log(`   BC3: ${trendIcon} ${bc3Label}`);
      console.log(`   Delta (final): ${update.delta > 0 ? '+' : ''}${update.delta.toFixed(3)}`);
      console.log('');
    }
    
    // Summary
    console.log(`📊 Summary:`);
    console.log(`   Initial RS: 6.00`);
    console.log(`   Final RS: ${updates[updates.length - 1].newRS.toFixed(2)}`);
    console.log(`   Total Change: ${(updates[updates.length - 1].newRS - 6.0) > 0 ? '+' : ''}${(updates[updates.length - 1].newRS - 6.0).toFixed(2)}`);
    
    // BC3 Analysis
    const lastUpdate = updates[updates.length - 1];
    const historyResult = await pool.query(
      `SELECT COALESCE(delta_before_bc3, delta) as delta
       FROM rs_delta_history
       WHERE user_id = $1 AND ritual_id != $2
       ORDER BY created_at DESC
       LIMIT 3`,
      [user.id, rituals[rituals.length - 1].id]
    );
    
    if (historyResult.rows.length > 0) {
      const deltas = historyResult.rows.map(r => parseFloat(r.delta));
      const positiveCount = deltas.filter(d => d > 0).length;
      const negativeCount = deltas.filter(d => d < 0).length;
      
      console.log(`\n   BC3 Analysis (last 3 rituals):`);
      console.log(`   Deltas: ${deltas.map(d => `${d > 0 ? '+' : ''}${d.toFixed(3)}`).join(', ')}`);
      console.log(`   Positive: ${positiveCount}, Negative: ${negativeCount}`);
      console.log(`   BC3 Applied: ${getBC3Label(lastUpdate.bc3Multiplier)}`);
    }
    
    // Cleanup
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    // Cleanup on error
    if (rituals.length > 0) {
      await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
      await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
      await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
      await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    throw error;
  }
}

async function main() {
  console.log('\n🧪 BC3 Visual Test Suite');
  console.log('='.repeat(60));
  console.log('\nBu test, BC3 Trend Supervisor\'ın farklı senaryolardaki');
  console.log('davranışını görsel olarak gösterir.\n');
  
  try {
    // Scenario 1: Strong Positive Trend (3 positive)
    await testScenario('Strong Positive Trend', ['green', 'green', 'green', 'green']);
    
    // Scenario 2: Medium Positive Trend (2 positive)
    await testScenario('Medium Positive Trend', ['green', 'green', 'green']);
    
    // Scenario 3: Weak Positive Trend (1 positive)
    await testScenario('Weak Positive Trend', ['green', 'green']);
    
    // Scenario 4: Strong Negative Trend (3 negative)
    await testScenario('Strong Negative Trend', ['green', 'red', 'red', 'red']);
    
    // Scenario 5: Medium Negative Trend (2 negative)
    await testScenario('Medium Negative Trend', ['green', 'red', 'red']);
    
    // Scenario 6: Weak Negative Trend (1 negative)
    await testScenario('Weak Negative Trend', ['green', 'red']);
    
    // Scenario 7: Mixed Trend (neutral)
    await testScenario('Mixed Trend (Neutral)', ['green', 'red', 'green']);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Tüm BC3 testleri tamamlandı!');
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
