/**
 * v2 §2 firstSeal — kod ilk mühürle doğar; PENDING_WITNESS iken kod/window doğmaz.
 */
import crypto from 'crypto';
import pool from '../config/database.js';
import LOCAL_CONFIG from '../config/localConfig.js';
import { generateUniqueCheckinCode } from './checkinCodeService.js';
import { computeAis, getGpsRadiusMeters } from '../config/localConfig.js';
import { encryptJsonAtRest } from '../utils/piiCrypto.js';
import { runPostCheckinJobs } from './checkinPostCheckin.js';
import { pickFirstSealOpenerId } from '../utils/firstSealOpener.js';

function ritualLockKey(ritualId) {
  return `ritual_first_seal_${ritualId}`;
}

function doorCloseAt(ritual) {
  const start = new Date(ritual.start_time);
  const pct = Number(LOCAL_CONFIG.checkin?.KAPI_PCT ?? 0.2);
  const min = Number(LOCAL_CONFIG.checkin?.KAPI_MIN_MINUTES ?? 10);
  const max = Number(LOCAL_CONFIG.checkin?.KAPI_MAX_MINUTES ?? 60);
  const duration = Number(ritual.duration) || 60;
  const kapiMin = Math.max(min, Math.min(max, Math.round(duration * pct)));
  return new Date(start.getTime() + kapiMin * 60000);
}

async function noteWitnessForSicil(witnessUserId, ritualId) {
  try {
    const { maybeEnqueueFalseWitnessReview } = await import('./modEngine.js');
    await maybeEnqueueFalseWitnessReview(witnessUserId, ritualId);
  } catch (_e) {
    /* best effort — sicil check-in'i durdurmaz */
  }
}

/**
 * PENDING_WITNESS eşik — ACTIVE_SCHEME=LEGACY_2_TIER (default).
 * FUTURE_3_TIER yalnız FUTURE_3_TIER_ENABLED=true + founder/pivot ile açılır.
 */
export function witnessThresholdForSealedCount(sealedCount) {
  const w = LOCAL_CONFIG.witness || {};
  const n = Number(sealedCount) || 0;
  const useFuture =
    w.FUTURE_3_TIER_ENABLED === true && w.ACTIVE_SCHEME === 'FUTURE_3_TIER';
  if (useFuture) {
    const f = w.FUTURE_3_TIER || { le3: 1, mid_lo: 4, mid_hi: 12, mid: 2, ge13: 3 };
    if (n <= 3) return Number(f.le3 ?? 1);
    if (n >= Number(f.mid_lo ?? 4) && n <= Number(f.mid_hi ?? 12)) return Number(f.mid ?? 2);
    return Number(f.ge13 ?? 3);
  }
  const t = w.THRESHOLD || { le3: 1, ge4: 2 };
  return n <= 3 ? Number(t.le3 ?? 1) : Number(t.ge4 ?? 2);
}

export async function countSealedAtRitual(ritualId, client = pool) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM ritual_attendance
     WHERE ritual_id = $1 AND checkin_at IS NOT NULL AND checkin_phase = 'sealed'`,
    [ritualId]
  );
  return Number(r.rows[0]?.c || 0);
}

async function emitRitualOpened(ritual, openNote) {
  try {
    const { notifyRitualOpened } = await import('./notifications.js');
    await notifyRitualOpened(ritual, { openNote });
  } catch (_e) {
    /* best effort */
  }
  try {
    const unsealed = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ritual_attendance
       WHERE ritual_id = $1 AND status = 'confirmed'
         AND (checkin_at IS NULL OR COALESCE(checkin_phase, '') <> 'sealed')`,
      [ritual.id]
    );
    const { recordCheckinFunnelEvent } = await import('./checkinFunnelService.js');
    await recordCheckinFunnelEvent({
      ritualId: ritual.id,
      userId: ritual.first_sealed_by || null,
      event: 'strip_open',
      meta: {
        prelobby_unsealed: Number(unsealed.rows[0]?.c || 0),
        copy: 'masa_yasiyor',
      },
    });
  } catch (_e) {
    /* analytics must not block birth */
  }
}

/**
 * Birth code + table open on first successful seal (not on PENDING).
 * EVENT ≥ EVENT_CODE_BAN_CAPACITY: kod YASAK — masa totem/personel ile açılır.
 */
