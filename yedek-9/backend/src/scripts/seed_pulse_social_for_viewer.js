import 'dotenv/config';
import pool from '../config/database.js';

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || '200541032@firat.edu.tr';

const PHOTO_URL =
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&h=900&fit=crop&q=80';
const PLAYLIST_URL = 'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id, name, city FROM users WHERE email = $1 LIMIT 1',
      [TARGET_EMAIL]
    );
    if (!userRes.rows.length) {
      throw new Error(`User not found for email: ${TARGET_EMAIL}`);
    }
    const viewer = userRes.rows[0];

    const ritualRes = await client.query(
      `SELECT r.id, r.title
       FROM rituals r
       JOIN ritual_attendance ra ON ra.ritual_id = r.id AND ra.user_id = $1
       WHERE r.suspended_at IS NULL
       ORDER BY r.start_time DESC
       LIMIT 1`,
      [viewer.id]
    );
    if (!ritualRes.rows.length) {
      throw new Error('No attended ritual found for viewer');
    }
    const ritual = ritualRes.rows[0];

    // Make viewer an active verified host so Pulse eligibility includes these memories too.
    await client.query(
      `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
       VALUES ($1, 'admin', 'standard', 'active')
       ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
      [viewer.id]
    );

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const rows = [
      {
        content: '[PHOTO] Navigli gecesi, guzel bir enerji vardi.',
        type: 'photo',
        destination: 'ritual_and_pulse',
        content_text: 'Navigli gecesi, guzel bir enerji vardi.',
        content_url: PHOTO_URL,
        external_url: null,
        spotify_playlist_url: null,
        caption: 'Navigli gece anisi',
      },
      {
        content: '[QUOTE] En iyi rituel, ayni frekansta insanlarla olan.',
        type: 'quote',
        destination: 'ritual_and_pulse',
        content_text: 'En iyi rituel, ayni frekansta insanlarla olan.',
        content_url: null,
        external_url: null,
        spotify_playlist_url: null,
        caption: 'Kisa alinti',
      },
      {
        content: 'After ritual chill listesi',
        type: 'playlist',
        destination: 'ritual_and_pulse',
        content_text: 'After ritual chill listesi',
        content_url: null,
        external_url: PLAYLIST_URL,
        spotify_playlist_url: PLAYLIST_URL,
        caption: 'Playlist pick',
      },
    ];

    for (const row of rows) {
      await client.query(
        `INSERT INTO memories (
          ritual_id, user_id, content, memory_type, expires_at,
          type, destination, content_text, content_url, external_url, spotify_playlist_url, caption, privacy
        ) VALUES (
          $1, $2, $3, 'pulse', $4,
          $5::memory_type_enum, $6::memory_destination_enum, $7, $8, $9, $10, $11, 'friends'
        )`,
        [
          ritual.id,
          viewer.id,
          row.content,
          expiresAt,
          row.type,
          row.destination,
          row.content_text,
          row.content_url,
          row.external_url,
          row.spotify_playlist_url,
          row.caption,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(
      `✅ Seeded pulse social memories for ${viewer.name} (${TARGET_EMAIL}) on ritual: ${ritual.title}`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed seeding pulse social memories:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
