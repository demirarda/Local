import pool from '../config/database.js';

const PREFIX = '[Hafta Sonu]';

function nextWeekdayDate(targetDay, hour, minute = 0) {
  const now = new Date();
  const d = new Date(now);
  const delta = (targetDay - now.getDay() + 7) % 7 || 7;
  d.setDate(now.getDate() + delta);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function getAnyCity() {
  const u = await pool.query(
    `SELECT city FROM users WHERE city IS NOT NULL AND city != '' ORDER BY created_at ASC LIMIT 1`
  );
  return u.rows[0]?.city || 'Milano';
}

async function ensureHost(city, name, rs = 7.5) {
  const ex = await pool.query(
    `SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
    [name, city]
  );
  if (ex.rows.length) return ex.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO users (name, city, university, rs_score) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, city, 'Weekend Seed University', rs]
  );
  return ins.rows[0].id;
}

async function upsertRitual(row) {
  const {
    title, type, location_name, start_time, duration,
    capacity, entry_type, host_id, status, is_special_event = false,
  } = row;
  const end_time = new Date(new Date(start_time).getTime() + duration * 60000);
  const entry = entry_type === 'request_seat' ? 'request' : entry_type;

  const ex = await pool.query(
    `SELECT id FROM rituals WHERE title = $1 AND location_name = $2 LIMIT 1`,
    [title, location_name]
  );

  if (ex.rows.length) {
    await pool.query(
      `UPDATE rituals
       SET type = $1, start_time = $2, end_time = $3, duration = $4, capacity = $5,
           entry_type = $6::ritual_entry_type, host_id = $7, status = $8::ritual_status,
           is_special_event = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [type, start_time, end_time, duration, capacity, entry, host_id, status, is_special_event, ex.rows[0].id]
    );
    return ex.rows[0].id;
  }

  const ins = await pool.query(
    `INSERT INTO rituals (
      title, type, location_name, start_time, end_time, duration, capacity, entry_type,
      location_lat, location_lng, host_id, status, is_special_event, min_rs, live_window_hours
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::ritual_entry_type,
      $9, $10, $11, $12::ritual_status, $13, 0, 12
    ) RETURNING id`,
    [
      title, type, location_name, start_time, end_time, duration, capacity, entry,
      45.4642, 9.19, host_id, status, is_special_event,
    ]
  );
  return ins.rows[0].id;
}

async function main() {
  try {
    const city = await getAnyCity();
    console.log(`Seeding weekend rituals for city: ${city}`);

    const hostA = await ensureHost(city, `${PREFIX} Weekend Host A`, 8.0);
    const hostB = await ensureHost(city, `${PREFIX} Weekend Host B`, 7.7);
    const hostC = await ensureHost(city, `${PREFIX} Weekend Host C`, 7.4);

    // Saturday (6)
    const sat07 = nextWeekdayDate(6, 7, 0);
    const sat11 = nextWeekdayDate(6, 11, 0);
    const sat14 = nextWeekdayDate(6, 14, 0);
    const sat17 = nextWeekdayDate(6, 17, 0);
    const sat20 = nextWeekdayDate(6, 20, 0);
    const sat23 = nextWeekdayDate(6, 23, 0);

    // Sunday (0)
    const sun11 = nextWeekdayDate(0, 11, 0);
    const sun14 = nextWeekdayDate(0, 14, 0);
    const sun17 = nextWeekdayDate(0, 17, 0);
    const sun20 = nextWeekdayDate(0, 20, 0);

    const rows = [
      { title: `${PREFIX} Morning Run Club`, type: 'Wellness', location_name: 'Parco Sempione', start_time: sat07, duration: 90, capacity: 12, entry_type: 'open', host_id: hostA, status: 'active' },
      { title: `${PREFIX} Weekend Brunch Circle`, type: 'Social', location_name: 'Navigli', start_time: sat11, duration: 120, capacity: 14, entry_type: 'request', host_id: hostB, status: 'active' },
      { title: `${PREFIX} Sanat Galerisi Acilisi`, type: 'Culture', location_name: 'Brera', start_time: sat14, duration: 120, capacity: 20, entry_type: 'open', host_id: hostC, status: 'active' },
      { title: `${PREFIX} Kanye Oncesi Aperitivo`, type: 'Social', location_name: 'Kadikoy', start_time: sat17, duration: 120, capacity: 24, entry_type: 'open', host_id: hostA, status: 'active' },
      { title: `${PREFIX} Kanye West Kadikoy Konseri`, type: 'Special Event', location_name: 'Sukru Saracoglu', start_time: sat20, duration: 180, capacity: 30000, entry_type: 'open', host_id: hostB, status: 'active', is_special_event: true },
      { title: `${PREFIX} Karaoke After Party`, type: 'Social', location_name: 'Kadikoy', start_time: sat23, duration: 120, capacity: 20, entry_type: 'request', host_id: hostC, status: 'active' },
      { title: `${PREFIX} Sunday Brunch Circle`, type: 'Social', location_name: 'Caffe Letterario', start_time: sun11, duration: 120, capacity: 8, entry_type: 'request', host_id: hostA, status: 'active' },
      { title: `${PREFIX} Galeri Turu`, type: 'Culture', location_name: 'Brera', start_time: sun14, duration: 90, capacity: 12, entry_type: 'open', host_id: hostC, status: 'active' },
      { title: `${PREFIX} Felsefe Okuma Grubu`, type: 'Culture', location_name: 'Darsena', start_time: sun17, duration: 90, capacity: 8, entry_type: 'request', host_id: hostB, status: 'active' },
      { title: `${PREFIX} Sunday Jazz`, type: 'Social', location_name: 'Blue Note', start_time: sun20, duration: 120, capacity: 18, entry_type: 'open', host_id: hostA, status: 'active' },
    ];

    for (const r of rows) {
      await upsertRitual(r);
      console.log(`- upserted: ${r.title}`);
    }

    console.log('Done. Hafta Sonu ritueleri eklendi/guncellendi.');
    process.exit(0);
  } catch (e) {
    console.error('Weekend seed failed:', e);
    process.exit(1);
  }
}

main();

