import { describe, it, expect } from "vitest";
import {
  plannedLoadMinutes,
  remainingLoadMinutes,
  loggedWorkMinutes,
  remainingEstimateMinutes,
  formatMinutes,
} from "./metrics";
import { Task } from "./models/types";

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    project_id: null,
    title: "Task",
    description: null,
    importance: "important",
    cognitive_demand: "medium",
    status: "planned",
    estimated_minutes: 60,
    actual_minutes: 0,
    scheduled_date: "2026-09-05",
    due_date: null,
    completed_at: null,
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

describe("execution metrics — explicit semantics", () => {
  it("plannedLoadMinutes counts only planned + in-progress estimates", () => {
    const tasks = [
      task({ estimated_minutes: 90 }),
      task({ status: "in_progress", estimated_minutes: 60 }),
      task({ status: "completed", estimated_minutes: 30 }),
      task({ status: "inbox", estimated_minutes: 45 }),
      task({ status: "deferred", estimated_minutes: 120 }),
    ];
    expect(plannedLoadMinutes(tasks)).toBe(150);
    expect(plannedLoadMinutes([])).toBe(0);
  });

  it("remainingLoadMinutes subtracts logged actuals and never goes negative per task", () => {
    const tasks = [
      task({ estimated_minutes: 60, actual_minutes: 25 }), // 35 remaining
      task({ status: "in_progress", estimated_minutes: 30, actual_minutes: 45 }), // overrun → 0
      task({ status: "completed", estimated_minutes: 60, actual_minutes: 10 }), // not planned
    ];
    expect(remainingLoadMinutes(tasks)).toBe(35);
  });

  it("loggedWorkMinutes uses actual when recorded, estimate otherwise", () => {
    const tasks = [
      task({ status: "completed", estimated_minutes: 30, actual_minutes: 55 }),
      task({ status: "completed", estimated_minutes: 45, actual_minutes: 0 }),
      task({ estimated_minutes: 90, actual_minutes: 20 }), // not completed
    ];
    expect(loggedWorkMinutes(tasks)).toBe(100);
  });

  it("remainingEstimateMinutes answers 'how much of THIS task is left'", () => {
    expect(remainingEstimateMinutes(task({ estimated_minutes: 60, actual_minutes: 0 }))).toBe(60);
    expect(remainingEstimateMinutes(task({ estimated_minutes: 60, actual_minutes: 25 }))).toBe(35);
    expect(remainingEstimateMinutes(task({ estimated_minutes: 30, actual_minutes: 90 }))).toBe(0);
  });

  it("formatMinutes gives human shorthand", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(150)).toBe("2h 30m");
    expect(formatMinutes(-10)).toBe("0m");
  });
});
