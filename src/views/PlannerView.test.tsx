import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createInMemoryDatabase, setDatabase, getDatabase } from "../repositories/database";
import { PlannerView } from "./PlannerView";
import { useTaskStore } from "../stores/useTaskStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useUIStore } from "../stores/useUIStore";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { todayLocal } from "../domain/time/date";

const taskRepo = new TaskRepository();
const eventLog = new EventLogRepository();
const today = todayLocal();

// jsdom has no DataTransfer — a stub is enough for React synthetic DnD events.
function makeDataTransfer(id?: string) {
  const store = new Map<string, string>(id ? [["text/plain", id]] : []);
  return {
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => void store.set(type, value),
    dropEffect: "none",
    effectAllowed: "none",
  };
}

function dragEvent(id?: string) {
  return { dataTransfer: makeDataTransfer(id) } as unknown as React.DragEvent;
}

describe("PlannerView drag & drop + delete", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    useTaskStore.setState({
      tasks: [],
      boardTasks: [],
      activeTaskId: null,
      isLoading: false,
    });
    useSessionStore.setState({ activeSession: null, interruptedSessions: [] });
    useUIStore.setState({
      activeView: "planner",
      isRabbitHoleModalOpen: false,
      isNewTaskModalOpen: false,
      isCompressionModalOpen: false,
      isCommandPaletteOpen: false,
    });
  });

  async function seedBoard() {
    await useTaskStore.getState().createTask({ title: "Card A", estimated_minutes: 30, scheduled_date: today });
    await useTaskStore.getState().createTask({ title: "Card B", estimated_minutes: 15 });
    await useTaskStore.getState().loadBoard();
  }

  function column(status: string): HTMLElement {
    // Column headers are unique per status; each column root is their common parent.
    const header = screen.getByText(status, { selector: "span", exact: false });
    return (header.closest("div") as HTMLElement).parentElement as HTMLElement;
  }

  it("dragStart → dragOver (no throw, allows drop) → drop moves the task status", async () => {
    await seedBoard();
    render(<PlannerView />);
    const card = screen.getByText("Card A").closest("div[draggable]") as HTMLElement;

    fireEvent.dragStart(card, dragEvent());
    const target = column("Completed");
    expect(() => fireEvent.dragOver(target, dragEvent())).not.toThrow();
    const cardAId = (await taskRepo.getAllTasks()).find((t) => t.title === "Card A")!.id;
    fireEvent.drop(target, dragEvent(cardAId));

    await act(async () => {});
    const stored = (await taskRepo.getAllTasks()).find((t) => t.title === "Card A");
    expect(stored?.status).toBe("completed");
  });

  it("drop into Planned schedules an unscheduled task for today (G-37 regression)", async () => {
    await seedBoard();
    render(<PlannerView />);
    const card = screen.getByText("Card B").closest("div[draggable]") as HTMLElement;
    fireEvent.dragStart(card, dragEvent());
    const unscheduled = (await taskRepo.getAllTasks()).find((t) => t.title === "Card B")!;
    expect(unscheduled.scheduled_date).toBeNull();

    fireEvent.drop(column("Planned"), dragEvent(unscheduled.id));
    await act(async () => {});

    const stored = (await taskRepo.getAllTasks()).find((t) => t.title === "Card B");
    expect(stored?.status).toBe("planned");
    expect(stored?.scheduled_date).toBe(today);
  });

  it("drop without a payload or with an unknown id is a no-op", async () => {
    await seedBoard();
    render(<PlannerView />);
    fireEvent.drop(column("Completed"), dragEvent());
    fireEvent.drop(column("Completed"), dragEvent("not-a-real-id"));
    await act(async () => {});
    const all = await taskRepo.getAllTasks();
    expect(all.filter((t) => t.status === "completed")).toHaveLength(0);
  });

  it("two-step delete confirm soft-deletes the task", async () => {
    await seedBoard();
    render(<PlannerView />);
    const card = screen.getByText("Card A").closest("div.group") as HTMLElement;
    const deleteBtn = screen.getAllByTitle("Delete task").find((b) =>
      (b.closest("div.group") as HTMLElement).textContent!.includes("Card A")
    )!;

    // First click arms ("Delete?"), nothing is deleted yet.
    fireEvent.click(deleteBtn);
    expect(screen.getAllByText("Delete?").length).toBe(1);
    expect((await taskRepo.getAllTasks()).some((t) => t.title === "Card A")).toBe(true);

    // Second click executes: deleted_at set, card gone from the board, repo
    // excludes it.
    fireEvent.click(deleteBtn);
    await act(async () => {});
    const all = await taskRepo.getAllTasks();
    expect(all.some((t) => t.title === "Card A")).toBe(false);
    expect(screen.queryByText("Card A")).not.toBeInTheDocument();

    // Event row exists.
    const events = await eventLog.getByType("task.deleted");
    expect(events.some((e) => JSON.parse(e.payload ?? "{}").title === "Card A")).toBe(true);

    // Soft-deleted row still exists with deleted_at (not hard-deleted).
    const raw = await getDatabase().select<{ deleted_at: string | null }>(
      "SELECT deleted_at FROM tasks WHERE title = 'Card A';"
    );
    expect(raw).toHaveLength(1);
    expect(raw[0].deleted_at).not.toBeNull();
    void card;
  });

  it("armed delete reverts when the confirm window passes", async () => {
    vi.useFakeTimers();
    try {
      await seedBoard();
      render(<PlannerView />);
      const deleteBtn = screen.getAllByTitle("Delete task")[0];
      fireEvent.click(deleteBtn);
      expect(screen.getAllByText("Delete?").length).toBe(1);
      act(() => {
        vi.advanceTimersByTime(3500);
      });
      expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
      // Still deletable after revert.
      fireEvent.click(deleteBtn);
      fireEvent.click(deleteBtn);
      await act(async () => {});
      expect((await taskRepo.getAllTasks()).filter((t) => t.title === "Card B" || t.title === "Card A").length).toBeLessThan(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("delete is blocked for the task owning the live session", async () => {
    await seedBoard();
    const cardATask = (await taskRepo.getAllTasks()).find((t) => t.title === "Card A")!;
    render(<PlannerView />);
    // Live session on Card A → its delete button is disabled with the tooltip.
    await act(async () => {
      useSessionStore.setState({
        activeSession: {
        sessionId: "s-live",
        taskId: cardATask.id,
        taskTitle: "Card A",
        startTime: new Date().toISOString(),
        accumulatedSeconds: 0,
        runningSinceMs: Date.now(),
        elapsedSeconds: 0,
        isRunning: true,
        interruptionCount: 0,
        notes: "",
      },
    });
    });

    const deleteBtn = screen
      .getAllByTitle("Finish the session before deleting")
      .find((b) => (b.closest("div.group") as HTMLElement).textContent!.includes("Card A"))! as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);

    // Store-level guard too (defence in depth).
    const result = await useTaskStore.getState().deleteTask(cardATask.id);
    expect(result).toEqual({ ok: false, reason: "active-session" });
    expect((await taskRepo.getAllTasks()).some((t) => t.id === cardATask.id)).toBe(true);
  });
});
