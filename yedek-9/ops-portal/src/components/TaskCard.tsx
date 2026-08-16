import type { Task } from '../lib/api';

const priorityColors: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-800',
  urgent: 'bg-red-50 text-red-700',
};

type Props = {
  task: Task;
  onClick: () => void;
  onDragStart: () => void;
};

export default function TaskCard({ task, onClick, onDragStart }: Props) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onClick={onClick}
      className="bg-white rounded-lg border border-navy/10 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-gold/40 transition"
    >
      <p className="text-sm font-medium text-navy leading-snug">{task.title}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${priorityColors[task.priority] || priorityColors.medium}`}>
          {task.priority}
        </span>
        {task.links?.slice(0, 2).map((l) => (
          <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded bg-navy/5 text-navy/70">
            {l.link_type}:{l.ref_key.slice(0, 12)}
          </span>
        ))}
      </div>
      {task.assignee_name && (
        <p className="text-[11px] text-navy/50 mt-2 truncate">@{task.assignee_name}</p>
      )}
    </article>
  );
}
