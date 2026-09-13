// Rabbit holes (rabbit_holes table): curiosity tangents captured mid-work so
// they stop derailing focus. Lifecycle: 'captured' -> 'converted_task' (with
// converted_id pointing at the spawned task) or 'archived'; converted_at is
// stamped on every transition away from 'captured'.
import { getDatabase } from "./database";
import { EventLogRepository } from "./eventLogRepository";
import { RabbitHole, RabbitHoleStatus, RabbitHoleSchema } from "../domain/models/types";

export class RabbitHoleRepository {
  // Rabbit holes are written directly from components (no store layer), so
  // their lifecycle instrumentation lives at this write boundary.
  private eventLog = new EventLogRepository();

  async getAllRabbitHoles(status?: RabbitHoleStatus): Promise<RabbitHole[]> {
    const db = getDatabase();
    const rows = status
      ? await db.select<unknown>(
          "SELECT * FROM rabbit_holes WHERE status = ? ORDER BY created_at DESC;",
          [status]
        )
      : await db.select<unknown>("SELECT * FROM rabbit_holes ORDER BY created_at DESC;");
    return rows.map((r) => RabbitHoleSchema.parse(r));
  }

  async createRabbitHole(params: {
    raw_text: string;
    active_task_id?: string | null;
    active_project_id?: string | null;
  }): Promise<RabbitHole> {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: RabbitHole = {
      id,
      active_task_id: params.active_task_id || null,
      active_project_id: params.active_project_id || null,
      raw_text: params.raw_text,
      status: "captured",
      converted_id: null,
      created_at: now,
      converted_at: null,
    };

    await db.execute(
      `INSERT INTO rabbit_holes (id, active_task_id, active_project_id, raw_text, status, converted_id, created_at, converted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.active_task_id,
        record.active_project_id,
        record.raw_text,
        record.status,
        record.converted_id,
        record.created_at,
        record.converted_at,
      ]
    );

    await this.eventLog
      .record("rabbit_hole.captured", "rabbit_hole", id, {
        active_task_id: record.active_task_id,
      })
      .catch((e) => console.error("event log failed:", e));

    return record;
  }

  async updateStatus(
    id: string,
    status: RabbitHoleStatus,
    convertedId?: string
  ): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    // convertedId is only meaningful for converted_task; archive clears it.
    await db.execute(
      "UPDATE rabbit_holes SET status = ?, converted_id = ?, converted_at = ? WHERE id = ?;",
      [status, convertedId || null, now, id]
    );
    await this.eventLog
      .record(`rabbit_hole.${status}`, "rabbit_hole", id, { converted_id: convertedId || null })
      .catch((e) => console.error("event log failed:", e));
  }
}
