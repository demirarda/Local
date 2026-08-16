import pool from '../config/database.js';
import { updateRSForRitual } from '../services/rsEngine.js';
import { calculateDiversityMultiplier } from '../services/antiGaming.js';

/**
 * Test Diversity Regulator
 * 
 * Senaryo:
 * 1. Bir kullanıcı oluştur
 * 2. 6 ritual oluştur (farklı venue ve context'lerle)
 * 3. Her ritual sonrası RS'yi güncelle
 * 4. Diversity multiplier'ın doğru hesaplandığını kontrol et
 */

async function testDiversity() {
  try {
    console.log('🧪 Diversity Regulator Test\n');
    
    // 1. Test user oluştur
    console.log('1️⃣ Creating test user...');
    const userResult = await pool.query(
      `INSERT INTO users (name, city, rs_score) 
       VALUES ('Diversity Test User', 'Test City', 6.0) 
       RETURNING id, name, rs_score`
    );
    const user = userResult.rows[0];
    console.log(`✅ User created: ${user.name} (RS: ${user.rs_score})\n`);
    
    // 2. 6 ritual oluştur (farklı venue ve context'lerle)
    console.log('2️⃣ Creating 6 test rituals with different venues and contexts...');
    const rituals = [];
    const now = new Date();
    const venues = ['Venue A', 'Venue B', 'Venue C', 'Venue A', 'Venue B', 'Venue C'];
    const contexts = ['study', 'social', 'fitness', 'study', 'social', 'fitness'];
    
    for (let i = 0; i < 6; i++) {
      const ritualTime = new Date(now.getTime() + (i * 60 * 60 * 1000));
      const ritualResult = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, 60, 10, 'open', 41.0082, 28.9784, $5, 'ended')
         RETURNING id, title, venue_name, type`,
        [`Diversity Test Ritual ${i + 1}`, contexts[i], venues[i], ritualTime, user.id]
      );
      rituals.push(ritualResult.rows[0]);
      console.log(`   ✅ Ritual ${i + 1}: ${ritualResult.rows[0].title} (${ritualResult.rows[0].venue_name}, ${ritualResult.rows[0].type})`);
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
        [ritual.id, user.id, new Date(now.getTime() + (i * 60 * 60 * 1000))]
      );
      
      // Positive feedback oluştur
      // P2R feedback
      await pool.query(
        `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
         VALUES ($1, $2, 'p2r', 'green')
         ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
        [ritual.id, user.id]
      );
      
      // P2P feedback (simulated - başka bir user'dan)
      const otherUserResult = await pool.query(
        `INSERT INTO users (name, city, rs_score) 
         VALUES ($1, 'Test City', 6.0) 
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [`Diversity Test User ${i}`]
      );
      
      if (otherUserResult.rows.length > 0 || i === 0) {
        const otherUserId = otherUserResult.rows.length > 0 
          ? otherUserResult.rows[0].id 
          : user.id;
        
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
           VALUES ($1, $2, $3, 'p2p', 'green', 'green')
           ON CONFLICT (ritual_id, from_user_id, to_user_id, feedback_type) DO NOTHING`,
          [ritual.id, otherUserId, user.id]
        );
      }
      
      console.log(`   ✅ Ritual ${i + 1}: Attendance + Feedback created`);
      
      // Diversity multiplier'ı kontrol et (ritual öncesi)
      const diversityBefore = await calculateDiversityMultiplier(user.id, ritual.id);
      console.log(`      Diversity multiplier (before): ${diversityBefore.toFixed(3)}`);
      
      // RS güncelle
      console.log(`   🔄 Updating RS for ritual ${i + 1}...`);
      const updateResult = await updateRSForRitual(ritual.id, user.id);
      rsUpdates.push(updateResult);
      
      console.log(`      RS: ${updateResult.oldRS.toFixed(2)} → ${updateResult.newRS.toFixed(2)}`);
      console.log(`      Delta: ${updateResult.delta > 0 ? '+' : ''}${updateResult.delta.toFixed(3)}`);
      console.log(`      BC3: ${updateResult.bc3Multiplier.toFixed(2)}\n`);
    }
    
    // 4. Diversity analizi
    console.log('4️⃣ Diversity Analysis:');
    const diversityState = await pool.query(
      `SELECT ds_prev FROM user_diversity_state WHERE user_id = $1`,
      [user.id]
    );
    
    if (diversityState.rows.length > 0) {
      const dsPrev = parseFloat(diversityState.rows[0].ds_prev);
      console.log(`   Final DS (EMA): ${dsPrev.toFixed(3)}`);
      console.log(`   Expected multiplier range: 0.6 - 1.0`);
      console.log(`   Calculated multiplier: ${(0.6 + 0.4 * dsPrev).toFixed(3)}`);
    }
    
    // 5. Venue ve Context diversity kontrolü
    console.log('\n5️⃣ Venue and Context Diversity:');
    const venueQuery = await pool.query(
      `SELECT COUNT(DISTINCT r.venue_name) as unique_venues
       FROM rituals r
       JOIN ritual_attendance ra ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND ra.status != 'no_show'
       AND ra.ritual_id IN (
         SELECT ritual_id FROM ritual_attendance 
         WHERE user_id = $1 AND status != 'no_show'
         ORDER BY created_at DESC LIMIT 5
       )`,
      [user.id]
    );
    
    const contextQuery = await pool.query(
      `SELECT COUNT(DISTINCT r.type) as unique_contexts
       FROM rituals r
       JOIN ritual_attendance ra ON r.id = ra.ritual_id
       WHERE ra.user_id = $1 AND ra.status != 'no_show'
       AND ra.ritual_id IN (
         SELECT ritual_id FROM ritual_attendance 
         WHERE user_id = $1 AND status != 'no_show'
         ORDER BY created_at DESC LIMIT 5
       )`,
      [user.id]
    );
    
    const uniqueVenues = parseInt(venueQuery.rows[0]?.unique_venues) || 0;
    const uniqueContexts = parseInt(contextQuery.rows[0]?.unique_contexts) || 0;
    
    console.log(`   Unique venues (last 5): ${uniqueVenues}/5`);
    console.log(`   Unique contexts (last 5): ${uniqueContexts}/5`);
    console.log(`   Expected: 3 venues, 3 contexts (diverse)`);
    
    // Cleanup
    console.log('\n6️⃣ Cleaning up test data...');
    await pool.query('DELETE FROM user_diversity_state WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM rs_delta_history WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM feedback WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM rituals WHERE id = ANY($1::uuid[])', [rituals.map(r => r.id)]);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    console.log('✅ Test data cleaned up\n');
    
    console.log('🎉 Diversity Regulator Test Completed!\n');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

testDiversity().catch(console.error);
