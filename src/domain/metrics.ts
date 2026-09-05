import { Task } from "./models/types";

// Explicit execution metrics. Each answers one question; never mix them.
// - "estimated"  = what the plan predicts (planning surface)
// - "actual"     = what deep work recorded (execution surface)
// - planned      = status is 'planned' or 'in_progress' (still ahead of the user today)
// - completed    = status is 'completed'

/** "How much work does today's plan still hold?" — Σ estimates of planned + in-progress tasks. */
export function plannedLoadMinutes(tasks: Task[]): number {
  return tasks
    .filter((t) => t.status === "planned" || t.status === "in_progress")
    .reduce((acc, t) => acc + t.estimated_minutes, 0);
}

/** "How much of today's plan is left?" — Σ (estimate − actual) of planned + in-progress tasks. */
export function remainingLoadMinutes(tasks: Task[]): number {
  return tasks
    .filter((t) => t.status === "planned" || t.status === "in_progress")
    .reduce((acc, t) => acc + remainingEstimateMinutes(t), 0);
}

/** "How much work did I record finishing today?" — Σ (actual ‖ estimate) of completed tasks. */
export function loggedWorkMinutes(tasks: Task[]): number {
  return tasks
    .filter((t) => t.status === "completed")
    .reduce((acc, t) => acc + (t.actual_minutes || t.estimated_minutes), 0);
}

/** "How much of THIS task is left?" — never negative; actual can exceed the estimate. */
export function remainingEstimateMinutes(task: Task): number {
  return Math.max(0, task.estimated_minutes - task.actual_minutes);
}

/** Human shorthand for a minute count: 45 → "45m", 150 → "2h 30m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
