import pool from '../config/database.js';
import { updateRSForRitual, getRSCalculationDetails } from '../services/rsEngine.js';

async function testRSEngine() {
  try {
    console.log('🧪 Testing RS Engine\n');

    // Get a test user and ritual
    const userResult = await pool.query('SELECT id, name, rs_score FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found. Please create test data first.');
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`📊 Testing RS for user: ${user.name}`);
    console.log(`   Current RS: ${user.rs_score}\n`);

    // Get a ritual this user attended
    const ritualResult = await pool.query(
      'SELECT id, title FROM rituals WHERE id IN (SELECT ritual_id FROM ritual_attendance WHERE user_id = $1) LIMIT 1',
      [user.id]
    );

    if (ritualResult.rows.length === 0) {
      console.log('⚠️  User has not attended any rituals. Creating test scenario...\n');
      
      // Create a test ritual and attendance
      const hostResult = await pool.query('SELECT id FROM users LIMIT 1');
      const hostId = hostResult.rows[0].id;

      const newRitual = await pool.query(
        `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        ['Test RS Ritual', 'Test', 'Test Venue', new Date(Date.now() - 3600000), 60, 10, 'open', 41.0082, 28.9784, hostId, 'ended']
      );

      const ritualId = newRitual.rows[0].id;

      // Add attendance
      await pool.query(
        'INSERT INTO ritual_attendance (ritual_id, user_id, status, check_in_time) VALUES ($1, $2, $3, $4)',
        [ritualId, user.id, 'checked_in', new Date(Date.now() - 3300000)]
      );

      console.log(`✅ Created test ritual: ${ritualId}\n`);

      // Add some test feedback
      const otherUserResult = await pool.query('SELECT id FROM users WHERE id != $1 LIMIT 1', [user.id]);
      if (otherUserResult.rows.length > 0) {
        const otherUserId = otherUserResult.rows[0].id;

        // P2P feedback
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, to_user_id, feedback_type, q1_comfort, q2_energy)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [ritualId, otherUserId, user.id, 'p2p', 'green', 'green']
        );

        // P2R feedback
        await pool.query(
          `INSERT INTO feedback (ritual_id, from_user_id, feedback_type, p2r_feeling)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [ritualId, user.id, 'p2r', 'green']
        );

        console.log('✅ Created test feedback\n');
      }

      // Test RS calculation
      console.log('📈 Calculating RS details...\n');
      const details = await getRSCalculationDetails(ritualId, user.id);
      console.log('RS Calculation Details:');
      console.log(`   Attendance (A_r): ${details.attendance.toFixed(3)}`);
      console.log(`   Interaction Quality (IQ_r): ${details.interactionQuality.toFixed(3)}`);
      console.log(`   Context Fit (CF_r): ${details.contextFit.toFixed(3)}`);
      console.log(`   Integrity Friction (IF_r): ${details.integrityFriction.toFixed(3)}`);
      console.log(`   Truth Signal (S_r): ${details.truthSignal.toFixed(3)}`);
      console.log(`   Delta (Δ): ${details.delta > 0 ? '+' : ''}${details.delta.toFixed(3)}\n`);

      // Update RS
      console.log('🔄 Updating RS...\n');
      const result = await updateRSForRitual(ritualId, user.id);
      console.log(`✅ RS Updated:`);
      console.log(`   Old RS: ${result.oldRS.toFixed(2)}`);
      console.log(`   New RS: ${result.newRS.toFixed(2)}`);
      console.log(`   Delta: ${result.delta > 0 ? '+' : ''}${result.delta.toFixed(3)}\n`);

      // Verify update
      const updatedUser = await pool.query('SELECT rs_score FROM users WHERE id = $1', [user.id]);
      console.log(`✅ Verified RS in database: ${parseFloat(updatedUser.rows[0].rs_score).toFixed(2)}\n`);

    } else {
      const ritual = ritualResult.rows[0];
      console.log(`📊 Testing with ritual: ${ritual.title}\n`);

      // Get RS calculation details
      const details = await getRSCalculationDetails(ritual.id, user.id);
      console.log('RS Calculation Details:');
      console.log(`   Attendance (A_r): ${details.attendance.toFixed(3)}`);
      console.log(`   Interaction Quality (IQ_r): ${details.interactionQuality.toFixed(3)}`);
      console.log(`   Context Fit (CF_r): ${details.contextFit.toFixed(3)}`);
      console.log(`   Integrity Friction (IF_r): ${details.integrityFriction.toFixed(3)}`);
      console.log(`   Truth Signal (S_r): ${details.truthSignal.toFixed(3)}`);
      console.log(`   Delta (Δ): ${details.delta > 0 ? '+' : ''}${details.delta.toFixed(3)}\n`);

      // Update RS
      const result = await updateRSForRitual(ritual.id, user.id);
      console.log(`✅ RS Updated:`);
      console.log(`   Old RS: ${result.oldRS.toFixed(2)}`);
      console.log(`   New RS: ${result.newRS.toFixed(2)}`);
      console.log(`   Delta: ${result.delta > 0 ? '+' : ''}${result.delta.toFixed(3)}\n`);
    }

    console.log('✅ RS Engine test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing RS Engine:', error);
    process.exit(1);
  }
}

testRSEngine();
