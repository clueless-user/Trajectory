import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { ReviewRepository } from "../repositories/reviewRepository";
import { useTaskStore } from "./useTaskStore";
import { todayLocal, addDays } from "../domain/time/date";

describe("useTaskStore", () => {
  const eventLog = new EventLogRepository();
  const reviewRepo = new ReviewRepository();

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
    useTaskStore.getState().setAvailableMinutes(100, today);

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

  describe("persistent planning state", () => {
    it("persists the objective and available minutes across reloads", async () => {
      const today = todayLocal();
      await useTaskStore.getState().setPrimaryObjective("Ship the eviction benchmark", today);
      await useTaskStore.getState().setAvailableMinutes(360, today);

      // Simulate a restart: fresh in-memory store state, same database.
      useTaskStore.setState({ primaryObjective: null, availableMinutes: 420 });
      await useTaskStore.getState().loadPlanningState(today);

      expect(useTaskStore.getState().primaryObjective).toBe("Ship the eviction benchmark");
      expect(useTaskStore.getState().availableMinutes).toBe(360);

      const events = await eventLog.getRecent(10);
      expect(events.some((e) => e.event_type === "planning.objective_set")).toBe(true);
      expect(events.some((e) => e.event_type === "planning.available_minutes_changed")).toBe(true);
    });

    it("carries yesterday's tomorrow-objective into today on load", async () => {
      const today = todayLocal();
      await reviewRepo.saveDailyReview({
        date: addDays(today, -1),
        completed_task_count: 0,
        total_work_minutes: 0,
        tomorrow_objective: "Profile the attention kernel",
      });

      await useTaskStore.getState().loadPlanningState(today);

      expect(useTaskStore.getState().primaryObjective).toBe("Profile the attention kernel");
      const events = await eventLog.getRecent(10);
      expect(events.some((e) => e.event_type === "planning.objective_carried_over")).toBe(true);
    });

    it("never lets the handoff overwrite today's own objective", async () => {
      const today = todayLocal();
      await reviewRepo.saveDailyReview({
        date: addDays(today, -1),
        completed_task_count: 0,
        total_work_minutes: 0,
        tomorrow_objective: "Stale suggestion",
      });
      await useTaskStore.getState().setPrimaryObjective("Today's own plan", today);

      await useTaskStore.getState().loadPlanningState(today);

      expect(useTaskStore.getState().primaryObjective).toBe("Today's own plan");
    });

    it("falls back to null objective and 420 minutes when nothing is recorded", async () => {
      await useTaskStore.getState().loadPlanningState(todayLocal());
      expect(useTaskStore.getState().primaryObjective).toBeNull();
      expect(useTaskStore.getState().availableMinutes).toBe(420);
    });
  });

  describe("planner board (Kanban on Task.status)", () => {
    it("loads all tasks onto the board regardless of schedule", async () => {
      await useTaskStore.getState().createTask({ title: "Scheduled", scheduled_date: "2026-09-03" });
      await useTaskStore.getState().createTask({ title: "Unrouted inbox work" });

      await useTaskStore.getState().loadBoard();

      const board = useTaskStore.getState().boardTasks;
      expect(board.length).toBe(2);
      expect(board.map((t) => t.status).sort()).toEqual(["inbox", "planned"]);
    });

    it("moves an inbox task to planned and schedules it for today so it appears on Today", async () => {
      const task = await useTaskStore.getState().createTask({ title: "Captured tangent task" });
      expect(task.status).toBe("inbox");

      await useTaskStore.getState().loadBoard();
      await useTaskStore.getState().moveTaskStatus(task.id, "planned");

      const moved = useTaskStore.getState().boardTasks.find((t) => t.id === task.id);
      expect(moved?.status).toBe("planned");
      expect(moved?.scheduled_date).toBe(todayLocal()); // visible on Today

      const todayList = useTaskStore.getState().tasks;
      expect(todayList.some((t) => t.id === task.id)).toBe(true);
    });

    it("recovers a deferred task by moving it back to planned", async () => {
      const task = await useTaskStore.getState().createTask({
        title: "Overflowed work",
        scheduled_date: "2026-09-03",
      });
      await useTaskStore.getState().updateTaskStatus(task.id, "deferred");
      await useTaskStore.getState().loadBoard();

      await useTaskStore.getState().moveTaskStatus(task.id, "planned");

      const recovered = useTaskStore.getState().boardTasks.find((t) => t.id === task.id);
      expect(recovered?.status).toBe("planned");
      expect(recovered?.scheduled_date).not.toBeNull(); // rescheduled
    });

    it("sets completed_at when completing from the board and clears it when reopened", async () => {
      const task = await useTaskStore.getState().createTask({
        title: "Finishable",
        scheduled_date: "2026-09-03",
      });
      await useTaskStore.getState().loadBoard();

      await useTaskStore.getState().moveTaskStatus(task.id, "completed");
      expect(
        useTaskStore.getState().boardTasks.find((t) => t.id === task.id)?.completed_at
      ).toBeTruthy();

      await useTaskStore.getState().moveTaskStatus(task.id, "in_progress");
      const reopened = useTaskStore.getState().boardTasks.find((t) => t.id === task.id);
      expect(reopened?.status).toBe("in_progress");
      expect(reopened?.completed_at).toBeNull();
    });

    it("keeps the board and the today list consistent after a move", async () => {
      const task = await useTaskStore.getState().createTask({
        title: "Dual-surface task",
        scheduled_date: todayLocal(),
      });
      await useTaskStore.getState().loadBoard();

      await useTaskStore.getState().moveTaskStatus(task.id, "completed");

      const boardStatus = useTaskStore.getState().boardTasks.find((t) => t.id === task.id)?.status;
      const todayStatus = useTaskStore.getState().tasks.find((t) => t.id === task.id)?.status;
      expect(boardStatus).toBe("completed");
      expect(todayStatus).toBe("completed");
    });
  });
});
