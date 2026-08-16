export type NavItem = { key: string; path: string; label: string };

export type Permissions = {
  role: string;
  can_view_all: boolean;
  nav: NavItem[];
  default_route: string;
};

const KEY = 'ops_permissions';

export function setPermissions(p: Permissions | null) {
  if (p) localStorage.setItem(KEY, JSON.stringify(p));
  else localStorage.removeItem(KEY);
}

export function getPermissions(): Permissions | null {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export function canAccessPath(path: string): boolean {
  const p = getPermissions();
  if (!p) return false;
  if (p.can_view_all) return true;
  return p.nav.some((n) => {
    if (n.path === '/') return path === '/' || path.startsWith('/projects/');
    return path === n.path || path.startsWith(`${n.path}/`);
  });
}
