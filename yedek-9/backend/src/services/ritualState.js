/**
 * Ritual lifecycle — son-part.md §2
 * CREATE → PRELOBBY → LIVE → WINDOW → ARCHIVED
 */
import LOCAL_CONFIG, { liveWindowHoursOf, liveWindowHoursSqlDefault } from '../config/localConfig.js';

export const RITUAL_STATUS = {
  CREATED: 'created',
  DRAFT: 'draft',
  PRELOBBY: 'prelobby',
  LIVE: 'live',
  WINDOW: 'window',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
};

/** @deprecated use RITUAL_STATUS — legacy DB values */
export const LEGACY_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
  CLOSED: 'closed',
};

const LEGACY_TO_CANONICAL = {
  active: RITUAL_STATUS.PRELOBBY,
  ended: RITUAL_STATUS.WINDOW,
  closed: RITUAL_STATUS.ARCHIVED,
};

/** SQL IN lists — legacy values included until DB fully migrated */
export const JOINABLE_STATUS_SQL = "('prelobby', 'active', 'live')";
export const PRELOBBY_STATUS_SQL = "('prelobby', 'active')";
export const LIVE_STATUS_SQL = "('live')";
export const WINDOW_STATUS_SQL = "('window', 'ended')";
export const ARCHIVED_STATUS_SQL = "('archived', 'closed')";
export const DISCOVERABLE_STATUS_SQL = "('prelobby', 'active', 'live', 'window', 'ended')";
export const CREATED_STATUS_SQL = "('created', 'draft')";
export const DOOR_CHECK_STATUS_SQL = LIVE_STATUS_SQL;

/** Discovery visibility — son-part.md §1 ritual.visibility */
export function ritualVisibilitySql(viewerUserIdParam, alias = 'r') {
  return `(
    COALESCE(${alias}.visibility::text, 'public') = 'public'
    OR ${alias}.host_id = ${viewerUserIdParam}
    OR EXISTS (
      SELECT 1 FROM ritual_attendance ra_vis
      WHERE ra_vis.ritual_id = ${alias}.id
        AND ra_vis.user_id = ${viewerUserIdParam}
        AND ra_vis.status NOT IN ('no_show', 'cancelled')
    )
    OR (
      ${alias}.visibility::text IN ('venue_only', 'regular_only')
      AND ${alias}.venue_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM venue_managers vm
        WHERE vm.venue_id = ${alias}.venue_id AND vm.user_id = ${viewerUserIdParam}
      )
    )
    OR (
      ${alias}.visibility::text = 'regular_only'
      AND ${alias}.venue_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM venue_regulars vr
        WHERE vr.venue_id = ${alias}.venue_id
          AND vr.user_id = ${viewerUserIdParam}
          AND vr.is_regular = true
      )
    )
  )`;
}

/**
 * §2C rituals.audience — PUBLIC everyone; FRIENDS = FL1/FL2/FL3 friend of host.
 * Separate from visibility. Without viewer → PUBLIC only.
 */
export function ritualDiscoveryAudienceSql(viewerUserIdParam, alias = 'r') {
  if (!viewerUserIdParam) {
    return `(COALESCE(${alias}.audience, 'PUBLIC') = 'PUBLIC')`;
  }
  return `(
    COALESCE(${alias}.audience, 'PUBLIC') = 'PUBLIC'
    OR ${alias}.host_id = ${viewerUserIdParam}
    OR EXISTS (
      SELECT 1 FROM friendships f_aud
      WHERE f_aud.status = 'accepted'
        AND f_aud.friendship_level::text IN ('l1', 'l2', 'l3')
        AND (
          (f_aud.requester_id = ${viewerUserIdParam} AND f_aud.receiver_id = ${alias}.host_id)
          OR (f_aud.receiver_id = ${viewerUserIdParam} AND f_aud.requester_id = ${alias}.host_id)
        )
    )
  )`;
}

export function normalizeRitualStatus(status) {
  if (!status) return status;
  return LEGACY_TO_CANONICAL[status] || status;
}

export function isPrelobby(status) {
  const s = normalizeRitualStatus(status);
  return s === RITUAL_STATUS.PRELOBBY;
}

