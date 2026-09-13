// Work sessions (work_sessions table): raw focus-time records per task.
// Crash-tombstone pattern: a session is created as 'paused' and later
// promoted to 'finished'/'interrupted'; a truly cancelled session is
// hard-deleted after logging an event, so a lingering 'paused' row found at
// boot means the app died mid-session. duration_seconds is authoritative.
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

  // Dynamic SET list from the update keys; id/created_at are stripped so
  // identity and creation time can never be rewritten. No-op when the
  // update contains nothing mutable.
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

  // Hard delete — used only for cancelled sessions, after their event has
  // been logged; the event log keeps the audit trail.
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

  // Phase 2B: sessions whose start falls in [startIso, endIso). Bounds are
  // UTC instants; callers derive them from local days via src/domain/time/date.ts.
  async getSessionsInRange(startIso: string, endIso: string): Promise<WorkSession[]> {
    const db = getDatabase();
    const rows = await db.select<unknown>(
      `SELECT * FROM work_sessions WHERE start_time >= ? AND start_time < ? ORDER BY start_time ASC;`,
      [startIso, endIso]
    );
    return rows.map(parseSession);
  }
}
