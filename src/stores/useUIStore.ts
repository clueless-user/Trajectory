import { create } from "zustand";
import { ExecutionMode } from "../domain/models/types";

export type ActiveView =
  | "today"
  | "planner"
  | "deep_work"
  | "habits"
  | "brain_dump"
  | "review"
  | "projects";

interface UIState {
  activeView: ActiveView;
  activeMode: ExecutionMode;
  isRabbitHoleModalOpen: boolean;
  isNewTaskModalOpen: boolean;
  isCompressionModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  // Id of the task being edited in the task modal; null = create mode.
  editingTaskId: string | null;

  setActiveView: (view: ActiveView) => void;
  setActiveMode: (mode: ExecutionMode) => void;
  setRabbitHoleModalOpen: (open: boolean) => void;
  setNewTaskModalOpen: (open: boolean) => void;
  setCompressionModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openTaskEditor: (taskId: string) => void;
  closeTaskEditor: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: "today",
  activeMode: "deep_work",
  isRabbitHoleModalOpen: false,
  isNewTaskModalOpen: false,
  isCompressionModalOpen: false,
  isCommandPaletteOpen: false,
  editingTaskId: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setRabbitHoleModalOpen: (open) => set({ isRabbitHoleModalOpen: open }),
  setNewTaskModalOpen: (open) => set({ isNewTaskModalOpen: open, editingTaskId: null }),
  setCompressionModalOpen: (open) => set({ isCompressionModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  openTaskEditor: (taskId) => set({ isNewTaskModalOpen: true, editingTaskId: taskId }),
  closeTaskEditor: () => set({ isNewTaskModalOpen: false, editingTaskId: null }),
}));
