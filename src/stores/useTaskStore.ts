import { create } from "zustand";
import { Task, TaskStatus, Importance, CognitiveDemand } from "../domain/models/types";
import { TaskRepository } from "../repositories/taskRepository";
import { PlanningStateRepository } from "../repositories/planningStateRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { ReviewRepository } from "../repositories/reviewRepository";
import { compressDayPlan } from "../domain/compression/compression";
import { todayLocal, nowIsoTimestamp, addDays } from "../domain/time/date";

interface TaskState {
  tasks: Task[];
  // Full task list backing the Planner board (all statuses, not day-filtered).
  boardTasks: Task[];
  activeTaskId: string | null;
  primaryObjective: string | null; // null = not set for today (Now asks the user)
  availableMinutes: number;
  isLoading: boolean;

  loadTodayTasks: (date: string) => Promise<void>;
  loadPlanningState: (date: string) => Promise<void>;
  loadBoard: () => Promise<void>;
  moveTaskStatus: (id: string, status: TaskStatus, source?: string) => Promise<void>;
  createTask: (params: {
    title: string;
    description?: string;
    importance?: Importance;
    cognitive_demand?: CognitiveDemand;
    estimated_minutes?: number;
    scheduled_date?: string | null;
    project_id?: string | null;
    source?: "quick_capture" | "rabbit_hole" | "manual";
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
  setPrimaryObjective: (text: string | null, date: string) => Promise<void>;
  setAvailableMinutes: (mins: number, date: string) => Promise<void>;
  compressPlan: (date: string) => Promise<{ freedMinutes: number; deferredCount: number }>;
}

const taskRepo = new TaskRepository();
const planningRepo = new PlanningStateRepository();
const reviewRepo = new ReviewRepository();

// Settle any live deep-work session for a task before its status leaves
// active work. Lazy import: useSessionStore itself imports this store.
async function settleActiveSessionFor(taskId: string): Promise<void> {
  const { settleActiveSessionForTask } = await import("./useSessionStore");
  await settleActiveSessionForTask(taskId);
}
const eventLog = new EventLogRepository();

// Instrumentation is fire-and-forget: it must never break the user action.
function logEvent(
  eventType: string,
  entityId: string | null,
  payload?: Record<string, unknown>,
  entityType: "task" | "planning" = "task"
) {
  eventLog.record(eventType, entityType, entityId, payload).catch((e) =>
    console.error("event log failed:", e)
  );
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  boardTasks: [],
  activeTaskId: null,
  primaryObjective: null, // loaded from planning_state for today
  availableMinutes: 420, // 7-hour fallback until today's planning state loads
  isLoading: false,

  // Loads the day's persisted planning state. If today has none but
  // yesterday's review recorded a tomorrow objective, that objective becomes
  // today's primary objective (the review → morning handoff, logged).
  loadPlanningState: async (date: string) => {
    try {
      let row = await planningRepo.getForDate(date);
      if (!row) {
        const yesterday = await reviewRepo.getDailyReview(addDays(date, -1));
        const carried = yesterday?.tomorrow_objective?.trim();
        if (carried) {
          row = await planningRepo.saveForDate(date, { primary_objective: carried });
          logEvent(
            "planning.objective_carried_over",
            null,
            { date, source: "daily_review" },
            "planning"
          );
        }
      }
      set({
        primaryObjective: row?.primary_objective ?? null,
        availableMinutes: row?.available_minutes ?? 420,
      });
    } catch (e) {
      console.error("Failed to load planning state:", e);
    }
  },

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
  moveTaskStatus: async (id: string, status: TaskStatus, source = "planner") => {
    const task =
      get().boardTasks.find((t) => t.id === id) || get().tasks.find((t) => t.id === id);

    // Leaving active work settles any live deep-work session first — a
    // completed/deferred task must never keep a session running.
    if (status === "completed" || status === "deferred" || status === "inbox") {
      await settleActiveSessionFor(id);
    }

    // Moving an unscheduled task into Planned schedules it for today:
    // otherwise it would not appear on the Today screen at all.
    if (status === "planned" && task && !task.scheduled_date) {
      await taskRepo.updateTask(id, { status, completed_at: null, scheduled_date: todayLocal() });
    } else {
      const completedAt = status === "completed" ? nowIsoTimestamp() : null;
      await taskRepo.updateTask(id, { status, completed_at: completedAt });
    }

    logEvent("task.status_changed", id, { from: task?.status ?? null, to: status, source });

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

    if (params.source === "quick_capture") {
      logEvent("task.quick_capture_created", newTask.id, { title: newTask.title });
    } else {
      logEvent("task.created", newTask.id, {
        title: newTask.title,
        importance: newTask.importance,
        status: newTask.status,
        source: params.source ?? "manual",
      });
    }

    return newTask;
  },

  updateTaskStatus: async (id: string, status: TaskStatus) => {
    const previous = get().tasks.find((t) => t.id === id);
    // Leaving active work settles any live deep-work session first.
    if (status === "completed" || status === "deferred" || status === "inbox") {
      await settleActiveSessionFor(id);
    }
    const completedAt = status === "completed" ? nowIsoTimestamp() : null;
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

  setPrimaryObjective: async (text: string | null, date: string) => {
    set({ primaryObjective: text });
    await planningRepo.saveForDate(date, { primary_objective: text });
    logEvent("planning.objective_set", null, { date, objective: text }, "planning");
  },

  setAvailableMinutes: async (mins: number, date: string) => {
    set({ availableMinutes: mins });
    await planningRepo.saveForDate(date, { available_minutes: mins });
    logEvent("planning.available_minutes_changed", null, { date, minutes: mins }, "planning");
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