export function isLive(status) {
  return normalizeRitualStatus(status) === RITUAL_STATUS.LIVE;
}

export function isWindow(status) {
  return normalizeRitualStatus(status) === RITUAL_STATUS.WINDOW;
}

export function isArchived(status) {
  return normalizeRitualStatus(status) === RITUAL_STATUS.ARCHIVED;
}

export function isJoinable(status) {
  const s = normalizeRitualStatus(status);
  return s === RITUAL_STATUS.PRELOBBY || s === RITUAL_STATUS.LIVE;
}

export function isDiscoverable(status) {
  const s = normalizeRitualStatus(status);
  return (
    s === RITUAL_STATUS.PRELOBBY ||
    s === RITUAL_STATUS.LIVE ||
    s === RITUAL_STATUS.WINDOW
  );
}

export function getDurationEndDate(ritual) {
  const start = new Date(ritual.start_time);
  const durationMin = Number(ritual.duration) || 60;
  return new Date(start.getTime() + durationMin * 60000);
}

export function getWindowEndDate(ritual) {
  if (ritual.window_ends_at) {
    return new Date(ritual.window_ends_at);
  }
  const durationEnd = getDurationEndDate(ritual);
  const hours = liveWindowHoursOf(ritual);
  return new Date(durationEnd.getTime() + hours * 3600000);
}

export function computeWindowEndsAt(ritual) {
  return getWindowEndDate(ritual);
}

/**
 * Prelobby grace + exact-pin unlock — Check-in MD §2
 * graceEndsAt: join+GRACE (eski davranış)
 * exactDetailsUnlockedAt: KİLİT anı (start−%25 clamp 15dk–3h); join kilit sonrasıysa anında
 * @returns {{ graceEndsAt: Date, exactDetailsUnlockedAt: Date }}
 */
export function computePrelobbyGrace(joinedAt, ritualStartAt, ritual = null) {
  const graceMin = LOCAL_CONFIG.ritual.GRACE_MINUTES;
  const joinMs = new Date(joinedAt).getTime();
  const startMs = new Date(ritualStartAt).getTime();
  const minsUntilStart = (startMs - joinMs) / 60000;

  const graceEndsAt =
    minsUntilStart <= graceMin
      ? new Date(joinMs)
      : new Date(joinMs + graceMin * 60000);

  const durationMin = Number(ritual?.duration) || 60;
  const pct = LOCAL_CONFIG.ritual.CANCEL_FREE_THRESHOLD_PCT ?? 0.25;
  const minM = LOCAL_CONFIG.ritual.CANCEL_FREE_MIN_MINUTES ?? 15;
  const maxM = LOCAL_CONFIG.ritual.CANCEL_FREE_MAX_MINUTES ?? 180;
  const lockMin = Math.max(minM, Math.min(maxM, durationMin * pct));
  const lockAtMs = startMs - lockMin * 60000;
  const exactDetailsUnlockedAt =
    joinMs >= lockAtMs ? new Date(joinMs) : new Date(lockAtMs);

  return { graceEndsAt, exactDetailsUnlockedAt };
}

export function isExactDetailsUnlocked(attendance, now = new Date()) {
  if (!attendance) return false;
  if (attendance.exact_details_unlocked_at) {
    return new Date(attendance.exact_details_unlocked_at) <= now;
  }
  if (attendance.prelobby_grace_ends_at) {
    return new Date(attendance.prelobby_grace_ends_at) <= now;
  }
  return false;
}

/**
 * Aktif window bubble sayisi — son-part.md §2.4 (max 10)
 */
const LWH_SQL_DEF = liveWindowHoursSqlDefault();

const ACTIVE_WINDOW_BUBBLE_SQL = `
  FROM ritual_attendance ra
  JOIN rituals r ON r.id = ra.ritual_id
  WHERE ra.user_id = $1
    AND ra.status::text NOT IN ('no_show', 'cancelled')
    AND ra.checkin_at IS NOT NULL
    AND r.status::text IN ('window', 'ended')
    AND COALESCE(
      r.window_ends_at,
      r.start_time
        + (COALESCE(r.duration, 60)::text || ' minutes')::interval
        + (COALESCE(r.live_window_hours, ${LWH_SQL_DEF})::text || ' hours')::interval
    ) > NOW()`;

