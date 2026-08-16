import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setStoredUser, setToken } from '../lib/api';
import { setPermissions } from '../lib/permissions';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('ops@local.dev');
  const [password, setPassword] = useState('OpsLocal2026!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      setStoredUser(user);
      const perms = await api.permissions();
      setPermissions(perms);
      navigate(perms.default_route || '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-navy to-[#2a4368]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-navy/10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gold/20 text-gold font-bold text-lg mb-4">
            LO
          </div>
          <h1 className="text-2xl font-bold text-navy">LOCAL Ops</h1>
          <p className="text-sm text-navy/60 mt-1">Rol bazlı yürütme paneli</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-navy/70 uppercase tracking-wide">E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-navy focus:outline-none focus:ring-2 focus:ring-gold/50"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-navy/70 uppercase tracking-wide">Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy/15 px-3 py-2.5 text-navy focus:outline-none focus:ring-2 focus:ring-gold/50"
              required
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-navy text-white font-semibold hover:bg-navy/90 disabled:opacity-60 transition"
          >
            {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
