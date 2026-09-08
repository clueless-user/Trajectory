import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "../repositories/database";
import { AreaRepository } from "../repositories/areaRepository";
import { useHierarchyStore } from "./useHierarchyStore";

describe("useHierarchyStore", () => {
  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    useHierarchyStore.setState({ areas: [], goals: [], projects: [], isLoading: false });
  });

  it("loadHierarchy populates areas, goals and projects", async () => {
    await useHierarchyStore.getState().loadHierarchy();
    const s = useHierarchyStore.getState();
    expect(s.areas).toHaveLength(4); // seeded
    expect(s.goals).toHaveLength(0);
    expect(s.projects).toHaveLength(0);
    expect(s.isLoading).toBe(false);
  });

  it("createArea persists and updates state", async () => {
    await useHierarchyStore.getState().createArea("Health");
    const s = useHierarchyStore.getState();
    expect(s.areas.some((a) => a.name === "Health")).toBe(true);
    // persisted via repo read
    const repos = new AreaRepository();
    expect((await repos.getAllAreas()).some((a) => a.name === "Health")).toBe(true);
  });

  it("updateArea renames without touching seeds", async () => {
    await useHierarchyStore.getState().createArea("Health");
    const area = useHierarchyStore.getState().areas.find((a) => a.name === "Health")!;
    await useHierarchyStore.getState().updateArea(area.id, "Health & Fitness");
    expect(useHierarchyStore.getState().areas.find((a) => a.id === area.id)?.name).toBe("Health & Fitness");
    expect(useHierarchyStore.getState().areas).toHaveLength(5);
  });

  it("deleteArea removes the area and its goals", async () => {
    const store = useHierarchyStore.getState();
    await store.createArea("Health");
    const area = useHierarchyStore.getState().areas.find((a) => a.name === "Health")!;
    await store.createGoal("Run Marathon", area.id);
    expect(useHierarchyStore.getState().goals).toHaveLength(1);

    await store.deleteArea(area.id);
    const s = useHierarchyStore.getState();
    expect(s.areas.some((a) => a.id === area.id)).toBe(false);
    expect(s.goals).toHaveLength(0);
  });

  it("createGoal / updateGoal / deleteGoal round-trip", async () => {
    const store = useHierarchyStore.getState();
    await store.createArea("Health");
    const area = useHierarchyStore.getState().areas.find((a) => a.name === "Health")!;
    const goal = await store.createGoal("Run Marathon", area.id);
    await store.updateGoal(goal.id, "Run a marathon");
    expect(useHierarchyStore.getState().goals[0].title).toBe("Run a marathon");
    await store.deleteGoal(goal.id);
    expect(useHierarchyStore.getState().goals).toHaveLength(0);
  });

  it("createProject links to goal and area; deleteProject prunes", async () => {
    const store = useHierarchyStore.getState();
    await store.createArea("Health");
    const area = useHierarchyStore.getState().areas.find((a) => a.name === "Health")!;
    const goal = await store.createGoal("Run Marathon", area.id);
    await store.createProject("Couch to 5k", { goalId: goal.id, areaId: area.id });
    const project = useHierarchyStore.getState().projects[0];
    expect(project.goal_id).toBe(goal.id);
    expect(project.area_id).toBe(area.id);

    await store.deleteProject(project.id);
    expect(useHierarchyStore.getState().projects).toHaveLength(0);
  });
});
