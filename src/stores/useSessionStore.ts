import { create } from "zustand";
import { Task, WorkSession } from "../domain/models/types";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { useTaskStore } from "./useTaskStore";

export interface ActiveSession {
  // Database row backing this session. Written at start so a crash leaves a
  // truthful record instead of losing the session entirely.
  sessionId: string;
  taskId: string | null;
  taskTitle: string;
  startTime: string;
  // Truthful timing model: elapsed time is derived from wall-clock
  // timestamps, not from interval ticks, so throttled/background timers and
  // view unmounts cannot distort the recorded duration.
  accumulatedSeconds: number;
  runningSinceMs: number | null;
  elapsedSeconds: number;
  isRunning: boolean;
  interruptionCount: number;
  notes: string;
}

interface SessionState {
  activeSession: ActiveSession | null;
  // Crash recovery: paused rows discovered at boot (the app died before
  // finishing them). Surfaced on Today until resolved.
  interruptedSessions: WorkSession[];
  startSession: (task: Task) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  syncElapsed: () => void;
  recordInterruption: (note?: string) => void;
  updateNotes: (notes: string) => void;
  finishSession: (completeTask?: boolean) => Promise<void>;
  cancelSession: () => Promise<void>;
  loadInterruptedSessions: () => Promise<void>;
  keepInterruptedRecord: (sessionId: string) => Promise<void>;
  discardInterruptedSession: (sessionId: string) => Promise<void>;
  // Adoption: continue an interrupted session in place — same DB row, no
  // duplicate session, timer restarts from now.
  resumeInterruptedSession: (sessionId: string) => Promise<void>;
}

const sessionRepo = new WorkSessionRepository();
const taskRepo = new TaskRepository();
const eventLog = new EventLogRepository();

// Instrumentation is fire-and-forget: it must never break the user action.
function logEvent(
  eventType: string,
  entityId: string | null,
  payload?: Record<string, unknown>
) {
  eventLog.record(eventType, "session", entityId, payload).catch((e) =>
    console.error("event log failed:", e)
  );
}

/**
 * Settle the live session for a task before the task leaves active work
 * (completed / deferred / returned to inbox). Finishes without completing
 * the task — the caller owns the status change. No-op when no session
 * matches. This is the single settlement path; every status transition
 * that could strand a session must go through it.
 */
export async function settleActiveSessionForTask(taskId: string): Promise<void> {
  const { activeSession, finishSession } = useSessionStore.getState();
  if (activeSession && activeSession.taskId === taskId) {
    await finishSession(false);
  }
}

// Injectable clock so tests can control time without real waiting.
let now: () => Date = () => new Date();
export function setNowForTesting(fn: () => Date) {
  now = fn;
}

// The display-refresh interval is owned by the store, not the view: sessions
// keep ticking (and keep truthful time) no matter which view is mounted.
let tickerId: ReturnType<typeof setInterval> | null = null;
let lastPersistedSeconds = 0;
function startTicker() {
  stopTicker();
  tickerId = setInterval(() => useSessionStore.getState().syncElapsed(), 1000);
}
function stopTicker() {
  if (tickerId !== null) {
    clearInterval(tickerId);
    tickerId = null;
  }
}

function runningSeconds(session: ActiveSession): number {
  if (session.runningSinceMs === null) return 0;
  return Math.max(0, (now().getTime() - session.runningSinceMs) / 1000);
}

