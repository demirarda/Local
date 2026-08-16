import 'dotenv/config';
import pool from '../config/database.js';

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || null;

function atOffset(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60000);
}

async function getViewer(client) {
  if (TARGET_EMAIL) {
    const byMail = await client.query(
      `SELECT id, email, city FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [TARGET_EMAIL]
    );
    if (byMail.rows[0]) return byMail.rows[0];
  }

  const byName = await client.query(
    `SELECT id, email, city FROM users WHERE name ILIKE $1 LIMIT 1`,
    ['%Arda%']
  );
  if (byName.rows[0]) return byName.rows[0];

  const any = await client.query(
    `SELECT id, email, city FROM users ORDER BY created_at ASC LIMIT 1`
  );
  if (!any.rows[0]) throw new Error('No users found in DB');
  return any.rows[0];
}

async function ensureHost(client, city, idx, opts = {}) {
  const email = opts.email || `followed.host.${idx}@local.app`;
  const name = opts.name || `Followed Host ${idx}`;
  const rs = Number.isFinite(Number(opts.rs)) ? Number(opts.rs) : 8.2 + (idx % 3) * 0.2;
  const host = await client.query(
    `INSERT INTO users (email, password_hash, name, city, university, rs_score)
     VALUES ($1, '$2b$10$8Qy6Qh59yKpW6Rcv8Yp6Qe0z8GGzxubUoil58x2oyS9MhUlCT3VkG', $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name,
           city = EXCLUDED.city,
           university = EXCLUDED.university,
           rs_score = EXCLUDED.rs_score
     RETURNING id, name`,
    [email, name, city, 'Seed University', rs]
  );

  await client.query(
    `INSERT INTO host_verifications (user_id, status, verified_at, expires_at, verified_by, verification_type)
     VALUES ($1, 'active', NOW(), NOW() + INTERVAL '365 days', 'admin', 'standard')
     ON CONFLICT (user_id) DO UPDATE
       SET status = 'active', expires_at = NOW() + INTERVAL '365 days'`,
    [host.rows[0].id]
  );

  return host.rows[0];
}

async function ensureVenue(client, city, idx) {
  const name = `Followed Venue ${idx}`;
  const venue = await client.query(
    `INSERT INTO venues (name, city, address, description, location_lat, location_lng, slug, subscription_tier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pro')
     ON CONFLICT (name, city) DO UPDATE
       SET address = EXCLUDED.address,
           description = EXCLUDED.description,
           location_lat = EXCLUDED.location_lat,
           location_lng = EXCLUDED.location_lng
     RETURNING id, name`,
    [
      name,
      city,
      `${city} Center ${idx}`,
      'Seeded followed venue',
      41.0 + idx * 0.01,
      29.0 + idx * 0.01,
      `followed-venue-${idx}-${city.toLowerCase()}`,
    ]
  );

  await client.query(
    `INSERT INTO venue_verifications (venue_name, city, verified_by, verification_type, verified_at, expires_at, status)
     VALUES ($1, $2, 'admin', 'standard', NOW(), NOW() + INTERVAL '365 days', 'active')
     ON CONFLICT (venue_name, city) DO UPDATE
       SET status = 'active', expires_at = NOW() + INTERVAL '365 days'`,
    [name, city]
  );

  return venue.rows[0];
}

async function ensureFollow(client, followerId, followingId) {
  await client.query(
    `INSERT INTO follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id) DO NOTHING`,
    [followerId, followingId]
  );
}

async function ensureVenueFollow(client, userId, venueId) {
  await client.query(
    `INSERT INTO venue_follows (user_id, venue_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, venue_id) DO NOTHING`,
    [userId, venueId]
  );
}

async function ensureAcceptedFriendship(client, userA, userB, createdAt) {
  const existing = await client.query(
    `SELECT id
     FROM friendships
     WHERE (requester_id = $1 AND receiver_id = $2)
        OR (requester_id = $2 AND receiver_id = $1)
     LIMIT 1`,
    [userA, userB]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE friendships
       SET status = 'accepted',
           requester_id = COALESCE(requester_id, $2),
           receiver_id = COALESCE(receiver_id, $3),
           created_at = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [existing.rows[0].id, userA, userB, createdAt]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO friendships (requester_id, receiver_id, status, created_at, updated_at)
     VALUES ($1, $2, 'accepted', $3, CURRENT_TIMESTAMP)
     RETURNING id`,
    [userA, userB, createdAt]
  );
  return inserted.rows[0].id;
}

async function ensureAttendance(client, ritualId, userId) {
  await client.query(
    `INSERT INTO ritual_attendance (ritual_id, user_id, status)
     VALUES ($1, $2, 'confirmed')
     ON CONFLICT (ritual_id, user_id)
     DO UPDATE SET status = 'confirmed'`,
    [ritualId, userId]
  );
}

async function upsertRitual(client, row) {
  const existing = await client.query(
    `SELECT id FROM rituals WHERE title = $1 AND location_name = $2 LIMIT 1`,
    [row.title, row.location_name]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE rituals
       SET type = $1,
           venue_id = $2,
           start_time = $3,
           end_time = $4,
           duration = $5,
           capacity = $6,
           entry_type = $7::ritual_entry_type,
           host_id = $8,
           status = $9::ritual_status,
           location_lat = $10,
           location_lng = $11,
           is_recurring = $12,
           recurrence_rule = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14`,
      [
        row.type,
        row.venue_id,
        row.start_time,
        row.end_time,
        row.duration,
        row.capacity,
        row.entry_type,
        row.host_id,
        row.status,
        row.location_lat,
        row.location_lng,
        Boolean(row.is_recurring),
        row.recurrence_rule || null,
        existing.rows[0].id,
      ]
    );
    return existing.rows[0].id;
  }

  const ins = await client.query(
    `INSERT INTO rituals (
      title, type, location_name, venue_id, start_time, end_time, duration, capacity, entry_type,
      location_lat, location_lng, host_id, status, min_rs, live_window_hours, is_recurring, recurrence_rule
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::ritual_entry_type,
      $10, $11, $12, $13::ritual_status, 0, 12, $14, $15
    )
    RETURNING id`,
    [
      row.title,
      row.type,
      row.location_name,
      row.venue_id,
      row.start_time,
      row.end_time,
      row.duration,
      row.capacity,
      row.entry_type,
      row.location_lat,
      row.location_lng,
      row.host_id,
      row.status,
      Boolean(row.is_recurring),
      row.recurrence_rule || null,
    ]
  );
  return ins.rows[0].id;
}

async function upsertPulseMemory(client, { ritualId, userId, content, spotifyUrl = null }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const existing = await client.query(
    `SELECT id FROM memories
     WHERE ritual_id = $1
       AND user_id = $2
       AND memory_type = 'pulse'
       AND content = $3
     LIMIT 1`,
    [ritualId, userId, content]
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE memories
       SET expires_at = $1,
           spotify_playlist_url = $2::text,
           spotify_playlist_id = CASE
             WHEN $2 IS NULL THEN NULL
             ELSE regexp_replace($2::text, '^.*(?:playlist/|playlist:)([A-Za-z0-9]+).*$','\\1')
           END
       WHERE id = $3`,
      [expiresAt, spotifyUrl, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO memories (ritual_id, user_id, content, memory_type, expires_at, spotify_playlist_url, spotify_playlist_id)
     VALUES (
       $1, $2, $3, 'pulse', $4, $5::text,
       CASE
         WHEN $5 IS NULL THEN NULL
         ELSE regexp_replace($5::text, '^.*(?:playlist/|playlist:)([A-Za-z0-9]+).*$','\\1')
       END
     )
     RETURNING id`,
    [ritualId, userId, content, expiresAt, spotifyUrl]
  );

  return inserted.rows[0].id;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const viewer = await getViewer(client);
    const city = viewer.city || 'Istanbul';

    const hosts = [];
    for (let i = 1; i <= 4; i += 1) {
      const host = await ensureHost(client, city, i);
      await ensureFollow(client, viewer.id, host.id);
      hosts.push(host);
    }
    const pivotSeeds = [
      { idx: 21, name: 'Alessandro R.', rs: 8.7, email: 'pivot.alessandro@local.app' },
      { idx: 22, name: 'Sofia M.', rs: 8.4, email: 'pivot.sofia@local.app' },
      { idx: 23, name: 'Chiara B.', rs: 8.1, email: 'pivot.chiara@local.app' },
      { idx: 24, name: 'Marco V.', rs: 8.0, email: 'pivot.marco@local.app' },
    ];
    const pivotHosts = [];
    for (const seed of pivotSeeds) {
      const host = await ensureHost(client, city, seed.idx, seed);
      await ensureFollow(client, viewer.id, host.id);
      pivotHosts.push(host);
    }

    const friendA = await ensureHost(client, city, 11);
    const friendB = await ensureHost(client, city, 12);
    const friendshipCreatedAt = new Date(Date.now() - 10 * 60 * 1000);
    await ensureAcceptedFriendship(client, viewer.id, friendA.id, friendshipCreatedAt);
    await ensureAcceptedFriendship(client, viewer.id, friendB.id, friendshipCreatedAt);

    const venues = [];
    for (let i = 1; i <= 3; i += 1) {
      const venue = await ensureVenue(client, city, i);
      await ensureVenueFollow(client, viewer.id, venue.id);
      venues.push(venue);
    }

    const rows = [
      {
        title: '[Followed] Live Jazz Circle',
        type: 'Music',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(-25),
        end_time: atOffset(65),
        duration: 90,
        capacity: 12,
        entry_type: 'open',
        host_id: hosts[0].id,
        status: 'live',
        location_lat: 41.01,
        location_lng: 28.98,
      },
      {
        title: '[Followed] Philosophy Walk',
        type: 'Culture',
        location_name: venues[1].name,
        venue_id: venues[1].id,
        start_time: atOffset(35),
        end_time: atOffset(125),
        duration: 90,
        capacity: 10,
        entry_type: 'request',
        host_id: hosts[1].id,
        status: 'active',
        location_lat: 41.02,
        location_lng: 28.99,
      },
      {
        title: '[Followed] Sunset Networking',
        type: 'Social',
        location_name: venues[2].name,
        venue_id: venues[2].id,
        start_time: atOffset(70),
        end_time: atOffset(160),
        duration: 90,
        capacity: 20,
        entry_type: 'open',
        host_id: hosts[2].id,
        status: 'active',
        location_lat: 41.03,
        location_lng: 29.0,
      },
      {
        title: '[Followed] Special Showcase',
        type: 'Special Event',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(110),
        end_time: atOffset(230),
        duration: 120,
        capacity: 80,
        entry_type: 'open',
        host_id: hosts[3].id,
        status: 'active',
        location_lat: 41.01,
        location_lng: 28.98,
      },
      {
        title: '[Pivot] Jazz Night at Blue Note',
        type: 'Music',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(-20),
        end_time: atOffset(70),
        duration: 90,
        capacity: 12,
        entry_type: 'open',
        host_id: pivotHosts[0].id,
        status: 'live',
        location_lat: 41.011,
        location_lng: 28.981,
      },
      {
        title: '[Pivot] Morning Run Club',
        type: 'Fitness',
        location_name: venues[2].name,
        venue_id: venues[2].id,
        start_time: atOffset(-35),
        end_time: atOffset(55),
        duration: 90,
        capacity: 20,
        entry_type: 'open',
        host_id: pivotHosts[1].id,
        status: 'live',
        location_lat: 41.03,
        location_lng: 29.001,
      },
      {
        title: '[Pivot] Philosophy Walk',
        type: 'Culture',
        location_name: venues[1].name,
        venue_id: venues[1].id,
        start_time: atOffset(40),
        end_time: atOffset(130),
        duration: 90,
        capacity: 8,
        entry_type: 'request',
        host_id: pivotHosts[2].id,
        status: 'active',
        location_lat: 41.021,
        location_lng: 28.992,
      },
      {
        title: '[Pivot] Sunday Brunch Circle',
        type: 'Social',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(160),
        end_time: atOffset(250),
        duration: 90,
        capacity: 10,
        entry_type: 'open',
        host_id: pivotHosts[3].id,
        status: 'active',
        location_lat: 41.012,
        location_lng: 28.982,
      },
      {
        title: '[Recurring] Morning Coffee Circle',
        type: 'Social',
        location_name: venues[1].name,
        venue_id: venues[1].id,
        start_time: atOffset(50),
        end_time: atOffset(110),
        duration: 60,
        capacity: 12,
        entry_type: 'open',
        host_id: hosts[0].id,
        status: 'active',
        location_lat: 41.018,
        location_lng: 28.989,
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      },
      {
        title: '[Recurring] Sunset Yoga Weekly',
        type: 'Fitness',
        location_name: venues[2].name,
        venue_id: venues[2].id,
        start_time: atOffset(85),
        end_time: atOffset(145),
        duration: 60,
        capacity: 16,
        entry_type: 'open',
        host_id: hosts[1].id,
        status: 'active',
        location_lat: 41.029,
        location_lng: 29.002,
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      },
      {
        title: '[Recurring] Philosophy Reading Monthly',
        type: 'Culture',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(180),
        end_time: atOffset(260),
        duration: 80,
        capacity: 10,
        entry_type: 'request',
        host_id: hosts[2].id,
        status: 'active',
        location_lat: 41.012,
        location_lng: 28.984,
        is_recurring: true,
        recurrence_rule: 'FREQ=MONTHLY;BYDAY=1FR',
      },
      {
        title: '[Recurring] Language Exchange Biweekly',
        type: 'Social',
        location_name: venues[1].name,
        venue_id: venues[1].id,
        start_time: atOffset(120),
        end_time: atOffset(200),
        duration: 80,
        capacity: 14,
        entry_type: 'open',
        host_id: hosts[3].id,
        status: 'active',
        location_lat: 41.02,
        location_lng: 28.991,
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE',
      },
      {
        title: '[Recurring] Jazz Night Friday Series',
        type: 'Music',
        location_name: venues[0].name,
        venue_id: venues[0].id,
        start_time: atOffset(-10),
        end_time: atOffset(80),
        duration: 90,
        capacity: 12,
        entry_type: 'open',
        host_id: pivotHosts[0].id,
        status: 'live',
        location_lat: 41.011,
        location_lng: 28.981,
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=FR',
      },
    ];

    const ritualIds = [];
    for (const row of rows) {
      const id = await upsertRitual(client, row);
      ritualIds.push(id);
    }

    const memoryRows = [
      {
        ritualId: ritualIds[0],
        userId: hosts[0].id,
        content: 'Bu gece enerji efsane. Caz sesi ve sohbet tam kivaminda.',
      },
      {
        ritualId: ritualIds[1],
        userId: hosts[1].id,
        content: 'Yuruyus rotasi hazir. Felsefe sohbeti icin notlarimi da getirdim.',
      },
      {
        ritualId: ritualIds[2],
        userId: hosts[2].id,
        content: 'Aksam acilisi icin ortak playlisti biraktim.',
        spotifyUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6',
      },
      {
        ritualId: ritualIds[4],
        userId: pivotHosts[0].id,
        content: 'Pivot serisinin ilk gecesi: Jazz Night canli yayinda.',
      },
      {
        ritualId: ritualIds[6],
        userId: pivotHosts[2].id,
        content: 'Felsefe yuruyusu notlari hazir. 20:30 bulusuyoruz.',
      },
      {
        ritualId: ritualIds[8],
        userId: hosts[0].id,
        content: 'Morning Coffee Circle serisi bu hafta da devam.',
      },
      {
        ritualId: ritualIds[10],
        userId: hosts[2].id,
        content: 'Aylik Philosophy Reading takvimi acildi.',
      },
    ];
    for (const m of memoryRows) {
      await upsertPulseMemory(client, m);
    }

    await ensureAttendance(client, ritualIds[0], viewer.id);
    await ensureAttendance(client, ritualIds[0], friendA.id);
    await ensureAttendance(client, ritualIds[0], friendB.id);

    await client.query('COMMIT');
    console.log(`✅ Viewer: ${viewer.email} (${city})`);
    console.log(`✅ Followed hosts ensured: ${hosts.length}`);
    console.log(`✅ Pivot hosts ensured: ${pivotHosts.length}`);
    console.log(`✅ Followed venues ensured: ${venues.length}`);
    console.log(`✅ Followed rituals upserted: ${rows.length}`);
    console.log(`✅ Followed pulse memories upserted: ${memoryRows.length}`);
    console.log('✅ Friend pulse events prerequisites ensured: 2 new friends + shared ritual');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ seed_followed_pulse_data failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
