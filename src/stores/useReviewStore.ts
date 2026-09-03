import { create } from "zustand";
import { DailyReview } from "../domain/models/types";
import { ReviewRepository } from "../repositories/reviewRepository";

interface ReviewState {
  todayReview: DailyReview | null;
  recentReviews: DailyReview[];
  isLoading: boolean;

  loadTodayReview: (date: string) => Promise<void>;
  saveReview: (review: Omit<DailyReview, "id" | "created_at">) => Promise<DailyReview>;
}

const reviewRepo = new ReviewRepository();

export const useReviewStore = create<ReviewState>((set) => ({
  todayReview: null,
  recentReviews: [],
  isLoading: false,

  loadTodayReview: async (date: string) => {
    set({ isLoading: true });
    try {
      const todayReview = await reviewRepo.getDailyReview(date);
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
      recentReviews: [saved, ...state.recentReviews.filter((r) => r.date !== saved.date)],
    }));
    return saved;
  },
}));
