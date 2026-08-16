import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../../');

/** Canon gaps from DOKUMAN_VS_PROJE_ANALIZI.md section 3 */
export const SPEC_GAPS = [
  {
    title: 'OB-11 — Kilitli gözatma ekranı',
    column: 'Tasarım',
    priority: 'high',
    description: 'Banner/overlay var; spec dedicated ekran istiyor.',
    links: [
      { link_type: 'screen', ref_key: 'OB-11', ref_label: 'Kilitli gözatma' },
      { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/ob11_kilitli_gozatma.html' },
    ],
  },
  {
    title: 'OB-12 — Verify modal varyantı',
    column: 'Geliştirme',
    priority: 'medium',
    description: 'VerifyEmailScreen full-screen → modal.',
    links: [
      { link_type: 'screen', ref_key: 'OB-12', ref_label: 'Verify modal' },
      { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/ob12_verify_modal.html' },
    ],
  },
  {
    title: 'Pulse filtre: Şimdi Canlı (Live Now)',
    column: 'Geliştirme',
    priority: 'high',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-live-now' }],
  },
  {
    title: 'Pulse filtre: Başlamak Üzere',
    column: 'Geliştirme',
    priority: 'high',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-starting-soon' }],
  },
  {
    title: 'Pulse filtre: Bu Gece / Bu Hafta / Hafta Sonu',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-time-range' }],
  },
  {
    title: 'Pulse filtre: Sabah / Öğleden Sonra / Akşam',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-time-of-day' }],
  },
  {
    title: 'Pulse filtre: Pivot Hostlar',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-pivot-hosts' }],
  },
  {
    title: 'Pulse filtre: Ücretsiz Giriş',
    column: 'Geliştirme',
    priority: 'low',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-free-entry' }],
  },
  {
    title: 'Pulse filtre: Birebir / Küçük Grup / Büyük Grup',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-group-size' }],
  },
  {
    title: 'Pulse filtre: Herkese Açık',
    column: 'Geliştirme',
    priority: 'low',
    links: [{ link_type: 'screen', ref_key: 'PL-filter-public' }],
  },
  {
    title: '24 filtre çipi — tam liste parity',
    column: 'Tasarım',
    priority: 'high',
    description: 'FILTER_OPTIONS 24 elemana çıkarılacak; backend query params.',
    links: [
      { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/pulse_filtreler_24.html' },
      { link_type: 'doc', ref_key: 'DOKUMAN_VS_PROJE_ANALIZI.md#pulse-filtreler' },
    ],
  },
  {
    title: 'Memory tipi: Check-in UI kartı',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/memory_checkin.html' }],
  },
  {
    title: 'Memory tipi: RS Delta kartı',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/memory_rs_delta.html' }],
  },
  {
    title: 'Memory tipi: Host Teaser kartı',
    column: 'Geliştirme',
    priority: 'medium',
    links: [{ link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/memory_host_teaser.html' }],
  },
  {
    title: 'Bypass 2-kademeli warning state machine doğrulama',
    column: 'QA',
    priority: 'high',
    links: [
      { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/bypass_warning_1.html' },
      { link_type: 'file', ref_key: 'eksik-ekran-tasarimlari/bypass_penalty_2.html' },
      { link_type: 'doc', ref_key: 'LOCAL_RS_v3.1_Final.md' },
    ],
  },
  {
    title: 'Ritual kategorileri 56 → 60',
    column: 'Backlog',
    priority: 'low',
    links: [{ link_type: 'doc', ref_key: 'DOKUMAN_VS_PROJE_ANALIZI.md#kategori' }],
  },
  {
    title: 'Doküman borcu: PROJE_ACIKLAMASI INIT_RS 5.0',
    column: 'Backlog',
    priority: 'low',
    links: [{ link_type: 'doc', ref_key: 'PROJE_ACIKLAMASI.md' }],
  },
  {
    title: 'Doküman borcu: ALGORITMALAR.md LTE-3 v3 sync',
    column: 'Backlog',
    priority: 'low',
    links: [{ link_type: 'doc', ref_key: 'ALGORITMALAR.md' }],
  },
];

export function parseGapsFromMarkdown(filePath) {
  const abs = filePath.startsWith('/') ? filePath : join(REPO_ROOT, filePath);
  let content;
  try {
    content = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }

  const gaps = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const m = line.match(/^- \[ \] (.+)$/);
    if (!m) continue;
    let text = m[1].trim();
    text = text.replace(/\*\*/g, '');
    let column = 'Backlog';
    if (/OB-|onboarding|modal|ekran|tasarım/i.test(text)) column = 'Tasarım';
    else if (/filtre|pulse|PL-|backend|geliştir/i.test(text)) column = 'Geliştirme';
    else if (/bypass|QA|test|doğrula/i.test(text)) column = 'QA';

    const specMatch = text.match(/^(OB-\d+|PL-\d+|RT-\d+|GL-\d+)/i);
    const links = [];
    if (specMatch) {
      links.push({ link_type: 'screen', ref_key: specMatch[1].toUpperCase(), ref_label: text.slice(0, 80) });
    }
    links.push({ link_type: 'doc', ref_key: 'DOKUMAN_VS_PROJE_ANALIZI.md' });

    gaps.push({
      title: text.slice(0, 255),
      column,
      priority: column === 'Tasarım' ? 'high' : 'medium',
      description: 'Markdown checklist import',
      links,
    });
  }
  return gaps;
}

export async function importGapsToProject(projectId, { source = 'canon', reporterId = null, skipDuplicates = true } = {}) {
  const gaps = source === 'markdown'
    ? parseGapsFromMarkdown('DOKUMAN_VS_PROJE_ANALIZI.md')
    : SPEC_GAPS;

  if (!gaps.length) {
    return { created: 0, skipped: 0, total: 0 };
  }

  const cols = await pool.query(
    `SELECT id, name FROM ops.ops_board_columns WHERE project_id = $1 ORDER BY position`,
    [projectId]
  );
  const colByName = Object.fromEntries(cols.rows.map((c) => [c.name, c.id]));
  const defaultColId = cols.rows[0]?.id;

  let created = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const gap of gaps) {
      if (skipDuplicates) {
        const dup = await client.query(
          `SELECT id FROM ops.ops_tasks WHERE project_id = $1 AND title = $2 LIMIT 1`,
          [projectId, gap.title]
        );
        if (dup.rows[0]) {
          skipped++;
          continue;
        }
      }

      const columnId = colByName[gap.column] || defaultColId;
      const posRes = await client.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ops.ops_tasks WHERE column_id = $1`,
        [columnId]
      );

      const ins = await client.query(
        `INSERT INTO ops.ops_tasks (
          project_id, column_id, title, description, priority, reporter_id, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          projectId,
          columnId,
          gap.title,
          gap.description || null,
          gap.priority || 'medium',
          reporterId,
          posRes.rows[0].p,
        ]
      );

      for (const link of gap.links || []) {
        await client.query(
          `INSERT INTO ops.ops_task_links (task_id, link_type, ref_key, ref_label)
           VALUES ($1, $2, $3, $4)`,
          [ins.rows[0].id, link.link_type, link.ref_key, link.ref_label || null]
        );
      }
      created++;
    }

    await client.query('COMMIT');
    return { created, skipped, total: gaps.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
