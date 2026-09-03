import { create } from "zustand";
import { Task } from "../domain/models/types";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { useTaskStore } from "./useTaskStore";

export interface ActiveSession {
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
  startSession: (task: Task) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  tick: (deltaSeconds?: number) => void;
  recordInterruption: (note?: string) => void;
  updateNotes: (notes: string) => void;
  finishSession: (completeTask?: boolean) => Promise<void>;
  cancelSession: () => void;
}

const sessionRepo = new WorkSessionRepository();
const taskRepo = new TaskRepository();

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,

  startSession: (task: Task) => {
    // If task is not already in_progress, transition it
    if (task.status !== "in_progress") {
      useTaskStore.getState().updateTaskStatus(task.id, "in_progress");
    }

    set({
      activeSession: {
        taskId: task.id,
        taskTitle: task.title,
        startTime: new Date().toISOString(),
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

    const endTime = new Date().toISOString();
    const durationSeconds = activeSession.elapsedSeconds;
    const additionalMinutes = Math.round(durationSeconds / 60);

    // 1. Record session
    await sessionRepo.createSession({
      task_id: activeSession.taskId,
      start_time: activeSession.startTime,
      end_time: endTime,
      duration_seconds: durationSeconds,
      interruption_count: activeSession.interruptionCount,
      completed_state: "finished",
      notes: activeSession.notes || null,
    });

    // 2. Update task actual_minutes
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

  cancelSession: () => {
    set({ activeSession: null });
  },
}));
