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
});
