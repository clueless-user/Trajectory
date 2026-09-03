import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { useTaskStore } from "./useTaskStore";

describe("useTaskStore", () => {
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
