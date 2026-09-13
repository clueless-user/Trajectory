import { Goal, Project, Task } from "../models/types";
import { EventLogEntry } from "../../repositories/eventLogRepository";
import { addDays, todayLocal } from "../time/date";
import { localDateOf } from "./stats";

/**
 * Unlinked-goal detection (Phase 2C, v3 Orphaned Goals — pull-based). A goal
 * is unlinked when ALL hold (docs/SEMANTICS.md §10.3):
 *   1. status is 'active' (paused goals are parked — a valid outcome, never flagged)
 *   2. created >= ORPHAN_GRACE_DAYS ago (a fresh goal is never flagged — a
 *      deliberate deviation from v3, recorded in the decision log)
 *   3. no linked task (goal → projects → tasks) currently 'planned' with a
 *      scheduled_date inside today's week, or 'in_progress'
 *   4. no execution event on any linked task in the last ORPHAN_WINDOW_DAYS
 *   5. no goal.acknowledged event in the last ORPHAN_WINDOW_DAYS
 *   6. not parked (rule 1 covers it; listed for symmetry with the spec)
 *
 * Today-anchored: this is a CURRENT blind-spot view, independent of whichever
 * week the Weekly Review is displaying. Detection is read-time only — nothing
 * is written or backfilled. Language rule: these goals are "unlinked" /
 * "parked candidates" — never "failed" or "neglected".
 */

export const ORPHAN_GRACE_DAYS = 7;
export const ORPHAN_WINDOW_DAYS = 7;
export const ORPHAN_LONG_TERM_DAYS = 14;

export interface OrphanedGoal {
  goalId: string;
  title: string;
  areaTitle: string | null;
  /** Local days since the newest linked execution; null = never any linked work. */
  daysSinceLastLinkedWork: number | null;
  projectCount: number;
}

export interface SessionLink {
  id: string; // session id
  taskId: string | null;
}

export interface OrphanInputs {
  goals: Goal[];
  areas: { id: string; name: string }[];
  projects: Project[];
  tasks: Task[];
  /** Events from the last ORPHAN_WINDOW_DAYS (today-anchored), any type. */
  recentEvents: EventLogEntry[];
  /** Session id → task id resolution so session.finished counts as execution. */
  sessions: SessionLink[];
  /** Clock seam for tests; defaults to the real local today. */
  today?: string;
}

export function detectUnlinkedGoals(inputs: OrphanInputs): OrphanedGoal[] {
  const { goals, areas, projects, tasks, recentEvents, sessions, today = todayLocal() } = inputs;

  const windowStartDay = addDays(today, -ORPHAN_WINDOW_DAYS);
  const graceCutoffDay = addDays(today, -ORPHAN_GRACE_DAYS);

  // Window events → which linked tasks saw execution.
  const sessionIdToTask = new Map(sessions.map((s) => [s.id, s.taskId]));
  const executedTaskIds = new Set<string>();
  const acknowledgedGoalIds = new Set<string>();
  for (const e of recentEvents) {
    if (e.event_type === "task.completed" && e.entity_id) {
      executedTaskIds.add(e.entity_id);
    } else if (e.event_type === "session.finished" && e.entity_id) {
      const taskId = sessionIdToTask.get(e.entity_id);
      if (taskId) executedTaskIds.add(taskId);
    } else if (e.event_type === "goal.acknowledged") {
      const gid = safeParse(e.payload).goal_id;
      if (typeof gid === "string") acknowledgedGoalIds.add(gid);
    }
  }

  const areaName = (id: string | null | undefined) =>
    areas.find((a) => a.id === id)?.name ?? null;

  const result: OrphanedGoal[] = [];

  for (const goal of goals) {
    // Rules 1 + 6: active only (paused = parked, a valid outcome).
    if (goal.status !== "active") continue;

    // Rule 2: grace period — a goal created this week is never flagged.
    const createdDay = goal.created_at.slice(0, 10);
    if (createdDay > graceCutoffDay) continue;

    // Rule 5: acknowledged inside the window → excluded.
    if (acknowledgedGoalIds.has(goal.id)) continue;

    // Linked work surface: goal → projects (by explicit goal_id) → tasks.
    const goalProjects = projects.filter((p) => p.goal_id === goal.id);
    const projectIds = new Set(goalProjects.map((p) => p.id));
    const linkedTasks = tasks.filter((t) => t.project_id && projectIds.has(t.project_id));

    // Rule 3: planned this week (scheduled within today's Monday week) or live.
    const weekStartDay = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
    const weekEndDay = addDays(weekStartDay, 6);
    const hasActiveWork = linkedTasks.some((t) => {
      if (t.status === "in_progress") return true;
      if (t.status === "planned" && t.scheduled_date) {
        return t.scheduled_date >= weekStartDay && t.scheduled_date <= weekEndDay;
      }
      return false;
    });
    if (hasActiveWork) continue;

    // Rule 4: execution on any linked task inside the window?
    const executionDays = linkedTasks
      .flatMap((t) => {
        const days: string[] = [];
        if (t.status === "completed" && t.completed_at) days.push(localDateOf(t.completed_at));
        if (executedTaskIds.has(t.id)) days.push(today);
        return days;
      })
      .sort();
    const lastExecutionDay = executionDays[executionDays.length - 1] ?? null;
    if (lastExecutionDay && lastExecutionDay >= windowStartDay) continue;

    result.push({
      goalId: goal.id,
      title: goal.title,
      areaTitle: areaName(goal.area_id),
      daysSinceLastLinkedWork: lastExecutionDay
        ? Math.round(
            (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastExecutionDay}T00:00:00Z`)) / 86400000
          )
        : null,
      projectCount: goalProjects.length,
    });
  }

  return result;
}

function safeParse(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
