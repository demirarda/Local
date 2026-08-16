import pg from 'pg';
import dotenv from 'dotenv';
import { importGapsToProject } from '../src/services/specImport.js';

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

async function main() {
  const projectName = process.argv[2] || 'LOCAL Milano Launch';
  const source = process.argv[3] || 'canon';

  const proj = await pool.query(
    `SELECT id FROM ops.ops_projects WHERE name = $1 LIMIT 1`,
    [projectName]
  );
  if (!proj.rows[0]) {
    console.error(`Project not found: ${projectName}`);
    process.exit(1);
  }

  const result = await importGapsToProject(proj.rows[0].id, { source, skipDuplicates: true });
  console.log(`Import complete for "${projectName}":`, result);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
