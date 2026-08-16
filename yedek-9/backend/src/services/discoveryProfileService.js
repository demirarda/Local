/**
 * Venue character card + chain/brand profiles — LOCAL v2 §12
 */
import pool from '../config/database.js';
import { computeVenueTrustAura, getSeatingLabel } from './venueTrustAuraService.js';
import { getPublicChipBreakdown } from './chipService.js';

const CHIP_TOP = 3;

/**
 * Karakter kartı: Trust+etiket + Aura+etiket + skor-altı 1-3 chip
 * Hacim (n_eff) kartta YOK — sadece profil detayında
 */
export async function buildVenueCharacterCard(venueId) {
  const venue = await pool.query(
    `SELECT id, name, city, chain_id, brand_id, is_verified FROM venues WHERE id = $1`,
    [venueId]
  );
  if (!venue.rows[0]) return { ok: false, status: 404, error: 'Venue not found' };

  const [trustAura, chips] = await Promise.all([
    computeVenueTrustAura(venueId, { audience: 'public' }),
    getPublicChipBreakdown(venueId),
  ]);

  const topChips = (chips.breakdown || [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, CHIP_TOP)
    .map((c) => ({
      chip_id: c.chip_id,
      // 🟢 + 🔴 aynı anda olabilir
      green: c.green,
      red: c.red,
      yellow: c.yellow,
      // volume intentionally omitted on card
    }));

  const distCats = trustAura?.aura_display?.distribution?.categories || [];
  const firstSlices = distCats.slice(0, 3).map((c) => ({
    category: c.category,
    avg_score: c.avg_score,
    status: c.status,
    // no count on character card
  }));
  const otherCount = Math.max(0, distCats.length - 3);

  const seating = getSeatingLabel(trustAura?.trust_display?.n_eff || 0);

  return {
    ok: true,
    card: {
      venue_id: venue.rows[0].id,
      name: venue.rows[0].name,
      city: venue.rows[0].city,
      verified: venue.rows[0].is_verified,
      chain_id: venue.rows[0].chain_id || null,
      brand_id: venue.rows[0].brand_id || null,
      trust: {
        score: trustAura?.trust_display?.score ?? null,
        score_hidden: Boolean(trustAura?.trust_display?.score_hidden),
        public_label: trustAura?.trust_display?.public_label || null,
        label: seating.label,
        label_key: seating.key,
        // n_eff intentionally NOT on card
      },
      aura: {
        score: trustAura?.aura_display?.score ?? null,
        score_hidden: Boolean(trustAura?.aura_display?.score_hidden),
        public_label: trustAura?.aura_display?.public_label || null,
        label: seating.label,
        label_key: seating.key,
      },
      chips_under_scores: topChips,
      distribution_slices: firstSlices,
      distribution_other: otherCount > 0 ? { label: '+diğer', count_categories: otherCount } : null,
      volume_hidden: true,
    },
    /** Profil detayı — hacim burada */
    profile_volume: {
      trust_n_eff: trustAura?.trust_display?.n_eff ?? 0,
      aura_n_eff: trustAura?.aura_display?.n_eff ?? 0,
      chip_total: chips.total_chip_answers || 0,
    },
  };
}

export async function getChainProfile(chainId) {
  const chain = await pool.query(`SELECT * FROM venue_chains WHERE id = $1`, [chainId]);
  if (!chain.rows[0]) return { ok: false, status: 404, error: 'Chain not found' };

  const branches = await pool.query(
    `SELECT v.id, v.name, v.city, v.is_verified
     FROM venues v
     WHERE v.chain_id = $1
     ORDER BY v.name ASC`,
    [chainId]
  );

  const scores = [];
  for (const b of branches.rows) {
    const ta = await computeVenueTrustAura(b.id, { audience: 'public' });
    const s = ta?.trust_display?.score;
    if (s != null) scores.push(Number(s));
    b.trust_score = s ?? null;
    b.aura_score = ta?.aura_display?.score ?? null;
  }

  const min = scores.length ? Math.min(...scores) : null;
  const max = scores.length ? Math.max(...scores) : null;
  // harman YOK — sadece aralık
  const range_label =
    min != null && max != null ? `${min.toFixed(1)}–${max.toFixed(1)}` : null;

  return {
    ok: true,
    chain: {
      ...chain.rows[0],
      branches: branches.rows.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        verified: b.is_verified,
        trust_score: b.trust_score,
        aura_score: b.aura_score,
        // her şube ayrı profil/skor
      })),
      score_range: range_label,
      blended: false,
    },
  };
}

/**
 * Brand: yalnız Aura (Trust yok) + dağılım + yaşandığı-yerler (ortalama YOK)
 * + Series şeridi + arşiv (gizlenemez) — slot YOK, feed YOK
 * RQ hem host'a hem brand-Aura'ya (ritual.brand_id ∨ venue.brand_id)
 */
