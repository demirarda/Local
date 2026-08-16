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

const SEED_EMAIL = process.env.OPS_SEED_EMAIL || 'ops@local.dev';
const SEED_PASSWORD = process.env.OPS_SEED_PASSWORD || 'OpsLocal2026!';
const SEED_NAME = process.env.OPS_SEED_NAME || 'LOCAL PM';

const SAMPLE_TASKS = [
  {
    title: 'OB-11 — Kilitli gözatma ekranı',
    column: 'Tasarım',
    priority: 'high',
    description: 'Spec: dedicated ekran. Mockup: eksik-ekran-tasarimlari/ob11_kilitli_gozatma.html',
    links: [{ link_type: 'screen', ref_key: 'OB-11', ref_label: 'Kilitli gözatma' }, { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/ob11_kilitli_gozatma.html' }],
  },
  {
    title: 'OB-12 — Verify modal (full-screen → modal)',
    column: 'Geliştirme',
    priority: 'medium',
    description: 'VerifyEmailScreen modal varyantına dönüştürülecek.',
    links: [{ link_type: 'screen', ref_key: 'OB-12', ref_label: 'Verify modal' }],
  },
  {
    title: 'PL — 24 filtre çipi tam liste',
    column: 'Tasarım',
    priority: 'high',
    description: 'pulse_filtreler_24.html ile parity.',
    links: [{ link_type: 'screen', ref_key: 'PL-filters', ref_label: '24 filtre' }, { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/pulse_filtreler_24.html' }],
  },
  {
    title: 'Bypass warning / penalty ekranları',
    column: 'QA',
    priority: 'medium',
    links: [{ link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/bypass_warning_1.html' }],
  },
  {
    title: 'Milano host pipeline — doğrulama checklist',
    column: 'Brief',
    priority: 'urgent',
    description: 'Host lead: aday seçimi → admin doğrulama → pilot ritüel.',
    links: [{ link_type: 'doc', ref_key: 'backend/admin/dogrulama.html', ref_label: 'Admin doğrulama' }],
  },
  {
    title: 'Mekan PRO tier onboarding şablonu',
    column: 'Backlog',
    priority: 'medium',
    links: [{ link_type: 'doc', ref_key: 'DOKUMAN_VS_PROJE_ANALIZI.md', ref_label: 'Venue subscription' }],
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    const existingUser = await client.query(
      'SELECT id FROM ops.ops_users WHERE email = $1',
      [SEED_EMAIL.toLowerCase()]
    );

    let pmId;
    if (existingUser.rows[0]) {
      pmId = existingUser.rows[0].id;
      console.log(`Ops user exists: ${SEED_EMAIL}`);
    } else {
      const hash = await bcrypt.hash(SEED_PASSWORD, 12);
      const u = await client.query(
        `INSERT INTO ops.ops_users (email, name, password_hash, role)
         VALUES ($1, $2, $3, 'founder') RETURNING id`,
        [SEED_EMAIL.toLowerCase(), SEED_NAME, hash]
      );
      pmId = u.rows[0].id;
      console.log(`Created ops user: ${SEED_EMAIL} / ${SEED_PASSWORD}`);
    }

    const existingProj = await client.query(
      `SELECT id FROM ops.ops_projects WHERE name = 'LOCAL Milano Launch' LIMIT 1`
    );

    let projectId;
    let columns = [];

    if (existingProj.rows[0]) {
      projectId = existingProj.rows[0].id;
      const cols = await client.query(
        'SELECT id, name FROM ops.ops_board_columns WHERE project_id = $1 ORDER BY position',
        [projectId]
      );
      columns = cols.rows;
      console.log('Project already seeded: LOCAL Milano Launch');
    } else {
      await client.query('BEGIN');
      const proj = await client.query(
        `INSERT INTO ops.ops_projects (name, city, status, target_date)
         VALUES ('LOCAL Milano Launch', 'Milano', 'active', CURRENT_DATE + INTERVAL '90 days')
         RETURNING id`
      );
      projectId = proj.rows[0].id;

      const colNames = ['Backlog', 'Brief', 'Tasarım', 'Geliştirme', 'QA', 'Tamamlandı'];
      for (let i = 0; i < colNames.length; i++) {
        const c = await client.query(
          `INSERT INTO ops.ops_board_columns (project_id, name, position) VALUES ($1, $2, $3) RETURNING id, name`,
          [projectId, colNames[i], i]
        );
        columns.push(c.rows[0]);
      }
      await client.query('COMMIT');
      console.log('Created project: LOCAL Milano Launch');
    }

    if (columns.length === 0) {
      const cols = await client.query(
        'SELECT id, name FROM ops.ops_board_columns WHERE project_id = $1 ORDER BY position',
        [projectId]
      );
      columns = cols.rows;
    }

    const colByName = Object.fromEntries(columns.map((c) => [c.name, c.id]));

    const taskCount = await client.query(
      'SELECT COUNT(*)::int AS n FROM ops.ops_tasks WHERE project_id = $1',
      [projectId]
    );

    if (taskCount.rows[0].n > 0) {
      console.log(`Tasks already exist (${taskCount.rows[0].n}), skipping task seed.`);
    } else {
      for (let i = 0; i < SAMPLE_TASKS.length; i++) {
        const t = SAMPLE_TASKS[i];
        const columnId = colByName[t.column] || columns[0].id;
        const ins = await client.query(
          `INSERT INTO ops.ops_tasks (
            project_id, column_id, title, description, priority,
            reporter_id, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [projectId, columnId, t.title, t.description || null, t.priority, pmId, i]
        );
        const taskId = ins.rows[0].id;
        for (const link of t.links || []) {
          await client.query(
            `INSERT INTO ops.ops_task_links (task_id, link_type, ref_key, ref_label)
             VALUES ($1, $2, $3, $4)`,
            [taskId, link.link_type, link.ref_key, link.ref_label || null]
          );
        }
      }
      console.log(`Seeded ${SAMPLE_TASKS.length} sample tasks.`);
    }

    console.log('\n--- Ops Portal ready ---');
    console.log(`Login: ${SEED_EMAIL}`);
    console.log(`Password: ${SEED_PASSWORD}`);
    console.log('API: http://localhost:3001');
    console.log('Portal: http://localhost:5173');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
