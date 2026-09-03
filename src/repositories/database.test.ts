import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "./database";
import { TaskRepository } from "./taskRepository";
import { HabitRepository } from "./habitRepository";
import { StateRepository } from "./stateRepository";
import { ReviewRepository } from "./reviewRepository";

describe("Database & Repositories Integration", () => {
  let taskRepo: TaskRepository;
  let habitRepo: HabitRepository;
  let stateRepo: StateRepository;
  let reviewRepo: ReviewRepository;

  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
    taskRepo = new TaskRepository();
    habitRepo = new HabitRepository();
    stateRepo = new StateRepository();
    reviewRepo = new ReviewRepository();
  });

  it("initializes schema and seeds default areas and habits", async () => {
    const habits = await habitRepo.getAllHabits();
    expect(habits.length).toBeGreaterThanOrEqual(4);
    const deepWork = habits.find((h) => h.title === "Deep Work");
    expect(deepWork).toBeDefined();
    expect(deepWork?.normal_target).toBe(180);
    expect(deepWork?.minimum_target).toBe(30);
  });

  it("performs task CRUD operations and preserves order by importance", async () => {
    const today = "2026-09-03";
    const t1 = await taskRepo.createTask({
      title: "Optional Task",
      importance: "optional",
      estimated_minutes: 20,
      scheduled_date: today,
    });
    const t2 = await taskRepo.createTask({
      title: "Critical Task",
      importance: "critical",
      estimated_minutes: 60,
      scheduled_date: today,
    });
    const t3 = await taskRepo.createTask({
      title: "Important Task",
      importance: "important",
      estimated_minutes: 45,
      scheduled_date: today,
    });

    const todayTasks = await taskRepo.getTodayTasks(today);
    expect(todayTasks.length).toBe(3);
    // Critical must be first, then Important, then Optional
    expect(todayTasks[0].id).toBe(t2.id);
    expect(todayTasks[1].id).toBe(t3.id);
    expect(todayTasks[2].id).toBe(t1.id);

    // Update status
    await taskRepo.updateTask(t2.id, { status: "in_progress" });
    const fetched = await taskRepo.getTaskById(t2.id);
    expect(fetched?.status).toBe("in_progress");

    // Soft delete
    await taskRepo.softDeleteTask(t1.id);
    const afterDelete = await taskRepo.getTodayTasks(today);
    expect(afterDelete.find((t) => t.id === t1.id)).toBeUndefined();
  });

  it("logs habits with continuous values and updates existing date records", async () => {
    const habits = await habitRepo.getAllHabits();
    const meditation = habits.find((h) => h.title === "Meditation")!;
    const date = "2026-09-03";

    // Partial / minimum log
    const log1 = await habitRepo.logHabit(meditation.id, date, 15, "minimum");
    expect(log1.value).toBe(15);
    expect(log1.target_met_status).toBe("minimum");

    // Later updated to full normal target on the same day
    const log2 = await habitRepo.logHabit(meditation.id, date, 60, "normal", "Completed morning sit");
    expect(log2.value).toBe(60);
    expect(log2.target_met_status).toBe("normal");

    const todayLogs = await habitRepo.getLogsForDate(date);
    expect(todayLogs.length).toBe(1);
    expect(todayLogs[0].value).toBe(60);
    expect(todayLogs[0].notes).toBe("Completed morning sit");
  });

  it("persists daily state and reviews cleanly", async () => {
    const date = "2026-09-03";
    const state = await stateRepo.saveDailyState({
      date,
      energy: 8,
      clarity: 7,
      stress: 3,
      social_battery: 6,
    });
    expect(state.energy).toBe(8);

    const review = await reviewRepo.saveDailyReview({
      date,
      completed_task_count: 5,
      total_work_minutes: 240,
      tomorrow_objective: "Optimize memory paging in engine",
      energy_drains: "Context switching",
      energy_boosts: "Deep coding uninterrupted",
    });
    expect(review.tomorrow_objective).toBe("Optimize memory paging in engine");

    const fetchedReview = await reviewRepo.getDailyReview(date);
    expect(fetchedReview?.completed_task_count).toBe(5);
  });
});
