import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TodayView } from "./TodayView";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { useTaskStore } from "../stores/useTaskStore";
import { useHabitStore } from "../stores/useHabitStore";
import { useStateStore } from "../stores/useStateStore";
import { useUIStore } from "../stores/useUIStore";
import { useSessionStore, setNowForTesting } from "../stores/useSessionStore";
import { todayLocal } from "../domain/time/date";
import { WorkSessionRepository } from "../repositories/workSessionRepository";

const sessionRepo = new WorkSessionRepository();

// The view computes "today" from the real clock, so tests must load the
// stores with the same real date to exercise meaningful behavior.
const today = todayLocal();

interface SeedTask {
  title: string;
  importance: "critical" | "important" | "optional";
  estimated_minutes: number;
}

describe("TodayView Component", () => {
  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
    setNowForTesting(() => new Date()); // real clock; sessions tick from now
    useTaskStore.setState({ tasks: [], activeTaskId: null, isLoading: false });
    useSessionStore.setState({ activeSession: null, interruptedSessions: [] });
    useUIStore.setState({
      activeView: "today",
      isRabbitHoleModalOpen: false,
      isNewTaskModalOpen: false,
      isCompressionModalOpen: false,
      isCommandPaletteOpen: false,
    });
    await useHabitStore.getState().loadHabitsAndTodayLogs(today);
    await useStateStore.getState().loadTodayState(today);
  });

  async function loadTasksWith(tasks: SeedTask[]) {
    const store = useTaskStore.getState();
    await store.setPrimaryObjective("Ship the compression engine", today);
    store.setAvailableMinutes(480, today);
    for (const t of tasks) {
      await store.createTask({
        title: t.title,
        importance: t.importance,
        estimated_minutes: t.estimated_minutes,
        scheduled_date: today,
      });
    }
  }

  it("renders the local date banner and objective empty-state placeholder", async () => {
    render(<TodayView />);
    // Banner shows "<weekday> · <local date>" (never a bare "Date" placeholder).
    const weekday = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
    });
    expect(screen.getByText(new RegExp(`^${weekday} · ${today}$`))).toBeInTheDocument();
    // No objective set → muted click-to-set placeholder (V-6 literal).
    expect(screen.getByText("Click to set today's primary objective")).toBeInTheDocument();
  });

  it("renders the primary objective and the three execution sections", async () => {
    await loadTasksWith([
      { title: "Fix kernel panic", importance: "critical", estimated_minutes: 60 },
      { title: "Write release notes", importance: "important", estimated_minutes: 30 },
      { title: "Sort bookmarks", importance: "optional", estimated_minutes: 15 },
    ]);
    // createTask auto-selects the first task as active; clear it so every
    // task renders in its importance section rather than the NOW cockpit.
    useTaskStore.getState().setActiveTask(null);

    render(<TodayView />);

    expect(screen.getByText("Ship the compression engine")).toBeInTheDocument();
    expect(screen.getByText("Must-Do — Critical Leverage (1)")).toBeInTheDocument();
    expect(screen.getByText("Should-Do — High Leverage (1)")).toBeInTheDocument();
    expect(screen.getByText("Optional — If Capacity Permits (1)")).toBeInTheDocument();
    // NEXT surfaces the top planned task; plan sections stay complete.
    expect(screen.getByText("Up Next")).toBeInTheDocument();
    expect(screen.getAllByText("Fix kernel panic").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Write release notes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sort bookmarks").length).toBeGreaterThanOrEqual(1);
  });

  it("highlights the active task in the NOW cockpit with a deep-work entry point", async () => {
    await loadTasksWith([
      { title: "Fix kernel panic", importance: "critical", estimated_minutes: 60 },
      { title: "Write release notes", importance: "important", estimated_minutes: 30 },
    ]);
    const critical = useTaskStore.getState().tasks.find((t) => t.title === "Fix kernel panic")!;
    useTaskStore.getState().setActiveTask(critical.id);

    render(<TodayView />);

    expect(screen.getByText("NOW — Active Focus")).toBeInTheDocument();
    // The cockpit's primary action starts execution inline (Start appears in
    // the cockpit, NEXT, and task rows).
    expect(screen.getAllByRole("button", { name: /Start/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fix kernel panic").length).toBeGreaterThanOrEqual(1);
  });

  it("moves a task to Completed when its completion control is pressed", async () => {
    await loadTasksWith([
      { title: "Write release notes", importance: "important", estimated_minutes: 30 },
    ]);
    // Deactivate so the task renders as a TaskItemCard with a circle control
    // instead of the NOW cockpit's Complete button.
    useTaskStore.getState().setActiveTask(null);

    render(<TodayView />);
    expect(screen.queryByText("Completed Today (1)")).not.toBeInTheDocument();

    // The TaskItemCard's completion control is the first (circular) button;
    // pick the match inside a task card (the NEXT pointer card has no .group).
    const card = screen
      .getAllByText("Write release notes")
      .map((el) => el.closest("div.group"))
      .find((el): el is HTMLElement => !!el)!;
    fireEvent.click(card.querySelector("button")!);

    await waitFor(() => {
      expect(useTaskStore.getState().tasks[0].status).toBe("completed");
    });
    expect(screen.getByText("Completed Today (1)")).toBeInTheDocument();
  });

  it("reports workload overload against the available capacity", async () => {
    await loadTasksWith([
      { title: "Big block A", importance: "important", estimated_minutes: 300 },
      { title: "Big block B", importance: "important", estimated_minutes: 240 },
    ]);

    render(<TodayView />);

    // 540 committed of 480 available = 113%.
    expect(screen.getByText("113% CAPACITY")).toBeInTheDocument();
    expect(screen.getByText("540m / 480m")).toBeInTheDocument();
    expect(screen.getByText("Overloaded by 1h 0m.")).toBeInTheDocument();
  });

  it("hides deferred tasks from the plan after compression is applied", async () => {
    await loadTasksWith([
      { title: "Critical anchor", importance: "critical", estimated_minutes: 60 },
      { title: "Deferrable filler", importance: "optional", estimated_minutes: 240 },
    ]);
    useTaskStore.getState().setAvailableMinutes(60, today);

    render(<TodayView />);
    expect(screen.getAllByText("Deferrable filler").length).toBeGreaterThanOrEqual(1);

    await useTaskStore.getState().compressPlan(today);

    // The deferred task leaves the plan (and NEXT); the critical anchor remains.
    expect(screen.queryAllByText("Deferrable filler").length).toBe(0);
    expect(screen.getByText("Critical anchor")).toBeInTheDocument();
    const deferred = useTaskStore.getState().tasks.find((t) => t.title === "Deferrable filler");
    expect(deferred?.status).toBe("deferred"); // still in the database, recoverable
  });

  it("persists habit quick-log steppers to today's log", async () => {
    await loadTasksWith([]);
    const habit = useHabitStore.getState().habits[0];

    render(<TodayView />);
    expect(screen.getByText("Habit Trajectory")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("+")[0]);

    await waitFor(() => {
      expect(useHabitStore.getState().todayLogs[habit.id]?.value).toBe(15);
    });
  });

  it("reflects the daily state metric set through the store", async () => {
    await loadTasksWith([]);
    await useStateStore.getState().updateMetric(today, "energy", 9);

    render(<TodayView />);
    expect(screen.getByText("Current State")).toBeInTheDocument();
    expect(screen.getByText("9/10")).toBeInTheDocument();
  });

  it("starts execution inline from the cockpit without navigating", async () => {
    await loadTasksWith([
      { title: "Inline work", importance: "important", estimated_minutes: 60 },
    ]);
    useTaskStore.getState().setActiveTask(null); // cockpit idle
    render(<TodayView />);

    const startButtons = screen.getAllByRole("button", { name: /Start/ });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(useSessionStore.getState().activeSession?.taskTitle).toBe("Inline work");
    });
    expect(useSessionStore.getState().activeSession?.isRunning).toBe(true);
    expect(useUIStore.getState().activeView).toBe("today"); // no navigation
    expect(await sessionRepo.getRecentSessions(10)).toHaveLength(1); // crash-safe row
  });

  it("defers the active task while its session is running, settling the session first", async () => {
    await loadTasksWith([
      { title: "Deferred mid-flight", importance: "important", estimated_minutes: 60 },
    ]);
    render(<TodayView />);

    fireEvent.click(screen.getAllByRole("button", { name: /Start/ })[0]);
    await waitFor(() => expect(useSessionStore.getState().activeSession).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Defer" }));
    await waitFor(() => {
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    const task = useTaskStore.getState().tasks[0];
    expect(task.status).toBe("deferred");
    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows).toHaveLength(1);
    expect(rows[0].completed_state).toBe("finished"); // truthful, not orphaned
  });

  it("completes the active task from the cockpit while running (session settles as finished)", async () => {
    await loadTasksWith([
      { title: "Finish me running", importance: "important", estimated_minutes: 30 },
    ]);
    render(<TodayView />);

    fireEvent.click(screen.getAllByRole("button", { name: /Start/ })[0]);
    await waitFor(() => expect(useSessionStore.getState().activeSession).not.toBeNull());

    fireEvent.click(screen.getAllByRole("button", { name: /Complete/ })[0]);
    await waitFor(() => expect(useSessionStore.getState().activeSession).toBeNull());

    const task = useTaskStore.getState().tasks[0];
    expect(task.status).toBe("completed");
    const rows = await sessionRepo.getRecentSessions(10);
    expect(rows[0].completed_state).toBe("finished");
  });

  it("offers quick capture that files an Inbox task without classification", async () => {
    await loadTasksWith([]);
    render(<TodayView />);

    const input = screen.getByPlaceholderText(/Quick capture/);
    fireEvent.change(input, { target: { value: "Email prof about the benchmark" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      const created = useTaskStore
        .getState()
        .boardTasks.find((t) => t.title === "Email prof about the benchmark");
      // createTask without scheduled_date lands in the Inbox; loadBoard not
      // called here, so assert through the today-store tasks array instead.
      const inTasks = useTaskStore.getState().tasks.find(
        (t) => t.title === "Email prof about the benchmark"
      );
      expect(created?.status ?? inTasks?.status).toBe("inbox");
    });
  });

  it("resumes an interrupted session from the recovery banner", async () => {
    await loadTasksWith([
      { title: "Interrupted work", importance: "important", estimated_minutes: 60 },
    ]);
    // Simulate the crash tombstone left by a previous run.
    const task = useTaskStore.getState().tasks[0];
    await sessionRepo.createSession({
      task_id: task.id,
      start_time: "2026-09-05T08:00:00.000Z",
      end_time: "2026-09-05T08:00:00.000Z",
      duration_seconds: 0,
      interruption_count: 0,
      completed_state: "paused",
      notes: null,
    });
    await useSessionStore.getState().loadInterruptedSessions();

    render(<TodayView />);
    expect(screen.getByText(/Were you working on something/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => {
      expect(useSessionStore.getState().activeSession?.sessionId).toBeTruthy();
    });
    expect(useSessionStore.getState().activeSession?.taskTitle).toBe("Interrupted work");
    expect(screen.queryByText(/Were you working on something/)).not.toBeInTheDocument();
  });

  it("opens the new-task surface from the Add Task control", async () => {
    await loadTasksWith([]);
    render(<TodayView />);

    fireEvent.click(screen.getByText("Add Task"));

    expect(useUIStore.getState().isNewTaskModalOpen).toBe(true);
  });
});
