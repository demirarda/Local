import { useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import ProjectPicker from '../components/ProjectPicker';
import { api, type VenuePipeline } from '../lib/api';

const COLUMNS = [
  { key: 'target', title: 'Hedef mekanlar', color: 'border-slate-200 bg-slate-50' },
  { key: 'contacted', title: 'İletişimde', color: 'border-blue-200 bg-blue-50' },
  { key: 'negotiating', title: 'Görüşmede', color: 'border-amber-200 bg-amber-50' },
  { key: 'agreed', title: 'Anlaşılan', color: 'border-green-200 bg-green-50' },
  { key: 'active', title: 'Aktif partner', color: 'border-emerald-300 bg-emerald-50' },
  { key: 'declined', title: 'Olumsuz / red', color: 'border-red-200 bg-red-50' },
];

export default function VenuesPage() {
  const [projectId, setProjectId] = useState('');
  const [grouped, setGrouped] = useState<Record<string, VenuePipeline[]>>({});
  const [selected, setSelected] = useState<VenuePipeline | null>(null);
  const [notes, setNotes] = useState('');
  const [venueStatus, setVenueStatus] = useState('');

  function load() {
    if (!projectId) return;
    api.pipelineVenues(projectId).then((r) => setGrouped(r.grouped));
  }

  useEffect(() => {
    load();
  }, [projectId]);

  async function save() {
    if (!selected) return;
    await api.updateVenue(selected.id, { internal_notes: notes, pipeline_status: venueStatus });
    setSelected(null);
    load();
  }

  async function moveVenue(v: VenuePipeline, newStatus: string) {
    await api.updateVenue(v.id, { pipeline_status: newStatus });
    load();
  }

  return (
    <OpsLayout>
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">Mekan pipeline</h1>
            <p className="text-sm text-navy/60">Hedef · anlaşılan · olumsuz</p>
          </div>
          <ProjectPicker value={projectId} onChange={setProjectId} />
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]">
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className={`flex-shrink-0 w-64 rounded-xl border-2 p-3 ${col.color}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('venue-id');
                const v = Object.values(grouped).flat().find((x) => x.id === id);
                if (v) moveVenue(v, col.key);
              }}
            >
              <h2 className="text-xs font-bold uppercase tracking-wide text-navy/70 mb-3">
                {col.title}
                <span className="ml-1 font-normal">({(grouped[col.key] || []).length})</span>
              </h2>
              <ul className="space-y-2">
                {(grouped[col.key] || []).map((v) => (
                  <li
                    key={v.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('venue-id', v.id)}
                    onClick={() => {
                      setSelected(v);
                      setNotes(v.internal_notes || '');
                      setVenueStatus(v.pipeline_status);
                    }}
                    className="bg-white rounded-lg p-3 shadow-sm border border-navy/10 cursor-grab text-sm"
                  >
                    <p className="font-medium text-navy">{v.name}</p>
                    {v.city && <p className="text-navy/50 text-xs mt-1">{v.city}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md h-full bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-4">{selected.name}</h2>
            <select
              value={venueStatus}
              onChange={(e) => setVenueStatus(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            >
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="İç notlar, red sebebi, anlaşma detayı…"
            />
            <button type="button" onClick={save} className="w-full py-2.5 bg-navy text-white rounded-lg">
              Kaydet
            </button>
          </div>
        </div>
      )}
    </OpsLayout>
  );
}
