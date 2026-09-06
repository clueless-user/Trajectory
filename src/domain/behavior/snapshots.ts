import { Task } from "../models/types";

/**
 * Plan-of-record snapshots (docs/SEMANTICS.md §9.2): a past day's planned
 * workload cannot be reconstructed from current task state, so the day's
 * plan is recorded as a planning.day_snapshot event whenever it materially
 * changes. Pure construction + dedupe signature; the writer lives in
 * useTaskStore (it owns today's tasks and planning state).
 */
export type SnapshotReason = "day_opened" | "compression_applied" | "material_replan";

export interface SnapshotTask {
  task_id: string;
  title: string;
  status: string;
  importance: string;
  cognitive_demand: string;
  estimated_minutes: number | null;
}

export interface DaySnapshotPayload {
  date: string;
  available_minutes: number;
  primary_objective: string | null;
  total_planned_minutes: number;
  planned_tasks: SnapshotTask[];
  snapshot_reason: SnapshotReason;
}

/** Tasks that constitute the day's plan of record (same set as Today shows). */
function planOfRecord(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.status === "planned" || t.status === "in_progress")
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildDaySnapshotPayload(
  date: string,
  availableMinutes: number,
  primaryObjective: string | null,
  tasks: Task[],
  reason: SnapshotReason
): DaySnapshotPayload {
  const planned = planOfRecord(tasks);
  return {
    date,
    available_minutes: availableMinutes,
    primary_objective: primaryObjective,
    total_planned_minutes: planned.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0),
    planned_tasks: planned.map((t) => ({
      task_id: t.id,
      title: t.title,
      status: t.status,
      importance: t.importance,
      cognitive_demand: t.cognitive_demand,
      estimated_minutes: t.estimated_minutes ?? null,
    })),
    snapshot_reason: reason,
  };
}

/**
 * Dedupe signature: the meaningful snapshot content WITHOUT the reason
 * (a compression that defers nothing, or a re-open with an identical plan,
 * must not produce a duplicate snapshot). Stable ordering via sorted tasks.
 */
export function snapshotSignature(payload: DaySnapshotPayload): string {
  const core = {
    date: payload.date,
    available_minutes: payload.available_minutes,
    primary_objective: payload.primary_objective,
    total_planned_minutes: payload.total_planned_minutes,
    planned_tasks: [...payload.planned_tasks].sort((a, b) => a.task_id.localeCompare(b.task_id)),
  };
  return JSON.stringify(core);
}
