import { getDatabase } from "./database";
import { WorkSession, WorkSessionSchema } from "../domain/models/types";

function parseSession(row: unknown): WorkSession {
  const result = WorkSessionSchema.safeParse(row);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Work session record failed schema validation (${detail})`);
  }
  return result.data;
}

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

    WorkSessionSchema.parse(newSession);

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

  async deleteSession(id: string): Promise<void> {
    const db = getDatabase();
    await db.execute(`DELETE FROM work_sessions WHERE id = ?;`, [id]);
  }

  // Unfinished sessions discovered at boot (crash tombstones).
  async getPausedSessions(): Promise<WorkSession[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      `SELECT * FROM work_sessions WHERE completed_state = 'paused' ORDER BY start_time ASC;`
    );
    return rows.map(parseSession);
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

}
