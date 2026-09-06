import React, { useEffect, useState } from "react";
import { useTaskStore } from "../stores/useTaskStore";
import { useHabitStore } from "../stores/useHabitStore";
import { useStateStore } from "../stores/useStateStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useUIStore } from "../stores/useUIStore";
import { Task } from "../domain/models/types";
import { todayLocal } from "../domain/time/date";
import {
  remainingEstimateMinutes,
  plannedLoadMinutes,
  remainingLoadMinutes,
  formatMinutes,
} from "../domain/metrics";
import { formatSeconds, calculateEstimateDelta } from "../domain/sessions/timer";
import { ImportanceBadge, CognitiveBadge } from "../components/common/Badge";
import { Slider } from "../components/common/Slider";
import { DualTargetProgressBar, WorkloadBar } from "../components/common/ProgressBar";
import { Button } from "../components/common/Button";
import { ProjectRepository } from "../repositories/projectRepository";
import {
  Play,
  CheckCircle2,
  Circle,
  Plus,
  Clock,
  Sparkles,
  Edit3,
  History,
  Pause,
  ArrowRight,
  ArrowDownCircle,
  Zap,
} from "lucide-react";

const projectRepo = new ProjectRepository();

export const TodayView: React.FC = () => {
  const todayStr = todayLocal();
  // Weekday label for the banner date — parsed as a LOCAL calendar day
  // (G-01: never raw UTC).
  const weekdayLabel = new Date(`${todayStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });

  const {
    tasks,
    activeTaskId,
    primaryObjective,
    availableMinutes,
    setActiveTask,
    updateTaskStatus,
    setPrimaryObjective,
    createTask,
    moveTaskStatus,
  } = useTaskStore();

  const { habits, todayLogs, logHabitValue } = useHabitStore();
  const { currentState, updateMetric } = useStateStore();
  const {
    activeSession,
    interruptedSessions,
    keepInterruptedRecord,
    discardInterruptedSession,
    resumeInterruptedSession,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
  } = useSessionStore();
  const { setActiveView, setCompressionModalOpen, setNewTaskModalOpen, openTaskEditor } =
    useUIStore();

  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [objectiveInput, setObjectiveInput] = useState(primaryObjective ?? "");
  const [quickCapture, setQuickCapture] = useState("");
  const [projectTitles, setProjectTitles] = useState<Record<string, string>>({});

  // The execution state machine on this screen:
  // idle → (Start) running → (Pause) paused → (Resume) running → (Complete) done
  const activeTask =
    tasks.find((t) => t.id === activeTaskId) || tasks.find((t) => t.status === "in_progress");
  const session = activeSession;
  const sessionOnActive = !!session && session.taskId === activeTask?.id;
  const isRunning = sessionOnActive && session.isRunning;
  const isPaused = sessionOnActive && !session.isRunning;

  const plannedTasks = tasks.filter((t) => t.status === "planned" || t.status === "in_progress");
  // NEXT: the highest-priority planned task that is not the current one.
  const nextTask = plannedTasks.find((t) => t.id !== activeTask?.id);
  const criticalTasks = plannedTasks.filter(
    (t) => t.importance === "critical" && t.id !== activeTask?.id
  );
  const importantTasks = plannedTasks.filter(
    (t) => t.importance === "important" && t.id !== activeTask?.id
  );
  const optionalTasks = plannedTasks.filter(
    (t) => t.importance === "optional" && t.id !== activeTask?.id
  );
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const handleSaveObjective = async () => {
    // Empty submit clears the objective — "nothing matters today yet" is a
    // legitimate, persisted state, not an error.
    await setPrimaryObjective(objectiveInput.trim() || null, todayStr);
    setIsEditingObjective(false);
  };

  // Execution actions — truthful under every transition: completing or
  // deferring the active task settles the running session first.
  const handleStart = async (task: Task) => {
    setActiveTask(task.id);
    await startSession(task);
  };

  const handleComplete = async (task: Task) => {
    if (session && session.taskId === task.id) {
      await finishSession(true);
    } else {
      await updateTaskStatus(task.id, "completed");
    }
  };

  const handleDefer = async (task: Task) => {
    // moveTaskStatus settles any live session for the task first.
    await moveTaskStatus(task.id, "deferred", "today_defer");
  };

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickCapture.trim();
    if (!text) return;
    setQuickCapture(""); // clear synchronously — a rapid double-Enter creates one task
    await createTask({ title: text, source: "quick_capture" });
  };

  // Project context for the current and next task.
  useEffect(() => {
    let cancelled = false;
    async function loadTitles() {
      const ids = [activeTask?.project_id, nextTask?.project_id].filter(
        (id): id is string => !!id && !projectTitles[id]
      );
      for (const id of ids) {
        const project = await projectRepo.getProject(id);
        if (!cancelled && project) {
          setProjectTitles((prev) => ({ ...prev, [id]: project.title }));
        }
      }
    }
    loadTitles();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.project_id, nextTask?.project_id]);

  const renderProjectContext = (task?: Task) =>
    task?.project_id ? projectTitles[task.project_id] : undefined;

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-6xl 2xl:max-w-7xl mx-auto w-full">
      {/* 0. Crash / interruption recovery */}
      {interruptedSessions.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
            <History className="w-3.5 h-3.5" />
            <span>
              Were you working on something? Interrupted session
              {interruptedSessions.length > 1 ? "s" : ""} ({interruptedSessions.length})
            </span>
          </div>
          {interruptedSessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-300 truncate">
                Started {new Date(s.start_time).toLocaleString()} — the app closed before it
                finished.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => resumeInterruptedSession(s.id)}
                  icon={<Play className="w-3.5 h-3.5 fill-current" />}
                >
                  Resume
                </Button>
                <Button size="sm" variant="ghost" onClick={() => keepInterruptedRecord(s.id)}>
                  Keep Record
                </Button>
                <Button size="sm" variant="danger" onClick={() => discardInterruptedSession(s.id)}>
                  Discard
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. Primary objective — "What matters today?" */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Primary Objective For Today</span>
            </div>
            {isEditingObjective ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  type="text"
                  value={objectiveInput}
                  onChange={(e) => setObjectiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveObjective()}
                  placeholder="What matters today?"
                  className="w-full bg-zinc-950 border border-cyan-500/50 rounded px-2.5 py-1 text-sm text-zinc-100 focus:outline-none"
                />
                <Button size="sm" variant="primary" onClick={handleSaveObjective}>
                  Save
                </Button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingObjective(true)}
                className={`text-base font-semibold cursor-pointer flex items-center gap-2 group transition-colors ${
                  primaryObjective
                    ? "text-zinc-100 hover:text-cyan-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Click to edit primary objective"
              >
                <span>
                  {primaryObjective ?? "Click to set today's primary objective"}
                </span>
                <Edit3 className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-mono font-medium text-zinc-300">
              {weekdayLabel} · {todayStr}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Quick capture — offload without leaving the current task */}
      <form onSubmit={handleQuickCapture} className="flex items-center gap-2">
        <ArrowDownCircle className="w-4 h-4 text-zinc-600 shrink-0" />
        <input
          type="text"
          value={quickCapture}
          onChange={(e) => setQuickCapture(e.target.value)}
          placeholder="Quick capture — it lands in the Inbox; classify later…"
          className="flex-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-600"
        />
        {quickCapture.trim() && (
          <Button size="sm" variant="secondary" type="submit">
            Capture
          </Button>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: execution surface */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* 3. NOW — the current task cockpit */}
          <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  data-testid="now-status-dot"
                  className={`w-2 h-2 rounded-full ${
                    // V-3 semantics: running = cyan pulse; in_progress without a
                    // running session (paused included) = cyan solid; idle = zinc.
                    isRunning
                      ? "bg-cyan-400 animate-pulse"
                      : activeTask?.status === "in_progress"
                        ? "bg-cyan-400"
                        : "bg-zinc-600"
                  }`}
                />
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                  NOW — {isRunning ? "Executing" : isPaused ? "Paused" : "Active Focus"}
                </span>
              </div>
              {activeTask && (
                <div className="flex items-center gap-2">
                  <ImportanceBadge importance={activeTask.importance} />
                  <CognitiveBadge demand={activeTask.cognitive_demand} />
                </div>
              )}
            </div>

            {activeTask ? (
              <div className="flex flex-col gap-4">
                <div>
                  {/* break-words: a long title wraps — leading characters are
                      never clipped (V-1c) */}
                  <h2
                    className="text-lg font-bold text-zinc-100 tracking-tight break-words"
                    title={activeTask.title}
                  >
                    {activeTask.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
                    {renderProjectContext(activeTask) && (
                      <span>{renderProjectContext(activeTask)}</span>
                    )}
                    {activeTask.status === "in_progress" && (
                      <span className="text-cyan-400">in progress</span>
                    )}
                  </div>
                  {activeTask.description && (
                    <p className="text-xs text-zinc-400 mt-1">{activeTask.description}</p>
                  )}
                </div>

                {sessionOnActive && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                    <span className="font-mono text-2xl text-zinc-100 tabular-nums">
                      {formatSeconds(session!.elapsedSeconds)}
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        calculateEstimateDelta(session!.elapsedSeconds, activeTask.estimated_minutes)
                          .isOver
                          ? "text-amber-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {
                        calculateEstimateDelta(session!.elapsedSeconds, activeTask.estimated_minutes)
                          .deltaLabel
                      }
                    </span>
                    <span className="text-xs font-mono text-zinc-500 ml-auto">
                      {formatMinutes(remainingEstimateMinutes(activeTask))} remaining
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                  <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Est: {activeTask.estimated_minutes}m</span>
                    </span>
                    {activeTask.actual_minutes > 0 && (
                      <span className="text-cyan-400">Logged: {activeTask.actual_minutes}m</span>
                    )}
                  </div>

                  {/* Unified ghost action row: one pattern for every action
                      (V-2) — sizing/gap single-sourced in Button's "action"
                      size, icons fixed at 16px. */}
                  <div className="flex items-center gap-2">
                    {isRunning ? (
                      <Button
                        variant="ghost"
                        size="action"
                        onClick={pauseSession}
                        icon={<Pause className="w-4 h-4" />}
                      >
                        Pause
                      </Button>
                    ) : isPaused ? (
                      <Button
                        variant="ghost"
                        size="action"
                        onClick={resumeSession}
                        icon={<Play className="w-4 h-4 fill-current" />}
                      >
                        Resume
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="action"
                        onClick={() => handleStart(activeTask)}
                        icon={<Play className="w-4 h-4 fill-current" />}
                      >
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="action"
                      onClick={() => handleComplete(activeTask)}
                      icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    >
                      Complete
                    </Button>
                    <Button
                      variant="ghost"
                      size="action"
                      onClick={() => handleDefer(activeTask)}
                      icon={<ArrowDownCircle className="w-4 h-4 text-amber-400" />}
                      title="Push to Deferred — recoverable in the Planner"
                    >
                      Defer
                    </Button>
                    <Button
                      variant="ghost"
                      size="action"
                      onClick={() => openTaskEditor(activeTask.id)}
                      icon={<Edit3 className="w-4 h-4" />}
                      title="Edit task"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="action"
                      onClick={() => setActiveView("deep_work")}
                      icon={<Zap className="w-4 h-4 text-cyan-400" />}
                      title="Distraction-free cockpit"
                    >
                      Focus
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-zinc-500">
                <p className="text-xs">
                  Nothing in progress. Choose what you're doing now — pick from NEXT below or the
                  plan.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setNewTaskModalOpen(true)}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create New Task
                </Button>
              </div>
            )}
          </div>

          {/* 4. NEXT — the single next commitment */}
          {nextTask && (
            <NextTaskCard
              task={nextTask}
              projectTitle={renderProjectContext(nextTask)}
              onStart={() => handleStart(nextTask)}
            />
          )}

          {/* 5. Plan horizon */}
          <div className="flex flex-col gap-5">
            {criticalTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Must-Do — Critical Leverage ({criticalTasks.length})</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {criticalTasks.map((t) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      onSelect={() => setActiveTask(t.id)}
                      onStart={() => handleStart(t)}
                      onComplete={() => handleComplete(t)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Should-Do — High Leverage ({importantTasks.length})</span>
                </div>
                <Button
                  variant="ghost"
                  size="action"
                  onClick={() => setNewTaskModalOpen(true)}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Add Task
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {importantTasks.map((t) => (
                  <TaskItemCard
                    key={t.id}
                    task={t}
                    onSelect={() => setActiveTask(t.id)}
                    onStart={() => handleStart(t)}
                    onComplete={() => handleComplete(t)}
                  />
                ))}
                {importantTasks.length === 0 && (
                  <div className="p-3 text-center text-xs text-zinc-600 rounded-lg border border-dashed border-zinc-800">
                    No important tasks scheduled. Add one above.
                  </div>
                )}
              </div>
            </div>

            {optionalTasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-500 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span>Optional — If Capacity Permits ({optionalTasks.length})</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {optionalTasks.map((t) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      onSelect={() => setActiveTask(t.id)}
                      onStart={() => handleStart(t)}
                      onComplete={() => handleComplete(t)}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-850">
                <div className="text-[11px] font-mono text-zinc-600 uppercase tracking-wider">
                  Completed Today ({completedTasks.length})
                </div>
                <div className="flex flex-col gap-1 opacity-70">
                  {completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 rounded bg-zinc-950/40 border border-zinc-850/60 text-xs"
                    >
                      <div className="flex items-center gap-2 line-through text-zinc-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-600 shrink-0">
                        {t.actual_minutes || t.estimated_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: pressure, state & habits */}
        <div className="flex flex-col gap-6">
          <WorkloadBar
            committedMinutes={plannedLoadMinutes(tasks)}
            availableMinutes={availableMinutes}
            onCompressClick={() => setCompressionModalOpen(true)}
          />

          <TimeAwarenessLine
            remainingMinutes={remainingLoadMinutes(tasks)}
            availableMinutes={availableMinutes}
          />

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Current State</span>
              <span className="text-[10px] font-mono text-zinc-500">Subjective 1-10</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <Slider
                label="Energy"
                value={currentState?.energy ?? 6}
                color="cyan"
                onChange={(val) => updateMetric(todayStr, "energy", val)}
              />
              <Slider
                label="Mental Clarity"
                value={currentState?.clarity ?? 6}
                color="emerald"
                onChange={(val) => updateMetric(todayStr, "clarity", val)}
              />
              <Slider
                label="Stress"
                value={currentState?.stress ?? 4}
                color="amber"
                onChange={(val) => updateMetric(todayStr, "stress", val)}
              />
              <Slider
                label="Social Battery"
                value={currentState?.social_battery ?? 5}
                color="purple"
                onChange={(val) => updateMetric(todayStr, "social_battery", val)}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200">Habit Trajectory</span>
              <span className="text-[10px] font-mono text-zinc-500">Dual Targets</span>
            </div>

            <div className="flex flex-col gap-3">
              {habits.map((habit) => {
                const log = todayLogs[habit.id];
                const currentVal = log?.value ?? 0;

                return (
                  <div
                    key={habit.id}
                    className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-850 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{habit.title}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            logHabitValue(habit.id, todayStr, Math.max(0, currentVal - 15))
                          }
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs flex items-center justify-center font-mono"
                        >
                          -
                        </button>
                        <button
                          onClick={() => logHabitValue(habit.id, todayStr, currentVal + 15)}
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs flex items-center justify-center font-mono"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <DualTargetProgressBar
                      current={currentVal}
                      normalTarget={habit.normal_target}
                      minimumTarget={habit.minimum_target}
                      unit={habit.unit}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** NEXT: the single next commitment — no backlog dump. */
const NextTaskCard: React.FC<{
  task: Task;
  projectTitle?: string;
  onStart: () => void;
}> = ({ task, projectTitle, onStart }) => (
  <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider mb-1">
        <ArrowRight className="w-3.5 h-3.5" />
        <span>Up Next</span>
      </div>
      <div className="text-sm font-semibold text-zinc-200 truncate">{task.title}</div>
      <div className="flex items-center gap-2 mt-1 font-mono text-[11px] text-zinc-500">
        {projectTitle && <span>{projectTitle}</span>}
        <span>{formatMinutes(remainingEstimateMinutes(task))} remaining</span>
      </div>
    </div>
    <Button
      variant="secondary"
      size="md"
      onClick={onStart}
      icon={<Play className="w-3.5 h-3.5 fill-current text-cyan-400" />}
      className="shrink-0"
    >
      Start
    </Button>
  </div>
);

/** A quiet clock + the honest "planned vs available" line. */
const TimeAwarenessLine: React.FC<{ remainingMinutes: number; availableMinutes: number }> = ({
  remainingMinutes,
  availableMinutes,
}) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    // V-5/V-7: same p-4 card rhythm as the other right-column cards; the two
    // segments are separate nowrap flex children that stack below 2xl (the
    // row form measurably overflows the right column at 1280–1536), so no
    // word ever orphans.
    <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-1.5 2xl:gap-3 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 text-xs font-mono text-zinc-400">
      <span className="whitespace-nowrap">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        {" · "}
        {formatMinutes(remainingMinutes)} of work planned
      </span>
      <span
        className={`whitespace-nowrap ${
          remainingMinutes > availableMinutes ? "text-rose-400" : "text-zinc-500"
        }`}
      >
        {formatMinutes(availableMinutes)} available
      </span>
    </div>
  );
};

interface TaskItemCardProps {
  task: Task;
  onSelect: () => void;
  onStart: () => void;
  onComplete: () => void;
}

const TaskItemCard: React.FC<TaskItemCardProps> = ({ task, onSelect, onStart, onComplete }) => {
  return (
    <div
      onClick={onSelect}
      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 hover:bg-zinc-850/80 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-3 truncate">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          <Circle className="w-4 h-4" />
        </button>
        <div className="truncate">
          <div className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
            {task.title}
          </div>
          {task.description && (
            <div className="text-[11px] text-zinc-500 truncate">{task.description}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <CognitiveBadge demand={task.cognitive_demand} />
        <span className="font-mono text-xs text-zinc-400">{task.estimated_minutes}m</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          icon={<Play className="w-3.5 h-3.5 fill-current text-cyan-400" />}
        >
          Start
        </Button>
      </div>
    </div>
  );
};
