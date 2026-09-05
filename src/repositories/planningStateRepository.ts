import { getDatabase } from "./database";

export interface PlanningState {
  id: string;
  date: string;
  primary_objective: string | null;
  available_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Per-day planning state (primary objective + available capacity).
 * Single row per local day; the persistence behind the Now screen.
 */
export class PlanningStateRepository {
  async getForDate(date: string): Promise<PlanningState | null> {
    const db = getDatabase();
    const rows = await db.select<PlanningState>(
      "SELECT * FROM planning_state WHERE date = ? LIMIT 1;",
      [date]
    );
    return rows[0] ?? null;
  }

  async saveForDate(
    date: string,
    fields: { primary_objective?: string | null; available_minutes?: number | null }
  ): Promise<PlanningState> {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = await this.getForDate(date);
    if (existing) {
      const updated: PlanningState = {
        ...existing,
        primary_objective:
          fields.primary_objective !== undefined
            ? fields.primary_objective
            : existing.primary_objective,
        available_minutes:
          fields.available_minutes !== undefined
            ? fields.available_minutes
            : existing.available_minutes,
        updated_at: now,
      };
      await db.execute(
        "UPDATE planning_state SET primary_objective = ?, available_minutes = ?, updated_at = ? WHERE id = ?;",
        [updated.primary_objective, updated.available_minutes, now, existing.id]
      );
      return updated;
    }

    const created: PlanningState = {
      id: crypto.randomUUID(),
      date,
      primary_objective: fields.primary_objective ?? null,
      available_minutes: fields.available_minutes ?? null,
      created_at: now,
      updated_at: now,
    };
    await db.execute(
      `INSERT INTO planning_state (id, date, primary_objective, available_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [created.id, created.date, created.primary_objective, created.available_minutes, now, now]
    );
    return created;
  }
}
