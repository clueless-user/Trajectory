import React, { useState } from "react";
import { Modal } from "./common/Modal";
import { useUIStore } from "../stores/useUIStore";
import { useTaskStore } from "../stores/useTaskStore";
import { RabbitHoleRepository } from "../repositories/rabbitHoleRepository";
import { Button } from "./common/Button";
import { Lightbulb } from "lucide-react";

const rabbitHoleRepo = new RabbitHoleRepository();

export const RabbitHoleModal: React.FC = () => {
  const { isRabbitHoleModalOpen, setRabbitHoleModalOpen } = useUIStore();
  const { activeTaskId, tasks } = useTaskStore();
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    setIsSaving(true);
    try {
      await rabbitHoleRepo.createRabbitHole({
        raw_text: text.trim(),
        active_task_id: activeTask?.id || null,
        active_project_id: activeTask?.project_id || null,
      });
      setText("");
      setRabbitHoleModalOpen(false);
    } catch (err) {
      console.error("Failed to capture rabbit hole:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isRabbitHoleModalOpen}
      onClose={() => setRabbitHoleModalOpen(false)}
      title="Capture Rabbit Hole"
      subtitle="Offload tangential curiosities without interrupting active execution."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {activeTask && (
          <div className="p-2.5 rounded bg-zinc-950/80 border border-zinc-800 text-xs">
            <span className="text-zinc-500">Active Task Provenance:</span>
            <div className="text-cyan-300 font-medium mt-0.5">{activeTask.title}</div>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-300 block mb-1.5 font-medium">
            What curiosity / tangent just popped up?
          </label>
          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            placeholder="e.g. Look into memory-mapped I/O latency vs io_uring benchmarks..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
          />
          <div className="flex justify-between text-[11px] text-zinc-500 mt-1">
            <span>Will be stored in review backlog for later conversion.</span>
            <span>Ctrl+Enter to save</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRabbitHoleModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!text.trim() || isSaving}
            icon={<Lightbulb className="w-3.5 h-3.5" />}
          >
            Capture Thought
          </Button>
        </div>
      </form>
    </Modal>
  );
};
