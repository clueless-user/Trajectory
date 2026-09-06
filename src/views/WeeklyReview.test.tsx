import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
