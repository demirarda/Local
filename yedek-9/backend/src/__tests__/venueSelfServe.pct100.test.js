import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  closingTimeFromWeeklyHours,
  normalizeWeeklyHours,
  permissionsFor,
} from '../services/venueRoleService.js';
import { validateApplicationPayload } from '../services/venueApplicationService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('venue self-serve 100%', () => {
  test('staff cannot bill or invite managers; owner can', () => {
    expect(permissionsFor('staff').shift).toBe(true);
    expect(permissionsFor('staff').slots).toBe(false);
    expect(permissionsFor('staff').business).toBe(false);
    expect(permissionsFor('staff').regulars).toBe(false);
    expect(permissionsFor('staff').night_archive).toBe(false);
    expect(permissionsFor('manager').slots).toBe(true);
    expect(permissionsFor('manager').invite_staff).toBe(true);
    expect(permissionsFor('manager').business).toBe(false);
    expect(permissionsFor('owner').business).toBe(true);
    expect(permissionsFor('owner').invite_manager).toBe(true);
  });

  test('weekly hours normalize and yield closing_time', () => {
    const hours = normalizeWeeklyHours({
      mon: { open: '08:00', close: '22:30', closed: false },
    });
    expect(hours.mon.close).toBe('22:30');
    expect(hours.sun.close).toBeTruthy();
    const close = closingTimeFromWeeklyHours(hours, new Date('2026-08-17T12:00:00Z'));
    expect(close).toMatch(/^\d{2}:\d{2}$/);
  });

  test('submit payload requires maps, photos, commitment; hours default', () => {
    const photos = ['https://a.com/1', 'https://a.com/2', 'https://a.com/3', 'https://a.com/4', 'https://a.com/5'];
    const r = validateApplicationPayload({
      business_name: 'Cafe Roma SRL',
      venue_name: 'Cafe Roma',
      city: 'Milano',
      proof_notes: 'Partita IVA ve mekan fotograflari eklendi.',
      maps_url: 'https://maps.google.com/?q=roma',
      photo_urls: photos,
      commitment_accepted: true,
    });
    expect(r.ok).toBe(true);
    expect(r.data.weekly_hours.mon.close).toBeTruthy();
    expect(r.data.closing_time).toBeTruthy();
  });

  test('migration 124 and surfaces exist', () => {
    const runner = readFileSync(join(root, '../scripts/run-migrations.js'), 'utf8');
    expect(runner).toContain('124_venue_self_serve_complete.sql');
    expect(runner).toContain('125_venue_application_draft_index.sql');
    const sql = readFileSync(join(root, 'migrations/124_venue_self_serve_complete.sql'), 'utf8');
    expect(sql).toContain('weekly_hours');
    expect(sql).toContain('draft');
    const idx = readFileSync(join(root, 'migrations/125_venue_application_draft_index.sql'), 'utf8');
    expect(idx).toContain("status IN ('pending', 'draft')");
    expect(readFileSync(join(root, '../admin/basvuru.html'), 'utf8')).toContain('Mekan başvuru kuyruğu');
    expect(readFileSync(join(root, '../venue-web/apply.html'), 'utf8')).toContain('Taslak kaydet');
    const apply = readFileSync(join(root, '../../mobile/src/screens/VenueApplyScreen.js'), 'utf8');
    expect(apply).toContain('saveVenueApplicationDraft');
    expect(apply).toContain('weekly_hours');
    expect(apply).toContain('const handleWithdraw');
    const panel = readFileSync(join(root, '../../mobile/src/screens/VenueManagerScreen.js'), 'utf8');
    expect(panel).toContain('p.business');
    expect(panel).toContain('addVenueManager');
    expect(panel).toContain('invite_staff');
    expect(panel).toContain('removeVenueManager');
    const api = readFileSync(join(root, 'api/venues.js'), 'utf8');
    expect(api).toContain("applications/me/draft");
    expect(api).toContain('assertVenuePermission');
    expect(runner).toContain('126_venue_surface_complete.sql');
    expect(readFileSync(join(root, '../venue-web/panel.html'), 'utf8')).toContain('Takvim');
    expect(readFileSync(join(root, '../venue-web/panel.js'), 'utf8')).toContain('business/checkout');
    expect(readFileSync(join(root, '../venue-web/panel.js'), 'utf8')).not.toContain('gps-verify');
    expect(readFileSync(join(root, '../venue-web/apply.html'), 'utf8')).toContain('uploadVenueFile');
    expect(readFileSync(join(root, 'api/venues.js'), 'utf8')).toContain("applications/media");
    expect(readFileSync(join(root, 'services/stripePayments.js'), 'utf8')).toContain('/venue/panel.html');
    expect(readFileSync(join(root, '../../ops-portal/src/pages/VenuesPage.tsx'), 'utf8')).toContain('Launch CRM');
    expect(readFileSync(join(root, '../../mobile/src/screens/VenueApplyScreen.js'), 'utf8')).toContain('uploadVenueApplicationFile');
    expect(readFileSync(join(root, '../../mobile/src/screens/VenueApplyScreen.js'), 'utf8')).toContain('handleCamera');
    expect(readFileSync(join(root, '../admin/basvuru.html'), 'utf8')).not.toMatch(/value=["']draft["']/);
  });
});
