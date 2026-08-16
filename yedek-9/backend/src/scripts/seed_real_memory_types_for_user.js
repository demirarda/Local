import 'dotenv/config';
import pool from '../config/database.js';

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || '200541032@firat.edu.tr';

const PHOTO_URL = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&h=900&fit=crop&q=80';
const VOICE_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const PLAYLIST_URL = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';

async function getTargetUser(client) {
  const res = await client.query(
    'SELECT id, city, name FROM users WHERE email = $1 LIMIT 1',
    [TARGET_EMAIL]
  );
  if (!res.rows.length) {
    throw new Error(`Target user not found for email: ${TARGET_EMAIL}`);
  }
  return res.rows[0];
}

async function getOrPrepareRitual(client, userId, city) {
  const attended = await client.query(
    `SELECT r.id, r.title
     FROM rituals r
     JOIN ritual_attendance ra ON ra.ritual_id = r.id
     WHERE ra.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [userId]
  );
  if (attended.rows.length) return attended.rows[0];

  const anyRitual = await client.query(
    `SELECT id, title FROM rituals
     WHERE suspended_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`
  );
  if (!anyRitual.rows.length) {
    throw new Error('No ritual found to attach memories');
  }

  const ritual = anyRitual.rows[0];
  await client.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status)
     VALUES ($1, $2, 'confirmed')
     ON CONFLICT (ritual_id, user_id) DO NOTHING`,
    [ritual.id, userId]
  );
  return ritual;
}

async function seedMemories(client, userId, ritualId) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const rows = [
    {
      content: 'Milano kahve anisi: altin saat',
      type: 'photo',
      destination: 'ritual_and_pulse',
      content_text: 'Milano kahve anisi: altin saat',
      content_url: PHOTO_URL,
      external_url: null,
      spotify_playlist_url: null,
      caption: 'Brera kahve molasi',
      memory_type: 'pulse',
      expires_at: expiresAt,
    },
    {
      content: 'En iyi rituel, iyi insanlarla olan ritueldir.',
      type: 'quote',
      destination: 'ritual_only',
      content_text: 'En iyi rituel, iyi insanlarla olan ritueldir.',
      content_url: null,
      external_url: null,
      spotify_playlist_url: null,
      caption: 'Kisa alinti',
      memory_type: 'ritual',
      expires_at: null,
    },
    {
      content: 'After ritual chill playlist',
      type: 'playlist',
      destination: 'ritual_and_pulse',
      content_text: 'After ritual chill playlist',
      content_url: null,
      external_url: PLAYLIST_URL,
      spotify_playlist_url: PLAYLIST_URL,
      caption: 'After ritual chill',
      memory_type: 'pulse',
      expires_at: expiresAt,
    },
    {
      content: 'Sesli not: bugun cok iyi bir akisti.',
      type: 'voice',
      destination: 'ritual_only',
      content_text: 'Sesli not: bugun cok iyi bir akisti.',
      content_url: VOICE_URL,
      external_url: null,
      spotify_playlist_url: null,
      caption: 'Voice memo',
      memory_type: 'ritual',
      expires_at: null,
    },
  ];

  for (const row of rows) {
    await client.query(
      `INSERT INTO memories (
        ritual_id, user_id, content, memory_type, expires_at,
        type, destination, content_text, content_url, external_url, spotify_playlist_url, caption, privacy
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::memory_type_enum, $7::memory_destination_enum, $8, $9, $10, $11, $12, 'friends'
      )`,
      [
        ritualId,
        userId,
        row.content,
        row.memory_type,
        row.expires_at,
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
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await getTargetUser(client);
    const ritual = await getOrPrepareRitual(client, user.id, user.city);
    await seedMemories(client, user.id, ritual.id);
    await client.query('COMMIT');
    console.log(`✅ Seeded real memory types for ${user.name} (${TARGET_EMAIL}) on ritual: ${ritual.title}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed real memory types:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
