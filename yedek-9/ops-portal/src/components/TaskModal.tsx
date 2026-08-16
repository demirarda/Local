import { FormEvent, useEffect, useState } from 'react';
import { api, type OpsUser, type Task } from '../lib/api';

type TaskDetail = Task & {
  comments?: { id: string; body: string; author_name: string; created_at: string }[];
  links?: { id: string; link_type: string; ref_key: string; ref_label?: string }[];
  attachments?: { id: string; file_name: string; url: string; created_at: string }[];
};

type Props = {
  taskId: string | null;
  columnId?: string;
  projectId: string;
  users: OpsUser[];
  onClose: () => void;
  onSaved: () => void;
};

export default function TaskModal({ taskId, columnId, projectId, users, onClose, onSaved }: Props) {
  const isNew = !taskId;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [linkType, setLinkType] = useState('screen');
  const [linkKey, setLinkKey] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssigneeId('');
      setTask(null);
      return;
    }
    setLoading(true);
    api
      .getTask(taskId)
      .then((t) => {
        setTask(t);
        setTitle(t.title);
        setDescription(t.description || '');
        setPriority(t.priority);
        setAssigneeId(t.assignee_id || '');
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew && columnId) {
        await api.createTask({
          project_id: projectId,
          column_id: columnId,
          title,
          description,
          priority,
          assignee_id: assigneeId || null,
        });
      } else if (taskId) {
        await api.updateTask(taskId, {
          title,
          description,
          priority,
          assignee_id: assigneeId || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kayıt başarısız');
    } finally {
      setLoading(false);
    }
  }

  async function addComment() {
    if (!taskId || !comment.trim()) return;
    await api.addComment(taskId, comment);
    setComment('');
    const t = await api.getTask(taskId);
    setTask(t);
    onSaved();
  }

  async function addLink() {
    if (!taskId || !linkKey.trim()) return;
    await api.addLink(taskId, { link_type: linkType, ref_key: linkKey });
    setLinkKey('');
    const t = await api.getTask(taskId);
    setTask(t);
    onSaved();
  }

  if (!isNew && loading && !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl p-8">Yükleniyor…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-navy/10 px-6 py-4 flex justify-between items-center">
          <h2 className="font-bold text-navy">{isNew ? 'Yeni görev' : 'Görev detayı'}</h2>
          <button type="button" onClick={onClose} className="text-navy/50 hover:text-navy text-xl">
            ×
          </button>
        </div>

        <form onSubmit={save} className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-navy/60">Başlık</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border border-navy/15 rounded-lg px-3 py-2"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-navy/60">Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full border border-navy/15 rounded-lg px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-navy/60">Öncelik</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full border border-navy/15 rounded-lg px-3 py-2"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-navy/60">Atanan</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 w-full border border-navy/15 rounded-lg px-3 py-2"
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-navy text-white rounded-lg font-medium hover:bg-navy/90"
          >
            Kaydet
          </button>
        </form>

        {!isNew && task && (
          <div className="px-6 pb-8 space-y-6 border-t border-navy/10 pt-6">
            <section>
              <h3 className="text-xs font-bold uppercase text-navy/50 mb-2">Bağlantılar</h3>
              <ul className="space-y-1 mb-3">
                {task.links?.map((l) => (
                  <li key={l.id} className="text-sm text-navy/80">
                    <span className="font-mono text-xs bg-navy/5 px-1 rounded">{l.link_type}</span>{' '}
                    {l.ref_label || l.ref_key}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="text-sm border rounded-lg px-2 py-1"
                >
                  <option value="screen">screen</option>
                  <option value="host">host</option>
                  <option value="venue">venue</option>
                  <option value="file">file</option>
                  <option value="doc">doc</option>
                  <option value="figma">figma</option>
                </select>
                <input
                  value={linkKey}
                  onChange={(e) => setLinkKey(e.target.value)}
                  placeholder="ref_key"
                  className="flex-1 text-sm border rounded-lg px-2 py-1"
                />
                <button type="button" onClick={addLink} className="text-sm px-3 py-1 bg-gold/20 rounded-lg">
                  Ekle
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase text-navy/50 mb-2">Dosyalar</h3>
              <ul className="space-y-1 mb-3">
                {task.attachments?.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-gold hover:underline"
                    >
                      {a.file_name}
                    </a>
                  </li>
                ))}
              </ul>
              <label className="block">
                <input
                  type="file"
                  accept="image/*,.pdf,.html,.md,.fig,.zip"
                  className="text-sm w-full"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !taskId) return;
                    await api.uploadAttachment(taskId, file);
                    const t = await api.getTask(taskId);
                    setTask(t);
                    onSaved();
                    e.target.value = '';
                  }}
                />
              </label>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase text-navy/50 mb-2">Yorumlar</h3>
              <ul className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {task.comments?.map((c) => (
                  <li key={c.id} className="text-sm bg-cream rounded-lg p-2">
                    <span className="font-medium text-navy">{c.author_name}</span>
                    <p className="text-navy/80 mt-0.5">{c.body}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Yorum yaz…"
                  className="flex-1 text-sm border rounded-lg px-3 py-2"
                />
                <button type="button" onClick={addComment} className="px-3 py-2 bg-navy text-white text-sm rounded-lg">
                  Gönder
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
