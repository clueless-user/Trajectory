// Evening shutdown review (daily_reviews table): one row per LOCAL date,
// captured once per day and re-editable until then. Optional text fields are
// normalised to NULL so "not filled in" is distinct from the empty string.
import { getDatabase } from "./database";
import { DailyReview, DailyReviewSchema } from "../domain/models/types";

export class ReviewRepository {
  async getDailyReview(date: string): Promise<DailyReview | null> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM daily_reviews WHERE date = ? LIMIT 1;",
      [date]
    );
    return rows[0] ? DailyReviewSchema.parse(rows[0]) : null;
  }

  // Upsert via select-then-insert/update (date is UNIQUE): a re-submitted
  // evening review edits the existing row instead of creating a second one.
  // The returned object merges the review over the existing record so
  // created_at survives an update.
  async saveDailyReview(review: Omit<DailyReview, "id" | "created_at">): Promise<DailyReview> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const existing = await this.getDailyReview(review.date);

    if (existing) {
      await db.execute(
        `UPDATE daily_reviews 
         SET completed_task_count = ?, total_work_minutes = ?, energy_drains = ?, energy_boosts = ?, tomorrow_objective = ?, reflection_notes = ?
         WHERE id = ?;`,
        [
          review.completed_task_count,
          review.total_work_minutes,
          review.energy_drains || null,
          review.energy_boosts || null,
          review.tomorrow_objective || null,
          review.reflection_notes || null,
          existing.id,
        ]
      );
      return {
        ...existing,
        ...review,
      };
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO daily_reviews (id, date, completed_task_count, total_work_minutes, energy_drains, energy_boosts, tomorrow_objective, reflection_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          review.date,
          review.completed_task_count,
          review.total_work_minutes,
          review.energy_drains || null,
          review.energy_boosts || null,
          review.tomorrow_objective || null,
          review.reflection_notes || null,
          now,
        ]
      );
      return {
        id,
        ...review,
        created_at: now,
      };
    }
  }

  async getRecentReviews(limit = 7): Promise<DailyReview[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM daily_reviews ORDER BY date DESC LIMIT ?;",
      [limit]
    );
    return rows.map((r) => DailyReviewSchema.parse(r));
  }
}
