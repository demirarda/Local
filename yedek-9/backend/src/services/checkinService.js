import pool from '../config/database.js';
import redis from '../config/redis.js';
import {
  computeAis,
  getKapiMinutes,
  isGpsEdgeDistance,
  LOCAL_CONFIG,
  resolveCheckinRadiusMeters,
} from '../config/localConfig.js';
import { encryptJsonAtRest } from '../utils/piiCrypto.js';
import { enqueue } from './queueSystem.js';
import { applyFriendshipLevelOnCheckin } from './friendshipLevel.js';
import { collapseRitualHostNoShow, collapseHomeEmptyDoor } from './penaltyService.js';
import { notifyLateArrivalJoin } from './notifications.js';
import { runPostCheckinJobs } from './checkinPostCheckin.js';
import { issuePresenceTicket } from './presenceTicketService.js';
import {
  applyFirstSealBirth,
  finalizeSeal,
  setPendingWitness,
} from './firstSealService.js';
import { recordCheckinFunnelEvent } from './checkinFunnelService.js';

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getDoorCloseTime(startTimeOrRitual, durationMin) {
  const ritual = typeof startTimeOrRitual === 'object' && startTimeOrRitual && startTimeOrRitual.start_time
    ? startTimeOrRitual
    : null;
  const start = new Date(ritual ? ritual.start_time : startTimeOrRitual);
  const effectiveDuration = ritual ? Number(ritual.duration) || 60 : (durationMin || 60);
  const formulaClose = new Date(start.getTime() + getKapiMinutes(effectiveDuration) * 60000);
  // TARİFELİ/VAPUR: min(formül, kalkış+DEPARTURE_GATE_PAD_MIN) via gate_override_until
  if (ritual?.gate_override_until) {
    const gateOverride = new Date(ritual.gate_override_until);
    if (!Number.isNaN(gateOverride.getTime())) {
      return gateOverride < formulaClose ? gateOverride : formulaClose;
    }
  }
  // departure_at fallback when gate_override not set yet
  if (ritual?.departure_at) {
    const pad = Number(LOCAL_CONFIG.checkin?.DEPARTURE_GATE_PAD_MIN ?? 5);
    const depClose = new Date(new Date(ritual.departure_at).getTime() + pad * 60000);
    if (!Number.isNaN(depClose.getTime()) && depClose < formulaClose) return depClose;
  }
  return formulaClose;
}

/**
 * Hareketli Ritual: çapa = açanın (first_sealed_by) canlı GPS'i — sonMD §4.
 * Centroid kaldırıldı; opener GPS yoksa no-op.
 */
export async function updateMovingRitualCentroid(ritualId) {
  const r = await pool.query(
    `SELECT id, location_type, first_sealed_by FROM rituals WHERE id = $1`,
    [ritualId]
  );
  const ritual = r.rows[0];
  if (!ritual || String(ritual.location_type || '').toLowerCase() !== 'moving') {
    return { ok: false, reason: 'not_moving' };
  }
  const ownerId = ritual.first_sealed_by;
  if (!ownerId) return { ok: false, reason: 'no_opener' };
  const pts = await pool.query(
    `SELECT checkin_gps_lat AS lat, checkin_gps_lng AS lng
     FROM ritual_attendance
     WHERE ritual_id = $1
       AND user_id = $2
       AND checkin_at IS NOT NULL
       AND checkin_gps_lat IS NOT NULL
       AND checkin_gps_lng IS NOT NULL
     LIMIT 1`,
    [ritualId, ownerId]
  );
  const row = pts.rows[0];
  if (!row) return { ok: false, reason: 'no_opener_gps' };
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: 'invalid' };
  }
  await pool.query(
    `UPDATE rituals
     SET location_lat = $2, location_lng = $3, updated_at = NOW()
     WHERE id = $1 AND location_type = 'moving'`,
    [ritualId, lat, lng]
  );
  return { ok: true, location_lat: lat, location_lng: lng, n: 1, opener_id: ownerId };
}

/**
 * Ferry/scheduled: kalkış sonrası çapa iskele→gemi (opener GPS veya ship_*).
 * @returns {{ lat: number, lng: number, mode: string }|null}
 */
