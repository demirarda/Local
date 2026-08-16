import 'dotenv/config';
import pool from '../config/database.js';

const IMG = [
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1415201364244-b4e9d983eafd?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1476480862121-37bf1b20d605?w=900&h=650&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=900&h=650&fit=crop&q=80',
];

const QUOTES = [
  "Rituelin enerjisi bugun cok yuksekti.",
  "Bu gruba her geldigde iyi hissediyorum.",
  "Kisa ama cok kaliteli bir bulusmaydi.",
  "Mekan ve insanlar gercekten cok iyiydi.",
  "Tekrar etmek isteyecegim bir deneyim oldu.",
];

function pick(list, idx) {
  return list[idx % list.length];
}

async function main() {
  const client = await pool.connect();
  try {
    const viewerEmail = process.env.PULSE_VIEWER_EMAIL || '200541032@firat.edu.tr';
    const userRes = await client.query(
      'SELECT id, city FROM users WHERE email = $1 LIMIT 1',
      [viewerEmail]
    );
    const fallbackUserRes = await client.query('SELECT id, city FROM users ORDER BY created_at ASC LIMIT 1');
    const viewer = userRes.rows[0] || fallbackUserRes.rows[0];
    if (!viewer) throw new Error('No users found');

    const usersRes = await client.query(
      'SELECT id FROM users WHERE city = $1 ORDER BY created_at ASC LIMIT 12',
      [viewer.city || 'Milano']
    );
    const userIds = usersRes.rows.map((r) => r.id);
    if (userIds.length === 0) userIds.push(viewer.id);

    const ritualsRes = await client.query(
      `SELECT id, title
       FROM rituals
       WHERE suspended_at IS NULL
       ORDER BY created_at DESC
       LIMIT 40`
    );
    const rituals = ritualsRes.rows;
    if (rituals.length === 0) throw new Error('No rituals found');

    let inserted = 0;
    for (let i = 0; i < rituals.length; i += 1) {
      const ritual = rituals[i];
      const owner = pick(userIds, i);
      const friend = pick(userIds, i + 1);
      const quote = pick(QUOTES, i);
      const img = pick(IMG, i);

      const expiresAt = new Date(Date.now() + ((i % 3) + 1) * 24 * 60 * 60 * 1000);

      // photo
      await client.query(
        `INSERT INTO memories (
          ritual_id, user_id, content, memory_type, expires_at,
          type, destination, content_text, content_url, external_url, spotify_playlist_url, caption, privacy
        ) VALUES (
          $1, $2, $3, 'pulse', $4,
          'photo'::memory_type_enum, 'ritual_and_pulse'::memory_destination_enum, $3, $5, NULL, NULL, $6, 'friends'
        )`,
        [ritual.id, owner, `[PHOTO] ${ritual.title}`, expiresAt, img, `Memory photo ${i + 1}`]
      );
      inserted += 1;

      // quote
      await client.query(
        `INSERT INTO memories (
          ritual_id, user_id, content, memory_type, expires_at,
          type, destination, content_text, privacy
        ) VALUES (
          $1, $2, $3, 'ritual', $4,
          'quote'::memory_type_enum, 'ritual_only'::memory_destination_enum, $3, 'friends'
        )`,
        [ritual.id, friend, `[QUOTE] ${quote}`, expiresAt]
      );
      inserted += 1;

      // playlist every 2 rituals
      if (i % 2 === 0) {
        await client.query(
          `INSERT INTO memories (
            ritual_id, user_id, content, memory_type, expires_at,
            type, destination, content_text, external_url, spotify_playlist_url, caption, privacy
          ) VALUES (
            $1, $2, $3, 'pulse', $4,
            'playlist'::memory_type_enum, 'ritual_and_pulse'::memory_destination_enum, $3, $5, $6, $7, 'friends'
          )`,
          [
            ritual.id,
            owner,
            `Playlist pick for ${ritual.title}`,
            expiresAt,
            'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',
            'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',
            'Top tracks',
          ]
        );
        inserted += 1;
      }

      // voice every 3 rituals
      if (i % 3 === 0) {
        await client.query(
          `INSERT INTO memories (
            ritual_id, user_id, content, memory_type, expires_at,
            type, destination, content_text, caption, privacy
          ) VALUES (
            $1, $2, $3, 'ritual', $4,
            'voice'::memory_type_enum, 'ritual_only'::memory_destination_enum, $3, $5, 'friends'
          )`,
          [ritual.id, friend, `[VOICE] Kisa sesli not #${i + 1}`, expiresAt, 'Voice memo']
        );
        inserted += 1;
      }
    }

    console.log(`✅ Bulk memory seed tamamlandi. Eklenen toplam kayit: ${inserted}`);
    console.log(`   Rituel sayisi: ${rituals.length}, sehir odagi: ${viewer.city || 'n/a'}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Bulk memory seed hatasi:', err);
  process.exit(1);
});
