import type { BoardColumn, Task } from '../lib/api';
import TaskCard from './TaskCard';

type Props = {
  column: BoardColumn;
  onTaskClick: (task: Task) => void;
  onDrop: (taskId: string, position: number) => void;
  onAddTask: () => void;
};

export default function KanbanColumn({ column, onTaskClick, onDrop, onAddTask }: Props) {
  return (
    <section
      className="flex-shrink-0 w-72 flex flex-col max-h-[calc(100vh-8rem)]"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/task-id');
        if (taskId) onDrop(taskId, column.tasks.length);
      }}
    >
      <header className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-navy">
          {column.name}
          <span className="ml-2 text-navy/40 font-normal">{column.tasks.length}</span>
        </h2>
        <button
          type="button"
          onClick={onAddTask}
          className="text-navy/50 hover:text-gold text-lg leading-none"
          title="Görev ekle"
        >
          +
        </button>
      </header>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px] rounded-xl bg-navy/[0.03] p-2 border border-dashed border-navy/10">
        {column.tasks.map((task, index) => (
          <div
            key={task.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const taskId = e.dataTransfer.getData('text/task-id');
              if (taskId) onDrop(taskId, index);
            }}
          >
            <TaskCard task={task} onClick={() => onTaskClick(task)} onDragStart={() => {}} />
          </div>
        ))}
      </div>
    </section>
  );
}
