import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../../repositories/database";
import { estimateFacts, ESTIMATE_BIAS_MIN_TASKS } from "./estimates";
import { planningFacts } from "./planning";
import { sessionFacts } from "./sessions";
import { deferralFacts, repeatedlyDeferredTaskIds } from "./deferrals";
import { habitFacts } from "./habits";
import { rabbitHoleFacts } from "./rabbitHoles";
import { stateAssociations, STATE_ASSOCIATION_MIN_PAIRS } from "./stateAssociations";
import { detectPatterns, PATTERN_THRESHOLDS } from "./patterns";
import { EventLogRepository } from "../../repositories/eventLogRepository";
import { Task } from "../models/types";
import { Habit, HabitLog } from "../models/types";
import { localDayBounds } from "../time/date";
import { buildWeeklyBehaviorFacts } from "../../services/behaviorService";

// ---- fixtures -------------------------------------------------------------
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    project_id: null,
    title: "Task",
    description: null,
    importance: "important",
    cognitive_demand: "medium",
    status: "completed",
    estimated_minutes: 60,
    actual_minutes: 60,
    scheduled_date: "2026-08-31",
    due_date: null,
    completed_at: "2026-08-31T15:00:00Z",
    order_index: 0,
    created_at: "2026-08-31T08:00:00Z",
    updated_at: "2026-08-31T08:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const T = (id: string, type: string, payload: Record<string, unknown>, createdAt: string) => ({
  id,
  event_type: type,
  entity_type: "task",
  entity_id: id,
  payload: JSON.stringify(payload),
  created_at: createdAt,
});

describe("estimateFacts", () => {
  it("computes median error and ratio, over/under counts", () => {
    const tasks = [
      makeTask({ estimated_minutes: 60, actual_minutes: 90 }), // ratio 1.5
      makeTask({ estimated_minutes: 30, actual_minutes: 30 }), // ratio 1.0
      makeTask({ estimated_minutes: 60, actual_minutes: 30 }), // ratio 0.5
    ];
    const f = estimateFacts(tasks);
    expect(f.taskCount).toBe(3);
    expect(f.medianErrorMinutes).toBe(0);
    expect(f.medianRatio).toBe(1.0);
    expect(f.overEstimateCount).toBe(1);
    expect(f.underEstimateCount).toBe(1);
    expect(f.bias).toBe("insufficient-data"); // below threshold
  });

  it("labels bias only above the threshold and is outlier-robust (median)", () => {
    const tasks: Task[] = [];
    for (let i = 0; i < ESTIMATE_BIAS_MIN_TASKS + 2; i++) {
      tasks.push(makeTask({ estimated_minutes: 60, actual_minutes: 90 }));
    }
    // One extreme outlier must not move the median.
    tasks.push(makeTask({ estimated_minutes: 10, actual_minutes: 1000 }));
    const f = estimateFacts(tasks);
    expect(f.bias).toBe("over");
    expect(f.medianRatio).toBe(1.5);
  });

  it("excludes tasks with missing estimate or actual", () => {
    const tasks = [
      makeTask({ estimated_minutes: 0, actual_minutes: 30 }),
      makeTask({ estimated_minutes: 30, actual_minutes: 0 }),
    ];
    const f = estimateFacts(tasks);
    expect(f.taskCount).toBe(0);
    expect(f.medianRatio).toBeNull();
  });
});

describe("planningFacts", () => {
  it("returns null planned minutes when no snapshots exist", () => {
    const f = planningFacts([], [makeTask({})], 120, 30, 0);
    expect(f.plannedMinutes).toBeNull();
    expect(f.remainingEstimatedMinutes).toBeNull();
  });

  it("sums snapshots, counts overload days and compressions", () => {
    const f = planningFacts(
      [
        { date: "2026-08-31", available_minutes: 300, total_planned_minutes: 400 },
        { date: "2026-09-01", available_minutes: 300, total_planned_minutes: 120 },
        { date: "2026-09-02", available_minutes: null, total_planned_minutes: 100 },
      ],
      [makeTask({ estimated_minutes: 100 })],
      90,
      40,
      2
    );
    expect(f.plannedMinutes).toBe(620);
    expect(f.completedEstimatedMinutes).toBe(100);
    expect(f.remainingEstimatedMinutes).toBe(520);
    expect(f.overloadDays).toBe(1);
    expect(f.compressionCount).toBe(2);
    expect(f.daysWithPlanData).toBe(3);
  });
});

