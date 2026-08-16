/**
 * Search & discovery — LOCAL v2 §12
 * Tabs · 2-layer ranking · category formula · people graph order
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { blockedPeerIds } from './blockVisibility.js';
import { ritualDiscoveryAudienceSql } from './ritualState.js';
import { feeDtoFromRow } from './ritualCreateValidation.js';
import { resolveActiveCityId } from './cityScope.js';

export const SEARCH_TABS = [
  'all',
  'rituals',
  'series',
  'slots',
  'venues',
  'zones',
  'people',
  'memories',
  'forum',
  'category',
  'location',
  'brands',
];

/** Keşif/slot/şehir-akışı — active_city. Forum-arşiv + kişiler + brand city YOK. */
export const CITY_SCOPED_TABS = [
  'rituals',
  'series',
  'slots',
  'venues',
  'zones',
  'memories',
  'category',
  'location',
];

const WEIGHTS = LOCAL_CONFIG.search?.RANKING_WEIGHTS || { objective: 0.55, personal: 0.45 };
const TENTATIVE_MIN = Number(LOCAL_CONFIG.venue?.KATEGORI_TENTATIVE) || 3;

function like(q) {
  return `%${String(q || '').trim()}%`;
}

/** Append active_city predicate; mutates params. Empty sql when no city. */
export function appendCitySql(params, cityId, expr) {
  if (!cityId) return '';
  params.push(cityId);
  return ` AND ${expr} = $${params.length}`;
}

function combineScore(objective, personal) {
  const o = Number(objective) || 0;
  const p = Number(personal) || 0;
  return WEIGHTS.objective * o + WEIGHTS.personal * p;
}

async function personalBoost(viewerId, { hostId = null, venueId = null, ritualType = null } = {}) {
  if (!viewerId) return 0;
  let boost = 0;
  try {
    if (hostId) {
      const fr = await pool.query(
        `SELECT
           CASE
             WHEN EXISTS (
               SELECT 1 FROM friendships f
               WHERE f.status = 'accepted'
                 AND ((f.requester_id = $1 AND f.receiver_id = $2) OR (f.receiver_id = $1 AND f.requester_id = $2))
             ) THEN 1.0
             WHEN EXISTS (
               SELECT 1 FROM follows uf
               WHERE uf.follower_id = $1 AND uf.following_id = $2
             ) THEN 0.7
             WHEN EXISTS (
               SELECT 1 FROM friendships f
               WHERE f.status = 'accepted'
                 AND f.friendship_level::text IN ('l1','l2','l3')
                 AND ((f.requester_id = $1 AND f.receiver_id = $2) OR (f.receiver_id = $1 AND f.requester_id = $2))
             ) THEN 0.85
             ELSE 0.2
           END AS b`,
        [viewerId, hostId]
      );
      boost = Math.max(boost, Number(fr.rows[0]?.b) || 0);
    }
    if (venueId) {
      const vf = await pool.query(
        `SELECT 1 FROM venue_follows WHERE user_id = $1 AND venue_id = $2 LIMIT 1`,
        [viewerId, venueId]
      ).catch(() => ({ rows: [] }));
      if (vf.rows.length) boost = Math.max(boost, 0.6);
    }
    if (ritualType) {
      const interest = await pool.query(
        `SELECT 1 FROM user_interests
         WHERE user_id = $1 AND LOWER(category) = LOWER($2) LIMIT 1`,
        [viewerId, ritualType]
      ).catch(() => ({ rows: [] }));
      if (interest.rows.length) boost = Math.max(boost, 0.5);
    }
  } catch (_e) {
    /* ignore */
  }
  return boost;
}

