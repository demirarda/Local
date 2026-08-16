import { Navigate } from 'react-router-dom';
import { canAccessPath, getPermissions } from '../lib/permissions';
import { getToken } from '../lib/api';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequirePath({ path, children }: { path: string; children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  const perms = getPermissions();
  if (!perms) return <Navigate to="/login" replace />;
  if (!canAccessPath(path)) {
    return <Navigate to={perms.default_route || '/'} replace />;
  }
  return <>{children}</>;
}
