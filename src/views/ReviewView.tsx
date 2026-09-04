import React, { useState } from "react";
import { useTaskStore } from "../stores/useTaskStore";
import { useReviewStore } from "../stores/useReviewStore";
import { useUIStore } from "../stores/useUIStore";
import { todayLocal } from "../domain/time/date";
import { Button } from "../components/common/Button";
import { Sunset, CheckCircle2, BatteryCharging, BatteryWarning, Target } from "lucide-react";

export const ReviewView: React.FC = () => {
  const todayStr = todayLocal();
  const { tasks, setPrimaryObjective } = useTaskStore();
  const { saveReview } = useReviewStore();
  const { setActiveView } = useUIStore();

  const completedTasks = tasks.filter((t) => t.status === "completed");
  const totalWorkMinutes = completedTasks.reduce(
    (acc, t) => acc + (t.actual_minutes || t.estimated_minutes),
    0
  );

  const [drains, setDrains] = useState("");
  const [boosts, setBoosts] = useState("");
  const [tomorrowObjective, setTomorrowObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const handleFinishShutdown = async () => {
    await saveReview({
      date: todayStr,
      completed_task_count: completedTasks.length,
      total_work_minutes: totalWorkMinutes,
      energy_drains: drains.trim() || undefined,
      energy_boosts: boosts.trim() || undefined,
      tomorrow_objective: tomorrowObjective.trim() || undefined,
      reflection_notes: notes.trim() || undefined,
    });

    if (tomorrowObjective.trim()) {
      setPrimaryObjective(tomorrowObjective.trim());
    }

    setIsSaved(true);
    setTimeout(() => {
      setActiveView("today");
    }, 1200);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
      <div className="p-5 rounded-xl bg-gradient-to-r from-zinc-900 via-rose-950/20 to-zinc-950 border border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-mono text-rose-400 font-semibold uppercase tracking-wider mb-1">
          <Sunset className="w-4 h-4" />
          <span>Evening Shutdown (90-Second Review)</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Daily Reflection & Closeout</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Close open loops, capture behavioral signals, and prime tomorrow's single focus.
        </p>
      </div>

      {/* Progress snapshot */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <div className="text-lg font-bold font-mono text-zinc-100">{completedTasks.length}</div>
            <div className="text-[11px] text-zinc-400">Tasks Completed Today</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-300 font-mono text-xs flex items-center justify-center font-bold">
            M
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-zinc-100">{totalWorkMinutes}m</div>
            <div className="text-[11px] text-zinc-400">Total Work Minutes Recorded</div>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-4 p-5 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <div>
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
            <BatteryWarning className="w-3.5 h-3.5 text-amber-400" />
            <span>1. What drained your energy or derailed execution?</span>
          </label>
          <input
            type="text"
            value={drains}
            onChange={(e) => setDrains(e.target.value)}
            placeholder="e.g. Excessive context-switching, unneeded meetings..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. What gave you energy or created high flow?</span>
          </label>
          <input
            type="text"
            value={boosts}
            onChange={(e) => setBoosts(e.target.value)}
            placeholder="e.g. Uninterrupted 90m deep work block on kernel benchmark..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>3. What is the single primary objective for tomorrow?</span>
          </label>
          <input
            type="text"
            value={tomorrowObjective}
            onChange={(e) => setTomorrowObjective(e.target.value)}
            placeholder="e.g. Complete KV Cache layout microbenchmarks"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 font-medium"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400 block mb-1.5">
            Optional Notes / Epiphanies
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Freeform thoughts..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-zinc-800/80">
          <Button
            variant="primary"
            size="lg"
            onClick={handleFinishShutdown}
            icon={<CheckCircle2 className="w-4 h-4" />}
            disabled={isSaved}
          >
            {isSaved ? "Shutdown Recorded — Rest Well" : "Complete Shutdown (90s)"}
          </Button>
        </div>
      </div>
    </div>
  );
};