describe("sessionFacts", () => {
  const repo = new EventLogRepository();

  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("counts started/finished/interrupted and durations, excludes cancelled", () => {
    const sessions = [
      { id: "s1", task_id: null, start_time: "2026-08-31T10:00:00Z", end_time: "2026-08-31T11:00:00Z", duration_seconds: 3600, interruption_count: 2, completed_state: "finished" as const, notes: null, created_at: "" },
      { id: "s2", task_id: null, start_time: "2026-08-31T12:00:00Z", end_time: "2026-08-31T12:30:00Z", duration_seconds: 1800, interruption_count: 0, completed_state: "interrupted" as const, notes: null, created_at: "" },
    ];
    const f = sessionFacts(sessions, []);
    expect(f.sessionsStarted).toBe(2);
    expect(f.sessionsFinished).toBe(1);
    expect(f.sessionsInterrupted).toBe(1);
    expect(f.totalLoggedMinutes).toBe(90);
    expect(f.medianSessionMinutes).toBe(60);
    expect(f.interruptions).toBe(2);
  });

  it("detects abandoned sessions only when the log has started events", async () => {
    const { startIso } = localDayBounds("2026-08-31");
    const { endIso } = localDayBounds("2026-09-01");
    const events = await repo.getByDateRange(startIso, endIso);
    // Started but never resolved.
    const f1 = sessionFacts([], [T("a", "session.started", {}, "2026-08-31T10:00:00Z"), ...events]);
    expect(f1.sessionsAbandoned).toBe(1);
    // With no started events at all, abandonment is unavailable, not zero.
    const f2 = sessionFacts([], []);
    expect(f2.sessionsAbandoned).toBeNull();
  });
});

describe("deferralFacts", () => {
  const ev = (id: string, type: string) =>
    T(id, type, { estimated_minutes: 30 }, "2026-08-31T10:00:00Z");

  it("counts deferrals, repeats, and completions after deferral", () => {
    const events = [
      ev("a", "task.deferred"),
      ev("a", "task.deferred"),
      ev("b", "task.deferred"),
      ev("a", "task.completed"),
    ];
    const f = deferralFacts(events);
    expect(f.totalDeferrals).toBe(3);
    expect(f.uniqueDeferredTasks).toBe(2);
    expect(f.repeatedDeferralTasks).toBe(1);
    expect(f.completedAfterDeferral).toBe(1);
  });

  it("detects repeatedly deferred ids above threshold", () => {
    const events = [ev("a", "task.deferred"), ev("a", "task.deferred"), ev("a", "task.deferred"), ev("b", "task.deferred")];
    expect(repeatedlyDeferredTaskIds(events, PATTERN_THRESHOLDS.REPEATED_DEFERRAL_MIN)).toEqual(["a"]);
  });
});

describe("habitFacts", () => {
  const habit: Habit = {
    id: crypto.randomUUID(),
    area_id: null,
    title: "Walk",
    description: null,
    unit: "minutes",
    normal_target: 30,
    minimum_target: 10,
    order_index: 0,
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const log = (date: string, status: HabitLog["target_met_status"]): HabitLog => ({
    id: crypto.randomUUID(),
    habit_id: habit.id,
    date,
    value: 20,
    target_met_status: status,
    notes: null,
    logged_at: `${date}T20:00:00Z`,
  });
  const week = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];

  it("computes normal/minimum/missed days and recovery median", () => {
    const logs = [
      log("2026-08-31", "normal"),
      log("2026-09-01", "minimum"),
      // 09-02, 09-03 missed
      log("2026-09-04", "exceeded"),
    ];
    const [f] = habitFacts([habit], logs, week);
    expect(f.normalDays).toBe(2);
    expect(f.minimumDays).toBe(1);
    expect(f.missedDays).toBe(4); // 09-02, 09-03, 09-05, 09-06
    // Recovery gaps: 09-02 -> 09-04 = 2, 09-03 -> 09-04 = 1 → median 1.5
    expect(f.recoveryAfterMissMedianDays).toBe(1.5);
  });

  it("does not count days before the habit existed", () => {
    const young = { ...habit, created_at: "2026-09-05T00:00:00Z" };
    const [f] = habitFacts([young], [], week);
    expect(f.missedDays).toBe(2); // only 09-05 and 09-06
  });
});

describe("rabbitHoleFacts", () => {
  it("attributes captures to their local date and counts real statuses", () => {
    const holes = [
      { id: "1", active_task_id: null, active_project_id: null, raw_text: "x", status: "captured" as const, converted_id: null, created_at: "2026-08-31T23:00:00Z", converted_at: null },
      { id: "2", active_task_id: null, active_project_id: null, raw_text: "y", status: "converted_task" as const, converted_id: "t", created_at: "2026-09-01T10:00:00Z", converted_at: "2026-09-01T11:00:00Z" },
      { id: "3", active_task_id: null, active_project_id: null, raw_text: "z", status: "archived" as const, converted_id: null, created_at: "2026-08-30T10:00:00Z", converted_at: null },
    ];
    const f = rabbitHoleFacts(holes, "2026-08-31", "2026-09-06");
    expect(f.captured).toBe(2);
    expect(f.converted).toBe(1);
    expect(f.archived).toBe(0);
  });
});

