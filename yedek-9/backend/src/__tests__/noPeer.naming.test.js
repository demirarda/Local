/**
 * sonMD §4 — no_peer naming: config/kodda `solo` RS path YASAK.
 * Exception: memory_scope DB enum `solo` = WINDOW legacy (audience map).
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import { toAudience, audienceToLegacyScope } from '../services/waveBSocial.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('no_peer naming leftovers', () => {
  test('rs.solo config key removed', () => {
    expect(LOCAL_CONFIG.rs.no_peer).toBeTruthy();
    expect(LOCAL_CONFIG.rs.solo).toBeUndefined();
  });

  test('rsEngine uses applyNoPeerEngagementGate · no rs.solo fallback', () => {
    const src = readFileSync(join(__dirname, '../services/rsEngine.js'), 'utf8');
    expect(src).toMatch(/applyNoPeerEngagementGate/);
    expect(src).not.toMatch(/rs\.solo/);
    expect(src).not.toMatch(/applySoloEngagementGate/);
    expect(src).toMatch(/noPeerPath/);
  });

  test('publicConfig no_peer only', () => {
    const src = readFileSync(join(__dirname, '../services/publicConfigService.js'), 'utf8');
    expect(src).toMatch(/no_peer:/);
    expect(src).not.toMatch(/rs\.solo/);
  });

  test('memory_scope solo remains WINDOW legacy (not RS path)', () => {
    expect(toAudience('solo')).toBe('WINDOW');
    expect(audienceToLegacyScope('WINDOW')).toBe('solo');
    expect(LOCAL_CONFIG.memory_audience.LEGACY_MAP.solo).toBe('WINDOW');
  });
});
