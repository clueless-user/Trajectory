import { getDatabase } from "./database";
import { DailyState, DailyStateSchema } from "../domain/models/types";

export class StateRepository {
  async getDailyState(date: string): Promise<DailyState | null> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      "SELECT * FROM daily_states WHERE date = ? ORDER BY logged_at DESC LIMIT 1;",
      [date]
    );
    return rows[0] ? DailyStateSchema.parse(rows[0]) : null;
  }

  async saveDailyState(state: {
    date: string;
    energy: number;
    clarity: number;
    stress: number;
    social_battery: number;
    notes?: string;
  }): Promise<DailyState> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO daily_states (id, date, energy, clarity, stress, social_battery, notes, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         energy = excluded.energy,
         clarity = excluded.clarity,
         stress = excluded.stress,
         social_battery = excluded.social_battery,
         notes = excluded.notes,
         logged_at = excluded.logged_at;`,
      [id, state.date, state.energy, state.clarity, state.stress, state.social_battery, state.notes || null, now]
    );
    const rows = await db.select<unknown>(
      "SELECT * FROM daily_states WHERE date = ? ORDER BY logged_at DESC LIMIT 1;",
      [state.date]
    );
    return DailyStateSchema.parse(rows[0]);

  }
}
