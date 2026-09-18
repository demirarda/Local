import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveMinCapacity } from '../services/underMinGate.js';
import LOCAL_CONFIG from '../config/localConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('UNDER_MIN gate helpers', () => {
  test('MIN_SIZE floor is 3', () => {
    expect(LOCAL_CONFIG.ritual.MIN_SIZE).toBe(3);
  });

  test('resolveMinCapacity uses category soft_min (takim_spor ≥6)', () => {
    expect(resolveMinCapacity({ title: 'halisaha mac' })).toBe(6);
    expect(resolveMinCapacity({ title: 'Kahve sohbeti' })).toBe(3);
    expect(resolveMinCapacity({ category_label: 'takim_spor' })).toBe(6);
  });

  test('FIND_NOTE_MAX_CH is 60', () => {
    expect(LOCAL_CONFIG.ritual.FIND_NOTE_MAX_CH).toBe(60);
  });

  test('§8 UNDER_MIN blocks all FB types including P2R/P2Z/P2C/RQ', () => {
    const src = readFileSync(join(__dirname, '../api/feedback.js'), 'utf8');
    expect(src).toContain('assertFeedbackNotUnderMin');
    expect(src).toContain('denyIfUnderMin');
    expect(src).toContain('if (await denyIfUnderMin(res, ritual_id)) return;');
    expect(src).toContain('HOST_P2V_FORBIDDEN');
    expect(src).toContain('host_p2v_forbidden');
  });
});
