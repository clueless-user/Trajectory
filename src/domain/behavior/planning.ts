import { Task } from "../models/types";
import { PlanningFacts } from "./types";

export interface DayPlanSnapshot {
  date: string;
  available_minutes: number | null;
  total_planned_minutes: number | null;
}

/**
 * Planning facts for a week. plannedMinutes is null when no day in the week
 * has a trustworthy snapshot — planned-vs-actual is then not claimed at all
 * (docs/SEMANTICS.md §9.2 confidence rule).
 */
export function planningFacts(
  snapshots: DayPlanSnapshot[],
  completedTasks: Task[],
  loggedWorkMinutes: number,
  deferredEstimatedMinutes: number,
  compressionCount: number
): PlanningFacts {
  const daysWithPlanData = snapshots.filter((s) => s.total_planned_minutes !== null).length;
  const plannedMinutes =
    daysWithPlanData > 0
      ? snapshots.reduce((acc, s) => acc + (s.total_planned_minutes ?? 0), 0)
      : null;

  const completedEstimatedMinutes = completedTasks.reduce(
    (acc, t) => acc + (t.estimated_minutes || 0),
    0
  );

  const overloadDays = snapshots.filter(
    (s) =>
      s.total_planned_minutes !== null &&
      s.available_minutes !== null &&
      s.total_planned_minutes > s.available_minutes
  ).length;

  return {
    plannedMinutes,
    completedEstimatedMinutes,
    loggedWorkMinutes,
    remainingEstimatedMinutes:
      plannedMinutes === null
        ? null
        : Math.max(0, plannedMinutes - completedEstimatedMinutes),
    deferredEstimatedMinutes,
    overloadDays,
    daysWithPlanData,
    compressionCount,
  };
}
