import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'local_db',
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD,
});

const DEMO_USERS = [
  { email: 'host.lead@local.dev', name: 'Host Lead', role: 'host_lead', password: 'OpsLocal2026!' },
  { email: 'venue.lead@local.dev', name: 'Venue Lead', role: 'venue_lead', password: 'OpsLocal2026!' },
  { email: 'designer@local.dev', name: 'Grafik Tasarımcı', role: 'designer', password: 'OpsLocal2026!' },
  { email: 'dev@local.dev', name: 'Yazılımcı', role: 'developer', password: 'OpsLocal2026!' },
];

async function seed() {
  for (const u of DEMO_USERS) {
    const exists = await pool.query('SELECT id FROM ops.ops_users WHERE email = $1', [u.email]);
    if (exists.rows[0]) {
      console.log(`Skip: ${u.email}`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 12);
    await pool.query(
      `INSERT INTO ops.ops_users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)`,
      [u.email, u.name, hash, u.role]
    );
    console.log(`Created: ${u.email} (${u.role})`);
  }
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
