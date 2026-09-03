import { create } from "zustand";
import { Habit, HabitLog } from "../domain/models/types";
import { HabitRepository } from "../repositories/habitRepository";
import { evaluateTargetStatus } from "../domain/habits/consistency";

interface HabitState {
  habits: Habit[];
  todayLogs: Record<string, HabitLog>;
  isLoading: boolean;

  loadHabitsAndTodayLogs: (date: string) => Promise<void>;
  logHabitValue: (habitId: string, date: string, value: number, notes?: string) => Promise<void>;
}

const habitRepo = new HabitRepository();

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  todayLogs: {},
  isLoading: false,

  loadHabitsAndTodayLogs: async (date: string) => {
    set({ isLoading: true });
    try {
      const habits = await habitRepo.getAllHabits();
      const logs = await habitRepo.getLogsForDate(date);
      const logMap: Record<string, HabitLog> = {};
      for (const log of logs) {
        logMap[log.habit_id] = log;
      }
      set({ habits, todayLogs: logMap, isLoading: false });
    } catch (e) {
      console.error("Failed to load habits:", e);
      set({ isLoading: false });
    }
  },

  logHabitValue: async (habitId: string, date: string, value: number, notes?: string) => {
    const habit = get().habits.find((h) => h.id === habitId);
    if (!habit) return;

    const targetMetStatus = evaluateTargetStatus(value, habit.normal_target, habit.minimum_target);
    const updatedLog = await habitRepo.logHabit(habitId, date, value, targetMetStatus, notes);

    set((state) => ({
      todayLogs: {
        ...state.todayLogs,
        [habitId]: updatedLog,
      },
    }));
  },
}));
