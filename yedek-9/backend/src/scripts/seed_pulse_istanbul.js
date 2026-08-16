/**
 * İstanbul kullanıcıları için Pulse ekranında görünen örnek ritüeller ve ilişkili veriler.
 * Hostların `users.city` değeri İstanbul olduğundan GET /api/rituals/pulse?city=Istanbul yanıt verir.
 *
 * Çalıştırma (backend klasöründen):
 *   node src/scripts/seed_pulse_istanbul.js
 */

import pool from '../config/database.js';

const CITY = 'Istanbul';
const IST_LAT = 41.0082;
const IST_LNG = 28.9784;

async function getOrCreateUser(name, university = 'Boğaziçi University') {
  const existing = await pool.query(
    'SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1',
    [name, CITY]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const r = await pool.query(
    `INSERT INTO users (name, city, university, rs_score)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, CITY, university, 7.2]
  );
  return r.rows[0].id;
}

async function verifyHost(userId) {
  await pool.query(
    `INSERT INTO host_verifications (user_id, verified_by, verification_type, status)
     VALUES ($1, 'admin', 'standard', 'active')
     ON CONFLICT (user_id) DO UPDATE SET status = 'active', verified_at = CURRENT_TIMESTAMP`,
    [userId]
  );
}

async function verifyVenue(venueName) {
  await pool.query(
    `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, status)
     VALUES ($1, $2, 'admin', 'standard', 'active')
     ON CONFLICT (venue_name, city) DO UPDATE SET status = 'active'`,
    [venueName, CITY]
  );
}

async function upsertRitual(title, venueName, startTime, hostId, status, type, capacity = 20) {
  const existing = await pool.query(
    `SELECT id FROM rituals WHERE title = $1 AND venue_name = $2 ORDER BY created_at DESC LIMIT 1`,
    [title, venueName]
  );
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE rituals SET
         start_time = $1, duration = 90, capacity = $2, entry_type = 'open',
         host_id = $3, status = $4, type = $5,
         location_lat = $6, location_lng = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [startTime, capacity, hostId, status, type, IST_LAT, IST_LNG, id]
    );
    return id;
  }
  const ins = await pool.query(
    `INSERT INTO rituals (title, type, venue_name, start_time, duration, capacity, entry_type, location_lat, location_lng, host_id, status)
     VALUES ($1, $2, $3, $4, 90, $5, 'open', $6, $7, $8, $9)
     RETURNING id`,
    [title, type, venueName, startTime, capacity, IST_LAT, IST_LNG, hostId, status]
  );
  return ins.rows[0].id;
}

async function clearAttendance(ritualId) {
  await pool.query('DELETE FROM ritual_attendance WHERE ritual_id = $1', [ritualId]);
}

async function joinRitual(ritualId, userId) {
  await pool.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status)
     VALUES ($1, $2, 'joined')
     ON CONFLICT (ritual_id, user_id) DO UPDATE SET status = 'joined'`,
    [ritualId, userId]
  );
}

async function seedPulseMemory(ritualId, userId, content) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const ex = await pool.query(
    `SELECT id FROM memories WHERE ritual_id = $1 AND user_id = $2 AND memory_type = 'pulse' LIMIT 1`,
    [ritualId, userId]
  );
  if (ex.rows.length > 0) {
    await pool.query(
      `UPDATE memories SET content = $1, expires_at = $2 WHERE id = $3`,
      [content, expiresAt, ex.rows[0].id]
    );
    return;
  }
  await pool.query(
    `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at)
     VALUES ($1, $2, $3, 'pulse', $4)`,
    [ritualId, userId, content, expiresAt]
  );
}

