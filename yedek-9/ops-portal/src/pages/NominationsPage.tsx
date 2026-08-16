import { useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import { api, type VenueNomination } from '../lib/api';

const SOURCE_LABELS: Record<string, string> = {
  map_long_press: 'Harita uzun bas',
  free_ritual: 'Free ritüel sonrası',
  empty_search: 'Boş arama',
};

export default function NominationsPage() {
  const [rows, setRows] = useState<VenueNomination[]>([]);
  const [status, setStatus] = useState('pooled');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextStatus = status) {
    setLoading(true);
    setError('');
    try {
      const data = await api.nominations({ status: nextStatus });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markReviewed(id: string) {
    await api.updateNomination(id, { status: 'reviewed' });
    load();
  }

  return (
    <OpsLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex flex-wrap justify-between gap-3 items-end">
          <div>
            <h1 className="text-2xl font-bold text-navy">Mekan önerileri</h1>
            <p className="text-sm text-navy/60">Nomination triage · pitch listesi</p>
          </div>
          <div className="flex gap-2">
            {['pooled', 'reviewed', 'all'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                  load(s);
                }}
                className={`text-sm px-3 py-1.5 rounded-lg border ${
                  status === s ? 'bg-navy text-white border-navy' : 'bg-white text-navy/70 border-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-navy/50">Yükleniyor…</p> : null}

        <ul className="space-y-3">
          {rows.map((n) => (
            <li key={n.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-navy">{n.name || 'Adsız mekan'}</h2>
                  <p className="text-xs text-navy/50 mt-1">
                    {SOURCE_LABELS[n.source] || n.source}
                    {n.cluster_key ? ` · küme ${n.cluster_key}` : ''}
                    {n.lat != null && n.lng != null ? ` · ${Number(n.lat).toFixed(4)}, ${Number(n.lng).toFixed(4)}` : ''}
                  </p>
                  {n.note ? <p className="text-sm text-navy/70 mt-2">{n.note}</p> : null}
                </div>
                <div className="text-right space-y-2">
                  <span className="inline-block text-[11px] uppercase tracking-wide px-2 py-1 rounded bg-amber-50 text-amber-800">
                    {n.status}
                  </span>
                  {n.status === 'pooled' ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => markReviewed(n.id)}
                        className="text-sm px-3 py-1.5 rounded-lg bg-navy text-white"
                      >
                        İncelendi
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-navy/40 mt-3">
                {n.created_at ? new Date(n.created_at).toLocaleString('tr-TR') : ''}
              </p>
            </li>
          ))}
        </ul>

        {!loading && rows.length === 0 ? (
          <p className="text-sm text-navy/50">Bu filtrede öneri yok.</p>
        ) : null}
      </div>
    </OpsLayout>
  );
}
