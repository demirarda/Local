import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import KanbanColumn from '../components/KanbanColumn';
import TaskModal from '../components/TaskModal';
import { api, type BoardColumn, type OpsUser, type Task } from '../lib/api';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState('');
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [users, setUsers] = useState<OpsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskColumnId, setNewTaskColumnId] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!projectId) return;
    const data = await api.board(projectId);
    setProjectName(data.project.name);
    setColumns(data.columns);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([loadBoard(), api.users().then(setUsers)])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, loadBoard]);

  async function handleDrop(taskId: string, columnId: string, position: number) {
    await api.moveTask(taskId, columnId, position);
    await loadBoard();
  }

  function openNewTask(columnId: string) {
    setSelectedTaskId(null);
    setNewTaskColumnId(columnId);
  }

  if (!projectId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-6 py-3 flex items-center gap-4 shrink-0">
        <Link to="/" className="text-white/70 hover:text-white text-sm">
          ← Projeler
        </Link>
        <h1 className="font-bold text-lg">{projectName || 'Board'}</h1>
      </header>

      {loading ? (
        <p className="p-8 text-navy/60">Board yükleniyor…</p>
      ) : (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 min-w-max pb-4">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                onTaskClick={(task: Task) => {
                  setNewTaskColumnId(null);
                  setSelectedTaskId(task.id);
                }}
                onDrop={(taskId, position) => handleDrop(taskId, col.id, position)}
                onAddTask={() => openNewTask(col.id)}
              />
            ))}
          </div>
        </div>
      )}

      {(selectedTaskId || newTaskColumnId) && (
        <TaskModal
          taskId={selectedTaskId}
          columnId={newTaskColumnId || undefined}
          projectId={projectId}
          users={users}
          onClose={() => {
            setSelectedTaskId(null);
            setNewTaskColumnId(null);
          }}
          onSaved={loadBoard}
        />
      )}
    </div>
  );
}