async function main() {
  console.log('🇹🇷 İstanbul Pulse örnek verileri ekleniyor...\n');

  const hostGalata = await getOrCreateUser('Deniz Aydın', 'İTÜ');
  const hostKadikoy = await getOrCreateUser('Melis Karaca', 'Koç University');
  const hostBesiktas = await getOrCreateUser('Barış Öztürk', 'Boğaziçi University');
  await verifyHost(hostGalata);
  await verifyHost(hostKadikoy);
  await verifyHost(hostBesiktas);

  await verifyVenue('Galata Port Saha');
  await verifyVenue('Moda Sahil Yürüyüş');
  await verifyVenue('Karaköy Kayıkhane');
  await verifyVenue('Maslak Atölye');

  const now = new Date();

  // Canlı: başlangıç ~40 dk önce, süre 90 dk → hâlâ devam ediyor
  const liveStart = new Date(now.getTime() - 40 * 60 * 1000);
  const liveId = await upsertRitual(
    'Boğaz Caz & Kahve',
    'Galata Port Saha',
    liveStart,
    hostGalata,
    'live',
    'Music'
  );
  await clearAttendance(liveId);
  for (let i = 1; i <= 6; i += 1) {
    const uid = await getOrCreateUser(`Demo Katılımcı ${i}`, 'İTÜ');
    await joinRitual(liveId, uid);
  }

  // Yakında başlıyor: 35–90 dk aralığında
  const soonStart = new Date(now.getTime() + 50 * 60 * 1000);
  const soonId = await upsertRitual(
    'Kadıköy Indie Yayını',
    'Moda Sahil Yürüyüş',
    soonStart,
    hostKadikoy,
    'upcoming',
    'Music'
  );
  await clearAttendance(soonId);
  await joinRitual(soonId, await getOrCreateUser('Demo Katılımcı A'));

  // Özel etkinlik: bu gece, starting_soon bucket (24 saat içinde)
  const specialStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
  if (specialStart <= now) {
    specialStart.setDate(specialStart.getDate() + 1);
  }
  const specialId = await upsertRitual(
    'İstanbul Tasarım Turu',
    'Karaköy Kayıkhane',
    specialStart,
    hostGalata,
    'upcoming',
    'Special Event'
  );
  await pool.query(`UPDATE rituals SET type = 'Special Event' WHERE id = $1`, [specialId]);
  await clearAttendance(specialId);

  // Neredeyse dolu: başlangıç >90 dk sonra, az boş koltuk
  const almostStart = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  const almostCapacity = 14;
  const almostId = await upsertRitual(
    'Akşam Çizim Kulübü',
    'Maslak Atölye',
    almostStart,
    hostBesiktas,
    'upcoming',
    'Arts',
    almostCapacity
  );
  await clearAttendance(almostId);
  for (let j = 1; j <= 12; j += 1) {
    const uid = await getOrCreateUser(`Çizim Kulüp ${j}`);
    await joinRitual(almostId, uid);
  }

  // Reopened: bitti, 30–45 dk önce
  const reopenEnd = new Date(now.getTime() - 35 * 60 * 1000);
  const reopenStart = new Date(reopenEnd.getTime() - 90 * 60 * 1000);
  const reopenId = await upsertRitual(
    'Karaköy Brunch Buluşması',
    'Karaköy Kayıkhane',
    reopenStart,
    hostBesiktas,
    'ended',
    'Food'
  );
  await pool.query(
    `UPDATE rituals SET start_time = $1, status = 'ended' WHERE id = $2`,
    [reopenStart, reopenId]
  );

  await seedPulseMemory(
    reopenId,
    hostGalata,
    'Bugünkü brunch harikaydı — Karaköy sokakları mis gibi. Yarın görüşürüz!'
  );

  console.log('✅ Tamamlandı. Özet:');
  console.log('   • live_now: Boğaz Caz & Kahve (Galata)');
  console.log('   • starting_soon: Kadıköy Indie + İstanbul Tasarım Turu (Special)');
  console.log('   • almost_full: Akşam Çizim Kulübü (12/14)');
  console.log('   • reopened: Karaköy Brunch Buluşması');
  console.log('   • pulse memory: doğrulanmış host paylaşımı');
  console.log('\n📱 Uygulamada kullanıcı şehri İstanbul olmalı; Pulse’u yenileyin.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌', err);
    process.exit(1);
  });
