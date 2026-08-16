import 'dotenv/config';
import pool from '../config/database.js';

const TARGET_EMAIL = process.env.SEED_TARGET_EMAIL || '200541032@firat.edu.tr';

const HOSTS = [
  {
    email: 'zeynep.kaya.host@local.app',
    name: 'Zeynep Kaya',
    city: 'Istanbul',
    university: 'Bogazici University',
    rs_score: 8.9,
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=500&fit=crop',
  },
  {
    email: 'mert.arslan.host@local.app',
    name: 'Mert Arslan',
    city: 'Ankara',
    university: 'Middle East Technical University',
    rs_score: 8.6,
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=500&fit=crop',
  },
  {
    email: 'elif.demir.host@local.app',
    name: 'Elif Demir',
    city: 'Izmir',
    university: 'Ege University',
    rs_score: 9.1,
    avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=500&fit=crop',
  },
  {
    email: 'berk.celik.host@local.app',
    name: 'Berk Celik',
    city: 'Eskisehir',
    university: 'Anadolu University',
    rs_score: 8.4,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop',
  },
];

async function ensureHostUser(client, host) {
  const inserted = await client.query(
    `INSERT INTO users (email, password_hash, name, city, university, rs_score, avatar_url)
     VALUES ($1, '$2b$10$8Qy6Qh59yKpW6Rcv8Yp6Qe0z8GGzxubUoil58x2oyS9MhUlCT3VkG', $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE
     SET name = EXCLUDED.name,
         city = EXCLUDED.city,
         university = EXCLUDED.university,
         rs_score = EXCLUDED.rs_score,
         avatar_url = EXCLUDED.avatar_url
     RETURNING id`,
    [host.email, host.name, host.city, host.university, host.rs_score, host.avatar_url]
  );
  return inserted.rows[0].id;
}

async function ensureHostVerification(client, hostId) {
  await client.query(
    `INSERT INTO host_verifications (user_id, status, verified_at, expires_at, verified_by, verification_type)
     VALUES ($1, 'active', NOW(), NOW() + INTERVAL '365 days', 'admin', 'standard')
     ON CONFLICT (user_id) DO UPDATE
     SET status = 'active',
         verified_at = COALESCE(host_verifications.verified_at, NOW()),
         expires_at = NOW() + INTERVAL '365 days'`,
    [hostId]
  );
}

async function ensureFollow(client, followerId, followingId) {
  await client.query(
    `INSERT INTO follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id) DO NOTHING`,
    [followerId, followingId]
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetUser = await client.query(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [TARGET_EMAIL]
    );

    if (!targetUser.rows[0]) {
      throw new Error(`Target user not found for email: ${TARGET_EMAIL}`);
    }

    const followerId = targetUser.rows[0].id;
    let hostsAdded = 0;
    let followsAdded = 0;

    for (const host of HOSTS) {
      const hostId = await ensureHostUser(client, host);
      await ensureHostVerification(client, hostId);
      await ensureFollow(client, followerId, hostId);
      hostsAdded += 1;
      followsAdded += 1;
    }

    await client.query('COMMIT');
    console.log(`✅ Real hosts upserted: ${hostsAdded}`);
    console.log(`✅ Follows ensured for ${TARGET_EMAIL}: ${followsAdded}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ seed_real_hosts_following failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
