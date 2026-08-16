import pool from '../config/database.js';

const PREFIX = '[Bu Gece]';

function atToday(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function getViewerCity() {
  const byName = await pool.query(
    `SELECT city FROM users WHERE name ILIKE $1 AND city IS NOT NULL LIMIT 1`,
    ['%Arda Demir%']
  );
  if (byName.rows.length > 0) return byName.rows[0].city;

  const any = await pool.query(
    `SELECT city FROM users WHERE city IS NOT NULL ORDER BY created_at ASC LIMIT 1`
  );
  return any.rows[0]?.city || 'Istanbul';
}

async function ensureHost(city, name, rs = 7.2) {
  const existing = await pool.query(
    `SELECT id FROM users WHERE name = $1 AND city = $2 LIMIT 1`,
    [name, city]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await pool.query(
    `INSERT INTO users (name, city, university, rs_score)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, city, 'Seed University', rs]
  );
  return created.rows[0].id;
}

async function upsertTonightRitual({
  title,
  type,
  location_name,
  start_time,
  duration,
  capacity,
  entry_type,
  host_id,
  status,
  is_special_event = false,
}) {
  const existing = await pool.query(
    `SELECT id FROM rituals WHERE title = $1 AND location_name = $2 LIMIT 1`,
    [title, location_name]
  );

  const end_time = new Date(new Date(start_time).getTime() + duration * 60000);
  const normalizedEntry = entry_type === 'request_seat' ? 'request' : entry_type;

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE rituals
       SET type = $1,
           start_time = $2,
           end_time = $3,
           duration = $4,
           capacity = $5,
           entry_type = $6::ritual_entry_type,
           host_id = $7,
           status = $8::ritual_status,
           is_special_event = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10`,
      [
        type,
        start_time,
        end_time,
        duration,
        capacity,
        normalizedEntry,
        host_id,
        status,
        is_special_event,
        existing.rows[0].id,
      ]
    );
    return existing.rows[0].id;
  }

  const inserted = await pool.query(
    `INSERT INTO rituals (
      title, type, location_name, start_time, end_time, duration, capacity, entry_type,
      location_lat, location_lng, host_id, status, is_special_event, min_rs, live_window_hours
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::ritual_entry_type,
      $9, $10, $11, $12::ritual_status, $13, 0, 12
    )
    RETURNING id`,
    [
      title,
      type,
      location_name,
      start_time,
      end_time,
      duration,
      capacity,
      normalizedEntry,
      41.0082,
      28.9784,
      host_id,
      status,
      is_special_event,
    ]
  );
  return inserted.rows[0].id;
}

async function main() {
  try {
    const city = await getViewerCity();
    console.log(`Seeding tonight rituals for city: ${city}`);

    const hostA = await ensureHost(city, `${PREFIX} Jazz Host`, 8.1);
    const hostB = await ensureHost(city, `${PREFIX} Walk Host`, 7.6);
    const hostC = await ensureHost(city, `${PREFIX} Art Host`, 7.8);

    const rituals = [
      {
        title: `${PREFIX} Jazz Night`,
        type: 'Social',
        location_name: 'Kadikoy Sahil',
        start_time: atToday(19, 30),
        duration: 120,
        capacity: 24,
        entry_type: 'open',
        host_id: hostA,
        status: 'active',
      },
      {
        title: `${PREFIX} Philosophy Walk`,
        type: 'Culture',
        location_name: 'Moda',
        start_time: atToday(20, 30),
        duration: 90,
        capacity: 10,
        entry_type: 'request',
        host_id: hostB,
        status: 'active',
      },
      {
        title: `${PREFIX} Super Event Warmup`,
        type: 'Special Event',
        location_name: 'Bostanci',
        start_time: atToday(21, 0),
        duration: 120,
        capacity: 100,
        entry_type: 'open',
        host_id: hostA,
        status: 'active',
        is_special_event: true,
      },
      {
        title: `${PREFIX} Chess Evening`,
        type: 'Games',
        location_name: 'Besiktas',
        start_time: atToday(21, 45),
        duration: 90,
        capacity: 8,
        entry_type: 'open',
        host_id: hostB,
        status: 'active',
      },
      {
        title: `${PREFIX} Art Opening`,
        type: 'Culture',
        location_name: 'Karakoy',
        start_time: atToday(22, 15),
        duration: 90,
        capacity: 20,
        entry_type: 'open',
        host_id: hostC,
        status: 'active',
      },
      {
        title: `${PREFIX} Midnight Stories`,
        type: 'Social',
        location_name: 'Cihangir',
        start_time: atToday(23, 15),
        duration: 75,
        capacity: 12,
        entry_type: 'request',
        host_id: hostC,
        status: 'active',
      },
    ];

    for (const ritual of rituals) {
      await upsertTonightRitual(ritual);
      console.log(`- upserted: ${ritual.title} @ ${ritual.location_name}`);
    }

    console.log('Done. Bu Gece filtresi icin ritueler eklendi/guncellendi.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed tonight rituals:', error);
    process.exit(1);
  }
}

main();

