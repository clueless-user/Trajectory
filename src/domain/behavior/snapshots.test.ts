import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../../repositories/database";
import { EventLogRepository } from "../../repositories/eventLogRepository";
import { useTaskStore } from "../../stores/useTaskStore";
import { todayLocal } from "../../domain/time/date";
import {
  buildDaySnapshotPayload,
  snapshotSignature,
} from "./snapshots";
import { localDayBounds, weekStart } from "../../domain/time/date";
import { Task } from "../models/types";

describe("planning day snapshots", () => {
  const eventLog = new EventLogRepository();

  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
  });

  async function snapshotEvents(): Promise<ReturnType<typeof eventLog.getByType>> {
    return eventLog.getByType("planning.day_snapshot", 100);
  }

  it("records a day_opened snapshot when the day first loads with a planned task", async () => {
    await useTaskStore.getState().createTask({
      title: "Planned work",
      estimated_minutes: 60,
      scheduled_date: todayLocal(),
    });
    await useTaskStore.getState().loadTodayTasks(todayLocal());

    const events = await snapshotEvents();
    expect(events).toHaveLength(1);
    const payload = JSON.parse(events[0].payload!);
    expect(payload.snapshot_reason).toBe("day_opened");
    expect(payload.date).toBe(todayLocal());
    expect(payload.total_planned_minutes).toBe(60);
    expect(payload.planned_tasks).toHaveLength(1);
    expect(payload.available_minutes).toBe(420);
  });

  it("does not duplicate a snapshot for an unchanged plan", async () => {
    await useTaskStore.getState().createTask({
      title: "Planned work",
      estimated_minutes: 60,
      scheduled_date: todayLocal(),
    });
    await useTaskStore.getState().loadTodayTasks(todayLocal());
    await useTaskStore.getState().loadTodayTasks(todayLocal());
    await useTaskStore.getState().loadTodayTasks(todayLocal());

    expect(await snapshotEvents()).toHaveLength(1);
  });

  it("records a new snapshot after compression changes the plan", async () => {
    // 480 optional minutes against a 60-minute day forces compression
    // (important tasks are always kept while any budget remains).
    await useTaskStore.getState().createTask({
      title: "Big work",
      importance: "optional",
      estimated_minutes: 480,
      scheduled_date: todayLocal(),
    });
    await useTaskStore.getState().loadTodayTasks(todayLocal());
    await useTaskStore.getState().setAvailableMinutes(60, todayLocal());
    const result = await useTaskStore.getState().compressPlan(todayLocal());
    expect(result.deferredCount).toBe(1);

    const events = await snapshotEvents();
    const reasons = events.map((e) => JSON.parse(e.payload!).snapshot_reason);
    expect(reasons).toContain("compression_applied");
    // The post-compression snapshot shows the plan of record with nothing
    // left planned (getByType returns newest-first).
    const latest = JSON.parse(events[0].payload!);
    expect(latest.planned_tasks).toHaveLength(0);
  });

  it("records a material_replan snapshot when a task's status changes", async () => {
    const task = await useTaskStore.getState().createTask({
      title: "Work",
      estimated_minutes: 30,
      scheduled_date: todayLocal(),
    });
    await useTaskStore.getState().loadTodayTasks(todayLocal());
    await useTaskStore.getState().updateTaskStatus(task.id, "completed");

    const events = await snapshotEvents();
    const reasons = events.map((e) => JSON.parse(e.payload!).snapshot_reason);
    expect(reasons).toContain("material_replan");
  });

  it("writes at most one snapshot per local date and getLatestSnapshotsForRange returns it", async () => {
    await useTaskStore.getState().createTask({
      title: "Work",
      estimated_minutes: 30,
      scheduled_date: todayLocal(),
    });
    await useTaskStore.getState().loadTodayTasks(todayLocal());
    await useTaskStore.getState().loadTodayTasks(todayLocal());

    const { startIso, endIso } = localDayBounds(todayLocal());
    const latest = await eventLog.getLatestSnapshotsForRange(startIso, endIso);
    expect(latest).toHaveLength(1);
  });

  it("does not duplicate snapshots when two loads race (StrictMode double-boot)", async () => {
    await useTaskStore.getState().createTask({
      title: "Work",
      estimated_minutes: 30,
      scheduled_date: todayLocal(),
    });
    // Exactly the boot pattern: two loads fired concurrently.
    await Promise.all([
      useTaskStore.getState().loadTodayTasks(todayLocal()),
      useTaskStore.getState().loadTodayTasks(todayLocal()),
    ]);
    const events = await snapshotEvents();
    expect(events).toHaveLength(1);
  });
});

describe("snapshot payload construction", () => {
  const baseTask = (overrides: Partial<Task>): Task => ({
    id: "t1",
    project_id: null,
    title: "Task",
    description: null,
    importance: "important",
    cognitive_demand: "medium",
    status: "planned",
    estimated_minutes: 45,
    actual_minutes: 0,
    scheduled_date: "2026-09-07",
    due_date: null,
    completed_at: null,
    order_index: 0,
    created_at: "2026-09-07T08:00:00Z",
    updated_at: "2026-09-07T08:00:00Z",
    deleted_at: null,
    ...overrides,
  });

  it("only includes planned/in_progress tasks and sorts them by id", () => {
    const tasks = [
      baseTask({ id: "b", status: "completed" }),
      baseTask({ id: "z", estimated_minutes: 10 }),
      baseTask({ id: "a", status: "in_progress", estimated_minutes: 20 }),
    ];
    const payload = buildDaySnapshotPayload("2026-09-07", 240, "Objective", tasks, "day_opened");
    expect(payload.planned_tasks.map((t) => t.task_id)).toEqual(["a", "z"]);
    expect(payload.total_planned_minutes).toBe(30);
  });

  it("signature ignores the snapshot reason (dedupe across reasons)", () => {
    const tasks = [baseTask({})];
    const a = buildDaySnapshotPayload("2026-09-07", 240, null, tasks, "day_opened");
    const b = buildDaySnapshotPayload("2026-09-07", 240, null, tasks, "material_replan");
    expect(snapshotSignature(a)).toBe(snapshotSignature(b));
  });
});

describe("week and day-bound helpers", () => {
  it("weekStart returns the Monday of the containing local week", () => {
    expect(weekStart("2026-09-05")).toBe("2026-08-31"); // Saturday → Monday
    expect(weekStart("2026-08-31")).toBe("2026-08-31"); // Monday itself
    expect(weekStart("2026-09-06")).toBe("2026-08-31"); // Sunday → previous Monday
  });

  it("localDayBounds covers exactly the local day", () => {
    const { startIso, endIso } = localDayBounds("2026-09-05");
    expect(new Date(startIso).getHours()).toBe(0);
    expect(new Date(endIso).getTime() - new Date(startIso).getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
