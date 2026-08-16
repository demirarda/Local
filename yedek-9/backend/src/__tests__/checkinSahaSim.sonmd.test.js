import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  classifyDoorSealSeconds,
  walkinBirthMinutes,
  stripFollowHit,
  sahaLocationLocks,
  runTamGunSahaSim,
} from '../services/checkinSahaSim.js';
import { getCheckinWindowInfo } from '../services/checkinService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('check-in §9–§10 saha sim %100', () => {
  test('tam-gün sim + 30dk stres + metro/vapur/ev/trol kilitleri geçer', () => {
    const sim = runTamGunSahaSim();
    expect(sim.ok).toBe(true);
    expect(sim.stres30.duration_min).toBe(30);
    expect(sim.stres30.kapi_min).toBe(10);
    expect(sim.stres30.late.ais).toBe(0.85);
    expect(sim.locks.metro.location_type).toBe('moving');
    expect(sim.locks.vapur.location_type).toBe('ferry');
    expect(sim.locks.ev.is_home).toBe(true);
    expect(sim.locks.trol.hard_block).toBe(false);
  });

  test('kapı→mühür <20 on_target · >45 C1 alarm', () => {
    expect(LOCAL_CONFIG.checkin.DOOR_SEAL_TARGET_S).toBe(20);
    expect(LOCAL_CONFIG.checkin.DOOR_SEAL_ALARM_S).toBe(45);
    expect(classifyDoorSealSeconds(14).band).toBe('on_target');
    expect(classifyDoorSealSeconds(30).band).toBe('watch');
    expect(classifyDoorSealSeconds(50).band).toBe('c1_alarm');
  });

  test('walk-in dakika + şerit 15dk takip', () => {
    expect(walkinBirthMinutes('2026-08-16T10:00:00Z', '2026-08-16T10:07:00Z')).toBe(7);
    expect(LOCAL_CONFIG.checkin.STRIP_FOLLOW_MIN).toBe(15);
    expect(
      stripFollowHit('2026-08-16T18:00:00Z', '2026-08-16T18:14:00Z', 15)
    ).toBe(true);
    expect(
      stripFollowHit('2026-08-16T18:00:00Z', '2026-08-16T18:16:00Z', 15)
    ).toBe(false);
  });

  test('30dk stres: kapı start−15 açık, 11dk no-show', () => {
    const ritual = { start_time: new Date('2026-08-16T12:00:00Z'), duration: 30 };
    const early = getCheckinWindowInfo(ritual, new Date('2026-08-16T11:50:00Z'));
    expect(early.door_open).toBe(true);
    const afterKapı = getCheckinWindowInfo(ritual, new Date('2026-08-16T12:11:00Z'));
    expect(afterKapı.door_open).toBe(false);
  });

  test('saha location locks match GPS yıldızları', () => {
    const locks = sahaLocationLocks();
    expect(locks.metro.radius_m).toBe(15);
    expect(locks.vapur.radius_m).toBe(50);
    expect(locks.ev.radius_m).toBe(30);
    expect(locks.vapur.departure_pad_min).toBe(5);
  });

  test('funnel + firstSeal + panel wire pivot saha', () => {
    const funnelSrc = readFileSync(join(root, 'services/checkinFunnelService.js'), 'utf8');
    const sealSrc = readFileSync(join(root, 'services/firstSealService.js'), 'utf8');
    const notifSrc = readFileSync(join(root, 'services/notifications.js'), 'utf8');
    const checkinSrc = readFileSync(join(root, 'services/checkinService.js'), 'utf8');
    expect(funnelSrc).toContain('getPivotSahaMetrics');
    expect(funnelSrc).toContain('culture_path');
    expect(funnelSrc).toContain('phone_dead');
    expect(funnelSrc).toContain('strip_open');
    expect(funnelSrc).toContain('pivot_saha');
    expect(sealSrc).toContain("event: 'strip_open'");
    expect(notifSrc).toContain('masa yaşıyor');
    expect(checkinSrc).toContain('gate_s');
    expect(checkinSrc).toContain('culturePath');
  });

  test('mobile: 12 madde kart + gate_ms + culture_path', () => {
    const mobileRoot = join(__dirname, '../../../mobile/src');
    const checkinUi = readFileSync(join(mobileRoot, 'screens/RitualCheckInScreen.js'), 'utf8');
    const modSrc = readFileSync(join(mobileRoot, 'screens/ModerationScreen.js'), 'utf8');
    expect(checkinUi).toContain('gate_ms');
    expect(checkinUi).toContain('culture_path');
    expect(checkinUi).toContain("recordCheckinFunnelClient(ritualId, 'culture_path'");
    expect(modSrc).toContain('pivot_saha');
    expect(modSrc).toContain('(funnel?.pivot_checklist || []).map');
    expect(modSrc).not.toContain('pivot_checklist || []).slice(0, 8)');
    expect(LOCAL_CONFIG.checkinPivotChecklist).toHaveLength(12);
  });
});
