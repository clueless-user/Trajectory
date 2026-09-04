import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase, getDatabase } from "./database";
import { TaskRepository } from "./taskRepository";
import { HabitRepository } from "./habitRepository";
import { WorkSessionRepository } from "./workSessionRepository";
import { RabbitHoleRepository } from "./rabbitHoleRepository";
import { BrainDumpRepository } from "./brainDumpRepository";
import { Task } from "../domain/models/types";

const taskRepo = new TaskRepository();
const habitRepo = new HabitRepository();
const sessionRepo = new WorkSessionRepository();
const rabbitHoleRepo = new RabbitHoleRepository();
const brainDumpRepo = new BrainDumpRepository();

async function seedTask(overrides: Partial<Task> = {}): Promise<Task> {
  return taskRepo.createTask({
    title: "Profiling pass",
    importance: "important",
    estimated_minutes: 45,
    scheduled_date: "2026-09-04",
    ...overrides,
  });
}

describe("WorkSessionRepository", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("creates, updates, and deletes sessions (pause tombstone → finished promotion)", async () => {
    const task = await seedTask();

    const started = await sessionRepo.createSession({
      task_id: task.id,
      start_time: "2026-09-04T09:00:00.000Z",
      end_time: "2026-09-04T09:00:00.000Z",
      duration_seconds: 0,
      interruption_count: 0,
      completed_state: "paused",
      notes: null,
    });

    await sessionRepo.updateSession(started.id, {
      end_time: "2026-09-04T10:30:00.000Z",
      duration_seconds: 5400,
      interruption_count: 2,
      completed_state: "finished",
      notes: "Deep focus block",
    });

    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows.length).toBe(1);
    expect(rows[0].completed_state).toBe("finished");
    expect(rows[0].duration_seconds).toBe(5400);
    expect(rows[0].interruption_count).toBe(2);
    expect(rows[0].notes).toBe("Deep focus block");
    expect(rows[0].task_id).toBe(task.id);

    const forTask = await sessionRepo.getSessionsForTask(task.id);
    expect(forTask.map((s) => s.id)).toEqual([started.id]);

    await sessionRepo.deleteSession(started.id);
    expect((await sessionRepo.getRecentSessions(10)).length).toBe(0);
  });

  it("sums only sessions whose start_time begins with the requested date", async () => {
    await sessionRepo.createSession({
      task_id: null,
      start_time: "2026-09-04T08:00:00.000Z",
      end_time: "2026-09-04T08:30:00.000Z",
      duration_seconds: 1800,
      interruption_count: 0,
      completed_state: "finished",
    });
    await sessionRepo.createSession({
      task_id: null,
      start_time: "2026-09-04T14:00:00.000Z",
      end_time: "2026-09-04T14:10:00.000Z",
      duration_seconds: 600,
      interruption_count: 0,
      completed_state: "finished",
    });
    await sessionRepo.createSession({
      task_id: null,
      start_time: "2026-09-03T20:00:00.000Z",
      end_time: "2026-09-03T21:00:00.000Z",
      duration_seconds: 3600,
      interruption_count: 0,
      completed_state: "finished",
    });

    expect(await sessionRepo.getTodayTotalDuration("2026-09-04")).toBe(2400);
    expect(await sessionRepo.getTodayTotalDuration("2026-09-03")).toBe(3600);
    expect(await sessionRepo.getTodayTotalDuration("2026-09-05")).toBe(0);
  });
});

describe("RabbitHoleRepository", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("captures with provenance and a preserved timestamp", async () => {
    const task = await seedTask();

    const captured = await rabbitHoleRepo.createRabbitHole({
      raw_text: "Compare io_uring vs memory-mapped I/O latency",
      active_task_id: task.id,
    });

    expect(captured.status).toBe("captured");
    expect(captured.active_task_id).toBe(task.id);
    expect(captured.converted_id).toBeNull();

    const all = await rabbitHoleRepo.getAllRabbitHoles();
    expect(all.length).toBe(1);
    expect(all[0].raw_text).toBe("Compare io_uring vs memory-mapped I/O latency");
    expect(all[0].created_at).toBeTruthy();
  });

  it("preserves the original capture when the rabbit hole is later converted", async () => {
    const task = await seedTask();
    const captured = await rabbitHoleRepo.createRabbitHole({
      raw_text: "Research zero-copy benchmarking",
      active_task_id: task.id,
    });
    const originalCreatedAt = captured.created_at;

    const newTask = await seedTask({ title: "Zero-copy benchmark study" });
    await rabbitHoleRepo.updateStatus(captured.id, "converted_task", newTask.id);

    const all = await rabbitHoleRepo.getAllRabbitHoles();
    expect(all.length).toBe(1); // conversion does not destroy the record
    const converted = all[0];
    expect(converted.status).toBe("converted_task");
    expect(converted.converted_id).toBe(newTask.id);
    expect(converted.converted_at).toBeTruthy();
    expect(converted.raw_text).toBe("Research zero-copy benchmarking"); // provenance intact
    expect(converted.created_at).toBe(originalCreatedAt);
  });
});