async function searchRituals(q, viewerId, limit, cityId = null) {
  const audienceClause = ritualDiscoveryAudienceSql(viewerId ? '$2' : null, 'r');
  const params = viewerId ? [like(q), viewerId] : [like(q)];
  const citySql = appendCitySql(params, cityId, 'r.city_id');
  const r = await pool.query(
    `SELECT r.id, r.title, r.type, r.status, r.start_time, r.capacity, r.host_id, r.venue_id,
            r.entry_type, r.location_name, r.fee_amount, r.fee_currency, r.fee_note, r.audience,
            (SELECT COUNT(*)::int FROM ritual_attendance ra
             WHERE ra.ritual_id = r.id AND ra.status::text NOT IN ('no_show','cancelled')) AS joined
     FROM rituals r
     WHERE r.suspended_at IS NULL
       AND (r.title ILIKE $1 OR COALESCE(r.type,'') ILIKE $1 OR COALESCE(r.location_name,'') ILIKE $1)
       AND r.status::text IN ('prelobby','live','active','scheduled','published','window')
       AND ${audienceClause}
       ${citySql}
     ORDER BY r.start_time ASC
     LIMIT 80`,
    params
  );

  const scored = [];
  for (const row of r.rows) {
    const seats = Math.max(0, (Number(row.capacity) || 0) - (Number(row.joined) || 0));
    const joinable =
      seats > 0 &&
      String(row.entry_type || 'open').toLowerCase() !== 'invite_only';
    const objective = (joinable ? 0.7 : 0.2) + Math.min(0.3, seats / 20);
    const personal = await personalBoost(viewerId, {
      hostId: row.host_id,
      venueId: row.venue_id,
      ritualType: row.type,
    });
    const fee = feeDtoFromRow(row);
    scored.push({
      kind: 'rituals',
      id: row.id,
      label: row.title,
      meta: {
        type: row.type,
        seats_left: seats,
        joinable,
        entry_type: row.entry_type,
        start_time: row.start_time,
        fee,
        has_fee: fee != null,
        audience: String(row.audience || 'PUBLIC').toUpperCase(),
      },
      score: combineScore(objective, personal),
      objective,
      personal,
      joinable,
      happened_at: row.start_time,
    });
  }
  // girebileceğin önce
  scored.sort((a, b) => {
    if (a.joinable !== b.joinable) return a.joinable ? -1 : 1;
    return b.score - a.score;
  });
  return scored.slice(0, limit);
}