export async function countActiveWindowBubbles(db, userId) {
  const r = await db.query(
    `SELECT COUNT(DISTINCT r.id)::int AS c ${ACTIVE_WINDOW_BUBBLE_SQL}`,
    [userId]
  );
  return Number(r.rows[0]?.c || 0);
}

/** Aktif window bubble listesi — son-part.md §2.4 UI */
export async function listActiveWindowBubbles(db, userId) {
  const r = await db.query(
    `SELECT r.id, r.title, r.status, r.window_ends_at, r.start_time, r.duration,
            COALESCE(r.live_window_hours, ${LWH_SQL_DEF}) AS live_window_hours,
            COALESCE(
              r.window_ends_at,
              r.start_time
                + (COALESCE(r.duration, 60)::text || ' minutes')::interval
                + (COALESCE(r.live_window_hours, ${LWH_SQL_DEF})::text || ' hours')::interval
            ) AS window_end_at
     ${ACTIVE_WINDOW_BUBBLE_SQL}
     ORDER BY window_end_at ASC
     LIMIT 10`,
    [userId]
  );
  return r.rows;
}

/** Ayni anda tek LIVE duration */
export async function countActiveLiveParticipations(db, userId, excludeRitualId = null) {
  const r = await db.query(
    `SELECT COUNT(DISTINCT r.id)::int AS c
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.user_id = $1
       AND ra.status::text NOT IN ('no_show', 'cancelled')
       AND r.status::text = 'live'
       AND ($2::uuid IS NULL OR r.id != $2)`,
    [userId, excludeRitualId]
  );
  return Number(r.rows[0]?.c || 0);
}

/**
 * K3 muafiyet.
 * Join: start'a ≤ LATE_JOIN_EXEMPT_MIN (30dk) — "kapıdan girmek söz vermek değildir".
 * Host: Instant-kurma (time_type=instant veya start ≤ +INSTANT_MAX_LEAD_H).
 */
export function commitmentCountsTowardDailyCap(ritual, now = new Date(), { role = 'join' } = {}) {
  if (!ritual?.start_time) return true;
  const start = new Date(ritual.start_time);
  const minsToStart = (start.getTime() - now.getTime()) / 60000;
  const lateExempt = Number(LOCAL_CONFIG.ritual.LATE_JOIN_EXEMPT_MIN || 30);
  if (minsToStart <= lateExempt) return false;
  if (role === 'host') {
    const instantLeadH = Number(LOCAL_CONFIG.ritual.INSTANT_MAX_LEAD_H || 2);
    const timeType = String(ritual.time_type || '').toLowerCase();
    if (timeType === 'instant' || minsToStart <= instantLeadH * 60) return false;
  }
  return true;
}

/** K3 event=1 — aynı event_group tek kova */
export function dailyCommitBucket(ritual) {
  if (ritual?.event_group_id) return `eg:${ritual.event_group_id}`;
  if (ritual?.id) return `r:${ritual.id}`;
  return 'new';
}

export async function listDailyCommitBuckets(db, userId, now = new Date()) {
  const r = await db.query(
    `SELECT r.id, r.event_group_id, r.start_time, r.time_type, 'join'::text AS role
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.user_id = $1
       AND ra.status::text NOT IN ('cancelled', 'no_show', 'left')
       AND ra.created_at::date = CURRENT_DATE
     UNION
     SELECT r.id, r.event_group_id, r.start_time, r.time_type, 'host'::text AS role
     FROM rituals r
     WHERE r.host_id = $1
       AND r.status::text NOT IN ('cancelled', 'archived', 'closed', 'ended', 'draft', 'created')
       AND r.created_at::date = CURRENT_DATE`,
    [userId]
  );
  const buckets = new Set();
  for (const row of r.rows) {
    if (!commitmentCountsTowardDailyCap(row, now, { role: row.role })) continue;
    buckets.add(dailyCommitBucket(row));
  }
  return buckets;
}

