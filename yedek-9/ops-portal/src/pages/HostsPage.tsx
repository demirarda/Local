import { useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import ProjectPicker from '../components/ProjectPicker';
import { api, type HostPipeline } from '../lib/api';

const STATUSES = [
  { value: 'candidate', label: 'Aday' },
  { value: 'contacted', label: 'İletişimde' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Aktif' },
  { value: 'paused', label: 'Duraklatıldı' },
  { value: 'churned', label: 'Ayrıldı' },
];

export default function HostsPage() {
  const [projectId, setProjectId] = useState('');
  const [hosts, setHosts] = useState<HostPipeline[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<HostPipeline | null>(null);
  const [feedback, setFeedback] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');

  function load() {
    if (!projectId) return;
    api.pipelineHosts(projectId, { status: filter || undefined }).then(setHosts);
  }

  useEffect(() => {
    load();
  }, [projectId, filter]);

  useEffect(() => {
    if (selected) {
      setFeedback(selected.host_feedback || '');
      setNotes(selected.internal_notes || '');
      setStatus(selected.pipeline_status);
    }
  }, [selected]);

  async function save() {
    if (!selected) return;
    await api.updateHost(selected.id, {
      host_feedback: feedback,
      internal_notes: notes,
      pipeline_status: status,
    });
    setSelected(null);
    load();
  }

  return (
    <OpsLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Host pipeline</h1>
            <p className="text-sm text-navy/60">Durum, ritüel sayısı, host geri bildirimi</p>
          </div>
          <ProjectPicker value={projectId} onChange={setProjectId} />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('')}
            className={`text-xs px-3 py-1 rounded-full ${!filter ? 'bg-navy text-white' : 'bg-white border border-navy/15'}`}
          >
            Tümü
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setFilter(s.value)}
              className={`text-xs px-3 py-1 rounded-full ${filter === s.value ? 'bg-navy text-white' : 'bg-white border border-navy/15'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-navy/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-navy/60 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Ritüel</th>
                <th className="px-4 py-3">Geri bildirim</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.id} className="border-t border-navy/5 hover:bg-cream/50">
                  <td className="px-4 py-3 font-medium">{h.display_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-gold/15 text-xs">
                      {STATUSES.find((s) => s.value === h.pipeline_status)?.label || h.pipeline_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{h.rituals_hosted}</td>
                  <td className="px-4 py-3 text-navy/60 max-w-xs truncate">
                    {h.host_feedback ? '✓ Var' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(h)}
                      className="text-gold text-xs font-medium"
                    >
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md h-full bg-white shadow-xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-navy mb-4">{selected.display_name}</h2>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-navy/60">Pipeline durumu</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-navy/60">Host geri bildirimi (veri / notlar)</span>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Hostun paylaştığı içgörüler, anket cevapları, pilot notları…"
              />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold text-navy/60">İç notlar (ekip)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </label>
            <p className="text-sm text-navy/50 mb-4">
              Ritüel sayısı: <strong>{selected.rituals_hosted}</strong>
              {selected.production_user_id && (
                <button
                  type="button"
                  className="ml-2 text-gold text-xs"
                  onClick={async () => {
                    await api.syncHostRituals(selected.id);
                    load();
                    const updated = await api.pipelineHosts(projectId);
                    const h = updated.find((x) => x.id === selected.id);
                    if (h) setSelected(h);
                  }}
                >
                  Uygulamadan senkronize et
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={save}
              className="w-full py-2.5 bg-navy text-white rounded-lg font-medium"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}
    </OpsLayout>
  );
}
