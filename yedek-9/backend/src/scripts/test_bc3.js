import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';

/**
 * Test BC3 Trend Supervisor
 * 
 * Senaryo:
 * 1. Bir kullanıcı oluştur
 * 2. 3 ritual oluştur ve feedback ver
 * 3. Her ritual sonrası RS'yi güncelle
 * 4. BC3 multiplier'ın doğru uygulandığını kontrol et
 */

async function testBC3() {
  try {
    console.log('🧪 BC3 Trend Supervisor Test\n');
    
    // 1. Test user oluştur
    console.log('1️⃣ Creating test user...');
    const userResult = await pool.query(
      `INSERT INTO users (name, city, rs_score) 
       VALUES ('BC3 Test User', 'Test City', 6.0) 
       RETURNING id, name, rs_score`
    );
    const user = userResult.rows[0];
    console.log(`✅ User created: ${user.name} (RS: ${user.rs_score})\n`);
    
    // 2. 3 ritual oluştur
    console.log('2️⃣ Creating 3 test rituals...');
    const rituals = [];
    const now = new Date();
    
    for (let i = 0; i < 3; i++) {
      const ritualTime = new Date(now.getTime() + (i * 60 * 60 * 1000)); // 1 saat arayla
      const ritualResult = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, 'test', 'Test Venue', $2, 60, 10, 'open', 41.0082, 28.9784, $3, 'ended')
         RETURNING id, title, start_time`,
        [`BC3 Test Ritual ${i + 1}`, ritualTime, user.id]
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
      
      // Positive feedback oluştur (ilk 2 ritual için)
      // Son ritual için negative feedback (trend testi için)
      const feedbackType = i < 2 ? 'green' : 'red';
      
      // P2R feedback (ritual feeling)
      await pool.query(
        `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
         VALUES ($1, $2, 'p2r', $3)
         ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
        [ritual.id, user.id, feedbackType]
      );
      
      // P2P feedback (simulated - başka bir user'dan)
      // Test için, kendine feedback veriyoruz (normalde olmaz ama test için)
      const otherUserResult = await pool.query(
        `INSERT INTO users (name, city, rs_score) 
         VALUES ($1, 'Test City', 6.0) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [`BC3 Test User ${i}`]
      );
      
      if (otherUserResult.rows.length > 0 || i === 0) {
        const otherUserId = otherUserResult.rows.length > 0 
          ? otherUserResult.rows[0].id 
          : user.id; // İlk ritual için kendine feedback
        
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
      
      console.log(`      Old RS: ${updateResult.oldRS.toFixed(2)}`);
      console.log(`      New RS: ${updateResult.newRS.toFixed(2)}`);
      console.log(`      Delta: ${updateResult.delta > 0 ? '+' : ''}${updateResult.delta.toFixed(3)}`);
      console.log(`      BC3 Multiplier: ${updateResult.bc3Multiplier.toFixed(2)}`);
      console.log(`      Delta before BC3: ${updateResult.deltaBeforeBC3 > 0 ? '+' : ''}${updateResult.deltaBeforeBC3.toFixed(3)}\n`);
    }
    
    // 4. BC3 trend analizi
    console.log('4️⃣ BC3 Trend Analysis:');
    console.log('   Last 3 rituals:');
    for (let i = 0; i < rsUpdates.length; i++) {
      const update = rsUpdates[i];
      const trend = update.delta > 0 ? '📈 Positive' : update.delta < 0 ? '📉 Negative' : '➡️  Neutral';
      console.log(`   ${i + 1}. ${trend} (Δ: ${update.delta > 0 ? '+' : ''}${update.delta.toFixed(3)}, BC3: ${update.bc3Multiplier.toFixed(2)})`);
    }
    
    // BC3 multiplier'ları kontrol et
    console.log('\n5️⃣ BC3 Multiplier Verification:');
    const positiveCount = rsUpdates.filter(u => u.delta > 0).length;
    const negativeCount = rsUpdates.filter(u => u.delta < 0).length;
    
    console.log(`   Positive deltas: ${positiveCount}`);
    console.log(`   Negative deltas: ${negativeCount}`);
    
    if (positiveCount === 2 && negativeCount === 1) {
      // Son ritual negative, ilk 2 positive
      // BC3 should apply BC_NEG_WEAK (0.35) for the last ritual
      const lastBC3 = rsUpdates[rsUpdates.length - 1].bc3Multiplier;
      if (Math.abs(lastBC3 - 0.35) < 0.01) {
        console.log(`   ✅ BC3 correctly applied BC_NEG_WEAK (0.35) for negative trend`);
      } else {
        console.log(`   ⚠️  BC3 multiplier mismatch. Expected ~0.35, got ${lastBC3.toFixed(2)}`);
      }
    }
    
    // Final RS
    const finalUser = await pool.query('SELECT rs_score FROM users WHERE id = $1', [user.id]);
    console.log(`\n6️⃣ Final RS: ${parseFloat(finalUser.rows[0].rs_score).toFixed(2)}`);
    
    // Cleanup
    console.log('\n7️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('✅ Test data cleaned up\n');
    
    console.log('🎉 BC3 Test Completed!\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testBC3().catch(console.error);
