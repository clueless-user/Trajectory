import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { NewTaskModal } from "./NewTaskModal";
import { useUIStore } from "../stores/useUIStore";
import { useHierarchyStore } from "../stores/useHierarchyStore";
import { useTaskStore } from "../stores/useTaskStore";
import { AreaRepository } from "../repositories/areaRepository";
import { GoalRepository } from "../repositories/goalRepository";
import { ProjectRepository } from "../repositories/projectRepository";
import { TaskRepository } from "../repositories/taskRepository";

const taskRepo = new TaskRepository();

describe("NewTaskModal external draft (goal.card prefill)", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    useUIStore.setState({
      isNewTaskModalOpen: false,
      isRabbitHoleModalOpen: false,
      isCompressionModalOpen: false,
      isCommandPaletteOpen: false,
      editingTaskId: null,
      taskDraft: null,
    });
    useTaskStore.setState({ tasks: [], boardTasks: [], activeTaskId: null, isLoading: false });
  });

  async function seedProject() {
    await new AreaRepository().createArea({ name: "Health" });
    const area = (await new AreaRepository().getAllAreas()).find((a) => a.name === "Health")!;
    await new GoalRepository().createGoal({ title: "Run Marathon", area_id: area.id });
    const goal = (await new GoalRepository().getAllGoals())[0];
    const project = await new ProjectRepository().createProject({
      title: "Couch to 5k",
      goal_id: goal.id,
      area_id: area.id,
    });
    await useHierarchyStore.getState().loadHierarchy();
    return project;
  }

  it("draft prefills project + scheduled-today on open", async () => {
    const project = await seedProject();
    useUIStore.getState().setTaskDraft({ project_id: project.id, scheduledToday: true });
    useUIStore.getState().setNewTaskModalOpen(true);

    render(<NewTaskModal />);
    const select = screen.getByLabelText("Project (optional)") as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(project.id));
    expect((screen.getByLabelText("Schedule for Today") as HTMLInputElement).checked).toBe(true);
  });

  it("draft is consumed on open — a second open has no stale prefill", async () => {
    const project = await seedProject();
    useUIStore.getState().setTaskDraft({ project_id: project.id, scheduledToday: true });
    useUIStore.getState().setNewTaskModalOpen(true);
    render(<NewTaskModal />);
    await waitFor(() => {
      expect((screen.getByLabelText("Project (optional)") as HTMLSelectElement).value).toBe(project.id);
    });

    // Close → draft cleared; reopen → clean create branch.
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(useUIStore.getState().taskDraft).toBeNull());
    useUIStore.getState().setNewTaskModalOpen(true);
    await waitFor(() => {
      expect((screen.getByLabelText("Project (optional)") as HTMLSelectElement).value).toBe("");
    });
  });

  it("submit consumes the draft and the created task links the project", async () => {
    const project = await seedProject();
    useUIStore.getState().setTaskDraft({ project_id: project.id, scheduledToday: true });
    useUIStore.getState().setNewTaskModalOpen(true);
    render(<NewTaskModal />);

    const input = screen.getByPlaceholderText(/Implement KV cache/);
    fireEvent.change(input, { target: { value: "Week 1 runs" } });
    fireEvent.click(screen.getByText("Create Task"));

    await waitFor(() => expect(useUIStore.getState().taskDraft).toBeNull());
    const task = (await taskRepo.getAllTasks()).find((t) => t.title === "Week 1 runs");
    expect(task?.project_id).toBe(project.id);
    expect(task?.scheduled_date).toBeTruthy(); // scheduled today via draft
  });
});
