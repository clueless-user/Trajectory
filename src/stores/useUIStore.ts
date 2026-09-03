import { create } from "zustand";
import { ExecutionMode } from "../domain/models/types";

export type ActiveView = "today" | "deep_work" | "habits" | "brain_dump" | "review" | "projects";

interface UIState {
  activeView: ActiveView;
  activeMode: ExecutionMode;
  isRabbitHoleModalOpen: boolean;
  isNewTaskModalOpen: boolean;
  isCompressionModalOpen: boolean;
  isCommandPaletteOpen: boolean;

  setActiveView: (view: ActiveView) => void;
  setActiveMode: (mode: ExecutionMode) => void;
  setRabbitHoleModalOpen: (open: boolean) => void;
  setNewTaskModalOpen: (open: boolean) => void;
  setCompressionModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: "today",
  activeMode: "deep_work",
  isRabbitHoleModalOpen: false,
  isNewTaskModalOpen: false,
  isCompressionModalOpen: false,
  isCommandPaletteOpen: false,

  setActiveView: (view) => set({ activeView: view }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setRabbitHoleModalOpen: (open) => set({ isRabbitHoleModalOpen: open }),
  setNewTaskModalOpen: (open) => set({ isNewTaskModalOpen: open }),
  setCompressionModalOpen: (open) => set({ isCompressionModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
}));