export async function assertDailyCommitCap(db, userId, ritual, { role = 'join' } = {}) {
  const dailyCap = Number(LOCAL_CONFIG.ritual.DAILY_COMMIT_CAP || 0);
  if (dailyCap <= 0) return { ok: true };
  if (!commitmentCountsTowardDailyCap(ritual, new Date(), { role })) return { ok: true };
  const buckets = await listDailyCommitBuckets(db, userId);
  const bucket = dailyCommitBucket(ritual);
  if (bucket !== 'new' && buckets.has(bucket)) return { ok: true };
  if (buckets.size >= dailyCap) {
    return {
      ok: false,
      code: 'DAILY_COMMIT_CAP',
      error: `Bugun en fazla ${dailyCap} ileri-tarihli taahhut yapabilirsin.`,
    };
  }
  return { ok: true };
}

/** K1 + K3 for host create / publish (kurulan taahhüt) */
export async function assertCanHostCommit(db, userId, ritual) {
  const k1 = await assertNoTimeOverlapCommit(db, userId, ritual);
  if (!k1.ok) return k1;
  return assertDailyCommitCap(db, userId, ritual, { role: 'host' });
}

/**
 * K1 🔒 zaman-çakışma yasağı — host+join taahhütleri örtüşemez.
 * Event = tek söz; masa geçişi / tanıklık söz değildir.
 */
export async function assertNoTimeOverlapCommit(db, userId, ritual) {
  if (!ritual?.start_time) return { ok: true };
  const start = new Date(ritual.start_time);
  const durationMin = Number(ritual.duration) || 60;
  const end = new Date(start.getTime() + durationMin * 60000);
  const eventGroupId = ritual.event_group_id || null;

  const overlap = await db.query(
    `SELECT r.id, r.title, r.start_time, r.duration, r.event_group_id
     FROM ritual_attendance ra
     JOIN rituals r ON r.id = ra.ritual_id
     WHERE ra.user_id = $1
       AND ra.status::text NOT IN ('cancelled', 'no_show', 'left')
       AND r.status::text NOT IN ('cancelled', 'archived', 'closed', 'ended')
       AND ($2::uuid IS NULL OR r.id != $2)
       AND r.start_time < $4
       AND (r.start_time + (COALESCE(r.duration, 60) || ' minutes')::interval) > $3
       AND (
         $5::uuid IS NULL
         OR r.event_group_id IS NULL
         OR r.event_group_id IS DISTINCT FROM $5
       )
     LIMIT 1`,
    [userId, ritual.id || null, start, end, eventGroupId]
  );

  // Also block hosting another overlapping ritual
  const hostOverlap = await db.query(
    `SELECT r.id, r.title
     FROM rituals r
     WHERE r.host_id = $1
       AND r.status::text NOT IN ('cancelled', 'archived', 'closed', 'ended', 'draft')
       AND ($2::uuid IS NULL OR r.id != $2)
       AND r.start_time < $4
       AND (r.start_time + (COALESCE(r.duration, 60) || ' minutes')::interval) > $3
       AND (
         $5::uuid IS NULL
         OR r.event_group_id IS NULL
         OR r.event_group_id IS DISTINCT FROM $5
       )
     LIMIT 1`,
    [userId, ritual.id || null, start, end, eventGroupId]
  );

  if (overlap.rows[0] || hostOverlap.rows[0]) {
    const hit = overlap.rows[0] || hostOverlap.rows[0];
    return {
      ok: false,
      code: 'K1_TIME_OVERLAP',
      error: `Zaman cakismasi: baska bir taahhutun var (${hit.title || hit.id}).`,
      conflicting_ritual_id: hit.id,
    };
  }
  return { ok: true };
}

