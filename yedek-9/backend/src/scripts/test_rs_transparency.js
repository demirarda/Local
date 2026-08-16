import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

/**
 * Test RS Transparency Dashboard
 * 
 * Senaryo:
 * 1. Bir kullanıcı oluştur
 * 2. 3 ritual oluştur ve feedback ver
 * 3. Her ritual sonrası RS'yi güncelle
 * 4. RS history endpoint'ini test et
 */

async function testRSTransparency() {
  try {
    console.log('🧪 RS Transparency Dashboard Test\n');
    
    // 1. Test user oluştur
    console.log('1️⃣ Creating test user...');
    const userResult = await pool.query(
      `INSERT INTO users (name, city, rs_score) 
       VALUES ('RS Transparency Test User', 'Test City', 6.0) 
       RETURNING id, name, rs_score`
    );
    const user = userResult.rows[0];
    console.log(`✅ User created: ${user.name} (RS: ${user.rs_score})\n`);
    
    // 2. 3 ritual oluştur
    console.log('2️⃣ Creating 3 test rituals...');
    const rituals = [];
    const now = new Date();
    
    for (let i = 0; i < 3; i++) {
      const ritualTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
      const ritualResult = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, 'test', 'Test Venue', $2, 60, 10, 'open', 41.0082, 28.9784, $3, 'ended')
         RETURNING id, title, start_time`,
        [`RS Transparency Test Ritual ${i + 1}`, ritualTime, user.id]
      );
      rituals.push(ritualResult.rows[0]);
      console.log(`   ✅ Ritual ${i + 1} created: ${ritualResult.rows[0].title}`);
    }
    console.log('');
    
    // 3. Her ritual için attendance ve feedback oluştur
    console.log('3️⃣ Creating attendance and feedback for each ritual...');
    const rsUpdates = [];
    
    for (let i = 0; i < rituals.length; i++) {
      const ritual = rituals[i];
      
      // Attendance oluştur
      await pool.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time)
         VALUES ($1, $2, 'checked_in', $3)
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'checked_in'`,
        [ritual.id, user.id, ritual.start_time]
      );
      
      // Positive feedback oluştur
      const feedbackType = i < 2 ? 'green' : 'yellow'; // İlk 2 green, son yellow
      
      // P2R feedback
      await pool.query(
        `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
         VALUES ($1, $2, 'p2r', $3)
         ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
        [ritual.id, user.id, feedbackType]
      );
      
      // P2P feedback (simulated - başka bir user'dan)
      const otherUserResult = await pool.query(
        `INSERT INTO users (name, city, rs_score) 
         VALUES ($1, 'Test City', 6.0) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [`RS Transparency Test User ${i}`]
      );
      
      if (otherUserResult.rows.length > 0 || i === 0) {
        const otherUserId = otherUserResult.rows.length > 0 
          ? otherUserResult.rows[0].id 
          : user.id;
        
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
           VALUES ($1, $2, $3, 'p2p', $4, $4)
           ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
          [ritual.id, otherUserId, user.id, feedbackType]
        );
      }
      
      console.log(`   ✅ Ritual ${i + 1}: Attendance + Feedback (${feedbackType}) created`);
      
      // RS güncelle
      console.log(`   🔄 Updating RS for ritual ${i + 1}...`);
      const updateResult = await updateRSForRitual(ritual.id, user.id);
      rsUpdates.push(updateResult);
      
      console.log(`      RS: ${updateResult.oldRS.toFixed(2)} → ${updateResult.newRS.toFixed(2)}`);
      console.log(`      Delta: ${updateResult.delta > 0 ? '+' : ''}${updateResult.delta.toFixed(3)}`);
      console.log(`      BC3: ${updateResult.bc3Multiplier.toFixed(2)}\n`);
    }
    
    // 4. RS history endpoint'ini test et
    console.log('4️⃣ Testing RS history endpoint...');
    const { default: express } = await import('express');
    const { default: usersRouter } = await import('../api/users.js');
    
    const app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);
    
    // Simulate request
    const req = {
      params: { id: user.id },
      query: { limit: 5 }
    };
    
    let resData = null;
    const res = {
      json: (data) => { resData = data; },
      status: (code) => ({ json: (data) => { resData = data; } })
    };
    
    // Call endpoint
    const handler = usersRouter.stack.find(layer => 
      layer.route && layer.route.path === '/:id/rs-history'
    );
    
    if (handler) {
      await handler.route.stack[0].handle(req, res);
      
      if (resData && resData.success) {
        console.log('✅ RS history endpoint working!\n');
        console.log('📊 RS History Data:');
        console.log(`   Current RS: ${resData.data.currentRS.toFixed(2)}`);
        console.log(`   Feedback Count: ${resData.data.feedbackCount}`);
        console.log(`   Changes: ${resData.data.changes.length} rituals\n`);
        
        resData.data.changes.forEach((change, index) => {
          console.log(`   Change ${index + 1}:`);
          console.log(`      Ritual: ${change.ritualTitle}`);
          console.log(`      Date: ${new Date(change.ritualDate).toLocaleString()}`);
          console.log(`      Delta: ${change.delta > 0 ? '+' : ''}${change.delta.toFixed(3)}`);
          console.log(`      RS: ${change.oldRS.toFixed(2)} → ${change.newRS.toFixed(2)}`);
          console.log(`      Reason: ${change.reasonSummary}`);
          console.log(`      IQ: ${change.details.interactionQuality.level} (${(change.details.interactionQuality.value * 100).toFixed(0)}%)`);
          console.log(`      CF: ${change.details.contextFit.level} (${(change.details.contextFit.value * 100).toFixed(0)}%)`);
          console.log(`      IF: ${(change.details.integrityFriction.value * 100).toFixed(0)}%`);
          if (change.details.integrityFriction.events.length > 0) {
            console.log(`      IF Events: ${change.details.integrityFriction.events.join(', ')}`);
          }
          console.log(`      Diversity: ${(change.details.diversityMultiplier * 100).toFixed(0)}%`);
          console.log(`      BC3: ${(change.details.bc3Multiplier * 100).toFixed(0)}%`);
          console.log('');
        });
      } else {
        console.log('❌ RS history endpoint failed:', resData);
      }
    } else {
      console.log('⚠️  Could not find RS history endpoint handler');
    }
    
    // Cleanup
    console.log('5️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('✅ Test data cleaned up\n');
    
    console.log('🎉 RS Transparency Test Completed!\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testRSTransparency().catch(console.error);
