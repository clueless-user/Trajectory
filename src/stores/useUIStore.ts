// Global UI/navigation state: which view is mounted, which Review tab is
// active, modal open flags, and the task being edited. Pure setters only —
// no persistence, no async, no domain logic. Everything here is session-
// scoped and resets on app restart.

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

export type ReviewTab = "daily" | "weekly";

interface UIState {
  activeView: ActiveView;
  activeMode: ExecutionMode;
  // Which tab the Review view shows; command palette can target it directly.
  reviewTab: ReviewTab;
  isRabbitHoleModalOpen: boolean;
  isNewTaskModalOpen: boolean;
  isCompressionModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  // Id of the task being edited in the task modal; null = create mode.
  editingTaskId: string | null;

  setActiveView: (view: ActiveView) => void;
  setActiveMode: (mode: ExecutionMode) => void;
  setReviewTab: (tab: ReviewTab) => void;
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
  reviewTab: "daily",
  isRabbitHoleModalOpen: false,
  isNewTaskModalOpen: false,
  isCompressionModalOpen: false,
  isCommandPaletteOpen: false,
  editingTaskId: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setReviewTab: (tab) => set({ reviewTab: tab }),
  setRabbitHoleModalOpen: (open) => set({ isRabbitHoleModalOpen: open }),
  setNewTaskModalOpen: (open) => set({ isNewTaskModalOpen: open, editingTaskId: null }),
  // One modal serves create and edit modes: editingTaskId disambiguates them.
  setCompressionModalOpen: (open) => set({ isCompressionModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  openTaskEditor: (taskId) => set({ isNewTaskModalOpen: true, editingTaskId: taskId }),
  closeTaskEditor: () => set({ isNewTaskModalOpen: false, editingTaskId: null }),
}));
