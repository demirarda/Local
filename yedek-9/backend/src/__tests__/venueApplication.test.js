import { describe, test, expect } from '@jest/globals';
import { validateApplicationPayload } from '../services/venueApplicationService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('venue application (F5 §9.1)', () => {
  test('requires business proof notes', () => {
    const r = validateApplicationPayload({
      business_name: 'Cafe Roma SRL',
      venue_name: 'Cafe Roma',
      city: 'Milano',
      proof_notes: 'short',
    });
    expect(r.ok).toBe(false);
  });

  test('accepts valid application payload', () => {
    const r = validateApplicationPayload({
      business_name: 'Cafe Roma SRL',
      venue_name: 'Cafe Roma',
      city: 'Milano',
      proof_notes: 'Partita IVA ve mekan fotograflari eklendi.',
      category: 'Kahve',
    });
    expect(r.ok).toBe(true);
    expect(r.data.venue_name).toBe('Cafe Roma');
  });

  test('onboarding steps match spec order', () => {
    const steps = LOCAL_CONFIG.venue.ONBOARDING_STEPS;
    expect(steps[0]).toBe('application_submitted');
    expect(steps).toContain('vitrine');
    expect(steps).toContain('venue_badge');
    expect(steps[steps.length - 1]).toBe('live');
  });

  test('VEN-4 config constants', () => {
    expect(LOCAL_CONFIG.venue.K).toBe(3);
    expect(LOCAL_CONFIG.venue.PRIOR).toBe(5.0);
    expect(LOCAL_CONFIG.venue.WINDOW_DAYS).toBe(90);
  });
});
