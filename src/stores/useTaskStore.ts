import { create } from "zustand";
import { Task, TaskStatus, Importance, CognitiveDemand } from "../domain/models/types";
import { TaskRepository } from "../repositories/taskRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { compressDayPlan } from "../domain/compression/compression";
import { todayLocal, nowIsoTimestamp } from "../domain/time/date";

interface TaskState {
  tasks: Task[];
  // Full task list backing the Planner board (all statuses, not day-filtered).
  boardTasks: Task[];
  activeTaskId: string | null;
  primaryObjective: string;
  availableMinutes: number;
  isLoading: boolean;

  loadTodayTasks: (date: string) => Promise<void>;
  loadBoard: () => Promise<void>;
  moveTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
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
  updateTaskDetails: (
    id: string,
    details: {
      title: string;
      description?: string;
      importance: Importance;
      cognitive_demand: CognitiveDemand;
      estimated_minutes: number;
      scheduled_date?: string | null;
    }
  ) => Promise<void>;
  setActiveTask: (id: string | null) => void;
  setPrimaryObjective: (text: string) => void;
  setAvailableMinutes: (mins: number) => void;
  compressPlan: (date: string) => Promise<{ freedMinutes: number; deferredCount: number }>;
}

const taskRepo = new TaskRepository();
const eventLog = new EventLogRepository();

// Instrumentation is fire-and-forget: it must never break the user action.
function logEvent(
  eventType: string,
  entityId: string | null,
  payload?: Record<string, unknown>
) {
  eventLog.record(eventType, "task", entityId, payload).catch((e) =>
    console.error("event log failed:", e)
  );
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  boardTasks: [],
  activeTaskId: null,
  primaryObjective: "Finish Core Engine Architecture & Verification",
  availableMinutes: 420, // 7 hours default
  isLoading: false,

  loadBoard: async () => {
    try {
      const boardTasks = await taskRepo.getAllTasks();
      set({ boardTasks });
    } catch (e) {
      console.error("Failed to load task board:", e);
    }
  },

  // Single mutation path for status moves (Planner drag & drop, recovery
  // actions). Kanban and Today always read the same Task.status — there is
  // no second task-state system.
  moveTaskStatus: async (id: string, status: TaskStatus) => {
    const task =
      get().boardTasks.find((t) => t.id === id) || get().tasks.find((t) => t.id === id);

    // Moving an unscheduled task into Planned schedules it for today:
    // otherwise it would not appear on the Today screen at all.
    if (status === "planned" && task && !task.scheduled_date) {
      await taskRepo.updateTask(id, { status, completed_at: null, scheduled_date: todayLocal() });
    } else {
      const completedAt = status === "completed" ? nowIsoTimestamp() : null;
      await taskRepo.updateTask(id, { status, completed_at: completedAt });
    }

    logEvent("task.status_changed", id, { from: task?.status ?? null, to: status, via: "planner" });

    // Reload both surfaces so Kanban and Today stay consistent.
    await Promise.all([get().loadBoard(), get().loadTodayTasks(todayLocal())]);
  },

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

    logEvent("task.created", newTask.id, {
      title: newTask.title,
      importance: newTask.importance,
      status: newTask.status,
    });

    return newTask;
  },

  updateTaskStatus: async (id: string, status: TaskStatus) => {
    const previous = get().tasks.find((t) => t.id === id);
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

    logEvent("task.status_changed", id, { from: previous?.status ?? null, to: status });
  },

  updateTaskDetails: async (id, details) => {
    await taskRepo.updateTask(id, {
      title: details.title,
      description: details.description ?? null,
      importance: details.importance,
      cognitive_demand: details.cognitive_demand,
      estimated_minutes: details.estimated_minutes,
      ...(details.scheduled_date !== undefined ? { scheduled_date: details.scheduled_date } : {}),
    });

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              title: details.title,
              description: details.description ?? null,
              importance: details.importance,
              cognitive_demand: details.cognitive_demand,
              estimated_minutes: details.estimated_minutes,
              ...(details.scheduled_date !== undefined
                ? { scheduled_date: details.scheduled_date }
                : {}),
            }
          : t
      ),
    }));

    logEvent("task.details_updated", id, { title: details.title });
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
      logEvent("task.status_changed", task.id, { from: "planned", to: "deferred", via: "compression" });
    }

    // Refresh state
    await get().loadTodayTasks(date);

    return {
      freedMinutes: result.freedMinutes,
      deferredCount: result.deferredTasks.length,
    };
  },
}));
