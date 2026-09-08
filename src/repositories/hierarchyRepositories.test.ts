import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryDatabase, setDatabase } from "./database";
import { AreaRepository } from "./areaRepository";
import { GoalRepository } from "./goalRepository";
import { ProjectRepository } from "./projectRepository";

describe("hierarchy repositories (Area/Goal/Project CRUD)", () => {
  let areas: AreaRepository;
  let goals: GoalRepository;
  let projects: ProjectRepository;

  beforeEach(async () => {
    setDatabase(await createInMemoryDatabase());
    areas = new AreaRepository();
    goals = new GoalRepository();
    projects = new ProjectRepository();
  });

  it("getAllAreas returns the four seeded areas with fixed UUIDs (G-06)", async () => {
    const all = await areas.getAllAreas();
    expect(all).toHaveLength(4);
    expect(all[0].id).toMatch(/^11111111/);
    expect(all.every((a) => a.name.length > 0)).toBe(true);
  });

  it("creates, updates and deletes an area without touching the seeds", async () => {
    const created = await areas.createArea({ name: "Health" });
    expect(created.id).not.toMatch(/^11111111/); // fresh UUID for user areas
    expect(created.color).toBe("#3b82f6");

    await areas.updateArea(created.id, { name: "Health & Fitness" });
    const updated = await areas.getArea(created.id);
    expect(updated?.name).toBe("Health & Fitness");

    await areas.deleteArea(created.id);
    expect(await areas.getArea(created.id)).toBeNull();
    // Seeds untouched.
    expect(await areas.getAllAreas()).toHaveLength(4);
  });

  it("creates goals under an area and lists them by area", async () => {
    const area = (await areas.getAllAreas())[0];
    const goal = await goals.createGoal({ title: "Run Marathon", area_id: area.id });
    await goals.createGoal({ title: "Orphan goal" }); // area-less is legal

    const byArea = await goals.getGoalsByArea(area.id);
    expect(byArea.map((g) => g.title)).toContain("Run Marathon");
    expect(byArea.every((g) => g.area_id === area.id)).toBe(true);
    expect((await goals.getAllGoals()).length).toBe(2);
    expect(goal.status).toBe("active");
  });

  it("updates and deletes goals", async () => {
    const goal = await goals.createGoal({ title: "Draft" });
    await goals.updateGoal(goal.id, { title: "Run Marathon", description: "42.195 km" });
    const all = await goals.getAllGoals();
    expect(all[0].title).toBe("Run Marathon");
    expect(all[0].description).toBe("42.195 km");

    await goals.deleteGoal(goal.id);
    expect(await goals.getAllGoals()).toHaveLength(0);
  });

  it("creates projects under a goal, under an area, or standalone", async () => {
    const area = (await areas.getAllAreas())[0];
    const goal = await goals.createGoal({ title: "Run Marathon", area_id: area.id });

    const underGoal = await projects.createProject({ title: "Couch to 5k", goal_id: goal.id, area_id: area.id });
    const underArea = await projects.createProject({ title: "Meal planning", area_id: area.id });
    const standalone = await projects.createProject({ title: "Side quest" });

    expect(underGoal.goal_id).toBe(goal.id);
    expect(underArea.goal_id).toBeNull();
    expect(underArea.area_id).toBe(area.id);
    expect(standalone.area_id).toBeNull();
    expect(standalone.goal_id).toBeNull();
    expect(underGoal.status).toBe("active");
  });

  it("updates and deletes projects", async () => {
    const project = await projects.createProject({ title: "Draft" });
    await projects.updateProject(project.id, { title: "Couch to 5k", description: "Week 1" });
    expect((await projects.getProjects())[0].title).toBe("Couch to 5k");

    await projects.deleteProject(project.id);
    expect(await projects.getProjects()).toHaveLength(0);
  });

  it("deleting an area does not delete its goals (schema: ON DELETE SET NULL or orphan)", async () => {
    const area = await areas.createArea({ name: "Temporary" });
    const goal = await goals.createGoal({ title: "Temp goal", area_id: area.id });
    await areas.deleteArea(area.id);

    // The goal is NOT cascaded away — the store layer owns explicit cleanup.
    const all = await goals.getAllGoals();
    expect(all.some((g) => g.id === goal.id)).toBe(true);
    // Its area_id is either nulled (FK enforced) or dangling (pragma off) —
    // both acceptable; the store never relies on the dangling reference.
  });

  it("rejects records that violate the Zod schema on read", async () => {
    const db = (await import("./database")).getDatabase();
    // Insert a row that cannot pass AreaSchema (empty name).
    await db.execute(
      "INSERT INTO areas (id, name, color, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
      [crypto.randomUUID(), "", "#3b82f6", 0, new Date().toISOString(), new Date().toISOString()]
    );
    await expect(areas.getAllAreas()).rejects.toThrow(/failed schema validation/);
  });
});
