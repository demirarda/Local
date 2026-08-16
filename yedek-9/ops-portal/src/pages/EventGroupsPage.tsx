import { useEffect, useState } from 'react';
import OpsLayout from '../components/OpsLayout';
import { api } from '../lib/api';

type EventGroup = {
  id: string;
  name: string;
  zone_id?: string;
  capacity_total?: number;
  ritual_count?: number;
  created_at?: string;
};

type TableRow = {
  id: string;
  title?: string;
  capacity?: number;
  joined?: number;
};

export default function EventGroupsPage() {
  const [rows, setRows] = useState<EventGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [ritualId, setRitualId] = useState('');
  const [attachGroupId, setAttachGroupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState('');
  const [tables, setTables] = useState<TableRow[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.eventGroups();
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

  async function createGroup() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createEventGroup({
        name: name.trim(),
        capacity_total: capacity ? Number(capacity) : undefined,
      });
      setName('');
      setCapacity('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setSaving(false);
    }
  }

  async function attachRitual() {
    if (!attachGroupId || !ritualId.trim()) return;
    setSaving(true);
    try {
      await api.attachRitualToEventGroup(attachGroupId, ritualId.trim());
      setRitualId('');
      await load();
      if (openId === attachGroupId) await openGroup(attachGroupId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bağlanamadı');
    } finally {
      setSaving(false);
    }
  }

  async function openGroup(id: string) {
    setOpenId(id);
    setTables([]);
    try {
      const data = await api.eventGroup(id);
      const umbrella = data as { tables?: TableRow[] };
      setTables(Array.isArray(umbrella?.tables) ? umbrella.tables : []);
    } catch {
      setTables([]);
    }
  }

  return (
    <OpsLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">ZONE-EVENT grupları</h1>
          <p className="text-sm text-navy/60">
            Şemsiye kart · masaları ritüel olarak bağla · keşifte tek kart
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-navy">Yeni event group</h2>
          <div className="flex flex-wrap gap-2">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
              placeholder="LOCAL @ Emirgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2 text-sm w-28"
              placeholder="Kapasite"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={createGroup}
              className="bg-navy text-white text-sm px-4 py-2 rounded-lg"
            >
              Oluştur
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-navy">Ritüel bağla (masa)</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={attachGroupId}
              onChange={(e) => setAttachGroupId(e.target.value)}
            >
              <option value="">Grup seç</option>
              {rows.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[220px]"
              placeholder="ritual UUID"
              value={ritualId}
              onChange={(e) => setRitualId(e.target.value)}
            />
            <button
              type="button"
              disabled={saving}
              onClick={attachRitual}
              className="bg-navy text-white text-sm px-4 py-2 rounded-lg"
            >
              Bağla
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-navy/50">Yükleniyor…</p> : null}
        <ul className="space-y-3">
          {rows.map((g) => (
            <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <button type="button" className="text-left w-full" onClick={() => openGroup(g.id)}>
                <h2 className="font-semibold text-navy">{g.name}</h2>
                <p className="text-xs text-navy/50 mt-1">
                  {g.ritual_count ?? 0} masa
                  {g.capacity_total != null ? ` · kapasite ${g.capacity_total}` : ''}
                  {g.zone_id ? ` · zone ${g.zone_id.slice(0, 8)}…` : ''}
                </p>
                <p className="text-[10px] text-navy/40 mt-1 font-mono">{g.id}</p>
              </button>
              {openId === g.id && tables.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                  {tables.map((t) => (
                    <li key={t.id} className="text-sm text-navy/80">
                      {t.title || t.id.slice(0, 8)}
                      {t.capacity != null ? ` · ${t.joined ?? 0}/${t.capacity}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </OpsLayout>
  );
}
