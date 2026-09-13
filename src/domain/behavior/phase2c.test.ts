import { describe, it, expect } from "vitest";
import { executionBalance, OUTPUT_RATIO_MIN_DAY_EVENTS, OUTPUT_RATIO_MIN_WEEK_EVENTS } from "./executionBalance";
import { detectUnlinkedGoals, ORPHAN_GRACE_DAYS, ORPHAN_WINDOW_DAYS, ORPHAN_LONG_TERM_DAYS } from "./orphanedGoals";
import { EventLogEntry } from "../../repositories/eventLogRepository";
import { Goal, Project, Task } from "../models/types";

// ---- fixtures ---------------------------------------------------------------
const T = (id: string, type: string, payload: Record<string, unknown>, createdAt: string): EventLogEntry => ({
  id,
  event_type: type,
  entity_type: "task",
  entity_id: id,
  payload: JSON.stringify(payload),
  created_at: createdAt,
});

// A Monday.
const WEEK = "2026-08-31";
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const day = (d: number, hh = 12) =>
  `${addDays(WEEK, d)}T${String(hh).padStart(2, "0")}:00:00Z`;

function goal(overrides: Partial<Goal>): Goal {
  return {
    id: "goal-1",
    area_id: "area-1",
    title: "Run Marathon",
    description: null,
    target_date: null,
    status: "active",
    parked_until: null,
    order_index: 0,
    created_at: "2026-07-01T00:00:00Z", // well past grace
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    project_id: "proj-1",
    title: "Task",
    description: null,
    importance: "important",
    cognitive_demand: "medium",
    status: "planned",
    estimated_minutes: 30,
    actual_minutes: 0,
    scheduled_date: "2026-09-02",
    due_date: null,
    completed_at: null,
    order_index: 0,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const baseInputs = {
  goals: [goal({})],
  areas: [{ id: "area-1", name: "Health" }],
  projects: [{ id: "proj-1", goal_id: "goal-1", area_id: "area-1", title: "Couch to 5k", description: null, status: "active", order_index: 0, created_at: "", updated_at: "" } as Project],
  tasks: [] as Task[],
  recentEvents: [] as EventLogEntry[],
  sessions: [] as { id: string; taskId: string | null }[],
  today: "2026-09-06",
};

describe("executionBalance", () => {
  it("zero active events → week ratio null + suppressed reason", () => {
    const b = executionBalance([], WEEK);
    expect(b.weekRatio).toBeNull();
    expect(b.readout).toBeNull();
    expect(b.suppressedReason).toBe("Not enough active events this week to compute execution balance.");
  });

  it("below week threshold → suppressed even with some events", () => {
    const events = [T("1", "task.completed", {}, day(0)), T("2", "task.created", {}, day(1))];
    const b = executionBalance(events, WEEK);
    expect(b.weekExecution).toBe(1);
    expect(b.weekPlanning).toBe(1);
    expect(b.weekRatio).toBeNull();
    expect(b.suppressedReason).toContain("Not enough");
  });

  it("at/above week threshold → readout sentence with exact literal pattern", () => {
    const events = [
      ...Array.from({ length: 7 }, (_, i) => T(`e${i}`, "task.completed", {}, day(0, 10 + i))),
      ...Array.from({ length: 4 }, (_, i) => T(`p${i}`, "task.created", {}, day(1, 10 + i))),
    ];
    const b = executionBalance(events, WEEK);
    expect(b.weekExecution).toBe(7);
    expect(b.weekPlanning).toBe(4);
    expect(b.weekRatio).toBeCloseTo(7 / 11, 5);
    expect(b.readout).toBe("Execution balance — 7 of 11 active events this week were shipped work.");
    expect(b.suppressedReason).toBeNull();
  });

  it("per-day ratio is null below the day minimum and set above it", () => {
    const events = [
      ...Array.from({ length: OUTPUT_RATIO_MIN_DAY_EVENTS }, (_, i) => T(`e${i}`, "task.completed", {}, day(2, 9 + i))),
      T("p0", "task.created", {}, day(3)),
    ];
    const b = executionBalance(events, WEEK);
    const strong = b.perDay.find((d) => d.date === addDays(WEEK, 2));
    const sparse = b.perDay.find((d) => d.date === addDays(WEEK, 3));
    expect(strong?.ratio).not.toBeNull();
    expect(sparse?.ratio).toBeNull(); // 1 active event < day minimum
    void OUTPUT_RATIO_MIN_WEEK_EVENTS;
  });

  it("neutral events never enter the denominator", () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => T(`e${i}`, "task.completed", {}, day(0, 9 + i))),
      ...Array.from({ length: 6 }, (_, i) => T(`n${i}`, "session.started", {}, day(0, 15 + i))),
    ];
    const b = executionBalance(events, WEEK);
    expect(b.weekExecution).toBe(5);
    expect(b.weekPlanning).toBe(0);
    // Day ratio: 5/5 execution, above the day minimum.
    expect(b.perDay[0].ratio).toBe(1);
    // Week ratio still suppressed: 5 active events < the week minimum —
    // suppression is by event count, never by ratio quality.
    expect(b.weekRatio).toBeNull();
  });
});

