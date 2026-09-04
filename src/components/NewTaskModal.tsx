import React, { useEffect, useState } from "react";
import { Modal } from "./common/Modal";
import { useUIStore } from "../stores/useUIStore";
import { useTaskStore } from "../stores/useTaskStore";
import { Importance, CognitiveDemand } from "../domain/models/types";
import { todayLocal } from "../domain/time/date";
import { Button } from "./common/Button";
import { Plus, Pencil } from "lucide-react";

export const NewTaskModal: React.FC = () => {
  const { isNewTaskModalOpen, setNewTaskModalOpen, editingTaskId, closeTaskEditor } = useUIStore();
  const { createTask, updateTaskDetails, tasks, boardTasks } = useTaskStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState<Importance>("important");
  const [cognitiveDemand, setCognitiveDemand] = useState<CognitiveDemand>("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [scheduleForToday, setScheduleForToday] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const todayStr = todayLocal();
  const isEditing = editingTaskId !== null;
  const editingTask =
    (editingTaskId && (tasks.find((t) => t.id === editingTaskId) ||
      boardTasks.find((t) => t.id === editingTaskId))) ||
    null;

  // Prefill when entering edit mode.
  useEffect(() => {
    if (isNewTaskModalOpen && editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? "");
      setImportance(editingTask.importance);
      setCognitiveDemand(editingTask.cognitive_demand);
      setEstimatedMinutes(editingTask.estimated_minutes);
      setScheduleForToday(editingTask.scheduled_date === todayStr);
    } else if (isNewTaskModalOpen) {
      setTitle("");
      setDescription("");
      setImportance("important");
      setCognitiveDemand("medium");
      setEstimatedMinutes(30);
      setScheduleForToday(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewTaskModalOpen, editingTaskId]);

  const handleClose = () => {
    if (isEditing) closeTaskEditor();
    else setNewTaskModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      if (isEditing && editingTask) {
        await updateTaskDetails(editingTask.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          importance,
          cognitive_demand: cognitiveDemand,
          estimated_minutes: Number(estimatedMinutes),
          scheduled_date: scheduleForToday ? todayStr : editingTask.scheduled_date,
        });
      } else {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          importance,
          cognitive_demand: cognitiveDemand,
          estimated_minutes: Number(estimatedMinutes),
          scheduled_date: scheduleForToday ? todayStr : null,
        });
        setTitle("");
        setDescription("");
      }
      handleClose();
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isNewTaskModalOpen}
      onClose={handleClose}
      title={isEditing ? "Edit Task" : "Create New Task"}
      subtitle={
        isEditing ? "Refine the commitment without touching its history." : "Define actionable, measurable work units."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-zinc-300 block mb-1 font-medium">Task Action Title</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement KV cache memory pool allocator"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1 font-medium">Description / Context</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional context, references, or checklist requirements..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-300 block mb-1 font-medium">Importance</label>
            <select
              value={importance}
              onChange={(e) => setImportance(e.target.value as Importance)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="critical">Critical (Must do)</option>
              <option value="important">Important (High leverage)</option>
              <option value="optional">Optional (Nice to have)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-300 block mb-1 font-medium">Cognitive Demand</label>
            <select
              value={cognitiveDemand}
              onChange={(e) => setCognitiveDemand(e.target.value as CognitiveDemand)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="deep">Deep Focus (Zero distraction)</option>
              <option value="medium">Medium Focus (Analytical)</option>
              <option value="shallow">Shallow (Administrative)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-300 block mb-1 font-medium">Estimated Duration</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={5}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-zinc-500">mins</span>
            </div>
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={scheduleForToday}
                onChange={(e) => setScheduleForToday(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-800 text-cyan-500 focus:ring-0"
              />
              <span>Schedule for Today</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800/80">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!title.trim() || isSaving}
            icon={
              isEditing ? (
                <Pencil className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )
            }
          >
            {isEditing ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
