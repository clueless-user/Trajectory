import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { useTaskStore } from "./useTaskStore";

describe("useTaskStore", () => {
  const eventLog = new EventLogRepository();

  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
  });

  it("creates tasks and manages active task selection", async () => {
    const today = "2026-09-03";
    const task = await useTaskStore.getState().createTask({
      title: "Test KV Cache Kernel",
      importance: "critical",
      cognitive_demand: "deep",
      estimated_minutes: 90,
      scheduled_date: today,
    });

    expect(task.title).toBe("Test KV Cache Kernel");
    expect(useTaskStore.getState().activeTaskId).toBe(task.id);

    // Complete task
    await useTaskStore.getState().updateTaskStatus(task.id, "completed");
    const updated = useTaskStore.getState().tasks.find((t) => t.id === task.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.completed_at).toBeDefined();

    // Behavioural instrumentation: lifecycle events were recorded.
    const events = await eventLog.getByEntity(task.id);
    expect(events.map((e) => e.event_type)).toEqual([
      "task.created",
      "task.status_changed",
    ]);
    expect(JSON.parse(events[1].payload!)).toEqual({
      from: "planned",
      to: "completed",
    });
  });

  it("edits task details through the store and persists them", async () => {
    const task = await useTaskStore.getState().createTask({
      title: "Original title",
      estimated_minutes: 30,
      scheduled_date: "2026-09-03",
    });

    await useTaskStore.getState().updateTaskDetails(task.id, {
      title: "Renamed and rescoped",
      description: "New context",
      importance: "critical",
      cognitive_demand: "deep",
      estimated_minutes: 75,
      scheduled_date: "2026-09-04",
    });

    const updated = useTaskStore.getState().tasks.find((t) => t.id === task.id);
    expect(updated?.title).toBe("Renamed and rescoped");
    expect(updated?.description).toBe("New context");
    expect(updated?.importance).toBe("critical");
    expect(updated?.cognitive_demand).toBe("deep");
    expect(updated?.estimated_minutes).toBe(75);
    expect(updated?.scheduled_date).toBe("2026-09-04");
    expect(updated?.status).toBe("planned"); // details edit must not touch status

    const events = await eventLog.getByEntity(task.id);
    expect(events.some((e) => e.event_type === "task.details_updated")).toBe(true);
  });

  it("compresses an overloaded day and marks overflow tasks deferred", async () => {
    const today = "2026-09-03";
    useTaskStore.getState().setAvailableMinutes(100);

    await useTaskStore.getState().createTask({
      title: "Hard Critical Commitment",
      importance: "critical",
      estimated_minutes: 80,
      scheduled_date: today,
    });

    await useTaskStore.getState().createTask({
      title: "Non-critical overflow",
      importance: "optional",
      estimated_minutes: 60,
      scheduled_date: today,
    });

    const result = await useTaskStore.getState().compressPlan(today);
    expect(result.deferredCount).toBe(1);
    expect(result.freedMinutes).toBe(60);

    const tasks = useTaskStore.getState().tasks;
    const overflow = tasks.find((t) => t.title === "Non-critical overflow");
    expect(overflow?.status).toBe("deferred");
  });
});
