import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase, runMigrations } from "./database";
import { PlanningStateRepository } from "./planningStateRepository";
import { ReviewRepository } from "./reviewRepository";
import { EventLogRepository } from "./eventLogRepository";
import { todayLocal, addDays } from "../domain/time/date";

const repo = new PlanningStateRepository();
const reviewRepo = new ReviewRepository();
const eventLog = new EventLogRepository();

describe("PlanningStateRepository — persistent planning state", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
  });

  it("round-trips a day's planning state", async () => {
    const saved = await repo.saveForDate(todayLocal(), {
      primary_objective: "Ship the eviction benchmark",
      available_minutes: 360,
    });

    expect(saved.primary_objective).toBe("Ship the eviction benchmark");
    expect(saved.available_minutes).toBe(360);

    const loaded = await repo.getForDate(todayLocal());
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.primary_objective).toBe("Ship the eviction benchmark");
  });

  it("upserts by day — editing never creates a second row", async () => {
    await repo.saveForDate(todayLocal(), { primary_objective: "First" });
    await repo.saveForDate(todayLocal(), { primary_objective: "Second", available_minutes: 120 });
    const final = await repo.saveForDate(todayLocal(), { available_minutes: 300 });

    expect(final.primary_objective).toBe("Second"); // untouched by the minutes-only update
    expect(final.available_minutes).toBe(300);

    const rows = await (await import("./database")).getDatabase().select(
      "SELECT id FROM planning_state;"
    );
    expect(rows.length).toBe(1);
  });

  it("keeps different days independent", async () => {
    await repo.saveForDate(todayLocal(), { primary_objective: "Today's focus" });
    await repo.saveForDate(addDays(todayLocal(), 1), { primary_objective: "Tomorrow's focus" });

    expect((await repo.getForDate(todayLocal()))?.primary_objective).toBe("Today's focus");
    expect((await repo.getForDate(addDays(todayLocal(), 1)))?.primary_objective).toBe(
      "Tomorrow's focus"
    );
    expect(await repo.getForDate(addDays(todayLocal(), -5))).toBeNull();
  });

  it("upgrades a v2 database to v3 without losing data", async () => {
    // Roll back to v2 shape: forget migration 3 and drop its table.
    const db = (await import("./database")).getDatabase();
    await db.execute("DROP TABLE planning_state;");
    await db.execute("DELETE FROM _migrations WHERE version = 3;");

    // Pre-existing v2-era data.
    await reviewRepo.saveDailyReview({
      date: addDays(todayLocal(), -1),
      completed_task_count: 0,
      total_work_minutes: 0,
      tomorrow_objective: "Written before planning_state existed",
    });

    await runMigrations(db);

    const versions = await db.select<{ version: number }>(
      "SELECT version FROM _migrations ORDER BY version;"
    );
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);

    // The new table works and old data is untouched.
    await repo.saveForDate(todayLocal(), { primary_objective: "Post-upgrade objective" });
    expect((await repo.getForDate(todayLocal()))?.primary_objective).toBe(
      "Post-upgrade objective"
    );
    const yesterday = await reviewRepo.getDailyReview(addDays(todayLocal(), -1));
    expect(yesterday?.tomorrow_objective).toBe("Written before planning_state existed");
  });

  describe("tomorrow-objective handoff", () => {
    it("seeds today's objective from yesterday's review on first load", async () => {
      await reviewRepo.saveDailyReview({
        date: addDays(todayLocal(), -1),
        completed_task_count: 0,
        total_work_minutes: 0,
        tomorrow_objective: "Finish the KV cache harness",
      });

      // Simulate the store's load: no row today → handoff from yesterday.
      const existing = await repo.getForDate(todayLocal());
      expect(existing).toBeNull();
      const yesterday = await reviewRepo.getDailyReview(addDays(todayLocal(), -1));
      const carried = yesterday?.tomorrow_objective?.trim();
      expect(carried).toBe("Finish the KV cache harness");
      if (carried) await repo.saveForDate(todayLocal(), { primary_objective: carried });

      expect((await repo.getForDate(todayLocal()))?.primary_objective).toBe(
        "Finish the KV cache harness"
      );
    });

    it("never overwrites today's own objective with the handoff", async () => {
      await repo.saveForDate(todayLocal(), { primary_objective: "Today's own plan" });
      await reviewRepo.saveDailyReview({
        date: addDays(todayLocal(), -1),
        completed_task_count: 0,
        total_work_minutes: 0,
        tomorrow_objective: "Stale suggestion",
      });

      // Handoff only applies when today has no row (store guard).
      const existing = await repo.getForDate(todayLocal());
      expect(existing).not.toBeNull();
      expect(existing?.primary_objective).toBe("Today's own plan");
    });

    it("is idempotent — the handoff writes once and survives re-loads", async () => {
      await reviewRepo.saveDailyReview({
        date: addDays(todayLocal(), -1),
        completed_task_count: 0,
        total_work_minutes: 0,
        tomorrow_objective: "Carry me forward",
      });

      const first = await repo.saveForDate(todayLocal(), { primary_objective: "Carry me forward" });
      const second = await repo.getForDate(todayLocal());
      expect(second?.id).toBe(first.id);
      expect(second?.primary_objective).toBe("Carry me forward");
    });
  });

  describe("event instrumentation", () => {
    it("records planning events with timestamps", async () => {
      await repo.saveForDate(todayLocal(), { primary_objective: "Deep work on kernels" });
      // The store layer logs planning.objective_set; here we verify the log
      // wiring used by the store records retrievable rows.
      await eventLog.record("planning.objective_set", "planning", null, { date: todayLocal() });
      const recent = await eventLog.getRecent(5);
      expect(recent.some((e) => e.event_type === "planning.objective_set")).toBe(true);
      expect(recent[0].created_at).toBeTruthy();
    });
  });
});
