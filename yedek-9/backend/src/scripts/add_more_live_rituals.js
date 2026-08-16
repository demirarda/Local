/**
 * Live Now sekmesinde daha fazla içerik görünsün diye ek "live" ritüeller ekler.
 * Mevcut şehirlerdeki (Milano, Istanbul) kullanıcıları host olarak kullanır.
 *
 * Kullanım: node src/scripts/add_more_live_rituals.js
 */

import pool from '../config/database.js';

const LIVE_RITUALS = [
  { title: 'Live Study Session', type: 'Study', venue: 'Central Library', city: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { title: 'Evening Co-Working', type: 'Work', venue: 'Impact Hub Istanbul', city: 'Istanbul', lat: 41.0150, lng: 28.9770 },
  { title: 'Sunset Running Club', type: 'Fitness', venue: 'Maçka Park', city: 'Istanbul', lat: 41.0480, lng: 29.0090 },
  { title: 'Late Night Coding', type: 'Tech', venue: 'Kadıköy Hackspace', city: 'Istanbul', lat: 40.9920, lng: 29.0230 },
  { title: 'Acoustic Jam Session', type: 'Music', venue: 'Nardis Jazz Club', city: 'Istanbul', lat: 41.0320, lng: 28.9850 },
  { title: 'Book Club Live', type: 'Social', venue: 'Macka Park Cafe', city: 'Istanbul', lat: 41.0460, lng: 29.0080 },
  { title: 'Aperitivo Hour', type: 'Social', venue: 'Navigli Bar', city: 'Milano', lat: 45.4500, lng: 9.1700 },
  { title: 'Evening Yoga Flow', type: 'Wellness', venue: 'Parco Sempione', city: 'Milano', lat: 45.4728, lng: 9.1750 },
  { title: 'Design Critique Session', type: 'Creative', venue: 'Base Milano', city: 'Milano', lat: 45.4642, lng: 9.1914 },
  { title: 'Language Exchange', type: 'Social', venue: 'Caffè Duomo', city: 'Milano', lat: 45.4642, lng: 9.1900 },
];

async function addMoreLiveRituals() {
  try {
    console.log('🔴 Adding more LIVE NOW rituals...\n');
    const now = new Date();

    // Mevcut kullanıcıları host olarak al (şehre göre)
    const usersByCity = await pool.query(
      `SELECT id, name, city FROM users WHERE city IN ('Milano', 'Istanbul') ORDER BY city, created_at LIMIT 30`
    );
    let allUsers = usersByCity.rows;
    if (allUsers.length === 0) {
      const anyUsers = await pool.query(
        `SELECT id, name, city FROM users ORDER BY created_at LIMIT 20`
      );
      if (anyUsers.rows.length === 0) {
        console.error('❌ Veritabanında kullanıcı yok. Önce seed çalıştırın: npm run seed:pulse veya create_pulse_demo_data_comprehensive.js');
        process.exit(1);
      }
      allUsers = anyUsers.rows;
    }

    const cityToHosts = {};
    for (const u of allUsers) {
      if (!cityToHosts[u.city]) cityToHosts[u.city] = [];
      cityToHosts[u.city].push(u);
    }

    let added = 0;
    const usedHostIds = new Set();

    for (let i = 0; i < LIVE_RITUALS.length; i++) {
      const r = LIVE_RITUALS[i];
      const hosts = cityToHosts[r.city] || allUsers;
      const host = hosts[i % hosts.length];
      if (!host) continue;

      const startOffset = -((i % 5) * 15 + 10); // 10, 25, 40, 55, 70 dakika önce başlamış
      const startTime = new Date(now.getTime() + startOffset * 60000);
      const duration = 90 + (i % 3) * 15; // 90, 105, 120 dk

      await pool.query(
        `INSERT INTO rituals (
          title, type, venue_name, start_time, duration,
          capacity, entry_type, location_lat, location_lng, host_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'live')`,
        [
          r.title,
          r.type,
          r.venue,
          startTime,
          duration,
          12 + (i % 10),
          'open',
          r.lat,
          r.lng,
          host.id,
        ]
      );
      usedHostIds.add(host.id);
      added++;
    }

    // Bazı ritüellere katılımcı ekle (son eklenen live ritüeller)
    const liveIds = await pool.query(
      `SELECT id FROM rituals WHERE status = 'live' ORDER BY created_at DESC LIMIT ${added}`
    );
    const viewers = await pool.query(
      `SELECT id FROM users WHERE city IN ('Milano', 'Istanbul') LIMIT 5`
    );
    for (const row of liveIds.rows.slice(0, 4)) {
      for (const v of viewers.rows.slice(0, 2)) {
        if (v.id === row.id) continue;
        await pool.query(
          `INSERT INTO ritual_attendance (ritual_id, user_id, status)
           VALUES ($1, $2, 'joined')
           ON CONFLICT DO NOTHING`,
          [row.id, v.id]
        ).catch(() => {});
      }
    }

    console.log(`✅ ${added} adet LIVE NOW ritüel eklendi.`);
    console.log('   Pulse\'ta "Live Now" sekmesine tıklayıp yenileyin.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addMoreLiveRituals();