export async function getBrandProfile(brandId) {
  const brand = await pool.query(`SELECT * FROM brands WHERE id = $1`, [brandId]);
  if (!brand.rows[0]) return { ok: false, status: 404, error: 'Brand not found' };

  const venues = await pool.query(
    `SELECT v.id, v.name, v.city
     FROM venues v
     WHERE v.brand_id = $1
     ORDER BY v.name ASC`,
    [brandId]
  );

  const auraR = await pool.query(
    `SELECT AVG(
       CASE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, ''))
         WHEN 'green' THEN 1.0
         WHEN 'yellow' THEN 0.5
         WHEN 'red' THEN 0.0
         ELSE NULL
       END
     )::float AS aura,
     COUNT(*)::int AS n
     FROM feedback f
     JOIN rituals r ON r.id = f.ritual_id
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE (r.brand_id = $1 OR v.brand_id = $1)
       AND f.feedback_type IN ('p2r','rq')
       AND COALESCE(f.submitted_at, f.created_at) >= NOW() - INTERVAL '90 days'`,
    [brandId]
  ).catch(() => ({ rows: [{}] }));

  const distR = await pool.query(
    `SELECT COALESCE(NULLIF(TRIM(r.type), ''), 'diger') AS category,
            COUNT(*)::int AS n,
            AVG(
              CASE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, ''))
                WHEN 'green' THEN 1.0
                WHEN 'yellow' THEN 0.5
                WHEN 'red' THEN 0.0
                ELSE NULL
              END
            )::float AS rq_avg
     FROM rituals r
     LEFT JOIN venues v ON v.id = r.venue_id
     LEFT JOIN feedback f ON f.ritual_id = r.id AND f.feedback_type IN ('p2r','rq')
     WHERE (r.brand_id = $1 OR v.brand_id = $1)
       AND r.start_time >= NOW() - INTERVAL '90 days'
     GROUP BY COALESCE(NULLIF(TRIM(r.type), ''), 'diger')
     ORDER BY n DESC
     LIMIT 12`,
    [brandId]
  ).catch(() => ({ rows: [] }));

  const lived = [];
  for (const v of venues.rows) {
    const ta = await computeVenueTrustAura(v.id, { audience: 'public' });
    lived.push({
      venue_id: v.id,
      name: v.name,
      city: v.city,
      trust_score: ta?.trust_display?.score ?? null,
      aura_score: ta?.aura_display?.score ?? null,
      // her mekan kendi skoruna linkli — ortalama YOK
    });
  }

  // custom location = brand'in kendi binası; çoklu-masa = event_group_id (mevcut)
  const customLocations = await pool.query(
    `SELECT r.id, r.title, r.location_name, r.start_time, r.event_group_id
     FROM rituals r
     WHERE r.brand_id = $1
       AND LOWER(COALESCE(r.location_type::text, '')) = 'custom'
     ORDER BY r.start_time DESC
     LIMIT 20`,
    [brandId]
  ).catch(() => ({ rows: [] }));

  const seriesStrip = await pool.query(
    `SELECT DISTINCT ON (r.series_id)
       r.series_id, rs.name AS series_name, r.id AS ritual_id, r.title, r.series_week, r.start_time
     FROM rituals r
     LEFT JOIN ritual_series rs ON rs.id = r.series_id
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE (r.brand_id = $1 OR v.brand_id = $1)
       AND r.series_id IS NOT NULL
     ORDER BY r.series_id, r.start_time DESC
     LIMIT 12`,
    [brandId]
  ).catch(() => ({ rows: [] }));

  const archive = await pool.query(
    `SELECT m.id, COALESCE(m.content, m.text, m.title, 'Memory') AS label, m.created_at
     FROM memories m
     JOIN rituals r ON r.id = m.ritual_id
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE (r.brand_id = $1 OR v.brand_id = $1)
       AND (m.privacy::text = 'public' OR m.privacy_mode = 'public')
     ORDER BY m.created_at DESC
     LIMIT 20`,
    [brandId]
  ).catch(() => ({ rows: [] }));

  let affiliated_hosts = [];
  try {
    const { listAffiliatedHosts } = await import('./affiliationService.js');
    const ah = await listAffiliatedHosts('brand', brandId);
    affiliated_hosts = ah.hosts || [];
  } catch (_e) {
    affiliated_hosts = [];
  }

  return {
    ok: true,
    brand: {
      id: brand.rows[0].id,
      name: brand.rows[0].name,
      logo_url: brand.rows[0].logo_url || null,
      category: brand.rows[0].category || null,
      one_liner: brand.rows[0].one_liner || null,
      slug: brand.rows[0].slug || null,
      created_at: brand.rows[0].created_at,
      trust: null, // TRUST YOK
      slots: null, // slot YOK
      feed: null, // feed YOK
      aura: {
        score:
          auraR.rows[0]?.aura != null
            ? Math.round(Number(auraR.rows[0].aura) * 100) / 100
            : null,
        n: Number(auraR.rows[0]?.n) || 0,
      },
      distribution: {
        categories: distR.rows.map((row) => ({
          category: row.category,
          n: row.n,
          rq_avg: row.rq_avg != null ? Math.round(Number(row.rq_avg) * 100) / 100 : null,
        })),
        window_days: 90,
      },
      lived_venues: lived,
      average_forbidden: true,
      series_strip: seriesStrip.rows,
      custom_locations: customLocations.rows,
      archive: archive.rows,
      archive_hideable: false,
      affiliated_hosts,
    },
  };
}
