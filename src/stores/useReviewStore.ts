// Evening review store: today's daily review plus a short history of recent
// ones. Data flow: ReviewView loads on mount (loadTodayReview); saving
// upserts by date so re-editing tonight's review never duplicates rows.
// The saved review's tomorrow_objective is later seeded into the next day's
// planning state by useTaskStore.loadPlanningState — the review→morning
// handoff that closes the daily loop. Every save also appends an event-log
// entry (fire-and-forget, never blocks the user action).

import { create } from "zustand";
import { DailyReview } from "../domain/models/types";
import { ReviewRepository } from "../repositories/reviewRepository";
import { EventLogRepository } from "../repositories/eventLogRepository";

interface ReviewState {
  todayReview: DailyReview | null;
  recentReviews: DailyReview[];
  isLoading: boolean;

  loadTodayReview: (date: string) => Promise<void>;
  saveReview: (review: Omit<DailyReview, "id" | "created_at">) => Promise<DailyReview>;
}

const reviewRepo = new ReviewRepository();
const eventLog = new EventLogRepository();

export const useReviewStore = create<ReviewState>((set) => ({
  todayReview: null,
  recentReviews: [],
  isLoading: false,

  loadTodayReview: async (date: string) => {
    set({ isLoading: true });
    try {
      const todayReview = await reviewRepo.getDailyReview(date);
      // Fixed 7-entry window: enough context for week-over-week patterns
      // without the weekly tab needing pagination.
      const recentReviews = await reviewRepo.getRecentReviews(7);
      set({ todayReview, recentReviews, isLoading: false });
    } catch (e) {
      console.error("Failed to load review:", e);
      set({ isLoading: false });
    }
  },

  saveReview: async (review) => {
    const saved = await reviewRepo.saveDailyReview(review);
    set((state) => ({
      todayReview: saved,
      // Prepend after removing any prior entry for the same date: the upsert
      // replaced that row, and the recent list must not show it twice.
      recentReviews: [saved, ...state.recentReviews.filter((r) => r.date !== saved.date)],
    }));

    eventLog
      .record("review.saved", "daily_review", saved.id, { date: saved.date })
      .catch((e) => console.error("event log failed:", e));
    return saved;
  },
}));
