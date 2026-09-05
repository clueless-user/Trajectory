import React, { useEffect, useState } from "react";
import { useTaskStore } from "../stores/useTaskStore";
import { useUIStore } from "../stores/useUIStore";
import { Task, TaskStatus } from "../domain/models/types";
import { ImportanceBadge, CognitiveBadge } from "../components/common/Badge";
import { Columns3, Pencil } from "lucide-react";

const COLUMNS: Array<{ status: TaskStatus; label: string; accent: string }> = [
  { status: "inbox", label: "Inbox", accent: "text-zinc-300" },
  { status: "planned", label: "Planned", accent: "text-cyan-300" },
  { status: "in_progress", label: "In Progress", accent: "text-emerald-300" },
  { status: "completed", label: "Completed", accent: "text-zinc-400" },
  { status: "deferred", label: "Deferred", accent: "text-amber-300" },
];

const COMPLETED_VISIBLE = 20;

export const PlannerView: React.FC = () => {
  const { boardTasks, loadBoard, moveTaskStatus } = useTaskStore();
  const { openTaskEditor, setNewTaskModalOpen } = useUIStore();
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const id = e.dataTransfer.getData("text/task-id");
    const task = boardTasks.find((t) => t.id === id);
    if (!task || task.status === status) return;
    moveTaskStatus(id, status);
  };

  const byStatus = (status: TaskStatus): Task[] => {
    const list = boardTasks.filter((t) => t.status === status);
    if (status === "completed") {
      return [...list]
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
        .slice(0, COMPLETED_VISIBLE);
    }
    return list;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider mb-1">
            <Columns3 className="w-4 h-4" />
            <span>Planner — Task Board</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            {boardTasks.length} Tasks Across The Pipeline
          </h1>
          <p className="text-xs text-zinc-400 max-w-xl mt-1">
            Drag cards between columns to change status. Double-click a card to edit. Pull work
            back from Deferred when capacity returns.
          </p>
        </div>
        <button
          onClick={() => setNewTaskModalOpen(true)}
          className="text-xs text-zinc-400 hover:text-cyan-300 border border-zinc-700 hover:border-cyan-700 rounded-lg px-3 py-2 transition-colors shrink-0"
        >
          + New Task
        </button>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-2 flex-1">
        {COLUMNS.map((col) => {
          const tasks = byStatus(col.status);
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumn(col.status);
              }}
              onDragLeave={() => setDragOverColumn((c) => (c === col.status ? null : c))}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`flex flex-col gap-2 w-64 shrink-0 p-3 rounded-xl border transition-colors ${
                dragOverColumn === col.status
                  ? "border-cyan-600 bg-zinc-900/80"
                  : "border-zinc-800 bg-zinc-950/40"
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span
                  className={`text-[11px] font-mono font-semibold uppercase tracking-wider ${col.accent}`}
                >
                  {col.label}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">{tasks.length}</span>
              </div>

              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={() => openTaskEditor(task.id)} />
              ))}

              {tasks.length === 0 && (
                <div className="py-6 text-center text-[11px] text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
                  {col.status === "inbox"
                    ? "Inbox is clear. Captures and unrouted work land here."
                    : col.status === "deferred"
                      ? "Nothing deferred. Compression overflow appears here."
                      : `No ${col.label.toLowerCase()} tasks.`}
                </div>
              )}

              {col.status === "completed" && boardTasks.filter((t) => t.status === "completed").length > COMPLETED_VISIBLE && (
                <div className="text-center text-[10px] text-zinc-600 pt-1">
                  Showing latest {COMPLETED_VISIBLE}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/task-id", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDoubleClick={onEdit}
      className={`group p-3 rounded-lg bg-zinc-900/70 hover:bg-zinc-850/80 border border-zinc-800/80 hover:border-zinc-700 cursor-grab active:cursor-grabbing transition-all ${
        task.status === "completed" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-xs font-medium leading-snug ${
            task.status === "completed" ? "text-zinc-500 line-through" : "text-zinc-200"
          }`}
        >
          {task.title}
        </span>
        <button
          onClick={onEdit}
          className="flex items-center justify-center p-1 rounded text-zinc-600 hover:text-cyan-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Edit task"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <ImportanceBadge importance={task.importance} />
        <CognitiveBadge demand={task.cognitive_demand} />
        <span className="font-mono text-[10px] text-zinc-500">{task.estimated_minutes}m</span>
        {task.due_date && (
          <span className="font-mono text-[10px] text-rose-400">
            due {task.due_date.split("T")[0]}
          </span>
        )}
        {task.actual_minutes > 0 && task.status !== "completed" && (
          <span className="font-mono text-[10px] text-cyan-400">logged {task.actual_minutes}m</span>
        )}
      </div>
    </div>
  );
};
