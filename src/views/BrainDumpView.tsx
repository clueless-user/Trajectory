import React, { useEffect, useState } from "react";
import { BrainDumpRepository } from "../repositories/brainDumpRepository";
import { useTaskStore } from "../stores/useTaskStore";
import { todayLocal } from "../domain/time/date";
import { Button } from "../components/common/Button";
import { FileText, Save, ArrowRight } from "lucide-react";

const brainDumpRepo = new BrainDumpRepository();

export const BrainDumpView: React.FC = () => {
  const [content, setContent] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { createTask } = useTaskStore();

  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    async function load() {
      const dump = await brainDumpRepo.getLatestBrainDump();
      if (dump) {
        setContent(dump.content);
        setLastSaved(new Date(dump.updated_at).toLocaleTimeString());
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await brainDumpRepo.saveBrainDump(content);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromoteToTask = async () => {
    if (!selectedText.trim()) return;
    await createTask({
      title: selectedText.trim(),
      importance: "important",
      cognitive_demand: "medium",
      scheduled_date: todayLocal(),
    });
    setSelectedText("");
  };

  const handleTextSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const selection = target.value.substring(target.selectionStart, target.selectionEnd);
    setSelectedText(selection);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-5xl mx-auto w-full h-full">
      <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-400" />
          <div>
            <h1 className="text-sm font-bold text-zinc-100">Brain Dump & Cognitive Canvas</h1>
            <p className="text-xs text-zinc-400">
              Messy thoughts, ambiguous ideas, fragments. Zero structure required.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[11px] font-mono text-zinc-500">
              Saved {lastSaved}
            </span>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            Save
          </Button>
        </div>
      </div>

      {selectedText.trim() && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800 flex items-center justify-between animate-fadeIn shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs text-cyan-300 font-semibold shrink-0">Selected:</span>
            <span className="text-xs text-zinc-200 truncate italic">"{selectedText.trim()}"</span>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handlePromoteToTask}
            icon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Promote to Task
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-[400px] flex flex-col bg-zinc-950 rounded-xl border border-zinc-800 p-4 shadow-inner">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onSelect={handleTextSelect}
          placeholder="Dump whatever is in your head right now without filtering...
- Architecture thoughts
- Quick reminders
- Questions to research
- Unsorted task fragments..."
          className="w-full flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none font-mono leading-relaxed"
        />
      </div>
    </div>
  );
};
