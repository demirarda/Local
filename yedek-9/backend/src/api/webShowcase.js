/**
 * WEB-VİTRİN — LOCAL v2 §12 · /w/*
 * Salt-okunur · WEB_SHOWCASE_ENABLED ile kapılı.
 * Kişi profili YOK · etkileşim YOK · tek CTA app-store.
 */
import express from 'express';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { displayWebAuthorName } from '../services/brandService.js';
import { getBrandProfile } from '../services/discoveryProfileService.js';
import { getZoneProfile } from '../services/zoneService.js';
import { buildOgCard } from '../services/ogCardService.js';

const router = express.Router();

function showcaseEnabled() {
  return Boolean(LOCAL_CONFIG.stubs?.WEB_SHOWCASE_ENABLED);
}

function ctaLinks() {
  return {
    app_store: LOCAL_CONFIG.stubs?.WEB_SHOWCASE_APP_STORE_URL || null,
    play_store: LOCAL_CONFIG.stubs?.WEB_SHOWCASE_PLAY_STORE_URL || null,
  };
}

function gate(res) {
  if (!showcaseEnabled()) {
    res.status(503).json({
      success: false,
      error: 'WEB_SHOWCASE_ENABLED:false — vitrin kapalı (stub inşa edildi)',
      code: 'WEB_SHOWCASE_OFF',
      cta: ctaLinks(),
    });
    return false;
  }
  return true;
}

/** SSR/OG mutlak URL tabanı — reverse proxy arkasında env ile ezilir */
export function showcaseBaseUrl() {
  const raw = process.env.WEB_SHOWCASE_BASE_URL || 'https://local.app';
  return String(raw).replace(/\/+$/, '');
}