export async function assertCanJoinRitualConstraints(db, userId, ritual) {
  const maxBubbles = LOCAL_CONFIG.ritual.MAX_CONCURRENT_WINDOW_BUBBLES || 10;
  const bubbles = await countActiveWindowBubbles(db, userId);
  if (bubbles >= maxBubbles) {
    return {
      ok: false,
      code: 'WINDOW_BUBBLE_LIMIT',
      error: `En fazla ${maxBubbles} aktif Window bubble tutabilirsin. Bir Window kapansin, sonra yeniden dene.`,
    };
  }

  const phase = getLifecyclePhase(ritual);
  if (phase === RITUAL_STATUS.LIVE) {
    const liveCount = await countActiveLiveParticipations(db, userId, ritual.id);
    if (liveCount > 0) {
      return {
        ok: false,
        code: 'LIVE_DURATION_CONFLICT',
        error: 'Ayni anda yalnizca bir canli Ritualde olabilirsin.',
      };
    }
  }

  // K1 🔒: kurulan+join'li taahhütler zaman-çakışamaz (masa geçişi / tanıklık söz değil)
  const k1 = await assertNoTimeOverlapCommit(db, userId, ritual);
  if (!k1.ok) return k1;

  // K3: günlük tavan — yalnız ileri-tarihli; event=1; host+join aynı kova
  const k3 = await assertDailyCommitCap(db, userId, ritual, { role: 'join' });
  if (!k3.ok) return k3;

  // v2 §2 K-seti: aynı rituale aynı gün tek join
  const sameRitualPerDay = Number(LOCAL_CONFIG.ritual.SAME_RITUAL_JOIN_PER_DAY || 0);
  if (sameRitualPerDay > 0 && ritual?.id) {
    const sameR = await db.query(
      `SELECT COUNT(*)::int AS c
       FROM ritual_attendance
       WHERE user_id = $1
         AND ritual_id = $2
         AND created_at::date = CURRENT_DATE`,
      [userId, ritual.id]
    );
    if (Number(sameR.rows[0]?.c || 0) >= sameRitualPerDay) {
      return {
        ok: false,
        code: 'SAME_RITUAL_JOIN_PER_DAY',
        error: 'Ayni rituale ayni gun tekrar join yapamazsin.',
      };
    }
  }

  const origin = String(ritual?.origin || 'WALK_IN');
  if (origin === 'WALK_IN') {
    const walkInCap = Number(LOCAL_CONFIG.ritual.WALK_IN_DAILY_CAP || 0);
    if (walkInCap > 0) {
      const walkR = await db.query(
        `SELECT COUNT(*)::int AS c
         FROM ritual_attendance ra
         JOIN rituals r ON r.id = ra.ritual_id
         WHERE ra.user_id = $1
           AND ra.status::text NOT IN ('cancelled', 'no_show')
           AND ra.created_at::date = CURRENT_DATE
           AND COALESCE(r.origin::text, 'WALK_IN') = 'WALK_IN'`,
        [userId]
      );
      if (Number(walkR.rows[0]?.c || 0) >= walkInCap) {
        return {
          ok: false,
          code: 'WALK_IN_DAILY_CAP',
          error: `Bugun en fazla ${walkInCap} WALK-IN rituale commit yapabilirsin.`,
        };
      }
    }
  }

  // §14 — badge / üni kapıları (min-RS yok)
  try {
    const { assertRitualAudienceGates } = await import('./ritualAudienceGate.js');
    const gate = await assertRitualAudienceGates(db, userId, ritual);
    if (!gate.ok) return gate;
  } catch (_e) {
    /* non-fatal if module missing */
  }

  return { ok: true };
}

export function getLifecyclePhase(ritual, now = new Date()) {
  const status = normalizeRitualStatus(ritual.status);
  if (status === RITUAL_STATUS.CANCELLED || status === RITUAL_STATUS.DRAFT) {
    return status;
  }
  if (status === RITUAL_STATUS.ARCHIVED) return RITUAL_STATUS.ARCHIVED;

  const start = new Date(ritual.start_time);
  const durationEnd = getDurationEndDate(ritual);
  const windowEnd = getWindowEndDate(ritual);

  if (now < start) return RITUAL_STATUS.PRELOBBY;
  if (now < durationEnd) return RITUAL_STATUS.LIVE;
  if (now < windowEnd) return RITUAL_STATUS.WINDOW;
  return RITUAL_STATUS.ARCHIVED;
}
