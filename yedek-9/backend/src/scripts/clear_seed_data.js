/**
 * Pilot / seed ritüelleri ve demo kullanıcıları temizler.
 * Gerçek kullanıcı hesapları (test.local dışı, [prefix] olmayan) korunur.
 *
 * Kullanım: node src/scripts/clear_seed_data.js
 */

import pool from '../config/database.js';

const SEED_USER_EMAIL_PATTERNS = ['%@test.local', '%@example.com', '%@seed.local'];

const SEED_USER_NAME_PATTERNS = [
  'Pulse Test',
  'Jazz Host',
  'Brunch Host',
  'Yoga Host',
  'Run Host',
  'Caffè Host',
  'Cafe Host',
  'Friend 1',
  'Friend 2',
  'Study Host',
];

async function safeDelete(client, sql, params, label) {
  try {
    const res = await client.query(sql, params);
    if (res.rowCount > 0) console.log(`   ${label}: ${res.rowCount}`);
    return res.rowCount;
  } catch (e) {
    if (e.code === '42P01' || e.code === '42703') return 0;
    console.error(`   ${label} hata:`, e.message);
    throw e;
  }
}

async function deleteRitualDependents(client, ritualIds) {
  if (!ritualIds.length) return;
  const idList = ritualIds;
  const tables = [
    ['feedback', 'ritual_id'],
    ['ritual_attendance', 'ritual_id'],
    ['chat_messages', 'ritual_id'],
    ['memories', 'ritual_id'],
    ['ritual_invites', 'ritual_id'],
    ['rs_delta_history', 'ritual_id'],
    ['reports', 'reported_ritual_id'],
    ['forum_comments', 'ritual_id'],
    ['pulse_reposts', 'source_ritual_id'],
    ['ritual_replacement_slots', 'ritual_id'],
    ['ritual_recurring_instances', 'parent_ritual_id'],
    ['live_activity_sessions', 'ritual_id'],
    ['ritual_participants', 'ritual_id'],
  ];

  for (const [table, col] of tables) {
    await safeDelete(
      client,
      `DELETE FROM ${table} WHERE ${col} = ANY($1::uuid[])`,
      [idList],
      table
    );
  }

  await safeDelete(
    client,
    `UPDATE user_badges SET source_ritual_id = NULL, ritual_id = NULL WHERE source_ritual_id = ANY($1::uuid[]) OR ritual_id = ANY($1::uuid[])`,
    [idList],
    'user_badges (unlink)'
  );

  await safeDelete(
    client,
    `DELETE FROM score_events WHERE ritual_id = ANY($1::uuid[])`,
    [idList],
    'score_events'
  );
}

async function clearSeedData() {
  const client = await pool.connect();
  try {
    console.log('🧹 Seed / pilot verileri temizleniyor...\n');

    const seedRitualRes = await client.query(
      `SELECT id, title FROM rituals
       WHERE title LIKE '[%]%'
          OR title IN (
            'Morning Run Club', 'Live Jazz Circle', 'Special Showcase', 'Super Event Warmup',
            'Jazz Night at Blue Note', 'Brunch Circle', 'Morning Yoga Session',
            'Philosophy Walk', 'Sunset Networking', 'Live Study Session',
            'Evening Co-Working', 'Sunset Running Club', 'Late Night Coding',
            'Acoustic Jam Session', 'Book Club Live', 'Aperitivo Hour',
            'Evening Yoga Flow', 'Design Critique Session', 'Language Exchange',
            'Sunrise Yoga', 'Coffee & Focus', 'Study Sprint', 'Brunch Circle Live'
          )
          OR host_id IN (
            SELECT id FROM users
            WHERE email ILIKE ANY($1::text[])
               OR name = ANY($2::text[])
               OR name LIKE '[%]%'
               OR name LIKE '% Showcase%'
          )`,
      [SEED_USER_EMAIL_PATTERNS, SEED_USER_NAME_PATTERNS]
    );

    const seedIds = seedRitualRes.rows.map((r) => r.id);
    console.log(`📋 ${seedIds.length} seed ritüel bulundu`);
    if (seedIds.length > 0) {
      await deleteRitualDependents(client, seedIds);
      const del = await client.query(`DELETE FROM rituals WHERE id = ANY($1::uuid[])`, [seedIds]);
      console.log(`✅ rituals silindi: ${del.rowCount}`);
    }

    const remaining = await client.query(`SELECT COUNT(*)::int AS c FROM rituals`);
    const remainingCount = remaining.rows[0]?.c || 0;
    if (remainingCount > 0) {
      console.log(`\n⚠️  ${remainingCount} ritüel kaldi (seed disi olabilir).`);
      console.log('   Hepsini silmek icin: npm run clear:rituals\n');
    }

    const seedUsersRes = await client.query(
      `SELECT id, name, email FROM users
       WHERE email ILIKE ANY($1::text[])
          OR name = ANY($2::text[])
          OR name LIKE '[%]%'
          OR name LIKE '[Pulse Showcase]%'
       ORDER BY created_at`,
      [SEED_USER_EMAIL_PATTERNS, SEED_USER_NAME_PATTERNS]
    );

    let usersDeleted = 0;
    for (const u of seedUsersRes.rows) {
      const hosted = await client.query(`SELECT 1 FROM rituals WHERE host_id = $1 LIMIT 1`, [u.id]);
      if (hosted.rows.length > 0) continue;
      const attended = await client.query(`SELECT 1 FROM ritual_attendance WHERE user_id = $1 LIMIT 1`, [u.id]);
      if (attended.rows.length > 0) continue;
      try {
        await client.query(`DELETE FROM users WHERE id = $1`, [u.id]);
        usersDeleted += 1;
        console.log(`   kullanici silindi: ${u.name || u.email}`);
      } catch (e) {
        console.log(`   kullanici atlandi (FK): ${u.name || u.email}`);
      }
    }
    if (usersDeleted > 0) console.log(`✅ ${usersDeleted} demo kullanici silindi`);

    console.log('\n✅ Seed temizligi tamamlandi.\n');
  } catch (error) {
    console.error('❌ Hata:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearSeedData().catch(() => process.exit(1));