export async function resolveCheckinAnchor(ritual) {
  const locType = String(ritual?.location_type || '').toLowerCase();
  const baseLat = ritual?.location_lat != null ? Number(ritual.location_lat) : null;
  const baseLng = ritual?.location_lng != null ? Number(ritual.location_lng) : null;

  if (locType === 'moving' && ritual?.first_sealed_by) {
    const opener = await pool.query(
      `SELECT checkin_gps_lat AS lat, checkin_gps_lng AS lng
       FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2
         AND checkin_gps_lat IS NOT NULL LIMIT 1`,
      [ritual.id, ritual.first_sealed_by]
    );
    const o = opener.rows[0];
    if (o && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng))) {
      return { lat: Number(o.lat), lng: Number(o.lng), mode: 'moving_opener' };
    }
  }

  if (
    (locType === 'ferry' || locType === 'scheduled' || locType === 'tarifeli' || locType === 'vapur') &&
    ritual?.departure_at
  ) {
    const dep = new Date(ritual.departure_at);
    if (!Number.isNaN(dep.getTime()) && Date.now() >= dep.getTime()) {
      const shipLat = ritual.ship_lat != null ? Number(ritual.ship_lat) : null;
      const shipLng = ritual.ship_lng != null ? Number(ritual.ship_lng) : null;
      if (Number.isFinite(shipLat) && Number.isFinite(shipLng)) {
        return { lat: shipLat, lng: shipLng, mode: 'ship' };
      }
      if (ritual.first_sealed_by) {
        const opener = await pool.query(
          `SELECT checkin_gps_lat AS lat, checkin_gps_lng AS lng
           FROM ritual_attendance
           WHERE ritual_id = $1 AND user_id = $2
             AND checkin_gps_lat IS NOT NULL LIMIT 1`,
          [ritual.id, ritual.first_sealed_by]
        );
        const o = opener.rows[0];
        if (o && Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lng))) {
          return { lat: Number(o.lat), lng: Number(o.lng), mode: 'ship_via_opener' };
        }
      }
    }
  }

  if (Number.isFinite(baseLat) && Number.isFinite(baseLng)) {
    return { lat: baseLat, lng: baseLng, mode: 'static' };
  }
  return null;
}

async function maybeHandoverMovingAnchorOwner(ritualId, fallbackUserId) {
  const r = await pool.query(
    `SELECT id, location_type, first_sealed_by
     FROM rituals
     WHERE id = $1`,
    [ritualId]
  );
  const ritual = r.rows[0];
  if (!ritual || String(ritual.location_type || '').toLowerCase() !== 'moving') return;
  const ownerId = ritual.first_sealed_by;
  if (!ownerId) return;
  let ownerOnline = false;
  try {
    const online = await redis.get(`user_online:${ownerId}`);
    ownerOnline = online === '1';
  } catch (_e) {
    ownerOnline = false;
  }
  if (ownerOnline) return;
  await pool.query(
    `UPDATE rituals
     SET first_sealed_by = $2, updated_at = NOW()
     WHERE id = $1`,
    [ritualId, fallbackUserId]
  );
}

export function getCheckinWindowInfo(ritual, now = new Date()) {
  const start = new Date(ritual.start_time);
  const durationMin = Number(ritual.duration) || 60;
  const doorClose = getDoorCloseTime(ritual);
  const kapıMin = getKapiMinutes(durationMin);
  const earlyMin = LOCAL_CONFIG.keyword?.CHECKIN_EARLY_OPEN_MIN ?? 15;
  const earlyOpen = new Date(start.getTime() - earlyMin * 60000);
  const started = now >= start;
  const earlyWindow = now >= earlyOpen && !started;
  // sonMD: kapı start−15'te açılır; firstSeal + kod girişi erken pencerede de geçerli
  const doorOpen = now >= earlyOpen && now <= doorClose;
  const minutesUntilDoorClose = doorOpen
    ? Math.max(0, Math.ceil((doorClose - now) / 60000))
    : 0;
  const minutesLate = started ? Math.max(0, (now - start) / 60000) : 0;
  const tableOpen = Boolean(ritual.checkin_keyword) || Boolean(ritual.first_sealed_at);
  const codeBanned = Boolean(ritual.first_sealed_at) && !ritual.checkin_keyword;

  return {
    ritual_started: started,
    early_window: earlyWindow,
    early_open_at: earlyOpen.toISOString(),
    door_open: doorOpen,
    door_closes_at: doorClose.toISOString(),
    kapi_minutes: kapıMin,
    minutes_until_door_close: minutesUntilDoorClose,
    minutes_late: Math.round(minutesLate),
    seconds_until_start: started ? 0 : Math.max(0, Math.ceil((start - now) / 1000)),
    code_entry_active: doorOpen && tableOpen && !codeBanned,
    table_open: tableOpen,
    can_first_seal: doorOpen && !tableOpen,
    warmup: earlyWindow,
    code_banned: codeBanned,
  };
}

function keywordRevealed(ritual) {
  return ritual.keyword_revealed_at != null && ritual.checkin_keyword;
}

