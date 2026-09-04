import React, { useEffect, useState } from "react";
import { useHabitStore } from "../stores/useHabitStore";
import { DualTargetProgressBar } from "../components/common/ProgressBar";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { HabitRepository } from "../repositories/habitRepository";
import { calculateRollingConsistency, ConsistencyScore } from "../domain/habits/consistency";
import { todayLocal } from "../domain/time/date";
import { Flame, Plus } from "lucide-react";

const habitRepo = new HabitRepository();
const CONSISTENCY_WINDOW_DAYS = 7;

export const HabitsView: React.FC = () => {
  const todayStr = todayLocal();
  const { habits, todayLogs, logHabitValue, loadHabitsAndTodayLogs } = useHabitStore();
  const [consistencyByHabit, setConsistencyByHabit] = useState<Record<string, ConsistencyScore>>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUnit, setNewUnit] = useState("minutes");
  const [normalTarget, setNormalTarget] = useState(45);
  const [minimumTarget, setMinimumTarget] = useState(10);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadConsistency() {
      const entries = await Promise.all(
        habits.map(async (habit) => {
          const statuses = await habitRepo.getRecentStatuses(
            habit.id,
            todayStr,
            CONSISTENCY_WINDOW_DAYS
          );
          return [habit.id, calculateRollingConsistency(statuses, CONSISTENCY_WINDOW_DAYS)] as const;
        })
      );
      if (!cancelled) setConsistencyByHabit(Object.fromEntries(entries));
    }
    loadConsistency();
    return () => {
      cancelled = true;
    };
  }, [habits, todayLogs, todayStr]);

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSaving(true);
    try {
      await habitRepo.createHabit({
        title: newTitle.trim(),
        unit: newUnit,
        normal_target: Number(normalTarget),
        minimum_target: Number(minimumTarget),
      });
      await loadHabitsAndTodayLogs(todayStr);
      setNewTitle("");
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Failed to create habit:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4" />
            <span>Habits & Behavioral Continuity</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Minimum Viable Day Architecture
          </h1>
          <p className="text-xs text-zinc-400 max-w-xl mt-1">
            Maintain neural trajectory without streak anxiety. Completing a minimum target preserves momentum on demanding days.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          New Habit
        </Button>
      </div>

      {/* Habits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {habits.map((habit) => {
          const log = todayLogs[habit.id];
          const currentVal = log?.value ?? 0;
          const consistency = consistencyByHabit[habit.id];

          return (
            <div
              key={habit.id}
              className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between gap-4 shadow-md"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-semibold text-zinc-100">{habit.title}</h3>
                  {consistency && (
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                      title={`Last ${CONSISTENCY_WINDOW_DAYS} days: ${consistency.normalDays} normal, ${consistency.minimumDays} minimum, ${consistency.missedDays} missed`}
                    >
                      {consistency.trajectoryLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
                  <span>Target: {habit.normal_target} {habit.unit}</span>
                  <span>•</span>
                  <span>Minimum Viable: {habit.minimum_target} {habit.unit}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <DualTargetProgressBar
                  current={currentVal}
                  normalTarget={habit.normal_target}
                  minimumTarget={habit.minimum_target}
                  unit={habit.unit}
                />

                {/* Direct quick-log inputs */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
                  <span className="text-zinc-500">Quick Log:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => logHabitValue(habit.id, todayStr, habit.minimum_target)}
                      className="px-2 py-1 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800 text-[11px] font-mono hover:bg-cyan-900 transition-colors"
                      title="Log exact Minimum Viable Target"
                    >
                      Min ({habit.minimum_target})
                    </button>
                    <button
                      onClick={() => logHabitValue(habit.id, todayStr, habit.normal_target)}
                      className="px-2 py-1 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 text-[11px] font-mono hover:bg-emerald-900 transition-colors"
                      title="Log full Normal Target"
                    >
                      Full ({habit.normal_target})
                    </button>
                    <div className="flex items-center bg-zinc-800 rounded px-1.5 py-0.5 gap-1 font-mono text-xs">
                      <button
                        onClick={() => logHabitValue(habit.id, todayStr, Math.max(0, currentVal - 10))}
                        className="text-zinc-400 hover:text-white px-1"
                      >
                        -
                      </button>
                      <span className="text-zinc-200">{currentVal}</span>
                      <button
                        onClick={() => logHabitValue(habit.id, todayStr, currentVal + 10)}
                        className="text-zinc-400 hover:text-white px-1"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Habit Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Habit"
        subtitle="Configure dual targets to support minimum viable performance on bad days."
      >
        <form onSubmit={handleCreateHabit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-300 block mb-1 font-medium">Habit Title</label>
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Weight Training, Language Study, Meditation"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-300 block mb-1 font-medium">Measurement Unit</label>
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="minutes, pages, reps, sessions"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-300 block mb-1 font-medium">Normal Target</label>
              <input
                type="number"
                min={1}
                value={normalTarget}
                onChange={(e) => setNormalTarget(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-cyan-300 block mb-1 font-medium">Minimum Viable Target</label>
              <input
                type="number"
                min={1}
                value={minimumTarget}
                onChange={(e) => setMinimumTarget(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!newTitle.trim() || isSaving}>
              Save Habit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
