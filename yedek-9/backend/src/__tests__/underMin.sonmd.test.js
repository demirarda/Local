import { describe, test, expect } from '@jest/globals';
import { resolveMinCapacity } from '../services/underMinGate.js';
import LOCAL_CONFIG from '../config/localConfig.js';

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
});
