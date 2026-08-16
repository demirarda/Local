import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

/**
 * Create RS History for a specific user
 * This script creates test rituals, feedback, and RS updates to populate RS history
 */

const TARGET_USER_ID = 'e7bac5bc-4793-4f9b-b945-27228ab4e649';

async function createRSHistory() {
  try {
    console.log('📊 Creating RS History for User\n');
    console.log(`Target User ID: ${TARGET_USER_ID}\n`);
    
    // 1. Check if user exists
    console.log('1️⃣ Checking if user exists...');
    const userResult = await pool.query(
      'SELECT id, name, rs_score FROM users WHERE id = $1',
      [TARGET_USER_ID]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found. Creating user...');
      await pool.query(
        `INSERT INTO users (id, name, city, university, rs_score)
         VALUES ($1, 'Test User', 'Istanbul', 'Test University', 6.0)`,
        [TARGET_USER_ID]
      );
      console.log('✅ User created\n');
    } else {
      const user = userResult.rows[0];
      console.log(`✅ User found: ${user.name} (RS: ${user.rs_score})\n`);
    }
    
    // 2. Clean existing RS history for this user (optional - comment out if you want to keep existing)
    console.log('2️⃣ Cleaning existing RS history...');
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [TARGET_USER_ID]);
    console.log('✅ Existing history cleaned\n');
    
    // 3. Create 5 rituals over the past 30 days
    console.log('3️⃣ Creating test rituals over the past 30 days...');
    const rituals = [];
    const now = new Date();
    
    // Create rituals spread over 30 days
    for (let i = 0; i < 5; i++) {
      // Spread rituals over 30 days (every 6 days)
      const daysAgo = 30 - (i * 6);
      const ritualTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      const ritualResult = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, title, start_time`,
        [
          `Test Ritual ${i + 1}`,
          'Study',
          `Test Venue ${i + 1}`,
          ritualTime,
          60,
          10,
          'open',
          41.0082 + (i * 0.01), // Slightly different locations
          28.9784 + (i * 0.01),
          TARGET_USER_ID,
          'ended'
        ]
      );
      rituals.push(ritualResult.rows[0]);
      console.log(`   ✅ Ritual ${i + 1} created: ${ritualResult.rows[0].title} (${new Date(ritualResult.rows[0].start_time).toLocaleDateString()})`);
    }
    console.log('');
    
    // 4. Create another user for feedback
    console.log('4️⃣ Creating feedback user...');
    const feedbackUserResult = await pool.query(
      `INSERT INTO users (name, city, university, rs_score)
       VALUES ('Feedback User', 'Istanbul', 'Test University', 6.0)
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const feedbackUserId = feedbackUserResult.rows.length > 0 
      ? feedbackUserResult.rows[0].id 
      : (await pool.query('SELECT id FROM users WHERE name = $1', ['Feedback User'])).rows[0].id;
    console.log(`✅ Feedback user ready\n`);
    
    // 5. Create attendance and feedback for each ritual, then update RS
    console.log('5️⃣ Creating attendance, feedback, and updating RS...');
    const rsUpdates = [];
    
    for (let i = 0; i < rituals.length; i++) {
      const ritual = rituals[i];
      
      // Create attendance
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
         VALUES ($1, $2, 'checked_in', $3)
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in', check_in_time = $3`,
        [ritual.id, TARGET_USER_ID, ritual.start_time]
      );
      
      // Create feedback (varying quality to show different RS changes)
      let q1Comfort, q2Energy, p2rFeeling;
      if (i === 0) {
        // First ritual: excellent
        q1Comfort = 'green';
        q2Energy = 'green';
        p2rFeeling = 'green';
      } else if (i === 1) {
        // Second ritual: good
        q1Comfort = 'green';
        q2Energy = 'yellow';
        p2rFeeling = 'green';
      } else if (i === 2) {
        // Third ritual: mixed
        q1Comfort = 'yellow';
        q2Energy = 'yellow';
        p2rFeeling = 'yellow';
      } else if (i === 3) {
        // Fourth ritual: good again
        q1Comfort = 'green';
        q2Energy = 'green';
        p2rFeeling = 'green';
      } else {
        // Fifth ritual: excellent
        q1Comfort = 'green';
        q2Energy = 'green';
        p2rFeeling = 'green';
      }
      
      // P2R feedback (to_user_id is NULL for P2R)
      // Check if feedback already exists
      const existingP2R = await pool.query(
        `SELECT id FROM feedback 
         WHERE ritual_id = $1 AND from_user_id = $2 AND feedback_type = 'p2r' AND to_user_id IS NULL`,
        [ritual.id, TARGET_USER_ID]
      );
      
      if (existingP2R.rows.length > 0) {
        await pool.query(
          `UPDATE feedback SET p2r_feeling = $1 WHERE id = $2`,
          [p2rFeeling, existingP2R.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
           VALUES ($1, $2, 'p2r', $3)`,
          [ritual.id, TARGET_USER_ID, p2rFeeling]
        );
      }
      
      // P2P feedback
      // Check if feedback already exists
      const existingP2P = await pool.query(
        `SELECT id FROM feedback 
         WHERE ritual_id = $1 AND from_user_id = $2 AND to_user_id = $3 AND feedback_type = 'p2p'`,
        [ritual.id, feedbackUserId, TARGET_USER_ID]
      );
      
      if (existingP2P.rows.length > 0) {
        await pool.query(
          `UPDATE feedback SET q1_comfort = $1, q2_energy = $2 WHERE id = $3`,
          [q1Comfort, q2Energy, existingP2P.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
           VALUES ($1, $2, $3, 'p2p', $4, $5)`,
          [ritual.id, feedbackUserId, TARGET_USER_ID, q1Comfort, q2Energy]
        );
      }
      
      console.log(`   ✅ Ritual ${i + 1}: Attendance + Feedback created`);
      
      // Update RS
      console.log(`   🔄 Updating RS for ritual ${i + 1}...`);
      const updateResult = await updateRSForRitual(ritual.id, TARGET_USER_ID);
      rsUpdates.push(updateResult);
      
      console.log(`      RS: ${updateResult.oldRS.toFixed(2)} → ${updateResult.newRS.toFixed(2)}`);
      console.log(`      Delta: ${updateResult.delta > 0 ? '+' : ''}${updateResult.delta.toFixed(3)}\n`);
    }
    
    // 6. Verify RS history
    console.log('6️⃣ Verifying RS history...');
    const historyResult = await pool.query(
      `SELECT COUNT(*) as count FROM rs_delta_history WHERE user_id = $1`,
      [TARGET_USER_ID]
    );
    console.log(`✅ RS history entries: ${historyResult.rows[0].count}\n`);
    
    // 7. Show final RS
    const finalUserResult = await pool.query(
      'SELECT rs_score FROM users WHERE id = $1',
      [TARGET_USER_ID]
    );
    const finalRS = parseFloat(finalUserResult.rows[0].rs_score) || 0;
    console.log(`📊 Final RS Score: ${finalRS.toFixed(2)}\n`);
    
    console.log('🎉 RS History created successfully!\n');
    console.log('You can now view the RS Transparency screen in the app.');
    
  } catch (error) {
    console.error('❌ Error creating RS history:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createRSHistory().catch(console.error);
