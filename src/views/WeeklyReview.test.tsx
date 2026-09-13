import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { WeeklyReview } from "./WeeklyReview";
import { TaskRepository } from "../repositories/taskRepository";
import { WorkSessionRepository } from "../repositories/workSessionRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { addDays, todayLocal, weekStart } from "../domain/time/date";

// Last completed week (the default the component shows).
function lastCompletedWeek(): string {
  return addDays(weekStart(todayLocal()), -7);
}

describe("WeeklyReview UI", () => {
  let db: Awaited<ReturnType<typeof createInMemoryDatabase>>;
  beforeEach(async () => {
    db = await createInMemoryDatabase();
    setDatabase(db);
  });

  it("shows an honest empty state for a week with no data", async () => {
    render(<WeeklyReview />);
    await waitFor(() =>
      expect(screen.getByText(/no recorded activity this week/i)).toBeInTheDocument()
    );
    // Defaults to the last completed week, not the in-progress one.
    expect(screen.getByText(new RegExp(`Week of ${lastCompletedWeek()}`))).toBeInTheDocument();
  });

  it("renders real numbers from tasks, sessions and deferrals", async () => {
    const taskRepo = new TaskRepository();
    const sessionRepo = new WorkSessionRepository();
    const eventLog = new EventLogRepository();
    const monday = lastCompletedWeek();
    const wed = addDays(monday, 2);

    await taskRepo.createTask({
      id: crypto.randomUUID(),
      title: "Weekly task",
      estimated_minutes: 60,
      actual_minutes: 45,
      status: "completed",
      completed_at: `${wed}T15:00:00Z`,
      scheduled_date: wed,
    });
    await sessionRepo.createSession({
      task_id: null,
      start_time: `${wed}T10:00:00Z`,
      end_time: `${wed}T10:45:00Z`,
      duration_seconds: 2700,
      interruption_count: 0,
      completed_state: "finished",
    });
    await eventLog.record("task.deferred", "task", crypto.randomUUID(), { estimated_minutes: 30 });
    // Events are stamped with "now" — move the deferral into the target week.
    await db.execute(`UPDATE event_log SET created_at = ?;`, [`${wed}T09:00:00Z`]);

    render(<WeeklyReview />);
    await waitFor(() => expect(screen.getByText("This Week")).toBeInTheDocument());
    expect(screen.getAllByText("45m").length).toBeGreaterThan(0); // logged work & median session
    expect(screen.getByText(/1 tasks \(30m\)/)).toBeInTheDocument(); // deferred count + minutes
    expect(screen.getByText(/1 started · 1 finished/)).toBeInTheDocument();
    // No patterns claimable from a single session.
    expect(screen.getByText(/not enough recorded behaviour yet/i)).toBeInTheDocument();
  });

  it("hides the unlinked-goals section when empty and shows it with the three actions", async () => {
    // Seed the DB: a long-orphaned goal with one project (facts come from the
    // service, which reads repositories — store state is irrelevant here).
    const { GoalRepository } = await import("../repositories/goalRepository");
    const { AreaRepository } = await import("../repositories/areaRepository");
    const { ProjectRepository } = await import("../repositories/projectRepository");
    await new AreaRepository().createArea({ name: "Health" });
    const area = (await new AreaRepository().getAllAreas()).find((a) => a.name === "Health")!;
    await new GoalRepository().createGoal({ title: "Run Marathon", area_id: area.id });
    const goal = (await new GoalRepository().getAllGoals())[0];
    await new ProjectRepository().createProject({ title: "Couch to 5k", goal_id: goal.id, area_id: area.id });
    // created_at is "now" → inside the grace window; backdate past it.
    await db.execute("UPDATE goals SET created_at = '2026-01-01T00:00:00Z';");

    render(<WeeklyReview />);
    await waitFor(() => expect(screen.getByText("Unlinked goals")).toBeInTheDocument());
    expect(screen.getByText("Active goals without linked work as of today.")).toBeInTheDocument();
    expect(screen.getByText("Active goals without linked work in the last 7 days. Parking is a valid outcome.")).toBeInTheDocument();
    expect(screen.getByText("Add a card this week")).toBeInTheDocument();
    expect(screen.getByText("Park this goal")).toBeInTheDocument();
    expect(screen.getByText("It's still live")).toBeInTheDocument();
    expect(screen.getByText(/no linked work yet/)).toBeInTheDocument();
  });

  it("projectless unlinked goal shows the no-projects hint instead of the card action", async () => {
    const { GoalRepository } = await import("../repositories/goalRepository");
    await new GoalRepository().createGoal({ title: "Floating ambition" });
    await db.execute("UPDATE goals SET created_at = '2026-01-01T00:00:00Z';");

    render(<WeeklyReview />);
    await waitFor(() => expect(screen.getByText("Unlinked goals")).toBeInTheDocument());
    expect(screen.getByText("No projects linked to this goal.")).toBeInTheDocument();
    expect(screen.queryByText("Add a card this week")).not.toBeInTheDocument();
  });

  it("park flow writes status+parked_until and the ack flow logs the event", async () => {
    const { GoalRepository } = await import("../repositories/goalRepository");
    const goalRepo = new GoalRepository();
    await goalRepo.createGoal({ title: "Old ambition" });
    await db.execute("UPDATE goals SET created_at = '2026-01-01T00:00:00Z';");
    const goal = (await goalRepo.getAllGoals())[0];

    // Drive the store action the section uses (service facts read the same row).
    const { useHierarchyStore } = await import("../stores/useHierarchyStore");
    const parkGoal = useHierarchyStore.getState().parkGoal;
    useHierarchyStore.setState({ goals: await goalRepo.getAllGoals() });

    render(<WeeklyReview />);
    await waitFor(() => expect(screen.getByText("Unlinked goals")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Park this goal"));
    expect(screen.getByText("Park")).toBeInTheDocument();
    expect(screen.getByText("Keep active")).toBeInTheDocument();
    await act(async () => {
      await parkGoal(goal.id, "2026-09-14");
    });

    const stored = (await goalRepo.getAllGoals()).find((g) => g.id === goal.id);
    expect(stored?.status).toBe("paused");
    expect(stored?.parked_until).toBe("2026-09-14");

    // ack flow logs goal.acknowledged
    fireEvent.click(screen.getByText("It's still live"));
    await waitFor(() => expect(screen.getByText("Noted — still live.")).toBeInTheDocument());
    const { EventLogRepository } = await import("../repositories/eventLogRepository");
    const events = await new EventLogRepository().getByType("goal.acknowledged");
    expect(events.some((e) => JSON.parse(e.payload ?? "{}").goal_id === goal.id)).toBe(true);
  });

  it("shows the in-progress label when the current week is selected", async () => {
    const taskRepo = new TaskRepository();
    await taskRepo.createTask({
      id: crypto.randomUUID(),
      title: "Now task",
      estimated_minutes: 30,
      status: "planned",
      scheduled_date: todayLocal(),
    });
    render(<WeeklyReview />);
    // Navigate to the current week via the "Next week" button.
    const next = screen.getByLabelText("Next week");
    await waitFor(() => expect(next).toBeEnabled());
    next.click();
    await waitFor(() =>
      expect(screen.getByText(/week in progress/i)).toBeInTheDocument()
    );
  });
});
