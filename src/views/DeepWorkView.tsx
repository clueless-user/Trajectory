import React, { useEffect, useState } from "react";
import { useSessionStore } from "../stores/useSessionStore";
import { useTaskStore } from "../stores/useTaskStore";
import { useUIStore } from "../stores/useUIStore";
import { formatSeconds, calculateEstimateDelta } from "../domain/sessions/timer";
import { Button } from "../components/common/Button";
import {
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lightbulb,
  ArrowLeft,
} from "lucide-react";

export const DeepWorkView: React.FC = () => {
  const {
    activeSession,
    pauseSession,
    resumeSession,
    tick,
    recordInterruption,
    updateNotes,
    finishSession,
  } = useSessionStore();

  const { tasks, activeTaskId } = useTaskStore();
  const { setActiveView, setRabbitHoleModalOpen } = useUIStore();

  const [interruptionNote, setInterruptionNote] = useState("");
  const [showInterruptionInput, setShowInterruptionInput] = useState(false);

  // Active task metadata
  const currentTask = tasks.find((t) => t.id === activeSession?.taskId) ||
    tasks.find((t) => t.id === activeTaskId);

  // Timer interval hook
  useEffect(() => {
    if (!activeSession || !activeSession.isRunning) return;

    const interval = setInterval(() => {
      tick(1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.isRunning, tick]);

  const elapsed = activeSession?.elapsedSeconds ?? 0;
  const isRunning = activeSession?.isRunning ?? false;
  const estimated = currentTask?.estimated_minutes ?? 45;
  const delta = calculateEstimateDelta(elapsed, estimated);

  const handleRecordInterruption = () => {
    recordInterruption(interruptionNote.trim() || undefined);
    setInterruptionNote("");
    setShowInterruptionInput(false);
  };

  const handleFinish = async (completeTask: boolean) => {
    await finishSession(completeTask);
    setActiveView("today");
  };

  if (!activeSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
          <Play className="w-8 h-8 fill-current ml-1" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">No Active Deep Work Session</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">
          Select a task from your Today plan to initiate a distraction-free deep work session.
        </p>
        <Button variant="primary" onClick={() => setActiveView("today")} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Today Plan
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 p-8 max-w-4xl mx-auto w-full justify-between select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveView("today")}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Today View
        </Button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
            Deep Work Execution Mode
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRabbitHoleModalOpen(true)}
          icon={<Lightbulb className="w-4 h-4 text-purple-400" />}
        >
          Capture Tangent (R)
        </Button>
      </div>

      {/* Center Focus Cockpit */}
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">
          CURRENT FOCUS OBJECTIVE
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 max-w-2xl tracking-tight mb-8">
          {activeSession.taskTitle}
        </h1>

        {/* Large High-Contrast Calm Timer */}
        <div className="font-mono text-7xl sm:text-8xl font-bold tracking-tighter text-zinc-100 drop-shadow-[0_0_35px_rgba(6,182,212,0.15)] mb-3">
          {formatSeconds(elapsed)}
        </div>

        {/* Estimate vs Actual comparison */}
        <div className="text-xs font-mono text-zinc-400 mb-8 flex items-center gap-3">
          <span>Target: {estimated}m</span>
          <span>•</span>
          <span className={delta.isOver ? "text-amber-400 font-semibold" : "text-zinc-500"}>
            {delta.deltaLabel}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {isRunning ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={pauseSession}
              icon={<Pause className="w-5 h-5 fill-current" />}
              className="px-6 py-2.5 text-sm"
            >
              Pause Session
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={resumeSession}
              icon={<Play className="w-5 h-5 fill-current" />}
              className="px-6 py-2.5 text-sm"
            >
              Resume Session
            </Button>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={() => handleFinish(true)}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-300" />}
            className="px-6 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Complete Task & Finish
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => handleFinish(false)}
            className="px-4 py-2.5 text-sm"
          >
            Log & Stop
          </Button>
        </div>
      </div>

      {/* Bottom Section: Interruptions & Live Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-zinc-900">
        {/* Interruption Logger */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Interruptions ({activeSession.interruptionCount})</span>
            </div>
            {!showInterruptionInput ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowInterruptionInput(true)}
              >
                + Log Interruption
              </Button>
            ) : (
              <button
                onClick={() => setShowInterruptionInput(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            )}
          </div>

          {showInterruptionInput ? (
            <div className="flex gap-2 mt-1">
              <input
                autoFocus
                type="text"
                value={interruptionNote}
                onChange={(e) => setInterruptionNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRecordInterruption()}
                placeholder="Brief reason: phone call, colleague, slack..."
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
              />
              <Button size="sm" variant="primary" onClick={handleRecordInterruption}>
                Save
              </Button>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">
              Track interruptions to understand execution friction without self-blame.
            </div>
          )}
        </div>

        {/* Live Session Notes */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Session Scratchpad</span>
          </div>
          <textarea
            rows={2}
            value={activeSession.notes}
            onChange={(e) => updateNotes(e.target.value)}
            placeholder="Key insights, commit hashes, or state while in the zone..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
};