describe("detectUnlinkedGoals", () => {
  it("goal with a task completed 3 days ago → NOT orphaned", () => {
    const completed = task({
      status: "completed",
      completed_at: "2026-09-03T15:00:00Z",
      scheduled_date: null,
    });
    const out = detectUnlinkedGoals({ ...baseInputs, tasks: [completed], today: "2026-09-06" });
    expect(out).toHaveLength(0);
  });

  it("goal with last execution 10 days ago and nothing planned → ORPHANED", () => {
    const done = task({
      status: "completed",
      completed_at: "2026-08-27T15:00:00Z", // 10 days before 2026-09-06
      scheduled_date: null,
    });
    const out = detectUnlinkedGoals({ ...baseInputs, tasks: [done], today: "2026-09-06" });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Run Marathon");
    expect(out[0].daysSinceLastLinkedWork).toBe(10);
    expect(out[0].areaTitle).toBe("Health");
    expect(out[0].projectCount).toBe(1);
  });

  it("paused goal excluded (parking is a valid outcome)", () => {
    const done = task({ status: "completed", completed_at: "2026-08-20T15:00:00Z", scheduled_date: null });
    const out = detectUnlinkedGoals({
      ...baseInputs,
      tasks: [done],
      goals: [goal({ status: "paused", parked_until: "2026-09-01" })],
      today: "2026-09-06",
    });
    expect(out).toHaveLength(0);
  });

  it("goal acknowledged 2 days ago excluded", () => {
    const done = task({ status: "completed", completed_at: "2026-08-20T15:00:00Z", scheduled_date: null });
    const out = detectUnlinkedGoals({
      ...baseInputs,
      tasks: [done],
      recentEvents: [T("a1", "goal.acknowledged", { goal_id: "goal-1" }, "2026-09-04T10:00:00Z")],
      today: "2026-09-06",
    });
    expect(out).toHaveLength(0);
  });

  it(`goal created within the ${ORPHAN_GRACE_DAYS}-day grace excluded`, () => {
    const young = goal({ created_at: "2026-09-05T00:00:00Z" }); // 1 day old
    const out = detectUnlinkedGoals({ ...baseInputs, goals: [young], today: "2026-09-06" });
    expect(out).toHaveLength(0);
  });

  it("goal with a task planned this week excluded", () => {
    const planned = task({ status: "planned", scheduled_date: "2026-09-04" }); // this week (Mon 08-31..Sun 09-06)
    const out = detectUnlinkedGoals({ ...baseInputs, tasks: [planned], today: "2026-09-06" });
    expect(out).toHaveLength(0);
  });

  it("goal with a live in_progress task excluded", () => {
    const live = task({ status: "in_progress", scheduled_date: null });
    const out = detectUnlinkedGoals({ ...baseInputs, tasks: [live], today: "2026-09-06" });
    expect(out).toHaveLength(0);
  });

  it("window execution (task.completed event in the last 7 days) excludes", () => {
    const open = task({ status: "planned", scheduled_date: null });
    const out = detectUnlinkedGoals({
      ...baseInputs,
      tasks: [open],
      recentEvents: [T("c1", "task.completed", {}, "2026-09-05T10:00:00Z")],
      today: "2026-09-06",
    });
    // The completed event's entity_id doesn't match the open task — different
    // task. The goal's OWN linked task has no window execution → still orphaned.
    expect(out).toHaveLength(1);
  });

  it("session.finished on a linked task inside the window excludes", () => {
    const open = task({ status: "planned", scheduled_date: null });
    const out = detectUnlinkedGoals({
      ...baseInputs,
      tasks: [open],
      recentEvents: [T("s-fin", "session.finished", {}, "2026-09-05T10:00:00Z")],
      sessions: [{ id: "s-fin", taskId: "task-1" }],
      today: "2026-09-06",
    });
    expect(out).toHaveLength(0);
  });

  it("long-term unlinked goal reports the parked-candidate threshold", () => {
    const done = task({ status: "completed", completed_at: "2026-08-10T15:00:00Z", scheduled_date: null });
    const out = detectUnlinkedGoals({ ...baseInputs, tasks: [done], today: "2026-09-06" });
    expect(out[0].daysSinceLastLinkedWork).toBeGreaterThanOrEqual(ORPHAN_LONG_TERM_DAYS);
  });

  it(`window constant is ${ORPHAN_WINDOW_DAYS} days (spec)`, () => {
    expect(ORPHAN_WINDOW_DAYS).toBe(7);
    expect(ORPHAN_GRACE_DAYS).toBe(7);
    expect(ORPHAN_LONG_TERM_DAYS).toBe(14);
  });
});
