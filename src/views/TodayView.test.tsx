import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayView } from "./TodayView";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { useTaskStore } from "../stores/useTaskStore";
import { useHabitStore } from "../stores/useHabitStore";

describe("TodayView Component", () => {
  beforeEach(async () => {
    const db = await createInMemoryDatabase();
    setDatabase(db);
    const today = "2026-09-03";
    await useTaskStore.getState().loadTodayTasks(today);
    await useHabitStore.getState().loadHabitsAndTodayLogs(today);
  });

  it("renders primary objective and execution surface", async () => {
    render(<TodayView />);

    expect(screen.getByText("Primary Objective For Today")).toBeInTheDocument();
    expect(screen.getByText("Daily Workload")).toBeInTheDocument();
    expect(screen.getByText("Current State")).toBeInTheDocument();
    expect(screen.getByText("Habit Trajectory")).toBeInTheDocument();
  });
});
