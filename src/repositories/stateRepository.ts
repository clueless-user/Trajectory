import { getDatabase } from "./database";
import { DailyState } from "../domain/models/types";

export class StateRepository {
  async getDailyState(date: string): Promise<DailyState | null> {
    const db = getDatabase();
    const rows = await db.select<DailyState>(
      "SELECT * FROM daily_states WHERE date = ? ORDER BY logged_at DESC LIMIT 1;",
      [date]
    );
    return rows[0] || null;
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
    const existing = await this.getDailyState(state.date);

    if (existing) {
      await db.execute(
        `UPDATE daily_states 
         SET energy = ?, clarity = ?, stress = ?, social_battery = ?, notes = ?, logged_at = ?
         WHERE id = ?;`,
        [
          state.energy,
          state.clarity,
          state.stress,
          state.social_battery,
          state.notes || null,
          now,
          existing.id,
        ]
      );
      return {
        ...existing,
        ...state,
        notes: state.notes || null,
        logged_at: now,
      };
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO daily_states (id, date, energy, clarity, stress, social_battery, notes, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          state.date,
          state.energy,
          state.clarity,
          state.stress,
          state.social_battery,
          state.notes || null,
          now,
        ]
      );
      return {
        id,
        date: state.date,
        energy: state.energy,
        clarity: state.clarity,
        stress: state.stress,
        social_battery: state.social_battery,
        notes: state.notes || null,
        logged_at: now,
      };
    }
  }
}
