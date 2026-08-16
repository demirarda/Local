import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStoredUser, setStoredUser, setToken } from '../lib/api';
import { getPermissions, setPermissions } from '../lib/permissions';

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const perms = getPermissions();
  const nav = perms?.nav || [
    { key: 'projects', path: '/', label: 'Board' },
    { key: 'bridge', path: '/bridge', label: 'Köprü' },
    { key: 'team', path: '/team', label: 'Ekip' },
  ];

  function logout() {
    setToken(null);
    setStoredUser(null);
    setPermissions(null);
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <Link to={perms?.default_route || '/'} className="font-bold text-lg tracking-tight shrink-0">
            LOCAL <span className="text-gold">Ops</span>
          </Link>
          <nav className="flex gap-0.5 overflow-x-auto">
            {nav.map((item) => {
              const active =
                item.path === '/'
                  ? location.pathname === '/' || location.pathname.startsWith('/projects/')
                  : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`text-sm px-2.5 py-1.5 rounded-lg whitespace-nowrap transition ${
                    active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-gold hidden md:inline">{user?.role}</span>
          <span className="text-sm hidden sm:inline">{user?.name}</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          >
            Çıkış
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
