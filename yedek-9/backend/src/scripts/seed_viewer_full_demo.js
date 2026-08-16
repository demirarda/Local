/**
 * Pulse + City Rhythm + Social Passport için viewer hesabına tam demo veri.
 *
 *   VIEWER_EMAIL=200541032@firat.edu.tr node src/scripts/seed_viewer_full_demo.js
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIEWER_EMAIL = process.env.VIEWER_EMAIL || process.env.PULSE_VIEWER_EMAIL || '200541032@firat.edu.tr';

const IMG = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=650&fit=crop&q=80';

function runScript(scriptName, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        PULSE_VIEWER_EMAIL: VIEWER_EMAIL,
        SEED_TARGET_EMAIL: VIEWER_EMAIL,
        ...extraEnv,
      },
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with ${code}`));
    });
  });
}

async function seedPassportMilano(viewer) {
  const city = viewer.city || 'Milano';
  const viewerId = viewer.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    async function getOrCreateHost(name) {
      const ex = await client.query('SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1', [name, city]);
      if (ex.rows.length) return ex.rows[0].id;
      const ins = await client.query(
        `INSERT INTO users (name, city, university, rs_score) VALUES ($1, $2, $3, 7.2) RETURNING id`,
        [name, city, viewer.university || 'Politecnico di Milano']
      );
      return ins.rows[0].id;
    }

    const hosts = {
      study: await getOrCreateHost('Study Host Milano'),
      cafe: await getOrCreateHost('Caffè Host Milano'),
      yoga: await getOrCreateHost('Yoga Host Milano'),
      run: await getOrCreateHost('Run Host Milano'),
      brunch: await getOrCreateHost('Brunch Host Milano'),
    };

    for (const hostId of Object.values(hosts)) {
      await client.query(
        `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [viewerId, hostId]
      );
      await client.query(
        `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
         VALUES ($1, 'seed', 'standard', 'active')
         ON CONFLICT (user_id) DO UPDATE SET status = 'active'`,
        [hostId]
      );
    }

    const pastDefs = [
      { title: '[Demo] Study Circle', venue: 'Biblioteca Ambrosiana', daysAgo: 3, host: hosts.study, type: 'Study' },
      { title: '[Demo] Brunch & Connect', venue: 'Brera Café', daysAgo: 6, host: hosts.brunch, type: 'Social' },
      { title: '[Demo] Morning Yoga', venue: 'Parco Sempione', daysAgo: 9, host: hosts.yoga, type: 'Wellness' },
      { title: '[Demo] Sunset Run', venue: 'Navigli', daysAgo: 12, host: hosts.run, type: 'Active' },
      { title: '[Demo] Coffee & Philosophy', venue: 'Caffè Letterario', daysAgo: 14, host: hosts.cafe, type: 'Culture' },
    ];

    const ritualIds = [];
    for (const def of pastDefs) {
      const start = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start.getTime() + 90 * 60000);
      const ins = await client.query(
        `INSERT INTO rituals (
          title, type, location_name, start_time, duration, end_time, capacity,
          entry_type, location_lat, location_lng, host_id, status
        ) VALUES ($1, $2, $3, $4, 90, $5, 20, 'open', 45.4642, 9.19, $6, 'ended')
        RETURNING id`,
        [def.title, def.type, def.venue, start, end, def.host]
      );
      let ritualId = ins.rows[0]?.id;
      if (!ritualId) {
        const found = await client.query(
          `SELECT id FROM rituals WHERE title = $1 AND location_name = $2 ORDER BY created_at DESC LIMIT 1`,
          [def.title, def.venue]
        );
        ritualId = found.rows[0]?.id;
      }
      if (!ritualId) continue;
      ritualIds.push(ritualId);

      await client.query(
        `INSERT INTO ritual_attendance (ritual_id, user_id, status)
         VALUES ($1, $2, 'confirmed'::ritual_participant_status)
         ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'confirmed'::ritual_participant_status`,
        [ritualId, viewerId]
      );

      await client.query(
        `INSERT INTO memories (
          ritual_id, user_id, content, memory_type, type, destination, content_text, content_url, caption
        ) VALUES ($1, $2, $3, 'ritual', 'photo'::memory_type_enum, 'ritual_only'::memory_destination_enum, $3, $4, $5)`,
        [ritualId, viewerId, `${def.title} anisi`, IMG, 'Passport arsivi']
      );
    }

    // Gelecek / canli ritüeller (City Rhythm browse)
    const now = new Date();
    const upcoming = [
      { title: '[Demo] Jazz Night', venue: 'Blue Note Milano', hours: 2, host: hosts.cafe, status: 'active' },
      { title: '[Demo] Live Aperitivo', venue: 'Navigli Terrace', hours: -1, host: hosts.brunch, status: 'live' },
      { title: '[Demo] Weekend Brunch', venue: 'Brera', hours: 26, host: hosts.brunch, status: 'active' },
      { title: '[Demo] Book Club', venue: 'Feltrinelli', hours: 48, host: hosts.study, status: 'active' },
      { title: '[Demo] Park Yoga', venue: 'Parco Sempione', hours: 72, host: hosts.yoga, status: 'active' },
    ];

    for (const u of upcoming) {
      const start = new Date(now.getTime() + u.hours * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 90 * 60000);
      await client.query(
        `INSERT INTO rituals (
          title, type, location_name, start_time, duration, end_time, capacity,
          entry_type, location_lat, location_lng, host_id, status
        ) VALUES ($1, 'Social', $2, $3, 90, $4, 24, 'open', 45.47, 9.19, $5, $6::ritual_status)`,
        [u.title, u.venue, start, end, u.host, u.status]
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Passport + City Rhythm: ${ritualIds.length} geçmiş, ${upcoming.length} yaklaşan ritüel (${city})`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const userRes = await pool.query(
    'SELECT id, name, email, city, university FROM users WHERE email = $1 LIMIT 1',
    [VIEWER_EMAIL]
  );
  if (!userRes.rows.length) {
    console.error(`❌ Kullanıcı bulunamadı: ${VIEWER_EMAIL}`);
    console.error('   Uygulamada bu e-posta ile giriş yapın veya VIEWER_EMAIL ayarlayın.');
    process.exit(1);
  }
  const viewer = userRes.rows[0];
  console.log(`\n🌱 Demo veri yükleniyor: ${viewer.name} (${VIEWER_EMAIL}) — ${viewer.city}\n`);

  console.log('1/4 Pulse showcase...');
  await runScript('seed_pulse_showcase.js');

  console.log('\n2/4 Social Passport (Milano geçmiş + browse)...');
  await seedPassportMilano(viewer);

  console.log('\n3/4 Ek memory türleri...');
  try {
    await runScript('seed_real_memory_types_for_user.js');
  } catch (e) {
    console.warn('   (atlandı:', e.message, ')');
  }

  console.log('\n4/4 Bulk pulse memories...');
  try {
    await runScript('seed_memories_bulk.js');
  } catch (e) {
    console.warn('   (atlandı:', e.message, ')');
  }

  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM rituals WHERE suspended_at IS NULL) AS rituals,
       (SELECT COUNT(*)::int FROM memories WHERE memory_type = 'pulse' AND expires_at > NOW()) AS pulse_mem,
       (SELECT COUNT(*)::int FROM memories WHERE memory_type = 'ritual') AS ritual_mem,
       (SELECT COUNT(*)::int FROM friendships WHERE user_id = $1 AND status = 'accepted') AS friends
     `,
    [viewer.id]
  );
  const c = counts.rows[0];
  console.log('\n📊 Özet:');
  console.log(`   Ritüeller: ${c.rituals}`);
  console.log(`   Pulse memories (24h): ${c.pulse_mem}`);
  console.log(`   Passport memories: ${c.ritual_mem}`);
  console.log(`   Arkadaşlıklar: ${c.friends}`);
  console.log('\n✅ Tamamlandı — uygulamada Pulse / City Rhythm / Social Passport yenileyin.\n');
  await pool.end();
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
