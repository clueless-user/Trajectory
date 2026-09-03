import { create } from "zustand";
import { Task, TaskStatus, Importance, CognitiveDemand } from "../domain/models/types";
import { TaskRepository } from "../repositories/taskRepository";
import { compressDayPlan } from "../domain/compression/compression";

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  primaryObjective: string;
  availableMinutes: number;
  isLoading: boolean;

  loadTodayTasks: (date: string) => Promise<void>;
  createTask: (params: {
    title: string;
    description?: string;
    importance?: Importance;
    cognitive_demand?: CognitiveDemand;
    estimated_minutes?: number;
    scheduled_date?: string | null;
    project_id?: string | null;
  }) => Promise<Task>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  setActiveTask: (id: string | null) => void;
  setPrimaryObjective: (text: string) => void;
  setAvailableMinutes: (mins: number) => void;
  compressPlan: (date: string) => Promise<{ freedMinutes: number; deferredCount: number }>;
}

const taskRepo = new TaskRepository();

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  primaryObjective: "Finish Core Engine Architecture & Verification",
  availableMinutes: 420, // 7 hours default
  isLoading: false,

  loadTodayTasks: async (date: string) => {
    set({ isLoading: true });
    try {
      const tasks = await taskRepo.getTodayTasks(date);
      set({ tasks, isLoading: false });

      // If no active task is set, select the first in_progress or critical/important task
      const active = tasks.find((t) => t.status === "in_progress") || tasks.find((t) => t.status === "planned");
      if (active && !get().activeTaskId) {
        set({ activeTaskId: active.id });
      }
    } catch (e) {
      console.error("Failed to load today tasks:", e);
      set({ isLoading: false });
    }
  },

  createTask: async (params) => {
    const newTask = await taskRepo.createTask({
      ...params,
      status: params.scheduled_date ? "planned" : "inbox",
    });

    set((state) => ({
      tasks: [newTask, ...state.tasks],
      activeTaskId: state.activeTaskId || (newTask.status === "planned" ? newTask.id : null),
    }));

    return newTask;
  },

  updateTaskStatus: async (id: string, status: TaskStatus) => {
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    await taskRepo.updateTask(id, { status, completed_at: completedAt });

    set((state) => {
      const updated = state.tasks.map((t) =>
        t.id === id ? { ...t, status, completed_at: completedAt } : t
      );
      // If we just completed the active task, select the next planned task
      let nextActiveId = state.activeTaskId;
      if (state.activeTaskId === id && status === "completed") {
        const next = updated.find((t) => t.status === "planned" || t.status === "in_progress");
        nextActiveId = next ? next.id : null;
      }
      return { tasks: updated, activeTaskId: nextActiveId };
    });
  },

  setActiveTask: (id: string | null) => {
    set({ activeTaskId: id });
  },

  setPrimaryObjective: (text: string) => {
    set({ primaryObjective: text });
  },

  setAvailableMinutes: (mins: number) => {
    set({ availableMinutes: mins });
  },

  compressPlan: async (date: string) => {
    const { tasks, availableMinutes } = get();
    const result = compressDayPlan(tasks, availableMinutes);

    // Persist deferred status for overflow tasks
    for (const task of result.deferredTasks) {
      await taskRepo.updateTask(task.id, { status: "deferred" });
    }

    // Refresh state
    await get().loadTodayTasks(date);

    return {
      freedMinutes: result.freedMinutes,
      deferredCount: result.deferredTasks.length,
    };
  },
}));