async function evaluateIntegritySignals({ userId, userLat, userLng, integrity = {} }) {
  const cfg = LOCAL_CONFIG.checkin?.INTEGRITY || {};
  const reasons = [];
  let blocked = false;
  let suspect = false;

  const playIntegrity = integrity.play_integrity;
  const appAttest = integrity.app_attest;
  const mockLocation = integrity.mock_location === true;

  if (mockLocation) {
    suspect = true;
    reasons.push('mock_location');
  }
  if (integrity.root === true) {
    suspect = true;
    reasons.push('root');
  }
  if (playIntegrity === false) {
    if (cfg.BLOCK_ON_PLAY_INTEGRITY_FAIL) {
      blocked = true;
    } else {
      suspect = true;
    }
    reasons.push('play_integrity_fail');
  }
  if (appAttest === false) {
    if (cfg.BLOCK_ON_APP_ATTEST_FAIL) {
      blocked = true;
    } else {
      suspect = true;
    }
    reasons.push('app_attest_fail');
  }

  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return { blocked, suspect, reasons };
  }

  const historyWindowMin = Number(cfg.HISTORY_WINDOW_MIN || 30);
  const recent = await pool.query(
    `SELECT checkin_gps_lat AS lat, checkin_gps_lng AS lng,
            COALESCE(checkin_attempt_at, checkin_at, updated_at) AS ts
     FROM ritual_attendance
     WHERE user_id = $1
       AND checkin_gps_lat IS NOT NULL
       AND checkin_gps_lng IS NOT NULL
       AND COALESCE(checkin_attempt_at, checkin_at, updated_at) >= NOW() - ($2::text || ' minutes')::interval
     ORDER BY COALESCE(checkin_attempt_at, checkin_at, updated_at) DESC
     LIMIT 1`,
    [userId, String(historyWindowMin)]
  );
  const prev = recent.rows[0];
  if (prev?.ts) {
    const prevTs = new Date(prev.ts).getTime();
    const nowTs = Date.now();
    const dtHours = Math.max(0, (nowTs - prevTs) / 3600000);
    if (dtHours > 0) {
      const distM = haversineMeters(Number(prev.lat), Number(prev.lng), userLat, userLng);
      const speedKmh = (distM / 1000) / dtHours;
      const blockKmh = Number(cfg.IMPOSSIBLE_SPEED_BLOCK_KMH || 0);
      const suspectKmh = Number(cfg.IMPOSSIBLE_SPEED_SUSPECT_KMH || 180);
      if (blockKmh > 0 && speedKmh >= blockKmh) {
        blocked = true;
        reasons.push('impossible_speed_block');
      } else if (speedKmh >= suspectKmh) {
        suspect = true;
        reasons.push('impossible_speed_suspect');
      }
    }
  }

  return { blocked, suspect, reasons };
}

/**
 * @returns {Promise<{ ok: true, data: object } | { ok: false, status: number, body: object }>}
 */
