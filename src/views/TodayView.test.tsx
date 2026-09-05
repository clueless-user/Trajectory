import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TodayView } from "./TodayView";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { useTaskStore } from "../stores/useTaskStore";
import { useHabitStore } from "../stores/useHabitStore";
import { useStateStore } from "../stores/useStateStore";
import { useUIStore } from "../stores/useUIStore";
import { useSessionStore } from "../stores/useSessionStore";

// The view computes "today" from the real clock, so tests must load the
// stores with the same real date to exercise meaningful behavior.
const today = new Date().toISOString().split("T")[0];

interface SeedTask {
  title: string;
  importance: "critical" | "important" | "optional";
  estimated_minutes: number;
}

describe("TodayView Component", () => {
  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
    useTaskStore.setState({ tasks: [], activeTaskId: null, isLoading: false });
    useSessionStore.setState({ activeSession: null });
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
    expect(screen.getByText("Fix kernel panic")).toBeInTheDocument();
    expect(screen.getByText("Write release notes")).toBeInTheDocument();
    expect(screen.getByText("Sort bookmarks")).toBeInTheDocument();
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
    expect(screen.getByText("Enter Deep Work")).toBeInTheDocument();
    expect(screen.getByText("Fix kernel panic")).toBeInTheDocument();
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

    // The TaskItemCard's completion control is the first (circular) button.
    const card = screen.getByText("Write release notes").closest("div.group")!;
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
    expect(screen.getByText("Deferrable filler")).toBeInTheDocument();

    await useTaskStore.getState().compressPlan(today);

    // The deferred task leaves the plan; the critical anchor remains.
    expect(screen.queryByText("Deferrable filler")).not.toBeInTheDocument();
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

  it("opens the new-task surface from the Add Task control", async () => {
    await loadTasksWith([]);
    render(<TodayView />);

    fireEvent.click(screen.getByText("Add Task"));

    expect(useUIStore.getState().isNewTaskModalOpen).toBe(true);
  });
});
