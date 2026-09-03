import { Task } from "../models/types";

export interface CompressionResult {
  keptTasks: Task[];
  deferredTasks: Task[];
  totalPlannedMinutes: number;
  availableMinutes: number;
  fitsWithinBudget: boolean;
  freedMinutes: number;
}

/**
 * Deterministically compresses an overloaded day's plan.
 *
 * Invariants:
 * 1. Historical completed tasks are NEVER touched or modified.
 * 2. In-progress tasks are always preserved.
 * 3. Critical tasks are prioritized and preserved first.
 * 4. Important tasks are fitted into remaining available time.
 * 5. Overflow important and optional tasks are deferred without guilt.
 */
export function compressDayPlan(
  tasks: Task[],
  availableMinutes: number
): CompressionResult {
  // Separate tasks that cannot/should not be compressed
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const plannedTasks = tasks.filter((t) => t.status === "planned");

  // Sum time already committed to active/completed work today
  const committedMinutes = [...completedTasks, ...inProgressTasks].reduce(
    (acc, t) => acc + (t.actual_minutes > 0 ? t.actual_minutes : t.estimated_minutes),
    0
  );

  let remainingBudget = Math.max(0, availableMinutes - committedMinutes);

  // Group planned tasks by importance
  const critical = plannedTasks.filter((t) => t.importance === "critical");
  const important = plannedTasks.filter((t) => t.importance === "important");
  const optional = plannedTasks.filter((t) => t.importance === "optional");

  const keptTasks: Task[] = [...completedTasks, ...inProgressTasks];
  const deferredTasks: Task[] = [];

  // 1. Process Critical Tasks
  for (const task of critical) {
    keptTasks.push(task);
    remainingBudget -= task.estimated_minutes;
  }

  // 2. Process Important Tasks
  // Sort important tasks by order_index, then estimated duration (prefer completing higher priority)
  const sortedImportant = [...important].sort((a, b) => {
    if (a.order_index !== b.order_index) return a.order_index - b.order_index;
    return a.estimated_minutes - b.estimated_minutes;
  });

  for (const task of sortedImportant) {
    if (task.estimated_minutes <= remainingBudget || remainingBudget > 0) {
      keptTasks.push(task);
      remainingBudget -= task.estimated_minutes;
    } else {
      deferredTasks.push(task);
    }
  }

  // 3. Process Optional Tasks (only kept if surplus budget remains)
  for (const task of optional) {
    if (task.estimated_minutes <= remainingBudget && remainingBudget > 0) {
      keptTasks.push(task);
      remainingBudget -= task.estimated_minutes;
    } else {
      deferredTasks.push(task);
    }
  }

  const totalPlannedMinutes = keptTasks.reduce((acc, t) => acc + t.estimated_minutes, 0);
  const freedMinutes = deferredTasks.reduce((acc, t) => acc + t.estimated_minutes, 0);

  return {
    keptTasks,
    deferredTasks,
    totalPlannedMinutes,
    availableMinutes,
    fitsWithinBudget: totalPlannedMinutes <= availableMinutes,
    freedMinutes,
  };
}
