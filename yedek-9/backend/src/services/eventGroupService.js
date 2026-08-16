/**
 * ZONE-EVENT umbrella cards — LOCAL v2 §11
 * rituals.event_group_id → single discovery card ("LOCAL @ Emirgan · 8 Ritual · 22/32")
 * Master §2E: köşe cap 12 · max 8 köşe · ~96 fiili tavan
 */
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';

function eventGroupLimits() {
  const eg = LOCAL_CONFIG.event_group || {};
  const cornerCap = Number(eg.CORNER_CAP) || 12;
  const maxCorners = Number(eg.MAX_CORNERS) || 8;
  const ceiling = Number(eg.EFFECTIVE_CEILING) || cornerCap * maxCorners;
  return { cornerCap, maxCorners, ceiling };
}

export async function createEventGroup({ name, zoneId, capacityTotal, createdBy }) {
  const { cornerCap, maxCorners, ceiling } = eventGroupLimits();
  let cap = capacityTotal == null || capacityTotal === '' ? null : Number(capacityTotal);
  if (cap != null) {
    if (!Number.isFinite(cap) || cap <= 0) {
      return { ok: false, status: 400, error: 'capacity_total must be a positive number' };
    }
    if (cap > ceiling) {
      return {
        ok: false,
        status: 400,
        error: `event_group capacity cannot exceed ${ceiling} (corner ${cornerCap} × max ${maxCorners})`,
        code: 'EVENT_GROUP_CEILING',
      };
    }
  }

  const r = await pool.query(
    `INSERT INTO ritual_event_groups (name, zone_id, capacity_total, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, zoneId || null, cap, createdBy || null]
  );
  return { ok: true, group: r.rows[0], limits: { cornerCap, maxCorners, ceiling } };
}

export async function listEventGroups({ limit = 50 } = {}) {
  const r = await pool.query(
    `SELECT g.*,
            (SELECT COUNT(*)::int FROM rituals r WHERE r.event_group_id = g.id) AS ritual_count
     FROM ritual_event_groups g
     ORDER BY g.created_at DESC
     LIMIT $1`,
    [Math.min(100, Math.max(1, Number(limit) || 50))]
  );
  return { ok: true, groups: r.rows };
}

export async function attachRitualToEventGroup(ritualId, eventGroupId) {
  const { cornerCap, maxCorners, ceiling } = eventGroupLimits();

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS n FROM rituals WHERE event_group_id = $1`,
    [eventGroupId]
  );
  const currentCorners = Number(countRes.rows[0]?.n || 0);
  if (currentCorners >= maxCorners) {
    return {
      ok: false,
      status: 400,
      error: `event_group max corners is ${maxCorners}`,
      code: 'EVENT_GROUP_MAX_CORNERS',
    };
  }

  const ritualRes = await pool.query(
    `SELECT id, capacity FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritual = ritualRes.rows[0];
  if (!ritual) return { ok: false, status: 404, error: 'Ritual not found' };

  const capacity = Number(ritual.capacity) || 0;
  if (capacity > cornerCap) {
    return {
      ok: false,
      status: 400,
      error: `event_group corner capacity cannot exceed ${cornerCap}`,
      code: 'EVENT_GROUP_CORNER_CAP',
    };
  }

  const sumRes = await pool.query(
    `SELECT COALESCE(SUM(capacity), 0)::int AS total
     FROM rituals WHERE event_group_id = $1`,
    [eventGroupId]
  );
  const projected = Number(sumRes.rows[0]?.total || 0) + capacity;
  if (projected > ceiling) {
    return {
      ok: false,
      status: 400,
      error: `event_group effective ceiling is ${ceiling}`,
      code: 'EVENT_GROUP_CEILING',
    };
  }

  const r = await pool.query(
    `UPDATE rituals SET event_group_id = $2 WHERE id = $1 RETURNING id, event_group_id, title, capacity`,
    [ritualId, eventGroupId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  return { ok: true, ritual: r.rows[0] };
}

export async function detachRitualFromEventGroup(ritualId) {
  const r = await pool.query(
    `UPDATE rituals SET event_group_id = NULL WHERE id = $1 RETURNING id, event_group_id`,
    [ritualId]
  );
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  return { ok: true, ritual: r.rows[0] };
}

/** Pure helper — used by getEventGroupUmbrella + unit tests (no DB). */
export function buildUmbrellaPayload(group, tables = []) {
  const rows = Array.isArray(tables) ? tables : [];
  const capacitySum = rows.reduce((a, t) => a + (Number(t.capacity) || 0), 0);
  const joinedSum = rows.reduce(
    (a, t) => a + (Number(t.joined ?? t.current_attendees ?? t.attendance_count) || 0),
    0
  );
  const enriched = rows.map((t) => {
    const joined = Number(t.joined ?? t.current_attendees ?? t.attendance_count) || 0;
    const capacity = Number(t.capacity) || 0;
    const seatsLeft = Math.max(0, capacity - joined);
    const isFull = capacity > 0 && seatsLeft <= 0;
    const others = rows
      .filter((o) => String(o.id) !== String(t.id))
      .map((o) => {
        const oJoined = Number(o.joined ?? o.current_attendees ?? o.attendance_count) || 0;
        const oCapacity = Number(o.capacity) || 0;
        return {
          id: o.id,
          title: o.title,
          joined: oJoined,
          capacity: oCapacity,
          seats_left: Math.max(0, oCapacity - oJoined),
        };
      })
      .filter((o) => o.seats_left > 0);
    return {
      ...t,
      joined,
      capacity,
      seats_left: seatsLeft,
      is_full: isFull,
      // Full table → suggest sibling tables with seats (Emirgan drop-in model)
      suggest_other_tables: isFull ? others : [],
    };
  });
  const anyFull = enriched.some((t) => t.is_full);
  const { cornerCap, maxCorners, ceiling } = eventGroupLimits();

  return {
    id: group.id,
    name: group.name,
    zone_id: group.zone_id || null,
    card_type: 'event_group',
    time_state: 'live_now',
    label: `${group.name} · ${enriched.length} Ritual · ${joinedSum}/${capacitySum || group.capacity_total || 0}`,
    table_count: enriched.length,
    joined: joinedSum,
    capacity: capacitySum || group.capacity_total,
    seats_left: Math.max(0, (capacitySum || Number(group.capacity_total) || 0) - joinedSum),
    tables: enriched,
    suggest_other_tables: anyFull,
    limits: { corner_cap: cornerCap, max_corners: maxCorners, effective_ceiling: ceiling },
  };
}

export async function getEventGroupUmbrella(eventGroupId) {
  const g = await pool.query(`SELECT * FROM ritual_event_groups WHERE id = $1`, [eventGroupId]);
  if (!g.rows[0]) return { ok: false, status: 404, error: 'Event group not found' };

  const tables = await pool.query(
    `SELECT id, title, capacity, status, start_time,
            (SELECT COUNT(*)::int FROM ritual_attendance ra
              WHERE ra.ritual_id = rituals.id AND ra.status != 'no_show') AS joined
     FROM rituals
     WHERE event_group_id = $1
     ORDER BY start_time ASC NULLS LAST, created_at ASC`,
    [eventGroupId]
  );

  return { ok: true, umbrella: buildUmbrellaPayload(g.rows[0], tables.rows) };
}

export async function listLiveEventGroupUmbrellas() {
  const groups = await pool.query(
    `SELECT g.*
     FROM ritual_event_groups g
     WHERE EXISTS (
       SELECT 1 FROM rituals r
       WHERE r.event_group_id = g.id
         AND r.status::text IN ('prelobby', 'active', 'live', 'window')
     )
     ORDER BY g.created_at DESC
     LIMIT 50`
  );
  const out = [];
  for (const group of groups.rows) {
    const um = await getEventGroupUmbrella(group.id);
    if (um.ok) out.push(um.umbrella);
  }
  return { ok: true, umbrellas: out };
}

/**
 * Collapse rituals sharing event_group_id into one umbrella card for discovery.
 * @param {object[]} rituals
 * @param {{ resolveUmbrella?: (gid: string) => Promise<{ok:boolean, umbrella?: object}|object|null> }} [opts]
 *        resolveUmbrella — inject for unit tests (no DB); default loads via getEventGroupUmbrella
 */
export async function foldRitualsWithUmbrellas(rituals = [], opts = {}) {
  const list = Array.isArray(rituals) ? rituals : [];
  const groupIds = [
    ...new Set(list.map((r) => r.event_group_id).filter(Boolean).map(String)),
  ];
  if (groupIds.length === 0) return list;

  const resolve =
    typeof opts.resolveUmbrella === 'function'
      ? opts.resolveUmbrella
      : async (gid) => getEventGroupUmbrella(gid);

  const umbrellaCache = new Map();
  for (const gid of groupIds) {
    try {
      const u = await resolve(gid);
      const umbrella = u?.umbrella || (u?.card_type === 'event_group' ? u : null);
      if (u?.ok === false) continue;
      if (umbrella) umbrellaCache.set(gid, umbrella);
    } catch (_e) {
      // leave members as individual rituals if umbrella resolve fails
    }
  }

  const seen = new Set();
  const folded = [];
  for (const ritual of list) {
    const gid = ritual.event_group_id ? String(ritual.event_group_id) : null;
    if (!gid || !umbrellaCache.has(gid)) {
      folded.push(ritual);
      continue;
    }
    if (seen.has(gid)) continue;
    seen.add(gid);
    folded.push(umbrellaCache.get(gid));
  }
  return folded;
}

export { eventGroupLimits };
