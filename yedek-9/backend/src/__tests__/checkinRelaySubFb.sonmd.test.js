import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('EVENT sub FB time-intersection + digital relay', () => {
  test('eventSubSealService exports overlap + refresh helpers', () => {
    const src = readFileSync(join(__dirname, '../services/eventSubSealService.js'), 'utf8');
    expect(src).toContain('refreshSubSealFeedbackEligibility');
    expect(src).toContain('usersHaveSubTimeOverlap');
    expect(src).toContain('sub_seal');
  });

  test('snapshotFeedbackEligibility branches VEN_EVENT to sub-only', () => {
    const src = readFileSync(join(__dirname, '../services/waveBSocial.js'), 'utf8');
    expect(src).toContain('ven_event_sub_only');
    expect(src).toContain('VEN_EVENT');
  });

  test('peer FB requires sub overlap on events', () => {
    const src = readFileSync(join(__dirname, '../api/feedback.js'), 'utf8');
    expect(src).toContain('EVENT_SUB_OVERLAP_REQUIRED');
    expect(src).toContain('main_only_no_person_fb');
  });

  test('checkin rejects digital paste', () => {
    const src = readFileSync(join(__dirname, '../services/checkinService.js'), 'utf8');
    expect(src).toContain('DIGITAL_RELAY_FORBIDDEN');
    expect(src).toContain('digitalPaste');
  });

  test('LOCAL-TAG redeem enforces proximity', () => {
    const src = readFileSync(join(__dirname, '../services/firstSealService.js'), 'utf8');
    expect(src).toContain('PHYSICAL_RELAY_RADIUS_M');
    expect(src).toContain('issuer_lat');
    expect(src).toContain('DIGITAL_RELAY_FORBIDDEN');
  });
});
