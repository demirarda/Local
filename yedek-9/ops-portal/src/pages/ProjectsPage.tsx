import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import OpsLayout from '../components/OpsLayout';
import { api, getStoredUser } from '../lib/api';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const canImport = user?.role === 'pm' || user?.role === 'founder';
  const [projects, setProjects] = useState<
    { id: string; name: string; city?: string; status: string; task_count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState('');

  function load() {
    api
      .projects()
      .then(setProjects)
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [navigate]);

  async function importGaps(projectId: string) {
    setImporting(projectId);
    setImportMsg('');
    try {
      const r = await api.importSpecGaps(projectId, 'canon');
      setImportMsg(`${r.created} görev eklendi, ${r.skipped} atlandı (zaten vardı).`);
      load();
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Import başarısız');
    } finally {
      setImporting(null);
    }
  }

  return (
    <OpsLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Projeler</h1>
          <p className="text-sm text-navy/60 mt-1">Lansman ve yürütme board&apos;ları</p>
        </div>

        {importMsg && (
          <p className="mb-4 text-sm bg-gold/10 text-navy px-4 py-2 rounded-lg border border-gold/20">
            {importMsg}
          </p>
        )}

        {loading ? (
          <p className="text-navy/60">Yükleniyor…</p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="bg-white rounded-xl border border-navy/10 overflow-hidden">
                <Link
                  to={`/projects/${p.id}`}
                  className="block p-5 hover:bg-cream/50 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-semibold text-lg text-navy">{p.name}</h2>
                      {p.city && <p className="text-sm text-navy/50 mt-1">{p.city}</p>}
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gold/15 text-navy">
                      {p.task_count} görev
                    </span>
                  </div>
                </Link>
                {canImport && (
                  <div className="px-5 pb-4 pt-0 flex gap-2">
                    <button
                      type="button"
                      disabled={importing === p.id}
                      onClick={(e) => {
                        e.preventDefault();
                        importGaps(p.id);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-navy/15 text-navy hover:bg-navy/5 disabled:opacity-50"
                    >
                      {importing === p.id ? 'İçe aktarılıyor…' : 'Spec eksiklerini içe aktar (18)'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </OpsLayout>
  );
}