/** v2 §7 SERIES — aktif seriler; hafta sayaci ile */
async function searchSeries(q, viewerId, limit, cityId = null) {
  const params = [like(q)];
  const citySql = cityId
    ? (() => {
        params.push(cityId);
        return ` AND EXISTS (
          SELECT 1 FROM rituals r
          WHERE r.series_id = s.id AND r.city_id = $${params.length}
        )`;
      })()
    : '';
  const r = await pool.query(
    `SELECT s.id, s.name, s.week_count, s.active, s.host_id, s.recurrence_rule, s.created_at,
            (SELECT COUNT(*)::int FROM ritual_series_followers f WHERE f.series_id = s.id) AS follower_count
     FROM ritual_series s
     WHERE s.name ILIKE $1
       ${citySql}
     ORDER BY s.active DESC, s.week_count DESC
     LIMIT 60`,
    params
  ).catch(() => ({ rows: [] }));

  const out = [];
  for (const row of r.rows) {
    const rule =
      typeof row.recurrence_rule === 'string'
        ? JSON.parse(row.recurrence_rule || '{}')
        : row.recurrence_rule || {};
    const cadence = Number(rule.interval_days) === 14 ? 'BIWEEKLY' : 'WEEKLY';
    const objective = (row.active ? 0.7 : 0.2) + Math.min(0.3, Number(row.week_count || 0) / 20);
    const personal = await personalBoost(viewerId, { hostId: row.host_id });
    out.push({
      kind: 'series',
      id: row.id,
      label: row.name,
      meta: {
        week_count: Number(row.week_count) || 0,
        cadence,
        end_after_weeks: rule.end_after_weeks ?? null,
        open_ended: rule.end_after_weeks == null,
        active: row.active !== false,
        follower_count: Number(row.follower_count) || 0,
      },
      score: combineScore(objective, personal),
      happened_at: row.created_at,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Forum yorumlari — yalniz acik forum + public Ritual yuzeyleri */
async function searchForum(q, limit) {
  const r = await pool.query(
    `SELECT c.id, c.ritual_id, c.content, c.created_at, r.title AS ritual_title
     FROM forum_comments c
     JOIN rituals r ON r.id = c.ritual_id
     WHERE c.content ILIKE $1
       AND r.suspended_at IS NULL
       AND COALESCE(r.window_type::text, '') = 'open_forum'
       AND COALESCE(r.visibility::text, 'public') = 'public'
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [like(q), limit]
  ).catch(() => ({ rows: [] }));

  return r.rows.map((row) => ({
    kind: 'forum',
    id: row.id,
    label: String(row.content || '').slice(0, 120),
    meta: { ritual_id: row.ritual_id, ritual_title: row.ritual_title },
    score: 0.35,
    happened_at: row.created_at,
  }));
}

async function searchSlots(q, limit, cityId = null) {
  const params = [like(q), limit];
  const citySql = cityId
    ? (() => {
        params.push(cityId);
        return ` AND v.city_id = $${params.length}`;
      })()
    : '';
  const r = await pool.query(
    `SELECT vs.id, COALESCE(vs.title, vs.audience_tag, 'Slot') AS label, vs.created_at, vs.venue_id, vs.status
     FROM venue_slots vs
     JOIN venues v ON v.id = vs.venue_id
     WHERE COALESCE(vs.title, vs.audience_tag, '') ILIKE $1
       AND COALESCE(vs.status, 'open') IN ('open', 'claimed', 'live')
       ${citySql}
     ORDER BY vs.created_at DESC
     LIMIT $2`,
    params
  ).catch(() => ({ rows: [] }));
  return r.rows.map((row) => ({
    kind: 'slots',
    id: row.id,
    label: row.label,
    meta: { venue_id: row.venue_id, status: row.status },
    score: 0.5,
    happened_at: row.created_at,
  }));
}

async function searchVenues(q, viewerId, limit, cityId = null) {
  const params = [like(q)];
  const citySql = appendCitySql(params, cityId, 'v.city_id');
  const r = await pool.query(
    `SELECT v.id, v.name, v.city, v.venue_rs, v.is_verified, v.chain_id, v.brand_id
     FROM venues v
     WHERE (v.name ILIKE $1 OR COALESCE(v.city,'') ILIKE $1)
       ${citySql}
     ORDER BY v.name ASC
     LIMIT 60`,
    params
  ).catch(() => ({ rows: [] }));

  const out = [];
  for (const row of r.rows) {
    const personal = await personalBoost(viewerId, { venueId: row.id });
    const objective = (row.is_verified ? 0.6 : 0.35) + Math.min(0.4, (Number(row.venue_rs) || 5) / 25);
    out.push({
      kind: 'venues',
      id: row.id,
      label: row.name,
      meta: {
        city: row.city,
        verified: row.is_verified,
        chain_id: row.chain_id || null,
        brand_id: row.brand_id || null,
      },
      score: combineScore(objective, personal),
      happened_at: null,
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

async function searchZones(q, limit, cityId = null) {
  const params = [like(q), limit];
  const citySql = cityId
    ? (() => {
        params.push(cityId);
        return ` AND city_id = $${params.length}`;
      })()
    : '';
  const r = await pool.query(
    `SELECT id, name, marker_type, created_at FROM zones
     WHERE name ILIKE $1
       ${citySql}
     ORDER BY name ASC LIMIT $2`,
    params
  ).catch(() => ({ rows: [] }));
  return r.rows.map((row) => ({
    kind: 'zones',
    id: row.id,
    label: row.name,
    meta: { marker_type: row.marker_type },
    score: 0.4,
    happened_at: row.created_at,
  }));
}

/** friends → followers → FL-ağı → herkes */
async function searchPeople(q, viewerId, limit) {
  const r = await pool.query(
    `SELECT id, name, avatar_url, created_at FROM users WHERE name ILIKE $1 LIMIT 80`,
    [like(q)]
  );
  const blocked = viewerId ? await blockedPeerIds(viewerId) : new Set();
  if (!viewerId) {
    return r.rows.slice(0, limit).map((row) => ({
      kind: 'people',
      id: row.id,
      label: row.name,
      meta: { avatar_url: row.avatar_url, tier: 'everyone' },
      score: 0.2,
      happened_at: row.created_at,
    }));
  }

  const scored = [];
  for (const row of r.rows) {
    if (String(row.id) === String(viewerId)) continue;
    if (blocked.has(String(row.id))) continue;
    let tier = 'everyone';
    let objective = 0.15;
    const friend = await pool.query(
      `SELECT friendship_level::text AS fl FROM friendships
       WHERE status = 'accepted'
         AND ((requester_id = $1 AND receiver_id = $2) OR (receiver_id = $1 AND requester_id = $2))
       LIMIT 1`,
      [viewerId, row.id]
    );
    if (friend.rows[0]) {
      tier = 'friends';
      objective = 1.0;
    } else {
      const follow = await pool.query(
        `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
        [viewerId, row.id]
      ).catch(() => ({ rows: [] }));
      if (follow.rows.length) {
        tier = 'followers';
        objective = 0.75;
      } else {
        const flNet = await pool.query(
          `SELECT 1 FROM friendships f1
           JOIN friendships f2 ON f2.status = 'accepted'
             AND f2.friendship_level::text IN ('l1','l2','l3')
             AND (
               (f2.requester_id = $2 AND f2.receiver_id IN (f1.requester_id, f1.receiver_id))
               OR (f2.receiver_id = $2 AND f2.requester_id IN (f1.requester_id, f1.receiver_id))
             )
           WHERE f1.status = 'accepted'
             AND f1.friendship_level::text IN ('l1','l2','l3')
             AND ((f1.requester_id = $1 AND f1.receiver_id != $2) OR (f1.receiver_id = $1 AND f1.requester_id != $2))
           LIMIT 1`,
          [viewerId, row.id]
        ).catch(() => ({ rows: [] }));
        if (flNet.rows.length) {
          tier = 'fl_network';
          objective = 0.55;
        }
      }
    }
    scored.push({
      kind: 'people',
      id: row.id,
      label: row.name,
      meta: { avatar_url: row.avatar_url, tier },
      score: objective,
      happened_at: row.created_at,
      _tierRank: { friends: 0, followers: 1, fl_network: 2, everyone: 3 }[tier],
    });
  }
  scored.sort((a, b) => a._tierRank - b._tierRank || b.score - a.score);
  return scored.slice(0, limit).map(({ _tierRank, ...rest }) => rest);
}

/** canlı 24h + kalıcı arşiv — keşif active_city (forum-arşiv route'u ayrı, city YOK) */
async function searchMemories(q, limit, cityId = null) {
  const params = [like(q), Math.ceil(limit / 2)];
  const citySql = cityId
    ? (() => {
        params.push(cityId);
        return ` AND COALESCE(m.city_id, r.city_id) = $${params.length}`;
      })()
    : '';
  const live = await pool.query(
    `SELECT m.id, COALESCE(m.content, m.text, m.title, 'Memory') AS label, m.created_at, 'live_24h' AS lane
     FROM memories m
     LEFT JOIN rituals r ON r.id = m.ritual_id
     WHERE COALESCE(m.content, m.text, m.title, '') ILIKE $1
       AND m.created_at >= NOW() - INTERVAL '24 hours'
       AND (m.privacy::text = 'public' OR m.privacy_mode = 'public' OR m.destination::text LIKE '%pulse%')
       AND COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
       ${citySql}
     ORDER BY m.created_at DESC
     LIMIT $2`,
    params
  ).catch(() => ({ rows: [] }));

  const archiveParams = [...params];
  const archive = await pool.query(
    `SELECT m.id, COALESCE(m.content, m.text, m.title, 'Memory') AS label, m.created_at, 'archive' AS lane
     FROM memories m
     LEFT JOIN rituals r ON r.id = m.ritual_id
     WHERE COALESCE(m.content, m.text, m.title, '') ILIKE $1
       AND m.created_at < NOW() - INTERVAL '24 hours'
       AND (m.privacy::text = 'public' OR m.privacy_mode = 'public' OR m.destination::text LIKE '%pulse%')
       AND COALESCE(m.csam_scan_status, 'clear') IN ('clear', 'provider_scanned', 'window_pass')
       ${citySql}
     ORDER BY m.created_at DESC
     LIMIT $2`,
    archiveParams
  ).catch(() => ({ rows: [] }));

  return [...live.rows, ...archive.rows].map((row) => ({
    kind: 'memories',
    id: row.id,
    label: String(row.label || '').slice(0, 120),
    meta: { lane: row.lane },
    score: row.lane === 'live_24h' ? 0.8 : 0.4,
    happened_at: row.created_at,
  }));
}

/**
 * skor = kategori_payı × kategori_RQ_ort × conf(instance)
 * conf: <3 instance tentative → sıralamada öne GEÇEMEZ
 */
export async function searchByCategory(q, limit = 20, cityId = null) {
  const params = [like(q)];
  const citySql = appendCitySql(params, cityId, 'r.city_id');
  const r = await pool.query(
    `SELECT
       COALESCE(NULLIF(TRIM(r.type), ''), 'diger') AS category,
       COUNT(*)::int AS instance_count,
       AVG(
         CASE LOWER(COALESCE(f.p2r_feeling, f.p2v_feeling, ''))
           WHEN 'green' THEN 1.0
           WHEN 'yellow' THEN 0.5
           WHEN 'red' THEN 0.0
           ELSE NULL
         END
       )::float AS rq_avg
     FROM rituals r
     LEFT JOIN feedback f ON f.ritual_id = r.id AND f.feedback_type IN ('p2r','rq')
     WHERE COALESCE(r.type, '') ILIKE $1
       AND r.suspended_at IS NULL
       AND r.start_time >= NOW() - INTERVAL '90 days'
       ${citySql}
     GROUP BY COALESCE(NULLIF(TRIM(r.type), ''), 'diger')
     HAVING COUNT(*) > 0
     ORDER BY COUNT(*) DESC
     LIMIT 40`,
    params
  ).catch(() => ({ rows: [] }));

  const total = r.rows.reduce((a, row) => a + Number(row.instance_count || 0), 0) || 1;
  const mapped = r.rows.map((row) => {
    const instances = Number(row.instance_count) || 0;
    const share = instances / total;
    const rq = Number(row.rq_avg) || 0.5;
    const tentative = instances < TENTATIVE_MIN;
    const conf = tentative ? 0.35 : 1.0;
    const raw = share * rq * conf;
    return {
      kind: 'category',
      id: row.category,
      label: row.category,
      meta: {
        instance_count: instances,
        rq_avg: rq != null ? Math.round(rq * 100) / 100 : null,
        share: Math.round(share * 1000) / 1000,
        tentative,
        conf,
      },
      score: raw,
      // tentative cannot lead ranking — demote sort key
      _rank: tentative ? raw * 0.01 : raw,
    };
  });
  mapped.sort((a, b) => b._rank - a._rank);
  return mapped.slice(0, limit).map(({ _rank, ...rest }) => rest);
}

/** Brand filtresi + kart — imza keşif sıralamasını ETKİLEMEZ */
async function searchBrands(q, limit) {
  const r = await pool.query(
    `SELECT id, name, slug, logo_url, category, one_liner, created_at
     FROM brands
     WHERE name ILIKE $1
        OR COALESCE(category,'') ILIKE $1
        OR COALESCE(one_liner,'') ILIKE $1
        OR COALESCE(slug,'') ILIKE $1
     ORDER BY name ASC
     LIMIT $2`,
    [like(q), limit]
  ).catch(() => ({ rows: [] }));
  return r.rows.map((row) => ({
    kind: 'brands',
    id: row.id,
    label: row.name,
    meta: {
      slug: row.slug,
      logo_url: row.logo_url,
      category: row.category,
      one_liner: row.one_liner,
      /** signature never boosts objective score */
      signature_rank_neutral: true,
    },
    // flat score — brand imza ranking'i etkilemez
    score: 0.45,
    objective: 0.45,
    personal: 0,
    happened_at: row.created_at,
  }));
}

async function searchLocation(q, limit, cityId = null) {
  const venueParams = [like(q), limit];
  const venueCity = cityId
    ? (() => {
        venueParams.push(cityId);
        return ` AND city_id = $${venueParams.length}`;
      })()
    : '';
  const venues = await pool.query(
    `SELECT id, name, city, address FROM venues
     WHERE (COALESCE(city,'') ILIKE $1 OR COALESCE(address,'') ILIKE $1 OR name ILIKE $1)
       ${venueCity}
     LIMIT $2`,
    venueParams
  ).catch(() => ({ rows: [] }));
  const zoneParams = [like(q), Math.min(10, limit)];
  const zoneCity = cityId
    ? (() => {
        zoneParams.push(cityId);
        return ` AND city_id = $${zoneParams.length}`;
      })()
    : '';
  const zones = await pool.query(
    `SELECT id, name, marker_type FROM zones WHERE name ILIKE $1 ${zoneCity} LIMIT $2`,
    zoneParams
  ).catch(() => ({ rows: [] }));

  return [
    ...venues.rows.map((row) => ({
      kind: 'location',
      id: `venue:${row.id}`,
      label: row.name,
      meta: { subtype: 'venue', city: row.city, venue_id: row.id },
      score: 0.6,
    })),
    ...zones.rows.map((row) => ({
      kind: 'location',
      id: `zone:${row.id}`,
      label: row.name,
      meta: { subtype: 'zone', marker_type: row.marker_type, zone_id: row.id },
      score: 0.5,
    })),
  ].slice(0, limit);
}

export async function search({ query, tab = 'all', limit = 20, viewerId = null, cityId = null } = {}) {
  const selected = SEARCH_TABS.includes(tab) ? tab : 'all';
  const lim = Math.min(50, Math.max(1, Number(limit) || 20));
  if (!String(query || '').trim()) {
    return { tab: selected, results: [], tabs: SEARCH_TABS, ranking_weights: WEIGHTS };
  }

  let scopedCity = cityId || null;
  if (!scopedCity && viewerId) {
    try {
      scopedCity = await resolveActiveCityId(viewerId);
    } catch (_e) {
      scopedCity = null;
    }
  }

  const runners = {
    rituals: () => searchRituals(query, viewerId, lim, scopedCity),
    series: () => searchSeries(query, viewerId, lim, scopedCity),
    forum: () => searchForum(query, lim),
    slots: () => searchSlots(query, lim, scopedCity),
    venues: () => searchVenues(query, viewerId, lim, scopedCity),
    zones: () => searchZones(query, lim, scopedCity),
    people: () => searchPeople(query, viewerId, lim),
    memories: () => searchMemories(query, lim, scopedCity),
    category: () => searchByCategory(query, lim, scopedCity),
    location: () => searchLocation(query, lim, scopedCity),
    brands: () => searchBrands(query, lim),
  };

  if (selected !== 'all') {
    const results = await runners[selected]();
    return { tab: selected, results, tabs: SEARCH_TABS, ranking_weights: WEIGHTS, scoped_city_id: scopedCity };
  }

  const per = Math.max(3, Math.ceil(lim / 6));
  const chunks = await Promise.all([
    runners.rituals().then((x) => x.slice(0, per)),
    runners.venues().then((x) => x.slice(0, per)),
    runners.people().then((x) => x.slice(0, per)),
    runners.memories().then((x) => x.slice(0, per)),
    runners.series().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.forum().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.slots().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.zones().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.category().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.location().then((x) => x.slice(0, Math.ceil(per / 2))),
    runners.brands().then((x) => x.slice(0, Math.ceil(per / 2))),
  ]);
  const merged = chunks.flat().sort((a, b) => (b.score || 0) - (a.score || 0));
  return {
    tab: 'all',
    results: merged.slice(0, lim),
    tabs: SEARCH_TABS,
    ranking_weights: WEIGHTS,
    brand_signature_affects_ranking: Boolean(
      LOCAL_CONFIG.search?.BRAND_SIGNATURE_AFFECTS_RANKING
    ),
    scoped_city_id: scopedCity,
  };
}