describe("BrainDumpRepository", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("round-trips raw multiline text verbatim (parser never destroys the dump)", async () => {
    const messy = [
      "  TODO profile the allocator",
      "",
      "idea? zero-copy serde for telemetry",
      "\t- check io_uring deadlines",
      "why is KV cache evicting early??",
    ].join("\n");

    await brainDumpRepo.saveBrainDump(messy);
    const loaded = await brainDumpRepo.getLatestBrainDump();

    expect(loaded?.content).toBe(messy);
  });

  it("keeps a single document and updates it in place", async () => {
    await brainDumpRepo.saveBrainDump("first thoughts");
    await brainDumpRepo.saveBrainDump("second thoughts\nwith more detail");

    const rows = await getDatabase().select("SELECT id FROM brain_dumps;");
    expect(rows.length).toBe(1);

    const loaded = await brainDumpRepo.getLatestBrainDump();
    expect(loaded?.content).toBe("second thoughts\nwith more detail");
  });
});

describe("TaskRepository extras", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("lists inbox tasks newest-first and hides soft-deleted rows", async () => {
    const older = await taskRepo.createTask({ title: "Inbox older" });
    // created_at has millisecond resolution; ensure distinct timestamps for ordering.
    await new Promise((r) => setTimeout(r, 5));
    const newer = await taskRepo.createTask({ title: "Inbox newer" });

    const inbox = await taskRepo.getInboxTasks();
    expect(inbox.map((t) => t.id)).toEqual([newer.id, older.id]);

    await taskRepo.softDeleteTask(older.id);
    expect((await taskRepo.getInboxTasks()).map((t) => t.id)).toEqual([newer.id]);

    const allIncludingDeleted = await taskRepo.getAllTasks(true);
    expect(allIncludingDeleted.length).toBe(2);
    expect((await taskRepo.getAllTasks(false)).length).toBe(1);
  });

  it("supports the actions (subtask) lifecycle", async () => {
    const task = await seedTask();

    await taskRepo.createAction(task.id, "Reproduce the leak");
    await taskRepo.createAction(task.id, "Patch the allocator");

    let actions = await taskRepo.getActionsByTaskId(task.id);
    expect(actions.length).toBe(2);
    expect(actions[0].is_completed).toBe(false);

    await taskRepo.toggleAction(actions[0].id, true);
    actions = await taskRepo.getActionsByTaskId(task.id);
    expect(actions[0].is_completed).toBe(true);
    expect(actions[0].completed_at).toBeTruthy();
  });

  it("returns null for a missing task instead of throwing", async () => {
    expect(await taskRepo.getTaskById("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("HabitRepository history", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("fills unlogged days as missed in recent statuses", async () => {
    const habit = await habitRepo.createHabit({ title: "Meditation", normal_target: 60, minimum_target: 5 });

    // Window Sep 1–7 (7 days ending 2026-09-07): log only 3 days.
    await habitRepo.logHabit(habit.id, "2026-09-01", 60, "normal");
    await habitRepo.logHabit(habit.id, "2026-09-03", 10, "minimum");
    await habitRepo.logHabit(habit.id, "2026-09-07", 75, "exceeded");

    const statuses = await habitRepo.getRecentStatuses(habit.id, "2026-09-07", 7);
    expect(statuses).toEqual([
      "normal",   // 09-01
      "none",     // 09-02 unlogged
      "minimum",  // 09-03
      "none",     // 09-04
      "none",     // 09-05
      "none",     // 09-06
      "exceeded", // 09-07
    ]);
  });

  it("edits history without disturbing other habits or days", async () => {
    const habitA = await habitRepo.createHabit({ title: "Habit A", normal_target: 30, minimum_target: 5 });
    const habitB = await habitRepo.createHabit({ title: "Habit B", normal_target: 45, minimum_target: 10 });

    await habitRepo.logHabit(habitA.id, "2026-09-04", 10, "minimum");
    await habitRepo.logHabit(habitB.id, "2026-09-04", 45, "normal");

    // Historical edit: yesterday's 10 minutes corrected to a full 30.
    await habitRepo.logHabit(habitA.id, "2026-09-04", 30, "normal", "finished the session");

    const logsA = await habitRepo.getLogsForRange("2026-09-04", "2026-09-04");
    const a = logsA.find((l) => l.habit_id === habitA.id);
    const b = logsA.find((l) => l.habit_id === habitB.id);
    expect(a?.value).toBe(30);
    expect(a?.target_met_status).toBe("normal");
    expect(a?.notes).toBe("finished the session");
    expect(b?.value).toBe(45);
  });

  it("scopes a single-day recent-status window to exactly that day", async () => {
    const habit = await habitRepo.createHabit({ title: "Reading", normal_target: 45, minimum_target: 15 });
    await habitRepo.logHabit(habit.id, "2026-09-03", 45, "normal");

    expect(await habitRepo.getRecentStatuses(habit.id, "2026-09-04", 1)).toEqual(["none"]);
    expect(await habitRepo.getRecentStatuses(habit.id, "2026-09-03", 1)).toEqual(["normal"]);
  });
});