function absoluteUrl(path) {
  if (!path) return showcaseBaseUrl();
  if (/^https?:\/\//i.test(path)) return path;
  return `${showcaseBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * SSR head payload — her /w/* cevabı bunu taşır (crawler + OG kart).
 */
export function seoMeta({
  title,
  description,
  ogImage = null,
  url = null,
  stamp = null,
  signature = null,
  type = 'website',
} = {}) {
  const resolvedTitle = title || 'LOCAL';
  const resolvedDescription = description || 'LOCAL — şehir ritüelleri';
  const canonical = absoluteUrl(url);
  const og = buildOgCard({
    title: resolvedTitle,
    description: resolvedDescription,
    imageUrl: ogImage ? absoluteUrl(ogImage) : null,
    url: canonical,
    stamp,
    signature,
    type,
  });
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    canonical,
    /** Salt-okunur vitrin: indekslenir, ama app derin-linkleri takip edilmez */
    robots: 'index, follow',
    lang: 'tr',
    og,
  };
}

/** Vitrin kökü — crawler girişi + CTA */
router.get('/', (_req, res) => {
  if (!gate(res)) return;
  return res.json({
    success: true,
    data: {
      sections: ['pulse', 'venue', 'zone', 'brand', 'ritual', 'forum'],
      cta: ctaLinks(),
      seo: seoMeta({
        title: 'LOCAL — şehrin ritüelleri',
        description: 'Local World akışı, mekanlar ve bölgeler. Söz söylemek için uygulamayı indir.',
        url: '/w',
      }),
    },
  });
});

/** No person profile routes by design — 404 */
router.get('/user/:id', (_req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Kişi profili web-vitrinde yok',
    cta: ctaLinks(),
  });
});

router.get('/people/:id', (_req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Kişi profili web-vitrinde yok',
    cta: ctaLinks(),
  });
});

/** Reject all write methods on showcase */
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: 'Web-vitrin salt-okunur — etkileşim yok',
      cta: ctaLinks(),
    });
  }
  return next();
});

router.get('/pulse', async (_req, res) => {
  if (!gate(res)) return;
  try {
    const r = await pool.query(
      `SELECT m.id, COALESCE(m.content, m.text, m.title, 'Memory') AS label,
              m.created_at, m.media_url,
              u.web_named, u.name AS user_name, u.city AS user_city
       FROM memories m
       JOIN users u ON u.id = m.user_id
       WHERE (
         COALESCE(m.scope::text, '') ILIKE '%all%'
         OR COALESCE(m.destination::text, '') ILIKE '%local_world%'
         OR COALESCE(m.destination::text, '') ILIKE '%ALL%'
       )
       AND COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
       ORDER BY m.created_at DESC
       LIMIT 40`
    ).catch(() => ({ rows: [] }));

    const items = r.rows.map((row) => ({
      id: row.id,
      label: row.label,
      created_at: row.created_at,
      media_url: row.media_url || null,
      author: displayWebAuthorName({
        webNamed: row.web_named,
        name: row.user_name,
        city: row.user_city,
      }),
    }));

    return res.json({
      success: true,
      data: {
        items,
        cta: ctaLinks(),
        seo: seoMeta({
          title: 'LOCAL Pulse',
          description: `Local World taze akış · ${items.length} an`,
          ogImage: items.find((it) => it.media_url)?.media_url || null,
          url: '/w/pulse',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/venue/:slug', async (req, res) => {
  if (!gate(res)) return;
  try {
    const slug = req.params.slug;
    const v = await pool.query(
      `SELECT id, name, city, slug, description, address, logo_url
       FROM venues
       WHERE slug = $1 OR id::text = $1
       LIMIT 1`,
      [slug]
    ).catch(() => ({ rows: [] }));
    if (!v.rows[0]) return res.status(404).json({ success: false, error: 'Venue not found', cta: ctaLinks() });
    const venue = v.rows[0];
    return res.json({
      success: true,
      data: {
        venue: {
          id: venue.id,
          name: venue.name,
          city: venue.city,
          slug: venue.slug,
          description: venue.description,
          address: venue.address,
        },
        participants: undefined, // never
        cta: ctaLinks(),
        seo: seoMeta({
          title: `${venue.name} · LOCAL`,
          description: venue.description || `${venue.name} — ${venue.city || 'LOCAL mekan'}`,
          ogImage: venue.logo_url || null,
          url: `/w/venue/${venue.slug || venue.id}`,
          type: 'place',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Totem hunisi — app'siz okutan kişi buraya düşer (sonMD TOTEM 3-hal ③).
 * App'li kullanıcı `local://portal/...` derin-linkiyle buradasın-moduna gider.
 */
router.get('/t/:venueId/:portalId', async (req, res) => {
  if (!gate(res)) return;
  try {
    const { venueId, portalId } = req.params;
    const v = await pool.query(
      `SELECT v.id, v.name, v.city, v.slug, v.description, v.logo_url,
              p.label AS portal_label
       FROM venues v
       LEFT JOIN venue_portals p ON p.venue_id = v.id AND p.portal_id = $2
       WHERE v.slug = $1 OR v.id::text = $1
       LIMIT 1`,
      [venueId, portalId]
    ).catch(() => ({ rows: [] }));
    if (!v.rows[0]) {
      return res.status(404).json({ success: false, error: 'Totem not found', cta: ctaLinks() });
    }
    const venue = v.rows[0];
    return res.json({
      success: true,
      data: {
        venue: {
          id: venue.id,
          name: venue.name,
          city: venue.city,
          slug: venue.slug,
          description: venue.description,
        },
        portal: { portal_id: portalId, label: venue.portal_label || null },
        app_link: `local://portal/${venue.id}/${encodeURIComponent(portalId)}`,
        cta: ctaLinks(),
        seo: seoMeta({
          title: `${venue.name} · LOCAL`,
          description: venue.portal_label
            ? `${venue.name} · ${venue.portal_label} — buradasın`
            : `${venue.name} — buradasın`,
          ogImage: venue.logo_url || null,
          url: `/w/t/${venue.slug || venue.id}/${encodeURIComponent(portalId)}`,
          type: 'place',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/zone/:slug', async (req, res) => {
  if (!gate(res)) return;
  try {
    const slug = req.params.slug;
    const z = await pool.query(
      `SELECT id, name, slug FROM zones WHERE slug = $1 OR id::text = $1 LIMIT 1`,
      [slug]
    ).catch(() => ({ rows: [] }));
    if (!z.rows[0]) return res.status(404).json({ success: false, error: 'Zone not found', cta: ctaLinks() });
    const profile = await getZoneProfile(z.rows[0].id);
    if (!profile.ok) return res.status(404).json({ success: false, error: profile.error, cta: ctaLinks() });
    // Strip any accidental participant surfaces
    const safe = {
      ...profile.profile,
      live_rituals: (profile.profile.live_rituals || []).map(({ id, title, status, start_time, capacity, joined }) => ({
        id,
        title,
        status,
        start_time,
        capacity,
        joined,
      })),
      trust: null,
    };
    return res.json({
      success: true,
      data: {
        zone: safe,
        cta: ctaLinks(),
        seo: seoMeta({
          title: `${z.rows[0].name} · LOCAL Zone`,
          description:
            safe.description || `${z.rows[0].name} bölgesinde yaşayan LOCAL ritüelleri`,
          url: `/w/zone/${z.rows[0].slug || z.rows[0].id}`,
          type: 'place',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/brand/:slug', async (req, res) => {
  if (!gate(res)) return;
  try {
    const slug = req.params.slug;
    const b = await pool.query(
      `SELECT id FROM brands WHERE slug = $1 OR id::text = $1 LIMIT 1`,
      [slug]
    );
    if (!b.rows[0]) return res.status(404).json({ success: false, error: 'Brand not found', cta: ctaLinks() });
    const result = await getBrandProfile(b.rows[0].id);
    if (!result.ok) return res.status(404).json({ success: false, error: result.error, cta: ctaLinks() });
    return res.json({
      success: true,
      data: {
        brand: result.brand,
        cta: ctaLinks(),
        seo: seoMeta({
          title: `${result.brand.name} · LOCAL Brand`,
          description: result.brand.one_liner || result.brand.name,
          ogImage: result.brand.logo_url || null,
          url: `/w/brand/${result.brand.slug || result.brand.id}`,
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/forum/:id', async (req, res) => {
  if (!gate(res)) return;
  try {
    const r = await pool.query(
      `SELECT fp.id, fp.body, fp.created_at, r.title AS ritual_title,
              u.web_named, u.name AS user_name, u.city AS user_city
       FROM forum_posts fp
       LEFT JOIN rituals r ON r.id = fp.ritual_id
       LEFT JOIN users u ON u.id = fp.user_id
       WHERE fp.id = $1
       LIMIT 1`,
      [req.params.id]
    ).catch(() => ({ rows: [] }));
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Forum post not found', cta: ctaLinks() });
    const row = r.rows[0];
    return res.json({
      success: true,
      data: {
        post: {
          id: row.id,
          body: row.body,
          ritual_title: row.ritual_title,
          created_at: row.created_at,
          author: displayWebAuthorName({
            webNamed: row.web_named,
            name: row.user_name,
            city: row.user_city,
          }),
        },
        cta: ctaLinks(),
        seo: seoMeta({
          title: row.ritual_title ? `${row.ritual_title} · LOCAL Forum` : 'LOCAL Forum',
          description: String(row.body || 'LOCAL forum sözü').slice(0, 200),
          url: `/w/forum/${row.id}`,
          type: 'article',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** Ritual künye — yalnız LW-izli; katılımcı listesi ASLA */
router.get('/ritual/:id', async (req, res) => {
  if (!gate(res)) return;
  try {
    const r = await pool.query(
      `SELECT id, title, type, location_name, start_time, duration, status,
              window_visibility, brand_id, venue_id, zone_id
       FROM rituals
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ success: false, error: 'Ritual not found', cta: ctaLinks() });
    const ritual = r.rows[0];
    // Web: never participants; window content only if TRANSPARENT for city-readable cue
    return res.json({
      success: true,
      data: {
        ritual: {
          id: ritual.id,
          title: ritual.title,
          type: ritual.type,
          location_name: ritual.location_name,
          start_time: ritual.start_time,
          duration: ritual.duration,
          status: ritual.status,
          window_visibility: ritual.window_visibility || 'CLOSED',
          brand_id: ritual.brand_id || null,
        },
        participants: [],
        participant_list_visible: false,
        cta: ctaLinks(),
        seo: seoMeta({
          title: `${ritual.title} · LOCAL`,
          description: [ritual.location_name, ritual.type]
            .filter(Boolean)
            .join(' · ') || 'LOCAL ritüel künyesi',
          url: `/w/ritual/${ritual.id}`,
          type: 'article',
        }),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
