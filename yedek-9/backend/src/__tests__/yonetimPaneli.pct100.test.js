import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { permissionsFor } from '../services/venueRoleService.js';
import {
  canAccessOpsSection,
  navForRole,
  resolveProductOpsRole,
} from '../services/productOpsRoles.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('yonetim paneli 100%', () => {
  test('1 — staff/manager/owner izin matrisi', () => {
    expect(permissionsFor('staff').shift).toBe(true);
    expect(permissionsFor('staff').gps).toBe(true);
    expect(permissionsFor('staff').regulars).toBe(false);
    expect(permissionsFor('staff').night_archive).toBe(false);
    expect(permissionsFor('staff').events).toBe(false);
    expect(permissionsFor('staff').business).toBe(false);
    expect(permissionsFor('manager').slots).toBe(true);
    expect(permissionsFor('manager').night_archive).toBe(true);
    expect(permissionsFor('manager').events).toBe(true);
    expect(permissionsFor('manager').business).toBe(false);
    expect(permissionsFor('owner').business).toBe(true);
    expect(permissionsFor('owner').invite_manager).toBe(true);
  });

  test('1 — API ve mobil UI kilitleri', () => {
    const api = readFileSync(join(root, 'api/venues.js'), 'utf8');
    expect(api).toContain("assertVenuePermission(userId, venueId, 'regulars'");
    expect(api).toContain('forceMini');
    expect(api).toContain('night_archive');
    expect(api).toContain("client: req.body?.client");
    const onboarding = readFileSync(join(root, 'services/venueOnboardingService.js'), 'utf8');
    expect(onboarding).toContain("client || '') !== 'native'");
    const mobileApi = readFileSync(join(root, '../../mobile/src/services/api.js'), 'utf8');
    expect(mobileApi).toContain("client: 'native'");
    const panel = readFileSync(join(root, '../../mobile/src/screens/VenueManagerScreen.js'), 'utf8');
    expect(panel).toContain('permissions?.events');
    expect(panel).toContain('permissions?.night_archive');
    expect(panel).toContain("mini: !venue?.permissions?.night_archive");
  });

  test('2 — mekan web ev; GPS yok', () => {
    const html = readFileSync(join(root, '../venue-web/panel.html'), 'utf8');
    const js = readFileSync(join(root, '../venue-web/panel.js'), 'utf8');
    expect(html).toContain('Takvim');
    expect(html).toContain('Paket');
    expect(html).toContain('Rapor');
    expect(html).toContain('Saatler');
    expect(html).toContain('Personel');
    expect(html).not.toContain('gps-verify');
    expect(js).toContain('business/checkout');
    expect(js).toContain('weekly_hours');
    expect(js).not.toContain('gps-verify');
    expect(js).toContain("mini = !perms().night_archive");
    expect(js).toContain('invite_staff');
  });

  test('3 — MOD web Ops; app L-aksiyon kapalı', () => {
    const modHtml = readFileSync(join(root, '../admin/mod.html'), 'utf8');
    const modJs = readFileSync(join(root, '../admin/mod.js'), 'utf8');
    expect(modHtml).toContain('MOD kuyruğu');
    expect(modJs).toContain('/api/mod/actions');
    expect(modJs).toContain('four-eyes');
    const mobile = readFileSync(join(root, '../../mobile/src/screens/ModerationScreen.js'), 'utf8');
    expect(mobile).toContain('L_ACTIONS_ON_DEVICE = false');
    expect(mobile).toContain('/admin/mod.html');
    expect(mobile).toContain("id: 'funnel'");
    const modApi = readFileSync(join(root, 'api/mod.js'), 'utf8');
    expect(modApi).toContain("requireProductOps('mod')");
  });

  test('4 — Ops roller ve hub kuyrukları', () => {
    expect(resolveProductOpsRole('x', 'nobody@local')).toBeNull();
    expect(canAccessOpsSection('moderator', 'mod')).toBe(true);
    expect(canAccessOpsSection('moderator', 'applications_decide')).toBe(false);
    expect(canAccessOpsSection('venue_ops', 'applications_decide')).toBe(true);
    expect(canAccessOpsSection('venue_ops', 'mod_action')).toBe(false);
    expect(canAccessOpsSection('support', 'applications')).toBe(true);
    expect(canAccessOpsSection('support', 'applications_decide')).toBe(false);
    expect(canAccessOpsSection('support', 'config')).toBe(false);
    expect(navForRole('moderator').some((n) => n.href === 'mod.html')).toBe(true);
    expect(navForRole('moderator').some((n) => n.href === 'config.html')).toBe(false);
    const adminApi = readFileSync(join(root, 'api/admin.js'), 'utf8');
    expect(adminApi).toContain("router.get('/me'");
    expect(adminApi).toContain("requireProductOps('applications_decide')");
    expect(adminApi).toContain("requireProductOps('config')");
    const hub = readFileSync(join(root, '../admin/hub.js'), 'utf8');
    expect(hub).toContain('mod.html');
    expect(hub).toContain('nominations.html');
    expect(hub).toContain('event-groups.html');
    expect(hub).toContain('loadOpsNav');
    const rolesSrc = readFileSync(join(root, 'services/productOpsRoles.js'), 'utf8');
    expect(rolesSrc).not.toContain("ADMIN_USER_IDS', 'ADMIN_EMAILS')) return 'founder'");
    const modEngine = readFileSync(join(root, 'services/modEngine.js'), 'utf8');
    expect(modEngine).not.toContain('process.env.ADMIN_USER_IDS');
  });

  test('5 — CRM ürün kuyruklarını taşımaz', () => {
    const dash = readFileSync(join(root, '../../ops-api/src/api/dashboard.js'), 'utf8');
    expect(dash).not.toContain("nav.push('nominations')");
    expect(dash).not.toContain("nav.push('event_groups')");
    expect(dash).toContain("label: 'Launch CRM'");
    const nom = readFileSync(join(root, '../../ops-portal/src/pages/NominationsPage.tsx'), 'utf8');
    expect(nom).toContain('Ürün Ops');
    expect(nom).not.toContain('api.nominations');
    const eg = readFileSync(join(root, '../../ops-portal/src/pages/EventGroupsPage.tsx'), 'utf8');
    expect(eg).toContain('ZONE-EVENT — Ürün Ops');
    const venues = readFileSync(join(root, '../../ops-portal/src/pages/VenuesPage.tsx'), 'utf8');
    expect(venues).toContain('Launch CRM');
    expect(venues).toContain('admin/mod.html');
  });
});
