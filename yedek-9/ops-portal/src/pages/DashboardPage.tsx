import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OpsLayout from '../components/OpsLayout';
import ProjectPicker from '../components/ProjectPicker';
import { api } from '../lib/api';
import { getPermissions } from '../lib/permissions';

type DashboardData = {
  role: string;
  can_view_all?: boolean;
  sections: {
    hosts?: { by_status: Record<string, number>; recent: { id: string; display_name: string; pipeline_status: string; rituals_hosted: number; has_feedback: boolean }[] };
    venues?: { target: number; agreed: number; declined: number; by_status: Record<string, number> };
    screens?: { target_total: number; design_done: number; dev_done: number; design_in_progress: number; dev_in_progress: number };
    my_tasks?: { id: string; title: string; column_name: string; priority: string }[];
  };
};

const HOST_STATUS_TR: Record<string, string> = {
  candidate: 'Aday',
  contacted: 'İletişim',
  onboarding: 'Onboarding',
  active: 'Aktif',
  paused: 'Duraklatıldı',
  churned: 'Ayrıldı',
};

export default function DashboardPage() {
  const perms = getPermissions();
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!projectId) return;
    api.dashboard(projectId).then((d) => setData(d as DashboardData));
  }, [projectId]);

  return (
    <OpsLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Özet</h1>
            <p className="text-sm text-navy/60">
              {perms?.can_view_all ? 'Tüm ekipler' : `Rolünüz: ${perms?.role}`}
            </p>
          </div>
          <ProjectPicker value={projectId} onChange={setProjectId} />
        </div>

        {!data ? (
          <p className="text-navy/50">Yükleniyor…</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sections.hosts && (
              <section className="bg-white rounded-xl border border-navy/10 p-5 sm:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-navy">Hostlar</h2>
                  <Link to="/hosts" className="text-sm text-gold hover:underline">
                    Tümü →
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(data.sections.hosts.by_status).map(([k, n]) => (
                    <span key={k} className="text-xs px-2 py-1 rounded-full bg-navy/5 text-navy">
                      {HOST_STATUS_TR[k] || k}: {n}
                    </span>
                  ))}
                </div>
                <ul className="space-y-2">
                  {data.sections.hosts.recent.map((h) => (
                    <li key={h.id} className="flex justify-between text-sm border-b border-navy/5 pb-2">
                      <span className="font-medium">{h.display_name}</span>
                      <span className="text-navy/50">
                        {h.rituals_hosted} ritüel · {h.has_feedback ? '✓ geri bildirim' : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.sections.venues && (
              <section className="bg-white rounded-xl border border-navy/10 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-navy">Mekanlar</h2>
                  <Link to="/venues" className="text-sm text-gold hover:underline">
                    Tümü →
                  </Link>
                </div>
                <div className="space-y-3 text-sm">
                  <p>
                    <span className="text-navy/50">Hedef:</span>{' '}
                    <strong>{data.sections.venues.target}</strong>
                  </p>
                  <p>
                    <span className="text-navy/50">Anlaşılan / aktif:</span>{' '}
                    <strong className="text-green-700">{data.sections.venues.agreed}</strong>
                  </p>
                  <p>
                    <span className="text-navy/50">Olumsuz:</span>{' '}
                    <strong className="text-red-600">{data.sections.venues.declined}</strong>
                  </p>
                </div>
              </section>
            )}

            {data.sections.screens && (
              <section className="bg-white rounded-xl border border-navy/10 p-5 sm:col-span-2 lg:col-span-1">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-semibold text-navy">Ekranlar</h2>
                  <Link to="/screens" className="text-sm text-gold hover:underline">
                    Tümü →
                  </Link>
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    Hedef ekran: <strong>{data.sections.screens.target_total}</strong>
                  </p>
                  <p>
                    Tasarım bitti:{' '}
                    <strong>
                      {data.sections.screens.design_done}/{data.sections.screens.target_total}
                    </strong>
                  </p>
                  <p>
                    Dev bitti:{' '}
                    <strong>
                      {data.sections.screens.dev_done}/{data.sections.screens.target_total}
                    </strong>
                  </p>
                  <p className="text-navy/50">
                    Devam: tasarım {data.sections.screens.design_in_progress} · dev{' '}
                    {data.sections.screens.dev_in_progress}
                  </p>
                </div>
              </section>
            )}

            {data.sections.my_tasks && data.sections.my_tasks.length > 0 && (
              <section className="bg-white rounded-xl border border-navy/10 p-5 lg:col-span-3">
                <h2 className="font-semibold text-navy mb-3">Görevlerim</h2>
                <ul className="grid sm:grid-cols-2 gap-2">
                  {data.sections.my_tasks.map((t) => (
                    <li key={t.id} className="text-sm px-3 py-2 rounded-lg bg-cream">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-navy/50 ml-2">· {t.column_name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}
