import React, { useEffect, useState } from "react";
import { useTaskStore } from "../stores/useTaskStore";
import { useReviewStore } from "../stores/useReviewStore";
import { useUIStore } from "../stores/useUIStore";
import { todayLocal } from "../domain/time/date";
import { RabbitHoleRepository } from "../repositories/rabbitHoleRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { RabbitHole } from "../domain/models/types";
import { Button } from "../components/common/Button";
import {
  Sunset,
  CheckCircle2,
  BatteryCharging,
  BatteryWarning,
  Target,
  Lightbulb,
  ArrowRight,
  Archive,
  BookOpen,
} from "lucide-react";

const rabbitHoleRepo = new RabbitHoleRepository();
const taskRepo = new TaskRepository();

export const ReviewView: React.FC = () => {
  const todayStr = todayLocal();
  const { tasks, setPrimaryObjective, createTask } = useTaskStore();
  const { saveReview, loadTodayReview, recentReviews } = useReviewStore();
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

  // Retrieve today's previously saved review and prefill — editing and
  // re-saving upserts; nothing is lost.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadTodayReview(todayStr);
      if (cancelled) return;
      const saved = useReviewStore.getState().todayReview;
      if (saved) {
        setDrains(saved.energy_drains ?? "");
        setBoosts(saved.energy_boosts ?? "");
        setTomorrowObjective(saved.tomorrow_objective ?? "");
        setNotes(saved.reflection_notes ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-3xl 2xl:max-w-4xl mx-auto w-full">
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
            <div className="text-[11px] text-zinc-400">Work Minutes Logged Today</div>
          </div>
        </div>
      </div>

      {/* Capture backlog: open rabbit holes awaiting conversion */}
      <CaptureBacklog onCreateTask={createTask} />

      {/* Recent reflections */}
      {recentReviews.length > 0 && (
        <div className="flex flex-col gap-2 p-5 rounded-xl bg-zinc-900/50 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 font-semibold uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span>Recent Reflections</span>
          </div>
          {recentReviews
            .filter((r) => r.date !== todayStr)
            .slice(0, 5)
            .map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 p-2 rounded-lg bg-zinc-950/50 border border-zinc-850/60 text-xs"
              >
                <span className="font-mono text-[10px] text-zinc-500 shrink-0">{r.date}</span>
                <span className="text-zinc-400 truncate flex-1">
                  {r.tomorrow_objective ?? "No objective recorded"}
                </span>
                <span className="font-mono text-[10px] text-zinc-600 shrink-0">
                  {r.completed_task_count} done · {r.total_work_minutes}m
                </span>
              </div>
            ))}
        </div>
      )}

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
            icon={<CheckCircle2 className="w-5 h-5" />}
            disabled={isSaved}
          >
            {isSaved ? "Shutdown Recorded — Rest Well" : "Complete Shutdown (90s)"}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface CaptureBacklogProps {
  onCreateTask: ReturnType<typeof useTaskStore.getState>["createTask"];
}

const CaptureBacklog: React.FC<CaptureBacklogProps> = ({ onCreateTask }) => {
  const [backlog, setBacklog] = useState<RabbitHole[]>([]);
  const [provenance, setProvenance] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);

  const reload = async () => {
    const holes = await rabbitHoleRepo.getAllRabbitHoles("captured");
    setBacklog(holes);
    const titles: Record<string, string> = {};
    for (const hole of holes) {
      if (hole.active_task_id && !titles[hole.active_task_id]) {
        const task = await taskRepo.getTaskById(hole.active_task_id);
        titles[hole.active_task_id] = task?.title ?? "Deleted task";
      }
    }
    setProvenance(titles);
  };

  useEffect(() => {
    reload();
  }, []);

  const handleConvert = async (hole: RabbitHole) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      // Conversion lands in the Inbox: a captured curiosity becomes work to
      // route, not an instant commitment for today (documented decision).
      const title = hole.raw_text.trim().split("\n")[0].slice(0, 120);
      const task = await onCreateTask({ title });
      await rabbitHoleRepo.updateStatus(hole.id, "converted_task", task.id);
      await reload();
    } finally {
      setIsBusy(false);
    }
  };

  const handleDismiss = async (hole: RabbitHole) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await rabbitHoleRepo.updateStatus(hole.id, "archived");
      await reload();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-5 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-mono text-purple-300 font-semibold uppercase tracking-wider">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>Capture Backlog — Open Rabbit Holes ({backlog.length})</span>
        </div>
      </div>

      {backlog.map((hole) => (
        <div
          key={hole.id}
          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs text-zinc-200 truncate" title={hole.raw_text}>
              {hole.raw_text}
            </span>
            <span className="font-mono text-[10px] text-zinc-500 truncate">
              {hole.created_at.split("T")[0]}
              {hole.active_task_id && ` · during: ${provenance[hole.active_task_id] ?? "…"}`}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={() => handleConvert(hole)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              To Task
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => handleDismiss(hole)}
              icon={<Archive className="w-3.5 h-3.5" />}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}

      {backlog.length === 0 && (
        <div className="py-5 text-center text-[11px] text-zinc-600 border border-dashed border-zinc-800 rounded-lg">
          No open rabbit holes. Captured tangents (R) wait here for conversion.
        </div>
      )}
    </div>
  );
};
