import { describe, it, expect } from "vitest";
import { compressDayPlan } from "./compression";
import { Task } from "../models/types";

function mockTask(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    project_id: null,
    title: "Test Task",
    description: null,
    importance: "important",
    cognitive_demand: "medium",
    status: "planned",
    estimated_minutes: 60,
    actual_minutes: 0,
    scheduled_date: "2026-09-03",
    due_date: null,
    completed_at: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

describe("Day Compression / Survival Mode", () => {
  it("keeps all tasks when available time exceeds total planned time", () => {
    const tasks: Task[] = [
      mockTask({ title: "Task 1", estimated_minutes: 45, importance: "important" }),
      mockTask({ title: "Task 2", estimated_minutes: 30, importance: "optional" }),
    ];

    const result = compressDayPlan(tasks, 120);
    expect(result.keptTasks.length).toBe(2);
    expect(result.deferredTasks.length).toBe(0);
    expect(result.fitsWithinBudget).toBe(true);
    expect(result.freedMinutes).toBe(0);
  });

  it("preserves critical tasks and defers lower-priority tasks when overloaded", () => {
    const critical1 = mockTask({ title: "Deploy Engine", estimated_minutes: 90, importance: "critical" });
    const important1 = mockTask({ title: "Code Review", estimated_minutes: 45, importance: "important" });
    const optional1 = mockTask({ title: "Sort Bookmarks", estimated_minutes: 60, importance: "optional" });
    const optional2 = mockTask({ title: "Read Twitter", estimated_minutes: 30, importance: "optional" });

    // Available budget: 120 minutes. Total planned: 225 minutes.
    const tasks = [critical1, important1, optional1, optional2];
    const result = compressDayPlan(tasks, 120);

    // Critical (90m) must be kept. Remaining budget is 30m.
    // Important1 (45m) is evaluated next and kept because remainingBudget > 0.
    // Optionals (60m, 30m) exceed budget and must be deferred.
    expect(result.keptTasks.map((t) => t.title)).toContain("Deploy Engine");
    expect(result.keptTasks.map((t) => t.title)).toContain("Code Review");
    expect(result.deferredTasks.map((t) => t.title)).toContain("Sort Bookmarks");
    expect(result.deferredTasks.map((t) => t.title)).toContain("Read Twitter");
    expect(result.freedMinutes).toBe(90);
  });

  it("never mutates or defers completed or in-progress tasks", () => {
    const completed = mockTask({
      title: "Morning Routine",
      status: "completed",
      estimated_minutes: 30,
      actual_minutes: 35,
    });
    const inProgress = mockTask({
      title: "Current Benchmark",
      status: "in_progress",
      estimated_minutes: 60,
    });
    const plannedOverflow = mockTask({
      title: "Write documentation",
      status: "planned",
      estimated_minutes: 120,
      importance: "optional",
    });

    const result = compressDayPlan([completed, inProgress, plannedOverflow], 60);

    expect(result.keptTasks.map((t) => t.title)).toContain("Morning Routine");
    expect(result.keptTasks.map((t) => t.title)).toContain("Current Benchmark");
    expect(result.deferredTasks.map((t) => t.title)).toContain("Write documentation");
  });

  it("returns empty kept and deferred lists for an empty day", () => {
    const result = compressDayPlan([], 480);
    expect(result.keptTasks).toEqual([]);
    expect(result.deferredTasks).toEqual([]);
    expect(result.totalPlannedMinutes).toBe(0);
    expect(result.fitsWithinBudget).toBe(true);
    expect(result.freedMinutes).toBe(0);
  });

  it("keeps only critical tasks when there is zero available time", () => {
    const critical = mockTask({ title: "Hotfix prod", importance: "critical", estimated_minutes: 90 });
    const important = mockTask({ title: "Write docs", importance: "important", estimated_minutes: 45 });
    const optional = mockTask({ title: "Sort bookmarks", importance: "optional", estimated_minutes: 20 });

    const result = compressDayPlan([critical, important, optional], 0);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Hotfix prod"]);
    expect(result.deferredTasks.map((t) => t.title).sort()).toEqual(["Sort bookmarks", "Write docs"]);
    expect(result.fitsWithinBudget).toBe(false);
  });

  it("keeps every critical task even when they alone exceed the budget", () => {
    const c1 = mockTask({ title: "Critical A", importance: "critical", estimated_minutes: 300 });
    const c2 = mockTask({ title: "Critical B", importance: "critical", estimated_minutes: 300 });

    const result = compressDayPlan([c1, c2], 100);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Critical A", "Critical B"]);
    expect(result.deferredTasks).toEqual([]);
    expect(result.fitsWithinBudget).toBe(false);
    expect(result.freedMinutes).toBe(0);
  });

  it("accounts committed actual minutes of completed and in-progress work against the budget", () => {
    const done = mockTask({
      title: "Already done",
      status: "completed",
      estimated_minutes: 30,
      actual_minutes: 300,
    });
    const running = mockTask({
      title: "In flight",
      status: "in_progress",
      estimated_minutes: 60,
      actual_minutes: 0,
    });
    const planned = mockTask({ title: "Planned work", importance: "important", estimated_minutes: 120 });

    // Available 480: committed = 300 (actual) + 60 (estimate, no actual yet) → remaining 120.
    const result = compressDayPlan([done, running, planned], 480);

    expect(result.keptTasks.map((t) => t.title)).toContain("Planned work");
    expect(result.fitsWithinBudget).toBe(true);
  });

  it("keeps an optional task only when it fits the remaining budget exactly or better", () => {
    const fits = mockTask({ title: "Fits", importance: "optional", estimated_minutes: 30 });
    const spills = mockTask({ title: "Spills", importance: "optional", estimated_minutes: 31 });

    const result = compressDayPlan([fits, spills], 30);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Fits"]);
    expect(result.deferredTasks.map((t) => t.title)).toEqual(["Spills"]);
    expect(result.freedMinutes).toBe(31);
  });

  it("keeps a zero-estimate optional task whenever any budget remains", () => {
    const zero = mockTask({ title: "Free win", importance: "optional", estimated_minutes: 0 });
    const result = compressDayPlan([zero], 1);
    expect(result.keptTasks.map((t) => t.title)).toEqual(["Free win"]);
  });

  it("keeps the first important task when any budget remains even if it overruns, deferring the rest", () => {
    const oversized = mockTask({ title: "Oversized important", importance: "important", estimated_minutes: 90, order_index: 0 });
    const next = mockTask({ title: "Next important", importance: "important", estimated_minutes: 30, order_index: 1 });

    // Remaining budget is 10: the oversized task is kept (remainingBudget > 0,
    // driving the budget negative); nothing positive remains for the next one.
    const result = compressDayPlan([oversized, next], 10);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Oversized important"]);
    expect(result.deferredTasks.map((t) => t.title)).toEqual(["Next important"]);
    expect(result.fitsWithinBudget).toBe(false);
  });

  it("breaks important-task ties by order_index then smaller estimate", () => {
    const later = mockTask({ title: "Later", importance: "important", estimated_minutes: 60, order_index: 1 });
    const first = mockTask({ title: "First", importance: "important", estimated_minutes: 60, order_index: 0 });

    // Budget fits exactly one 60-minute task; order_index 0 wins.
    const result = compressDayPlan([later, first], 60);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["First"]);
    expect(result.deferredTasks.map((t) => t.title)).toEqual(["Later"]);
  });

  it("prefers the smaller estimate among equally-ranked important tasks", () => {
    const big = mockTask({ title: "Big", importance: "important", estimated_minutes: 60, order_index: 0 });
    const small = mockTask({ title: "Small", importance: "important", estimated_minutes: 20, order_index: 0 });

    // Budget 45: Small (20) is evaluated first and kept; Big then hits the
    // overrun branch (budget 25 > 0) and is kept too, overflowing the day.
    const result = compressDayPlan([big, small], 45);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Small", "Big"]);
    expect(result.fitsWithinBudget).toBe(false);
  });

  it("defers inbox, cancelled and already-deferred tasks from both output lists", () => {
    const inbox = mockTask({ title: "Inbox item", status: "inbox" });
    const cancelled = mockTask({ title: "Cancelled item", status: "cancelled" });
    const deferred = mockTask({ title: "Deferred item", status: "deferred" });
    const planned = mockTask({ title: "Planned item", estimated_minutes: 30 });

    const result = compressDayPlan([inbox, cancelled, deferred, planned], 480);

    const allNames = [...result.keptTasks, ...result.deferredTasks].map((t) => t.title);
    expect(allNames).toEqual(["Planned item"]);
  });

  it("is deterministic across repeated calls and never mutates its input", () => {
    const tasks: Task[] = [
      mockTask({ title: "Critical", importance: "critical", estimated_minutes: 120 }),
      mockTask({ title: "Important A", importance: "important", estimated_minutes: 60, order_index: 0 }),
      mockTask({ title: "Important B", importance: "important", estimated_minutes: 45, order_index: 1 }),
      mockTask({ title: "Optional", importance: "optional", estimated_minutes: 30 }),
    ];
    const snapshot = JSON.stringify(tasks);

    const first = compressDayPlan(tasks, 150);
    const second = compressDayPlan(tasks, 150);

    expect(first.keptTasks.map((t) => t.title)).toEqual(second.keptTasks.map((t) => t.title));
    expect(first.deferredTasks.map((t) => t.title)).toEqual(second.deferredTasks.map((t) => t.title));
    expect(first.freedMinutes).toBe(second.freedMinutes);
    expect(JSON.stringify(tasks)).toBe(snapshot);
    tasks.forEach((t, i) => {
      expect(t.status).toBe(tasks[i].status);
    });
  });

  it("treats cognitive demand as irrelevant to the compression decision", () => {
    const deep = mockTask({ title: "Deep work item", importance: "important", cognitive_demand: "deep", estimated_minutes: 60 });
    const shallow = mockTask({ title: "Shallow item", importance: "optional", cognitive_demand: "shallow", estimated_minutes: 60 });

    const result = compressDayPlan([deep, shallow], 60);

    expect(result.keptTasks.map((t) => t.title)).toEqual(["Deep work item"]);
    expect(result.deferredTasks.map((t) => t.title)).toEqual(["Shallow item"]);
  });
});
