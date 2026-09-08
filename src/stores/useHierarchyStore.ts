import { create } from "zustand";
import { Area, Goal, Project } from "../domain/models/types";
import { AreaRepository } from "../repositories/areaRepository";
import { GoalRepository } from "../repositories/goalRepository";
import { ProjectRepository } from "../repositories/projectRepository";

const areaRepo = new AreaRepository();
const goalRepo = new GoalRepository();
const projectRepo = new ProjectRepository();

interface HierarchyState {
  areas: Area[];
  goals: Goal[];
  projects: Project[];
  isLoading: boolean;

  loadHierarchy: () => Promise<void>;
  createArea: (name: string) => Promise<Area>;
  updateArea: (id: string, name: string) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;
  createGoal: (title: string, areaId: string) => Promise<Goal>;
  updateGoal: (id: string, title: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  createProject: (title: string, parents: { goalId?: string | null; areaId?: string | null }) => Promise<Project>;
  updateProject: (id: string, title: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  areas: [],
  goals: [],
  projects: [],
  isLoading: false,

  // Single reload path: every mutation writes through its repository then
  // reloads — mirrors useTaskStore's write-then-reload convention.
  loadHierarchy: async () => {
    set({ isLoading: true });
    try {
      const [areas, goals, projects] = await Promise.all([
        areaRepo.getAllAreas(),
        goalRepo.getAllGoals(),
        projectRepo.getProjects(),
      ]);
      set({ areas, goals, projects, isLoading: false });
    } catch (e) {
      console.error("Failed to load hierarchy:", e);
      set({ isLoading: false });
    }
  },

  createArea: async (name) => {
    const area = await areaRepo.createArea({ name });
    await get().loadHierarchy();
    return area;
  },
  updateArea: async (id, name) => {
    await areaRepo.updateArea(id, { name });
    await get().loadHierarchy();
  },
  // Areas have no deleted_at (hard delete). Deleting an area removes its
  // goals explicitly — the schema does not cascade (SET NULL at best, and
  // the FK pragma is unverified natively), so orphan goals would otherwise
  // linger with a dangling reference.
  deleteArea: async (id) => {
    for (const goal of get().goals.filter((g) => g.area_id === id)) {
      await goalRepo.deleteGoal(goal.id);
    }
    await areaRepo.deleteArea(id);
    await get().loadHierarchy();
  },

  createGoal: async (title, areaId) => {
    const goal = await goalRepo.createGoal({ title, area_id: areaId });
    await get().loadHierarchy();
    return goal;
  },
  updateGoal: async (id, title) => {
    await goalRepo.updateGoal(id, { title });
    await get().loadHierarchy();
  },
  deleteGoal: async (id) => {
    await goalRepo.deleteGoal(id);
    await get().loadHierarchy();
  },

  createProject: async (title, parents) => {
    const project = await projectRepo.createProject({
      title,
      goal_id: parents.goalId ?? null,
      area_id: parents.areaId ?? null,
    });
    await get().loadHierarchy();
    return project;
  },
  updateProject: async (id, title) => {
    await projectRepo.updateProject(id, { title });
    await get().loadHierarchy();
  },
  deleteProject: async (id) => {
    await projectRepo.deleteProject(id);
    await get().loadHierarchy();
  },
}));
