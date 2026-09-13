// Planning state (planning_state table): the morning plan of record —
// primary objective plus available capacity — for one LOCAL date per row.
// Fields are optional in updates; unspecified fields keep their current
// value rather than being nulled out.
import { getDatabase } from "./database";
import { PlanningStateSchema } from "../domain/models/types";

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
    const rows = await db.select<unknown>(
      "SELECT * FROM planning_state WHERE date = ? LIMIT 1;",
      [date]
    );
    return rows[0] ? PlanningStateSchema.parse(rows[0]) : null;
  }

  // Atomic upsert on the UNIQUE(date) index — concurrent boot/load calls
  // (React StrictMode double-mount) cannot create duplicate rows or throw.
  async saveForDate(
    date: string,
    fields: { primary_objective?: string | null; available_minutes?: number | null }
  ): Promise<PlanningState> {
    const db = getDatabase();
    const now = new Date().toISOString();

    const current = await this.getForDate(date);
    const primary_objective =
      fields.primary_objective !== undefined
        ? fields.primary_objective
        : (current?.primary_objective ?? null);
    const available_minutes =
      fields.available_minutes !== undefined
        ? fields.available_minutes
        : (current?.available_minutes ?? null);

    await db.execute(
      `INSERT INTO planning_state (id, date, primary_objective, available_minutes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         primary_objective = excluded.primary_objective,
         available_minutes = excluded.available_minutes,
         updated_at = excluded.updated_at;`,
      [crypto.randomUUID(), date, primary_objective, available_minutes, now, now]
    );

    const rows = await db.select<unknown>(
      "SELECT * FROM planning_state WHERE date = ? LIMIT 1;",
      [date]
    );
    return PlanningStateSchema.parse(rows[0]);
  }
}
