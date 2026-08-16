import pool from '../config/database.js';

/**
 * Veritabanına örnek bir Host Memory Share ekler.
 * Pulse feed'de "HOST MEMORY SHARE" kartı olarak görünür (host verified veya viewer host'u follow ediyorsa).
 */
async function addHostMemoryExample() {
  try {
    console.log('Adding example host memory...');

    // Önce tüm pulse memory paylaşan host'ları verified yap (mevcut host memory'ler görünsün)
    const hostsWithMemory = await pool.query(
      `SELECT DISTINCT m.user_id FROM memories m
       WHERE m.memory_type = 'pulse' AND m.expires_at > CURRENT_TIMESTAMP`
    );
    for (const row of hostsWithMemory.rows) {
      await pool.query(
        `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
         VALUES ($1, 'admin', 'standard', 'active')
         ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
        [row.user_id]
      );
    }
    if (hostsWithMemory.rows.length > 0) {
      console.log('✅ Pulse memory paylaşan', hostsWithMemory.rows.length, 'host verified yapıldı.');
    }

    // Henüz host memory'si olmayan bir ritüel bul
    const ritualRes = await pool.query(
      `SELECT r.id, r.title, r.venue_name, r.host_id, u.city
       FROM rituals r
       JOIN users u ON r.host_id = u.id
       WHERE r.status IN ('upcoming', 'live', 'ended')
         AND NOT EXISTS (
           SELECT 1 FROM memories m
           WHERE m.ritual_id = r.id AND m.user_id = r.host_id AND m.memory_type = 'pulse'
         )
       ORDER BY r.created_at DESC
       LIMIT 1`
    );

    if (ritualRes.rows.length === 0) {
      console.log('ℹ️ Tüm ritüeller için zaten host memory var. Yine de ekstra bir tane ekleniyor (Sunset Aperitivo Milano)...');
      const fallback = await pool.query(
        `SELECT r.id, r.title, r.venue_name, r.host_id, u.city
         FROM rituals r JOIN users u ON r.host_id = u.id
         WHERE r.title = $1 AND r.venue_name = $2 LIMIT 1`,
        ['Sunset Aperitivo', 'Terrazza Aperol']
      );
      if (fallback.rows.length === 0) {
        console.log('❌ Ritüel bulunamadı. Önce: npm run seed:pulse');
        process.exit(1);
      }
      ritualRes.rows[0] = fallback.rows[0];
    }

    const ritual = ritualRes.rows[0];
    const hostId = ritual.host_id;
    const ritualId = ritual.id;
    const city = ritual.city;

    const existing = await pool.query(
      `SELECT id FROM memories
       WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse'
       LIMIT 1`,
      [ritualId, hostId]
    );
    if (existing.rows.length > 0) {
      console.log('ℹ️ Bu ritüel için host memory zaten var:', ritual.title, '·', ritual.venue_name);
      process.exit(0);
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const content = `Shared a ritual memory: ${ritual.title} at ${ritual.venue_name}. High energy.`;

    await pool.query(
      `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
       VALUES ($1, $2, $3, 'pulse', $4)`,
      [ritualId, hostId, content, expiresAt]
    );

    // Host'u verified yap ki Pulse API eligibility'dan geçsin (verified host = görünür)
    await pool.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'active', verified_by = 'admin', verified_at = CURRENT_TIMESTAMP`,
      [hostId]
    );

    console.log('✅ Yeni host memory eklendi:', ritual.title, '·', ritual.venue_name, '(' + city + ')');
    console.log('   Pulse\'ta görmek için: ilgili şehirle giriş yapıp aşağı çekerek yenileyin.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

addHostMemoryExample();
