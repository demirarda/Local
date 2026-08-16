import { FormEvent, useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import { api, getStoredUser, type OpsUser } from '../lib/api';

const ROLES = [
  { value: 'pm', label: 'Proje Yöneticisi' },
  { value: 'founder', label: 'Founder' },
  { value: 'designer', label: 'Tasarımcı' },
  { value: 'developer', label: 'Yazılımcı' },
  { value: 'host_lead', label: 'Host Koordinatörü' },
  { value: 'venue_lead', label: 'Mekan Koordinatörü' },
];

export default function TeamPage() {
  const me = getStoredUser();
  const canInvite = me?.role === 'pm' || me?.role === 'founder';
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('developer');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load() {
    api.users().then(setUsers).catch(() => setUsers([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      await api.inviteUser({ email, name, password, role });
      setMsg(`${email} davet edildi.`);
      setEmail('');
      setName('');
      setPassword('');
      load();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Davet başarısız');
    }
  }

  return (
    <OpsLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">Ekip</h1>
          <p className="text-sm text-navy/60 mt-1">Ops portal kullanıcıları (ürün kullanıcılarından ayrı)</p>
        </div>

        <section className="bg-white rounded-xl border border-navy/10 overflow-hidden">
          <ul className="divide-y divide-navy/5">
            {users.map((u) => (
              <li key={u.id} className="px-5 py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-navy">{u.name}</p>
                  <p className="text-sm text-navy/50">{u.email}</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-gold/15 text-navy">
                  {u.role}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {canInvite && (
          <section className="bg-white rounded-xl border border-navy/10 p-6">
            <h2 className="font-semibold text-navy mb-4">Yeni üye davet et</h2>
            <form onSubmit={onInvite} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  placeholder="Ad Soyad"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border border-navy/15 rounded-lg px-3 py-2"
                  required
                />
                <input
                  type="email"
                  placeholder="E-posta"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border border-navy/15 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  placeholder="Geçici şifre"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-navy/15 rounded-lg px-3 py-2"
                  required
                  minLength={8}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="border border-navy/15 rounded-lg px-3 py-2"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {err && <p className="text-sm text-red-600">{err}</p>}
              {msg && <p className="text-sm text-green-700">{msg}</p>}
              <button type="submit" className="px-4 py-2 bg-navy text-white rounded-lg font-medium hover:bg-navy/90">
                Davet gönder
              </button>
            </form>
          </section>
        )}
      </div>
    </OpsLayout>
  );
}
