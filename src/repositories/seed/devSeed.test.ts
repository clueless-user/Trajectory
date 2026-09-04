import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase, getDatabase } from "../database";
import { seedDevelopmentData, isTaskTableEmpty } from "./devSeed";
import { HabitRepository } from "../habitRepository";
import { TaskRepository } from "../taskRepository";

describe("devSeed — deterministic development dataset", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("refuses to run when tasks already exist (never mixes with real data)", async () => {
    const taskRepo = new TaskRepository();
    await taskRepo.createTask({ title: "A real user task", scheduled_date: "2026-09-04" });

    await expect(seedDevelopmentData()).rejects.toThrow(/refused/);
    // The real task is untouched.
    expect((await taskRepo.getTodayTasks("2026-09-04")).length).toBe(1);
  });

  it("seeds the full realistic structure on an empty database", async () => {
    const summary = await seedDevelopmentData();

    expect(summary.goals).toBe(4);
    expect(summary.projects).toBe(4);
    expect(summary.tasks).toBe(10);
    expect(summary.rabbitHoles).toBe(2);
    expect(summary.reviews).toBe(2);
    expect(summary.dailyStates).toBe(14);
    expect(summary.habitLogs).toBeGreaterThan(20);
    expect(summary.workSessions).toBeGreaterThanOrEqual(14);
  });

  it("produces an identical dataset on repeated runs against fresh databases", async () => {
    const first = await seedDevelopmentData();

    // Fresh empty database, same seed → identical summary.
    setDatabase(await createInMemoryDatabase());
    const second = await seedDevelopmentData();

    expect(second).toEqual(first);

    const rows = await getDatabase().select<{ id: string; title: string }>(
      "SELECT id, title FROM tasks ORDER BY id;"
    );
    expect(rows.length).toBe(10);
    // Fixed UUIDs, not random ones — stable across runs.
    expect(rows.every((r) => r.id.startsWith("dea10003-"))).toBe(true);
  });

  it("marks today's plan as overloaded against the default 420-minute capacity", async () => {
    await seedDevelopmentData();

    const taskRepo = new TaskRepository();
    const today = new Date().toISOString().split("T")[0];
    const todayTasks = await taskRepo.getTodayTasks(today);

    const planned = todayTasks.filter((t) => t.status === "planned" || t.status === "in_progress");
    const committed = planned.reduce((acc, t) => acc + t.estimated_minutes, 0);
    expect(committed).toBe(435);
    expect(committed).toBeGreaterThan(420);

    // A critical anchor and an in-progress task exist so the cockpit is live.
    expect(planned.some((t) => t.importance === "critical")).toBe(true);
    expect(planned.some((t) => t.status === "in_progress")).toBe(true);
    // Completed history is present but does not count into planned load.
    expect(todayTasks.some((t) => t.status === "completed")).toBe(true);
  });

  it("writes two weeks of habit history with mixed outcomes and no logs today", async () => {
    await seedDevelopmentData();

    const habitRepo = new HabitRepository();
    const habits = await habitRepo.getAllHabits();
    const today = new Date().toISOString().split("T")[0];

    // Combined history across all habits must show a lived-in mix: normal
    // days, minimum-viable days, and missed days — and today is unlogged.
    const allPast = new Set<string>();
    for (const habit of habits) {
      const statuses = await habitRepo.getRecentStatuses(habit.id, today, 14);
      expect(statuses[statuses.length - 1]).toBe("none"); // today not yet lived
      for (const s of statuses.slice(0, -1)) allPast.add(s);
    }
    expect(allPast.has("normal")).toBe(true);
    expect(allPast.has("minimum")).toBe(true);
    expect(allPast.has("none")).toBe(true);
  });

  it("leaves daily states, reviews, rabbit holes and a marked brain dump behind", async () => {
    await seedDevelopmentData();
    const db = getDatabase();
    const dump = async (sql: string) => {
      const rows = await db.select<Record<string, unknown>>(sql);
      return rows;
    };

    const states = await dump("SELECT notes FROM daily_states;");
    expect(states.length).toBe(14);
    expect(states.every((s) => s.notes === "development seed")).toBe(true);

    const reviews = await dump("SELECT tomorrow_objective FROM daily_reviews;");
    expect(reviews.length).toBe(2);
    expect(reviews.every((r) => Boolean(r.tomorrow_objective))).toBe(true);

    const holes = await dump("SELECT status, converted_id FROM rabbit_holes ORDER BY status;");
    expect(holes.length).toBe(2);
    expect(holes.some((h) => h.status === "captured")).toBe(true);
    expect(holes.some((h) => h.status === "converted_task" && Boolean(h.converted_id))).toBe(true);

    const dumps = await dump("SELECT content FROM brain_dumps;");
    expect(dumps.length).toBe(1);
    expect(String(dumps[0].content)).toContain("DEVELOPMENT SEED DATA");
  });

  it("reports an empty task table before seeding", async () => {
    expect(await isTaskTableEmpty()).toBe(true);
    await seedDevelopmentData();
    expect(await isTaskTableEmpty()).toBe(false);
  });
});