export async function birthCheckinCodeIfNeeded(client, ritual, actorUserId, openNote = null, actorAttemptAt = null) {
  if (ritual.checkin_keyword && ritual.checkin_code_generated_at) {
    return { code: ritual.checkin_keyword, born: false };
  }
  if (ritual.first_sealed_at && ritual.code_banned) {
    return { code: null, born: false, code_banned: true };
  }

  const hostAttempt = ritual.host_id
    ? await client.query(
        `SELECT checkin_attempt_at, checkin_phase
         FROM ritual_attendance
         WHERE ritual_id = $1 AND user_id = $2
         LIMIT 1`,
        [ritual.id, ritual.host_id]
      )
    : { rows: [] };
  const openerUserId = pickFirstSealOpenerId(
    ritual,
    actorUserId,
    hostAttempt.rows[0] || null,
    actorAttemptAt
  );

  const banCap = Number(
    LOCAL_CONFIG.checkin?.EVENT_CODE_BAN_CAPACITY ?? LOCAL_CONFIG.checkin?.CODE_BAN_MIN_SIZE ?? 100
  );
  let codeBanned = false;
  const capacity = Number(ritual.capacity) || 0;
  if (capacity >= banCap && (ritual.event_group_id || String(ritual.origin || '') === 'VEN_EVENT')) {
    codeBanned = true;
  } else if (ritual.event_group_id) {
    try {
      const eg = await client.query(
        `SELECT capacity_total FROM ritual_event_groups WHERE id = $1`,
        [ritual.event_group_id]
      );
      if (Number(eg.rows[0]?.capacity_total || 0) >= banCap) codeBanned = true;
    } catch (_e) {
      /* column may be absent in older schemas */
    }
  }

  if (codeBanned) {
    const upd = await client.query(
      `UPDATE rituals
       SET checkin_code_generated_at = NOW(),
           keyword_revealed_at = COALESCE(keyword_revealed_at, NOW()),
           first_sealed_at = COALESCE(first_sealed_at, NOW()),
           first_sealed_by = COALESCE(first_sealed_by, $2),
           open_note = COALESCE(open_note, $3),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [ritual.id, openerUserId, openNote]
    );
    const row = upd.rows[0];
    await emitRitualOpened(row, row.open_note);
    return { code: null, born: true, code_banned: true, ritual: row };
  }

  const code = await generateUniqueCheckinCode(client, ritual);

  const upd = await client.query(
    `UPDATE rituals
     SET checkin_keyword = $2,
         checkin_code_generated_at = NOW(),
         keyword_revealed_at = COALESCE(keyword_revealed_at, NOW()),
         first_sealed_at = COALESCE(first_sealed_at, NOW()),
         first_sealed_by = COALESCE(first_sealed_by, $3),
        open_note = COALESCE(open_note, $4),
        updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [ritual.id, code, openerUserId, openNote]
  );
  const row = upd.rows[0];
  await emitRitualOpened(row, row.open_note);
  return { code, born: true, ritual: row };
}

export async function finalizeSeal({
  client,
  ritualId,
  userId,
  ritual,
  userLat,
  userLng,
  distanceMeters,
  radius,
  aisScore,
  aisStatus,
  now,
}) {
  const encryptedGps = encryptJsonAtRest({
    lat: userLat,
    lng: userLng,
    ts: now.toISOString(),
    distance_m: Math.round(distanceMeters),
    radius_m: radius,
  });
  const distRounded = Math.round(distanceMeters);
  const update = await client.query(
    `UPDATE ritual_attendance
     SET checkin_at = CURRENT_TIMESTAMP,
         checkin_gps_lat = $3,
         checkin_gps_lng = $4,
         checkin_gps_encrypted = $5,
         checkin_keyword_ok = true,
         checkin_manual_fallback = false,
         ais_score = $6,
         gps_distance_m = $7,
         checkin_radius_m = $8,
         checkin_phase = 'sealed',
         witness_required = NULL,
         witness_count = 0,
         checkin_attempt_at = NULL,
         location_suspect = false,
         status = 'confirmed'
     WHERE ritual_id = $1 AND user_id = $2
     RETURNING *`,
    [ritualId, userId, userLat, userLng, encryptedGps, aisScore, distRounded, radius]
  );
  return update.rows[0];
}

export async function setPendingWitness({
  client,
  ritualId,
  userId,
  userLat,
  userLng,
  distanceMeters,
  radius,
  locationSuspect,
  now,
  ritual,
}) {
  const sealed = await countSealedAtRitual(ritualId, client);
  const required = witnessThresholdForSealedCount(sealed);
  const lateMinutes = (now - new Date(ritual.start_time)) / 60000;
  const ais = computeAis(lateMinutes, Number(ritual.duration) || 60);
  const attemptAis = ais.ais;

  await client.query(
    `UPDATE ritual_attendance
     SET checkin_phase = 'pending_witness',
         witness_required = $3,
         witness_count = 0,
         checkin_attempt_at = COALESCE(checkin_attempt_at, NOW()),
         checkin_gps_lat = $4,
         checkin_gps_lng = $5,
         gps_distance_m = $6,
         checkin_radius_m = $7,
         location_suspect = $8,
         ais_score = $9,
         status = 'confirmed'
     WHERE ritual_id = $1 AND user_id = $2 AND checkin_at IS NULL`,
    [
      ritualId,
      userId,
      required,
      userLat != null && Number.isFinite(Number(userLat)) ? Number(userLat) : null,
      userLng != null && Number.isFinite(Number(userLng)) ? Number(userLng) : null,
      Math.round(Number(distanceMeters) || 0),
      radius,
      Boolean(locationSuspect),
      attemptAis,
    ]
  );

  return {
    pending_witness: true,
    witness_required: required,
    witness_count: 0,
    ais: attemptAis,
    code_born: false,
  };
}

/**
 * Advisory-lock first seal path inside transaction.
 */
export async function applyFirstSealBirth(client, ritualId, userId, openNote = null, actorAttemptAt = null) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [ritualLockKey(ritualId)]);
  const r = await client.query(`SELECT * FROM rituals WHERE id = $1 FOR UPDATE`, [ritualId]);
  if (!r.rows[0]) return { ok: false, status: 404, error: 'Ritual not found' };
  return birthCheckinCodeIfNeeded(client, r.rows[0], userId, openNote, actorAttemptAt);
}

