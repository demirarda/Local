/** Roles that see the full ops portal */
export const FULL_ACCESS_ROLES = ['founder', 'pm'];

export function canViewAll(role) {
  return FULL_ACCESS_ROLES.includes(role);
}

export function canAccessSection(role, section) {
  if (canViewAll(role)) return true;
  const map = {
    dashboard: ['founder', 'pm', 'host_lead', 'venue_lead', 'designer', 'developer'],
    projects: ['founder', 'pm', 'host_lead', 'venue_lead', 'designer', 'developer'],
    hosts: ['founder', 'pm', 'host_lead'],
    venues: ['founder', 'pm', 'venue_lead'],
    screens: ['founder', 'pm', 'designer', 'developer'],
    bridge: ['founder', 'pm', 'host_lead', 'venue_lead'],
    team: ['founder', 'pm'],
  };
  return (map[section] || []).includes(role);
}

export function getDefaultRoute(role) {
  if (role === 'host_lead') return '/hosts';
  if (role === 'venue_lead') return '/venues';
  if (role === 'designer') return '/screens';
  if (role === 'developer') return '/screens';
  return '/';
}