function totalSeconds(session: ActiveSession): number {
  return Math.floor(session.accumulatedSeconds + runningSeconds(session));
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  interruptedSessions: [],

  startSession: async (task: Task) => {
    if (get().activeSession) return;

    // If task is not already in_progress, transition it
    if (task.status !== "in_progress") {
      useTaskStore.getState().updateTaskStatus(task.id, "in_progress");
    }

    const startTime = now().toISOString();
    // Persist the row immediately with completed_state 'paused': if the app
    // dies mid-session, the record truthfully shows an unfinished session.
    const session = await sessionRepo.createSession({
      task_id: task.id,
      start_time: startTime,
      end_time: startTime,
      duration_seconds: 0,
      interruption_count: 0,
      completed_state: "paused",
      notes: null,
    });

    set({
      activeSession: {
        sessionId: session.id,
        taskId: task.id,
        taskTitle: task.title,
        startTime,
        accumulatedSeconds: 0,
        runningSinceMs: now().getTime(),
        elapsedSeconds: 0,
        isRunning: true,
        interruptionCount: 0,
        notes: "",
      },
    });
    lastPersistedSeconds = 0;
    startTicker();
    logEvent("session.started", session.id, { task_id: task.id });
  },

  pauseSession: () => {
    const target = get().activeSession;
    if (!target || !target.isRunning) return; // already paused / none
    set((state) => {
      if (!state.activeSession || !state.activeSession.isRunning) return state;
      const session = state.activeSession;
      const accumulated = session.accumulatedSeconds + runningSeconds(session);
      return {
        activeSession: {
          ...session,
          accumulatedSeconds: accumulated,
          runningSinceMs: null,
          elapsedSeconds: Math.floor(accumulated),
          isRunning: false,
        },
      };
    });
    stopTicker();
    logEvent("session.paused", target.sessionId);
  },

  resumeSession: () => {
    const target = get().activeSession;
    if (!target || target.isRunning) return; // already running / none
    set((state) => {
      if (!state.activeSession || state.activeSession.isRunning) return state;
      return {
        activeSession: {
          ...state.activeSession,
          runningSinceMs: now().getTime(),
          isRunning: true,
        },
      };
    });
    startTicker();
    logEvent("session.resumed", target.sessionId);
  },

  syncElapsed: () => {
    const session = get().activeSession;
    if (!session) return;
    const elapsed = totalSeconds(session);
    if (elapsed === session.elapsedSeconds) return;
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, elapsedSeconds: elapsed }
        : state.activeSession,
    }));
    // The persisted row is the authority: sync running time into it at most
    // once per 30s so a crash/close loses at most 30 seconds of truth.
    if (elapsed - lastPersistedSeconds >= 30) {
      lastPersistedSeconds = elapsed;
      sessionRepo
        .updateSession(session.sessionId, { duration_seconds: elapsed })
        .catch((e) => console.error("session sync failed:", e));
    }
  },

  recordInterruption: (note?: string) => {
    set((state) => {
      if (!state.activeSession) return state;
      const count = state.activeSession.interruptionCount + 1;
      const appendNote = note
        ? `${state.activeSession.notes}\n[Interruption ${count}]: ${note}`.trim()
        : state.activeSession.notes;
      return {
        activeSession: {
          ...state.activeSession,
          interruptionCount: count,
          notes: appendNote,
        },
      };
    });
  },

  updateNotes: (notes: string) => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          notes,
        },
      };
    });
  },

  finishSession: async (completeTask = false) => {
    const { activeSession } = get();
    if (!activeSession) return;
    stopTicker();
    // Null the live state synchronously: re-entrant/rapid double calls can
    // never double-count actual_minutes or emit duplicate events.
    set({ activeSession: null });
    lastPersistedSeconds = 0;

    const endTime = now().toISOString();
    // Running time is settled into the accumulation before reading duration.
    const durationSeconds = totalSeconds({
      ...activeSession,
      accumulatedSeconds: activeSession.accumulatedSeconds + runningSeconds(activeSession),
      runningSinceMs: null,
    });
    const additionalMinutes = Math.round(durationSeconds / 60);

    // Promote the crash-safety row to a finished session. start_time /
    // end_time are the wall-clock brackets; duration_seconds counts only
    // running time, so paused gaps are excluded from the duration.
    await sessionRepo.updateSession(activeSession.sessionId, {
      end_time: endTime,
      duration_seconds: durationSeconds,
      interruption_count: activeSession.interruptionCount,
      completed_state: "finished",
      notes: activeSession.notes || null,
    });

    // Update task actual_minutes
    if (activeSession.taskId) {
      const task = await taskRepo.getTaskById(activeSession.taskId);
      if (task) {
        const newActual = (task.actual_minutes || 0) + additionalMinutes;
        await taskRepo.updateTask(task.id, { actual_minutes: newActual });
        // Reflect the accrued time immediately; the repo write alone leaves
        // TodayView showing a stale estimate until the next reload.
        useTaskStore.setState((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id ? { ...t, actual_minutes: newActual } : t
          ),
        }));

        if (completeTask) {
          await useTaskStore.getState().updateTaskStatus(task.id, "completed");
        }
      }
    }

    logEvent("session.finished", activeSession.sessionId, {
      duration_seconds: durationSeconds,
      completed_task: completeTask,
      interruption_count: activeSession.interruptionCount,
    });
  },

  cancelSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    stopTicker();
    set({ activeSession: null });
    lastPersistedSeconds = 0;
    // Cancellation means the session never happened: remove the crash-safety
    // row so no orphaned record is left behind.
    await sessionRepo.deleteSession(activeSession.sessionId);
    logEvent("session.cancelled", activeSession.sessionId);
  },

  loadInterruptedSessions: async () => {
    const rows = await sessionRepo.getPausedSessions();
    set({ interruptedSessions: rows });
  },

  keepInterruptedRecord: async (sessionId: string) => {
    const row = get().interruptedSessions.find((s) => s.id === sessionId);
    if (!row) return; // already resolved — no duplicate events
    set((state) => ({
      interruptedSessions: state.interruptedSessions.filter((s) => s.id !== sessionId),
    }));
    // Finalize truthfully: mark the row 'interrupted' with the recovery
    // moment as its end boundary. Duration keeps its last synced value
    // (<=30s stale) — real recorded time, never invented.
    await sessionRepo.updateSession(sessionId, {
      end_time: now().toISOString(),
      duration_seconds: row.duration_seconds,
      completed_state: "interrupted",
    });
    logEvent("session.recovered_interrupted", sessionId);
  },

  discardInterruptedSession: async (sessionId: string) => {
    if (!get().interruptedSessions.some((s) => s.id === sessionId)) return;
    set((state) => ({
      interruptedSessions: state.interruptedSessions.filter((s) => s.id !== sessionId),
    }));
    await sessionRepo.deleteSession(sessionId);
    logEvent("session.discarded", sessionId);
  },

  resumeInterruptedSession: async (sessionId: string) => {
    if (get().activeSession) return; // never two live sessions
    const row = get().interruptedSessions.find((s) => s.id === sessionId);
    if (!row) return;
    // Claim synchronously: a rapid double-click cannot adopt twice.
    set((state) => ({
      interruptedSessions: state.interruptedSessions.filter((s) => s.id !== sessionId),
    }));

    // Resolve the task (it may have been deleted while the session sat paused).
    let taskTitle = "Unassigned session";
    if (row.task_id) {
      const task = await taskRepo.getTaskById(row.task_id);
      if (task) {
        taskTitle = task.title;
        if (task.status !== "in_progress") {
          useTaskStore.getState().updateTaskStatus(task.id, "in_progress");
        }
      }
    }

    // Adopt the recorded duration as the starting accumulation: the
    // persisted row — not UI timer state — is the source of truth.
    set({
      activeSession: {
        sessionId: row.id,
        taskId: row.task_id ?? null,
        taskTitle,
        startTime: row.start_time,
        accumulatedSeconds: row.duration_seconds,
        runningSinceMs: now().getTime(),
        elapsedSeconds: row.duration_seconds,
        isRunning: true,
        interruptionCount: row.interruption_count,
        notes: row.notes ?? "",
      },
    });
    lastPersistedSeconds = row.duration_seconds;
    startTicker();
    logEvent("session.resumed_after_interrupt", sessionId, { task_id: row.task_id });
  },
}));
