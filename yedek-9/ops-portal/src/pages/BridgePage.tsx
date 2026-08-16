import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OpsLayout from '../components/OpsLayout';
import { api } from '../lib/api';

type Host = { id: string; name: string; email: string; city?: string; rs_score?: number; is_verified?: boolean };
type Venue = { id: string; name: string; city?: string; subscription_tier?: string; is_verified?: boolean };

export default function BridgePage() {
  const [tab, setTab] = useState<'hosts' | 'venues'>('hosts');
  const [city, setCity] = useState('Milano');
  const [search, setSearch] = useState('');
  const [hosts, setHosts] = useState<Host[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.projects().then((p) => {
      setProjects(p);
      if (p[0]) setProjectId(p[0].id);
    });
  }, []);

  useEffect(() => {
    const q = { city, search };
    if (tab === 'hosts') {
      api.bridgeHosts(q).then(setHosts);
    } else {
      api.bridgeVenues(q).then(setVenues);
    }
  }, [tab, city, search]);

  return (
    <OpsLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Üretim köprüsü</h1>
          <p className="text-sm text-navy/60 mt-1">
            Canlı uygulamadaki host ve mekanları arayın; görev açın.{' '}
            <a
              href="http://localhost:3000/admin/dogrulama.html"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline"
            >
              Admin doğrulama →
            </a>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="text-navy/60 block mb-1">Proje</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border border-navy/15 rounded-lg px-3 py-2 min-w-[200px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-navy/60 block mb-1">Şehir</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="border border-navy/15 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-sm flex-1 min-w-[160px]">
            <span className="text-navy/60 block mb-1">Ara</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-navy/15 rounded-lg px-3 py-2"
              placeholder="İsim…"
            />
          </label>
        </div>

        {msg && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{msg}</p>}

        <div className="flex gap-2">
          {(['hosts', 'venues'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === t ? 'bg-navy text-white' : 'bg-white border border-navy/15 text-navy'
              }`}
            >
              {t === 'hosts' ? 'Hostlar' : 'Mekanlar'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-navy/10 divide-y divide-navy/5">
          {tab === 'hosts' &&
            (hosts.length === 0 ? (
              <p className="p-6 text-sm text-navy/50">Host bulunamadı veya production DB bağlı değil.</p>
            ) : (
              hosts.map((h) => (
                <BridgeRow
                  key={h.id}
                  title={h.name}
                  sub={`${h.email} · ${h.city || '—'} · RS ${h.rs_score ?? '—'}`}
                  badge={h.is_verified ? 'Doğrulanmış' : 'Bekliyor'}
                  onTask={async () => {
                    if (!projectId) return;
                    const board = await api.board(projectId);
                    const col = board.columns.find((c) => c.name === 'Brief') || board.columns[0];
                    const task = await api.createTask({
                      project_id: projectId,
                      column_id: col.id,
                      title: `Host: ${h.name}`,
                      description: `user_id: ${h.id}`,
                      priority: h.is_verified ? 'low' : 'high',
                    });
                    await api.addLink(task.id, { link_type: 'host', ref_key: h.id, ref_label: h.name });
                    setMsg(`Görev oluşturuldu: ${h.name}`);
                  }}
                />
              ))
            ))}
          {tab === 'venues' &&
            (venues.length === 0 ? (
              <p className="p-6 text-sm text-navy/50">Mekan bulunamadı.</p>
            ) : (
              venues.map((v) => (
                <BridgeRow
                  key={v.id}
                  title={v.name}
                  sub={`${v.city || '—'} · ${v.subscription_tier || 'basic'}`}
                  badge={v.is_verified ? 'Doğrulanmış' : '—'}
                  onTask={async () => {
                    if (!projectId) return;
                    const board = await api.board(projectId);
                    const col = board.columns.find((c) => c.name === 'Brief') || board.columns[0];
                    const task = await api.createTask({
                      project_id: projectId,
                      column_id: col.id,
                      title: `Mekan: ${v.name}`,
                      description: `venue_id: ${v.id}`,
                      priority: 'medium',
                    });
                    await api.addLink(task.id, { link_type: 'venue', ref_key: v.id, ref_label: v.name });
                    setMsg(`Görev oluşturuldu: ${v.name}`);
                  }}
                />
              ))
            ))}
        </div>

        {projectId && (
          <Link to={`/projects/${projectId}`} className="inline-block text-sm text-gold font-medium hover:underline">
            Board&apos;a git →
          </Link>
        )}
      </div>
    </OpsLayout>
  );
}

function BridgeRow({
  title,
  sub,
  badge,
  onTask,
}: {
  title: string;
  sub: string;
  badge: string;
  onTask: () => void;
}) {
  return (
    <div className="px-5 py-4 flex justify-between items-center gap-4">
      <div>
        <p className="font-medium text-navy">{title}</p>
        <p className="text-sm text-navy/50">{sub}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs px-2 py-1 rounded-full bg-navy/5 text-navy/70">{badge}</span>
        <button
          type="button"
          onClick={onTask}
          className="text-sm px-3 py-1.5 bg-gold/20 text-navy rounded-lg font-medium hover:bg-gold/30"
        >
          Görev aç
        </button>
      </div>
    </div>
  );
}
