import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase, getDatabase } from "./database";
import { TaskRepository } from "./taskRepository";
import { WorkSessionRepository } from "./workSessionRepository";
import { HabitRepository } from "./habitRepository";

describe("runtime validation at repository boundaries", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("round-trips valid tasks through schema-validated reads", async () => {
    const repo = new TaskRepository();
    const task = await repo.createTask({
      title: "Valid task",
      importance: "critical",
      estimated_minutes: 30,
      scheduled_date: "2026-09-04",
    });

    const fetched = await repo.getTaskById(task.id);
    expect(fetched?.title).toBe("Valid task");
    expect((await repo.getTodayTasks("2026-09-04")).length).toBe(1);
  });

  it("rejects corrupt task rows instead of returning untrusted data", async () => {
    const repo = new TaskRepository();
    await repo.createTask({ title: "Good task", scheduled_date: "2026-09-04" });

    // Corrupt a row directly in SQL, bypassing the repository: invalid UUID.
    await getDatabase().execute(
      `INSERT INTO tasks (id, title, importance, cognitive_demand, status, estimated_minutes, actual_minutes, scheduled_date, order_index, created_at, updated_at)
       VALUES ('not-a-uuid', 'Corrupt row', 'important', 'medium', 'planned', 30, 0, '2026-09-04', 0, '2026-09-04T00:00:00Z', '2026-09-04T00:00:00Z');`
    );

    await expect(repo.getTodayTasks("2026-09-04")).rejects.toThrow(/schema validation/);
  });

  it("rejects recovery-path session rows whose values the schema forbids", async () => {
    const repo = new WorkSessionRepository();
    await repo.createSession({
      task_id: null,
      start_time: "2026-09-04T09:00:00.000Z",
      end_time: "2026-09-04T09:00:00.000Z",
      duration_seconds: 0,
      interruption_count: 0,
      completed_state: "paused",
    });

    // Corrupt a field with no SQL CHECK (interruption_count) in a way SQL
    // accepts but the domain schema forbids (negative counts).
    await getDatabase().execute(
      `INSERT INTO work_sessions (id, task_id, start_time, end_time, duration_seconds, interruption_count, completed_state, created_at)
       VALUES ('11111111-2222-4333-8444-555555555555', NULL, '2026-09-04T08:00:00.000Z', '2026-09-04T08:00:00.000Z', 0, -5, 'paused', '2026-09-04T08:00:00Z');`
    );

    await expect(repo.getPausedSessions()).rejects.toThrow(/schema validation/);
  });

  it("validates habit log construction with the domain schema", async () => {
    const habitRepo = new HabitRepository();
    const habit = await habitRepo.createHabit({
      title: "Meditation",
      normal_target: 60,
      minimum_target: 5,
    });

    const log = await habitRepo.logHabit(habit.id, "2026-09-04", 30, "minimum", "sit complete");
    expect(log.value).toBe(30);
    expect(log.target_met_status).toBe("minimum");
  });
});
