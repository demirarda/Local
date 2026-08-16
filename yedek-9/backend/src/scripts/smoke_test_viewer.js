/**
 * Canlı backend + DB smoke test — simülatör öncesi hızlı kontrol.
 *
 *   VIEWER_EMAIL=200541032@firat.edu.tr node src/scripts/smoke_test_viewer.js
 */

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:3000/api';
const EMAIL = process.env.VIEWER_EMAIL || '200541032@firat.edu.tr';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function countPulseCards(data) {
  if (!data || typeof data !== 'object') return 0;
  if (Array.isArray(data)) return data.length;
  return ['live_now', 'starting_soon', 'almost_full', 'reopened', 'special_events', 'friend_activity']
    .reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
}

async function main() {
  const userRes = await pool.query('SELECT id, name, city FROM users WHERE email = $1 LIMIT 1', [EMAIL]);
  if (!userRes.rows.length) {
    console.error('❌ Kullanıcı bulunamadı:', EMAIL);
    process.exit(1);
  }
  const user = userRes.rows[0];
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  const checks = [];
  const run = async (name, fn) => {
    try {
      checks.push({ name, ...(await fn()) });
    } catch (e) {
      checks.push({ name, ok: false, detail: e.message });
    }
  };

  await run('Backend erişilebilir', async () => {
    const res = await fetch(`${BASE}/config/public`);
    const data = await res.json();
    return { ok: res.ok && data.success, detail: `HTTP ${res.status}` };
  });

  await run('Pulse feed', async () => {
    const res = await fetch(
      `${BASE}/rituals/pulse?city=${encodeURIComponent(user.city)}&viewer_id=${user.id}`,
      { headers: auth() }
    );
    const data = await res.json();
    const n = countPulseCards(data.data);
    return { ok: res.ok && n > 0, detail: `${n} kart` };
  });

  await run('City Rhythm', async () => {
    const res = await fetch(
      `${BASE}/city-rhythm/browse?city=${encodeURIComponent(user.city)}&viewer_id=${user.id}`,
      { headers: auth() }
    );
    const data = await res.json();
    const list = data.data?.rituals || data.data || [];
    const n = Array.isArray(list) ? list.length : 0;
    return { ok: res.ok && n > 0, detail: `${n} ritüel` };
  });

  await run('Social Passport (geçmiş)', async () => {
    const res = await fetch(`${BASE}/users/${user.id}/rituals?limit=5`, { headers: auth() });
    const data = await res.json();
    const n = (data.data || []).length;
    return { ok: res.ok && n > 0, detail: `${n} ritüel` };
  });

  await run('Arkadaşlar', async () => {
    const res = await fetch(`${BASE}/friends?user_id=${user.id}&status=accepted`, { headers: auth() });
    const data = await res.json();
    const n = (data.data || []).length;
    return { ok: res.ok && n > 0, detail: `${n} arkadaş` };
  });

  await run('Pulse anıları', async () => {
    const res = await fetch(
      `${BASE}/memories/pulse?city=${encodeURIComponent(user.city)}&viewer_id=${user.id}`,
      { headers: auth() }
    );
    const data = await res.json();
    const n = (data.data || []).length;
    return { ok: res.ok, detail: `${n} anı` };
  });

  await run('Ritüel oluştur', async () => {
    const res = await fetch(`${BASE}/rituals`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        title: `[Smoke] ${Date.now()}`,
        type: 'Social',
        venue_name: 'Smoke Test Venue',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        duration: 90,
        capacity: 10,
        entry_type: 'open',
        location_lat: 45.47,
        location_lng: 9.19,
      }),
    });
    return { ok: res.status === 201, detail: `HTTP ${res.status}` };
  });

  await run('Bildirimler', async () => {
    const res = await fetch(`${BASE}/notifications?user_id=${user.id}`, { headers: auth() });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  });

  const db = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM rituals WHERE suspended_at IS NULL) AS rituals,
       (SELECT COUNT(*)::int FROM friendships WHERE status = 'accepted') AS friends,
       (SELECT COUNT(*)::int FROM memories WHERE memory_type = 'pulse' AND expires_at > NOW()) AS pulse_mem`
  );

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;

  console.log('\n=== LOCAL Smoke Test ===');
  console.log(`${user.name} (${EMAIL}) — ${user.city}`);
  console.log(`DB: ${db.rows[0].rituals} ritüel, ${db.rows[0].friends} arkadaşlık, ${db.rows[0].pulse_mem} pulse anı\n`);

  for (const c of checks) {
    console.log(`${c.ok ? '✅' : '❌'} ${c.name} — ${c.detail}`);
  }

  console.log(`\nSonuç: ${pass}/${checks.length} geçti${fail ? ` (${fail} başarısız)` : ''}`);

  if (fail === 0) {
    console.log('\nBackend hazır — simülatörde manuel teste geçebilirsin.');
  } else {
    console.log('\nBaşarısız maddeler için: backend çalışıyor mu? npm run seed:viewer-demo çalıştır.');
  }

  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
