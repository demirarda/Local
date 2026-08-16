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

const SCREENS = [
  { spec_id: 'OB-11', title: 'Kilitli gözatma', category: 'onboarding', file_ref: 'eksik-ekran-tasarimlari/ob11_kilitli_gozatma.html', is_target: true, design_status: 'in_progress' },
  { spec_id: 'OB-12', title: 'Verify modal', category: 'onboarding', file_ref: 'eksik-ekran-tasarimlari/ob12_verify_modal.html', is_target: true, design_status: 'not_started' },
  { spec_id: 'PL-filters', title: '24 filtre çipi', category: 'pulse', file_ref: 'eksik-ekran-tasarimlari/pulse_filtreler_24.html', is_target: true, design_status: 'in_progress', dev_status: 'not_started' },
  { spec_id: 'PL-01', title: 'Pulse ana akış light', category: 'pulse', is_target: true, design_status: 'done', dev_status: 'done' },
  { spec_id: 'PL-03', title: 'Hero ritual kartı', category: 'pulse', is_target: true, design_status: 'done', dev_status: 'in_progress' },
  { spec_id: 'memory-checkin', title: 'Memory Check-in kartı', category: 'memory', file_ref: 'eksik-ekran-tasarimlari/memory_checkin.html', is_target: true, design_status: 'not_started' },
  { spec_id: 'memory-rs-delta', title: 'Memory RS Delta', category: 'memory', file_ref: 'eksik-ekran-tasarimlari/memory_rs_delta.html', is_target: true, design_status: 'not_started' },
  { spec_id: 'memory-host-teaser', title: 'Memory Host Teaser', category: 'memory', file_ref: 'eksik-ekran-tasarimlari/memory_host_teaser.html', is_target: true, design_status: 'not_started' },
  { spec_id: 'bypass-warning', title: 'Bypass uyarı', category: 'trust', file_ref: 'eksik-ekran-tasarimlari/bypass_warning_1.html', is_target: true, design_status: 'done', dev_status: 'in_progress' },
  { spec_id: 'bypass-penalty', title: 'Bypass ceza', category: 'trust', file_ref: 'eksik-ekran-tasarimlari/bypass_penalty_2.html', is_target: true, design_status: 'done', dev_status: 'not_started' },
  { spec_id: 'CR-01', title: 'City Rhythm liste', category: 'city_rhythm', is_target: false, design_status: 'done', dev_status: 'done' },
  { spec_id: 'SP-01', title: 'Social Passport', category: 'passport', is_target: false, design_status: 'done', dev_status: 'done' },
];

async function seed() {
  const proj = await pool.query(`SELECT id FROM ops.ops_projects WHERE name = 'LOCAL Milano Launch' LIMIT 1`);
  if (!proj.rows[0]) {
    console.log('Run npm run seed first');
    process.exit(1);
  }
  const projectId = proj.rows[0].id;
  const pm = await pool.query(`SELECT id FROM ops.ops_users WHERE role IN ('founder','pm') LIMIT 1`);

  const hostCount = await pool.query('SELECT COUNT(*)::int AS n FROM ops.ops_host_pipeline WHERE project_id = $1', [projectId]);
  if (hostCount.rows[0].n === 0) {
    const samples = [
      { name: 'Marco B.', status: 'active', rituals: 12, feedback: 'Milano kampüsünde 3 pivot ritüel önerdi. Haftalık check-in istiyor.' },
      { name: 'Giulia R.', status: 'onboarding', rituals: 2, feedback: null },
      { name: 'Luca V.', status: 'candidate', rituals: 0, feedback: null },
    ];
    for (const h of samples) {
      await pool.query(
        `INSERT INTO ops.ops_host_pipeline (project_id, display_name, city, pipeline_status, rituals_hosted, host_feedback, owner_id)
         VALUES ($1, $2, 'Milano', $3, $4, $5, $6)`,
        [projectId, h.name, h.status, h.rituals, h.feedback, pm.rows[0]?.id]
      );
    }
    console.log('Seeded 3 sample hosts');
  }

  const venueCount = await pool.query('SELECT COUNT(*)::int AS n FROM ops.ops_venue_pipeline WHERE project_id = $1', [projectId]);
  if (venueCount.rows[0].n === 0) {
    const venues = [
      { name: 'Caffè Biblioteca Braidense', status: 'agreed', city: 'Milano' },
      { name: 'Navigli Jazz Bar', status: 'negotiating', city: 'Milano' },
      { name: 'Brera Gallery Space', status: 'target', city: 'Milano' },
      { name: 'Porta Venezia Studio', status: 'declined', city: 'Milano', notes: 'Franchise politikası — şimdilik hayır' },
    ];
    for (const v of venues) {
      await pool.query(
        `INSERT INTO ops.ops_venue_pipeline (project_id, name, city, pipeline_status, internal_notes, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, v.name, v.city, v.status, v.notes || null, pm.rows[0]?.id]
      );
    }
    console.log('Seeded 4 sample venues');
  }

  for (const s of SCREENS) {
    await pool.query(
      `INSERT INTO ops.ops_screens (project_id, spec_id, title, category, file_ref, is_target, design_status, dev_status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'medium')
       ON CONFLICT (project_id, spec_id) DO NOTHING`,
      [projectId, s.spec_id, s.title, s.category, s.file_ref || null, s.is_target, s.design_status, s.dev_status || 'not_started']
    );
  }
  console.log(`Seeded/upgraded ${SCREENS.length} screens catalog`);

  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
