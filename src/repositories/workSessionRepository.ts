import { getDatabase } from "./database";
import { WorkSession } from "../domain/models/types";

export class WorkSessionRepository {
  async createSession(session: Omit<WorkSession, "id" | "created_at"> & { id?: string }): Promise<WorkSession> {
    const db = getDatabase();
    const id = session.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const newSession: WorkSession = {
      id,
      task_id: session.task_id || null,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_seconds: session.duration_seconds,
      interruption_count: session.interruption_count ?? 0,
      completed_state: session.completed_state,
      notes: session.notes || null,
      created_at: now,
    };

    await db.execute(
      `INSERT INTO work_sessions (id, task_id, start_time, end_time, duration_seconds, interruption_count, completed_state, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        newSession.id,
        newSession.task_id,
        newSession.start_time,
        newSession.end_time,
        newSession.duration_seconds,
        newSession.interruption_count,
        newSession.completed_state,
        newSession.notes,
        newSession.created_at,
      ]
    );

    return newSession;
  }

  async updateSession(id: string, updates: Partial<WorkSession>): Promise<void> {
    const db = getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && key !== "created_at") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;
    values.push(id);

    await db.execute(`UPDATE work_sessions SET ${fields.join(", ")} WHERE id = ?;`, values);
  }

  async getRecentSessions(limit = 20): Promise<WorkSession[]> {
    const db = getDatabase();
    return await db.select<WorkSession>(
      `SELECT * FROM work_sessions ORDER BY start_time DESC LIMIT ?;`,
      [limit]
    );
  }

  async getSessionsForTask(taskId: string): Promise<WorkSession[]> {
    const db = getDatabase();
    return await db.select<WorkSession>(
      `SELECT * FROM work_sessions WHERE task_id = ? ORDER BY start_time DESC;`,
      [taskId]
    );
  }

  async getTodayTotalDuration(date: string): Promise<number> {
    const db = getDatabase();
    // Match sessions starting on this date (e.g. 2026-09-03%)
    const rows = await db.select<{ total: number | null }>(
      `SELECT SUM(duration_seconds) as total FROM work_sessions WHERE start_time LIKE ?;`,
      [`${date}%`]
    );
    return rows[0]?.total ?? 0;
  }
}
