// Habit store: today's habit logs keyed by habit id. Data flow: the view
// loads habits + today's logs once per date; every log write goes through
// logHabitValue, which derives target_met_status from the habit's dual
// targets (domain/habits/consistency) before upserting — UNIQUE(habit_id,
// date) means repeated logs for the same day overwrite the prior value
// rather than creating new rows. Writes also append a fire-and-forget
// event-log entry for Phase 2B behavioral analysis.

import { create } from "zustand";
import { Habit, HabitLog } from "../domain/models/types";
import { HabitRepository } from "../repositories/habitRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";
import { evaluateTargetStatus } from "../domain/habits/consistency";

interface HabitState {
  habits: Habit[];
  todayLogs: Record<string, HabitLog>;
  isLoading: boolean;

  loadHabitsAndTodayLogs: (date: string) => Promise<void>;
  logHabitValue: (habitId: string, date: string, value: number, notes?: string) => Promise<void>;
}

const habitRepo = new HabitRepository();
const eventLog = new EventLogRepository();

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  todayLogs: {},
  isLoading: false,

  loadHabitsAndTodayLogs: async (date: string) => {
    set({ isLoading: true });
    try {
      const habits = await habitRepo.getAllHabits();
      const logs = await habitRepo.getLogsForDate(date);
      // Flatten rows into a habit-id map so O(1) lookup in the grid.
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

    // Status is derived at write time (not read time) so the DB row remains
    // the authoritative record for the rolling-consistency window.
    const targetMetStatus = evaluateTargetStatus(value, habit.normal_target, habit.minimum_target);
    const updatedLog = await habitRepo.logHabit(habitId, date, value, targetMetStatus, notes);

    set((state) => ({
      todayLogs: {
        ...state.todayLogs,
        [habitId]: updatedLog,
      },
    }));

    eventLog
      .record("habit.logged", "habit", habitId, {
        date,
        value,
        target_met_status: targetMetStatus,
      })
      .catch((e) => console.error("event log failed:", e));
  },
}));
