import 'dotenv/config';
import pool from '../config/database.js';

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id
       FROM users
       WHERE avatar_url IS NULL OR TRIM(avatar_url) = ''
       ORDER BY created_at ASC
       LIMIT 200`
    );

    let updated = 0;
    for (const row of res.rows) {
      const id = String(row.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'u';
      const avatarUrl = `https://picsum.photos/seed/user-${id}/240/240`;
      await client.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatarUrl, row.id]);
      updated += 1;
    }

    console.log(`✅ Avatar seed tamamlandı. Güncellenen kullanıcı: ${updated}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Avatar seed hatası:', err);
  process.exit(1);
});
