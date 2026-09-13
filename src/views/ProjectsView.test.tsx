import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { ProjectsView } from "./ProjectsView";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { useHierarchyStore } from "../stores/useHierarchyStore";
import { useTaskStore } from "../stores/useTaskStore";
import { readFileSync } from "fs";

// Static architecture guard: the view must not touch the database directly.
const viewSource = readFileSync("src/views/ProjectsView.tsx", "utf-8");
describe("ProjectsView architecture guard", () => {
  it("imports no database access (repository pattern)", () => {
    expect(viewSource.includes("getDatabase")).toBe(false);
    expect(/SELECT |INSERT INTO|UPDATE tasks|DELETE FROM/.test(viewSource)).toBe(false);
    expect(viewSource.includes("useHierarchyStore")).toBe(true);
  });
});

describe("ProjectsView CRUD", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    useHierarchyStore.setState({ areas: [], goals: [], projects: [], isLoading: false });
    useTaskStore.setState({ tasks: [], boardTasks: [], activeTaskId: null, isLoading: false });
  });

  async function openView() {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getAllByText(/Life Areas/).length).toBeGreaterThan(0));
    await act(async () => {});
  }

  it("renders the seeded areas and the empty-goal state", async () => {
    await openView();
    expect(screen.getAllByText("AI & Engineering").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No goals yet — add one below").length).toBeGreaterThan(0);
    expect(screen.getByText(/Goals/)).toBeInTheDocument();
  });

  it("Add Area flow creates a persistent area", async () => {
    await openView();
    fireEvent.click(screen.getByText("Add Area"));
    const input = screen.getByPlaceholderText(/New life area/);
    fireEvent.change(input, { target: { value: "Health" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});
    expect(screen.getAllByText("Health").length).toBeGreaterThan(0);
  });

  it("Add Goal flow nests a goal under an area", async () => {
    await openView();
    // Add an area first.
    fireEvent.click(screen.getByText("Add Area"));
    let input = screen.getByPlaceholderText(/New life area/);
    fireEvent.change(input, { target: { value: "Health" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    // Add a goal inside it.
    const goalButtons = screen.getAllByText("Goal");
    fireEvent.click(goalButtons[goalButtons.length - 1]);
    input = screen.getByPlaceholderText(/New goal/);
    fireEvent.change(input, { target: { value: "Run Marathon" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    expect(screen.getAllByText("Run Marathon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No projects yet").length).toBeGreaterThan(0);
  });

  it("Add Project flow attaches a project to a goal", async () => {
    await openView();
    fireEvent.click(screen.getByText("Add Area"));
    let input = screen.getByPlaceholderText(/New life area/);
    fireEvent.change(input, { target: { value: "Health" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    fireEvent.click(screen.getAllByText("Goal")[0]);
    input = screen.getByPlaceholderText(/New goal/);
    fireEvent.change(input, { target: { value: "Run Marathon" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    const projectButtons = screen.getAllByText("Project");
    fireEvent.click(projectButtons[0]);
    input = screen.getByPlaceholderText("New project…");
    fireEvent.change(input, { target: { value: "Couch to 5k" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    expect(screen.getAllByText("Couch to 5k").length).toBeGreaterThan(0);
  });

  it("two-step delete removes a goal", async () => {
    await openView();
    fireEvent.click(screen.getByText("Add Area"));
    let input = screen.getByPlaceholderText(/New life area/);
    fireEvent.change(input, { target: { value: "Health" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    fireEvent.click(screen.getAllByText("Goal")[0]);
    input = screen.getByPlaceholderText(/New goal/);
    fireEvent.change(input, { target: { value: "Run Marathon" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await act(async () => {});

    // Hover-revealed delete button (title attribute; present even at opacity 0).
    const deleteBtn = screen.getByTitle("Delete goal");
    fireEvent.click(deleteBtn); // arm
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    fireEvent.click(deleteBtn); // execute
    await act(async () => {});
    expect(screen.queryByText("Run Marathon")).not.toBeInTheDocument();
  });
});