describe("stateAssociations", () => {
  const obs = (stateValue: number, completedWork: number, i: number) => ({
    date: `2026-09-0${(i % 9) + 1}`,
    stateValue,
    completedWork,
  });

  it("suppresses claims below the sample threshold", () => {
    const a = stateAssociations("energy", [obs(8, 100, 1), obs(3, 10, 2)]);
    expect(a.confidence).toBe("insufficient");
  });

  it("uses strictly associational language above the threshold", () => {
    const observations: ReturnType<typeof obs>[] = [];
    for (let i = 0; i < STATE_ASSOCIATION_MIN_PAIRS; i++) {
      // half high-energy/lot of work, half low-energy/little work
      observations.push(i % 2 === 0 ? obs(9, 240, i) : obs(2, 30, i));
    }
    const a = stateAssociations("energy", observations);
    expect(a.confidence).toBe("tentative");
    expect(a.statement).toMatch(/associated with/);
    expect(a.statement).not.toMatch(/caused|because|should/);
  });
});

describe("detectPatterns", () => {
  it("produces no strong claims from empty data", () => {
    const patterns = detectPatterns({
      events: [],
      estimates: { taskCount: 0, medianErrorMinutes: null, medianRatio: null, overEstimateCount: 0, underEstimateCount: 0, bias: "insufficient-data" },
      planning: { plannedMinutes: null, completedEstimatedMinutes: 0, loggedWorkMinutes: 0, remainingEstimatedMinutes: null, deferredEstimatedMinutes: 0, overloadDays: 0, daysWithPlanData: 0, compressionCount: 0 },
      execution: { tasksCompleted: 0, tasksDeferred: 0, tasksCancelled: 0, sessionsStarted: 0, sessionsFinished: 0, sessionsInterrupted: 0, sessionsAbandoned: null, totalLoggedMinutes: 0, medianSessionMinutes: null, interruptions: 0 },
      associations: [],
      habitRecoverySamples: [],
    });
    expect(patterns).toHaveLength(0);
  });
});

describe("buildWeeklyBehaviorFacts (integration)", () => {
  let db: Awaited<ReturnType<typeof createInMemoryDatabase>>;
  beforeEach(async () => {
    db = await createInMemoryDatabase();
    setDatabase(db);
  });

  it("returns honest sparse facts for an empty week", async () => {
    const facts = await buildWeeklyBehaviorFacts("2026-08-31");
    expect(facts.execution.tasksCompleted).toBe(0);
    expect(facts.planning.plannedMinutes).toBeNull();
    expect(facts.estimates.bias).toBe("insufficient-data");
    expect(facts.coverage.daysWithData).toBe(0);
    expect(facts.patterns).toHaveLength(0);
  });

  it("counts completed tasks, sessions and deferrals from real rows", async () => {
    const { TaskRepository } = await import("../../repositories/taskRepository");
    const { WorkSessionRepository } = await import("../../repositories/workSessionRepository");
    const eventLog = new EventLogRepository();
    const taskRepo = new TaskRepository();
    const sessionRepo = new WorkSessionRepository();

    await taskRepo.createTask({ id: crypto.randomUUID(), title: "Done", estimated_minutes: 60, actual_minutes: 45, status: "completed", completed_at: "2026-08-31T15:00:00Z", scheduled_date: "2026-08-31" });
    await sessionRepo.createSession({ task_id: null, start_time: "2026-08-31T10:00:00Z", end_time: "2026-08-31T10:45:00Z", duration_seconds: 2700, completed_state: "finished", interruption_count: 0 });
    await eventLog.record("task.deferred", "task", crypto.randomUUID(), { estimated_minutes: 30 });
    // Events are stamped with "now" — pin the deferral inside the fixture
    // week so the test does not break when the calendar moves past it.
    await setDatabase(db);
    await db.execute(`UPDATE event_log SET created_at = '2026-08-31T09:00:00Z';`);

    const facts = await buildWeeklyBehaviorFacts("2026-08-31");
    expect(facts.execution.tasksCompleted).toBe(1);
    expect(facts.execution.sessionsFinished).toBe(1);
    expect(facts.execution.totalLoggedMinutes).toBe(45);
    expect(facts.deferrals.totalDeferrals).toBe(1);
    expect(facts.estimates.taskCount).toBe(1);
    // 7-day week without snapshots -> explicit warning, no fake plan claims
    expect(facts.coverage.warnings.some((w) => w.includes("snapshots"))).toBe(true);
  });
});
