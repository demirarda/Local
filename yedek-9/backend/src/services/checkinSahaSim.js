/**
 * LOCAL_CheckIn_Sistemi §9–§10 saha sim — tam-gün + 30dk stres + metro/vapur/ev/trol.
 * Saf fonksiyonlar; DB yok. Funnel canlı metrikleri checkinFunnelService'te.
 */
import LOCAL_CONFIG, {
  computeAis,
  getKapiMinutes,
} from '../config/localConfig.js';

export function classifyDoorSealSeconds(seconds) {
  const s = Number(seconds);
  const target = Number(LOCAL_CONFIG.checkin.DOOR_SEAL_TARGET_S ?? 20);
  const alarm = Number(LOCAL_CONFIG.checkin.DOOR_SEAL_ALARM_S ?? 45);
  if (!Number.isFinite(s) || s < 0) return { band: 'unknown', target, alarm };
  if (s > alarm) return { band: 'c1_alarm', target, alarm };
  if (s <= target) return { band: 'on_target', target, alarm };
  return { band: 'watch', target, alarm };
}

export function walkinBirthMinutes(createdAt, firstSealedAt) {
  const a = new Date(createdAt).getTime();
  const b = new Date(firstSealedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

export function stripFollowHit(openedAt, actionAt, windowMin) {
  const w = Number(windowMin ?? LOCAL_CONFIG.checkin.STRIP_FOLLOW_MIN ?? 15);
  const a = new Date(openedAt).getTime();
  const b = new Date(actionAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return false;
  return b - a <= w * 60000;
}

/** §10 metro / vapur / ev / trol kilitleri */
export function sahaLocationLocks() {
  const radii = LOCAL_CONFIG.checkin.GPS_RADIUS_METERS;
  return {
    metro: {
      location_type: 'moving',
      radius_m: Number(radii.moving),
    },
    vapur: {
      location_type: 'ferry',
      radius_m: Number(radii.ferry ?? radii.scheduled ?? radii.venue),
      departure_pad_min: Number(LOCAL_CONFIG.checkin.DEPARTURE_GATE_PAD_MIN || 5),
    },
    ev: {
      location_type: 'custom',
      radius_m: Number(radii.custom),
      is_home: true,
      empty_door_no_host_penalty: true,
    },
    trol: {
      mock_or_integrity: 'pending_witness',
      hard_block: Boolean(LOCAL_CONFIG.checkin.INTEGRITY?.BLOCK_ON_PLAY_INTEGRITY_FAIL),
    },
  };
}

/**
 * Tam-gün saha sim — bir günün kapı sınıfları tek geçişte.
 * 30dk stres: duration=30 kapı 10dk, late AIS 0.85, door start−15 açık.
 */
export function runTamGunSahaSim() {
  const locks = sahaLocationLocks();
  const door14 = classifyDoorSealSeconds(14);
  const door50 = classifyDoorSealSeconds(50);
  const walkin = walkinBirthMinutes('2026-08-16T12:00:00Z', '2026-08-16T12:12:00Z');
  const strip = stripFollowHit(
    '2026-08-16T18:00:00Z',
    '2026-08-16T18:08:00Z',
    LOCAL_CONFIG.checkin.STRIP_FOLLOW_MIN
  );
  const stres30 = {
    duration_min: 30,
    kapi_min: getKapiMinutes(30),
    late: computeAis(8, 30),
    no_show: computeAis(11, 30),
  };
  return {
    ok:
      door14.band === 'on_target' &&
      door50.band === 'c1_alarm' &&
      walkin === 12 &&
      strip === true &&
      stres30.kapi_min === 10 &&
      stres30.late.ais === LOCAL_CONFIG.checkin.AIS_LATE &&
      stres30.no_show.status === 'no_show' &&
      locks.metro.radius_m === 15 &&
      locks.vapur.radius_m === 50 &&
      locks.ev.radius_m === 30 &&
      locks.trol.hard_block === false,
    door14,
    door50,
    walkin_min: walkin,
    strip_follow: strip,
    stres30,
    locks,
  };
}

export default {
  classifyDoorSealSeconds,
  walkinBirthMinutes,
  stripFollowHit,
  sahaLocationLocks,
  runTamGunSahaSim,
};
