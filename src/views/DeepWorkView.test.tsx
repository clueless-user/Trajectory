import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeepWorkView } from "./DeepWorkView";
import { useSessionStore } from "../stores/useSessionStore";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { Task } from "../domain/models/types";

describe("DeepWorkView Component", () => {
  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
  });

  it("renders empty state when no session is active", () => {
    useSessionStore.setState({ activeSession: null });
    render(<DeepWorkView />);
    expect(screen.getByText("No Active Deep Work Session")).toBeInTheDocument();
  });

  it("renders active session timer and responds to pause/resume", () => {
    const task: Task = {
      id: crypto.randomUUID(),
      title: "Optimize KV Cache Benchmark",
      importance: "critical",
      cognitive_demand: "deep",
      status: "in_progress",
      estimated_minutes: 60,
      actual_minutes: 0,
      scheduled_date: "2026-09-03",
      due_date: null,
      completed_at: null,
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      project_id: null,
      description: null,
    };

    useSessionStore.getState().startSession(task);
    render(<DeepWorkView />);

    expect(screen.getByText("Optimize KV Cache Benchmark")).toBeInTheDocument();
    expect(screen.getByText("Pause Session")).toBeInTheDocument();

    // Pause session
    fireEvent.click(screen.getByText("Pause Session"));
    expect(screen.getByText("Resume Session")).toBeInTheDocument();

    // Log interruption button is visible
    expect(screen.getByText("+ Log Interruption")).toBeInTheDocument();
  });
});
