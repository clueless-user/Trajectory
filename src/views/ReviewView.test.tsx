import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { ReviewView } from "./ReviewView";
import { useTaskStore } from "../stores/useTaskStore";
import { useReviewStore } from "../stores/useReviewStore";
import { RabbitHoleRepository } from "../repositories/rabbitHoleRepository";
import { TaskRepository } from "../repositories/taskRepository";
import { ReviewRepository } from "../repositories/reviewRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { todayLocal } from "../domain/time/date";

const rabbitHoleRepo = new RabbitHoleRepository();
const taskRepo = new TaskRepository();
const reviewRepo = new ReviewRepository();
const eventLog = new EventLogRepository();

describe("ReviewView — capture backlog and review retrieval", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    useTaskStore.setState({ tasks: [], boardTasks: [], activeTaskId: null });
  });

  it("lists open rabbit holes with provenance and converts one into an inbox task", async () => {
    const provenanceTask = await taskRepo.createTask({
      title: "Profiling pass",
      scheduled_date: todayLocal(),
    });
    const hole = await rabbitHoleRepo.createRabbitHole({
      raw_text: "Benchmark WAL checkpoint frequency",
      active_task_id: provenanceTask.id,
    });

    render(<ReviewView />);

    await waitFor(() => {
      expect(screen.getByText(/Benchmark WAL checkpoint frequency/)).toBeInTheDocument();
    });
    expect(screen.getByText(/during: Profiling pass/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("To Task"));

    await waitFor(() => {
      expect(screen.getByText(/Capture Backlog — Open Rabbit Holes \(0\)/)).toBeInTheDocument();
    });

    // The converted task landed in the Inbox (not scheduled for today).
    const tasks = await taskRepo.getAllTasks();
    const converted = tasks.find((t) => t.title === "Benchmark WAL checkpoint frequency");
    expect(converted?.status).toBe("inbox");
    expect(converted?.scheduled_date).toBeNull();

    // The original capture is preserved with its conversion link.
    const all = await rabbitHoleRepo.getAllRabbitHoles();
    const record = all.find((r) => r.id === hole.id)!;
    expect(record.status).toBe("converted_task");
    expect(record.converted_id).toBe(converted!.id);
    expect(record.raw_text).toBe("Benchmark WAL checkpoint frequency");

    // Instrumentation recorded both lifecycle events.
    const holeEvents = await eventLog.getByEntity(hole.id);
    expect(holeEvents.map((e) => e.event_type)).toEqual([
      "rabbit_hole.captured",
      "rabbit_hole.converted_task",
    ]);
  });

  it("dismisses a rabbit hole by archiving without deleting it", async () => {
    const hole = await rabbitHoleRepo.createRabbitHole({ raw_text: "Dead-end curiosity" });

    render(<ReviewView />);
    await waitFor(() => screen.getByText(/Dead-end curiosity/));

    fireEvent.click(screen.getByText("Dismiss"));

    await waitFor(() => {
      expect(screen.getByText(/Open Rabbit Holes \(0\)/)).toBeInTheDocument();
    });

    const all = await rabbitHoleRepo.getAllRabbitHoles();
    expect(all.find((r) => r.id === hole.id)?.status).toBe("archived");
  });

  it("prefills the form from a saved review and re-saves as an upsert", async () => {
    await reviewRepo.saveDailyReview({
      date: todayLocal(),
      completed_task_count: 2,
      total_work_minutes: 90,
      energy_drains: "Context switching",
      energy_boosts: "Long uninterrupted block",
      tomorrow_objective: "Ship the eviction benchmark",
      reflection_notes: "Good day overall",
    });

    render(<ReviewView />);

    await waitFor(() => {
      expect((screen.getByDisplayValue("Context switching") as HTMLInputElement).value).toBe(
        "Context switching"
      );
    });
    expect(screen.getByDisplayValue("Ship the eviction benchmark")).toBeInTheDocument();

    // Editing and re-saving upserts the same date row.
    const objectiveInput = screen.getByDisplayValue("Ship the eviction benchmark");
    fireEvent.change(objectiveInput, { target: { value: "Ship the eviction benchmark v2" } });
    fireEvent.click(screen.getByText("Complete Shutdown (90s)"));

    await waitFor(() => {
      expect(screen.getByText("Shutdown Recorded — Rest Well")).toBeInTheDocument();
    });

    const saved = await reviewRepo.getDailyReview(todayLocal());
    expect(saved?.tomorrow_objective).toBe("Ship the eviction benchmark v2");
    const rows = await reviewRepo.getRecentReviews(10);
    expect(rows.filter((r) => r.date === todayLocal()).length).toBe(1);
  });

  it("shows recent reflections from previous days", async () => {
    await reviewRepo.saveDailyReview({
      date: "2026-01-15",
      completed_task_count: 3,
      total_work_minutes: 140,
      tomorrow_objective: "Historical objective",
    });

    render(<ReviewView />);

    await waitFor(() => {
      expect(screen.getByText(/Historical objective/)).toBeInTheDocument();
    });
    expect(screen.getByText("2026-01-15")).toBeInTheDocument();
  });

  it("keeps the review store hydrated after saving", async () => {
    render(<ReviewView />);
    await waitFor(() => screen.getByText("Complete Shutdown (90s)"));

    fireEvent.change(screen.getByPlaceholderText(/Complete KV Cache/), {
      target: { value: "Tomorrow's focus" },
    });
    fireEvent.click(screen.getByText("Complete Shutdown (90s)"));

    await waitFor(() => {
      expect(useReviewStore.getState().todayReview?.tomorrow_objective).toBe("Tomorrow's focus");
    });
    expect(useReviewStore.getState().recentReviews.length).toBeGreaterThan(0);
  });
});
