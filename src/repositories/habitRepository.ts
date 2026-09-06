import { getDatabase } from "./database";
import { Habit, HabitLog, HabitTargetStatus, HabitLogSchema } from "../domain/models/types";
import { addDays } from "../domain/time/date";

export class HabitRepository {
  async getAllHabits(includeArchived = false): Promise<Habit[]> {
    const db = getDatabase();
    const whereClause = includeArchived ? "" : "WHERE is_archived = 0";
    const rows = await db.select<{
      id: string;
      area_id: string | null;
      title: string;
      description: string | null;
      unit: string;
      normal_target: number;
      minimum_target: number;
      order_index: number;
      is_archived: number;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM habits ${whereClause} ORDER BY order_index ASC, created_at ASC;`);

    return rows.map((r) => ({
      ...r,
      is_archived: Boolean(r.is_archived),
    }));
  }

  async createHabit(habit: Partial<Habit> & { title: string; normal_target: number; minimum_target: number }): Promise<Habit> {
    const db = getDatabase();
    const id = habit.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const newHabit: Habit = {
      id,
      area_id: habit.area_id || null,
      title: habit.title,
      description: habit.description || null,
      unit: habit.unit || "minutes",
      normal_target: habit.normal_target,
      minimum_target: habit.minimum_target,
      order_index: habit.order_index ?? 0,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    await db.execute(
      `INSERT INTO habits (id, area_id, title, description, unit, normal_target, minimum_target, order_index, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
      [
        newHabit.id,
        newHabit.area_id,
        newHabit.title,
        newHabit.description,
        newHabit.unit,
        newHabit.normal_target,
        newHabit.minimum_target,
        newHabit.order_index,
        newHabit.created_at,
        newHabit.updated_at,
      ]
    );

    return newHabit;
  }

  async getLogsForDate(date: string): Promise<HabitLog[]> {
    const db = getDatabase();
    return await db.select<HabitLog>("SELECT * FROM habit_logs WHERE date = ?;", [date]);
  }

  async getLogsForRange(startDate: string, endDate: string): Promise<HabitLog[]> {
    const db = getDatabase();
    return await db.select<HabitLog>(
      "SELECT * FROM habit_logs WHERE date >= ? AND date <= ? ORDER BY date ASC;",
      [startDate, endDate]
    );
  }

  // Per-day target statuses for the last `days` days ending at endDate.
  // Days without a log count as "none": an unlogged day is a missed day.
  async getRecentStatuses(habitId: string, endDate: string, days: number): Promise<HabitTargetStatus[]> {
    const startDate = addDays(endDate, -(days - 1));
    const logs = await this.getLogsForRange(startDate, endDate);
    const byDate = new Map(logs.filter((l) => l.habit_id === habitId).map((l) => [l.date, l]));

    const statuses: HabitTargetStatus[] = [];
    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      statuses.push(byDate.get(date)?.target_met_status ?? "none");
    }
    return statuses;
  }

  async logHabit(
    habitId: string,
    date: string,
    value: number,
    targetMetStatus: HabitTargetStatus,
    notes?: string
  ): Promise<HabitLog> {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = await db.select<HabitLog>(
      "SELECT * FROM habit_logs WHERE habit_id = ? AND date = ? LIMIT 1;",
      [habitId, date]
    );

    if (existing.length > 0) {
      await db.execute(
        "UPDATE habit_logs SET value = ?, target_met_status = ?, notes = ?, logged_at = ? WHERE id = ?;",
        [value, targetMetStatus, notes || null, now, existing[0].id]
      );
      const updated: HabitLog = HabitLogSchema.parse({
        id: existing[0].id,
        habit_id: habitId,
        date,
        value,
        target_met_status: targetMetStatus,
        notes: notes || null,
        logged_at: now,
      });
      return updated;
    } else {
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO habit_logs (id, habit_id, date, value, target_met_status, notes, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [id, habitId, date, value, targetMetStatus, notes || null, now]
      );
      return HabitLogSchema.parse({
        id,
        habit_id: habitId,
        date,
        value,
        target_met_status: targetMetStatus,
        notes: notes || null,
        logged_at: now,
      });
    }
  }
}
