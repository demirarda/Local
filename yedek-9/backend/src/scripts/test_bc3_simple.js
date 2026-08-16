import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

async function testBC3Simple() {
  try {
    console.log('🧪 Simple BC3 Test\n');
    
    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (name, city, rs_score) 
       VALUES ('BC3 Simple Test', 'Test City', 6.0) 
       RETURNING id`
    );
    const userId = userResult.rows[0].id;
    console.log(`✅ User created: ${userId}\n`);
    
    // Create 3 rituals
    const now = new Date();
    const rituals = [];
    for (let i = 0; i < 3; i++) {
      const ritualTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
      const ritualResult = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, 'test', 'Test Venue', $2, 60, 10, 'open', 41.0082, 28.9784, $3, 'ended')
         RETURNING id`,
        [`Ritual ${i + 1}`, ritualTime, userId]
      );
      rituals.push(ritualResult.rows[0].id);
    }
    console.log(`✅ Created 3 rituals\n`);
    
    // Process each ritual with positive feedback
    for (let i = 0; i < 3; i++) {
      const ritualId = rituals[i];
      
      // Attendance
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
         VALUES ($1, $2, 'checked_in', $3)
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
        [ritualId, userId, new Date(now.getTime() + (i * 60 * 60 * 1000))]
      );
      
      // Positive feedback
      await pool.query(
        `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
         VALUES ($1, $2, 'p2r', 'green')
         ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
        [ritualId, userId]
      );
      
      await pool.query(
        `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
         VALUES ($1, $2, $3, 'p2p', 'green', 'green')
         ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
        [ritualId, userId, userId]
      );
      
      // Update RS
      console.log(`🔄 Processing Ritual ${i + 1}...`);
      const result = await updateRSForRitual(ritualId, userId);
      console.log(`   RS: ${result.oldRS.toFixed(2)} → ${result.newRS.toFixed(2)}`);
      console.log(`   Delta before BC3: ${result.deltaBeforeBC3 > 0 ? '+' : ''}${result.deltaBeforeBC3.toFixed(3)}`);
      console.log(`   BC3 Multiplier: ${result.bc3Multiplier.toFixed(2)}`);
      console.log(`   Final Delta: ${result.delta > 0 ? '+' : ''}${result.delta.toFixed(3)}\n`);
      
      // Check stored values
      const historyResult = await pool.query(
        `SELECT delta, delta_before_bc3 FROM rs_delta_history 
         WHERE user_id = $1 AND ritual_id = $2`,
        [userId, ritualId]
      );
      if (historyResult.rows.length > 0) {
        const row = historyResult.rows[0];
        console.log(`   Stored delta: ${parseFloat(row.delta).toFixed(3)}`);
        console.log(`   Stored delta_before_bc3: ${row.delta_before_bc3 ? parseFloat(row.delta_before_bc3).toFixed(3) : 'NULL'}\n`);
      }
    }
    
    // Check BC3 calculation for 3rd ritual
    console.log('📊 BC3 Analysis for 3rd ritual:');
    const bc3Result = await pool.query(
      `SELECT COALESCE(delta_before_bc3, delta) as delta, created_at
       FROM rs_delta_history
       WHERE user_id = $1 AND ritual_id != $2
       ORDER BY created_at DESC
       LIMIT 3`,
      [userId, rituals[2]]
    );
    console.log(`   Last 3 deltas (before BC3):`);
    bc3Result.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${parseFloat(row.delta) > 0 ? '+' : ''}${parseFloat(row.delta).toFixed(3)}`);
    });
    
    const positiveCount = bc3Result.rows.filter(r => parseFloat(r.delta) > 0).length;
    console.log(`   Positive deltas: ${positiveCount}`);
    console.log(`   Expected BC3: ${positiveCount === 2 ? '0.5 (BC_POS_MEDIUM)' : positiveCount === 3 ? '1.0 (BC_POS_STRONG)' : '0.0 (BC_POS_WEAK)'}\n`);
    
    // Cleanup
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('✅ Cleanup completed\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testBC3Simple().catch(console.error);
