import { create } from "zustand";
import { Task } from "../domain/models/types";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { useTaskStore } from "./useTaskStore";

export interface ActiveSession {
  // Database row backing this session. Written at start so a crash leaves a
  // truthful record instead of losing the session entirely.
  sessionId: string;
  taskId: string | null;
  taskTitle: string;
  startTime: string;
  elapsedSeconds: number;
  isRunning: boolean;
  interruptionCount: number;
  notes: string;
}

interface SessionState {
  activeSession: ActiveSession | null;
  startSession: (task: Task) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  tick: (deltaSeconds?: number) => void;
  recordInterruption: (note?: string) => void;
  updateNotes: (notes: string) => void;
  finishSession: (completeTask?: boolean) => Promise<void>;
  cancelSession: () => Promise<void>;
}

const sessionRepo = new WorkSessionRepository();
const taskRepo = new TaskRepository();

// Injectable clock so tests can control time without real waiting.
let now: () => Date = () => new Date();
export function setNowForTesting(fn: () => Date) {
  now = fn;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,

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
        elapsedSeconds: 0,
        isRunning: true,
        interruptionCount: 0,
        notes: "",
      },
    });
  },

  pauseSession: () => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          isRunning: false,
        },
      };
    });
  },

  resumeSession: () => {
    set((state) => {
      if (!state.activeSession) return state;
      return {
        activeSession: {
          ...state.activeSession,
          isRunning: true,
        },
      };
    });
  },

  tick: (deltaSeconds = 1) => {
    set((state) => {
      if (!state.activeSession || !state.activeSession.isRunning) return state;
      return {
        activeSession: {
          ...state.activeSession,
          elapsedSeconds: state.activeSession.elapsedSeconds + deltaSeconds,
        },
      };
    });
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

    const endTime = now().toISOString();
    const durationSeconds = activeSession.elapsedSeconds;
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

        if (completeTask) {
          await useTaskStore.getState().updateTaskStatus(task.id, "completed");
        }
      }
    }

    set({ activeSession: null });
  },

  cancelSession: async () => {
    const { activeSession } = get();
    if (!activeSession) return;
    // Cancellation means the session never happened: remove the crash-safety
    // row so no orphaned record is left behind.
    await sessionRepo.deleteSession(activeSession.sessionId);
    set({ activeSession: null });
  },
}));
