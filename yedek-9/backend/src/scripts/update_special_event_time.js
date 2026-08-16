import pool from '../config/database.js';

async function updateSpecialEventTime() {
  try {
    const now = new Date();
    // Update special event to start in 60 minutes (within starting_soon range)
    const newStartTime = new Date(now.getTime() + 60 * 60000);
    
    const result = await pool.query(
      `UPDATE rituals 
       SET start_time = $1 
       WHERE id = (
         SELECT id FROM rituals
         WHERE type = 'Special Event' 
           AND status = 'upcoming'
         ORDER BY created_at DESC 
         LIMIT 1
       )
       RETURNING id, title, start_time, type`,
      [newStartTime]
    );

    if (result.rows.length > 0) {
      console.log('✅ Updated special event:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('⚠️  No special event found to update');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating special event:', error);
    process.exit(1);
  }
}

updateSpecialEventTime();