export async function witnessPendingCheckin(ritualId, witnessUserId, subjectUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const witnessAtt = await client.query(
      `SELECT checkin_at, checkin_phase FROM ritual_attendance
       WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, witnessUserId]
    );
    if (!witnessAtt.rows[0]?.checkin_at || witnessAtt.rows[0]?.checkin_phase !== 'sealed') {
      await client.query('ROLLBACK');
      return { ok: false, status: 403, body: { success: false, error: 'Witness must be sealed at table' } };
    }

    const isStaff = await client.query(
      `SELECT 1 FROM rituals r
       JOIN venue_managers vm ON vm.venue_id = r.venue_id AND vm.user_id = $2
       WHERE r.id = $1 AND r.venue_id IS NOT NULL LIMIT 1`,
      [ritualId, witnessUserId]
    );
    if (isStaff.rows.length > 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 403, body: { success: false, error: 'Venue staff cannot witness' } };
    }

    const subj = await client.query(
      `SELECT * FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2 FOR UPDATE`,
      [ritualId, subjectUserId]
    );
    const row = subj.rows[0];
    if (!row || row.checkin_phase !== 'pending_witness') {
      await client.query('ROLLBACK');
      return { ok: false, status: 400, body: { success: false, error: 'Subject is not pending witness' } };
    }

    await client.query(
      `INSERT INTO ritual_checkin_witnesses (ritual_id, subject_user_id, witness_user_id)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [ritualId, subjectUserId, witnessUserId]
    );

    const countR = await client.query(
      `SELECT COUNT(*)::int AS c FROM ritual_checkin_witnesses
       WHERE ritual_id = $1 AND subject_user_id = $2`,
      [ritualId, subjectUserId]
    );
    const witnessCount = Number(countR.rows[0]?.c || 0);
    const required = Number(row.witness_required) || 1;

    await client.query(
      `UPDATE ritual_attendance SET witness_count = $3 WHERE ritual_id = $1 AND user_id = $2`,
      [ritualId, subjectUserId, witnessCount]
    );

    if (witnessCount < required) {
      await client.query('COMMIT');
      await noteWitnessForSicil(witnessUserId, ritualId);
      return {
        ok: true,
        data: { witness_count: witnessCount, witness_required: required, sealed: false },
      };
    }

    const ritualR = await client.query(`SELECT * FROM rituals WHERE id = $1`, [ritualId]);
    const ritual = ritualR.rows[0];
    const now = new Date();

    // §2 PENDING_GRACE_MIN: deneme kapı içindeyse onay kapı+grace'e kadar mühür basar.
    const attemptAt = row.checkin_attempt_at ? new Date(row.checkin_attempt_at) : null;
    const doorClose = doorCloseAt(ritual);
    const graceMin = Number(LOCAL_CONFIG.witness?.PENDING_GRACE_MIN ?? 10);
    const graceUntil = new Date(doorClose.getTime() + graceMin * 60000);
    const attemptInDoor = !!attemptAt && attemptAt <= doorClose;
    const canSealWithGrace = attemptInDoor && now <= graceUntil;
    if (!canSealWithGrace) {
      try {
        const { enqueueUnverifiedCheckinReview } = await import('./modEngine.js');
        await enqueueUnverifiedCheckinReview(subjectUserId, ritualId, {
          reason: 'PENDING_WITNESS_GRACE_EXPIRED',
        });
      } catch (_e) {
        // best effort
      }
      await client.query('COMMIT');
      await noteWitnessForSicil(witnessUserId, ritualId);
      return {
        ok: false,
        status: 410,
        body: {
          success: false,
          error: 'Witness grace expired; check-in not sealed',
          code: 'PENDING_WITNESS_GRACE_EXPIRED',
          unverified_checkin: true,
        },
      };
    }

    await applyFirstSealBirth(client, ritualId, subjectUserId);

    const lateMinutes = row.checkin_attempt_at
      ? (new Date(row.checkin_attempt_at) - new Date(ritual.start_time)) / 60000
      : 0;
    const ais = computeAis(lateMinutes, Number(ritual.duration) || 60);

    const attendance = await finalizeSeal({
      client,
      ritualId,
      userId: subjectUserId,
      ritual,
      userLat: row.checkin_gps_lat,
      userLng: row.checkin_gps_lng,
      distanceMeters: row.gps_distance_m || 0,
      radius: row.checkin_radius_m || getGpsRadiusMeters(ritual.location_type),
      aisScore: ais.ais,
      aisStatus: ais.status,
      now,
    });

    await client.query('COMMIT');
    await runPostCheckinJobs(ritualId, subjectUserId);
    await noteWitnessForSicil(witnessUserId, ritualId);
    try {
      const { recordCheckinFunnelEvent } = await import('./checkinFunnelService.js');
      await recordCheckinFunnelEvent({
        ritualId,
        userId: subjectUserId,
        event: 'witness_approve',
        meta: { witness_user_id: witnessUserId, sealed: true },
      });
      await recordCheckinFunnelEvent({
        ritualId,
        userId: subjectUserId,
        event: 'seal',
        meta: { via: 'witness' },
      });
    } catch (_e) {
      /* non-fatal */
    }
    return {
      ok: true,
      data: { sealed: true, witness_count: witnessCount, attendance, ais: ais.ais },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function createLocalCheckinTag(ritualId, issuerUserId) {
  const att = await pool.query(
    `SELECT checkin_at, checkin_phase, checkin_gps_lat, checkin_gps_lng
     FROM ritual_attendance WHERE ritual_id = $1 AND user_id = $2`,
    [ritualId, issuerUserId]
  );
  if (!att.rows[0]?.checkin_at || att.rows[0]?.checkin_phase !== 'sealed') {
    return { ok: false, status: 403, body: { success: false, error: 'Only sealed participants can issue LOCAL-TAG' } };
  }
  const ttl = LOCAL_CONFIG.tag?.TTL_S ?? 30;
  const token = crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + ttl * 1000);
  const issuerLat =
    att.rows[0].checkin_gps_lat != null ? Number(att.rows[0].checkin_gps_lat) : null;
  const issuerLng =
    att.rows[0].checkin_gps_lng != null ? Number(att.rows[0].checkin_gps_lng) : null;
  await pool.query(
    `INSERT INTO ritual_local_checkin_tags
       (ritual_id, issuer_user_id, token_hash, expires_at, issuer_lat, issuer_lng)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      ritualId,
      issuerUserId,
      hashToken(token),
      expires,
      Number.isFinite(issuerLat) ? issuerLat : null,
      Number.isFinite(issuerLng) ? issuerLng : null,
    ]
  );
  return {
    ok: true,
    data: {
      token,
      expires_at: expires.toISOString(),
      ttl_s: ttl,
      physical_relay_only: true,
      proximity_m: Number(LOCAL_CONFIG.tag?.PHYSICAL_RELAY_RADIUS_M ?? 15),
      qr_payload: `local-tag:${token}`,
    },
  };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * LOCAL-TAG redeem — dijital yollama yasak: redeemer GPS, issuer GPS yarıçapında olmalı.
 */
export async function redeemLocalCheckinTag(ritualId, userId, token, { latitude, longitude } = {}) {
  if (!token) {
    return { ok: false, status: 400, body: { success: false, error: 'token required' } };
  }
  const r = await pool.query(
    `SELECT id, issuer_user_id, redeemed_by, expires_at, issuer_lat, issuer_lng
     FROM ritual_local_checkin_tags
     WHERE ritual_id = $1 AND token_hash = $2
     ORDER BY created_at DESC LIMIT 1`,
    [ritualId, hashToken(token)]
  );
  const row = r.rows[0];
  if (!row) {
    return { ok: false, status: 404, body: { success: false, error: 'Invalid or expired tag' } };
  }
  if (row.redeemed_by) {
    return { ok: false, status: 409, body: { success: false, error: 'Tag already redeemed' } };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, status: 410, body: { success: false, error: 'Tag expired' } };
  }

  const requireProx = LOCAL_CONFIG.relayBan?.TAG_REQUIRES_PROXIMITY !== false;
  if (requireProx) {
    const userLat = latitude != null ? Number(latitude) : NaN;
    const userLng = longitude != null ? Number(longitude) : NaN;
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return {
        ok: false,
        status: 400,
        body: {
          success: false,
          error: 'LOCAL-TAG redeem requires live GPS (digital relay forbidden)',
          code: 'DIGITAL_RELAY_FORBIDDEN',
          gps_required: true,
        },
      };
    }
    let anchorLat = row.issuer_lat != null ? Number(row.issuer_lat) : NaN;
    let anchorLng = row.issuer_lng != null ? Number(row.issuer_lng) : NaN;
    if (!Number.isFinite(anchorLat) || !Number.isFinite(anchorLng)) {
      const ritual = await pool.query(
        `SELECT location_lat, location_lng FROM rituals WHERE id = $1`,
        [ritualId]
      );
      anchorLat = Number(ritual.rows[0]?.location_lat);
      anchorLng = Number(ritual.rows[0]?.location_lng);
    }
    const radius = Number(LOCAL_CONFIG.tag?.PHYSICAL_RELAY_RADIUS_M ?? 15);
    if (Number.isFinite(anchorLat) && Number.isFinite(anchorLng)) {
      const dist = haversineM(userLat, userLng, anchorLat, anchorLng);
      if (dist > radius) {
        try {
          const { recordCheckinFunnelEvent } = await import('./checkinFunnelService.js');
          await recordCheckinFunnelEvent({
            ritualId,
            userId,
            event: 'code_relay_suspect',
            meta: { via: 'local_tag', distance_m: Math.round(dist), radius },
          });
        } catch (_e) {
          /* ignore */
        }
        return {
          ok: false,
          status: 403,
          body: {
            success: false,
            error: 'Too far from issuer — digital relay forbidden; stand next to them',
            code: 'DIGITAL_RELAY_FORBIDDEN',
            distance_meters: Math.round(dist),
            max_distance_meters: radius,
          },
        };
      }
    }
  }

  await pool.query(
    `UPDATE ritual_local_checkin_tags SET redeemed_by = $2, redeemed_at = NOW() WHERE id = $1`,
    [row.id, userId]
  );
  const ritualR = await pool.query(`SELECT checkin_keyword FROM rituals WHERE id = $1`, [ritualId]);
  return {
    ok: true,
    data: {
      checkin_keyword: ritualR.rows[0]?.checkin_keyword || null,
      relay_from: row.issuer_user_id,
      physical_relay_ok: true,
    },
  };
}

export default {
  witnessThresholdForSealedCount,
  birthCheckinCodeIfNeeded,
  applyFirstSealBirth,
  setPendingWitness,
  finalizeSeal,
  witnessPendingCheckin,
  createLocalCheckinTag,
  redeemLocalCheckinTag,
  pickFirstSealOpenerId,
};
