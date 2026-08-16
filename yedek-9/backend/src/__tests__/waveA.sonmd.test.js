import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG, {
  validateRitualCapacity,
  getCategorySoftCap,
} from '../config/localConfig.js';

describe('sonMD Wave A — capacity / walk-in / no_peer', () => {
  test('CUSTOM_MAX_CAP is 40 absolute', () => {
    expect(LOCAL_CONFIG.ritual.CUSTOM_MAX_CAP).toBe(40);
  });

  test('WALK_IN_DAILY_CAP unlimited (0)', () => {
    expect(LOCAL_CONFIG.ritual.WALK_IN_DAILY_CAP).toBe(0);
  });

  test('hard reject above 40 for custom', () => {
    const r = validateRitualCapacity(41, 'Kahve', { locationType: 'custom' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('CAPACITY_ABSOLUTE_MAX');
  });

  test('soft warning when over category soft_max', () => {
    const r = validateRitualCapacity(20, 'Kahve', { locationType: 'custom' });
    expect(r.ok).toBe(true);
    expect(r.soft_warning).toBeTruthy();
    expect(r.soft_warning.code).toBe('SOFT_CAPACITY_EXCEEDED');
  });

  test('within soft band has no warning', () => {
    const r = validateRitualCapacity(8, 'Kahve', { locationType: 'custom' });
    expect(r.ok).toBe(true);
    expect(r.soft_warning).toBeNull();
  });

  test('category soft alias maps kahve', () => {
    expect(getCategorySoftCap('Kahve').key).toBe('kahve_bulusmasi');
    expect(getCategorySoftCap('Kahve').soft_max).toBe(12);
  });

  test('no_peer config primary; rs.solo removed', () => {
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_DAMPENER).toBe(0.35);
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_CEILING).toBe(7.5);
    expect(LOCAL_CONFIG.rs.no_peer.CF_SELF_NO_PEER_W).toBe(0.5);
    expect(LOCAL_CONFIG.rs.solo).toBeUndefined();
  });

  test('AIS_MANUAL disabled', () => {
    expect(LOCAL_CONFIG.checkin.AIS_MANUAL_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.checkin.AIS_MANUAL_FALLBACK).toBeUndefined();
  });

  test('RS visibility ring rules', () => {
    expect(LOCAL_CONFIG.rs.visibility.MIN_RITUALS_FOR_RING).toBe(10);
    expect(LOCAL_CONFIG.rs.visibility.TOGGLE_DAYS).toBe(30);
    expect(LOCAL_CONFIG.rs.visibility.PUBLIC_RAW_SCORE).toBe(false);
  });
});