export async function processCheckIn({
  ritualId,
  userId,
  latitude,
  longitude,
  keyword,
  manualApproved = false,
  bypassDoor = false,
  locationSuspect = false,
  localTagRedeem = false,
  nfcMarker = false,
  openNote = null,
  integritySignals = null,
  digitalPaste = false,
  entryMs = null,
  gateMs = null,
  culturePath = null,
}) {
  const attendanceCheck = await pool.query(
    `SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, userId]
  );

  if (attendanceCheck.rows.length === 0) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'User is not attending this ritual' },
    };
  }

  const attendance = attendanceCheck.rows[0];
  if (attendance.status === 'cancelled' || attendance.status === 'no_show') {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'Cannot check in with current attendance status' },
    };
  }

  if (attendance.checkin_at && attendance.checkin_phase === 'sealed') {
    return {
      ok: true,
      data: {
        attendance,
        already_checked_in: true,
        ais: attendance.ais_score != null ? Number(attendance.ais_score) : null,
      },
    };
  }

  if (attendance.checkin_phase === 'pending_witness') {
    return {
      ok: true,
      data: {
        pending_witness: true,
        witness_required: attendance.witness_required,
        witness_count: attendance.witness_count,
        checkin_attempt_at: attendance.checkin_attempt_at,
      },
    };
  }

  const ritualResult = await pool.query(
    `SELECT r.id, r.start_time, r.duration, r.status, r.checkin_keyword, r.keyword_revealed_at,
            r.location_lat, r.location_lng, r.location_type, r.host_id, r.venue_id, r.check_in_radius,
            r.first_sealed_at, r.checkin_code_generated_at, r.origin, r.gate_override_until,
            v.city_id AS city_id,
            v.dense_canyon AS venue_dense_canyon,
            v.gps_radius_m AS venue_gps_radius_m
     FROM rituals r
     LEFT JOIN venues v ON v.id = r.venue_id
     WHERE r.id = $1`,
    [ritualId]
  );

  if (ritualResult.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      body: { success: false, error: 'Ritual not found' },
    };
  }

  const ritual = ritualResult.rows[0];
  const now = new Date();
  const windowInfo = getCheckinWindowInfo(ritual, now);

  if (manualApproved) {
    return {
      ok: false,
      status: 410,
      body: {
        success: false,
        error: 'Host manual check-in removed — use PENDING_WITNESS',
        code: 'AIS_MANUAL_REMOVED',
      },
    };
  }

  // sonMD: full check-in / firstSeal opens at start−15 (early_window); not start-gated
  if (!windowInfo.door_open && !bypassDoor) {
    const tooEarly = !windowInfo.ritual_started && !windowInfo.early_window;
    return {
      ok: false,
      status: tooEarly ? 400 : 403,
      body: {
        success: false,
        error: tooEarly
          ? 'Check-in opens 15 minutes before ritual start'
          : 'Check-in door is closed (no-show)',
        door_closed: !tooEarly,
        checkin_window: windowInfo,
      },
    };
  }

  let aisScore = LOCAL_CONFIG.checkin.AIS_LATE;
  let aisStatus = 'pending';

  // sonMD §1 T1: konum yok/kirli → ② açılır, mühür PENDING (hard GPS block değil)
  const hasCoords = latitude != null && longitude != null;
  const userLatNum = hasCoords ? Number(latitude) : NaN;
  const userLngNum = hasCoords ? Number(longitude) : NaN;
  const coordsValid = Number.isFinite(userLatNum) && Number.isFinite(userLngNum);
  const gpsT1Fail = !hasCoords || !coordsValid;

  const anchor = await resolveCheckinAnchor(ritual);
  const ritualLat = anchor?.lat ?? (ritual.location_lat != null ? Number(ritual.location_lat) : null);
  const ritualLng = anchor?.lng ?? (ritual.location_lng != null ? Number(ritual.location_lng) : null);

  if (!gpsT1Fail && (!Number.isFinite(ritualLat) || !Number.isFinite(ritualLng))) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'Ritual location is not configured for GPS check-in' },
    };
  }

  const radius = resolveCheckinRadiusMeters({
    locationType: ritual.location_type,
    ritualRadius: ritual.check_in_radius,
    venueGpsRadiusM: ritual.venue_gps_radius_m,
    denseCanyon: ritual.venue_dense_canyon,
  });
  const distanceMeters =
    gpsT1Fail || !Number.isFinite(ritualLat)
      ? 0
      : haversineMeters(userLatNum, userLngNum, ritualLat, ritualLng);
  const gpsFail = !gpsT1Fail && distanceMeters > radius;

  // sonMD §1: radius dışı = kapı KAPALI (pending değil). Pending yalnız T1/T2/T3.
  if (gpsFail) {
    const sealedCountR = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_attendance
       WHERE ritual_id = $1 AND checkin_at IS NOT NULL AND checkin_phase = 'sealed'`,
      [ritualId]
    );
    void recordCheckinFunnelEvent({
      ritualId,
      userId,
      event: 'outside_radius_block',
      meta: { distance_m: Math.round(distanceMeters), radius, anchor_mode: anchor?.mode },
    });
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: 'Outside check-in radius — door closed',
        code: 'OUTSIDE_RADIUS',
        door_closed_outside: true,
        gps_ok: false,
        distance_meters: Math.round(distanceMeters),
        max_distance_meters: radius,
        sealed_at_table: Number(sealedCountR.rows[0]?.c || 0),
        find_note: ritual.find_note || null,
        open_note: ritual.open_note || null,
        location_lat: ritualLat,
        location_lng: ritualLng,
        checkin_window: windowInfo,
      },
    };
  }

  const userLat = gpsT1Fail ? null : userLatNum;
  const userLng = gpsT1Fail ? null : userLngNum;

  void recordCheckinFunnelEvent({
    ritualId,
    userId,
    event: 'checkin_start',
    meta: {
      distance_m: Math.round(distanceMeters),
      radius,
      t1_gps_fail: gpsT1Fail,
      anchor_mode: anchor?.mode || null,
    },
  });

  const tableOpen =
    Boolean(ritual.checkin_keyword) || Boolean(ritual.first_sealed_at);
  const codeBanned = Boolean(ritual.first_sealed_at) && !ritual.checkin_keyword;
  const expectedKw = ritual.checkin_keyword ? String(ritual.checkin_keyword).trim() : '';
  const gotRaw = keyword != null ? String(keyword).trim() : '';
  const got = nfcMarker && tableOpen && expectedKw ? expectedKw : gotRaw;
  const isFirstSealAttempt = !tableOpen && !got && !nfcMarker;

  // sonMD §1/C4: dijital paste/DM ile kod → yasak (LOCAL-TAG/NFC fiziksel yol)
  // Client flag + sunucu heuristik (süper-hızlı tam-kod = paste/autofill şüphesi)
  const fastEntryMs = Number(LOCAL_CONFIG.relayBan?.FAST_ENTRY_MS ?? 400);
  const entryMsNum = entryMs != null ? Number(entryMs) : null;
  const fastEntrySuspect =
    Number.isFinite(entryMsNum) &&
    entryMsNum >= 0 &&
    entryMsNum < fastEntryMs &&
    Boolean(got) &&
    got.length >= 3;
  const relaySuspect = Boolean(digitalPaste) || fastEntrySuspect;
  if (
    got &&
    !nfcMarker &&
    !localTagRedeem &&
    relaySuspect &&
    LOCAL_CONFIG.relayBan?.REJECT_DIGITAL_PASTE !== false
  ) {
    void recordCheckinFunnelEvent({
      ritualId,
      userId,
      event: 'code_relay_suspect',
      meta: {
        via: digitalPaste ? 'digital_paste' : 'fast_entry',
        entry_ms: entryMsNum,
      },
    });
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: 'Digital code relay forbidden — ask at the table, show code, or use LOCAL-TAG/NFC',
        code: 'DIGITAL_RELAY_FORBIDDEN',
        physical_paths: ['say', 'show', 'local_tag', 'nfc'],
      },
    };
  }

  if (isFirstSealAttempt && String(ritual.origin || 'WALK_IN') === 'VEN_EVENT') {
    const isStaff = await isVenueStaffForRitual(ritualId, userId);
    if (!isStaff) {
      return {
        ok: false,
        status: 403,
        body: { success: false, error: 'Only venue personnel can technically open VEN_EVENT table' },
      };
    }
  }

  // C5: totem_broken → kod fallback (EVENT kod yasak bypass)
  let totemBroken = false;
  if (tableOpen && codeBanned && ritual.venue_id) {
    try {
      const vs = await pool.query(
        `SELECT COALESCE(totem_status, 'ok') AS totem_status FROM venues WHERE id = $1`,
        [ritual.venue_id]
      );
      totemBroken = String(vs.rows[0]?.totem_status || '') === 'broken';
    } catch (_e) {
      totemBroken = false;
    }
  }
  const allowCodeDespiteBan =
    totemBroken && LOCAL_CONFIG.checkin?.TOTEM_BROKEN_FALLBACK_TO_CODE !== false;

  if (tableOpen && codeBanned && !nfcMarker && !isFirstSealAttempt && !allowCodeDespiteBan) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: 'Large event — use totem/NFC check-in (code banned)',
        code: 'EVENT_CODE_BANNED',
        code_banned: true,
        totem_required: true,
      },
    };
  }

  const codePathActive = (tableOpen && !codeBanned) || allowCodeDespiteBan;
  if (codePathActive) {
    if (!got && !nfcMarker) {
      return {
        ok: false,
        status: 400,
        body: { success: false, error: 'Check-in code required', keyword_required: true },
      };
    }
  }

  if (codePathActive || got) {
    const tryLimit = LOCAL_CONFIG.keyword?.ENTRY_TRIES ?? 3;
    const retryWaitS = LOCAL_CONFIG.keyword?.RETRY_WAIT_S ?? 30;
    const attemptRow = await pool.query(
      `SELECT attempts, locked_until FROM ritual_checkin_attempts
       WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, userId]
    );
    const lockedUntil = attemptRow.rows[0]?.locked_until
      ? new Date(attemptRow.rows[0].locked_until)
      : null;
    if (lockedUntil && lockedUntil > now) {
      return {
        ok: false,
        status: 429,
        body: {
          success: false,
          error: 'Too many code attempts — wait before retrying',
          locked_until: lockedUntil.toISOString(),
          retry_wait_s: Math.ceil((lockedUntil - now) / 1000),
        },
      };
    }

    if (codePathActive && expectedKw) {
      if (got !== expectedKw) {
        const prevAttempts = Number(attemptRow.rows[0]?.attempts || 0) + 1;
        const lock =
          prevAttempts >= tryLimit
            ? new Date(now.getTime() + retryWaitS * 1000)
            : null;
        await pool.query(
          `INSERT INTO ritual_checkin_attempts (ritual_id, user_id, attempts, locked_until, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (ritual_id, user_id) DO UPDATE
             SET attempts = $3, locked_until = $4, updated_at = NOW()`,
          [ritualId, userId, prevAttempts >= tryLimit ? 0 : prevAttempts, lock]
        );
        return {
          ok: false,
          status: 400,
          body: {
            success: false,
            error: 'Invalid or missing check-in code',
            keyword_required: true,
            attempts_remaining: Math.max(0, tryLimit - prevAttempts),
            locked_until: lock ? lock.toISOString() : null,
          },
        };
      }
    }

    await pool.query(
      `INSERT INTO ritual_checkin_attempts (ritual_id, user_id, attempts, locked_until, updated_at)
       VALUES ($1, $2, 0, NULL, NOW())
       ON CONFLICT (ritual_id, user_id) DO UPDATE
         SET attempts = 0, locked_until = NULL, updated_at = NOW()`,
      [ritualId, userId]
    );
  }

  const distRounded = Math.round(distanceMeters);
  const attemptAt = now;
  await pool.query(
    `UPDATE ritual_attendance
     SET checkin_attempt_at = $3
     WHERE ritual_id = $1 AND user_id = $2 AND checkin_at IS NULL`,
    [ritualId, userId, attemptAt]
  );
  const edgePattern = await evaluateGpsEdgeZeroMemoryPattern(userId);
  const integrityEval = await evaluateIntegritySignals({
    userId,
    userLat: userLatNum,
    userLng: userLngNum,
    integrity: integritySignals || {},
  });
  if (integrityEval.blocked) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: 'Integrity check failed',
        integrity_blocked: true,
        integrity_reasons: integrityEval.reasons,
      },
    };
  }
  const t3Pending =
    Boolean(edgePattern.hit) && LOCAL_CONFIG.checkin?.T3_PENDING_ENABLED === true;
  const needsWitness =
    Boolean(locationSuspect) ||
    t3Pending ||
    Boolean(integrityEval.suspect) ||
    Boolean(gpsT1Fail);

  if (needsWitness) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const pending = await setPendingWitness({
        client,
        ritualId,
        userId,
        userLat,
        userLng,
        distanceMeters,
        radius,
        locationSuspect: Boolean(locationSuspect) || t3Pending || gpsT1Fail,
        now,
        ritual,
      });
      await client.query('COMMIT');
      void recordCheckinFunnelEvent({
        ritualId,
        userId,
        event: 'pending_witness',
        meta: {
          witness_required: pending.witness_required,
          t1_gps_fail: gpsT1Fail,
          integrity_suspect: Boolean(integrityEval.suspect),
          t2_integrity: Boolean(integrityEval.suspect),
          t3_edge: t3Pending,
          venue_id: ritual.venue_id || null,
          city_id: ritual.city_id || null,
          culture_path: culturePath || null,
        },
      });
      if (culturePath) {
        void recordCheckinFunnelEvent({
          ritualId,
          userId,
          event: 'culture_path',
          meta: { path: String(culturePath), via: 'pending' },
        });
      }
      return {
        ok: true,
        data: {
          ...pending,
          gps_fail: gpsT1Fail,
          t1_gps_fail: gpsT1Fail,
          integrity_suspect: integrityEval.suspect,
          integrity_reasons: integrityEval.reasons,
          t3_edge: t3Pending,
          max_distance_meters: radius,
          distance_meters: distRounded,
          checkin_window: windowInfo,
        },
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const lateMinutes = (now - new Date(ritual.start_time)) / 60000;
  const ais = computeAis(lateMinutes, Number(ritual.duration) || 60);
  if (ais.status === 'no_show') {
    void recordCheckinFunnelEvent({
      ritualId,
      userId,
      event: 'door_closed_noshow',
    });
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: 'Check-in door is closed (no-show)',
        door_closed: true,
        checkin_window: windowInfo,
        neutral_card: true,
      },
    };
  }
    aisScore = ais.ais;
    aisStatus = ais.status;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (isFirstSealAttempt) {
        await applyFirstSealBirth(client, ritualId, userId, openNote, attemptAt);
      }
      const ritualLocked = await client.query(`SELECT * FROM rituals WHERE id = $1`, [ritualId]);
      const attendanceRow = await finalizeSeal({
        client,
        ritualId,
        userId,
        ritual: ritualLocked.rows[0],
        userLat,
        userLng,
        distanceMeters,
        radius,
        aisScore,
        aisStatus,
        now,
      });
      await client.query('COMMIT');

      try {
        const { snapshotFeedbackEligibility } = await import('./waveBSocial.js');
        await snapshotFeedbackEligibility(ritualId, userId);
      } catch (_e) {
        /* non-fatal */
      }

      try {
        if (ritual.series_id) {
          const { evaluateSeriesRegular } = await import('./seriesRegularService.js');
          await evaluateSeriesRegular({ seriesId: ritual.series_id, userId });
        }
      } catch (_e) {
        /* non-fatal */
      }

      const flUpdate = await runPostCheckinJobs(ritualId, userId);
      void recordCheckinFunnelEvent({
        ritualId,
        userId,
        event: 'seal',
        meta: {
          first_seal: isFirstSealAttempt,
          ais: aisScore,
          gate_s:
            Number.isFinite(Number(gateMs)) && Number(gateMs) >= 0
              ? Number((Number(gateMs) / 1000).toFixed(1))
              : null,
          culture_path: culturePath || null,
        },
      });
      if (culturePath) {
        void recordCheckinFunnelEvent({
          ritualId,
          userId,
          event: 'culture_path',
          meta: { path: String(culturePath), via: 'seal' },
        });
      }
      const presenceTicket = await issuePresenceTicket(userId, ritualId).catch(() => null);

      if (String(ritual.location_type || '').toLowerCase() === 'moving') {
        await updateMovingRitualCentroid(ritualId).catch(() => {});
        await maybeHandoverMovingAnchorOwner(ritualId, userId).catch(() => {});
      }

      if (aisStatus === 'late' && ritual.host_id && String(ritual.host_id) !== String(userId)) {
        const userR = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
        notifyLateArrivalJoin(ritual.host_id, {
          ritualData: { id: ritual.id, title: ritual.title },
          participantName: userR.rows[0]?.name,
          minutesLate: Math.round(lateMinutes),
        }).catch(() => {});
      }

      const refreshed = await pool.query(`SELECT checkin_keyword FROM rituals WHERE id = $1`, [ritualId]);

      return {
        ok: true,
        data: {
          attendance: attendanceRow,
          ais: aisScore,
          ais_status: aisStatus,
          minutesLate: lateMinutes > 0 ? Math.round(lateMinutes) : 0,
          distanceMeters: Math.round(distanceMeters),
          integrity_reasons: integrityEval.reasons,
          checkin_window: windowInfo,
          friendship_level_update: flUpdate,
          presence_ticket: presenceTicket,
          first_seal: isFirstSealAttempt,
          table_code: refreshed.rows[0]?.checkin_keyword || null,
        },
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
}


/**
 * Legacy: v2 firstSeal — kod start'ta değil, ilk mühürde doğar. Mevcut kodu döndürür.
 */
export async function ensureCheckinCodeAtStart(ritualId) {
  const ritualResult = await pool.query(
    `SELECT id, checkin_keyword, checkin_code_generated_at, start_time, status
     FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (ritualResult.rows.length === 0) {
    return { ok: false, status: 404, error: 'Ritual not found' };
  }
  const ritual = ritualResult.rows[0];
  if (ritual.checkin_code_generated_at && ritual.checkin_keyword) {
    return { ok: true, code: ritual.checkin_keyword, already: true };
  }
  const now = new Date();
  if (now < new Date(ritual.start_time)) {
    return { ok: false, status: 400, error: 'Code is generated on first seal at or after start' };
  }
  return { ok: false, status: 400, error: 'Table not opened yet — awaiting first seal' };
}

async function isVenueStaffForRitual(ritualId, userId) {
  const r = await pool.query(
    `SELECT 1
     FROM rituals r
     JOIN venue_managers vm ON vm.venue_id = r.venue_id AND vm.user_id = $2
     WHERE r.id = $1 AND r.venue_id IS NOT NULL
     LIMIT 1`,
    [ritualId, userId]
  );
  return r.rows.length > 0;
}

/**
 * v2 §2 — kod yalnız mühürlü katılımcıya (relay ekranı). Host/escrow açma kaldırıldı.
 */
export async function revealCheckinKeyword(ritualId, actorUserId, _ignoredKeyword) {
  const { displayCode } = await import('./checkinCodeService.js');
  const att = await pool.query(
    `SELECT checkin_at, checkin_phase FROM ritual_attendance
     WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, actorUserId]
  );
  if (!att.rows[0]?.checkin_at || att.rows[0]?.checkin_phase !== 'sealed') {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        error: 'Check-in code visible only after you are sealed at the table',
        first_seal_required: true,
      },
    };
  }
  const ritualResult = await pool.query(
    `SELECT id, checkin_keyword, keyword_revealed_at FROM rituals WHERE id = $1`,
    [ritualId]
  );
  if (!ritualResult.rows[0]?.checkin_keyword) {
    return {
      ok: false,
      status: 400,
      body: { success: false, error: 'Table code not born yet — first seal opens the table' },
    };
  }
  const code = ritualResult.rows[0].checkin_keyword;
  return {
    ok: true,
    data: {
      ritual_id: ritualResult.rows[0].id,
      keyword_revealed_at: ritualResult.rows[0].keyword_revealed_at,
      revealed: true,
      code,
      code_display: displayCode(code, 'tr'),
      code_display_en: displayCode(code, 'en'),
    },
  };
}

/**
 * Escrow removed — firstSeal model (sonMD). Kept as no-ops for import safety.
 */
export async function offerKeywordEscrow(_ritualId) {
  return { ok: true, skipped: true, reason: 'escrow_removed' };
}

export async function claimKeywordEscrow(_ritualId, _userId, _opts = {}) {
  return {
    ok: false,
    status: 410,
    body: { success: false, error: 'Escrow removed — use first seal at table', code: 'ESCROW_REMOVED' },
  };
}

/**
 * Host manual check-in — KALDIRILDI (sonMD 30 Tem).
 * Tek yol: PENDING_WITNESS. Host mühürleme yetkisi yok.
 */
export async function approveManualCheckIn(_ritualId, _hostUserId, _participantUserId) {
  return {
    ok: false,
    status: 410,
    body: {
      success: false,
      error: 'Host manual check-in removed — use PENDING_WITNESS (first seal / peer witness)',
      code: 'AIS_MANUAL_REMOVED',
    },
  };
}

/** Kapı kapanınca check-in yapmayanları no-show işaretle (son-part.md §3.1) */
export async function closeCheckinDoorsForLiveRituals() {
  const liveRituals = await pool.query(
    `SELECT id, start_time, duration, is_home, location_type,
            gate_override_until, departure_at
     FROM rituals
     WHERE status::text IN ('live', 'prelobby', 'active')
       AND start_time <= NOW()`
  );

  let marked = 0;
  const now = new Date();

  for (const ritual of liveRituals.rows) {
    const doorClose = getDoorCloseTime(ritual);
    if (now <= doorClose) continue;

    if (ritual.is_home) {
      const sealed = await pool.query(
        `SELECT COUNT(*)::int AS n
         FROM ritual_attendance
         WHERE ritual_id = $1 AND checkin_at IS NOT NULL`,
        [ritual.id]
      );
      if (Number(sealed.rows[0]?.n || 0) === 0) {
        await collapseHomeEmptyDoor(ritual.id);
        continue;
      }
    }

    const hostRow = await pool.query(
      `SELECT r.host_id, ra.checkin_at
       FROM rituals r
       LEFT JOIN ritual_attendance ra ON ra.ritual_id = r.id AND ra.user_id = r.host_id
       WHERE r.id = $1`,
      [ritual.id]
    );
    const hostId = hostRow.rows[0]?.host_id;
    const hostCheckedIn = hostRow.rows[0]?.checkin_at != null;

    if (hostId && !hostCheckedIn) {
      await collapseRitualHostNoShow(ritual.id, hostId);
      continue;
    }

    const transitioned = await pool.query(
      `UPDATE ritual_attendance
       SET status = 'no_show'
       WHERE ritual_id = $1
         AND checkin_at IS NULL
         AND COALESCE(checkin_phase, '') <> 'pending_witness'
         AND status = 'confirmed'
       RETURNING user_id`,
      [ritual.id]
    );

    for (const row of transitioned.rows) {
      marked += 1;
      try {
        await enqueue(
          'rs-bypass',
          { action: 'no_show', user_id: row.user_id, ritual_id: ritual.id },
          { priority: 1, jobId: `rs-bypass:no_show:${ritual.id}:${row.user_id}` }
        );
      } catch (e) {
        console.warn('enqueue rs-bypass no_show (door close)', e.message);
      }
    }

    // sonMD §3: pending onaysız + kapı+grace → no-show yok, unverified MOD
    const graceMin = Number(LOCAL_CONFIG.witness?.PENDING_GRACE_MIN ?? 10);
    const graceUntil = new Date(doorClose.getTime() + graceMin * 60000);
    if (now > graceUntil) {
      const pendingRows = await pool.query(
        `SELECT user_id FROM ritual_attendance
         WHERE ritual_id = $1
           AND checkin_phase = 'pending_witness'
           AND checkin_at IS NULL`,
        [ritual.id]
      );
      for (const prow of pendingRows.rows) {
        try {
          const { enqueueUnverifiedCheckinReview } = await import('./modEngine.js');
          await enqueueUnverifiedCheckinReview(prow.user_id, ritual.id, {
            reason: 'door_closed_pending_unresolved',
          });
        } catch (e) {
          console.warn('enqueue unverified_checkin', e.message);
        }
      }
    }
  }

  return { marked };
}

/**
 * Master Parametre §2 — “hep radius sınırı + sıfır memory” MOD sinyali.
 * @returns {{ hit: boolean, edge_hits: number, threshold: number, window_days: number }}
 */
export async function evaluateGpsEdgeZeroMemoryPattern(userId) {
  const edge = LOCAL_CONFIG.checkin.GPS_EDGE;
  const windowDays = edge.WINDOW_DAYS ?? 30;
  const minHits = edge.MIN_HITS ?? 3;
  const margin = edge.MARGIN_M ?? 5;
  const ratioMin = edge.RATIO_MIN ?? 0.9;

  const r = await pool.query(
    `SELECT COUNT(*)::int AS c
     FROM ritual_attendance ra
     WHERE ra.user_id = $1
       AND ra.checkin_at IS NOT NULL
       AND ra.checkin_at >= NOW() - ($2::text || ' days')::interval
       AND ra.gps_distance_m IS NOT NULL
       AND ra.checkin_radius_m IS NOT NULL
       AND ra.checkin_radius_m > 0
       AND ra.gps_distance_m <= ra.checkin_radius_m
       AND (
         ra.gps_distance_m >= GREATEST(0, ra.checkin_radius_m - $3)
         OR (ra.gps_distance_m / ra.checkin_radius_m) >= $4
       )
       AND NOT EXISTS (
         SELECT 1 FROM memories m
         WHERE m.ritual_id = ra.ritual_id
           AND m.user_id = ra.user_id
           AND COALESCE(m.status, 'published') <> 'deleted'
       )`,
    [userId, String(windowDays), margin, ratioMin]
  );

  const edgeHits = Number(r.rows[0]?.c || 0);
  return {
    hit: edgeHits >= minHits,
    edge_hits: edgeHits,
    threshold: minHits,
    window_days: windowDays,
  };
}

export { isGpsEdgeDistance };
