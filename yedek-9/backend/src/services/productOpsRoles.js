/**
 * Product Ops roles — founder / moderator / venue_ops / support / read_only
 * Separate from launch CRM (ops-portal) and from venue owner/manager/staff.
 *
 * Env (comma-separated ids or emails) — ADMIN_* is NOT a role.
 *   FOUNDER_USER_IDS / FOUNDER_EMAILS           → founder (L3/L4, config)
 *   OPS_MODERATOR_USER_IDS / OPS_MODERATOR_EMAILS
 *   OPS_VENUE_OPS_USER_IDS / OPS_VENUE_OPS_EMAILS
 *   OPS_SUPPORT_USER_IDS / OPS_SUPPORT_EMAILS
 *   OPS_READONLY_USER_IDS / OPS_READONLY_EMAILS
 * ADMIN_USER_IDS / ADMIN_EMAILS = venue-panel override only (not Ops founder).
 */

export const PRODUCT_OPS_ROLES = ['founder', 'moderator', 'venue_ops', 'support', 'read_only'];

export const OPS_SECTION_MAP = {
  dashboard: ['founder', 'moderator', 'venue_ops', 'support', 'read_only'],
  users: ['founder', 'moderator', 'support'],
  rituals: ['founder', 'moderator'],
  applications: ['founder', 'venue_ops', 'support'],
  applications_decide: ['founder', 'venue_ops'],
  venues: ['founder', 'venue_ops'],
  mod: ['founder', 'moderator'],
  mod_action: ['founder', 'moderator'],
  nominations: ['founder', 'venue_ops'],
  event_groups: ['founder', 'venue_ops'],
  badges: ['founder', 'venue_ops'],
  brand: ['founder'],
  config: ['founder'],
  identity: ['founder'],
  notifications: ['founder'],
  memories: ['founder', 'moderator'],
  verifications: ['founder', 'venue_ops'],
  score_events: ['founder'],
  funnel: ['founder', 'moderator', 'venue_ops'],
};

export const OPS_NAV = [
  { href: 'dashboard.html', label: 'Dashboard', section: 'dashboard', icon: 'dashboard', desc: 'Kuyruk sayaçları + şehir nabzı' },
  { href: 'mod.html', label: 'MOD kuyruğu', section: 'mod', icon: 'gavel', desc: 'L0–L4 · four-eyes · itiraz' },
  { href: 'basvuru.html', label: 'Mekan başvuruları', section: 'applications', icon: 'how_to_reg', desc: 'White-glove onay/red' },
  { href: 'nominations.html', label: 'Aday / lead', section: 'nominations', icon: 'place', desc: 'Nominasyon triage' },
  { href: 'event-groups.html', label: 'ZONE-EVENT', section: 'event_groups', icon: 'groups', desc: 'Şemsiye kart / masa grubu' },
  { href: 'mekan.html', label: 'Mekanlar', section: 'venues', icon: 'location_on', desc: 'Pin, paket, gölge' },
  { href: 'kullanici.html', label: 'Kullanıcılar', section: 'users', icon: 'group', desc: 'Arama · askı (yazma founder)' },
  { href: 'rite.html', label: 'Ritüeller', section: 'rituals', icon: 'auto_awesome', desc: 'Yaşam döngüsü' },
  { href: 'badge-llm.html', label: 'Rozet kuyruğu', section: 'badges', icon: 'military_tech', desc: 'Venue-badge + LLM (flag kapalı)' },
  { href: 'dogrulama.html', label: 'Doğrulama', section: 'verifications', icon: 'verified_user', desc: 'Üni / venue' },
  { href: 'anilar.html', label: 'Anılar', section: 'memories', icon: 'history', desc: 'Memory arşivi' },
  { href: 'bildirim.html', label: 'Bildirimler', section: 'notifications', icon: 'notifications', desc: 'NOTIF v1' },
  { href: 'config.html', label: 'Config', section: 'config', icon: 'tune', desc: '⭐ kalibrasyon — founder' },
  { href: 'founder-decisions.html', label: 'Founder', section: 'config', icon: 'gavel', desc: 'Karar özeti' },
  { href: 'score-events.html', label: 'Score Events', section: 'score_events', icon: 'timeline', desc: 'RS bypass log' },
];

function parseList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function envHas(userId, email, idsEnv, emailsEnv) {
  const ids = parseList(process.env[idsEnv]);
  const emails = parseList(process.env[emailsEnv]).map((s) => s.toLowerCase());
  if (userId && ids.includes(String(userId))) return true;
  if (email && emails.includes(String(email).toLowerCase())) return true;
  return false;
}

export function resolveProductOpsRole(userId, email = '') {
  if (envHas(userId, email, 'FOUNDER_USER_IDS', 'FOUNDER_EMAILS')) return 'founder';
  if (envHas(userId, email, 'OPS_MODERATOR_USER_IDS', 'OPS_MODERATOR_EMAILS')) return 'moderator';
  if (envHas(userId, email, 'OPS_VENUE_OPS_USER_IDS', 'OPS_VENUE_OPS_EMAILS')) return 'venue_ops';
  if (envHas(userId, email, 'OPS_SUPPORT_USER_IDS', 'OPS_SUPPORT_EMAILS')) return 'support';
  if (envHas(userId, email, 'OPS_READONLY_USER_IDS', 'OPS_READONLY_EMAILS')) return 'read_only';
  return null;
}

export function isFounderUser(userId, email = '') {
  return resolveProductOpsRole(userId, email) === 'founder';
}

/** Venue panel override — founder, or legacy ADMIN_* (not an Ops role). */
export function isVenuePlatformOverride(userId, email = '') {
  if (isFounderUser(userId, email)) return true;
  return envHas(userId, email, 'ADMIN_USER_IDS', 'ADMIN_EMAILS');
}

export function canAccessOpsSection(role, section) {
  if (!role || !section) return false;
  if (role === 'founder') return true;
  return (OPS_SECTION_MAP[section] || []).includes(role);
}

export function navForRole(role) {
  return OPS_NAV.filter((item) => canAccessOpsSection(role, item.section));
}

/** Any product-ops role (replaces binary ADMIN_* for login). */
export function requireProductOps(section = null) {
  return function productOpsGuard(req, res, next) {
    const role = resolveProductOpsRole(req.user?.userId, req.user?.email);
    if (!role) {
      return res.status(403).json({ success: false, error: 'Ops access required' });
    }
    req.productOpsRole = role;
    if (section && !canAccessOpsSection(role, section)) {
      return res.status(403).json({ success: false, error: `Requires ${section}` });
    }
    return next();
  };
}
