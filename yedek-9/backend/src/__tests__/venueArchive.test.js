import { describe, test, expect } from '@jest/globals';
import { PUBLIC_ARCHIVE_SQL } from '../services/venueArchiveService.js';

describe('venue archive (F5 §9.5)', () => {
  test('public archive SQL includes public privacy modes', () => {
    expect(PUBLIC_ARCHIVE_SQL).toContain('public');
    expect(PUBLIC_ARCHIVE_SQL).toContain('ritual_and_pulse');
  });
});
