// Daily subjective state store: energy/clarity/stress/social_battery, each
// rated 1-10 for the current day. Data flow: loadTodayState runs at boot and
// seeds the baseline row if the day has no record yet; updateMetric merges
// the single changed metric over the current state and upserts by date, so
// sliders write one row per day.

import { create } from "zustand";
import { DailyState } from "../domain/models/types";
import { StateRepository } from "../repositories/stateRepository";

interface StateState {
  currentState: DailyState | null;
  isLoading: boolean;
  loadTodayState: (date: string) => Promise<void>;
  updateMetric: (
    date: string,
    metric: "energy" | "clarity" | "stress" | "social_battery",
    value: number
  ) => Promise<void>;
}

const stateRepo = new StateRepository();

// The single neutral-positive daily baseline. Seeding and null-fallbacks
// must agree — they describe the same "nothing recorded yet" state.
const DAILY_STATE_BASELINE = { energy: 6, clarity: 6, stress: 4, social_battery: 5 } as const;

export const useStateStore = create<StateState>((set, get) => ({
  currentState: null,
  isLoading: false,

  loadTodayState: async (date: string) => {
    set({ isLoading: true });
    try {
      let state = await stateRepo.getDailyState(date);
      if (!state) {
        // Persist the baseline immediately (not just in-memory): the sliders
        // and any consumer reading the DB must see the same seeded day.
        state = await stateRepo.saveDailyState({ date, ...DAILY_STATE_BASELINE });
      }
      set({ currentState: state, isLoading: false });
    } catch (e) {
      console.error("Failed to load daily state:", e);
      set({ isLoading: false });
    }
  },

  updateMetric: async (date, metric, value) => {
    // Fall back to the baseline if a metric is updated before load — the
    // write must always carry all four metrics for the date row.
    const current = get().currentState || {
      date,
      ...DAILY_STATE_BASELINE,
      notes: null,
    };

    const updatedData = {
      date,
      energy: metric === "energy" ? value : current.energy,
      clarity: metric === "clarity" ? value : current.clarity,
      stress: metric === "stress" ? value : current.stress,
      social_battery: metric === "social_battery" ? value : current.social_battery,
      notes: current.notes || undefined,
    };

    const saved = await stateRepo.saveDailyState(updatedData);
    set({ currentState: saved });
  },
}));
