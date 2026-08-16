import { useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import ProjectPicker from '../components/ProjectPicker';
import { api, getStoredUser, type ScreenItem } from '../lib/api';
import { getPermissions } from '../lib/permissions';

const DESIGN_STATUSES = [
  { value: 'not_started', label: 'Başlanmadı' },
  { value: 'in_progress', label: 'Tasarımda' },
  { value: 'review', label: 'İnceleme' },
  { value: 'done', label: 'Bitti' },
];

const DEV_STATUSES = [
  { value: 'not_started', label: 'Başlanmadı' },
  { value: 'in_progress', label: 'Geliştirmede' },
  { value: 'qa', label: 'QA' },
  { value: 'done', label: 'Bitti' },
];

export default function ScreensPage() {
  const user = getStoredUser();
  const perms = getPermissions();
  const isDesigner = user?.role === 'designer';
  const isDeveloper = user?.role === 'developer';
  const [projectId, setProjectId] = useState('');
  const [screens, setScreens] = useState<ScreenItem[]>([]);
  const [stats, setStats] = useState<{
    target_total: number;
    target_design_done: number;
    target_dev_done: number;
  } | null>(null);
  const [targetOnly, setTargetOnly] = useState(true);

  function load() {
    if (!projectId) return;
    api
      .screens(projectId, { target_only: targetOnly ? 'true' : 'false' })
      .then((r) => {
        setScreens(r.screens);
        setStats(r.stats);
      });
  }

  useEffect(() => {
    load();
  }, [projectId, targetOnly]);

  async function patchScreen(id: string, body: Record<string, string>) {
    await api.updateScreen(id, body);
    load();
  }

  return (
    <OpsLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">
              {isDesigner ? 'Tasarım — ekranlar' : isDeveloper ? 'Geliştirme — ekranlar' : 'Ekran takibi'}
            </h1>
            <p className="text-sm text-navy/60">Hedef ekranlar, tasarım ve dev durumu</p>
          </div>
          <ProjectPicker value={projectId} onChange={setProjectId} />
        </div>

        {stats && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-navy/10">
              Hedef: <strong>{stats.target_total}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-navy/10">
              Tasarım bitti: <strong>{stats.target_design_done}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-navy/10">
              Dev bitti: <strong>{stats.target_dev_done}</strong>
            </span>
            <label className="flex items-center gap-2 ml-auto">
              <input type="checkbox" checked={targetOnly} onChange={(e) => setTargetOnly(e.target.checked)} />
              Sadece hedef ekranlar
            </label>
          </div>
        )}

        <div className="bg-white rounded-xl border border-navy/10 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-cream text-left text-xs uppercase text-navy/60">
              <tr>
                <th className="px-4 py-3">Spec</th>
                <th className="px-4 py-3">Ekran</th>
                <th className="px-4 py-3">Hedef</th>
                {!isDeveloper && <th className="px-4 py-3">Tasarım</th>}
                {!isDesigner && <th className="px-4 py-3">Geliştirme</th>}
                <th className="px-4 py-3">Mockup</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((s) => (
                <tr key={s.id} className="border-t border-navy/5">
                  <td className="px-4 py-2 font-mono text-xs">{s.spec_id}</td>
                  <td className="px-4 py-2 font-medium">{s.title}</td>
                  <td className="px-4 py-2">{s.is_target ? '★' : '—'}</td>
                  {!isDeveloper && (
                    <td className="px-4 py-2">
                      <select
                        value={s.design_status}
                        disabled={isDeveloper}
                        onChange={(e) => patchScreen(s.id, { design_status: e.target.value })}
                        className="text-xs border rounded px-2 py-1"
                      >
                        {DESIGN_STATUSES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {!isDesigner && (
                    <td className="px-4 py-2">
                      <select
                        value={s.dev_status}
                        disabled={isDesigner}
                        onChange={(e) => patchScreen(s.id, { dev_status: e.target.value })}
                        className="text-xs border rounded px-2 py-1"
                      >
                        {DEV_STATUSES.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2 text-xs text-navy/50 truncate max-w-[140px]">
                    {s.file_ref || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {perms?.can_view_all && (
          <p className="text-xs text-navy/40">
            Tasarımcılar yalnızca tasarım sütununu; yazılımcılar yalnızca geliştirme sütununu güncelleyebilir.
          </p>
        )}
      </div>
    </OpsLayout>
  );
}
